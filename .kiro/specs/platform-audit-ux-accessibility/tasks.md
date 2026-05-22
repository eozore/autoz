# Implementation Plan: Platform Audit UX & Accessibility

## Overview

This plan implements 10 requirements for the Autoz platform UX/accessibility audit: modal migration, form input migration, dashboard filter fix, 404 page, phone mask, confirm dialog, SVG icons, status badge icons, dead code removal, and skip navigation link.

## Tasks

- [ ] 1. Create ConfirmDialog component (`components/ConfirmDialog.tsx`) — renders Modal with title, description paragraph, cancel and confirm buttons; confirm calls onConfirm then closes
- [ ] 2. Create useConfirmDialog hook (`hooks/useConfirmDialog.ts`) — manages open state, exposes `confirm(options)` and `dialogProps`
- [ ] 3. Create PhoneInput component (`components/PhoneInput.tsx`) — wraps Input with `formatPhone`, `extractDigits`, validation error for incomplete numbers, `inputMode="numeric"`
- [ ] 4. Export `toPhoneSubmitValue` utility from PhoneInput module for form submission format (+55XXXXXXXXXXX)
- [ ] 5. Create StatusBadge component (`components/StatusBadge.tsx`) — maps each AppointmentStatus to variant, icon (✓, ⏳, ▶, ✕), and aria-label
- [ ] 6. Create NavIcon component (`components/NavIcon.tsx`) — inline SVG with path data for 8 nav items, `role="img"`, `aria-label`, `fill="currentColor"`, size in em units
- [ ] 7. Create NotFoundPage (`pages/NotFoundPage.tsx`) — uses EmptyState with heading "Página não encontrada" and Link to /dashboard
- [ ] 8. Add catch-all route `<Route path="*" element={<NotFoundPage />} />` in App.tsx
- [ ] 9. Add skip navigation link as first focusable element in Layout.tsx (`<a href="#main-content" className="skip-nav-link">Pular para conteúdo</a>`)
- [ ] 10. Add `id="main-content"` to the `<main>` element in Layout.tsx
- [ ] 11. Add CSS for `.skip-nav-link` — visually hidden by default, visible on `:focus`
- [ ] 12. Replace emoji icons in Layout.tsx navItems with NavIcon component rendering SVG with aria-label for each destination
- [ ] 13. Migrate modal in AppointmentsPage — replace `div.modal-overlay` with `<Modal>` from design system
- [ ] 14. Migrate modal in ServicesPage — replace `div.modal-overlay` with `<Modal>`
- [ ] 15. Migrate modal in ClientsPage — replace `div.modal-overlay` with `<Modal>`
- [ ] 16. Migrate modal in BillsPage — replace `div.modal-overlay` with `<Modal>`
- [ ] 17. Migrate modals in InventoryPage (2 instances) — replace `div.modal-overlay` with `<Modal>`
- [ ] 18. Migrate modals in LocationsPage (2 instances) — replace `div.modal-overlay` with `<Modal>`
- [ ] 19. Migrate modal in VehiclesPage — replace `div.modal-overlay` with `<Modal>`
- [ ] 20. Migrate form inputs in AppointmentsPage — replace raw `<input>` in modal form with `<Input>` from design system with label props
- [ ] 21. Migrate form inputs in ServicesPage — replace raw `<input>` with `<Input>` with label props
- [ ] 22. Migrate form inputs in ClientsPage — replace raw `<input>` with `<Input>` with label props; integrate PhoneInput for phone fields
- [ ] 23. Fix dashboard location filter — append `location_id` query parameter to all API calls in `loadFiltered()` when selectedLocation !== 'all'
- [ ] 24. Replace `confirm()` calls in AppointmentsPage with useConfirmDialog hook
- [ ] 25. Replace `confirm()` calls in ServicesPage with useConfirmDialog hook
- [ ] 26. Replace `confirm()` calls in ClientsPage with useConfirmDialog hook
- [ ] 27. Replace `confirm()` call in BillsPage with useConfirmDialog hook
- [ ] 28. Replace `confirm()` call in InventoryPage with useConfirmDialog hook
- [ ] 29. Replace `confirm()` call in VehiclesPage with useConfirmDialog hook
- [ ] 30. Replace `confirm()` call in LocationsPage with useConfirmDialog hook
- [ ] 31. Replace `confirm()` call in DashboardPage with useConfirmDialog hook
- [ ] 32. Replace status badges in AppointmentsPage and DashboardPage with StatusBadge component
- [ ] 33. Remove unused `toggleService` function from AppointmentsPage
- [ ] 34. Remove `.modal-overlay` and `.modal-content` CSS rules from index.css (if present)
- [ ] 35. Verify zero `div.modal-overlay` instances remain in codebase
- [ ] 36. Verify zero `confirm(` calls remain in codebase
- [ ] 37. Run `npm run build` to verify zero compile/build errors
- [ ] 38. Write property tests for PhoneInput: round-trip (formatPhone → extractDigits preserves digits), digit-only filtering, incomplete validation **Feature: platform-audit-ux-accessibility, Property 4, 5, 6**
- [ ] 39. Write property tests for ConfirmDialog: description visibility, confirm executes callback, cancel preserves safety **Feature: platform-audit-ux-accessibility, Property 7, 8, 9**
- [ ] 40. Write property tests for StatusBadge (icon + aria-label for all statuses) and Input (label htmlFor association, error aria-describedby linkage) **Feature: platform-audit-ux-accessibility, Property 10, 2, 3**

## Task Dependency Graph

```json
{
  "waves": [
    [1, 3, 5, 6, 7, 9, 10, 11, 23, 33],
    [2, 4, 8, 12, 13, 14, 15, 16, 17, 18, 19, 32],
    [20, 21, 22, 24, 25, 26, 27, 28, 29, 30, 31, 34],
    [35, 36, 38, 39, 40],
    [37]
  ]
}
```

- **Wave 1**: Independent component creation (ConfirmDialog, PhoneInput, StatusBadge, NavIcon, NotFoundPage, skip nav, dashboard filter, dead code)
- **Wave 2**: Hook creation, route addition, icon integration, modal migrations, StatusBadge integration
- **Wave 3**: Input migrations, confirm() replacements, CSS cleanup
- **Wave 4**: Verification tasks and property tests
- **Wave 5**: Final build verification

## Notes

- The existing Modal component already provides focus trap, Escape key handling, and aria-modal. No changes needed to the design system Modal itself.
- The existing Input component already provides htmlFor, aria-describedby, and error display. No changes needed to the design system Input itself.
- PhoneInput formatting utilities (`formatPhone`, `extractDigits`) are exported separately for unit/property testing without rendering.
- All `confirm()` calls found use the bare `confirm(` pattern (not `window.confirm`), but they resolve to the same global function.
- The dashboard location filter bug exists because `selectedLocation` state is declared but never passed to API calls in `loadFiltered()`.
