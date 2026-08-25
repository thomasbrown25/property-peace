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

  assert.match(page, /useFinancesMoneyData\(searchParams, drawer\.financeMutationVersion\)/);
  assert.match(page, /useFinancesPayments\(propertyId, drawer\.financeMutationVersion\)/);
  assert.match(page, /localSelectedProperty=\{selectedProperty \|\| ALL_PROPERTIES_SCOPE\}/);
  assert.match(page, /sumCollectedThisMonth\(paymentsData\.payments, new Date\(\), propertyId\)/);
  assert.match(page, /collectedThisMonthAvailable=\{paymentsData\.available\}/);
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
