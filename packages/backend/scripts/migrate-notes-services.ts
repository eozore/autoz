import { PrismaClient } from '../src/generated/prisma/client';

function escapeRegex(str: string): string {
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

export interface MigrationStats {
  tenantsProcessed: number;
  appointmentsProcessed: number;
  matchesFound: number;
  recordsCreated: number;
  recordsSkipped: number;
}

export async function migrateNotesServices(prisma: PrismaClient): Promise<MigrationStats> {
  const stats: MigrationStats = {
    tenantsProcessed: 0,
    appointmentsProcessed: 0,
    matchesFound: 0,
    recordsCreated: 0,
    recordsSkipped: 0,
  };

  const tenants = await prisma.tenant.findMany({ select: { id: true } });

  for (const tenant of tenants) {
    stats.tenantsProcessed++;

    // Get all services for this tenant
    const services = await prisma.service.findMany({
      where: { tenant_id: tenant.id },
      select: { id: true, nome: true },
    });

    const serviceMap = new Map<string, string>();
    for (const svc of services) {
      serviceMap.set(svc.nome.toLowerCase(), svc.id);
    }

    // Get all appointments with notas
    const appointments = await prisma.appointment.findMany({
      where: {
        tenant_id: tenant.id,
        notas: { not: null },
      },
      select: {
        id: true,
        service_id: true,
        notas: true,
        appointmentServices: { select: { service_id: true } },
      },
    });

    for (const appt of appointments) {
      if (!appt.notas || appt.notas.trim() === '') continue;
      stats.appointmentsProcessed++;

      const existingServiceIds = new Set(appt.appointmentServices.map((as) => as.service_id));

      // Migrate legacy service_id
      if (appt.service_id && !existingServiceIds.has(appt.service_id)) {
        await prisma.appointmentService.create({
          data: { appointment_id: appt.id, service_id: appt.service_id },
        });
        existingServiceIds.add(appt.service_id);
        stats.recordsCreated++;
      } else if (appt.service_id && existingServiceIds.has(appt.service_id)) {
        stats.recordsSkipped++;
      }

      // Match services in notes
      let remainingNotes = appt.notas;
      // Sort service names by length descending to match longer names first
      const sortedEntries = [...serviceMap.entries()].sort((a, b) => b[0].length - a[0].length);

      for (const [nameLower, serviceId] of sortedEntries) {
        const regex = new RegExp(escapeRegex(nameLower), 'gi');
        if (regex.test(remainingNotes)) {
          stats.matchesFound++;

          if (!existingServiceIds.has(serviceId)) {
            await prisma.appointmentService.create({
              data: { appointment_id: appt.id, service_id: serviceId },
            });
            existingServiceIds.add(serviceId);
            stats.recordsCreated++;
          } else {
            stats.recordsSkipped++;
          }

          remainingNotes = remainingNotes.replace(regex, '').trim();
        }
      }

      // Clean up orphan separators
      remainingNotes = remainingNotes
        .replace(/^[\s,;.\-\n]+|[\s,;.\-\n]+$/g, '')
        .replace(/[\s,;.\-]{2,}/g, ', ')
        .trim();

      // Update notes if changed
      const finalNotes = remainingNotes || null;
      if (finalNotes !== appt.notas) {
        await prisma.appointment.update({
          where: { id: appt.id },
          data: { notas: finalNotes },
        });
      }
    }
  }

  return stats;
}

// Run as standalone script
if (require.main === module) {
  const prisma = new PrismaClient();
  migrateNotesServices(prisma)
    .then((stats) => {
      console.log('Migration completed successfully!');
      console.log(`Tenants processed: ${stats.tenantsProcessed}`);
      console.log(`Appointments processed: ${stats.appointmentsProcessed}`);
      console.log(`Matches found: ${stats.matchesFound}`);
      console.log(`Records created: ${stats.recordsCreated}`);
      console.log(`Records skipped: ${stats.recordsSkipped}`);
    })
    .catch((err) => {
      console.error('Migration failed:', err);
      process.exit(1);
    })
    .finally(() => prisma.$disconnect());
}
