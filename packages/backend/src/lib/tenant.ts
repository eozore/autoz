/**
 * Returns a Prisma-compatible where filter for tenant isolation.
 */
export function tenantFilter(tenantId: string): { tenant_id: string } {
  return { tenant_id: tenantId };
}

/**
 * Validates that the requesting user's tenant matches the resource's tenant.
 * Returns false if either value is null.
 */
export function validateTenantAccess(
  requestTenantId: string | null,
  resourceTenantId: string
): boolean {
  if (requestTenantId === null) {
    return false;
  }
  return requestTenantId === resourceTenantId;
}
