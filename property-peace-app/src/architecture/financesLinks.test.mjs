import assert from 'node:assert/strict';
import { readdir, readFile } from 'node:fs/promises';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

const srcRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const mainRoutesPath = path.join(srcRoot, 'routes', 'MainRoutes.jsx');
const percySourcesPath = path.join(srcRoot, 'utils', 'percySources.js');
const sourceExtensions = new Set(['.js', '.jsx', '.mjs']);
const legacyListPath = /^\/?landlord\/(expenses|payments|ledger|money|money-activity)$/;
const allowedRedirectPaths = new Map([
  ['landlord/expenses', 'expenses'],
  ['landlord/payments', 'payments'],
  ['landlord/ledger', 'activity'],
  ['landlord/money', 'activity'],
  ['landlord/money-activity', 'activity']
]);
const taxCenterCompatibilityPath = 'landlord/money/tax-center';

async function sourceFiles(directory) {
  const entries = await readdir(directory, { withFileTypes: true });
  const nested = await Promise.all(entries.map(async (entry) => {
    const absolutePath = path.join(directory, entry.name);
    if (entry.isDirectory()) return sourceFiles(absolutePath);
    if (!sourceExtensions.has(path.extname(entry.name)) || entry.name.includes('.test.')) return [];
    return [absolutePath];
  }));
  return nested.flat();
}

function isPathnameCheck(line, literalIndex) {
  const prefix = line.slice(0, literalIndex);
  return /(?:location\.)?pathname\s*===\s*$/.test(prefix) || /(?:location\.)?pathname\.startsWith\(\s*$/.test(prefix);
}

function isAllowedPercySourceTranslation(filePath, line, destination) {
  // This exact pair normalizes trusted backend data; it is not an application navigation destination.
  return filePath === percySourcesPath && destination === '/landlord/payments' &&
    /^\s*\['\/landlord\/payments', '\/landlord\/finances\?tab=payments'\]\s*$/.test(line);
}

function isAllowedCompatibilityDeclaration(filePath, lines, lineIndex, literalIndex, destination) {
  if (filePath !== mainRoutesPath || !/\bpath:\s*$/.test(lines[lineIndex].slice(0, literalIndex))) return false;

  const routeElement = lines.slice(lineIndex + 1, lineIndex + 3).join('\n');
  if (destination === taxCenterCompatibilityPath) {
    return /element:\s*<EntitlementGate><TaxReports\s*\/><\/EntitlementGate>/.test(routeElement);
  }

  const tab = allowedRedirectPaths.get(destination);
  return Boolean(tab) && new RegExp(`element:\\s*<LegacyFinancesRedirect tab=["']${tab}["'] \\/>`).test(routeElement);
}

async function findLegacyListDestinations() {
  const violations = [];
  for (const filePath of await sourceFiles(srcRoot)) {
    const source = await readFile(filePath, 'utf8');
    const lines = source.split(/\r?\n/);
    lines.forEach((line, index) => {
      const literalPattern = /(['"`])(\/?landlord\/(?:expenses|payments|ledger|money(?:-activity)?)(?:[^'"`]*)?)\1/g;
      for (const match of line.matchAll(literalPattern)) {
        const destination = match[2];
        const pathname = destination.split(/[?#]/, 1)[0];
        const normalizedPathname = pathname.replace(/^\//, '');
        if (normalizedPathname === taxCenterCompatibilityPath) {
          if (isAllowedCompatibilityDeclaration(filePath, lines, index, match.index, destination)) continue;
          violations.push(`${path.relative(srcRoot, filePath)}:${index + 1} ${destination}`);
          continue;
        }
        if (!legacyListPath.test(pathname)) continue;
        if (isPathnameCheck(line, match.index)) continue;
        if (isAllowedPercySourceTranslation(filePath, line, destination)) continue;
        if (isAllowedCompatibilityDeclaration(filePath, lines, index, match.index, destination)) continue;
        violations.push(`${path.relative(srcRoot, filePath)}:${index + 1} ${destination}`);
      }
    });
  }
  return violations;
}

test('app navigation uses canonical Finances tab destinations', async () => {
  assert.deepEqual(await findLegacyListDestinations(), []);
});

test('Dashboard loading follows canonical Finances through accounting state', async () => {
  const dashboard = await readFile(path.join(srcRoot, 'layout', 'Dashboard', 'index.jsx'), 'utf8');
  const finances = await readFile(path.join(srcRoot, 'pages', 'landlord', 'finances.jsx'), 'utf8');

  assert.match(dashboard, /const isFinancesPage = pathname === '\/landlord\/finances'/);
  assert.match(dashboard, /\(isFinancesPage && isAccountingLoading\)/);
  assert.doesNotMatch(dashboard, /isExpensesPage|isExpensesLoading/);
  assert.match(finances, /import \{ useDashboardLoading \} from 'contexts\/DashboardLoadingContext';/);
  assert.match(finances, /const \{ setAccountingLoading \} = useDashboardLoading\(\);/);
  assert.match(
    finances,
    /const pageLoading = isFinancesPageLoading\(\{[\s\S]*propertiesLoading,[\s\S]*moneyLoading: moneyData\.loading,[\s\S]*moneyScopeChanged,[\s\S]*paymentsLoading: paymentsData\.loading,[\s\S]*paymentsScopeChanged,[\s\S]*expensesLoading: expensesData\.loading[\s\S]*\}\);/
  );
  assert.match(
    finances,
    /useEffect\(\(\) => \{\s*setAccountingLoading\(pageLoading\);\s*\}, \[pageLoading, setAccountingLoading\]\);/
  );
  assert.match(
    finances,
    /useEffect\(\(\) => \(\) => \{\s*setAccountingLoading\(false\);\s*\}, \[setAccountingLoading\]\);/
  );
  assert.doesNotMatch(
    finances,
    /useEffect\(\(\) => \{\s*setAccountingLoading\(pageLoading\);\s*return \(\) => setAccountingLoading\(false\);/
  );
});
