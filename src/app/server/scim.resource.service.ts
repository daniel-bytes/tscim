import type {
  QueryResults,
  Resource,
  ResourceType,
  AttributeParameters,
  PaginationParameters,
  ResourceId,
  SortingParameters,
} from '../../scim/model.js';
import type { ResourceAdapter } from '../adapter/resource.adapter.js';
import { ScimError, ScimInternalServerError } from '../../scim/errors.js';
import type { Filter } from '../../scim/filter.dsl.js';
import { applyFilters } from '../../scim/filter.js';
import type { PatchRequest } from '../../scim/patch.dsl.js';
import { ensureSinglePrimaryValue } from '../../scim/helpers.js';
import { applyPatch } from '../../scim/patch.js';
import type { ResourceApi } from '../../scim/api/resource.api.js';

/**
 * SCIM Resource Service for handling CRUD operations for a specific resource type
 *
 * Handles all resource operations for a single resource type (User or Group)
 */
export class ScimResourceService<
  TResource extends Resource,
> implements ResourceApi<TResource> {
  constructor(
    private readonly repository: ResourceAdapter<TResource>,
    private readonly resourceType: ResourceType,
    private readonly ensureSinglePrimaryValue?: boolean
  ) {}

  /**
   * GET /{ResourceType}s/{id}
   * @param args.id The ID of the resource to get
   * @returns The resource, or an error if the operation failed
   */
  public async get(args: { id: ResourceId }): Promise<TResource> {
    try {
      const result = await this.repository.getResource({
        id: args.id,
      });
      return result.result;
    } catch (error) {
      if (error instanceof ScimError) {
        throw error;
      }
      throw new ScimInternalServerError(
        `An unknown error occurred while getting the ${this.resourceType.toLowerCase()}`,
        error as Error,
        this.resourceType,
        args.id
      );
    }
  }

  /**
   * GET /{ResourceType}s?filter={filter}
   *           &attributes={attributes}
   *           &sortBy={sortBy}
   *           &sortOrder={sortOrder}
   *           &startIndex={startIndex}
   *           &count={count}
   *
   * @param args.filter The filter to apply to the query
   * @param args.attributes The attributes to include in the query
   * @param args.pagination The pagination to apply to the query
   * @param args.sorting The sorting to apply to the query
   * @returns The queried resources, or an error if the operation failed
   */
  public async list(args: {
    filter?: Filter;
    attributes?: AttributeParameters<TResource>;
    pagination?: PaginationParameters;
    sorting?: SortingParameters;
  }): Promise<QueryResults<TResource>> {
    try {
      const result = await this.repository.queryResources({
        ...(args.filter && { filter: args.filter }),
        ...(args.attributes && { attributes: args.attributes }),
        ...(args.pagination && { pagination: args.pagination }),
        ...(args.sorting && { sorting: args.sorting }),
      });
      return applyFilters({
        results: result.result,
        ...args,
      });
    } catch (error) {
      if (error instanceof ScimError) {
        throw error;
      }
      throw new ScimInternalServerError(
        `An unknown error occurred while getting the ${this.resourceType.toLowerCase()}s`,
        error as Error,
        this.resourceType
      );
    }
  }

  /**
   * POST /{ResourceType}s
   *
   * @param args.resource The resource to create
   * @returns The created resource, or an error if the operation failed
   */
  public async create(args: { resource: TResource }): Promise<TResource> {
    try {
      const resource = this.ensureSinglePrimaryValue
        ? ensureSinglePrimaryValue(args.resource)
        : args.resource;
      const result = await this.repository.createResource({
        resource,
      });
      return result.result;
    } catch (error) {
      if (error instanceof ScimError) {
        throw error;
      }
      throw new ScimInternalServerError(
        `An unknown error occurred while creating the ${this.resourceType.toLowerCase()}`,
        error as Error,
        this.resourceType
      );
    }
  }

  /**
   * PUT /{ResourceType}s/{id}
   * @param args.id The ID of the resource to update
   * @param args.resource The resource to update
   * @returns The updated resource, or an error if the operation failed
   */
  public async update(args: {
    id: ResourceId;
    resource: TResource;
  }): Promise<TResource> {
    try {
      const resource = this.ensureSinglePrimaryValue
        ? ensureSinglePrimaryValue(args.resource)
        : args.resource;
      const result = await this.repository.updateResource({
        id: args.id,
        resource,
      });
      return result.result;
    } catch (error) {
      if (error instanceof ScimError) {
        throw error;
      }
      throw new ScimInternalServerError(
        `An unknown error occurred while updating the ${this.resourceType.toLowerCase()}`,
        error as Error,
        this.resourceType,
        args.id
      );
    }
  }

  /**
   * PATCH /{ResourceType}s/{id}
   * @param args.id The ID of the resource to patch
   * @param args.patch The patch to apply to the resource
   * @returns The patched resource, or an error if the operation failed
   */
  public async patch(args: {
    id: ResourceId;
    patch: PatchRequest<TResource>;
  }): Promise<TResource> {
    try {
      const fetchResult = await this.repository.getResource({
        id: args.id,
      });
      const patchedResource = applyPatch(fetchResult.result, args.patch);
      const resource = this.ensureSinglePrimaryValue
        ? ensureSinglePrimaryValue(patchedResource)
        : patchedResource;
      const result = await this.repository.updateResource({
        id: args.id,
        resource,
      });
      return result.result;
    } catch (error) {
      if (error instanceof ScimError) {
        throw error;
      }
      throw new ScimInternalServerError(
        `An unknown error occurred while patching the ${this.resourceType.toLowerCase()}`,
        error as Error,
        this.resourceType,
        args.id
      );
    }
  }

  /**
   * DELETE /{ResourceType}s/{id}
   * @param args.id The ID of the resource to delete
   * @returns void
   */
  public async delete(args: { id: ResourceId }): Promise<void> {
    try {
      await this.repository.deleteResource({
        id: args.id,
      });
    } catch (error) {
      if (error instanceof ScimError) {
        throw error;
      }
      throw new ScimInternalServerError(
        `An unknown error occurred while deleting the ${this.resourceType.toLowerCase()}`,
        error as Error,
        this.resourceType,
        args.id
      );
    }
  }
}
