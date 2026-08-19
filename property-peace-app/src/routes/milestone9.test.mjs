import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const read = (relativePath) => readFile(new URL(relativePath, import.meta.url), 'utf8');

test('money has a canonical route and legacy redirects retain query/property scope', async () => {
  const routes = await read('./MainRoutes.jsx');
  assert.match(routes, /path: 'landlord\/money'/);
  assert.match(routes, /path: 'landlord\/money-activity'[\s\S]*LegacyMoneyRedirect/);
  assert.match(routes, /path: 'money-activity\/:propertyId'[\s\S]*LegacyMoneyRedirect/);
  assert.match(routes, /searchParams\.set\('propertyId', propertyId\)/);
  assert.match(routes, /`\/landlord\/money\?\$\{searchParams\.toString\(\)\}`/);
});

test('landlord navigation exposes Money and a grouped Accounting workspace', async () => {
  const menu = await read('../menu-items/pages.js');
  assert.match(menu, /id: 'money'[\s\S]*title: 'Money'[\s\S]*url: '\/landlord\/money'/);
  assert.match(menu, /id: 'accounting'[\s\S]*title: 'Accounting'[\s\S]*type: 'collapse'/);
  for (const title of ['Rent Collection', 'Payments', 'Expenses', 'Ledger', 'Tax Center']) {
    assert.ok(menu.includes(`title: '${title}'`), `missing Accounting child ${title}`);
  }
  assert.doesNotMatch(menu, /id: 'reports'/);
  assert.match(menu, /url: '\/landlord\/accounting\/tax-center'/);

  const routes = await read('./MainRoutes.jsx');
  assert.match(routes, /path: 'landlord\/accounting\/tax-center'/);
  assert.match(routes, /path: 'landlord\/reports'[\s\S]*Navigate to="\/landlord\/accounting\/tax-center"/);
  assert.match(routes, /path: 'landlord\/reports\/tax'[\s\S]*Navigate to="\/landlord\/accounting\/tax-center"/);

  const mobile = await read('../layout/Dashboard/BottomNavBar/index.jsx');
  assert.match(mobile, /mobileLandlordSections/);
  assert.match(mobile, /section\.title/);
  assert.match(mobile, /section\.children\.map/);
});

test('financial reports use the filter-only API signatures and distinguish empty from failure', async () => {
  const financial = await read('../pages/landlord/reports/financial.jsx');
  for (const method of ['getExpenseReport', 'getExpenseReportSummary', 'getExpenseReportByCategory', 'getPropertyProfitability', 'getYearOverYearComparison', 'getIncomeByYear']) {
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
