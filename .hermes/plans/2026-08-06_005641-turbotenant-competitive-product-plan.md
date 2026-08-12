# Property Peace TurboTenant Competitive Product Plan

> **For Hermes:** Use `subagent-driven-development` to execute this plan one milestone at a time. Each milestone requires specification review and code-quality/security review before the next begins. Do not commit, push, migrate, deploy, or enable payment gates without Thomas's explicit authorization.

**Goal:** Make Property Peace the clearer, safer, more property-first operating system for independent landlords with 1–50 units by adopting TurboTenant's strongest workflow ideas, improving their transparency and usability, and deliberately excluding its renter-fee shifting, feature sprawl, and managed-service complexity.

**Architecture:** Preserve Property Peace's existing React/.NET domain depth, but organize the customer experience around one property/unit-scoped lifecycle: Vacancy → Lead → Showing → Application → Screening → Approval → Lease → Move-in → Rent → Maintenance → Renewal/Move-out. Introduce shared pipeline, entitlement, integration, communication-timeline, and audit contracts rather than adding more disconnected pages. Keep all regulated/financial integrations provider-abstracted, fail-closed, and independently releasable.

**Tech Stack:** React/Vite web app, ASP.NET Core API, EF Core/SQL Server, Next.js marketing, Expo/React Native mobile, external screening/listing/e-signature/payment/SMS providers.

---

## 1. Product position and decision rules

### Target position

Property Peace should not become a TurboTenant clone. The winning position is:

- **TurboTenant's continuous vacancy-to-tenant workflow**, but anchored to a clean property/unit workspace.
- **Property Peace's deeper maintenance, documents, accounting, reporting, and Percy capabilities**, made simpler and more coherent.
- **Transparent total cost** for both landlord and renter.
- **No generic proptech bloat:** every feature must reduce a recurring landlord job or complete the rental lifecycle.
- **No unsafe claims:** unavailable/gated integrations must not appear as shipped.

### Adopt and improve

1. Listing → lead → pre-screen → showing → application → screening → lease continuity.
2. Applicant enters sensitive screening data directly with the screening provider.
3. Structured maintenance intake with photos, issue location, troubleshooting, urgency, and vendor handoff.
4. Contextual communications attached to property, unit, person, application, lease, or maintenance request.
5. Tenant self-service for applications, screening, signatures, documents, rent, maintenance, and messages.
6. A genuinely useful free-start experience with a simple upgrade story.
7. Reusable state-specific leasing documents and condition reports, with careful legal disclaimers.
8. Automation for reminders, receipts, showing confirmations, follow-up queues, and transaction categorization.

### Deliberately leave out

1. Do not fund “free” by hiding material applicant/tenant fees; show landlord and renter costs together before consent.
2. Do not add Autopilot/full-service property management until the SaaS workflow is excellent; it changes the business into a market-dependent service operation.
3. Do not add LLC formation, insurance marketplaces, eviction assistance, call forwarding, or other partner catalogs merely to inflate the checklist.
4. Do not claim AI legal compliance or guaranteed lease validity.
5. Do not expose enterprise accounting primitives as the default navigation for small landlords.
6. Do not display mobile menu aliases as if full mobile features exist.
7. Do not enable rent collection before the existing Stripe redesign, real-SQL acceptance, reconciliation, security review, migration rollout, and independent gates are complete.

## 2. Current Property Peace baseline

### Strong and substantially implemented

- Property and unit management.
- Rental applications.
- Lease lifecycle and lease generation.
- Documents, checklists, inspections, and condition evidence.
- Manual rent tracking and broad accounting/report entities.
- Maintenance, vendors, and Percy-assisted maintenance.
- In-app messaging, notifications, and Premium/Lifetime dedicated SMS.
- Web tenant portal.
- Organizations, invitations, team membership, and roles.
- Dashboard/reporting breadth.
- Percy web/API workflows.

### Partial or integration-dependent

- Listings are hosted and shareable, but external syndication is “Coming Soon.”
- Prospect capture is application-centric; no first-class lead/showing CRM exists.
- RentSpree screening code exists, but production consent, billing, credentials, webhooks, report retrieval, and recovery are not runtime-proven.
- DocuSign/e-signature behavior depends on provider selection, credentials, templates, and callbacks.
- Entitlement enforcement is distributed across navigation, route guards, controllers, services, and UI checks.
- Tenant and advanced landlord workflows lack full mobile parity.
- Percy has broad capability but limited focused test coverage and duplicated/legacy orchestration paths.

### Unavailable or misleading today

- Listing syndication controls are disabled placeholders.
- Online Stripe rent collection must be treated as unavailable while gates remain closed.
- Marketing copy currently overstates Stripe rent-payment availability.
- Several mobile menu entries redirect to unrelated screens or do nothing.

## 3. Competitive priority order

### P0 — Trust and funnel blockers

1. Align marketing and product claims with actual feature-gate/integration state.
2. Establish a first-class property/unit-scoped leasing pipeline.
3. Add lead capture, pre-screening, showing scheduling, and follow-up.
4. Productionize tenant screening or replace the provider path after a formal vendor decision.
5. Deliver real listing syndication through a provider/marketplace integration.
6. Complete the separate Stripe rent-payment readiness program without weakening its gates.

### P1 — Make Property Peace meaningfully better

7. Unify communications into one contextual timeline.
8. Improve maintenance intake and tenant/vendor status visibility.
9. Replace accounting-first navigation with outcome-first money views while preserving the ledger underneath.
10. Create one canonical activation journey.
11. Centralize plan entitlements and organization authorization.

### P2 — Platform completeness

12. Build real mobile workflows and a full tenant mobile portal.
13. Harden Percy actions, auditability, tests, and safe automation.
14. Add conversion/operational analytics for the complete lifecycle.

---

# Implementation milestones

## Milestone 0: Truthful product state and shared readiness contracts

**Objective:** Ensure unavailable integrations cannot be marketed or surfaced as working, and establish one authoritative readiness model.

**Likely files:**

- Modify: `property-peace-marketing/lib/otto-seo.ts`
- Modify: relevant feature pages under `property-peace-marketing/app/`
- Modify: `property-peace-app/src/components/subscription/PricingTable.jsx`
- Modify: `property-peace-app/src/components/subscription/PlanComparisonTable.jsx`
- Modify: `property-peace-api/Services/SubscriptionService/FeatureGateService.cs`
- Modify: API feature/readiness DTOs and startup registrations under `property-peace-api/`
- Test: `property-peace-api.Tests/` feature-gate/readiness tests
- Test: marketing metadata/page tests where present

**Steps:**

1. Inventory every public claim and in-app entry point for screening, syndication, e-signature, Stripe payments, SMS, and Percy.
2. Define canonical states: `Unavailable`, `ComingSoon`, `ConfigurationRequired`, `Pilot`, `Available`, and `Suspended`.
3. Write failing API tests proving a feature marked unavailable cannot be invoked, regardless of frontend state.
4. Implement a backend readiness endpoint that combines plan entitlement, global gate, organization readiness, provider configuration, and user authorization without exposing secrets.
5. Update web navigation/actions to consume readiness rather than infer availability from plan names.
6. Remove or qualify unsupported marketing claims; do not claim syndication or online rent payments until truly available.
7. Verify Free/Premium/Lifetime behavior and fail-closed defaults.
8. Build API, app, and marketing; inspect generated marketing HTML and authenticated app entry points.

**Acceptance:** A user never discovers an unavailable integration only after completing a workflow, and marketing never describes a gated-off capability as live.

## Milestone 1: Property-first lifecycle and leasing pipeline foundation

**Objective:** Create one canonical lifecycle record and UI from vacancy through move-in without replacing existing application/lease entities.

**Likely files:**

- Modify: `property-peace-app/src/pages/landlord/property-details.jsx`
- Modify: `property-peace-app/src/pages/landlord/listing-detail.jsx`
- Modify: `property-peace-app/src/pages/landlord/applications.jsx`
- Modify: `property-peace-app/src/pages/landlord/application-details.jsx`
- Create: property/unit pipeline components under `property-peace-app/src/components/leasing/`
- Create: pipeline DTOs/controller/service under `property-peace-api/Controllers/`, `Dtos/`, and `Services/`
- Modify: `property-peace-api/Models/Listing.cs`
- Modify: `property-peace-api/Models/Application.cs`
- Test: new pipeline service/controller tests in `property-peace-api.Tests/`
- Test: app component/adapter tests using the project's existing frontend test pattern

**Steps:**

1. Define lifecycle states and allowed transitions: `Vacant`, `Listed`, `Lead`, `ShowingScheduled`, `Applied`, `Screening`, `Approved`, `LeaseDraft`, `SignaturePending`, `MoveInReady`, `Occupied`.
2. Keep lifecycle state derived from authoritative domain records where possible; persist only transition metadata that cannot be derived.
3. Write failing tests for valid transitions, cross-organization denial, stale-state conflicts, and idempotent retries.
4. Add a property/unit pipeline query that returns current stage, blocking action, next best action, and relevant records.
5. Add a compact pipeline to property, listing, and application detail pages.
6. Make every stage deep-link to the real existing workflow rather than duplicate it.
7. Add an audit event for stage transitions and manual overrides.
8. Verify desktop and mobile-width web composition using a real authenticated route or a clearly labeled real-component harness.

**Acceptance:** From a vacant unit, the landlord can always see its current leasing stage, the blocking issue, and one primary next action.

## Milestone 2: Lead CRM, pre-screening, showing scheduling, and follow-up

**Objective:** Capture and nurture prospects before requiring a full application.

**Likely files:**

- Create: `Lead`, `LeadSource`, `Showing`, and pre-screen response models/migrations under `property-peace-api/Models/` and `Migrations/`
- Create: lead/showing controllers and services under `property-peace-api/Controllers/` and `Services/`
- Modify: `property-peace-api/Models/Listing.cs`
- Create: landlord lead pipeline pages/components under `property-peace-app/src/pages/landlord/` and `components/leasing/`
- Modify: `property-peace-app/src/routes/MainRoutes.jsx`
- Modify: public listing/application components to offer inquiry and application as distinct actions
- Test: API authorization, transition, scheduling, and notification tests

**Steps:**

1. Write the domain contract before the migration: a lead belongs to an organization, listing, property/unit, and person/contact identity.
2. Add configurable pre-screen questions with safe defaults: move-in date, occupants, pets, smoking, income range, and requested showing time; prohibit protected-class questions.
3. Add anonymous inquiry submission with abuse/rate controls and contact verification.
4. Add lead-source attribution and deduplication by normalized contact plus listing.
5. Add showing availability, booking links, timezone-safe slots, cancellation, confirmation, and reminder events.
6. Add lead statuses, owner/team assignment, notes, tasks, and next-follow-up date.
7. Add conversion from lead to application without re-entering known information.
8. Add pipeline filters and conversion metrics without exposing protected screening attributes.
9. Verify concurrent booking, timezone boundaries, duplicate inquiry handling, and organization isolation.

**Better than TurboTenant:** Keep the pre-screen concise, explain why each question is asked, allow the landlord to disable optional questions, and prevent discriminatory custom questions.

## Milestone 3: Tenant screening productionization and TransUnion decision

**Objective:** Offer a safe applicant-mediated screening workflow with transparent pricing and a replaceable provider boundary.

**Likely files:**

- Modify: `property-peace-api/Services/BackgroundCheckService/BackgroundCheckService.cs`
- Modify: `property-peace-api/Config/RentSpreeSettings.cs`
- Create/modify: provider abstraction, webhook inbox, status state machine, audit and adverse-action services under `property-peace-api/Services/`
- Modify: `property-peace-app/src/pages/landlord/screenings.jsx`
- Modify: `property-peace-app/src/pages/landlord/application-details.jsx`
- Create: applicant screening consent/status pages in `property-peace-app/src/pages/`
- Test: background-check provider contract, webhook replay, authorization, status, billing, and adverse-action tests
- Docs: vendor decision record under `docs/architecture/`

**Steps:**

1. Obtain and document RentSpree's current production terms, pricing, credentialing, consent, webhook, report-retention, and dispute requirements.
2. Contact TransUnion SmartMove B2B sales for eligibility, minimum volume, private integration docs, pricing, security requirements, and end-landlord vetting.
3. Compare RentSpree, direct TransUnion, and at least one integration-friendly screening intermediary using the same rubric.
4. Select one launch provider without coupling domain statuses to provider-specific names.
5. Ensure the applicant enters SSN/identity data directly with the provider; Property Peace must not store full SSNs or bank credentials.
6. Model `Invited`, `ConsentPending`, `PaymentPending`, `Processing`, `Complete`, `ActionRequired`, `Expired`, `Disputed`, and `Failed` with idempotent provider callbacks.
7. Require a real property/application, verified landlord/manager authority, and a recorded permissible purpose for every order.
8. Show the complete landlord-paid and applicant-paid cost before consent; enforce jurisdiction-specific fee caps and prohibit unsupported markups.
9. Add adverse-action generation, delivery evidence, CRA contact/right-to-dispute text, and access audit logs.
10. Add secure report access, retention, deletion, support-access restrictions, and incident logging per contract.
11. Run sandbox acceptance, signed webhook replay, failure/retry scenarios, and an FCRA counsel review before production.

**Acceptance:** A real applicant can authorize and complete screening without giving sensitive credentials to the landlord or Property Peace, the authorized landlord receives the permitted result, failures recover safely, and an adverse-action notice can be generated and audited.

## Milestone 4: Listing syndication

**Objective:** Turn Property Peace listings into a real acquisition channel rather than only shareable hosted pages.

**Likely files:**

- Modify: `property-peace-app/src/pages/landlord/listing-add-workflow.jsx`
- Modify: `property-peace-app/src/pages/landlord/listing-edit-workflow.jsx`
- Modify: `property-peace-app/src/pages/landlord/listing-detail.jsx`
- Create: syndication provider abstraction/services/jobs under `property-peace-api/Services/ListingSyndication/`
- Modify: `property-peace-api/Controllers/ListingController.cs`
- Modify: `property-peace-api/Models/Listing.cs`
- Create: feed/provider status entities and migration
- Test: provider mapping, publish/update/withdraw, retry, image, validation, and authorization tests

**Steps:**

1. Remove disabled marketplace logos until contracts/integrations are real.
2. Evaluate a syndication partner/feed accepted by the target marketplaces; do not promise direct Zillow/Realtor access without an approved channel.
3. Define a canonical listing schema and provider-specific validation adapters.
4. Add pre-publish completeness checks, fair-housing copy validation, image requirements, and exact failure messages.
5. Implement idempotent publish, update, pause, and withdraw jobs with per-destination statuses.
6. Show review/pending/rejected/live state and actionable rejection reasons.
7. Capture source attribution when inquiries return through trackable links or provider callbacks.
8. Verify stale-update ordering, partial-provider failure, image changes, withdrawal, and organization isolation.

**Better than TurboTenant:** Show exactly where a listing is live, when it was last accepted, and what must be fixed—never a vague “syndicated” success state.

## Milestone 5: Lease and move-in simplification

**Objective:** Package Property Peace's existing lease/document depth into one predictable post-approval workflow.

**Likely files:**

- Modify: `property-peace-app/src/pages/landlord/lease-add-workflow.jsx`
- Modify: `property-peace-app/src/pages/landlord/lease-edit-workflow.jsx`
- Modify: `property-peace-app/src/pages/landlord/lease-details.jsx`
- Modify: lease builder components referenced by `property-peace-app/src/routes/MainRoutes.jsx`
- Modify: `property-peace-api/Services/LeaseGeneration/`
- Modify: `property-peace-api/Services/ESignatureService/`
- Test: lease generation, signer matching, callbacks, retries, and move-in checklist tests

**Steps:**

1. Begin lease creation from the approved application and carry forward authoritative applicant/property/unit data.
2. Present one review sequence: terms → required disclosures/addenda → document preview → signer verification → send.
3. Unify provider readiness checks so signature setup cannot fail only at the final step.
4. Preserve draft recovery, idempotent finalization, exact tenant signer matching, and organization isolation.
5. Add signature reminders, per-signer status, audit events, and completed-copy access.
6. Transition directly into deposit/initial-charge setup, condition report, keys, and move-in checklist.
7. Keep AI lease review informational, source-cited, and unable to claim legal compliance.

**Better than TurboTenant:** Make every required disclosure source-visible and versioned, and never silently inject legal text or imply attorney approval.

## Milestone 6: Rent-payment readiness program — separate security track

**Objective:** Deliver safe tenant payments and landlord settlement without bypassing existing risk controls.

**Primary references:**

- `property-peace-development/references/stripe-connect-delayed-rent-transfers.md`
- `property-peace-development/references/stripe-connected-payee-risk-controls.md`
- `property-peace-development/references/stripe-rent-real-sql-verification.md`
- `property-peace-development/references/stripe-rent-dev-acceptance.md`
- `property-peace-development/references/stripe-rent-production-promotion-preflight.md`

**Likely files:** Existing Stripe payment controllers/services/models/tests, `property-peace-app/src/sections/landlord/settings/PaymentsSettings.jsx`, `property-peace-app/src/components/drawers/PaymentModal.jsx`, and tenant payment pages.

**Steps:**

1. Keep `RentPaymentsEnabled` and transfer-release gates explicit and false.
2. Finish the already-defined authority, destination, collection-time, reservation, idempotency, concurrency, webhook, refund/dispute/ACH-return, ledger, and reconciliation requirements.
3. Complete real-SQL tests and disposable dev acceptance with Stripe test mode.
4. Add a tenant-facing schedule, fee disclosure, autopay authorization, failure/retry, receipt, and status experience.
5. Add landlord payout/hold/reconciliation visibility without promising instant availability.
6. Complete migration and production preflight, independent security review, and exact-SHA deployment verification.
7. Enable payment intake and transfer release separately only after every readiness condition is proven.

**Better than TurboTenant:** Show who pays each fee, the hold/settlement state, failure consequences, and expected availability before authorization. Do not use renter fee opacity to subsidize the landlord plan.

## Milestone 7: Contextual communication timeline

**Objective:** Replace fragmented communication surfaces with one record of the relationship.

**Likely files:**

- Modify: `property-peace-api/Controllers/MessageController.cs`
- Modify/create: conversation, notification, SMS, announcement, and audit services/models
- Modify: landlord/tenant message pages and `property-peace-app/src/pages/landlord/application-details.jsx`
- Modify: `property-peace-mobile/src/screens/landlord/MessagesScreen.tsx`
- Modify: `property-peace-mobile/src/screens/landlord/ConversationDetailScreen.tsx`
- Test: timeline ordering, visibility, delivery-state, organization access, and idempotency tests

**Steps:**

1. Define a shared timeline event contract for in-app messages, SMS, email, reminders, screening events, lease events, payments, maintenance, and Percy follow-ups.
2. Keep transport delivery status separate from “message saved.”
3. Attach every event to the smallest valid context: property, unit, listing/lead/application, lease, payment, or maintenance request.
4. Add participant-aware visibility so applicants, tenants, vendors, team members, and admins see only permitted events.
5. Add quick replies, group conversations, follow-up tasks, unread state, and search.
6. Preserve the rule that unpaid-rent landlords do not receive a redundant standalone email when the daily summary already covers it.
7. Verify ordering under retries, SMS webhook replay, SignalR reconnect, and cross-organization attempts.

**Better than TurboTenant:** A landlord should understand not just the message, but the exact property/unit/workflow context and whether the external delivery actually succeeded.

## Milestone 8: Maintenance experience refinement

**Objective:** Turn Property Peace's existing maintenance depth into a simpler tenant-to-vendor loop.

**Likely files:**

- Modify: `property-peace-app/src/pages/tenant/maintenance.jsx`
- Modify: landlord maintenance pages and `LandlordMaintenanceDrawer.jsx`
- Modify: `property-peace-api/Controllers/MaintenanceAgentController.cs`
- Modify: maintenance/vendor/work-order services and tests
- Modify: mobile maintenance screens

**Steps:**

1. Standardize structured intake: issue category, exact location, description, photos/video, severity signals, access permission, pets, and preferred times.
2. Let Percy ask bounded troubleshooting questions and escalate emergencies clearly; never allow AI to suppress a suspected emergency.
3. Produce a landlord-ready summary, suggested urgency, and missing-information checklist.
4. Add assignment, estimate/approval, scheduling, work-order, completion evidence, and tenant confirmation statuses.
5. Keep coordinated maintenance as landlord-controlled vendor workflow, not a Property Peace managed-service operation.
6. Add SLA/aging visibility and a complete timeline linked to messages and costs.
7. Verify tenant, landlord, team, and vendor permissions and mobile photo/status behavior.

## Milestone 9: Outcome-first accounting and money center

**Objective:** Preserve the existing ledger/reporting depth while making daily money management simpler than TurboTenant.

**Likely files:**

- Modify: `property-peace-app/src/pages/landlord/money-activity.jsx`
- Modify: `property-peace-app/src/pages/landlord/rent-collection.jsx`
- Modify: accounting/report navigation in layout components and `MainRoutes.jsx`
- Reuse: `shared/api/general-ledger.js`, `financial-statements.js`, `bank-reconciliation.js`, and expense APIs
- Test: frontend money-summary adapters and API report/accounting tests

**Steps:**

1. Make the default money view answer: what came in, what is due, what went out, what needs attention, and what is available.
2. Group advanced pages under an `Accounting` workspace rather than top-level navigation.
3. Provide property/unit cashflow, income/expense categories, uncategorized transactions, upcoming obligations, and tax-ready status.
4. Preserve double-entry/ledger integrity beneath simplified UI; never compute conflicting balances client-side.
5. Add explanation and drill-down for every summary number.
6. Evaluate bank-feed integration separately; do not claim automatic import until a real provider is selected and verified.
7. Add export packages for accountant review before expanding tax claims.

**Better than TurboTenant:** Offer the simple landlord view first, with trustworthy drill-down into Property Peace's richer ledger rather than hiding complexity or overpromising “automatic accounting.”

## Milestone 10: Canonical onboarding and activation

**Objective:** Replace overlapping setup flows with one lifecycle-driven checklist.

**Likely files:**

- Modify: `property-peace-app/src/components/onboarding/OnboardingWizard.jsx`
- Modify: `property-peace-app/src/components/onboarding/OnboardingWrapper.jsx`
- Modify: `property-peace-app/src/sections/landlord/dashboard/FinishSetup.jsx`
- Modify: `property-peace-app/src/hooks/useLandlordSetupSteps.js`
- Modify: dashboard composition in `property-peace-app/src/pages/landlord/dashboard.jsx`
- Test: setup-state derivation and role/plan visibility tests

**Steps:**

1. Define one canonical activation sequence: account → organization → property/unit → listing/application path → lease → tenant invite → rent tracking/payment readiness → communication.
2. Derive completion from real records, not dismissible UI flags.
3. Move optional Premium features such as dedicated SMS into a later “enhance your setup” section.
4. Make every step resumable and deep-linked.
5. Personalize the next action for vacant, occupied, and importing landlords.
6. Verify a clean new account, an existing spreadsheet landlord, and an invited team member.

## Milestone 11: Centralized entitlements and authorization

**Objective:** Make Free/Premium/Lifetime behavior and organization isolation consistent across every surface.

**Likely files:**

- Modify: `property-peace-api/Services/SubscriptionService/FeatureGateService.cs`
- Modify: `property-peace-api/Data/SubscriptionPlanSeeder.cs`
- Modify: `property-peace-api/Attributes/RequireOrganizationRoleAttribute.cs`
- Modify: organization-sensitive controllers
- Create: shared frontend entitlement contract/adapter
- Modify: `property-peace-app/src/routes/MainRoutes.jsx`
- Test: entitlement matrix and organization authorization tests

**Steps:**

1. Define one versioned entitlement matrix with feature keys, plan access, quotas, add-ons, and readiness dependencies.
2. Enforce entitlements in API services/controllers; frontend hiding is only presentation.
3. Apply organization membership/role checks uniformly to every organization-scoped endpoint.
4. Add tests for Free, Premium, Lifetime, paused, expired, invited, removed, wrong-organization, and admin scenarios.
5. Expose reason codes that let UI distinguish upgrade-required, setup-required, unavailable, and unauthorized.
6. Audit pricing/marketing copy against the exact matrix.

## Milestone 12: Mobile and tenant parity

**Objective:** Stop overstating mobile coverage and deliver the high-frequency workflows first.

**Likely files:**

- Modify: `property-peace-mobile/src/navigation/MainNavigator.tsx`
- Create/modify: mobile listing, application/screening, payment, expense, report, team, and Percy screens
- Create: tenant navigation and tenant screens under `property-peace-mobile/src/screens/tenant/`
- Reuse/extend: `property-peace-mobile/src/api/`
- Test: TypeScript, navigation, adapter, and critical interaction tests

**Steps:**

1. Remove/no-op or label all current alias destinations until real screens exist.
2. Prioritize tenant maintenance/photos, messages, lease/document access, notifications, and payment status.
3. Prioritize landlord leads/applications/screening, maintenance triage, messages, rent status, and property next actions.
4. Add Percy only after backend action confirmation, scoping, and audit rules are uniform.
5. Add push/deep-link handling tied to real route permissions.
6. Run `npx tsc --noEmit`, Expo bundle checks, and representative iOS/Android visual verification.

## Milestone 13: Percy as the differentiator

**Objective:** Use Percy to reduce work inside existing workflows rather than create a separate AI product maze.

**Likely files:**

- Modify: `property-peace-api/Controllers/AICopilotController.cs`
- Modify: AI services/actions under `property-peace-api/Services/`
- Modify: `property-peace-app/src/pages/landlord/ai-center.jsx`
- Modify: `property-peace-app/src/layout/Dashboard/AICopilotSidebar/index.jsx`
- Consolidate/remove legacy client-side orchestration after dependency analysis
- Create: focused AI/action/authorization tests under `property-peace-api.Tests/`

**Steps:**

1. Inventory every Percy action and classify it as read-only, draft, reversible mutation, financial, legal-sensitive, or disallowed.
2. Require deterministic server-side authorization and confirmation for every mutation.
3. Add organization-scoped audit events, input/output redaction, idempotency, and replay handling.
4. Embed Percy suggestions in lead follow-up, screening status, lease preparation, maintenance intake, collections, and accounting cleanup.
5. Keep Percy explanations source-linked to Property Peace records; do not fabricate completion or provider status.
6. Add adversarial tests for cross-organization prompts, stale confirmation, indirect prompt injection from documents/messages, and unavailable integrations.

## Milestone 14: Pricing, packaging, and launch proof

**Objective:** Compete with TurboTenant without copying its hidden-cost economics.

**Steps:**

1. Define the minimum genuinely useful Free workflow and do not call a crippled trial “free.”
2. Keep Property Peace's simple Premium/Lifetime model unless data proves another tier is necessary.
3. Publish one total-cost comparison showing subscription, screening, ACH, card, e-signature, SMS, and add-on costs for landlord and renter.
4. Avoid per-unit punishment for the 1–50-unit audience where commercially feasible.
5. Instrument activation and funnel metrics: property added, listing published, lead received, showing booked, application completed, screening completed, lease signed, tenant invited, first rent recorded/paid, and maintenance closed.
6. Run clean-account desktop/mobile walkthroughs with real integrations in sandbox/test environments.
7. Require exact evidence before launch: builds, tests, migrations, security review, provider acceptance, signed webhook tests, mobile verification, marketing parity, and gated rollout metrics.

---

# Cross-cutting test and validation matrix

For every milestone:

1. **TDD:** Add a failing test for the domain/authorization contract before implementation.
2. **Organization isolation:** Test wrong organization, removed member, stale role, and direct-ID access.
3. **Entitlements:** Test Free, Premium, Lifetime, paused, unavailable, and configuration-required states.
4. **Idempotency/concurrency:** Test duplicate requests, callbacks, retries, and stale updates for external integrations.
5. **Auditability:** Verify actor, organization, entity, timestamp, action, old/new state, and external reference are recorded without secrets.
6. **Accessibility/responsiveness:** Verify keyboard, labels, focus, contrast, desktop, and phone layouts.
7. **External-provider failure:** Verify timeout, invalid signature, out-of-order webhook, partial completion, user retry, and support diagnostics.
8. **Truthful UX:** Verify no “complete,” “sent,” “paid,” “screened,” or “syndicated” state is shown before authoritative confirmation.
9. **Builds:** Build only touched packages; leave checkout `node_modules` untouched if WSL optional dependencies require a clean `/tmp` copy.
10. **No push by default:** Do not commit or push without Thomas's explicit instruction.

# Risks and tradeoffs

- **Direct TransUnion may reject or delay a small platform.** Keep the screening provider boundary and launch with the best compliant intermediary if necessary.
- **Syndication access is commercial, not just technical.** Do not build marketplace-specific UI before confirming an approved distribution channel.
- **Stripe is an independent high-risk program.** Competitive urgency cannot weaken collection/settlement controls.
- **The existing feature breadth can hide unfinished integrations.** Readiness contracts and truthful marketing precede expansion.
- **Mobile breadth can become a second incomplete product.** Prioritize tenant and high-frequency landlord actions rather than duplicating every accounting page.
- **Regulatory differences matter.** Screening, application fees, criminal history, adverse action, payments, e-signatures, and leases need jurisdiction-aware policy and counsel review.
- **Migration scope:** New lead/showing/syndication/screening state models require reviewed SQL migrations and staged rollout; do not combine them into one risky migration.

# Recommended execution order

1. Milestone 0 — truthful state/readiness.
2. Milestone 1 — property-first pipeline.
3. Milestone 2 — leads/showings.
4. Milestone 3 — screening provider and production flow.
5. Milestone 4 — syndication.
6. Milestone 5 — lease/move-in simplification.
7. Milestone 7 and 8 — communication and maintenance refinement.
8. Milestone 9 and 10 — money UX and onboarding.
9. Milestone 11 — entitlement/authorization consolidation, started earlier where touched.
10. Milestone 12 and 13 — mobile parity and Percy hardening.
11. Milestone 6 proceeds in parallel as its own security-controlled track and blocks any online-payment launch.
12. Milestone 14 — packaging and evidence-backed launch.

# Definition of competitive success

Property Peace is competitively ready when a new landlord can start free, add a property, publish a real distributed listing, capture and pre-screen a lead, schedule a showing, receive an application, complete applicant-mediated screening, approve the applicant, generate and sign a lease, complete move-in, communicate in context, collect or accurately track rent, resolve maintenance, and understand property cashflow—without duplicate data entry, hidden renter costs, fake mobile destinations, unsupported marketing claims, or unsafe provider/payment states.
