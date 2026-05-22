# Requirements Document

## Introduction

This feature optimizes the Autoz bilateral marketplace UX for shop owners (supply side) and end customers (demand side). The primary focus is the admin panel experience — improving onboarding, time-to-value, trust signals, and engagement through a shared internal design system. The public-facing page receives lighter improvements to support real reviews, liquidity signals, and progressive data replacement of mock content.

## Glossary

- **Admin_Panel**: The authenticated shop owner interface comprising Dashboard, Locations, Services, Clients, Inventory, Bills, Appointments, and Vehicles pages
- **Public_Page**: The customer-facing storefront page accessible via tenant slug at `/p/{slug}`
- **Design_System**: A shared components folder with consistent design tokens (colors, spacing, typography, radii, shadows) used across all 12 pages
- **Onboarding_Engine**: The backend and frontend system that tracks, persists, and displays shop owner setup progress
- **Review_System**: The backend tables and frontend components that collect, store, and display real customer reviews and ratings
- **Cold_Start_Handler**: Logic that displays pre-populated placeholder content when real data is insufficient, progressively replacing mocks as real data accumulates
- **Liquidity_Signal**: Visual indicators showing marketplace activity (response times, recent bookings, active shops) to build user confidence
- **Gamification_Engine**: Visual incentive system showing completion percentages, streaks, and achievement badges to drive engagement
- **Shop_Owner**: An authenticated user with OWNER or ADMIN role managing their automotive service business
- **End_Customer**: An unauthenticated visitor browsing the Public_Page and booking services
- **Analytics_Event**: A tracked user interaction stored in the database for measuring engagement and marketplace health

## Requirements

### Requirement 1: Internal Design System

**User Story:** As a Shop_Owner, I want a consistent visual experience across all pages, so that the platform feels professional and trustworthy.

#### Acceptance Criteria

1. THE Design_System SHALL provide design tokens for colors, spacing, typography, border-radii, and shadows as CSS custom properties in a single tokens file
2. THE Design_System SHALL provide reusable UI components including Button, Card, Input, Badge, Modal, EmptyState, ProgressBar, and Tooltip
3. WHEN a page renders any interactive element, THE Design_System SHALL ensure the element meets a minimum touch target size of 44x44 pixels for mobile accessibility
4. THE Design_System SHALL define a responsive breakpoint system with mobile (below 768px), tablet (768px to 1024px), and desktop (above 1024px) layouts

### Requirement 2: Onboarding Progress Persistence

**User Story:** As a Shop_Owner, I want my onboarding progress saved to the database, so that I can resume setup across sessions and devices.

#### Acceptance Criteria

1. WHEN a Shop_Owner completes an onboarding step, THE Onboarding_Engine SHALL persist the step completion status, timestamp, and tenant identifier to the database within 2 seconds
2. WHEN a Shop_Owner loads the Dashboard, THE Onboarding_Engine SHALL retrieve persisted onboarding progress and display the correct completion state
3. THE Onboarding_Engine SHALL track the following steps: company profile, services setup, location setup, first client, first appointment, public page activation, and first review received
4. WHEN all onboarding steps are completed, THE Onboarding_Engine SHALL dismiss the onboarding banner and display a congratulatory achievement badge
5. IF the database is unreachable during step persistence, THEN THE Onboarding_Engine SHALL retry the write operation up to 3 times with exponential backoff and display a non-blocking warning to the Shop_Owner

### Requirement 3: Time-to-Value Optimization

**User Story:** As a new Shop_Owner, I want to reach a functional state quickly, so that I see value from the platform within my first session.

#### Acceptance Criteria

1. WHEN a Shop_Owner has zero services registered, THE Admin_Panel SHALL offer a one-click import of a curated template pack with at least 5 common automotive services including name, duration, and price
2. WHEN a Shop_Owner has zero clients registered, THE Admin_Panel SHALL display a guided prompt with a direct link to client creation rather than an empty table
3. WHEN a Shop_Owner completes company setup, THE Admin_Panel SHALL automatically redirect to the Dashboard with the onboarding checklist expanded and the next incomplete step highlighted
4. THE Admin_Panel SHALL display contextual tips on each page explaining the page purpose and next recommended action until the Shop_Owner dismisses the tip

### Requirement 4: Real Review and Rating System

**User Story:** As a Shop_Owner, I want real customer reviews displayed on my public page, so that I build genuine trust with potential customers.

#### Acceptance Criteria

1. WHEN an appointment reaches CONCLUIDO status, THE Review_System SHALL send a review request to the End_Customer via the registered phone number within 24 hours
2. THE Review_System SHALL store each review with a star rating (1 to 5), text comment (up to 500 characters), customer name, vehicle description, appointment reference, and creation timestamp
3. WHEN the Public_Page loads and fewer than 3 real reviews exist, THE Cold_Start_Handler SHALL display placeholder testimonials clearly marked as example content
4. WHEN 3 or more real reviews exist, THE Public_Page SHALL display only real reviews sorted by most recent first
5. THE Public_Page SHALL display an aggregate star rating calculated as the arithmetic mean of all review scores rounded to one decimal place
6. IF a review contains fewer than 10 characters in the comment field, THEN THE Review_System SHALL reject the submission and return a validation error message

### Requirement 5: Liquidity Signals

**User Story:** As an End_Customer, I want to see activity indicators on the public page, so that I feel confident the shop is active and responsive.

#### Acceptance Criteria

1. THE Public_Page SHALL display the total count of completed appointments for the current month as a visible activity indicator
2. THE Public_Page SHALL display the average response time from booking to confirmation calculated from the last 30 confirmed appointments
3. WHEN the shop has fewer than 5 completed appointments, THE Cold_Start_Handler SHALL display a generic activity badge instead of specific metrics
4. WHILE the Public_Page is visible, THE Liquidity_Signal SHALL refresh activity data every 5 minutes without requiring a full page reload

### Requirement 6: Gamification and Visual Incentives

**User Story:** As a Shop_Owner, I want visual progress indicators and achievements, so that I stay motivated to complete platform setup and maintain engagement.

#### Acceptance Criteria

1. THE Gamification_Engine SHALL display a profile completeness percentage on the Dashboard calculated from weighted onboarding steps
2. WHEN a Shop_Owner reaches 100% profile completeness, THE Gamification_Engine SHALL award a "Perfil Completo" badge visible on the Dashboard and Public_Page
3. WHEN a Shop_Owner completes 10 appointments in a calendar month, THE Gamification_Engine SHALL award a monthly activity streak badge
4. THE Gamification_Engine SHALL persist all earned badges and achievements to the database with award date and badge type
5. THE Dashboard SHALL display a weekly engagement summary showing appointments completed, new clients added, and revenue earned compared to the previous week

### Requirement 7: Cold Start Data Strategy

**User Story:** As a new Shop_Owner, I want my public page to look populated from day one, so that potential customers perceive my business as established.

#### Acceptance Criteria

1. WHEN a tenant has zero completed appointments, THE Cold_Start_Handler SHALL display pre-populated demand statistics with a visual indicator that data is estimated
2. WHEN real appointment data accumulates to 10 or more completed appointments, THE Cold_Start_Handler SHALL replace estimated demand statistics with real calculated metrics
3. THE Cold_Start_Handler SHALL provide fallback FAQ content for the Public_Page until the Shop_Owner configures custom FAQ entries
4. WHEN the Shop_Owner adds custom FAQ entries, THE Public_Page SHALL display custom entries and hide the fallback content

### Requirement 8: Publishing Friction Reduction

**User Story:** As a Shop_Owner, I want service creation to be fast and guided, so that I can publish my offerings without friction.

#### Acceptance Criteria

1. WHEN a Shop_Owner creates a new service, THE Admin_Panel SHALL offer autofill suggestions based on common automotive service templates matching the entered service name
2. THE Admin_Panel SHALL provide a bulk service import option accepting a list of services with name, duration, and price in a single submission
3. WHEN a Shop_Owner uploads a service photo, THE Admin_Panel SHALL display a preview and auto-crop the image to the required aspect ratio before saving
4. THE Admin_Panel SHALL validate service creation forms inline and display field-level error messages within 300 milliseconds of the user leaving a required field

### Requirement 9: Bilateral Marketplace Metrics

**User Story:** As a Shop_Owner, I want to see marketplace-specific KPIs on my dashboard, so that I understand my performance relative to platform activity.

#### Acceptance Criteria

1. THE Dashboard SHALL display a booking conversion rate calculated as confirmed appointments divided by total public page visits for the current month
2. THE Dashboard SHALL display average customer rating from the Review_System updated in real time as new reviews arrive
3. THE Dashboard SHALL display a repeat customer percentage calculated as returning clients divided by total unique clients for the trailing 90 days
4. WHEN the Dashboard loads, THE Admin_Panel SHALL retrieve all marketplace metrics in a single API call completing within 500 milliseconds

### Requirement 10: Analytics Event Tracking

**User Story:** As a Shop_Owner, I want platform interactions tracked, so that marketplace health can be measured and features can be improved based on real usage data.

#### Acceptance Criteria

1. WHEN an End_Customer views the Public_Page, THE Analytics_Event system SHALL record a page view event with tenant identifier, timestamp, and referrer source
2. WHEN an End_Customer initiates a booking flow, THE Analytics_Event system SHALL record a booking_started event with service identifier and step reached
3. WHEN a Shop_Owner completes an onboarding step, THE Analytics_Event system SHALL record an onboarding_step_completed event with step name and elapsed time since registration
4. THE Analytics_Event system SHALL store events in a dedicated database table with event type, tenant identifier, metadata JSON field, and creation timestamp
5. IF the analytics write fails, THEN THE Analytics_Event system SHALL fail silently without affecting the user-facing operation

### Requirement 11: Mobile-First Responsive Layout

**User Story:** As an End_Customer browsing on a mobile device, I want the public page to be fully usable on small screens, so that I can book services from my phone.

#### Acceptance Criteria

1. WHEN the viewport width is below 768px, THE Public_Page SHALL stack the service list and booking widget vertically with the booking widget appearing below the selected service
2. WHEN the viewport width is below 768px, THE Admin_Panel SHALL collapse the sidebar navigation into a hamburger menu accessible from a fixed header
3. THE Design_System SHALL ensure all text content remains readable at a minimum font size of 14px on mobile viewports
4. WHEN a touch interaction occurs on a service card, THE Public_Page SHALL provide visual feedback within 100 milliseconds

### Requirement 12: Transparency and Trust on Public Page

**User Story:** As an End_Customer, I want clear pricing and service information, so that I can make informed decisions without hidden surprises.

#### Acceptance Criteria

1. THE Public_Page SHALL display service prices prominently on each service card, or display "Sob consulta" when no price is set
2. THE Public_Page SHALL display the shop operating hours for the selected location in a visible section above the service list
3. WHEN a service has a defined duration, THE Public_Page SHALL display the estimated duration on the service card
4. THE Public_Page SHALL display a "Garantia Inclusa" trust badge only when the Shop_Owner has enabled the guarantee option in their profile settings
5. THE Public_Page SHALL display the total number of completed services as a social proof indicator next to the shop rating
