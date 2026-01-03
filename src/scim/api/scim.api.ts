import type { ConfigApi } from './config.api.js';
import type { ResourcesApi } from './resources.api.js';

/**
 * API for the SCIM protocol.
 * Implemented by both SCIM HTTP client and server services.
 *
 * https://datatracker.ietf.org/doc/html/rfc7644
 */
export interface ScimApi {
  /**
   * The core Resource APIs (Users, Groups).
   * https://datatracker.ietf.org/doc/html/rfc7644#section-3
   */
  resources: ResourcesApi;
  /**
   * The Service Provider Configuration APIs.
   * https://datatracker.ietf.org/doc/html/rfc7644#section-4
   */
  config: ConfigApi;
}
