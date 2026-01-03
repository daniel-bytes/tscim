import { ResourceAdapter } from './resource.adapter.js';
import type {
  Resource,
  ResourceId,
  ResourceTypeOf,
  QueryResults,
  PaginationParameters,
  SortingParameters,
  AttributeParameters,
} from '../../scim/model.js';
import type {
  AdapterSingleResult,
  AdapterQueryResult,
  AdapterBooleanResult,
} from './resource.adapter.types.js';
import type { Filter } from '../../scim/filter.dsl.js';
import { ScimNotFoundError, ScimConflictError } from '../../scim/errors.js';
import { SchemaUris } from '../../scim/uris.js';

/**
 * In-memory implementation of ResourceAdapter.
 *
 * This is a simple implementation that stores resources in a JavaScript object.
 * Useful for testing, demos, POCs, etc.
 */
export class InMemoryAdapter<
  TResource extends Resource,
> extends ResourceAdapter<TResource> {
  constructor(
    private readonly resourceType: ResourceTypeOf<TResource>,
    private readonly resources: Record<string, TResource> = {}
  ) {
    super();
  }

  /**
   * Get a resource by its ID from the in-memory store.
   */
  public async getResource(args: {
    id: ResourceId;
    attributes?: AttributeParameters<TResource>;
  }): Promise<AdapterSingleResult<TResource>> {
    const resource = this.resources[args.id];
    if (!resource) {
      throw new ScimNotFoundError(
        `Resource with ID ${args.id} not found`,
        this.resourceType,
        args.id
      );
    }

    return {
      id: args.id,
      result: resource,
      ...(args.attributes && { attributes: args.attributes }),
    };
  }

  /**
   * Query resources from the in-memory store.
   */
  public async queryResources(args: {
    filter?: Filter;
    attributes?: AttributeParameters<TResource>;
    pagination?: PaginationParameters;
    sorting?: SortingParameters;
  }): Promise<AdapterQueryResult<TResource>> {
    // Return all resources and let the controller apply filters in-memory
    // as per the ResourceAdapter documentation
    const allResources = Object.values(this.resources);
    const queryResults: QueryResults<TResource> = {
      schemas: [SchemaUris.ListResponse],
      totalResults: allResources.length,
      Resources: allResources,
    };

    return {
      result: queryResults,
      ...(args.filter && { filter: args.filter }),
      ...(args.attributes && { attributes: args.attributes }),
      ...(args.pagination && { pagination: args.pagination }),
      ...(args.sorting && { sorting: args.sorting }),
    };
  }

  /**
   * Create a resource in the in-memory store.
   * ID is generated if not provided.
   * If the ID already exists, a conflict error is thrown.
   */
  public async createResource(args: {
    resource: TResource;
  }): Promise<AdapterSingleResult<TResource>> {
    // Generate ID if not provided
    const id = args.resource.id || this.generateId();

    // Check for conflict if ID already exists
    if (this.resources[id]) {
      throw new ScimConflictError(
        `Resource with ID ${id} already exists`,
        this.resourceType,
        id
      );
    }

    // Create resource with ID
    const newResource: TResource = {
      ...args.resource,
      id,
    } as TResource;

    this.resources[id] = newResource;
    return { id, result: newResource };
  }

  /**
   * Update a resource in the in-memory store.
   * If the resource does not exist, a not found error is thrown.
   */
  public async updateResource(args: {
    id: ResourceId;
    resource: TResource;
  }): Promise<AdapterSingleResult<TResource>> {
    if (!this.resources[args.id]) {
      throw new ScimNotFoundError(
        `Resource with ID ${args.id} not found`,
        this.resourceType,
        args.id
      );
    }

    // Update resource, preserving the ID
    const updatedResource: TResource = {
      ...args.resource,
      id: args.id,
    } as TResource;

    this.resources[args.id] = updatedResource;
    return { id: args.id, result: updatedResource };
  }

  /**
   * Delete a resource from the in-memory store.
   * If the resource does not exist, a not found error is thrown.
   */
  public async deleteResource(args: {
    id: ResourceId;
  }): Promise<AdapterBooleanResult<TResource>> {
    if (!this.resources[args.id]) {
      throw new ScimNotFoundError(
        `Resource with ID ${args.id} not found`,
        this.resourceType,
        args.id
      );
    }

    delete this.resources[args.id];
    return { id: args.id, result: true };
  }

  /**
   * Generate a simple ID for resources that don't have one.
   * In a real implementation, you might want to use a UUID library.
   */
  private generateId(): ResourceId {
    return `${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
  }

  /**
   * Get a snapshot of all resources in the adapter.
   * Useful for testing to verify state changes.
   * @returns A copy of all resources keyed by ID
   */
  public getAllResources(): Record<string, TResource> {
    return { ...this.resources };
  }

  /**
   * Get all resource IDs in the adapter.
   * Useful for testing to verify which resources exist.
   * @returns Array of all resource IDs
   */
  public getAllResourceIds(): ResourceId[] {
    return Object.keys(this.resources);
  }
}

