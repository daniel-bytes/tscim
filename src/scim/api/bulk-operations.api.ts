import type { BulkRequest, BulkResponse } from '../model.js';

/**
 * API for executing bulk operations
 * https://datatracker.ietf.org/doc/html/rfc7644#section-3.7
 */
export interface BulkOperationsApi {
  /**
   * API for executing bulk operations.
   * https://datatracker.ietf.org/doc/html/rfc7644#section-3.7
   *
   * @param args.bulkRequest - The bulk request
   * @returns The bulk response
   */
  execute(args: { bulkRequest: BulkRequest }): Promise<BulkResponse>;
}
