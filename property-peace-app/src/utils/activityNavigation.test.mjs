import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { ACTIVITY_TYPES, getActivityDestination, getActivityKey } from './activityNavigation.mjs';

const cases = {
  LeaseAgreement: ['/landlord/lease-agreements', '/landlord/lease-agreements'],
  Lease: ['/landlord/leases/42', '/landlord/leases'],
  Property: ['/landlord/property/42', '/landlord/properties'],
  BankAccount: ['/landlord/online-payments', '/landlord/online-payments'],
  TeamMember: ['/landlord/admin-members', '/landlord/admin-members'],
  Listing: ['/landlord/listings/42', '/landlord/listings'],
  Calendar: ['/landlord/calendar', '/landlord/calendar'],
  Booking: ['/landlord/bookings', '/landlord/bookings'],
  Tenant: ['/landlord/tenants/42', '/landlord/leases?tab=tenants'],
  Checklist: ['/landlord/checklist/42', '/landlord/checklists'],
  Announcement: ['/landlord/announcements/details?id=42', '/landlord/announcements'],
  Payment: ['/landlord/finances?tab=payments', '/landlord/finances?tab=payments']
};
for (const [activityType, [detail, list]] of Object.entries(cases)) {
  test(`${activityType}: filter and CRUD destinations, including missing ID`, () => {
    assert.ok(ACTIVITY_TYPES.some(({ value }) => value === activityType));
    for (const operation of ['Created', 'Updated']) {
      assert.equal(getActivityDestination({ activityType, operation, relatedId: 42 }), detail);
    }
    assert.equal(getActivityDestination({ activityType, operation: 'Deleted', relatedId: 42 }), list);
    assert.equal(getActivityDestination({ activityType, operation: 'Deleted', id: 999 }), list);
    assert.equal(getActivityDestination({ activityType, operation: 'Created', id: 999 }), list);
  });
}
test('legacy destinations and unknown categories are safe', () => {
  for (const activityType of ['Maintenance', 'StaffMember', 'Expense', 'File', 'Application', 'Message', 'Notification']) {
    assert.ok(ACTIVITY_TYPES.some(({ value }) => value === activityType));
    assert.ok(getActivityDestination({ activityType }));
  }
  assert.equal(getActivityDestination({ activityType: 'Maintenance', operation: 'Deleted', relatedId: 42 }), '/landlord/maintenances');
  assert.equal(getActivityDestination({ activityType: 'StaffMember', operation: 'Deleted', relatedId: 42 }), '/landlord/staff-members');
  assert.equal(getActivityDestination(), null);
  assert.equal(getActivityDestination({ activityType: 'FutureType' }), null);
});
test('IDs are encoded and deleted conversations never target a removed thread', () => {
  assert.equal(getActivityDestination({ activityType: 'Announcement', relatedId: 'a&b' }), '/landlord/announcements/details?id=a%26b');
  assert.equal(getActivityDestination({ activityType: 'Message', conversationId: 'a&b' }), '/landlord/messages?conversationId=a%26b');
  assert.equal(getActivityDestination({ activityType: 'Message', operation: 'Deleted', conversationId: 42 }), '/landlord/messages');
});
test('event keys win; fallback separates source ID collisions and operations', () => {
  assert.equal(getActivityKey({ eventKey: 'durable:123' }), 'durable:123');
  const base = { activityType: 'Lease', id: 42, createdAt: '2026-11-10' };
  const entries = [base, { ...base, activityType: 'Property' }, { ...base, operation: 'Created' }, { ...base, operation: 'Updated' }];
  assert.equal(new Set(entries.map((item) => getActivityKey(item))).size, entries.length);
  assert.notEqual(getActivityKey(base, 0), getActivityKey(base, 1));
});
test('all generated destinations correspond to registered routes', () => {
  const source = readFileSync(new URL('../routes/MainRoutes.jsx', import.meta.url), 'utf8');
  const routes = [...source.matchAll(/path: '([^']+)'/g)].map(([, path]) => path);
  for (const activityType of ACTIVITY_TYPES.map(({ value }) => value)) {
    for (const operation of ['Created', 'Updated', 'Deleted']) {
      const destination = getActivityDestination({ activityType, operation, relatedId: 42, conversationId: 42 });
      if (!destination) continue;
      const path = destination.split('?')[0].slice(1);
      assert.ok(routes.filter((route) => route.startsWith('landlord/')).some((route) => new RegExp(`^${route.replace(/:[^/]+/g, '[^/]+')}$`).test(path)), destination);
    }
  }
});
test('each activity surface uses shared navigation and collision-safe keys', () => {
  for (const file of ['../pages/landlord/activity.jsx', '../sections/landlord/dashboard/RecentActivity.jsx', '../sections/landlord/dashboard/OwnerHomeSidebar.jsx']) {
    const source = readFileSync(new URL(file, import.meta.url), 'utf8');
    assert.match(source, /getActivityDestination\(/);
    assert.match(source, /key=\{getActivityKey\(/);
  }
});
