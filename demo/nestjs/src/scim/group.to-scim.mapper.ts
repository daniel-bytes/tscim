import type { Group } from 'tscim';
import { SchemaUris } from 'tscim';
import type { Team } from '../domain/team';

export function toScimGroup(team: Team): Group {
  const schemaUris = SchemaUris as { Group: string };
  return {
    schemas: [schemaUris.Group],
    id: team.id,
    displayName: team.name,
    members: team.members.map((member) => ({
      value: member.userId,
      type: member.role,
    })),
    meta: {
      created: team.createdAt?.toISOString(),
      lastModified: team.updatedAt?.toISOString(),
      version: team.version,
    },
  };
}
