import type { PatchRequest } from '../../scim/patch.dsl.js';
import type { Filter } from '../../scim/filter.dsl.js';
import type {
  AttributeParameters,
  PaginationParameters,
  Resource,
  ResourceId,
  SortingParameters,
} from '../../scim/model.js';

import type {
  AdapterBooleanResult,
  AdapterSingleResult,
  AdapterQueryResult,
} from './resource.adapter.types.js';
import { applyPatch } from '../../scim/patch.js';

/**
 * Abstract base class for a resource adapter.
 *
 * A resource adapter is used to adapt an application's implementation of User and Group
 * resources to the format the SCIM protocol expects.
 *
 * When implementing this class you may apply any incoming filtering properties yourself,
 * or else pass them back as part of the result to have them applied by the controller in-memory.
 *
 * Implementations must implement the basic CRUD operations, as well as a query/filtering method.
 *
 * NOTE: The PATCH endpoint is implemented here by fetching the resource, applying the patch
 * and then updating the resource. Most applications should not need to override the patch method.
 *
 * NOTE: If any filtering is applied, DO NOT return them in the result or they will be applied twice.
 *
 * Generally filtering is applied by the implementing class by converting to some sort of query,
 * for example a SQL query, MongoDB query, etc.
 */
export abstract class ResourceAdapter<TResource extends Resource> {
  /**
   * Get a resource by its ID.
   *
   * @param args.id - The ID of the resource
   * @param args.attributes - The optional attributes to include in the result
   * @throws {ScimError} If the operation fails
   * @returns The resource, or an error if the operation failed
   */
  public abstract getResource(args: {
    id: ResourceId;
    attributes?: AttributeParameters<TResource>;
  }): Promise<AdapterSingleResult<TResource>>;

  /**
   * Query resources.
   *
   * @param args.filter - The optional filter to apply to the query
   * @param args.attributes - The optional attributes to include in the query
   * @param args.sorting - The optional sorting to apply to the query
   * @param args.pagination - The optional pagination to apply to the query
   * @throws {ScimError} If the operation fails
   * @returns The query results, or an error if the operation failed
   */
  public abstract queryResources(args: {
    filter?: Filter;
    attributes?: AttributeParameters<TResource>;
    sorting?: SortingParameters;
    pagination?: PaginationParameters;
  }): Promise<AdapterQueryResult<TResource>>;

  /**
   * Create a resource
   * @param args.resource - The resource to create
   * @throws {ScimError} If the operation fails
   * @returns The created resource
   */
  public abstract createResource(args: {
    resource: TResource;
  }): Promise<AdapterSingleResult<TResource>>;

  /**
   * Update a resource
   *
   * @param args.id - The ID of the resource
   * @param args.resource - The resource to update
   * @throws {ScimError} If the operation fails
   * @returns The updated resource, or undefined if the resource was not found
   */
  public abstract updateResource(args: {
    id: ResourceId;
    resource: TResource;
  }): Promise<AdapterSingleResult<TResource>>;

  /**
   * Delete a resource
   *
   * @param args.id - The ID of the resource
   * @throws {ScimError} If the operation fails
   * @returns True if the resource was deleted, false otherwise
   */
  public abstract deleteResource(args: {
    id: ResourceId;
  }): Promise<AdapterBooleanResult<TResource>>;

  /**
   * Update a resource using PATCH semantics.
   * This is not an abstract method, only override this if you want to support PATCH yourself.
   *
   * @param args.id - The ID of the resource
   * @param args.patch - The patch to apply to the resource
   * @throws {ScimError} If the operation fails
   * @returns The updated resource, or undefined if the resource was not found
   */
  public async patchResource(args: {
    id: ResourceId;
    patch: PatchRequest<TResource>;
  }): Promise<AdapterSingleResult<TResource>> {
    const fetchResult = await this.getResource({ id: args.id });

    return this.updateResource({
      id: args.id,
      resource: applyPatch(fetchResult.result, args.patch),
    });
  }
}
