# Implementation Plan

- [x] 1. Write bug condition exploration tests
  - **Property 1: Bug Condition** - Production Readiness Defects
  - **CRITICAL**: These tests MUST FAIL on unfixed code - failure confirms the bugs exist
  - **DO NOT attempt to fix the tests or the code when they fail**
  - **NOTE**: These tests encode the expected behavior - they will validate the fixes when they pass after implementation
  - **GOAL**: Surface counterexamples that demonstrate each bug exists
  - **Scoped PBT Approach**: For deterministic bugs, scope properties to concrete failing cases
  - Test 1.1: `getSecret()` returns fallback string when `JWT_SECRET` is unset (instead of throwing) — delete `JWT_SECRET` from `process.env`, call `getSecret()`, assert it throws `Error`
  - Test 1.8: `GET /health` returns `{ status: 'ok' }` with HTTP 200 even when DB is unreachable — mock `prisma.$queryRaw` to reject, call `/health`, assert status is 503 (will fail: returns 200)
  - Test 1.11: Upload accepts file with `mimetype: 'image/jpeg'` but buffer content is `0xDE 0xAD 0xBE 0xEF` (not JPEG magic bytes) — POST to `/upload` with forged buffer, assert 400 rejection (will fail: returns 201)
  - Test 1.12: `generateSlug()` uses `Math.random()` — spy on `Math.random` and `crypto.randomBytes`, call `generateSlug('existing-name')` with collision, assert `crypto.randomBytes` was called (will fail: `Math.random` is called instead)
  - Run tests on UNFIXED code
  - **EXPECTED OUTCOME**: Tests FAIL (this is correct - it proves the bugs exist)
  - Document counterexamples found to understand root causes
  - Mark task complete when tests are written, run, and failures are documented
  - _Requirements: 1.1, 1.8, 1.11, 1.12_

- [x] 2. Write preservation property tests (BEFORE implementing fixes)
  - **Property 2: Preservation** - Existing Functionality Unchanged
  - **IMPORTANT**: Follow observation-first methodology
  - Observe on UNFIXED code: `POST /auth/register` with valid data returns 201 + JWT + user data
  - Observe on UNFIXED code: `POST /auth/login` with valid credentials returns 200 + JWT
  - Observe on UNFIXED code: Protected routes with valid token return expected data
  - Observe on UNFIXED code: `POST /upload` with valid JPEG buffer (starts with `0xFF 0xD8 0xFF`) returns 201 + URL
  - Observe on UNFIXED code: `POST /upload` with valid PNG buffer (starts with `0x89 0x50 0x4E 0x47`) returns 201 + URL
  - Observe on UNFIXED code: `GET /health` returns 200 when DB is accessible
  - Observe on UNFIXED code: `slugify('Café & Bar')` returns `'cafe-bar'`
  - Write property-based tests with fast-check:
    - Auth flow: for all valid email/password combos, register → login → access protected route succeeds
    - Upload valid images: for all buffers starting with JPEG/PNG magic bytes (< 5MB), upload returns 201 + URL
    - Slugify: for all arbitrary strings, `slugify(s)` produces lowercase alphanumeric-hyphen output with no leading/trailing hyphens
    - Health check: when DB is accessible, `/health` returns 200 with `{ status: 'ok' }` (or superset)
  - Run tests on UNFIXED code
  - **EXPECTED OUTCOME**: Tests PASS (this confirms baseline behavior to preserve)
  - Mark task complete when tests are written, run, and passing on unfixed code
  - _Requirements: 3.1, 3.2, 3.3, 3.5, 3.10_

- [x] 3. Fix 1.1 — JWT Secret obrigatório

  - [x] 3.1 Remove fallback from `getSecret()` in `packages/backend/src/lib/jwt.ts`
    - Remove `|| 'dev-secret-key-change-in-production'` fallback
    - Throw `Error('FATAL: JWT_SECRET environment variable is required')` when `JWT_SECRET` is undefined
    - Allow test-only fallback when `NODE_ENV === 'test'` or `VITEST === 'true'`
    - _Bug_Condition: isBugCondition(input) where input.env.JWT_SECRET is undefined AND system starts with fallback secret_
    - _Expected_Behavior: System throws fatal error on startup when JWT_SECRET is missing_
    - _Preservation: Test environment continues to work with test-only secret_
    - _Requirements: 2.1_

  - [x] 3.2 Verify bug condition exploration test for JWT now passes
    - **Property 1: Expected Behavior** - JWT Secret Required
    - **IMPORTANT**: Re-run the SAME test from task 1 (JWT test) - do NOT write a new test
    - **EXPECTED OUTCOME**: Test PASSES (confirms `getSecret()` throws without `JWT_SECRET`)
    - _Requirements: 2.1_

  - [x] 3.3 Verify preservation tests still pass
    - **Property 2: Preservation** - Auth Flow Unchanged
    - **IMPORTANT**: Re-run the SAME tests from task 2 - do NOT write new tests
    - **EXPECTED OUTCOME**: Tests PASS (auth flow works identically with `JWT_SECRET` set in test env)

- [x] 4. Fix 1.2 — Docker Compose sem credenciais hardcoded

  - [x] 4.1 Update `docker-compose.yml` to use environment variable references
    - Replace hardcoded `POSTGRES_USER: postgres` with `${POSTGRES_USER:-postgres}`
    - Replace hardcoded `POSTGRES_PASSWORD: postgres` with `${POSTGRES_PASSWORD:?POSTGRES_PASSWORD is required}`
    - Replace hardcoded `POSTGRES_DB: smp_dev` with `${POSTGRES_DB:-smp_dev}`
    - Replace hardcoded `DATABASE_URL` with `${DATABASE_URL:?DATABASE_URL is required}`
    - Replace hardcoded `JWT_SECRET` with `${JWT_SECRET:?JWT_SECRET is required}`
    - Replace hardcoded `CORS_ORIGINS` with `${CORS_ORIGINS:-http://localhost:5173}`
    - Replace hardcoded `PORT` with `${PORT:-3000}`
    - _Bug_Condition: docker-compose.yml contains hardcoded credentials_
    - _Expected_Behavior: All secrets use env var references with required validation_
    - _Requirements: 2.2_

  - [x] 4.2 Create `.env.example` at project root with documented placeholders
    - Include `POSTGRES_USER`, `POSTGRES_PASSWORD`, `POSTGRES_DB`, `DATABASE_URL`
    - Include `JWT_SECRET` with note about minimum 32 chars
    - Include `PORT`, `CORS_ORIGINS`, `GCS_BUCKET`, `SLOW_QUERY_MS`
    - _Requirements: 2.2_

  - [x] 4.3 Update `.gitignore` to exclude `.env` files (Fix 1.9 combined)
    - Add `.env`, `.env.*`, `!.env.example`, `dist/`, `uploads/`, `*.log`, `.DS_Store`
    - _Bug_Condition: .gitignore only contains node_modules_
    - _Expected_Behavior: Sensitive files and build artifacts are excluded from git_
    - _Requirements: 2.9_

- [x] 5. Fix 1.3 — Logging estruturado

  - [x] 5.1 Create `packages/backend/src/lib/logger.ts` with structured JSON logging
    - Implement `logger` object with `info`, `warn`, `error`, `debug` methods
    - Each log entry: `{ timestamp, level, message, ...meta }` as JSON
    - Write to `process.stdout` (info/warn/debug) and `process.stderr` (error)
    - Export `generateRequestId()` using `crypto.randomUUID()`
    - _Bug_Condition: System uses console.error/console.log without structure_
    - _Expected_Behavior: All logs are structured JSON with timestamp, level, message_
    - _Requirements: 2.3_

  - [x] 5.2 Write unit test for logger output format
    - Verify `logger.info('test')` produces valid JSON with `timestamp`, `level: 'info'`, `message: 'test'`
    - Verify `logger.error('fail', { code: 500 })` includes meta fields
    - Verify error logs go to stderr, info logs go to stdout
    - _Requirements: 2.3_

- [x] 6. Fix 1.4 — Graceful Shutdown

  - [x] 6.1 Implement graceful shutdown in `packages/backend/src/index.ts`
    - Capture `app.listen()` return value in `server` variable
    - Register handlers for `SIGTERM` and `SIGINT`
    - On signal: stop accepting new connections, await pending requests (10s timeout), disconnect Prisma, exit
    - Use `logger` instead of `console.log` for server startup message
    - _Bug_Condition: No graceful shutdown handler exists for SIGTERM/SIGINT_
    - _Expected_Behavior: Server closes HTTP connections, disconnects Prisma, exits cleanly_
    - _Preservation: Server startup and request handling unchanged_
    - _Requirements: 2.4_

  - [x] 6.2 Write unit test for graceful shutdown behavior
    - Verify `SIGTERM` handler calls `server.close()` and `prisma.$disconnect()`
    - Verify forced shutdown after timeout (10s)
    - _Requirements: 2.4_

- [x] 7. Fix 1.5 — Nginx hardening

  - [x] 7.1 Create `packages/frontend/nginx.conf` with security headers
    - Add `X-Content-Type-Options: nosniff`
    - Add `X-Frame-Options: DENY`
    - Add `X-XSS-Protection: 1; mode=block`
    - Add `Referrer-Policy: strict-origin-when-cross-origin`
    - Enable gzip for `text/plain text/css application/json application/javascript text/xml`
    - Add cache headers for `/assets/` (1y, public, immutable)
    - Keep SPA fallback `try_files $uri $uri/ /index.html`
    - _Bug_Condition: nginx serves without security headers, gzip, or cache headers_
    - _Expected_Behavior: All security headers present, gzip enabled, assets cached_
    - _Requirements: 2.5_

  - [x] 7.2 Update `packages/frontend/Dockerfile` to use external nginx.conf
    - Replace inline `RUN echo '...'` with `COPY nginx.conf /etc/nginx/conf.d/default.conf`
    - _Requirements: 2.5_

- [ ] 8. Fix 1.6 — Docker non-root user

  - [x] 8.1 Update `packages/backend/Dockerfile` to run as non-root
    - Add `RUN chown -R node:node /app` before `USER node`
    - Add `USER node` instruction after `mkdir -p uploads`
    - Node Alpine image already includes `node` user
    - _Bug_Condition: Docker process runs as root user_
    - _Expected_Behavior: Process runs as user `node` (non-root)_
    - _Preservation: Multi-stage build, Alpine base, uploads dir, migrations all unchanged_
    - _Requirements: 2.6_

- [ ] 9. Fix 1.7 — Prisma connection pool e logging

  - [x] 9.1 Update `packages/backend/src/lib/prisma.ts` with pool config and logging
    - Configure `PrismaClient` with `log: [{ level: 'warn', emit: 'event' }, { level: 'error', emit: 'event' }, { level: 'query', emit: 'event' }]`
    - Add `$on('query')` handler to log slow queries above `SLOW_QUERY_MS` threshold (default 500ms)
    - Add `$on('warn')` and `$on('error')` handlers using `logger`
    - Import and use `logger` from `./logger`
    - _Bug_Condition: PrismaClient instantiated without pool config or logging_
    - _Expected_Behavior: Slow queries logged, errors captured, pool configured via DATABASE_URL params_
    - _Requirements: 2.7_

- [ ] 10. Fix 1.8 — Health check com verificação de DB

  - [x] 10.1 Update `/health` endpoint in `packages/backend/src/index.ts`
    - Replace static `res.json({ status: 'ok' })` with async handler
    - Execute `prisma.$queryRaw\`SELECT 1\`` to verify DB connectivity
    - Return `{ status: 'ok', db: 'connected' }` on success
    - Return 503 `{ status: 'unhealthy', db: 'disconnected' }` on failure
    - Log health check failures with `logger.error`
    - _Bug_Condition: /health returns 200 without verifying DB connectivity_
    - _Expected_Behavior: /health returns 503 when DB is unreachable_
    - _Preservation: /health returns 200 when DB is accessible_
    - _Requirements: 2.8_

  - [x] 10.2 Verify bug condition exploration test for health check now passes
    - **Property 1: Expected Behavior** - Health Check DB Verification
    - **IMPORTANT**: Re-run the SAME test from task 1 (health check test) - do NOT write a new test
    - **EXPECTED OUTCOME**: Test PASSES (confirms /health returns 503 when DB is down)
    - _Requirements: 2.8_

  - [x] 10.3 Verify preservation tests still pass
    - **Property 2: Preservation** - Health Check When DB Accessible
    - **IMPORTANT**: Re-run the SAME tests from task 2 - do NOT write new tests
    - **EXPECTED OUTCOME**: Tests PASS (health check returns 200 when DB is up)

- [ ] 11. Fix 1.10 — Dashboard queries otimizadas

  - [x] 11.1 Rewrite `packages/backend/src/routes/dashboard.ts` with aggregation queries
    - Replace `findMany` + in-memory `reduce` for completed appointments with `prisma.appointment.aggregate({ _sum: { valor_servico, desconto }, _count })`
    - Replace `findMany` + `filter` for all appointments with targeted `aggregate` queries per status
    - Replace `findMany` for sales movements with `prisma.stockMovement.aggregate` joined with item value
    - Replace `findMany` + `filter` for bills with `prisma.bill.groupBy({ by: ['status'], _sum: { valor }, _count })`
    - Replace `findMany` for monthly bills with `aggregate` filtered by date range
    - Replace `findMany` for inventory with `prisma.inventoryItem.aggregate`
    - Keep the same response JSON shape
    - Use `logger` instead of `console.error` for error handling
    - _Bug_Condition: Dashboard loads all records into memory for calculations_
    - _Expected_Behavior: All calculations done via DB aggregations, no full table scans_
    - _Preservation: Response JSON shape and values identical for same data_
    - _Requirements: 2.10_

  - [x] 11.2 Write integration test for dashboard response shape
    - Seed test data with known appointments, bills, inventory
    - Call `GET /dashboard/stats` and verify response matches expected shape and values
    - Verify no `findMany` without aggregation is used (can spy on prisma methods)
    - _Requirements: 2.10_

- [x] 12. Fix 1.11 — Validação de magic bytes no upload

  - [x] 12.1 Add `validateMagicBytes()` function to `packages/backend/src/routes/upload.ts`
    - Define `MAGIC_BYTES` map: `image/jpeg` → `[0xFF, 0xD8, 0xFF]`, `image/png` → `[0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A]`
    - Implement `validateMagicBytes(buffer: Buffer, declaredMime: string): boolean`
    - Call validation after `req.file` check, before saving
    - Return 400 `{ error: 'Conteúdo do arquivo não corresponde ao tipo declarado' }` on mismatch
    - _Bug_Condition: Upload validates only mimetype header, not actual file content_
    - _Expected_Behavior: Upload rejects files whose magic bytes don't match declared mimetype_
    - _Preservation: Valid JPEG/PNG uploads continue to work_
    - _Requirements: 2.11_

  - [x] 12.2 Verify bug condition exploration test for upload now passes
    - **Property 1: Expected Behavior** - Magic Bytes Validation
    - **IMPORTANT**: Re-run the SAME test from task 1 (upload test) - do NOT write a new test
    - **EXPECTED OUTCOME**: Test PASSES (confirms forged mimetype is rejected with 400)
    - _Requirements: 2.11_

  - [x] 12.3 Verify preservation tests still pass
    - **Property 2: Preservation** - Valid Upload Unchanged
    - **IMPORTANT**: Re-run the SAME tests from task 2 - do NOT write new tests
    - **EXPECTED OUTCOME**: Tests PASS (valid JPEG/PNG uploads still return 201)

  - [x] 12.4 Write property-based test for `validateMagicBytes` with fast-check
    - Generate arbitrary buffers with `fc.uint8Array()` and verify:
      - Buffers starting with `[0xFF, 0xD8, 0xFF]` + arbitrary tail → accepted as `image/jpeg`
      - Buffers starting with `[0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A]` + arbitrary tail → accepted as `image/png`
      - Buffers NOT starting with valid magic bytes → rejected for both mimetypes
    - _Requirements: 2.11_

- [ ] 13. Fix 1.12 — Slug com crypto seguro e retry

  - [x] 13.1 Update `generateSlug()` in `packages/backend/src/lib/slug.ts`
    - Import `randomBytes` from `crypto`
    - Replace `Math.random().toString(36).substring(2, 6)` with `randomBytes(4).toString('hex')` (8 hex chars)
    - Implement retry loop (max 5 attempts) checking uniqueness with `prisma.tenant.findUnique`
    - Throw `Error` if all retries exhausted
    - _Bug_Condition: Slug suffix uses Math.random() without retry_
    - _Expected_Behavior: Slug uses crypto.randomBytes with retry loop for uniqueness_
    - _Preservation: slugify() function unchanged, base slug generation unchanged_
    - _Requirements: 2.12_

  - [x] 13.2 Verify bug condition exploration test for slug now passes
    - **Property 1: Expected Behavior** - Crypto Secure Slug
    - **IMPORTANT**: Re-run the SAME test from task 1 (slug test) - do NOT write a new test
    - **EXPECTED OUTCOME**: Test PASSES (confirms crypto.randomBytes is used, not Math.random)
    - _Requirements: 2.12_

  - [x] 13.3 Verify preservation tests still pass
    - **Property 2: Preservation** - Slugify Behavior Unchanged
    - **IMPORTANT**: Re-run the SAME tests from task 2 - do NOT write new tests
    - **EXPECTED OUTCOME**: Tests PASS (slugify produces same output for same input)

  - [x] 13.4 Write property-based test for slug uniqueness with fast-check
    - Generate arbitrary company names with `fc.string()` and verify:
      - `slugify(name)` always produces lowercase, alphanumeric-hyphen output
      - No leading or trailing hyphens
      - No consecutive hyphens
    - _Requirements: 2.12_

- [x] 14. Replace `console.log`/`console.error` with `logger` across codebase

  - [x] 14.1 Update `packages/backend/src/index.ts` to use `logger`
    - Replace `console.log(\`Server running on port ${PORT}\`)` with `logger.info(...)`
    - Import `logger` from `./lib/logger`
    - _Requirements: 2.3_

  - [x] 14.2 Update `packages/backend/src/routes/dashboard.ts` to use `logger`
    - Replace `console.error('Dashboard stats error:', err)` with `logger.error(...)`
    - _Requirements: 2.3_

  - [x] 14.3 Scan all route files for remaining `console.log`/`console.error` and replace with `logger`
    - Check all files in `packages/backend/src/routes/`
    - Check `packages/backend/src/middleware/auth.ts`
    - _Requirements: 2.3_

- [x] 15. Checkpoint - Ensure all tests pass
  - Run full test suite: `cd packages/backend && npm test`
  - Verify all bug condition exploration tests from task 1 now PASS
  - Verify all preservation tests from task 2 still PASS
  - Verify all new unit/property-based tests PASS
  - Verify no regressions in existing test files
  - Ensure all tests pass, ask the user if questions arise
