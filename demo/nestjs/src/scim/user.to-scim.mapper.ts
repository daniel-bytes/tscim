import type {
  Address,
  Email,
  Manager,
  PhoneNumber,
  User as ScimUser,
} from 'tscim';
import { SchemaUris } from 'tscim';
import type { User } from '../domain/user';

export function toScimUser(user: User): ScimUser {
  const schemaUris = SchemaUris as {
    User: string;
    EnterpriseUser: string;
  };
  return {
    schemas: [schemaUris.User, schemaUris.EnterpriseUser],
    id: user.id,
    userName: user.userName,
    name: {
      formatted: user.fullName,
      familyName: user.name.lastName,
      givenName: user.name.firstName,
    },
    displayName:
      (user.attributes?.displayName as string | undefined) ?? user.fullName,
    nickName: user.attributes?.nickName as string | undefined,
    profileUrl: user.attributes?.profileUrl as string | undefined,
    groups: user.teamIds?.map((teamId) => ({
      value: teamId,
    })),
    emails: toScimEmails(user),
    phoneNumbers: toScimPhoneNumbers(user),
    addresses: toScimAddresses(user),
    [schemaUris.EnterpriseUser]: {
      manager: toScimManager(user),
      employeeNumber: user.attributes?.employeeNumber as string | undefined,
      costCenter: user.attributes?.costCenter as string | undefined,
      organization: user.attributes?.organization as string | undefined,
      division: user.attributes?.division as string | undefined,
      department: user.attributes?.department as string | undefined,
    },
    title: user.attributes?.title as string | undefined,
    userType: user.attributes?.userType as string | undefined,
    preferredLanguage: user.attributes?.preferredLanguage as string | undefined,
    locale: user.attributes?.locale as string | undefined,
    timezone: user.attributes?.timezone as string | undefined,
    active: user.attributes?.active as boolean | undefined,
    meta: {
      created: user.createdAt?.toISOString(),
      lastModified: user.updatedAt?.toISOString(),
      version: user.version,
    },
  };
}

function toScimEmails(user: User): Email[] {
  const emails: Email[] = [
    {
      value: user.email.primary,
      type: 'primary',
      primary: true,
    },
  ];
  if (user.email.alternate) {
    emails.push({
      value: user.email.alternate,
      type: 'alternate',
      primary: false,
    });
  }
  return emails;
}

function toScimPhoneNumbers(user: User): PhoneNumber[] | undefined {
  if (!user.phone || !user.phone.primary) {
    return undefined;
  }
  const phoneNumbers: PhoneNumber[] = [
    {
      value: user.phone.primary,
      type: 'primary',
      primary: true,
    },
  ];
  if (user.phone.alternate) {
    phoneNumbers.push({
      value: user.phone.alternate,
      type: 'alternate',
      primary: false,
    });
  }
  return phoneNumbers;
}

function toScimAddresses(user: User): Address[] | undefined {
  if (!user.address) {
    return undefined;
  }
  const address: Address = {
    streetAddress: user.address.street,
    locality: user.address.city,
    region: user.address.state,
    postalCode: user.address.postalCode,
    country: user.address.country,
  };

  if (user.address.street2) {
    address.streetAddress = `${address.streetAddress}\n${user.address.street2}`;
  }

  return [address];
}

function toScimManager(user: User): Manager | undefined {
  if (!user.managerId) {
    return undefined;
  }
  const manager: Manager = {
    value: user.managerId,
  };
  return manager;
}
