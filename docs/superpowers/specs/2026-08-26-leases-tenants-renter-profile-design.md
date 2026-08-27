# Leases, Tenants, and Renter Profile Consolidation Design

**Date:** 2026-08-26

**Status:** Approved design

**Target branch:** `dev`

## Summary

Consolidate tenant directory management into the Leases workspace, remove the standalone Tenants navigation destination, and replace the current tenant-detail experience with a full renter profile.

The Leases page will expose three top-level tabs in this order:

1. Leases
2. Tenants
3. Lease agreements

The Tenants tab will reuse the existing tenant directory capabilities in an embedded mode. Selecting a renter will open a canonical renter profile at `/landlord/renters/:renterId`. Legacy tenant list and detail URLs will redirect to their new destinations so bookmarks and older links remain valid.

## Goals

- Make Leases the single workspace for lease and tenant directory management.
- Remove the Tenants item from the landlord side navigation.
- Preserve all current tenant list, search, filtering, import, add, edit, and lease-assignment capabilities.
- Introduce a useful renter profile with Profile, Leases, Transactions, Insurance, Applications, and Requests tabs.
- Populate every tab from existing renter-linked records and show honest, actionable empty states when no records exist.
- Keep the result visually native to Property Peace rather than reproducing the reference screenshots.
- Preserve legacy URLs through redirects and update all in-app links to canonical destinations.
- Maintain keyboard accessibility, responsive behavior, dark-mode compatibility, and clear loading/error states.

## Non-goals

- Replacing the tenant data model with a separately persisted renter entity.
- Adding fictional balances, deposits, credits, or invoices that are not supported by current ledger data.
- Building a single large renter-profile backend aggregation endpoint.
- Replacing the existing tenant import workflow.
- Redesigning lease details, maintenance details, or application details beyond the links needed from the renter profile.
- Renaming the Leases workspace tab from Tenants to Renters.

## Terminology

- **Tenants** describes the directory tab inside the Leases workspace.
- **Renter profile** describes an individual person's detail experience.
- Existing backend `Tenant` models and API names remain unchanged.
- User-facing profile copy should prefer “renter” where it refers to the person or profile, while established lease/legal copy may continue to use “tenant.”

## Information Architecture and Routes

### Canonical routes

| Destination | Route |
| --- | --- |
| Leases tab | `/landlord/leases` |
| Tenants tab | `/landlord/leases?tab=tenants` |
| Lease agreements tab | `/landlord/leases?tab=agreements` |
| Renter profile | `/landlord/renters/:renterId` |
| Renter profile tab | `/landlord/renters/:renterId?tab=<tab-key>` |

Supported renter-profile tab keys are `profile`, `leases`, `transactions`, `insurance`, `applications`, and `requests`. Missing or invalid tab keys resolve to `profile` without producing a broken state.

### Legacy routes

| Legacy route | Behavior |
| --- | --- |
| `/landlord/tenants` | Replace-navigation redirect to `/landlord/leases?tab=tenants` |
| `/landlord/tenants/:tenantId` | Replace-navigation redirect to `/landlord/renters/:tenantId` |

The tenant import workflow may remain at `/landlord/tenants/import`, but its breadcrumbs, completion navigation, cancel action, and back action must return to `/landlord/leases?tab=tenants`.

### Link contract

- Links whose destination is the tenant directory use `/landlord/leases?tab=tenants`.
- Links that represent a specific renter use `/landlord/renters/:renterId`.
- Search results, activity entries, property/unit tenant links, message context, lease flows, and other dynamic tenant links must follow the specific-renter contract.
- Breadcrumbs and back buttons on the renter profile point through the Leases/Tenants hierarchy.
- No active landlord navigation item points at `/landlord/tenants`.

## Leases Workspace Changes

### Tab state

The URL is the source of truth for the Leases page's top-level tab:

- no `tab` parameter or an unsupported value: Leases
- `tab=tenants`: Tenants
- `tab=agreements`: Lease agreements

Changing tabs updates the query string using React Router navigation while preserving only query parameters that remain meaningful for the selected workspace. Existing lease-list `view` filters continue to apply to the Leases tab and must not incorrectly select a top-level tab.

Browser back/forward navigation must update the selected tab.

### Embedded tenant directory

`TenantsContent` becomes reusable in two modes:

- page mode, retained only as necessary for compatibility during the transition
- embedded mode, used inside the Leases page

Embedded mode omits its standalone page header and breadcrumb. Tenant-specific controls such as Add tenant and Import remain visible in a compact directory toolbar within the tab. Existing list metrics, filters, responsive cards/table, drawers, dialogs, and CSV import entry point remain functional.

The Leases page owns the top-level breadcrumb and tab shell. The directory component owns only tenant-directory content and actions.

## Renter Profile Experience

### Page shell

Breadcrumb:

`Dashboard / Leases / Tenants / <Renter name>`

The page uses a responsive two-column layout on desktop:

```text
┌─ Renter snapshot ──────┐  ┌─ Page actions ─────────────────────┐
│ identity and contact   │  │ Profile Leases Transactions ...   │
│ current residence      │  ├────────────────────────────────────┤
│ portal status          │  │ selected tab content               │
│ residency track        │  │                                    │
└────────────────────────┘  └────────────────────────────────────┘
```

The left snapshot is supportive context, not a duplicate page header. It contains:

- profile image or initials
- renter name
- email and phone when available
- portal connection/invite state
- current property and unit
- current lease status and dates
- a compact residency track showing the current home and next lease milestone

The residency track is the page's signature visual. It encodes real lease information and must not become decorative progress UI.

On smaller screens, the snapshot becomes a compact full-width summary above the tabs. Secondary details may collapse behind a clearly labelled disclosure, while the renter name, portal status, residence, and primary actions remain visible.

### Page actions

Use existing Property Peace vocabulary and capabilities:

- Message
- Add charge, enabled only when an applicable lease exists
- Actions menu containing Edit renter, Invite to portal when eligible, and other existing renter-level actions that are safe in context

Destructive lease-removal actions remain inside the relevant lease record rather than the global page menu unless there is an unambiguous active lease.

### Profile tabs

Tabs are URL-addressable and keyboard navigable. Tab panels load their heavier data on first activation and retain it for subsequent tab changes during the session.

#### Profile

Show:

- personal information: first name, last name, email, phone, and available date of birth
- forwarding/current address when available
- emergency contact
- pets
- vehicles
- general renter attachments

The `Tenant` record is authoritative for current name and contact information. When an application is linked through `ConvertedToTenantId`, its profile fields may enrich date of birth, prior/current address, emergency contact, pet, and vehicle sections. Application data must not overwrite newer tenant fields.

Empty household sections use concise messages such as “No emergency contact added” and offer Edit renter only when the existing edit flow supports the field. Do not display unavailable values as misleading zeroes.

#### Leases

Show active, draft, and historical leases associated with the renter. Each record includes:

- lease/property/unit identity
- status
- start and end dates
- rent amount when available
- portal invite action when relevant
- View lease action
- Remove from lease action with existing confirmation and authorization behavior

The active lease appears first, followed by drafts and history in reverse chronological order.

#### Transactions

Use `/api/payment/tenant/:renterId`. Present payment records grouped by month with:

- status
- due date and/or payment date
- payment category
- property or lease context
- amount
- on-time/late interpretation only when supported by actual due-date and lease terms

Reuse the current payment reliability calculation where valid. Do not infer an outstanding ledger balance from payment history alone. Add charge is a page action; transaction rows link to an existing payment or lease payment-history destination when one exists.

#### Insurance

Use `/api/TenantDocument/tenant/:renterId` and document types `RenterInsurance` and `LiabilityInsurance`. Show:

- policy/document name
- insurance type
- linked lease/property when available
- upload date
- expiration date and status
- download action
- upload insurance document action

Show whether the active lease requires renters insurance when that lease field is available. A requirement is not proof of coverage; the UI must distinguish “Required” from “Document on file.”

#### Applications

Load landlord applications and match the renter by exact `ConvertedToTenantId`. Each application includes:

- property/unit
- application status
- submitted/reviewed dates
- screening state when available
- View application action
- View/download PDF action when available

Email matching may be used only as a clearly documented legacy fallback when there is no converted tenant identifier and the email match is exact within the current organization. It must never override an exact identifier match.

#### Requests

Use the canonical maintenance request list and filter by exact `SubmittedByTenantId`. Each record includes:

- request/order number and title
- property/unit
- priority or urgency
- status
- submitted, scheduled, and completed dates when present
- assigned party when available
- View request action

Records submitted only under older identity fields may be shown through an explicit, organization-scoped fallback only if the existing API supplies a safe exact association. Do not associate requests solely because a later renter occupies the same unit.

## Visual Direction

### Subject and single job

This is an operational renter record for independent landlords and property managers. Its single job is to answer: “What do I need to know or do about this renter right now?”

### Tokens

- Brand navy: `#061e35` for primary text and strong structure
- Property Peace green: `#41a541` for active states and positive actions
- Warm app canvas: `#f9f6f4`
- Paper: `#ffffff` in light mode and existing theme surfaces in dark mode
- Border/slate: existing `divider`, `text.secondary`, and semantic palette tokens
- Status colors: theme `success`, `warning`, `error`, and `info`; never use color as the only status indicator

Hard-coded light-mode surfaces should be avoided. Components derive colors from the theme so dark mode remains supported.

### Typography

- Poppins for the renter name, tab-section headings, and key lease/property labels
- Inter for body copy, controls, dates, statuses, and financial values
- Existing app type scale and button casing remain authoritative

### Shape and elevation

- Transparent page header and breadcrumb region
- One quiet identity surface and one main content surface on desktop
- Thin dividers and restrained borders rather than a card around every field
- Moderate corner radius consistent with the current application
- Minimal shadow; elevation communicates sticky or raised regions only

### Motion

Use a single restrained tab-content transition if it does not interfere with reduced-motion preferences. Hover and focus states remain functional rather than decorative. No ambient animation is needed.

## Data Loading and State

- The base tenant record loads first because it supplies identity and authorization context.
- Lease data loads with the profile shell because it drives residence, actions, and the residency track.
- Transactions, insurance documents, applications, and requests load lazily when their tabs are first opened.
- Each tab owns independent loading, empty, success, and error states so one failed endpoint does not blank the whole profile.
- Retry actions operate per tab.
- Stale requests must not replace state after navigating to another renter.
- Data adapters normalize camelCase/PascalCase API variants at the boundary rather than throughout presentation components.

## Component Structure

The current monolithic `tenant.jsx` should be decomposed into focused renter-profile components under a renter-profile section directory. Suggested responsibilities:

- `RenterProfilePage`: route params, base orchestration, breadcrumbs, URL tab state
- `RenterSnapshot`: identity, contact, residence, portal status, residency track
- `RenterProfileActions`: message, charge, edit, invite, overflow actions
- `RenterProfileTabs`: accessible tab navigation and panel shell
- one component per tab: Profile, Leases, Transactions, Insurance, Applications, Requests
- renter data adapters/hooks: field normalization, association rules, and lazy endpoint loading

Existing edit, message, payment, invite, document, and confirmation components should be reused where they fit the approved behavior.

## Accessibility

- Tabs use correct `role`, `aria-controls`, `aria-labelledby`, and arrow-key behavior through MUI Tabs.
- Every icon-only action has an accessible name and tooltip where needed.
- Status labels include text, not color alone.
- Focus rings remain visible against light and dark surfaces.
- Contact links use semantic `mailto:` and `tel:` behavior where appropriate.
- Sticky desktop behavior must not trap keyboard focus or obscure content at browser zoom.
- Empty and error states are announced clearly and include a next action when one exists.

## Responsive Behavior

- Desktop: snapshot rail plus main content panel.
- Tablet: narrower snapshot rail or stacked identity summary depending on available width.
- Mobile: stacked summary, horizontally scrollable tabs, single-column records, and full-width primary actions where appropriate.
- Dense transaction tables become labelled record cards on narrow screens rather than forcing horizontal page overflow.
- The profile remains usable at 200% zoom and at the app's supported small breakpoint.

## Testing and Verification

### Routing and navigation

- Leases top-level tab is derived from and updates the URL.
- Browser back/forward restores the correct Leases tab and renter-profile tab.
- Legacy list and detail routes redirect with replace semantics.
- Tenant directory links target the Leases/Tenants tab.
- Individual renter links target the canonical renter profile.
- The Tenants side-nav item is absent.

### Data association

- Applications match exact `ConvertedToTenantId` before any fallback.
- Requests match exact `SubmittedByTenantId` and do not leak records based on shared units.
- Insurance shows only renter/liability insurance document types for the renter.
- Current and historical leases are deduplicated.
- Transactions retain the existing organization authorization and renter scope.

### Interaction and presentation

- Directory add/import/edit/assignment flows still work when embedded.
- Each renter-profile tab handles loading, empty, error, retry, and populated states.
- Page actions enable and disable from real capability state.
- Responsive layouts are checked at mobile, tablet, and desktop widths.
- Light and dark themes maintain readable contrast.
- Keyboard navigation and visible focus are verified.

### Regression verification

- Run targeted frontend unit/architecture tests for routes, tab mapping, link helpers, and renter association adapters.
- Run existing tenant, lease, application, maintenance, payment, and document-related tests affected by the change.
- Run the frontend production build.
- Run backend tests only if implementation changes backend code; the approved design is expected to reuse existing endpoints.

## Rollout and Compatibility

- Land the canonical routes and redirects in the same change as link updates to avoid dead destinations.
- Keep redirect routes for legacy bookmarks and externally delivered links.
- Do not remove backend tenant APIs or models.
- No data migration is required.
- Existing links from notifications or activation flows must remain valid through either direct updates or the redirect layer.

## Acceptance Criteria

1. Leases shows Leases, Tenants, and Lease agreements tabs with URL-synchronized selection.
2. The Tenants directory is fully usable inside Leases without a duplicate header or breadcrumb.
3. The landlord side navigation no longer contains a Tenants item.
4. Every tenant-directory link opens `/landlord/leases?tab=tenants`.
5. Every individual-renter link opens `/landlord/renters/:renterId` or reaches it through a compatibility redirect.
6. The renter profile includes all six approved tabs with real data or useful empty states.
7. The profile follows the approved Property Peace visual direction and responsive layout.
8. Legacy tenant list and detail URLs continue to work through redirects.
9. Tenant import returns to the embedded Tenants directory.
10. Targeted tests and the production build pass, with any pre-existing environmental failures reported separately.
