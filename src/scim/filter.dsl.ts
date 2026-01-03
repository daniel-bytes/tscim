/**
 * SCIM Filter DSL Parser
 *
 * Implements RFC 7644 Section 3.4.2.2 - Filtering
 * https://datatracker.ietf.org/doc/html/rfc7644#section-3.4.2.2
 */

import {
  alt,
  as,
  attrName,
  charLit,
  digit,
  lazy,
  lit,
  many1,
  map,
  optional,
  optWhitespace,
  regex,
  seq,
  subAttr,
  uri,
  whitespace1,
} from '../parser/combinators.js';
import type {
  Either,
  Parser,
  ParserError,
  ParserResult,
} from '../parser/types.js';
import { failure, success } from '../parser/types.js';

// ============================================================================
// Enums - RFC 7644 Tables 3, 4, 5
// ============================================================================

/**
 * Comparison operators as specified in RFC 7644 Table 3
 */
export enum ComparisonOperator {
  /** Equal */
  Eq = 'eq',
  /** Not Equal */
  Ne = 'ne',
  /** Contains */
  Co = 'co',
  /** Starts With */
  Sw = 'sw',
  /** Ends With */
  Ew = 'ew',
  /** Greater Than */
  Gt = 'gt',
  /** Less Than */
  Lt = 'lt',
  /** Greater Than or Equal */
  Ge = 'ge',
  /** Less Than or Equal */
  Le = 'le',
}

/**
 * Logical operators as specified in RFC 7644 Table 4
 */
export enum LogicalOperator {
  /** Logical AND */
  And = 'and',
  /** Logical OR */
  Or = 'or',
  /** Logical NOT */
  Not = 'not',
}

/**
 * Grouping operators as specified in RFC 7644 Table 5
 */
export enum GroupingOperator {
  Precedence = '()',
  ComplexAttribute = '[]',
}

// ============================================================================
// AST Types
// ============================================================================

/**
 * Comparison value types (JSON values)
 */
export type CompValue = string | number | boolean | null;

/**
 * Attribute path component
 */
export interface AttributeExpressionPath {
  readonly uri?: string;
  readonly attrName: string;
  readonly subAttr?: string;
}

/**
 * Attribute expression: attrPath [SP compareOp SP compValue] / attrPath SP "pr"
 */
export interface AttributeExpression {
  readonly type: 'attribute';
  readonly attrPath: AttributeExpressionPath;
  readonly operator?: ComparisonOperator;
  readonly value?: CompValue;
  readonly present?: boolean; // true if "pr" operator is used
}

/**
 * Value filter (used in valuePath)
 */
export type ValueFilter =
  | AttributeExpression
  | LogicalExpression
  | NotExpression;

/**
 * Value path: attrPath "[" valFilter "]"
 */
export interface ValuePath {
  readonly type: 'valuePath';
  readonly attrPath: AttributeExpressionPath;
  readonly valFilter: ValueFilter;
}

/**
 * Logical expression: FILTER SP ("and" / "or") SP FILTER
 */
export interface LogicalExpression {
  readonly type: 'logical';
  readonly left: Filter;
  readonly operator: LogicalOperator;
  readonly right: Filter;
}

/**
 * Not expression: "not" "(" FILTER ")"
 */
export interface NotExpression {
  readonly type: 'not';
  readonly filter: Filter;
}

/**
 * Main filter type: attrExp / logExp / valuePath / notExp
 */
export type Filter =
  | AttributeExpression
  | LogicalExpression
  | ValuePath
  | NotExpression;

/**
 * Parse an attribute path: [URI ":"] ATTRNAME *1subAttr
 */
const attrPath: Parser<AttributeExpressionPath> = map(
  seq(optional(uri), attrName, optional(subAttr)),
  (
    tuple: [string | undefined, string, string | undefined]
  ): AttributeExpressionPath => {
    const [uri, name, subAttr] = tuple;
    if (uri !== undefined && subAttr !== undefined) {
      return {
        uri,
        attrName: name,
        subAttr,
      };
    } else if (uri !== undefined) {
      return {
        uri,
        attrName: name,
      };
    } else if (subAttr !== undefined) {
      return {
        attrName: name,
        subAttr,
      };
    } else {
      return {
        attrName: name,
      };
    }
  }
);

/**
 * Parse comparison operator: "eq" / "ne" / "co" / "sw" / "ew" / "gt" / "lt" / "ge" / "le"
 */
const compareOp: Parser<ComparisonOperator> = alt(
  as(lit('eq'), ComparisonOperator.Eq),
  as(lit('ne'), ComparisonOperator.Ne),
  as(lit('co'), ComparisonOperator.Co),
  as(lit('sw'), ComparisonOperator.Sw),
  as(lit('ew'), ComparisonOperator.Ew),
  as(lit('gt'), ComparisonOperator.Gt),
  as(lit('lt'), ComparisonOperator.Lt),
  as(lit('ge'), ComparisonOperator.Ge),
  as(lit('le'), ComparisonOperator.Le)
);

/**
 * Parse "pr" (present) operator
 */
const prOperator = as(lit('pr'), true);

/**
 * Parse a JSON string value (quoted string)
 */
const jsonString: Parser<string> = map(
  seq(charLit('"'), regex(/[^"]*/), charLit('"')),
  (tuple: [string, string, string]) => {
    const [, str] = tuple;
    return str;
  }
);

/**
 * Parse a JSON number value (integer)
 */
const jsonNumber: Parser<number> = map(many1(digit), (digits: string[]) =>
  Number.parseInt(digits.join(''), 10)
);

/**
 * Parse JSON boolean values
 */
const jsonBoolean: Parser<boolean> = alt(
  as(lit('true'), true),
  as(lit('false'), false)
);

/**
 * Parse JSON null value
 */
const jsonNull = as(lit('null'), null);

/**
 * Parse a comparison value: false / null / true / number / string
 */
const compValue: Parser<CompValue> = alt(
  jsonBoolean as Parser<CompValue>,
  jsonNull as Parser<CompValue>,
  jsonNumber as Parser<CompValue>,
  jsonString as Parser<CompValue>
);

/**
 * Parse logical operator: "and" / "or"
 */
const logOp: Parser<LogicalOperator> = alt(
  as(lit('and'), LogicalOperator.And),
  as(lit('or'), LogicalOperator.Or)
);

/**
 * Parse "not" keyword
 */
const notKeyword = lit('not');

// ============================================================================
// Expression Parsers (with forward references)
// ============================================================================

/**
 * Parse an attribute expression: (attrPath SP "pr") / (attrPath SP compareOp SP compValue)
 */
const attrExp: Parser<AttributeExpression> = map(
  seq(
    attrPath,
    whitespace1,
    alt(
      map(
        prOperator,
        (present: boolean): Omit<AttributeExpression, 'attrPath'> => ({
          type: 'attribute' as const,
          present,
        })
      ),
      map(
        seq(compareOp, whitespace1, compValue),
        (
          tuple: [ComparisonOperator, string[], CompValue]
        ): Omit<AttributeExpression, 'attrPath'> => {
          const [operator, , value] = tuple;
          return {
            type: 'attribute' as const,
            operator,
            value,
          };
        }
      )
    )
  ),
  (
    tuple: [
      AttributeExpressionPath,
      string[],
      Omit<AttributeExpression, 'attrPath'>,
    ]
  ): AttributeExpression => {
    const [attrPath, , expr] = tuple;
    return {
      ...expr,
      attrPath,
    };
  }
);

/**
 * Forward declarations for recursive parsers
 * These need to be let because they reference each other circularly
 */
// eslint-disable-next-line prefer-const
let filter: Parser<Filter>;
// eslint-disable-next-line prefer-const
let notExp: Parser<NotExpression>;

/**
 * Parse a parenthesized value filter for precedence grouping: "(" valFilter ")"
 * This handles parentheses without the "not" keyword in value filters
 */
const parenthesizedValFilter = (input: string): ParserResult<ValueFilter> => {
  return map(
    seq(
      charLit('('),
      optWhitespace,
      lazy(() => valFilter),
      optWhitespace,
      charLit(')')
    ),
    (
      tuple: [
        string,
        string[] | undefined,
        ValueFilter,
        string[] | undefined,
        string,
      ]
    ): ValueFilter => {
      const [, , valFilter] = tuple;
      // Return the inner filter directly (precedence grouping doesn't need a separate AST node)
      return valFilter;
    }
  )(input);
};

/**
 * Parse a value filter: attrExp / logExp / "not" "(" valFilter ")" / "(" valFilter ")"
 * Uses the same strategy as the main filter to handle logical expressions
 *
 * Note: While ValueFilter type doesn't include ValuePath directly, a ValuePath can appear
 * as part of a LogicalExpression (left/right can be any Filter including ValuePath).
 * So we need to try valuePath as a base case to handle nested valuePaths in logical expressions.
 */
const valFilter: Parser<ValueFilter> = (input: string) => {
  // First try notExp (requires "not" keyword)
  const notResult = lazy(() => notExp)(input);
  if (notResult.isRight()) {
    return notResult as ParserResult<ValueFilter>;
  }

  // Try parenthesized value filter (precedence grouping, no "not" keyword)
  const parenResult = lazy(() => parenthesizedValFilter)(input);
  if (parenResult.isRight()) {
    return parenResult;
  }

  // Try valuePath as a base case (needed for nested valuePaths in logical expressions)
  // A standalone valuePath cannot be a ValueFilter, but it can be the left side of a LogicalExpression
  const valuePathResult = lazy(() => valuePath)(input);
  if (valuePathResult.isRight()) {
    const [valuePathFilter, remaining] = valuePathResult.value;
    // If there's remaining input, try to parse it as a logical expression
    if (remaining.trim().length > 0) {
      // Try to parse: remaining = SP logOp SP FILTER
      const logResult = map(
        seq(
          whitespace1,
          logOp,
          whitespace1,
          lazy(() => filter)
        ),
        (
          tuple: [string[], LogicalOperator, string[], Filter]
        ): LogicalExpression => {
          const [, operator, , right] = tuple;
          return {
            type: 'logical' as const,
            left: valuePathFilter,
            operator,
            right,
          };
        }
      )(remaining);

      if (logResult.isRight()) {
        return logResult as ParserResult<ValueFilter>;
      }
    }
    // If we parsed a valuePath but there's no logical operator, we can't return it
    // as a ValueFilter (since ValueFilter doesn't include ValuePath directly).
    // Fall through to try attrExp - if that also fails, we'll return the attrExp error.
  }

  // Try base expression (attrExp)
  const baseResult = attrExp(input);
  if (baseResult.isLeft()) {
    return baseResult;
  }

  const [baseFilter, remaining] = baseResult.value;

  // If there's remaining input, try to parse it as a logical expression
  if (remaining.trim().length > 0) {
    // Try to parse: remaining = SP logOp SP FILTER
    const logResult = map(
      seq(
        whitespace1,
        logOp,
        whitespace1,
        lazy(() => filter)
      ),
      (
        tuple: [string[], LogicalOperator, string[], Filter]
      ): LogicalExpression => {
        const [, operator, , right] = tuple;
        return {
          type: 'logical' as const,
          left: baseFilter,
          operator,
          right,
        };
      }
    )(remaining);

    if (logResult.isRight()) {
      return logResult as ParserResult<ValueFilter>;
    }
  }

  // Return the base expression
  return baseResult as ParserResult<ValueFilter>;
};

/**
 * Parse a value path: attrPath "[" valFilter "]"
 */
const valuePath: Parser<ValuePath> = map(
  seq(
    attrPath,
    charLit('['),
    optWhitespace,
    valFilter,
    optWhitespace,
    charLit(']')
  ),
  (
    tuple: [
      AttributeExpressionPath,
      string,
      string[] | undefined,
      ValueFilter,
      string[] | undefined,
      string,
    ]
  ): ValuePath => {
    const [attrPath, , , valFilter] = tuple;
    return {
      type: 'valuePath',
      attrPath,
      valFilter,
    };
  }
);

/**
 * Parse a parenthesized expression for precedence grouping: "(" FILTER ")"
 * This handles parentheses without the "not" keyword (precedence grouping)
 */
const parenthesizedExpr = (input: string): ParserResult<Filter> => {
  return map(
    seq(
      charLit('('),
      optWhitespace,
      lazy(() => filter),
      optWhitespace,
      charLit(')')
    ),
    (
      tuple: [
        string,
        string[] | undefined,
        Filter,
        string[] | undefined,
        string,
      ]
    ): Filter => {
      const [, , filter] = tuple;
      // Return the inner filter directly (precedence grouping doesn't need a separate AST node)
      return filter;
    }
  )(input);
};

/**
 * Parse a not expression: "not" "(" FILTER ")"
 * Uses lazy evaluation to break circular dependency
 * Note: Per RFC 7644, the "not" keyword is required for NOT expressions.
 * Parentheses without "not" are handled by parenthesizedExpr for precedence grouping.
 */
notExp = (input: string): ParserResult<NotExpression> => {
  return map(
    seq(
      notKeyword,
      optWhitespace,
      charLit('('),
      optWhitespace,
      lazy(() => filter),
      optWhitespace,
      charLit(')')
    ),
    (
      tuple: [
        string,
        string[] | undefined,
        string,
        string[] | undefined,
        Filter,
        string[] | undefined,
        string,
      ]
    ): NotExpression => {
      const [, , , , filter] = tuple;
      return {
        type: 'not' as const,
        filter,
      };
    }
  )(input);
};

/**
 * Parse a base filter expression (non-recursive)
 */
const baseFilterExpr: Parser<Filter> = alt(
  valuePath as Parser<Filter>,
  attrExp as Parser<Filter>
);

/**
 * Main filter parser: attrExp / logExp / valuePath / "not" "(" FILTER ")" / "(" FILTER ")"
 * Uses lazy evaluation for recursive expressions
 *
 * Strategy: Parse base expressions first, then try to extend with operators.
 * This handles left-associative operators correctly and avoids infinite recursion.
 */
filter = (input: string): ParserResult<Filter> => {
  // First try notExp (requires "not" keyword)
  const notResult = lazy(() => notExp)(input);
  if (notResult.isRight()) {
    const [notFilter, notRemaining] = notResult.value;
    // Check if there's remaining input that could extend this as a logical expression
    if (notRemaining.trim().length > 0) {
      const logResult = map(
        seq(
          whitespace1,
          logOp,
          whitespace1,
          lazy(() => filter)
        ),
        (
          tuple: [string[], LogicalOperator, string[], Filter]
        ): LogicalExpression => {
          const [, operator, , right] = tuple;
          return {
            type: 'logical' as const,
            left: notFilter,
            operator,
            right,
          };
        }
      )(notRemaining);

      if (logResult.isRight()) {
        return logResult as ParserResult<Filter>;
      }
    }
    return notResult;
  }

  // Try parenthesized expression (precedence grouping, no "not" keyword)
  const parenResult = lazy(() => parenthesizedExpr)(input);
  if (parenResult.isRight()) {
    const [parenFilter, parenRemaining] = parenResult.value;
    // Check if there's remaining input that could extend this as a logical expression
    if (parenRemaining.trim().length > 0) {
      const logResult = map(
        seq(
          whitespace1,
          logOp,
          whitespace1,
          lazy(() => filter)
        ),
        (
          tuple: [string[], LogicalOperator, string[], Filter]
        ): LogicalExpression => {
          const [, operator, , right] = tuple;
          return {
            type: 'logical' as const,
            left: parenFilter,
            operator,
            right,
          };
        }
      )(parenRemaining);

      if (logResult.isRight()) {
        return logResult as ParserResult<Filter>;
      }
    }
    return parenResult;
  }

  // Try base expressions (valuePath, attrExp)
  const baseResult = baseFilterExpr(input);
  if (baseResult.isLeft()) {
    return baseResult;
  }

  const [baseFilter, remaining] = baseResult.value;

  // If there's remaining input, try to parse it as a logical expression
  if (remaining.trim().length > 0) {
    // Try to parse: remaining = SP logOp SP FILTER
    const logResult = map(
      seq(
        whitespace1,
        logOp,
        whitespace1,
        lazy(() => filter)
      ),
      (
        tuple: [string[], LogicalOperator, string[], Filter]
      ): LogicalExpression => {
        const [, operator, , right] = tuple;
        return {
          type: 'logical' as const,
          left: baseFilter,
          operator,
          right,
        };
      }
    )(remaining);

    if (logResult.isRight()) {
      return logResult as ParserResult<Filter>;
    }
  }

  // Return the base expression
  return baseResult;
};

// ============================================================================
// Serializers: Convert AST back to filter expression string
// ============================================================================

/**
 * Serializes an attribute path to a string
 */
function serializeAttrPath(attrPath: AttributeExpressionPath): string {
  let result = '';
  if (attrPath.uri) {
    result += attrPath.uri + ':';
  }
  result += attrPath.attrName;
  if (attrPath.subAttr) {
    result += '.' + attrPath.subAttr;
  }
  return result;
}

/**
 * Serializes a comparison value to a string
 */
function serializeCompValue(value: CompValue): string {
  if (typeof value === 'string') {
    // Escape quotes in strings
    const escaped = value.replace(/"/g, '\\"');
    return `"${escaped}"`;
  }
  if (typeof value === 'number') {
    return value.toString();
  }
  if (typeof value === 'boolean') {
    return value ? 'true' : 'false';
  }
  if (value === null) {
    return 'null';
  }
  // This should never happen, but TypeScript needs it
  return String(value);
}

/**
 * Serializes a value filter to a string
 */
function serializeValueFilter(valFilter: ValueFilter): string {
  return serializeFilter(valFilter);
}

// ============================================================================
// Public API
// ============================================================================

/**
 * Parse a SCIM filter expression
 *
 * @param input - The filter string to parse
 * @returns Either a ParserError or the parsed Filter
 *
 * @example
 * ```ts
 * const result = parseFilter('userName eq "john.doe"')
 * if (result.isRight()) {
 *   console.log(result.value) // Filter AST
 * } else {
 *   console.error(result.value.message) // Error message
 * }
 * ```
 */
export function parseFilter(input: string): Either<ParserError, Filter> {
  const trimmed = input.trim();
  const result = filter(trimmed);
  if (result.isLeft()) {
    return result;
  }
  const [value, remaining] = result.value;
  // Check if there's remaining input that wasn't parsed
  if (remaining.trim().length > 0) {
    return failure({
      code: 'INVALID_SYNTAX',
      message: `Unexpected input remaining: "${remaining.trim()}"`,
      position: input.length - remaining.length,
      input,
    });
  }
  return success(value);
}

/**
 * Converts a Filter AST back to a filter expression string
 * @param filter - The Filter AST to serialize
 * @returns The serialized filter expression string
 */
export function serializeFilter(filter: Filter): string {
  if (filter.type === 'attribute') {
    const attrPathStr = serializeAttrPath(filter.attrPath);
    if (filter.present) {
      return `${attrPathStr} pr`;
    }
    if (filter.operator !== undefined && filter.value !== undefined) {
      return `${attrPathStr} ${filter.operator} ${serializeCompValue(filter.value)}`;
    }
    // Fallback: just the attribute path (shouldn't happen in valid filters)
    return attrPathStr;
  }

  if (filter.type === 'logical') {
    const leftStr = serializeFilter(filter.left);
    const rightStr = serializeFilter(filter.right);
    return `${leftStr} ${filter.operator} ${rightStr}`;
  }

  if (filter.type === 'valuePath') {
    const attrPathStr = serializeAttrPath(filter.attrPath);
    const valFilterStr = serializeValueFilter(filter.valFilter);
    return `${attrPathStr}[${valFilterStr}]`;
  }

  if (filter.type === 'not') {
    const filterStr = serializeFilter(filter.filter);
    return `not (${filterStr})`;
  }

  // This should never happen, but TypeScript needs it
  throw new Error(`Unknown filter type: ${(filter as Filter).type}`);
}
