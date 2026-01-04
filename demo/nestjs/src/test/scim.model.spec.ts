import fc from 'fast-check';
import { Test } from '@nestjs/testing';
import { ScimService } from '../../../../src/app/server/scim.service';
import { syncResources } from '../../../../src/app/utils/scim.sync.utils';
import { userArb } from '@test/scim/arbitraries';
import { AppModule } from '../app.module';
import { INestApplication } from '@nestjs/common';
import { Tokens } from '../tokens';

//
// SCIM Model E2E Tests
//
// Even though this is just a demo application, its a good place to show
// how we can use fast-check model testing to ensure our SCIM adapters are
// working as expected.
//
describe('SCIM', () => {
  let app: INestApplication;
  let dummyScimService: ScimService;
  let realScimService: ScimService;

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleRef.createNestApplication();
    await app.init();

    dummyScimService = moduleRef.get<ScimService>(Tokens.TestScimService);
    realScimService = moduleRef.get<ScimService>(Tokens.ScimService);
  });

  it(`Test`, () => {
    fc.assert(
      fc.asyncProperty(userArb, async (user) => {
        await realScimService.resources.users.create({ resource: user });
        await syncResources({
          syncFrom: realScimService,
          syncTo: dummyScimService,
        });

        const result = await dummyScimService.resources.users.get({
          id: user.id!,
        });
        expect(result).toEqual(user);
      }),
    );
  });

  afterAll(async () => {
    await app.close();
  });
});
