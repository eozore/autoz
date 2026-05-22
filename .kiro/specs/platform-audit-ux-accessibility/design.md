# Design Document: Platform Audit UX & Accessibility

## Overview

This document describes the architecture and implementation approach for the Autoz platform UX and accessibility audit. The work spans 10 requirements covering modal migration, form input migration, dashboard filter fix, 404 page, phone mask, confirm dialog, SVG icons, status badge icons, dead code removal, and skip navigation link. All changes target `packages/frontend/src/`.

The audit follows a **component-first migration** strategy: existing raw HTML patterns are replaced with design system components that already provide accessibility semantics. New components (PhoneInput, ConfirmDialog, NotFoundPage) are built on top of the existing design system primitives.

## Architecture

```
┌─────────────────────────────────────────────────────────┐
│  App.tsx (Router — adds catch-all * route)               │
├─────────────────────────────────────────────────────────┤
│  Layout.tsx                                              │
│  ├── SkipNavLink (new)                                   │
│  ├── Sidebar (SVG icons replace emoji)                   │
│  └── <main id="main-content">                            │
├─────────────────────────────────────────────────────────┤
│  Pages                                                   │
│  ├── DashboardPage (location filter wired to API)        │
│  ├── AppointmentsPage (Modal + Input migration)          │
│  ├── ServicesPage (Modal + Input migration)              │
│  ├── ClientsPage (Input migration)                       │
│  └── NotFoundPage (new)                                  │
├─────────────────────────────────────────────────────────┤
│  Shared Components                                       │
│  ├── ConfirmDialog (new — wraps Modal)                   │
│  ├── PhoneInput (new — wraps Input)                      │
│  └── StatusBadge (new — wraps Badge + icon)              │
├─────────────────────────────────────────────────────────┤
│  Design System (existing)                                │
│  ├── Modal (portal, focus trap, Escape, aria-modal)      │
│  ├── Input (label, error, aria-describedby)              │
│  ├── Badge (color variants)                              │
│  └── Button, Card, EmptyState, etc.                      │
└─────────────────────────────────────────────────────────┘
```

### Migration Strategy

**Modal Migration**: Replace all `div.modal-overlay` / `div.modal-content` patterns (found in 7 pages) with the existing `<Modal>` design system component. The Modal already provides portal rendering, focus trap, Escape key dismissal, and `aria-modal` semantics.

**Input Migration**: Replace raw `<input>` elements inside modal forms with `<Input>` from the design system, adding `label` prop for each field to ensure proper `htmlFor` association and `aria-describedby` for errors.

**confirm() Replacement**: Replace all 10 `confirm()` calls across 8 pages with the new ConfirmDialog component managed via a `useConfirmDialog` hook.

**Dashboard Filter Fix**: Wire the existing `selectedLocation` state to all API calls in `loadFiltered()` by appending `location_id` query parameter.

## Components and Interfaces

### ConfirmDialog

A reusable confirmation dialog for destructive actions, replacing all `confirm()` calls.

```tsx
// components/ConfirmDialog.tsx
export interface ConfirmDialogProps {
  open: boolean;
  title: string;
  description: string;
  confirmLabel?: string;   // default: 'Confirmar'
  cancelLabel?: string;    // default: 'Cancelar'
  onConfirm: () => void;
  onCancel: () => void;
  variant?: 'danger' | 'warning';  // default: 'danger'
}

export function ConfirmDialog(props: ConfirmDialogProps): JSX.Element;
```

Implementation: Renders `<Modal open={open} onClose={onCancel} title={title}>` with description paragraph and two buttons (cancel + confirm). Confirm button calls `onConfirm()` then `onCancel()` to close.

### useConfirmDialog Hook

```tsx
// hooks/useConfirmDialog.ts
interface ConfirmOptions {
  title: string;
  description: string;
  onConfirm: () => void;
  variant?: 'danger' | 'warning';
}

interface UseConfirmDialogReturn {
  dialogProps: ConfirmDialogProps;
  confirm: (options: ConfirmOptions) => void;
}

export function useConfirmDialog(): UseConfirmDialogReturn;
```

### PhoneInput

A masked input for Brazilian phone numbers built on top of Design_System_Input.

```tsx
// components/PhoneInput.tsx
export interface PhoneInputProps extends Omit<InputProps, 'value' | 'onChange'> {
  value: string;                    // raw digits (up to 11)
  onChange: (rawDigits: string) => void;
}

export function PhoneInput(props: PhoneInputProps): JSX.Element;

// Utilities (exported for testing)
export function formatPhone(digits: string): string;
export function extractDigits(input: string): string;
export function toPhoneSubmitValue(digits: string): string;
```

Formatting logic:
- `formatPhone("11999887766")` → `"+55 (11) 99988-7766"`
- `extractDigits("+55 (11) 99988-7766")` → `"1199988776"` (strips non-digits, caps at 11)
- `toPhoneSubmitValue("11999887766")` → `"+5511999887766"`

Validation: Shows error "Número de telefone incompleto" when `0 < digits.length < 11`.

### StatusBadge

An accessible status badge that conveys information through color AND icon.

```tsx
// components/StatusBadge.tsx
type AppointmentStatus = 'AGENDADO' | 'CONFIRMADO' | 'EM_ANDAMENTO' | 'CONCLUIDO' | 'CANCELADO';

interface StatusConfig {
  variant: 'info' | 'warning' | 'success' | 'danger';
  icon: string;    // ⏳, ▶, ✓, ✕
  label: string;   // human-readable status text
}

export interface StatusBadgeProps {
  status: AppointmentStatus;
}

export function StatusBadge(props: StatusBadgeProps): JSX.Element;
```

Status mapping:
| Status | Variant | Icon | Label |
|--------|---------|------|-------|
| AGENDADO | info | ⏳ | Agendado |
| CONFIRMADO | info | ⏳ | Confirmado |
| EM_ANDAMENTO | warning | ▶ | Em Andamento |
| CONCLUIDO | success | ✓ | Finalizado |
| CANCELADO | danger | ✕ | Cancelado |

### NavIcon

```tsx
// components/NavIcon.tsx
export interface NavIconProps {
  name: string;       // key into icon path map
  ariaLabel: string;  // accessible label for screen readers
}

export function NavIcon(props: NavIconProps): JSX.Element;
```

Renders inline SVG with `role="img"`, `aria-label`, `fill="currentColor"`, and size in `em` units (1.25em) to scale with text.

### NotFoundPage

```tsx
// pages/NotFoundPage.tsx
export default function NotFoundPage(): JSX.Element;
```

Uses EmptyState with heading "Página não encontrada" and a Link to `/dashboard`.

### Skip Navigation Link

Added as the first focusable element inside Layout's app-layout div:

```tsx
<a href="#main-content" className="skip-nav-link">
  Pular para conteúdo
</a>
```

CSS: visually hidden by default (`position: absolute; left: -9999px`), becomes visible on `:focus` (`left: var(--ds-space-4)`).

The `<main>` element receives `id="main-content"`.

### Dashboard Filter Integration

```typescript
// In DashboardPage.loadFiltered():
const locationParam = selectedLocation !== 'all' ? `&location_id=${selectedLocation}` : '';

// Applied to all API calls:
api.get(`/dashboard/stats?month=${selectedMonth}${locationParam}`)
api.get(`/appointments?start=${ms}&end=${me}${locationParam}`)
api.get(`/bills?${locationParam.slice(1)}`)  // remove leading &
```

## Data Models

No new database models are introduced. All changes are purely frontend UI/UX.

### Status Configuration Map

```typescript
type AppointmentStatus = 'AGENDADO' | 'CONFIRMADO' | 'EM_ANDAMENTO' | 'CONCLUIDO' | 'CANCELADO';

interface StatusConfig {
  variant: 'info' | 'warning' | 'success' | 'danger';
  icon: string;    // ⏳, ▶, ✓, ✕
  label: string;   // human-readable status text
}

const statusConfig: Record<AppointmentStatus, StatusConfig>;
```

### Phone Formatting Types

```typescript
// Raw digits: "11999887766" (11 chars max)
// Display format: "+55 (11) 99988-7766"
// Submit format: "+5511999887766"
```

## Error Handling

- **PhoneInput validation**: Inline error shown when `0 < digits.length < 11`. Error clears when input reaches 11 digits or is emptied.
- **ConfirmDialog**: If the destructive API call fails after confirmation, the existing page-level error handling remains. The dialog closes regardless.
- **Modal focus restoration**: If the triggering element is removed from DOM before modal closes, focus falls back to `document.body`.
- **404 page**: Catches all unmatched routes via `<Route path="*">`. No error state needed.

## Testing Strategy

**Unit tests** (example-based): Verify specific migration outcomes — modal renders, inputs have labels, 404 page content, skip link behavior.

**Property-based tests** (universal): Verify PhoneInput formatting/filtering, ConfirmDialog behavior, StatusBadge mapping, and Input accessibility associations across all valid inputs.

**Smoke tests**: Verify zero `modal-overlay` instances, zero `confirm(` calls, zero compile errors after dead code removal.

## Correctness Properties

*A property is a characteristic or behavior that should hold true across all valid executions of a system — essentially, a formal statement about what the system should do. Properties serve as the bridge between human-readable specifications and machine-verifiable correctness guarantees.*

### Property 1: Modal Escape closes and restores focus

*For any* open Modal instance with any triggering element, pressing the Escape key SHALL close the modal (open becomes false) and return document focus to the element that was focused before the modal opened.

**Validates: Requirements 1.4**

### Property 2: Input label-to-input association

*For any* non-empty label string provided to the Input component, the rendered `<label>` element's `htmlFor` attribute SHALL match the rendered `<input>` element's `id` attribute.

**Validates: Requirements 2.4**

### Property 3: Input error accessibility linkage

*For any* non-empty error string provided to the Input component, the rendered `<input>` element's `aria-describedby` attribute SHALL reference an element whose `id` matches and whose text content equals the error string.

**Validates: Requirements 2.5**

### Property 4: Phone formatting round-trip

*For any* sequence of exactly 11 digits, formatting the digits for display via `formatPhone` and then extracting digits from the display string via `extractDigits` SHALL produce the original 11-digit sequence.

**Validates: Requirements 5.1, 5.2**

### Property 5: Phone digit-only filtering

*For any* input string containing arbitrary characters, the `extractDigits` function SHALL return a string containing only characters in [0-9], preserving their original order, with a maximum length of 11.

**Validates: Requirements 5.4**

### Property 6: Phone incomplete validation

*For any* digit sequence with length between 1 and 10 (inclusive), the PhoneInput SHALL produce a validation error. For sequences of length 0 or 11, no validation error SHALL be produced.

**Validates: Requirements 5.3**

### Property 7: ConfirmDialog description visibility

*For any* non-empty description string passed to ConfirmDialog, the rendered dialog SHALL contain that exact string as visible text content.

**Validates: Requirements 6.3**

### Property 8: ConfirmDialog confirm executes callback

*For any* onConfirm callback provided to ConfirmDialog, activating the confirm button SHALL invoke the callback exactly once and close the dialog.

**Validates: Requirements 6.4**

### Property 9: ConfirmDialog cancel preserves safety

*For any* onConfirm callback provided to ConfirmDialog, activating the cancel button or pressing Escape SHALL close the dialog without invoking onConfirm.

**Validates: Requirements 6.5**

### Property 10: Status badge accessibility mapping

*For any* valid AppointmentStatus value, the StatusBadge component SHALL render both a distinguishing icon character AND an `aria-label` attribute containing a human-readable status description.

**Validates: Requirements 8.1, 8.2**

### Property 11: SVG navigation icon labeling

*For any* navigation item in the sidebar configuration, the rendered SVG icon SHALL have an `aria-label` attribute that describes the navigation destination.

**Validates: Requirements 7.2**
