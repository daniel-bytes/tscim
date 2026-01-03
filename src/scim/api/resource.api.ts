import type { Filter } from '../filter.dsl.js';
import type { PatchRequest } from '../patch.dsl.js';
import type {
  Resource,
  ResourceId,
  QueryResults,
  AttributeParameters,
  PaginationParameters,
  SortingParameters,
} from '../model.js';

/**
 * API for a resource type.
 * https://datatracker.ietf.org/doc/html/rfc7644#section-3.2
 */
export interface ResourceApi<TResource extends Resource> {
  /**
   * Get a resource by its ID.
   * https://datatracker.ietf.org/doc/html/rfc7644#section-3.4.1
   *
   * @param args.id - The ID of the resource
   * @returns The resource
   */
  get(args: { id: ResourceId }): Promise<TResource>;

  /**
   * Query resources.
   * https://datatracker.ietf.org/doc/html/rfc7644#section-3.4.2
   *
   * @param args.filter - The optional filter to apply to the query
   * @param args.attributes - The optional attributes to include in the query
   * @param args.pagination - The optional pagination to apply to the query
   * @param args.sorting - The optional sorting to apply to the query
   * @returns The query results
   */
  list(args: {
    filter?: Filter;
    attributes?: AttributeParameters<TResource>;
    pagination?: PaginationParameters;
    sorting?: SortingParameters;
  }): Promise<QueryResults<TResource>>;

  /**
   * Create a resource.
   * https://datatracker.ietf.org/doc/html/rfc7644#section-3.3
   *
   * @param args.resource - The resource to create
   * @returns The created resource
   */
  create(args: { resource: TResource }): Promise<TResource>;

  /**
   * Update a resource.
   * https://datatracker.ietf.org/doc/html/rfc7644#section-3.5.1
   *
   * @param args.id - The ID of the resource
   * @param args.resource - The resource to update
   * @returns The updated resource
   */
  update(args: { id: ResourceId; resource: TResource }): Promise<TResource>;

  /**
   * Update a resource using PATCH semantics.
   * https://datatracker.ietf.org/doc/html/rfc7644#section-3.5.2
   *
   * @param args.id - The ID of the resource
   * @param args.patch - The patch to apply to the resource
   * @returns The updated resource
   */
  patch(args: {
    id: ResourceId;
    patch: PatchRequest<TResource>;
  }): Promise<TResource>;

  /**
   * Delete a resource.
   * https://datatracker.ietf.org/doc/html/rfc7644#section-3.6
   *
   * @param args.id - The ID of the resource
   * @returns void
   */
  delete(args: { id: ResourceId }): Promise<void>;
}
