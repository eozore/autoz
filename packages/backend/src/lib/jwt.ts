import jwt from 'jsonwebtoken';

function getSecret(): string {
  const secret = process.env.JWT_SECRET;
  if (!secret) {
    if (process.env.VITEST === 'true') {
      return 'test-secret-key-for-automated-tests-only';
    }
    throw new Error('FATAL: JWT_SECRET environment variable is required');
  }
  return secret;
}

export interface JwtPayload {
  user_id: string;
  tenant_id: string | null;
  role: string;
}

export function signJwt(payload: JwtPayload): string {
  return jwt.sign(payload, getSecret(), { expiresIn: '1h' });
}

export function verifyJwt(token: string): JwtPayload {
  return jwt.verify(token, getSecret()) as JwtPayload;
}
