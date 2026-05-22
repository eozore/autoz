# Implementation Plan: UI/UX Marketplace Optimization

## Overview

This plan implements six subsystems (Design System, Onboarding Engine, Review System, Gamification Engine, Cold Start Handler, Analytics Event system) plus marketplace metrics, publishing friction reduction, mobile-first layout, and transparency/trust improvements. Tasks are ordered to build foundational layers first (schema, tokens, shared components), then backend services, then frontend integration, and finally wiring everything together.

## Tasks

- [x] 1. Design System foundation
  - [x] 1.1 Create design tokens CSS file and breakpoints module
    - Create `packages/frontend/src/design-system/tokens.css` with CSS custom properties for colors, spacing, typography, border-radii, and shadows
    - Create `packages/frontend/src/design-system/breakpoints.ts` with mobile (<768px), tablet (768–1024px), desktop (>1024px) constants
    - Import tokens.css in the app entry point
    - _Requirements: 1.1, 1.4_

  - [x] 1.2 Create shared UI components (Button, Card, Input, Badge)
    - Create `packages/frontend/src/design-system/components/Button.tsx` with min 44x44px touch target
    - Create `packages/frontend/src/design-system/components/Card.tsx`
    - Create `packages/frontend/src/design-system/components/Input.tsx` with inline validation support
    - Create `packages/frontend/src/design-system/components/Badge.tsx`
    - Create barrel export `packages/frontend/src/design-system/components/index.ts`
    - _Requirements: 1.2, 1.3_

  - [x] 1.3 Create shared UI components (Modal, EmptyState, ProgressBar, Tooltip)
    - Create `packages/frontend/src/design-system/components/Modal.tsx`
    - Create `packages/frontend/src/design-system/components/EmptyState.tsx` with guided action prompt
    - Create `packages/frontend/src/design-system/components/ProgressBar.tsx`
    - Create `packages/frontend/src/design-system/components/Tooltip.tsx`
    - Update barrel export
    - _Requirements: 1.2, 1.3_

  - [x] 1.4 Create responsive layout utilities and mobile-first base styles
    - Add responsive container, grid, and stack layout components using breakpoints
    - Add hamburger menu component for mobile sidebar collapse
    - Ensure minimum 14px font size on mobile viewports
    - _Requirements: 1.4, 11.2, 11.3_

- [x] 2. Database schema and migrations
  - [x] 2.1 Add new Prisma models and enums for all subsystems
    - Add enums: `OnboardingStepKey`, `BadgeType`, `AnalyticsEventType`
    - Add models: `OnboardingProgress`, `Review`, `Badge`, `AnalyticsEvent`, `FAQ`, `TenantSettings`
    - Add relations to existing `Tenant` and `Appointment` models
    - Generate and run migration
    - _Requirements: 2.1, 4.2, 6.4, 7.3, 10.4_

- [x] 3. Backend services — Onboarding and Analytics
  - [x] 3.1 Implement OnboardingService with retry logic
    - Create `packages/backend/src/services/onboarding.service.ts`
    - Implement `completeStep()` with exponential backoff retry (3 retries, 500ms base)
    - Implement `getProgress()` returning steps, completeness percent, and allCompleted flag
    - Use onboarding step weights for completeness calculation
    - _Requirements: 2.1, 2.2, 2.3, 2.5, 6.1_

  - [x] 3.2 Implement AnalyticsService with fail-silent pattern
    - Create `packages/backend/src/services/analytics.service.ts`
    - Implement `trackEvent()` that catches all errors and logs warnings without throwing
    - Support event types: page_view, booking_started, booking_completed, onboarding_step_completed, service_created, review_submitted
    - _Requirements: 10.1, 10.2, 10.3, 10.4, 10.5_

  - [ ]* 3.3 Write property tests for OnboardingService
    - **Property 1: Onboarding Persistence Round-Trip**
    - **Property 2: Onboarding Retry Behavior**
    - **Property 9: Profile Completeness Computation**
    - **Validates: Requirements 2.1, 2.2, 2.5, 6.1**

  - [ ]* 3.4 Write property tests for AnalyticsService
    - **Property 19: Analytics Event Recording**
    - **Property 20: Analytics Fail-Silent**
    - **Validates: Requirements 10.1, 10.2, 10.3, 10.4, 10.5**

- [x] 4. Backend services — Review and Gamification
  - [x] 4.1 Implement ReviewService with validation and aggregation
    - Create `packages/backend/src/services/review.service.ts`
    - Implement Zod validation (rating 1-5, comment 10-500 chars, required fields)
    - Implement `createReview()`, `getPublicReviews()`, `getAggregateRating()`
    - Sort reviews by most recent first; return placeholder flag when < 3 real reviews
    - _Requirements: 4.1, 4.2, 4.3, 4.4, 4.5, 4.6_

  - [x] 4.2 Implement GamificationService with badge logic
    - Create `packages/backend/src/services/gamification.service.ts`
    - Implement `checkAndAwardBadges()` for perfil_completo, streak_mensal, primeiro_review
    - Implement `getWeeklyEngagement()` comparing current vs previous week metrics
    - Persist badges with award date
    - _Requirements: 6.2, 6.3, 6.4, 6.5_

  - [ ]* 4.3 Write property tests for ReviewService
    - **Property 4: Review Validation**
    - **Property 5: Review Display Threshold**
    - **Property 6: Aggregate Rating Computation**
    - **Validates: Requirements 4.2, 4.3, 4.4, 4.5, 4.6**

  - [ ]* 4.4 Write property tests for GamificationService
    - **Property 10: Badge Persistence Round-Trip**
    - **Property 11: Weekly Engagement Summary**
    - **Validates: Requirements 6.4, 6.5**

- [x] 5. Backend services — Metrics, Cold Start, and FAQ
  - [x] 5.1 Implement MetricsService for marketplace KPIs
    - Create `packages/backend/src/services/metrics.service.ts`
    - Implement `getMarketplaceMetrics()` returning conversion rate, avg rating, repeat %, response time in a single call
    - Use algorithms from design: `calculateConversionRate`, `calculateRepeatCustomerPercent`
    - _Requirements: 9.1, 9.2, 9.3, 9.4_

  - [x] 5.2 Implement ColdStartService and FAQ logic
    - Create `packages/backend/src/services/cold-start.service.ts`
    - Implement threshold checks: reviews (3), liquidity (5), demand (10)
    - Implement fallback FAQ content and custom FAQ CRUD
    - _Requirements: 7.1, 7.2, 7.3, 7.4, 5.3_

  - [ ]* 5.3 Write property tests for MetricsService
    - **Property 7: Liquidity Signals Computation**
    - **Property 8: Cold Start Liquidity Threshold**
    - **Property 12: Cold Start Data Transition**
    - **Property 17: Booking Conversion Rate**
    - **Property 18: Repeat Customer Percentage**
    - **Validates: Requirements 5.1, 5.2, 5.3, 7.2, 9.1, 9.3**

  - [ ]* 5.4 Write property tests for ColdStartService and FAQ
    - **Property 13: FAQ Display Logic**
    - **Validates: Requirements 7.3, 7.4**

- [x] 6. Backend API routes
  - [x] 6.1 Create onboarding and gamification API routes
    - Add `GET /api/onboarding/progress` and `POST /api/onboarding/complete-step`
    - Add `GET /api/gamification/badges`
    - Wire to OnboardingService and GamificationService
    - Apply existing auth middleware
    - _Requirements: 2.1, 2.2, 6.1, 6.4_

  - [x] 6.2 Create review and public review API routes
    - Add `POST /public/:slug/reviews` with Zod validation
    - Add `GET /public/:slug/reviews` returning reviews + aggregate + placeholder flag
    - Wire to ReviewService
    - _Requirements: 4.2, 4.3, 4.4, 4.5, 4.6_

  - [x] 6.3 Create metrics, analytics, liquidity, and FAQ routes
    - Add `GET /api/dashboard/marketplace-metrics` (single call, <500ms target)
    - Add `POST /api/analytics/events`
    - Add `GET /public/:slug/liquidity` with cold start flag
    - Add `GET /public/:slug/faqs` and `POST /api/faqs`
    - Add `POST /api/services/bulk` for bulk import
    - _Requirements: 5.1, 5.2, 7.3, 8.2, 9.4, 10.1_

- [x] 7. Checkpoint — Backend complete
  - Ensure all tests pass, ask the user if questions arise.

- [x] 8. Frontend — Onboarding and contextual tips
  - [x] 8.1 Create OnboardingBanner and OnboardingStepCard components
    - Create `packages/frontend/src/components/onboarding/OnboardingBanner.tsx` with persistent checklist
    - Create `packages/frontend/src/components/onboarding/OnboardingStepCard.tsx` with action links
    - Fetch progress from `/api/onboarding/progress` on Dashboard load
    - Show congratulatory badge when all steps complete
    - _Requirements: 2.2, 2.3, 2.4, 3.3_

  - [x] 8.2 Create ContextualTip component and integrate across admin pages
    - Create `packages/frontend/src/components/onboarding/ContextualTip.tsx`
    - Add dismissible tips to each admin page explaining purpose and next action
    - Persist dismissed state via TenantSettings `tips_dismissed` array
    - _Requirements: 3.4_

  - [ ]* 8.3 Write property test for contextual tips visibility
    - **Property 3: Contextual Tips Visibility**
    - **Validates: Requirements 3.4**

- [x] 9. Frontend — Service creation and bulk import
  - [x] 9.1 Create ServiceAutofill component with template matching
    - Create `packages/frontend/src/components/services/ServiceAutofill.tsx`
    - Implement client-side template matching using normalized substring search
    - Show suggestions dropdown as user types service name
    - _Requirements: 8.1_

  - [x] 9.2 Create BulkImportModal and one-click template pack
    - Create `packages/frontend/src/components/services/BulkImportModal.tsx`
    - Accept list of services (name, duration, price) and submit via `POST /api/services/bulk`
    - Add "Importar pacote de serviços" button on ServicesPage when zero services exist
    - _Requirements: 3.1, 8.2_

  - [x] 9.3 Add inline form validation and image preview/crop to service creation
    - Add field-level validation with <300ms feedback on blur
    - Add image upload preview with auto-crop to required aspect ratio
    - _Requirements: 8.3, 8.4_

  - [ ]* 9.4 Write property tests for service autofill and validation
    - **Property 14: Service Autofill Matching**
    - **Property 15: Bulk Service Import**
    - **Property 16: Service Form Validation**
    - **Validates: Requirements 8.1, 8.2, 8.4**

- [x] 10. Frontend — Dashboard metrics and gamification
  - [x] 10.1 Create marketplace metrics components on Dashboard
    - Create `packages/frontend/src/components/metrics/ConversionRate.tsx`
    - Create `packages/frontend/src/components/metrics/RepeatCustomers.tsx`
    - Create `packages/frontend/src/components/metrics/CustomerRating.tsx`
    - Fetch all from `GET /api/dashboard/marketplace-metrics` single call
    - _Requirements: 9.1, 9.2, 9.3, 9.4_

  - [x] 10.2 Create gamification components (ProfileCompleteness, BadgeDisplay, WeeklyEngagement)
    - Create `packages/frontend/src/components/gamification/ProfileCompleteness.tsx` with percentage ring
    - Create `packages/frontend/src/components/gamification/BadgeDisplay.tsx` with badge grid
    - Create `packages/frontend/src/components/gamification/WeeklyEngagement.tsx` with week-over-week comparison
    - Fetch from `GET /api/gamification/badges`
    - _Requirements: 6.1, 6.2, 6.5_

  - [x] 10.3 Integrate metrics and gamification into DashboardPage
    - Add metrics cards and gamification widgets to existing DashboardPage layout
    - Show empty state with guided prompts when no data available
    - _Requirements: 6.1, 9.1, 9.2, 9.3_

- [x] 11. Frontend — Public page enhancements
  - [x] 11.1 Create ReviewSection component with cold-start handling
    - Create `packages/frontend/src/components/public/ReviewSection.tsx`
    - Display real reviews when >= 3 exist, placeholder testimonials otherwise (marked as examples)
    - Show aggregate star rating
    - _Requirements: 4.3, 4.4, 4.5_

  - [x] 11.2 Create LiquiditySignals component with polling
    - Create `packages/frontend/src/components/public/LiquiditySignals.tsx`
    - Display completed appointments count and avg response time
    - Show generic activity badge when cold start (< 5 appointments)
    - Poll every 5 minutes via `setInterval`
    - _Requirements: 5.1, 5.2, 5.3, 5.4_

  - [x] 11.3 Create TrustBadges, FAQSection, and enhanced ServiceCard
    - Create `packages/frontend/src/components/public/TrustBadges.tsx` with conditional "Garantia Inclusa" badge
    - Create `packages/frontend/src/components/public/FAQSection.tsx` with fallback/custom logic
    - Update `ServiceCard` to display price ("Sob consulta" when null), duration, and total completed count
    - _Requirements: 7.3, 7.4, 12.1, 12.2, 12.3, 12.4, 12.5_

  - [ ]* 11.4 Write property tests for public page display logic
    - **Property 5: Review Display Threshold** (frontend logic)
    - **Property 21: Price and Duration Display Logic**
    - **Property 22: Guarantee Badge Conditional Display**
    - **Validates: Requirements 4.3, 4.4, 12.1, 12.3, 12.4**

- [x] 12. Frontend — Mobile-first responsive layout
  - [x] 12.1 Apply responsive layout to PublicPage
    - Stack service list and booking widget vertically on mobile (<768px)
    - Add touch feedback (100ms visual response) on service cards
    - Display shop operating hours above service list
    - _Requirements: 11.1, 11.4, 12.2_

  - [x] 12.2 Apply responsive layout to Admin Panel
    - Collapse sidebar into hamburger menu on mobile (<768px)
    - Ensure all interactive elements meet 44x44px touch targets
    - Test layout at all three breakpoints
    - _Requirements: 11.2, 1.3_

- [x] 13. Frontend — Analytics event integration
  - [x] 13.1 Add analytics event tracking across frontend
    - Create analytics utility `packages/frontend/src/utils/analytics.ts` wrapping `POST /api/analytics/events`
    - Track page_view on PublicPage load with tenant_id and referrer
    - Track booking_started when user enters booking flow with service_id and step
    - Track onboarding_step_completed when step is marked done
    - Ensure all tracking is fire-and-forget (no blocking)
    - _Requirements: 10.1, 10.2, 10.3, 10.5_

- [x] 14. Integration and wiring
  - [x] 14.1 Wire PublicPage to use all new public components
    - Integrate ReviewSection, LiquiditySignals, TrustBadges, FAQSection into PublicPage
    - Replace hardcoded mock testimonials and demand data with API-driven components
    - Ensure progressive replacement: cold start → real data
    - _Requirements: 4.3, 5.1, 7.1, 12.5_

  - [x] 14.2 Wire DashboardPage with onboarding, metrics, and gamification
    - Integrate OnboardingBanner at top of Dashboard
    - Add marketplace metrics section
    - Add gamification widgets
    - Auto-redirect from CompanySetupPage to Dashboard with checklist expanded
    - _Requirements: 2.2, 3.3, 6.1, 9.1_

  - [x] 14.3 Wire ServicesPage with autofill, bulk import, and empty state
    - Add ServiceAutofill to service creation form
    - Add BulkImportModal trigger when zero services
    - Add EmptyState component for zero-client scenario on ClientsPage
    - _Requirements: 3.1, 3.2, 8.1, 8.2_

  - [ ]* 14.4 Write integration tests for end-to-end flows
    - Test review creation on appointment completion flow
    - Test onboarding progress persistence across page loads
    - Test cold start → real data transition
    - _Requirements: 2.1, 4.1, 7.2_

- [x] 15. Final checkpoint
  - Ensure all tests pass, ask the user if questions arise.

## Notes

- Tasks marked with `*` are optional and can be skipped for faster MVP
- Each task references specific requirements for traceability
- Checkpoints ensure incremental validation
- Property tests validate universal correctness properties from the design document
- Unit tests validate specific examples and edge cases
- The design system is CSS-only at runtime (no JS framework dependency for tokens)
- All backend services follow the existing multi-tenant pattern keyed by `tenant_id`
- Analytics tracking is always fire-and-forget to avoid blocking user operations

## Task Dependency Graph

```json
{
  "waves": [
    { "id": 0, "tasks": ["1.1", "2.1"] },
    { "id": 1, "tasks": ["1.2", "1.3", "3.1", "3.2"] },
    { "id": 2, "tasks": ["1.4", "3.3", "3.4", "4.1", "4.2"] },
    { "id": 3, "tasks": ["4.3", "4.4", "5.1", "5.2", "6.1"] },
    { "id": 4, "tasks": ["5.3", "5.4", "6.2", "6.3"] },
    { "id": 5, "tasks": ["8.1", "8.2", "9.1", "9.2", "10.1", "10.2", "11.1", "11.2", "13.1"] },
    { "id": 6, "tasks": ["8.3", "9.3", "9.4", "10.3", "11.3", "11.4", "12.1", "12.2"] },
    { "id": 7, "tasks": ["14.1", "14.2", "14.3"] },
    { "id": 8, "tasks": ["14.4"] }
  ]
}
```
