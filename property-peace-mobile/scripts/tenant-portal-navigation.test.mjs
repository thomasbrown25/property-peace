import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const file = (path) => readFile(new URL(`../src/${path}`, import.meta.url), 'utf8');

test('tenant dock shows Leases immediately after Payments, before Maintenance and Messages', async () => {
  const [model, nav, dock] = await Promise.all([file('navigation/mainTabModel.ts'), file('navigation/MainNavigator.tsx'), file('navigation/QuickActionsTabBar.tsx')]);
  assert.match(model, /tenant: \[\s*\{ name: 'Payments', component: 'TenantPaymentsScreen' \},\s*\{ name: 'Leases', component: 'TenantLeasesNavigator' \},\s*\{ name: 'Maintenance', component: 'TenantMaintenanceNavigator' \},\s*\{ name: 'Messages', component: 'MessagesNavigator' \},\s*\{ name: 'Settings', component: 'SettingsScreen' \}/);
  assert.match(nav, /TenantPaymentsScreen:?(?: TenantPaymentsScreen)?[,\s]/);
  assert.match(dock, /audience === 'landlord' && route\.name === 'Maintenance'/);
  assert.match(dock, /visibleRoutes\.map\(renderTab\)/);
  assert.match(dock, /accessibilityLabel="Settings"/);
  assert.match(dock, /label: 'Payments'[^\n]*route: 'Payments'/);
  assert.doesNotMatch(dock.slice(dock.indexOf('const tenantMenu:'), dock.indexOf('// Do not send a development/preview')), /webPath:/);
});

test('tenant screens reuse landlord-style header and leave room below floating dock', async () => {
  const [pay, maintenance, messagesHeader] = await Promise.all([file('screens/tenant/TenantPaymentsScreen.tsx'), file('screens/tenant/TenantMaintenanceScreen.tsx'), file('components/LandlordPageHeader.tsx')]);
  assert.match(pay, /<LandlordPageHeader title="Payments"/);
  assert.match(maintenance, /<LandlordPageHeader title="Maintenance"/);
  assert.match(maintenance, /paddingBottom: Math\.max\(insets\.bottom, 24\) \+ 100/);
  assert.match(pay, /paddingBottom: Math\.max\(insets\.bottom, 24\) \+ 100/);
  assert.match(messagesHeader, /!isTenant && <GlobalSearchModal/);
  assert.match(messagesHeader, /!isTenant && <TouchableOpacity[^\n]*setSearchOpen/);
});

test('payments header uses the landlord theme logos and rent/history copy stays concise', async () => {
  const [pay, header] = await Promise.all([file('screens/tenant/TenantPaymentsScreen.tsx'), file('components/LandlordPageHeader.tsx')]);
  assert.match(pay, /<LandlordPageHeader title="Payments" logo \/>/);
  assert.match(header, /mode === 'dark' \? darkLogo : lightLogo/);
  assert.match(header, /property-peace-navbar-logo\.png/);
  assert.match(header, /property-peace-logo\.png/);
  assert.match(pay, /rentIsLate\(rent\)/);
  assert.match(pay, /Past due' : 'Due/);
  assert.match(pay, /<Modal visible=\{!!modalCharge\}/);
  assert.doesNotMatch(pay, /Rent only\. Fees and deposits|Only finalized rent payments count as paid|Confirmed rent payments:|Online payments are not available yet/);
});

test('tenant charges show server-scoped balances, fee checkout and read-only deposits', async () => {
  const pay = await file('screens/tenant/TenantPaymentsScreen.tsx');
  assert.match(pay, /api\.charges\(id\)/);
  assert.match(pay, /setCharges\(chargeResult/);
  assert.match(pay, /setCharges\(\[\]\)/);
  assert.match(pay, /setChargeError\(/);
  assert.match(pay, /Some payment items are unavailable/);
  assert.match(pay, /Deposit payments are not available online/);
  assert.match(pay, /submitFeePayment\(/);
  assert.match(pay, /canPayFee\(lease, charge, readiness\)/);
  assert.match(pay, /money\(charge\.remaining\)/);
  assert.match(pay, /paymentStatus\(payment\)/);
  assert.doesNotMatch(pay, /createIntent\(charge\./);
});

test('tenant settings hide landlord operations but keep personal account, alerts and appearance', async () => {
  const settings = await file('screens/landlord/SettingsScreen.tsx');
  assert.match(settings, /const isTenant = maintenanceAudience\(currentUser\) === 'tenant'/);
  assert.match(settings, /visibleCategories = isTenant \? categories\.filter\(item => !\['subscription', 'payments', 'smsnumber'\]/);
  assert.match(settings, /visibleProfileFields = isTenant \? profileFields\.filter\(item => !item\.key\.startsWith\('business'\)/);
  assert.match(settings, /\{!category && visibleCategories\.map/);
});
