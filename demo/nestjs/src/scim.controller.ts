import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Patch,
  Body,
  Param,
  Query,
  HttpException,
  Inject,
} from '@nestjs/common';
import {
  ScimClient,
  ScimService,
  parseQueryParameters,
  ScimError,
  syncResources,
  type QueryParametersInput,
  type User,
  type Group,
  type PatchRequest,
  type BulkRequest,
  type SchemaUri,
} from 'tscim';
import { Tokens } from './tokens';
import { ParseSchemaUriPipe } from './parse-schema-uri.pipe';
import type { SynchronizeRequest } from './domain/synchronize.request';

@Controller()
export class ScimController {
  constructor(
    @Inject(Tokens.ScimServer) private readonly scimService: ScimService,
    @Inject(Tokens.ScimClient) private readonly scimClient: ScimClient,
  ) {}

  //
  // Synchronization
  //

  @Post('Synchronize')
  async synchronize(@Body() body: SynchronizeRequest) {
    try {
      await syncResources({
        syncFrom: this.scimClient,
        syncTo: this.scimService,
        deleteOrphanedResources: body.deleteOrphanedResources,
      });
    } catch (error) {
      this.handleError(error);
    }
  }

  //
  // Service Provider Configuration
  //

  @Get('ServiceProviderConfig')
  getServiceProviderConfig() {
    try {
      return this.scimService.config.serviceProvider.get();
    } catch (error) {
      this.handleError(error);
    }
  }

  //
  // Resource Types
  //

  @Get('ResourceTypes')
  getResourceTypes() {
    try {
      return this.scimService.config.resourceTypes.list();
    } catch (error) {
      this.handleError(error);
    }
  }

  @Get('ResourceTypes/:id')
  getResourceType(@Param('id', ParseSchemaUriPipe) id: SchemaUri) {
    try {
      return this.scimService.config.resourceTypes.get({ id });
    } catch (error) {
      this.handleError(error);
    }
  }

  //
  // Schemas
  //

  @Get('Schemas')
  getSchemas() {
    try {
      return this.scimService.config.schemas.list();
    } catch (error) {
      this.handleError(error);
    }
  }

  @Get('Schemas/:id')
  getSchema(@Param('id', ParseSchemaUriPipe) id: SchemaUri) {
    try {
      return this.scimService.config.schemas.get({ id });
    } catch (error) {
      this.handleError(error);
    }
  }

  //
  // Users
  //

  @Get('Users')
  async getUsers(@Query() query: QueryParametersInput) {
    try {
      const params = parseQueryParameters<User>(query, 'User');
      return await this.scimService.resources.users.list(params);
    } catch (error) {
      this.handleError(error);
    }
  }

  @Get('Users/:id')
  async getUser(@Param('id') id: string) {
    try {
      return await this.scimService.resources.users.get({ id });
    } catch (error) {
      this.handleError(error);
    }
  }

  @Post('Users')
  async createUser(@Body() user: User) {
    try {
      return await this.scimService.resources.users.create({ resource: user });
    } catch (error) {
      this.handleError(error);
    }
  }

  @Put('Users/:id')
  async updateUser(@Param('id') id: string, @Body() user: User) {
    try {
      return await this.scimService.resources.users.update({
        id,
        resource: user,
      });
    } catch (error) {
      this.handleError(error);
    }
  }

  @Patch('Users/:id')
  async patchUser(@Param('id') id: string, @Body() patch: PatchRequest<User>) {
    try {
      return await this.scimService.resources.users.patch({ id, patch });
    } catch (error) {
      this.handleError(error);
    }
  }

  @Delete('Users/:id')
  async deleteUser(@Param('id') id: string) {
    try {
      return await this.scimService.resources.users.delete({ id });
    } catch (error) {
      this.handleError(error);
    }
  }

  //
  // Groups
  //

  @Get('Groups')
  async getGroups(@Query() query: QueryParametersInput) {
    try {
      const params = parseQueryParameters<Group>(query, 'Group');
      return await this.scimService.resources.getGroupsApi().list(params);
    } catch (error) {
      this.handleError(error);
    }
  }

  @Get('Groups/:id')
  async getGroup(@Param('id') id: string) {
    try {
      return await this.scimService.resources.getGroupsApi().get({ id });
    } catch (error) {
      this.handleError(error);
    }
  }

  @Post('Groups')
  async createGroup(@Body() group: Group) {
    try {
      return await this.scimService.resources
        .getGroupsApi()
        .create({ resource: group });
    } catch (error) {
      this.handleError(error);
    }
  }

  @Put('Groups/:id')
  async updateGroup(@Param('id') id: string, @Body() group: Group) {
    try {
      return await this.scimService.resources
        .getGroupsApi()
        .update({ id, resource: group });
    } catch (error) {
      this.handleError(error);
    }
  }

  @Patch('Groups/:id')
  async patchGroup(
    @Param('id') id: string,
    @Body() patch: PatchRequest<Group>,
  ) {
    try {
      return await this.scimService.resources
        .getGroupsApi()
        .patch({ id, patch });
    } catch (error) {
      this.handleError(error);
    }
  }

  @Delete('Groups/:id')
  async deleteGroup(@Param('id') id: string) {
    try {
      return await this.scimService.resources.getGroupsApi().delete({ id });
    } catch (error) {
      this.handleError(error);
    }
  }

  //
  // Bulk
  //

  @Post('Bulk')
  async bulkOperation(@Body() bulkRequest: BulkRequest) {
    try {
      return await this.scimService.resources
        .getBulkOperationsApi()
        .execute({ bulkRequest });
    } catch (error) {
      this.handleError(error);
    }
  }

  //
  // Utilities
  //

  /**
   * Convert SCIM errors to NestJS HTTP exceptions
   */
  private handleError(error: unknown): never {
    console.error(error);
    if (error instanceof ScimError) {
      const scimError = error;
      throw new HttpException(scimError.toJSON(), scimError.statusCode);
    }
    throw error;
  }
}
