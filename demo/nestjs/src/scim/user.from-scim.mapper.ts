import { plainToInstance } from 'class-transformer';
import type { Address, User as ScimUser } from 'tscim';
import { User } from '../domain/user';

const ENTERPRISE_USER_SCHEMA =
  'urn:ietf:params:scim:schemas:extension:enterprise:2.0:User' as const;

export function fromScimUser(user: ScimUser): User {
  const enterpriseUser = user[ENTERPRISE_USER_SCHEMA] as
    | {
        manager?: { value?: string };
        employeeNumber?: string;
        costCenter?: string;
        organization?: string;
        division?: string;
        department?: string;
      }
    | undefined;
  const userWithTypedProps = user as ScimUser & {
    id?: string;
    userName?: string;
    groups?: Array<{ value?: string }>;
    emails?: Array<{ primary?: boolean; value?: string }>;
    phoneNumbers?: Array<{ primary?: boolean; value?: string }>;
    name?: { givenName?: string; familyName?: string };
    displayName?: string;
    nickName?: string;
    profileUrl?: string;
    title?: string;
    userType?: string;
    preferredLanguage?: string;
    locale?: string;
    timezone?: string;
    active?: boolean;
    meta?: { created?: string; lastModified?: string; version?: string };
    addresses?: Address[];
  };

  const result = plainToInstance(User, {
    id: userWithTypedProps.id,
    userName: userWithTypedProps.userName,
    managerId: enterpriseUser?.manager?.value,
    teamIds: userWithTypedProps.groups
      ?.map((group) => group.value)
      .filter((v): v is string => v !== undefined),
    email: {
      primary: userWithTypedProps.emails?.find((email) => email.primary)?.value,
      alternate: userWithTypedProps.emails?.find((email) => !email.primary)
        ?.value,
    },
    name: {
      firstName: userWithTypedProps.name?.givenName,
      lastName: userWithTypedProps.name?.familyName,
    },
    phone: (() => {
      const primaryPhone = userWithTypedProps.phoneNumbers?.find((phone) => phone.primary)?.value;
      const alternatePhone = userWithTypedProps.phoneNumbers?.find(
        (phone) => !phone.primary,
      )?.value;
      
      // Only create phone object if there's at least a primary phone number
      if (primaryPhone) {
        return {
          primary: primaryPhone,
          alternate: alternatePhone,
        };
      }
      return undefined;
    })(),
    address: fromScimAddress(userWithTypedProps.addresses?.[0]),
    attributes: {
      displayName: userWithTypedProps.displayName,
      nickName: userWithTypedProps.nickName,
      profileUrl: userWithTypedProps.profileUrl,
      title: userWithTypedProps.title,
      userType: userWithTypedProps.userType,
      preferredLanguage: userWithTypedProps.preferredLanguage,
      locale: userWithTypedProps.locale,
      timezone: userWithTypedProps.timezone,
      active: userWithTypedProps.active,
    },
    createdAt: userWithTypedProps.meta?.created
      ? new Date(userWithTypedProps.meta.created)
      : undefined,
    updatedAt: userWithTypedProps.meta?.lastModified
      ? new Date(userWithTypedProps.meta.lastModified)
      : undefined,
    version: userWithTypedProps.meta?.version,
  });

  if (enterpriseUser?.employeeNumber) {
    result.attributes = result.attributes || {};
    result.attributes.employeeNumber = enterpriseUser.employeeNumber;
  }
  if (enterpriseUser?.costCenter) {
    result.attributes = result.attributes || {};
    result.attributes.costCenter = enterpriseUser.costCenter;
  }
  if (enterpriseUser?.organization) {
    result.attributes = result.attributes || {};
    result.attributes.organization = enterpriseUser.organization;
  }
  if (enterpriseUser?.division) {
    result.attributes = result.attributes || {};
    result.attributes.division = enterpriseUser.division;
  }
  if (enterpriseUser?.department) {
    result.attributes = result.attributes || {};
    result.attributes.department = enterpriseUser.department;
  }
  return result;
}

function fromScimAddress(
  address: Address | undefined,
): User['address'] | undefined {
  if (!address) {
    return undefined;
  }
  const typedAddress = address;
  if (
    typedAddress.streetAddress &&
    typedAddress.locality &&
    typedAddress.region &&
    typedAddress.postalCode &&
    typedAddress.country
  ) {
    const streetParts = typedAddress.streetAddress.split('\n');
    const street2 = streetParts.length > 1 ? streetParts.pop() : undefined;
    const street = streetParts.join('\n');

    return {
      street,
      street2,
      city: typedAddress.locality,
      state: typedAddress.region,
      postalCode: typedAddress.postalCode,
      country: typedAddress.country,
    };
  }
  return undefined;
}
