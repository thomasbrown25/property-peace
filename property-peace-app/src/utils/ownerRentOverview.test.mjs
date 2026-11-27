import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import * as ownerHome from './ownerHome.js';

test('a confirmed empty portfolio shows a plain Rent overview message before rendering payment controls', () => {
  const home = readFileSync(new URL('../sections/landlord/dashboard/OwnerTodayHome.jsx', import.meta.url), 'utf8');
  const view = readFileSync(new URL('../sections/landlord/dashboard/OwnerRentOverview.jsx', import.meta.url), 'utf8');
  assert.match(home, /emptyPortfolio=\{propertiesStatus === 'ready' && properties\?\.length === 0\}/);
  const emptyView = view.match(/if \(emptyPortfolio\) \{([\s\S]*?)\n  \}/);
  assert.ok(emptyView);
  assert.match(emptyView[1], /Rent overview[\s\S]*?Add a property to start tracking rent\./);
  assert.doesNotMatch(emptyView[1], /<Button|<RecordPaymentModal|border|periodLabel/);
});

test('Rent Overview opens a centered payment dialog with the drawer form', () => {
  const view = readFileSync(new URL('../sections/landlord/dashboard/OwnerRentOverview.jsx', import.meta.url), 'utf8');
  const modal = readFileSync(new URL('../components/drawers/RecordPaymentModal.jsx', import.meta.url), 'utf8');
  const drawer = readFileSync(new URL('../components/drawers/RecordPaymentDrawer.jsx', import.meta.url), 'utf8');
  const action = view.match(/<Button\b([^\n]*)>\s*Record payment\s*<\/Button>/);

  assert.ok(action, 'Record payment is available from Rent Overview');
  assert.match(action[1], /onClick=\{\(\) => setPaymentOpen\(true\)\}/);
  assert.match(view, /<RecordPaymentModal\s+open=\{paymentOpen\}[\s\S]*?onSuccess=\{notifyFinanceMutation\}/);
  assert.match(modal, /<RecordPaymentOverlay\b[^>]*presentation="modal"/);
  assert.match(drawer, /const Surface = isModal \? Dialog : ThemeAdaptiveDrawer/);
  assert.match(drawer, /<TenantPaymentSelector\b/);
  assert.match(drawer, /<PaymentEntryForm\b/);
});

test('monthly rent remaining includes unpaid scheduled rent and does not add prior arrears', () => {
  const overview = ownerHome.getOwnerRentOverview({
    period: '2026-11',
    propertyId: null,
    expectedThisMonth: 5300,
    collectedThisMonth: 1200,
    remainingThisMonth: 200,
    overdue: 4700
  });

  assert.equal(overview.period, '2026-11');
  assert.equal(overview.expectedRent, 5300);
  assert.equal(overview.income, 1200);
  assert.equal(overview.remainingRent, 4100);
  assert.equal(Math.round(overview.collectionPct), 23);
  assert.equal(overview.overdue, 4700);
});

test('unavailable or property-scoped rent is not displayed as a portfolio total', () => {
  assert.equal(ownerHome.getOwnerRentOverview(null), null);
  assert.equal(ownerHome.getOwnerRentOverview({ propertyId: 7, expectedThisMonth: 1000, collectedThisMonth: 100 }), null);
  assert.equal(ownerHome.getOwnerRentOverview({ expectedThisMonth: 1000 }), null);
});

test('an empty month can still have overdue rent, and older responses can omit the period', () => {
  assert.deepEqual(ownerHome.getOwnerRentOverview({ ExpectedThisMonth: 0, CollectedThisMonth: 0, Overdue: 300 }), {
    expectedRent: 0,
    income: 0,
    remainingRent: 0,
    collectionPct: 0,
    period: null,
    overdue: 300
  });
});
