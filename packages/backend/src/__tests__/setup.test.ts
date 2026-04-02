import { describe, it, expect } from 'vitest';
import { prisma } from '../test/setup';
import { createTenant, createUser, createFullTenantSetup } from '../test/factories';
import { generateTestJwt, authHeader } from '../test/helpers';
import { Role } from '../generated/prisma/enums';

describe('Test Environment Setup', () => {
  it('should connect to the test database', async () => {
    const result = await prisma.$queryRaw<[{ result: number }]>`SELECT 1 as result`;
    expect(result[0].result).toBe(1);
  });

  it('should clean database between tests', async () => {
    await createTenant({ slug: 'cleanup-test' });
    const tenants = await prisma.tenant.findMany();
    expect(tenants).toHaveLength(1);
  });

  it('should have an empty database after cleanup', async () => {
    const tenants = await prisma.tenant.findMany();
    expect(tenants).toHaveLength(0);
  });

  it('should create entities using factory functions', async () => {
    const { tenant, company, location, user } = await createFullTenantSetup();

    expect(tenant.id).toBeDefined();
    expect(company.tenant_id).toBe(tenant.id);
    expect(location.tenant_id).toBe(tenant.id);
    expect(location.is_primary).toBe(true);
    expect(user.tenant_id).toBe(tenant.id);
    expect(user.role).toBe(Role.OWNER);
  });

  it('should generate valid JWT tokens for testing', () => {
    const token = generateTestJwt({
      user_id: 'test-user-id',
      tenant_id: 'test-tenant-id',
      role: Role.OWNER,
    });

    expect(token).toBeDefined();
    expect(typeof token).toBe('string');
    expect(authHeader(token)).toMatch(/^Bearer .+/);
  });
});
