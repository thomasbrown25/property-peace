import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const read = (relativePath) => readFile(new URL(relativePath, import.meta.url), 'utf8');

test('finances is the guarded canonical finance-list route', async () => {
  const routes = await read('./MainRoutes.jsx');

  assert.match(routes, /const Finances = Loadable\(lazy\(\(\) => import\('pages\/landlord\/finances'\)\)\);/);
  assert.doesNotMatch(routes, /const (Expenses|Payments|Ledger|MoneyActivity) = Loadable/);
  assert.match(
    routes,
    /path: 'landlord\/finances',[\s\S]{0,200}<SubscriptionPausedGuard>[\s\S]{0,100}<Finances \/>[\s\S]{0,100}<\/SubscriptionPausedGuard>/
  );
});

test('legacy finance-list routes redirect directly to the intended Finances tab', async () => {
  const routes = await read('./MainRoutes.jsx');
  const redirects = [
    ['landlord/expenses', 'expenses'],
    ['landlord/payments', 'payments'],
    ['landlord/ledger', 'activity'],
    ['landlord/money', 'activity'],
    ['landlord/money-activity', 'activity'],
    ['money-activity/:propertyId', 'activity']
  ];

  for (const [legacyPath, tab] of redirects) {
    const escapedPath = legacyPath.replace(/[.*+?^$()|[\]\\]/g, '\\$&');
    assert.match(
      routes,
      new RegExp("path: '" + escapedPath + '\',[\\s\\S]{0,120}<LegacyFinancesRedirect tab="' + tab + '" \\/>'),
      legacyPath + ' must redirect directly to the ' + tab + ' tab'
    );
  }

  assert.match(
    routes,
    /function LegacyFinancesRedirect\(\{ tab \}\)[\s\S]{0,300}return <Navigate to=\{buildLegacyFinancesRedirect\(search, \{ tab, propertyId \}\)\} replace \/>;/
  );
  assert.doesNotMatch(routes, /<Expenses \/>|<Payments \/>|<Ledger \/>|<MoneyActivity \/>/);
});

test('payment workflows and both Tax Center aliases remain real routes', async () => {
  const routes = await read('./MainRoutes.jsx');

  assert.match(
    routes,
    /path: 'landlord\/payments\/record',[\s\S]{0,200}<SubscriptionPausedGuard>[\s\S]{0,100}<RecordPaymentPage \/>[\s\S]{0,100}<\/SubscriptionPausedGuard>/
  );
  assert.match(
    routes,
    /path: 'landlord\/payments\/add',[\s\S]{0,200}<SubscriptionPausedGuard>[\s\S]{0,100}<PaymentAddWorkflow \/>[\s\S]{0,100}<\/SubscriptionPausedGuard>/
  );
  assert.match(routes, /path: 'landlord\/accounting\/tax-center',\s*element: <EntitlementGate><TaxReports \/><\/EntitlementGate>/);
  assert.match(routes, /path: 'landlord\/money\/tax-center',\s*element: <EntitlementGate><TaxReports \/><\/EntitlementGate>/);
});

test('mobile navigation still renders grouped landlord sections accessibly', async () => {
  const mobile = await read('../layout/Dashboard/BottomNavBar/index.jsx');

  assert.match(mobile, /mobileLandlordSections/);
  assert.match(mobile, /section\.title/);
  assert.match(mobile, /section\.children\.map/);
});
test('financial reports use the filter-only API signatures and distinguish empty from failure', async () => {
  const financial = await read('../pages/landlord/reports/financial.jsx');
  for (const method of [
    'getExpenseReport',
    'getExpenseReportSummary',
    'getExpenseReportByCategory',
    'getPropertyProfitability',
    'getYearOverYearComparison',
    'getIncomeByYear'
  ]) {
    assert.doesNotMatch(financial, new RegExp(`${method}\\(landlordId,`), `${method} still uses stale landlordId signature`);
  }
  assert.match(financial, /Loading financial reports/);
  assert.match(financial, /Unable to load financial reports/);
  assert.match(financial, /No financial activity found/);
  assert.match(financial, /Promise\.allSettled/);
  assert.match(financial, /requestId !== requestSequence\.current/);
  assert.match(financial, /Some report sections could not be refreshed/);
  assert.match(financial, /aria-label': 'Expense category'/);
  assert.match(financial, /financial-export-menu/);
  assert.match(financial, /onClick={fetchData}>Try again/);
});

test('tax workspace describes preparation/review truthfully', async () => {
  const tax = await read('../pages/landlord/reports/tax.jsx');
  assert.ok(tax.includes('Tax preparation checklist'));
  assert.ok(tax.includes('QuickBooks experimental template'));
  assert.ok(tax.includes('Xero experimental template'));
  assert.ok(tax.includes('Accountant-review package'));
  assert.doesNotMatch(tax, /Estimated savings|estimatedSavings|22%/i);
  assert.doesNotMatch(tax, /Per-property Schedule E/);
  assert.match(tax, /Promise\.allSettled/);
  assert.match(tax, /requestId !== taxRequestSequence\.current/);
  assert.match(tax, /Some tax workspace sections could not be refreshed/);
  assert.match(tax, /Search tax-deductible expenses/);
  assert.match(tax, /aria-label={`Edit tax category/);
  assert.match(tax, /tax-export-menu/);
});

test('tax workspace header keeps utility controls distinct from primary actions', async () => {
  const tax = await read('../pages/landlord/reports/tax.jsx');
  assert.match(tax, /aria-label="Tax workspace actions"/);
  assert.match(tax, /gridTemplateColumns: \{ xs: '1fr', sm: 'repeat\(2, minmax\(0, 1fr\)\)' \}/);
  assert.ok(tax.indexOf('aria-label="Refresh tax data"') < tax.indexOf('Download Schedule E'));
  assert.doesNotMatch(tax, /calc\(100% - 140px\)/);
});

test('Money Center and mobile Accounting navigation expose state to assistive technology', async () => {
  const money = await read('../components/money-center/MoneyCenter.jsx');
  const mobile = await read('../layout/Dashboard/BottomNavBar/index.jsx');
  assert.match(money, /role="status" aria-live="polite"/);
  assert.match(money, /aria-controls="money-calculation-details"/);
  assert.match(money, /aria-labelledby': 'money-detail-title'/);
  assert.match(money, /The CSV could not be prepared/);
  assert.match(money, /matching loaded source records/);
  assert.match(money, /Some activity response fields were unavailable/);
  assert.match(money, /Summary totals are unavailable/);
  assert.match(money, /error && itemsError/);
  assert.match(money, /not confirmation that the period has no records/);
  assert.match(mobile, /aria-expanded={moreOpen}/);
  assert.match(mobile, /aria-controls="mobile-more-navigation"/);
  assert.match(mobile, /'aria-label': 'More landlord navigation'/);
  assert.match(mobile, /boxSizing: 'border-box'/);
  assert.doesNotMatch(mobile, /disableEnforceFocus|disableAutoFocus|hideBackdrop/);
});
