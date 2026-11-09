import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { getPropertyOverdueRent } from './ownerHome.js';

test('property overdue rent aggregates canonical balances without double-counting current rent', () => {
  assert.equal(getPropertyOverdueRent('1', [
    { propertyId: 1, rentDue: 1500, overdueAmount: 400, currentMonthRentDue: 1100, currentMonthRentIsOverdue: true },
    { PropertyId: 1, RentDue: 800, OverdueAmount: 300 },
    { propertyId: 2, rentDue: 900, overdueAmount: 900 }
  ]), 700);
});

test('overdue status uses the collection fallback and excludes rent that is not yet late', () => {
  assert.equal(getPropertyOverdueRent(1, [{ propertyId: 1, rentDue: 700, rentDueIsOverdue: true }]), 700);
  assert.equal(getPropertyOverdueRent(1, [{ propertyId: 1, rentDue: 700, overdueAmount: 0 }]), 0);
  assert.equal(getPropertyOverdueRent(1, [{ propertyId: 1, rentDue: 0, overdueAmount: 100 }]), 0);
  assert.equal(getPropertyOverdueRent(1, []), 0);
  assert.equal(getPropertyOverdueRent(1, [], true), null);
  assert.equal(getPropertyOverdueRent(1, null), null);
});

test('home places rent status after rent paid and hides only its own operations overdue notice', () => {
  const home = readFileSync(new URL('../sections/landlord/dashboard/OwnerTodayHome.jsx', import.meta.url), 'utf8');
  const operations = readFileSync(new URL('../sections/landlord/properties/PropertyOperations.jsx', import.meta.url), 'utf8');
  assert.ok(home.includes("['Property', 'Rent paid', 'Rent status', 'Operations']"));
  assert.match(home, /\$\{money\(overdue\)\} overdue/);
  assert.match(home, /showOverdue=\{false\}/);
  assert.match(home, /Rent data unavailable/);
  assert.match(operations, /showOverdue = true/);
  assert.match(operations, /showOverdue && summary.overdue > 0/);
  assert.match(operations, /summary.urgentMaintenance/);
  assert.match(operations, /summary.nextLeaseEnd/);
});
