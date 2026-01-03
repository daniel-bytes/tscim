import type { ServiceProviderConfig } from '../model.js';

/**
 * API for fetching details about the service provider
 * https://datatracker.ietf.org/doc/html/rfc7644#section-4
 */
export interface ServiceProviderApi {
  /**
   * The API for the Service Provider Configuration resource.
   * https://datatracker.ietf.org/doc/html/rfc7644#section-5
   *
   * @returns The service provider configuration
   */
  get(): Promise<ServiceProviderConfig>;
}
