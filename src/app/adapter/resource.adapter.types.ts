import type { PatchRequest } from '../../scim/patch.dsl.js';
import type { Filter } from '../../scim/filter.dsl.js';
import type {
  AttributeParameters,
  PaginationParameters,
  QueryResults,
  Resource,
  ResourceId,
  SortingParameters,
} from '../../scim/model.js';

/**
 * Result of an adapter operation.
 *
 * If any filtering properties are provided, they will be applied to the in-memory result.
 * If any of the filters were applied already (e.g. the adapter converted to a SQL query), they should not be provided here.
 */
export interface AdapterResult<TResource extends Resource> {
  /**
   * The patch request to apply to the result
   */
  patchRequest?: PatchRequest<TResource>;
}

export interface AdapterBooleanResult<
  TResource extends Resource,
> extends AdapterResult<TResource> {
  /**
   * The ID of the resource that was operated on
   */
  id: ResourceId;

  /**
   * The boolean result of the operation
   */
  result: boolean;
}

/**
 * Result of a single resource adapter operation
 */
export interface AdapterSingleResult<
  TResource extends Resource,
> extends AdapterResult<TResource> {
  /**
   * The ID of the resource that was operated on
   */
  id: ResourceId;

  /**
   * The resource that was found, or an error if the operation failed
   */
  result: TResource;
}

/**
 * Result of a resource query adapter operation
 */
export interface AdapterQueryResult<
  TResource extends Resource,
> extends AdapterResult<TResource> {
  /**
   * The resources that were found, or an error if the operation failed
   */
  result: QueryResults<TResource>;

  /**
   * The remaining filters to apply to the result.
   * These are the input filters not applied by the adapter.
   * Typically this will be the case if the adapter can only handle a subset of
   * filtering options, for example a SQL query that only supports equality filters.
   *
   * Generally if the adapter cannot apply all filters it should not try to apply pagination.
   * Its OK to apply sorting and attribute filtering server side along with partial filtering,
   * but pagination requires all filtering and sorting to be applied to the dataset first.
   */
  remainingFilters?: {
    /**
     * The filter to apply to the result
     */
    filter?: Filter;

    /**
     * Sorting parameters to apply to the result
     */
    sorting?: SortingParameters;

    /**
     * Attribute filters to apply to the result
     */
    attributes?: AttributeParameters<TResource>;

    /**
     * Pagination parameters to apply to the result
     */
    pagination?: PaginationParameters;
  };
}

