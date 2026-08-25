# Finances Consolidation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task with review checkpoints.

**Goal:** Replace the landlord-facing Expenses, Payments, Ledger, and Money pages with one server-backed Finances workspace while preserving all existing record-management actions, review signals, activity details, exports, and legacy links.

**Architecture:** `/landlord/finances` becomes the only finance-list route. A small page controller owns URL scope, shared Money Center requests, creation actions, and refresh coordination; focused tab components own their editable collections and filters. Pure functions normalize Money Center activity and review records, calculate the current-month collection card, group account activity, and merge recurring and future expenses. The existing `/api/money-center` contract stays unchanged and authoritative for the overview, Needs review, Activity, Account activity, calculations, and Activity export.

**Tech Stack:** React 18, React Router, Material UI, Redux/Redux Thunk, Axios, `react-csv`, Node's built-in `node:test`, Vite.

**Spec:** `docs/superpowers/specs/2026-08-25-finances-consolidation-design.md`

## Global Constraints

- Do not change `property-peace-api` or any `/api/money-center` request/response contract.
- Do not add Plaid, bank connection UI, bank-account terminology, or fabricated review records.
- Keep `/landlord/payments/record` and `/landlord/payments/add` as real workflow routes.
- Preserve the current payment status/type/source semantics and expense paid/receipt/deductible semantics.
- Preserve unrelated working-tree changes. Inspect `git status --short` before every commit and stage only files from the current task.
- Follow red-green-refactor for every task: add the named failing test, run it and observe the expected failure, make the smallest implementation, rerun it, then run the adjacent regression tests.
- All query-string updates must preserve the selected shared scope (`period`, `from`, `to`, `propertyId`, `unitId`) unless a documented metric action intentionally changes it.
- All responsive tables/lists must retain readable stacked mobile rows; status and type may not be represented by color alone.

---

## Task 1: Add the pure Finances model

**Files:**

- Create: `property-peace-app/src/utils/finances.js`
- Create: `property-peace-app/src/utils/finances.test.js`
- Reuse: `property-peace-app/src/utils/moneyCenter.js`

- [ ] Write failing tests for tab/search normalization.

```js
test('finances defaults to Activity and keeps shared scope when tabs change', () => {
  assert.equal(normalizeFinancesTab(null), 'activity');
  assert.equal(normalizeFinancesTab('nonsense'), 'activity');
  assert.equal(normalizeFinancesTab('expenses'), 'expenses');

  const next = updateFinancesSearch(
    new URLSearchParams('period=ytd&propertyId=12&unitId=3&tab=review'),
    { tab: 'payments', status: 'completed' }
  );
  assert.equal(next.toString(), 'period=ytd&propertyId=12&unitId=3&tab=payments&status=completed');
});

test('finances uses year to date when the URL has no period', () => {
  assert.equal(buildFinancesMoneyQuery(new URLSearchParams(), new Date('2026-08-25T12:00:00Z')).from, '2026-01-01T00:00:00.000Z');
});
```

- [ ] Run `node --experimental-default-type=module --test src/utils/finances.test.js` from `property-peace-app`; expect `ERR_MODULE_NOT_FOUND` for `./finances.js`.
- [ ] Implement and export these URL helpers:

```js
export const FINANCES_TABS = ['review', 'activity', 'expenses', 'payments', 'upcoming'];

export function normalizeFinancesTab(value) {
  return FINANCES_TABS.includes(value) ? value : 'activity';
}

export function updateFinancesSearch(current, changes = {}) {
  const next = new URLSearchParams(current);
  Object.entries(changes).forEach(([key, value]) => {
    if (value === undefined || value === null || value === '') next.delete(key);
    else next.set(key, String(value));
  });
  next.set('tab', normalizeFinancesTab(next.get('tab')));
  return next;
}

export function buildFinancesMoneyQuery(search, now = new Date()) {
  const scoped = new URLSearchParams(search);
  if (!scoped.get('period')) scoped.set('period', 'ytd');
  return buildMoneyCenterQuery(scoped, now);
}
```

- [ ] Add failing tests for Money Center item normalization, exclusion, ordering, and running balance. Use fixtures with `cameIn`, `wentOut`, `obligation`, and `excluded` directions and assert that only posted cash directions become Activity entries.
- [ ] Implement `buildActivityEntries(items)` with this stable output shape:

```js
{
  id: item.sourceId,
  sourceId: item.sourceId,
  sourceType: item.sourceType,
  occurredAt: item.occurredAt,
  timestamp: Date.parse(item.occurredAt),
  direction: item.direction,
  signedAmount: item.direction === 'cameIn' ? amount : -amount,
  amount,
  description: item.description || item.category || 'Financial activity',
  account: item.category || 'Uncategorized',
  propertyId: item.propertyId,
  propertyName: item.propertyName || 'Property not recorded',
  unitId: item.unitId ?? null,
  unitName: item.unitName || 'Property level',
  counterparty: item.counterparty || '',
  method: item.method || '',
  reference: item.reference || '',
  treatment: item.treatment || '',
  runningBalance
}
```

Process valid dates oldest-first to calculate `runningBalance`, use `sourceId` as the deterministic tie-breaker, then return newest-first. Invalid dates remain renderable at the end with `timestamp: null`; non-finite amounts become `0` and never produce `NaN`.

- [ ] Add failing tests for deduplicated review reasons. One uncategorized expense without a receipt must produce one row with both reason labels. Cover all four real signals: `Uncategorized`, `Missing receipt`, `Overdue obligation`, and `Settlement exception`.
- [ ] Implement `selectNeedsReviewItems(items)` by selecting only:

```js
item.sourceType === 'expense' && item.direction === 'wentOut' && item.category?.trim().toLowerCase() === 'uncategorized'
item.sourceType === 'expense' && item.direction === 'wentOut' && !item.hasReceipt
item.direction === 'obligation' && item.needsAttention
item.sourceType === 'payment' && item.needsAttention
```

Return one copy per `sourceId` with a `reviewReasons` array; do not manufacture a record from overview counts.

- [ ] Add failing tests for `buildAccountActivity(entries, limit)`. Assert grouping by `account`, signed totals, counts, descending absolute-total rank, and stable alphabetical tie-breaking.
- [ ] Add failing tests for `buildUpcomingEntries(recurring, future)`. Assert the normalized fields `key`, `id`, `type`, `name`, `category`, `propertyName`, `unitName`, `amount`, `actionDate`, `frequency`, `isPaused`, and `source`; valid dates sort ascending and missing/invalid dates sort last.
- [ ] Add failing tests for `sumCollectedThisMonth(payments, now, propertyId)`. Include PascalCase and camelCase payloads, completed/succeeded/paid status aliases, failed and processing exclusions, previous-month exclusions, invalid amounts, and selected-property filtering.
- [ ] Implement the three derivation functions without React, Redux, or browser dependencies.
- [ ] Run `node --experimental-default-type=module --test src/utils/finances.test.js src/utils/moneyCenter.test.js`; expect all tests to pass.
- [ ] Commit only these files: `git commit -m "test: define finances data model"`.

---

## Task 2: Add an explicit finance-mutation refresh signal to global drawers

**Files:**

- Modify: `property-peace-app/src/hooks/useDrawerControls.js`
- Modify: `property-peace-app/src/layout/Dashboard/index.jsx`
- Modify: `property-peace-app/src/components/expense/ExpenseAddDrawer.jsx`
- Create: `property-peace-app/src/architecture/financeDrawerRefresh.test.mjs`

- [ ] Write a source-contract test that asserts `useDrawerControls` exposes `financeMutationVersion` and `notifyFinanceMutation`, and Dashboard passes the notifier to both global creation drawers as `onSuccess`.
- [ ] Run `node --experimental-default-type=module --test src/architecture/financeDrawerRefresh.test.mjs`; expect the first assertion to fail.
- [ ] Add the state and stable notifier:

```js
const [financeMutationVersion, setFinanceMutationVersion] = useState(0);
const notifyFinanceMutation = useCallback(() => {
  setFinanceMutationVersion((version) => version + 1);
}, []);
```

Return both values from `useDrawerControls`. In Dashboard render:

```jsx
<RecordPaymentDrawer onSuccess={drawer.notifyFinanceMutation} />
<ExpenseAddDrawer
  open={drawer.isOpenExpenseAdd}
  onClose={drawer.closeExpenseAddDrawer}
  onSuccess={drawer.notifyFinanceMutation}
  initialSelection={drawer.expenseAddInitialSelection}
/>
```

- [ ] Change the Expense drawer's post-success destination from the obsolete `/landlord/accounting?tab=1` target to `/landlord/finances?tab=expenses`; do not navigate on cancel or failure.
- [ ] Extend the test to assert the obsolete destination is absent and the canonical destination is present.
- [ ] Run `node --experimental-default-type=module --test src/architecture/financeDrawerRefresh.test.mjs`; expect all tests to pass.
- [ ] Commit: `git commit -m "feat: signal successful finance mutations"`.

---

## Task 3: Fetch shared Money Center and payment-summary data once per scope

**Files:**

- Create: `property-peace-app/src/hooks/useFinancesMoneyData.js`
- Create: `property-peace-app/src/hooks/useFinancesPayments.js`
- Create: `property-peace-app/src/architecture/financesDataFlow.test.mjs`
- Reuse: `property-peace-app/src/api/moneyCenter.js`
- Reuse: `property-peace-app/src/utils/moneyCenter.js`
- Reuse: `property-peace-app/src/utils/finances.js`

- [ ] Write a source-contract test requiring exactly one `moneyCenterAPI.overview` and one `moneyCenterAPI.items` call in the Money hook, a shared `AbortController`, `Promise.allSettled`, request-sequence protection, and independent `overviewError`/`itemsError` state. Require exactly one `/api/payment/all` call in the Payments hook and assert that no Finances component calls that list endpoint directly.
- [ ] Run `node --experimental-default-type=module --test src/architecture/financesDataFlow.test.mjs`; expect `ENOENT` for the hook.
- [ ] Implement `useFinancesMoneyData(searchParams, mutationVersion)` returning:

```js
{
  overview,
  itemsResponse,
  activityEntries,
  reviewItems,
  accountActivity,
  loading,
  overviewError,
  itemsError,
  exporting,
  exportError,
  retry,
  exportActivity
}
```

The hook must:

- Build its params with `buildFinancesMoneyQuery`.
- Request overview/items together with one abort signal.
- Normalize successful results with existing Money Center utilities.
- Retain whichever source succeeded when the other fails.
- Ignore stale results using a monotonically increasing request id.
- Derive review, Activity, and Account activity with Task 1 helpers.
- Use `downloadMoneyCenterExport(params)` for Activity export only.
- Refetch when scope, `mutationVersion`, or its local retry counter changes.
- Never request a portfolio overview solely to populate the property selector; that selector continues to use the existing property store/hook.

- [ ] Implement `useFinancesPayments(propertyId, mutationVersion)` as the one page-level owner of `/api/payment/all`. It returns `{ payments, loading, error, available, retry }`, unwraps array/`data`/`Data` payloads exactly as the legacy page does, passes `propertyId` as the only optional query value, cancels stale requests, retains an explicit error instead of replacing failures with an empty-success state, and refetches after `mutationVersion` or its local retry counter changes.

- [ ] Run `node --experimental-default-type=module --test src/architecture/financesDataFlow.test.mjs src/api/moneyCenter.contract.test.js src/utils/moneyCenter.test.js src/utils/finances.test.js`; expect all tests to pass.
- [ ] Commit: `git commit -m "feat: add shared finances money data hook"`.

---

## Task 4: Build the Finances shell, header, metrics, and right rail

**Files:**

- Create: `property-peace-app/src/pages/landlord/finances.jsx`
- Create: `property-peace-app/src/sections/landlord/finances/FinancesHeader.jsx`
- Create: `property-peace-app/src/sections/landlord/finances/FinancesMetrics.jsx`
- Create: `property-peace-app/src/sections/landlord/finances/AccountActivityCard.jsx`
- Create: `property-peace-app/src/sections/landlord/finances/CalculationDisclosure.jsx`
- Create: `property-peace-app/src/architecture/financesPage.test.mjs`
- Reuse: `property-peace-app/src/components/breadcrumbs/PageBreadcrumbs.jsx`
- Reuse: `property-peace-app/src/components/PropertySelect.jsx`
- Reuse: `property-peace-app/src/contexts/DrawerContext.jsx`
- Reuse: `property-peace-app/src/hooks/useFetchProperties.js`

- [ ] Write a source-contract test for the canonical page title, five tab labels in the approved order, four metric labels, Add menu actions, right-rail Account Activity, tax guidance, and the absence of `Spend by category` and bank-connection controls.
- [ ] Run `node --experimental-default-type=module --test src/architecture/financesPage.test.mjs`; expect `ENOENT` for the page.
- [ ] Implement the page controller with `useSearchParams`, `normalizeFinancesTab`, shared property/date scope, `useFinancesMoneyData`, `useFinancesPayments`, and `useDrawer`.

Use this component contract:

```jsx
<FinancesHeader
  activeTab={activeTab}
  onAddExpense={() => drawer.openExpenseAddDrawer()}
  onRecordPayment={() => drawer.openPaymentAddDrawer()}
  exportState={activeExport}
/>
<FinancesMetrics
  overview={moneyData.overview}
  collectedThisMonth={collectedThisMonth}
  collectedThisMonthAvailable={paymentsData.available}
  onSelectMetric={handleMetricNavigation}
/>
<Tabs value={activeTab} onChange={(_, tab) => setTab(tab)} variant="scrollable" />
```

The five values are `review`, `activity`, `expenses`, `payments`, and `upcoming`. Do not keep a second local tab index.

- [ ] Implement metric behavior exactly:

- Income uses normalized `overview.cameIn` and opens `payments`.
- Expenses uses normalized `overview.wentOut` and opens `expenses`.
- Net cash flow uses normalized `overview.recordedNetCashFlow` and opens `activity`.
- Collected this month uses `sumCollectedThisMonth` from the Payments collection, opens `payments`, and sets `period=this-month` while clearing custom `from`/`to`.
- Missing source fields display `Unavailable`, never `$0.00`.

- [ ] Implement `FinancesHeader` with one keyboard-accessible Add menu (`Add expense`, `Record payment`) and one active-tab export slot. A disabled export must explain why it is unavailable.
- [ ] Implement `AccountActivityCard` from `moneyData.accountActivity`. Each row is a button with a visible account label and formatted signed total; selecting it changes to `tab=activity&account=<name>`. Use absolute magnitude only for the bar width, not for the displayed signed value.
- [ ] Implement `CalculationDisclosure` from `overview.explanations`, `itemsResponse.disclosures`, and data-quality warnings, preserving `aria-controls`, `aria-expanded`, and a live error/status region.
- [ ] Keep the current Expenses tax-readiness guidance as the second right-rail card below Account Activity. It must link to the existing Tax Center route and must not duplicate the removed Spend by Category card.
- [ ] Subscribe to `drawer.financeMutationVersion`; pass it to `useFinancesMoneyData` and to tab data loaders. Do not infer success from a drawer close.
- [ ] Run `node --experimental-default-type=module --test src/architecture/financesPage.test.mjs src/architecture/financeDrawerRefresh.test.mjs src/architecture/financesDataFlow.test.mjs`; expect all tests to pass.
- [ ] Commit: `git commit -m "feat: add unified finances shell"`.

---

## Task 5: Move Needs review and Activity into focused tabs

**Files:**

- Create: `property-peace-app/src/sections/landlord/finances/NeedsReviewTab.jsx`
- Create: `property-peace-app/src/sections/landlord/finances/ActivityTab.jsx`
- Create: `property-peace-app/src/sections/landlord/finances/ActivityRow.jsx`
- Create: `property-peace-app/src/sections/landlord/finances/FinanceDetailDrawer.jsx`
- Modify: `property-peace-app/src/pages/landlord/finances.jsx`
- Modify: `property-peace-app/src/architecture/financesPage.test.mjs`
- Reuse: `property-peace-app/src/components/filters/TransactionFilterToolbar.jsx`

- [ ] Extend the page contract test to require real review reasons, the truthful caught-up empty copy, view-relative balance wording, source error/retry controls, pagination, and CSV export wiring.
- [ ] Run the test; expect missing-tab assertions to fail.
- [ ] Implement `NeedsReviewTab({ items, loading, error, onRetry, onSelectItem, registerExport })`.

Required behavior:

- Render only `selectNeedsReviewItems` results supplied by the page.
- Show every `reviewReasons` value as text chips.
- Export only currently visible review rows with source id, date, reason(s), description, property/unit, category, amount, and source type.
- If zero real rows and no error, show: `Your books are caught up.` and `Imported bank transactions will also appear here after bank connections are added.`
- Show no Plaid button and no synthetic row derived from overview counts.

- [ ] Implement `ActivityTab({ entries, loading, error, onRetry, initialAccount, onSelectItem, registerExport })` with search, type, account, sort, 12-row pagination, and responsive rows. Type options are All, Income, and Expense. Account options come from the entries, not a hard-coded list.
- [ ] Label the last column/row value `Activity balance` and add helper copy: `Running total of the posted activity shown here — not a bank balance.`
- [ ] Reuse the Money Center detail fields in `FinanceDetailDrawer`; include the source id and attention/receipt notices.
- [ ] Wire Activity's Export to `moneyData.exportActivity` only when no client-side search/type/account filter is active. When filters are active, use `CSVLink` data built from the visible filtered entries so the export matches the tab.
- [ ] Preserve partial data: `overviewError` must not hide Activity; `itemsError` displays a retry state without zero-state language.
- [ ] Run `node --experimental-default-type=module --test src/architecture/financesPage.test.mjs src/utils/finances.test.js src/api/moneyCenter.contract.test.js`; expect all tests to pass.
- [ ] Commit: `git commit -m "feat: add finances review and activity tabs"`.

---

## Task 6: Move the editable Expenses list into its tab

**Files:**

- Create: `property-peace-app/src/sections/landlord/finances/ExpensesTab.jsx`
- Create: `property-peace-app/src/sections/landlord/finances/ExpenseRow.jsx`
- Modify: `property-peace-app/src/pages/landlord/finances.jsx`
- Modify: `property-peace-app/src/architecture/financesPage.test.mjs`
- Source to decompose: `property-peace-app/src/pages/landlord/expenses.jsx`
- Reuse: `property-peace-app/src/components/expense/ExpenseEditDrawer.jsx`
- Reuse: `property-peace-app/src/components/dialogs/ConfirmationDialog.jsx`
- Reuse: `property-peace-app/src/hooks/useFetchExpenses.js`

- [ ] Add failing contract assertions that ExpensesTab retains status, receipt, deductible, category, search, period, sort, pagination, CSV, edit, mark-paid, and delete behaviors but does not render page breadcrumbs, metric cards, PropertySelect, recurring/future sub-tabs, Spend by Category, or a second ExpenseAddDrawer.
- [ ] Run the page contract test; expect the new file assertion to fail.
- [ ] Move `ExpenseRow`, expense normalization helpers, transaction filters, edit drawer, mark-paid mutation, deletion confirmation, pagination, and visible-row CSV shaping from the legacy page into `ExpensesTab`.
- [ ] Give the component this public contract:

```jsx
<ExpensesTab
  propertyId={selectedPropertyId}
  sharedPeriod={sharedPeriod}
  sharedFrom={sharedFrom}
  sharedTo={sharedTo}
  mutationVersion={drawer.financeMutationVersion}
  onMutation={drawer.notifyFinanceMutation}
  onRegisterExport={setActiveExport}
  onAvailabilityChange={setExpensesAvailable}
/>
```

- [ ] Keep `useFetchExpenses` as the editable source. On edit, mark paid, or delete success: refetch expenses, call `onMutation`, retain current filters, and clamp pagination if the last row on a page disappears.
- [ ] Keep error and filtered-empty states distinct. A failed fetch sets availability false so the metrics do not present false zeroes.
- [ ] Use the global header Add menu for creation. Do not render the page-local `ExpenseAddDrawer` that exists at the bottom of the old page.
- [ ] Run `node --experimental-default-type=module --test src/architecture/financesPage.test.mjs src/components/filters/transactionFilterToolbar.test.js src/components/filters/transactionFilterToolbar.module-resolution.test.js`; expect all tests to pass.
- [ ] Commit: `git commit -m "feat: move expenses into finances"`.

---

## Task 7: Move the editable Payments list into its tab

**Files:**

- Create: `property-peace-app/src/sections/landlord/finances/PaymentsTab.jsx`
- Create: `property-peace-app/src/sections/landlord/finances/PaymentRow.jsx`
- Modify: `property-peace-app/src/pages/landlord/finances.jsx`
- Modify: `property-peace-app/src/architecture/financesPage.test.mjs`
- Source to decompose: `property-peace-app/src/pages/landlord/payments.jsx`
- Reuse: `property-peace-app/src/components/drawers/PaymentEditDrawer.jsx`
- Reuse: `property-peace-app/src/components/filters/TransactionFilterToolbar.jsx`

- [ ] Add failing contract assertions that PaymentsTab retains rent/fee/deposit types; completed/processing/failed/disputed/canceled statuses; online/manual sources; record/edit/delete actions; search, property/period filters, sorting, pagination, CSV, and retry states.
- [ ] Move the legacy page's `normalizeStatus`, `getPaymentType`, `isOnlinePayment`, `getReference`, `PaymentRow`, filter, edit, and delete logic into the two new modules. Keep fetching in `useFinancesPayments`; do not simplify statuses or exclude failed/disputed records from the editable list.
- [ ] Give the component this public contract:

```jsx
<PaymentsTab
  propertyId={selectedPropertyId}
  sharedPeriod={sharedPeriod}
  sharedFrom={sharedFrom}
  sharedTo={sharedTo}
  mutationVersion={drawer.financeMutationVersion}
  onMutation={drawer.notifyFinanceMutation}
  onRegisterExport={setActiveExport}
  payments={paymentsData.payments}
  loading={paymentsData.loading}
  error={paymentsData.error}
  onRetry={paymentsData.retry}
/>
```

The page-level `useFinancesPayments` result supplies the same unfiltered collection to `sumCollectedThisMonth` and PaymentsTab, including when another tab is active. PaymentsTab must not call `/api/payment/all` itself.

- [ ] On edit/delete/record success, call `onMutation`; the changed mutation version makes the single Payments hook and Money Center hook refetch. Do not refresh from a mere drawer close or issue a second direct Payments request.
- [ ] Register a visible-row CSV export with the header and surface independent failure/retry state.
- [ ] Run `node --experimental-default-type=module --test src/architecture/financesPage.test.mjs`; expect all tests to pass.
- [ ] Commit: `git commit -m "feat: move payments into finances"`.

---

## Task 8: Combine recurring and one-time expenses in Upcoming

**Files:**

- Create: `property-peace-app/src/sections/landlord/finances/UpcomingTab.jsx`
- Create: `property-peace-app/src/sections/landlord/finances/UpcomingRow.jsx`
- Modify: `property-peace-app/src/pages/landlord/finances.jsx`
- Modify: `property-peace-app/src/architecture/financesPage.test.mjs`
- Source to decompose: `property-peace-app/src/pages/landlord/expenses.jsx`

- [ ] Add failing assertions for one combined list, `All`/`Recurring`/`One-time` filters, both type chips, date sort, search/property filters, CSV, and all existing actions.
- [ ] Move the recurring/future selectors and actions from the old Expenses page into `UpcomingTab`. Dispatch `getRecurringExpensesAction` and `getFutureExpensesAction` once on scope or mutation-version changes, then pass both collections to `buildUpcomingEntries`.
- [ ] Render one ordered list. Recurring uses `nextOccurrenceDate`; one-time uses `dueDate`. Rows with invalid/missing dates show `Date not set` after all valid dates.
- [ ] Preserve exact mutation behaviors:

- Record as paid uses the existing `addExpenseAction` payload and then refreshes expenses plus the scheduled source.
- Pause/resume calls `pauseRecurringExpenseAction`/`resumeRecurringExpenseAction`.
- Delete recurring calls `deleteRecurringExpenseAction` after confirmation.
- Delete one-time calls `deleteFutureExpenseAction` after confirmation.

Every successful mutation calls `onMutation`; every failure keeps the row and shows the existing snackbar error.

- [ ] Distinguish `No upcoming expenses are scheduled` from `No upcoming expenses match these filters`.
- [ ] Register the visible combined rows as the Upcoming CSV export.
- [ ] Run `node --experimental-default-type=module --test src/architecture/financesPage.test.mjs src/utils/finances.test.js`; expect all tests to pass.
- [ ] Commit: `git commit -m "feat: combine upcoming finance obligations"`.

---

## Task 9: Make Finances canonical in routes and navigation

**Files:**

- Modify: `property-peace-app/src/routes/MainRoutes.jsx`
- Modify: `property-peace-app/src/routes/milestone9.test.mjs`
- Modify: `property-peace-app/src/menu-items/pages.js`
- Modify: `property-peace-app/src/menu-items/pages.integration.test.js`
- Modify: `property-peace-app/src/architecture/productConsolidation.test.mjs`

- [ ] First rewrite the route/menu tests to assert the approved contract:

```js
for (const [legacy, tab] of [
  ['landlord/expenses', 'expenses'],
  ['landlord/payments', 'payments'],
  ['landlord/ledger', 'activity'],
  ['landlord/money', 'activity'],
  ['landlord/money-activity', 'activity']
]) {
  assert.match(routes, new RegExp(`path: '${legacy}'[\\s\\S]*tab=${tab}`));
}
```

Assert that Accounting contains `Finances`, `Rent Collection`, `Tax Center`, and `Reports & Analytics`; assert that standalone `Money`, `Payments`, `Expenses`, and `Ledger` items and the `Money Center` group are absent.

- [ ] Run `node --experimental-default-type=module --test src/routes/milestone9.test.mjs src/menu-items/pages.integration.test.js src/architecture/productConsolidation.test.mjs`; expect old Money/navigation assertions to fail.
- [ ] Replace the lazy imports for Expenses, Payments, Ledger, and MoneyActivity with one lazy `Finances` import.
- [ ] Add the guarded canonical route:

```jsx
{
  path: 'landlord/finances',
  element: (
    <SubscriptionPausedGuard>
      <Finances />
    </SubscriptionPausedGuard>
  )
}
```

- [ ] Add a reusable `LegacyFinancesRedirect({ tab })` that preserves existing search params, writes the intended tab, optionally folds `:propertyId` into `propertyId`, and returns `<Navigate replace>`. Use it for all five legacy list/money paths. The redirect destination is always `/landlord/finances?...`; it must never render a deleted page before redirecting.
- [ ] Keep `/landlord/payments/record`, `/landlord/payments/add`, and both Tax Center route aliases untouched.
- [ ] Remove the Money Center top-level group from `pages.js`. Put this exact Accounting order in its children: Finances, Rent Collection, Tax Center, Reports & Analytics.
- [ ] Run the three navigation tests again; expect all to pass.
- [ ] Commit: `git commit -m "feat: make finances the accounting workspace"`.

---

## Task 10: Update internal list links and mobile loading behavior

**Files:**

- Modify all files returned by: `rg -l "/landlord/expenses|/landlord/payments|/landlord/ledger|/landlord/money" property-peace-app/src`
- Modify adjacent tests including: `property-peace-app/src/utils/percySources.test.js`
- Modify adjacent tests including: `property-peace-app/src/sections/landlord/dashboard/recentTransactions.test.js`
- Modify: `property-peace-app/src/layout/Dashboard/index.jsx`
- Modify: `property-peace-app/src/layout/Dashboard/BottomNavBar/index.jsx`
- Create: `property-peace-app/src/architecture/financesLinks.test.mjs`

- [ ] Add a source scan that fails when app code still navigates to the removed list destinations, with explicit allow-list exceptions only for redirect declarations and Tax Center's `/landlord/money/tax-center` compatibility route.
- [ ] Run `node --experimental-default-type=module --test src/architecture/financesLinks.test.mjs`; expect it to report current legacy links.
- [ ] Replace intent-preserving links:

- Old expense list destinations become `/landlord/finances?tab=expenses`.
- Old payment list destinations become `/landlord/finances?tab=payments`.
- Old ledger and Money activity destinations become `/landlord/finances?tab=activity`.
- Links intended to create records continue to call drawer actions or keep `/landlord/payments/record` and `/landlord/payments/add`.
- Property-context links preserve scope, for example `/landlord/finances?tab=expenses&propertyId=${propertyId}`.
- Do not rewrite `/landlord/money/tax-center` as an Activity URL.

- [ ] Update Dashboard's page-loading detection from the old Expenses pathname to `/landlord/finances`, using the existing accounting loading state rather than adding a new global context flag.
- [ ] Update Percy source expectations and dashboard recent-transaction expectations to the canonical URLs.
- [ ] Run:

```powershell
node --experimental-default-type=module --test src/architecture/financesLinks.test.mjs
node --experimental-default-type=module --test src/utils/percySources.test.js
node --experimental-default-type=module --test src/sections/landlord/dashboard/recentTransactions.test.js
```

Expect all to pass.

- [ ] Commit: `git commit -m "refactor: point finance links to finances"`.

---

## Task 11: Delete retired user-facing page implementations

**Files:**

- Delete: `property-peace-app/src/pages/landlord/expenses.jsx`
- Delete: `property-peace-app/src/pages/landlord/payments.jsx`
- Delete: `property-peace-app/src/pages/landlord/ledger.jsx`
- Delete: `property-peace-app/src/pages/landlord/money-activity.jsx`
- Delete: `property-peace-app/src/components/money-center/MoneyCenter.jsx`
- Modify: `property-peace-app/src/routes/milestone9.test.mjs`
- Modify: `property-peace-app/src/architecture/productConsolidation.test.mjs`

- [ ] Add assertions that MainRoutes no longer imports the five retired modules and that no app source imports `components/money-center/MoneyCenter`.
- [ ] Run the route/consolidation tests and observe failure while the imports still exist.
- [ ] Verify every moved action and presentation behavior exists in the new focused modules, then delete the retired modules. Do not delete `src/api/moneyCenter.js`, `src/utils/moneyCenter.js`, their tests, or backend Money Center code.
- [ ] Update the old Money Center accessibility source-contract test in `milestone9.test.mjs` to target the new Finances page, CalculationDisclosure, ActivityTab, and FinanceDetailDrawer. Preserve assertions for live status, calculation disclosure controls, drawer labelling, export failure copy, partial-response copy, and the distinction between failure and true empty state.
- [ ] Run:

```powershell
node --experimental-default-type=module --test src/routes/milestone9.test.mjs
node --experimental-default-type=module --test src/architecture/productConsolidation.test.mjs
node --experimental-default-type=module --test src/architecture/financesPage.test.mjs
```

Expect all to pass.

- [ ] Commit: `git commit -m "refactor: retire standalone finance pages"`.

---

## Task 12: Regression verification and responsive smoke test

**Files:**

- Modify only files required to fix regressions introduced by Tasks 1-11.

- [ ] Run all focused Finances and Money Center tests:

```powershell
node --experimental-default-type=module --test src/utils/finances.test.js src/utils/moneyCenter.test.js src/api/moneyCenter.contract.test.js src/architecture/financeDrawerRefresh.test.mjs src/architecture/financesDataFlow.test.mjs src/architecture/financesPage.test.mjs src/architecture/financesLinks.test.mjs src/routes/milestone9.test.mjs src/menu-items/pages.integration.test.js src/architecture/productConsolidation.test.mjs
```

- [ ] Discover and run every existing expense/payment/accounting regression test without guessing names:

```powershell
rg --files src | rg "(expense|payment|transaction|accounting).*test\\.(js|mjs|jsx)$"
```

Run each returned test with `node --experimental-default-type=module --test <paths>` and fix only regressions caused by this consolidation.

- [ ] Run `npm run build` from `property-peace-app`; expect Vite to exit 0 with no missing imports or JSX errors.
- [ ] Run `npm run lint` from `property-peace-app`. If unrelated pre-existing lint failures exist, record them with file/line evidence; fix all failures in files changed by this work.
- [ ] Start the existing local app using the repository's documented development command and manually verify at desktop and narrow mobile widths:

1. `/landlord/finances` opens Activity with This year scope.
2. Tabs are ordered Needs review, Activity, Expenses, Payments, Upcoming and scroll on mobile.
3. All four metric cards navigate as specified; unavailable source data never appears as zero.
4. Add expense and Record payment save successfully and refresh the affected tab, review/activity data, and cards once.
5. Expense edit/mark paid/delete and payment edit/delete still work.
6. Failed/disputed/processing payments remain visible in Payments but do not enter posted Activity.
7. Upcoming combines and sorts recurring/one-time rows; pause/resume/record/delete all work.
8. Account Activity replaces Spend by Category and selects the Activity account filter.
9. Needs review shows only real source records or the truthful caught-up state.
10. Active-tab exports contain the visible records.
11. Every legacy URL redirects directly to the intended tab while preserving property/date search scope.
12. Accounting navigation has Finances, Rent Collection, Tax Center, and Reports & Analytics only.

- [ ] Inspect `git diff --check` and `git status --short`. Ensure no generated artifacts, secrets, or unrelated files are staged.
- [ ] Commit any verification-only fixes: `git commit -m "test: verify finances consolidation"`.

## Plan Self-Review Checklist

- [ ] Every approved tab, metric, header action, right-rail card, review signal, editable operation, redirect, and navigation move has an owning task.
- [ ] The Money Center API remains internal and unchanged; only the user-facing Money/Money Center page is retired.
- [ ] Activity and Account Activity consume the same items request; payment collections are not fetched twice for Payments and Collected this month.
- [ ] The plan contains no placeholder components, fake review data, disabled bank-connect UI, or unspecified backend work.
- [ ] Pure model shapes are consistent across FinancesMetrics, NeedsReviewTab, ActivityTab, AccountActivityCard, and UpcomingTab.
- [ ] Mutation refresh occurs only after confirmed success and covers add/edit/mark-paid/pause/resume/delete.
- [ ] Old page deletion happens only after routes, internal links, actions, exports, accessibility behavior, and tests have moved.
- [ ] Verification includes focused tests, discovered regressions, production build, lint evidence, and desktop/mobile smoke testing.
