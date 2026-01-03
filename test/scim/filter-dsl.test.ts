import { describe, expect, it } from 'vitest';
import type {
  AttributeExpression,
  LogicalExpression,
  Filter,
} from '../../src/scim/filter.dsl.js';
import {
  ComparisonOperator,
  parseFilter,
  serializeFilter,
  LogicalOperator,
} from '../../src/scim/filter.dsl.js';
import type { ParserError } from '../../src/parser/types.js';

describe('parseFilter', () => {
  describe('Attribute Expressions', () => {
    it('should parse a simple equality expression', () => {
      const result = parseFilter('userName eq "john.doe"');
      expect(result.get()).toMatchSnapshot();
    });

    it.each([
      { op: ComparisonOperator.Eq, input: 'userName eq "test"' },
      { op: ComparisonOperator.Ne, input: 'userName ne "test"' },
      { op: ComparisonOperator.Co, input: 'userName co "test"' },
      { op: ComparisonOperator.Sw, input: 'userName sw "test"' },
      { op: ComparisonOperator.Ew, input: 'userName ew "test"' },
      { op: ComparisonOperator.Gt, input: 'age gt 18' },
      { op: ComparisonOperator.Lt, input: 'age lt 65' },
      { op: ComparisonOperator.Ge, input: 'age ge 18' },
      { op: ComparisonOperator.Le, input: 'age le 65' },
    ])('should parse comparison operator $op', ({ input, op }): void => {
      const result = parseFilter(input);
      const filter = result.get();
      expect((filter as AttributeExpression).operator).toBe(op);
    });

    it('should parse present operator (pr)', () => {
      const result = parseFilter('userName pr');
      expect(result.get()).toMatchSnapshot();
    });

    it('should parse attribute with URI', () => {
      const result = parseFilter(
        'urn:ietf:params:scim:schemas:core:2.0:User:userName eq "test"'
      );
      expect(result.get()).toMatchSnapshot();
    });

    it('should parse attribute with sub-attribute', () => {
      const result = parseFilter('name.familyName eq "Smith"');
      expect(result.get()).toMatchSnapshot();
    });

    it('should parse attribute with URI and sub-attribute', () => {
      const result = parseFilter(
        'urn:ietf:params:scim:schemas:core:2.0:User:name.familyName eq "Smith"'
      );
      expect(result.get()).toMatchSnapshot();
    });
  });

  describe('Value Types', () => {
    it('should parse string values', () => {
      const result = parseFilter('userName eq "test@example.com"');
      expect(result.get()).toMatchSnapshot();
    });

    it('should parse number values', () => {
      const result = parseFilter('age eq 25');
      expect(result.get()).toMatchSnapshot();
    });

    it('should parse boolean true', () => {
      const result = parseFilter('active eq true');
      expect(result.get()).toMatchSnapshot();
    });

    it('should parse boolean false', () => {
      const result = parseFilter('active eq false');
      expect(result.get()).toMatchSnapshot();
    });

    it('should parse null', () => {
      const result = parseFilter('manager eq null');
      expect(result.get()).toMatchSnapshot();
    });
  });

  describe('Logical Expressions', () => {
    it('should parse AND expression', () => {
      const result = parseFilter('userName eq "john" and active eq true');
      expect(result.get()).toMatchSnapshot();
    });

    it('should parse OR expression', () => {
      const result = parseFilter('userName eq "john" or userName eq "jane"');
      expect(result.get()).toMatchSnapshot();
    });

    it('should parse complex nested logical expressions', () => {
      const result = parseFilter(
        'userName eq "john" and active eq true or role eq "admin"'
      );
      expect(result.get()).toMatchSnapshot();
    });
  });

  describe('Not Expressions', () => {
    it('should parse not expression with parentheses', () => {
      const result = parseFilter('not (userName eq "admin")');
      expect(result.get()).toMatchSnapshot();
    });

    it('should parse parenthesized expression as precedence grouping (not NOT expression)', () => {
      // Per RFC 7644, parentheses without "not" are for precedence grouping,
      // not for creating a NOT expression. The inner expression should be returned.
      const result = parseFilter('(userName eq "admin")');
      expect(result.get()).toMatchSnapshot();
    });

    it('should parse nested not expressions', () => {
      const result = parseFilter(
        'not (userName eq "admin" and active eq false)'
      );
      expect(result.get()).toMatchSnapshot();
    });
  });

  describe('Value Paths', () => {
    it('should parse value path with attribute expression', () => {
      const result = parseFilter('emails[type eq "work"]');
      expect(result.get()).toMatchSnapshot();
    });

    it('should parse value path with logical expression', () => {
      const result = parseFilter('emails[type eq "work" and primary eq true]');
      expect(result.get()).toMatchSnapshot();
    });

    it('should parse value path with not expression', () => {
      const result = parseFilter('emails[not (type eq "work")]');
      expect(result.get()).toMatchSnapshot();
    });

    it('should parse nested value path with logical expression containing not', () => {
      const result = parseFilter('attr1[attr2[subAttr pr] or not (attr3 pr)]');
      expect(result.get()).toMatchSnapshot();
    });

    it('should round-trip parse nested value path with logical expression containing not (working case)', () => {
      // This case works - it parses correctly when written as a string
      const filterString = 'attr1[attr2[subAttr pr] or not (attr3 pr)]';
      const parsed = parseFilter(filterString);
      if (parsed.isLeft()) {
        throw new Error(`Parse failed: ${parsed.value.message}`);
      }
      const filter = parsed.get();

      // Now test round-trip
      const serialized = serializeFilter(filter);
      const reparsed = parseFilter(serialized);

      if (reparsed.isLeft()) {
        throw new Error(
          `Round-trip failed: ${reparsed.value.message}\nSerialized: ${serialized}`
        );
      }

      expect(reparsed.get()).toEqual(filter);
    });

    // TODO: Remove this describe block once the issue is fixed (can keep the tests)
    describe('Failing cases from filter.property.test.ts round trip assertion', () => {
      /**
       * Cursor summary of the issue:
       * Added three test cases to filter-dsl.test.ts
       * 1. Working case (passes): Tests round-trip serialization for attr1[attr2[subAttr pr] or not (attr3 pr)] — this works because the not expression doesn't contain a URI.
       * 2. Two minimal failing cases (both fail):
       *   - Test 1: ValuePath with URI, logical expression where left is a valuePath and right is a not expression with a URI
       *   - Test 2: Simpler case with no URI on the outer valuePath, but URI only in the not expression's attribute
       * Both failing cases show the same error: "Unexpected input remaining: ')]'"
       *
       * Key Finding:
       * The issue occurs specifically when:
       *   - A valuePath contains a logical expression as its valFilter
       *   - The logical expression's left side is a valuePath
       *   - The logical expression's right side is a not expression
       *   - The not expression's attribute path contains a URI
       * The tests are minimal and well-documented, making it easier to debug the parser issue. The working case shows that the structure is valid; something about having a URI in the not expression's attribute path causes the parser to fail.
       */

      it('should parse the exact failing case from property test', () => {
        const failingString =
          'urn:fV--m1D0liW:6:1Ewy9_.:b--.A07P:5:xT_u:4:t.:10.:qSjgQ9ug4k[TIpx[wXNi.bE pr] or not (urn:F_:cP.a__.:21T.ty-A_:5_.o:01Y--Z:MrfttC.ShHbHDXCUuG pr)]';
        const result = parseFilter(failingString);
        if (result.isLeft()) {
          throw new Error(`Parse failed: ${result.value.message}`);
        }
        expect(result.get()).toBeDefined();
      });

      it('should round-trip serialize and parse: valuePath with logical expression (valuePath left, not right)', () => {
        // Minimal failing case: valuePath with logical expression where:
        // - Left side is a valuePath
        // - Right side is a not expression with attribute containing URI
        const filter: Filter = {
          type: 'valuePath',
          attrPath: { uri: 'urn:test', attrName: 'outer' },
          valFilter: {
            type: 'logical',
            operator: LogicalOperator.Or,
            left: {
              type: 'valuePath',
              attrPath: { attrName: 'inner' },
              valFilter: {
                type: 'attribute',
                attrPath: { attrName: 'subAttr' },
                present: true,
              },
            },
            right: {
              type: 'not',
              filter: {
                type: 'attribute',
                attrPath: { uri: 'urn:test2', attrName: 'otherAttr' },
                present: true,
              },
            },
          },
        };

        const serialized = serializeFilter(filter);
        const parsed = parseFilter(serialized);

        if (parsed.isLeft()) {
          throw new Error(
            `Round-trip failed: ${parsed.value.message}\nSerialized: ${serialized}`
          );
        }

        expect(parsed.get()).toEqual(filter);
      });

      it('should round-trip serialize and parse: simpler case with URI in not expression', () => {
        // Even simpler: valuePath with logical expression, URI only in the not expression
        const filter: Filter = {
          type: 'valuePath',
          attrPath: { attrName: 'outer' },
          valFilter: {
            type: 'logical',
            operator: LogicalOperator.Or,
            left: {
              type: 'valuePath',
              attrPath: { attrName: 'inner' },
              valFilter: {
                type: 'attribute',
                attrPath: { attrName: 'attr' },
                present: true,
              },
            },
            right: {
              type: 'not',
              filter: {
                type: 'attribute',
                attrPath: { uri: 'urn:test', attrName: 'other' },
                present: true,
              },
            },
          },
        };

        const serialized = serializeFilter(filter);
        const parsed = parseFilter(serialized);

        if (parsed.isLeft()) {
          throw new Error(
            `Round-trip failed: ${parsed.value.message}\nSerialized: ${serialized}`
          );
        }

        expect(parsed.get()).toEqual(filter);
      });
    });
  });

  describe('RFC 7644 Examples', () => {
    it('should parse RFC 7644 example: userName eq "bjensen"', () => {
      const result = parseFilter('userName eq "bjensen"');
      expect(result.get()).toMatchSnapshot();
    });

    it('should parse RFC 7644 example: name.familyName co "O\'Malley"', () => {
      const result = parseFilter('name.familyName co "O\'Malley"');
      expect(result.get()).toMatchSnapshot();
    });

    it('should parse RFC 7644 example: userName sw "J"', () => {
      const result = parseFilter('userName sw "J"');
      expect(result.get()).toMatchSnapshot();
    });

    it('should parse RFC 7644 example: title pr', () => {
      const result = parseFilter('title pr');
      expect(result.get()).toMatchSnapshot();
    });

    it('should parse RFC 7644 example: meta.lastModified gt "2011-05-13T04:42:34Z"', () => {
      const result = parseFilter('meta.lastModified gt "2011-05-13T04:42:34Z"');
      expect(result.get()).toMatchSnapshot();
    });

    it('should parse RFC 7644 example: title pr and userType eq "Employee"', () => {
      const result = parseFilter('title pr and userType eq "Employee"');
      expect(result.get()).toMatchSnapshot();
    });

    it('should parse RFC 7644 example: emails[type eq "work" and value co "@example.com"]', () => {
      const result = parseFilter(
        'emails[type eq "work" and value co "@example.com"]'
      );
      expect(result.get()).toMatchSnapshot();
    });
  });

  describe('Complex Examples', () => {
    it('should parse deeply nested expressions with complex whitespace', () => {
      const result = parseFilter(
        `(userName sw "admin" and not (active eq false))
         or
         (
            emails[type eq "work"] and roles[
              value ne "admin"
              or
              not (type ew "user")
              and primary eq true
              or not (display pr)
            ]
         )
       `
      );
      expect(result.get()).toMatchSnapshot();
    });

    it('should parse multiple value paths combined with logical operators', () => {
      const result = parseFilter(
        'emails[type eq "work"] and roles[value eq "admin"]'
      );
      expect(result.get()).toMatchSnapshot();
    });

    it('should parse value path combined with regular attribute expression', () => {
      const result = parseFilter('emails[type eq "work"] and active eq true');
      expect(result.get()).toMatchSnapshot();
    });

    it('should parse NOT expression wrapping a value path', () => {
      const result = parseFilter('not (emails[type eq "work"])');
      expect(result.get()).toMatchSnapshot();
    });

    it('should parse parenthesized value path for precedence grouping', () => {
      const result = parseFilter('(emails[type eq "work"]) and active eq true');
      expect(result.get()).toMatchSnapshot();
    });

    it('should parse expression with explicit precedence grouping (A and B) or C', () => {
      const result = parseFilter(
        '(userName eq "admin" and active eq true) or role eq "user"'
      );
      const filter = result.get();
      expect((filter as LogicalExpression).operator).toBe(LogicalOperator.Or);
      expect((filter as LogicalExpression).left.type).toBe('logical');
      expect(filter).toMatchSnapshot();
    });

    it('should parse expression with explicit precedence grouping A and (B or C)', () => {
      const result = parseFilter(
        'userName eq "admin" and (active eq true or role eq "user")'
      );
      const filter = result.get();
      expect((filter as LogicalExpression).operator).toBe(LogicalOperator.And);
      expect((filter as LogicalExpression).right.type).toBe('logical');
      expect(filter).toMatchSnapshot();
    });

    it('should parse multiple NOT expressions in a logical expression', () => {
      const result = parseFilter(
        'not (userName eq "admin") and not (active eq false)'
      );
      expect(result.get()).toMatchSnapshot();
    });

    it('should parse NOT of value path combined with regular attributes', () => {
      const result = parseFilter(
        'not (emails[type eq "work"]) and active eq true'
      );
      expect(result.get()).toMatchSnapshot();
    });
  });

  describe('Error Cases', () => {
    it('should fail on empty input', () => {
      const result = parseFilter('');
      expect(result.isLeft()).toBe(true);
    });

    it('should fail on invalid operator', () => {
      const result = parseFilter('userName invalid "test"');
      expect(result.isLeft()).toBe(true);
      expect((result.value as ParserError).code).toBe('INVALID_SYNTAX');
    });

    it('should fail on missing value', () => {
      const result = parseFilter('userName eq');
      expect(result.isLeft()).toBe(true);
    });

    it('should fail on unexpected remaining input', () => {
      const result = parseFilter('userName eq "test" extra');
      expect(result.isLeft()).toBe(true);
      expect((result.value as ParserError).code).toBe('INVALID_SYNTAX');
      expect((result.value as ParserError).message).toContain(
        'Unexpected input remaining'
      );
    });

    it('should fail on malformed logical expression', () => {
      const result = parseFilter('userName eq "test" and');
      expect(result.isLeft()).toBe(true);
      expect((result.value as ParserError).code).toBe('INVALID_SYNTAX');
    });

    it('should fail on unclosed parentheses', () => {
      const result = parseFilter('(userName eq "test"');
      expect(result.isLeft()).toBe(true);
      expect((result.value as ParserError).code).toBe('INVALID_SYNTAX');
    });

    it('should fail on unclosed brackets', () => {
      const result = parseFilter('emails[type eq "work"');
      expect(result.isLeft()).toBe(true);
      expect((result.value as ParserError).code).toBe('INVALID_SYNTAX');
    });

    it('should fail on invalid attribute name', () => {
      const result = parseFilter('123invalid eq "test"');
      expect(result.isLeft()).toBe(true);
      expect((result.value as ParserError).code).toBe('INVALID_SYNTAX');
    });
  });

  describe('Whitespace Handling', () => {
    it('should handle extra whitespace', () => {
      const result = parseFilter('  userName   eq   "test"  ');
      expect((result.get() as AttributeExpression).attrPath.attrName).toBe(
        'userName'
      );
    });

    it('should handle tabs as whitespace', () => {
      const result = parseFilter('userName\teq\t"test"');
      expect((result.get() as AttributeExpression).attrPath.attrName).toBe(
        'userName'
      );
    });
  });
});
