import type { SchemaApi } from '../../scim/api/schema.api.js';
import type { QueryResults, SchemaDefinition } from '../../scim/model.js';
import type { SchemaUri } from '../../scim/uris.js';
import { SchemaUris } from '../../scim/uris.js';
import { ScimNotFoundError } from '../../scim/errors.js';
import type { ScimServiceOptions } from './scim.service.options.js';

/**
 * SCIM service provider configuration service.
 */
export class ScimSchemaService implements SchemaApi {
  constructor(private readonly options: ScimServiceOptions) {}

  /**
   * GET /Schemas/{id}
   * RFC 7644 Section 7
   * @param args.id The schema identifier (URI)
   * @returns The schema definition
   */
  public async get(args: { id: SchemaUri }): Promise<SchemaDefinition> {
    const schemas = await this.list();
    const schema = schemas.Resources.find(s => s.id === args.id);

    if (!schema) {
      throw new ScimNotFoundError(
        `Schema '${args.id}' not found`,
        'User',
        args.id
      );
    }

    return schema;
  }
  /**
   * GET /Schemas
   * RFC 7644 Section 7
   * @returns List of schema definitions
   */
  public async list(): Promise<QueryResults<SchemaDefinition>> {
    const schemas: SchemaDefinition[] = [
      this.getCoreSchema(),
      this.getUserSchema(),
    ];

    if (this.options.groupAdapter) {
      schemas.push(this.getGroupSchema());
    }

    // Add Enterprise User Extension schema if groups are supported
    if (this.options.groupAdapter) {
      schemas.push(this.getEnterpriseUserSchema());
    }

    return {
      schemas: [SchemaUris.ListResponse],
      totalResults: schemas.length,
      startIndex: 1,
      itemsPerPage: schemas.length,
      Resources: schemas,
    };
  }

  /**
   * Get Core schema definition
   */
  private getCoreSchema(): SchemaDefinition {
    return {
      schemas: [SchemaUris.Schema],
      id: SchemaUris.Core,
      name: 'Core',
      description: 'Core SCIM attributes',
      attributes: [
        {
          name: 'id',
          type: 'string',
          mutability: 'readOnly',
          required: false,
          returned: 'always',
          uniqueness: 'server',
          description: 'A unique identifier for a SCIM resource',
        },
        {
          name: 'externalId',
          type: 'string',
          mutability: 'readWrite',
          required: false,
          returned: 'default',
          uniqueness: 'none',
          description:
            'A String that is an identifier for the resource as defined by the provisioning client',
        },
        {
          name: 'meta',
          type: 'complex',
          mutability: 'readOnly',
          required: false,
          returned: 'default',
          description: 'A complex attribute containing resource metadata',
          subAttributes: [
            {
              name: 'resourceType',
              type: 'string',
              mutability: 'readOnly',
              required: false,
              returned: 'default',
            },
            {
              name: 'created',
              type: 'dateTime',
              mutability: 'readOnly',
              required: false,
              returned: 'default',
            },
            {
              name: 'lastModified',
              type: 'dateTime',
              mutability: 'readOnly',
              required: false,
              returned: 'default',
            },
            {
              name: 'location',
              type: 'reference',
              mutability: 'readOnly',
              required: false,
              returned: 'default',
            },
            {
              name: 'version',
              type: 'string',
              mutability: 'readOnly',
              required: false,
              returned: 'default',
            },
          ],
        },
      ],
    };
  }

  /**
   * Get User schema definition
   */
  private getUserSchema(): SchemaDefinition {
    return {
      schemas: [SchemaUris.Schema],
      id: SchemaUris.User,
      name: 'User',
      description: 'User Account',
      attributes: [
        {
          name: 'userName',
          type: 'string',
          mutability: 'readWrite',
          required: true,
          returned: 'default',
          uniqueness: 'server',
          description: 'Unique identifier for the User',
        },
        {
          name: 'name',
          type: 'complex',
          mutability: 'readWrite',
          required: false,
          returned: 'default',
          description: "The components of the user's name",
          subAttributes: [
            {
              name: 'formatted',
              type: 'string',
              mutability: 'readWrite',
              required: false,
              returned: 'default',
            },
            {
              name: 'familyName',
              type: 'string',
              mutability: 'readWrite',
              required: false,
              returned: 'default',
            },
            {
              name: 'givenName',
              type: 'string',
              mutability: 'readWrite',
              required: false,
              returned: 'default',
            },
            {
              name: 'middleName',
              type: 'string',
              mutability: 'readWrite',
              required: false,
              returned: 'default',
            },
            {
              name: 'honorificPrefix',
              type: 'string',
              mutability: 'readWrite',
              required: false,
              returned: 'default',
            },
            {
              name: 'honorificSuffix',
              type: 'string',
              mutability: 'readWrite',
              required: false,
              returned: 'default',
            },
          ],
        },
        {
          name: 'displayName',
          type: 'string',
          mutability: 'readWrite',
          required: false,
          returned: 'default',
        },
        {
          name: 'nickName',
          type: 'string',
          mutability: 'readWrite',
          required: false,
          returned: 'default',
        },
        {
          name: 'profileUrl',
          type: 'reference',
          mutability: 'readWrite',
          required: false,
          returned: 'default',
        },
        {
          name: 'title',
          type: 'string',
          mutability: 'readWrite',
          required: false,
          returned: 'default',
        },
        {
          name: 'userType',
          type: 'string',
          mutability: 'readWrite',
          required: false,
          returned: 'default',
        },
        {
          name: 'preferredLanguage',
          type: 'string',
          mutability: 'readWrite',
          required: false,
          returned: 'default',
        },
        {
          name: 'locale',
          type: 'string',
          mutability: 'readWrite',
          required: false,
          returned: 'default',
        },
        {
          name: 'timezone',
          type: 'string',
          mutability: 'readWrite',
          required: false,
          returned: 'default',
        },
        {
          name: 'active',
          type: 'boolean',
          mutability: 'readWrite',
          required: false,
          returned: 'default',
        },
        {
          name: 'password',
          type: 'string',
          mutability: 'writeOnly',
          required: false,
          returned: 'never',
        },
        {
          name: 'emails',
          type: 'complex',
          mutability: 'readWrite',
          required: false,
          returned: 'default',
          description: 'Email addresses for the user',
          subAttributes: [
            {
              name: 'value',
              type: 'string',
              mutability: 'readWrite',
              required: true,
              returned: 'default',
            },
            {
              name: 'type',
              type: 'string',
              mutability: 'readWrite',
              required: false,
              returned: 'default',
            },
            {
              name: 'primary',
              type: 'boolean',
              mutability: 'readWrite',
              required: false,
              returned: 'default',
            },
            {
              name: 'display',
              type: 'string',
              mutability: 'readWrite',
              required: false,
              returned: 'default',
            },
          ],
        },
        {
          name: 'addresses',
          type: 'complex',
          mutability: 'readWrite',
          required: false,
          returned: 'default',
          description: 'Physical mailing addresses',
          subAttributes: [
            {
              name: 'formatted',
              type: 'string',
              mutability: 'readWrite',
              required: false,
              returned: 'default',
            },
            {
              name: 'streetAddress',
              type: 'string',
              mutability: 'readWrite',
              required: false,
              returned: 'default',
            },
            {
              name: 'locality',
              type: 'string',
              mutability: 'readWrite',
              required: false,
              returned: 'default',
            },
            {
              name: 'region',
              type: 'string',
              mutability: 'readWrite',
              required: false,
              returned: 'default',
            },
            {
              name: 'postalCode',
              type: 'string',
              mutability: 'readWrite',
              required: false,
              returned: 'default',
            },
            {
              name: 'country',
              type: 'string',
              mutability: 'readWrite',
              required: false,
              returned: 'default',
            },
            {
              name: 'type',
              type: 'string',
              mutability: 'readWrite',
              required: false,
              returned: 'default',
            },
            {
              name: 'primary',
              type: 'boolean',
              mutability: 'readWrite',
              required: false,
              returned: 'default',
            },
          ],
        },
        {
          name: 'phoneNumbers',
          type: 'complex',
          mutability: 'readWrite',
          required: false,
          returned: 'default',
          description: 'Phone numbers for the User',
          subAttributes: [
            {
              name: 'value',
              type: 'string',
              mutability: 'readWrite',
              required: true,
              returned: 'default',
            },
            {
              name: 'type',
              type: 'string',
              mutability: 'readWrite',
              required: false,
              returned: 'default',
            },
            {
              name: 'primary',
              type: 'boolean',
              mutability: 'readWrite',
              required: false,
              returned: 'default',
            },
          ],
        },
        {
          name: 'groups',
          type: 'complex',
          mutability: 'readOnly',
          required: false,
          returned: 'default',
          description: 'A list of groups to which the user belongs',
          subAttributes: [
            {
              name: 'value',
              type: 'string',
              mutability: 'readOnly',
              required: false,
              returned: 'default',
            },
            {
              name: '$ref',
              type: 'reference',
              mutability: 'readOnly',
              required: false,
              returned: 'default',
            },
            {
              name: 'display',
              type: 'string',
              mutability: 'readOnly',
              required: false,
              returned: 'default',
            },
          ],
        },
      ],
    };
  }

  /**
   * Get Group schema definition
   */
  private getGroupSchema(): SchemaDefinition {
    return {
      schemas: [SchemaUris.Schema],
      id: SchemaUris.Group,
      name: 'Group',
      description: 'Group',
      attributes: [
        {
          name: 'displayName',
          type: 'string',
          mutability: 'readWrite',
          required: true,
          returned: 'default',
          description: 'A human-readable name for the Group',
        },
        {
          name: 'members',
          type: 'complex',
          mutability: 'readWrite',
          required: false,
          returned: 'default',
          description: 'A list of members of the Group',
          subAttributes: [
            {
              name: 'value',
              type: 'string',
              mutability: 'readWrite',
              required: true,
              returned: 'default',
            },
            {
              name: '$ref',
              type: 'reference',
              mutability: 'readOnly',
              required: false,
              returned: 'default',
            },
            {
              name: 'display',
              type: 'string',
              mutability: 'readOnly',
              required: false,
              returned: 'default',
            },
            {
              name: 'type',
              type: 'string',
              mutability: 'readWrite',
              required: false,
              returned: 'default',
            },
          ],
        },
      ],
    };
  }

  /**
   * Get Enterprise User Extension schema definition
   */
  private getEnterpriseUserSchema(): SchemaDefinition {
    return {
      schemas: [SchemaUris.Schema],
      id: SchemaUris.EnterpriseUser,
      name: 'EnterpriseUser',
      description: 'Enterprise User Extension',
      attributes: [
        {
          name: 'employeeNumber',
          type: 'string',
          mutability: 'readWrite',
          required: false,
          returned: 'default',
        },
        {
          name: 'costCenter',
          type: 'string',
          mutability: 'readWrite',
          required: false,
          returned: 'default',
        },
        {
          name: 'organization',
          type: 'string',
          mutability: 'readWrite',
          required: false,
          returned: 'default',
        },
        {
          name: 'division',
          type: 'string',
          mutability: 'readWrite',
          required: false,
          returned: 'default',
        },
        {
          name: 'department',
          type: 'string',
          mutability: 'readWrite',
          required: false,
          returned: 'default',
        },
        {
          name: 'manager',
          type: 'complex',
          mutability: 'readWrite',
          required: false,
          returned: 'default',
          subAttributes: [
            {
              name: 'value',
              type: 'string',
              mutability: 'readWrite',
              required: false,
              returned: 'default',
            },
            {
              name: '$ref',
              type: 'reference',
              mutability: 'readOnly',
              required: false,
              returned: 'default',
            },
            {
              name: 'displayName',
              type: 'string',
              mutability: 'readOnly',
              required: false,
              returned: 'default',
            },
          ],
        },
      ],
    };
  }
}
