import { describe, it, expect } from 'vitest';
import request from 'supertest';
import jwt from 'jsonwebtoken';
import app from '../index';
import { prisma } from '../test/setup';
import { createUser, createTenant } from '../test/factories';
import { generateRefreshToken, hashRefreshToken } from '../lib/refreshToken';

describe('POST /auth/refresh', () => {
  it('should refresh a valid token and return 200 with new token pair', async () => {
    const user = await createUser();

    // Create a valid refresh token in the DB
    const rawToken = generateRefreshToken();
    const tokenHash = hashRefreshToken(rawToken);
    const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);

    await prisma.refreshToken.create({
      data: {
        user_id: user.id,
        token_hash: tokenHash,
        expires_at: expiresAt,
      },
    });

    const res = await request(app)
      .post('/auth/refresh')
      .send({ refresh_token: rawToken });

    expect(res.status).toBe(200);
    expect(res.body.token).toBeDefined();
    expect(res.body.refresh_token).toBeDefined();
    expect(typeof res.body.token).toBe('string');
    expect(typeof res.body.refresh_token).toBe('string');

    // Verify new access token has correct claims
    const payload = jwt.decode(res.body.token) as Record<string, unknown>;
    expect(payload.user_id).toBe(user.id);
    expect(payload.role).toBe('OWNER');
  });

  it('should return updated tenant_id if user was assigned to a tenant', async () => {
    const tenant = await createTenant();
    const user = await createUser({ tenantId: tenant.id });

    // Create a valid refresh token in the DB
    const rawToken = generateRefreshToken();
    const tokenHash = hashRefreshToken(rawToken);
    const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);

    await prisma.refreshToken.create({
      data: {
        user_id: user.id,
        token_hash: tokenHash,
        expires_at: expiresAt,
      },
    });

    const res = await request(app)
      .post('/auth/refresh')
      .send({ refresh_token: rawToken });

    expect(res.status).toBe(200);

    // New token should reflect the current tenant_id from the database
    const payload = jwt.decode(res.body.token) as Record<string, unknown>;
    expect(payload.user_id).toBe(user.id);
    expect(payload.tenant_id).toBe(tenant.id);
    expect(payload.role).toBe('OWNER');
  });

  it('should rotate the refresh token (old token invalidated)', async () => {
    const user = await createUser();

    const rawToken = generateRefreshToken();
    const tokenHash = hashRefreshToken(rawToken);
    const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);

    await prisma.refreshToken.create({
      data: {
        user_id: user.id,
        token_hash: tokenHash,
        expires_at: expiresAt,
      },
    });

    // First refresh should succeed
    const res = await request(app)
      .post('/auth/refresh')
      .send({ refresh_token: rawToken });

    expect(res.status).toBe(200);

    // Using the same old token again should fail (rotation)
    const res2 = await request(app)
      .post('/auth/refresh')
      .send({ refresh_token: rawToken });

    expect(res2.status).toBe(401);
    expect(res2.body.error).toBe('Token inválido ou expirado');
  });

  it('should return 401 for an invalid refresh token', async () => {
    const res = await request(app)
      .post('/auth/refresh')
      .send({ refresh_token: 'not-a-valid-refresh-token' });

    expect(res.status).toBe(401);
    expect(res.body.error).toBe('Token inválido ou expirado');
  });

  it('should return 401 for an expired refresh token', async () => {
    const user = await createUser();

    const rawToken = generateRefreshToken();
    const tokenHash = hashRefreshToken(rawToken);
    // Expired 1 hour ago
    const expiresAt = new Date(Date.now() - 60 * 60 * 1000);

    await prisma.refreshToken.create({
      data: {
        user_id: user.id,
        token_hash: tokenHash,
        expires_at: expiresAt,
      },
    });

    const res = await request(app)
      .post('/auth/refresh')
      .send({ refresh_token: rawToken });

    expect(res.status).toBe(401);
    expect(res.body.error).toBe('Token inválido ou expirado');
  });

  it('should return 400 for missing refresh_token in body', async () => {
    const res = await request(app)
      .post('/auth/refresh')
      .send({});

    expect(res.status).toBe(400);
    expect(res.body.error).toBe('Dados inválidos');
  });

  it('should return 400 for empty refresh_token string', async () => {
    const res = await request(app)
      .post('/auth/refresh')
      .send({ refresh_token: '' });

    expect(res.status).toBe(400);
    expect(res.body.error).toBe('Dados inválidos');
  });
});
