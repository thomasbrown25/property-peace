import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

const srcRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const source = (relativePath) => readFile(path.join(srcRoot, relativePath), 'utf8');

test('unified Finances shell keeps the approved navigation, actions, and right rail', async () => {
  const [page, header, metrics, accountActivity, disclosure] = await Promise.all([
    source('pages/landlord/finances.jsx'),
    source('sections/landlord/finances/FinancesHeader.jsx'),
    source('sections/landlord/finances/FinancesMetrics.jsx'),
    source('sections/landlord/finances/AccountActivityCard.jsx'),
    source('sections/landlord/finances/CalculationDisclosure.jsx')
  ]);
  const combined = [page, header, metrics, accountActivity, disclosure].join('\n');

  assert.match(header, />Finances<\/Typography>/);
  assert.match(
    page,
    /const FINANCES_TAB_LABELS = \[\s*\['review', 'Needs review'\],\s*\['activity', 'Activity'\],\s*\['expenses', 'Expenses'\],\s*\['payments', 'Payments'\],\s*\['upcoming', 'Upcoming'\]\s*\];/
  );
  assert.match(metrics, /label: 'Income'/);
  assert.match(metrics, /label: 'Expenses'/);
  assert.match(metrics, /label: 'Net cash flow'/);
  assert.match(metrics, /label: 'Collected this month'/);

  assert.match(header, />Add expense<\/MenuItem>/);
  assert.match(header, />Record payment<\/MenuItem>/);
  assert.match(header, /tabIndex=\{exportDisabled \? 0 : undefined\}/);
  assert.match(page, /onAddExpense=\{\(\) => drawer\.openExpenseAddDrawer\(\)\}/);
  assert.match(page, /onRecordPayment=\{\(\) => drawer\.openPaymentAddDrawer\(\)\}/);
  assert.match(page, /exportState=\{activeExport\}/);

  assert.match(page, /useFinancesMoneyData\(effectiveSearchParams, drawer\.financeMutationVersion\)/);
  assert.match(page, /useFinancesPayments\(propertyId, drawer\.financeMutationVersion\)/);
  assert.match(page, /localSelectedProperty=\{selectedProperty \|\| ALL_PROPERTIES_SCOPE\}/);
  assert.match(page, /updateFinancesPropertyScope\(searchParams, property\?\.id\)/);
  assert.match(page, /sumCollectedThisMonth\(paymentsData\.payments, new Date\(\), propertyId\)/);
  assert.match(page, /collectedThisMonthAvailable=\{[^}]*paymentsData\.available\}/);
  assert.match(metrics, /overview\?\.fieldAvailability\?\.cameIn/);
  assert.match(metrics, /overview\?\.fieldAvailability\?\.wentOut/);
  assert.match(metrics, /overview\?\.fieldAvailability\?\.recordedNetCashFlow/);
  assert.match(metrics, /available \? money\.format\(value\) : 'Unavailable'/);

  assert.match(accountActivity, />Account Activity<\/Typography>/);
  assert.match(accountActivity, /Math\.abs\(account\.signedTotal\)/);
  assert.match(accountActivity, /formatSignedMoney\(account\.signedTotal\)/);
  assert.match(page, /tab: 'activity', account/);
  assert.match(page, />Keep records tax-ready<\/Typography>/);
  assert.match(page, /to="\/landlord\/accounting\/tax-center"/);

  assert.match(disclosure, /aria-controls="finances-calculation-details"/);
  assert.match(disclosure, /aria-expanded=\{expanded\}/);
  assert.match(disclosure, /aria-live="polite"/);
  assert.match(disclosure, /overview\?\.explanations/);
  assert.match(disclosure, /itemsResponse\?\.disclosures/);
  assert.match(disclosure, /overview\?\.dataQuality\?\.warnings/);

  assert.doesNotMatch(combined, /Spend by category/i);
  assert.doesNotMatch(combined, /connect(?:ed|ing)?\s+(?:a\s+)?bank|plaid/i);
  assert.doesNotMatch(combined, /coming soon/i);
});

test('finance metrics suppress retained values while their requested scope is loading', async () => {
  const page = await source('pages/landlord/finances.jsx');

  assert.match(page, /overview=\{moneyData\.loading \|\| moneyScopeChanged \? null : moneyData\.overview\}/);
  assert.match(page, /collectedThisMonthAvailable=\{!paymentsData\.loading && !paymentsScopeChanged && paymentsData\.available\}/);
});
test('Needs review renders and exports real review records without fabricating bank connection rows', async () => {
  const [page, review] = await Promise.all([
    source('pages/landlord/finances.jsx'),
    source('sections/landlord/finances/NeedsReviewTab.jsx')
  ]);

  assert.match(page, /items=\{moneyData\.reviewItems\}/);
  assert.match(review, /item\.reviewReasons\.map/);
  assert.match(review, /Your books are caught up\./);
  assert.match(review, /Imported bank transactions will also appear here after bank connections are added\./);
  assert.match(review, /CSVLink/);
  assert.match(review, /buildReviewCsvRows\(items\)/);
  assert.match(review, /onClick=\{onRetry\}/);
  assert.doesNotMatch(review, /Plaid|connect(?:ed|ing)?\s+(?:a\s+)?bank/i);
  assert.doesNotMatch(review, /overview|attention.*Count/i);
});

test('Activity supports scoped filtering, responsive rows, retry, pagination, and view-relative balances', async () => {
  const [page, activity, row] = await Promise.all([
    source('pages/landlord/finances.jsx'),
    source('sections/landlord/finances/ActivityTab.jsx'),
    source('sections/landlord/finances/ActivityRow.jsx')
  ]);

  assert.match(page, /entries=\{moneyData\.activityEntries\}/);
  assert.match(page, /initialAccount=\{searchParams\.get\('account'\) \|\| ''\}/);
  assert.match(activity, /TransactionFilterToolbar/);
  assert.match(activity, /period="shared"/);
  assert.doesNotMatch(activity, /period=\{type\}/);
  assert.match(activity, /\{ value: 'all', label: 'All' \}/);
  assert.match(activity, /\{ value: 'income', label: 'Income' \}/);
  assert.match(activity, /\{ value: 'expense', label: 'Expense' \}/);
  assert.match(activity, /getActivityAccountOptions\(entries\)/);
  assert.match(activity, /const PAGE_SIZE = 12/);
  assert.match(activity, /<Pagination/);
  assert.match(activity, /onClick=\{onRetry\}/);
  assert.match(row, /Activity balance/);
  assert.match(activity, /Running total of the posted activity shown here — not a bank balance\./);
});

test('active-tab export registration requires the current mount and navigation before enabling export', async () => {
  const [page, activity, review] = await Promise.all([
    source('pages/landlord/finances.jsx'),
    source('sections/landlord/finances/ActivityTab.jsx'),
    source('sections/landlord/finances/NeedsReviewTab.jsx')
  ]);

  assert.match(page, /useLocation\(\)/);
  assert.match(page, /const exportRegistrationKey = `\$\{location\.key\}:\$\{activeTab\}`/);
  assert.match(page, /const registerExport = useCallback/);
  assert.match(page, /return \(\) => setExportRegistration/);
  assert.match(page, /selectFinancesExportState\(exportRegistration, activeTab, exportRegistrationKey\)/);
  assert.match(page, /if \(!registeredExportState\)[\s\S]*disabled: true[\s\S]*if \(activeTab === 'activity'/);
  assert.doesNotMatch(page, /tabExports|activityExport\?\./);
  assert.match(page, /onExport: moneyData\.exportActivity/);
  assert.match(page, /registrationKey=\{exportRegistrationKey\}/);
  assert.match(activity, /useLayoutEffect\(\(\) => registerExport\('activity', registrationKey, exportState\)/);
  assert.match(review, /useLayoutEffect\(\(\) => registerExport\('review', registrationKey, exportState\)/);
  assert.match(activity, /hasClientFilters/);
  assert.match(activity, /buildActivityCsvRows\(visibleEntries\)/);
  assert.match(activity, /<CSVLink/);
});

test('Activity item errors remain retry states and detail uses original Money Center records', async () => {
  const [page, activity, drawer] = await Promise.all([
    source('pages/landlord/finances.jsx'),
    source('sections/landlord/finances/ActivityTab.jsx'),
    source('sections/landlord/finances/FinanceDetailDrawer.jsx')
  ]);

  assert.match(page, /error=\{moneyData\.itemsError\}/);
  assert.match(page, /moneyData\.itemsResponse\?\.items\?\.find\(\(item\) => item\.sourceId === entry\.sourceId\)/);
  assert.doesNotMatch(page, /overviewError[^\n]+ActivityTab/);
  assert.match(activity, /Activity records could not be loaded/);
  assert.match(activity, /This is not confirmation that the selected period has no posted activity\./);
  assert.match(activity, /resultSummary=\{!loading && !error\s*\?/);
  assert.doesNotMatch(activity, /resultSummary=\{`\$\{totalCount\} posted/);
  assert.match(drawer, /Source ID/);
  assert.match(drawer, /item\.needsAttention/);
  assert.match(drawer, /item\.hasReceipt === false/);
  assert.match(drawer, /aria-labelledby="finance-detail-title"/);
});
test('Expenses keeps editable transaction behavior inside the shared Finances scope', async () => {
  const [page, expenses, row] = await Promise.all([
    source('pages/landlord/finances.jsx'),
    source('sections/landlord/finances/ExpensesTab.jsx'),
    source('sections/landlord/finances/ExpenseRow.jsx')
  ]);

  assert.match(page, /<ExpensesTab/);
  assert.match(page, /propertyId=\{propertyId\}/);
  assert.match(page, /sharedPeriod=\{period\}/);
  assert.match(page, /sharedFrom=\{scopedQuery\.from\}/);
  assert.match(page, /sharedTo=\{scopedQuery\.to\}/);
  assert.match(page, /const expensesData = useFetchExpenses\(expenseFilters\)/);
  assert.match(page, /expenses=\{expensesData\.expenses\}/);
  assert.match(page, /loading=\{expensesData\.loading\}/);
  assert.match(page, /error=\{expensesData\.error\}/);
  assert.match(page, /onRetry=\{expensesData\.refetch\}/);
  assert.match(page, /onMutation=\{drawer\.notifyFinanceMutation\}/);
  assert.match(page, /registrationKey=\{exportRegistrationKey\}/);
  assert.match(page, /registerExport=\{registerExport\}/);

  assert.doesNotMatch(expenses, /useFetchExpenses/);
  assert.match(expenses, /TransactionFilterToolbar/);
  assert.match(expenses, /period="shared"/);
  assert.match(expenses, /Paid/);
  assert.match(expenses, /Unpaid/);
  assert.match(expenses, /Tax deductible/);
  assert.match(expenses, /Missing receipt/);
  assert.match(expenses, /Category/);
  assert.match(expenses, /search=\{search\}/);
  assert.match(expenses, /sort=\{sort\}/);
  assert.match(expenses, /<Pagination/);
  assert.match(expenses, /<CSVLink/);
  assert.match(expenses, /<ExpenseEditDrawer/);
  assert.match(expenses, /updateExpenseAction/);
  assert.match(expenses, /deleteExpenseAction/);
  assert.match(expenses, /onClick=\{onRetry\}/);
  assert.match(expenses, /useLayoutEffect\(\(\) => registerExport\('expenses', registrationKey, exportState\)/);
  assert.match(expenses, /buildExpenseCsvRows\(filteredExpenses\)/);
  assert.match(expenses, /const requestedPage = scopeChanged \? 1 : page/);
  assert.doesNotMatch(expenses, /useEffect\(\(\) => \{\s*setPage\(1\);\s*\}, \[category,/);
  assert.match(row, /Receipt/);
  assert.match(row, /Mark as paid/);
  assert.match(row, /Edit expense/);
  assert.match(row, /Delete expense/);

  const combined = [expenses, row].join('\n');
  assert.doesNotMatch(combined, /PageBreadcrumbs/);
  assert.doesNotMatch(combined, /FinancesMetrics|MetricCard/);
  assert.doesNotMatch(combined, /PropertySelect/);
  assert.doesNotMatch(combined, /ExpenseAddDrawer/);
  assert.doesNotMatch(combined, /Spend by category/i);
  assert.doesNotMatch(combined, /Recurring|Upcoming/);
});

test('page-owned keyed expense data gates metrics without excluding concurrent consumers', async () => {
  const [page, hook, action, reducer, selectors] = await Promise.all([
    source('pages/landlord/finances.jsx'),
    source('hooks/useFetchExpenses.js'),
    source('store/expense/expense.action.js'),
    source('store/expense/expense.reducer.js'),
    source('store/expense/expense.selector.js')
  ]);

  assert.match(page, /useFetchExpenses\(expenseFilters\)/);
  assert.match(page, /maskExpenseMetricsAvailability\([\s\S]*expensesData\.available/);
  assert.doesNotMatch(page, /expensesAvailable|setExpensesAvailable/);
  assert.match(hook, /selectExpenseListRequest/);
  assert.match(hook, /buildExpenseListRequestKey/);
  assert.match(hook, /registerExpenseListScopeAction/);
  assert.match(hook, /releaseExpenseListScopeAction/);
  assert.match(hook, /getStaleExpensesAction/);
  assert.match(hook, /listRequest?.stale/);
  assert.match(hook, /available/);
  assert.match(action, /requestId/);
  assert.match(action, /requestKey/);
  assert.match(reducer, /listRequestsByKey/);
  assert.match(reducer, /listRequestRefCounts/);
  assert.match(selectors, /selectExpenseListRequest/);
});

test('Payments keeps the complete editable list while the page owns its one shared collection', async () => {
  const [page, payments, row, hook, dashboard] = await Promise.all([
    source('pages/landlord/finances.jsx'),
    source('sections/landlord/finances/PaymentsTab.jsx'),
    source('sections/landlord/finances/PaymentRow.jsx'),
    source('hooks/useFinancesPayments.js'),
    source('layout/Dashboard/index.jsx')
  ]);

  assert.match(page, /const paymentsData = useFinancesPayments\(propertyId, drawer\.financeMutationVersion\)/);
  assert.match(page, /sumCollectedThisMonth\(paymentsData\.payments, new Date\(\), propertyId\)/);
  assert.match(page, /<PaymentsTab/);
  assert.match(page, /payments=\{paymentsData\.payments\}/);
  assert.match(page, /loading=\{paymentsData\.loading/);
  assert.match(page, /error=\{paymentsData\.error\}/);
  assert.match(page, /onRetry=\{paymentsData\.retry\}/);
  assert.match(page, /mutationVersion=\{drawer\.financeMutationVersion\}/);
  assert.match(page, /onMutation=\{drawer\.notifyFinanceMutation\}/);
  assert.match(page, /registrationKey=\{exportRegistrationKey\}/);
  assert.match(page, /registerExport=\{registerExport\}/);
  assert.match(page, /maskPaymentMetricsAvailability/);
  assert.match(
    page,
    /expensesData\.available\s*\n\s*\),\s*\n\s*!paymentsData\.loading && !paymentsScopeChanged && paymentsData\.available\s*\n\s*\), \[/
  );

  assert.match(hook, /axiosServices\.get\('\/api\/payment\/all'/);
  assert.doesNotMatch(payments, /\/api\/payment\/all/);
  assert.doesNotMatch(row, /\/api\/payment\/all/);
  assert.match(payments, /TransactionFilterToolbar/);
  assert.match(payments, /period="shared"/);
  assert.match(payments, /Rent/);
  assert.match(payments, /Fees/);
  assert.match(payments, /Deposits/);
  assert.match(payments, /Completed/);
  assert.match(payments, /Processing/);
  assert.match(payments, /Failed/);
  assert.match(payments, /Disputed/);
  assert.match(payments, /Canceled/);
  assert.match(payments, /Online/);
  assert.match(payments, /Manual/);
  assert.match(payments, /search=\{search\}/);
  assert.match(payments, /sort=\{sort\}/);
  assert.match(payments, /<Pagination/);
  assert.match(payments, /<CSVLink/);
  assert.match(payments, /buildPaymentCsvRows\(filteredPayments\)/);
  assert.match(payments, /useLayoutEffect\(\(\) => registerExport\('payments', registrationKey, exportState\)/);
  assert.match(payments, /<PaymentEditDrawer/);
  assert.match(payments, /axiosServices\.delete\(`\/api\/payment\/\$\{paymentId\}`\)/);
  assert.match(payments, /openPaymentAddDrawer\(\)/);
  assert.match(payments, /onClick=\{onRetry\}/);
  assert.match(row, /Edit payment/);
  assert.match(row, /Delete payment/);
  assert.match(dashboard, /<RecordPaymentDrawer onSuccess=\{drawer\.notifyFinanceMutation\}/);

  const combined = [payments, row].join('\n');
  assert.doesNotMatch(combined, /PageBreadcrumbs|PropertySelect|FinancesMetrics|MetricCard/);
  assert.doesNotMatch(combined, /useEffect[\s\S]*isOpenPaymentAdd/);
});

test('Upcoming combines scheduled expenses with scoped filters, truthful states, export, and preserved mutations', async () => {
  const [
    page,
    upcoming,
    row,
    expenseAction,
    upcomingSelection,
    recurringSelector,
    futureSelector,
    futureAction,
    futureReducer,
    cleanupStorage
  ] = await Promise.all([
    source('pages/landlord/finances.jsx'),
    source('sections/landlord/finances/UpcomingTab.jsx'),
    source('sections/landlord/finances/UpcomingRow.jsx'),
    source('store/expense/expense.action.js'),
    source('utils/upcomingTab.js'),
    source('store/recurring-expense/recurring-expense.selector.js'),
    source('store/future-expense/future-expense.selector.js'),
    source('store/future-expense/future-expense.action.js'),
    source('store/future-expense/future-expense.reducer.js'),
    source('store/future-expense/future-expense.cleanup-storage.js')
  ]);

  assert.match(page, /<UpcomingTab/);
  assert.match(page, /propertyId=\{propertyId\}/);
  assert.match(page, /mutationVersion=\{drawer\.financeMutationVersion\}/);
  assert.match(page, /onMutation=\{drawer\.notifyFinanceMutation\}/);
  assert.match(page, /registrationKey=\{exportRegistrationKey\}/);
  assert.match(page, /registerExport=\{registerExport\}/);

  assert.match(upcoming, /buildUpcomingEntries\(recurringExpenses, futureExpenses\)/);
  assert.equal((upcoming.match(/dispatch\(getRecurringExpensesAction/g) || []).length, 1);
  assert.equal((upcoming.match(/dispatch\(getFutureExpensesAction/g) || []).length, 1);
  assert.match(upcoming, /getRecurringExpensesAction\(landlordId, \{ propertyId \}, requestScopeKey\)/);
  assert.match(upcoming, /getFutureExpensesAction\(landlordId, \{ propertyId \}, requestScopeKey\)/);
  assert.match(upcoming, /requestScopeKey[\s\S]*landlordId[\s\S]*propertyId[\s\S]*mutationVersion[\s\S]*retryVersion/);
  assert.match(recurringSelector, /selectRecurringExpenseListSettledRequestKey/);
  assert.match(futureSelector, /selectFutureExpenseListSettledRequestKey/);
  assert.match(upcoming, /recurringListSettledRequestKey === requestScopeKey/);
  assert.match(upcoming, /futureListSettledRequestKey === requestScopeKey/);
  assert.match(upcoming, /\[cleanupHydrated, dispatch, landlordId, requestScopeKey\]/);
  assert.match(upcoming, /if \(!cleanupHydrated\)[\s\S]*return undefined;[\s\S]*dispatch\(getRecurringExpensesAction/);
  assert.ok(upcoming.indexOf('hydrateFutureExpenseCleanupAction') < upcoming.indexOf('dispatch(getRecurringExpensesAction'));
  assert.match(upcoming, /TransactionFilterToolbar/);
  assert.match(upcoming, /search=\{search\}/);
  assert.match(upcoming, /selectUpcomingEntries\(combinedEntries, \{ propertyId, search, type: typeFilter \}\)/);
  assert.match(upcomingSelection, /entry\?\.source\?\.propertyId \?\? entry\?\.source\?\.PropertyId/);
  assert.match(upcoming, /\{ value: 'all', label: 'All' \}/);
  assert.match(upcoming, /\{ value: 'Recurring', label: 'Recurring' \}/);
  assert.match(upcoming, /\{ value: 'One-time', label: 'One-time' \}/);
  assert.doesNotMatch(upcoming, /<Tabs|<Tab\s/);

  assert.match(row, /label=\{entry\.type\}/);
  assert.match(row, /entry\.type === 'Recurring'/);
  assert.match(row, /Date not set/);
  assert.match(row, /display: \{ xs: 'block', md: 'grid' \}/);
  assert.match(row, /Record as paid/);
  assert.match(row, /Pause schedule/);
  assert.match(row, /Resume schedule/);
  assert.match(row, /Delete recurring schedule/);
  assert.match(row, /Delete one-time expense/);

  assert.match(upcoming, /buildUpcomingCsvRows\(filteredEntries\)/);
  assert.match(upcoming, /<CSVLink/);
  assert.match(upcoming, /useLayoutEffect\(\(\) => registerExport\('upcoming', registrationKey, exportState\)/);
  assert.doesNotMatch(upcoming, /<Pagination|visibleEntries/);
  assert.match(upcoming, /No upcoming expenses are scheduled/);
  assert.match(upcoming, /No upcoming expenses match these filters/);
  assert.match(upcoming, /Upcoming expenses could not be loaded/);
  assert.match(upcoming, /onClick=\{retry\}/);

  assert.match(upcoming, /addExpenseAction\(\{/);
  for (const field of [
    'landlordId',
    'propertyId',
    'unitId',
    'name',
    'category',
    'amount',
    'expenseDate',
    'vendor',
    'paymentMethod',
    'isRecurring',
    'isTaxDeductible',
    'maintenanceRequestId',
    'isPaid',
    'paidDate'
  ]) {
    assert.match(upcoming, new RegExp(`${field}:`));
  }
  assert.match(expenseAction, /ADD_EXPENSE_SUCCESS[\s\S]*meta: \{ invalidateLists \}/);
  assert.doesNotMatch(upcoming, /useFetchExpenses|getExpensesAction|refetchExpenses/);
  assert.match(upcoming, /pauseRecurringExpenseAction/);
  assert.match(upcoming, /resumeRecurringExpenseAction/);
  assert.match(upcoming, /deleteRecurringExpenseAction/);
  assert.match(upcoming, /deleteFutureExpenseAction/);
  assert.match(upcoming, /selectFutureExpenseCleanupById/);
  assert.match(upcoming, /markFutureExpenseCleanupPendingAction/);
  assert.match(upcoming, /await dispatch\s*\(\s*addExpenseAction/);
  assert.match(upcoming, /if \(cleanupPending\)[\s\S]*reconcileFutureExpense[\s\S]*return;[\s\S]*await dispatch\s*\(\s*addExpenseAction/);
  assert.match(upcoming, /hydrateFutureExpenseCleanupAction/);
  assert.match(upcoming, /selectFutureExpenseCleanupHydratedLandlordId/);
  assert.match(upcoming, /readFutureExpenseCleanupMarkers/);
  assert.match(upcoming, /writeFutureExpenseCleanupMarkers/);
  assert.match(upcoming, /upsertFutureExpenseCleanupMarker/);
  assert.match(upcoming, /removeFutureExpenseCleanupMarker/);
  assert.match(upcoming, /cleanupHydrated[\s\S]*requestPending/);
  assert.match(cleanupStorage, /property-peace:future-expense-cleanup:v1/);
  assert.match(cleanupStorage, /landlordId/);
  assert.match(cleanupStorage, /futureExpenseId/);
  assert.match(cleanupStorage, /propertyId/);
  assert.doesNotMatch(cleanupStorage, /expenseId|source|propertyName|name:/);
  assert.match(futureAction, /meta[\s\S]*landlordId[\s\S]*propertyId/);
  assert.match(futureReducer, /HYDRATE_FUTURE_EXPENSE_CLEANUP/);
  assert.match(futureReducer, /cleanupHydratedLandlordId/);
  const cleanupMarker = upcoming.match(/const cleanupMarker = \{([\s\S]*?)\n\s*\};/)?.[1] || '';
  assert.deepEqual(
    new Set(cleanupMarker.match(/[a-zA-Z]+(?=:)/g)),
    new Set(['futureExpenseId', 'propertyId', 'landlordId', 'cleanupError'])
  );
  assert.match(upcoming, /Expense recorded, but the scheduled item could not be removed/);
  assert.match(row, /Expense recorded · cleanup needed/);
  assert.match(row, /Retry scheduled cleanup/);
  assert.match(futureAction, /MARK_FUTURE_EXPENSE_CLEANUP_PENDING/);
  assert.match(futureReducer, /recordedExpenseCleanupById/);
  assert.match(futureReducer, /GET_FUTURE_EXPENSES_SUCCESS[\s\S]*recordedExpenseCleanupById/);
  assert.match(upcoming, /<ConfirmationDialog/);
  assert.match(upcoming, /const notifyFinanceMutation = useCallback[\s\S]*onMutation\(\)/);
  assert.equal((upcoming.match(/onMutation\(\)/g) || []).length, 1);

  const combined = [upcoming, row].join('\n');
  assert.doesNotMatch(combined, /PageBreadcrumbs|PropertySelect|FinancesMetrics|MetricCard|ExpenseAddDrawer/);
});
