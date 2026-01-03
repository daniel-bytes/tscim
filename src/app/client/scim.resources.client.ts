import type { BulkOperationsApi } from '../../scim/api/bulk-operations.api.js';
import type { ResourcesApi } from '../../scim/api/resources.api.js';
import type { ResourceApi } from '../../scim/api/resource.api.js';
import type {
  BulkRequest,
  BulkResponse,
  Group,
  User,
} from '../../scim/model.js';
import type { ScimHttpClient } from './scim.http.client.js';
import { ScimResourceClient } from './scim.resource.client.js';
import { ResourcesApiBase } from '../../scim/api/resources.api.base.js';

/**
 * SCIM Resources APIs Client
 */
export class ScimResourcesClient
  extends ResourcesApiBase
  implements ResourcesApi
{
  public readonly users: ResourceApi<User>;

  public readonly groups: ResourceApi<Group>;

  public readonly bulkOperations?: BulkOperationsApi;

  constructor(private readonly httpClient: ScimHttpClient) {
    super();

    this.users = new ScimResourceClient<User>('User', this.httpClient);

    this.groups = new ScimResourceClient<Group>('Group', this.httpClient);

    this.bulkOperations = {
      execute: (args: { bulkRequest: BulkRequest }) =>
        this.httpClient.request<BulkResponse>({
          method: 'POST',
          path: '/Bulk',
          body: args.bulkRequest,
        }),
    };
  }
}
