# Implementation Plan: Platform Audit Security

## Overview

Security hardening implementation across six subsystems. Execution order: database migrations first (RefreshToken table, FormaPagamento enum), then backend services/routes (refresh token module, auth routes, upload isolation, Zod schemas), then frontend changes (token storage migration, refresh interceptor).

## Tasks

- [x] 1. Database migrations
  - [x] 1.1 Create RefreshToken model and migration
    - Add `RefreshToken` model to `packages/backend/prisma/schema.prisma` with fields: id (UUID), user_id (FK → users.id, CASCADE), token_hash (String, @unique), expires_at (DateTime), created_at (DateTime)
    - Add `refreshTokens RefreshToken[]` relation to the `User` model
    - Add `@@index([user_id])` and `@@index([token_hash])` and `@@map("refresh_tokens")`
    - Run `npx prisma migrate dev --name add_refresh_tokens`
    - _Requirements: 2.4_

  - [x] 1.2 Create FormaPagamento enum and migrate column
    - Add `FormaPagamento` enum to `packages/backend/prisma/schema.prisma` with values: A_VISTA, PARCELADO, PIX, CARTAO_CREDITO, CARTAO_DEBITO
    - Change `forma_pagamento` field on `Appointment` model from `String?` to `FormaPagamento?`
    - Write a SQL data migration script at `packages/backend/scripts/migrate-forma-pagamento.ts` that maps existing free-text values to enum values (e.g., "pix" → "PIX", "cartão" → "CARTAO_CREDITO") and sets unrecognized values to null
    - Run `npx prisma migrate dev --name forma_pagamento_enum`
    - _Requirements: 5.1, 5.5_

- [x] 2. Backend refresh token module
  - [x] 2.1 Create refresh token utility library
    - Create `packages/backend/src/lib/refreshToken.ts`
    - Implement `generateRefreshToken()`: uses `crypto.randomBytes(32).toString('hex')` to produce a 64-char hex string
    - Implement `hashRefreshToken(token: string)`: uses `crypto.createHash('sha256').update(token).digest('hex')`
    - _Requirements: 2.4, 2.8_

  - [ ]* 2.2 Write property test for refresh token generation (Property 7)
    - **Property 7: Refresh token minimum entropy**
    - Verify that every generated token is exactly 64 hex characters (32 bytes)
    - Verify that hashing is deterministic (same input → same output)
    - Verify that different tokens produce different hashes
    - **Validates: Requirements 2.8**

  - [ ]* 2.3 Write property test for refresh token stored as hash (Property 5)
    - **Property 5: Refresh token stored as hash**
    - Verify that `hashRefreshToken(token) !== token` for all non-empty tokens
    - Verify hash output is always 64 hex characters (SHA-256)
    - **Validates: Requirements 2.4**

- [x] 3. Backend auth routes update
  - [x] 3.1 Update JWT utility for short-lived access tokens
    - Modify `packages/backend/src/lib/jwt.ts` to export `signAccessToken(payload)` with `{ expiresIn: '1h' }`
    - Keep existing `signJwt` as alias or update all callers
    - _Requirements: 2.1_

  - [x] 3.2 Update login and register routes to issue token pairs
    - Modify `packages/backend/src/routes/auth.ts` login handler: after successful auth, generate refresh token, hash it, store in `RefreshToken` table with 7-day expiry, return `{ token, refresh_token, user }`
    - Modify register handler similarly
    - _Requirements: 2.1, 2.4_

  - [x] 3.3 Implement POST /auth/refresh endpoint
    - Add new route in `packages/backend/src/routes/auth.ts`
    - Accept `{ refresh_token }` in body
    - Hash the incoming token, look up in DB, verify not expired
    - Delete old token row (rotation), generate new pair, store new hash
    - Return `{ token, refresh_token }` on success, 401 on failure
    - _Requirements: 2.2, 2.3, 2.5_

  - [ ]* 3.4 Write property test for token expiry correctness (Property 3)
    - **Property 3: Token expiry correctness**
    - Verify access token JWT `exp` claim is within 1h ± 5s of issuance
    - **Validates: Requirements 2.1, 2.2**

  - [ ]* 3.5 Write property test for invalid refresh token rejection (Property 4)
    - **Property 4: Invalid refresh token rejection**
    - For any random string not in the DB, /auth/refresh returns 401
    - **Validates: Requirements 2.3**

  - [ ]* 3.6 Write property test for refresh token rotation (Property 6)
    - **Property 6: Refresh token rotation invalidates predecessor**
    - After a successful refresh, the old token hash no longer exists in DB
    - **Validates: Requirements 2.5**

- [x] 4. Checkpoint - Ensure DB and auth tests pass
  - Ensure all tests pass, ask the user if questions arise.

- [x] 5. Password complexity and validation schemas
  - [x] 5.1 Implement password complexity schema
    - Modify `packages/backend/src/schemas/auth.ts`
    - Create `passwordSchema` with `.min(8)` and three `.refine()` calls (uppercase, digit, special char)
    - Apply `passwordSchema` to `registerSchema.senha` field
    - Keep `loginSchema.senha` as simple `z.string().min(1)`
    - _Requirements: 4.1, 4.2, 4.3, 4.4, 4.5, 4.6_

  - [ ]* 5.2 Write property test for password complexity (Property 10)
    - **Property 10: Password complexity validation**
    - Generate random strings missing one or more character classes → must fail validation
    - Generate strings meeting all four requirements → must pass validation
    - **Validates: Requirements 4.1, 4.2, 4.3, 4.4, 4.5**

  - [x] 5.3 Add FormaPagamento enum validation to appointment schema
    - Modify `packages/backend/src/schemas/appointment.ts`
    - Define `FORMA_PAGAMENTO_VALUES` const array
    - Replace `forma_pagamento: z.string().nullable().optional()` with `z.enum(FORMA_PAGAMENTO_VALUES).nullable().optional()`
    - _Requirements: 5.2, 5.3, 5.4_

  - [ ]* 5.4 Write property test for forma_pagamento enum (Property 11)
    - **Property 11: forma_pagamento enum enforcement**
    - Any string not in the enum set → rejected
    - Any value in the enum set or null/undefined → accepted
    - **Validates: Requirements 5.2, 5.3, 5.4**

  - [x] 5.5 Add max length constraints to all text field schemas
    - Add `.max(2000, '{field}: máximo 2000 caracteres')` to:
      - `packages/backend/src/schemas/appointment.ts` → `notas` field (create and update)
      - `packages/backend/src/schemas/service.ts` → `descricao` field
      - `packages/backend/src/schemas/bill.ts` → `descricao` field
      - `packages/backend/src/schemas/inventory.ts` → `descricao` field (InventoryItem create/update)
    - Add `.max(2000)` to `comment` field in review schema (find in `packages/backend/src/routes/public.ts` or dedicated schema)
    - Add `.max(2000)` to `notas` field in stock movement schema within `packages/backend/src/schemas/inventory.ts`
    - _Requirements: 6.1, 6.2, 6.3, 6.4, 6.5, 6.6, 6.7_

  - [ ]* 5.6 Write property test for max length enforcement (Property 12)
    - **Property 12: Text field max length enforcement**
    - Strings > 2000 chars → rejected with field-specific error
    - Strings ≤ 2000 chars → pass length check
    - **Validates: Requirements 6.1, 6.2, 6.3, 6.4, 6.5, 6.6, 6.7**

- [x] 6. Upload tenant isolation
  - [x] 6.1 Update upload route with tenant namespacing
    - Modify `packages/backend/src/routes/upload.ts`
    - Extract `tenant_id` from `req.context` (or `user_id` as fallback)
    - Prefix stored filename with `${namespace}/` (e.g., `tenant-123/uuid.jpg`)
    - Return full namespaced URL in response
    - _Requirements: 3.1, 3.2, 3.5, 3.6_

  - [x] 6.2 Add file access verification middleware
    - Modify `packages/backend/src/routes/upload.ts` or create middleware in `packages/backend/src/middleware/`
    - For file access requests, parse tenant_id from file path prefix
    - Compare with requesting user's tenant_id
    - Return 403 if mismatch
    - _Requirements: 3.3, 3.4_

  - [ ]* 6.3 Write property test for upload path namespacing (Property 8)
    - **Property 8: Upload path tenant namespacing**
    - For any user with tenant_id, stored path starts with `{tenant_id}/`
    - For any user without tenant_id, stored path starts with `{user_id}/`
    - **Validates: Requirements 3.1, 3.2, 3.5, 3.6**

  - [ ]* 6.4 Write property test for cross-tenant file access denial (Property 9)
    - **Property 9: Cross-tenant file access denial**
    - Any request where user's tenant_id ≠ file path tenant_id → 403
    - **Validates: Requirements 3.3, 3.4**

- [x] 7. Checkpoint - Ensure backend tests pass
  - Ensure all tests pass, ask the user if questions arise.

- [x] 8. Frontend token storage migration
  - [x] 8.1 Migrate AuthContext to sessionStorage
    - Modify `packages/frontend/src/contexts/AuthContext.tsx`
    - Replace all `localStorage.getItem('token')` with `sessionStorage.getItem('token')`
    - Replace all `localStorage.setItem('token', ...)` with `sessionStorage.setItem('token', ...)`
    - Store `refresh_token` in sessionStorage on login/register success
    - On logout, remove both `token` and `refresh_token` from sessionStorage
    - Remove any `localStorage` references for auth data (`token`, `refresh_token`, `user`)
    - _Requirements: 1.1, 1.2, 1.4, 1.5_

  - [x] 8.2 Add token refresh interceptor to API client
    - Modify `packages/frontend/src/lib/api.ts`
    - Add `isTokenExpiringSoon(token)` helper (checks if < 5 min remaining)
    - Add `ensureFreshToken()` with deduplication (single in-flight refresh)
    - Add `refreshAccessToken()` that calls POST /auth/refresh
    - Integrate into request interceptor: call `ensureFreshToken()` before each request
    - On 401 response from non-auth routes: clear tokens, redirect to /login
    - _Requirements: 1.3, 1.6, 2.6, 2.7_

  - [ ]* 8.3 Write unit tests for token storage and refresh logic
    - Test that login stores tokens in sessionStorage (not localStorage)
    - Test that logout clears both tokens from sessionStorage
    - Test that 401 response triggers token cleanup and redirect
    - Test that `isTokenExpiringSoon` correctly identifies near-expiry tokens
    - **Validates: Requirements 1.1, 1.2, 1.3, 1.4, 1.5, 1.6**

- [x] 9. Final checkpoint - Ensure all tests pass
  - Ensure all tests pass, ask the user if questions arise.

## Notes

- Tasks marked with `*` are optional and can be skipped for faster MVP
- Each task references specific requirements for traceability
- Checkpoints ensure incremental validation
- Property tests validate universal correctness properties from the design document
- Unit tests validate specific examples and edge cases
- DB migrations (tasks 1.1, 1.2) must run before any backend code that depends on the new models/enums
- The data migration script (1.2) should be run manually after the Prisma migration to convert existing free-text forma_pagamento values

## Task Dependency Graph

```json
{
  "waves": [
    { "id": 0, "tasks": ["1.1", "1.2"] },
    { "id": 1, "tasks": ["2.1", "3.1", "5.1", "5.3", "5.5"] },
    { "id": 2, "tasks": ["2.2", "2.3", "3.2", "5.2", "5.4", "5.6"] },
    { "id": 3, "tasks": ["3.3", "6.1"] },
    { "id": 4, "tasks": ["3.4", "3.5", "3.6", "6.2"] },
    { "id": 5, "tasks": ["6.3", "6.4"] },
    { "id": 6, "tasks": ["8.1"] },
    { "id": 7, "tasks": ["8.2"] },
    { "id": 8, "tasks": ["8.3"] }
  ]
}
```
