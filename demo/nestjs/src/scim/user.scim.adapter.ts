import {
  ClassSerializerInterceptor,
  Injectable,
  UseInterceptors,
} from '@nestjs/common';
import { UserRepository } from '../domain/user.repository';
import {
  ResourceAdapter,
  SchemaUris,
  ScimNotFoundError,
  selectAttributes,
} from 'tscim';
import type {
  AttributeParameters,
  Filter,
  PaginationParameters,
  AdapterBooleanResult,
  AdapterQueryResult,
  AdapterSingleResult,
  ResourceId,
  SortingParameters,
  User,
} from 'tscim';
import { toScimUser } from './user.to-scim.mapper';
import { fromScimUser } from './user.from-scim.mapper';

/**
 * SCIM adapter for User resources, using the internal User domain model.
 *
 * This adapter is used to adapt the User resource to the format the SCIM protocol expects.
 * It is used by the SCIM service to handle User resources.
 */
@UseInterceptors(ClassSerializerInterceptor)
@Injectable()
export class UserScimAdapter extends ResourceAdapter<User> {
  constructor(private readonly userRepository: UserRepository) {
    super();
  }

  public async getResource(args: {
    id: ResourceId;
    attributes?: AttributeParameters<User> | undefined;
  }): Promise<AdapterSingleResult<User>> {
    await Promise.resolve();
    const user = this.userRepository.findById(args.id);
    if (!user) {
      throw new ScimNotFoundError(`User not found`, 'User', args.id);
    }

    const scimUser = toScimUser(user);
    const attributes = args.attributes;
    return {
      id: args.id,
      result: selectAttributes<User>(scimUser, attributes),
    };
  }

  public async queryResources(args: {
    filter?: Filter;
    attributes?: AttributeParameters<User> | undefined;
    sorting?: SortingParameters;
    pagination?: PaginationParameters;
  }): Promise<AdapterQueryResult<User>> {
    await Promise.resolve();
    // TODO: Apply server-side filtering
    const users = this.userRepository.findAll();
    const schemaUris = SchemaUris as { ListResponse: string };
    return {
      result: {
        schemas: [schemaUris.ListResponse],
        totalResults: users.length,
        Resources: users.map((user) => toScimUser(user)),
      },
      remainingFilters: args,
    };
  }

  public async createResource(args: {
    resource: User;
  }): Promise<AdapterSingleResult<User>> {
    await Promise.resolve();
    const user = fromScimUser(args.resource);
    const result = this.userRepository.create(user);
    const scimUser = toScimUser(result);
    return {
      id: result.id,
      result: scimUser,
    };
  }

  public async updateResource(args: {
    id: ResourceId;
    resource: User;
  }): Promise<AdapterSingleResult<User>> {
    await Promise.resolve();
    const user = fromScimUser(args.resource);
    const result = this.userRepository.update(args.id, user);
    if (!result) {
      throw new ScimNotFoundError(`User not found`, 'User', args.id);
    }
    const scimUser = toScimUser(result);
    return {
      id: args.id,
      result: scimUser,
    };
  }

  public async deleteResource(args: {
    id: ResourceId;
  }): Promise<AdapterBooleanResult<User>> {
    await Promise.resolve();
    const deleted = this.userRepository.delete(args.id);
    return {
      id: args.id,
      result: deleted,
    };
  }
}
