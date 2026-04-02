# Production Readiness Audit — Bugfix Design

## Overview

O sistema possui 12 problemas de segurança, configuração e confiabilidade que impedem um deploy seguro em produção. Os bugs abrangem credenciais hardcoded, ausência de logging estruturado, Docker sem hardening, health check superficial, queries não otimizadas, validação de upload insuficiente, e geração de slug insegura. A estratégia de fix é aplicar mudanças cirúrgicas em cada arquivo afetado, mantendo compatibilidade total com o fluxo existente.

## Glossary

- **Bug_Condition (C)**: Conjunto de 12 condições que expõem vulnerabilidades ou deficiências quando o sistema opera em produção
- **Property (P)**: Comportamento correto esperado após cada fix — segurança, resiliência e performance adequadas
- **Preservation**: Funcionalidades existentes (auth, CRUD, uploads válidos, migrations, rate limiting) que devem permanecer inalteradas
- **`getSecret()`**: Função em `packages/backend/src/lib/jwt.ts` que retorna o JWT secret com fallback inseguro
- **`generateSlug()`**: Função em `packages/backend/src/lib/slug.ts` que gera slugs com `Math.random()`
- **Dashboard `/stats`**: Endpoint em `packages/backend/src/routes/dashboard.ts` que carrega todos os registros em memória
- **Upload route**: Endpoint em `packages/backend/src/routes/upload.ts` que valida apenas mimetype do header

## Bug Details

### Bug Condition

Os 12 bugs se manifestam quando o sistema é executado em ambiente de produção. Cada bug representa uma condição onde a implementação atual diverge do comportamento seguro/correto esperado.

**Formal Specification:**
```
FUNCTION isBugCondition(input)
  INPUT: input of type SystemState
  OUTPUT: boolean

  RETURN (input.env.JWT_SECRET is undefined AND system starts with fallback secret)
         OR (input.dockerCompose contains hardcoded credentials)
         OR (input.error occurs AND logging uses console.error without structure)
         OR (input.signal IN ['SIGTERM', 'SIGINT'] AND no graceful shutdown handler exists)
         OR (input.nginxConfig lacks security headers, gzip, cache headers)
         OR (input.dockerProcess runs as root user)
         OR (input.prismaClient has no pool config, no query logging, no error handling)
         OR (input.healthCheck does not verify database connectivity)
         OR (input.gitignore does not exclude .env, dist/, uploads/)
         OR (input.dashboardRequest loads all records into memory)
         OR (input.uploadFile has forged mimetype AND no magic bytes validation)
         OR (input.slugCollision AND suffix generated with Math.random())
END FUNCTION
```

### Examples

- **Bug 1.1**: Backend inicia sem `JWT_SECRET` → usa `'dev-secret-key-change-in-production'` → atacante forja tokens
- **Bug 1.4**: GCP envia SIGTERM durante redeploy → Node.js encerra sem fechar conexões → requests em andamento falham, conexões órfãs no PostgreSQL
- **Bug 1.8**: PostgreSQL fica inacessível → `/health` retorna `{ status: 'ok' }` → load balancer continua enviando tráfego
- **Bug 1.10**: Tenant com 50k appointments → dashboard carrega todos em memória → OOM ou timeout
- **Bug 1.11**: Atacante envia `.exe` com header `Content-Type: image/jpeg` → arquivo salvo como `.jpg` → execução maliciosa potencial
- **Bug 1.12**: 10k tenants → `Math.random().toString(36).substring(2, 6)` → ~1.6M combinações → colisões frequentes, sem retry

## Expected Behavior

### Preservation Requirements

**Unchanged Behaviors:**
- Login com credenciais válidas retorna JWT e dados do usuário (3.1)
- Rotas protegidas autorizam acesso com token válido e injetam contexto do tenant (3.2)
- Rotas públicas `/public/:slug/profile` funcionam sem autenticação (3.3)
- Criação de agendamentos sem conflito funciona normalmente (3.4)
- Upload de JPEG/PNG válidos < 5MB continua salvando e retornando URL (3.5)
- Movimentações de estoque atualizam atomicamente (3.6)
- Frontend inclui Bearer token e trata 401 com redirect (3.7)
- Docker multi-stage build com Alpine mantém tamanho reduzido (3.8)
- Migrations executam antes do servidor iniciar (3.9)
- Rate limiting mantém limites de 10/15min para auth e 5/15min para agendamentos públicos (3.10)

**Scope:**
Todas as operações CRUD existentes, fluxos de autenticação, e integrações frontend-backend devem funcionar identicamente após os fixes.

## Hypothesized Root Cause

Based on the codebase analysis, the root causes are:

1. **JWT Secret Fallback (1.1)**: `getSecret()` em `jwt.ts` usa operador `||` com fallback string, nunca falha se env var está ausente
2. **Credenciais Hardcoded (1.2)**: `docker-compose.yml` define valores literais para `POSTGRES_USER`, `POSTGRES_PASSWORD`, `JWT_SECRET`
3. **Logging Primitivo (1.3)**: Todo o backend usa `console.error`/`console.log` sem biblioteca de logging estruturado
4. **Sem Graceful Shutdown (1.4)**: `index.ts` chama `app.listen()` sem registrar handlers para SIGTERM/SIGINT, sem referência ao server object
5. **Nginx Sem Hardening (1.5)**: Frontend Dockerfile gera `default.conf` inline sem headers de segurança, sem gzip, sem cache
6. **Container Root (1.6)**: Backend Dockerfile não usa instrução `USER`, processo roda como root
7. **Prisma Sem Pool Config (1.7)**: `prisma.ts` instancia `PrismaClient()` sem opções de connection pool ou logging
8. **Health Check Superficial (1.8)**: Endpoint `/health` em `index.ts` retorna `{ status: 'ok' }` sem query ao banco
9. **Gitignore Incompleto (1.9)**: Root `.gitignore` contém apenas `node_modules`
10. **Dashboard N+1/Memory (1.10)**: `dashboard.ts` usa `findMany` sem filtros eficientes e faz reduce em memória
11. **Upload Sem Magic Bytes (1.11)**: `upload.ts` valida apenas `file.mimetype` do header HTTP
12. **Slug Math.random (1.12)**: `slug.ts` usa `Math.random()` sem retry de unicidade

## Correctness Properties

Property 1: Bug Condition - Sistema rejeita configuração insegura e opera com hardening em produção

_For any_ input onde qualquer bug condition se aplica (isBugCondition returns true), o sistema fixado SHALL rejeitar a configuração insegura (crash on missing JWT_SECRET), usar logging estruturado, executar graceful shutdown, servir com headers de segurança, rodar como non-root, usar connection pool configurado, verificar DB no health check, excluir arquivos sensíveis do git, usar queries otimizadas, validar magic bytes de uploads, e gerar slugs com crypto seguro.

**Validates: Requirements 2.1, 2.2, 2.3, 2.4, 2.5, 2.6, 2.7, 2.8, 2.9, 2.10, 2.11, 2.12**

Property 2: Preservation - Funcionalidades existentes permanecem inalteradas

_For any_ input onde nenhuma bug condition se aplica (isBugCondition returns false), o sistema fixado SHALL produzir exatamente o mesmo resultado que o sistema original, preservando autenticação, CRUD, uploads válidos, rate limiting, migrations, e integrações frontend-backend.

**Validates: Requirements 3.1, 3.2, 3.3, 3.4, 3.5, 3.6, 3.7, 3.8, 3.9, 3.10**

## Fix Implementation

### Changes Required

Assuming our root cause analysis is correct:

---

**Fix 1.1 — JWT Secret obrigatório**

**File**: `packages/backend/src/lib/jwt.ts`

**Function**: `getSecret()`

**Specific Changes**:
1. Remover fallback `'dev-secret-key-change-in-production'`
2. Lançar erro se `JWT_SECRET` não está definido (exceto em ambiente de teste)
3. Validar comprimento mínimo do secret (32 chars) em produção

```typescript
function getSecret(): string {
  const secret = process.env.JWT_SECRET;
  if (!secret) {
    if (process.env.NODE_ENV === 'test' || process.env.VITEST === 'true') {
      return 'test-secret-key-for-automated-tests-only';
    }
    throw new Error('FATAL: JWT_SECRET environment variable is required');
  }
  return secret;
}
```

---

**Fix 1.2 — Docker Compose sem credenciais hardcoded**

**File**: `docker-compose.yml`

**Specific Changes**:
1. Substituir valores hardcoded por referências a variáveis de ambiente com `${VAR}` syntax
2. Criar arquivo `.env.example` com placeholders documentados
3. Adicionar `.env` ao `.gitignore`

```yaml
services:
  db:
    environment:
      POSTGRES_USER: ${POSTGRES_USER:-postgres}
      POSTGRES_PASSWORD: ${POSTGRES_PASSWORD:?POSTGRES_PASSWORD is required}
      POSTGRES_DB: ${POSTGRES_DB:-smp_dev}
  backend:
    environment:
      DATABASE_URL: ${DATABASE_URL:?DATABASE_URL is required}
      JWT_SECRET: ${JWT_SECRET:?JWT_SECRET is required}
      CORS_ORIGINS: ${CORS_ORIGINS:-http://localhost:5173}
      PORT: ${PORT:-3000}
```

---

**Fix 1.3 — Logging estruturado**

**File**: `packages/backend/src/lib/logger.ts` (novo)

**Specific Changes**:
1. Criar módulo de logging estruturado com output JSON
2. Incluir campos: timestamp, level, message, requestId (quando disponível)
3. Substituir `console.error`/`console.log` nos arquivos existentes

```typescript
import { randomUUID } from 'crypto';

type LogLevel = 'info' | 'warn' | 'error' | 'debug';

interface LogEntry {
  timestamp: string;
  level: LogLevel;
  message: string;
  requestId?: string;
  [key: string]: unknown;
}

function log(level: LogLevel, message: string, meta?: Record<string, unknown>): void {
  const entry: LogEntry = {
    timestamp: new Date().toISOString(),
    level,
    message,
    ...meta,
  };
  const output = JSON.stringify(entry);
  if (level === 'error') {
    process.stderr.write(output + '\n');
  } else {
    process.stdout.write(output + '\n');
  }
}

export const logger = {
  info: (msg: string, meta?: Record<string, unknown>) => log('info', msg, meta),
  warn: (msg: string, meta?: Record<string, unknown>) => log('warn', msg, meta),
  error: (msg: string, meta?: Record<string, unknown>) => log('error', msg, meta),
  debug: (msg: string, meta?: Record<string, unknown>) => log('debug', msg, meta),
  generateRequestId: () => randomUUID(),
};
```

**Files to update** (substituir `console.error`/`console.log` por `logger`):
- `packages/backend/src/index.ts`
- `packages/backend/src/routes/dashboard.ts`
- Todos os route handlers que usam `console.error`

---

**Fix 1.4 — Graceful Shutdown**

**File**: `packages/backend/src/index.ts`

**Specific Changes**:
1. Capturar retorno de `app.listen()` em variável `server`
2. Registrar handlers para SIGTERM e SIGINT
3. Fechar server HTTP, aguardar requests pendentes (timeout 10s), desconectar Prisma

```typescript
import { prisma } from './lib/prisma';
import { logger } from './lib/logger';

const server = app.listen(PORT, () => {
  logger.info(`Server running on port ${PORT}`);
});

function gracefulShutdown(signal: string) {
  logger.info(`Received ${signal}, starting graceful shutdown`);
  server.close(async () => {
    logger.info('HTTP server closed');
    await prisma.$disconnect();
    logger.info('Database disconnected');
    process.exit(0);
  });
  // Force shutdown after 10s
  setTimeout(() => {
    logger.error('Forced shutdown after timeout');
    process.exit(1);
  }, 10_000);
}

process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
process.on('SIGINT', () => gracefulShutdown('SIGINT'));
```

---

**Fix 1.5 — Nginx hardening**

**File**: `packages/frontend/Dockerfile`

**Specific Changes**:
1. Substituir config inline por nginx.conf com headers de segurança
2. Adicionar gzip para text/html/css/js
3. Adicionar cache headers para assets com hash

```nginx
server {
    listen 80;
    root /usr/share/nginx/html;
    index index.html;

    # Security headers
    add_header X-Content-Type-Options "nosniff" always;
    add_header X-Frame-Options "DENY" always;
    add_header X-XSS-Protection "1; mode=block" always;
    add_header Referrer-Policy "strict-origin-when-cross-origin" always;

    # Gzip compression
    gzip on;
    gzip_types text/plain text/css application/json application/javascript text/xml;
    gzip_min_length 256;

    # Cache hashed assets (Vite generates filenames with hash)
    location /assets/ {
        expires 1y;
        add_header Cache-Control "public, immutable";
    }

    # SPA fallback
    location / {
        try_files $uri $uri/ /index.html;
    }
}
```

---

**Fix 1.6 — Docker non-root user**

**File**: `packages/backend/Dockerfile`

**Specific Changes**:
1. Adicionar `USER node` no estágio de produção (imagem `node:20-alpine` já inclui user `node`)
2. Ajustar ownership do diretório de uploads

```dockerfile
# No estágio de produção, antes do EXPOSE:
RUN mkdir -p uploads && chown -R node:node /app
USER node
```

---

**Fix 1.7 — Prisma connection pool e logging**

**File**: `packages/backend/src/lib/prisma.ts`

**Specific Changes**:
1. Configurar connection pool via `datasources.db.url` com parâmetros
2. Habilitar logging de queries lentas
3. Adicionar event handler para erros de conexão

```typescript
import { PrismaClient } from '../generated/prisma/client';
import { logger } from './logger';

const SLOW_QUERY_THRESHOLD = Number(process.env.SLOW_QUERY_MS) || 500;

export const prisma = new PrismaClient({
  log: [
    { level: 'warn', emit: 'event' },
    { level: 'error', emit: 'event' },
    { level: 'query', emit: 'event' },
  ],
});

prisma.$on('query', (e) => {
  if (e.duration > SLOW_QUERY_THRESHOLD) {
    logger.warn('Slow query detected', {
      query: e.query,
      duration: e.duration,
      params: e.params,
    });
  }
});

prisma.$on('warn', (e) => logger.warn('Prisma warning', { message: e.message }));
prisma.$on('error', (e) => logger.error('Prisma error', { message: e.message }));
```

**Nota**: Connection pool size é configurado via query params na `DATABASE_URL` (ex: `?connection_limit=10&pool_timeout=10`).

---

**Fix 1.8 — Health check com verificação de DB**

**File**: `packages/backend/src/index.ts`

**Specific Changes**:
1. Substituir health check estático por query `SELECT 1` ao banco
2. Retornar 503 se banco inacessível

```typescript
app.get('/health', async (_req, res) => {
  try {
    await prisma.$queryRaw`SELECT 1`;
    res.json({ status: 'ok', db: 'connected' });
  } catch (err) {
    logger.error('Health check failed', { error: String(err) });
    res.status(503).json({ status: 'unhealthy', db: 'disconnected' });
  }
});
```

---

**Fix 1.9 — Gitignore completo**

**File**: `.gitignore`

**Specific Changes**:
1. Adicionar padrões para `.env*`, `dist/`, `uploads/`, logs, e artefatos de IDE

```gitignore
node_modules
.env
.env.*
!.env.example
dist/
uploads/
*.log
.DS_Store
```

---

**Fix 1.10 — Dashboard queries otimizadas**

**File**: `packages/backend/src/routes/dashboard.ts`

**Specific Changes**:
1. Substituir `findMany` + reduce por `aggregate`/`count`/`groupBy` do Prisma
2. Usar `_sum`, `_count` para cálculos no banco
3. Eliminar carregamento de todos os registros em memória

```typescript
// Exemplo: substituir completedAppointments findMany por aggregate
const servicesAgg = await prisma.appointment.aggregate({
  where: {
    tenant_id: tenantId,
    status: AppointmentStatus.CONCLUIDO,
    data_hora: { gte: monthStart, lte: monthEnd },
  },
  _sum: { valor_servico: true, desconto: true },
  _count: true,
});

const servicesRevenue = Number(servicesAgg._sum.valor_servico ?? 0) 
                      - Number(servicesAgg._sum.desconto ?? 0);

// Bills: usar aggregate em vez de findMany + filter
const billsAgg = await prisma.bill.groupBy({
  by: ['status'],
  where: { tenant_id: tenantId },
  _sum: { valor: true },
  _count: true,
});

// Receivables: aggregate com filtros específicos
const inProgressAgg = await prisma.appointment.aggregate({
  where: {
    tenant_id: tenantId,
    status: AppointmentStatus.EM_ANDAMENTO,
  },
  _sum: { valor_servico: true, desconto: true },
  _count: true,
});
```

---

**Fix 1.11 — Validação de magic bytes**

**File**: `packages/backend/src/routes/upload.ts`

**Specific Changes**:
1. Adicionar função `validateMagicBytes()` que verifica os primeiros bytes do buffer
2. Chamar validação após multer processar o arquivo, antes de salvar

```typescript
const MAGIC_BYTES: Record<string, number[][]> = {
  'image/jpeg': [[0xFF, 0xD8, 0xFF]],
  'image/png': [[0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A]],
};

function validateMagicBytes(buffer: Buffer, declaredMime: string): boolean {
  const signatures = MAGIC_BYTES[declaredMime];
  if (!signatures) return false;
  return signatures.some((sig) =>
    sig.every((byte, i) => buffer[i] === byte)
  );
}

// No handler POST, após verificar req.file:
if (!validateMagicBytes(req.file.buffer, req.file.mimetype)) {
  res.status(400).json({ error: 'Conteúdo do arquivo não corresponde ao tipo declarado' });
  return;
}
```

---

**Fix 1.12 — Slug com crypto seguro e retry**

**File**: `packages/backend/src/lib/slug.ts`

**Specific Changes**:
1. Substituir `Math.random()` por `crypto.randomBytes()`
2. Implementar loop de retry com verificação de unicidade
3. Limitar tentativas para evitar loop infinito

```typescript
import { randomBytes } from 'crypto';
import { prisma } from './prisma';

function generateSecureSuffix(length: number = 6): string {
  return randomBytes(length).toString('hex').substring(0, length);
}

export async function generateSlug(name: string): Promise<string> {
  const base = slugify(name);
  const MAX_RETRIES = 5;

  const existing = await prisma.tenant.findUnique({ where: { slug: base } });
  if (!existing) return base;

  for (let i = 0; i < MAX_RETRIES; i++) {
    const candidate = `${base}-${generateSecureSuffix()}`;
    const collision = await prisma.tenant.findUnique({ where: { slug: candidate } });
    if (!collision) return candidate;
  }

  throw new Error(`Failed to generate unique slug for "${name}" after ${MAX_RETRIES} attempts`);
}
```

---

**Arquivo adicional: `.env.example`**

**File**: `.env.example` (novo, na raiz)

```env
# Database
POSTGRES_USER=postgres
POSTGRES_PASSWORD=<strong-password-here>
POSTGRES_DB=smp_dev
DATABASE_URL=postgresql://${POSTGRES_USER}:${POSTGRES_PASSWORD}@db:5432/${POSTGRES_DB}?schema=public&connection_limit=10&pool_timeout=10

# Auth
JWT_SECRET=<min-32-char-random-secret>

# Server
PORT=3000
CORS_ORIGINS=https://your-domain.com

# Storage (optional — omit for local storage)
# GCS_BUCKET=your-bucket-name

# Logging
# SLOW_QUERY_MS=500
```

## Testing Strategy

### Validation Approach

A estratégia de testes segue duas fases: primeiro, surfacing de counterexamples que demonstram os bugs no código não-fixado, depois verificação de que os fixes funcionam e preservam comportamento existente.

### Exploratory Bug Condition Checking

**Goal**: Demonstrar os bugs ANTES de implementar os fixes. Confirmar ou refutar a análise de root cause.

**Test Plan**: Escrever testes que exercitam cada condição de bug no código atual e observar as falhas.

**Test Cases**:
1. **JWT Fallback Test**: Verificar que `getSecret()` retorna fallback quando `JWT_SECRET` não está definido (vai passar no código não-fixado, demonstrando o bug)
2. **Health Check Shallow Test**: Chamar `/health` e verificar que retorna 200 mesmo sem DB (vai passar, demonstrando o bug)
3. **Upload Magic Bytes Test**: Enviar arquivo com mimetype `image/jpeg` mas conteúdo não-JPEG e verificar que é aceito (vai passar, demonstrando o bug)
4. **Slug Randomness Test**: Verificar que `generateSlug` usa `Math.random()` e não faz retry (vai passar, demonstrando o bug)
5. **Dashboard Memory Test**: Verificar que dashboard usa `findMany` sem agregação (vai passar, demonstrando o bug)

**Expected Counterexamples**:
- JWT aceita secret inseguro sem erro
- Health check retorna ok sem verificar DB
- Upload aceita arquivo com magic bytes inválidos
- Slug gera sufixo com Math.random() sem retry

### Fix Checking

**Goal**: Verificar que para todos os inputs onde a bug condition se aplica, o sistema fixado produz o comportamento esperado.

**Pseudocode:**
```
FOR ALL input WHERE isBugCondition(input) DO
  result := fixedSystem(input)
  ASSERT expectedBehavior(result)
END FOR
```

### Preservation Checking

**Goal**: Verificar que para todos os inputs onde a bug condition NÃO se aplica, o sistema fixado produz o mesmo resultado que o original.

**Pseudocode:**
```
FOR ALL input WHERE NOT isBugCondition(input) DO
  ASSERT originalSystem(input) = fixedSystem(input)
END FOR
```

**Testing Approach**: Property-based testing é recomendado para preservation checking porque:
- Gera muitos test cases automaticamente no domínio de input
- Captura edge cases que testes manuais podem perder
- Fornece garantias fortes de que o comportamento não mudou para inputs não-buggy

**Test Plan**: Observar comportamento no código não-fixado para operações normais, depois escrever property-based tests capturando esse comportamento.

**Test Cases**:
1. **Auth Preservation**: Verificar que login/register/refresh continuam funcionando identicamente
2. **CRUD Preservation**: Verificar que todas as operações CRUD (clients, vehicles, services, etc.) produzem mesmos resultados
3. **Upload Valid Files Preservation**: Verificar que upload de JPEG/PNG válidos continua funcionando
4. **Rate Limiting Preservation**: Verificar que rate limits continuam aplicados

### Unit Tests

- Testar `getSecret()` lança erro sem `JWT_SECRET` (exceto em test env)
- Testar `validateMagicBytes()` aceita JPEG/PNG válidos e rejeita conteúdo falsificado
- Testar `generateSlug()` usa crypto seguro e faz retry em colisão
- Testar `gracefulShutdown()` fecha server e desconecta Prisma
- Testar health check retorna 503 quando DB está inacessível
- Testar logger produz JSON estruturado com campos obrigatórios

### Property-Based Tests

- Gerar buffers aleatórios e verificar que `validateMagicBytes` só aceita buffers com magic bytes corretos
- Gerar nomes aleatórios e verificar que `slugify` produz slugs válidos (lowercase, sem caracteres especiais)
- Gerar nomes aleatórios e verificar que `generateSlug` sempre retorna slug único
- Gerar payloads de login válidos e verificar que auth flow funciona identicamente após fixes

### Integration Tests

- Testar fluxo completo: register → login → create company → create service → create appointment
- Testar que health check reflete estado real do banco
- Testar que upload rejeita arquivo malicioso mas aceita imagens válidas
- Testar que dashboard retorna dados corretos com queries otimizadas
- Testar graceful shutdown com requests em andamento
