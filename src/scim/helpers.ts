import { ComparisonOperator } from './filter.dsl.js';
import type { Resource, ResourceType } from './model.js';
import { SchemaUris } from './uris.js';

/**
 * SCIM Helper Functions
 *
 * Shared utility functions used across SCIM operations
 */

/**
 * Get a value from an object using a path (array of segments)
 */
export function getValue(obj: unknown, segments: string[]): unknown {
  let current: unknown = obj;
  for (const segment of segments) {
    if (
      current === null
      || current === undefined
      || typeof current !== 'object'
    ) {
      return undefined;
    }
    current = (current as Record<string, unknown>)[segment];
  }
  return current;
}

/**
 * Get a value from an object using a dot-separated path string
 */
export function getValueByPath(obj: unknown, path: string): unknown {
  const segments = path.split('.').filter(Boolean);
  return getValue(obj, segments);
}

/**
 * Compare a value with an operator and expected value
 *
 * Implements RFC 7644 Section 3.4.2.2 - Filtering comparison operators
 * https://datatracker.ietf.org/doc/html/rfc7644#section-3.4.2.2
 */
export function compareValue(
  actual: unknown,
  operator: ComparisonOperator,
  expected: unknown
): boolean {
  // Handle null/undefined
  if (actual === null || actual === undefined) {
    if (operator === ComparisonOperator.Eq) {
      return expected === null || expected === undefined;
    }
    if (operator === ComparisonOperator.Ne) {
      return expected !== null && expected !== undefined;
    }
    return false;
  }

  // Type-specific comparisons
  if (typeof actual === 'string' && typeof expected === 'string') {
    switch (operator) {
      case ComparisonOperator.Eq:
        return actual === expected;
      case ComparisonOperator.Ne:
        return actual !== expected;
      case ComparisonOperator.Co:
        return actual.includes(expected);
      case ComparisonOperator.Sw:
        return actual.startsWith(expected);
      case ComparisonOperator.Ew:
        return actual.endsWith(expected);
      case ComparisonOperator.Gt:
        return actual > expected;
      case ComparisonOperator.Lt:
        return actual < expected;
      case ComparisonOperator.Ge:
        return actual >= expected;
      case ComparisonOperator.Le:
        return actual <= expected;
      default:
        return false;
    }
  }

  if (typeof actual === 'number' && typeof expected === 'number') {
    switch (operator) {
      case ComparisonOperator.Eq:
        return actual === expected;
      case ComparisonOperator.Ne:
        return actual !== expected;
      case ComparisonOperator.Gt:
        return actual > expected;
      case ComparisonOperator.Lt:
        return actual < expected;
      case ComparisonOperator.Ge:
        return actual >= expected;
      case ComparisonOperator.Le:
        return actual <= expected;
      default:
        return false;
    }
  }

  if (typeof actual === 'boolean' && typeof expected === 'boolean') {
    switch (operator) {
      case ComparisonOperator.Eq:
        return actual === expected;
      case ComparisonOperator.Ne:
        return actual !== expected;
      default:
        return false;
    }
  }

  // For date/time strings, try to compare as ISO 8601 dates
  if (typeof actual === 'string' && typeof expected === 'string') {
    const actualDate = new Date(actual);
    const expectedDate = new Date(expected);
    if (!isNaN(actualDate.getTime()) && !isNaN(expectedDate.getTime())) {
      switch (operator) {
        case ComparisonOperator.Eq:
          return actualDate.getTime() === expectedDate.getTime();
        case ComparisonOperator.Ne:
          return actualDate.getTime() !== expectedDate.getTime();
        case ComparisonOperator.Gt:
          return actualDate.getTime() > expectedDate.getTime();
        case ComparisonOperator.Lt:
          return actualDate.getTime() < expectedDate.getTime();
        case ComparisonOperator.Ge:
          return actualDate.getTime() >= expectedDate.getTime();
        case ComparisonOperator.Le:
          return actualDate.getTime() <= expectedDate.getTime();
        default:
          return false;
      }
    }
  }

  // Fallback to equality
  return actual === expected;
}

/**
 * Get the ResourceType from a resource instance by checking its schemas
 *
 * @param resource - The resource to get the type from
 * @returns The ResourceType ("User" or "Group")
 * @throws Error if the resource type cannot be determined
 */
export function getResourceType(resource: Resource): ResourceType {
  if (resource.schemas.includes(SchemaUris.User)) {
    return 'User';
  }
  if (resource.schemas.includes(SchemaUris.Group)) {
    return 'Group';
  }
  throw new Error(
    `Unable to determine resource type from schemas: ${resource.schemas.join(', ')}`
  );
}

/**
 * Ensure that there is only one primary value in every collection of the resource.
 * Mutates the resource in place.
 */
export function ensureSinglePrimaryValue<TResource extends Resource>(
  resource: TResource
): TResource {
  for (const resourceProperty of Object.values(resource)) {
    if (Array.isArray(resourceProperty)) {
      let hasPrimary = false;

      for (let i = resourceProperty.length - 1; i >= 0; i--) {
        if (resourceProperty[i].primary === true) {
          if (hasPrimary) {
            // We've already found a primary value (later in the array),
            // so set this one to false
            resourceProperty[i].primary = false;
          } else {
            // This is the first primary value we've encountered (going backwards),
            // so keep it and mark that we've found one
            hasPrimary = true;
          }
        }
      }
    }
  }
  return resource;
}
