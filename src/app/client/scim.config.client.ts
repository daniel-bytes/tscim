import type { ConfigApi } from '../../scim/api/config.api.js';
import type { ResourceTypeApi } from '../../scim/api/resource-type.api.js';
import type { SchemaApi } from '../../scim/api/schema.api.js';
import type { ServiceProviderApi } from '../../scim/api/service-provider.api.js';
import type {
  QueryResults,
  ResourceTypeDefinition,
  SchemaDefinition,
  ServiceProviderConfig,
} from '../../scim/model.js';
import type { ScimHttpClient } from './scim.http.client.js';
import type { SchemaUri } from '../../scim/uris.js';

/**
 * SCIM Configuration APIs Client
 */
export class ScimConfigClient implements ConfigApi {
  public readonly resourceTypes: ResourceTypeApi;

  public readonly schemas: SchemaApi;

  public readonly serviceProvider: ServiceProviderApi;

  constructor(private readonly httpClient: ScimHttpClient) {
    this.resourceTypes = {
      get: (args: { id: SchemaUri }) =>
        this.httpClient.request<ResourceTypeDefinition>({
          method: 'GET',
          path: `/ResourceTypes/${args.id}`,
          resourceId: args.id,
        }),
      list: () =>
        this.httpClient.request<QueryResults<ResourceTypeDefinition>>({
          method: 'GET',
          path: '/ResourceTypes',
        }),
    };

    this.schemas = {
      get: (args: { id: SchemaUri }) =>
        this.httpClient.request<SchemaDefinition>({
          method: 'GET',
          path: `/Schemas/${args.id}`,
          resourceId: args.id,
        }),
      list: () =>
        this.httpClient.request<QueryResults<SchemaDefinition>>({
          method: 'GET',
          path: '/Schemas',
        }),
    };

    this.serviceProvider = {
      get: () =>
        this.httpClient.request<ServiceProviderConfig>({
          method: 'GET',
          path: '/ServiceProviderConfig',
        }),
    };
  }
}
