import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { formatAccountMoney, loadDashboardAccounts, loadDashboardActivity, RECENT_ACTIVITY_LIMIT } from './dashboardAccounts.mjs';
const require = createRequire(import.meta.url);
const parser = require('@babel/parser');

test('accounts load scoped real balances and retain missing balances as unavailable', async () => {
  const requests = [];
  const client = { get: async (url, config) => {
    requests.push({ url, config });
    if (url === '/api/bank-accounts') return { data: { success: true, data: [
      { id: 1, isActive: true, stripeAccountId: 'acct_one' },
      { id: 2, isActive: true, stripeAccountId: 'acct_two' },
      { id: 3, isActive: false, stripeAccountId: 'acct_old' },
      { id: 4, isActive: true }
    ] } };
    if (url.endsWith('/1/balance')) return { data: { success: true, data: { balances: [{ currency: 'usd', available: 0, pending: 5 }] } } };
    throw new Error('Provider unavailable');
  } };
  const result = await loadDashboardAccounts(client, 42);
  assert.equal(result.length, 2);
  assert.deepEqual(result[0].balances, [{ currency: 'usd', available: 0, pending: 5 }]);
  assert.equal(result[0].balanceError, false);
  assert.equal(result[1].balanceError, true);
  assert.deepEqual(result[1].balances, []);
  assert.equal(requests.length, 3);
  assert.ok(requests.every(({ config }) => config.headers['X-Organization-Id'] === '42'));
});

test('service failures and malformed account responses are not empty success states', async () => {
  for (const data of [{ success: false, data: [] }, { success: true, data: {} }]) {
    await assert.rejects(loadDashboardAccounts({ get: async () => ({ data }) }, 1));
  }
});

test('empty Stripe balance list remains empty, not a fictional USD zero', async () => {
  const client = { get: async (url) => ({ data: { success: true, data: url.endsWith('/balance')
    ? { balances: [] } : [{ id: 1, isActive: true, stripeAccountId: 'acct_one' }] } }) };
  const [account] = await loadDashboardAccounts(client, 1);
  assert.deepEqual(account.balances, []);
  assert.equal(account.balanceError, false);
});

test('recent activity requests five records in organization scope and caps oversized responses', async () => {
  const items = Array.from({ length: 9 }, (_, id) => ({ id }));
  const client = { get: async (url, config) => {
    assert.equal(url, '/api/activities');
    assert.deepEqual(config.params, { page: 1, pageSize: 5 });
    assert.equal(config.headers['X-Organization-Id'], '7');
    return { data: { success: true, data: { activities: items } } };
  } };
  assert.equal(RECENT_ACTIVITY_LIMIT, 5);
  assert.deepEqual(await loadDashboardActivity(client, 7), items.slice(0, 5));
});

test('activity failures do not masquerade as no recent activity', async () => {
  await assert.rejects(loadDashboardActivity({ get: async () => ({ data: { success: false } }) }, 1));
});

test('balance formatting respects currency decimals, true zero and unavailable values', () => {
  assert.equal(formatAccountMoney(0, 'usd'), '$0.00');
  assert.equal(formatAccountMoney(1234.56, 'usd'), '$1,234.56');
  assert.equal(formatAccountMoney(123, 'jpy'), '¥123');
  assert.equal(formatAccountMoney(null, 'usd'), '—');
  assert.equal(formatAccountMoney(undefined, 'usd'), '—');
  assert.equal(formatAccountMoney('bad', 'usd'), '—');
});

test('setup card only appears for a loaded empty account list in the current scope', () => {
  const source = readFileSync(new URL('./OwnerHomeSidebar.jsx', import.meta.url), 'utf8');
  const ast = parser.parse(source, { sourceType: 'module', plugins: ['jsx'] });
  let gate;
  const visit = (node) => {
    if (!node || typeof node !== 'object') return;
    if (node.type === 'LogicalExpression' && node.operator === '&&' && node.right.type === 'JSXElement' &&
        source.slice(node.right.start, node.right.end).includes('Set up payments')) gate = node.left;
    for (const value of Object.values(node)) {
      if (Array.isArray(value)) value.forEach(visit);
      else if (value && typeof value === 'object') visit(value);
    }
  };
  visit(ast);
  assert.ok(gate, 'production setup card condition exists');
  const visible = new Function('ready', 'accounts', `return Boolean(${source.slice(gate.start, gate.end)});`);
  assert.equal(visible(true, { data: [] }), true);
  assert.equal(visible(false, { data: [] }), false);
  assert.equal(visible(true, {}), false);
  assert.equal(visible(true, { data: [{ id: 1 }] }), false);
  // LoadState suppresses all children on loading/error, including a cached empty result.
  const loadState = ast.program.body.find((node) => node.type === 'FunctionDeclaration' && node.id.name === 'LoadState');
  assert.equal(loadState.body.body[0].test.name, 'loading');
  assert.equal(loadState.body.body[1].test.name, 'error');
  assert.equal(loadState.body.body[2].argument.name, 'children');
});

test('sidebar and dashboard JSX parse and preserve accessible section contract', () => {
  const sidebar = readFileSync(new URL('./OwnerHomeSidebar.jsx', import.meta.url), 'utf8');
  const home = readFileSync(new URL('./OwnerTodayHome.jsx', import.meta.url), 'utf8');
  for (const source of [sidebar, home]) parser.parse(source, { sourceType: 'module', plugins: ['jsx'] });
  assert.match(sidebar, /aria-expanded=\{accountsOpen\}/);
  assert.match(sidebar, /aria-controls="owner-accounts-content"/);
  assert.match(sidebar, /<Collapse in=\{accountsOpen\} id="owner-accounts-content"/);
  assert.match(sidebar, /to="\/landlord\/activity"/);
  assert.match(sidebar, /Recent activity/);
  assert.match(sidebar, /Stripe funds · not your bank balance/);
  assert.match(sidebar, /id="owner-accounts-heading"[^>]*>Stripe accounts<\/Typography>/);
  assert.match(sidebar, />Stripe account<\/Typography>/);
  assert.match(sidebar, /Payout bank: \{account\.displayName/);
  assert.match(sidebar, />Set up online payments<\/Typography>/);
  assert.match(sidebar, /Connect your Stripe account or finish setup/);
  assert.match(sidebar, /<Button component=\{RouterLink\} to="\/landlord\/online-payments" variant="contained" fullWidth/);
  assert.match(sidebar, />\s*Set up payments\s*<\/Button>/);
  assert.match(sidebar, /\['owner-home-accounts', organizationId, userId\]/);
  assert.match(sidebar, /\['owner-home-activity', organizationId, userId\]/);
  assert.match(home, /<OwnerHomeSidebar \/>/);
  assert.match(home, /lg: '280px minmax\(0, 1fr\)'/);
});
