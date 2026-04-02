import { randomBytes } from 'crypto';
import { prisma } from './prisma';

/**
 * Converts a company name into a URL-friendly slug.
 * 1. Normalize unicode (NFD) and remove diacritics
 * 2. Convert to lowercase
 * 3. Replace spaces and special chars with hyphens
 * 4. Remove consecutive hyphens
 * 5. Trim hyphens from start/end
 */
export function slugify(name: string): string {
  return name
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '') // remove diacritics
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-') // replace non-alphanumeric with hyphens
    .replace(/-+/g, '-') // collapse consecutive hyphens
    .replace(/^-|-$/g, ''); // trim leading/trailing hyphens
}

/**
 * Generates a unique slug for a tenant.
 * If the base slug already exists, appends a cryptographically secure suffix
 * and retries up to 5 times to ensure uniqueness.
 */
export async function generateSlug(name: string): Promise<string> {
  const base = slugify(name);
  const MAX_RETRIES = 5;

  const existing = await prisma.tenant.findUnique({
    where: { slug: base },
  });

  if (!existing) {
    return base;
  }

  for (let i = 0; i < MAX_RETRIES; i++) {
    const suffix = randomBytes(4).toString('hex');
    const candidate = `${base}-${suffix}`;
    const collision = await prisma.tenant.findUnique({
      where: { slug: candidate },
    });
    if (!collision) {
      return candidate;
    }
  }

  throw new Error(`Failed to generate unique slug for "${name}" after ${MAX_RETRIES} attempts`);
}
