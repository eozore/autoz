import { randomBytes, createHash } from 'crypto';

const TOKEN_BYTES = 32;

export function generateRefreshToken(): string {
  return randomBytes(TOKEN_BYTES).toString('hex');
}

export function hashRefreshToken(token: string): string {
  return createHash('sha256').update(token).digest('hex');
}
