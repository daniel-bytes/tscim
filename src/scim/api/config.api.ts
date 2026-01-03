import type { ResourceTypeApi } from './resource-type.api.js';
import type { SchemaApi } from './schema.api.js';
import type { ServiceProviderApi } from './service-provider.api.js';

/**
 * SCIM Service provider configuration APIs
 * https://datatracker.ietf.org/doc/html/rfc7644#section-4
 */
export interface ConfigApi {
  /**
   * The API for the Resource Types resource.
   */
  resourceTypes: ResourceTypeApi;
  /**
   * The API for the Schemas resource.
   */
  schemas: SchemaApi;
  /**
   * The API for the Service Provider resource.
   */
  serviceProvider: ServiceProviderApi;
}
