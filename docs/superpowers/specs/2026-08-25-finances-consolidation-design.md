# Finances Consolidation Design

## Summary

Replace the separate landlord Expenses, Payments, and Ledger list pages with one `Finances` workspace. The new page keeps the operational capabilities of Expenses and Payments, preserves the Ledger's useful combined activity view, and removes `Ledger` as a landlord-facing accounting concept.

The Finances workspace uses these top-level tabs:

1. `Needs review`
2. `Activity`
3. `Expenses`
4. `Payments`
5. `Upcoming`

`Upcoming` combines recurring expenses and one-time future expenses in a single date-sorted list. The current Ledger page's `Account activity` card moves into the Finances right rail and replaces the Expenses page's `Spend by category` card.

This change also absorbs the existing server-backed Money page into Finances. The `/api/money-center` contract remains the authoritative source for overview, review, activity, and export data even though `Money Center` is retired as a user-facing name. It does not implement Plaid, connect a bank account, or create new bank-transaction classification behavior.

## Goals

- Give landlords one place to understand and manage money in, money out, and scheduled expenses.
- Remove redundant Expenses, Payments, and Ledger destinations from the Accounting navigation.
- Preserve all existing payment and expense record actions.
- Preserve the useful combined chronological activity and account summary currently shown by Ledger.
- Preserve the useful review, activity, calculation-disclosure, and export signals currently provided by Money Center.
- Prepare a clear `Needs review` destination for future imported bank activity without claiming that bank sync already exists.
- Keep old list-page URLs functional through redirects.
- Avoid creating one oversized page component by separating tab content, presentation, and financial derivation logic.

## Non-goals

This consolidation will not:

- Integrate Plaid or another financial-data provider.
- Add bank connection, consent, refresh, relink, or disconnection flows.
- Add transaction classification, bank-to-expense matching, or automatic categorization.
- Redesign the expense creation, payment recording, receipt, tax-center, or reporting workflows.
- Convert the current derived Ledger into a double-entry general ledger.
- Change the persisted accounting treatment of rent, fees, deposits, or expenses.
- Remove payment-recording workflow routes such as `/landlord/payments/record` or `/landlord/payments/add`.
- Change backend API contracts.
- Rename the internal `/api/money-center` route or its service contracts.

## Navigation and Routes

Remove the `Money Center` navigation group. Move its `Rent Collection` destination into Accounting.

The Accounting navigation becomes:

- `Finances` at `/landlord/finances`
- `Rent Collection` at `/landlord/rent-collection`
- `Tax Center`
- `Reports & Analytics`

Remove the standalone `Payments`, `Expenses`, and `Ledger` navigation items.

Preserve existing bookmarks and internal links with redirects:

- `/landlord/expenses` redirects to `/landlord/finances?tab=expenses`.
- `/landlord/payments` redirects to `/landlord/finances?tab=payments`.
- `/landlord/ledger` redirects to `/landlord/finances?tab=activity`.
- `/landlord/money` redirects to `/landlord/finances?tab=activity`.
- `/landlord/money-activity` and legacy property-scoped Money Activity URLs redirect to the equivalent Finances Activity scope.

The list-page modules for Payments and Ledger are deleted after their required UI and behavior move into Finances. The existing Expenses list page is replaced by the Finances page rather than left as a second implementation.

Links elsewhere in the app that intend to open a list are updated to the canonical Finances URL and correct tab. Actions that open payment or expense drawers remain actions rather than navigation links.

## Finances Page Structure

### Header

The page breadcrumb and title become `Finances`. Supporting text explains that the page covers collected payments, expenses, cash activity, and upcoming costs.

Header actions are:

- `Export`, scoped to the active tab's visible records.
- `Add`, opening a compact menu with `Add expense` and `Record payment`.

Existing creation drawers remain the source of truth. The Finances page refreshes the relevant data after a drawer closes following a successful save.

### Shared scope

A shared property selector and date-period selector control the page metrics, Activity tab, and Account activity card. The default period is `This year`, matching the current Expenses, Payments, and Ledger list pages. Search and type/status controls remain tab-specific so expense filters do not leak into payment or upcoming views.

The active tab is represented by the `tab` query parameter. Supported values are `review`, `activity`, `expenses`, `payments`, and `upcoming`. Invalid or absent values fall back to `activity`.

### Overview cards

Show four cards above the tabs:

- `Income`: completed payment total in the selected property/date scope.
- `Expenses`: paid expense total in the selected property/date scope.
- `Net cash flow`: Income minus paid Expenses in the selected property/date scope.
- `Collected this month`: completed payment total in the current calendar month, still constrained by the selected property.

These calculations intentionally preserve current payment and expense semantics. Broader accounting corrections, including deposit-liability treatment, are separate work.

Selecting Income opens or filters the Payments tab. Selecting Expenses opens or filters the Expenses tab. Selecting Net cash flow opens Activity. Selecting Collected this month opens Payments with the current-month period.

## Tabs

### Needs review

This tab combines the existing Money Center attention signals and is also the future home for imported bank activity that has not been classified or matched. In this consolidation release it shows real source records for:

- Uncategorized expenses.
- Expenses missing receipts.
- Overdue obligations.
- Payment settlement exceptions.

When none of those real records need review, the empty copy states that the books are caught up and that imported bank transactions will also appear here after bank connections are added. No disabled or nonfunctional connection button is shown. The tab does not fabricate source records and does not call Plaid.

Future bank-sync work can replace this state without restructuring the Finances page.

### Activity

Activity replaces the standalone Ledger page and the Money Center activity drill-down. The server-backed Money Center items endpoint is the primary source. It combines:

- Completed payment records as positive activity.
- Paid expense records as negative activity.

Rows retain the useful Ledger details: description, account/category, date, amount, property/unit, and running balance. The running balance is a view-relative activity balance, not a bank balance, and the UI must label or explain it accordingly.

Activity supports search, property/date scope, transaction type, account/category, sorting, pagination, and CSV export. Failed, canceled, disputed, processing, unpaid, recurring, and future records do not affect this posted cash view.

### Expenses

Move the current Expenses transaction list and its behavior into this tab:

- Search and filters.
- Paid, unpaid, deductible, and receipt states.
- Add, edit, mark paid, and delete actions.
- Receipt indicators.
- Pagination and CSV export.

The current `Spend by category` right-rail card is removed. The existing tax-readiness guidance remains below Account activity as the second right-rail card.

### Payments

Move the current Payments list and behavior into this tab:

- Rent, fee, and deposit types.
- Completed, processing, failed, disputed, and canceled statuses.
- Online and manual sources.
- Record, edit, and delete actions.
- Search, filters, pagination, and CSV export.

The existing payment drawer and payment safety behavior remain unchanged. Removing the standalone page must not remove failure/dispute visibility or alter tenant and lease balances.

### Upcoming

Combine recurring expense schedules and one-time future expenses into one list. Sort all rows by their next actionable date:

- Recurring expenses use `nextOccurrenceDate`.
- One-time future expenses use `dueDate`.

Each row includes a `Recurring` or `One-time` type chip. Preserve existing actions:

- Record as paid.
- Pause or resume recurring schedules.
- Delete a recurring schedule.
- Delete a one-time future expense.

Search and property filtering apply across both types. Type can be narrowed with a lightweight `All`, `Recurring`, or `One-time` filter rather than separate top-level tabs.

## Account Activity Right Rail

Move the current Ledger `Account activity` component to the Finances right rail, replacing `Spend by category`.

The card:

- Uses posted Activity entries within the shared property/date scope.
- Groups entries by account/category name.
- Ranks the largest groups by absolute activity amount.
- Keeps the current compact bar presentation.
- Shows a clear empty state when no posted activity exists.

Selecting an account switches to the Activity tab and applies that account filter. This behavior is consistent regardless of which tab was active when the landlord selected the account.

The card does not imply that these groups are connected bank accounts. Its supporting copy continues to describe them as accounting activity within the selected period.

## Client Architecture

Create a focused Finances page that composes isolated modules rather than copying both large legacy pages into one file.

Required boundaries:

- A Finances page controller owns the active tab, shared property/date scope, refresh coordination, and creation actions.
- A pure finance-activity module normalizes payments and paid expenses into a shared activity-entry shape and derives metrics, running balance, and account summaries.
- Each tab owns its specific filters, pagination, table/list presentation, empty/error states, and row actions.
- Upcoming uses a pure combiner that normalizes recurring and future expenses into a single scheduled-entry shape.
- Account activity consumes already-derived Activity entries rather than fetching its own duplicate data.

Fetch the Money Center overview/items once per shared scope for cards, Needs review, Activity, Account activity, calculation disclosure, and export. Fetch payments, expenses, recurring expenses, and future expenses once per relevant shared scope for their editable tabs. Do not issue a second overview/items request solely for Account activity.

The implementation may reuse existing row and filter components, but tab-specific behavior must remain understandable without reading the entire Finances page.

## Data and Refresh Flow

1. Finances loads the organization-scoped Money Center overview and items for the selected date/property scope.
2. Finances separately loads the editable payment, expense, recurring-expense, and future-expense collections required by their tabs.
3. Needs review filters real Money Center items using the overview attention signals.
4. Activity renders Money Center items and derives the view-relative running balance.
5. Account activity groups the same Activity entries without another request.
6. Expenses and Payments tabs apply their own search, status, type, and sort filters.
7. Upcoming combines and sorts recurring and one-time future expenses.
8. After add, edit, mark-paid, pause/resume, or delete actions, refresh the affected editable collection plus Money Center overview/items when the change affects review signals, Activity, or overview metrics.

## Loading, Empty, and Error States

- Initial page loading uses the existing dashboard loading conventions.
- A failed payments request must not erase available expense or upcoming content; the Payments tab shows its retry state and shared metrics mark payment-dependent values unavailable rather than showing false zeroes.
- A failed expenses request behaves symmetrically.
- Activity explains which source failed if it can only show partial data.
- Needs review uses the explicit future-import empty state defined above.
- Upcoming distinguishes no scheduled expenses from filters that produced no results.
- Tab changes preserve shared property/date scope.
- Redirected legacy URLs resolve directly to the intended tab without flashing the wrong tab first.

## Accessibility and Responsive Behavior

- Tabs remain horizontally scrollable on narrow screens and expose their selected state.
- The `Add` menu and all row menus support keyboard navigation and meaningful labels.
- Metric cards remain buttons only when they perform the documented navigation/filter action.
- Status, transaction type, and recurring type are conveyed with text in addition to color.
- Mobile rows preserve the existing readable stacked treatment for expenses and payments.
- Account activity bars include visible labels and values; meaning does not depend on bar length alone.
- Focus moves predictably after tab changes, menu actions, and legacy-route redirects.

## Testing Strategy

Implementation follows test-driven development.

### Pure model tests

Cover:

- Payment and paid-expense normalization into Activity entries.
- Exclusion of unpaid expenses and non-completed payments from posted Activity.
- Income, Expenses, Net cash flow, and Collected this month calculations.
- Running-balance calculation and ordering.
- Account activity grouping and ranking.
- Recurring and one-time Upcoming normalization and date sorting.
- Invalid or missing dates and amounts.

### Page and interaction tests

Cover:

- Query-parameter tab selection and invalid-tab fallback.
- Metric-card navigation/filter behavior.
- Expense actions and refresh behavior.
- Payment actions and failure/dispute visibility.
- Upcoming type filters and recurring controls.
- Account activity selecting the Activity tab and account filter.
- Partial-source errors and retry actions.
- Needs review's truthful empty state.

### Navigation contract tests

Cover:

- Accounting navigation contains Finances, Tax Center, and Reports & Analytics.
- Standalone Payments, Expenses, and Ledger items are absent.
- Legacy list URLs redirect to the intended Finances tab.
- Legacy Money and Money Activity URLs redirect to Finances Activity.
- Money Center navigation is absent and Rent Collection is present under Accounting.
- Payment-recording workflow routes remain available.
- Internal list links use canonical Finances URLs.

### Verification

- Run focused Finances tests.
- Run existing expense, payment, transaction-filter, dashboard-loading, and accounting presentation tests.
- Run the main-app test suite relevant to routing and menu configuration.
- Run the main-app production build.
- Manually smoke-test desktop and narrow mobile layouts, every tab, metric navigation, creation drawers, edit/delete actions, legacy redirects, CSV export, and account filtering.

## Expected File Changes

Expected areas include:

- New Finances page and focused Finances section modules under `property-peace-app/src`.
- Pure finance-activity and upcoming-entry helpers with tests.
- `property-peace-app/src/routes/MainRoutes.jsx`.
- `property-peace-app/src/menu-items/pages.js`.
- Internal navigation links that currently target the old list pages.
- Existing payment and expense page code moved or decomposed into Finances tab modules.
- Existing Money Center client/API utilities reused behind the Finances presentation.
- Deletion or decomposition of `property-peace-app/src/components/money-center/MoneyCenter.jsx` and removal of the user-facing `money-activity.jsx` page wrapper after route migration.
- Deletion of the standalone `property-peace-app/src/pages/landlord/payments.jsx` and `property-peace-app/src/pages/landlord/ledger.jsx` list pages after route migration.
- Replacement of the old Expenses list-page module with the canonical Finances page.

No production backend change is expected for this consolidation.
