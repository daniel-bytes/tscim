import { Injectable } from '@nestjs/common';
import { TeamRepository } from '../domain/team.repository';
import { ResourceAdapter, ScimNotFoundError, SchemaUris } from 'tscim';
import type {
  AttributeParameters,
  Filter,
  PaginationParameters,
  AdapterBooleanResult,
  AdapterQueryResult,
  AdapterSingleResult,
  ResourceId,
  SortingParameters,
  Group,
} from 'tscim';
import { toScimGroup } from './group.to-scim.mapper';
import { fromScimGroup } from './group.from-scim.mapper';

/**
 * SCIM adapter for Group resources, using the internal Team domain model.
 *
 * This adapter is used to adapt the Group resource to the format the SCIM protocol expects.
 * It is used by the SCIM service to handle Group resources.
 */
@Injectable()
export class GroupScimAdapter extends ResourceAdapter<Group> {
  constructor(private readonly teamRepository: TeamRepository) {
    super();
  }

  public async getResource(args: {
    id: ResourceId;
    attributes?: AttributeParameters<Group> | undefined;
  }): Promise<AdapterSingleResult<Group>> {
    await Promise.resolve();
    const team = this.teamRepository.findById(args.id);
    if (!team) {
      throw new ScimNotFoundError(`Group not found`, 'Group', args.id);
    }
    const group = toScimGroup(team);
    return {
      id: args.id,
      result: group,
    };
  }

  public async queryResources(args: {
    filter?: Filter;
    attributes?: AttributeParameters<Group> | undefined;
    sorting?: SortingParameters;
    pagination?: PaginationParameters;
  }): Promise<AdapterQueryResult<Group>> {
    await Promise.resolve();
    const teams = this.teamRepository.findAll();
    const schemaUris = SchemaUris as { ListResponse: string };
    return {
      result: {
        schemas: [schemaUris.ListResponse],
        totalResults: teams.length,
        Resources: teams.map(toScimGroup),
      },
      remainingFilters: args,
    };
  }

  public async createResource(args: {
    resource: Group;
  }): Promise<AdapterSingleResult<Group>> {
    await Promise.resolve();
    const team = fromScimGroup(args.resource);
    const { id, createdAt, updatedAt, version, ...createTeam } = team;
    const result = this.teamRepository.create(createTeam);
    const scimGroup = toScimGroup(result);
    return {
      id: result.id,
      result: scimGroup,
    };
  }

  public async updateResource(args: {
    id: ResourceId;
    resource: Group;
  }): Promise<AdapterSingleResult<Group>> {
    await Promise.resolve();
    const team = fromScimGroup(args.resource);
    const { id, createdAt, version, ...updateTeam } = team;
    const result = this.teamRepository.update(args.id, updateTeam);
    if (!result) {
      throw new ScimNotFoundError(`Group not found`, 'Group', args.id);
    }
    const scimGroup = toScimGroup(result);
    return {
      id: args.id,
      result: scimGroup,
    };
  }

  public async deleteResource(args: {
    id: ResourceId;
  }): Promise<AdapterBooleanResult<Group>> {
    await Promise.resolve();
    const deleted = this.teamRepository.delete(args.id);
    return {
      id: args.id,
      result: deleted,
    };
  }
}
