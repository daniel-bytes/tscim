import type { Resource } from './model.js';
import type { PatchRequest, PatchOperation } from './patch.dsl.js';
import {
  parseFilter,
  type Filter,
  type AttributeExpression,
} from './filter.dsl.js';
import { SchemaUris } from './uris.js';
import { getValue, compareValue } from './helpers.js';

/**
 * SCIM PATCH Implementation
 *
 * Implements RFC 7644 Section 3.5.2 - PATCH
 * https://datatracker.ietf.org/doc/html/rfc7644#section-3.5.2
 */

/**
 * Error thrown when a PATCH operation fails
 */
export class PatchError extends Error {
  constructor(
    message: string,
    public readonly operation?: PatchOperation<Resource>,
    public readonly path?: string
  ) {
    super(message);
    this.name = 'PatchError';
  }
}

/**
 * Parsed path component for PATCH operations
 */
interface ParsedPath {
  /** The attribute path segments (e.g., ["name", "givenName"]) */
  segments: string[];
  /** Optional filter for array operations (e.g., "emails[value eq \"test\"]") */
  filter?: Filter;
}

/**
 * Parse a PATCH path string into segments and optional filter
 * Handles paths like:
 * - "userName" -> { segments: ["userName"] }
 * - "name.givenName" -> { segments: ["name", "givenName"] }
 * - "emails[value eq \"test@example.com\"]" -> { segments: ["emails"], filter: ... }
 */
function parsePath(path: string): ParsedPath {
  // Check for array filter syntax: attrName[filter]
  const filterMatch = path.match(/^([^[]+)\[(.+)\]$/);
  if (filterMatch) {
    const [, attrPath, filterStr] = filterMatch;
    const filterResult = parseFilter(filterStr.trim());
    if (filterResult.isLeft()) {
      throw new PatchError(
        `Invalid filter in path "${path}": ${filterResult.value.message}`,
        undefined,
        path
      );
    }
    return {
      segments: attrPath.split('.').filter(Boolean),
      filter: filterResult.value,
    };
  }

  // Simple path (no filter)
  return {
    segments: path.split('.').filter(Boolean),
  };
}

/**
 * Check if a filter matches a value (for array operations)
 */
function matchesFilter(value: unknown, filter: Filter): boolean {
  if (filter.type === 'attribute') {
    return matchesAttributeExpression(value, filter);
  } else if (filter.type === 'logical') {
    const leftMatch = matchesFilter(value, filter.left);
    const rightMatch = matchesFilter(value, filter.right);
    if (filter.operator === 'and') {
      return leftMatch && rightMatch;
    } else {
      return leftMatch || rightMatch;
    }
  } else if (filter.type === 'not') {
    return !matchesFilter(value, filter.filter);
  } else if (filter.type === 'valuePath') {
    // For valuePath, check if the nested attribute matches
    const nestedValue = getValue(value, [
      filter.attrPath.attrName,
      ...(filter.attrPath.subAttr ? [filter.attrPath.subAttr] : []),
    ]);
    return matchesFilter(nestedValue, filter.valFilter);
  }
  return false;
}

/**
 * Check if an attribute expression matches a value
 */
function matchesAttributeExpression(
  value: unknown,
  expr: AttributeExpression
): boolean {
  if (expr.present !== undefined) {
    // "pr" (present) operator - check if the attribute exists
    if (typeof value === 'object' && value !== null) {
      const attrValue = (value as Record<string, unknown>)[
        expr.attrPath.attrName
      ];
      return attrValue !== undefined && attrValue !== null;
    }
    return value !== undefined && value !== null;
  }

  if (expr.operator === undefined || expr.value === undefined) {
    return false;
  }

  // Get the attribute value from the object
  let attrValue = value;
  if (typeof value === 'object' && value !== null) {
    // First get the main attribute
    attrValue = (value as Record<string, unknown>)[expr.attrPath.attrName];
    // Then get sub-attribute if it exists
    if (
      expr.attrPath.subAttr
      && typeof attrValue === 'object'
      && attrValue !== null
    ) {
      attrValue = (attrValue as Record<string, unknown>)[expr.attrPath.subAttr];
    }
  }

  return compareValue(attrValue, expr.operator, expr.value);
}

/**
 * Validate that a value matches the expected type for a given attribute path
 * Throws PatchError if the type doesn't match
 */
function validateValueType(
  resource: Resource,
  segments: string[],
  value: unknown,
  operation: PatchOperation<Resource>
): void {
  // Skip validation for array operations (they can contain various types)
  if (segments.length === 0) {
    return;
  }

  const [first, ...rest] = segments;

  // Check if this is a User resource
  if (resource.schemas.includes(SchemaUris.User)) {
    // Validate top-level attributes
    if (rest.length === 0) {
      switch (first) {
        case 'userName':
          if (typeof value !== 'string') {
            throw new PatchError(
              `Invalid value type for "userName": expected string, got ${typeof value}`,
              operation,
              segments.join('.')
            );
          }
          if (value.length === 0) {
            throw new PatchError(
              'Invalid value for "userName": cannot be empty string',
              operation,
              segments.join('.')
            );
          }
          return;
        case 'active':
          if (typeof value !== 'boolean') {
            throw new PatchError(
              `Invalid value type for "active": expected boolean, got ${typeof value}`,
              operation,
              segments.join('.')
            );
          }
          return;
        case 'displayName':
        case 'nickName':
        case 'title':
          if (
            value !== null
            && value !== undefined
            && typeof value !== 'string'
          ) {
            throw new PatchError(
              `Invalid value type for "${first}": expected string or null, got ${typeof value}`,
              operation,
              segments.join('.')
            );
          }
          return;
      }
    }

    // Validate nested attributes (e.g., name.givenName)
    if (rest.length === 1 && first === 'name') {
      const subAttr = rest[0];
      if (
        subAttr === 'givenName'
        || subAttr === 'familyName'
        || subAttr === 'formatted'
      ) {
        if (
          value !== null
          && value !== undefined
          && typeof value !== 'string'
        ) {
          throw new PatchError(
            `Invalid value type for "name.${subAttr}": expected string or null, got ${typeof value}`,
            operation,
            segments.join('.')
          );
        }
        return;
      }
    }
  }

  // For other resource types or unknown paths, we can't validate
  // This is a conservative approach - we only validate known User attributes
}

/**
 * Set a value in an object using a path (immutably)
 */
function setValue<T>(obj: T, segments: string[], value: unknown): T {
  if (segments.length === 0) {
    return value as T;
  }

  const [first, ...rest] = segments;
  const current = obj as Record<string, unknown>;
  const newObj = { ...current };

  if (rest.length === 0) {
    // Leaf node
    if (value === undefined) {
      delete newObj[first];
    } else {
      newObj[first] = value;
    }
  } else {
    // Nested path
    const nested = current[first];
    if (nested === null || nested === undefined || typeof nested !== 'object') {
      // Create new nested object
      newObj[first] = setValue({}, rest, value);
    } else if (Array.isArray(nested)) {
      // Can't set nested path in array
      throw new PatchError(
        `Cannot set nested path "${rest.join('.')}" in array attribute "${first}"`,
        undefined,
        segments.join('.')
      );
    } else {
      // Recursively set in nested object
      newObj[first] = setValue(nested, rest, value);
    }
  }

  return newObj as T;
}

/**
 * Apply an "add" operation
 * RFC 7644 Section 3.5.2.1
 */
function applyAdd<TResource extends Resource>(
  resource: TResource,
  operation: Extract<PatchOperation<TResource>, { op: 'add' }>
): TResource {
  // If no path, treat value as a partial resource and merge
  if (!operation.path) {
    if (typeof operation.value !== 'object' || operation.value === null) {
      throw new PatchError(
        'Add operation without path requires an object value',
        operation
      );
    }
    return { ...resource, ...(operation.value as Partial<TResource>) };
  }

  const parsed = parsePath(operation.path);
  const currentValue = getValue(resource, parsed.segments);

  // Handle array operations
  if (parsed.filter) {
    if (!Array.isArray(currentValue)) {
      throw new PatchError(
        `Cannot apply filter to non-array attribute "${parsed.segments.join('.')}"`,
        operation,
        operation.path
      );
    }

    // Find matching items
    const matches = (currentValue as unknown[]).filter(item =>
      matchesFilter(item, parsed.filter!)
    );

    if (matches.length === 0) {
      // No matches, append the value
      const newArray = [...currentValue, operation.value];
      return setValue(resource, parsed.segments, newArray);
    } else {
      // Items already exist, don't add duplicates (RFC 7644 says add should not create duplicates)
      return resource;
    }
  }

  // Non-array operation
  if (Array.isArray(currentValue)) {
    // Append to array
    const newArray = [...currentValue, operation.value];
    return setValue(resource, parsed.segments, newArray);
  } else if (currentValue === undefined || currentValue === null) {
    // If the path suggests this is an array attribute (common SCIM patterns), create an array
    // Common SCIM array attributes end with 's' (emails, addresses, phoneNumbers, etc.)
    const lastSegment = parsed.segments[parsed.segments.length - 1];
    const isLikelyArray =
      lastSegment.endsWith('s') && lastSegment !== 'schemas';

    if (isLikelyArray) {
      // Create as array
      return setValue(resource, parsed.segments, [operation.value]);
    } else {
      // Create as single value - validate type
      validateValueType(resource, parsed.segments, operation.value, operation);
      return setValue(resource, parsed.segments, operation.value);
    }
  } else {
    // Replace existing single value (RFC 7644: "If the target location specifies a single-value attribute, the existing value is replaced")
    // Validate type before replacing
    validateValueType(resource, parsed.segments, operation.value, operation);
    return setValue(resource, parsed.segments, operation.value);
  }
}

/**
 * Apply a "replace" operation
 * RFC 7644 Section 3.5.2.1
 */
function applyReplace<TResource extends Resource>(
  resource: TResource,
  operation: Extract<PatchOperation<TResource>, { op: 'replace' }>
): TResource {
  // If no path, treat value as a partial resource and replace matching attributes
  if (!operation.path) {
    if (typeof operation.value !== 'object' || operation.value === null) {
      throw new PatchError(
        'Replace operation without path requires an object value',
        operation
      );
    }
    return { ...resource, ...(operation.value as Partial<TResource>) };
  }

  const parsed = parsePath(operation.path);
  const currentValue = getValue(resource, parsed.segments);

  // Handle array operations with filter
  if (parsed.filter) {
    if (!Array.isArray(currentValue)) {
      throw new PatchError(
        `Cannot apply filter to non-array attribute "${parsed.segments.join('.')}"`,
        operation,
        operation.path
      );
    }

    // Replace matching items
    const newArray = (currentValue as unknown[]).map(item => {
      if (matchesFilter(item, parsed.filter!)) {
        // If value is an object, merge it with the existing item
        if (
          typeof operation.value === 'object'
          && operation.value !== null
          && typeof item === 'object'
          && item !== null
        ) {
          return {
            ...(item as Record<string, unknown>),
            ...(operation.value as Record<string, unknown>),
          };
        }
        return operation.value;
      }
      return item;
    });

    return setValue(resource, parsed.segments, newArray);
  }

  // Non-array operation - simple replace
  // Validate type before replacing (unless it's an array)
  if (!Array.isArray(currentValue)) {
    validateValueType(resource, parsed.segments, operation.value, operation);
  }
  return setValue(resource, parsed.segments, operation.value);
}

/**
 * Apply a "remove" operation
 * RFC 7644 Section 3.5.2.1
 */
function applyRemove<TResource extends Resource>(
  resource: TResource,
  operation: Extract<PatchOperation<TResource>, { op: 'remove' }>
): TResource {
  // RFC 7644 Section 3.5.2: "path" is REQUIRED for remove operations
  // Type system enforces this, but we check at runtime for safety
  if (!operation.path) {
    throw new PatchError(
      'Remove operation requires a "path" attribute per RFC 7644 Section 3.5.2',
      operation
    );
  }

  const parsed = parsePath(operation.path);
  const currentValue = getValue(resource, parsed.segments);

  if (currentValue === undefined) {
    // Attribute doesn't exist, nothing to remove
    return resource;
  }

  // Handle array operations
  if (parsed.filter || Array.isArray(currentValue)) {
    if (!Array.isArray(currentValue)) {
      throw new PatchError(
        `Cannot apply filter to non-array attribute "${parsed.segments.join('.')}"`,
        operation,
        operation.path
      );
    }

    const filterToUse = parsed.filter;

    // If no filter but value is provided, remove items matching the value
    if (!filterToUse && operation.value !== undefined) {
      // For simple value matching, we'll filter by direct equality (keep items that DON'T match)
      const newArray = (currentValue as unknown[]).filter(item => {
        if (
          typeof item === 'object'
          && item !== null
          && typeof operation.value === 'object'
          && operation.value !== null
        ) {
          // Partial object match - check if all properties in operation.value match
          // If they match, we remove the item (return false)
          const valueObj = operation.value as Record<string, unknown>;
          const matches = Object.keys(valueObj).every(key => {
            const itemValue = (item as Record<string, unknown>)[key];
            return itemValue === valueObj[key];
          });
          return !matches; // Keep items that don't match
        }
        return item !== operation.value; // Keep items that don't match
      });
      return setValue(resource, parsed.segments, newArray);
    }

    if (filterToUse) {
      // Remove items matching the filter
      const newArray = (currentValue as unknown[]).filter(
        item => !matchesFilter(item, filterToUse!)
      );
      return setValue(resource, parsed.segments, newArray);
    } else {
      // No filter and no value - remove all items (set to empty array)
      // RFC 7644: "If no filter is specified, the entire attribute SHALL be removed"
      return setValue(resource, parsed.segments, []);
    }
  }

  // Non-array operation - remove the attribute
  return setValue(resource, parsed.segments, undefined);
}

/**
 * Apply a SCIM PATCH request to a resource
 *
 * @param resource - The resource to patch
 * @param patch - The PATCH request containing operations
 * @returns The patched resource (new object, original is not modified)
 * @throws {PatchError} If the PATCH operation fails
 *
 * @example
 * ```ts
 * const user: User = { schemas: [SchemaUris.User], userName: "john" };
 * const patch: PatchRequest<User> = {
 *   schemas: [SchemaUris.PatchOp],
 *   Operations: [
 *     { op: "replace", path: "userName", value: "jane" },
 *     { op: "add", path: "name.givenName", value: "Jane" }
 *   ]
 * };
 * const patched = applyPatch(user, patch);
 * ```
 */
export function applyPatch<TResource extends Resource>(
  resource: TResource,
  patch: PatchRequest<TResource>
): TResource {
  // Validate schema
  if (!patch.schemas.includes(SchemaUris.PatchOp)) {
    throw new PatchError(
      `PATCH request must include schema "${SchemaUris.PatchOp}"`,
      undefined
    );
  }

  // Apply operations in order
  let result = resource;
  for (const operation of patch.Operations) {
    try {
      switch (operation.op) {
        case 'add':
          result = applyAdd(result, operation);
          break;
        case 'replace':
          result = applyReplace(result, operation);
          break;
        case 'remove':
          result = applyRemove(result, operation);
          break;
        default:
          throw new PatchError(
            `Unknown operation: ${(operation as { op: unknown }).op}`,
            operation
          );
      }
    } catch (error) {
      if (error instanceof PatchError) {
        throw error;
      }
      throw new PatchError(
        `Failed to apply operation: ${error instanceof Error ? error.message : String(error)}`,
        operation,
        operation.path
      );
    }
  }

  return result;
}
