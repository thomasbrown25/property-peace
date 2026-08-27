import assert from 'node:assert/strict';
import { readdir, readFile } from 'node:fs/promises';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

const srcRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const source = (relativePath) => readFile(path.join(srcRoot, relativePath), 'utf8');
const occurrences = (value, expression) => (value.match(expression) || []).length;

async function sourceIfPresent(relativePath) {
  try {
    return await source(relativePath);
  } catch (error) {
    if (error?.code === 'ENOENT') return null;
    throw error;
  }
}

async function financeSources(relativePath) {
  const directory = path.join(srcRoot, relativePath);
  try {
    const entries = await readdir(directory, { withFileTypes: true });
    const nested = await Promise.all(entries.map(async (entry) => {
      const entryPath = path.join(relativePath, entry.name);
      return entry.isDirectory() ? financeSources(entryPath) : [entryPath];
    }));
    return nested.flat();
  } catch (error) {
    if (error?.code === 'ENOENT') return [];
    throw error;
  }
}

test('shared Money data hook makes one coordinated request pair per scope', async () => {
  const hook = await source('hooks/useFinancesMoneyData.js');

  assert.equal(occurrences(hook, /moneyCenterAPI\.overview\(/g), 1);
  assert.equal(occurrences(hook, /moneyCenterAPI\.items\(/g), 1);
  assert.match(hook, /const controller = new AbortController\(\);/);
  assert.match(hook, /Promise\.allSettled\(\[\s*moneyCenterAPI\.overview\(params, controller\.signal\),\s*moneyCenterAPI\.items\(params, controller\.signal\)\s*\]\)/);
  assert.match(hook, /requestIdRef\.current \+= 1/);
  assert.match(hook, /if \(requestId !== requestIdRef\.current \|\| controller\.signal\.aborted\) return;/);
  assert.match(hook, /const \[overviewError, setOverviewError\] = useState\(/);
  assert.match(hook, /const \[itemsError, setItemsError\] = useState\(/);
  assert.match(hook, /buildFinancesMoneyQuery\(searchParams\)/);
  assert.match(hook, /normalizeMoneyCenterOverview\(overviewResult\.value\)/);
  assert.match(hook, /normalizeMoneyCenterItemsResponse\(itemsResult\.value\)/);
  assert.match(hook, /deriveFinancesMoneyItems\(itemsResponse\)/);
  assert.match(hook, /downloadMoneyCenterExport\(await moneyCenterAPI\.export\(params\)\)/);
  assert.match(hook, /return \(\) => controller\.abort\(\);/);
});

test('shared Payments hook is the only Finances owner of the payment list endpoint', async () => {
  const hook = await source('hooks/useFinancesPayments.js');
  const financeFiles = [
    'pages/landlord/finances.jsx',
    ...(await financeSources('sections/landlord/finances'))
  ];
  const componentSources = (await Promise.all(financeFiles.map(sourceIfPresent))).filter(Boolean);

  assert.equal(occurrences(hook, /['"]\/api\/payment\/all['"]/g), 1);
  assert.match(hook, /buildFinancesPaymentRequestScope\(propertyId, unitId\)/);
  assert.match(hook, /\[propertyId, unitId, mutationVersion, retryVersion\]/);
  assert.match(hook, /axiosServices\.get\('\/api\/payment\/all', \{ params, signal: controller\.signal \}\)/);
  assert.match(hook, /response\?\.data\?\.data/);
  assert.match(hook, /response\?\.data\?\.Data/);
  assert.match(hook, /Array\.isArray\(data\) \? data : \[\]/);
  assert.match(hook, /requestIdRef\.current \+= 1/);
  assert.match(hook, /if \(requestId !== requestIdRef\.current \|\| controller\.signal\.aborted\) return;/);
  assert.match(hook, /return \(\) => controller\.abort\(\);/);
  componentSources.forEach((component) => assert.doesNotMatch(component, /\/api\/payment\/all/));
});
test('truncated Money Center rows stay explicitly partial without adding another request owner', async () => {
  const [hook, page, activity, row, review, account, api] = await Promise.all([
    source('hooks/useFinancesMoneyData.js'),
    source('pages/landlord/finances.jsx'),
    source('sections/landlord/finances/ActivityTab.jsx'),
    source('sections/landlord/finances/ActivityRow.jsx'),
    source('sections/landlord/finances/NeedsReviewTab.jsx'),
    source('sections/landlord/finances/AccountActivityCard.jsx'),
    source('api/moneyCenter.js')
  ]);

  assert.match(hook, /clientDerivationsAvailable/);
  assert.match(page, /<ActivityTab[\s\S]*partial=\{Boolean\(moneyData\.itemsResponse\?\.isTruncated\)\}/);
  assert.match(page, /<NeedsReviewTab[\s\S]*partial=\{Boolean\(moneyData\.itemsResponse\?\.isTruncated\)\}/);
  assert.match(page, /<AccountActivityCard[\s\S]*partial=\{Boolean\(moneyData\.itemsResponse\?\.isTruncated\)\}/);
  assert.match(activity, /partial && hasClientFilters/);
  assert.match(activity, /Showing \{loadedCount\} of \{sourceTotalCount\}/);
  assert.doesNotMatch(activity, /Showing \$\{loadedCount\}/);
  assert.match(activity, /Filtered activity export is unavailable while this view is partial/);
  assert.match(review, /partial/);
  assert.match(review, /Showing \{loadedCount\} of \{totalCount\}/);
  assert.doesNotMatch(review, /Showing \$\{loadedCount\}/);
  assert.match(review, /Review export is unavailable while this view is partial/);
  assert.match(account, /Account totals are unavailable because only/);
  assert.match(account, /only \{loadedCount\} of \{totalCount\} source records loaded/);
  assert.doesNotMatch(account, /only \$\{loadedCount\}/);
  assert.match(row, /entry\.runningBalance == null \? 'Unavailable'/);
  assert.match(api, /items: .*limit: 1000/);
  assert.match(api, /export: .*contractParams\(params\).*responseType: 'blob'/);
  assert.doesNotMatch(api, /offset|pageSize/);
});