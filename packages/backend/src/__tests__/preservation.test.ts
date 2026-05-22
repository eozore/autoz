import { describe, it, expect } from 'vitest';
import fc from 'fast-check';
import request from 'supertest';
import app from '../index';
import { slugify } from '../lib/slug';
import { createFullTenantSetup } from '../test/factories';
import { generateTestJwt, authHeader } from '../test/helpers';
import { Role } from '../generated/prisma/enums';

/**
 * Preservation Property Tests
 *
 * These tests capture the CURRENT correct behavior that must be preserved
 * after bug fixes. They MUST PASS on the unfixed code.
 *
 * Validates: Requirements 3.1, 3.2, 3.3, 3.5, 3.10
 */

describe('Preservation Properties', () => {
  // ─── Property 2.1: Auth flow preservation ────────────────────────────
  // For valid email/password combos, register → login → access protected route succeeds
  describe('Auth flow preservation', () => {
    it('register → login → protected route succeeds for valid credentials', async () => {
      await fc.assert(
        fc.asyncProperty(
          // Generate valid email local parts (alphanumeric, 3-10 chars)
          fc.stringMatching(/^[a-z][a-z0-9]{2,9}$/),
          // Generate valid passwords (8-20 chars, must have uppercase, digit, special char)
          fc.stringMatching(/^[A-Z][a-z]{2,5}[0-9]{2}[!@#]$/),
          // Generate valid names (2-20 chars)
          fc.stringMatching(/^[A-Z][a-z]{1,19}$/),
          async (emailLocal, senha, nome) => {
            const email = `${emailLocal}@preservation-test.com`;

            // Step 1: Register
            const registerRes = await request(app).post('/auth/register').send({
              email,
              senha,
              nome,
              idade: 25,
              celular: '+5511999990000',
            });

            expect(registerRes.status).toBe(201);
            expect(registerRes.body.token).toBeDefined();
            expect(registerRes.body.user).toBeDefined();
            expect(registerRes.body.user.email).toBe(email);
            expect(registerRes.body.user.role).toBe('OWNER');

            // Step 2: Login with same credentials
            const loginRes = await request(app).post('/auth/login').send({
              email,
              senha,
            });

            expect(loginRes.status).toBe(200);
            expect(loginRes.body.token).toBeDefined();
            expect(loginRes.body.user.email).toBe(email);

            // Step 3: Access protected route (upload is a setup route, works without tenant)
            const token = loginRes.body.token;
            const protectedRes = await request(app)
              .post('/upload')
              .set('Authorization', authHeader(token));

            // 400 because no file attached, but NOT 401/403 — auth succeeded
            expect(protectedRes.status).toBe(400);
          }
        ),
        { numRuns: 5 }
      );
    });
  });

  // ─── Property 2.2: Upload valid JPEG images ─────────────────────────
  // For buffers starting with JPEG magic bytes + arbitrary tail, upload returns 201 + URL
  describe('Upload valid JPEG images', () => {
    it('buffers starting with JPEG magic bytes return 201 + URL', async () => {
      const { tenant, user } = await createFullTenantSetup();
      const token = generateTestJwt({
        user_id: user.id,
        tenant_id: tenant.id,
        role: Role.OWNER,
      });

      await fc.assert(
        fc.asyncProperty(
          // Generate arbitrary tail bytes (0-100 bytes)
          fc.uint8Array({ minLength: 0, maxLength: 100 }),
          async (tail) => {
            // JPEG magic bytes: 0xFF 0xD8 0xFF
            const jpegHeader = Buffer.from([0xff, 0xd8, 0xff, 0xe0]);
            const jpegBuffer = Buffer.concat([jpegHeader, Buffer.from(tail)]);

            const res = await request(app)
              .post('/upload')
              .set('Authorization', authHeader(token))
              .attach('file', jpegBuffer, {
                filename: 'test.jpg',
                contentType: 'image/jpeg',
              });

            expect(res.status).toBe(201);
            expect(res.body.url).toBeDefined();
            expect(typeof res.body.url).toBe('string');
            expect(res.body.url).toMatch(/\.jpg$/);
          }
        ),
        { numRuns: 5 }
      );
    });
  });

  // ─── Property 2.3: Upload valid PNG images ──────────────────────────
  // For buffers starting with PNG magic bytes + arbitrary tail, upload returns 201 + URL
  describe('Upload valid PNG images', () => {
    it('buffers starting with PNG magic bytes return 201 + URL', async () => {
      const { tenant, user } = await createFullTenantSetup();
      const token = generateTestJwt({
        user_id: user.id,
        tenant_id: tenant.id,
        role: Role.OWNER,
      });

      await fc.assert(
        fc.asyncProperty(
          // Generate arbitrary tail bytes (0-100 bytes)
          fc.uint8Array({ minLength: 0, maxLength: 100 }),
          async (tail) => {
            // PNG magic bytes: 0x89 0x50 0x4E 0x47 0x0D 0x0A 0x1A 0x0A
            const pngHeader = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
            const pngBuffer = Buffer.concat([pngHeader, Buffer.from(tail)]);

            const res = await request(app)
              .post('/upload')
              .set('Authorization', authHeader(token))
              .attach('file', pngBuffer, {
                filename: 'test.png',
                contentType: 'image/png',
              });

            // NOTE: On current unfixed code, PNG uploads are rejected by the
            // upload test (see upload.test.ts "should reject non-JPEG file").
            // But looking at the upload route, ALLOWED_TYPES includes 'image/png'.
            // The existing test uses a fake buffer without PNG magic bytes.
            // With proper PNG magic bytes + correct contentType, it should work.
            expect(res.status).toBe(201);
            expect(res.body.url).toBeDefined();
            expect(typeof res.body.url).toBe('string');
            expect(res.body.url).toMatch(/\.png$/);
          }
        ),
        { numRuns: 5 }
      );
    });
  });

  // ─── Property 2.4: Slugify produces valid output ────────────────────
  // For arbitrary strings, slugify(s) produces lowercase alphanumeric-hyphen
  // output with no leading/trailing hyphens
  describe('Slugify produces valid output', () => {
    it('for arbitrary strings, output is lowercase alphanumeric-hyphen with no leading/trailing hyphens', () => {
      fc.assert(
        fc.property(
          fc.string({ minLength: 0, maxLength: 200 }),
          (input) => {
            const result = slugify(input);

            // Result should only contain lowercase letters, digits, and hyphens
            expect(result).toMatch(/^[a-z0-9-]*$/);

            // No leading hyphens
            if (result.length > 0) {
              expect(result[0]).not.toBe('-');
            }

            // No trailing hyphens
            if (result.length > 0) {
              expect(result[result.length - 1]).not.toBe('-');
            }

            // No consecutive hyphens
            expect(result).not.toMatch(/--/);
          }
        ),
        { numRuns: 20 }
      );
    });
  });

  // ─── Property 2.5: Health check returns 200 when DB is accessible ───
  // When DB is accessible, /health returns 200 with { status: 'ok' }
  describe('Health check when DB is accessible', () => {
    it('returns 200 with status ok when database is reachable', async () => {
      const res = await request(app).get('/health');

      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty('status', 'ok');
    });
  });
});
