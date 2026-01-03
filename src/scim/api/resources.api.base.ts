import type { BulkOperationsApi } from './bulk-operations.api.js';
import type { ResourcesApi } from './resources.api.js';
import type { ResourceApi } from './resource.api.js';
import type {
  Group,
  Resource,
  ResourceType,
  ResourceTypeOf,
  User,
} from '../model.js';
import { ScimNotImplementedError } from '../errors.js';

/**
 * SCIM Resources base class
 */
export abstract class ResourcesApiBase implements ResourcesApi {
  public abstract readonly users: ResourceApi<User>;

  public abstract readonly groups?: ResourceApi<Group>;

  public abstract readonly bulkOperations?: BulkOperationsApi;

  public getGroupsApi(): ResourceApi<Group> {
    if (!this.groups) {
      throw new ScimNotImplementedError(
        'Group resource is not implemented',
        'Group'
      );
    }
    return this.groups;
  }

  public getBulkOperationsApi(): BulkOperationsApi {
    if (!this.bulkOperations) {
      throw new ScimNotImplementedError('Bulk operations are not implemented');
    }
    return this.bulkOperations;
  }

  /**
   * Get a generic resource client for a specific resource type
   *
   * @param resourceType - The resource type ('User' or 'Group')
   * @returns The resource client for the specified type
   */
  public getGenericResourceApi<TResource extends Resource>(
    resourceType: ResourceTypeOf<TResource>
  ): ResourceApi<TResource> {
    return this.getConcreteResourceApi<ResourceTypeOf<TResource>>(
      resourceType
    ) as unknown as ResourceApi<TResource>;
  }

  /**
   * Get a resource client for a specific resource type
   *
   * @param resourceType - The resource type ('User' or 'Group')
   * @returns The resource client for the specified type
   */
  public getConcreteResourceApi<TResourceType extends ResourceType>(
    resourceType: ResourceType
  ): TResourceType extends 'User'
    ? ResourceApi<User>
    : TResourceType extends 'Group'
      ? ResourceApi<Group>
      : never {
    if (resourceType === 'User') {
      return this.users as any;
    }
    if (resourceType === 'Group') {
      return this.groups as any;
    }
    throw new Error(`Unknown resource type: ${resourceType}`);
  }
}
