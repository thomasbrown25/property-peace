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
    /title: 'Online Payments'[\s\S]*type: 'item'[\s\S]*url: '\/landlord\/settings\?tab=payments'/
  );
  assert.equal((menu.slice(onlinePaymentsIndex, financesIndex).match(/id: '/g) || []).length, 1);
  assert.ok(financesIndex > onlinePaymentsIndex, 'Online Payments should be directly above Finances');
});

test('the former Online Payments route redirects to Settings and preserves the query and hash', async () => {
  const routes = await read('../routes/MainRoutes.jsx');

  assert.doesNotMatch(routes, /import\('pages\/landlord\/online-payments'\)/);
  assert.match(routes, /path: 'landlord\/online-payments',\s*element: <LegacyOnlinePaymentsRedirect \/>/);
  assert.match(routes, /<Navigate to=\{`\$\{buildLegacyOnlinePaymentsRedirect\(search\)\}\$\{hash\}`} replace \/>/);
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

test('Online Rent Payments puts Stripe setup and status in one tab beside Payout Assignments', async () => {
  const [settings, panel] = await Promise.all([
    read('../pages/landlord/settings.jsx'), read('../sections/landlord/settings/OnlinePaymentSettings.jsx')
  ]);

  assert.match(settings, /key: 'payments', label: 'Online Rent Payments',[^}]*component: OnlinePaymentSettings/);
  assert.match(panel, /getOnlinePaymentTabs\(rentPaymentAccess\.presentation\.canConfigure\)/);
  assert.match(panel, /getRequestedOnlinePaymentTab\(searchParams\)/);
  assert.match(panel, /getSelectedOnlinePaymentTab\(requestedTab, paymentTabs\)/);
  assert.match(panel, /params\.set\('paymentTab', value\)/);
  assert.match(panel, /selectedTab === STRIPE_TAB && \([\s\S]*?<PaymentsSettingsContent[\s\S]*?showStripeSetup=\{isStripeSetupRequested\(searchParams\)\}/);
  assert.doesNotMatch(panel, /ShortStayConnect/);
  assert.match(await read('../pages/landlord/short-stay-setup.jsx'), /<ShortStayConnect\b/);
  assert.doesNotMatch(panel, /OnlinePaymentTransactions/);
  assert.match(panel, /selectedTab === 'payout-assignments' && \(\s*<SubscriptionPausedGuard>\s*<PayoutAssignments \/>/);
});

test('property payment actions use the Settings paths for setup and editing', async () => {
  const property = await read('../pages/landlord/property.jsx');
  assert.match(property, /onSelect: \(\) => navigate\(paymentAction\.showInRentCard \? ONLINE_PAYMENT_SETUP_PATH : ONLINE_PAYMENT_STRIPE_PATH\)/);
});

test('the Stripe tab opens and closes the inline wizard for authorized first-time setup', async () => {
  const [page, settings] = await Promise.all([read('../sections/landlord/settings/OnlinePaymentSettings.jsx'), read('../sections/landlord/settings/PaymentsSettings.jsx')]);
  assert.match(page, /if \(setup\) params\.set\('setup', '1'\);\s*else params\.delete\('setup'\);/);
  assert.match(settings, /showStripeSetup && !isDemo && !rentReadinessLoading && !rentReadinessError && canCreateInitialAccount/);
  assert.match(settings, /if \(showStripeSetup && canCreateInitialAccount\) \{[\s\S]*?<ConnectOnboardingWizard\s+embedded\s+onClose=\{onCloseStripeSetup\}/);
});

test('lease and property setup actions use the Online Rent Payments settings route and keep editing open', async () => {
  const setupButton = await read('../components/rent-payments/OnlinePaymentSetupButton.jsx');
  assert.match(setupButton, /component=\{RouterLink\}\s+to=\{ONLINE_PAYMENT_SETUP_PATH\}/);
  assert.match(setupButton, /target=\{isImpersonating\(\) \? undefined : '_blank'\}\s+rel="noopener noreferrer"/);
  for (const path of ['lease.jsx', 'lease-charges.jsx', 'property.jsx', 'property-add.jsx']) {
    const page = await read(`../pages/landlord/${path}`);
    assert.match(page, /<OnlinePaymentSetupButton\b/);
    assert.doesNotMatch(page, /StripeConnectOnboardingDialog|\/api\/stripe\/sync-bank-account/);
  }
  const [legacyLeaseSetup, propertyWorkflow] = await Promise.all([
    read('../pages/landlord/lease-payment-setup.jsx'), read('../pages/landlord/property-add-workflow.jsx')
  ]);
  assert.match(legacyLeaseSetup, /<Navigate to=\{ONLINE_PAYMENT_SETUP_PATH\} replace \/>/);
  assert.doesNotMatch(propertyWorkflow, /StripeConnectOnboardingDialog|\/api\/stripe\/sync-bank-account/);
});

test('Bank Accounts only shows connected Stripe bank accounts, not connected properties or the legacy account card', async () => {
  const settings = await read('../sections/landlord/settings/PaymentsSettings.jsx');

  assert.match(settings, /getStripeBankAccountStatus\(accountStatus\)/);
  assert.match(settings, /label=\{stripeStatus\.label\}/);
  assert.match(settings, /HasPastDueRequirements: data\?\.hasPastDueRequirements === true/);
  assert.match(settings, /stripeStatus\.requirements\.map\(/);
  assert.match(settings, /Connected bank accounts/);
  assert.match(settings, /bankAccounts\.map\(\(account\)/);
  assert.doesNotMatch(settings, /Doing business as/);
  assert.doesNotMatch(settings, /onConfigure=\{/);
  assert.doesNotMatch(settings, /Online rent payment account/);
  assert.doesNotMatch(settings, /Connected Properties/);
  assert.doesNotMatch(settings, /getPropertiesForAccount/);
});
