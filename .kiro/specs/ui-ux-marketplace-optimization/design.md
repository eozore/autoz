# Design Document: UI/UX Marketplace Optimization

## Overview

This feature optimizes the Autoz bilateral marketplace UX across 12 pages, focusing on the admin panel (shop owner experience) first. It introduces six subsystems: Design System (shared tokens + components), Onboarding Engine (persistent progress tracking), Review System (real customer reviews replacing mocks), Gamification Engine (badges and engagement), Cold Start Handler (progressive mock→real data), and Analytics Event system (interaction tracking). All changes are full-stack with DB schema additions, following the existing multi-tenant architecture.

## Architecture

This feature extends the existing Autoz monorepo (React 19 + Vite frontend, Express + Prisma + PostgreSQL backend) with six new subsystems: Design System, Onboarding Engine, Review System, Gamification Engine, Cold Start Handler, and Analytics Event system. All subsystems follow the existing multi-tenant architecture keyed by `tenant_id`.

### High-Level Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                     Frontend (React 19 + Vite)               │
├──────────────┬──────────────┬───────────────────────────────┤
│ Design System│  Admin Panel │       Public Page              │
│ (tokens +   │ (Dashboard,  │  (Reviews, Liquidity,         │
│  components) │  Onboarding, │   Cold Start, Booking)        │
│              │  Gamification)│                               │
└──────┬───────┴──────┬───────┴───────────────┬───────────────┘
       │              │                       │
       │     ┌────────▼────────┐     ┌────────▼────────┐
       │     │  Auth Routes    │     │  Public Routes   │
       │     │  /api/*         │     │  /public/:slug/* │
       │     └────────┬────────┘     └────────┬────────┘
       │              │                       │
       │     ┌────────▼───────────────────────▼────────┐
       │     │         Express Backend                  │
       │     │  ┌─────────────────────────────────┐    │
       │     │  │  Services Layer                  │    │
       │     │  │  - OnboardingService             │    │
       │     │  │  - ReviewService                 │    │
       │     │  │  - GamificationService           │    │
       │     │  │  - AnalyticsService              │    │
       │     │  │  - MetricsService                │    │
       │     │  │  - ColdStartService              │    │
       │     │  └──────────────┬──────────────────┘    │
       │     └─────────────────┬───────────────────────┘
       │                       │
       │              ┌────────▼────────┐
       │              │   PostgreSQL     │
       │              │   (Prisma ORM)   │
       │              └─────────────────┘
       │
  No runtime dependency — CSS only
```

### Technology Decisions

| Concern | Choice | Rationale |
|---------|--------|-----------|
| Design System | CSS custom properties + React components | Matches existing pattern in `index.css`; no external library per user requirement |
| State Management | React Context + hooks | Existing pattern (`AuthContext`); lightweight for this scope |
| API Layer | Express routes + Prisma | Existing pattern; all new routes follow same middleware chain |
| Validation | Zod schemas | Already used in `public.ts` routes |
| Testing | Vitest + fast-check | Already configured in backend `package.json` |
| Charts | Recharts | Already used in `DashboardPage` |

---

## Components and Interfaces

### Frontend Components

#### Design System (`packages/frontend/src/design-system/`)

```
design-system/
├── tokens.css              # CSS custom properties (single source of truth)
├── breakpoints.ts          # Responsive breakpoint constants
├── components/
│   ├── Button.tsx
│   ├── Card.tsx
│   ├── Input.tsx
│   ├── Badge.tsx
│   ├── Modal.tsx
│   ├── EmptyState.tsx
│   ├── ProgressBar.tsx
│   ├── Tooltip.tsx
│   └── index.ts            # Barrel export
└── index.ts
```

#### Admin Panel Components (`packages/frontend/src/components/`)

```
components/
├── onboarding/
│   ├── OnboardingBanner.tsx       # Persistent checklist banner
│   ├── OnboardingStepCard.tsx     # Individual step with action
│   └── ContextualTip.tsx          # Dismissible page tips
├── gamification/
│   ├── ProfileCompleteness.tsx    # Percentage ring
│   ├── BadgeDisplay.tsx           # Badge grid
│   └── WeeklyEngagement.tsx       # Week-over-week summary
├── metrics/
│   ├── ConversionRate.tsx         # Booking conversion KPI
│   ├── RepeatCustomers.tsx        # Returning clients KPI
│   └── CustomerRating.tsx         # Average rating display
└── services/
    ├── ServiceAutofill.tsx        # Template suggestions
    └── BulkImportModal.tsx        # Multi-service import
```

#### Public Page Components (`packages/frontend/src/components/public/`)

```
public/
├── ReviewSection.tsx          # Real reviews or cold-start placeholders
├── LiquiditySignals.tsx       # Activity indicators with polling
├── TrustBadges.tsx            # Conditional trust badges
├── FAQSection.tsx             # Custom or fallback FAQs
└── ServiceCard.tsx            # Price + duration display
```

### Backend Services (`packages/backend/src/services/`)

```
services/
├── onboarding.service.ts      # Step tracking, persistence, retry logic
├── review.service.ts          # CRUD, validation, aggregation
├── gamification.service.ts    # Badge logic, completeness calculation
├── analytics.service.ts       # Event recording, fail-silent wrapper
├── metrics.service.ts         # Conversion, repeat %, response time
└── cold-start.service.ts      # Threshold checks, fallback data
```

---

## Interfaces

### New API Endpoints

#### Onboarding Routes (`/api/onboarding`)

```typescript
// GET /api/onboarding/progress
interface OnboardingProgressResponse {
  steps: OnboardingStep[];
  completenessPercent: number;
  allCompleted: boolean;
}

interface OnboardingStep {
  key: OnboardingStepKey;
  title: string;
  description: string;
  completed: boolean;
  completedAt: string | null;
}

type OnboardingStepKey =
  | 'company_profile'
  | 'services_setup'
  | 'location_setup'
  | 'first_client'
  | 'first_appointment'
  | 'public_page_activation'
  | 'first_review_received';

// POST /api/onboarding/complete-step
interface CompleteStepRequest {
  step: OnboardingStepKey;
}

interface CompleteStepResponse {
  success: boolean;
  step: OnboardingStep;
  completenessPercent: number;
  badgeAwarded?: string;
}
```

#### Review Routes (`/api/reviews` and `/public/:slug/reviews`)

```typescript
// POST /public/:slug/reviews
interface CreateReviewRequest {
  appointment_id: string;
  rating: number;        // 1-5
  comment: string;       // 10-500 chars
  customer_name: string;
  vehicle_description: string;
}

// GET /public/:slug/reviews
interface PublicReviewsResponse {
  reviews: Review[];
  aggregateRating: number | null;  // Mean rounded to 1 decimal
  totalCount: number;
  isPlaceholder: boolean;          // true when < 3 real reviews
}

interface Review {
  id: string;
  rating: number;
  comment: string;
  customerName: string;
  vehicleDescription: string;
  createdAt: string;
  isPlaceholder: boolean;
}
```

#### Gamification Routes (`/api/gamification`)

```typescript
// GET /api/gamification/badges
interface BadgesResponse {
  badges: Badge[];
  profileCompleteness: number;
  weeklyEngagement: WeeklyEngagement;
}

interface Badge {
  id: string;
  type: BadgeType;
  awardedAt: string;
  label: string;
}

type BadgeType = 'perfil_completo' | 'streak_mensal' | 'primeiro_review';

interface WeeklyEngagement {
  currentWeek: { appointments: number; newClients: number; revenue: number };
  previousWeek: { appointments: number; newClients: number; revenue: number };
}
```

#### Metrics Routes (`/api/dashboard/marketplace-metrics`)

```typescript
// GET /api/dashboard/marketplace-metrics
interface MarketplaceMetricsResponse {
  conversionRate: number;          // confirmed / page_views as percentage
  averageRating: number | null;    // arithmetic mean, 1 decimal
  repeatCustomerPercent: number;   // returning / total unique, 90 days
  completedThisMonth: number;
  avgResponseTimeMinutes: number | null;  // booking → confirmation, last 30
}
```

#### Analytics Routes (`/api/analytics`)

```typescript
// POST /api/analytics/events (internal, called by frontend)
interface AnalyticsEventRequest {
  event_type: AnalyticsEventType;
  metadata: Record<string, unknown>;
}

type AnalyticsEventType =
  | 'page_view'
  | 'booking_started'
  | 'booking_completed'
  | 'onboarding_step_completed'
  | 'service_created'
  | 'review_submitted';
```

#### Public Liquidity Routes (`/public/:slug/liquidity`)

```typescript
// GET /public/:slug/liquidity
interface LiquidityResponse {
  completedThisMonth: number;
  avgResponseTimeMinutes: number | null;
  isColdStart: boolean;            // true when < 5 completed
  totalCompleted: number;
}
```

#### FAQ Routes (`/api/faqs` and `/public/:slug/faqs`)

```typescript
// GET /public/:slug/faqs
interface PublicFAQsResponse {
  faqs: FAQ[];
  isFallback: boolean;
}

interface FAQ {
  id: string;
  question: string;
  answer: string;
  sortOrder: number;
}

// POST /api/faqs
interface CreateFAQRequest {
  question: string;
  answer: string;
  sortOrder?: number;
}
```

#### Bulk Service Import (`/api/services/bulk`)

```typescript
// POST /api/services/bulk
interface BulkServiceImportRequest {
  services: Array<{
    nome: string;
    duracao_minutos: number;
    valor?: number;
  }>;
}

interface BulkServiceImportResponse {
  created: number;
  services: Array<{ id: string; nome: string }>;
}
```

---

## Data Models

### New Prisma Schema Additions

```prisma
// ==================== NEW ENUMS ====================

enum OnboardingStepKey {
  COMPANY_PROFILE
  SERVICES_SETUP
  LOCATION_SETUP
  FIRST_CLIENT
  FIRST_APPOINTMENT
  PUBLIC_PAGE_ACTIVATION
  FIRST_REVIEW_RECEIVED
}

enum BadgeType {
  PERFIL_COMPLETO
  STREAK_MENSAL
  PRIMEIRO_REVIEW
}

enum AnalyticsEventType {
  PAGE_VIEW
  BOOKING_STARTED
  BOOKING_COMPLETED
  ONBOARDING_STEP_COMPLETED
  SERVICE_CREATED
  REVIEW_SUBMITTED
}

// ==================== NEW MODELS ====================

model OnboardingProgress {
  id           String            @id @default(uuid())
  tenant_id    String
  step         OnboardingStepKey
  completed    Boolean           @default(false)
  completed_at DateTime?
  created_at   DateTime          @default(now())
  updated_at   DateTime          @updatedAt

  tenant Tenant @relation(fields: [tenant_id], references: [id])

  @@unique([tenant_id, step])
  @@index([tenant_id])
  @@map("onboarding_progress")
}

model Review {
  id                  String   @id @default(uuid())
  tenant_id           String
  appointment_id      String
  rating              Int      // 1-5
  comment             String   // 10-500 chars
  customer_name       String
  vehicle_description String
  created_at          DateTime @default(now())

  tenant      Tenant      @relation(fields: [tenant_id], references: [id])
  appointment Appointment @relation(fields: [appointment_id], references: [id])

  @@unique([appointment_id])
  @@index([tenant_id])
  @@index([tenant_id, created_at])
  @@map("reviews")
}

model Badge {
  id         String    @id @default(uuid())
  tenant_id  String
  type       BadgeType
  awarded_at DateTime  @default(now())
  created_at DateTime  @default(now())

  tenant Tenant @relation(fields: [tenant_id], references: [id])

  @@unique([tenant_id, type])
  @@index([tenant_id])
  @@map("badges")
}

model AnalyticsEvent {
  id         String             @id @default(uuid())
  tenant_id  String
  event_type AnalyticsEventType
  metadata   Json               @default("{}")
  created_at DateTime           @default(now())

  tenant Tenant @relation(fields: [tenant_id], references: [id])

  @@index([tenant_id])
  @@index([tenant_id, event_type])
  @@index([created_at])
  @@map("analytics_events")
}

model FAQ {
  id         String   @id @default(uuid())
  tenant_id  String
  question   String
  answer     String
  sort_order Int      @default(0)
  created_at DateTime @default(now())
  updated_at DateTime @updatedAt

  tenant Tenant @relation(fields: [tenant_id], references: [id])

  @@index([tenant_id])
  @@map("faqs")
}

model TenantSettings {
  id                String   @id @default(uuid())
  tenant_id         String   @unique
  garantia_enabled  Boolean  @default(false)
  tips_dismissed    Json     @default("[]")  // Array of page keys
  created_at        DateTime @default(now())
  updated_at        DateTime @updatedAt

  tenant Tenant @relation(fields: [tenant_id], references: [id])

  @@map("tenant_settings")
}
```

### Schema Changes to Existing Models

```prisma
// Add relations to Tenant model:
model Tenant {
  // ... existing fields ...
  onboardingProgress OnboardingProgress[]
  reviews            Review[]
  badges             Badge[]
  analyticsEvents    AnalyticsEvent[]
  faqs               FAQ[]
  settings           TenantSettings?
}

// Add relation to Appointment model:
model Appointment {
  // ... existing fields ...
  review Review?
}
```

### Onboarding Step Weights

```typescript
const ONBOARDING_WEIGHTS: Record<OnboardingStepKey, number> = {
  COMPANY_PROFILE: 20,
  SERVICES_SETUP: 20,
  LOCATION_SETUP: 15,
  FIRST_CLIENT: 15,
  FIRST_APPOINTMENT: 15,
  PUBLIC_PAGE_ACTIVATION: 10,
  FIRST_REVIEW_RECEIVED: 5,
};
// Total: 100
```

---

## Error Handling

### Onboarding Retry Strategy

```typescript
interface RetryConfig {
  maxRetries: 3;
  baseDelayMs: 500;
  backoffMultiplier: 2;
  // Delays: 500ms, 1000ms, 2000ms
}

async function persistWithRetry(
  operation: () => Promise<void>,
  config: RetryConfig
): Promise<{ success: boolean; attempts: number }> {
  for (let attempt = 1; attempt <= config.maxRetries; attempt++) {
    try {
      await operation();
      return { success: true, attempts: attempt };
    } catch (error) {
      if (attempt === config.maxRetries) {
        return { success: false, attempts: attempt };
      }
      const delay = config.baseDelayMs * Math.pow(config.backoffMultiplier, attempt - 1);
      await sleep(delay);
    }
  }
  return { success: false, attempts: config.maxRetries };
}
```

### Analytics Fail-Silent Pattern

```typescript
async function trackEvent(
  tenantId: string,
  eventType: AnalyticsEventType,
  metadata: Record<string, unknown>
): Promise<void> {
  try {
    await prisma.analyticsEvent.create({
      data: { tenant_id: tenantId, event_type: eventType, metadata },
    });
  } catch (error) {
    // Log but never throw — analytics must not block user operations
    logger.warn('Analytics event write failed', { tenantId, eventType, error: String(error) });
  }
}
```

### Review Validation

```typescript
const reviewSchema = z.object({
  appointment_id: z.string().uuid(),
  rating: z.number().int().min(1).max(5),
  comment: z.string().min(10, 'Comentário deve ter pelo menos 10 caracteres').max(500),
  customer_name: z.string().min(1),
  vehicle_description: z.string().min(1),
});
```

### Service Form Validation

```typescript
const serviceSchema = z.object({
  nome: z.string().min(1, 'Nome é obrigatório').max(200),
  duracao_minutos: z.number().int().min(5, 'Duração mínima: 5 minutos').max(480),
  valor: z.number().min(0).optional(),
});
```

---

## Key Algorithms

### Aggregate Rating Calculation

```typescript
function calculateAggregateRating(ratings: number[]): number | null {
  if (ratings.length === 0) return null;
  const sum = ratings.reduce((acc, r) => acc + r, 0);
  return Math.round((sum / ratings.length) * 10) / 10;
}
```

### Repeat Customer Percentage

```typescript
function calculateRepeatCustomerPercent(
  appointments: Array<{ client_id: string | null }>
): number {
  const clientCounts = new Map<string, number>();
  for (const appt of appointments) {
    if (!appt.client_id) continue;
    clientCounts.set(appt.client_id, (clientCounts.get(appt.client_id) || 0) + 1);
  }
  const totalUnique = clientCounts.size;
  if (totalUnique === 0) return 0;
  const returning = [...clientCounts.values()].filter(count => count >= 2).length;
  return Math.round((returning / totalUnique) * 100);
}
```

### Booking Conversion Rate

```typescript
function calculateConversionRate(
  confirmedAppointments: number,
  pageViews: number
): number {
  if (pageViews === 0) return 0;
  return Math.round((confirmedAppointments / pageViews) * 10000) / 100;
}
```

### Profile Completeness

```typescript
function calculateCompleteness(
  completedSteps: OnboardingStepKey[],
  weights: Record<OnboardingStepKey, number>
): number {
  const totalWeight = Object.values(weights).reduce((a, b) => a + b, 0);
  const completedWeight = completedSteps.reduce(
    (sum, step) => sum + (weights[step] || 0), 0
  );
  return Math.round((completedWeight / totalWeight) * 100);
}
```

### Cold Start Threshold Logic

```typescript
interface ColdStartConfig {
  reviewThreshold: 3;       // Show real reviews at >= 3
  liquidityThreshold: 5;    // Show real liquidity at >= 5
  demandThreshold: 10;      // Show real demand stats at >= 10
}

function shouldShowRealData(
  completedCount: number,
  threshold: number
): boolean {
  return completedCount >= threshold;
}
```

### Service Autofill Matching

```typescript
const SERVICE_TEMPLATES = [
  { nome: 'Troca de Óleo e Filtro', duracao_minutos: 45, valor: 150 },
  { nome: 'Alinhamento e Balanceamento', duracao_minutos: 60, valor: 120 },
  { nome: 'Revisão Completa', duracao_minutos: 120, valor: 250 },
  { nome: 'Diagnóstico Eletrônico', duracao_minutos: 30, valor: 100 },
  { nome: 'Lavagem Completa', duracao_minutos: 60, valor: 90 },
  { nome: 'Troca de Pastilhas de Freio', duracao_minutos: 90, valor: 180 },
  { nome: 'Higienização de Ar Condicionado', duracao_minutos: 45, valor: 80 },
  { nome: 'Polimento e Cristalização', duracao_minutos: 180, valor: 350 },
];

function matchTemplates(input: string): typeof SERVICE_TEMPLATES {
  if (!input || input.length < 2) return [];
  const normalized = input.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
  return SERVICE_TEMPLATES.filter(t => {
    const tNorm = t.nome.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
    return tNorm.includes(normalized) || normalized.split(' ').some(word => tNorm.includes(word));
  });
}
```

---

## Testing Strategy

### Unit Tests (Example-Based)
- Design system component rendering (Button, Card, Input, etc.)
- Onboarding step enumeration (7 specific steps)
- Cold start threshold edge cases (exactly at boundary values)
- Mobile layout breakpoint behavior
- Touch feedback CSS configuration

### Property-Based Tests (fast-check)
- All 22 correctness properties below, minimum 100 iterations each
- Generators for: review data, appointment sets, onboarding step combinations, service payloads, analytics events

### Integration Tests
- Review request creation on appointment CONCLUIDO transition
- Image upload and auto-crop pipeline
- Dashboard marketplace metrics single-call response
- Liquidity signal polling behavior

---

## Correctness Properties

*A property is a characteristic or behavior that should hold true across all valid executions of a system — essentially, a formal statement about what the system should do. Properties serve as the bridge between human-readable specifications and machine-verifiable correctness guarantees.*

### Property 1: Onboarding Persistence Round-Trip

For any valid onboarding step completed for any tenant, persisting the step and then retrieving the onboarding progress should return that step as completed with a non-null timestamp and the correct tenant identifier.

**Validates: Requirements 2.1, 2.2**

### Property 2: Onboarding Retry Behavior

For any database failure during onboarding step persistence, the retry mechanism should attempt exactly 3 retries with exponentially increasing delays (500ms, 1000ms, 2000ms) before reporting failure, and should succeed immediately if any retry succeeds.

**Validates: Requirements 2.5**

### Property 3: Contextual Tips Visibility

For any admin page and any tip-dismissal state, the contextual tip should be visible if and only if the page key is not present in the dismissed tips array for that tenant.

**Validates: Requirements 3.4**

### Property 4: Review Validation

For any review submission, the system should accept it if and only if the rating is an integer between 1 and 5 inclusive, the comment contains between 10 and 500 characters, and all required fields (customer_name, vehicle_description, appointment_id) are non-empty. Any submission violating these constraints should be rejected with a validation error.

**Validates: Requirements 4.2, 4.6**

### Property 5: Review Display Threshold

For any tenant, if the count of real reviews is fewer than 3, the public reviews response should include placeholder testimonials marked with `isPlaceholder: true`. If the count is 3 or more, the response should contain only real reviews sorted by `created_at` descending with `isPlaceholder: false`.

**Validates: Requirements 4.3, 4.4**

### Property 6: Aggregate Rating Computation

For any non-empty set of review ratings (each between 1 and 5), the aggregate rating should equal the arithmetic mean of all ratings rounded to exactly one decimal place.

**Validates: Requirements 4.5, 9.2**

### Property 7: Liquidity Signals Computation

For any set of appointments with CONCLUIDO status in the current month, the displayed completed count should equal the exact count of those appointments. For any set of confirmed appointments, the average response time should equal the mean of (confirmation_timestamp - creation_timestamp) calculated from the most recent 30 confirmed appointments.

**Validates: Requirements 5.1, 5.2**

### Property 8: Cold Start Liquidity Threshold

For any tenant with fewer than 5 completed appointments, the liquidity response should set `isColdStart: true` and omit specific metrics. For any tenant with 5 or more completed appointments, `isColdStart` should be `false` with real metrics populated.

**Validates: Requirements 5.3**

### Property 9: Profile Completeness Computation

For any subset of completed onboarding steps, the profile completeness percentage should equal the sum of weights for completed steps divided by the total weight (100), expressed as an integer percentage.

**Validates: Requirements 6.1**

### Property 10: Badge Persistence Round-Trip

For any badge awarded to a tenant, querying the badges table should return a record with the correct badge type, tenant identifier, and a non-null awarded_at timestamp.

**Validates: Requirements 6.4**

### Property 11: Weekly Engagement Summary

For any set of appointments, clients, and revenue data across two consecutive weeks, the weekly engagement summary should correctly report current week totals and previous week totals, with each metric independently calculated from the respective week boundaries.

**Validates: Requirements 6.5**

### Property 12: Cold Start Data Transition

For any tenant with 10 or more completed appointments, the demand statistics response should contain real calculated metrics without any estimated/placeholder indicators. For any tenant with fewer than 10, estimated indicators should be present.

**Validates: Requirements 7.2**

### Property 13: FAQ Display Logic

For any tenant with zero custom FAQ entries, the public FAQ response should return fallback content with `isFallback: true`. For any tenant with one or more custom FAQ entries, the response should return only custom entries with `isFallback: false`.

**Validates: Requirements 7.3, 7.4**

### Property 14: Service Autofill Matching

For any partial service name input that is a substring of a template name (after normalization), the autofill suggestions should include that template. For any input that matches no template, the suggestions should be an empty array.

**Validates: Requirements 8.1**

### Property 15: Bulk Service Import

For any list of N valid services (each with nome, duracao_minutos, and optional valor) submitted via bulk import, exactly N services should be created in the database for the tenant, each with the correct field values.

**Validates: Requirements 8.2**

### Property 16: Service Form Validation

For any service creation payload, the validation should reject submissions where nome is empty, duracao_minutos is less than 5 or greater than 480, or valor is negative. Valid payloads should pass validation.

**Validates: Requirements 8.4**

### Property 17: Booking Conversion Rate

For any non-zero page view count and any confirmed appointment count, the booking conversion rate should equal (confirmed / pageViews * 100) rounded to two decimal places. For zero page views, the rate should be 0.

**Validates: Requirements 9.1**

### Property 18: Repeat Customer Percentage

For any set of appointments in a 90-day window, the repeat customer percentage should equal the count of clients with 2 or more appointments divided by the total count of unique clients, expressed as a rounded integer percentage.

**Validates: Requirements 9.3**

### Property 19: Analytics Event Recording

For any tracked user interaction (page_view, booking_started, onboarding_step_completed), the system should store an analytics event with the correct event_type, tenant_id, a metadata JSON object containing the event-specific fields, and a non-null created_at timestamp.

**Validates: Requirements 10.1, 10.2, 10.3, 10.4**

### Property 20: Analytics Fail-Silent

For any user-facing operation where the analytics event write fails (database error, timeout), the parent operation should complete successfully without throwing an error or affecting the response.

**Validates: Requirements 10.5**

### Property 21: Price and Duration Display Logic

For any service, the displayed price should be the formatted valor if valor is not null, or the string "Sob consulta" if valor is null. For any service with a defined duracao_minutos, the duration should be displayed on the service card.

**Validates: Requirements 12.1, 12.3**

### Property 22: Guarantee Badge Conditional Display

For any tenant, the "Garantia Inclusa" trust badge should be visible on the public page if and only if `garantia_enabled` is `true` in the tenant's settings.

**Validates: Requirements 12.4**
