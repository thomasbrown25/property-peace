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

test('Transactions reloads for the active organization without rendering stale organization data', async () => {
  const transactions = await read('../sections/landlord/payments/OnlinePaymentTransactions.jsx');

  assert.match(transactions, /const \{ currentOrganization, loading: organizationLoading \} = useOrganization\(\)/);
  assert.match(transactions, /loadedOrganizationId === organizationId \? payments : \[\]/);
  assert.match(transactions, /\[organizationId, organizationLoading, retryVersion\]/);
  assert.match(transactions, /return \(\) => controller\.abort\(\)/);
  assert.match(transactions, /\.get\('\/api\/stripe\/payment-transactions'/);
  assert.match(transactions, /\.get\('\/api\/stripe\/account-status'/);
  assert.doesNotMatch(transactions, /\/api\/payment\/all/);
  assert.match(transactions, /canOpenStripeDashboard &&[\s\S]{0,220}<Button[\s\S]{0,160}size="small"[\s\S]{0,280}View Stripe Dashboard/);
  assert.match(transactions, /All properties/);
});

test('Online Payments shows a one-time welcome before the tabbed payment workspace', async () => {
  const page = await read('../pages/landlord/online-payments.jsx');

  assert.match(page, /<ManagementPageHeader/);
  assert.match(page, /title="Online Payments"/);
  assert.match(page, /user\.hasContinuedToOnlinePayments === true/);
  assert.match(page, /post\('\/api\/user\/online-payments-welcome\/continue'\)/);
  assert.match(page, /updateUser\(\{ hasContinuedToOnlinePayments: true \}\)/);
  assert.match(page, /hasContinuedToOnlinePayments\(user, currentOrganization\)/);
  assert.match(page, /markOnlinePaymentsContinued\(user, currentOrganization\)/);
  assert.match(page, /Continue to Online Payments/);
  assert.match(page, /useState\(DEFAULT_ONLINE_PAYMENT_TAB\)/);
  assert.match(page, /getOnlinePaymentTabs\(rentPaymentAccess\.access, rentPaymentAccess\.presentation\.canConfigure\)/);
  assert.match(page, /getSelectedOnlinePaymentTab\(activeTab, paymentTabs\)/);
  assert.match(page, /paymentTabs\.map\(\(\{ id, label \}\)/);
  assert.match(page, /value=\{selectedTab\}/);
  assert.match(page, /selectedTab === 'transactions' && <OnlinePaymentTransactions \/>/);
  assert.ok(page.includes("selectedTab === 'bank-accounts' && ("));
  assert.ok(page.includes('<PaymentsSettingsContent rentPaymentAccess={rentPaymentAccess} headerActionElement={paymentHeaderActionElement} />'));
  assert.match(page, /actions=\{selectedTab === 'bank-accounts' \? <Box ref=\{setPaymentHeaderActionElement\} \/> : null\}/);
  assert.match(page, /selectedTab === 'payout-assignments' && <PayoutAssignments \/>/);
  assert.doesNotMatch(page, /account-status/);
  assert.doesNotMatch(page, /role="status"/);
  assert.doesNotMatch(page, /could not load your current setup status/i);
  assert.doesNotMatch(page, /navigate\('\/landlord\/settings\?tab=payments'\)/);
});

test('Bank Accounts only shows connected Stripe bank accounts, not connected properties or the legacy account card', async () => {
  const settings = await read('../sections/landlord/settings/PaymentsSettings.jsx');

  assert.match(settings, /Payment entity/);
  assert.match(settings, /Connected bank accounts/);
  assert.match(settings, /bankAccounts\.map\(\(account\)/);
  assert.match(settings, /createPortal\(addAccountButton, headerActionElement\)/);
  assert.match(settings, /!headerActionElement && addAccountButton/);
  assert.doesNotMatch(settings, /Online rent payment account/);
  assert.doesNotMatch(settings, /Connected Properties/);
  assert.doesNotMatch(settings, /getPropertiesForAccount/);
});
