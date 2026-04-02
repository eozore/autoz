import { Request, Response, NextFunction } from 'express';
import { verifyJwt } from '../lib/jwt';
import { Role } from '../generated/prisma/enums';

/**
 * Routes that are allowed without a tenant_id (user hasn't set up a company yet).
 * Matched by method + path prefix.
 */
const SETUP_ROUTES: Array<{ method: string; path: string }> = [
  { method: 'POST', path: '/companies' },
  { method: 'POST', path: '/upload' },
];

function isSetupRoute(method: string, originalUrl: string): boolean {
  return SETUP_ROUTES.some(
    (route) =>
      route.method === method.toUpperCase() &&
      (originalUrl === route.path || originalUrl.startsWith(route.path + '?'))
  );
}

/**
 * Authentication middleware that:
 * 1. Extracts Bearer token from Authorization header
 * 2. Verifies JWT signature and expiration
 * 3. Injects user_id, tenant_id, and role into req.context
 * 4. Returns 401 for missing/invalid tokens
 * 5. Returns 403 if tenant_id is null and route is not a setup route
 */
export function authMiddleware(
  req: Request,
  res: Response,
  next: NextFunction
): void {
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    res.status(401).json({ error: 'Token não fornecido' });
    return;
  }

  const token = authHeader.slice(7);

  let payload;
  try {
    payload = verifyJwt(token);
  } catch {
    res.status(401).json({ error: 'Token inválido ou expirado' });
    return;
  }

  // Check if user has a tenant — if not, only allow setup routes
  if (payload.tenant_id === null && !isSetupRoute(req.method, req.originalUrl || req.path)) {
    res.status(403).json({ error: 'Configure sua empresa primeiro' });
    return;
  }

  req.context = {
    user_id: payload.user_id,
    tenant_id: payload.tenant_id,
    role: payload.role as Role,
  };

  next();
}
