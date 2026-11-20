import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { getPropertyOverdueRent, getPropertyRentDueDate } from './ownerHome.js';

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

test('dashboard due date uses the earliest property rent installment and falls back to the next due date', () => {
  const records = [
    { propertyId: 1, currentMonthRentDue: 500, currentMonthRentDueDate: '2026-11-12T00:00:00', dueDate: '2026-12-12T00:00:00' },
    { PropertyId: 1, CurrentMonthRentDue: 0, DueDate: '2026-12-01T00:00:00' },
    { propertyId: 2, dueDate: '2026-11-01T00:00:00' }
  ];
  assert.equal(getPropertyRentDueDate(1, records), '2026-11-12');
  assert.equal(getPropertyRentDueDate(2, records), '2026-11-01');
  assert.equal(getPropertyRentDueDate(3, records), null);
  assert.equal(getPropertyRentDueDate(1, records, true), null);
});

test('home places due date after rent status and replaces operations', () => {
  const home = readFileSync(new URL('../sections/landlord/dashboard/OwnerTodayHome.jsx', import.meta.url), 'utf8');
  assert.ok(home.includes("['Property', 'Rent paid', 'Rent status', 'Due date']"));
  assert.match(home, /\$\{money\(overdue\)\} overdue/);
  assert.match(home, /getPropertyRentDueDate\(property\.id/);
  assert.doesNotMatch(home, /PropertyOperations/);
  assert.match(home, /Rent data unavailable/);
});
