import type { QueryResults, SchemaDefinition } from '../model.js';
import type { SchemaUri } from '../uris.js';

/**
 * API for fetching details about schemas
 * https://datatracker.ietf.org/doc/html/rfc7644#section-4
 */
export interface SchemaApi {
  /**
   * API for fetching a schema by its schema resource URI.
   * https://datatracker.ietf.org/doc/html/rfc7644#section-4
   *
   * @param args - The arguments for the API call
   * @param args.id - The schema resource URI
   * @returns The schema
   */
  get(args: { id: SchemaUri }): Promise<SchemaDefinition>;

  /**
   * API for fetching all schemas.
   * https://datatracker.ietf.org/doc/html/rfc7644#section-4
   *
   * @returns The schemas
   */
  list(): Promise<QueryResults<SchemaDefinition>>;
}
