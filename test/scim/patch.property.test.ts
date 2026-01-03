import { describe, expect, it } from 'vitest';
import fc from 'fast-check';
import { applyPatch } from '../../src/scim/patch.js';
import type { PatchRequest } from '../../src/scim/patch.dsl.js';
import type { User, Email } from '../../src/scim/model.js';
import { SchemaUris } from '../../src/scim/uris.js';
import {
  userArb,
  patchRequestArb,
  stringArb,
  booleanArb,
  emailArb,
  buildOptions,
} from './arbitraries.js';

const NUM_RUNS = 2000;

describe('applyPatch - Property Tests', () => {
  it('should have basic properties evaluated', () => {
    fc.assert(
      fc.property(userArb, patchRequestArb, (user, patch) => {
        let result: User | undefined;
        try {
          const originalUser = JSON.parse(JSON.stringify(user)); // Deep clone
          result = applyPatch(user, patch);

          // Original should be unchanged
          expect(user).toEqual(originalUser);

          // Result should have required User properties
          expect(result).toHaveProperty('schemas');
          expect(result).toHaveProperty('userName');
          expect(typeof result.userName).toBe('string');
          expect(result.userName.length).toBeGreaterThan(0);

          // Schemas should be preserved
          expect(result.schemas).toEqual(user.schemas);
        } catch (error) {
          console.log('User:', JSON.stringify(user, null, 2));
          console.log('Patch:', JSON.stringify(patch, null, 2));
          console.log('Result:', JSON.stringify(result, null, 2));
          throw error;
        }
      }),
      buildOptions(NUM_RUNS)
    );
  });

  it('should be idempotent for replace operations on same path', () => {
    // Generate path-value pairs where the value type matches the path
    const pathValueArb = fc.oneof(
      // String paths (accept string or null)
      fc.record({
        path: fc.constant('displayName' as const),
        value: fc.oneof(stringArb, fc.constant(null)),
      }),
      fc.record({
        path: fc.constant('nickName' as const),
        value: fc.oneof(stringArb, fc.constant(null)),
      }),
      fc.record({
        path: fc.constant('title' as const),
        value: fc.oneof(stringArb, fc.constant(null)),
      }),
      // Boolean path
      fc.record({
        path: fc.constant('active' as const),
        value: booleanArb,
      })
    );

    fc.assert(
      fc.property(userArb, pathValueArb, (user, { path, value }) => {
        let result1: User | undefined;
        let result2: User | undefined;
        let patch1: PatchRequest<User> | undefined;
        let patch2: PatchRequest<User> | undefined;
        try {
          patch1 = {
            schemas: [SchemaUris.PatchOp],
            Operations: [{ op: 'replace', path, value }],
          };
          result1 = applyPatch(user, patch1);

          patch2 = {
            schemas: [SchemaUris.PatchOp],
            Operations: [{ op: 'replace', path, value }],
          };
          result2 = applyPatch(result1, patch2);

          // Applying the same replace twice should be idempotent
          expect(result2).toEqual(result1);
        } catch (error) {
          console.log('User:', JSON.stringify(user, null, 2));
          console.log('Patch1:', JSON.stringify(patch1, null, 2));
          console.log('Result1:', JSON.stringify(result1, null, 2));
          console.log('Patch2:', JSON.stringify(patch2, null, 2));
          console.log('Result2:', JSON.stringify(result2, null, 2));
          throw error;
        }

        // Applying the same replace twice should be idempotent
        expect(result2).toEqual(result1);
      }),
      buildOptions(NUM_RUNS)
    );
  });

  it('should apply operations in sequence', () => {
    fc.assert(
      fc.property(
        userArb,
        fc.string({ minLength: 1, maxLength: 50 }),
        fc.string({ minLength: 1, maxLength: 50 }),
        (user, value1, value2) => {
          let result: User | undefined;
          let patch: PatchRequest<User> | undefined;
          try {
            // Apply two replace operations in order
            patch = {
              schemas: [SchemaUris.PatchOp],
              Operations: [
                { op: 'replace', path: 'displayName', value: value1 },
                { op: 'replace', path: 'displayName', value: value2 },
              ],
            };

            result = applyPatch(user, patch);
          } catch (error) {
            console.log('User:', JSON.stringify(user, null, 2));
            console.log('Value1:', value1);
            console.log('Value2:', value2);
            console.log('Patch:', JSON.stringify(patch, null, 2));
            console.log('Result:', JSON.stringify(result, null, 2));
            throw error;
          }
          // Final value should be value2 (last operation wins)
          expect(result.displayName).toBe(value2);
        }
      ),
      buildOptions(NUM_RUNS)
    );
  });

  it('should correctly resolve nested paths for replace and add operations', () => {
    fc.assert(
      fc.property(
        userArb,
        fc.string({ minLength: 1, maxLength: 50 }),
        fc.constantFrom('replace', 'add'),
        (user, name, operation) => {
          let result: User | undefined;
          let patch: PatchRequest<User> | undefined;
          try {
            if (operation === 'replace') {
              patch = {
                schemas: [SchemaUris.PatchOp],
                Operations: [
                  { op: 'replace', path: 'name.givenName', value: name },
                ],
              };
              result = applyPatch(user, patch);
              expect(result.name?.givenName).toBe(name);
            } else {
              patch = {
                schemas: [SchemaUris.PatchOp],
                Operations: [
                  { op: 'add', path: 'name.familyName', value: name },
                ],
              };
              result = applyPatch(user, patch);
              expect(result.name?.familyName).toBe(name);
            }
          } catch (error) {
            console.log('User:', JSON.stringify(user, null, 2));
            console.log('Name:', name);
            console.log('Operation:', operation);
            console.log('Patch:', JSON.stringify(patch, null, 2));
            console.log('Result:', JSON.stringify(result, null, 2));
            throw error;
          }
        }
      ),
      buildOptions(NUM_RUNS)
    );
  });

  it('should handle add and remove operations on email arrays', () => {
    fc.assert(
      fc.property(
        fc.oneof(
          userArb,
          userArb.filter((u): u is User => !!(u.emails && u.emails.length > 0))
        ),
        emailArb,
        fc.constantFrom('work', 'home', 'other'),
        fc.constantFrom('add', 'remove'),
        (user, emailValue, emailType, operation) => {
          let result: User | undefined;
          let patch: PatchRequest<User> | undefined;
          try {
            if (operation === 'add') {
              const newEmail: Email = {
                value: emailValue,
                type: emailType,
                primary: false,
              };
              patch = {
                schemas: [SchemaUris.PatchOp],
                Operations: [{ op: 'add', path: 'emails', value: newEmail }],
              };
              result = applyPatch(user, patch);
              expect(Array.isArray(result.emails)).toBe(true);
              expect(result.emails?.length).toBeGreaterThan(0);
              expect(result.emails?.some(e => e.value === emailValue)).toBe(
                true
              );
            } else if (user.emails && user.emails.length > 0) {
              const emailToRemove = user.emails[0];
              patch = {
                schemas: [SchemaUris.PatchOp],
                Operations: [
                  {
                    op: 'remove',
                    path: 'emails',
                    value: emailToRemove,
                  },
                ],
              };
              result = applyPatch(user, patch);
              if (result.emails) {
                expect(result.emails.length).toBeLessThan(user.emails.length);
              }
            }
          } catch (error) {
            console.log('User:', JSON.stringify(user, null, 2));
            console.log('EmailValue:', emailValue);
            console.log('EmailType:', emailType);
            console.log('Operation:', operation);
            console.log('Patch:', JSON.stringify(patch, null, 2));
            console.log('Result:', JSON.stringify(result, null, 2));
            throw error;
          }
        }
      ),
      buildOptions(NUM_RUNS)
    );
  });

  it('should replace existing values and create new values for non-existent paths', () => {
    fc.assert(
      fc.property(
        userArb,
        fc.string({ minLength: 1, maxLength: 100 }),
        (user, displayName) => {
          let result: User | undefined;
          let patch: PatchRequest<User> | undefined;
          try {
            patch = {
              schemas: [SchemaUris.PatchOp],
              Operations: [
                { op: 'replace', path: 'displayName', value: displayName },
              ],
            };

            result = applyPatch(user, patch);
            expect(result.displayName).toBe(displayName);
          } catch (error) {
            console.log('User:', JSON.stringify(user, null, 2));
            console.log('DisplayName:', displayName);
            console.log('Patch:', JSON.stringify(patch, null, 2));
            console.log('Result:', JSON.stringify(result, null, 2));
            throw error;
          }
        }
      ),
      buildOptions(NUM_RUNS)
    );
  });

  it('should remove existing attributes and be safe for non-existent attributes', () => {
    fc.assert(
      fc.property(userArb, user => {
        let result: User | undefined;
        let patch: PatchRequest<User> | undefined;
        try {
          patch = {
            schemas: [SchemaUris.PatchOp],
            Operations: [{ op: 'remove', path: 'displayName' }],
          };

          result = applyPatch(user, patch);
          expect(result).toHaveProperty('userName');
          expect(result.displayName).toBeUndefined();
        } catch (error) {
          console.log('User:', JSON.stringify(user, null, 2));
          console.log('Patch:', JSON.stringify(patch, null, 2));
          console.log('Result:', JSON.stringify(result, null, 2));
          throw error;
        }
      }),
      buildOptions(NUM_RUNS)
    );
  });
  it('should handle multiple operations correctly and add then remove operations', () => {
    fc.assert(
      fc.property(
        userArb,
        fc.string({ minLength: 1, maxLength: 50 }),
        fc.string({ minLength: 1, maxLength: 50 }),
        booleanArb,
        fc.constantFrom('multiple', 'addRemove'),
        (user, displayName, nickName, active, testType) => {
          let result: User | undefined;
          let patch: PatchRequest<User> | undefined;
          try {
            if (testType === 'multiple') {
              patch = {
                schemas: [SchemaUris.PatchOp],
                Operations: [
                  { op: 'replace', path: 'displayName', value: displayName },
                  { op: 'replace', path: 'nickName', value: nickName },
                  { op: 'replace', path: 'active', value: active },
                ],
              };
              result = applyPatch(user, patch);
              expect(result.displayName).toBe(displayName);
              expect(result.nickName).toBe(nickName);
              expect(result.active).toBe(active);
            } else if (user.displayName === undefined) {
              patch = {
                schemas: [SchemaUris.PatchOp],
                Operations: [
                  { op: 'add', path: 'displayName', value: displayName },
                  { op: 'remove', path: 'displayName' },
                ],
              };
              result = applyPatch(user, patch);
              // After add then remove, should be undefined
              expect(result.displayName).toBeUndefined();
            }
          } catch (error) {
            console.log('User:', JSON.stringify(user, null, 2));
            console.log('DisplayName:', displayName);
            console.log('NickName:', nickName);
            console.log('Active:', active);
            console.log('TestType:', testType);
            console.log('Patch:', JSON.stringify(patch, null, 2));
            console.log('Result:', JSON.stringify(result, null, 2));
            throw error;
          }
        }
      ),
      buildOptions(NUM_RUNS)
    );
  });
  it('should handle empty operations array and operations on root level (no path)', () => {
    fc.assert(
      fc.property(
        userArb,
        fc.oneof(
          fc.constant(null), // Empty operations case
          fc.record({
            displayName: fc.option(stringArb),
            nickName: fc.option(stringArb),
          })
        ),
        (user, partialUserOrNull) => {
          let result: User | undefined;
          let patch: PatchRequest<User> | undefined;
          try {
            if (partialUserOrNull === null) {
              patch = {
                schemas: [SchemaUris.PatchOp],
                Operations: [],
              };
              result = applyPatch(user, patch);
              // Should return unchanged resource
              expect(result).toEqual(user);
            } else {
              patch = {
                schemas: [SchemaUris.PatchOp],
                Operations: [{ op: 'replace', value: partialUserOrNull }],
              };
              result = applyPatch(user, patch);
              // Should merge the partial user
              if (partialUserOrNull.displayName !== undefined) {
                expect(result.displayName).toBe(partialUserOrNull.displayName);
              }
              if (partialUserOrNull.nickName !== undefined) {
                expect(result.nickName).toBe(partialUserOrNull.nickName);
              }
            }
          } catch (error) {
            console.log('User:', JSON.stringify(user, null, 2));
            console.log('PartialUserOrNull:', partialUserOrNull);
            console.log('Patch:', JSON.stringify(patch, null, 2));
            console.log('Result:', JSON.stringify(result, null, 2));
            throw error;
          }
        }
      ),
      buildOptions(NUM_RUNS)
    );
  });
});
