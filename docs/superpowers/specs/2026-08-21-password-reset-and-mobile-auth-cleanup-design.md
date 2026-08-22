# Password Reset Flow and Mobile Auth Cleanup Design

## Context

The mobile forgot-password screen currently posts to `POST /api/user/forgot-password`, but the API does not implement that route, so production returns 404. The main web application does not provide a working reference implementation: its forgot-password context method is empty, and its reset-password form reports success without submitting a password. These stubs have existed since the initial reachable monorepo commit.

This change will build a real shared password-reset flow for the API, web app, and mobile app. It will also remove the `Property Peace mobile` presentation chip from the mobile create-account screen, matching the approved login-screen cleanup.

## Goals

- Let a user request a password-reset email from either the web or mobile app.
- Deliver a secure, time-limited link to the existing web reset-password page.
- Let the user set a valid new password exactly once with that link.
- Prevent account enumeration, token disclosure, replay, and continued use of existing refresh sessions.
- Remove the create-account screen's `Property Peace mobile` chip without changing registration behavior.

## Non-goals

- Native-app deep linking or an in-app password-entry screen.
- Changing the existing password hashing algorithm as part of this feature.
- Allowing password creation for OAuth-only accounts that do not already have a password.
- Refactoring unrelated authentication, email-template, or registration code.

## Chosen Approach

Use a database-backed opaque reset token. The API generates a cryptographically random token, emails the raw token only inside the reset URL, and stores only its SHA-256 hash. A database record makes expiry, invalidation, atomic single use, and auditability explicit.

A stateless signed token was rejected because it cannot reliably enforce single use or targeted invalidation without server state. An emailed numeric code was rejected because it does not match the requested reset-link experience and would require additional UI.

## Data Model

Add a `PasswordResetToken` entity and EF Core configuration with:

- `Id`
- `UserId` and a required relationship to `User`
- `TokenHash`, stored as a fixed SHA-256 representation with a unique index
- `CreatedAt`
- `ExpiresAt`
- nullable `ConsumedAt`

Add an index supporting lookup and invalidation by user and token state. Add the corresponding EF Core migration and model snapshot update.

The raw token must never be stored or logged. A token is usable only when its hash matches, it is unconsumed, and its expiry is later than the current UTC time.

## API Contracts

### Request reset email

`POST /api/user/forgot-password`

Request:

```json
{ "email": "person@example.com" }
```

The endpoint is anonymous and always returns the same generic HTTP 200 response regardless of whether the account exists, supports passwords, or email delivery succeeds. This prevents callers from discovering registered accounts.

For an active, non-deleted account with an existing password hash and salt, the service will:

1. Normalize and locate the email address.
2. Invalidate any earlier unconsumed reset tokens for that user.
3. Generate 32 random bytes and encode them for safe use in a URL.
4. Store the token hash with a 30-minute expiry.
5. Build `FrontendBaseUrl/reset-password?token=<encoded-token>` using trusted server configuration.
6. Send a dedicated Property Peace password-reset email with HTML and plain-text bodies.

Email delivery failures are logged without the raw token or full recipient address, while the caller still receives the generic response.

### Complete password reset

`POST /api/user/reset-password`

Request:

```json
{
  "token": "opaque-token-from-email",
  "newPassword": "Str0ng!Password"
}
```

The endpoint is anonymous. It validates the existing `PasswordValidator` rules, hashes the presented token, and completes the following work in one database transaction:

1. Load an unconsumed, unexpired matching reset record.
2. Atomically mark the record consumed so concurrent requests cannot reuse it.
3. Update the associated user's password hash and salt using the current repository convention.
4. Revoke all active refresh tokens for the user.
5. Invalidate any other outstanding reset tokens for the user.

Missing, expired, consumed, or malformed tokens return a safe client error with: `This reset link is invalid or has expired.` Password-rule failures return the existing validation message. Successful reset returns a generic success response and does not create a login session.

The existing rate-limit configuration for both endpoint paths remains in force.

## Backend Structure

Keep the responsibilities separated:

- `UserController` exposes the two anonymous HTTP contracts and maps service results to responses.
- A focused password-reset service owns token generation, hashing, expiry, email construction, and reset orchestration.
- The user repository or service exposes a narrowly scoped token-authorized password update instead of calling the admin password method directly from the controller.
- Session revocation is exposed as a reusable service operation that marks all active `UserRefreshToken` records revoked.
- `DataContext`, entity configuration, and the migration own persistence details.

The service uses `TimeProvider` or the repository's established clock pattern where available so expiry behavior is deterministic in tests.

## Client Behavior

### Web forgot-password

Implement the existing JWT context method so it calls `POST /api/user/forgot-password` with `{ email }`. Preserve the existing generic success message and check-mail navigation only after the request resolves.

### Web reset-password

Read `token` from the URL query string. If it is absent, show the invalid-or-expired message and do not submit. On valid form submission, call `POST /api/user/reset-password` with the token and new password. Navigate to login only after a successful response. Preserve password confirmation and strength feedback, and display safe API validation errors in the form.

### Mobile forgot-password

The mobile auth service already calls `POST /api/user/forgot-password` with the correct request body. No route change is required. Once the API exists, the current mobile screen continues to show the enumeration-safe success message and returns to login.

Reset links always open the web application at the configured `FrontendBaseUrl`; native deep linking is intentionally outside this scope.

## Mobile Create-account Cleanup

In `property-peace-mobile/src/screens/auth/RegisterScreen.tsx`:

- Remove the `Property Peace mobile` `Text` element above the title.
- Remove the now-unused `eyebrow` style block.
- Leave the title, form spacing, Apple/Google sign-in, legal links, navigation, and registration behavior unchanged.

## Security and Error Handling

- Store token hashes only and never log raw tokens.
- Use cryptographically secure random token generation.
- Enforce a 30-minute expiry and single-use consumption.
- Invalidate older tokens when a new reset is requested.
- Return the same forgot-password response for known, unknown, OAuth-only, suspended, or deleted accounts.
- Do not use a caller-provided origin when creating reset URLs.
- Revoke all active refresh sessions after a successful reset.
- Keep reset completion errors specific enough for recovery but free of account-identifying details.
- Avoid changing the existing password hashing scheme in this feature; a password-KDF migration requires separate compatibility planning.

## Testing

Follow red-green-refactor for production changes.

Backend tests will prove:

- Known and unknown email requests produce the same public response.
- OAuth-only, deleted, and suspended accounts do not receive usable reset tokens.
- Stored tokens are hashes rather than raw values.
- A new request invalidates prior tokens.
- Expired, malformed, and consumed tokens are rejected.
- A valid token changes the password once.
- Password-policy failures do not consume the token.
- Concurrent or repeated use cannot reset twice.
- A successful reset revokes all active refresh sessions.
- Email links use the configured frontend base URL.

Web tests will prove:

- The forgot-password context posts the expected email payload.
- The reset form submits the URL token and new password.
- Missing or rejected tokens show the safe error and do not report success.
- Successful completion navigates to login only after the API resolves.

The mobile package has no React Native component-test harness for the presentation-only chip removal. Per user-approved exception, verify that change with TypeScript compilation, the existing iOS compliance checks, and a focused diff. The backend regression tests cover the mobile 404 because the mobile client already targets the new shared endpoint.

## Verification and Rollout

- Run the targeted API password-reset tests, then the relevant API test suite.
- Run the web auth tests and web build/type checks used by the project.
- Run mobile TypeScript compilation and `npm run test:ios-compliance`.
- Run whitespace checks and inspect focused diffs to ensure unrelated working-tree changes remain untouched.
- Apply the database migration before or with the API deployment.
- Confirm production `FrontendBaseUrl` is `https://app.propertypeace.io` before enabling email delivery.
- Smoke-test one request, one successful reset, replay rejection, and login with the new password in the deployment environment.
