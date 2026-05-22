import { PrismaClient } from '../src/generated/prisma/client';

/**
 * Data migration script for forma_pagamento column.
 *
 * Maps existing free-text values to the FormaPagamento enum values.
 * Unrecognized values are set to NULL.
 *
 * This script should be run AFTER the Prisma migration that creates the enum
 * and converts the column type. The Prisma migration SQL uses a USING clause
 * that handles the conversion, but this script can be used as a pre-migration
 * step to normalize values, or as a standalone data cleanup tool.
 */

export interface MigrationStats {
  totalRecords: number;
  alreadyValid: number;
  mapped: number;
  nullified: number;
}

/**
 * Mapping of free-text values (lowercase) to valid FormaPagamento enum values.
 * Covers common variations users might have entered.
 */
const VALUE_MAP: Record<string, string> = {
  // Direct matches (already valid enum values)
  a_vista: 'A_VISTA',
  parcelado: 'PARCELADO',
  pix: 'PIX',
  cartao_credito: 'CARTAO_CREDITO',
  cartao_debito: 'CARTAO_DEBITO',

  // Common variations
  'a vista': 'A_VISTA',
  'à vista': 'A_VISTA',
  avista: 'A_VISTA',
  dinheiro: 'A_VISTA',
  cartão: 'CARTAO_CREDITO',
  cartao: 'CARTAO_CREDITO',
  'cartão de crédito': 'CARTAO_CREDITO',
  'cartao de credito': 'CARTAO_CREDITO',
  credito: 'CARTAO_CREDITO',
  crédito: 'CARTAO_CREDITO',
  'cartão de débito': 'CARTAO_DEBITO',
  'cartao de debito': 'CARTAO_DEBITO',
  debito: 'CARTAO_DEBITO',
  débito: 'CARTAO_DEBITO',
};

const VALID_ENUM_VALUES = new Set([
  'A_VISTA',
  'PARCELADO',
  'PIX',
  'CARTAO_CREDITO',
  'CARTAO_DEBITO',
]);

export function mapFormaPagamento(value: string | null): string | null {
  if (value === null || value === undefined) return null;

  const trimmed = value.trim();
  if (trimmed === '') return null;

  // Check if already a valid enum value (case-sensitive)
  if (VALID_ENUM_VALUES.has(trimmed)) return trimmed;

  // Check if already a valid enum value (case-insensitive)
  const upper = trimmed.toUpperCase();
  if (VALID_ENUM_VALUES.has(upper)) return upper;

  // Try mapping from known variations
  const lower = trimmed.toLowerCase();
  if (VALUE_MAP[lower]) return VALUE_MAP[lower];

  // Unrecognized value → null
  return null;
}

export async function migrateFormaPagamento(prisma: PrismaClient): Promise<MigrationStats> {
  const stats: MigrationStats = {
    totalRecords: 0,
    alreadyValid: 0,
    mapped: 0,
    nullified: 0,
  };

  // Fetch all appointments with a non-null forma_pagamento
  const appointments = await prisma.appointment.findMany({
    where: { forma_pagamento: { not: null } },
    select: { id: true, forma_pagamento: true },
  });

  stats.totalRecords = appointments.length;

  for (const appt of appointments) {
    const currentValue = appt.forma_pagamento as string | null;
    const mappedValue = mapFormaPagamento(currentValue);

    if (currentValue && VALID_ENUM_VALUES.has(currentValue)) {
      // Already a valid enum value, no change needed
      stats.alreadyValid++;
    } else if (mappedValue !== null) {
      // Mapped to a valid enum value
      await prisma.$executeRawUnsafe(
        `UPDATE "appointments" SET "forma_pagamento" = $1 WHERE "id" = $2`,
        mappedValue,
        appt.id,
      );
      stats.mapped++;
    } else {
      // Unrecognized value → set to null
      await prisma.$executeRawUnsafe(
        `UPDATE "appointments" SET "forma_pagamento" = NULL WHERE "id" = $1`,
        appt.id,
      );
      stats.nullified++;
    }
  }

  return stats;
}

// Run as standalone script
if (require.main === module) {
  const prisma = new PrismaClient();
  migrateFormaPagamento(prisma)
    .then((stats) => {
      console.log('FormaPagamento migration completed successfully!');
      console.log(`Total records with forma_pagamento: ${stats.totalRecords}`);
      console.log(`Already valid enum values: ${stats.alreadyValid}`);
      console.log(`Mapped to enum values: ${stats.mapped}`);
      console.log(`Set to NULL (unrecognized): ${stats.nullified}`);
    })
    .catch((err) => {
      console.error('Migration failed:', err);
      process.exit(1);
    })
    .finally(() => prisma.$disconnect());
}
