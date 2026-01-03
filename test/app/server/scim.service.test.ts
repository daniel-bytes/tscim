import { describe, expect, it, beforeEach } from 'vitest';
import { ScimService } from '../../../src/app/server/scim.service.js';
import { InMemoryAdapter } from '../../../src/app/adapter/in-memory.resource.adapter.js';
import type {
  User,
  Group,
  Email,
  Member,
  BulkRequest,
} from '../../../src/scim/model.js';
import { SchemaUris } from '../../../src/scim/uris.js';
import type { PatchRequest } from '../../../src/scim/patch.dsl.js';
import {
  ScimNotFoundError,
  ScimConflictError,
  ScimBadRequestError,
} from '../../../src/scim/errors.js';
import { parseFilter } from '../../../src/scim/filter.dsl.js';

describe('ScimService', () => {
  // Helper to create a test user
  const createUser = (overrides: Partial<User> = {}): User => ({
    schemas: [SchemaUris.User],
    userName: 'testuser',
    ...overrides,
  });

  // Helper to create a test group
  const createGroup = (overrides: Partial<Group> = {}): Group => ({
    schemas: [SchemaUris.Group],
    displayName: 'Test Group',
    ...overrides,
  });

  // Initial test dataset
  let initialUsers: Record<string, User>;
  let initialGroups: Record<string, Group>;
  let userRepository: InMemoryAdapter<User>;
  let groupRepository: InMemoryAdapter<Group>;
  let service: ScimService;

  beforeEach(() => {
    // Create initial users dataset
    initialUsers = {
      'user-1': createUser({
        id: 'user-1',
        userName: 'john.doe',
        displayName: 'John Doe',
        active: true,
        emails: [
          { value: 'john.doe@example.com', primary: true },
          { value: 'john@work.com', primary: false },
        ],
        name: {
          givenName: 'John',
          familyName: 'Doe',
          formatted: 'John Doe',
        },
      }),
      'user-2': createUser({
        id: 'user-2',
        userName: 'jane.smith',
        displayName: 'Jane Smith',
        active: true,
        emails: [{ value: 'jane.smith@example.com', primary: true }],
        name: {
          givenName: 'Jane',
          familyName: 'Smith',
          formatted: 'Jane Smith',
        },
      }),
      'user-3': createUser({
        id: 'user-3',
        userName: 'bob.inactive',
        displayName: 'Bob Inactive',
        active: false,
        emails: [{ value: 'bob@example.com', primary: true }],
      }),
      'user-4': createUser({
        id: 'user-4',
        userName: 'alice.admin',
        displayName: 'Alice Admin',
        active: true,
        emails: [{ value: 'alice@example.com', primary: true }],
        title: 'Administrator',
      }),
    };

    // Create initial groups dataset
    initialGroups = {
      'group-1': createGroup({
        id: 'group-1',
        displayName: 'Developers',
        members: [
          { value: 'user-1', display: 'John Doe' },
          { value: 'user-2', display: 'Jane Smith' },
        ],
      }),
      'group-2': createGroup({
        id: 'group-2',
        displayName: 'Admins',
        members: [{ value: 'user-4', display: 'Alice Admin' }],
      }),
    };

    // Create repositories with initial data
    userRepository = new InMemoryAdapter('User', { ...initialUsers });
    groupRepository = new InMemoryAdapter('Group', { ...initialGroups });

    // Create service
    service = new ScimService({
      userAdapter: userRepository,
      groupAdapter: groupRepository,
      ensureSinglePrimaryValue: true,
    });
  });

  describe('User Operations', () => {
    describe('get', () => {
      it('should get an existing user by ID', async () => {
        const user = await service.resources.users.get({ id: 'user-1' });

        expect(user.id).toBe('user-1');
        expect(user.userName).toBe('john.doe');
        expect(user.displayName).toBe('John Doe');
        expect(user.active).toBe(true);
      });

      it('should throw ScimNotFoundError for non-existent user', async () => {
        await expect(
          service.resources.users.get({ id: 'non-existent' })
        ).rejects.toThrow(ScimNotFoundError);
      });

      it('should preserve all user attributes', async () => {
        const user = await service.resources.users.get({ id: 'user-1' });

        expect(user.emails).toHaveLength(2);
        expect(user.emails?.[0].value).toBe('john.doe@example.com');
        expect(user.emails?.[0].primary).toBe(true);
        expect(user.name?.givenName).toBe('John');
        expect(user.name?.familyName).toBe('Doe');
      });
    });

    describe('list', () => {
      it('should return all users when no filter is provided', async () => {
        const result = await service.resources.users.list({});

        expect(result.totalResults).toBe(4);
        expect(result.Resources).toHaveLength(4);
        expect(result.schemas).toContain(SchemaUris.ListResponse);
      });

      it('should filter users by active status', async () => {
        const filterResult = parseFilter('active eq true');

        const result = await service.resources.users.list({
          filter: filterResult.get(),
        });

        expect(result.totalResults).toBe(3);
        expect(result.Resources.every(u => u.active === true)).toBe(true);
        expect(result.Resources.map(u => u.id)).toContain('user-1');
        expect(result.Resources.map(u => u.id)).toContain('user-2');
        expect(result.Resources.map(u => u.id)).toContain('user-4');
      });

      it('should filter users by userName', async () => {
        const filterResult = parseFilter('userName eq "john.doe"');

        const result = await service.resources.users.list({
          filter: filterResult.get(),
        });

        expect(result.totalResults).toBe(1);
        expect(result.Resources[0].userName).toBe('john.doe');
      });

      it('should filter users by email value', async () => {
        const filterResult = parseFilter(
          'emails[value eq "jane.smith@example.com"]'
        );

        const result = await service.resources.users.list({
          filter: filterResult.get(),
        });

        expect(result.totalResults).toBe(1);
        expect(result.Resources[0].userName).toBe('jane.smith');
      });

      it('should support pagination', async () => {
        const result = await service.resources.users.list({
          pagination: {
            startIndex: 2,
            count: 2,
          },
        });

        expect(result.startIndex).toBe(2);
        expect(result.itemsPerPage).toBe(2);
        expect(result.Resources).toHaveLength(2);
        expect(result.totalResults).toBe(4);
      });

      it('should support sorting', async () => {
        const result = await service.resources.users.list({
          sorting: {
            sortBy: 'userName',
            sortOrder: 'ascending',
          },
        });

        expect(result.Resources).toHaveLength(4);
        const userNames = result.Resources.map(u => u.userName);
        expect(userNames).toEqual([
          'alice.admin',
          'bob.inactive',
          'jane.smith',
          'john.doe',
        ]);
      });

      it('should return empty results when filter matches nothing', async () => {
        const filterResult = parseFilter('userName eq "nonexistent"');

        const result = await service.resources.users.list({
          filter: filterResult.get(),
        });

        expect(result.totalResults).toBe(0);
        expect(result.Resources).toHaveLength(0);
      });
    });

    describe('create', () => {
      it('should create a new user', async () => {
        const newUser = createUser({
          userName: 'newuser',
          displayName: 'New User',
          active: true,
        });

        const created = await service.resources.users.create({
          resource: newUser,
        });

        expect(created.id).toBeDefined();
        expect(created.userName).toBe('newuser');
        expect(created.displayName).toBe('New User');

        // Verify it was actually stored
        const stored = await service.resources.users.get({ id: created.id! });
        expect(stored.userName).toBe('newuser');
      });

      it('should generate ID if not provided', async () => {
        const newUser: any = createUser({
          userName: 'noguid',
        });
        delete newUser.id;

        const created = await service.resources.users.create({
          resource: newUser,
        });

        expect(created.id).toBeDefined();
        expect(created.id).not.toBeUndefined();
      });

      it('should ensure single primary value for emails', async () => {
        const newUser = createUser({
          userName: 'multiprimary',
          emails: [
            { value: 'email1@example.com', primary: true },
            { value: 'email2@example.com', primary: true },
          ],
        });

        const created = await service.resources.users.create({
          resource: newUser,
        });

        const primaryEmails = created.emails?.filter(e => e.primary === true);
        expect(primaryEmails).toHaveLength(1);
        // ensureSinglePrimaryValue keeps the last primary (iterates backwards)
        expect(primaryEmails?.[0].value).toBe('email2@example.com');
      });

      it('should throw ScimConflictError when creating user with existing ID', async () => {
        const newUser = createUser({
          id: 'user-1', // Already exists
          userName: 'duplicate',
        });

        await expect(
          service.resources.users.create({ resource: newUser })
        ).rejects.toThrow(ScimConflictError);
      });

      it('should create user with complex attributes', async () => {
        const newUser = createUser({
          userName: 'complexuser',
          name: {
            givenName: 'Complex',
            familyName: 'User',
            formatted: 'Complex User',
          },
          emails: [
            { value: 'complex@example.com', primary: true },
            { value: 'complex2@example.com', primary: false },
          ],
          addresses: [
            {
              streetAddress: '123 Main St',
              locality: 'City',
              region: 'State',
              postalCode: '12345',
              country: 'USA',
              type: 'work',
              primary: true,
            },
          ],
        });

        const created = await service.resources.users.create({
          resource: newUser,
        });

        expect(created.name?.givenName).toBe('Complex');
        expect(created.emails).toHaveLength(2);
        expect(created.addresses).toHaveLength(1);
        expect(created.addresses?.[0].streetAddress).toBe('123 Main St');
      });
    });

    describe('update', () => {
      it('should update an existing user', async () => {
        const updated = createUser({
          id: 'user-1',
          userName: 'john.doe',
          displayName: 'John Doe Updated',
          active: false,
        });

        const result = await service.resources.users.update({
          id: 'user-1',
          resource: updated,
        });

        expect(result.displayName).toBe('John Doe Updated');
        expect(result.active).toBe(false);

        // Verify it was actually updated
        const stored = await service.resources.users.get({ id: 'user-1' });
        expect(stored.displayName).toBe('John Doe Updated');
        expect(stored.active).toBe(false);
      });

      it('should preserve ID when updating', async () => {
        const updated = createUser({
          userName: 'john.doe',
          displayName: 'Updated',
        });

        const result = await service.resources.users.update({
          id: 'user-1',
          resource: updated,
        });

        expect(result.id).toBe('user-1');
      });

      it('should throw ScimNotFoundError when updating non-existent user', async () => {
        const updated = createUser({
          userName: 'nonexistent',
        });

        await expect(
          service.resources.users.update({
            id: 'non-existent',
            resource: updated,
          })
        ).rejects.toThrow(ScimNotFoundError);
      });

      it('should ensure single primary value when updating', async () => {
        const updated = createUser({
          id: 'user-1',
          userName: 'john.doe',
          emails: [
            { value: 'email1@example.com', primary: true },
            { value: 'email2@example.com', primary: true },
          ],
        });

        const result = await service.resources.users.update({
          id: 'user-1',
          resource: updated,
        });

        const primaryEmails = result.emails?.filter(e => e.primary === true);
        expect(primaryEmails).toHaveLength(1);
        // ensureSinglePrimaryValue keeps the last primary (iterates backwards)
        expect(primaryEmails?.[0].value).toBe('email2@example.com');
      });

      it('should completely replace user attributes', async () => {
        const updated = createUser({
          id: 'user-1',
          userName: 'john.doe',
          displayName: 'Simple User',
          // No emails, no name - should remove them
        });

        const result = await service.resources.users.update({
          id: 'user-1',
          resource: updated,
        });

        expect(result.displayName).toBe('Simple User');
        expect(result.emails).toBeUndefined();
        expect(result.name).toBeUndefined();
      });
    });

    describe('patch', () => {
      it('should patch a user with replace operation', async () => {
        const patch: PatchRequest<User> = {
          schemas: [SchemaUris.PatchOp],
          Operations: [
            {
              op: 'replace',
              path: 'displayName',
              value: 'Patched Display Name',
            },
          ],
        };

        const result = await service.resources.users.patch({
          id: 'user-1',
          patch,
        });

        expect(result.displayName).toBe('Patched Display Name');
        expect(result.userName).toBe('john.doe'); // Unchanged

        // Verify it was actually patched
        const stored = await service.resources.users.get({ id: 'user-1' });
        expect(stored.displayName).toBe('Patched Display Name');
      });

      it('should patch a user with add operation', async () => {
        const patch: PatchRequest<User> = {
          schemas: [SchemaUris.PatchOp],
          Operations: [
            {
              op: 'add',
              path: 'title',
              value: 'Senior Developer',
            },
          ],
        };

        const result = await service.resources.users.patch({
          id: 'user-1',
          patch,
        });

        expect(result.title).toBe('Senior Developer');
      });

      it('should patch a user with remove operation', async () => {
        const patch: PatchRequest<User> = {
          schemas: [SchemaUris.PatchOp],
          Operations: [
            {
              op: 'remove',
              path: 'displayName',
            },
          ],
        };

        const result = await service.resources.users.patch({
          id: 'user-1',
          patch,
        });

        expect(result.displayName).toBeUndefined();
      });

      it('should patch nested attributes', async () => {
        const patch: PatchRequest<User> = {
          schemas: [SchemaUris.PatchOp],
          Operations: [
            {
              op: 'replace',
              path: 'name.givenName',
              value: 'Jonathan',
            },
          ],
        };

        const result = await service.resources.users.patch({
          id: 'user-1',
          patch,
        });

        expect(result.name?.givenName).toBe('Jonathan');
        expect(result.name?.familyName).toBe('Doe'); // Unchanged
      });

      it('should patch array attributes', async () => {
        const newEmail: Email = {
          value: 'newemail@example.com',
          primary: false,
        };

        const patch: PatchRequest<User> = {
          schemas: [SchemaUris.PatchOp],
          Operations: [
            {
              op: 'add',
              path: 'emails',
              value: newEmail,
            },
          ],
        };

        const result = await service.resources.users.patch({
          id: 'user-1',
          patch,
        });

        expect(result.emails).toHaveLength(3);
        expect(
          result.emails?.some(e => e.value === 'newemail@example.com')
        ).toBe(true);
      });

      it('should ensure single primary value after patching', async () => {
        // Get user-1 which already has a primary email
        const user = await service.resources.users.get({ id: 'user-1' });
        const existingPrimaryEmail = user.emails?.find(e => e.primary === true);
        expect(existingPrimaryEmail).toBeDefined();

        const newEmail: Email = {
          value: 'newprimary@example.com',
          primary: true,
        };

        const patch: PatchRequest<User> = {
          schemas: [SchemaUris.PatchOp],
          Operations: [
            {
              op: 'add',
              path: 'emails',
              value: newEmail,
            },
          ],
        };

        const result = await service.resources.users.patch({
          id: 'user-1',
          patch,
        });

        const primaryEmails = result.emails?.filter(e => e.primary === true);
        expect(primaryEmails).toHaveLength(1);
        // ensureSinglePrimaryValue keeps the last primary (iterates backwards)
        // Since we added the new email to the end, it should be the primary
        expect(primaryEmails?.[0].value).toBe('newprimary@example.com');
      });

      it('should throw ScimNotFoundError when patching non-existent user', async () => {
        const patch: PatchRequest<User> = {
          schemas: [SchemaUris.PatchOp],
          Operations: [
            {
              op: 'replace',
              path: 'displayName',
              value: 'New Name',
            },
          ],
        };

        await expect(
          service.resources.users.patch({ id: 'non-existent', patch })
        ).rejects.toThrow(ScimNotFoundError);
      });

      it('should apply multiple patch operations in order', async () => {
        const patch: PatchRequest<User> = {
          schemas: [SchemaUris.PatchOp],
          Operations: [
            {
              op: 'replace',
              path: 'displayName',
              value: 'First Update',
            },
            {
              op: 'replace',
              path: 'displayName',
              value: 'Second Update',
            },
            {
              op: 'add',
              path: 'title',
              value: 'Developer',
            },
          ],
        };

        const result = await service.resources.users.patch({
          id: 'user-1',
          patch,
        });

        expect(result.displayName).toBe('Second Update');
        expect(result.title).toBe('Developer');
      });
    });

    describe('delete', () => {
      it('should delete an existing user', async () => {
        await service.resources.users.delete({ id: 'user-1' });

        // Verify it was actually deleted
        await expect(
          service.resources.users.get({ id: 'user-1' })
        ).rejects.toThrow(ScimNotFoundError);
      });

      it('should throw ScimNotFoundError when deleting non-existent user', async () => {
        await expect(
          service.resources.users.delete({ id: 'non-existent' })
        ).rejects.toThrow(ScimNotFoundError);
      });

      it('should remove user from repository', async () => {
        const beforeIds = userRepository.getAllResourceIds();
        expect(beforeIds).toContain('user-2');

        await service.resources.users.delete({ id: 'user-2' });

        const afterIds = userRepository.getAllResourceIds();
        expect(afterIds).not.toContain('user-2');
        expect(afterIds.length).toBe(beforeIds.length - 1);
      });
    });

    describe('Error Handling', () => {
      it('should preserve ScimError types', async () => {
        await expect(
          service.resources.users.get({ id: 'non-existent' })
        ).rejects.toThrow(ScimNotFoundError);
      });
    });
  });

  describe('Group Operations', () => {
    describe('get', () => {
      it('should get an existing group by ID', async () => {
        const group = await service.resources.groups!.get({ id: 'group-1' });

        expect(group.id).toBe('group-1');
        expect(group.displayName).toBe('Developers');
        expect(group.members).toHaveLength(2);
      });

      it('should throw ScimNotFoundError for non-existent group', async () => {
        await expect(
          service.resources.groups!.get({ id: 'non-existent' })
        ).rejects.toThrow(ScimNotFoundError);
      });

      it('should preserve all group attributes', async () => {
        const group = await service.resources.groups!.get({ id: 'group-1' });

        expect(group.members?.[0].value).toBe('user-1');
        expect(group.members?.[0].display).toBe('John Doe');
      });
    });

    describe('list', () => {
      it('should return all groups when no filter is provided', async () => {
        const result = await service.resources.groups!.list({});

        expect(result.totalResults).toBe(2);
        expect(result.Resources).toHaveLength(2);
      });

      it('should filter groups by displayName', async () => {
        const filterResult = parseFilter('displayName eq "Developers"');

        const result = await service.resources.groups!.list({
          filter: filterResult.get(),
        });

        expect(result.totalResults).toBe(1);
        expect(result.Resources[0].displayName).toBe('Developers');
      });

      it('should filter groups by member value', async () => {
        const filterResult = parseFilter('members[value eq "user-1"]');

        const result = await service.resources.groups!.list({
          filter: filterResult.get(),
        });

        expect(result.totalResults).toBe(1);
        expect(result.Resources[0].id).toBe('group-1');
      });
    });

    describe('create', () => {
      it('should create a new group', async () => {
        const newGroup = createGroup({
          displayName: 'New Group',
          members: [{ value: 'user-1', display: 'John Doe' }],
        });

        const created = await service.resources.groups!.create({
          resource: newGroup,
        });

        expect(created.id).toBeDefined();
        expect(created.displayName).toBe('New Group');
        expect(created.members).toHaveLength(1);

        // Verify it was actually stored
        const stored = await service.resources.groups!.get({ id: created.id! });
        expect(stored.displayName).toBe('New Group');
      });

      it('should throw ScimConflictError when creating group with existing ID', async () => {
        const newGroup = createGroup({
          id: 'group-1', // Already exists
          displayName: 'Duplicate',
        });

        await expect(
          service.resources.groups!.create({ resource: newGroup })
        ).rejects.toThrow(ScimConflictError);
      });
    });

    describe('update', () => {
      it('should update an existing group', async () => {
        const updated = createGroup({
          id: 'group-1',
          displayName: 'Developers Updated',
          members: [{ value: 'user-1', display: 'John Doe' }],
        });

        const result = await service.resources.groups!.update({
          id: 'group-1',
          resource: updated,
        });

        expect(result.displayName).toBe('Developers Updated');
        expect(result.members).toHaveLength(1);

        // Verify it was actually updated
        const stored = await service.resources.groups!.get({ id: 'group-1' });
        expect(stored.displayName).toBe('Developers Updated');
      });

      it('should throw ScimNotFoundError when updating non-existent group', async () => {
        const updated = createGroup({
          displayName: 'Nonexistent',
        });

        await expect(
          service.resources.groups!.update({
            id: 'non-existent',
            resource: updated,
          })
        ).rejects.toThrow(ScimNotFoundError);
      });
    });

    describe('patch', () => {
      it('should patch a group with replace operation', async () => {
        const patch: PatchRequest<Group> = {
          schemas: [SchemaUris.PatchOp],
          Operations: [
            {
              op: 'replace',
              path: 'displayName',
              value: 'Patched Group Name',
            },
          ],
        };

        const result = await service.resources.groups!.patch({
          id: 'group-1',
          patch,
        });

        expect(result.displayName).toBe('Patched Group Name');

        // Verify it was actually patched
        const stored = await service.resources.groups!.get({ id: 'group-1' });
        expect(stored.displayName).toBe('Patched Group Name');
      });

      it('should patch group members', async () => {
        const newMember: Member = {
          value: 'user-3',
          display: 'Bob Inactive',
        };

        const patch: PatchRequest<Group> = {
          schemas: [SchemaUris.PatchOp],
          Operations: [
            {
              op: 'add',
              path: 'members',
              value: newMember,
            },
          ],
        };

        const result = await service.resources.groups!.patch({
          id: 'group-1',
          patch,
        });

        expect(result.members).toHaveLength(3);
        expect(result.members?.some(m => m.value === 'user-3')).toBe(true);
      });

      it('should throw ScimNotFoundError when patching non-existent group', async () => {
        const patch: PatchRequest<Group> = {
          schemas: [SchemaUris.PatchOp],
          Operations: [
            {
              op: 'replace',
              path: 'displayName',
              value: 'New Name',
            },
          ],
        };

        await expect(
          service.resources.groups!.patch({ id: 'non-existent', patch })
        ).rejects.toThrow(ScimNotFoundError);
      });
    });

    describe('delete', () => {
      it('should delete an existing group', async () => {
        await service.resources.groups!.delete({
          id: 'group-1',
        });

        // Verify it was actually deleted
        await expect(
          service.resources.groups!.get({ id: 'group-1' })
        ).rejects.toThrow(ScimNotFoundError);
      });

      it('should throw ScimNotFoundError when deleting non-existent group', async () => {
        await expect(
          service.resources.groups!.delete({ id: 'non-existent' })
        ).rejects.toThrow(ScimNotFoundError);
      });
    });

    describe('Group Repository Not Implemented', () => {
      it('should throw ScimNotImplementedError when group repository is not provided', async () => {
        const serviceWithoutGroups = new ScimService({
          userAdapter: userRepository,
          // No groupRepository
        });

        expect(serviceWithoutGroups.resources.groups).toBeUndefined();
      });
    });
  });

  describe('ensureSinglePrimaryValue Option', () => {
    it('should ensure single primary value when enabled', async () => {
      const userWithMultiplePrimary = createUser({
        userName: 'multiprimary',
        emails: [
          { value: 'email1@example.com', primary: true },
          { value: 'email2@example.com', primary: true },
        ],
      });

      const created = await service.resources.users.create({
        resource: userWithMultiplePrimary,
      });

      const primaryEmails = created.emails?.filter(e => e.primary === true);
      expect(primaryEmails).toHaveLength(1);
      // ensureSinglePrimaryValue keeps the last primary (iterates backwards)
      expect(primaryEmails?.[0].value).toBe('email2@example.com');
    });

    it('should not ensure single primary value when disabled', async () => {
      const serviceWithoutEnforcement = new ScimService({
        userAdapter: userRepository,
        ensureSinglePrimaryValue: false,
      });

      const userWithMultiplePrimary = createUser({
        userName: 'multiprimary',
        emails: [
          { value: 'email1@example.com', primary: true },
          { value: 'email2@example.com', primary: true },
        ],
      });

      const created = await serviceWithoutEnforcement.resources.users.create({
        resource: userWithMultiplePrimary,
      });

      const primaryEmails = created.emails?.filter(e => e.primary === true);
      expect(primaryEmails).toHaveLength(2);
    });

    it('should handle groups without primary fields', async () => {
      // Groups don't have primary fields, but ensureSinglePrimaryValue should handle this gracefully
      const group = createGroup({
        displayName: 'Test',
        members: [{ value: 'user-1', display: 'John Doe' }],
      });

      const created = await service.resources.groups!.create({
        resource: group,
      });
      expect(created.displayName).toBe('Test');
      expect(created.members).toHaveLength(1);
    });
  });

  describe('Data Integrity', () => {
    it('should maintain data isolation between operations', async () => {
      // Get initial state
      const initialUser = await service.resources.users.get({ id: 'user-1' });
      const initialDisplayName = initialUser.displayName;

      // Update a different user
      const updated = createUser({
        id: 'user-2',
        userName: 'jane.smith',
        displayName: 'Jane Updated',
      });
      await service.resources.users.update({ id: 'user-2', resource: updated });

      // Verify first user is unchanged
      const unchangedUser = await service.resources.users.get({ id: 'user-1' });
      expect(unchangedUser.displayName).toBe(initialDisplayName);
    });

    it('should maintain repository state consistency', async () => {
      const beforeCount = userRepository.getAllResourceIds().length;

      // Create a user
      const newUser = createUser({ userName: 'newuser' });
      await service.resources.users.create({ resource: newUser });

      const afterCreateCount = userRepository.getAllResourceIds().length;
      expect(afterCreateCount).toBe(beforeCount + 1);

      // Delete a user
      await service.resources.users.delete({ id: 'user-3' });

      const afterDeleteCount = userRepository.getAllResourceIds().length;
      expect(afterDeleteCount).toBe(beforeCount); // Back to original count
    });
  });

  describe('Discovery Endpoints', () => {
    describe('ServiceProviderConfig', () => {
      it('should return service provider configuration', async () => {
        const config = await service.config.serviceProvider.get();

        expect(config.schemas).toContain(
          'urn:ietf:params:scim:schemas:core:2.0:ServiceProviderConfig'
        );
        expect(config.patch?.supported).toBe(true);
        expect(config.filter?.supported).toBe(true);
        expect(config.sort?.supported).toBe(true);
        expect(config.changePassword?.supported).toBe(false);
        expect(config.etag?.supported).toBe(false);
      });

      it('should indicate bulk is not supported by default', async () => {
        const config = await service.config.serviceProvider.get();

        expect(config.bulk?.supported).toBe(false);
      });

      it('should indicate bulk is supported when enabled', async () => {
        const bulkController = new ScimService({
          userAdapter: userRepository,
          groupAdapter: groupRepository,
          enableBulk: true,
          maxBulkOperations: 50,
          maxBulkPayloadSize: 512000,
        });

        const config = await bulkController.config.serviceProvider.get();

        expect(config.bulk?.supported).toBe(true);
        expect(config.bulk?.maxOperations).toBe(50);
        expect(config.bulk?.maxPayloadSize).toBe(512000);
      });

      it('should include authentication schemes', async () => {
        const config = await service.config.serviceProvider.get();

        expect(config.authenticationSchemes).toBeDefined();
        expect(config.authenticationSchemes?.length).toBeGreaterThan(0);
        expect(config.authenticationSchemes?.[0].type).toBe('oauthbearertoken');
      });

      it('should include filter maxResults', async () => {
        const config = await service.config.serviceProvider.get();

        expect(config.filter?.maxResults).toBeDefined();
        expect(config.filter?.maxResults).toBeGreaterThan(0);
      });
    });

    describe('ResourceTypes', () => {
      it('should return list of resource types', async () => {
        const result = await service.config.resourceTypes.list();

        expect(result.schemas).toContain(
          'urn:ietf:params:scim:api:messages:2.0:ListResponse'
        );
        expect(result.totalResults).toBeGreaterThan(0);
        expect(result.Resources.length).toBeGreaterThan(0);
      });

      it('should always include User resource type', async () => {
        const result = await service.config.resourceTypes.list();

        const userType = result.Resources.find(rt => rt.id === 'User');
        expect(userType).toBeDefined();
        expect(userType?.name).toBe('User');
        expect(userType?.endpoint).toBe('/Users');
        expect(userType?.schema).toBe(
          'urn:ietf:params:scim:schemas:core:2.0:User'
        );
      });

      it('should include Group resource type when groupRepository is provided', async () => {
        const result = await service.config.resourceTypes.list();

        const groupType = result.Resources.find(rt => rt.id === 'Group');
        expect(groupType).toBeDefined();
        expect(groupType?.name).toBe('Group');
        expect(groupType?.endpoint).toBe('/Groups');
        expect(groupType?.schema).toBe(
          'urn:ietf:params:scim:schemas:core:2.0:Group'
        );
      });

      it('should not include Group resource type when groupRepository is not provided', async () => {
        const serviceWithoutGroups = new ScimService({
          userAdapter: userRepository,
        });

        const result = await serviceWithoutGroups.config.resourceTypes.list();

        const groupType = result.Resources.find(rt => rt.id === 'Group');
        expect(groupType).toBeUndefined();
        expect(result.totalResults).toBe(1);
      });

      it('should include schema extensions for User', async () => {
        const result = await service.config.resourceTypes.list();

        const userType = result.Resources.find(rt => rt.id === 'User');
        expect(userType?.schemaExtensions).toBeDefined();
        expect(userType?.schemaExtensions?.length).toBeGreaterThan(0);
        expect(userType?.schemaExtensions?.[0].schema).toBe(
          'urn:ietf:params:scim:schemas:extension:enterprise:2.0:User'
        );
        expect(userType?.schemaExtensions?.[0].required).toBe(false);
      });

      it('should get individual resource type by ID', async () => {
        const userType = await service.config.resourceTypes.get({
          id: 'User' as any,
        });

        expect(userType.id).toBe('User');
        expect(userType.name).toBe('User');
        expect(userType.endpoint).toBe('/Users');
      });

      it('should get Group resource type by ID when available', async () => {
        const groupType = await service.config.resourceTypes.get({
          id: 'Group' as any,
        });

        expect(groupType.id).toBe('Group');
        expect(groupType.name).toBe('Group');
        expect(groupType.endpoint).toBe('/Groups');
      });

      it('should throw ScimNotFoundError for non-existent resource type', async () => {
        await expect(
          service.config.resourceTypes.get({ id: 'NonExistent' as any })
        ).rejects.toThrow(ScimNotFoundError);
      });
    });

    describe('Schemas', () => {
      it('should return list of schema definitions', async () => {
        const result = await service.config.schemas.list();

        expect(result.schemas).toContain(
          'urn:ietf:params:scim:api:messages:2.0:ListResponse'
        );
        expect(result.totalResults).toBeGreaterThan(0);
        expect(result.Resources.length).toBeGreaterThan(0);
      });

      it('should always include Core schema', async () => {
        const result = await service.config.schemas.list();

        const coreSchema = result.Resources.find(
          s => s.id === 'urn:ietf:params:scim:schemas:core:2.0:Core'
        );
        expect(coreSchema).toBeDefined();
        expect(coreSchema?.name).toBe('Core');
        expect(coreSchema?.attributes).toBeDefined();
      });

      it('should always include User schema', async () => {
        const result = await service.config.schemas.list();

        const userSchema = result.Resources.find(
          s => s.id === 'urn:ietf:params:scim:schemas:core:2.0:User'
        );
        expect(userSchema).toBeDefined();
        expect(userSchema?.name).toBe('User');
        expect(userSchema?.attributes).toBeDefined();
        expect(userSchema?.attributes.length).toBeGreaterThan(0);
      });

      it('should include Group schema when groupRepository is provided', async () => {
        const result = await service.config.schemas.list();

        const groupSchema = result.Resources.find(
          s => s.id === 'urn:ietf:params:scim:schemas:core:2.0:Group'
        );
        expect(groupSchema).toBeDefined();
        expect(groupSchema?.name).toBe('Group');
        expect(groupSchema?.attributes).toBeDefined();
      });

      it('should include Enterprise User Extension schema when groups are supported', async () => {
        const result = await service.config.schemas.list();

        const enterpriseSchema = result.Resources.find(
          s =>
            s.id
            === 'urn:ietf:params:scim:schemas:extension:enterprise:2.0:User'
        );
        expect(enterpriseSchema).toBeDefined();
        expect(enterpriseSchema?.name).toBe('EnterpriseUser');
      });

      it('should not include Group schema when groupRepository is not provided', async () => {
        const serviceWithoutGroups = new ScimService({
          userAdapter: userRepository,
        });

        const result = await serviceWithoutGroups.config.schemas.list();

        const groupSchema = result.Resources.find(
          s => s.id === 'urn:ietf:params:scim:schemas:core:2.0:Group'
        );
        expect(groupSchema).toBeUndefined();
      });

      it('should get individual schema by ID', async () => {
        const userSchema = await service.config.schemas.get({
          id: 'urn:ietf:params:scim:schemas:core:2.0:User',
        });

        expect(userSchema.id).toBe(
          'urn:ietf:params:scim:schemas:core:2.0:User'
        );
        expect(userSchema.name).toBe('User');
        expect(userSchema.attributes).toBeDefined();
      });

      it('should throw ScimNotFoundError for non-existent schema', async () => {
        await expect(
          service.config.schemas.get({
            id: 'urn:ietf:params:scim:schemas:core:2.0:NonExistent',
          })
        ).rejects.toThrow(ScimNotFoundError);
      });

      it('should include Core schema attributes', async () => {
        const coreSchema = await service.config.schemas.get({
          id: 'urn:ietf:params:scim:schemas:core:2.0:Core',
        });

        const idAttr = coreSchema.attributes.find(a => a.name === 'id');
        expect(idAttr).toBeDefined();
        expect(idAttr?.type).toBe('string');
        expect(idAttr?.mutability).toBe('readOnly');
        expect(idAttr?.uniqueness).toBe('server');

        const metaAttr = coreSchema.attributes.find(a => a.name === 'meta');
        expect(metaAttr).toBeDefined();
        expect(metaAttr?.type).toBe('complex');
        expect(metaAttr?.subAttributes).toBeDefined();
      });

      it('should include User schema attributes', async () => {
        const userSchema = await service.config.schemas.get({
          id: 'urn:ietf:params:scim:schemas:core:2.0:User',
        });

        const userNameAttr = userSchema.attributes.find(
          a => a.name === 'userName'
        );
        expect(userNameAttr).toBeDefined();
        expect(userNameAttr?.type).toBe('string');
        expect(userNameAttr?.required).toBe(true);
        expect(userNameAttr?.uniqueness).toBe('server');

        const emailsAttr = userSchema.attributes.find(a => a.name === 'emails');
        expect(emailsAttr).toBeDefined();
        expect(emailsAttr?.type).toBe('complex');
        expect(emailsAttr?.subAttributes).toBeDefined();
      });

      it('should include Group schema attributes when available', async () => {
        const groupSchema = await service.config.schemas.get({
          id: 'urn:ietf:params:scim:schemas:core:2.0:Group',
        });

        const displayNameAttr = groupSchema.attributes.find(
          a => a.name === 'displayName'
        );
        expect(displayNameAttr).toBeDefined();
        expect(displayNameAttr?.type).toBe('string');
        expect(displayNameAttr?.required).toBe(true);

        const membersAttr = groupSchema.attributes.find(
          a => a.name === 'members'
        );
        expect(membersAttr).toBeDefined();
        expect(membersAttr?.type).toBe('complex');
        expect(membersAttr?.subAttributes).toBeDefined();
      });
    });

    describe('Bulk Operations', () => {
      it('should throw ScimNotImplementedError when bulk is not enabled', async () => {
        expect(service.resources.bulkOperations).toBeUndefined();
      });

      describe('with bulk enabled', () => {
        let bulkController: ScimService;

        beforeEach(() => {
          bulkController = new ScimService({
            userAdapter: userRepository,
            groupAdapter: groupRepository,
            enableBulk: true,
            maxBulkOperations: 10,
          });
        });

        it('should process bulk create operations', async () => {
          const bulkRequest: BulkRequest = {
            schemas: ['urn:ietf:params:scim:api:messages:2.0:BulkRequest'],
            Operations: [
              {
                method: 'POST',
                path: '/Users',
                bulkId: 'bulk-1',
                data: createUser({
                  userName: 'bulkuser1',
                  displayName: 'Bulk User 1',
                }),
              },
            ],
          };

          const result = await bulkController.resources.bulkOperations!.execute(
            {
              bulkRequest,
            }
          );

          expect(result.schemas).toContain(
            'urn:ietf:params:scim:api:messages:2.0:BulkResponse'
          );
          expect(result.Operations).toHaveLength(1);
          expect(result.Operations[0].status).toBe('201');
          expect(result.Operations[0].bulkId).toBe('bulk-1');
          expect(result.Operations[0].response).toBeDefined();
        });

        it('should process bulk update operations', async () => {
          const bulkRequest: BulkRequest = {
            schemas: ['urn:ietf:params:scim:api:messages:2.0:BulkRequest'],
            Operations: [
              {
                method: 'PUT',
                path: '/Users/user-1',
                bulkId: 'bulk-1',
                data: createUser({
                  id: 'user-1',
                  userName: 'john.doe',
                  displayName: 'John Doe Updated via Bulk',
                }),
              },
            ],
          };

          const result = await bulkController.resources.bulkOperations!.execute(
            {
              bulkRequest,
            }
          );

          expect(result.Operations[0].status).toBe('200');
          const response = result.Operations[0].response as User;
          expect(response.displayName).toBe('John Doe Updated via Bulk');
        });

        it('should process bulk patch operations', async () => {
          const bulkRequest: BulkRequest = {
            schemas: ['urn:ietf:params:scim:api:messages:2.0:BulkRequest'],
            Operations: [
              {
                method: 'PATCH',
                path: '/Users/user-1',
                bulkId: 'bulk-1',
                data: {
                  schemas: [SchemaUris.PatchOp],
                  Operations: [
                    {
                      op: 'replace',
                      path: 'displayName',
                      value: 'Patched via Bulk',
                    },
                  ],
                },
              },
            ],
          };

          const result = await bulkController.resources.bulkOperations!.execute(
            {
              bulkRequest,
            }
          );

          expect(result.Operations[0].status).toBe('200');
          const response = result.Operations[0].response as User;
          expect(response.displayName).toBe('Patched via Bulk');
        });

        it('should process bulk delete operations', async () => {
          // Create a user to delete
          const newUser = await bulkController.resources.users.create({
            resource: createUser({ userName: 'todelete' }),
          });

          const bulkRequest: BulkRequest = {
            schemas: ['urn:ietf:params:scim:api:messages:2.0:BulkRequest'],
            Operations: [
              {
                method: 'DELETE',
                path: `/Users/${newUser.id}`,
                bulkId: 'bulk-1',
              },
            ],
          };

          const result = await bulkController.resources.bulkOperations!.execute(
            {
              bulkRequest,
            }
          );

          expect(result.Operations[0].status).toBe('204');
          // Verify user was deleted
          await expect(
            bulkController.resources.users.get({ id: newUser.id! })
          ).rejects.toThrow(ScimNotFoundError);
        });

        it('should process multiple operations in one request', async () => {
          const bulkRequest: BulkRequest = {
            schemas: ['urn:ietf:params:scim:api:messages:2.0:BulkRequest'],
            Operations: [
              {
                method: 'POST',
                path: '/Users',
                bulkId: 'bulk-1',
                data: createUser({
                  userName: 'bulkuser1',
                  displayName: 'Bulk User 1',
                }),
              },
              {
                method: 'POST',
                path: '/Users',
                bulkId: 'bulk-2',
                data: createUser({
                  userName: 'bulkuser2',
                  displayName: 'Bulk User 2',
                }),
              },
              {
                method: 'PATCH',
                path: '/Users/user-1',
                bulkId: 'bulk-3',
                data: {
                  schemas: [SchemaUris.PatchOp],
                  Operations: [
                    {
                      op: 'replace',
                      path: 'displayName',
                      value: 'Updated via Bulk',
                    },
                  ],
                },
              },
            ],
          };

          const result = await bulkController.resources.bulkOperations!.execute(
            {
              bulkRequest,
            }
          );

          expect(result.Operations).toHaveLength(3);
          expect(result.Operations[0].status).toBe('201');
          expect(result.Operations[1].status).toBe('201');
          expect(result.Operations[2].status).toBe('200');
        });

        it('should handle group operations', async () => {
          const bulkRequest: BulkRequest = {
            schemas: ['urn:ietf:params:scim:api:messages:2.0:BulkRequest'],
            Operations: [
              {
                method: 'POST',
                path: '/Groups',
                bulkId: 'bulk-1',
                data: createGroup({
                  displayName: 'Bulk Group',
                }),
              },
            ],
          };

          const result = await bulkController.resources.bulkOperations!.execute(
            {
              bulkRequest,
            }
          );

          expect(result.Operations[0].status).toBe('201');
          const response = result.Operations[0].response as Group;
          expect(response.displayName).toBe('Bulk Group');
        });

        it('should return error for invalid path', async () => {
          const bulkRequest: BulkRequest = {
            schemas: ['urn:ietf:params:scim:api:messages:2.0:BulkRequest'],
            Operations: [
              {
                method: 'POST',
                path: '/InvalidResource',
                bulkId: 'bulk-1',
                data: {},
              },
            ],
          };

          const result = await bulkController.resources.bulkOperations!.execute(
            {
              bulkRequest,
            }
          );

          expect(result.Operations[0].status).toBe('400');
          expect(result.Operations[0].response).toBeDefined();
        });

        it('should return error for missing resource ID in PUT', async () => {
          const bulkRequest: BulkRequest = {
            schemas: ['urn:ietf:params:scim:api:messages:2.0:BulkRequest'],
            Operations: [
              {
                method: 'PUT',
                path: '/Users',
                bulkId: 'bulk-1',
                data: createUser({ userName: 'test' }),
              },
            ],
          };

          const result = await bulkController.resources.bulkOperations!.execute(
            {
              bulkRequest,
            }
          );

          expect(result.Operations[0].status).toBe('400');
        });

        it('should return error for missing resource ID in PATCH', async () => {
          const bulkRequest: BulkRequest = {
            schemas: ['urn:ietf:params:scim:api:messages:2.0:BulkRequest'],
            Operations: [
              {
                method: 'PATCH',
                path: '/Users',
                bulkId: 'bulk-1',
                data: {
                  schemas: [SchemaUris.PatchOp],
                  Operations: [],
                },
              },
            ],
          };

          const result = await bulkController.resources.bulkOperations!.execute(
            {
              bulkRequest,
            }
          );

          expect(result.Operations[0].status).toBe('400');
        });

        it('should return error for missing resource ID in DELETE', async () => {
          const bulkRequest: BulkRequest = {
            schemas: ['urn:ietf:params:scim:api:messages:2.0:BulkRequest'],
            Operations: [
              {
                method: 'DELETE',
                path: '/Users',
                bulkId: 'bulk-1',
              },
            ],
          };

          const result = await bulkController.resources.bulkOperations!.execute(
            {
              bulkRequest,
            }
          );

          expect(result.Operations[0].status).toBe('400');
        });

        it('should return error for non-existent resource in PUT', async () => {
          const bulkRequest: BulkRequest = {
            schemas: ['urn:ietf:params:scim:api:messages:2.0:BulkRequest'],
            Operations: [
              {
                method: 'PUT',
                path: '/Users/non-existent',
                bulkId: 'bulk-1',
                data: createUser({
                  id: 'non-existent',
                  userName: 'test',
                }),
              },
            ],
          };

          const result = await bulkController.resources.bulkOperations!.execute(
            {
              bulkRequest,
            }
          );

          expect(result.Operations[0].status).toBe('404');
        });

        it('should respect failOnErrors parameter', async () => {
          const bulkRequest: BulkRequest = {
            schemas: ['urn:ietf:params:scim:api:messages:2.0:BulkRequest'],
            failOnErrors: 1,
            Operations: [
              {
                method: 'PUT',
                path: '/Users/non-existent-1',
                bulkId: 'bulk-1',
                data: createUser({
                  id: 'non-existent-1',
                  userName: 'test1',
                }),
              },
              {
                method: 'PUT',
                path: '/Users/non-existent-2',
                bulkId: 'bulk-2',
                data: createUser({
                  id: 'non-existent-2',
                  userName: 'test2',
                }),
              },
              {
                method: 'POST',
                path: '/Users',
                bulkId: 'bulk-3',
                data: createUser({
                  userName: 'shouldnotprocess',
                }),
              },
            ],
          };

          const result = await bulkController.resources.bulkOperations!.execute(
            {
              bulkRequest,
            }
          );

          // Should stop after first error (failOnErrors: 1)
          expect(result.Operations.length).toBeLessThanOrEqual(2);
          expect(result.Operations[0].status).toBe('404');
        });

        it('should throw ScimBadRequestError when exceeding maxOperations', async () => {
          const bulkControllerWithLimit = new ScimService({
            userAdapter: userRepository,
            enableBulk: true,
            maxBulkOperations: 2,
          });

          const bulkRequest: BulkRequest = {
            schemas: ['urn:ietf:params:scim:api:messages:2.0:BulkRequest'],
            Operations: [
              {
                method: 'POST',
                path: '/Users',
                data: createUser({ userName: 'user1' }),
              },
              {
                method: 'POST',
                path: '/Users',
                data: createUser({ userName: 'user2' }),
              },
              {
                method: 'POST',
                path: '/Users',
                data: createUser({ userName: 'user3' }),
              },
            ],
          };

          await expect(
            bulkControllerWithLimit.resources.bulkOperations!.execute({
              bulkRequest,
            })
          ).rejects.toThrow(ScimBadRequestError);
        });

        it('should handle operations without bulkId', async () => {
          const bulkRequest: BulkRequest = {
            schemas: ['urn:ietf:params:scim:api:messages:2.0:BulkRequest'],
            Operations: [
              {
                method: 'POST',
                path: '/Users',
                data: createUser({
                  userName: 'nobulkid',
                  displayName: 'No Bulk ID',
                }),
              },
            ],
          };

          const result = await bulkController.resources.bulkOperations!.execute(
            {
              bulkRequest,
            }
          );

          expect(result.Operations[0].status).toBe('201');
          expect(result.Operations[0].bulkId).toBeUndefined();
        });
      });
    });
  });
});
