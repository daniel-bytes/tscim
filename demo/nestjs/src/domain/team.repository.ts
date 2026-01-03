import type Loki from 'lokijs';
import { Injectable } from '@nestjs/common';
import type { Team, TeamMember } from './team';
import { Tokens } from '../tokens';
import { Inject } from '@nestjs/common';

export type CreateTeam = Omit<
  Team,
  'id' | 'createdAt' | 'updatedAt' | 'version'
>;
export type UpdateTeam = Partial<Omit<Team, 'id' | 'createdAt' | 'version'>>;

/**
 * Repository for managing teams.
 * Teams are stored in a Loki database.
 */
@Injectable()
export class TeamRepository {
  private readonly collection: Loki.Collection<Team>;

  constructor(@Inject(Tokens.Loki) private readonly db: Loki) {
    this.collection = this.db.addCollection<Team>('teams');
  }

  /**
   * Create a new team
   */
  create(team: CreateTeam): Team {
    const now = new Date();
    const newTeam: Team = {
      ...team,
      id: this.generateId(),
      createdAt: now,
      version: '1',
      members: team.members || [],
    };
    const inserted = this.collection.insert(newTeam);
    if (!inserted) {
      throw new Error('Failed to create team');
    }
    return inserted;
  }

  /**
   * Find a team by ID
   */
  findById(id: string): Team | null {
    return this.collection.findOne({ id }) || null;
  }

  /**
   * Find all teams
   */
  findAll(): Team[] {
    return this.collection.find();
  }

  /**
   * Find teams by name (case-insensitive partial match)
   */
  findByName(name: string): Team[] {
    const regex = new RegExp(name, 'i');
    return this.collection.find({ name: { $regex: regex } });
  }

  /**
   * Find teams by member userId
   */
  findByMember(userId: string): Team[] {
    return this.collection.where((team) =>
      (team.members || []).some((member) => member.userId === userId),
    );
  }

  /**
   * Update an existing team
   */
  update(id: string, updates: UpdateTeam): Team | null {
    const team = this.collection.findOne({ id });
    if (!team) {
      return null;
    }

    const updatedTeam: Team = {
      ...team,
      ...updates,
      id: team.id, // Ensure ID cannot be changed
      createdAt: team.createdAt, // Ensure createdAt cannot be changed
      updatedAt: new Date(),
      version: String(parseInt(team.version || '0', 10) + 1), // Increment version
      members:
        updates.members !== undefined ? updates.members : team.members || [],
    };

    this.collection.update(updatedTeam);
    return updatedTeam;
  }

  /**
   * Add a member to a team
   */
  addMember(teamId: string, member: TeamMember): Team | null {
    const team = this.findById(teamId);
    if (!team) {
      return null;
    }

    // Ensure members is always an array
    const members = team.members || [];

    // Check if member already exists
    const existingMemberIndex = members.findIndex(
      (m) => m.userId === member.userId,
    );
    if (existingMemberIndex >= 0) {
      // Update existing member's role
      members[existingMemberIndex].role = member.role;
    } else {
      // Add new member
      members.push(member);
    }

    return this.update(teamId, { members });
  }

  /**
   * Remove a member from a team
   */
  removeMember(teamId: string, userId: string): Team | null {
    const team = this.findById(teamId);
    if (!team) {
      return null;
    }

    // Ensure members is always an array
    const members = team.members || [];
    const updatedMembers = members.filter((m) => m.userId !== userId);
    return this.update(teamId, { members: updatedMembers });
  }

  /**
   * Delete a team by ID
   */
  delete(id: string): boolean {
    const team = this.collection.findOne({ id });
    if (!team) {
      return false;
    }
    this.collection.remove(team);
    return true;
  }

  /**
   * Generate a unique ID for new teams
   */
  private generateId(): string {
    return `team_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }
}
