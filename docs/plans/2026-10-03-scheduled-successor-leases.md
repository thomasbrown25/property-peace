# Scheduled Successor Leases Implementation Plan

> **For Hermes:** Implement on the existing `dev` checkout. Do not commit, push, deploy, restart the app/API, or modify unrelated WIP.

**Goal:** Permit a landlord to schedule a new tenant's lease for an occupied unit without replacing the current resident's lease, with a new start date on or after the existing end date.

**Architecture:** Store each contract as a distinct Lease row associated with a Unit (one-to-many instead of one-to-one). `IsActive` continues to mean finalized, not physically occupying; draft and scheduled are separate states derived from agreement flag and term dates. Unit/current projections choose the outgoing lease through its end date; if incoming starts on that same calendar date, it becomes the current lease the next day (date-only representation cannot order events within a day). By-ID reads always address the requested contract. Expose scheduled leases alongside the current lease to selection/list views.

**Tech stack:** ASP.NET Core/EF Core SQL Server; React, Formik/Yup; xUnit and node tests.

**Scope boundary:** Existing changes to conversation unread, listing readiness, and marketing assets are unrelated and must remain untouched. No production migration; local source migration only. Keep existing lease details, agreement, signature and historical tenant associations intact. No automatic termination/move-out of a current tenant at scheduling time.

## Acceptance conditions

- Unit with a finalized lease ending Oct 31 accepts a separate finalized successor starting Oct 31 or later; rejects Oct 30 and missing incumbent end date. Future successors cannot overlap one another; different units independent.
- Reject overlap on initial create, finalizing a draft, and editing either lease's term. A failed request does not mutate either contract or occupancy. Scoped to the authenticated organization and unit. Prevent competing creates with transaction-level serialization or equivalent DB guarantee.
- A newly saved future lease does not change `Unit.IsOccupied`, `Property.IsOccupied`, current lease displays, current tenant, billing or renewal selection. Prior residents are not linked automatically to the successor.
- Landlord creation UI offers occupied units, shows incumbent end date, validates calendar dates, and displays backend conflicts. Current and scheduled contracts are individually discoverable and navigable by lease ID.
- Current lease persists through its end date (inclusive); same-day incoming contract is scheduled until the next day. On first date thereafter the successor is current. Date-only boundary is documented to users.

## Implementation tasks (test-first for each behavior)

1. **Schema and migration.** Tests: relational model shows many leases per unit and a nonunique index on `Leases.UnitId`. Change `property-peace-api/Models/Unit.cs`, `Configurations/UnitConfig.cs` and all `unit.Lease` assumptions to collection-aware current selection. Add an EF migration that drops unique `IX_Leases_UnitId` and recreates a nonunique index. Validate migration snapshot and SQL without touching live databases.
2. **Term conflicts.** Tests in `property-peace-api.Tests/Repositories/Leases/` for equal boundary, earlier start, missing end, overlapping scheduled successor, other unit, draft completion, term edits. Centralize date-only conflict check in `Repositories/Leases/LeaseRepository.cs`; only nondeleted finalized leases reserve intervals. Validate complete drafts and updates too. Return a client-meaningful 400/409 response rather than a generic 500.
3. **Creation semantics.** Tests in `property-peace-api.Tests/Services/Leases/LeaseServiceTests.cs` for ID-less second lease inserts without touching the incumbent, and ID-based edits still update the selected contract. In `Services/LeaseService/LeaseService.cs` remove implicit update-by-unit, use explicit ID for edits, and do not replace occupancy from a future lease.
4. **Current and upcoming queries.** Tests for outgoing-wins same-day selection, successor selection after end, and no candidate when vacant. Update `Repositories/Leases/LeaseRepository.cs`, `Repositories/Units/UnitRepository.cs`, property and portfolio projections, tenant views and `GET api/Lease/{unitId}`. Introduce a scoped list endpoint or nested DTO list to expose scheduled leases without changing by-ID semantics. Audit billing, auto-renewal and end/delete occupancy changes.
5. **Tenant isolation.** Test that creating a successor never copies the prior unit's tenant links, while explicit tenant assignment remains possible. Update `LeaseRepository.AddLease` and tenant assignment/read mapping.
6. **Landlord UI.** Node tests for date-only comparison and boundary rule (same day allowed); UI tests for choosing occupied unit, date minimum and server conflict. Update `property-peace-app/src/components/drawers/LeaseAddDrawer.jsx`, `src/utils/leaseDraft.js`, legacy wizard and bulk creation flows. Show scheduled records separately from currently occupied lease in property and lease pages; preserve by-ID agreement navigation.
7. **Final verification.** Re-run focused API tests and app tests, compile API, build app if safe in temp to avoid active processes, inspect `git diff --check`, migration/up-down SQL, worktree status, and review the scoped diff. Do not claim deployment or end-to-end readiness if any path remains unverified.

**Risk notes:** SQL uniqueness and one-to-one mapping prevent a simple form-only fix. Same-day lease dates create a deliberate outgoing-wins display convention, but operational handoff inside a day is not modeled. Month-to-month auto-renew must not extend into a booked successor. Unit occupancy is derived from current-term leases, not merely `IsActive`. Migration requires coordinated rollout; do not run against production without explicit request.
