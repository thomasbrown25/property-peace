# Property Peace Long-Term + Short-Term Rental Implementation Plan

> **For Hermes:** Use the `subagent-driven-development`, `property-peace-development`, and `test-driven-development` skills when implementation is authorized. This document is a plan, not authorization to build, migrate, enable payments, or deploy.

**Goal:** Let owners choose **Long-term rental** or **Short-term rental** when adding a property, assign the mode to each independently managed unit, change a unit's mode later under safe rules, and see fields and workflows appropriate to its mode. Grow the short-term mode into direct booking, a consolidated availability calendar, guest communications, owner reporting, and a digital guidebook without disrupting existing lease-based management.

**Architecture:** Keep a single Property Peace account and property record. Store rental *mode* on each independently managed unit, independent of the existing structural `PropertyType` (`SingleFamily`/`MultiUnit`); do **not** rename or overload that enum. The property-creation choice is the initial default for its units, not a property-wide constraint; a single-family home still needs an inventory record representing its rentable home. Preserve long-term behavior as the default for all existing inventory. Keep leases/tenants and reservations/guests as separate domain models, sharing property/unit inventory, expense and maintenance infrastructure where appropriate. The API, not just conditional UI, enforces mode-specific rules.

**Tech stack:** Existing ASP.NET Core/EF Core API and SQL Server; React web app; Expo/React Native mobile app. Use existing organization authorization, property-entitlement and feature-readiness conventions.

---

## Decisions confirmed with Thomas

- Property Peace will support normal long-term rentals and short-term rentals under the same product.
- Property creation offers a short-term option; owners can change the mode after creation.
- Mixed-use buildings are supported: each independently managed unit has its own mode; the creation choice initializes units but does not force every unit in a building to stay the same. Single-family homes use one managed inventory record.
- The visible fields depend on the mode.
- Property Peace checkout is for **new direct bookings made through Property Peace**. This is not a flow to reroute payment on existing Airbnb/Vrbo/Booking.com bookings.
- Later short-term capabilities: direct booking/secure payment, unified availability and blocks, guest messages, performance dashboard, digital guidebook.
- Use **Lease** and **Tenant** only for long-term rentals. For short-term rentals, use **Booking** in the owner interface, **Reservation** in guest-facing details and confirmations, **Stay** for the checked-in period, and **Guest** for the person booking. A guest may accept house rules or a rental agreement, but that document does not turn a booking into a lease.

## Current codebase findings (as inspected)

- `property-peace-api/Models/Property.cs` and `Enums/EPropertyType.cs` model building/unit structure only; `PropertyType` is stored as a string in `Configurations/PropertyConfig.cs`.
- `Dtos/Property/UpdatePropertyDto.cs` and `LoadPropertyDto.cs` expose property fields; `PropertyService.cs` and `Repositories/Properties/PropertyRepository.cs` own create/update with organization scope and unit-based entitlements.
- Web creation is `property-peace-app/src/pages/landlord/property-add-workflow.jsx` (wrapped by `components/drawers/PropertyAddWorkflowDrawer.jsx`); editing is `components/drawers/PropertyEditDrawer.jsx`. Both currently use `propertyType` for building type. Review the older `PropertyAddDrawer.jsx` and `pages/landlord/property-add.jsx` paths before coding to avoid leaving an active entry point behind.
- Mobile creation is `property-peace-mobile/src/screens/landlord/AddPropertyScreen.tsx`; property view is `PropertyDetailScreen.tsx`; API requests are in `src/api/propertyAPI.ts`.
- Mobile creation currently uses `address` and `propertyType: 'Residential'`, whereas the API DTO expects `streetAddress` and structural `SingleFamily`/`MultiUnit`. **Verify/fix this contract before adding the new choice**; do not assume a new mode picker alone creates valid properties. Mobile has no evident property-mode edit control yet.
- The working tree contains unrelated mobile lease, rent-collection, quick-actions and test changes. Preserve them; this plan is the only file modified for the rental-mode decision. No implementation is underway.

## Product model and field matrix

| Area | Shared | Long-term only | Short-term only (as the phases become real) |
| --- | --- | --- | --- |
| Property basics | Name, address, structural building type, photos, contacts/manager, expenses, maintenance | — | — |
| Inventory | Units where applicable; the bookable inventory must be explicitly defined | Leaseable unit | Bookable unit/listing (do not assume every multi-unit property is one bookable listing) |
| Pricing | Currency, property ownership | Monthly target rent, target deposit, lease terms | Nightly base price, minimum nights, cleaning fee, taxes/fees, check-in/out times, timezone; validate availability before publish |
| People & work | Authorized staff, maintenance | Tenants, leases, rent collection, move-in/out | Guests, reservations, stays, turnovers, guest communication |
| Owner view | Property-specific expenses and financial context | Occupancy/rent roll/lease status | Calendar, occupied nights, booking revenue, expenses, profit with stated accounting basis |
| Publishing | Private owner record first | Existing long-term listing flow | Separate direct-booking publication readiness and guest-facing listing; mode selection does not itself publish or take payments |

Start with a **small creation form** (mode, address, name, structural type, shared details) and show only relevant fields or a clearly labeled "Set up short-term rental" section. Avoid collecting booking/payment details that have nowhere to go in phase 1. Preserve mode-specific data on a reversible switch; never silently erase leases, reservations, rates, or guidebooks when a panel becomes hidden.

## Phase 0 — Contract, domain, and conversion rules

1. Inventory every active web/mobile add/edit entry point, API property projection, unit/listing creation path, dashboard selector, filter, and property-limit calculation. Confirm how an existing single-family property maps to its managed unit, and whether multi-unit properties already represent every independently bookable space. Record current JSON enum casing and model binding.
2. Define a dedicated enum, e.g. `ERentalMode.LongTerm` / `ShortTerm`, persisted on the managed unit as a string, with SQL default `LongTerm` for existing rows. Set explicit default for omitted create payloads to retain legacy clients. Ensure updates from older clients that omit rental mode **preserve** the existing value instead of resetting it; a dedicated unit-mode-change command/endpoint is preferable to changing the existing full-property POST semantics. The creation-level choice populates unit defaults; it does not create a contradictory second source of truth on Property.
3. Define per-unit mode-switch policy and test it before UI: never delete associated data; block a long→short switch with active/scheduled leases or tenant obligations on that unit until safely closed; block a short→long switch with upcoming/active reservations or unresolved guest/payment obligations on that unit. Historical data remains accessible/auditable. Reversing an empty unit's change is allowed. Explicit warning plus confirmation is required whenever switching hides or disables workflows. Do not block a safe unit because another unit in the building has an active lease or stay. Property summaries must represent mixed modes rather than pretending the whole building is one type.
4. Clarify that `IsOccupied`/rent-roll and unit entitlements have long-term semantics; agree on how short-term inventory counts against the existing 5-unit free plan before migration. Existing users must not be charged or locked out simply because a rental-mode column was added.

**Acceptance:** Documented defaults, switch preconditions and user-facing conflict messages; a migration/backfill strategy with a safe rollback path; no payment or reservation promise in phase 1.

## Phase 1 — Rental mode and conditional property management (first delivery slice)

### API and migration

5. Test-first: add API tests for existing units defaulting to LongTerm, explicit ShortTerm unit creation, single-family inventory, mixed-mode buildings, omitted field on legacy updates, invalid mode values, organization-scoped unit-mode changes, and both blocked/allowed switch scenarios. Likely tests: `property-peace-api.Tests/Services/Properties/PropertyCreationEntitlementTests.cs`, `PropertyOrganizationScopeAndReactivationTests.cs`; add a focused rental-mode test file if clearer.
6. Add `property-peace-api/Enums/ERentalMode.cs`, a mode field to the existing managed-unit model (identify exact path in phase 0), unit DTO read/create/write mapping and string conversion/default in its EF configuration, and a generated EF migration under `property-peace-api/Migrations/`. Audit `AutoMapperProfile.cs`, property/unit repository mapping and list/detail response contracts. Validate SQL default and legacy-client behavior with relational tests, not just in-memory tests.
7. In the unit service/controller identified in phase 0, enforce switch rules under existing organization scope and a server-side confirmation mechanism for valid changes. Prefer a dedicated unit-mode-change route over trusting a hidden field on general property update. Avoid a time-of-check/time-of-use race with lease/reservation creation; reevaluate blockers atomically at mutation time.

### Web

8. Test-first: add a **rental mode** selector early in `property-peace-app/src/pages/landlord/property-add-workflow.jsx`, distinct from its existing building-type step. Long-term selection follows today's flow; short-term selection shows shared fields and only supported short-term setup fields. Do not reuse monthly rent or bank-account onboarding as nightly rates or booking checkout. Update all active add paths discovered in phase 0.
9. Add unit-mode controls and context-sensitive fields/sections to the active unit editor and property detail/list projections (`src/sections/landlord/property/*`, `src/sections/landlord/properties/*` as needed); inspect `property-peace-app/src/components/drawers/PropertyEditDrawer.jsx` for any creation/default behavior. Show a Mixed label for a building with both modes, and an explicit change-mode action per unit with preflight conflict text; no implicit conversion when editing building type. Hide irrelevant long-term actions for short-term units, but retain historical access where needed.
10. Add focused web tests alongside `src/pages/landlord/property-add-readiness.test.js` and the edit/detail surfaces: both creation choices, conditional validation, cancel/retry preserving draft, failed conversion, and no regression to the original building-type/unit flow.

### Mobile

11. Test-first: fix/verify the existing add-property payload contract (`streetAddress` vs `address`, valid structural `propertyType`) in `property-peace-mobile/src/screens/landlord/AddPropertyScreen.tsx`, `src/features/properties/addressAutocomplete.ts`, and `src/api/propertyAPI.ts`. Add an explicit rental-mode type/mapper and regression test under `property-peace-mobile/scripts/`.
12. Add the same creation default and per-unit mode-specific supported fields to mobile add. In `PropertyDetailScreen.tsx` add an honest mixed-mode overview (no lease/rent-roll/tenant actions on short-term units) and a per-unit mode-change entry point only after the API guards and confirmation UI exist. Verify light/dark mode, accessibility labels, and refresh after switching; do not ship a control that implies reservations/payments already exist.

**Phase 1 acceptance:** Existing units and legacy clients remain LongTerm; new owners can initialize either mode and manage different units differently in one building; changing a safe empty unit works on web and mobile without affecting sibling units; conflicting changes are rejected without data loss; the API never uses `EPropertyType` to infer rental mode; no short-term unit accidentally enters lease/rent-collection workflows; no fake booking or payment affordances.

## Phase 2 — Short-term calendar and reservation foundation

13. Introduce organization-scoped bookable inventory, property timezone, inclusive check-in/exclusive checkout date ranges, manual blocks, and direct reservation states (pending payment, confirmed, cancelled, completed). Build calendar read/write APIs and an owner view, with overlap constraints and transactional holds to prevent **Property Peace direct-booking** conflicts.
14. Add iCal import/export per supported channel only after verifying each provider's current permitted sync method. Store source, external UID, timestamps, sync health and last-success time; make imports idempotent and handle edits/deletes/stale feeds safely. Show source labels and stale-sync warnings; iCal does not provide a live lock or full guest/price/payment data. Never promise perfect cross-channel double-booking prevention without authorized real-time channel APIs and tested race handling.
15. Add tests for same-day checkout/check-in, timezone/DST, concurrent booking attempts, duplicate events, delayed/failed feeds, manual blocks and cancellation/reversal. Specify how owners resolve external conflicts.

## Phase 3 — Direct booking and guest checkout (separate approval gate)

16. Define quote rules before coding: nightly rates, date overrides, minimum stays, discounts, cleaning fees, taxes, security deposits, refunds/cancellations and all-in price display. Make quote, availability hold, payment authorization/capture, webhook reconciliation and reservation confirmation a single idempotent business flow; expired/failed checkout releases the hold. Do not reuse lease/rent payment records for stays.
17. Define guest-facing listing and checkout, confirmation emails, privacy/identity and fraud controls, accessibility, support and dispute flows. **Payment ownership/payout model and money movement require a dedicated security/compliance review**: verify merchant-of-record, Stripe Connect account capabilities/authorization, manager-owner authority, KYC, fraud holds, reversals and taxes; current Property Peace payment gates must stay off until the redesign/testing criteria are met. Channel-origin reservations remain governed by the channel's payment rules.
18. Prove two concurrent guest attempts cannot confirm the same nights, webhook retries cannot duplicate charges or reservations, and a paid guest always receives a recoverable confirmation or refund workflow. Publish only after sandbox-to-production and operational readiness gates.

## Phase 4 — Guest operations, guidebooks, and owner reporting

19. Send opted-in, channel-permitted, timezone-aware messages for **direct bookings** (check-in, checkout, review request); templates, consent/unsubscribe where applicable, delivery status, retry, audit and manual override. Treat third-party guest messaging as a separate integration gated on provider permission/data access.
20. Add property-scoped digital guidebooks with access boundaries (public preview vs confirmed guest details), expiring stay links where needed, Wi-Fi, house rules, local places, emergency contacts and owner-maintained updates. Do not expose door codes or sensitive instructions to unverified visitors.
21. Add short-term dashboard definitions: occupied nights / available nights, booking-source attribution, gross vs net booking income, payment fees, refunds, taxes, expenses and period profit; keep imported-channel revenue unknown unless explicitly supplied/authorized. Distinguish booked dates from paid revenue and avoid blending nightly metrics with long-term rent roll.

## Validation and delivery gates

- Keep all work on `dev`; no push, merge, production migration or enablement without explicit instruction. Before coding, inventory and preserve the current dirty worktree; avoid touching its unrelated mobile changes.
- Run focused API relational + service tests, web property-creation/edit tests and mobile property/navigation tests, plus type/build checks only when implementation is requested and consistent with the user's current CI preference. Do not use production DB for validation. For a nonbreaking development migration, review then apply via `dotnet ef database update` to the configured **dev** database; do not apply a potentially breaking migration without review.
- Check web/mobile create → list → detail → edit → safe switch → conflicting switch → refresh, including mixed portfolios, older records, old-client updates, multi-unit inventory, owner permissions and dark mode. CI, deployment, App Store processing and device verification are separate milestones.
- Document the actual state in release notes/marketing: selectable short-term mode is not synonymous with a working booking engine, real-time channel sync, or active payouts.

## Open decisions before phase 1 implementation

1. **Resolved:** mode is per independently managed unit. The property-creation choice seeds its units; a single-family home maps to one managed inventory record. Confirm the current unit model and creation semantics in phase 0 before implementing the migration.
2. On a long-term property with historical but no active lease, should switching archive/hide the former workflow or show read-only history? Recommendation: retain read-only history.
3. For initial short-term setup, which fields should be editable before booking is available—nightly price/minimum stay/check-in/out, or only shared property information? Recommendation: shared details first, then dedicated setup in Phase 2/3.
4. How do short-term listings/bookable units count toward the current Free 5 / Premium unlimited unit entitlement? Recommendation: same bookable-inventory count until pricing is explicitly revisited.
5. Should mobile support full conversion in the first release, or creation/visibility first with guarded conversion on web? User requested post-creation switching; recommended first delivery includes web and mobile parity, unless rollout risk warrants an explicit staged exception.
6. Will first calendar integration be import-only, or two-way export and import? What expectations should owners see for sync delay and conflict recovery? Decide after current provider documentation is verified.

**Implementation sequence recommendation:** Approve the model/conversion rules first; ship Phase 1 as a truthful property-mode foundation; build Phase 2 availability before offering direct booking/checkout; gate money movement independently; then add automation and analytics. Each phase must preserve long-term workflows for existing owners.
