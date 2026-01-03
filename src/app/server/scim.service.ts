import { ScimResourcesService } from './scim.resources.service.js';
import { ScimConfigService } from './scim.config.service.js';
import type { ScimServiceOptions } from './scim.service.options.js';
import type { ScimApi } from '../../scim/api/scim.api.js';
import type { ResourcesApi } from '../../scim/api/resources.api.js';
import type { ConfigApi } from '../../scim/api/config.api.js';

/**
 * Service for implementing the various SCIM APIs.
 *
 * Applications looking to implement a SCIM server should implement
 * the User and (optionally) Group repositories and pass them to the ScimService
 * constructor.
 */
export class ScimService implements ScimApi {
  /** The resource service. */
  public readonly resources: ResourcesApi;

  /** The configuration service. */
  public readonly config: ConfigApi;

  constructor(private readonly options: ScimServiceOptions) {
    this.resources = new ScimResourcesService(this.options);
    this.config = new ScimConfigService(this.options);
  }
}
