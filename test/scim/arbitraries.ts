import fc from 'fast-check';
import type { PatchRequest, PatchOperation } from '../../src/scim/patch.dsl.js';
import type {
  User,
  Email,
  Address,
  PhoneNumber,
  InstantMessage,
  Photo,
  Entitlement,
  Role,
  X509Certificate,
  EnterpriseUser,
} from '../../src/scim/model.js';
import { SchemaUris } from '../../src/scim/uris.js';
import type {
  Filter,
  AttributeExpressionPath,
  AttributeExpression,
  ValueFilter,
  ValuePath,
  LogicalExpression,
  NotExpression,
  CompValue,
} from '../../src/scim/filter.dsl.js';
import {
  ComparisonOperator,
  LogicalOperator,
} from '../../src/scim/filter.dsl.js';

// Basic arbitraries for generating test data
export const userNameArb = fc.string({ minLength: 1, maxLength: 50 });
export const emailArb = fc
  .string({ minLength: 1, maxLength: 100 })
  .map(s => `${s}@example.com`);
export const displayNameArb = fc.string({ minLength: 0, maxLength: 100 });
export const booleanArb = fc.boolean();
export const stringArb = fc.string({ minLength: 0, maxLength: 200 });
export const urlArb = fc
  .string({ minLength: 1, maxLength: 50 })
  .map(s => `https://example.com/${s}`);

// Complex type arbitraries
export const emailItemArb = fc.record({
  value: emailArb,
  type: fc.option(fc.constantFrom('work', 'home', 'other')),
  primary: fc.option(booleanArb),
  display: fc.option(stringArb),
}) as fc.Arbitrary<Email>;

export const addressArb = fc.record({
  formatted: fc.option(stringArb),
  streetAddress: fc.option(stringArb),
  locality: fc.option(stringArb),
  region: fc.option(stringArb),
  postalCode: fc.option(stringArb),
  country: fc.option(stringArb),
  type: fc.option(fc.constantFrom('work', 'home', 'other')),
  primary: fc.option(booleanArb),
}) as fc.Arbitrary<Address>;

export const phoneNumberArb = fc.record({
  value: fc.string({ minLength: 1, maxLength: 20 }),
  type: fc.option(
    fc.constantFrom('work', 'home', 'mobile', 'fax', 'pager', 'other')
  ),
  primary: fc.option(booleanArb),
}) as fc.Arbitrary<PhoneNumber>;

export const instantMessageArb = fc.record({
  value: fc.string({ minLength: 1, maxLength: 100 }),
  type: fc.option(
    fc.constantFrom(
      'aim',
      'gtalk',
      'icq',
      'xmpp',
      'msn',
      'skype',
      'qq',
      'yahoo',
      'other'
    )
  ),
  primary: fc.option(booleanArb),
}) as fc.Arbitrary<InstantMessage>;

export const photoArb = fc.record({
  value: urlArb,
  type: fc.option(fc.constantFrom('photo', 'thumbnail')),
  primary: fc.option(booleanArb),
}) as fc.Arbitrary<Photo>;

export const entitlementArb = fc.record({
  value: stringArb,
  type: fc.option(stringArb),
  primary: fc.option(booleanArb),
  display: fc.option(stringArb),
}) as fc.Arbitrary<Entitlement>;

export const roleArb = fc.record({
  value: stringArb,
  type: fc.option(stringArb),
  primary: fc.option(booleanArb),
  display: fc.option(stringArb),
}) as fc.Arbitrary<Role>;

export const x509CertificateArb = fc.record({
  value: fc.string({ minLength: 1, maxLength: 500 }),
  type: fc.option(stringArb),
  primary: fc.option(booleanArb),
}) as fc.Arbitrary<X509Certificate>;

export const enterpriseUserArb = fc.record({
  employeeNumber: fc.option(stringArb),
  costCenter: fc.option(stringArb),
  organization: fc.option(stringArb),
  division: fc.option(stringArb),
  department: fc.option(stringArb),
  manager: fc.option(
    fc.record({
      value: fc.option(stringArb),
    })
  ),
}) as fc.Arbitrary<EnterpriseUser>;

// Generate a comprehensive User resource with all attributes
export const userArb: fc.Arbitrary<User> = fc.record({
  schemas: fc.constant([SchemaUris.User]),
  userName: userNameArb,
  name: fc.option(
    fc.record({
      formatted: fc.option(stringArb),
      familyName: fc.option(stringArb),
      givenName: fc.option(stringArb),
      middleName: fc.option(stringArb),
      honorificPrefix: fc.option(stringArb),
      honorificSuffix: fc.option(stringArb),
    })
  ),
  displayName: fc.option(displayNameArb),
  nickName: fc.option(stringArb),
  profileUrl: fc.option(urlArb),
  title: fc.option(stringArb),
  userType: fc.option(stringArb),
  preferredLanguage: fc.option(
    fc.constantFrom('en', 'es', 'fr', 'de', 'ja', 'zh', 'ko')
  ),
  locale: fc.option(
    fc.constantFrom('en-US', 'en-GB', 'es-ES', 'fr-FR', 'de-DE')
  ),
  timezone: fc.option(
    fc.constantFrom(
      'America/New_York',
      'America/Los_Angeles',
      'Europe/London',
      'Asia/Tokyo'
    )
  ),
  active: fc.option(booleanArb),
  password: fc.option(stringArb),
  emails: fc.option(fc.array(emailItemArb, { maxLength: 5 })),
  addresses: fc.option(fc.array(addressArb, { maxLength: 5 })),
  phoneNumbers: fc.option(fc.array(phoneNumberArb, { maxLength: 5 })),
  ims: fc.option(fc.array(instantMessageArb, { maxLength: 5 })),
  photos: fc.option(fc.array(photoArb, { maxLength: 5 })),
  entitlements: fc.option(fc.array(entitlementArb, { maxLength: 5 })),
  roles: fc.option(fc.array(roleArb, { maxLength: 5 })),
  x509Certificates: fc.option(fc.array(x509CertificateArb, { maxLength: 5 })),
  [SchemaUris.EnterpriseUser]: fc.option(enterpriseUserArb),
}) as fc.Arbitrary<User>;

// Generate a valid patch operation
// Note: When path is null/undefined, value must be an object (partial resource)
export const patchOperationArb: fc.Arbitrary<PatchOperation<User>> = fc.oneof(
  // Add operation
  fc.oneof(
    // Add with path - generate type-safe values based on path
    fc.oneof(
      // userName: must be non-empty string
      fc.record({
        op: fc.constant('add' as const),
        path: fc.constant('userName' as const),
        value: userNameArb,
      }),
      // String attributes: string or null
      fc.record({
        op: fc.constant('add' as const),
        path: fc.constantFrom(
          'displayName',
          'nickName',
          'title',
          'profileUrl',
          'userType',
          'preferredLanguage',
          'locale',
          'timezone',
          'password' as const
        ),
        value: fc.oneof(stringArb, fc.constant(null)),
      }),
      // active: boolean
      fc.record({
        op: fc.constant('add' as const),
        path: fc.constant('active' as const),
        value: booleanArb,
      }),
      // name sub-attributes: string or null
      fc.record({
        op: fc.constant('add' as const),
        path: fc.constantFrom(
          'name.formatted',
          'name.familyName',
          'name.givenName',
          'name.middleName',
          'name.honorificPrefix',
          'name.honorificSuffix' as const
        ),
        value: fc.oneof(stringArb, fc.constant(null)),
      }),
      // Array attributes: add item to array - match path to correct type
      fc.oneof(
        fc.record({
          op: fc.constant('add' as const),
          path: fc.constant('emails' as const),
          value: emailItemArb,
        }),
        fc.record({
          op: fc.constant('add' as const),
          path: fc.constant('addresses' as const),
          value: addressArb,
        }),
        fc.record({
          op: fc.constant('add' as const),
          path: fc.constant('phoneNumbers' as const),
          value: phoneNumberArb,
        }),
        fc.record({
          op: fc.constant('add' as const),
          path: fc.constant('ims' as const),
          value: instantMessageArb,
        }),
        fc.record({
          op: fc.constant('add' as const),
          path: fc.constant('photos' as const),
          value: photoArb,
        }),
        fc.record({
          op: fc.constant('add' as const),
          path: fc.constant('entitlements' as const),
          value: entitlementArb,
        }),
        fc.record({
          op: fc.constant('add' as const),
          path: fc.constant('roles' as const),
          value: roleArb,
        }),
        fc.record({
          op: fc.constant('add' as const),
          path: fc.constant('x509Certificates' as const),
          value: x509CertificateArb,
        })
      )
    ),
    // Add without path (value must be an object - partial resource)
    fc
      .record({
        displayName: fc.option(stringArb),
        nickName: fc.option(stringArb),
        title: fc.option(stringArb),
        active: fc.option(booleanArb),
      })
      .map(value => ({
        op: 'add' as const,
        path: undefined,
        value,
      }))
  ),
  // Replace operation
  fc.oneof(
    // Replace with path - generate type-safe values based on path
    fc.oneof(
      // userName: must be non-empty string
      fc.record({
        op: fc.constant('replace' as const),
        path: fc.constant('userName' as const),
        value: userNameArb,
      }),
      // String attributes: string or null
      fc.record({
        op: fc.constant('replace' as const),
        path: fc.constantFrom(
          'displayName',
          'nickName',
          'title',
          'profileUrl',
          'userType',
          'preferredLanguage',
          'locale',
          'timezone',
          'password' as const
        ),
        value: fc.oneof(stringArb, fc.constant(null)),
      }),
      // active: boolean
      fc.record({
        op: fc.constant('replace' as const),
        path: fc.constant('active' as const),
        value: booleanArb,
      }),
      // name sub-attributes: string or null
      fc.record({
        op: fc.constant('replace' as const),
        path: fc.constantFrom(
          'name.formatted',
          'name.familyName',
          'name.givenName',
          'name.middleName',
          'name.honorificPrefix',
          'name.honorificSuffix' as const
        ),
        value: fc.oneof(stringArb, fc.constant(null)),
      })
    ),
    // Replace without path (value must be an object - partial resource)
    fc
      .record({
        displayName: fc.option(stringArb),
        nickName: fc.option(stringArb),
        title: fc.option(stringArb),
        active: fc.option(booleanArb),
      })
      .map(value => ({
        op: 'replace' as const,
        path: undefined,
        value,
      }))
  ),
  // Remove operation
  // RFC 7644 Section 3.5.2: "path" is REQUIRED for remove operations
  // Value is optional (used for matching items in multi-valued attributes)
  fc.record({
    op: fc.constant('remove' as const),
    path: fc.constantFrom(
      'displayName',
      'active',
      'nickName',
      'title',
      'profileUrl',
      'userType',
      'preferredLanguage',
      'locale',
      'timezone',
      'password',
      'name',
      'emails',
      'addresses',
      'phoneNumbers',
      'ims',
      'photos',
      'entitlements',
      'roles',
      'x509Certificates'
    ),
    value: fc.option(fc.anything()),
  })
) as fc.Arbitrary<PatchOperation<User>>;

// Generate a valid patch request
export const patchRequestArb: fc.Arbitrary<PatchRequest<User>> = fc.record({
  schemas: fc.constant([SchemaUris.PatchOp]),
  Operations: fc.array(patchOperationArb, { minLength: 1, maxLength: 10 }),
});

// ============================================================================
// Filter DSL Arbitraries
// ============================================================================

// Basic arbitraries for filter components

/**
 * Generate a valid attribute name (starts with letter, followed by letters, digits, dashes, underscores)
 * Uses a more reliable approach: always starts with a letter, then optionally adds name characters
 */
export const attrNameArb = fc
  .tuple(
    fc.constantFrom(
      ...'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ'.split('')
    ),
    fc.array(
      fc.constantFrom(
        ...'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789-_'.split(
          ''
        )
      ),
      { maxLength: 49 }
    )
  )
  .map(([first, rest]) => first + rest.join(''));

/**
 * Generate a URI string (used in attribute paths)
 * Examples: "urn:ietf:params:scim:schemas:core:2.0:User", "urn:example:org"
 * Generates valid URIs with colons as separators
 * Uses fc.stringMatching for cleaner, more maintainable code - the pattern is explicit and readable
 */
export const uriArb = fc.oneof(
  // URN-style URI (most common in SCIM)
  fc
    .tuple(
      fc.constant('urn'),
      fc.array(fc.stringMatching(/^[a-zA-Z0-9][a-zA-Z0-9._-]*$/), {
        minLength: 2,
        maxLength: 10,
      })
    )
    .map(([scheme, segments]) => `${scheme}:${segments.join(':')}`),
  // Generic URI segments
  fc
    .array(fc.stringMatching(/^[a-zA-Z0-9][a-zA-Z0-9._-]*$/), {
      minLength: 1,
      maxLength: 8,
    })
    .map(segments => segments.join(':'))
);

/**
 * Generate a sub-attribute name (same format as attrName)
 */
export const subAttrArb = attrNameArb;

/**
 * Generate an attribute path with optional URI and sub-attribute
 */
export const attributePathArb: fc.Arbitrary<AttributeExpressionPath> = fc.oneof(
  // Just attrName
  attrNameArb.map((attrName: string) => ({ attrName })),
  // attrName with subAttr
  fc
    .tuple(attrNameArb, subAttrArb)
    .map(([attrName, subAttr]: [string, string]) => ({ attrName, subAttr })),
  // URI:attrName
  fc
    .tuple(uriArb, attrNameArb)
    .map(([uri, attrName]: [string, string]) => ({ uri, attrName })),
  // URI:attrName.subAttr
  fc
    .tuple(uriArb, attrNameArb, subAttrArb)
    .map(([uri, attrName, subAttr]: [string, string, string]) => ({
      uri,
      attrName,
      subAttr,
    }))
) as fc.Arbitrary<AttributeExpressionPath>;

/**
 * Generate a comparison value (string, number, boolean, or null)
 */
export const compValueArb: fc.Arbitrary<CompValue> = fc.oneof(
  fc.string({ minLength: 0, maxLength: 200 }),
  fc.integer({ min: -1000, max: 1000 }),
  fc.float({ min: -1000, max: 1000 }),
  fc.boolean(),
  fc.constant(null)
);

/**
 * Generate a comparison operator
 */
export const comparisonOperatorArb = fc.constantFrom(
  ComparisonOperator.Eq,
  ComparisonOperator.Ne,
  ComparisonOperator.Co,
  ComparisonOperator.Sw,
  ComparisonOperator.Ew,
  ComparisonOperator.Gt,
  ComparisonOperator.Lt,
  ComparisonOperator.Ge,
  ComparisonOperator.Le
);

/**
 * Generate a logical operator
 */
export const logicalOperatorArb = fc.constantFrom(
  LogicalOperator.And,
  LogicalOperator.Or
);

/**
 * Generate an attribute expression
 * Can be either: attrPath SP "pr" or attrPath SP compareOp SP compValue
 */
export const attributeExpressionArb: fc.Arbitrary<AttributeExpression> =
  fc.oneof(
    // Present operator (pr)
    attributePathArb.map(
      (attrPath: AttributeExpressionPath): AttributeExpression => ({
        type: 'attribute',
        attrPath,
        present: true,
      })
    ),
    // Comparison operator with value
    fc.tuple(attributePathArb, comparisonOperatorArb, compValueArb).map(
      ([attrPath, operator, value]: [
        AttributeExpressionPath,
        ComparisonOperator,
        CompValue,
      ]): AttributeExpression => ({
        type: 'attribute',
        attrPath,
        operator,
        value,
      })
    )
  ) as fc.Arbitrary<AttributeExpression>;

// Recursive arbitraries with depth control
// We use factory functions with explicit depth to handle recursive types

/**
 * Factory for generating filters with depth control
 */
const filterArbFactory = (maxDepth: number): fc.Arbitrary<Filter> => {
  if (maxDepth <= 0) {
    // Base case: only generate simple attribute expressions
    return attributeExpressionArb as fc.Arbitrary<Filter>;
  }

  // Recursive case: can generate all filter types
  const currentDepth = maxDepth - 1;
  const filterArb = filterArbFactory(currentDepth);

  return fc.oneof(
    // Attribute expression (base case)
    attributeExpressionArb as fc.Arbitrary<Filter>,
    // Value path
    valuePathArbFactory(currentDepth) as fc.Arbitrary<Filter>,
    // Logical expression
    fc.tuple(filterArb, logicalOperatorArb, filterArb).map(
      ([left, operator, right]: [
        Filter,
        LogicalOperator,
        Filter,
      ]): LogicalExpression => ({
        type: 'logical',
        left,
        operator,
        right,
      })
    ) as fc.Arbitrary<Filter>,
    // Not expression
    filterArb.map(
      (filter: Filter): NotExpression => ({
        type: 'not',
        filter,
      })
    ) as fc.Arbitrary<Filter>
  );
};

/**
 * Factory for generating value filters with depth control
 */
const valueFilterArbFactory = (maxDepth: number): fc.Arbitrary<ValueFilter> => {
  if (maxDepth <= 0) {
    // Base case: only attribute expressions
    return attributeExpressionArb as fc.Arbitrary<ValueFilter>;
  }

  const currentDepth = maxDepth - 1;
  const filterArb = filterArbFactory(currentDepth);

  return fc.oneof(
    // Attribute expression
    attributeExpressionArb as fc.Arbitrary<ValueFilter>,
    // Logical expression
    fc.tuple(filterArb, logicalOperatorArb, filterArb).map(
      ([left, operator, right]: [
        Filter,
        LogicalOperator,
        Filter,
      ]): LogicalExpression => ({
        type: 'logical',
        left,
        operator,
        right,
      })
    ) as fc.Arbitrary<ValueFilter>,
    // Not expression
    filterArb.map(
      (filter: Filter): NotExpression => ({
        type: 'not',
        filter,
      })
    ) as fc.Arbitrary<ValueFilter>
  );
};

/**
 * Factory for generating value paths with depth control
 */
const valuePathArbFactory = (maxDepth: number): fc.Arbitrary<ValuePath> => {
  const valFilterArb = valueFilterArbFactory(maxDepth);
  return fc.tuple(attributePathArb, valFilterArb).map(
    ([attrPath, valFilter]: [
      AttributeExpressionPath,
      ValueFilter,
    ]): ValuePath => ({
      type: 'valuePath',
      attrPath,
      valFilter,
    })
  ) as fc.Arbitrary<ValuePath>;
};

/**
 * Generate a value filter (used in value paths)
 * Can be: AttributeExpression | LogicalExpression | NotExpression
 * Uses fc.memo with depth control (max depth 3)
 */
export const valueFilterArb: fc.Arbitrary<ValueFilter> = fc.memo(n =>
  valueFilterArbFactory(Math.min(n, 3))
) as unknown as fc.Arbitrary<ValueFilter>;

/**
 * Generate a value path: attrPath "[" valFilter "]"
 * Uses fc.memo with depth control (max depth 3)
 */
export const valuePathArb: fc.Arbitrary<ValuePath> = fc.memo(n =>
  valuePathArbFactory(Math.min(n, 3))
) as unknown as fc.Arbitrary<ValuePath>;

/**
 * Generate a logical expression: FILTER SP ("and" / "or") SP FILTER
 * Uses fc.memo with depth control (max depth 3)
 */
export const logicalExpressionArb: fc.Arbitrary<LogicalExpression> = fc.memo(
  n =>
    fc
      .tuple(
        filterArbFactory(Math.min(n, 3)),
        logicalOperatorArb,
        filterArbFactory(Math.min(n, 3))
      )
      .map(
        ([left, operator, right]: [
          Filter,
          LogicalOperator,
          Filter,
        ]): LogicalExpression => ({
          type: 'logical',
          left,
          operator,
          right,
        })
      ) as fc.Arbitrary<LogicalExpression>
) as unknown as fc.Arbitrary<LogicalExpression>;

/**
 * Generate a not expression: "not" "(" FILTER ")"
 * Uses fc.memo with depth control (max depth 3)
 */
export const notExpressionArb: fc.Arbitrary<NotExpression> = fc.memo(
  n =>
    filterArbFactory(Math.min(n, 3)).map(
      (filter: Filter): NotExpression => ({
        type: 'not',
        filter,
      })
    ) as fc.Arbitrary<NotExpression>
) as unknown as fc.Arbitrary<NotExpression>;

/**
 * Generate a comprehensive Filter AST
 * Covers all filter types: AttributeExpression, LogicalExpression, ValuePath, NotExpression
 * Uses explicit depth control to prevent infinite recursion (max depth of 3)
 */
export const filterArb: fc.Arbitrary<Filter> = filterArbFactory(3);

/**
 * Build options for fast-check.  By default we run 2000 tests with a static random seed.
 *
 * Environment variables:
 * - FAST_CHECK_PATH: Path to start running the test from (to start from last failure)
 * - FAST_CHECK_SEED: Seed for the random number generator (if not provided, FAST_CHECK_RANDOM is evaluated)
 * - FAST_CHECK_RANDOM: Whether to use a random seed (if not provided, value "42" is used)
 * - FAST_CHECK_VERBOSE: Whether to print verbose output
 *
 * Examples:
 * - to run totally random: FAST_CHECK_RANDOM=true
 * - if random fails, use the seed and path printed to start from last failure
 * @param numRuns - Number of runs to perform
 * @returns Options for fast-check
 */
export function buildOptions(numRuns: number = 2000): {
  numRuns?: number;
  verbose?: boolean;
  path?: string;
  seed?: number;
  endOnFailure?: boolean;
} {
  const result: {
    numRuns?: number;
    verbose?: boolean;
    path?: string;
    seed?: number;
    endOnFailure?: boolean;
  } = {
    numRuns,
    endOnFailure: true,
    seed: process.env.FAST_CHECK_SEED
      ? parseInt(process.env.FAST_CHECK_SEED)
      : process.env.FAST_CHECK_RANDOM
        ? Date.now()
        : 42,
  };

  if (process.env.FAST_CHECK_VERBOSE) {
    result.verbose = true;
  }

  if (process.env.FAST_CHECK_PATH) {
    result.path = process.env.FAST_CHECK_PATH;
  }

  return result;
}
