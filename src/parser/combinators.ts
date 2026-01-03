import type { Parser, ParserResult } from './types.js';
import { failure, success } from './types.js';

// ============================================================================
// Parser Combinators
// ============================================================================

/**
 * Matches a literal string
 */
export const lit =
  (match: string): Parser<string> =>
  (input: string): ParserResult<string> => {
    if (input.startsWith(match)) {
      return success([match, input.slice(match.length)] as [string, string]);
    }
    return failure({
      code: 'INVALID_TOKEN',
      message: `Expected "${match}"`,
      position: 0,
      input,
    });
  };

/**
 * Matches a single character that satisfies a predicate
 */
export const char =
  (predicate: (c: string) => boolean): Parser<string> =>
  (input: string): ParserResult<string> => {
    if (input.length === 0) {
      return failure({
        code: 'UNEXPECTED_END',
        message: 'Unexpected end of input',
        position: 0,
        input,
      });
    }
    const c = input[0];
    if (predicate(c)) {
      return success([c, input.slice(1)] as [string, string]);
    }
    return failure({
      code: 'INVALID_TOKEN',
      message: `Unexpected character: "${c}"`,
      position: 0,
      input,
    });
  };

/**
 * Matches a specific character
 */
export const charLit = (c: string): Parser<string> => char(x => x === c);

/**
 * Matches a character from a set
 */
export const oneOf = (chars: string): Parser<string> =>
  char(c => chars.includes(c));

/**
 * Parses a sequence of characters matching a regex
 */
export const regex =
  (pattern: RegExp): Parser<string> =>
  (input: string): ParserResult<string> => {
    const match = input.match(pattern);
    if (match && match.index === 0) {
      return success([match[0], input.slice(match[0].length)] as [
        string,
        string,
      ]);
    }
    return failure({
      code: 'INVALID_TOKEN',
      message: `Expected pattern: ${pattern}`,
      position: 0,
      input,
    });
  };

/**
 * Tries multiple parsers in sequence, returning the result of the first one that succeeds
 */
export const alt =
  <T>(...parsers: Parser<T>[]): Parser<T> =>
  (input: string) => {
    for (const parser of parsers) {
      const result = parser(input);
      if (result.isRight()) {
        return result;
      }
    }
    return failure({
      code: 'INVALID_SYNTAX',
      message: 'No alternative matched',
      position: 0,
      input,
    });
  };

/**
 * Applies multiple parsers sequentially, succeeding only if all of them succeed
 */
export const seq =
  <T extends readonly unknown[]>(
    ...parsers: readonly [...{ [K in keyof T]: Parser<T[K]> }]
  ): Parser<T> =>
  (input: string) => {
    let remaining = input;
    const results: unknown[] = [];

    for (const parser of parsers) {
      const result = parser(remaining);
      if (result.isLeft()) {
        return result;
      }
      const [value, rest] = result.value;
      results.push(value);
      remaining = rest;
    }

    return success([results as unknown as T, remaining] as [T, string]);
  };

/**
 * Applies a parser zero or more times, collecting the results into an array
 */
export const many =
  <T>(parser: Parser<T>): Parser<T[]> =>
  (input: string) => {
    const results: T[] = [];
    let remaining = input;

    while (true) {
      const result = parser(remaining);
      if (result.isLeft()) {
        break;
      }
      const [value, rest] = result.value;
      results.push(value);
      remaining = rest;
    }

    return success([results, remaining] as [T[], string]);
  };

/**
 * Applies a parser one or more times
 */
export const many1 =
  <T>(parser: Parser<T>): Parser<T[]> =>
  (input: string) => {
    const result = many(parser)(input);
    if (result.isLeft() || result.value[0].length === 0) {
      return failure({
        code: 'MISSING_VALUE',
        message: 'Expected one or more matches',
        position: 0,
        input,
      });
    }
    return result;
  };

/**
 * Transforms the result of a successful parse using a provided function
 */
export const map =
  <T, U>(parser: Parser<T>, fn: (value: T) => U): Parser<U> =>
  (input: string): ParserResult<U> => {
    const result = parser(input);
    if (result.isLeft()) {
      return result;
    }
    const [value, rest] = result.value;
    return success([fn(value), rest] as [U, string]);
  };

/**
 * Applies a parser and ignores its result, returning a constant value
 */
export const as = <T, U>(parser: Parser<T>, value: U): Parser<U> =>
  map(parser, () => value);

/**
 * Applies a parser zero or one time
 */
export const optional =
  <T>(parser: Parser<T>): Parser<T | undefined> =>
  (input: string) => {
    const result = parser(input);
    if (result.isLeft()) {
      return success([undefined, input] as [T | undefined, string]);
    }
    const [value, rest] = result.value;
    return success([value, rest] as [T | undefined, string]);
  };

/**
 * Creates a lazy parser that defers evaluation until parsing time
 * This is essential for recursive parsers to avoid circular dependencies
 */
export const lazy =
  <T>(parserFn: () => Parser<T>): Parser<T> =>
  (input: string) => {
    return parserFn()(input);
  };

/**
 * Skips whitespace (space, tab, newline, carriage return) - unused but kept for potential future use
 */
// const whitespace = many(oneOf(" \t\n\r"))

/**
 * Skips one or more whitespace characters (space, tab, newline, carriage return)
 */
export const whitespace1 = many1(oneOf(' \t\n\r'));

/**
 * Skips optional whitespace
 */
export const optWhitespace = optional(whitespace1);

// ============================================================================
// Basic Parsers
// ============================================================================

/**
 * Parse a letter (ALPHA)
 */
export const alpha = oneOf(
  'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ'
);

/**
 * Parse a digit (DIGIT)
 */
export const digit = oneOf('0123456789');

/**
 * Parse a name character: "-" / "_" / DIGIT / ALPHA
 */
export const nameChar = alt(alpha, digit, charLit('-'), charLit('_'));

/**
 * Parse an attribute name: ALPHA *(nameChar)
 */
export const attrName: Parser<string> = map(
  seq(alpha, many(nameChar)),
  (tuple: [string, string[]]) => {
    const [first, rest] = tuple;
    return first + rest.join('');
  }
);

/**
 * Parse a URI (matches URI segments separated by colons, ending with colon)
 * Example: "urn:ietf:params:scim:schemas:core:2.0:User:" -> "urn:ietf:params:scim:schemas:core:2.0:User"
 * Matches one or more segments (each segment can contain dots, dashes, etc.) separated by colons
 */
export const uri: Parser<string> = (input: string): ParserResult<string> => {
  // Find the last colon that's followed by an attribute name
  // Attribute name: starts with letter, followed by nameChars, then space/operator/bracket/end (NOT colon)
  // Search backwards to find the right colon
  let colonIndex = -1;

  for (let i = input.length - 1; i >= 0; i--) {
    if (input[i] === ':') {
      const afterColon = input.slice(i + 1);
      // Check if after this colon we have a valid attribute name pattern
      // that's NOT followed by another colon
      const attrMatch = afterColon.match(/^[a-zA-Z][a-zA-Z0-9_-]*/);
      if (attrMatch) {
        const attrName = attrMatch[0];
        const afterAttr = afterColon.slice(attrName.length);
        // After the attribute name, we should have space, operator, bracket, dot (sub-attr), or end - NOT colon
        if (
          afterAttr.length === 0
          || /^[ \t[."]/.test(afterAttr)
          || /^(eq|ne|co|sw|ew|gt|lt|ge|le|pr)/.test(afterAttr)
        ) {
          colonIndex = i;
          break;
        }
      }
    }
  }

  if (colonIndex === -1) {
    return failure({
      code: 'INVALID_TOKEN',
      message: 'Expected URI with colon before attribute name',
      position: 0,
      input,
    });
  }

  const uriPart = input.slice(0, colonIndex);
  const remaining = input.slice(colonIndex + 1);

  return success([uriPart, remaining] as [string, string]);
};

/**
 * Parse a sub-attribute: "." ATTRNAME
 */
export const subAttr: Parser<string> = map(
  seq(charLit('.'), attrName),
  (tuple: [string, string]) => {
    const [, name] = tuple;
    return name;
  }
);
