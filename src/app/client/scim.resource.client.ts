import type { PatchRequest } from '../../scim/patch.dsl.js';
import type { ResourceApi } from '../../scim/api/resource.api.js';
import type {
  AttributeParameters,
  PaginationParameters,
  QueryResults,
  Resource,
  ResourceId,
  ResourceTypeOf,
  SortingParameters,
} from '../../scim/model.js';
import type { ScimHttpClient } from './scim.http.client.js';
import type { Filter } from '../../scim/filter.dsl.js';
import { serializeFilter } from '../../scim/filter.dsl.js';

/**
 * SCIM Single Resource API Client
 */
export class ScimResourceClient<
  TResource extends Resource,
> implements ResourceApi<TResource> {
  private readonly resourcePath: string;

  constructor(
    public readonly resourceType: ResourceTypeOf<TResource>,
    private readonly httpClient: ScimHttpClient
  ) {
    this.resourcePath = `/${this.resourceType}s`;
  }

  public async get(args: { id: ResourceId }): Promise<TResource> {
    return this.httpClient.request<TResource>({
      method: 'GET',
      path: `${this.resourcePath}/${args.id}`,
      resourceType: this.resourceType,
      resourceId: args.id,
    });
  }

  public async list(args: {
    filter?: Filter;
    attributes?: AttributeParameters<TResource>;
    pagination?: PaginationParameters;
    sorting?: SortingParameters;
  }): Promise<QueryResults<TResource>> {
    return this.httpClient.request<QueryResults<TResource>>({
      method: 'GET',
      path: `${this.resourcePath}${this.buildQueryParams<TResource>(args)}`,
      resourceType: this.resourceType,
    });
  }

  public async create(args: { resource: TResource }): Promise<TResource> {
    return this.httpClient.request<TResource>({
      method: 'POST',
      path: this.resourcePath,
      resourceType: this.resourceType,
      body: args.resource,
    });
  }

  public async update(args: {
    id: ResourceId;
    resource: TResource;
  }): Promise<TResource> {
    return this.httpClient.request<TResource>({
      method: 'PUT',
      path: `${this.resourcePath}/${args.id}`,
      resourceType: this.resourceType,
      resourceId: args.id,
      body: args.resource,
    });
  }

  public async patch(args: {
    id: ResourceId;
    patch: PatchRequest<TResource>;
  }): Promise<TResource> {
    return this.httpClient.request<TResource>({
      method: 'PATCH',
      path: `${this.resourcePath}/${args.id}`,
      resourceType: this.resourceType,
      resourceId: args.id,
      body: args.patch,
    });
  }

  public async delete(args: { id: ResourceId }): Promise<void> {
    return this.httpClient.request<void>({
      method: 'DELETE',
      path: `${this.resourcePath}/${args.id}`,
      resourceType: this.resourceType,
      resourceId: args.id,
    });
  }

  private buildQueryParams<TResource extends Resource>(options?: {
    filter?: Filter;
    attributes?: AttributeParameters<TResource>;
    pagination?: PaginationParameters;
    sorting?: SortingParameters;
  }): string {
    if (!options) {
      return '';
    }

    const params = new URLSearchParams();

    if (options.filter) {
      params.append('filter', serializeFilter(options.filter));
    }

    if (options.attributes?.attributes) {
      params.append(
        'attributes',
        options.attributes.attributes.join(',') as string
      );
    }

    if (options.attributes?.excludedAttributes) {
      params.append(
        'excludedAttributes',
        options.attributes.excludedAttributes.join(',') as string
      );
    }

    if (options.pagination?.startIndex !== undefined) {
      params.append('startIndex', String(options.pagination.startIndex));
    }

    if (options.pagination?.count !== undefined) {
      params.append('count', String(options.pagination.count));
    }

    if (options.sorting?.sortBy) {
      params.append('sortBy', options.sorting.sortBy);
    }

    if (options.sorting?.sortOrder) {
      params.append('sortOrder', options.sorting.sortOrder);
    }

    const queryString = params.toString();
    return queryString ? `?${queryString}` : '';
  }
}
