import type { ServiceProviderConfig } from '../../scim/model.js';
import { SchemaUris } from '../../scim/uris.js';
import type { ServiceProviderApi } from '../../scim/api/service-provider.api.js';
import type { ScimServiceOptions } from './scim.service.options.js';

/**
 * SCIM service provider configuration service.
 */
export class ScimServiceProviderService implements ServiceProviderApi {
  constructor(private readonly options: ScimServiceOptions) {}

  /**
   * GET /ServiceProviderConfig
   * RFC 7644 Section 5
   * @returns The service provider configuration
   */
  public async get(): Promise<ServiceProviderConfig> {
    const supportsBulk = this.options.enableBulk ?? false;

    const bulkConfig: ServiceProviderConfig['bulk'] = supportsBulk
      ? {
          supported: true,
          maxOperations: this.options.maxBulkOperations ?? 100,
          maxPayloadSize: this.options.maxBulkPayloadSize ?? 1048576,
        }
      : {
          supported: false,
        };

    return {
      schemas: [SchemaUris.ServiceProviderConfig],
      patch: {
        supported: true,
      },
      bulk: bulkConfig,
      filter: {
        supported: true,
        maxResults: this.options.maxFilterResults ?? 200,
      },
      changePassword: {
        supported: false,
      },
      sort: {
        supported: true,
      },
      etag: {
        supported: false,
      },
      authenticationSchemes: [
        {
          type: 'oauthbearertoken',
          name: 'OAuth Bearer Token',
          description: 'Authentication using OAuth 2.0 Bearer Token',
        },
      ],
    };
  }
}
