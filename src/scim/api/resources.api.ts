import type {
  Resource,
  ResourceType,
  ResourceTypeOf,
  User,
  Group,
} from '../model.js';
import type { BulkOperationsApi } from './bulk-operations.api.js';
import type { ResourceApi } from './resource.api.js';

/**
 * SCIM Resources APIs
 * https://datatracker.ietf.org/doc/html/rfc7644#section-3.2
 */
export interface ResourcesApi {
  /**
   * The API for the User resource.
   */
  users: ResourceApi<User>;

  /**
   * The API for the Group resource.
   */
  groups?: ResourceApi<Group>;

  /**
   * The API for bulk resource operations
   */
  bulkOperations?: BulkOperationsApi;

  /**
   * Get the API for the Group resource if available, or else throw a SCIM 501 Not Implemented error.
   * @returns The API for the Group resource
   * @throws ScimNotImplementedError if the Group resource is not implemented
   */
  getGroupsApi(): ResourceApi<Group>;

  /**
   * Get the API for bulk resource operations if available, or else throw a SCIM 501 Not Implemented error.
   * @returns The API for bulk resource operations
   * @throws ScimNotImplementedError if the Bulk Operations API is not implemented
   */
  getBulkOperationsApi(): BulkOperationsApi;

  /**
   * Get a resource API for a specific resource type
   *
   * @param resourceType - The resource type ('User' or 'Group')
   * @returns The resource API for the specified type
   */
  getGenericResourceApi<TResource extends Resource>(
    resourceType: ResourceTypeOf<TResource>
  ): ResourceApi<TResource>;

  /**
   * Get a concrete resource API for a specific resource type
   *
   * @param resourceType - The resource type ('User' or 'Group')
   * @returns The resource API for the specified type
   */
  getConcreteResourceApi<TResourceType extends ResourceType>(
    resourceType: ResourceType
  ): TResourceType extends 'User'
    ? ResourceApi<User>
    : TResourceType extends 'Group'
      ? ResourceApi<Group>
      : never;
}
