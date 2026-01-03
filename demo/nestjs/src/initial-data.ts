import { type User, type Group, type ScimService, SchemaUris } from 'tscim';

/**
 * Create the initial data for the SCIM server.
 * @param api - The SCIM service to use
 */
export async function createInitialData(api: ScimService) {
  // Create the Admin user
  const adminUser: User = {
    schemas: [SchemaUris.User],
    userName: 'admin',
    displayName: 'Admin User',
    name: {
      givenName: 'Admin',
      familyName: 'User',
      formatted: 'Admin User',
    },
    active: true,
    emails: [
      {
        value: 'admin@example.com',
        primary: true,
      },
    ],
  };

  const createdUser = await api.resources.users.create({ resource: adminUser });
  if (!createdUser.id) {
    throw new Error('Failed to create admin user: no ID returned');
  }

  // Create the Admins group with the Admin user as a member
  const adminsGroup: Group = {
    schemas: [SchemaUris.Group],
    displayName: 'Admins',
    members: [
      {
        value: createdUser.id,
      },
    ],
  };

  await api.resources.getGroupsApi().create({ resource: adminsGroup });
}
