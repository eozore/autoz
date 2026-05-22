# Requirements Document

## Introduction

This specification covers a UX and accessibility audit for the Autoz platform. The goal is to migrate UI patterns to the existing design system components, fix functional bugs, improve keyboard and screen reader accessibility, and remove dead code. All changes target the React 19 frontend at `packages/frontend/`.

## Glossary

- **Autoz_Frontend**: The React 19 + Vite single-page application that serves the Autoz platform UI
- **Design_System_Modal**: The `Modal` component at `design-system/components/Modal.tsx` providing portal rendering, focus trap, Escape key dismissal, and `aria-modal` semantics
- **Design_System_Input**: The `Input` component at `design-system/components/Input.tsx` providing labels, inline validation, error states, and `aria-describedby` associations
- **Layout_Component**: The root layout component at `components/Layout.tsx` that renders the sidebar navigation and main content area
- **DashboardPage**: The dashboard page component that displays KPIs, charts, and filtered data
- **AppointmentsPage**: The appointments management page with scheduling modals and status actions
- **ServicesPage**: The services management page with CRUD modals
- **Router**: The React Router configuration in `App.tsx` that maps URL paths to page components
- **ConfirmDialog**: A new confirmation dialog component built on Design_System_Modal for destructive actions
- **PhoneInput**: A new masked input component for Brazilian phone numbers in +55 (XX) XXXXX-XXXX format
- **NotFoundPage**: A new page component rendered for unmatched routes
- **SVG_Icon**: An inline SVG element with appropriate `aria-label` used for navigation icons

## Requirements

### Requirement 1: Modal Migration

**User Story:** As a user, I want all modal dialogs to have consistent focus management and keyboard accessibility, so that I can interact with them using assistive technologies.

#### Acceptance Criteria

1. WHEN a modal is triggered in AppointmentsPage, THE Autoz_Frontend SHALL render the Design_System_Modal component instead of a raw `div.modal-overlay` element
2. WHEN a modal is triggered in ServicesPage, THE Autoz_Frontend SHALL render the Design_System_Modal component instead of a raw `div.modal-overlay` element
3. WHEN any modal is open, THE Design_System_Modal SHALL trap keyboard focus within the modal content
4. WHEN the user presses the Escape key while a modal is open, THE Design_System_Modal SHALL close the modal and return focus to the triggering element
5. THE Autoz_Frontend SHALL contain zero instances of raw `div.modal-overlay` patterns after migration

### Requirement 2: Form Input Migration

**User Story:** As a user, I want all form fields to have proper labels and error feedback, so that I can understand validation issues without relying on visual cues alone.

#### Acceptance Criteria

1. WHEN a form is rendered in AppointmentsPage, THE Autoz_Frontend SHALL use the Design_System_Input component for all text and number input fields
2. WHEN a form is rendered in ServicesPage, THE Autoz_Frontend SHALL use the Design_System_Input component for all text and number input fields
3. WHEN a form is rendered in ClientsPage, THE Autoz_Frontend SHALL use the Design_System_Input component for all text and number input fields
4. THE Design_System_Input SHALL associate each input with a visible label via the `htmlFor` attribute
5. WHEN a validation error occurs, THE Design_System_Input SHALL display an inline error message linked to the input via `aria-describedby`

### Requirement 3: Dashboard Location Filter

**User Story:** As a shop owner with multiple locations, I want the dashboard location filter to actually filter the displayed data, so that I can view metrics for a specific location.

#### Acceptance Criteria

1. WHEN the user selects a specific location from the filter dropdown, THE DashboardPage SHALL pass the selected location ID as a query parameter to all dashboard API calls
2. WHEN the user selects "Todas as lojas", THE DashboardPage SHALL request unfiltered data from the API
3. WHEN the selected location changes, THE DashboardPage SHALL reload KPIs, charts, and appointment lists reflecting only the selected location data

### Requirement 4: 404 Not Found Page

**User Story:** As a user who navigates to an invalid URL, I want to see a helpful "page not found" message, so that I understand the page does not exist and can navigate back.

#### Acceptance Criteria

1. WHEN a user navigates to a URL that does not match any defined route, THE Router SHALL render the NotFoundPage component
2. THE NotFoundPage SHALL display a heading indicating the page was not found
3. THE NotFoundPage SHALL provide a link to navigate back to the dashboard

### Requirement 5: Phone Input Mask

**User Story:** As a user entering phone numbers, I want the input to format my entry automatically, so that I do not need to remember the required +55 format.

#### Acceptance Criteria

1. WHEN the user types digits into the PhoneInput, THE PhoneInput SHALL format the displayed value as +55 (XX) XXXXX-XXXX
2. WHEN the user submits a form containing PhoneInput, THE PhoneInput SHALL provide the raw value in +55XXXXXXXXXXX format to the form handler
3. IF the user enters fewer than 11 digits (area code + number), THEN THE PhoneInput SHALL display a validation error indicating the phone number is incomplete
4. THE PhoneInput SHALL accept only numeric input and ignore non-digit characters

### Requirement 6: Confirmation Dialog for Destructive Actions

**User Story:** As a user, I want destructive actions to present an accessible confirmation dialog instead of a browser alert, so that I can confirm or cancel with keyboard and screen reader support.

#### Acceptance Criteria

1. WHEN a destructive action is triggered (delete or cancel), THE Autoz_Frontend SHALL display the ConfirmDialog component instead of calling `window.confirm`
2. THE ConfirmDialog SHALL use the Design_System_Modal as its base component
3. THE ConfirmDialog SHALL display a clear description of the action to be performed
4. WHEN the user confirms the action in the ConfirmDialog, THE ConfirmDialog SHALL execute the destructive operation and close
5. WHEN the user cancels or presses Escape in the ConfirmDialog, THE ConfirmDialog SHALL close without executing the destructive operation
6. THE Autoz_Frontend SHALL contain zero calls to `window.confirm` after migration

### Requirement 7: SVG Navigation Icons

**User Story:** As a user relying on assistive technology, I want navigation icons to be proper SVG elements with labels, so that screen readers can identify each navigation item.

#### Acceptance Criteria

1. THE Layout_Component SHALL render SVG_Icon elements for each navigation item instead of emoji characters
2. THE Layout_Component SHALL provide an `aria-label` attribute on each SVG_Icon describing the navigation destination
3. THE SVG_Icon elements SHALL be rendered inline and scale with the surrounding text size

### Requirement 8: Accessible Status Badges

**User Story:** As a colorblind user, I want status badges to include icons alongside colors, so that I can distinguish statuses without relying on color alone.

#### Acceptance Criteria

1. THE Autoz_Frontend SHALL render a distinguishing icon (✓, ⏳, ▶, ✕) alongside the color for each appointment status badge
2. WHEN a status badge is rendered, THE Autoz_Frontend SHALL include an `aria-label` attribute describing the status in text form
3. THE Autoz_Frontend SHALL convey status information through at least two visual channels (color and icon shape)

### Requirement 9: Dead Code Removal

**User Story:** As a developer, I want unused code removed from the codebase, so that the code remains maintainable and free of confusion.

#### Acceptance Criteria

1. THE AppointmentsPage SHALL not contain the unused `toggleService` function
2. THE Autoz_Frontend SHALL compile without errors after the removal of dead code

### Requirement 10: Skip Navigation Link

**User Story:** As a keyboard user, I want a skip navigation link at the top of the page, so that I can bypass the sidebar and jump directly to the main content.

#### Acceptance Criteria

1. THE Layout_Component SHALL render a visually-hidden "Pular para conteúdo" link as the first focusable element in the document
2. WHEN the skip link receives keyboard focus, THE Layout_Component SHALL make the link visible on screen
3. WHEN the user activates the skip link, THE Layout_Component SHALL move focus to the main content area
4. THE main content area SHALL have an `id` attribute that the skip link references via its `href`
