import { describe, it, expect, vi, beforeEach } from 'vitest';
import { Request, Response, NextFunction } from 'express';
import { fileAccessMiddleware } from '../middleware/fileAccess';
import { JWT_SECRET } from '../test/helpers';
import jwt from 'jsonwebtoken';
import { Role } from '../generated/prisma/enums';

function createMockReq(overrides: Partial<Request> = {}): Request {
  return {
    headers: {},
    path: '/tenant-123/image.jpg',
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

function signToken(payload: object): string {
  return jwt.sign(payload, JWT_SECRET, { expiresIn: '24h' });
}

describe('fileAccessMiddleware', () => {
  let next: NextFunction;

  beforeEach(() => {
    next = vi.fn();
  });

  it('should allow unauthenticated access (public pages)', () => {
    const req = createMockReq({ path: '/tenant-123/image.jpg' });
    const res = createMockRes();

    fileAccessMiddleware(req, res, next);

    expect(next).toHaveBeenCalled();
    expect(res._status).toBe(0);
  });

  it('should allow authenticated access when tenant_id matches file path', () => {
    const token = signToken({
      user_id: 'user-1',
      tenant_id: 'tenant-123',
      role: Role.OWNER,
    });
    const req = createMockReq({
      headers: { authorization: `Bearer ${token}` },
      path: '/tenant-123/image.jpg',
    });
    const res = createMockRes();

    fileAccessMiddleware(req, res, next);

    expect(next).toHaveBeenCalled();
    expect(res._status).toBe(0);
  });

  it('should return 403 when authenticated user tenant_id does not match file path', () => {
    const token = signToken({
      user_id: 'user-1',
      tenant_id: 'tenant-456',
      role: Role.OWNER,
    });
    const req = createMockReq({
      headers: { authorization: `Bearer ${token}` },
      path: '/tenant-123/image.jpg',
    });
    const res = createMockRes();

    fileAccessMiddleware(req, res, next);

    expect(next).not.toHaveBeenCalled();
    expect(res._status).toBe(403);
    expect(res._json).toEqual({ error: 'Acesso negado ao arquivo' });
  });

  it('should use user_id as fallback when tenant_id is null', () => {
    const token = signToken({
      user_id: 'user-1',
      tenant_id: null,
      role: Role.OWNER,
    });
    const req = createMockReq({
      headers: { authorization: `Bearer ${token}` },
      path: '/user-1/image.jpg',
    });
    const res = createMockRes();

    fileAccessMiddleware(req, res, next);

    expect(next).toHaveBeenCalled();
    expect(res._status).toBe(0);
  });

  it('should return 403 when user_id fallback does not match file path', () => {
    const token = signToken({
      user_id: 'user-1',
      tenant_id: null,
      role: Role.OWNER,
    });
    const req = createMockReq({
      headers: { authorization: `Bearer ${token}` },
      path: '/user-2/image.jpg',
    });
    const res = createMockRes();

    fileAccessMiddleware(req, res, next);

    expect(next).not.toHaveBeenCalled();
    expect(res._status).toBe(403);
    expect(res._json).toEqual({ error: 'Acesso negado ao arquivo' });
  });

  it('should return 403 for paths without tenant prefix (no segments)', () => {
    const req = createMockReq({ path: '/image.jpg' });
    const res = createMockRes();

    fileAccessMiddleware(req, res, next);

    expect(next).not.toHaveBeenCalled();
    expect(res._status).toBe(403);
    expect(res._json).toEqual({ error: 'Acesso negado ao arquivo' });
  });

  it('should allow access with invalid token (treat as unauthenticated)', () => {
    const req = createMockReq({
      headers: { authorization: 'Bearer invalid.token.here' },
      path: '/tenant-123/image.jpg',
    });
    const res = createMockRes();

    fileAccessMiddleware(req, res, next);

    expect(next).toHaveBeenCalled();
    expect(res._status).toBe(0);
  });

  it('should handle nested paths correctly', () => {
    const token = signToken({
      user_id: 'user-1',
      tenant_id: 'tenant-123',
      role: Role.OWNER,
    });
    const req = createMockReq({
      headers: { authorization: `Bearer ${token}` },
      path: '/tenant-123/subdir/image.jpg',
    });
    const res = createMockRes();

    fileAccessMiddleware(req, res, next);

    expect(next).toHaveBeenCalled();
    expect(res._status).toBe(0);
  });
});
