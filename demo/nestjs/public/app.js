function app() {
  const API_BASE = window.location.origin;

  return {
    activeTab: 'users',
    viewMode: 'list', // 'list' or 'editUser'
    users: [],
    teams: [],
    loadingUsers: false,
    loadingTeams: false,
    synchronizing: false,
    error: null,
    success: null,
    showTeamModal: false,
    showMembersModal: false,
    showSyncModal: false,
    showConfigModal: false,
    syncDeleteOrphaned: false,
    serviceProviderConfig: null,
    resourceTypes: [],
    schemas: [],
    editingUser: null,
    editingTeam: null,
    selectedTeam: null,
    selectedUserToAdd: '',
    selectedTeamToAdd: '',
    selectedTeamRole: 'viewer',
    selectedMemberRole: 'viewer',
    userSearchQuery: '',
    teamSearchQuery: '',
    userPage: 1,
    userPageSize: 12,
    teamPage: 1,
    teamPageSize: 12,
    userTotal: 0,
    teamTotal: 0,
    userTeams: [], // Teams the current editing user belongs to

    userForm: {
      userName: '',
      managerId: '',
      name: {
        firstName: '',
        lastName: '',
      },
      email: {
        primary: '',
        alternate: '',
      },
      phone: {
        mobile: '',
        home: '',
        office: '',
      },
      address: {
        street: '',
        street2: '',
        city: '',
        state: '',
        postalCode: '',
        country: '',
      },
      attributes: [],
    },

    teamForm: {
      name: '',
      description: '',
    },

    get availableUsers() {
      if (!this.selectedTeam) return this.users;
      const memberIds = new Set(
        (this.selectedTeam.members || []).map((m) => m.userId),
      );
      return this.users.filter((user) => !memberIds.has(user.id));
    },

    get availableTeamsForUser() {
      if (!this.editingUser) return this.teams;
      const userTeamIds = new Set(
        this.userTeams.map((t) => t.id),
      );
      return this.teams.filter((team) => !userTeamIds.has(team.id));
    },

    get availableManagers() {
      // When editing, exclude the current user from the manager list
      if (this.editingUser) {
        return this.users.filter((user) => user.id !== this.editingUser.id);
      }
      // When creating, all users can be managers
      return this.users;
    },

    getUserName(userId) {
      const user = this.users.find((u) => u.id === userId);
      return user ? user.userName : userId;
    },

    async loadUsers() {
      this.loadingUsers = true;
      this.error = null;
      try {
        const params = new URLSearchParams();
        params.append('page', this.userPage.toString());
        params.append('limit', this.userPageSize.toString());
        if (this.userSearchQuery && this.userSearchQuery.trim()) {
          params.append('search', this.userSearchQuery.trim());
        }

        const response = await fetch(`${API_BASE}/users?${params.toString()}`);
        if (!response.ok) {
          const error = await response.json().catch(() => ({ message: `HTTP ${response.status}` }));
          throw new Error(error.message || `HTTP ${response.status}`);
        }
        const data = await response.json();
        this.users = data.users || [];
        this.userTotal = data.total || 0;
      } catch (err) {
        this.error = `Failed to load users: ${err.message}`;
        this.users = [];
        this.userTotal = 0;
      } finally {
        this.loadingUsers = false;
      }
    },

    async loadAllUsers() {
      // Load all users without pagination for dropdowns
      try {
        const response = await fetch(`${API_BASE}/users?limit=10000`);
        if (response.ok) {
          const data = await response.json();
          // Merge with existing users, avoiding duplicates
          const existingIds = new Set(this.users.map(u => u.id));
          const newUsers = (data.users || []).filter(u => !existingIds.has(u.id));
          this.users = [...this.users, ...newUsers];
        }
      } catch (err) {
        // Silently fail - we'll just use the users we already have
        console.error('Failed to load all users:', err);
      }
    },

    async loadTeams() {
      this.loadingTeams = true;
      this.error = null;
      try {
        const params = new URLSearchParams();
        params.append('page', this.teamPage.toString());
        params.append('limit', this.teamPageSize.toString());
        if (this.teamSearchQuery && this.teamSearchQuery.trim()) {
          params.append('search', this.teamSearchQuery.trim());
        }

        const response = await fetch(`${API_BASE}/teams?${params.toString()}`);
        if (!response.ok) {
          const error = await response.json().catch(() => ({ message: `HTTP ${response.status}` }));
          throw new Error(error.message || `HTTP ${response.status}`);
        }
        const data = await response.json();
        this.teams = data.teams || [];
        this.teamTotal = data.total || 0;
      } catch (err) {
        this.error = `Failed to load teams: ${err.message}`;
        this.teams = [];
        this.teamTotal = 0;
      } finally {
        this.loadingTeams = false;
      }
    },

    async loadUserTeams() {
      if (!this.editingUser) {
        this.userTeams = [];
        return;
      }

      try {
        const allTeams = await fetch(`${API_BASE}/teams?limit=1000`).then((r) => r.json());
        this.userTeams = (allTeams.teams || [])
          .filter((team) =>
            team.members?.some((m) => m.userId === this.editingUser.id),
          )
          .map((team) => {
            const member = team.members.find((m) => m.userId === this.editingUser.id);
            return {
              id: team.id,
              name: team.name,
              role: member?.role || 'viewer',
            };
          });
      } catch (err) {
        console.error('Failed to load user teams:', err);
        this.userTeams = [];
      }
    },

    async openCreateUser() {
      this.editingUser = null;
      this.viewMode = 'editUser';
      this.userForm = {
        userName: '',
        managerId: '',
        name: {
          firstName: '',
          lastName: '',
        },
        email: {
          primary: '',
          alternate: '',
        },
        phone: {
          mobile: '',
          home: '',
          office: '',
        },
        address: {
          street: '',
          street2: '',
          city: '',
          state: '',
          postalCode: '',
          country: '',
        },
        attributes: [],
      };
      this.userTeams = [];
      // Load all users for manager dropdown
      await this.loadAllUsers();
    },

    async openEditUser(user) {
      this.editingUser = user;
      this.viewMode = 'editUser';

      // Load all users for manager dropdown
      await this.loadAllUsers();

      // Load full user details if we only have list view data
      try {
        const response = await fetch(`${API_BASE}/users/${user.id}`);
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

      await this.loadUserTeams();
    },

    populateUserForm(user) {
      // Convert attributes object to array of {key, value} pairs
      const attributesArray = [];
      if (user.attributes && typeof user.attributes === 'object') {
        for (const [key, value] of Object.entries(user.attributes)) {
          attributesArray.push({ key, value: String(value) });
        }
      }

      this.userForm = {
        userName: user.userName || '',
        managerId: user.managerId || '',
        name: {
          firstName: user.name?.firstName || '',
          lastName: user.name?.lastName || '',
        },
        email: {
          primary: user.email?.primary || '',
          alternate: user.email?.alternate || '',
        },
        phone: {
          mobile: user.phone?.mobile || '',
          home: user.phone?.home || '',
          office: user.phone?.office || '',
        },
        address: {
          street: user.address?.street || '',
          street2: user.address?.street2 || '',
          city: user.address?.city || '',
          state: user.address?.state || '',
          postalCode: user.address?.postalCode || '',
          country: user.address?.country || '',
        },
        attributes: attributesArray,
      };
    },

    closeUserEditor() {
      this.viewMode = 'list';
      this.editingUser = null;
      this.userTeams = [];
    },

    async saveUser() {
      this.error = null;
      this.success = null;

      // Build user object, only including address if at least one field is filled
      const userData = {
        userName: this.userForm.userName,
        name: {
          firstName: this.userForm.name.firstName,
          lastName: this.userForm.name.lastName,
        },
        email: {
          primary: this.userForm.email.primary,
        },
        phone: {
          mobile: this.userForm.phone.mobile,
        },
      };

      if (this.userForm.managerId) {
        userData.managerId = this.userForm.managerId;
      }

      if (this.userForm.email.alternate) {
        userData.email.alternate = this.userForm.email.alternate;
      }

      if (this.userForm.phone.home) {
        userData.phone.home = this.userForm.phone.home;
      }

      if (this.userForm.phone.office) {
        userData.phone.office = this.userForm.phone.office;
      }

      // Only include address if at least one field is filled
      const hasAddress =
        this.userForm.address.street ||
        this.userForm.address.street2 ||
        this.userForm.address.city ||
        this.userForm.address.state ||
        this.userForm.address.postalCode ||
        this.userForm.address.country;

      if (hasAddress) {
        userData.address = {};
        if (this.userForm.address.street) userData.address.street = this.userForm.address.street;
        if (this.userForm.address.street2) userData.address.street2 = this.userForm.address.street2;
        if (this.userForm.address.city) userData.address.city = this.userForm.address.city;
        if (this.userForm.address.state) userData.address.state = this.userForm.address.state;
        if (this.userForm.address.postalCode) userData.address.postalCode = this.userForm.address.postalCode;
        if (this.userForm.address.country) userData.address.country = this.userForm.address.country;
      }

      // Convert attributes array to object, filtering out empty keys
      const attributes = {};
      if (this.userForm.attributes && this.userForm.attributes.length > 0) {
        for (const attr of this.userForm.attributes) {
          if (attr.key && attr.key.trim()) {
            const trimmedKey = attr.key.trim();
            const value = attr.value;
            // Try to parse as number or boolean, otherwise keep as string
            if (value === 'true' || value === 'false') {
              attributes[trimmedKey] = value === 'true';
            } else if (value === '' || value === null || value === undefined) {
              // Skip empty values
              continue;
            } else if (!isNaN(value) && value !== '') {
              // Try to parse as number
              const numValue = Number(value);
              if (!isNaN(numValue) && isFinite(numValue)) {
                attributes[trimmedKey] = numValue;
              } else {
                attributes[trimmedKey] = value;
              }
            } else {
              attributes[trimmedKey] = value;
            }
          }
        }
        if (Object.keys(attributes).length > 0) {
          userData.attributes = attributes;
        }
      }

      try {
        let response;
        if (this.editingUser) {
          // Update existing user
          response = await fetch(`${API_BASE}/users/${this.editingUser.id}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(userData),
          });
        } else {
          // Create new user
          response = await fetch(`${API_BASE}/users`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(userData),
          });
        }

        if (!response.ok) {
          const error = await response.json().catch(() => ({ message: `HTTP ${response.status}` }));
          throw new Error(error.message || `HTTP ${response.status}`);
        }

        this.success = this.editingUser
          ? 'User updated successfully'
          : 'User created successfully';
        this.closeUserEditor();
        this.userPage = 1;
        await this.loadUsers();
        setTimeout(() => {
          this.success = null;
        }, 3000);
      } catch (err) {
        this.error = `Failed to save user: ${err.message}`;
      }
    },

    async deleteUser(userId) {
      if (!confirm('Are you sure you want to delete this user?')) {
        return;
      }

      this.error = null;
      this.success = null;

      try {
        const response = await fetch(`${API_BASE}/users/${userId}`, {
          method: 'DELETE',
        });

        if (!response.ok) {
          const error = await response.json().catch(() => ({ message: `HTTP ${response.status}` }));
          throw new Error(error.message || `HTTP ${response.status}`);
        }

        this.success = 'User deleted successfully';
        if (this.users.length === 1 && this.userPage > 1) {
          this.userPage = this.userPage - 1;
        }
        await this.loadUsers();
        setTimeout(() => {
          this.success = null;
        }, 3000);
      } catch (err) {
        this.error = `Failed to delete user: ${err.message}`;
      }
    },

    async addUserToTeam() {
      if (!this.selectedTeamToAdd || !this.editingUser) return;

      this.error = null;
      this.success = null;

      try {
        const response = await fetch(
          `${API_BASE}/teams/${this.selectedTeamToAdd}/members`,
          {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              action: 'add',
              userId: this.editingUser.id,
              role: this.selectedTeamRole,
            }),
          }
        );

        if (!response.ok) {
          const error = await response.json().catch(() => ({ message: `HTTP ${response.status}` }));
          throw new Error(error.message || `HTTP ${response.status}`);
        }

        this.success = 'User added to team successfully';
        this.selectedTeamToAdd = '';
        await this.loadUserTeams();
        await this.loadTeams();
        setTimeout(() => {
          this.success = null;
        }, 3000);
      } catch (err) {
        this.error = `Failed to add user to team: ${err.message}`;
      }
    },

    async removeUserFromTeam(teamId) {
      if (!this.editingUser) return;

      this.error = null;
      this.success = null;

      try {
        const response = await fetch(`${API_BASE}/teams/${teamId}/members`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            action: 'remove',
            userId: this.editingUser.id,
          }),
        });

        if (!response.ok) {
          const error = await response.json().catch(() => ({ message: `HTTP ${response.status}` }));
          throw new Error(error.message || `HTTP ${response.status}`);
        }

        this.success = 'User removed from team successfully';
        await this.loadUserTeams();
        await this.loadTeams();
        setTimeout(() => {
          this.success = null;
        }, 3000);
      } catch (err) {
        this.error = `Failed to remove user from team: ${err.message}`;
      }
    },

    openCreateTeamModal() {
      this.editingTeam = null;
      this.teamForm = {
        name: '',
        description: '',
      };
      this.showTeamModal = true;
    },

    openEditTeamModal(team) {
      this.editingTeam = team;
      this.teamForm = {
        name: team.name || '',
        description: team.description || '',
      };
      this.showTeamModal = true;
    },

    closeTeamModal() {
      this.showTeamModal = false;
      this.editingTeam = null;
    },

    async saveTeam() {
      this.error = null;
      this.success = null;

      const teamData = {
        name: this.teamForm.name,
      };

      if (this.teamForm.description) {
        teamData.description = this.teamForm.description;
      }

      try {
        let response;
        if (this.editingTeam) {
          response = await fetch(`${API_BASE}/teams/${this.editingTeam.id}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(teamData),
          });
        } else {
          response = await fetch(`${API_BASE}/teams`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(teamData),
          });
        }

        if (!response.ok) {
          const error = await response.json().catch(() => ({ message: `HTTP ${response.status}` }));
          throw new Error(error.message || `HTTP ${response.status}`);
        }

        this.success = this.editingTeam
          ? 'Team updated successfully'
          : 'Team created successfully';
        this.closeTeamModal();
        this.teamPage = 1;
        await this.loadTeams();
        setTimeout(() => {
          this.success = null;
        }, 3000);
      } catch (err) {
        this.error = `Failed to save team: ${err.message}`;
      }
    },

    async deleteTeam(teamId) {
      if (!confirm('Are you sure you want to delete this team?')) {
        return;
      }

      this.error = null;
      this.success = null;

      try {
        const response = await fetch(`${API_BASE}/teams/${teamId}`, {
          method: 'DELETE',
        });

        if (!response.ok) {
          const error = await response.json().catch(() => ({ message: `HTTP ${response.status}` }));
          throw new Error(error.message || `HTTP ${response.status}`);
        }

        this.success = 'Team deleted successfully';
        if (this.teams.length === 1 && this.teamPage > 1) {
          this.teamPage = this.teamPage - 1;
        }
        await this.loadTeams();
        setTimeout(() => {
          this.success = null;
        }, 3000);
      } catch (err) {
        this.error = `Failed to delete team: ${err.message}`;
      }
    },

    openManageMembersModal(team) {
      this.selectedTeam = team;
      this.selectedUserToAdd = '';
      this.showMembersModal = true;
    },

    closeMembersModal() {
      this.showMembersModal = false;
      this.selectedTeam = null;
      this.selectedUserToAdd = '';
    },

    async addMemberToTeam() {
      if (!this.selectedUserToAdd || !this.selectedTeam) return;

      this.error = null;
      this.success = null;

      try {
        const response = await fetch(
          `${API_BASE}/teams/${this.selectedTeam.id}/members`,
          {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              action: 'add',
              userId: this.selectedUserToAdd,
              role: this.selectedMemberRole,
            }),
          }
        );

        if (!response.ok) {
          const error = await response.json().catch(() => ({ message: `HTTP ${response.status}` }));
          throw new Error(error.message || `HTTP ${response.status}`);
        }

        const updatedTeam = await response.json();
        this.selectedTeam = updatedTeam;

        // Update the team in the teams array
        const index = this.teams.findIndex((t) => t.id === updatedTeam.id);
        if (index !== -1) {
          this.teams[index] = updatedTeam;
        }

        this.success = 'Member added successfully';
        this.selectedUserToAdd = '';
        setTimeout(() => {
          this.success = null;
        }, 3000);
      } catch (err) {
        this.error = `Failed to add member: ${err.message}`;
      }
    },

    async removeMemberFromTeam(userId) {
      if (!this.selectedTeam) return;

      this.error = null;
      this.success = null;

      try {
        const response = await fetch(
          `${API_BASE}/teams/${this.selectedTeam.id}/members`,
          {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              action: 'remove',
              userId: userId,
            }),
          }
        );

        if (!response.ok) {
          const error = await response.json().catch(() => ({ message: `HTTP ${response.status}` }));
          throw new Error(error.message || `HTTP ${response.status}`);
        }

        const updatedTeam = await response.json();
        this.selectedTeam = updatedTeam;

        // Update the team in the teams array
        const index = this.teams.findIndex((t) => t.id === updatedTeam.id);
        if (index !== -1) {
          this.teams[index] = updatedTeam;
        }

        this.success = 'Member removed successfully';
        setTimeout(() => {
          this.success = null;
        }, 3000);
      } catch (err) {
        this.error = `Failed to remove member: ${err.message}`;
      }
    },

    openSyncModal() {
      this.syncDeleteOrphaned = false;
      this.showSyncModal = true;
    },

    closeSyncModal() {
      this.showSyncModal = false;
      this.syncDeleteOrphaned = false;
    },

    async synchronize() {
      this.error = null;
      this.success = null;
      this.synchronizing = true;

      try {
        const body = {};
        if (this.syncDeleteOrphaned) {
          body.deleteOrphanedResources = true;
        }

        const response = await fetch(`${API_BASE}/Synchronize`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(body),
        });

        if (!response.ok) {
          const error = await response.json().catch(() => ({ message: `HTTP ${response.status}` }));
          throw new Error(error.message || `HTTP ${response.status}`);
        }

        this.success = 'Synchronization completed successfully';
        this.closeSyncModal();
        
        // Reload all data
        await Promise.all([
          this.loadUsers(),
          this.loadTeams(),
        ]);

        setTimeout(() => {
          this.success = null;
        }, 3000);
      } catch (err) {
        this.error = `Failed to synchronize: ${err.message}`;
      } finally {
        this.synchronizing = false;
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
        }
        if (resourceTypesResponse.ok) {
          const resourceTypesData = await resourceTypesResponse.json();
          this.resourceTypes = resourceTypesData.Resources || [];
        }
        if (schemasResponse.ok) {
          const schemasData = await schemasResponse.json();
          this.schemas = schemasData.Resources || [];
        }
      } catch (err) {
        console.error('Failed to load SCIM configuration:', err);
      }
    },

    openConfigModal() {
      this.showConfigModal = true;
    },

    closeConfigModal() {
      this.showConfigModal = false;
    },

    addAttribute() {
      this.userForm.attributes.push({ key: '', value: '' });
    },

    removeAttribute(index) {
      this.userForm.attributes.splice(index, 1);
    },
  };
}

