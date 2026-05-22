# Design Document: Platform Audit Performance

## Overview

Performance and resilience improvements across both the frontend (React 19 + Vite) and backend (Express + Prisma + PostgreSQL) layers of the Autoz platform. The changes cover three architectural concerns: client-side data management with React Query, bundle optimization via code splitting and skeletons, and backend resilience through query parallelization and soft-delete with undo.

## Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                        Frontend                              │
│                                                             │
│  main.tsx                                                   │
│    └─ QueryClientProvider (single QueryClient)              │
│         └─ UndoToastProvider                                │
│              └─ App.tsx                                      │
│                   └─ ChunkErrorBoundary                     │
│                        └─ Suspense + React.lazy pages       │
│                                                             │
│  Query Layer:                                               │
│    hooks/queries/*.ts  → useQuery per entity                │
│    hooks/mutations/*.ts → useMutation + cache invalidation  │
│                                                             │
│  UI Layer:                                                  │
│    design-system/components/Skeleton.tsx                     │
│    design-system/components/UndoToast.tsx                    │
│    components/ChunkErrorBoundary.tsx                         │
└─────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────┐
│                        Backend                               │
│                                                             │
│  routes/dashboard.ts                                        │
│    └─ GET /stats → Promise.all([...independent queries])    │
│                                                             │
│  Soft-delete middleware:                                    │
│    middleware/soft-delete.ts                                 │
│      - Prisma middleware to auto-filter deleted_at != null  │
│      - PATCH /:entity/:id/restore endpoint per entity       │
│                                                             │
│  Schema changes:                                            │
│    + deleted_at DateTime? on Service, Client, Vehicle,      │
│      InventoryItem, Bill, Appointment                       │
└─────────────────────────────────────────────────────────────┘
```

## Components and Interfaces

### Frontend Components

#### QueryClient Configuration (`src/lib/queryClient.ts`)

A single `QueryClient` instance with global defaults:

```typescript
import { QueryClient } from '@tanstack/react-query';

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 3,
      retryDelay: (attemptIndex) => Math.min(1000 * 2 ** attemptIndex, 8000),
      gcTime: 10 * 60 * 1000, // 10 minutes
      staleTime: 5 * 60 * 1000, // 5 minutes default
      refetchOnWindowFocus: false,
    },
    mutations: {
      retry: false,
    },
  },
});
```

#### Query Hooks (`src/hooks/queries/`)

Each entity gets a dedicated query hook file:

```typescript
// src/hooks/queries/useDashboardStats.ts
import { useQuery } from '@tanstack/react-query';
import api from '../../lib/api';

export const DASHBOARD_KEYS = {
  stats: ['dashboard', 'stats'] as const,
};

export function useDashboardStats() {
  return useQuery({
    queryKey: DASHBOARD_KEYS.stats,
    queryFn: () => api.get<FinStats>('/dashboard/stats'),
    staleTime: 30 * 1000, // 30 seconds for dashboard
  });
}
```

#### Mutation Hooks (`src/hooks/mutations/`)

```typescript
// src/hooks/mutations/useDeleteEntity.ts
import { useMutation, useQueryClient } from '@tanstack/react-query';
import api from '../../lib/api';

export function useDeleteEntity(entityKey: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api.delete(`/${entityKey}/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [entityKey] });
    },
  });
}
```

#### Skeleton Components (`src/design-system/components/Skeleton.tsx`)

```typescript
interface SkeletonProps {
  variant: 'card' | 'table-row' | 'chart';
  width?: string | number;
  height?: string | number;
  columns?: number;
  rows?: number;
}

export function Skeleton({ variant, width, height, columns, rows }: SkeletonProps) {
  // Renders pulsing placeholder matching target dimensions
}
```

#### Code-Split Pages (`src/App.tsx`)

```typescript
import { lazy, Suspense } from 'react';
import { ChunkErrorBoundary } from './components/ChunkErrorBoundary';

const DashboardPage = lazy(() => import('./pages/DashboardPage'));
const ServicesPage = lazy(() => import('./pages/ServicesPage'));
// ... all page imports become lazy

// Wrapped in:
<ChunkErrorBoundary>
  <Suspense fallback={<PageSkeleton />}>
    <Route ... />
  </Suspense>
</ChunkErrorBoundary>
```

#### ChunkErrorBoundary (`src/components/ChunkErrorBoundary.tsx`)

A React error boundary that catches chunk load failures and renders a retry UI:

```typescript
class ChunkErrorBoundary extends React.Component<Props, State> {
  state = { hasError: false };

  static getDerivedStateFromError(error: Error) {
    if (error.name === 'ChunkLoadError' || error.message.includes('Loading chunk')) {
      return { hasError: true };
    }
    throw error;
  }

  handleRetry = () => {
    this.setState({ hasError: false });
    window.location.reload();
  };

  render() {
    if (this.state.hasError) {
      return <ErrorFallback onRetry={this.handleRetry} />;
    }
    return this.props.children;
  }
}
```

#### UndoToast (`src/design-system/components/UndoToast.tsx`)

```typescript
interface UndoToastProps {
  message: string;
  duration?: number; // default 5000ms
  onUndo: () => void;
  onExpire: () => void;
}

export function UndoToast({ message, duration = 5000, onUndo, onExpire }: UndoToastProps) {
  // Renders toast with countdown progress bar
  // Calls onExpire after duration if no interaction
}
```

### Backend Components

#### Parallelized Dashboard Stats (`src/routes/dashboard.ts`)

Refactor the sequential queries into a single `Promise.all`:

```typescript
router.get('/stats', async (req, res) => {
  const tenantId = req.context!.tenant_id!;
  const now = new Date();
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
  const monthEnd = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59);

  try {
    const [
      servicesAgg, salesResult, inProgressAgg, installmentAgg,
      billsGrouped, overdueAgg, monthlyBillsAgg, monthlyPaidAgg,
      totalCompleted, stockCostResult, stockSaleResult,
    ] = await Promise.all([
      prisma.appointment.aggregate({ /* services this month */ }),
      prisma.$queryRaw(/* sales revenue */),
      prisma.appointment.aggregate({ /* in-progress */ }),
      prisma.appointment.aggregate({ /* installments */ }),
      prisma.bill.groupBy({ /* by status */ }),
      prisma.bill.aggregate({ /* overdue */ }),
      prisma.bill.aggregate({ /* monthly total */ }),
      prisma.bill.aggregate({ /* monthly paid */ }),
      prisma.appointment.count({ /* all-time completed */ }),
      prisma.$queryRaw(/* stock cost */),
      prisma.$queryRaw(/* stock sale value */),
    ]);

    res.json({ month, bills, receivables, allTime, inventory });
  } catch (err) {
    res.status(500).json({ error: 'Erro ao carregar estatísticas' });
  }
});
```

#### Soft-Delete Prisma Middleware (`src/middleware/soft-delete.ts`)

```typescript
import { Prisma } from '../generated/prisma';

const SOFT_DELETE_MODELS = ['Service', 'Client', 'Vehicle', 'InventoryItem', 'Bill', 'Appointment'];

export function softDeleteMiddleware(): Prisma.Middleware {
  return async (params, next) => {
    if (params.action === 'delete' && SOFT_DELETE_MODELS.includes(params.model ?? '')) {
      params.action = 'update';
      params.args.data = { deleted_at: new Date() };
      return next(params);
    }

    if (['findMany', 'findFirst', 'count', 'aggregate'].includes(params.action) &&
        SOFT_DELETE_MODELS.includes(params.model ?? '')) {
      params.args = params.args || {};
      params.args.where = params.args.where || {};
      params.args.where.deleted_at = null;
      return next(params);
    }

    return next(params);
  };
}
```

#### Restore Endpoints

Each main entity gets a `PATCH /:entity/:id/restore` route:

```typescript
router.patch('/:id/restore', async (req, res) => {
  const { id } = req.params;
  const tenantId = req.context!.tenant_id!;

  const record = await prisma.service.findFirst({
    where: { id, tenant_id: tenantId },
  });

  if (!record) return res.status(404).json({ error: 'Registro não encontrado' });

  await prisma.service.update({
    where: { id },
    data: { deleted_at: null },
  });

  res.json({ message: 'Registro restaurado' });
});
```

### Interfaces

#### Query Key Convention

```typescript
type QueryKeys = {
  dashboard: { stats: ['dashboard', 'stats'] };
  services: { all: ['services']; detail: ['services', string] };
  clients: { all: ['clients']; detail: ['clients', string] };
  vehicles: { all: ['vehicles']; detail: ['vehicles', string] };
  inventory: { all: ['inventory']; detail: ['inventory', string] };
  bills: { all: ['bills']; detail: ['bills', string] };
  appointments: { all: ['appointments']; byRange: ['appointments', string, string] };
};
```

#### Restore API Contract

```
PATCH /services/:id/restore     → { message: string }
PATCH /clients/:id/restore      → { message: string }
PATCH /vehicles/:id/restore     → { message: string }
PATCH /inventory/:id/restore    → { message: string }
PATCH /bills/:id/restore        → { message: string }
PATCH /appointments/:id/restore → { message: string }
```

#### UndoToast Context API

```typescript
interface UndoToastContext {
  showUndo: (options: {
    message: string;
    onUndo: () => Promise<void>;
  }) => void;
}
```

## Data Models

#### Schema Additions (Prisma)

```prisma
model Service {
  // ... existing fields
  deleted_at DateTime?
}

model Client {
  // ... existing fields
  deleted_at DateTime?
}

model Vehicle {
  // ... existing fields
  deleted_at DateTime?
}

model InventoryItem {
  // ... existing fields
  deleted_at DateTime?
}

model Bill {
  // ... existing fields
  deleted_at DateTime?
}

model Appointment {
  // ... existing fields
  deleted_at DateTime?
}
```

#### Cache Configuration Map

| Query Key Pattern | staleTime | gcTime |
|---|---|---|
| `['dashboard', 'stats']` | 30s | 10min |
| `['services', ...]` | 5min | 10min |
| `['clients', ...]` | 5min | 10min |
| `['vehicles', ...]` | 5min | 10min |
| `['inventory', ...]` | 5min | 10min |
| `['bills', ...]` | 5min | 10min |
| `['profile', ...]` | 5min | 10min |

## Error Handling

#### Frontend Error Strategies

| Scenario | Strategy |
|---|---|
| Query fails (network) | Retry 3× with exponential backoff (1s, 2s, 4s) |
| All retries exhausted | Display inline error message with manual retry button |
| Mutation fails | No auto-retry; show error toast immediately |
| Chunk load fails | Error boundary catches; shows "Erro ao carregar página" + retry button |
| Restore request fails | Show error toast; record remains soft-deleted |

#### Backend Error Strategies

| Scenario | Strategy |
|---|---|
| Any dashboard query fails | Catch in Promise.all, return 500 with error message |
| Restore on non-existent record | Return 404 |
| Restore on non-deleted record | Idempotent — set deleted_at = null (already null, no-op) |

## Testing Strategy

### Property-Based Tests (fast-check)

Property-based tests validate universal correctness properties using the existing `fast-check` library in the backend and will be added to the frontend test setup.

- **Exponential backoff**: Verify delay formula for all valid attempt indices
- **Soft-delete round-trip**: For any entity, delete→restore returns to original visible state
- **Soft-deleted exclusion**: For any soft-deleted record, list queries never include it
- **Dashboard stats integrity**: For any valid tenant data, response shape and values are correct

### Unit Tests (vitest)

- Skeleton component renders correct structure for given props
- ChunkErrorBoundary catches chunk errors and renders retry UI
- UndoToast countdown and callback behavior
- QueryClient configuration values

### Integration Tests

- Dashboard stats endpoint returns correct shape after parallelization
- Restore endpoints set deleted_at to null and record reappears
- Full frontend build produces separate chunks

## Correctness Properties

*A property is a characteristic or behavior that should hold true across all valid executions of a system — essentially, a formal statement about what the system should do. Properties serve as the bridge between human-readable specifications and machine-verifiable correctness guarantees.*

### Property 1: Exponential Backoff Delay Calculation

*For any* retry attempt index `n` in the range [0, 2], the computed retry delay SHALL equal `1000 * 2^n` milliseconds (producing the sequence 1000ms, 2000ms, 4000ms).

**Validates: Requirements 4.2**

### Property 2: Table Skeleton Structure

*For any* positive integer column count `c` and row count `r`, the table skeleton component SHALL render exactly `r` rows each containing exactly `c` skeleton cells.

**Validates: Requirements 3.2**

### Property 3: Skeleton-to-Content Layout Stability

*For any* skeleton variant (card, table-row, chart) with specified dimensions, the skeleton container's rendered width and height SHALL equal the actual content container's width and height, ensuring zero layout shift on data load.

**Validates: Requirements 3.4**

### Property 4: Dashboard Stats Response Integrity

*For any* tenant with valid data (0 to N appointments, bills, and inventory items), the dashboard stats endpoint SHALL return a response containing all required fields (`month`, `bills`, `receivables`, `allTime`, `inventory`) with numeric values that are non-negative and consistent with the underlying data aggregations.

**Validates: Requirements 5.1**

### Property 5: Entity Cache staleTime Configuration

*For any* entity type in the set {services, clients, vehicles, inventory, bills, profile}, the React Query configuration for that entity's queries SHALL specify a staleTime of 300000 milliseconds (5 minutes).

**Validates: Requirements 6.2**

### Property 6: Soft-Delete Round-Trip

*For any* main entity type and any valid record belonging to a tenant, performing a soft-delete followed by a restore SHALL return the record to a state where `deleted_at` is null and the record is visible in list queries — equivalent to its pre-deletion state.

**Validates: Requirements 7.2, 7.6**

### Property 7: Soft-Deleted Record Exclusion Invariant

*For any* main entity type and any record with a non-null `deleted_at` value, all list endpoints and detail endpoints for that entity SHALL exclude that record from their response.

**Validates: Requirements 7.3**
