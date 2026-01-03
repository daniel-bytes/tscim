import { plainToInstance } from 'class-transformer';
import type { Group as ScimGroup } from 'tscim';
import { Team, TeamRole } from '../domain/team';

export function fromScimGroup(group: ScimGroup): Team {
  const typedGroup = group as ScimGroup & {
    id?: string;
    displayName?: string;
    members?: Array<{ value?: string; type?: string }>;
    meta?: { created?: string; lastModified?: string; version?: string };
  };
  return plainToInstance(Team, {
    id: typedGroup.id,
    name: typedGroup.displayName,
    members: typedGroup.members?.map((member) => ({
      userId: member.value ?? '',
      role: (member.type as TeamRole) ?? TeamRole.Viewer,
    })),
    createdAt: typedGroup.meta?.created
      ? new Date(typedGroup.meta.created)
      : undefined,
    updatedAt: typedGroup.meta?.lastModified
      ? new Date(typedGroup.meta.lastModified)
      : undefined,
    version: typedGroup.meta?.version,
  });
}
