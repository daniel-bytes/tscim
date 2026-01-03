import type { ScimApi } from '../../scim/api/scim.api.js';
import type { ConfigApi } from '../../scim/api/config.api.js';
import type { ResourcesApi } from '../../scim/api/resources.api.js';
import type { ScimHttpClient } from './scim.http.client.js';
import { ScimConfigClient } from './scim.config.client.js';
import { ScimResourcesClient } from './scim.resources.client.js';

/**
 * SCIM Client for interacting with external SCIM APIs over HTTP
 *
 * Implements RFC 7644 - SCIM Protocol
 * https://datatracker.ietf.org/doc/html/rfc7644
 *
 * Uses Node.js built-in fetch (available in Node 18+)
 */
export class ScimClient implements ScimApi {
  /** The configuration API client. */
  public readonly config: ConfigApi;

  /** The resources API client. */
  public readonly resources: ResourcesApi;

  constructor(private readonly httpClient: ScimHttpClient) {
    this.config = new ScimConfigClient(this.httpClient);
    this.resources = new ScimResourcesClient(this.httpClient);
  }
}
