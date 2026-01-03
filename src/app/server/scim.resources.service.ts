import type { ResourceApi } from '../../scim/api/resource.api.js';
import type { ResourcesApi } from '../../scim/api/resources.api.js';
import type { BulkOperationsApi } from '../../scim/api/bulk-operations.api.js';
import type { Group, User } from '../../scim/model.js';
import { ScimBulkOperationsService } from './scim.bulk-operations.service.js';
import { ScimResourceService } from './scim.resource.service.js';
import type { ScimServiceOptions } from './scim.service.options.js';
import { ResourcesApiBase } from '../../scim/api/resources.api.base.js';

/**
 * SCIM service for the Resource API.
 *
 * This service is responsible for handling the various HTTP methods of the SCIM protocol.
 * It is responsible for delegating to the appropriate repository for the operation.
 * It is also responsible for applying any in-memory filters to the results.
 *
 * End users should generally leave this class as-is and implement the repository classes for their specific use case.
 */
export class ScimResourcesService
  extends ResourcesApiBase
  implements ResourcesApi
{
  /** The User resource service. */
  public readonly users: ResourceApi<User>;

  /** The optional Group resource service. */
  public readonly groups?: ResourceApi<Group>;

  /** The optional bulk resource operations service. */
  public readonly bulkOperations?: BulkOperationsApi;

  constructor(private readonly options: ScimServiceOptions) {
    super();
    this.users = new ScimResourceService<User>(
      this.options.userAdapter,
      'User',
      this.options.ensureSinglePrimaryValue
    );

    if (this.options.groupAdapter) {
      this.groups = new ScimResourceService<Group>(
        this.options.groupAdapter,
        'Group',
        this.options.ensureSinglePrimaryValue
      );
    }

    if (this.options.enableBulk) {
      this.bulkOperations = new ScimBulkOperationsService(this.options, this);
    }
  }
}
