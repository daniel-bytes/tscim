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
  HttpStatus,
} from '@nestjs/common';
import {
  UserRepository,
  type CreateUser,
  type UpdateUser,
} from './domain/user.repository';
import {
  TeamRepository,
  type CreateTeam,
  type UpdateTeam,
} from './domain/team.repository';
import { TeamRole, type TeamMember } from './domain/team';

@Controller()
export class AppController {
  constructor(
    private readonly userRepository: UserRepository,
    private readonly teamRepository: TeamRepository,
  ) {}

  // User endpoints
  @Get('users')
  getUsers(
    @Query('page') page?: string,
    @Query('limit') limit?: string,
    @Query('search') search?: string,
  ) {
    const pageNum = parseInt(page || '1', 10);
    const limitNum = parseInt(limit || '12', 10);
    let users = this.userRepository.findAll();

    // Simple search by userName, firstName, lastName, or email
    if (search) {
      const searchLower = search.toLowerCase();
      users = users.filter(
        (u) =>
          u.userName.toLowerCase().includes(searchLower) ||
          u.name.firstName.toLowerCase().includes(searchLower) ||
          u.name.lastName?.toLowerCase()?.includes(searchLower) ||
          u.email.primary.toLowerCase().includes(searchLower) ||
          u.email.alternate?.toLowerCase().includes(searchLower),
      );
    }

    const total = users.length;
    const startIndex = (pageNum - 1) * limitNum;
    const endIndex = startIndex + limitNum;
    const paginatedUsers = users.slice(startIndex, endIndex);

    return {
      users: paginatedUsers,
      total,
      page: pageNum,
      limit: limitNum,
      totalPages: Math.ceil(total / limitNum),
    };
  }

  @Get('users/:id')
  getUser(@Param('id') id: string) {
    const user = this.userRepository.findById(id);
    if (!user) {
      throw new HttpException('User not found', HttpStatus.NOT_FOUND);
    }
    return user;
  }

  @Post('users')
  createUser(@Body() createUserDto: CreateUser) {
    try {
      return this.userRepository.create(createUserDto);
    } catch (error) {
      const message =
        error instanceof Error ? error.message : 'Failed to create user';
      throw new HttpException(message, HttpStatus.BAD_REQUEST);
    }
  }

  @Put('users/:id')
  updateUser(@Param('id') id: string, @Body() updateUserDto: UpdateUser) {
    const user = this.userRepository.update(id, updateUserDto);
    if (!user) {
      throw new HttpException('User not found', HttpStatus.NOT_FOUND);
    }
    return user;
  }

  @Delete('users/:id')
  deleteUser(@Param('id') id: string) {
    const deleted = this.userRepository.delete(id);
    if (!deleted) {
      throw new HttpException('User not found', HttpStatus.NOT_FOUND);
    }
    return { success: true };
  }

  // Team endpoints
  @Get('teams')
  getTeams(
    @Query('page') page?: string,
    @Query('limit') limit?: string,
    @Query('search') search?: string,
  ) {
    const pageNum = parseInt(page || '1', 10);
    const limitNum = parseInt(limit || '12', 10);
    let teams = this.teamRepository.findAll();

    // Simple search by name or description
    if (search) {
      const searchLower = search.toLowerCase();
      teams = teams.filter(
        (t) =>
          t.name.toLowerCase().includes(searchLower) ||
          t.description?.toLowerCase().includes(searchLower),
      );
    }

    const total = teams.length;
    const startIndex = (pageNum - 1) * limitNum;
    const endIndex = startIndex + limitNum;
    const paginatedTeams = teams.slice(startIndex, endIndex);

    return {
      teams: paginatedTeams,
      total,
      page: pageNum,
      limit: limitNum,
      totalPages: Math.ceil(total / limitNum),
    };
  }

  @Get('teams/:id')
  getTeam(@Param('id') id: string) {
    const team = this.teamRepository.findById(id);
    if (!team) {
      throw new HttpException('Team not found', HttpStatus.NOT_FOUND);
    }
    return team;
  }

  @Post('teams')
  createTeam(@Body() createTeamDto: CreateTeam) {
    try {
      return this.teamRepository.create(createTeamDto);
    } catch (error) {
      const message =
        error instanceof Error ? error.message : 'Failed to create team';
      throw new HttpException(message, HttpStatus.BAD_REQUEST);
    }
  }

  @Put('teams/:id')
  updateTeam(@Param('id') id: string, @Body() updateTeamDto: UpdateTeam) {
    const team = this.teamRepository.update(id, updateTeamDto);
    if (!team) {
      throw new HttpException('Team not found', HttpStatus.NOT_FOUND);
    }
    return team;
  }

  @Delete('teams/:id')
  deleteTeam(@Param('id') id: string) {
    const deleted = this.teamRepository.delete(id);
    if (!deleted) {
      throw new HttpException('Team not found', HttpStatus.NOT_FOUND);
    }
    return { success: true };
  }

  @Patch('teams/:id/members')
  updateTeamMembers(
    @Param('id') id: string,
    @Body() body: { action: 'add' | 'remove'; userId: string; role?: TeamRole },
  ) {
    const team = this.teamRepository.findById(id);
    if (!team) {
      throw new HttpException('Team not found', HttpStatus.NOT_FOUND);
    }

    if (body.action === 'add') {
      const member: TeamMember = {
        userId: body.userId,
        role: body.role || TeamRole.Viewer,
      };
      return this.teamRepository.addMember(id, member);
    } else if (body.action === 'remove') {
      return this.teamRepository.removeMember(id, body.userId);
    } else {
      throw new HttpException('Invalid action', HttpStatus.BAD_REQUEST);
    }
  }
}
