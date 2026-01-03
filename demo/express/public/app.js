function scimApp() {
  const API_BASE = window.location.origin;

  return {
    activeTab: 'users',
    viewMode: 'list', // 'list' or 'editUser' or 'editGroup'
    users: [],
    groups: [],
    allGroups: [], // All groups for dropdowns (not paginated)
    loadingUsers: false,
    loadingGroups: false,
    error: null,
    success: null,
    showGroupModal: false,
    showMembersModal: false,
    showConfigModal: false,
    serviceProviderConfig: null, // null means loading, {} means loaded but empty
    resourceTypes: null, // null means loading, [] means loaded but empty
    schemas: null, // null means loading, [] means loaded but empty
    editingUser: null,
    editingGroup: null,
    selectedGroup: null,
    selectedUserToAdd: '',
    selectedGroupToAdd: '',
    userSearchQuery: '',
    groupSearchQuery: '',
    userPage: 1,
    userPageSize: 12,
    groupPage: 1,
    groupPageSize: 12,
    userTotalResults: 0,
    groupTotalResults: 0,
    userPagination: {},
    groupPagination: {},
    userForm: {
      userName: '',
      name: {
        formatted: '',
        familyName: '',
        givenName: '',
        middleName: '',
        honorificPrefix: '',
        honorificSuffix: '',
      },
      displayName: '',
      nickName: '',
      profileUrl: '',
      title: '',
      userType: '',
      preferredLanguage: '',
      locale: '',
      timezone: '',
      active: true,
      password: '',
      emails: [],
      phoneNumbers: [],
      addresses: [],
      ims: [],
      photos: [],
      entitlements: [],
      roles: [],
      x509Certificates: [],
      manager: '',
      schemas: ['urn:ietf:params:scim:schemas:core:2.0:User'],
    },
    groupForm: {
      displayName: '',
      schemas: ['urn:ietf:params:scim:schemas:core:2.0:Group'],
    },

    get availableUsers() {
      if (!this.selectedGroup) return this.users;
      const memberIds = new Set(
        (this.selectedGroup.members || []).map(m => m.value)
      );
      return this.users.filter(user => !memberIds.has(user.id));
    },

    get availableManagers() {
      // Exclude the current user being edited from the manager list
      if (!this.editingUser) return this.users;
      return this.users.filter(user => user.id !== this.editingUser.id);
    },

    getUserDisplayName(user) {
      if (!user) return '';
      const nameParts = [];
      if (user.name?.givenName) nameParts.push(user.name.givenName);
      if (user.name?.familyName) nameParts.push(user.name.familyName);
      if (nameParts.length > 0) return `${nameParts.join(' ')} (${user.userName})`;
      if (user.displayName) return `${user.displayName} (${user.userName})`;
      return user.userName || '';
    },

    getMemberDisplayName(member) {
      if (!member || !member.value) return member?.display || member?.value || 'Unknown';
      
      // Try to find the user in the users array
      const user = this.users.find(u => u.id === member.value);
      if (user) {
        // Construct full name from name components
        const nameParts = [];
        if (user.name?.givenName) nameParts.push(user.name.givenName);
        if (user.name?.familyName) nameParts.push(user.name.familyName);
        if (nameParts.length > 0) return nameParts.join(' ');
        
        // Fall back to displayName or userName
        if (user.displayName) return user.displayName;
        if (user.userName) return user.userName;
      }
      
      // Fall back to member.display or member.value
      return member.display || member.value;
    },

    async loadUsers() {
      this.loadingUsers = true;
      this.error = null;
      try {
        // Build query parameters for server-side filtering and pagination
        const params = new URLSearchParams();

        // Add filter if search query is provided
        if (this.userSearchQuery && this.userSearchQuery.trim()) {
          params.append('filter', this.userSearchQuery.trim());
        }

        // Add pagination parameters (SCIM uses 1-based startIndex)
        const startIndex = (this.userPage - 1) * this.userPageSize + 1;
        params.append('startIndex', startIndex.toString());
        params.append('count', this.userPageSize.toString());

        const response = await fetch(`${API_BASE}/Users?${params.toString()}`);
        if (!response.ok) {
          const error = await response.json();
          // SCIM errors have a detail field, use it directly
          if (error.detail) {
            throw { message: error.detail, isScimError: true };
          }
          throw new Error(error.detail || `HTTP ${response.status}`);
        }
        const data = await response.json();
        this.users = data.Resources || [];
        this.userTotalResults = data.totalResults || 0;
        this.userPagination = {
          startIndex: data.startIndex,
          itemsPerPage: data.itemsPerPage,
        };
      } catch (err) {
        // Show SCIM error details directly, or format other errors
        if (err.isScimError) {
          this.error = err.message;
        } else {
          this.error = `Failed to load users: ${err.message}`;
        }
        this.users = [];
        this.userTotalResults = 0;
      } finally {
        this.loadingUsers = false;
      }
    },

    async loadGroups() {
      this.loadingGroups = true;
      this.error = null;
      try {
        // Build query parameters for server-side filtering and pagination
        const params = new URLSearchParams();

        // Add filter if search query is provided
        if (this.groupSearchQuery && this.groupSearchQuery.trim()) {
          params.append('filter', this.groupSearchQuery.trim());
        }

        // Add pagination parameters (SCIM uses 1-based startIndex)
        const startIndex = (this.groupPage - 1) * this.groupPageSize + 1;
        params.append('startIndex', startIndex.toString());
        params.append('count', this.groupPageSize.toString());

        const response = await fetch(`${API_BASE}/Groups?${params.toString()}`);
        if (!response.ok) {
          const error = await response.json();
          // SCIM errors have a detail field, use it directly
          if (error.detail) {
            throw { message: error.detail, isScimError: true };
          }
          throw new Error(error.detail || `HTTP ${response.status}`);
        }
        const data = await response.json();
        this.groups = data.Resources || [];
        this.groupTotalResults = data.totalResults || 0;
        this.groupPagination = {
          startIndex: data.startIndex,
          itemsPerPage: data.itemsPerPage,
        };
        
        // If we're loading the first page with no filter, also update allGroups
        if (this.groupPage === 1 && !this.groupSearchQuery && this.groups.length > 0) {
          // If we got all groups (totalResults <= page size), use these
          if (data.totalResults <= this.groupPageSize) {
            this.allGroups = this.groups;
          } else {
            // Otherwise, load all groups separately
            this.loadAllGroups();
          }
        }
      } catch (err) {
        // Show SCIM error details directly, or format other errors
        if (err.isScimError) {
          this.error = err.message;
        } else {
          this.error = `Failed to load groups: ${err.message}`;
        }
        this.groups = [];
        this.groupTotalResults = 0;
      } finally {
        this.loadingGroups = false;
      }
    },

    async loadAllGroups() {
      // Load all groups without pagination for use in dropdowns
      try {
        const params = new URLSearchParams();
        // Request a large number to get all groups (most implementations support this)
        params.append('startIndex', '1');
        params.append('count', '1000');

        const response = await fetch(`${API_BASE}/Groups?${params.toString()}`);
        if (response.ok) {
          const data = await response.json();
          // Store all groups in a separate property for dropdowns
          this.allGroups = data.Resources || [];
          console.log('Loaded all groups:', this.allGroups.length);
        } else {
          console.error('Failed to load all groups, response not ok:', response.status);
          // Fallback to current groups if available
          if (this.groups && this.groups.length > 0) {
            this.allGroups = this.groups;
          }
        }
      } catch (err) {
        console.error('Failed to load all groups:', err);
        // Fallback to current groups if available
        if (this.groups && this.groups.length > 0) {
          this.allGroups = this.groups;
        } else {
          this.allGroups = [];
        }
      }
    },

    async openCreateUser() {
      this.editingUser = null;
      this.viewMode = 'editUser';
      // Load all groups for group selection when creating a new user
      await this.loadAllGroups();
      this.userForm = {
        userName: '',
        name: {
          formatted: '',
          familyName: '',
          givenName: '',
          middleName: '',
          honorificPrefix: '',
          honorificSuffix: '',
        },
        displayName: '',
        nickName: '',
        profileUrl: '',
        title: '',
        userType: '',
        preferredLanguage: '',
        locale: '',
        timezone: '',
        active: true,
        password: '',
        emails: [],
        phoneNumbers: [],
        addresses: [],
        ims: [],
        photos: [],
        entitlements: [],
        roles: [],
        x509Certificates: [],
        manager: '',
        schemas: ['urn:ietf:params:scim:schemas:core:2.0:User'],
      };
    },

    async openEditUser(user) {
      this.editingUser = user;
      this.viewMode = 'editUser';

      // Load all groups for group selection (use a large count to get all groups)
      // Do this first to ensure groups are available
      if (!this.allGroups || this.allGroups.length === 0) {
        await this.loadAllGroups();
      }

      // Load full user details if we only have list view data
      try {
        const response = await fetch(`${API_BASE}/Users/${user.id}`);
        if (response.ok) {
          const fullUser = await response.json();
          this.editingUser = fullUser;
          this.populateUserForm(fullUser);
        } else {
          this.populateUserForm(user);
        }
      } catch (err) {
        this.populateUserForm(user);
      }
      
      // Ensure groups are loaded after user is loaded
      if (!this.allGroups || this.allGroups.length === 0) {
        await this.loadAllGroups();
      }
    },

    populateUserForm(user) {
      // Extract manager from Enterprise User Extension
      const enterpriseUser = user['urn:ietf:params:scim:schemas:extension:enterprise:2.0:User'];
      const managerValue = enterpriseUser?.manager?.value || '';

      this.userForm = {
        userName: user.userName || '',
        name: {
          formatted: user.name?.formatted || '',
          familyName: user.name?.familyName || '',
          givenName: user.name?.givenName || '',
          middleName: user.name?.middleName || '',
          honorificPrefix: user.name?.honorificPrefix || '',
          honorificSuffix: user.name?.honorificSuffix || '',
        },
        displayName: user.displayName || '',
        nickName: user.nickName || '',
        profileUrl: user.profileUrl || '',
        title: user.title || '',
        userType: user.userType || '',
        preferredLanguage: user.preferredLanguage || '',
        locale: user.locale || '',
        timezone: user.timezone || '',
        active: user.active !== false,
        password: '',
        emails: user.emails ? [...user.emails] : [],
        phoneNumbers: user.phoneNumbers ? [...user.phoneNumbers] : [],
        addresses: user.addresses ? [...user.addresses] : [],
        ims: user.ims ? [...user.ims] : [],
        photos: user.photos ? [...user.photos] : [],
        entitlements: user.entitlements ? [...user.entitlements] : [],
        roles: user.roles ? [...user.roles] : [],
        x509Certificates: user.x509Certificates
          ? [...user.x509Certificates]
          : [],
        manager: managerValue,
        schemas: user.schemas || ['urn:ietf:params:scim:schemas:core:2.0:User'],
      };
    },

    closeUserEditor() {
      this.viewMode = 'list';
      this.editingUser = null;
    },

    async saveUser() {
      this.error = null;
      this.success = null;

      // Build user object with all fields
      const userData = {
        schemas: this.userForm.schemas,
        userName: this.userForm.userName,
        active: this.userForm.active,
      };

      // Name object
      const nameFields = {};
      if (this.userForm.name.formatted)
        nameFields.formatted = this.userForm.name.formatted;
      if (this.userForm.name.familyName)
        nameFields.familyName = this.userForm.name.familyName;
      if (this.userForm.name.givenName)
        nameFields.givenName = this.userForm.name.givenName;
      if (this.userForm.name.middleName)
        nameFields.middleName = this.userForm.name.middleName;
      if (this.userForm.name.honorificPrefix)
        nameFields.honorificPrefix = this.userForm.name.honorificPrefix;
      if (this.userForm.name.honorificSuffix)
        nameFields.honorificSuffix = this.userForm.name.honorificSuffix;
      if (Object.keys(nameFields).length > 0) {
        userData.name = nameFields;
      }

      // Simple string fields
      if (this.userForm.displayName)
        userData.displayName = this.userForm.displayName;
      if (this.userForm.nickName) userData.nickName = this.userForm.nickName;
      if (this.userForm.profileUrl)
        userData.profileUrl = this.userForm.profileUrl;
      if (this.userForm.title) userData.title = this.userForm.title;
      if (this.userForm.userType) userData.userType = this.userForm.userType;
      if (this.userForm.preferredLanguage)
        userData.preferredLanguage = this.userForm.preferredLanguage;
      if (this.userForm.locale) userData.locale = this.userForm.locale;
      if (this.userForm.timezone) userData.timezone = this.userForm.timezone;
      if (this.userForm.password) userData.password = this.userForm.password;

      // Array fields (only include if not empty)
      if (this.userForm.emails.length > 0)
        userData.emails = this.userForm.emails;
      if (this.userForm.phoneNumbers.length > 0)
        userData.phoneNumbers = this.userForm.phoneNumbers;
      if (this.userForm.addresses.length > 0)
        userData.addresses = this.userForm.addresses;
      if (this.userForm.ims.length > 0) userData.ims = this.userForm.ims;
      if (this.userForm.photos.length > 0)
        userData.photos = this.userForm.photos;
      if (this.userForm.entitlements.length > 0)
        userData.entitlements = this.userForm.entitlements;
      if (this.userForm.roles.length > 0) userData.roles = this.userForm.roles;
      if (this.userForm.x509Certificates.length > 0)
        userData.x509Certificates = this.userForm.x509Certificates;

      // Enterprise User Extension - Manager
      const enterpriseUser = this.editingUser?.['urn:ietf:params:scim:schemas:extension:enterprise:2.0:User'];
      if (this.userForm.manager || enterpriseUser) {
        // Add Enterprise User Extension schema if not already present
        if (!userData.schemas.includes('urn:ietf:params:scim:schemas:extension:enterprise:2.0:User')) {
          userData.schemas.push('urn:ietf:params:scim:schemas:extension:enterprise:2.0:User');
        }
        // Preserve existing enterprise user extension fields, update manager
        const enterpriseData = { ...(enterpriseUser || {}) };
        if (this.userForm.manager) {
          enterpriseData.manager = { value: this.userForm.manager };
        } else if (enterpriseUser?.manager) {
          // Clear manager by omitting it (or set to null if server requires it)
          delete enterpriseData.manager;
        }
        userData['urn:ietf:params:scim:schemas:extension:enterprise:2.0:User'] = enterpriseData;
      }

      try {
        let response;
        if (this.editingUser) {
          // Update existing user
          response = await fetch(`${API_BASE}/Users/${this.editingUser.id}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(userData),
          });
        } else {
          // Create new user
          response = await fetch(`${API_BASE}/Users`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(userData),
          });
        }

        if (!response.ok) {
          const error = await response.json();
          // SCIM errors have a detail field, use it directly
          if (error.detail) {
            throw { message: error.detail, isScimError: true };
          }
          throw new Error(error.detail || `HTTP ${response.status}`);
        }

        this.success = this.editingUser
          ? 'User updated successfully'
          : 'User created successfully';
        this.closeUserEditor();
        this.userPage = 1; // Reset to first page after create/update
        await this.loadUsers();
        setTimeout(() => {
          this.success = null;
        }, 3000);
      } catch (err) {
        // Show SCIM error details directly, or format other errors
        if (err.isScimError) {
          this.error = err.message;
        } else {
          this.error = `Failed to save user: ${err.message}`;
        }
      }
    },

    // Helper functions for managing array fields
    addEmail() {
      this.userForm.emails.push({ value: '', type: '', primary: false });
    },
    removeEmail(index) {
      this.userForm.emails.splice(index, 1);
    },
    addPhoneNumber() {
      this.userForm.phoneNumbers.push({ value: '', type: '', primary: false });
    },
    removePhoneNumber(index) {
      this.userForm.phoneNumbers.splice(index, 1);
    },
    addAddress() {
      this.userForm.addresses.push({
        formatted: '',
        streetAddress: '',
        locality: '',
        region: '',
        postalCode: '',
        country: '',
        type: '',
        primary: false,
      });
    },
    removeAddress(index) {
      this.userForm.addresses.splice(index, 1);
    },
    addIM() {
      this.userForm.ims.push({ value: '', type: '', primary: false });
    },
    removeIM(index) {
      this.userForm.ims.splice(index, 1);
    },
    addPhoto() {
      this.userForm.photos.push({ value: '', type: '', primary: false });
    },
    removePhoto(index) {
      this.userForm.photos.splice(index, 1);
    },
    addEntitlement() {
      this.userForm.entitlements.push({
        value: '',
        type: '',
        primary: false,
        display: '',
      });
    },
    removeEntitlement(index) {
      this.userForm.entitlements.splice(index, 1);
    },
    addRole() {
      this.userForm.roles.push({
        value: '',
        type: '',
        primary: false,
        display: '',
      });
    },
    removeRole(index) {
      this.userForm.roles.splice(index, 1);
    },
    addX509Certificate() {
      this.userForm.x509Certificates.push({
        value: '',
        type: '',
        primary: false,
      });
    },
    removeX509Certificate(index) {
      this.userForm.x509Certificates.splice(index, 1);
    },

    // Group management functions
    get availableGroupsForUser() {
      // Use allGroups if available, otherwise fall back to groups
      let groupsList = [];
      if (this.allGroups && this.allGroups.length > 0) {
        groupsList = this.allGroups;
      } else if (this.groups && this.groups.length > 0) {
        groupsList = this.groups;
      }
      
      if (!groupsList || groupsList.length === 0) {
        return [];
      }
      
      // Filter out groups without IDs
      groupsList = groupsList.filter(group => group && group.id);
      
      // If editing a user, filter out groups they're already in
      if (this.editingUser && this.editingUser.groups) {
        const userGroupIds = new Set(
          (this.editingUser.groups || []).map(g => g && g.value).filter(Boolean)
        );
        return groupsList.filter(group => !userGroupIds.has(group.id));
      }
      
      // If creating a new user or no groups assigned, return all groups
      return groupsList;
    },

    async addUserToGroup() {
      if (!this.selectedGroupToAdd || !this.editingUser) return;

      this.error = null;
      this.success = null;

      try {
        const groupsList = this.allGroups && this.allGroups.length > 0 ? this.allGroups : this.groups;
        const group = groupsList.find(g => g.id === this.selectedGroupToAdd);
        const memberValue = {
          value: this.editingUser.id,
          display: this.editingUser.displayName || this.editingUser.userName,
        };

        const patchRequest = {
          schemas: ['urn:ietf:params:scim:api:messages:2.0:PatchOp'],
          Operations: [
            {
              op: 'add',
              path: 'members',
              value: memberValue,
            },
          ],
        };

        const response = await fetch(
          `${API_BASE}/Groups/${this.selectedGroupToAdd}`,
          {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(patchRequest),
          }
        );

        if (!response.ok) {
          const error = await response.json();
          if (error.detail) {
            throw { message: error.detail, isScimError: true };
          }
          throw new Error(error.detail || `HTTP ${response.status}`);
        }

        // Reload user to get updated groups
        const userResponse = await fetch(
          `${API_BASE}/Users/${this.editingUser.id}`
        );
        if (userResponse.ok) {
          this.editingUser = await userResponse.json();
        }

        this.success = 'User added to group successfully';
        this.selectedGroupToAdd = '';
        await this.loadGroups(); // Refresh groups list
        await this.loadAllGroups(); // Refresh all groups for dropdown
        setTimeout(() => {
          this.success = null;
        }, 3000);
      } catch (err) {
        if (err.isScimError) {
          this.error = err.message;
        } else {
          this.error = `Failed to add user to group: ${err.message}`;
        }
      }
    },

    async removeUserFromGroup(groupId) {
      if (!this.editingUser) return;

      this.error = null;
      this.success = null;

      try {
        const patchRequest = {
          schemas: ['urn:ietf:params:scim:api:messages:2.0:PatchOp'],
          Operations: [
            {
              op: 'remove',
              path: `members[value eq "${this.editingUser.id}"]`,
            },
          ],
        };

        const response = await fetch(`${API_BASE}/Groups/${groupId}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(patchRequest),
        });

        if (!response.ok) {
          const error = await response.json();
          if (error.detail) {
            throw { message: error.detail, isScimError: true };
          }
          throw new Error(error.detail || `HTTP ${response.status}`);
        }

        // Reload user to get updated groups
        const userResponse = await fetch(
          `${API_BASE}/Users/${this.editingUser.id}`
        );
        if (userResponse.ok) {
          this.editingUser = await userResponse.json();
        }

        this.success = 'User removed from group successfully';
        await this.loadGroups(); // Refresh groups list
        await this.loadAllGroups(); // Refresh all groups for dropdown
        setTimeout(() => {
          this.success = null;
        }, 3000);
      } catch (err) {
        if (err.isScimError) {
          this.error = err.message;
        } else {
          this.error = `Failed to remove user from group: ${err.message}`;
        }
      }
    },

    async deleteUser(userId) {
      if (!confirm('Are you sure you want to delete this user?')) {
        return;
      }

      this.error = null;
      this.success = null;

      try {
        const response = await fetch(`${API_BASE}/Users/${userId}`, {
          method: 'DELETE',
        });

        if (!response.ok) {
          const error = await response.json();
          // SCIM errors have a detail field, use it directly
          if (error.detail) {
            throw { message: error.detail, isScimError: true };
          }
          throw new Error(error.detail || `HTTP ${response.status}`);
        }

        this.success = 'User deleted successfully';
        // If we're on a page that might be empty after deletion, go back a page
        if (this.users.length === 1 && this.userPage > 1) {
          this.userPage = this.userPage - 1;
        }
        await this.loadUsers();
        setTimeout(() => {
          this.success = null;
        }, 3000);
      } catch (err) {
        // Show SCIM error details directly, or format other errors
        if (err.isScimError) {
          this.error = err.message;
        } else {
          this.error = `Failed to delete user: ${err.message}`;
        }
      }
    },

    openCreateGroupModal() {
      this.editingGroup = null;
      this.groupForm = {
        displayName: '',
        schemas: ['urn:ietf:params:scim:schemas:core:2.0:Group'],
      };
      this.showGroupModal = true;
    },

    openEditGroupModal(group) {
      this.editingGroup = group;
      this.groupForm = {
        displayName: group.displayName || '',
        schemas: group.schemas || [
          'urn:ietf:params:scim:schemas:core:2.0:Group',
        ],
      };
      this.showGroupModal = true;
    },

    closeGroupModal() {
      this.showGroupModal = false;
      this.editingGroup = null;
    },

    async saveGroup() {
      this.error = null;
      this.success = null;

      const groupData = {
        schemas: this.groupForm.schemas,
        displayName: this.groupForm.displayName,
      };

      try {
        let response;
        if (this.editingGroup) {
          // Update existing group
          response = await fetch(`${API_BASE}/Groups/${this.editingGroup.id}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(groupData),
          });
        } else {
          // Create new group
          response = await fetch(`${API_BASE}/Groups`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(groupData),
          });
        }

        if (!response.ok) {
          const error = await response.json();
          // SCIM errors have a detail field, use it directly
          if (error.detail) {
            throw { message: error.detail, isScimError: true };
          }
          throw new Error(error.detail || `HTTP ${response.status}`);
        }

        this.success = this.editingGroup
          ? 'Group updated successfully'
          : 'Group created successfully';
        this.closeGroupModal();
        this.groupPage = 1; // Reset to first page after create/update
        await this.loadGroups();
        await this.loadAllGroups(); // Refresh all groups for dropdown
        setTimeout(() => {
          this.success = null;
        }, 3000);
      } catch (err) {
        // Show SCIM error details directly, or format other errors
        if (err.isScimError) {
          this.error = err.message;
        } else {
          this.error = `Failed to save group: ${err.message}`;
        }
      }
    },

    async deleteGroup(groupId) {
      if (!confirm('Are you sure you want to delete this group?')) {
        return;
      }

      this.error = null;
      this.success = null;

      try {
        const response = await fetch(`${API_BASE}/Groups/${groupId}`, {
          method: 'DELETE',
        });

        if (!response.ok) {
          const error = await response.json();
          // SCIM errors have a detail field, use it directly
          if (error.detail) {
            throw { message: error.detail, isScimError: true };
          }
          throw new Error(error.detail || `HTTP ${response.status}`);
        }

        this.success = 'Group deleted successfully';
        // If we're on a page that might be empty after deletion, go back a page
        if (this.groups.length === 1 && this.groupPage > 1) {
          this.groupPage = this.groupPage - 1;
        }
        await this.loadGroups();
        await this.loadAllGroups(); // Refresh all groups for dropdown
        setTimeout(() => {
          this.success = null;
        }, 3000);
      } catch (err) {
        // Show SCIM error details directly, or format other errors
        if (err.isScimError) {
          this.error = err.message;
        } else {
          this.error = `Failed to delete group: ${err.message}`;
        }
      }
    },

    openManageMembersModal(group) {
      this.selectedGroup = group;
      this.selectedUserToAdd = '';
      this.showMembersModal = true;
    },

    closeMembersModal() {
      this.showMembersModal = false;
      this.selectedGroup = null;
      this.selectedUserToAdd = '';
    },

    async addMemberToGroup() {
      if (!this.selectedUserToAdd || !this.selectedGroup) return;

      this.error = null;
      this.success = null;

      try {
        // Find the user to get their display name
        const user = this.users.find(u => u.id === this.selectedUserToAdd);
        const memberValue = {
          value: this.selectedUserToAdd,
          display: user ? user.displayName || user.userName : undefined,
        };

        const patchRequest = {
          schemas: ['urn:ietf:params:scim:api:messages:2.0:PatchOp'],
          Operations: [
            {
              op: 'add',
              path: 'members',
              value: memberValue,
            },
          ],
        };

        const response = await fetch(
          `${API_BASE}/Groups/${this.selectedGroup.id}`,
          {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(patchRequest),
          }
        );

        if (!response.ok) {
          const error = await response.json();
          // SCIM errors have a detail field, use it directly
          if (error.detail) {
            throw { message: error.detail, isScimError: true };
          }
          throw new Error(error.detail || `HTTP ${response.status}`);
        }

        const updatedGroup = await response.json();
        this.selectedGroup = updatedGroup;

        // Update the group in the groups array
        const index = this.groups.findIndex(g => g.id === updatedGroup.id);
        if (index !== -1) {
          this.groups[index] = updatedGroup;
        }

        this.success = 'Member added successfully';
        this.selectedUserToAdd = '';
        setTimeout(() => {
          this.success = null;
        }, 3000);
      } catch (err) {
        // Show SCIM error details directly, or format other errors
        if (err.isScimError) {
          this.error = err.message;
        } else {
          this.error = `Failed to add member: ${err.message}`;
        }
      }
    },

    async removeMemberFromGroup(memberId) {
      if (!this.selectedGroup) return;

      this.error = null;
      this.success = null;

      try {
        const patchRequest = {
          schemas: ['urn:ietf:params:scim:api:messages:2.0:PatchOp'],
          Operations: [
            {
              op: 'remove',
              path: `members[value eq "${memberId}"]`,
            },
          ],
        };

        const response = await fetch(
          `${API_BASE}/Groups/${this.selectedGroup.id}`,
          {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(patchRequest),
          }
        );

        if (!response.ok) {
          const error = await response.json();
          // SCIM errors have a detail field, use it directly
          if (error.detail) {
            throw { message: error.detail, isScimError: true };
          }
          throw new Error(error.detail || `HTTP ${response.status}`);
        }

        const updatedGroup = await response.json();
        this.selectedGroup = updatedGroup;

        // Update the group in the groups array
        const index = this.groups.findIndex(g => g.id === updatedGroup.id);
        if (index !== -1) {
          this.groups[index] = updatedGroup;
        }

        this.success = 'Member removed successfully';
        setTimeout(() => {
          this.success = null;
        }, 3000);
      } catch (err) {
        // Show SCIM error details directly, or format other errors
        if (err.isScimError) {
          this.error = err.message;
        } else {
          this.error = `Failed to remove member: ${err.message}`;
        }
      }
    },

    async loadConfig() {
      try {
        const [configResponse, resourceTypesResponse, schemasResponse] = await Promise.all([
          fetch(`${API_BASE}/ServiceProviderConfig`),
          fetch(`${API_BASE}/ResourceTypes`),
          fetch(`${API_BASE}/Schemas`),
        ]);

        if (configResponse.ok) {
          this.serviceProviderConfig = await configResponse.json();
        } else {
          // Set to empty object if request fails
          this.serviceProviderConfig = {};
          console.error('Failed to load ServiceProviderConfig:', configResponse.status, configResponse.statusText);
        }
        if (resourceTypesResponse.ok) {
          const resourceTypesData = await resourceTypesResponse.json();
          this.resourceTypes = resourceTypesData.Resources || [];
        } else {
          // Set to empty array if request fails
          this.resourceTypes = [];
          console.error('Failed to load ResourceTypes:', resourceTypesResponse.status, resourceTypesResponse.statusText);
        }
        if (schemasResponse.ok) {
          const schemasData = await schemasResponse.json();
          this.schemas = schemasData.Resources || [];
        } else {
          // Set to empty array if request fails
          this.schemas = [];
          console.error('Failed to load Schemas:', schemasResponse.status, schemasResponse.statusText);
        }
      } catch (err) {
        console.error('Failed to load SCIM configuration:', err);
        // Set defaults on error - use empty values to indicate loaded but failed
        this.serviceProviderConfig = {};
        this.resourceTypes = [];
        this.schemas = [];
      }
    },

    openConfigModal() {
      this.showConfigModal = true;
    },

    closeConfigModal() {
      this.showConfigModal = false;
    },
  };
}
