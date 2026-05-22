-- FormaPagamento enum was already created in the add_refresh_tokens migration.
-- This migration handles data normalization for any existing forma_pagamento values.
-- Note: If the column was already converted via DROP/ADD, these UPDATEs are safe no-ops.

-- Normalize existing free-text values to valid enum strings (safe if column is already enum type)
-- These statements will only have effect if run before the column type conversion,
-- or if the migration is used as a reference for manual data migration.

-- This is intentionally left as a marker migration to keep Prisma schema in sync.
-- The actual data migration logic is in scripts/migrate-forma-pagamento.ts
-- which should be run if data needs to be preserved during the conversion.
