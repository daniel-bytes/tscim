import express from 'express';
import { param, validationResult } from 'express-validator';
import {
  type Group,
  type User,
  type PatchRequest,
  InMemoryAdapter,
  ScimService,
  parseQueryParameters,
  ScimError,
  ScimBadRequestError,
  type QueryParametersInput,
  type BulkRequest,
  type SchemaUri,
} from 'tscim';
import { createInitialData } from './initial-data.js';

const app = express();
app.use(express.json());
app.use(express.static('public'));

// Simple request logger for visibility
app.use((req, _res, next) => {
  console.log(`${req.method} ${req.path}`);
  next();
});

const validateSchemaUri = param('id')
  .isString()
  .matches(/^urn:ietf:params:scim:schemas:.+$/)
  .withMessage('Invalid schema URI');

function checkValidationResult(req: express.Request) {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    throw new ScimBadRequestError(
      errors
        .array()
        .map(error => error.msg)
        .join(', '),
      undefined,
      req.params.id
    );
  }
}

/**
 * Populates the groups field on user(s) by finding all groups that contain the user as a member.
 * This is required because the groups field is read-only and must be computed from group memberships.
 */
async function populateUserGroups(
  users: User | User[],
  scimServer: ScimService
): Promise<void> {
  // Get all groups to check memberships
  const allGroupsResult = await scimServer.resources.getGroupsApi()?.list({});
  if (!allGroupsResult || !allGroupsResult.Resources) {
    return;
  }

  const allGroups = allGroupsResult.Resources;
  const usersArray = Array.isArray(users) ? users : [users];

  for (const user of usersArray) {
    if (!user.id) continue;

    // Find all groups that contain this user as a member
    const userGroups = allGroups
      .filter(
        group =>
          group.members?.some(member => member.value === user.id) ?? false
      )
      .map(group => {
        const groupRef: { value: string; display?: string; $ref?: string } = {
          value: group.id!,
        };
        if (group.displayName) {
          groupRef.display = group.displayName;
        }
        if (group.meta?.location) {
          groupRef.$ref = group.meta.location;
        }
        return groupRef;
      });

    // Populate the groups field (using type assertion since groups is readonly in the interface)
    (user as User & { groups: typeof userGroups }).groups = userGroups;
  }
}

// ---------------------------------------------------------------------------
// SCIM Endpoints (RFC 7644 Section 3.2)
// Each handler currently returns an empty JSON object as a placeholder.
// ---------------------------------------------------------------------------

//
// Service Provider Configuration
//
app.get('/ServiceProviderConfig', async (_req, res, next) => {
  try {
    const result = await scimServer.config.serviceProvider.get();
    res.json(result);
  } catch (error) {
    next(error);
  }
});

//
// Resource Types
//
app.get('/ResourceTypes', async (_req, res, next) => {
  try {
    const result = await scimServer.config.resourceTypes.list();
    res.json(result);
  } catch (error) {
    next(error);
  }
});
app.get('/ResourceTypes/:id', validateSchemaUri, async (req, res, next) => {
  try {
    checkValidationResult(req);
    const result = await scimServer.config.resourceTypes.get({
      id: req.params.id as SchemaUri,
    });
    res.json(result);
  } catch (error) {
    next(error);
  }
});

//
// Schemas
//
app.get('/Schemas', async (_req, res, next) => {
  try {
    const result = await scimServer.config.schemas.list();
    res.json(result);
  } catch (error) {
    next(error);
  }
});
app.get('/Schemas/:id', validateSchemaUri, async (req, res, next) => {
  try {
    checkValidationResult(req);
    const result = await scimServer.config.schemas.get({
      id: req.params.id as SchemaUri,
    });
    res.json(result);
  } catch (error) {
    next(error);
  }
});

//
// Users
//
app.get('/Users', async (req, res, next) => {
  try {
    const result = await scimServer.resources.users.list(
      // TODO: how can we fix this to be simple by not require the cast?
      parseQueryParameters<User>(
        req.query as unknown as QueryParametersInput,
        'User'
      )
    );

    // Populate groups field for all users
    if (result.Resources) {
      await populateUserGroups(result.Resources, scimServer);
    }

    res.json(result);
  } catch (error) {
    next(error);
  }
});
app.get('/Users/:id', async (req, res, next) => {
  try {
    const result = await scimServer.resources.users.get({ id: req.params.id });

    // Populate groups field for the user
    await populateUserGroups(result, scimServer);

    res.json(result);
  } catch (error) {
    next(error);
  }
});
app.post('/Users', async (req, res, next) => {
  try {
    const result = await scimServer.resources.users.create({
      resource: req.body as User,
    });

    // Populate groups field for the newly created user
    await populateUserGroups(result, scimServer);

    res.json(result);
  } catch (error) {
    next(error);
  }
});
app.put('/Users/:id', async (req, res, next) => {
  try {
    const result = await scimServer.resources.users.update({
      id: req.params.id,
      resource: req.body as User,
    });

    // Populate groups field for the updated user
    await populateUserGroups(result, scimServer);

    res.json(result);
  } catch (error) {
    next(error);
  }
});
app.patch('/Users/:id', async (req, res, next) => {
  try {
    const result = await scimServer.resources.users.patch({
      id: req.params.id,
      patch: req.body as PatchRequest<User>,
    });

    // Populate groups field for the patched user
    await populateUserGroups(result, scimServer);

    res.json(result);
  } catch (error) {
    next(error);
  }
});
app.delete('/Users/:id', async (req, res, next) => {
  try {
    const result = await scimServer.resources.users.delete({
      id: req.params.id,
    });
    res.json(result);
  } catch (error) {
    next(error);
  }
});

//
// Groups
//
app.get('/Groups', async (req, res, next) => {
  try {
    const result = await scimServer.resources
      .getGroupsApi()
      .list(
        parseQueryParameters<Group>(
          req.query as unknown as QueryParametersInput,
          'Group'
        )
      );
    res.json(result);
  } catch (error) {
    next(error);
  }
});
app.get('/Groups/:id', async (req, res, next) => {
  try {
    const result = await scimServer.resources
      .getGroupsApi()
      .get({ id: req.params.id });
    res.json(result);
  } catch (error) {
    next(error);
  }
});
app.post('/Groups', async (req, res, next) => {
  try {
    const result = await scimServer.resources.getGroupsApi().create({
      resource: req.body as Group,
    });
    res.json(result);
  } catch (error) {
    next(error);
  }
});
app.put('/Groups/:id', async (req, res, next) => {
  try {
    const result = await scimServer.resources.getGroupsApi().update({
      id: req.params.id,
      resource: req.body as Group,
    });
    res.json(result);
  } catch (error) {
    next(error);
  }
});
app.patch('/Groups/:id', async (req, res, next) => {
  try {
    const result = await scimServer.resources.getGroupsApi().patch({
      id: req.params.id,
      patch: req.body as PatchRequest<Group>,
    });
    res.json(result);
  } catch (error) {
    next(error);
  }
});
app.delete('/Groups/:id', async (req, res, next) => {
  try {
    const result = await scimServer.resources.getGroupsApi().delete({
      id: req.params.id,
    });
    res.json(result);
  } catch (error) {
    next(error);
  }
});

//
// Bulk
//
app.post('/Bulk', async (req, res, next) => {
  try {
    const result = await scimServer.resources.getBulkOperationsApi().execute({
      bulkRequest: req.body as BulkRequest,
    });
    res.json(result);
  } catch (error) {
    next(error);
  }
});

//
// Bootstrapping
//

// Global error handler for SCIM errors (must be after routes)
app.use(
  (
    error: unknown,
    _req: express.Request,
    res: express.Response,
    next: express.NextFunction
  ) => {
    if (error instanceof ScimError) {
      const scimErrorJson = error.toJSON();
      return res.status(error.statusCode).json(scimErrorJson);
    }

    // Pass through to Express default error handler for unknown errors
    next(error);
  }
);

let scimServer: ScimService;
const port = process.env.PORT ?? 3000;
app.listen(port, async () => {
  scimServer = new ScimService({
    userAdapter: new InMemoryAdapter<User>('User'),
    groupAdapter: new InMemoryAdapter<Group>('Group'),
    ensureSinglePrimaryValue: true,
    enableBulk: true,
    maxBulkOperations: 100,
    maxBulkPayloadSize: 1048576, // 1MB
    maxFilterResults: 200,
  });
  await createInitialData(scimServer);
  console.log(`Express.js SCIM demo API listening on http://localhost:${port}`);
});
