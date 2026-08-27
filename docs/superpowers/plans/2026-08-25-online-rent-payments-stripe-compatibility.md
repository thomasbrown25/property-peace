# Online Rent Payments — Stripe Compatibility Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan.

**Goal:** Bring the existing Stripe rent-payment integration to a production-verifiable SDK/API shape without weakening its separate-charge-and-transfer safeguards, payment holds, idempotency, webhook handling, refunds, disputes, reversals, or risk controls.

**Architecture:** First run a hard compatibility gate against Stripe's current stable .NET SDK and the platform account's actual Accounts v2 access. Then replace global API-key configuration with injected `StripeClient`, isolate recipient-account operations behind a gateway, use dynamically configured PaymentIntent methods, and preserve the existing domain service as the authority for lease/payment/payee rules.

**Tech Stack:** Stripe.net, ASP.NET Core DI/options, Stripe Accounts v2, PaymentIntents, webhooks, xUnit.

**Official implementation references:**

- Accounts v2: `https://docs.stripe.com/connect/accounts-v2`
- Dynamic payment methods: `https://docs.stripe.com/payments/payment-methods/dynamic-payment-methods?payment-ui=payment-element`
- Stripe .NET SDK: `https://github.com/stripe/stripe-dotnet`

**Production gate:** The current Accounts v2 documentation may require a preview API version and account enablement. If typed recipient-account creation and onboarding cannot be verified in the actual Stripe sandbox/platform account, complete only the fail-closed code paths and keep `Stripe:RentPaymentsEnabled=false`. Do not substitute legacy Express onboarding merely to make the launch look complete.

---

## Task 1: Resolve the SDK and Accounts v2 compatibility gate

**Files:**

- Modify: `property-peace-api/property-peace-api.csproj`
- Create: `docs/security/STRIPE_CONNECT_ROLLOUT_RUNBOOK.md`
- Test: `property-peace-api.Tests/Services/StripeRentPayments/StripeSdkCompatibilityTests.cs`

### Step 1: Establish the current baseline

Run:

```powershell
dotnet list property-peace-api/property-peace-api.csproj package
dotnet list property-peace-api/property-peace-api.csproj package --outdated
```

Record the installed Stripe.net version and the current stable, non-prerelease version in the runbook. The repository baseline is expected to be 47.0.0; verify rather than assuming.

### Step 2: Verify typed Accounts v2 support before editing production code

In an isolated test branch/commit, update only Stripe.net to the current stable non-prerelease version and restore:

```powershell
dotnet add property-peace-api/property-peace-api.csproj package Stripe.net
dotnet restore property-peace-api/property-peace-api.csproj
dotnet list property-peace-api/property-peace-api.csproj package
```

With no `--prerelease` option, `dotnet add package` resolves the latest stable version from the configured NuGet sources. Confirm the resolved Stripe.net version has no alpha/beta/preview suffix, matches the current stable release shown by the official Stripe .NET repository, and record that concrete version in the project file and runbook.

Compile a test that references the SDK's typed Accounts v2 client and recipient configuration types. Use the exact type names exposed by the selected stable SDK; the expected current family is `StripeClient.V2.Core.Accounts` and `V2.Core.AccountCreateOptions`.

### Step 3: Verify platform API access in Stripe sandbox

Using the project's configured sandbox credentials without printing them, perform a non-destructive typed retrieval or create/delete only a clearly labeled test recipient if deletion is supported and the user/account policy permits it. Confirm:

- the API version required by Accounts v2 is accepted;
- `configuration.recipient` is available;
- `configuration.recipient.capabilities.stripe_balance.stripe_transfers.status` is returned;
- an account link/session can be generated for the recipient onboarding flow used by the app;
- webhook event payloads needed by the integration can be consumed with the chosen API version.

If credentials or Accounts v2 preview access are unavailable, mark the gate `BLOCKED` in the runbook, skip live provider activation, and continue implementing approval/UI behind false flags.

Never write API keys or response bodies containing identity/bank data to the runbook.

### Step 4: Add a compile-time compatibility test

The test must instantiate or mock the selected typed client interfaces and assert the account snapshot mapper recognizes recipient configuration and Stripe-balance transfer capability status. It is a compile-time tripwire for accidental regression to v1 Express-only fields.

Run:

```powershell
dotnet test property-peace-api.Tests/property-peace-api.Tests.csproj --filter FullyQualifiedName~StripeSdkCompatibilityTests
```

Expected: PASS only if the selected stable SDK supports the required typed API.

### Step 5: Commit

```powershell
git add property-peace-api/property-peace-api.csproj property-peace-api.Tests/Services/StripeRentPayments/StripeSdkCompatibilityTests.cs docs/security/STRIPE_CONNECT_ROLLOUT_RUNBOOK.md
git commit -m "build: validate Stripe Accounts v2 compatibility"
```

---

## Task 2: Replace global Stripe configuration with injected clients

**Files:**

- Modify: `property-peace-api/Program.cs`
- Modify: `property-peace-api/Services/StripeService/StripeService.cs`
- Modify: `property-peace-api/Services/StripeService/StripeSyncService.cs`
- Modify: `property-peace-api/Services/StripeRentPayments/StripeRentGateway.cs`
- Modify: `property-peace-api/Services/StripeRentPayments/StripeConnectedAccountGateway.cs`
- Modify related interfaces in: `property-peace-api/Services/StripeRentPayments/`
- Test: `property-peace-api.Tests/Services/StripeRentPayments/StripeClientInjectionTests.cs`

### Step 1: Write failing injection tests

Assert:

- every Stripe service receives an `IStripeClient`/`StripeClient` dependency;
- services do not assign `StripeConfiguration.ApiKey`;
- missing secret configuration fails validation at startup or returns provider-unavailable through readiness, never at an arbitrary payment call;
- tests can provide a fake client without touching global process state.

Run:

```powershell
dotnet test property-peace-api.Tests/property-peace-api.Tests.csproj --filter FullyQualifiedName~StripeClientInjectionTests
```

Expected: FAIL against the global-key implementation.

### Step 2: Register a single configured client

Bind existing Stripe options. Register the selected SDK client using the secret from configuration and the chosen account/API version settings. Keep option validation free of secret logging.

Prefer an adapter where v1 and v2 clients differ so application services depend on project-owned interfaces, not global statics.

### Step 3: Refactor all services

Replace `new *Service()` instances that implicitly use global configuration with service instances constructed from the injected client. Remove every `StripeConfiguration.ApiKey = ...` assignment.

Run:

```powershell
rg -n "StripeConfiguration\.ApiKey|new StripeClient\(" property-peace-api
```

Expected: no global assignment; any direct client construction exists only in the DI composition root.

### Step 4: Make tests pass

Run the Step 1 command. Expected: PASS.

### Step 5: Commit

```powershell
git add property-peace-api/Program.cs property-peace-api/Services/StripeService property-peace-api/Services/StripeRentPayments property-peace-api.Tests/Services/StripeRentPayments/StripeClientInjectionTests.cs
git commit -m "refactor: inject Stripe clients"
```

---

## Task 3: Introduce a recipient-account gateway and Accounts v2 mapper

**Files:**

- Create: `property-peace-api/Services/StripeRentPayments/IStripeRecipientAccountGateway.cs`
- Create: `property-peace-api/Services/StripeRentPayments/StripeRecipientAccountGateway.cs`
- Create: `property-peace-api/Services/StripeRentPayments/StripeRecipientAccountModels.cs`
- Modify: `property-peace-api/Services/StripeService/StripeService.cs`
- Modify: `property-peace-api/Services/StripeRentPayments/StripeConnectedAccountGateway.cs`
- Modify: `property-peace-api/Services/StripeRentPayments/StripeConnectedPayeeService.cs`
- Test: `property-peace-api.Tests/Services/StripeRentPayments/StripeRecipientAccountGatewayTests.cs`
- Create: `property-peace-api.Tests/Services/StripeRentPayments/StripeConnectedPayeeServiceTests.cs`

### Step 1: Write failing mapper and gateway tests

Cover:

- recipient creation requests `configuration.recipient` and the Stripe-balance transfer capability;
- readiness maps the capability status, onboarding requirements, and identity/business verification without reading v1 `ChargesEnabled`/`PayoutsEnabled` as the source of truth;
- missing or inactive `stripe_transfers` capability is not ready;
- account links/sessions belong to the requested organization account;
- the gateway never accepts an organization-selected arbitrary Stripe account ID;
- existing platform payee review remains required after provider onboarding.

### Step 2: Add project-owned contract

```csharp
public sealed record StripeRecipientAccountCreateCommand(
    int OrganizationId,
    string ContactEmail,
    string ReturnUrl,
    string RefreshUrl);

public sealed record StripeRecipientAccountSnapshot(
    string AccountId,
    bool DetailsSubmitted,
    bool RecipientConfigurationActive,
    string StripeTransfersStatus,
    IReadOnlyList<string> CurrentlyDue,
    IReadOnlyList<string> EventuallyDue,
    string? DisabledReason);

public interface IStripeRecipientAccountGateway
{
    Task<StripeRecipientAccountSnapshot> CreateRecipientAsync(
        StripeRecipientAccountCreateCommand command,
        CancellationToken cancellationToken);
    Task<StripeRecipientAccountSnapshot> GetRecipientAsync(
        string accountId,
        CancellationToken cancellationToken);
    Task<string> CreateOnboardingLinkAsync(
        string accountId,
        string returnUrl,
        string refreshUrl,
        CancellationToken cancellationToken);
}
```

Adjust only the URL return type if the selected SDK exposes a richer value; keep the project-owned semantics unchanged.

### Step 3: Implement using typed Accounts v2

Use the exact SDK types proven in Task 1. Attach organization identity through safe metadata or an internal persisted mapping, but never trust metadata alone for authorization. Persist the provider account ID on the existing organization/payee record under existing uniqueness rules.

Do not create v1 `AccountCreateOptions { Type = "express" }` in the new path.

### Step 4: Adapt connected-payee readiness

Map provider onboarding state into the existing connected-payee domain, then preserve the separate internal review state:

```text
organization access Approved
AND recipient onboarding complete/capability active
AND StripeConnectedPayeeReview Approved
= eligible for tenant payment readiness
```

The provider capability does not auto-approve the internal payee review.

### Step 5: Run tests

```powershell
dotnet test property-peace-api.Tests/property-peace-api.Tests.csproj --filter "FullyQualifiedName~StripeRecipientAccountGatewayTests|FullyQualifiedName~StripeConnectedPayeeServiceTests"
```

Expected: PASS.

### Step 6: Commit

```powershell
git add property-peace-api/Services/StripeRentPayments property-peace-api/Services/StripeService/StripeService.cs property-peace-api.Tests/Services/StripeRentPayments
git commit -m "feat: use Stripe recipient accounts for onboarding"
```

---

## Task 4: Use dynamic payment methods for setup and payment intents

**Files:**

- Modify: `property-peace-api/Services/StripeRentPayments/StripeRentGateway.cs`
- Modify in: `property-peace-api/Services/StripeRentPayments/StripeRentGateway.cs` (`StripeRentPaymentMethodPolicy`)
- Modify: `property-peace-api/Controllers/StripeController.cs`
- Modify: `property-peace-api/Dtos/Stripe/` relevant response DTOs
- Modify tests: `property-peace-api.Tests/Services/StripeRentPayments/StripeRentPaymentMethodPolicyTests.cs`
- Create: `property-peace-api.Tests/Services/StripeRentPayments/StripeRentGatewayTests.cs`
- Modify tests: `property-peace-api.Tests/Controllers/StripeControllerSecurityTests.cs`

### Step 1: Write failing intent-creation tests

Assert:

- rent PaymentIntent creation does not set a hard-coded `PaymentMethodTypes` list;
- setup intent creation does not set a hard-coded list unless a verified Stripe constraint requires it and the runbook records why;
- the selected payment-method configuration is supplied if the account uses explicit configurations;
- API responses advertise only methods actually enabled for the environment/account;
- webhook classification and hold selection still distinguish card from US bank account;
- an unknown method fails closed for hold/release decisions.

### Step 2: Remove creation-time hard coding

Use Stripe's dynamic payment-method behavior or a named payment-method configuration. Keep `StripeRentPaymentMethodPolicy` for post-creation classification, risk, and hold rules; do not use it to claim methods are enabled merely because the application knows their names.

### Step 3: Expose verified capabilities to clients

Return a safe capability list such as `card` and `us_bank_account` only after it is confirmed by provider configuration. The frontend must consume this list rather than rendering unsupported choices.

### Step 4: Run tests

```powershell
dotnet test property-peace-api.Tests/property-peace-api.Tests.csproj --filter "FullyQualifiedName~StripeRentPaymentMethodPolicyTests|FullyQualifiedName~StripeRentGatewayTests|FullyQualifiedName~StripeControllerSecurityTests"
```

Expected: PASS.

### Step 5: Commit

```powershell
git add property-peace-api/Services/StripeRentPayments property-peace-api/Controllers/StripeController.cs property-peace-api/Dtos/Stripe property-peace-api.Tests/Services/StripeRentPayments property-peace-api.Tests/Controllers/StripeControllerSecurityTests.cs
git commit -m "feat: use dynamic methods for rent payments"
```

---

## Task 5: Revalidate existing collection safety controls

**Files:**

- Modify tests: `property-peace-api.Tests/Services/StripeRentPayments/StripeRentPaymentFlowTests.cs`
- Create: `property-peace-api.Tests/Services/StripeRentPayments/StripeRentPaymentSafetyRegressionTests.cs`
- Modify tests: `property-peace-api.Tests/Services/StripeRentPayments/StripeWebhookRentOrchestrationTests.cs`
- Modify tests: `property-peace-api.Tests/Services/StripeRentPayments/StripeRentTransferTests.cs`
- Modify implementation files under: `property-peace-api/Services/StripeRentPayments/` only where a failing regression test requires it

### Step 1: Add/refresh regression tests

Verify these unchanged business controls after the SDK migration:

- card payments retain a 7-day hold;
- ACH payments retain a 14-day hold;
- duplicate webhook delivery is idempotent;
- duplicate client operation IDs do not create duplicate PaymentIntents;
- refunds, disputes, reversals, and failed payments update the ledger safely;
- risk checks execute before collection/release;
- a transfer cannot be created before the hold expires;
- `Stripe:TransfersEnabled=false` blocks release even after the hold expires;
- transfer destination is the internally resolved approved payee, never a request-body account ID;
- cross-organization leases, tenants, and payees remain forbidden.

### Step 2: Run the regression slice

```powershell
dotnet test property-peace-api.Tests/property-peace-api.Tests.csproj --filter "FullyQualifiedName~StripeRentPaymentFlowTests|FullyQualifiedName~StripeRentPaymentSafetyRegressionTests|FullyQualifiedName~StripeWebhookRentOrchestrationTests|FullyQualifiedName~StripeWebhookRefundTests|FullyQualifiedName~StripeRentLossAccountingTests|FullyQualifiedName~StripeRentTransferTests"
```

Expected: PASS. If repository test class names differ, use `dotnet test --list-tests` to select the existing equivalent classes; do not omit any listed behavior.

### Step 3: Fix only proven regressions

Keep fixes minimal and inside the existing payment domain. Do not shorten holds, default transfer flags true, or bypass the connected-payee review to satisfy tests.

### Step 4: Commit

```powershell
git add property-peace-api/Services/StripeRentPayments property-peace-api.Tests/Services/StripeRentPayments
git commit -m "test: preserve rent payment safety controls"
```

---

## Task 6: Harden secrets and operational configuration

**Files:**

- Modify: `property-peace-api/appsettings.json`
- Modify: `property-peace-api/appsettings.Development.json` only for non-secret false defaults if present
- Modify: `docs/security/STRIPE_CONNECT_ROLLOUT_RUNBOOK.md`
- Modify tests: `property-peace-api.Tests/Services/FeatureReadiness/FeatureReadinessServiceTests.cs`

### Step 1: Assert fail-closed defaults

Tests must prove:

- absent or false `RentPaymentsEnabled` blocks provider actions;
- absent or false `TransfersEnabled` blocks transfers;
- absent secret/provider configuration blocks collection;
- neither application settings file contains a live secret or a true production default.

### Step 2: Document secret handling

The runbook must require Azure Key Vault/App Service secret references for Stripe keys and webhook secrets, least-privilege restricted keys where Stripe supports the required operations, rotation procedure, and redacted verification commands. It must explicitly forbid committing, echoing, or logging secrets.

### Step 3: Document rollback

Rollback order:

1. set transfers false;
2. set rent payments false;
3. stop marketing live claims;
4. preserve webhooks and reconciliation access long enough to settle/refund existing payments;
5. suspend affected organizations if the incident is tenant/payee-specific.

### Step 4: Run readiness tests

```powershell
dotnet test property-peace-api.Tests/property-peace-api.Tests.csproj --filter FullyQualifiedName~FeatureReadinessServiceTests
```

Expected: PASS.

### Step 5: Commit

```powershell
git add property-peace-api/appsettings.json property-peace-api/appsettings.Development.json docs/security/STRIPE_CONNECT_ROLLOUT_RUNBOOK.md property-peace-api.Tests/Services/FeatureReadiness/FeatureReadinessServiceTests.cs
git commit -m "docs: harden Stripe rollout controls"
```

---

## Task 7: Stripe verification checkpoint

### Step 1: Static checks

```powershell
rg -n "StripeConfiguration\.ApiKey|Type\s*=\s*\"express\"|PaymentMethodTypes\s*=" property-peace-api
```

Expected: no global API-key assignment, no legacy Express account creation in the live path, and no hard-coded PaymentIntent method list.

### Step 2: Run all Stripe-related tests

```powershell
dotnet test property-peace-api.Tests/property-peace-api.Tests.csproj --filter "FullyQualifiedName~Stripe|FullyQualifiedName~RentPaymentActionReadiness"
```

Expected: PASS.

### Step 3: Build API

```powershell
dotnet build property-peace-api/property-peace-api.csproj --no-restore
```

Expected: PASS with no new warnings caused by Stripe API obsolescence.

### Step 4: Record gate status

Update the runbook compatibility table with:

- stable SDK version;
- API version/preview status;
- typed Accounts v2 compilation;
- sandbox recipient creation/onboarding;
- card intent/webhook/refund;
- ACH intent/webhook/failure/refund;
- 7/14-day hold verification;
- transfers-disabled verification;
- go-live verdict `PASS` or `BLOCKED` with a non-secret reason.

Do not mark `PASS` from unit tests alone.


