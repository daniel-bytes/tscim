import { SchemaUris } from './uris.js';

/**
 * SCIM Core Schema Models
 *
 * Implements RFC 7643 Section 4 - SCIM Core Schema
 * https://datatracker.ietf.org/doc/html/rfc7643#section-4
 */

// ============================================================================
// Common Attributes (Section 4)
// ============================================================================

/**
 * Metadata about a SCIM resource
 * https://datatracker.ietf.org/doc/html/rfc7643#section-4.1
 */
export interface Meta {
  /** The name of the resource type of the resource */
  readonly resourceType?: string;
  /** The DateTime the resource was added to the service provider */
  readonly created?: string;
  /** The most recent DateTime the details of this resource were updated */
  readonly lastModified?: string;
  /** The URI of the resource being returned */
  readonly location?: string;
  /** The version of the resource being returned */
  readonly version?: string;
}

/**
 * A unique identifier for a SCIM resource as defined by the service provider
 */
export type ResourceId = string;

/**
 * A String that is an identifier for the resource as defined by the provisioning client
 */
export type ResourceExternalId = string;

/**
 * Base interface for all SCIM resources
 * RFC 7643 Section 4 - Common Attributes
 */
export interface Resource {
  /** A list of URIs of the schemas that define the attributes present in the current structure */
  schemas: string[];
  /** A unique identifier for a SCIM resource as defined by the service provider */
  readonly id?: ResourceId;
  /** A String that is an identifier for the resource as defined by the provisioning client */
  externalId?: ResourceExternalId;
  /** A complex attribute containing resource metadata */
  readonly meta?: Meta;
}

/**
 * The type of SCIM resource
 */
export type ResourceType = 'User' | 'Group';

/**
 * Type-level mapping from Resource interface to ResourceType.
 * This can be used to extract the ResourceType from a Resource type.
 *
 * @example
 * type UserResourceType = ResourceTypeOf<User>; // "User"
 * type GroupResourceType = ResourceTypeOf<Group>; // "Group"
 */
export type ResourceTypeOf<T extends Resource> = T extends User
  ? 'User'
  : T extends Group
    ? 'Group'
    : never;

// ============================================================================
// User Resource (Section 4.1)
// ============================================================================

/**
 * Name components of a User
 * https://datatracker.ietf.org/doc/html/rfc7643#section-4.1.1 - name
 */
export interface Name {
  /** The full name, including all middle names, titles, and suffixes */
  formatted?: string;
  /** The family name of the User */
  familyName?: string;
  /** The given (first) name of the User */
  givenName?: string;
  /** The middle name(s) of the User */
  middleName?: string;
  /** The honorific prefix(es) of the User */
  honorificPrefix?: string;
  /** The honorific suffix(es) of the User */
  honorificSuffix?: string;
}

/**
 * Email address
 * https://datatracker.ietf.org/doc/html/rfc7643#section-4.1.2 - emails
 */
export interface Email {
  /** Email addresses for the user */
  value: string;
  /** A label indicating the attribute's function */
  type?: string;
  /** A Boolean value indicating the 'primary' or preferred attribute value */
  primary?: boolean;
  /** A human-readable name, primarily used for display purposes */
  display?: string;
}

/**
 * Physical mailing address
 * https://datatracker.ietf.org/doc/html/rfc7643#section-4.1.2 - addresses
 */
export interface Address {
  /** The full mailing address */
  formatted?: string;
  /** The full street address component */
  streetAddress?: string;
  /** The city or locality component */
  locality?: string;
  /** The state or region component */
  region?: string;
  /** The zip code or postal code component */
  postalCode?: string;
  /** The country name component */
  country?: string;
  /** A label indicating the attribute's function */
  type?: string;
  /** A Boolean value indicating the 'primary' or preferred attribute value */
  primary?: boolean;
}

/**
 * Phone number
 * https://datatracker.ietf.org/doc/html/rfc7643#section-4.1.2 - phoneNumbers
 */
export interface PhoneNumber {
  /** Phone number of the User */
  value: string;
  /** A label indicating the attribute's function */
  type?: string;
  /** A Boolean value indicating the 'primary' or preferred attribute value */
  primary?: boolean;
}

/**
 * Instant messaging address
 * https://datatracker.ietf.org/doc/html/rfc7643#section-4.1.2 - ims
 */
export interface InstantMessage {
  /** Instant messaging address for the User */
  value: string;
  /** A label indicating the attribute's function */
  type?: string;
  /** A Boolean value indicating the 'primary' or preferred attribute value */
  primary?: boolean;
}

/**
 * Photo of the User
 * https://datatracker.ietf.org/doc/html/rfc7643#section-4.1.2 - photos
 */
export interface Photo {
  /** URL of a photo of the User */
  value: string;
  /** A label indicating the attribute's function */
  type?: string;
  /** A Boolean value indicating the 'primary' or preferred attribute value */
  primary?: boolean;
}

/**
 * Entitlement
 * https://datatracker.ietf.org/doc/html/rfc7643#section-4.1.2 - entitlements
 */
export interface Entitlement {
  /** The value of an entitlement */
  value: string;
  /** A label indicating the attribute's function */
  type?: string;
  /** A Boolean value indicating the 'primary' or preferred attribute value */
  primary?: boolean;
  /** A human-readable name, primarily used for display purposes */
  display?: string;
}

/**
 * Role
 * https://datatracker.ietf.org/doc/html/rfc7643#section-4.1.2 - roles
 */
export interface Role {
  /** The value of a role */
  value: string;
  /** A label indicating the attribute's function */
  type?: string;
  /** A Boolean value indicating the 'primary' or preferred attribute value */
  primary?: boolean;
  /** A human-readable name, primarily used for display purposes */
  display?: string;
}

/**
 * X.509 certificate
 * https://datatracker.ietf.org/doc/html/rfc7643#section-4.1.2 - x509Certificates
 */
export interface X509Certificate {
  /** The value of an X.509 certificate */
  value: string;
  /** A label indicating the attribute's function */
  type?: string;
  /** A Boolean value indicating the 'primary' or preferred attribute value */
  primary?: boolean;
}

/**
 * User Resource
 * https://datatracker.ietf.org/doc/html/rfc7643#section-4.1
 */
export interface User extends Resource {
  /** Unique identifier for the User */
  userName: string;
  /** The components of the user's name */
  name?: Name;
  /** The name of the User, suitable for display to end-users */
  displayName?: string;
  /** The casual way to address the user */
  nickName?: string;
  /** A URI that is a uniform resource locator (URL) pointing to a user's online profile */
  profileUrl?: string;
  /** The user's title */
  title?: string;
  /** Used to identify the organization to which the user belongs */
  userType?: string;
  /** Indicates the user's preferred written or spoken language */
  preferredLanguage?: string;
  /** Used to indicate the User's default location */
  locale?: string;
  /** The User's time zone */
  timezone?: string;
  /** A Boolean value indicating the User's administrative status */
  active?: boolean;
  /** The cleartext password */
  password?: string;
  /** Email addresses for the user */
  emails?: Email[];
  /** Physical mailing addresses */
  addresses?: Address[];
  /** Phone numbers for the User */
  phoneNumbers?: PhoneNumber[];
  /** Instant messaging addresses for the User */
  ims?: InstantMessage[];
  /** URLs of photos of the User */
  photos?: Photo[];
  /** A list of entitlements for the User */
  entitlements?: Entitlement[];
  /** A list of roles for the User */
  roles?: Role[];
  /** A list of certificates issued to the User */
  x509Certificates?: X509Certificate[];
  /** A list of groups to which the user belongs */
  readonly groups?: GroupReference[];
  /** Enterprise User Extension attributes */
  [SchemaUris.EnterpriseUser]?: EnterpriseUser;
}

/**
 * Group reference (used in User.groups)
 * https://datatracker.ietf.org/doc/html/rfc7643#section-4.1
 */
export interface GroupReference {
  /** The identifier of a group */
  value: string;
  /** The URI of the corresponding resource */
  $ref?: string;
  /** A human-readable name for the group */
  display?: string;
  /** A label indicating the type of resource */
  type?: string;
}

// ============================================================================
// Enterprise User Extension (Section 4.3)
// ============================================================================

/**
 * Manager reference
 * https://datatracker.ietf.org/doc/html/rfc7643#section-4.3 - manager
 */
export interface Manager {
  /** The identifier of the manager's SCIM resource */
  value?: string;
  /** The URI of the corresponding manager resource */
  readonly $ref?: string;
  /** The displayName of the manager */
  readonly displayName?: string;
}

/**
 * Enterprise User Extension attributes
 * https://datatracker.ietf.org/doc/html/rfc7643#section-4.3 - Enterprise User Extension
 */
export interface EnterpriseUser {
  /** A string identifier, typically numeric or alphanumeric, assigned to a person, typically based on order of hire or association with an organization */
  employeeNumber?: string;
  /** Identifies the name of a cost center */
  costCenter?: string;
  /** Identifies the name of an organization */
  organization?: string;
  /** Identifies the name of a division */
  division?: string;
  /** Identifies the name of a department */
  department?: string;
  /** The user's manager */
  manager?: Manager;
}

// ============================================================================
// Group Resource (Section 4.2)
// ============================================================================

/**
 * Member of a Group
 * https://datatracker.ietf.org/doc/html/rfc7643#section-4.2
 */
export interface Member {
  /** The identifier of a group member */
  value: string;
  /** The URI of the corresponding resource */
  $ref?: string;
  /** A human-readable name for the member */
  display?: string;
  /** A label indicating the type of resource */
  type?: string;
}

/**
 * Group Resource
 * https://datatracker.ietf.org/doc/html/rfc7643#section-4.2
 */
export interface Group extends Resource {
  /** A human-readable name for the Group */
  displayName: string;
  /** A list of members of the Group */
  members?: Member[];
}

// ============================================================================
// Query Inputs & Results (RFC 7644 Section 3.4.2)
// ============================================================================

/**
 * Pagination inputs for list requests
 * https://datatracker.ietf.org/doc/html/rfc7644#section-3.4.2.4
 */
export interface PaginationParameters {
  /** The 1-based index of the first query result (default: 1) */
  readonly startIndex?: number;
  /** The desired maximum number of query results (page size) */
  readonly count?: number;
}

/**
 * Allowed sort orders for list requests
 * https://datatracker.ietf.org/doc/html/rfc7644#section-3.4.2.3
 */
export type SortOrder = 'ascending' | 'descending';

/**
 * Sorting inputs for list requests
 * https://datatracker.ietf.org/doc/html/rfc7644#section-3.4.2.3
 */
export interface SortingParameters {
  /** The attribute whose value shall be used to order the returned responses */
  readonly sortBy?: string;
  /** The order in which the results SHALL be returned (default: ascending) */
  readonly sortOrder?: SortOrder;
}

/**
 * Attribute path notation for selection/filtering
 * https://datatracker.ietf.org/doc/html/rfc7644#section-3.4.2.5
 */
export type AttributePath<T extends object> = {
  [K in keyof T & string]: T[K] extends readonly (infer U)[]
    ? U extends object
      ? `${K}.${AttributePath<U>}` | K
      : K
    : T[K] extends object
      ? `${K}.${AttributePath<T[K]>}` | K
      : K;
}[keyof T & string];

/**
 * Attribute selection parameters for list requests
 * (include and exclude lists)
 */
export interface AttributeParameters<TResource extends Resource = Resource> {
  /** Attributes to include */
  readonly attributes?: AttributePath<TResource>[];
  /** Attributes to exclude */
  readonly excludedAttributes?: AttributePath<TResource>[];
}

/**
 * Paginated query results (ListResponse)
 * https://datatracker.ietf.org/doc/html/rfc7644#section-3.4.2
 */
export interface QueryResults<T> {
  /** Schemas present in the response (typically ListResponse) */
  readonly schemas: string[];
  /** The total number of results across all pages */
  readonly totalResults: number;
  /** The 1-based index of the first result in this page (default: 1) */
  readonly startIndex?: number;
  /** The number of results returned in this page (page size) */
  readonly itemsPerPage?: number;
  /** The resources returned for the current page */
  readonly Resources: T[];
}

/**
 * SCIM Error response according to RFC 7644 Section 3.12
 * https://datatracker.ietf.org/doc/html/rfc7644#section-3.12
 */
export interface ScimErrorJson {
  readonly schemas: ['urn:ietf:params:scim:api:messages:2.0:Error'];
  readonly status: string;
  readonly scimType?: string;
  readonly detail: string;
}

// ============================================================================
// Discovery Endpoints (RFC 7644 Sections 5-7)
// ============================================================================

/**
 * Service Provider Configuration
 * https://datatracker.ietf.org/doc/html/rfc7644#section-4
 */
export interface ServiceProviderConfig extends Resource {
  /** Supported authentication schemes */
  readonly patch?: {
    readonly supported: boolean;
  };
  readonly bulk?: {
    readonly supported: boolean;
    readonly maxOperations?: number;
    readonly maxPayloadSize?: number;
  };
  readonly filter?: {
    readonly supported: boolean;
    readonly maxResults?: number;
  };
  readonly changePassword?: {
    readonly supported: boolean;
  };
  readonly sort?: {
    readonly supported: boolean;
  };
  readonly etag?: {
    readonly supported: boolean;
  };
  readonly authenticationSchemes?: {
    readonly type: string;
    readonly name: string;
    readonly description?: string;
    readonly specUri?: string;
    readonly documentationUri?: string;
  }[];
}

/**
 * Resource Type definition
 *https://datatracker.ietf.org/doc/html/rfc7644#section-4
 */
export interface ResourceTypeDefinition extends Resource {
  /** The resource type's human-readable name */
  readonly name: string;
  /** The resource type's unique identifier */
  readonly id: string;
  /** The resource type's HTTP-addressable endpoint */
  readonly endpoint: string;
  /** The resource type's primary/base schema URI */
  readonly schema: string;
  /** A list of the schema extensions */
  readonly schemaExtensions?: {
    readonly schema: string;
    readonly required: boolean;
  }[];
  /** The resource type's human-readable description */
  readonly description?: string;
}

/**
 * Schema Attribute definition
 * https://datatracker.ietf.org/doc/html/rfc7644#section-4
 */
export interface SchemaAttribute {
  /** The attribute's name */
  readonly name: string;
  /** The attribute's data type */
  readonly type:
    | 'string'
    | 'boolean'
    | 'decimal'
    | 'integer'
    | 'dateTime'
    | 'reference'
    | 'complex'
    | 'binary';
  /** When an attribute is of type "complex", "subAttributes" defines a set of sub-attributes */
  readonly subAttributes?: SchemaAttribute[];
  /** A Boolean value indicating the attribute's mutability */
  readonly mutability?: 'readOnly' | 'readWrite' | 'immutable' | 'writeOnly';
  /** A Boolean value that specifies whether or not the attribute is required */
  readonly required?: boolean;
  /** A collection that specifies whether or not an attribute is returned by default */
  readonly returned?: 'always' | 'never' | 'default' | 'request';
  /** A single keyword indicating the circumstances under which the value of the attribute can be (re)defined */
  readonly uniqueness?: 'none' | 'server' | 'global';
  /** The attribute's human-readable description */
  readonly description?: string;
  /** A list of suggested canonical values */
  readonly canonicalValues?: string[];
  /** A Boolean value indicating whether or not a string attribute is case sensitive */
  readonly caseExact?: boolean;
  /** A multi-valued array of JSON strings that indicate the SCIM resource types that may be referenced */
  readonly referenceTypes?: string[];
}

/**
 * Schema definition
 * RFC 7644 Section 7
 */
export interface SchemaDefinition extends Resource {
  /** The schema's human-readable name */
  readonly name?: string;
  /** The schema's unique identifier */
  readonly id: string;
  /** The schema's human-readable description */
  readonly description?: string;
  /** A complex type that defines service provider attributes and their qualities */
  readonly attributes: SchemaAttribute[];
}

/**
 * Bulk Operation
 * https://datatracker.ietf.org/doc/html/rfc7644#section-3.7
 */
export interface BulkOperation {
  /** The HTTP method of the operation */
  readonly method: 'POST' | 'PUT' | 'PATCH' | 'DELETE';
  /** The resource's relative path */
  readonly path: string;
  /** A unique identifier for the operation */
  readonly bulkId?: string;
  /** The resource data for POST/PUT/PATCH operations */
  readonly data?: unknown;
}

/**
 * Bulk Request
 * https://datatracker.ietf.org/doc/html/rfc7644#section-3.7
 */
export interface BulkRequest {
  /** Schemas present in the request */
  readonly schemas: ['urn:ietf:params:scim:api:messages:2.0:BulkRequest'];
  /** Number of errors that the service provider will accept before the operation is terminated */
  readonly failOnErrors?: number;
  /** The set of operations to be processed */
  readonly Operations: BulkOperation[];
}

/**
 * Bulk Operation Response
 * https://datatracker.ietf.org/doc/html/rfc7644#section-3.7
 */
export interface BulkOperationResponse {
  /** The HTTP method of the operation */
  readonly method?: string;
  /** The resource's relative path */
  readonly path?: string;
  /** The unique identifier for the operation */
  readonly bulkId?: string;
  /** The HTTP response status code */
  readonly status: string;
  /** The operation response data */
  readonly response?: unknown;
  /** The operation response location */
  readonly location?: string;
}

/**
 * Bulk Response
 * https://datatracker.ietf.org/doc/html/rfc7644#section-3.7
 */
export interface BulkResponse {
  /** Schemas present in the response */
  readonly schemas: ['urn:ietf:params:scim:api:messages:2.0:BulkResponse'];
  /** The set of operation responses */
  readonly Operations: BulkOperationResponse[];
}

// ============================================================================
// Type Guards
// ============================================================================

/**
 * Type guard to check if a resource is a User
 */
export const isUser = (resource: Resource): resource is User => {
  return resource.schemas.includes(SchemaUris.User);
};

/**
 * Type guard to check if a resource is a Group
 */
export const isGroup = (resource: Resource): resource is Group => {
  return resource.schemas.includes(SchemaUris.Group);
};
