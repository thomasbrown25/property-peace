# Online Rent Payments Launch — Master Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan.

**Goal:** Launch online rent payments as a Free-plan capability that is denied per organization by default, requires an administrator approval before Stripe onboarding, and remains fail-closed until provider, payee, and action-specific readiness checks pass.

**Architecture:** Implement the approved design in four ordered workstreams. The access-approval domain is the source of truth for organization approval; Stripe integration remains responsible for provider and connected-payee readiness; the main app renders one consistent state machine; marketing is switched to live claims only through a coordinated build-time launch state. Preserve the existing separate-charge-and-transfer safety controls, payment holds, webhook idempotency, and transfer kill switch.

**Tech Stack:** ASP.NET Core, Entity Framework Core, SQL Server, Stripe.net, React/Vite, Next.js static export, xUnit, Node test runner, GitHub Actions, Azure App Service/Static Web Apps.

**Approved design:** [`docs/superpowers/specs/2026-08-25-online-rent-payments-launch-design.md`](../specs/2026-08-25-online-rent-payments-launch-design.md)

## Workstreams and required order

1. [`2026-08-25-online-rent-payments-api-approval.md`](./2026-08-25-online-rent-payments-api-approval.md) — persistence, organization request flow, admin email/review flow, action readiness, Free-plan packaging.
2. [`2026-08-25-online-rent-payments-stripe-compatibility.md`](./2026-08-25-online-rent-payments-stripe-compatibility.md) — Stripe SDK/API compatibility gate, injected client, Accounts v2 recipient onboarding, dynamic payment methods, existing safety-path regression coverage.
3. [`2026-08-25-online-rent-payments-main-app.md`](./2026-08-25-online-rent-payments-main-app.md) — landlord request/setup states, admin review workspace, tenant payment gating, Free-plan presentation.
4. [`2026-08-25-online-rent-payments-marketing-and-rollout.md`](./2026-08-25-online-rent-payments-marketing-and-rollout.md) — bespoke rent-collection page, FAQ/resources/tenant sections, claim inventory, build-time launch state, release runbook.

Workstreams 1 and 2 may be developed in separate commits, but workstream 2 cannot declare the provider production-ready until the compatibility gate passes. Workstream 3 depends on the API contracts from workstream 1. The live marketing state in workstream 4 is the last switch.

## Cross-workstream invariants

- `Stripe:RentPaymentsEnabled=false` blocks request-independent provider actions even for approved organizations.
- `Stripe:TransfersEnabled=false` blocks transfers independently of collection.
- No organization can configure Stripe or collect online rent without an `Approved` rent-payment access record.
- Tenant payment creation requires organization approval plus connected-payee approval/readiness and the existing lease/tenant/payee authorization checks.
- Email links are review links only. No state-changing GET endpoint exists.
- Failed notification delivery leaves a durable `Pending` request for administrators to find in the app.
- Online rent payments are included in Free; Percy and SMS remain Premium.
- The UI and marketing must not claim autopay, instant payouts, credit reporting, or autonomous AI execution.
- Production enablement is blocked if Accounts v2 recipient onboarding cannot be verified safely in the platform's Stripe sandbox/account.

## Integration checkpoints

### Checkpoint A — API approval domain

Run:

```powershell
dotnet test property-peace-api.Tests/property-peace-api.Tests.csproj --filter "FullyQualifiedName~RentPaymentAccess|FullyQualifiedName~FeatureReadiness|FullyQualifiedName~FreePackagingContract"
```

Expected: all targeted tests pass; migration is present; Free packaging and fail-closed defaults are asserted.

### Checkpoint B — Stripe compatibility and payment safety

Run:

```powershell
dotnet test property-peace-api.Tests/property-peace-api.Tests.csproj --filter "FullyQualifiedName~StripeRent|FullyQualifiedName~StripeController|FullyQualifiedName~StripePayee|FullyQualifiedName~RentPaymentActionReadiness"
```

Expected: all targeted tests pass; no global Stripe API key assignment or hard-coded intent payment-method list remains.

### Checkpoint C — applications

Run:

```powershell
Set-Location property-peace-app
npm run lint
npm run build
Set-Location ../property-peace-marketing
npm run lint
npm run test:marketing-claims
npm run build
```

Expected: lint, claim checks, and production builds pass. The marketing build defaults to unavailable unless the explicit launch variable is supplied.

### Checkpoint D — full repository verification

Run:

```powershell
dotnet test property-peace-api.Tests/property-peace-api.Tests.csproj
Set-Location property-peace-app
npm run lint
npm run build
Set-Location ../property-peace-marketing
npm run lint
npm run test:marketing-claims
npm run build
```

Expected: all commands exit 0. Record any unrelated pre-existing failure with the exact command and output; do not hide or weaken a test to obtain green status.

## Release order

1. Deploy schema and code with global payment and transfer flags false and marketing state unavailable.
2. Verify request, duplicate request, notification failure, review, rejection, suspension, and audit paths in a non-production environment.
3. Pass the Stripe compatibility gate and complete sandbox card/ACH, webhook, dispute, refund, and held-transfer verification.
4. Enable the provider collection flag for the environment while transfers remain false.
5. Approve only the pilot organization, finish onboarding, then complete the existing connected-payee review.
6. Run controlled card and ACH payments through the full hold period before enabling transfers separately.
7. Set the marketing build state to live and deploy marketing only after the app/API path is confirmed available.

