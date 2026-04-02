import { prisma } from './setup';
import {
  Role,
  ItemType,
  MovementType,
  BillStatus,
  AppointmentStatus,
} from '../generated/prisma/enums';
import { randomUUID } from 'crypto';

// ==================== TENANTS ====================

export async function createTenant(overrides: { slug?: string } = {}) {
  return prisma.tenant.create({
    data: {
      slug: overrides.slug ?? `test-tenant-${randomUUID().slice(0, 8)}`,
    },
  });
}

// ==================== USERS ====================

export async function createUser(
  overrides: {
    tenantId?: string | null;
    email?: string;
    passwordHash?: string;
    nome?: string;
    idade?: number;
    celular?: string;
    role?: Role;
  } = {}
) {
  return prisma.user.create({
    data: {
      tenant_id: overrides.tenantId ?? null,
      email: overrides.email ?? `user-${randomUUID().slice(0, 8)}@test.com`,
      password_hash:
        overrides.passwordHash ??
        '$2b$12$LJ3m4ys3Lk0TSwHjmz0VOeXlPMwnfMZOIEwJJfNTKODYVFxoCiy6', // "password123"
      nome: overrides.nome ?? 'Test User',
      idade: overrides.idade ?? 25,
      celular: overrides.celular ?? `+5511${Math.floor(900000000 + Math.random() * 99999999)}`,
      role: overrides.role ?? Role.OWNER,
    },
  });
}

// ==================== COMPANIES ====================

export async function createCompany(
  overrides: {
    tenantId: string;
    nome?: string;
    logoUrl?: string | null;
    descricao?: string | null;
  }
) {
  return prisma.company.create({
    data: {
      tenant_id: overrides.tenantId,
      nome: overrides.nome ?? 'Test Company',
      logo_url: overrides.logoUrl ?? null,
      descricao: overrides.descricao ?? 'A test company',
    },
  });
}

// ==================== LOCATIONS ====================

export async function createLocation(
  overrides: {
    tenantId: string;
    companyId: string;
    isPrimary?: boolean;
    endereco?: Partial<{
      rua: string;
      numero: string;
      complemento: string | null;
      bairro: string;
      cidade: string;
      estado: string;
      cep: string;
    }>;
  }
) {
  const addr = overrides.endereco ?? {};
  return prisma.location.create({
    data: {
      tenant_id: overrides.tenantId,
      company_id: overrides.companyId,
      endereco_rua: addr.rua ?? 'Rua Teste',
      endereco_numero: addr.numero ?? '100',
      endereco_complemento: addr.complemento ?? null,
      endereco_bairro: addr.bairro ?? 'Centro',
      endereco_cidade: addr.cidade ?? 'São Paulo',
      endereco_estado: addr.estado ?? 'SP',
      endereco_cep: addr.cep ?? '01001-000',
      is_primary: overrides.isPrimary ?? false,
    },
  });
}

// ==================== SERVICES ====================

export async function createService(
  overrides: {
    tenantId: string;
    nome?: string;
    duracaoMinutos?: number;
    ativo?: boolean;
  }
) {
  return prisma.service.create({
    data: {
      tenant_id: overrides.tenantId,
      nome: overrides.nome ?? 'Test Service',
      duracao_minutos: overrides.duracaoMinutos ?? 60,
      ativo: overrides.ativo ?? true,
    },
  });
}

// ==================== CLIENTS ====================

export async function createClient(
  overrides: {
    tenantId: string;
    nome?: string;
    email?: string | null;
    celular?: string;
  }
) {
  return prisma.client.create({
    data: {
      tenant_id: overrides.tenantId,
      nome: overrides.nome ?? 'Test Client',
      email: overrides.email ?? `client-${randomUUID().slice(0, 8)}@test.com`,
      celular: overrides.celular ?? `+5511${Math.floor(900000000 + Math.random() * 99999999)}`,
    },
  });
}

// ==================== VEHICLES ====================

export async function createVehicle(
  overrides: {
    tenantId: string;
    clientId: string;
    marca?: string;
    modelo?: string;
    ano?: number;
    placa?: string;
  }
) {
  return prisma.vehicle.create({
    data: {
      tenant_id: overrides.tenantId,
      client_id: overrides.clientId,
      marca: overrides.marca ?? 'Toyota',
      modelo: overrides.modelo ?? 'Corolla',
      ano: overrides.ano ?? 2022,
      placa: overrides.placa ?? `ABC${Math.floor(1000 + Math.random() * 8999)}`,
    },
  });
}

// ==================== INVENTORY ITEMS ====================

export async function createInventoryItem(
  overrides: {
    tenantId: string;
    nome?: string;
    tipo?: ItemType;
    custo?: number;
    valorVenda?: number;
    quantidadeAtual?: number;
    quantidadeMinima?: number;
  }
) {
  return prisma.inventoryItem.create({
    data: {
      tenant_id: overrides.tenantId,
      nome: overrides.nome ?? 'Test Item',
      tipo: overrides.tipo ?? ItemType.USO,
      custo: overrides.custo ?? 10.0,
      valor_venda: overrides.valorVenda ?? 25.0,
      quantidade_atual: overrides.quantidadeAtual ?? 50,
      quantidade_minima: overrides.quantidadeMinima ?? 5,
    },
  });
}

// ==================== STOCK MOVEMENTS ====================

export async function createStockMovement(
  overrides: {
    tenantId: string;
    itemId: string;
    tipo?: MovementType;
    quantidade?: number;
  }
) {
  return prisma.stockMovement.create({
    data: {
      tenant_id: overrides.tenantId,
      item_id: overrides.itemId,
      tipo: overrides.tipo ?? MovementType.ENTRADA,
      quantidade: overrides.quantidade ?? 10,
    },
  });
}

// ==================== BILLS ====================

export async function createBill(
  overrides: {
    tenantId: string;
    descricao?: string;
    valor?: number;
    dataVencimento?: Date;
    status?: BillStatus;
  }
) {
  return prisma.bill.create({
    data: {
      tenant_id: overrides.tenantId,
      descricao: overrides.descricao ?? 'Test Bill',
      valor: overrides.valor ?? 100.0,
      data_vencimento: overrides.dataVencimento ?? new Date('2025-12-31'),
      status: overrides.status ?? BillStatus.PENDENTE,
    },
  });
}

// ==================== APPOINTMENTS ====================

export async function createAppointment(
  overrides: {
    tenantId: string;
    serviceId: string;
    locationId: string;
    clientId?: string | null;
    dataHora?: Date;
    duracaoMinutos?: number;
    status?: AppointmentStatus;
    nomeVisitante?: string | null;
    celularVisitante?: string | null;
  }
) {
  return prisma.appointment.create({
    data: {
      tenant_id: overrides.tenantId,
      service_id: overrides.serviceId,
      location_id: overrides.locationId,
      client_id: overrides.clientId ?? null,
      data_hora: overrides.dataHora ?? new Date('2025-06-15T10:00:00Z'),
      duracao_minutos: overrides.duracaoMinutos ?? 60,
      status: overrides.status ?? AppointmentStatus.AGENDADO,
      nome_visitante: overrides.nomeVisitante ?? null,
      celular_visitante: overrides.celularVisitante ?? null,
    },
  });
}

// ==================== COMPOSITE HELPERS ====================

/**
 * Creates a full tenant setup: tenant + company + primary location + owner user.
 * Returns all created entities.
 */
export async function createFullTenantSetup(
  overrides: { slug?: string; companyName?: string; userEmail?: string } = {}
) {
  const tenant = await createTenant({ slug: overrides.slug });
  const company = await createCompany({
    tenantId: tenant.id,
    nome: overrides.companyName,
  });
  const location = await createLocation({
    tenantId: tenant.id,
    companyId: company.id,
    isPrimary: true,
  });
  const user = await createUser({
    tenantId: tenant.id,
    email: overrides.userEmail,
  });

  return { tenant, company, location, user };
}
