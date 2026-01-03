import { Entity } from './entity';

export enum TeamRole {
  Maintainer = 'maintainer',
  Collaborator = 'collaborator',
  Viewer = 'viewer',
  Guest = 'guest',
}

export class TeamMember {
  userId: string;
  role: TeamRole;
}

export class Team extends Entity {
  name: string;
  description?: string;
  members: TeamMember[] = [];
}
