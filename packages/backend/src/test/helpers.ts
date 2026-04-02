import jwt from 'jsonwebtoken';
import { Role } from '../generated/prisma/enums';

export const JWT_SECRET = 'test-secret-key-for-testing-only';

// Set JWT_SECRET for test environment
process.env.JWT_SECRET = JWT_SECRET;

/**
 * Generate a JWT token for testing purposes.
 */
export function generateTestJwt(payload: {
  user_id: string;
  tenant_id: string | null;
  role: Role;
}): string {
  return jwt.sign(payload, JWT_SECRET, { expiresIn: '24h' });
}

/**
 * Build an Authorization header value with a Bearer token.
 */
export function authHeader(token: string): string {
  return `Bearer ${token}`;
}

/**
 * Create a mock request context object for testing middleware/services.
 */
export function createRequestContext(overrides: {
  userId: string;
  tenantId: string | null;
  role?: Role;
}) {
  return {
    user_id: overrides.userId,
    tenant_id: overrides.tenantId,
    role: overrides.role ?? Role.OWNER,
  };
}
