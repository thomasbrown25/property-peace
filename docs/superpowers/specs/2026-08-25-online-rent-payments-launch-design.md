# Online Rent Payments Approval and Launch Design

**Date:** 2026-08-25
**Status:** Approved design
**Scope:** Property Peace API, main application, marketing application, deployment configuration, notifications, tests, and operating runbook

## 1. Goal

Launch Property Peace online rent payments as a real Free-plan capability while keeping every organization disabled by default. A landlord or organization manager must request access, and an authorized Property Peace administrator must manually approve the organization before Stripe onboarding can begin.

The launch also replaces the current rent-collection marketing page with accurate live-product messaging and makes the main application expose clear request, review, onboarding, payee-review, and ready states.

## 2. Product Decisions

The following decisions are approved:

- Online rent payments are included in the Free plan.
- Access is off by default for every organization, including after the global provider is enabled.
- Landlords and authorized organization managers request access from the main application.
- The request is sent to the same administrator recipients and email destinations used for new-user signup notifications.
- An email action opens an authenticated administrator review page. The email link does not mutate state.
- An explicit administrator approval enables Stripe onboarding for that organization.
- Stripe connected-payee review remains a separate control after onboarding.
- Tenants cannot submit online payments until organization access, Stripe onboarding, connected-payee approval, provider readiness, lease authorization, and payment risk checks all pass.
- Payment collection and transfers remain independently controlled. Transfers stay disabled during the initial payment pilot.
- The existing 7-day card and 14-day ACH security holds remain in place.
- Percy remains a separate Premium/readiness-gated product. The rent-payment launch does not enable AI collections execution.
- Marketing may claim automatic payment reminders, custom late-fee support, secure bank connections, card payments, and automatic ledger tracking. It must not claim unsupported autopay, instant payouts, credit reporting, or live AI follow-up execution.

## 3. Existing Constraints

The repository already contains a hardened Stripe rent-payment implementation using platform charges followed by delayed transfers. It also contains:

- independent `Stripe:RentPaymentsEnabled` and `Stripe:TransfersEnabled` kill switches;
- Stripe webhook reconciliation and idempotency controls;
- refund, dispute, reversal, and risk handling;
- connected-payee review and organization-scoped payout approval;
- 7-day card and 14-day ACH hold policies;
- tenant Payment Element and payment-history experiences;
- landlord Stripe Connect onboarding surfaces;
- an aggregate feature-readiness system and a pilot-organization configuration list.

The current readiness implementation intentionally forces online rent collection to `Suspended`, denies tenant readiness, and treats the feature as Premium-only. Those temporary launch blocks must be replaced with the persistent approval policy described here. They must not simply be removed without an equivalent organization-scoped control.

The current Stripe boundary also contains go-live compatibility debt: Stripe.net 47, legacy global API-key configuration in shared Stripe services, v1 Express account creation, v1 readiness fields, and a hard-coded rent `payment_method_types` list. The live launch must modernize these specific boundaries before production activation.

## 4. Non-Goals

This launch does not add:

- recurring autopay;
- automated AI collection messages;
- tenant credit reporting;
- instant payouts;
- automatic transfers before the transfer pilot is approved;
- a new payment-fee or surcharge policy;
- raw banking or identity data storage in Property Peace;
- a rewrite of the existing Stripe charge, webhook, dispute, refund, or transfer architecture beyond the focused compatibility work required for go-live.

## 5. Launch Architecture

There are three independent authorization layers:

1. **Global operational state** controls whether the Property Peace deployment may call the Stripe rent-payment provider at all.
2. **Organization access approval** controls whether a specific organization may begin Stripe onboarding.
3. **Action readiness** controls whether a particular actor may configure payments, submit a tenant payment, or release a transfer.

The global kill switches always take precedence. An approved organization cannot bypass a disabled provider or disabled transfers.

```text
Landlord requests access
        |
        v
Organization request: Pending
        |
        v
Admin reviews in authenticated app
        |
        +---- Reject/Suspend ----> Access remains blocked
        |
        v
Organization request: Approved
        |
        v
Landlord completes Stripe-hosted Connect onboarding
        |
        v
Property Peace completes connected-payee review
        |
        v
Tenant payments become eligible for authorized leases
        |
        v
Stripe webhooks reconcile payment and hold status
        |
        v
Transfer requires separate global flag + hold + risk checks
```

## 6. Organization Access State

Absence of an access record is the `NotRequested` state and is denied by default.

Persist an organization-scoped rent-payment access record with these states:

- `Pending`: a request exists and awaits administrator review;
- `Approved`: Stripe onboarding may begin for the organization;
- `Rejected`: the request was declined and onboarding remains blocked;
- `Suspended`: previously available access has been administratively disabled.

The record should include at minimum:

- internal identifier and non-sequential public review identifier;
- organization ID;
- status;
- requested-by user ID and request timestamp;
- reviewed-by user ID and review timestamp;
- rejection or suspension reason when applicable;
- internal review notes;
- last status-change timestamp;
- concurrency token/row version.

Use a database constraint to prevent more than one current access record per organization. Repeat requests while `Pending` or `Approved` return the existing state rather than creating duplicates. A rejected organization may submit a new request only according to an explicit resubmission transition; the implementation must not silently overwrite the prior decision history.

Every transition must create an immutable audit event containing the organization, request, prior state, next state, actor, timestamp, and safe request metadata. Audit records must not contain Stripe secrets, bank details, tenant payment details, or email-action credentials.

## 7. Request and Approval API

Introduce an application service that owns state transitions and policy. Controllers must not update the entity directly.

Landlord/manager endpoints:

- `GET /api/rent-payment-access` returns the current organization status and presentation state.
- `POST /api/rent-payment-access/requests` creates or returns the organization's request.

Administrator endpoints:

- `GET /api/admin/rent-payment-access/requests` lists/filter requests for the review queue.
- `GET /api/admin/rent-payment-access/requests/{publicId}` returns review details.
- `POST /api/admin/rent-payment-access/requests/{publicId}/approve` approves a pending request.
- `POST /api/admin/rent-payment-access/requests/{publicId}/reject` rejects a pending request with a reason.
- `POST /api/admin/rent-payment-access/requests/{publicId}/suspend` suspends approved access with a reason.

Policy requirements:

- Request creation requires an authenticated active organization owner or manager in the canonical organization context.
- Review endpoints require an authenticated `Admin` role.
- The server resolves organization and actor authority; it never trusts client-supplied organization membership.
- Approvals are idempotent. Replaying the same approved request returns its resolved state without applying a second mutation.
- Competing reviews use optimistic concurrency and return `409 Conflict` when the submitted state is stale.
- Rejected and suspended transitions require a review reason.
- Rate-limit request creation and administrative mutation endpoints.
- The request persists even if notification delivery fails.

## 8. Email and Notification Workflow

Recipient resolution must reuse the same administrator cohort, notification preferences, and configured email destinations used by the current new-user signup notification flow. If that flow currently resolves more than one opted-in administrator, the rent-payment request follows the same behavior rather than hard-coding a personal address.

On request creation:

- create the database request first;
- create an administrator in-app notification;
- send a dedicated rent-payment access request email;
- notify the requester that the request is under review;
- log and surface delivery failure without rolling back the request.

The administrator email includes:

- organization name and ID;
- requester name and email;
- request timestamp;
- a short explanation that approval unlocks Stripe onboarding but does not approve payouts;
- a `Review rent-payment request` button.

The email button links to the authenticated admin review route using the request's public identifier. It performs no mutation with `GET`. This prevents email security scanners, preview bots, forwarded messages, and accidental opens from enabling money movement.

The review page requires an explicit confirmation action. Approval is submitted as an authenticated `POST`, records the reviewing admin, and shows the resolved result. Repeated or stale actions show the existing resolution.

On approval, rejection, or suspension, notify the requester by email and in-app notification. Approval messaging directs the landlord to Stripe-hosted onboarding. Rejection and suspension messaging uses the administrator's user-safe reason and does not expose internal risk notes.

If no administrator recipient is available or email delivery fails, the pending request remains visible in the admin queue and emits an operational alert. The user-facing response still confirms that the request was recorded.

## 9. Action-Specific Readiness

The current single aggregate `OnlineRentCollection` readiness decision is too coarse for the approved workflow. Replace the temporary forced suspension with action-specific authorization that distinguishes:

- `RequestAccess`: organization owner/manager may create or view a request even while organization access is disabled;
- `Configure`: approved organization owner/manager may create a connected account, open Stripe-hosted onboarding, and view account status;
- `Pay`: an authorized tenant may create or update a payment for a server-resolved active lease after all payment readiness checks pass;
- `Transfer`: an internal transfer operation may release eligible funds only after all transfer controls pass.

The authorization service evaluates:

- global feature state and kill switch;
- provider configuration;
- organization access state;
- actor role and current organization authority;
- connected-account onboarding state when required;
- connected-payee organization approval when required;
- active tenant/lease relationship when required;
- transfer flag, hold period, dispute/refund state, and risk policy when required.

The server must derive a tenant payment's organization from the authorized lease/payment context. A client-provided organization ID is never sufficient authority.

The main application's presentation status can summarize readiness, but every Stripe action must enforce the appropriate server-side decision at the action boundary.

## 10. Free-Plan Entitlement

Remove `OnlineRentCollection` from the Premium-only feature list. Free, Premium, and lifetime plans may request organization access.

Plan entitlement does not imply activation. A Free-plan organization still requires:

- approved organization access;
- configured global provider;
- completed Stripe onboarding;
- connected-payee review;
- actor and lease authorization;
- applicable payment and transfer risk checks.

Percy, dedicated SMS numbers, and other Premium-only features remain unchanged.

## 11. Stripe Payment and Transfer Behavior

Preserve the existing separate-charges-and-transfers model and webhook-authoritative payment lifecycle.

- Stripe-hosted/embedded collection remains the boundary for payment credentials and banking information.
- Payment confirmation comes from verified Stripe webhooks, not browser success alone.
- Existing idempotency, dispute, refund, reversal, reconciliation, and audit controls remain in force.
- Connected-payee approval remains scoped to the exact user/account/organization destination.
- Payment collection may be globally enabled while transfers remain globally disabled.
- Card funds remain held for at least 7 days and ACH funds for at least 14 days before transfer eligibility.
- Transfers require a fresh connected-account snapshot and all existing risk decisions.
- Suspending organization access blocks new onboarding and payment attempts. Webhooks and reconciliation continue for already-created payments.

### Go-live Stripe compatibility prerequisite

Before production activation, complete a focused Stripe boundary upgrade:

- upgrade to the current stable Stripe.net release and pin the intended supported Stripe API version after reviewing its changelog and webhook shape changes;
- instantiate and inject `StripeClient` throughout payment and Connect services instead of using the global `StripeConfiguration.ApiKey` pattern;
- create and manage connected accounts with Accounts v2 rather than `AccountCreateOptions.Type = "express"`;
- use the Accounts v2 Recipient configuration and verify `configuration.recipient.capabilities.stripe_balance.stripe_transfers.status` before indirect transfers;
- replace v1 `ChargesEnabled`/`PayoutsEnabled` as transfer authority with the applicable Accounts v2 capability and requirements state;
- omit `payment_method_types` from rent PaymentIntent and SetupIntent creation so payment availability is controlled through Stripe dynamic payment methods/payment-method configuration;
- ensure the frontend only advertises and renders methods enabled for the rent-payment configuration;
- revalidate verified webhook event handling, connected-account onboarding, account-link/login behavior, disputes, refunds, transfer reversals, and stored snapshot mapping against the upgraded API;
- use a least-privilege restricted Stripe API key where supported, store production credentials in Azure Key Vault, and never log credentials or raw provider payload secrets.

This is a compatibility migration, not a change to the approved separate-charges-and-transfers funds flow or hold policy. If an Accounts v2 limitation prevents a safe equivalent in the selected stable API, production activation remains blocked until the limitation and migration path are explicitly resolved.

## 12. Main Application Experience

### Landlord rent collection and payment settings

Show one primary state at a time:

- `Not requested`: explain the approval process and show `Request online rent payments`.
- `Pending`: show `Request under review`, the request date, and no Stripe onboarding controls.
- `Rejected`: show the user-safe reason and an allowed next step.
- `Approved / onboarding incomplete`: show `Finish payment setup` and launch Stripe-hosted onboarding.
- `Connected / payee review pending`: explain that payment setup is being verified; tenants cannot yet pay.
- `Ready`: show `Ready to collect`, payment settings, ledger tools, and tenant-payment readiness.
- `Suspended`: disable setup/payment actions and show a support-oriented status message.
- `Globally unavailable`: show a temporary service-unavailable notice even for approved organizations.

Remove Premium upgrade prompts that specifically gate online rent collection. Do not remove unrelated Premium prompts for Percy or dedicated SMS.

### Administrator review queue

Add an Admin-only request queue with filters for pending, approved, rejected, and suspended requests. The email route opens the matching review detail.

The detail view shows request identity, organization identity, requester, current state, decision history, and separate warning text that organization approval is not connected-payee/payout approval. Approve, reject, and suspend actions require explicit confirmation. Reject and suspend require a reason.

### Tenant payments

Hide or disable the payment action until `Pay` readiness passes. When ready, retain the existing Payment Element, secure bank connection/card options, partial-payment support, status history, and webhook-backed ledger updates.

Do not add autopay controls or imply that saved payment methods are automatically charged.

## 13. Marketing Rent Collection Page

Create a dedicated rent-collection page composition rather than continuing to overload the generic feature-page benefit grid.

### Hero

- Plain eyebrow, without chip border: `COLLECT RENT ONLINE`
- Title: `The smooth, secure way to collect rent.`
- Supporting copy: `Set custom late fees, send automatic payment reminders, and give tenants secure bank and card payment options—all from one organized rent ledger.`
- Primary CTA: `Set Up Rent Payments`
- Secondary CTA: retain `View Pricing`
- Exactly three trust points:
  - included with Free;
  - secure bank connections;
  - automatic payment tracking.

The primary CTA leads into signup/login and then the in-app access-request flow. Marketing must not imply that every account is instantly activated.

### Smooth, automated process section

Centered heading:

`Make rent collection a smooth automated process for you and your tenants`

Centered supporting copy should communicate that Property Peace is purpose-built for rental workflows, unlike general peer-to-peer payment apps or paper checks, without copying competitor language. It should emphasize rent-specific records, reminders, balances, and tenant visibility.

Remove the current `What you get` benefit-card grid and `Everything included` box. Add a centered `Collect Rent Securely` CTA.

### Resources section

Add a rent-collection resources section in Property Peace's visual system. Feature the existing article:

- `/blog/rental-property-cash-flow-template-landlords/`

Additional resource cards may be included only after their internal routes are verified. Do not introduce broken placeholder links.

### Tenant-benefit section

Explain benefits that the current product supports:

- secure payment from a phone, tablet, or computer;
- eligible bank-account and card options;
- clear receipts and processing status;
- partial payments when the landlord permits them;
- fewer checks, cash handoffs, and ambiguous payment records.

Do not claim tenant credit reporting or automatic monthly payments.

### Broader rental workflow section

Show that rent collection works alongside Property Peace's existing rental workflow, including rent ledger/reporting, leases, maintenance, tenant records, and other verified product capabilities. Use Property Peace wording and styling rather than reproducing the reference screenshot.

### FAQ section

Use only questions that the current launch can answer accurately, including:

- How do landlords collect rent online with Property Peace?
- How do I request online rent payments, and what is the approval process?
- Is online rent collection included in the Free plan?
- What payment methods can tenants use?
- Can tenants make partial rent payments?
- Are rent payments tracked automatically?
- How secure are bank connections and online payments?
- Can Property Peace apply late fees and send payment reminders?
- When do completed payments become eligible for transfer?

Answers must explain approval, Stripe onboarding, connected-payee review, processing states, and applicable security holds without exposing internal risk rules or promising exact arrival times that the product cannot guarantee.

Remove all stale statements that Property Peace does not process online rent payments from the marketing page, main-app SEO, help content, pricing content, and safety-claim tests when the corresponding public launch state is enabled.

## 14. Marketing and Deployment State

Code and database migrations deploy with global payment and transfer kill switches disabled. Organization access is denied by default regardless of marketing state.

The marketing application must not publish live payment claims before the API and main-app approval workflow are deployed and verified. Use an explicit launch/deployment state or coordinated deployment step so the public page cannot get ahead of operational readiness.

At public launch:

- the global payment provider may be enabled;
- `Stripe:TransfersEnabled` remains false;
- every organization still begins as `NotRequested`;
- approved organizations proceed through onboarding and payee review;
- the live marketing page describes the request/approval process accurately.

Repository defaults remain fail-closed. Production configuration changes are a separate, deliberate operational action and are not silently embedded in application code.

## 15. Failure and Recovery Behavior

- **Duplicate request:** return the current request and do not send repeated email storms.
- **Notification failure:** retain the request, show success to the requester, log the delivery failure, and keep it in the admin queue.
- **Unauthorized request:** return `403` without revealing another organization's state.
- **Stale admin decision:** return `409`; display the already-resolved state.
- **Approval replay:** return the existing approved result without repeating side effects.
- **Global kill switch disabled:** all provider actions fail closed, including for approved organizations.
- **Stripe unavailable:** retain approval and onboarding state; show a temporary unavailable message and permit safe retry.
- **Onboarding incomplete or restricted:** do not enable tenant payments.
- **Payee review pending/rejected/suspended:** do not enable tenant payments or transfers.
- **Organization access suspended:** block new actions; continue webhook reconciliation for existing payments.
- **Admin recipient unavailable:** keep request queued and emit an operational alert.

## 16. Observability and Operations

Add structured, secret-free telemetry for:

- request created, deduplicated, and rate-limited;
- admin email queued, delivered, or failed;
- request approved, rejected, or suspended;
- stale/replayed admin action;
- readiness denial reason category;
- Stripe onboarding started/completed/restricted;
- payment creation denied by access/readiness;
- pilot payment lifecycle, hold eligibility, and transfer denial reason category.

Create operational queries/alerts for pending-request age, notification failures, unexpected cross-organization denials, webhook failures, unreconciled payments, hold-window exceptions, and transfer attempts while disabled.

No telemetry may contain Stripe secrets, access tokens, raw bank data, payment credentials, or sensitive KYC information.

## 17. Test Strategy

Implementation follows test-driven development.

### API tests

- Free-plan users may request access.
- Premium status is not required for online rent collection.
- Unknown organizations remain denied by default.
- Only active owners/managers can request for their canonical organization.
- Cross-organization requests and reads are denied.
- Duplicate requests are idempotent.
- Notification failure does not roll back the request.
- Admin-only review authorization is enforced.
- Email links cannot mutate state through `GET`.
- Approval/rejection/suspension transitions and required reasons are enforced.
- Concurrency conflict and approval replay behavior are deterministic.
- Audit entries identify every state transition.
- Global payment and transfer kill switches override organization state.
- Configure, Pay, and Transfer readiness are evaluated independently.
- Tenant payment authorization is derived from the active lease and organization.
- Connected-payee approval remains required before tenant payment readiness.
- Stripe services use injected clients and no rent-payment call hard-codes `payment_method_types`.
- Connected-account creation/readiness uses the supported Accounts v2 recipient capability path.
- Existing webhook, hold, dispute, refund, reversal, and transfer tests continue passing.

### Main-app tests

- Every landlord state renders the correct CTA and explanation.
- Pending/rejected/suspended users cannot open Stripe onboarding.
- Approved users can proceed to onboarding.
- Payee-review-pending users cannot expose tenant payment actions.
- Free-plan users receive no rent-payment Premium upsell.
- Admin email route requires authentication and loads the correct review.
- Admin confirmations handle success, stale state, and replay safely.
- Tenant payment controls fail closed until Pay readiness is true.

### Marketing tests

- Hero eyebrow, title, supporting copy, CTAs, and exactly three trust points match the approved content.
- The old unavailable-payment disclaimer and removed benefit grids are absent from the live variant.
- The resource link resolves to the requested cash-flow article.
- Tenant-benefit and broader-workflow sections do not contain unsupported claims.
- FAQs contain only approved, supportable questions and answers.
- Marketing safety checks reject autopay, credit-reporting, instant-payout, and AI-execution claims.
- Marketing safety checks allow truthful live online-rent-payment claims only in the coordinated live state.

### Verification

- API unit and integration tests;
- main-app targeted tests and production build;
- marketing interaction/contract tests and production build;
- repository release-validation workflow;
- Stripe sandbox payment, webhook, dispute/refund, hold, and disabled-transfer exercises;
- accessibility and responsive checks for the redesigned page and approval UI.

## 18. Rollout Sequence

1. Deploy database migration, API, main-app request/review UI, and marketing code with payment and transfer switches disabled and public live marketing disabled.
2. Verify migrations, admin recipient resolution, email delivery, audit logging, and the admin review queue in a non-production environment.
3. Upgrade and validate the focused Stripe compatibility boundary in sandbox: current stable SDK/API, injected clients, Accounts v2 recipient onboarding/readiness, dynamic payment methods, and webhook contracts.
4. Exercise the full workflow in Stripe sandbox: request, approve, onboard, payee review, tenant payment, webhook reconciliation, refund/dispute behavior, and transfer denial.
5. Deploy to production with repository defaults still fail-closed.
6. Deliberately enable the global rent-payment provider while leaving transfers disabled. All organizations remain `NotRequested` and denied.
7. Submit and approve a small internal/pilot organization through the same email workflow used by customers.
8. Complete Stripe onboarding and connected-payee review for the pilot.
9. Process controlled card and ACH payments and observe the full 7-day and 14-day windows, reconciliation, disputes/refunds, and alerting.
10. Enable transfers only after the existing rollout-runbook gates are satisfied, initially for the vetted pilot and with existing limits/manual controls.
11. Publish the live marketing state and expand approval volume gradually.

## 19. Acceptance Criteria

The launch is complete when:

- online rent payments are no longer Premium-only;
- every organization is denied until an approved request exists;
- request creation reliably notifies the existing signup-notification admin recipients;
- the email review link cannot mutate state without authenticated admin confirmation;
- approval unlocks Stripe onboarding only for the approved organization;
- tenant payment readiness requires completed onboarding and connected-payee approval;
- transfer readiness remains independent and disabled by default;
- the Stripe boundary uses the current stable SDK/API, injected clients, Accounts v2 recipient readiness, and dynamic payment methods;
- the main app accurately represents every access/setup state;
- the marketing rent-collection page matches the approved content and sections;
- unsupported claims are absent;
- targeted tests, builds, release validation, and sandbox payment exercises pass;
- production activation follows the existing Stripe rollout runbook and remains recoverable through global and organization-level suspension controls.
