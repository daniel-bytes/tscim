/**
 * SCIM Query Parameter Parsing
 *
 * Implements RFC 7644 Section 3.4.2 - Filtering, Sorting, and Pagination
 * https://datatracker.ietf.org/doc/html/rfc7644#section-3.4.2
 *
 * And RFC 7644 Section 3.4.3 - Pagination
 * https://datatracker.ietf.org/doc/html/rfc7644#section-3.4.3
 */

import { parseFilter, type Filter } from './filter.dsl.js';
import type {
  AttributeParameters,
  AttributePath,
  PaginationParameters,
  Resource,
  ResourceType,
  SortingParameters,
} from './model.js';
import { ScimBadRequestError } from './errors.js';

/**
 * Result of parsing query parameters - either success with parsed parameters or an error
 */
export interface QueryParametersParseResult<TResource extends Resource> {
  readonly filter?: Filter;
  readonly attributes?: AttributeParameters<TResource>;
  readonly pagination?: PaginationParameters;
  readonly sorting?: SortingParameters;
}

/**
 * Input type for query parameters - accepts a simple record where values can be strings or arrays
 * This matches common HTTP query parameter representations (Express, Node.js URLSearchParams, etc.)
 */
export type QueryParametersInput = Record<
  string,
  string | string[] | undefined
>;

/**
 * Extract a string value from query parameters, handling arrays by taking the first element
 */
function getStringValue(
  params: QueryParametersInput,
  key: string
): string | undefined {
  const value = params[key];
  if (value === undefined) {
    return undefined;
  }
  if (typeof value === 'string') {
    return value;
  }
  if (Array.isArray(value) && value.length > 0) {
    return typeof value[0] === 'string' ? value[0] : undefined;
  }
  return undefined;
}

/**
 * Parse SCIM query parameters from a generic query parameters object.
 *
 * Implements RFC 7644 Section 3.4.2 - Filtering, Sorting, and Pagination
 * https://datatracker.ietf.org/doc/html/rfc7644#section-3.4.2
 *
 * Query parameters:
 * - filter: SCIM filter expression (e.g., 'userName eq "john.doe"')
 * - attributes: comma-separated list of attributes to include
 * - excludedAttributes: comma-separated list of attributes to exclude
 * - sortBy: attribute path to sort by
 * - sortOrder: "ascending" or "descending" (default: "ascending")
 * - startIndex: 1-based index of first result (default: 1)
 * - count: maximum number of results per page
 *
 * @param params Query parameters object (e.g., from req.query in Express, URLSearchParams, etc.)
 * @returns Parsed query parameters or a SCIM error response
 *
 * @example
 * ```ts
 * // Express.js usage
 * const result = parseQueryParameters(req.query);
 * if (!result.success) {
 *   return res.status(result.statusCode).json(result.error);
 * }
 * const users = await controller.getUsers({
 *   filter: result.filter,
 *   attributes: result.attributes,
 *   pagination: result.pagination,
 *   sorting: result.sorting
 * });
 * ```
 */
export function parseQueryParameters<TResource extends Resource>(
  params: QueryParametersInput,
  resourceType: ResourceType
): QueryParametersParseResult<TResource> {
  const filterStr = getStringValue(params, 'filter');
  const attributesStr = getStringValue(params, 'attributes');
  const excludedAttributesStr = getStringValue(params, 'excludedAttributes');
  const sortBy = getStringValue(params, 'sortBy');
  const sortOrder = getStringValue(params, 'sortOrder');
  const startIndexStr = getStringValue(params, 'startIndex');
  const countStr = getStringValue(params, 'count');

  // Parse filter
  let filter: Filter | undefined;
  if (filterStr) {
    const filterResult = parseFilter(filterStr);
    if (filterResult.isLeft()) {
      throw new ScimBadRequestError(
        `Invalid filter expression: ${filterResult.value.message}`,
        resourceType
      );
    }
    filter = filterResult.value;
  }

  // Parse attributes
  let attributes: AttributeParameters<TResource> | undefined;
  if (attributesStr) {
    const attrList = attributesStr
      .split(',')
      .map(a => a.trim())
      .filter(a => a.length > 0);
    if (attrList.length > 0) {
      attributes = {
        attributes: attrList as AttributePath<TResource>[],
      };
    }
  }

  // Parse excludedAttributes
  if (excludedAttributesStr) {
    const excludedList = excludedAttributesStr
      .split(',')
      .map(a => a.trim())
      .filter(a => a.length > 0);
    if (excludedList.length > 0) {
      attributes = {
        ...attributes,
        excludedAttributes: excludedList as AttributePath<TResource>[],
      };
    }
  }

  // Parse pagination
  let pagination: PaginationParameters | undefined;
  if (startIndexStr || countStr) {
    let startIndex: number | undefined;
    if (startIndexStr) {
      const parsed = Number.parseInt(startIndexStr, 10);
      if (isNaN(parsed) || parsed < 1) {
        throw new ScimBadRequestError(
          'startIndex must be a positive integer',
          resourceType
        );
      }
      startIndex = parsed;
    }
    let count: number | undefined;
    if (countStr) {
      const parsed = Number.parseInt(countStr, 10);
      if (isNaN(parsed) || parsed < 0) {
        throw new ScimBadRequestError(
          'count must be a non-negative integer',
          resourceType
        );
      }
      count = parsed;
    }
    // Build object with conditional properties
    pagination = Object.assign(
      {},
      startIndex !== undefined && { startIndex },
      count !== undefined && { count }
    ) as PaginationParameters;
  }

  // Parse sorting
  let sorting: SortingParameters | undefined;
  if (sortBy) {
    let sortOrderValue: 'ascending' | 'descending' | undefined;
    if (sortOrder) {
      const order = sortOrder.toLowerCase();
      if (order !== 'ascending' && order !== 'descending') {
        throw new ScimBadRequestError(
          'sortOrder must be "ascending" or "descending"',
          resourceType
        );
      }
      sortOrderValue = order as 'ascending' | 'descending';
    }
    // Build object with conditional properties
    sorting = Object.assign(
      { sortBy },
      sortOrderValue !== undefined && { sortOrder: sortOrderValue }
    ) as SortingParameters;
  }

  const result: {
    filter?: Filter;
    attributes?: AttributeParameters<TResource>;
    pagination?: PaginationParameters;
    sorting?: SortingParameters;
  } = {};
  if (filter !== undefined) {
    result.filter = filter;
  }
  if (attributes !== undefined) {
    result.attributes = attributes;
  }
  if (pagination !== undefined) {
    result.pagination = pagination;
  }
  if (sorting !== undefined) {
    result.sorting = sorting;
  }

  return result;
}
