# Requirements Document

## Introduction

Security hardening for the Autoz platform addressing six areas: token storage migration from localStorage to sessionStorage, refresh token mechanism with short-lived access tokens, upload tenant isolation, password complexity enforcement, forma_pagamento enum validation, and max length constraints on text fields. These changes reduce XSS persistence risk, enforce data integrity, and isolate tenant resources.

## Glossary

- **Auth_Module**: The backend authentication system (routes/auth.ts, lib/jwt.ts, middleware/auth.ts) responsible for user registration, login, token issuance, and token verification.
- **Frontend_Auth_Client**: The frontend API client (lib/api.ts) responsible for storing tokens, attaching Authorization headers, and handling token refresh.
- **Upload_Service**: The backend upload route (routes/upload.ts) and storage provider (lib/storage.ts) responsible for receiving, validating, and persisting uploaded files.
- **Validation_Layer**: The Zod schema definitions (schemas/*.ts) that validate request payloads before processing.
- **Access_Token**: A short-lived JWT (1 hour expiry) used to authenticate API requests.
- **Refresh_Token**: A long-lived opaque token (7 days expiry) used to obtain new access tokens without re-authentication.
- **Tenant**: An isolated organizational unit identified by tenant_id that owns all data within the platform.

## Requirements

### Requirement 1: Token Storage Migration

**User Story:** As a platform user, I want my authentication token stored in sessionStorage, so that a compromised tab cannot persist access across browser sessions or other tabs.

#### Acceptance Criteria

1. WHEN a user successfully authenticates, THE Frontend_Auth_Client SHALL store the access token in sessionStorage under the key "token".
2. WHEN a user successfully authenticates, THE Frontend_Auth_Client SHALL store the refresh token in sessionStorage under the key "refresh_token".
3. WHEN the Frontend_Auth_Client sends an API request, THE Frontend_Auth_Client SHALL read the access token from sessionStorage.
4. WHEN a user logs out, THE Frontend_Auth_Client SHALL remove both "token" and "refresh_token" entries from sessionStorage.
5. THE Frontend_Auth_Client SHALL NOT store authentication tokens in localStorage.
6. WHEN a 401 response is received on a non-auth route, THE Frontend_Auth_Client SHALL remove both "token" and "refresh_token" from sessionStorage before redirecting to the login page.

### Requirement 2: Refresh Token Mechanism

**User Story:** As a platform user, I want short-lived access tokens that auto-refresh transparently, so that my session remains active without requiring frequent re-login while limiting the window of token compromise.

#### Acceptance Criteria

1. WHEN a user successfully authenticates via login or register, THE Auth_Module SHALL return an access token with a 1-hour expiry and a refresh token with a 7-day expiry.
2. WHEN the Auth_Module receives a valid refresh token on the /auth/refresh endpoint, THE Auth_Module SHALL issue a new access token with a 1-hour expiry and a new refresh token with a 7-day expiry.
3. WHEN the Auth_Module receives an expired or invalid refresh token on the /auth/refresh endpoint, THE Auth_Module SHALL respond with HTTP 401 and an error message.
4. THE Auth_Module SHALL store refresh tokens as hashed values in the database associated with the user_id.
5. WHEN a new refresh token is issued, THE Auth_Module SHALL invalidate the previous refresh token for that user session.
6. WHEN the access token has less than 5 minutes remaining before expiry, THE Frontend_Auth_Client SHALL automatically request a new access token using the stored refresh token.
7. IF the refresh token request fails with HTTP 401, THEN THE Frontend_Auth_Client SHALL clear stored tokens and redirect the user to the login page.
8. THE Auth_Module SHALL generate refresh tokens as cryptographically random opaque strings of at least 32 bytes.

### Requirement 3: Upload Tenant Isolation

**User Story:** As a platform tenant, I want uploaded files namespaced by my tenant_id, so that other tenants cannot access my files.

#### Acceptance Criteria

1. WHEN a file is uploaded, THE Upload_Service SHALL store the file under the path `{tenant_id}/{filename}` instead of a flat filename.
2. WHEN a file is uploaded, THE Upload_Service SHALL use the authenticated user's tenant_id from the request context to determine the storage namespace.
3. WHEN a request is made to access an uploaded file, THE Upload_Service SHALL verify that the requesting user's tenant_id matches the tenant_id in the file path before serving the file.
4. IF a user requests a file belonging to a different tenant, THEN THE Upload_Service SHALL respond with HTTP 403.
5. IF a user without a tenant_id attempts to upload a file, THEN THE Upload_Service SHALL still store the file under a temporary namespace using the user_id until a tenant is assigned.
6. THE Upload_Service SHALL return the full namespaced URL path in the upload response (e.g., `/uploads/{tenant_id}/{filename}`).

### Requirement 4: Password Complexity

**User Story:** As a platform administrator, I want passwords to meet complexity requirements, so that user accounts are resistant to brute-force and dictionary attacks.

#### Acceptance Criteria

1. THE Validation_Layer SHALL require passwords to contain at least 8 characters.
2. THE Validation_Layer SHALL require passwords to contain at least 1 uppercase letter (A-Z).
3. THE Validation_Layer SHALL require passwords to contain at least 1 numeric digit (0-9).
4. THE Validation_Layer SHALL require passwords to contain at least 1 special character from the set: !@#$%^&*()_+-=[]{}|;:',.<>?/~`
5. IF a registration request contains a password that does not meet all complexity requirements, THEN THE Validation_Layer SHALL respond with HTTP 400 and a descriptive error message indicating which requirements are not met.
6. THE Validation_Layer SHALL enforce password complexity on the registration endpoint only (login accepts any string for comparison).

### Requirement 5: forma_pagamento Enum Validation

**User Story:** As a platform developer, I want forma_pagamento constrained to a defined set of values, so that payment method data is consistent and queryable.

#### Acceptance Criteria

1. THE Auth_Module database schema SHALL define a FormaPagamento enum with values: A_VISTA, PARCELADO, PIX, CARTAO_CREDITO, CARTAO_DEBITO.
2. WHEN an appointment is created or updated with a forma_pagamento value, THE Validation_Layer SHALL accept only values from the FormaPagamento enum.
3. IF an appointment request contains a forma_pagamento value not in the FormaPagamento enum, THEN THE Validation_Layer SHALL respond with HTTP 400 and an error message listing the valid values.
4. THE Validation_Layer SHALL accept null or undefined for forma_pagamento (the field remains optional).
5. THE database schema SHALL migrate the forma_pagamento column from String to the FormaPagamento enum type with a data migration for existing records.

### Requirement 6: Max Length on Text Fields

**User Story:** As a platform developer, I want text fields constrained to a maximum length, so that the database is protected from excessively large payloads and storage abuse.

#### Acceptance Criteria

1. THE Validation_Layer SHALL enforce a maximum length of 2000 characters on the "notas" field in the appointment create and update schemas.
2. THE Validation_Layer SHALL enforce a maximum length of 2000 characters on the "descricao" field in the service schema.
3. THE Validation_Layer SHALL enforce a maximum length of 2000 characters on the "descricao" field in the bill schema.
4. THE Validation_Layer SHALL enforce a maximum length of 2000 characters on the "descricao" field in the inventory item schema.
5. THE Validation_Layer SHALL enforce a maximum length of 2000 characters on the "comment" field in the review schema.
6. THE Validation_Layer SHALL enforce a maximum length of 2000 characters on the "notas" field in the stock movement schema.
7. IF a request contains a text field exceeding 2000 characters, THEN THE Validation_Layer SHALL respond with HTTP 400 and an error message identifying the field and the maximum allowed length.
