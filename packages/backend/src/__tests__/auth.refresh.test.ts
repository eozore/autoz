import { describe, it, expect } from 'vitest';
import request from 'supertest';
import jwt from 'jsonwebtoken';
import app from '../index';
import { createUser, createTenant } from '../test/factories';
import { generateTestJwt, JWT_SECRET } from '../test/helpers';

describe('POST /auth/refresh', () => {
  it('should refresh a valid token and return 200 with a new token', async () => {
    const user = await createUser();

    const originalToken = generateTestJwt({
      user_id: user.id,
      tenant_id: user.tenant_id,
      role: user.role,
    });

    const res = await request(app)
      .post('/auth/refresh')
      .send({ token: originalToken });

    expect(res.status).toBe(200);
    expect(res.body.token).toBeDefined();
    expect(typeof res.body.token).toBe('string');

    // Verify new token has correct claims
    const payload = jwt.decode(res.body.token) as Record<string, unknown>;
    expect(payload.user_id).toBe(user.id);
    expect(payload.tenant_id).toBeNull();
    expect(payload.role).toBe('OWNER');
  });

  it('should return updated tenant_id if user was assigned to a tenant since token was issued', async () => {
    const tenant = await createTenant();
    const user = await createUser({ tenantId: tenant.id });

    // Generate a token with tenant_id NULL (as if issued before company setup)
    const oldToken = generateTestJwt({
      user_id: user.id,
      tenant_id: null,
      role: user.role,
    });

    const res = await request(app)
      .post('/auth/refresh')
      .send({ token: oldToken });

    expect(res.status).toBe(200);

    // New token should reflect the current tenant_id from the database
    const payload = jwt.decode(res.body.token) as Record<string, unknown>;
    expect(payload.user_id).toBe(user.id);
    expect(payload.tenant_id).toBe(tenant.id);
    expect(payload.role).toBe('OWNER');
  });

  it('should return 401 for an invalid token', async () => {
    const res = await request(app)
      .post('/auth/refresh')
      .send({ token: 'not.a.valid.jwt.token' });

    expect(res.status).toBe(401);
    expect(res.body.error).toBe('Token inválido ou expirado');
  });

  it('should return 401 for an expired token', async () => {
    const user = await createUser();

    // Sign a token that is already expired
    const expiredToken = jwt.sign(
      { user_id: user.id, tenant_id: null, role: 'OWNER' },
      JWT_SECRET,
      { expiresIn: '0s' }
    );

    // Small delay to ensure the token is expired
    await new Promise((resolve) => setTimeout(resolve, 50));

    const res = await request(app)
      .post('/auth/refresh')
      .send({ token: expiredToken });

    expect(res.status).toBe(401);
    expect(res.body.error).toBe('Token inválido ou expirado');
  });

  it('should return 401 if user no longer exists in the database', async () => {
    // Generate a token for a non-existent user
    const fakeToken = generateTestJwt({
      user_id: '00000000-0000-0000-0000-000000000000',
      tenant_id: null,
      role: 'OWNER',
    });

    const res = await request(app)
      .post('/auth/refresh')
      .send({ token: fakeToken });

    expect(res.status).toBe(401);
    expect(res.body.error).toBe('Token inválido ou expirado');
  });

  it('should return 400 for missing token in body', async () => {
    const res = await request(app)
      .post('/auth/refresh')
      .send({});

    expect(res.status).toBe(400);
    expect(res.body.error).toBe('Dados inválidos');
  });

  it('should return 400 for empty token string', async () => {
    const res = await request(app)
      .post('/auth/refresh')
      .send({ token: '' });

    expect(res.status).toBe(400);
    expect(res.body.error).toBe('Dados inválidos');
  });
});
