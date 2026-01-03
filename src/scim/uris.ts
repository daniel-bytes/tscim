// ============================================================================
// Schema URIs
// ============================================================================

/**
 * A SCIM schema URI
 */
export type SchemaUri = `urn:ietf:params:scim:schemas:${string}`;

/**
 * A SCIM API URI
 */
export type ApiUri = `urn:ietf:params:scim:api:${string}`;

/**
 * Standard SCIM schema URIs
 * RFC 7643 Section 4
 */
export const SchemaUris = {
  /** Core schema URI */
  Core: 'urn:ietf:params:scim:schemas:core:2.0:Core',
  /** User schema URI */
  User: 'urn:ietf:params:scim:schemas:core:2.0:User',
  /** Group schema URI */
  Group: 'urn:ietf:params:scim:schemas:core:2.0:Group',
  /** Enterprise User Extension schema URI */
  EnterpriseUser: 'urn:ietf:params:scim:schemas:extension:enterprise:2.0:User',
  /** ListResponse (query results) schema URI */
  ListResponse: 'urn:ietf:params:scim:api:messages:2.0:ListResponse',
  /** Patch schema URI, RFC 7644 Section 3.5.2 - PATCH */
  PatchOp: 'urn:ietf:params:scim:api:messages:2.0:PatchOp',
  /** ServiceProviderConfig schema URI, RFC 7644 Section 5 */
  ServiceProviderConfig:
    'urn:ietf:params:scim:schemas:core:2.0:ServiceProviderConfig',
  /** ResourceType schema URI, RFC 7644 Section 6 */
  ResourceType: 'urn:ietf:params:scim:schemas:core:2.0:ResourceType',
  /** Schema schema URI, RFC 7644 Section 7 */
  Schema: 'urn:ietf:params:scim:schemas:core:2.0:Schema',
  /** BulkRequest schema URI, RFC 7644 Section 3.7 */
  BulkRequest: 'urn:ietf:params:scim:api:messages:2.0:BulkRequest',
  /** BulkResponse schema URI, RFC 7644 Section 3.7 */
  BulkResponse: 'urn:ietf:params:scim:api:messages:2.0:BulkResponse',
} as const;
