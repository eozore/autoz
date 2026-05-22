# Design Document: Platform Audit Security

## Overview

Security hardening for the Autoz platform addressing six areas: token storage migration from localStorage to sessionStorage, refresh token mechanism with short-lived access tokens, upload tenant isolation, password complexity enforcement, forma_pagamento enum validation, and max length constraints on text fields.

## Architecture

This feature hardens the Autoz platform across six security domains. All changes are backward-compatible at the API contract level (new fields are additive), but the frontend must migrate token storage and the backend must introduce a refresh token table and enum migration.

**Stack:** React 19 + Vite (frontend), Express + Prisma + PostgreSQL (backend), Vitest + fast-check (testing)

```
┌─────────────────────────────────────────────────────────────┐
│                        Frontend                              │
│  AuthContext.tsx ──► api.ts (interceptor) ──► sessionStorage │
│       │                    │                                 │
│       │         ┌──────────┴──────────┐                     │
│       │         │  Token Refresh Loop  │                     │
│       │         └──────────┬──────────┘                     │
└───────┼────────────────────┼────────────────────────────────┘
        │                    │
        ▼                    ▼
┌─────────────────────────────────────────────────────────────┐
│                        Backend                               │
│  routes/auth.ts ──► lib/jwt.ts (access token)               │
│       │             lib/refreshToken.ts (opaque token)       │
│       │                                                      │
│  middleware/auth.ts ──► verifies access token                │
│                                                              │
│  routes/upload.ts ──► lib/storage.ts (tenant-namespaced)     │
│                                                              │
│  schemas/*.ts ──► Zod validation (password, enum, maxLen)    │
└─────────────────────────────────────────────────────────────┘
        │
        ▼
┌─────────────────────────────────────────────────────────────┐
│                      PostgreSQL                               │
│  RefreshToken table (user_id, token_hash, expires_at)        │
│  FormaPagamento enum                                         │
└─────────────────────────────────────────────────────────────┘
```

## Components and Interfaces

### 1. Frontend Token Storage (AuthContext + API Client)

**Files modified:** `packages/frontend/src/contexts/AuthContext.tsx`, `packages/frontend/src/lib/api.ts`

**Changes:**
- Replace all `localStorage.getItem('token')` / `localStorage.setItem('token', ...)` with `sessionStorage` equivalents.
- Store `refresh_token` in sessionStorage alongside `token`.
- Remove `user` from localStorage (derive from token or fetch on mount).
- Add a token refresh interceptor that checks expiry before requests.

```typescript
// packages/frontend/src/lib/api.ts

function getToken(): string | null {
  return sessionStorage.getItem('token');
}

function getRefreshToken(): string | null {
  return sessionStorage.getItem('refresh_token');
}

function clearTokens(): void {
  sessionStorage.removeItem('token');
  sessionStorage.removeItem('refresh_token');
  sessionStorage.removeItem('user');
}

function isTokenExpiringSoon(token: string): boolean {
  try {
    const payload = JSON.parse(atob(token.split('.')[1]));
    const expiresAt = payload.exp * 1000;
    const fiveMinutes = 5 * 60 * 1000;
    return expiresAt - Date.now() < fiveMinutes;
  } catch {
    return true;
  }
}

let refreshPromise: Promise<string> | null = null;

async function ensureFreshToken(): Promise<string | null> {
  const token = getToken();
  if (!token) return null;

  if (!isTokenExpiringSoon(token)) return token;

  // Deduplicate concurrent refresh calls
  if (!refreshPromise) {
    refreshPromise = refreshAccessToken().finally(() => {
      refreshPromise = null;
    });
  }

  return refreshPromise;
}

async function refreshAccessToken(): Promise<string> {
  const refreshToken = getRefreshToken();
  if (!refreshToken) throw new Error('No refresh token');

  const res = await fetch(`${BASE_URL}/auth/refresh`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ refresh_token: refreshToken }),
  });

  if (!res.ok) {
    clearTokens();
    window.location.href = '/login';
    throw new Error('Refresh failed');
  }

  const data = await res.json();
  sessionStorage.setItem('token', data.token);
  sessionStorage.setItem('refresh_token', data.refresh_token);
  return data.token;
}
```

### 2. Backend Refresh Token Module

**New file:** `packages/backend/src/lib/refreshToken.ts`

**Responsibilities:**
- Generate cryptographically random opaque tokens (≥32 bytes, hex-encoded = 64 chars)
- Hash tokens with SHA-256 before storage
- Store/retrieve/invalidate tokens in the `RefreshToken` table

```typescript
// packages/backend/src/lib/refreshToken.ts
import { randomBytes, createHash } from 'crypto';

const TOKEN_BYTES = 32;

export function generateRefreshToken(): string {
  return randomBytes(TOKEN_BYTES).toString('hex');
}

export function hashRefreshToken(token: string): string {
  return createHash('sha256').update(token).digest('hex');
}
```

### 3. RefreshToken Database Model

**New Prisma model:**

```prisma
model RefreshToken {
  id         String   @id @default(uuid())
  user_id    String
  token_hash String   @unique
  expires_at DateTime
  created_at DateTime @default(now())

  user User @relation(fields: [user_id], references: [id], onDelete: Cascade)

  @@index([user_id])
  @@index([token_hash])
  @@map("refresh_tokens")
}
```

**Relation added to User model:**
```prisma
model User {
  // ... existing fields
  refreshTokens RefreshToken[]
}
```

### 4. Auth Routes Update

**File modified:** `packages/backend/src/routes/auth.ts`

**Changes to login/register:**
- Generate refresh token alongside access token
- Store hashed refresh token in DB
- Return both tokens in response
- Access token expiry: 1 hour
- Refresh token expiry: 7 days

**Changes to /auth/refresh:**
- Accept `refresh_token` (opaque string) instead of JWT
- Look up hash in DB, verify not expired
- Delete old token, issue new pair (rotation)
- Return 401 for invalid/expired/missing tokens

```typescript
// packages/backend/src/lib/jwt.ts — updated signJwt
export function signAccessToken(payload: JwtPayload): string {
  return jwt.sign(payload, getSecret(), { expiresIn: '1h' });
}
```

### 5. Upload Tenant Isolation

**File modified:** `packages/backend/src/routes/upload.ts`, `packages/backend/src/lib/storage.ts`

**Changes:**
- Extract `tenant_id` (or `user_id` fallback) from `req.context`
- Prefix filename with namespace: `${tenant_id}/${uuid}.ext`
- Storage providers updated to handle path separators
- New GET endpoint or middleware to serve files with tenant verification

```typescript
// Upload path construction
const namespace = req.context.tenant_id ?? req.context.user_id;
const filename = `${namespace}/${randomUUID()}${ext}`;
```

**File access verification:**
```typescript
// Middleware for file access
function verifyFileAccess(req: Request, res: Response, next: NextFunction): void {
  const requestedPath = req.params.filepath; // e.g., "tenant-123/file.jpg"
  const pathTenantId = requestedPath.split('/')[0];
  const userTenantId = req.context.tenant_id ?? req.context.user_id;

  if (pathTenantId !== userTenantId) {
    res.status(403).json({ error: 'Acesso negado ao arquivo' });
    return;
  }
  next();
}
```

### 6. Password Complexity Validation

**File modified:** `packages/backend/src/schemas/auth.ts`

**Changes:** Replace the simple `.min(8)` on `senha` with a custom Zod refinement:

```typescript
const passwordSchema = z
  .string()
  .min(8, 'Senha deve ter no mínimo 8 caracteres')
  .refine((val) => /[A-Z]/.test(val), {
    message: 'Senha deve conter pelo menos 1 letra maiúscula',
  })
  .refine((val) => /[0-9]/.test(val), {
    message: 'Senha deve conter pelo menos 1 número',
  })
  .refine((val) => /[!@#$%^&*()_+\-=\[\]{}|;:',.<>?/~`]/.test(val), {
    message: 'Senha deve conter pelo menos 1 caractere especial',
  });

export const registerSchema = z.object({
  email: z.string().email('Email inválido'),
  senha: passwordSchema,
  // ... rest unchanged
});

// loginSchema keeps simple z.string().min(1) — no complexity check
```

### 7. FormaPagamento Enum Validation

**Files modified:** `packages/backend/prisma/schema.prisma`, `packages/backend/src/schemas/appointment.ts`

**New Prisma enum:**
```prisma
enum FormaPagamento {
  A_VISTA
  PARCELADO
  PIX
  CARTAO_CREDITO
  CARTAO_DEBITO
}
```

**Schema change in appointment:**
```typescript
const FORMA_PAGAMENTO_VALUES = [
  'A_VISTA', 'PARCELADO', 'PIX', 'CARTAO_CREDITO', 'CARTAO_DEBITO'
] as const;

export const createAppointmentSchema = z.object({
  // ... existing fields
  forma_pagamento: z.enum(FORMA_PAGAMENTO_VALUES).nullable().optional(),
});
```

**Migration:** A data migration script maps existing free-text values to the enum (e.g., "pix" → "PIX", "cartão" → "CARTAO_CREDITO") and sets unrecognized values to null.

### 8. Max Length Constraints

**Files modified:** All schemas with text fields.

**Pattern applied uniformly:**
```typescript
// Each text field gets .max(2000) added
notas: z.string().max(2000, 'notas: máximo 2000 caracteres').nullable().optional(),
descricao: z.string().max(2000, 'descricao: máximo 2000 caracteres').nullable().optional(),
comment: z.string().min(10).max(2000, 'comment: máximo 2000 caracteres'),
```

**Affected schemas:**
| Schema | Field |
|--------|-------|
| appointment (create/update) | notas |
| service (create/update) | descricao |
| bill (create/update) | descricao |
| inventory (create/update) | descricao |
| review | comment |
| movement (create) | notas |

## Data Models

### RefreshToken Table

| Column | Type | Constraints |
|--------|------|-------------|
| id | UUID | PK, auto-generated |
| user_id | UUID | FK → users.id, ON DELETE CASCADE |
| token_hash | VARCHAR(64) | UNIQUE, NOT NULL |
| expires_at | TIMESTAMP | NOT NULL |
| created_at | TIMESTAMP | DEFAULT now() |

### FormaPagamento Enum

| Value | Description |
|-------|-------------|
| A_VISTA | Cash payment |
| PARCELADO | Installment |
| PIX | PIX transfer |
| CARTAO_CREDITO | Credit card |
| CARTAO_DEBITO | Debit card |

## Interfaces

### Auth Response (Updated)

```typescript
interface AuthResponse {
  token: string;          // JWT access token (1h expiry)
  refresh_token: string;  // Opaque refresh token (7d expiry)
  user: User;
}
```

### Refresh Request/Response

```typescript
// Request: POST /auth/refresh
interface RefreshRequest {
  refresh_token: string;
}

// Response: 200
interface RefreshResponse {
  token: string;
  refresh_token: string;
}

// Response: 401
interface RefreshErrorResponse {
  error: string;
}
```

### Upload Response (Updated)

```typescript
interface UploadResponse {
  url: string; // e.g., "/uploads/{tenant_id}/{uuid}.jpg"
}
```

## Error Handling

| Scenario | HTTP Status | Error Message |
|----------|-------------|---------------|
| Invalid/expired refresh token | 401 | "Token inválido ou expirado" |
| Cross-tenant file access | 403 | "Acesso negado ao arquivo" |
| Password missing uppercase | 400 | "Senha deve conter pelo menos 1 letra maiúscula" |
| Password missing digit | 400 | "Senha deve conter pelo menos 1 número" |
| Password missing special char | 400 | "Senha deve conter pelo menos 1 caractere especial" |
| Password too short | 400 | "Senha deve ter no mínimo 8 caracteres" |
| Invalid forma_pagamento | 400 | "forma_pagamento: valor inválido. Valores aceitos: A_VISTA, PARCELADO, PIX, CARTAO_CREDITO, CARTAO_DEBITO" |
| Text field exceeds 2000 chars | 400 | "{field}: máximo 2000 caracteres" |
| Upload without tenant_id | 201 | (uses user_id as namespace fallback) |

## Testing Strategy

- **Property-based tests (fast-check + Vitest):** Validate universal properties for password complexity, enum validation, max-length enforcement, refresh token generation, and tenant isolation logic. Minimum 100 iterations per property.
- **Unit tests (Vitest):** Cover specific examples for token storage migration, logout cleanup, refresh flow error handling, and data migration edge cases.
- **Integration tests (Supertest):** Verify end-to-end auth flows (login → refresh → access), upload with tenant namespacing, and 401/403 responses.

## Correctness Properties

*A property is a characteristic or behavior that should hold true across all valid executions of a system — essentially, a formal statement about what the system should do. Properties serve as the bridge between human-readable specifications and machine-verifiable correctness guarantees.*

### Property 1: Token source invariant

For any API request made by the Frontend_Auth_Client, the Authorization header token SHALL be read from sessionStorage, and at no point during any auth operation (login, register, refresh, logout) SHALL localStorage contain keys "token" or "refresh_token".

**Validates: Requirements 1.3, 1.5**

### Property 2: 401 clears session tokens

For any non-auth API route that returns HTTP 401, the Frontend_Auth_Client SHALL remove both "token" and "refresh_token" from sessionStorage before redirecting.

**Validates: Requirements 1.6**

### Property 3: Token expiry correctness

For any successful authentication (login or register) or refresh operation, the issued access token SHALL have an expiry of 1 hour (±5 seconds tolerance) and the issued refresh token SHALL have a database expiry of 7 days (±5 seconds tolerance).

**Validates: Requirements 2.1, 2.2**

### Property 4: Invalid refresh token rejection

For any string that is not a currently valid, non-expired refresh token stored in the database, the /auth/refresh endpoint SHALL respond with HTTP 401.

**Validates: Requirements 2.3**

### Property 5: Refresh token stored as hash

For any refresh token issued by the Auth_Module, the value stored in the database SHALL be the SHA-256 hash of the token, never the plaintext token itself.

**Validates: Requirements 2.4**

### Property 6: Refresh token rotation invalidates predecessor

For any successful token refresh operation, the previously valid refresh token SHALL no longer be accepted by the /auth/refresh endpoint.

**Validates: Requirements 2.5**

### Property 7: Refresh token minimum entropy

For any refresh token generated by the Auth_Module, the raw token SHALL be at least 32 bytes (64 hex characters) of cryptographically random data.

**Validates: Requirements 2.8**

### Property 8: Upload path tenant namespacing

For any file uploaded by an authenticated user with a tenant_id, the stored file path and returned URL SHALL be prefixed with `{tenant_id}/`. For users without a tenant_id, the prefix SHALL be `{user_id}/`.

**Validates: Requirements 3.1, 3.2, 3.5, 3.6**

### Property 9: Cross-tenant file access denial

For any file access request where the requesting user's tenant_id does not match the tenant_id prefix in the file path, the Upload_Service SHALL respond with HTTP 403.

**Validates: Requirements 3.3, 3.4**

### Property 10: Password complexity validation

For any password string submitted to the registration endpoint, if it is missing any of the required character classes (minimum 8 characters, at least 1 uppercase letter, at least 1 digit, at least 1 special character), the Validation_Layer SHALL reject it with HTTP 400 and an error message identifying the failing requirement(s). Conversely, any password meeting all four requirements SHALL pass the complexity check.

**Validates: Requirements 4.1, 4.2, 4.3, 4.4, 4.5**

### Property 11: forma_pagamento enum enforcement

For any string value assigned to forma_pagamento in an appointment create or update request, the Validation_Layer SHALL accept it if and only if it is one of {A_VISTA, PARCELADO, PIX, CARTAO_CREDITO, CARTAO_DEBITO} or is null/undefined. Any other value SHALL result in HTTP 400.

**Validates: Requirements 5.2, 5.3, 5.4**

### Property 12: Text field max length enforcement

For any text field with a 2000-character constraint (notas, descricao, comment), if the submitted string exceeds 2000 characters, the Validation_Layer SHALL reject the request with HTTP 400 and an error message identifying the field name and the maximum allowed length. Strings of 2000 characters or fewer SHALL pass the length check.

**Validates: Requirements 6.1, 6.2, 6.3, 6.4, 6.5, 6.6, 6.7**
