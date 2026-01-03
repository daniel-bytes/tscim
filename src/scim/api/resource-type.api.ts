import type { QueryResults, ResourceTypeDefinition } from '../model.js';
import type { SchemaUri } from '../uris.js';

/**
 * API for fetching details about resource types
 * https://datatracker.ietf.org/doc/html/rfc7644#section-4
 */
export interface ResourceTypeApi {
  /**
   * API to get a resource type by its ID.
   * https://datatracker.ietf.org/doc/html/rfc7644#section-4
   *
   * @param args.id - The ID of the resource type
   * @returns The resource type
   */
  get(args: { id: SchemaUri }): Promise<ResourceTypeDefinition>;

  /**
   * API to list all resource types.
   * https://datatracker.ietf.org/doc/html/rfc7644#section-4
   *
   * @returns The resource types
   */
  list(): Promise<QueryResults<ResourceTypeDefinition>>;
}
