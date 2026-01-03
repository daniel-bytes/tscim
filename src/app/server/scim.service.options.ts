import type { ResourceAdapter } from '../adapter/resource.adapter.js';
import type { Group, User } from '../../scim/model.js';
/**
 * Options for creating a SCIM service.
 */
export interface ScimServiceOptions {
  /** User adapter (required) */
  userAdapter: ResourceAdapter<User>;
  /** Optional group adapter (default: undefined) */
  groupAdapter?: ResourceAdapter<Group>;
  /** Ensure single primary value for the resource (default: false) */
  ensureSinglePrimaryValue?: boolean;
  /** Base URL for generating resource locations (optional) */
  baseUrl?: string;
  /** Enable bulk operations (default: false) */
  enableBulk?: boolean;
  /** Maximum number of operations in a bulk request (default: 100) */
  maxBulkOperations?: number;
  /** Maximum payload size for bulk requests in bytes (default: 1048576 = 1MB) */
  maxBulkPayloadSize?: number;
  /** Maximum number of results for filter queries (default: 200) */
  maxFilterResults?: number;
}
