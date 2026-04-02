import { PrismaClient } from '../generated/prisma/client';
import { beforeAll, afterAll, beforeEach } from 'vitest';
import { execSync } from 'child_process';
import path from 'path';

const TEST_DATABASE_URL =
  process.env.TEST_DATABASE_URL ||
  'postgresql://postgres:postgres@localhost:5432/smp_test?schema=public';

// Override DATABASE_URL for tests
process.env.DATABASE_URL = TEST_DATABASE_URL;

export const prisma = new PrismaClient({
  datasourceUrl: TEST_DATABASE_URL,
});

// All table names in the correct deletion order (respecting FK constraints)
const TABLE_NAMES = [
  'appointments',
  'stock_movements',
  'bills',
  'inventory_items',
  'vehicles',
  'clients',
  'services',
  'locations',
  'companies',
  'users',
  'tenants',
] as const;

export async function cleanDatabase() {
  for (const table of TABLE_NAMES) {
    await prisma.$executeRawUnsafe(`TRUNCATE TABLE "${table}" CASCADE`);
  }
}

/**
 * Push the Prisma schema to the test database (creates tables if they don't exist).
 * Uses `prisma db push` which is ideal for test environments.
 */
function pushSchema() {
  const backendRoot = path.resolve(__dirname, '../..');
  execSync('npx prisma db push --skip-generate --accept-data-loss', {
    cwd: backendRoot,
    env: { ...process.env, DATABASE_URL: TEST_DATABASE_URL },
    stdio: 'pipe',
  });
}

beforeAll(async () => {
  try {
    pushSchema();
    await prisma.$connect();
  } catch (error) {
    console.error(
      'Failed to connect to test database. Make sure PostgreSQL is running and the smp_test database exists.',
      error
    );
    throw error;
  }
});

afterAll(async () => {
  await prisma.$disconnect();
});

beforeEach(async () => {
  await cleanDatabase();
});
