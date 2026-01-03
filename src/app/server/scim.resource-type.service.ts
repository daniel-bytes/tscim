import type { QueryResults, ResourceTypeDefinition } from '../../scim/model.js';
import type { SchemaUri } from '../../scim/uris.js';
import { SchemaUris } from '../../scim/uris.js';
import { ScimNotFoundError } from '../../scim/errors.js';
import type { ScimServiceOptions } from './scim.service.options.js';
import type { ResourceTypeApi } from '../../scim/api/resource-type.api.js';

/**
 * SCIM service provider configuration service.
 */
export class ScimResourceTypeService implements ResourceTypeApi {
  constructor(private readonly options: ScimServiceOptions) {}

  /**
   * GET /ResourceTypes/{id}
   * RFC 7644 Section 6
   * @param args.id The resource type identifier
   * @returns The resource type definition
   */
  public async get(args: { id: SchemaUri }): Promise<ResourceTypeDefinition> {
    const resourceTypes = await this.list();
    const resourceType = resourceTypes.Resources.find(rt => rt.id === args.id);

    if (!resourceType) {
      throw new ScimNotFoundError(
        `Resource type '${args.id}' not found`,
        'User',
        args.id
      );
    }

    return resourceType;
  }

  /**
   * GET /ResourceTypes
   * RFC 7644 Section 6
   * @returns List of resource types
   */
  public async list(): Promise<QueryResults<ResourceTypeDefinition>> {
    const resourceTypes: ResourceTypeDefinition[] = [
      {
        schemas: [SchemaUris.ResourceType],
        id: 'User',
        name: 'User',
        endpoint: '/Users',
        schema: SchemaUris.User,
        description: 'User Account',
        schemaExtensions: [
          {
            schema: SchemaUris.EnterpriseUser,
            required: false,
          },
        ],
      },
    ];

    if (this.options.groupAdapter) {
      resourceTypes.push({
        schemas: [SchemaUris.ResourceType],
        id: 'Group',
        name: 'Group',
        endpoint: '/Groups',
        schema: SchemaUris.Group,
        description: 'Group',
      });
    }

    return {
      schemas: [SchemaUris.ListResponse],
      totalResults: resourceTypes.length,
      startIndex: 1,
      itemsPerPage: resourceTypes.length,
      Resources: resourceTypes,
    };
  }
}
