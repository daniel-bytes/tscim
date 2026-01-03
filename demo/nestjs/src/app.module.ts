import { join } from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import Loki from 'lokijs';
import { Module } from '@nestjs/common';
import { ServeStaticModule } from '@nestjs/serve-static';
import { ScimService, ScimClient, ScimHttpClient } from 'tscim';
import { AppController } from './app.controller';
import { ScimController } from './scim.controller';
import { UserRepository } from './domain/user.repository';
import { TeamRepository } from './domain/team.repository';
import { Tokens } from './tokens';
import { GroupScimAdapter } from './scim/group.scim.adapter';
import { UserScimAdapter } from './scim/user.scim.adapter';

@Module({
  imports: [
    ServeStaticModule.forRoot({
      rootPath: join(__dirname, '..', 'public'),
    }),
  ],
  controllers: [AppController, ScimController],
  providers: [
    //
    // Database providers
    //
    {
      provide: Tokens.Loki,
      useFactory: () => new Loki('NestJS_SCIM_Demo'),
    },
    {
      provide: Tokens.Sqlite,
      useFactory: () => new DatabaseSync(':memory:'),
    },

    //
    // Domain repository services: built on top of the database providers
    //
    UserRepository,
    TeamRepository,

    //
    // SCIM server setup
    //
    UserScimAdapter,
    GroupScimAdapter,
    {
      provide: Tokens.ScimServer,
      useFactory: (
        userAdapter: UserScimAdapter,
        groupAdapter: GroupScimAdapter,
      ): ScimService =>
        new ScimService({
          userAdapter,
          groupAdapter,
          ensureSinglePrimaryValue: true,
          enableBulk: true,
          maxBulkOperations: 100,
          maxBulkPayloadSize: 1048576, // 1MB
          maxFilterResults: 200,
        }),
      inject: [UserScimAdapter, GroupScimAdapter],
    },

    //
    // SCIM client setup
    //
    {
      provide: Tokens.ScimHttpClient,
      useFactory: (): ScimHttpClient => {
        return new ScimHttpClient({
          baseUrl: 'http://localhost:3000',
        });
      },
      inject: [],
    },
    {
      provide: Tokens.ScimClient,
      useFactory: (scimHttpClient: ScimHttpClient): ScimClient => {
        return new ScimClient(scimHttpClient);
      },
      inject: [Tokens.ScimHttpClient],
    },
  ],
})
export class AppModule {}
