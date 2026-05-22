# Implementation Plan: Platform Audit Performance

## Overview

Implementation of performance and resilience improvements for the Autoz platform: React Query adoption, code splitting, loading skeletons, API retry with exponential backoff, backend query parallelization, response cache configuration, and soft-delete with undo.

## Tasks

- [ ] 1. Install `@tanstack/react-query` as a production dependency in `packages/frontend/package.json`
- [ ] 2. Create `packages/frontend/src/lib/queryClient.ts` with a single QueryClient instance configured with: retry=3, retryDelay exponential backoff (1000 * 2^attemptIndex), gcTime=600000ms, staleTime=300000ms default, mutations retry=false
- [ ] 3. Wrap the app root in `packages/frontend/src/main.tsx` with `QueryClientProvider` supplying the QueryClient instance
- [ ] 4. Create `packages/frontend/src/components/ChunkErrorBoundary.tsx` — a React error boundary that catches chunk load errors and renders a retry UI with a "Tentar novamente" button
- [ ] 5. Create `packages/frontend/src/components/PageSkeleton.tsx` — a full-page loading fallback for Suspense
- [ ] 6. Refactor `packages/frontend/src/App.tsx` to import DashboardPage, PublicPage, AppointmentsPage, InventoryPage, BillsPage, ServicesPage, ClientsPage, VehiclesPage, and LocationsPage via `React.lazy` with dynamic imports; wrap lazy routes with `<Suspense fallback={<PageSkeleton />}>` inside `<ChunkErrorBoundary>`
- [ ] 7. Create `packages/frontend/src/design-system/components/Skeleton.tsx` with variants: `card`, `table-row`, `chart` — each renders a pulsing gray placeholder matching target dimensions
- [ ] 8. Add CSS pulse keyframe animation in `packages/frontend/src/design-system/base.css` for the skeleton class
- [ ] 9. Create `packages/frontend/src/components/skeletons/DashboardSkeleton.tsx` — skeleton layout matching the dashboard KPI cards, charts, and agenda panels
- [ ] 10. Create `packages/frontend/src/components/skeletons/TableSkeleton.tsx` — configurable skeleton accepting `columns` and `rows` props for table pages
- [ ] 11. Export skeleton components from `packages/frontend/src/design-system/components/index.ts`
- [ ] 12. Create `packages/frontend/src/hooks/queries/keys.ts` — centralized query key factory for all entities (dashboard, services, clients, vehicles, inventory, bills, appointments, profile)
- [ ] 13. Create `packages/frontend/src/hooks/queries/useDashboardStats.ts` — useQuery hook with staleTime=30000ms
- [ ] 14. Create `packages/frontend/src/hooks/queries/useServices.ts` — useQuery hook for services list (staleTime=300000ms)
- [ ] 15. Create `packages/frontend/src/hooks/queries/useClients.ts` — useQuery hook for clients list (staleTime=300000ms)
- [ ] 16. Create `packages/frontend/src/hooks/queries/useVehicles.ts` — useQuery hook for vehicles list (staleTime=300000ms)
- [ ] 17. Create `packages/frontend/src/hooks/queries/useInventory.ts` — useQuery hook for inventory list (staleTime=300000ms)
- [ ] 18. Create `packages/frontend/src/hooks/queries/useBills.ts` — useQuery hook for bills list (staleTime=300000ms)
- [ ] 19. Create `packages/frontend/src/hooks/queries/useAppointments.ts` — useQuery hook for appointments (accepts date range params, staleTime=300000ms)
- [ ] 20. Create `packages/frontend/src/hooks/mutations/useDeleteEntity.ts` — generic useMutation hook that soft-deletes an entity and invalidates its query cache on success
- [ ] 21. Create `packages/frontend/src/hooks/mutations/useRestoreEntity.ts` — generic useMutation hook that restores a soft-deleted entity and invalidates its query cache on success
- [ ] 22. Refactor `DashboardPage.tsx` — replace useState/useEffect with useDashboardStats, useServices, useInventory hooks; use DashboardSkeleton while loading
- [ ] 23. Refactor `ServicesPage.tsx` — replace manual fetching with useServices hook; show TableSkeleton while loading
- [ ] 24. Refactor `ClientsPage.tsx` — replace manual fetching with useClients hook; show TableSkeleton while loading
- [ ] 25. Refactor `VehiclesPage.tsx` — replace manual fetching with useVehicles hook; show TableSkeleton while loading
- [ ] 26. Refactor `InventoryPage.tsx` — replace manual fetching with useInventory hook; show TableSkeleton while loading
- [ ] 27. Refactor `BillsPage.tsx` — replace manual fetching with useBills hook; show TableSkeleton while loading
- [ ] 28. Refactor `AppointmentsPage.tsx` — replace manual fetching with useAppointments hook; show TableSkeleton while loading
- [ ] 29. Refactor `packages/backend/src/routes/dashboard.ts` GET `/stats` handler to execute all 11 independent queries inside a single `Promise.all` call (keep response shape identical)
- [ ] 30. Add `deleted_at DateTime?` field to Service, Client, Vehicle, InventoryItem, Bill, and Appointment models in `packages/backend/prisma/schema.prisma`
- [ ] 31. Create a Prisma migration for the new `deleted_at` columns with partial indexes (`WHERE deleted_at IS NULL`) and run `npx prisma generate`
- [ ] 32. Create `packages/backend/src/middleware/soft-delete.ts` — Prisma middleware that intercepts `delete` on main entities → converts to `update { deleted_at: new Date() }`, and auto-adds `deleted_at: null` filter on `findMany`, `findFirst`, `count`, `aggregate`
- [ ] 33. Register the soft-delete middleware in `packages/backend/src/lib/prisma.ts`
- [ ] 34. Add `PATCH /services/:id/restore` endpoint in services route
- [ ] 35. Add `PATCH /clients/:id/restore` endpoint in clients route
- [ ] 36. Add `PATCH /vehicles/:id/restore` endpoint in vehicles route
- [ ] 37. Add `PATCH /inventory/:id/restore` endpoint in inventory route
- [ ] 38. Add `PATCH /bills/:id/restore` endpoint in bills route
- [ ] 39. Add `PATCH /appointments/:id/restore` endpoint in appointments route
- [ ] 40. Create `packages/frontend/src/design-system/components/UndoToast.tsx` — toast with message, 5-second countdown progress bar, and "Desfazer" button
- [ ] 41. Create `packages/frontend/src/contexts/UndoToastContext.tsx` — context provider with `showUndo(options)` method
- [ ] 42. Wrap the app with `UndoToastProvider` in `packages/frontend/src/main.tsx`
- [ ] 43. Integrate undo toast into delete flows: when a delete mutation succeeds, call `showUndo` with a restore callback; on undo click call restore mutation; on expiry dismiss toast
- [ ] 44. Write property test: exponential backoff delay — for any attempt index n in [0,2], delay equals 1000 * 2^n `[pbt]`
- [ ] 45. Write property test: soft-delete round-trip — for any main entity, soft-delete then restore returns record to visible state `[pbt]`
- [ ] 46. Write property test: soft-deleted record exclusion — for any main entity with non-null deleted_at, list endpoints exclude that record `[pbt]`
- [ ] 47. Write property test: dashboard stats response integrity — for any tenant data, response contains all required fields with non-negative numeric values `[pbt]`
- [ ] 48. Run full backend test suite and fix any failures caused by soft-delete middleware
- [ ] 49. Run frontend build (`npm run build` in packages/frontend) and verify no TypeScript errors and separate chunks are produced

## Task Dependency Graph

```json
{
  "waves": [
    {"tasks": [1, 4, 5, 7, 8, 29, 30]},
    {"tasks": [2, 6, 9, 10, 12, 31]},
    {"tasks": [3, 11, 13, 14, 15, 16, 17, 18, 19, 20, 21, 32, 40]},
    {"tasks": [22, 23, 24, 25, 26, 27, 28, 33, 41]},
    {"tasks": [34, 35, 36, 37, 38, 39, 42]},
    {"tasks": [43, 44, 45, 46, 47]},
    {"tasks": [48, 49]}
  ]
}
```

## Notes

- The soft-delete Prisma middleware must be registered before any route handlers to ensure consistent filtering.
- The `findUnique` action is intentionally NOT intercepted by the soft-delete middleware to allow restore endpoints to find soft-deleted records by ID.
- Dashboard stats parallelization must maintain the exact same response shape to avoid breaking the frontend.
- Property-based tests use the existing `fast-check` library already in backend devDependencies.
- Frontend property tests for exponential backoff can be pure unit tests since the retryDelay function is a pure computation.
