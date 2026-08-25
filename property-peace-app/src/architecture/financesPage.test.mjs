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
  assert.match(page, /const FINANCES_TAB_LABELS = \[\s*\['review', 'Needs review'\],\s*\['activity', 'Activity'\],\s*\['expenses', 'Expenses'\],\s*\['payments', 'Payments'\],\s*\['upcoming', 'Upcoming'\]\s*\];/);
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
  assert.match(
    page,
    /collectedThisMonthAvailable=\{!paymentsData\.loading && !paymentsScopeChanged && paymentsData\.available\}/
  );
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
