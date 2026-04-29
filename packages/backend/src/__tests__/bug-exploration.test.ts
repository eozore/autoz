import { describe, it, expect, vi } from 'vitest';
import request from 'supertest';
import app from '../index';
import { createFullTenantSetup } from '../test/factories';
import { generateTestJwt, authHeader } from '../test/helpers';
import { Role } from '../generated/prisma/enums';

/**
 * Bug Condition Exploration Tests
 *
 * These tests encode the EXPECTED (correct) behavior.
 * They MUST FAIL on the current unfixed code — failure confirms the bugs exist.
 *
 * Validates: Requirements 1.1, 1.8, 1.11, 1.12
 */

describe('Bug Condition Exploration', () => {
  // ─── Test 1.1: JWT Secret fallback ───────────────────────────────────
  // Bug: getSecret() returns a hardcoded fallback when JWT_SECRET is unset
  // Expected: getSecret() should throw an Error when JWT_SECRET is missing
  describe('1.1 — getSecret() must throw when JWT_SECRET is unset', () => {
    it('should throw an Error when JWT_SECRET is not defined', async () => {
      // Save and delete JWT_SECRET
      const originalSecret = process.env.JWT_SECRET;
      const originalVitest = process.env.VITEST;
      delete process.env.JWT_SECRET;
      delete process.env.VITEST;

      try {
        // Re-import the module to get fresh getSecret behavior
        // We test through signJwt since getSecret is not exported
        const jwtModule = await import('../lib/jwt');

        // This SHOULD throw because JWT_SECRET is not set
        // On unfixed code, it will NOT throw (uses fallback) → test FAILS
        expect(() =>
          jwtModule.signJwt({ user_id: 'u1', tenant_id: 't1', role: 'OWNER' })
        ).toThrow('JWT_SECRET');
      } finally {
        // Restore env
        if (originalSecret !== undefined) {
          process.env.JWT_SECRET = originalSecret;
        }
        if (originalVitest !== undefined) {
          process.env.VITEST = originalVitest;
        }
      }
    });
  });

  // ─── Test 1.8: Health check without DB verification ──────────────────
  // Bug: GET /health returns { status: 'ok' } with 200 even when DB is unreachable
  // Expected: Should return 503 when DB is unreachable
  describe('1.8 — GET /health must return 503 when DB is unreachable', () => {
    it('should return 503 when database is unreachable', async () => {
      // Mock prisma.$queryRaw to simulate DB failure
      const { prisma } = await import('../lib/prisma');
      const queryRawSpy = vi
        .spyOn(prisma, '$queryRaw')
        .mockRejectedValueOnce(new Error('Connection refused'));

      try {
        const res = await request(app).get('/health');

        // Expected: 503 with unhealthy status
        // On unfixed code: returns 200 with { status: 'ok' } → test FAILS
        expect(res.status).toBe(503);
      } finally {
        queryRawSpy.mockRestore();
      }
    });
  });

  // ─── Test 1.11: Upload accepts forged mimetype ───────────────────────
  // Bug: Upload validates only the mimetype header, not actual file content
  // Expected: Should reject files whose magic bytes don't match declared mimetype
  describe('1.11 — Upload must reject files with forged mimetype', () => {
    it('should return 400 when file content does not match declared mimetype', async () => {
      const { tenant, user } = await createFullTenantSetup();
      const token = generateTestJwt({
        user_id: user.id,
        tenant_id: tenant.id,
        role: Role.OWNER,
      });

      // Create a buffer with arbitrary bytes (NOT valid JPEG magic bytes)
      // Valid JPEG starts with 0xFF 0xD8 0xFF — this does not
      const forgedBuffer = Buffer.from([0xde, 0xad, 0xbe, 0xef]);

      const res = await request(app)
        .post('/upload')
        .set('Authorization', authHeader(token))
        .attach('file', forgedBuffer, {
          filename: 'malicious.jpg',
          contentType: 'image/jpeg',
        });

      // Expected: 400 rejection because magic bytes don't match
      // On unfixed code: returns 201 (accepts based on mimetype alone) → test FAILS
      expect(res.status).toBe(400);
    });
  });

  // ─── Test 1.12: Slug uses Math.random() instead of crypto ───────────
  // Bug: generateSlug() uses Math.random() for suffix generation
  // Expected: Should use crypto.randomBytes() for cryptographically secure slugs
  describe('1.12 — generateSlug() must use crypto.randomBytes, not Math.random', () => {
    it('should NOT call Math.random for collision suffix generation', async () => {
      const { generateSlug } = await import('../lib/slug');
      const { prisma } = await import('../lib/prisma');

      // Create a tenant so the base slug collides
      await prisma.tenant.create({ data: { slug: 'existing-name' } });

      const mathRandomSpy = vi.spyOn(Math, 'random');

      try {
        await generateSlug('existing-name');

        // Expected: Math.random should NOT be called (should use crypto instead)
        // On unfixed code: Math.random IS called → test FAILS
        expect(mathRandomSpy).not.toHaveBeenCalled();
      } finally {
        mathRandomSpy.mockRestore();
      }
    });
  });
});
