# Online Rent Payments — API Approval Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan.

**Goal:** Add a durable, per-organization access request and admin approval workflow that is off by default, sends review notifications to the existing new-user admin recipient cohort, and gates Stripe actions without weakening existing payment security.

**Architecture:** A single current-state record per organization plus immutable audit events owns the approval lifecycle. Organization and admin controllers call an application service that enforces transitions and authority. A separate action-readiness service composes global flags, approval state, provider readiness, connected-payee readiness, and actor authorization for `RequestAccess`, `Configure`, `Pay`, and `Transfer` actions.

**Tech Stack:** ASP.NET Core, EF Core, SQL Server, xUnit, Moq, existing Property Peace notification/email infrastructure.

**Depends on:** [`2026-08-25-online-rent-payments-launch-design.md`](../specs/2026-08-25-online-rent-payments-launch-design.md)

---

## Task 1: Define the approval domain and persistence contract

**Files:**

- Create: `property-peace-api/Models/RentPaymentAccessRequest.cs`
- Create: `property-peace-api/Models/RentPaymentAccessAuditEvent.cs`
- Create: `property-peace-api/Configurations/RentPaymentAccessRequestConfiguration.cs`
- Create: `property-peace-api/Configurations/RentPaymentAccessAuditEventConfiguration.cs`
- Modify: `property-peace-api/Data/DataContext.cs`
- Create: `property-peace-api/Dtos/RentPaymentAccess/RentPaymentAccessDtos.cs`
- Test: `property-peace-api.Tests/Models/RentPaymentAccessModelTests.cs`

### Step 1: Write failing model-contract tests

Assert:

- a new organization has no row and is therefore treated as `NotRequested`;
- `PublicId` is the externally addressable identifier;
- organization ID is unique;
- status values are `Pending`, `Approved`, `Rejected`, and `Suspended`;
- concurrency uses a row-version token;
- audit events capture prior status, next status, actor, timestamp, and user-safe metadata without secrets.

Run:

```powershell
dotnet test property-peace-api.Tests/property-peace-api.Tests.csproj --filter FullyQualifiedName~RentPaymentAccessModelTests
```

Expected: FAIL because the models do not exist.

### Step 2: Add exact model types

Use this status type:

```csharp
public enum RentPaymentAccessStatus
{
    Pending = 1,
    Approved = 2,
    Rejected = 3,
    Suspended = 4
}
```

`RentPaymentAccessRequest` must contain:

```csharp
public int Id { get; set; }
public Guid PublicId { get; set; } = Guid.NewGuid();
public int OrganizationId { get; set; }
public RentPaymentAccessStatus Status { get; set; }
public int RequestedByUserId { get; set; }
public DateTime RequestedAtUtc { get; set; }
public int? ReviewedByUserId { get; set; }
public DateTime? ReviewedAtUtc { get; set; }
public string? DecisionReason { get; set; }
public string? InternalNotes { get; set; }
public DateTime StatusChangedAtUtc { get; set; }
public byte[] RowVersion { get; set; } = Array.Empty<byte>();
```

`RentPaymentAccessAuditEvent` must contain request ID, organization ID, nullable prior status, next status, actor user ID, occurred-at UTC, and nullable safe metadata JSON. Do not put Stripe keys, tokens, bank details, or raw request bodies in metadata.

Configure a unique index on `OrganizationId`, a unique index on `PublicId`, row-version concurrency, bounded decision/notes fields, and a request-to-audit relationship with restrictive delete behavior.

Add both `DbSet` properties to `DataContext` and apply both configurations in the existing model configuration path.

### Step 3: Add API DTOs

Define:

```csharp
public sealed record RentPaymentAccessDto(
    Guid? PublicId,
    int OrganizationId,
    string Status,
    DateTime? RequestedAtUtc,
    DateTime? ReviewedAtUtc,
    string? DecisionReason);

public sealed record ReviewRentPaymentAccessRequestDto(
    string? DecisionReason,
    string? InternalNotes,
    byte[] RowVersion);

public sealed record RentPaymentAccessListItemDto(
    Guid PublicId,
    int OrganizationId,
    string OrganizationName,
    string Status,
    string RequestedBy,
    DateTime RequestedAtUtc,
    DateTime? ReviewedAtUtc,
    byte[] RowVersion);

public sealed record RentPaymentAccessAuditEventDto(
    string? PriorStatus,
    string NextStatus,
    int ActorUserId,
    DateTime OccurredAtUtc,
    string? SafeMetadataJson);

public sealed record RentPaymentAccessAdminDetailDto(
    Guid PublicId,
    int OrganizationId,
    string OrganizationName,
    string Status,
    int RequestedByUserId,
    string RequestedBy,
    DateTime RequestedAtUtc,
    int? ReviewedByUserId,
    DateTime? ReviewedAtUtc,
    string? DecisionReason,
    string? InternalNotes,
    byte[] RowVersion,
    IReadOnlyList<RentPaymentAccessAuditEventDto> AuditEvents);
```

Do not expose `InternalNotes` to organization endpoints.

### Step 4: Make the model tests pass

Run the Step 1 command. Expected: PASS.

### Step 5: Commit

```powershell
git add property-peace-api/Models/RentPaymentAccessRequest.cs property-peace-api/Models/RentPaymentAccessAuditEvent.cs property-peace-api/Configurations/RentPaymentAccessRequestConfiguration.cs property-peace-api/Configurations/RentPaymentAccessAuditEventConfiguration.cs property-peace-api/Data/DataContext.cs property-peace-api/Dtos/RentPaymentAccess/RentPaymentAccessDtos.cs property-peace-api.Tests/Models/RentPaymentAccessModelTests.cs
git commit -m "feat: add rent payment access approval domain"
```

---

## Task 2: Implement transition rules with organization isolation and idempotency

**Files:**

- Create: `property-peace-api/Services/RentPaymentAccess/IRentPaymentAccessService.cs`
- Create: `property-peace-api/Services/RentPaymentAccess/RentPaymentAccessService.cs`
- Test: `property-peace-api.Tests/Services/RentPaymentAccess/RentPaymentAccessServiceTests.cs`

### Step 1: Write failing service tests

Cover:

- first request creates `Pending` and one audit event;
- requesting while `Pending` returns the same request without another audit event;
- requesting while `Approved` is idempotent and does not regress status;
- a rejected request may be explicitly resubmitted and transitions to `Pending` with a new requested timestamp and audit event;
- a suspended request cannot be self-resubmitted;
- approval is allowed from `Pending` only;
- rejection is allowed from `Pending` only and requires a user-safe reason;
- suspension is allowed from `Approved` and `Pending` and requires a reason;
- a stale row version returns a conflict result;
- organization access reads only the requested organization;
- no row maps to the synthetic `NotRequested` DTO.

Run:

```powershell
dotnet test property-peace-api.Tests/property-peace-api.Tests.csproj --filter FullyQualifiedName~RentPaymentAccessServiceTests
```

Expected: FAIL because the service does not exist.

### Step 2: Define the service contract

```csharp
public interface IRentPaymentAccessService
{
    Task<RentPaymentAccessDto> GetForOrganizationAsync(int organizationId, CancellationToken cancellationToken);
    Task<RentPaymentAccessDto> RequestAsync(int organizationId, int actorUserId, CancellationToken cancellationToken);
    Task<IReadOnlyList<RentPaymentAccessListItemDto>> ListForAdminAsync(string? status, CancellationToken cancellationToken);
    Task<RentPaymentAccessAdminDetailDto?> GetForAdminAsync(Guid publicId, CancellationToken cancellationToken);
    Task<RentPaymentAccessAdminDetailDto> ApproveAsync(Guid publicId, int actorUserId, ReviewRentPaymentAccessRequestDto review, CancellationToken cancellationToken);
    Task<RentPaymentAccessAdminDetailDto> RejectAsync(Guid publicId, int actorUserId, ReviewRentPaymentAccessRequestDto review, CancellationToken cancellationToken);
    Task<RentPaymentAccessAdminDetailDto> SuspendAsync(Guid publicId, int actorUserId, ReviewRentPaymentAccessRequestDto review, CancellationToken cancellationToken);
}
```

Add typed exceptions/results for not found, invalid transition, validation, and concurrency conflict. Controllers must map them to 404, 409, 400, and 409 respectively without exposing internal details.

### Step 3: Implement transactional transitions

For every mutation:

1. Load by organization ID or public ID.
2. Validate the allowed prior state and row version.
3. Mutate the current row.
4. Append an audit event in the same database transaction.
5. Save once and return the mapped DTO.

Use UTC from an injected clock/time provider already used in the repository; if none exists, inject `TimeProvider` and register `TimeProvider.System`.

For a first request, catch the unique organization constraint race, reload, and return the winning `Pending` or `Approved` record. Do not send duplicate email from the losing request.

### Step 4: Make service tests pass

Run the Step 1 command. Expected: PASS.

### Step 5: Commit

```powershell
git add property-peace-api/Services/RentPaymentAccess property-peace-api.Tests/Services/RentPaymentAccess
git commit -m "feat: implement rent payment access transitions"
```

---

## Task 3: Reuse the existing admin notification cohort

**Files:**

- Create: `property-peace-api/Services/RentPaymentAccess/IRentPaymentAccessNotificationService.cs`
- Create: `property-peace-api/Services/RentPaymentAccess/RentPaymentAccessNotificationService.cs`
- Modify: `property-peace-api/Services/RentPaymentAccess/RentPaymentAccessService.cs`
- Test: `property-peace-api.Tests/Services/RentPaymentAccess/RentPaymentAccessNotificationServiceTests.cs`
- Test: `property-peace-api.Tests/Services/RentPaymentAccess/RentPaymentAccessServiceTests.cs`

### Step 1: Write failing notification tests

Verify the notifier:

- calls `GetAdminUsersAsync()`;
- gets/creates each admin's notification settings using the same path as `UserService.NotifyAdminsAboutNewUserAsync`;
- sends only to admins whose `AdminNewUserNotifications.Email` is enabled;
- targets the same resolved email address as new-user signup notifications;
- uses subject `Online rent collection request`;
- includes organization name, requester identity, requested time, and an absolute review URL ending `/admin/rent-payment-access/{publicId}`;
- labels the button `Review rent-payment request`;
- does not include an approval mutation URL or secret approval token;
- continues across one recipient failure and returns a delivery summary suitable for logging.

Run:

```powershell
dotnet test property-peace-api.Tests/property-peace-api.Tests.csproj --filter FullyQualifiedName~RentPaymentAccessNotificationServiceTests
```

Expected: FAIL.

### Step 2: Define and implement the notifier

```csharp
public sealed record RentPaymentAccessNotificationResult(int Attempted, int Accepted, int Failed);

public interface IRentPaymentAccessNotificationService
{
    Task<RentPaymentAccessNotificationResult> NotifyReviewersAsync(
        RentPaymentAccessAdminDetailDto request,
        CancellationToken cancellationToken);
}
```

Use the configured main-app base URL already used for frontend links. Normalize it once and URL-encode only route values. Submit through the existing email/notification abstraction with a stable idempotency token such as `rent-payment-access:{publicId}:pending:{requestedAtTicks}`.

Do not invent a second administrator email setting. The routing cohort must remain `GetAdminUsersAsync` plus `AdminNewUserNotifications.Email`.

### Step 3: Persist before notifying

In `RequestAsync`, commit the `Pending` row and audit event before invoking the notifier. Invoke it only for a newly created request or an explicit rejected-to-pending resubmission; an idempotent repeat while Pending/Approved does not send another email. Treat notification failure as an operational warning, not a transaction failure. Log public ID, organization ID, attempted/accepted/failed counts; never log addresses or message bodies.

Return the durable `Pending` DTO even if all email submissions fail.

### Step 4: Make tests pass

Run:

```powershell
dotnet test property-peace-api.Tests/property-peace-api.Tests.csproj --filter "FullyQualifiedName~RentPaymentAccessNotificationServiceTests|FullyQualifiedName~RentPaymentAccessServiceTests"
```

Expected: PASS.

### Step 5: Commit

```powershell
git add property-peace-api/Services/RentPaymentAccess property-peace-api.Tests/Services/RentPaymentAccess
git commit -m "feat: notify admins of rent payment access requests"
```

---

## Task 4: Add organization and admin endpoints

**Files:**

- Create: `property-peace-api/Controllers/RentPaymentAccessController.cs`
- Create: `property-peace-api/Controllers/AdminRentPaymentAccessController.cs`
- Test: `property-peace-api.Tests/Controllers/RentPaymentAccessControllerTests.cs`
- Test: `property-peace-api.Tests/Controllers/AdminRentPaymentAccessControllerTests.cs`

### Step 1: Write failing controller tests

Organization controller tests:

- active Owner and Manager can `GET /api/rent-payment-access` and `POST /api/rent-payment-access/requests` for the active organization;
- tenant, inactive membership, or cross-organization request is forbidden;
- organization ID is resolved from trusted user context, not accepted from the request body;
- duplicate POST is 200 with current state rather than creating another request.

Admin controller tests:

- only platform admins can list/detail/review;
- the email landing GET detail is read-only;
- approval, rejection, and suspension are authenticated POST actions;
- invalid transition and stale row version return 409;
- missing public ID returns 404;
- internal notes never appear in organization responses.

Run:

```powershell
dotnet test property-peace-api.Tests/property-peace-api.Tests.csproj --filter "FullyQualifiedName~RentPaymentAccessControllerTests|FullyQualifiedName~AdminRentPaymentAccessControllerTests"
```

Expected: FAIL.

### Step 2: Add organization endpoints

Implement:

```text
GET  /api/rent-payment-access
POST /api/rent-payment-access/requests
```

Use `IOrganizationAuthorityResolver.ResolveActiveMemberAsync` and existing organization-role conventions. Require Owner or Manager. The POST body is empty; actor and organization come from authenticated context.

### Step 3: Add admin endpoints

Implement:

```text
GET  /api/admin/rent-payment-access/requests?status={optional}
GET  /api/admin/rent-payment-access/requests/{publicId}
POST /api/admin/rent-payment-access/requests/{publicId}/approve
POST /api/admin/rent-payment-access/requests/{publicId}/reject
POST /api/admin/rent-payment-access/requests/{publicId}/suspend
```

All mutation routes require `ReviewRentPaymentAccessRequestDto`, including `RowVersion`. Require a decision reason for reject/suspend. Permit an optional internal note for all reviews.

### Step 4: Make tests pass

Run the Step 1 command. Expected: PASS.

### Step 5: Commit

```powershell
git add property-peace-api/Controllers/RentPaymentAccessController.cs property-peace-api/Controllers/AdminRentPaymentAccessController.cs property-peace-api.Tests/Controllers/RentPaymentAccessControllerTests.cs property-peace-api.Tests/Controllers/AdminRentPaymentAccessControllerTests.cs
git commit -m "feat: expose rent payment access review endpoints"
```

---

## Task 5: Add action-specific readiness composition

**Files:**

- Create: `property-peace-api/Services/RentPaymentAccess/RentPaymentAction.cs`
- Create: `property-peace-api/Services/RentPaymentAccess/IRentPaymentActionReadinessService.cs`
- Create: `property-peace-api/Services/RentPaymentAccess/RentPaymentActionReadinessService.cs`
- Create: `property-peace-api/Filters/RequireRentPaymentActionReadyAttribute.cs`
- Modify: `property-peace-api/Services/FeatureReadiness/FeatureReadinessService.cs`
- Test: `property-peace-api.Tests/Services/RentPaymentAccess/RentPaymentActionReadinessServiceTests.cs`
- Test: `property-peace-api.Tests/Filters/RequireRentPaymentActionReadyAttributeTests.cs`
- Modify test: `property-peace-api.Tests/Services/FeatureReadiness/FeatureReadinessServiceTests.cs`

### Step 1: Write the readiness truth-table tests

Use these actions:

```csharp
public enum RentPaymentAction
{
    RequestAccess,
    Configure,
    Pay,
    Transfer
}
```

Test this matrix:

| Condition | RequestAccess | Configure | Pay | Transfer |
|---|---:|---:|---:|---:|
| global provider disabled | allowed for Owner/Manager | blocked | blocked | blocked |
| no access row | allowed for Owner/Manager | blocked | blocked | blocked |
| Pending | blocked as duplicate/no-op | blocked | blocked | blocked |
| Rejected | allowed for explicit resubmission | blocked | blocked | blocked |
| Suspended | blocked | blocked | blocked | blocked |
| Approved, provider configured | n/a | allowed for Owner/Manager | depends on payee/tenant checks | depends on payee + transfer flag |
| Approved, payee not approved/ready | n/a | onboarding/status only | blocked | blocked |
| Approved, payee approved/ready | n/a | allowed | allowed for authorized tenant lease | depends on transfer flag |
| transfer flag false | unaffected | unaffected | unaffected | blocked |

Also assert blockers are stable machine-readable codes, not UI prose:

```text
provider_disabled
access_not_requested
access_pending
access_rejected
access_suspended
access_not_approved
connected_payee_missing
connected_payee_under_review
connected_payee_not_ready
transfers_disabled
actor_not_authorized
```

### Step 2: Define the readiness result

```csharp
public sealed record RentPaymentActionReadiness(
    RentPaymentAction Action,
    bool Allowed,
    string AccessStatus,
    bool ProviderEnabled,
    bool OrganizationApproved,
    bool ConnectedPayeeApproved,
    bool ConnectedPayeeReady,
    bool TransfersEnabled,
    IReadOnlyList<string> Blockers);

public interface IRentPaymentActionReadinessService
{
    Task<RentPaymentActionReadiness> EvaluateAsync(
        int userId,
        int organizationId,
        RentPaymentAction action,
        CancellationToken cancellationToken);
}
```

The service composes existing authorization and payee services. It does not replace lease/tenant/payment validation inside `StripeRentPaymentService`; it is an outer gate.

### Step 3: Implement the action attribute/filter

`RequireRentPaymentActionReadyAttribute` resolves the active organization and actor and returns the repository's standard forbidden/unavailable response with blocker codes. It must fail closed on missing context or service error.

Do not use it for `RequestAccess`; the request controller has its own Owner/Manager authorization and is intentionally available while the provider flag is off.

### Step 4: Correct aggregate feature readiness

Remove the forced `OnlineRentCollection => Suspended` override and Premium/pilot-allowlist organization assumption. The aggregate result should summarize the actual access state for presentation, while action endpoints use the new action service.

Preserve the global provider flag and provider-secret checks. A missing secret or false flag remains unavailable.

### Step 5: Run tests

```powershell
dotnet test property-peace-api.Tests/property-peace-api.Tests.csproj --filter "FullyQualifiedName~RentPaymentActionReadiness|FullyQualifiedName~RequireRentPaymentActionReady|FullyQualifiedName~FeatureReadinessServiceTests"
```

Expected: PASS.

### Step 6: Commit

```powershell
git add property-peace-api/Services/RentPaymentAccess property-peace-api/Filters/RequireRentPaymentActionReadyAttribute.cs property-peace-api/Services/FeatureReadiness/FeatureReadinessService.cs property-peace-api.Tests/Services/RentPaymentAccess property-peace-api.Tests/Filters/RequireRentPaymentActionReadyAttributeTests.cs property-peace-api.Tests/Services/FeatureReadiness/FeatureReadinessServiceTests.cs
git commit -m "feat: gate rent payment actions by approval and readiness"
```

---

## Task 6: Apply action gates to Stripe endpoints

**Files:**

- Modify: `property-peace-api/Controllers/StripeController.cs`
- Modify tests: `property-peace-api.Tests/Controllers/StripeControllerSecurityTests.cs`
- Modify tests: `property-peace-api.Tests/Services/FeatureReadiness/ProviderEndpointReadinessTests.cs`
- Modify tests: `property-peace-api.Tests/Services/StripeRentPayments/StripeRentPaymentFlowTests.cs`

### Step 1: Write failing endpoint-policy tests

Classify endpoints explicitly:

- connected-account create/status/account-link/login-link/account-session/sync-bank-account: `Configure`;
- tenant setup intent and create/update rent PaymentIntent: `Pay`;
- any transfer/release endpoint or job: `Transfer`.

Assert:

- an unapproved organization cannot call configure endpoints even if Stripe is globally enabled;
- an approved organization can onboard before connected-payee approval;
- a tenant cannot create or update payment intents until both organization approval and connected-payee approval/readiness pass;
- an organization from another lease cannot cross the boundary;
- transfer release is blocked independently when transfers are false;
- existing inner `EnsureCollectionPayeeEligibleAsync`, lease tenant checks, amount validation, operation idempotency, and risk checks still execute.

### Step 2: Replace generic endpoint attributes where needed

Apply `RequireRentPaymentActionReady` with the correct action. Keep `RequireFeatureReady` for unrelated features.

Do not remove validation from `StripeRentPaymentService`. Defense in depth is intentional.

### Step 3: Run tests

```powershell
dotnet test property-peace-api.Tests/property-peace-api.Tests.csproj --filter "FullyQualifiedName~StripeControllerSecurityTests|FullyQualifiedName~ProviderEndpointReadinessTests|FullyQualifiedName~StripeRentPaymentFlowTests"
```

Expected: PASS.

### Step 4: Commit

```powershell
git add property-peace-api/Controllers/StripeController.cs property-peace-api.Tests/Controllers/StripeControllerSecurityTests.cs property-peace-api.Tests/Services/FeatureReadiness/ProviderEndpointReadinessTests.cs property-peace-api.Tests/Services/StripeRentPayments/StripeRentPaymentFlowTests.cs
git commit -m "feat: enforce rent payment action readiness"
```

---

## Task 7: Move online rent payments into Free packaging

**Files:**

- Modify: `property-peace-api/Services/SubscriptionService/FeatureGateService.cs`
- Modify: `property-peace-api/Data/SubscriptionPlanSeeder.cs`
- Modify tests: `property-peace-api.Tests/Services/SubscriptionService/FreePackagingContractTests.cs`
- Modify tests: `property-peace-api.Tests/Services/SubscriptionService/FeatureGateOrganizationIsolationTests.cs`

### Step 1: Write failing packaging tests

Assert:

- `OnlineRentCollection` is not in the Premium-only feature set;
- the Free plan advertises online rent payments with approval required;
- Premium still owns Percy and SMS benefits;
- Free entitlement does not bypass organization approval or global provider readiness;
- feature decisions remain organization-isolated.

### Step 2: Update the gate and seed data

Remove `OnlineRentCollection` from Premium-only gates. Add `Online rent payments (approval required)` to Free feature JSON. Remove any contradictory Premium-only copy or duplicate feature claim.

Do not change existing customer subscriptions or prices in this task.

### Step 3: Run tests

```powershell
dotnet test property-peace-api.Tests/property-peace-api.Tests.csproj --filter "FullyQualifiedName~FreePackagingContractTests|FullyQualifiedName~FeatureGateOrganizationIsolationTests"
```

Expected: PASS.

### Step 4: Commit

```powershell
git add property-peace-api/Services/SubscriptionService/FeatureGateService.cs property-peace-api/Data/SubscriptionPlanSeeder.cs property-peace-api.Tests/Services/SubscriptionService/FreePackagingContractTests.cs property-peace-api.Tests/Services/SubscriptionService/FeatureGateOrganizationIsolationTests.cs
git commit -m "feat: include online rent payments in free plan"
```

---

## Task 8: Register services and create the migration

**Files:**

- Modify: `property-peace-api/Program.cs`
- Create: `property-peace-api/Migrations/<timestamp>_AddRentPaymentAccessApproval.cs`
- Create: `property-peace-api/Migrations/<timestamp>_AddRentPaymentAccessApproval.Designer.cs`
- Modify: `property-peace-api/Migrations/DataContextModelSnapshot.cs`
- Test: `property-peace-api.Tests/Data/RentPaymentAccessMigrationTests.cs`

### Step 1: Register services

Register the access service, notifier, readiness service, and any repository dependencies using lifetimes consistent with `DataContext`. Register `TimeProvider.System` only if the project does not already provide a clock.

### Step 2: Generate the migration

```powershell
dotnet ef migrations add AddRentPaymentAccessApproval --project property-peace-api --startup-project property-peace-api
```

Inspect the generated migration. It must create the current-state and audit tables, unique public/organization indexes, foreign keys, and row-version column. It must not update existing organizations to Approved.

### Step 3: Add and run migration tests

Assert that an organization with no row remains denied and that unique indexes prevent duplicate current-state rows.

```powershell
dotnet test property-peace-api.Tests/property-peace-api.Tests.csproj --filter FullyQualifiedName~RentPaymentAccessMigrationTests
```

Expected: PASS.

### Step 4: Commit

```powershell
git add property-peace-api/Program.cs property-peace-api/Migrations property-peace-api.Tests/Data/RentPaymentAccessMigrationTests.cs
git commit -m "feat: migrate rent payment access approvals"
```

---

## Task 9: Backend verification and security review

### Step 1: Run focused tests

```powershell
dotnet test property-peace-api.Tests/property-peace-api.Tests.csproj --filter "FullyQualifiedName~RentPaymentAccess|FullyQualifiedName~FeatureReadiness|FullyQualifiedName~StripeControllerSecurity|FullyQualifiedName~ProviderEndpointReadiness|FullyQualifiedName~FreePackagingContract"
```

Expected: PASS.

### Step 2: Run the entire API suite

```powershell
dotnet test property-peace-api.Tests/property-peace-api.Tests.csproj
```

Expected: PASS.

### Step 3: Inspect dangerous contract regressions

```powershell
rg -n "approve.*HttpGet|HttpGet.*approve|OnlineRentCollection.*Premium|RentPaymentsEnabled.*true|TransfersEnabled.*true" property-peace-api property-peace-api.Tests
```

Expected: no state-changing GET approval, Premium-only entitlement, or true-by-default provider/transfer settings.

### Step 4: Review changed code

Confirm:

- controller bodies never trust organization IDs from clients;
- admin email links do not mutate;
- notification failures do not delete Pending requests;
- every state mutation writes an audit event transactionally;
- concurrency conflicts return 409;
- no internal notes or PII appear in logs or organization DTOs;
- request permission and configure/pay/transfer permission remain separate.

### Step 5: Commit any verification corrections

```powershell
git add property-peace-api property-peace-api.Tests
git commit -m "test: harden rent payment approval workflow"
```


