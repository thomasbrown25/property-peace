# Landlord Move-In and Move-Out Checklists Implementation Plan

> Draft for review. For implementation, use `superpowers:subagent-driven-development` or `superpowers:executing-plans` and run each phase’s checks before moving on.

**Goal** Give landlords a practical checklist for handing over or taking back a rental, with a condition report as one step in each workflow.

**Architecture** Store move-in and move-out task checklists separately. Reuse the existing inspection records and editors for condition reports. A checklist can link to a completed report, an in-progress report, or a report it starts for the selected rental.

**Tech stack** ASP.NET Core, EF Core and SQL Server, React/Vite, React Native/Expo, Next.js, and the existing Python starter-pack generator.

**Proposed design** [Landlord experience](#landlord-experience) and [starter checklist content](#starter-checklist-content).

## Landlord experience

On web and mobile, open **Checklists** and select a property and unit. Show **Move-in & move-out checklists** and **Condition reports** in that property context. From a lease, preselect its property and unit and open the relevant checklist. Starting from a property also works before a lease has been entered.

The landlord selects **Start move-in checklist** or **Start move-out checklist**, sees progress, and checks off tasks as they go. Applicable items can be marked **Not applicable** with the reason optional. The **Complete condition report** item offers **Start report** and **Use existing report**. After a report is linked, the item shows **Continue report** or **View report**, and its completion follows the linked report’s saved status. The landlord returns to the same checklist when leaving the report.

From **Condition reports**, the landlord can also start an independent room-by-room inspection for any visit. The form asks for the rental and inspection date and supports rooms, condition, notes, and photos. Lease association is optional. The move-in or move-out context appears on the checklist that links to the report. A new report is a single visit record. Historical pairs retain their comparison view. When both checklists for a lease have reports, the web app can compare them using the existing comparison view.

The public entry point is a printable **What to Document Before Handing Over the Keys** checklist that any landlord can use. Offer the move-out checklist and blank condition report beside it in the existing starter pack. The app CTA says **Start my move-in checklist**.

## Starter checklist content

Use these as the initial task templates. If a landlord has a signed lease, lease documents and records can be opened from the existing lease view. The task checkboxes record what the landlord did and when. The condition report links directly to its source record.

| Move-in checklist | Move-out checklist |
| --- | --- |
| Confirm the move-in date, handoff time, and tenant contacts. | Confirm the move-out date and possession handoff. |
| Save the signed lease and any applicable addenda or disclosures. | Record returned keys, remotes, passes, and other access devices. |
| Record move-in funds received and save the receipts, if applicable. | Complete a condition report and compare it with the move-in record, if available. |
| Check that cleaning, repairs, locks, and safety devices are ready. | Photograph and document repair or cleaning needs before work starts. |
| Complete the condition report and save dated photos with it. | Record final utility readings or transfers, if applicable. |
| Confirm utilities and record meter readings, if applicable. | Record the forwarding address or agreed contact method, if applicable. |
| Record which keys, remotes, passes, and access devices you handed over. | Review applicable deposit requirements and record any itemization, return, or follow-up. |
| Share the move-in records and emergency or maintenance contact details. | Log outstanding repairs or cleaning for the next turnover. |

The condition report is required for checklist completion. Designate funds, utilities, and forwarding details as applicable-only in the template. Keep legal requirements conditional on the rental’s jurisdiction. Keep amounts, credentials, and full tenant contact details in the product’s existing records.

## Phase 0 — Existing code and patterns

| Area | Existing implementation to build on |
| --- | --- |
| Inspection storage and media | `property-peace-api/Models/Checklist.cs`, `property-peace-api/Configurations/ChecklistConfig.cs`, `property-peace-api/Repositories/Checklists/ChecklistRepository.cs`, and `property-peace-api/Controllers/ChecklistController.cs` own inspection types `40` and `41`, scope, persistence, and photos. `ChecklistRepository.AddChecklist` currently limits a lease to one record per type. Preserve that rule for legacy types. |
| Scheduled reports and templates | `property-peace-api/Services/LeaseChecklistSchedulingService/LeaseChecklistSchedulingService.cs` creates opted-in move-in inspections. `property-peace-api/Services/ChecklistService/MoveInReportTemplateService.cs` manages the existing organization inspection template. The lease template-completion timestamp records setup, and the inspection record holds visit completion. |
| Web | `property-peace-app/src/pages/landlord/checklists.jsx`, `property-peace-app/src/pages/landlord/inspection-detail.jsx`, and `property-peace-app/src/api/checklist.js` own search, creation, and inspection editing. `property-peace-app/src/utils/leaseMoveIn.js` and `property-peace-app/src/sections/landlord/leases/LeaseDetailView.jsx` currently read inspection types for lease checklist readiness. `property-peace-app/src/routes/MainRoutes.jsx` preserves links with report and comparison IDs. |
| Mobile | `property-peace-mobile/src/navigation/ChecklistsNavigator.tsx`, `property-peace-mobile/src/screens/landlord/PropertyChecklistsScreen.tsx`, and `property-peace-mobile/src/screens/landlord/ChecklistEditorScreen.tsx` own navigation and editing. `property-peace-mobile/src/features/checklists/checklistWorkflow.ts` owns the legacy paired creation flow. `property-peace-mobile/src/api/checklistAPI.ts` owns transport and item photo uploads. |
| Public resources | `property-peace-marketing/scripts/generate-landlord-starter-pack.py` generates the room-level inspection PDF and ZIP. `property-peace-marketing/lib/blog-posts.ts`, `property-peace-marketing/app/resources/starter-pack/page.tsx`, and `property-peace-marketing/lib/resource-library.ts` define the public content and download links. |

## Phase 1 — API and storage

- [ ] Add `ConditionReport = 44` under the existing inspection storage. Use `GET /api/condition-reports` for scoped history and `POST /api/condition-reports` for one standalone report. Accept a client-generated request ID on creation so a retry returns the same report. Keep `GET /api/Checklist/{id}`, the update endpoint, and the item-photo endpoints as the common editor contract. Keep type 44 out of existing legacy list responses so installed mobile builds continue to see the types they understand. Return all three types in the new report history. New type-44 reports support multiple visits on the same rental or lease and have no counterpart. Preserve legacy IDs, values, photos, dates, template data, and pair links in place.
- [ ] Add `LeaseTransitionChecklist` and `LeaseTransitionChecklistItem` in the API models and EF configuration. Store organization, creator, property, unit, optional lease, phase, optional report ID, and item status and timestamps. Copy task text and stable keys into each checklist when created so future template edits apply to new checklists. Store `Pending`, `Done`, and `NotApplicable` for ordinary tasks and derive the report item’s status from the linked report. Project progress from the applicable tasks, including the required report item.
- [ ] Add `GET/POST /api/lease-transition-checklists` for history and creation, `GET /api/lease-transition-checklists/{id}` for detail, and `PUT /api/lease-transition-checklists/{id}/items/{key}` for one ordinary task update. One checklist per phase per lease is reopened on repeat start. Without a lease, distinct turnovers may have separate checklists. Reuse a client-generated request ID on retried creation. A checklist created from a lease inherits its property and unit.
- [ ] Add `PUT /api/lease-transition-checklists/{id}/condition-report`. With `reportId`, attach an eligible existing report. Without it, return the current linked report or create and attach a draft in one transaction. Enforce organization/property access and same property and unit on the server. When both records have leases, require them to match. A property-level legacy report with a null unit may use its matching lease’s unit, or the only unit of a single-unit property. A report can be attached to one handoff checklist at a time. `DELETE` on the same link endpoint detaches the report and makes the item pending again. If a linked report is deleted through an existing path, clear the link and retain the handoff checklist. An explicitly reopened report makes the task pending on the next load.
- [ ] Keep already configured lease scheduling as inspection scheduling. Offer an existing scheduled report in the move-in report picker. If the move-in checklist already has a linked report for that lease, the schedule should consider the report created. Historical and scheduled inspection completion counts toward the checklist only after the landlord links the report. Create task checklists on demand. Preserve checklist history if a lease is deleted and its property/unit still exists. Wire property, unit and organization cleanup into their existing delete flows and verify SQL Server foreign-key behavior.
- [ ] Add an additive EF migration. Run the API tests under `property-peace-api.Tests/Services/Checklists`, `property-peace-api.Tests/Repositories/Checklists`, and `property-peace-api.Tests/Services/Leases` for the new and legacy paths. Follow `ChecklistServiceSecurityTests.cs` for authorization and `ChecklistRepositoryPersistenceTests.cs` for persistence patterns. Verify the migration against a staging database seeded with completed, partial, paired, and scheduled legacy inspections before any rollout.

## Phase 2 — Web application

- [ ] Use the property/unit chooser in `property-peace-app/src/pages/landlord/checklists.jsx`. Add handoff history and a task-detail view consuming the new API. Retain the existing report and comparison links in `MainRoutes.jsx` and open neutral reports in `inspection-detail.jsx` using the existing room and photo editing components. Use the two linked report IDs to select the baseline and follow-up in the lease comparison. Show each report’s date, status, and tenancy context when available.
- [ ] Update `leaseMoveIn.js` and `LeaseDetailView.jsx` to use the new checklist’s progress for move-in and move-out readiness. Keep the existing customized template setup under its own label and the existing auto-scheduling choice under condition report terminology. A completed old inspection must never imply that keys, disclosures, or funds were handled.
- [ ] Cover task state, report linking, property and unit selection, route/back navigation, and the distinction between a report and lease readiness. Follow `property-peace-app/src/architecture/leaseChecklistNavigation.test.mjs` and `property-peace-app/src/utils/leaseMoveIn.test.js`. Verify `npm run build:web` at the repo root.

## Phase 3 — Mobile application

- [ ] Extend `ChecklistsNavigator.tsx` and `PropertyChecklistsScreen.tsx` with the same two entry points. Add a native task-list screen and reuse `ChecklistEditorScreen.tsx` and `checklistAPI.ts` for room editing, photos, and completion. Carry property, unit, optional lease, and origin checklist through navigation. Refresh progress when returning to the checklist and show save/retry feedback for failed writes.
- [ ] Use `checklistWorkflow.ts` pairing only for existing legacy inspection behavior. Open scheduled and legacy reports from history and allow a new neutral report to start with a clean room template. Verify that older app versions still load their current inspections when the new API and database migration are deployed ahead of the mobile release.
- [ ] Follow the `property-peace-mobile/scripts/checklists-workflow.test.mjs`, `checklists-editor.test.mjs`, and `checklists-parity.test.mjs` test patterns. Run `npm run test:checklists` and `npx tsc --noEmit` in `property-peace-mobile`. Smoke-test camera/library upload and progress handoff on iOS and Android, and open the same saved report on web.

## Phase 4 — Public checklist and starter pack

- [ ] Use the existing Python generator to add `move-in-checklist.pdf` and `move-out-checklist.pdf` and generate a neutral `condition-report.pdf` from the current room-by-room worksheet. Keep the old inspection PDF URL serving an equivalent document for existing external links. Put seven resources in the current ZIP, including the original turnover checklist, maintenance calendar, pre-screening worksheet, and cash-flow workbook. Update the README, download cards, resource counts, and ZIP descriptions together.
- [ ] Keep `/blog/landlord-move-in-move-out-checklist/` and `/resources/starter-pack/` at their current URLs. Use the task content above in the article, PDF, and app. Keep key/access records on the handoff checklist and per-room photos, notes, and physical condition in the report. Update the marketing condition-report feature copy and point the public CTA to the new checklist flow once it is live. Carry an allowlisted move-in intent through signup and property setup so a new landlord can resume the checklist. Existing signed-in landlords can start from their chosen property.
- [ ] Render the PDFs and check that the print layout has usable writing space, legible text, and no clipping. Verify all download links, ZIP contents, and that the public CTA reaches a real checklist for signed-in and newly registered users. Run `npm run test:marketing-claims` and `npm run build` in `property-peace-marketing`.

## Release verification

- [ ] A single-unit landlord can start either checklist without a lease. A multi-unit landlord must choose a unit before starting, and the report picker excludes other units and organizations.
- [ ] Repeated starts for the same lease and phase return one checklist. Retrying **Start report** after a lost response returns the same linked draft. Starting a neutral report creates exactly one visit record. The scheduler honors a report already linked to the move-in checklist for that lease.
- [ ] A saved draft report leaves its task pending. Completion updates the task on web and mobile. Reopen, detach, and delete restore pending status. A completed report for a different lease on the same unit is rejected.
- [ ] Existing inspections still open with their photos, notes, completion state, dates, and paired comparison. A legacy inspection can be linked by the landlord. Two linked reports for the same lease can also be compared. Existing scheduled inspections still run once and the new task checklist remains independent.
- [ ] Run the documented gates in `.github/workflows/property-peace-release-validation.yml` and `.github/workflows/build-gate-prod.yml`. API commands are `dotnet test property-peace-api.Tests/property-peace-api.Tests.csproj --configuration Release --nologo` and `dotnet build property-peace-api/property-peace-api.csproj --configuration Release --nologo`. Ship API compatibility first, then web and mobile, then release the public CTA when the web path is usable.
