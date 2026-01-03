import { type User, type Group, type ScimApi, SchemaUris } from 'tscim';
import characterData from './character-data.json' with { type: 'json' };

interface CharacterData {
  givenName: string;
  familyName: string;
  title: string;
  email: string;
  userName: string;
  division: string;
  department: string;
  team?: CharacterData[];
}

interface OrgStructure {
  ceo: CharacterData;
  cfo: CharacterData & { team?: CharacterData[] };
  cto: CharacterData & { team?: CharacterData[] };
  coo: CharacterData & { team?: CharacterData[] };
}

// Flatten the hierarchy and collect all characters
function collectCharacters(
  data: CharacterData,
  managerUserName: string | null = null,
  result: Array<{ data: CharacterData; managerUserName: string | null }> = []
): Array<{ data: CharacterData; managerUserName: string | null }> {
  result.push({ data, managerUserName });
  if (data.team) {
    for (const teamMember of data.team) {
      collectCharacters(teamMember, data.userName, result);
    }
  }
  return result;
}

async function createUser(
  api: ScimApi,
  charData: CharacterData,
  managerId: string | undefined
): Promise<string> {
  const user: User = {
    schemas: [SchemaUris.User, SchemaUris.EnterpriseUser],
    userName: charData.userName,
    name: {
      givenName: charData.givenName,
      familyName: charData.familyName,
      formatted: `${charData.givenName} ${charData.familyName}`,
    },
    displayName: `${charData.givenName} ${charData.familyName}`,
    title: charData.title,
    active: true,
    emails: [
      {
        value: charData.email,
        primary: true,
      },
    ],
    [SchemaUris.EnterpriseUser]: {
      division: charData.division,
      department: charData.department,
      ...(managerId && {
        manager: {
          value: managerId,
        },
      }),
    },
  };

  const createdUser = await api.resources.users.create({ resource: user });
  if (!createdUser.id) {
    throw new Error(
      `Failed to create user ${charData.userName}: no ID returned`
    );
  }
  return createdUser.id;
}

/**
 * Create the initial data for the SCIM server.
 * @param api - The SCIM API to use
 */
export async function createInitialData(api: ScimApi) {
  const orgData = characterData as OrgStructure;

  // Track user IDs by userName for manager references
  const userIdMap = new Map<string, string>();

  // Collect all characters in hierarchical order (parents before children)
  const characters = [
    { data: orgData.ceo, managerUserName: null },
    ...collectCharacters(orgData.cfo, orgData.ceo.userName),
    ...collectCharacters(orgData.cto, orgData.ceo.userName),
    ...collectCharacters(orgData.coo, orgData.ceo.userName),
  ];

  // Create all users (in hierarchical order so managers exist before their reports)
  for (const { data, managerUserName } of characters) {
    const managerId = managerUserName
      ? userIdMap.get(managerUserName)
      : undefined;
    const userId = await createUser(api, data, managerId);
    userIdMap.set(data.userName, userId);
  }

  // Helper function to collect all user IDs under a character (including the character themselves)
  function collectUserIds(charData: CharacterData): string[] {
    const result: string[] = [];
    const userId = userIdMap.get(charData.userName);
    if (userId) {
      result.push(userId);
    }
    if (charData.team) {
      for (const teamMember of charData.team) {
        result.push(...collectUserIds(teamMember));
      }
    }
    return result;
  }

  // Create groups for organizational structure
  const groups: Array<{ displayName: string; members: string[] }> = [
    {
      displayName: 'Executive Team',
      members: [userIdMap.get(orgData.ceo.userName)!],
    },
    {
      displayName: 'Finance Division',
      members: collectUserIds(orgData.cfo),
    },
    {
      displayName: 'Engineering Division',
      members: collectUserIds(orgData.cto),
    },
    {
      displayName: 'Operations Division',
      members: collectUserIds(orgData.coo),
    },
  ];

  // Create the groups
  for (const groupData of groups) {
    const group: Group = {
      schemas: [SchemaUris.Group],
      displayName: groupData.displayName,
      members: groupData.members.map(userId => ({
        value: userId,
      })),
    };

    await api.resources.getGroupsApi().create({ resource: group });
  }
}
