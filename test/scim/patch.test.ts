import { describe, expect, it } from 'vitest';
import { applyPatch, PatchError } from '../../src/scim/patch.js';
import type { PatchRequest } from '../../src/scim/patch.dsl.js';
import type { User, Group, Email } from '../../src/scim/model.js';
import { SchemaUris } from '../../src/scim/uris.js';

describe('applyPatch', () => {
  describe('Schema Validation', () => {
    it('should reject PATCH request without PatchOp schema', () => {
      const user: User = {
        schemas: [SchemaUris.User],
        userName: 'test',
      };

      const patch: PatchRequest<User> = {
        schemas: [SchemaUris.User], // Missing PatchOp
        Operations: [{ op: 'replace', path: 'userName', value: 'new' }],
      };

      expect(() => applyPatch(user, patch)).toThrow(PatchError);
      expect(() => applyPatch(user, patch)).toThrow(
        'PATCH request must include schema'
      );
    });

    it('should accept PATCH request with PatchOp schema', () => {
      const user: User = {
        schemas: [SchemaUris.User],
        userName: 'test',
      };

      const patch: PatchRequest<User> = {
        schemas: [SchemaUris.PatchOp],
        Operations: [{ op: 'replace', path: 'userName', value: 'new' }],
      };

      const result = applyPatch(user, patch);
      expect(result.userName).toBe('new');
    });
  });

  describe('Add Operation', () => {
    it('should add a simple attribute', () => {
      const user: User = {
        schemas: [SchemaUris.User],
        userName: 'test',
      };

      const patch: PatchRequest<User> = {
        schemas: [SchemaUris.PatchOp],
        Operations: [{ op: 'add', path: 'displayName', value: 'Test User' }],
      };

      const result = applyPatch(user, patch);
      expect(result.displayName).toBe('Test User');
      expect(result.userName).toBe('test'); // Original unchanged
    });

    it('should replace existing single-value attribute when adding', () => {
      const user: User = {
        schemas: [SchemaUris.User],
        userName: 'test',
        displayName: 'Old Name',
      };

      const patch: PatchRequest<User> = {
        schemas: [SchemaUris.PatchOp],
        Operations: [{ op: 'add', path: 'displayName', value: 'New Name' }],
      };

      const result = applyPatch(user, patch);
      expect(result.displayName).toBe('New Name');
    });

    it('should add nested attribute', () => {
      const user: User = {
        schemas: [SchemaUris.User],
        userName: 'test',
      };

      const patch: PatchRequest<User> = {
        schemas: [SchemaUris.PatchOp],
        Operations: [{ op: 'add', path: 'name.givenName', value: 'John' }],
      };

      const result = applyPatch(user, patch);
      expect(result.name?.givenName).toBe('John');
    });

    it('should append to array attribute', () => {
      const user: User = {
        schemas: [SchemaUris.User],
        userName: 'test',
        emails: [{ value: 'test@example.com', primary: true }],
      };

      const newEmail: Email = { value: 'new@example.com', primary: false };
      const patch: PatchRequest<User> = {
        schemas: [SchemaUris.PatchOp],
        Operations: [{ op: 'add', path: 'emails', value: newEmail }],
      };

      const result = applyPatch(user, patch);
      expect(result.emails).toHaveLength(2);
      expect(result.emails?.[0].value).toBe('test@example.com');
      expect(result.emails?.[1].value).toBe('new@example.com');
    });

    it("should create array if it doesn't exist when adding", () => {
      const user: User = {
        schemas: [SchemaUris.User],
        userName: 'test',
      };

      const newEmail: Email = { value: 'new@example.com', primary: true };
      const patch: PatchRequest<User> = {
        schemas: [SchemaUris.PatchOp],
        Operations: [{ op: 'add', path: 'emails', value: newEmail }],
      };

      const result = applyPatch(user, patch);
      expect(result.emails).toHaveLength(1);
      expect(result.emails?.[0].value).toBe('new@example.com');
    });

    it('should not add duplicate when filter matches existing item', () => {
      const user: User = {
        schemas: [SchemaUris.User],
        userName: 'test',
        emails: [{ value: 'test@example.com', primary: true }],
      };

      const patch: PatchRequest<User> = {
        schemas: [SchemaUris.PatchOp],
        Operations: [
          {
            op: 'add',
            path: 'emails[value eq "test@example.com"]',
            value: { value: 'test@example.com', primary: false },
          },
        ],
      };

      const result = applyPatch(user, patch);
      expect(result.emails).toHaveLength(1); // Should not add duplicate
    });

    it("should add when filter doesn't match any item", () => {
      const user: User = {
        schemas: [SchemaUris.User],
        userName: 'test',
        emails: [{ value: 'test@example.com', primary: true }],
      };

      const patch: PatchRequest<User> = {
        schemas: [SchemaUris.PatchOp],
        Operations: [
          {
            op: 'add',
            path: 'emails[value eq "nonexistent@example.com"]',
            value: { value: 'new@example.com', primary: false },
          },
        ],
      };

      const result = applyPatch(user, patch);
      expect(result.emails).toHaveLength(2);
    });

    it('should merge partial resource when path is omitted', () => {
      const user: User = {
        schemas: [SchemaUris.User],
        userName: 'test',
      };

      const patch: PatchRequest<User> = {
        schemas: [SchemaUris.PatchOp],
        Operations: [
          {
            op: 'add',
            value: {
              displayName: 'Test User',
              active: true,
            },
          },
        ],
      };

      const result = applyPatch(user, patch);
      expect(result.displayName).toBe('Test User');
      expect(result.active).toBe(true);
      expect(result.userName).toBe('test'); // Original preserved
    });

    it('should throw error when adding with filter to non-array attribute', () => {
      const user: User = {
        schemas: [SchemaUris.User],
        userName: 'test',
      };

      const patch: PatchRequest<User> = {
        schemas: [SchemaUris.PatchOp],
        Operations: [
          {
            op: 'add',
            path: 'userName[value eq "test"]',
            value: 'new',
          },
        ],
      };

      expect(() => applyPatch(user, patch)).toThrow(PatchError);
      expect(() => applyPatch(user, patch)).toThrow('non-array attribute');
    });
  });

  describe('Replace Operation', () => {
    it('should replace simple attribute', () => {
      const user: User = {
        schemas: [SchemaUris.User],
        userName: 'test',
        displayName: 'Old Name',
      };

      const patch: PatchRequest<User> = {
        schemas: [SchemaUris.PatchOp],
        Operations: [{ op: 'replace', path: 'displayName', value: 'New Name' }],
      };

      const result = applyPatch(user, patch);
      expect(result.displayName).toBe('New Name');
    });

    it("should create attribute if it doesn't exist", () => {
      const user: User = {
        schemas: [SchemaUris.User],
        userName: 'test',
      };

      const patch: PatchRequest<User> = {
        schemas: [SchemaUris.PatchOp],
        Operations: [{ op: 'replace', path: 'displayName', value: 'New Name' }],
      };

      const result = applyPatch(user, patch);
      expect(result.displayName).toBe('New Name');
    });

    it('should replace nested attribute', () => {
      const user: User = {
        schemas: [SchemaUris.User],
        userName: 'test',
        name: {
          givenName: 'John',
          familyName: 'Doe',
        },
      };

      const patch: PatchRequest<User> = {
        schemas: [SchemaUris.PatchOp],
        Operations: [{ op: 'replace', path: 'name.givenName', value: 'Jane' }],
      };

      const result = applyPatch(user, patch);
      expect(result.name?.givenName).toBe('Jane');
      expect(result.name?.familyName).toBe('Doe'); // Other fields preserved
    });

    it('should replace entire array', () => {
      const user: User = {
        schemas: [SchemaUris.User],
        userName: 'test',
        emails: [{ value: 'old@example.com', primary: true }],
      };

      const newEmails: Email[] = [
        { value: 'new1@example.com', primary: true },
        { value: 'new2@example.com', primary: false },
      ];

      const patch: PatchRequest<User> = {
        schemas: [SchemaUris.PatchOp],
        Operations: [{ op: 'replace', path: 'emails', value: newEmails }],
      };

      const result = applyPatch(user, patch);
      expect(result.emails).toHaveLength(2);
      expect(result.emails?.[0].value).toBe('new1@example.com');
      expect(result.emails?.[1].value).toBe('new2@example.com');
    });

    it('should replace items in array matching filter', () => {
      const user: User = {
        schemas: [SchemaUris.User],
        userName: 'test',
        emails: [
          { value: 'test@example.com', primary: true },
          { value: 'other@example.com', primary: false },
        ],
      };

      const patch: PatchRequest<User> = {
        schemas: [SchemaUris.PatchOp],
        Operations: [
          {
            op: 'replace',
            path: 'emails[value eq "test@example.com"]',
            value: { value: 'test@example.com', primary: false, type: 'work' },
          },
        ],
      };

      const result = applyPatch(user, patch);
      expect(result.emails).toHaveLength(2);
      const updated = result.emails?.find(e => e.value === 'test@example.com');
      expect(updated?.primary).toBe(false);
      expect(updated?.type).toBe('work');
      expect(
        result.emails?.find(e => e.value === 'other@example.com')?.primary
      ).toBe(false);
    });

    it('should merge partial resource when path is omitted', () => {
      const user: User = {
        schemas: [SchemaUris.User],
        userName: 'test',
        displayName: 'Old Name',
      };

      const patch: PatchRequest<User> = {
        schemas: [SchemaUris.PatchOp],
        Operations: [
          {
            op: 'replace',
            value: {
              displayName: 'New Name',
              active: true,
            },
          },
        ],
      };

      const result = applyPatch(user, patch);
      expect(result.displayName).toBe('New Name');
      expect(result.active).toBe(true);
      expect(result.userName).toBe('test'); // Original preserved
    });

    it('should throw error when replacing with filter to non-array attribute', () => {
      const user: User = {
        schemas: [SchemaUris.User],
        userName: 'test',
      };

      const patch: PatchRequest<User> = {
        schemas: [SchemaUris.PatchOp],
        Operations: [
          {
            op: 'replace',
            path: 'userName[value eq "test"]',
            value: 'new',
          },
        ],
      };

      expect(() => applyPatch(user, patch)).toThrow(PatchError);
      expect(() => applyPatch(user, patch)).toThrow('non-array attribute');
    });
  });

  describe('Remove Operation', () => {
    it('should remove simple attribute', () => {
      const user: User = {
        schemas: [SchemaUris.User],
        userName: 'test',
        displayName: 'Test User',
      };

      const patch: PatchRequest<User> = {
        schemas: [SchemaUris.PatchOp],
        Operations: [{ op: 'remove', path: 'displayName' }],
      };

      const result = applyPatch(user, patch);
      expect(result.displayName).toBeUndefined();
      expect(result.userName).toBe('test'); // Other attributes preserved
    });

    it("should do nothing if attribute doesn't exist", () => {
      const user: User = {
        schemas: [SchemaUris.User],
        userName: 'test',
      };

      const patch: PatchRequest<User> = {
        schemas: [SchemaUris.PatchOp],
        Operations: [{ op: 'remove', path: 'displayName' }],
      };

      const result = applyPatch(user, patch);
      expect(result).toEqual(user);
    });

    it('should remove nested attribute', () => {
      const user: User = {
        schemas: [SchemaUris.User],
        userName: 'test',
        name: {
          givenName: 'John',
          familyName: 'Doe',
        },
      };

      const patch: PatchRequest<User> = {
        schemas: [SchemaUris.PatchOp],
        Operations: [{ op: 'remove', path: 'name.givenName' }],
      };

      const result = applyPatch(user, patch);
      expect(result.name?.givenName).toBeUndefined();
      expect(result.name?.familyName).toBe('Doe'); // Other fields preserved
    });

    it('should remove all items from array when no filter or value', () => {
      const user: User = {
        schemas: [SchemaUris.User],
        userName: 'test',
        emails: [
          { value: 'test1@example.com', primary: true },
          { value: 'test2@example.com', primary: false },
        ],
      };

      const patch: PatchRequest<User> = {
        schemas: [SchemaUris.PatchOp],
        Operations: [{ op: 'remove', path: 'emails' }],
      };

      const result = applyPatch(user, patch);
      expect(result.emails).toEqual([]);
    });

    it('should remove items matching filter from array', () => {
      const user: User = {
        schemas: [SchemaUris.User],
        userName: 'test',
        emails: [
          { value: 'test@example.com', primary: true },
          { value: 'other@example.com', primary: false },
        ],
      };

      const patch: PatchRequest<User> = {
        schemas: [SchemaUris.PatchOp],
        Operations: [
          {
            op: 'remove',
            path: 'emails[value eq "test@example.com"]',
          },
        ],
      };

      const result = applyPatch(user, patch);
      expect(result.emails).toHaveLength(1);
      expect(result.emails?.[0].value).toBe('other@example.com');
    });

    it('should remove items matching value from array', () => {
      const user: User = {
        schemas: [SchemaUris.User],
        userName: 'test',
        emails: [
          { value: 'test@example.com', primary: true },
          { value: 'other@example.com', primary: false },
        ],
      };

      const patch: PatchRequest<User> = {
        schemas: [SchemaUris.PatchOp],
        Operations: [
          {
            op: 'remove',
            path: 'emails',
            value: { value: 'test@example.com', primary: true },
          },
        ],
      };

      const result = applyPatch(user, patch);
      expect(result.emails).toHaveLength(1);
      expect(result.emails?.[0].value).toBe('other@example.com');
    });

    it('should reject remove operation without path (RFC 7644 requires path for remove)', () => {
      const user: User = {
        schemas: [SchemaUris.User],
        userName: 'test',
        displayName: 'Test User',
      };

      // TypeScript should prevent this, but we test runtime validation
      // Using 'unknown' first to bypass type checking for this test case
      const patch = {
        schemas: [SchemaUris.PatchOp],
        Operations: [
          {
            op: 'remove' as const,
            value: {
              displayName: 'Test User',
            },
          },
        ],
      } as unknown as PatchRequest<User>;

      expect(() => applyPatch(user, patch)).toThrow(PatchError);
      expect(() => applyPatch(user, patch)).toThrow(
        'Remove operation requires a "path" attribute'
      );
    });

    it('should throw error when removing with filter from non-array attribute', () => {
      const user: User = {
        schemas: [SchemaUris.User],
        userName: 'test',
      };

      const patch: PatchRequest<User> = {
        schemas: [SchemaUris.PatchOp],
        Operations: [
          {
            op: 'remove',
            path: 'userName[value eq "test"]',
          },
        ],
      };

      expect(() => applyPatch(user, patch)).toThrow(PatchError);
      expect(() => applyPatch(user, patch)).toThrow('non-array attribute');
    });
  });

  describe('Multiple Operations', () => {
    it('should apply multiple operations in order', () => {
      const user: User = {
        schemas: [SchemaUris.User],
        userName: 'test',
      };

      const patch: PatchRequest<User> = {
        schemas: [SchemaUris.PatchOp],
        Operations: [
          { op: 'add', path: 'displayName', value: 'Test User' },
          { op: 'add', path: 'active', value: true },
          { op: 'replace', path: 'displayName', value: 'Updated User' },
        ],
      };

      const result = applyPatch(user, patch);
      expect(result.displayName).toBe('Updated User'); // Last operation wins
      expect(result.active).toBe(true);
    });

    it('should handle complex multi-operation patch', () => {
      const user: User = {
        schemas: [SchemaUris.User],
        userName: 'test',
        emails: [{ value: 'old@example.com', primary: true }],
      };

      const patch: PatchRequest<User> = {
        schemas: [SchemaUris.PatchOp],
        Operations: [
          { op: 'add', path: 'name.givenName', value: 'John' },
          { op: 'add', path: 'name.familyName', value: 'Doe' },
          {
            op: 'add',
            path: 'emails',
            value: { value: 'new@example.com', primary: false },
          },
          {
            op: 'replace',
            path: 'emails[value eq "old@example.com"]',
            value: { value: 'old@example.com', primary: false },
          },
          { op: 'remove', path: 'emails[value eq "old@example.com"]' },
        ],
      };

      const result = applyPatch(user, patch);
      expect(result.name?.givenName).toBe('John');
      expect(result.name?.familyName).toBe('Doe');
      expect(result.emails).toHaveLength(1);
      expect(result.emails?.[0].value).toBe('new@example.com');
    });
  });

  describe('Edge Cases', () => {
    it('should handle empty operations array', () => {
      const user: User = {
        schemas: [SchemaUris.User],
        userName: 'test',
      };

      const patch: PatchRequest<User> = {
        schemas: [SchemaUris.PatchOp],
        Operations: [],
      };

      const result = applyPatch(user, patch);
      expect(result).toEqual(user);
    });

    it('should handle null and undefined values', () => {
      const user: User = {
        schemas: [SchemaUris.User],
        userName: 'test',
        displayName: 'Test',
      };

      const patch: PatchRequest<User> = {
        schemas: [SchemaUris.PatchOp],
        Operations: [{ op: 'replace', path: 'displayName', value: null }],
      };

      const result = applyPatch(user, patch);
      expect(result.displayName).toBeNull();
    });

    it('should preserve original resource immutability', () => {
      const user: User = {
        schemas: [SchemaUris.User],
        userName: 'test',
        displayName: 'Original',
      };

      const patch: PatchRequest<User> = {
        schemas: [SchemaUris.PatchOp],
        Operations: [{ op: 'replace', path: 'displayName', value: 'Updated' }],
      };

      const result = applyPatch(user, patch);
      expect(result.displayName).toBe('Updated');
      expect(user.displayName).toBe('Original'); // Original unchanged
    });

    it('should handle deeply nested paths', () => {
      const user: User = {
        schemas: [SchemaUris.User],
        userName: 'test',
      };

      const patch: PatchRequest<User> = {
        schemas: [SchemaUris.PatchOp],
        Operations: [
          { op: 'add', path: 'name.givenName', value: 'John' },
          { op: 'add', path: 'name.familyName', value: 'Doe' },
        ],
      };

      const result = applyPatch(user, patch);
      expect(result.name?.givenName).toBe('John');
      expect(result.name?.familyName).toBe('Doe');
    });

    it('should handle Group resources', () => {
      const group: Group = {
        schemas: [SchemaUris.Group],
        displayName: 'Test Group',
      };

      const patch: PatchRequest<Group> = {
        schemas: [SchemaUris.PatchOp],
        Operations: [
          {
            op: 'add',
            path: 'members',
            value: { value: 'user1', display: 'User 1' },
          },
        ],
      };

      const result = applyPatch(group, patch);
      expect(result.members).toHaveLength(1);
      expect(result.members?.[0].value).toBe('user1');
    });
  });

  describe('Error Handling', () => {
    it('should throw PatchError with operation context', () => {
      const user: User = {
        schemas: [SchemaUris.User],
        userName: 'test',
      };

      const patch: PatchRequest<User> = {
        schemas: [SchemaUris.PatchOp],
        Operations: [
          {
            op: 'add',
            path: 'userName[value eq "test"]',
            value: 'new',
          },
        ],
      };

      try {
        applyPatch(user, patch);
        expect.fail('Should have thrown PatchError');
      } catch (error) {
        expect(error).toBeInstanceOf(PatchError);
        if (error instanceof PatchError) {
          expect(error.operation).toBeDefined();
          expect(error.path).toBe('userName[value eq "test"]');
        }
      }
    });

    it('should throw error for invalid filter syntax in path', () => {
      const user: User = {
        schemas: [SchemaUris.User],
        userName: 'test',
      };

      const patch: PatchRequest<User> = {
        schemas: [SchemaUris.PatchOp],
        Operations: [
          {
            op: 'add',
            path: 'emails[invalid filter syntax]',
            value: { value: 'test@example.com' },
          },
        ],
      };

      expect(() => applyPatch(user, patch)).toThrow(PatchError);
    });

    it('should throw error for unknown operation type', () => {
      const user: User = {
        schemas: [SchemaUris.User],
        userName: 'test',
      };

      const patch = {
        schemas: [SchemaUris.PatchOp],
        Operations: [
          {
            op: 'unknown' as any,
            path: 'userName',
            value: 'new',
          },
        ],
      };

      expect(() => applyPatch(user, patch as PatchRequest<User>)).toThrow(
        PatchError
      );
      expect(() => applyPatch(user, patch as PatchRequest<User>)).toThrow(
        'Unknown operation'
      );
    });
  });
});
