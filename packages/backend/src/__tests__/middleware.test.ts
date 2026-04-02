import { describe, it, expect, vi, beforeEach } from 'vitest';
import { Request, Response, NextFunction } from 'express';
import { authMiddleware } from '../middleware/auth';
import { tenantFilter, validateTenantAccess } from '../lib/tenant';
import { JWT_SECRET } from '../test/helpers';
import jwt from 'jsonwebtoken';
import { Role } from '../generated/prisma/enums';

// ==================== Helpers ====================

function createMockReq(overrides: Partial<Request> = {}): Request {
  return {
    headers: {},
    method: 'GET',
    path: '/services',
    ...overrides,
  } as unknown as Request;
}

function createMockRes(): Response & { _status: number; _json: unknown } {
  const res = {
    _status: 0,
    _json: null as unknown,
    status(code: number) {
      res._status = code;
      return res;
    },
    json(body: unknown) {
      res._json = body;
      return res;
    },
  };
  return res as unknown as Response & { _status: number; _json: unknown };
}

function signToken(payload: object, options?: jwt.SignOptions): string {
  return jwt.sign(payload, JWT_SECRET, { expiresIn: '24h', ...options });
}

// ==================== authMiddleware ====================

describe('authMiddleware', () => {
  let next: NextFunction;

  beforeEach(() => {
    next = vi.fn();
  });

  it('should pass through with valid token and tenant_id', () => {
    const token = signToken({
      user_id: 'user-1',
      tenant_id: 'tenant-1',
      role: Role.OWNER,
    });
    const req = createMockReq({
      headers: { authorization: `Bearer ${token}` },
    });
    const res = createMockRes();

    authMiddleware(req, res, next);

    expect(next).toHaveBeenCalled();
    expect(req.context).toEqual({
      user_id: 'user-1',
      tenant_id: 'tenant-1',
      role: Role.OWNER,
    });
  });

  it('should pass through with valid token without tenant_id on setup route (POST /companies)', () => {
    const token = signToken({
      user_id: 'user-1',
      tenant_id: null,
      role: Role.OWNER,
    });
    const req = createMockReq({
      headers: { authorization: `Bearer ${token}` },
      method: 'POST',
      path: '/companies',
    });
    const res = createMockRes();

    authMiddleware(req, res, next);

    expect(next).toHaveBeenCalled();
    expect(req.context).toEqual({
      user_id: 'user-1',
      tenant_id: null,
      role: Role.OWNER,
    });
  });

  it('should return 403 with valid token without tenant_id on non-setup route', () => {
    const token = signToken({
      user_id: 'user-1',
      tenant_id: null,
      role: Role.OWNER,
    });
    const req = createMockReq({
      headers: { authorization: `Bearer ${token}` },
      method: 'GET',
      path: '/services',
    });
    const res = createMockRes();

    authMiddleware(req, res, next);

    expect(next).not.toHaveBeenCalled();
    expect(res._status).toBe(403);
    expect(res._json).toEqual({ error: 'Configure sua empresa primeiro' });
  });

  it('should return 401 when Authorization header is missing', () => {
    const req = createMockReq({ headers: {} });
    const res = createMockRes();

    authMiddleware(req, res, next);

    expect(next).not.toHaveBeenCalled();
    expect(res._status).toBe(401);
    expect(res._json).toEqual({ error: 'Token não fornecido' });
  });

  it('should return 401 when Authorization header has no Bearer prefix', () => {
    const req = createMockReq({
      headers: { authorization: 'Basic abc123' },
    });
    const res = createMockRes();

    authMiddleware(req, res, next);

    expect(next).not.toHaveBeenCalled();
    expect(res._status).toBe(401);
    expect(res._json).toEqual({ error: 'Token não fornecido' });
  });

  it('should return 401 for an invalid token', () => {
    const req = createMockReq({
      headers: { authorization: 'Bearer invalid.token.here' },
    });
    const res = createMockRes();

    authMiddleware(req, res, next);

    expect(next).not.toHaveBeenCalled();
    expect(res._status).toBe(401);
    expect(res._json).toEqual({ error: 'Token inválido ou expirado' });
  });

  it('should return 401 for an expired token', () => {
    const token = jwt.sign(
      { user_id: 'user-1', tenant_id: 'tenant-1', role: Role.OWNER },
      JWT_SECRET,
      { expiresIn: '0s' }
    );
    const req = createMockReq({
      headers: { authorization: `Bearer ${token}` },
    });
    const res = createMockRes();

    // Small delay to ensure token is expired
    authMiddleware(req, res, next);

    expect(next).not.toHaveBeenCalled();
    expect(res._status).toBe(401);
  });
});

// ==================== tenantFilter ====================

describe('tenantFilter', () => {
  it('should return a where clause with tenant_id', () => {
    expect(tenantFilter('tenant-abc')).toEqual({ tenant_id: 'tenant-abc' });
  });
});

// ==================== validateTenantAccess ====================

describe('validateTenantAccess', () => {
  it('should return true for matching tenant_ids', () => {
    expect(validateTenantAccess('tenant-1', 'tenant-1')).toBe(true);
  });

  it('should return false for mismatching tenant_ids', () => {
    expect(validateTenantAccess('tenant-1', 'tenant-2')).toBe(false);
  });

  it('should return false when request tenant_id is null', () => {
    expect(validateTenantAccess(null, 'tenant-1')).toBe(false);
  });
});
