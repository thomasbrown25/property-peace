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
  assert.match(hook, /buildActivityEntries\(/);
  assert.match(hook, /selectNeedsReviewItems\(/);
  assert.match(hook, /buildAccountActivity\(/);
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
  assert.match(hook, /const params = propertyId \? \{ propertyId \} : undefined;/);
  assert.match(hook, /axiosServices\.get\('\/api\/payment\/all', \{ params, signal: controller\.signal \}\)/);
  assert.match(hook, /response\?\.data\?\.data/);
  assert.match(hook, /response\?\.data\?\.Data/);
  assert.match(hook, /Array\.isArray\(data\) \? data : \[\]/);
  assert.match(hook, /requestIdRef\.current \+= 1/);
  assert.match(hook, /if \(requestId !== requestIdRef\.current \|\| controller\.signal\.aborted\) return;/);
  assert.match(hook, /return \(\) => controller\.abort\(\);/);
  componentSources.forEach((component) => assert.doesNotMatch(component, /\/api\/payment\/all/));
});