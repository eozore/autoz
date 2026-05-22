# Requirements Document

## Introduction

Performance and resilience audit for the Autoz platform. This spec covers adopting React Query for client-side data fetching, code splitting heavy page bundles, adding loading skeletons, configuring API retry with exponential backoff, parallelizing backend dashboard queries, tuning response cache lifetimes, and implementing soft-delete with an undo mechanism across all main entities.

## Glossary

- **Frontend**: The React 19 + Vite single-page application in `packages/frontend`
- **Backend**: The Express + Prisma + PostgreSQL API server in `packages/backend`
- **QueryClient**: The @tanstack/react-query client instance that manages cache, retries, and query lifecycle
- **React_Query**: The @tanstack/react-query library used for server-state management in the Frontend
- **Skeleton**: A pulsing gray placeholder UI element displayed while data is loading
- **Code_Splitting**: The technique of lazy-loading page components via React.lazy and dynamic imports
- **Dashboard_Stats_Endpoint**: The GET /dashboard/stats route that returns aggregated financial and operational metrics
- **Soft_Delete**: A deletion strategy where records receive a `deleted_at` timestamp instead of being physically removed from the database
- **Undo_Toast**: A transient notification with a 5-second countdown that allows the user to reverse a soft-delete action
- **Main_Entities**: The set of database models: Service, Client, Vehicle, InventoryItem, Bill, Appointment
- **staleTime**: React Query configuration that defines how long cached data is considered fresh before a background refetch is triggered
- **gcTime**: React Query configuration (formerly cacheTime) that defines how long inactive cached data is retained in memory

## Requirements

### Requirement 1: React Query Adoption

**User Story:** As a developer, I want a centralized server-state management library, so that data fetching, caching, retries, and loading states are handled consistently across the application.

#### Acceptance Criteria

1. THE Frontend SHALL include @tanstack/react-query as a production dependency.
2. THE Frontend SHALL wrap the application root with a QueryClientProvider that supplies a single QueryClient instance.
3. WHEN a page component fetches data from the Backend, THE Frontend SHALL use the useQuery hook instead of manual useState/useEffect patterns.
4. WHEN a page component mutates data on the Backend, THE Frontend SHALL use the useMutation hook and invalidate related query caches on success.

### Requirement 2: Code Splitting

**User Story:** As a user, I want the application to load quickly, so that I can start working without waiting for unused page bundles to download.

#### Acceptance Criteria

1. THE Frontend SHALL load DashboardPage, PublicPage, AppointmentsPage, InventoryPage, BillsPage, ServicesPage, ClientsPage, VehiclesPage, and LocationsPage via React.lazy with dynamic imports.
2. THE Frontend SHALL display a Suspense fallback component while a lazy-loaded page chunk is being fetched.
3. WHEN a lazy-loaded chunk fails to load, THE Frontend SHALL display an error boundary with a retry option.

### Requirement 3: Loading Skeletons

**User Story:** As a user, I want visual placeholders while data loads, so that the interface feels responsive and I understand content is on its way.

#### Acceptance Criteria

1. WHILE data is being fetched for card components, THE Frontend SHALL display a Skeleton element matching the card dimensions with a pulsing animation.
2. WHILE data is being fetched for table components, THE Frontend SHALL display Skeleton rows matching the expected table row height and column count.
3. WHILE data is being fetched for chart components, THE Frontend SHALL display a Skeleton element matching the chart container dimensions with a pulsing animation.
4. WHEN data fetching completes, THE Frontend SHALL replace the Skeleton elements with the actual content without layout shift.

### Requirement 4: API Retry with Exponential Backoff

**User Story:** As a user, I want failed API requests to be retried automatically, so that transient network issues do not require me to manually refresh the page.

#### Acceptance Criteria

1. THE QueryClient SHALL be configured with a default retry count of 3 for failed queries.
2. THE QueryClient SHALL use exponential backoff for retry delays, starting at 1 second and doubling on each subsequent attempt (1s, 2s, 4s).
3. WHEN a mutation fails, THE QueryClient SHALL NOT retry the mutation by default.
4. IF all retry attempts are exhausted, THEN THE Frontend SHALL display an error message to the user.

### Requirement 5: Backend Query Parallelization

**User Story:** As a user, I want the dashboard to load quickly, so that I can see my business metrics without a long wait.

#### Acceptance Criteria

1. WHEN the Dashboard_Stats_Endpoint receives a request, THE Backend SHALL execute all independent database queries concurrently using Promise.all.
2. THE Dashboard_Stats_Endpoint SHALL return the response within 500ms for a tenant with up to 10,000 appointments (measured at the application layer, excluding network latency).
3. IF any individual query within the parallel batch fails, THEN THE Backend SHALL return a 500 status code with an error message.

### Requirement 6: Response Cache Configuration

**User Story:** As a user, I want previously loaded data to appear instantly on revisit, so that navigating between pages feels snappy.

#### Acceptance Criteria

1. THE QueryClient SHALL configure a staleTime of 30 seconds for dashboard stats queries.
2. THE QueryClient SHALL configure a staleTime of 5 minutes for services, clients, vehicles, inventory, bills, and profile queries.
3. THE QueryClient SHALL configure a gcTime of 10 minutes for all queries.
4. WHEN cached data is stale and the user revisits a page, THE Frontend SHALL display the stale cached data immediately and refetch in the background.

### Requirement 7: Soft-Delete with Undo

**User Story:** As a user, I want to undo accidental deletions, so that I do not permanently lose important records by mistake.

#### Acceptance Criteria

1. THE Backend SHALL add a nullable `deleted_at` timestamp column to each of the Main_Entities tables.
2. WHEN a delete request is received for a Main_Entity record, THE Backend SHALL set the `deleted_at` column to the current timestamp instead of physically removing the row.
3. WHILE a record has a non-null `deleted_at` value, THE Backend SHALL exclude that record from all list and detail query results.
4. WHEN a delete action is performed, THE Frontend SHALL display an Undo_Toast with a 5-second countdown.
5. WHEN the user clicks the undo action within the Undo_Toast, THE Frontend SHALL send a restore request to the Backend.
6. WHEN a restore request is received, THE Backend SHALL set the `deleted_at` column back to null.
7. IF the Undo_Toast countdown expires without user interaction, THEN THE Frontend SHALL dismiss the toast and the record SHALL remain soft-deleted.
