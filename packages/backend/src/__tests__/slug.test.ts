import { describe, it, expect } from 'vitest';
import fc from 'fast-check';
import { slugify } from '../lib/slug';

/**
 * Property-based tests for slugify function.
 *
 * Validates: Requirements 2.12
 */
describe('slugify property-based tests', () => {
  it('always produces lowercase, alphanumeric-hyphen output', () => {
    fc.assert(
      fc.property(fc.string({ minLength: 0, maxLength: 200 }), (name) => {
        const result = slugify(name);
        expect(result).toMatch(/^[a-z0-9-]*$/);
      }),
      { numRuns: 20 }
    );
  });

  it('never has leading or trailing hyphens', () => {
    fc.assert(
      fc.property(fc.string({ minLength: 0, maxLength: 200 }), (name) => {
        const result = slugify(name);
        if (result.length > 0) {
          expect(result[0]).not.toBe('-');
          expect(result[result.length - 1]).not.toBe('-');
        }
      }),
      { numRuns: 20 }
    );
  });

  it('never contains consecutive hyphens', () => {
    fc.assert(
      fc.property(fc.string({ minLength: 0, maxLength: 200 }), (name) => {
        const result = slugify(name);
        expect(result).not.toMatch(/--/);
      }),
      { numRuns: 20 }
    );
  });
});
