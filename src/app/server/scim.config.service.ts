import type { ConfigApi } from '../../scim/api/config.api.js';
import type { ResourceTypeApi } from '../../scim/api/resource-type.api.js';
import type { SchemaApi } from '../../scim/api/schema.api.js';
import type { ServiceProviderApi } from '../../scim/api/service-provider.api.js';
import { ScimResourceTypeService } from './scim.resource-type.service.js';
import { ScimServiceProviderService } from './scim.service-provider.service.js';
import { ScimSchemaService } from './scim.schema.service.js';
import type { ScimServiceOptions } from './scim.service.options.js';

/**
 * SCIM configuration service.
 * Implements the SCIM configuration APIs.
 */
export class ScimConfigService implements ConfigApi {
  /** The resource type service. */
  public readonly resourceTypes: ResourceTypeApi;

  /** The schema service. */
  public readonly schemas: SchemaApi;

  /** The service provider service. */
  public readonly serviceProvider: ServiceProviderApi;

  constructor(private readonly options: ScimServiceOptions) {
    this.resourceTypes = new ScimResourceTypeService(this.options);
    this.schemas = new ScimSchemaService(this.options);
    this.serviceProvider = new ScimServiceProviderService(this.options);
  }
}
