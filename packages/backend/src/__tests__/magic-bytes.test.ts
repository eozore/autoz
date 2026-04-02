import { describe, it, expect } from 'vitest';
import fc from 'fast-check';
import { validateMagicBytes } from '../routes/upload';

/**
 * Property-based tests for validateMagicBytes
 *
 * Validates: Requirements 2.11
 */

const JPEG_MAGIC = [0xFF, 0xD8, 0xFF];
const PNG_MAGIC = [0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A];

describe('validateMagicBytes — property-based tests', () => {
  it('accepts any buffer starting with JPEG magic bytes as image/jpeg', () => {
    fc.assert(
      fc.property(
        fc.uint8Array({ minLength: 0, maxLength: 200 }),
        (tail) => {
          const buffer = Buffer.concat([Buffer.from(JPEG_MAGIC), Buffer.from(tail)]);
          expect(validateMagicBytes(buffer, 'image/jpeg')).toBe(true);
        }
      ),
      { numRuns: 10 }
    );
  });

  it('accepts any buffer starting with PNG magic bytes as image/png', () => {
    fc.assert(
      fc.property(
        fc.uint8Array({ minLength: 0, maxLength: 200 }),
        (tail) => {
          const buffer = Buffer.concat([Buffer.from(PNG_MAGIC), Buffer.from(tail)]);
          expect(validateMagicBytes(buffer, 'image/png')).toBe(true);
        }
      ),
      { numRuns: 10 }
    );
  });

  it('rejects buffers NOT starting with valid magic bytes for both mimetypes', () => {
    fc.assert(
      fc.property(
        fc.uint8Array({ minLength: 1, maxLength: 200 }).filter((arr) => {
          const buf = Buffer.from(arr);
          // Ensure buffer does NOT start with JPEG magic bytes
          const startsWithJpeg = JPEG_MAGIC.every((b, i) => buf[i] === b);
          // Ensure buffer does NOT start with PNG magic bytes
          const startsWithPng = PNG_MAGIC.every((b, i) => buf[i] === b);
          return !startsWithJpeg && !startsWithPng;
        }),
        (arr) => {
          const buffer = Buffer.from(arr);
          expect(validateMagicBytes(buffer, 'image/jpeg')).toBe(false);
          expect(validateMagicBytes(buffer, 'image/png')).toBe(false);
        }
      ),
      { numRuns: 10 }
    );
  });
});
