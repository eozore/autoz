/**
 * Soft-delete helper utilities.
 * 
 * Since Prisma 6.x removed $use middleware, we use a simpler approach:
 * - Export a `notDeleted` filter to add to queries
 * - Export a `softDelete` function to set deleted_at instead of hard-deleting
 * - The restore endpoints use raw queries to bypass any filtering
 */

export const SOFT_DELETE_MODELS = ['Service', 'Client', 'Vehicle', 'InventoryItem', 'Bill', 'Appointment'];

/**
 * Filter condition to exclude soft-deleted records.
 * Add this to `where` clauses: { ...notDeleted }
 */
export const notDeleted = { deleted_at: null } as const;

/**
 * Soft-delete data payload.
 * Use with prisma.entity.update({ data: softDeleteData() })
 */
export function softDeleteData() {
  return { deleted_at: new Date() };
}

/**
 * Restore data payload.
 * Use with prisma.entity.update({ data: restoreData() })
 */
export function restoreData() {
  return { deleted_at: null };
}
