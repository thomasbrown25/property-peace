import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const read = (relativePath) => readFile(new URL(relativePath, import.meta.url), 'utf8');

test('Accounting navigation places Online Payments directly above Finances', async () => {
  const menu = await read('../menu-items/pages.js');
  const onlinePaymentsIndex = menu.indexOf("id: 'online-payments'");
  const financesIndex = menu.indexOf("id: 'finances'");

  assert.notEqual(onlinePaymentsIndex, -1);
  assert.match(
    menu.slice(onlinePaymentsIndex, financesIndex),
    /title: 'Online Payments'[\s\S]*type: 'item'[\s\S]*url: '\/landlord\/online-payments'/
  );
  assert.equal((menu.slice(onlinePaymentsIndex, financesIndex).match(/id: '/g) || []).length, 1);
  assert.ok(financesIndex > onlinePaymentsIndex, 'Online Payments should be directly above Finances');
});

test('Online Payments is a guarded landlord route', async () => {
  const routes = await read('../routes/MainRoutes.jsx');

  assert.match(routes, /const OnlinePayments = Loadable\(lazy\(\(\) => import\('pages\/landlord\/online-payments'\)\)\);/);
  assert.match(
    routes,
    /path: 'landlord\/online-payments',[\s\S]{0,200}<SubscriptionPausedGuard>[\s\S]{0,100}<OnlinePayments \/>[\s\S]{0,100}<\/SubscriptionPausedGuard>/
  );
});

test('Online Payments shows a one-time welcome before the tabbed payment workspace', async () => {
  const page = await read('../pages/landlord/online-payments.jsx');

  assert.match(page, /<ManagementPageHeader/);
  assert.match(page, /title="Online Payments"/);
  assert.match(page, /hasContinuedToOnlinePayments\(user, currentOrganization\)/);
  assert.match(page, /markOnlinePaymentsContinued\(user, currentOrganization\)/);
  assert.match(page, /Continue to Online Payments/);
  assert.match(page, /<Tab label="Bank Accounts"/);
  assert.match(page, /<Tab label="Payout Assignments"/);
  assert.match(page, /<PaymentsSettings \/>/);
  assert.match(page, /<PayoutAssignments \/>/);
  assert.doesNotMatch(page, /account-status/);
  assert.doesNotMatch(page, /role="status"/);
  assert.doesNotMatch(page, /could not load your current setup status/i);
  assert.doesNotMatch(page, /navigate\('\/landlord\/settings\?tab=payments'\)/);
});
