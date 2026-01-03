import type { BulkOperationsApi } from '../../scim/api/bulk-operations.api.js';
import type {
  BulkOperationResponse,
  BulkRequest,
  BulkResponse,
  Group,
  ResourceType,
  User,
} from '../../scim/model.js';
import { SchemaUris } from '../../scim/uris.js';
import {
  ScimNotImplementedError,
  ScimBadRequestError,
  ScimError,
} from '../../scim/errors.js';
import type { PatchRequest } from '../../scim/patch.dsl.js';
import type { ScimServiceOptions } from './scim.service.options.js';
import type { ScimResourcesService } from './scim.resources.service.js';

/**
 * SCIM bulk operations service.
 */
export class ScimBulkOperationsService implements BulkOperationsApi {
  constructor(
    private readonly options: ScimServiceOptions,
    private readonly resourcesService: ScimResourcesService
  ) {}

  /**
   * POST /Bulk
   * RFC 7644 Section 3.7
   * @param args.bulkRequest The bulk operation request
   * @returns The bulk operation response
   */
  public async execute(args: {
    bulkRequest: BulkRequest;
  }): Promise<BulkResponse> {
    if (!this.options.enableBulk) {
      throw new ScimNotImplementedError(
        'Bulk operations are not enabled',
        'User'
      );
    }

    const { bulkRequest } = args;
    const maxOperations = this.options.maxBulkOperations ?? 100;

    if (bulkRequest.Operations.length > maxOperations) {
      throw new ScimBadRequestError(
        `Bulk request exceeds maximum operations (${maxOperations})`,
        'User'
      );
    }

    const failOnErrors = bulkRequest.failOnErrors ?? 0;
    const responses: BulkOperationResponse[] = [];
    let errorCount = 0;

    for (const operation of bulkRequest.Operations) {
      if (failOnErrors > 0 && errorCount >= failOnErrors) {
        break;
      }

      try {
        const response = await this.executeBulkOperation(operation);
        responses.push(response);
        if (parseInt(response.status) >= 400) {
          errorCount++;
        }
      } catch (error) {
        errorCount++;
        responses.push({
          method: operation.method,
          path: operation.path,
          ...(operation.bulkId && { bulkId: operation.bulkId }),
          status: '500',
          response: error instanceof ScimError ? error.toJSON() : undefined,
        });
      }
    }

    return {
      schemas: [SchemaUris.BulkResponse],
      Operations: responses,
    };
  }

  /**
   * Execute a single bulk operation
   */
  private async executeBulkOperation(
    operation: BulkRequest['Operations'][number]
  ): Promise<BulkOperationResponse> {
    const pathMatch = operation.path.match(/^\/(Users|Groups)(\/(.+))?$/);
    if (!pathMatch) {
      return {
        method: operation.method,
        path: operation.path,
        ...(operation.bulkId && { bulkId: operation.bulkId }),
        status: '400',
        response: {
          schemas: ['urn:ietf:params:scim:api:messages:2.0:Error'],
          status: '400',
          detail: `Invalid path: ${operation.path}`,
        },
      };
    }

    const resourceType = pathMatch[1];
    const resourceId = pathMatch[3];

    // Convert plural resource type to singular (Users -> User, Groups -> Group)
    const resourceTypeEnum = (
      resourceType === 'Users' ? 'User' : 'Group'
    ) as ResourceType;

    try {
      const userService = this.resourcesService.users;
      const groupService = this.resourcesService.groups!;

      switch (operation.method) {
        case 'POST':
          if (resourceTypeEnum === 'User') {
            const createdUser = await userService.create({
              resource: operation.data as User,
            });
            return {
              method: operation.method,
              path: operation.path,
              ...(operation.bulkId && { bulkId: operation.bulkId }),
              status: '201',
              response: createdUser,
              location: this.getResourceLocation('User', createdUser.id!),
            };
          } else if (resourceTypeEnum === 'Group') {
            const createdGroup = await groupService.create({
              resource: operation.data as Group,
            });
            return {
              method: operation.method,
              path: operation.path,
              ...(operation.bulkId && { bulkId: operation.bulkId }),
              status: '201',
              response: createdGroup,
              location: this.getResourceLocation('Group', createdGroup.id!),
            };
          }
          break;

        case 'PUT':
          if (!resourceId) {
            return {
              method: operation.method,
              path: operation.path,
              ...(operation.bulkId && { bulkId: operation.bulkId }),
              status: '400',
              response: {
                schemas: ['urn:ietf:params:scim:api:messages:2.0:Error'],
                status: '400',
                detail: 'Resource ID required for PUT operation',
              },
            };
          }
          if (resourceTypeEnum === 'User') {
            const updatedUser = await userService.update({
              id: resourceId,
              resource: operation.data as User,
            });
            return {
              method: operation.method,
              path: operation.path,
              ...(operation.bulkId && { bulkId: operation.bulkId }),
              status: '200',
              response: updatedUser,
            };
          } else if (resourceTypeEnum === 'Group') {
            const updatedGroup = await groupService.update({
              id: resourceId,
              resource: operation.data as Group,
            });
            return {
              method: operation.method,
              path: operation.path,
              ...(operation.bulkId && { bulkId: operation.bulkId }),
              status: '200',
              response: updatedGroup,
            };
          }
          break;

        case 'PATCH':
          if (!resourceId) {
            return {
              method: operation.method,
              path: operation.path,
              ...(operation.bulkId && { bulkId: operation.bulkId }),
              status: '400',
              response: {
                schemas: ['urn:ietf:params:scim:api:messages:2.0:Error'],
                status: '400',
                detail: 'Resource ID required for PATCH operation',
              },
            };
          }
          if (resourceTypeEnum === 'User') {
            const patchedUser = await userService.patch({
              id: resourceId,
              patch: operation.data as PatchRequest<User>,
            });
            return {
              method: operation.method,
              path: operation.path,
              ...(operation.bulkId && { bulkId: operation.bulkId }),
              status: '200',
              response: patchedUser,
            };
          } else if (resourceTypeEnum === 'Group') {
            const patchedGroup = await groupService.patch({
              id: resourceId,
              patch: operation.data as PatchRequest<Group>,
            });
            return {
              method: operation.method,
              path: operation.path,
              ...(operation.bulkId && { bulkId: operation.bulkId }),
              status: '200',
              response: patchedGroup,
            };
          }
          break;

        case 'DELETE':
          if (!resourceId) {
            return {
              method: operation.method,
              path: operation.path,
              ...(operation.bulkId && { bulkId: operation.bulkId }),
              status: '400',
              response: {
                schemas: ['urn:ietf:params:scim:api:messages:2.0:Error'],
                status: '400',
                detail: 'Resource ID required for DELETE operation',
              },
            };
          }
          if (resourceTypeEnum === 'User') {
            await userService.delete({
              id: resourceId,
            });
            return {
              method: operation.method,
              path: operation.path,
              ...(operation.bulkId && { bulkId: operation.bulkId }),
              status: '204',
            };
          } else if (resourceTypeEnum === 'Group') {
            await groupService.delete({
              id: resourceId,
            });
            return {
              method: operation.method,
              path: operation.path,
              ...(operation.bulkId && { bulkId: operation.bulkId }),
              status: '204',
            };
          }
          break;
      }

      return {
        method: operation.method,
        path: operation.path,
        ...(operation.bulkId && { bulkId: operation.bulkId }),
        status: '400',
        response: {
          schemas: ['urn:ietf:params:scim:api:messages:2.0:Error'],
          status: '400',
          detail: `Unsupported operation: ${operation.method} ${operation.path}`,
        },
      };
    } catch (error) {
      if (error instanceof ScimError) {
        return {
          method: operation.method,
          path: operation.path,
          ...(operation.bulkId && { bulkId: operation.bulkId }),
          status: String(error.statusCode),
          response: error.toJSON(),
        };
      }
      throw error;
    }
  }

  /**
   * Get resource location URL
   */
  private getResourceLocation(
    resourceType: 'User' | 'Group',
    resourceId: string
  ): string {
    if (this.options.baseUrl) {
      return `${this.options.baseUrl}/${resourceType}s/${resourceId}`;
    }
    return `/${resourceType}s/${resourceId}`;
  }
}
