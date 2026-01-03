import type { AttributeExpression, Filter, ValuePath } from './filter.dsl.js';
import { getValueByPath, compareValue } from './helpers.js';
import type {
  AttributeParameters,
  PaginationParameters,
  QueryResults,
  Resource,
  SortingParameters,
} from './model.js';

/**
 * SCIM Filter Implementation
 *
 * Implements RFC 7644 Section 3.4.2 - Filtering
 * https://datatracker.ietf.org/doc/html/rfc7644#section-3.4.2
 */

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Get attribute value from a resource using attribute path
 */
function getAttributeValue(
  resource: Resource,
  attrPath: AttributeExpression['attrPath']
): unknown {
  const segments: string[] = [];
  if (attrPath.attrName) {
    segments.push(attrPath.attrName);
  }
  if (attrPath.subAttr) {
    segments.push(attrPath.subAttr);
  }

  return getValueByPath(resource, segments.join('.'));
}

/**
 * Check if an attribute expression matches a resource
 */
function matchesAttributeExpression(
  resource: Resource,
  expr: AttributeExpression
): boolean {
  // Handle the simpler "pr" (present) operator first if we can
  if (expr.present !== undefined) {
    const value = getAttributeValue(resource, expr.attrPath);
    return value !== undefined && value !== null;
  }

  if (expr.operator === undefined || expr.value === undefined) {
    return false;
  }

  const attrValue = getAttributeValue(resource, expr.attrPath);
  return compareValue(attrValue, expr.operator, expr.value);
}

/**
 * Check if a value path matches a resource
 * RFC 7644: attrPath "[" valFilter "]"
 * This checks if any item in the array at attrPath matches the valFilter
 */
function matchesValuePath(resource: Resource, valuePath: ValuePath): boolean {
  const arrayValue = getAttributeValue(resource, valuePath.attrPath);

  if (!Array.isArray(arrayValue)) {
    return false;
  }

  // Check if any item in the array matches the filter
  return arrayValue.some(item => matchesFilter(item, valuePath.valFilter));
}

/**
 * Check if a filter matches a resource
 */
function matchesFilter(resource: Resource | unknown, filter: Filter): boolean {
  // For valuePath filters, the resource might be an array item
  if (
    typeof resource === 'object'
    && resource !== null
    && 'schemas' in resource
  ) {
    const scimResource = resource as Resource;

    if (filter.type === 'attribute') {
      return matchesAttributeExpression(scimResource, filter);
    }

    if (filter.type === 'valuePath') {
      return matchesValuePath(scimResource, filter);
    }

    if (filter.type === 'logical') {
      const leftMatch = matchesFilter(scimResource, filter.left);
      const rightMatch = matchesFilter(scimResource, filter.right);
      if (filter.operator === 'and') {
        return leftMatch && rightMatch;
      } else {
        return leftMatch || rightMatch;
      }
    }

    if (filter.type === 'not') {
      return !matchesFilter(scimResource, filter.filter);
    }
  } else {
    // This is an array item being checked by a filter
    const item = resource as Record<string, unknown>;

    if (filter.type === 'attribute') {
      const attrName = filter.attrPath.attrName;
      const subAttr = filter.attrPath.subAttr;

      if (filter.present !== undefined) {
        const value = subAttr
          ? (item[attrName] as Record<string, unknown>)?.[subAttr]
          : item[attrName];
        return value !== undefined && value !== null;
      }

      if (filter.operator === undefined || filter.value === undefined) {
        return false;
      }

      const attrValue = subAttr
        ? (item[attrName] as Record<string, unknown>)?.[subAttr]
        : item[attrName];
      return compareValue(attrValue, filter.operator, filter.value);
    }

    if (filter.type === 'logical') {
      const leftMatch = matchesFilter(item, filter.left);
      const rightMatch = matchesFilter(item, filter.right);
      if (filter.operator === 'and') {
        return leftMatch && rightMatch;
      } else {
        return leftMatch || rightMatch;
      }
    }

    if (filter.type === 'not') {
      return !matchesFilter(item, filter.filter);
    }

    if (filter.type === 'valuePath') {
      // For valuePath on array items, get the nested array
      const attrName = filter.attrPath.attrName;
      const subAttr = filter.attrPath.subAttr;
      const arrayValue = subAttr
        ? (item[attrName] as Record<string, unknown>)?.[subAttr]
        : item[attrName];

      if (!Array.isArray(arrayValue)) {
        return false;
      }

      return arrayValue.some(nestedItem =>
        matchesFilter(nestedItem, filter.valFilter)
      );
    }
  }

  return false;
}

// ============================================================================
// Attribute Selection
// ============================================================================

/**
 * Check if an attribute path should be included based on include/exclude lists
 */
function shouldIncludeAttribute(
  path: string,
  includeList?: string[],
  excludeList?: string[]
): boolean {
  // If exclude list is specified and this path is excluded, don't include it
  if (
    excludeList?.some(
      excluded => path === excluded || path.startsWith(excluded + '.')
    )
  ) {
    return false;
  }

  // If include list is specified, only include if it's in the list
  if (includeList && includeList.length > 0) {
    // Always include core attributes (schemas, id, externalId, meta)
    if (
      path === 'schemas'
      || path === 'id'
      || path === 'externalId'
      || path === 'meta'
    ) {
      return true;
    }

    // Check if this path or any parent path is in the include list
    return includeList.some(included => {
      if (path === included) {
        return true;
      }
      // Check if this is a sub-attribute of an included path
      if (path.startsWith(included + '.')) {
        return true;
      }
      // Check if the included path is a sub-attribute of this path
      if (included.startsWith(path + '.')) {
        return true;
      }
      return false;
    });
  }

  // No include list means include everything (unless excluded)
  return true;
}

/**
 * Select attributes from a resource based on include/exclude lists
 */
export function selectAttributes<TResource extends Resource>(
  resource: TResource,
  attributes?: AttributeParameters<TResource>
): TResource {
  if (
    !attributes
    || (!attributes.attributes && !attributes.excludedAttributes)
  ) {
    return resource;
  }

  const includeList = attributes.attributes?.map(attr => attr.toString());
  const excludeList = attributes.excludedAttributes?.map(attr =>
    attr.toString()
  );

  // If no include list and no exclude list, return as-is
  if (!includeList && !excludeList) {
    return resource;
  }

  // Helper to recursively copy selected attributes
  const copySelected = (source: unknown, prefix = ''): unknown => {
    if (source === null || source === undefined || typeof source !== 'object') {
      return source;
    }

    if (Array.isArray(source)) {
      const arrayCopy: unknown[] = [];
      for (const item of source) {
        if (typeof item === 'object' && item !== null) {
          arrayCopy.push(copySelected(item, prefix));
        } else {
          arrayCopy.push(item);
        }
      }
      return arrayCopy;
    }

    const sourceObj = source as Record<string, unknown>;
    const target: Record<string, unknown> = {};

    for (const [key, value] of Object.entries(sourceObj)) {
      const fullPath = prefix ? `${prefix}.${key}` : key;

      if (!shouldIncludeAttribute(fullPath, includeList, excludeList)) {
        continue;
      }

      if (value === null || value === undefined) {
        target[key] = value;
      } else if (Array.isArray(value)) {
        target[key] = copySelected(value, fullPath);
      } else if (typeof value === 'object') {
        target[key] = copySelected(value, fullPath);
      } else {
        target[key] = value;
      }
    }

    return target;
  };

  return copySelected(resource) as TResource;
}

// ============================================================================
// Sorting
// ============================================================================

/**
 * Compare two values for sorting
 */
function compareForSort(
  a: unknown,
  b: unknown,
  order: 'ascending' | 'descending'
): number {
  // Handle null/undefined
  if (a === null || a === undefined) {
    if (b === null || b === undefined) {
      return 0;
    }
    return order === 'ascending' ? -1 : 1;
  }
  if (b === null || b === undefined) {
    return order === 'ascending' ? 1 : -1;
  }

  // Compare by type
  if (typeof a === 'string' && typeof b === 'string') {
    const comparison = a.localeCompare(b);
    return order === 'ascending' ? comparison : -comparison;
  }

  if (typeof a === 'number' && typeof b === 'number') {
    const comparison = a - b;
    return order === 'ascending' ? comparison : -comparison;
  }

  if (typeof a === 'boolean' && typeof b === 'boolean') {
    const comparison = a === b ? 0 : a ? 1 : -1;
    return order === 'ascending' ? comparison : -comparison;
  }

  // Try to compare as dates
  if (typeof a === 'string' && typeof b === 'string') {
    const dateA = new Date(a);
    const dateB = new Date(b);
    if (!isNaN(dateA.getTime()) && !isNaN(dateB.getTime())) {
      const comparison = dateA.getTime() - dateB.getTime();
      return order === 'ascending' ? comparison : -comparison;
    }
  }

  // Fallback to string comparison
  const aStr = String(a);
  const bStr = String(b);
  const comparison = aStr.localeCompare(bStr);
  return order === 'ascending' ? comparison : -comparison;
}

/**
 * Sort resources by attribute path
 */
function sortResources<TResource extends Resource>(
  resources: TResource[],
  sorting?: SortingParameters
): TResource[] {
  if (!sorting || !sorting.sortBy) {
    return resources;
  }

  const sortBy = sorting.sortBy;
  const sortOrder = sorting.sortOrder || 'ascending';

  return [...resources].sort((a, b) => {
    const valueA = getValueByPath(a, sortBy);
    const valueB = getValueByPath(b, sortBy);
    return compareForSort(valueA, valueB, sortOrder);
  });
}

// ============================================================================
// Pagination
// ============================================================================

/**
 * Apply pagination to resources
 */
function paginateResources<TResource extends Resource>(
  resources: TResource[],
  pagination?: PaginationParameters
): { resources: TResource[]; startIndex: number; itemsPerPage: number } {
  const startIndex = pagination?.startIndex ?? 1;
  const count = pagination?.count;

  // Convert to 0-based index
  const start = Math.max(0, startIndex - 1);

  if (count !== undefined) {
    const end = start + count;
    return {
      resources: resources.slice(start, end),
      startIndex,
      itemsPerPage: resources.slice(start, end).length,
    };
  }

  return {
    resources: resources.slice(start),
    startIndex,
    itemsPerPage: resources.slice(start).length,
  };
}

// ============================================================================
// Apply Filters - Main Function
// ============================================================================

/**
 * Apply filters and query operators to query results in-memory.
 *
 * Implements RFC 7644 Section 3.4.2 - Filtering, Sorting, and Pagination
 * https://datatracker.ietf.org/doc/html/rfc7644#section-3.4.2
 *
 * @param results The query results to apply filters to.
 * @param filter The filter to apply to the query results.
 * @param attributes The attributes to apply to the query results.
 * @param pagination The pagination to apply to the query results.
 * @param sorting The sorting to apply to the query results.
 * @returns The query results with the filters applied.
 */
export function applyFilters<TResource extends Resource>(args: {
  results: QueryResults<TResource>;
  filter?: Filter;
  attributes?: AttributeParameters<TResource>;
  pagination?: PaginationParameters;
  sorting?: SortingParameters;
}): QueryResults<TResource> {
  const { attributes, filter, pagination, results, sorting } = args;

  let filteredResources = filter
    ? results.Resources.filter(resource => matchesFilter(resource, filter))
    : results.Resources;

  filteredResources = sortResources(filteredResources, sorting);

  const paginated = paginateResources(filteredResources, pagination);

  const selectedResources = paginated.resources.map(resource =>
    selectAttributes(resource, attributes)
  );

  // Calculate total results (before pagination)
  const totalResults = filteredResources.length;

  return {
    schemas: results.schemas,
    totalResults,
    startIndex: paginated.startIndex,
    itemsPerPage: paginated.itemsPerPage,
    Resources: selectedResources,
  };
}
