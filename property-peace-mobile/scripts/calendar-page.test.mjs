import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import { buildCalendarEvents, calendarDate, dayKey } from '../src/features/calendar/calendarEvents.ts';

const source = path => readFileSync(new URL(path, import.meta.url), 'utf8');

test('calendar dates preserve date-only lease days and reject invalid dates', () => {
  assert.equal(dayKey(calendarDate('2026-10-18')), '2026-10-18');
  assert.equal(dayKey(calendarDate('2026-10-18T00:00:00Z', true)), '2026-10-18');
  assert.equal(calendarDate('2026-02-30'), null);
});

test('calendar builds dated lease, maintenance, and task events without drafts or cancelled tasks', () => {
  const events = buildCalendarEvents([
    { id: 7, startDate: '2026-10-18', endDate: '2027-10-17', propertyName: 'Oak House', unitName: 'Unit 1' },
    { id: 8, isDrafted: true, startDate: '2026-10-18' },
    { id: 9, archived: true, endDate: '2026-10-18' },
  ], [{ id: 3, title: 'Fix sink', scheduledDate: '2026-10-18' }], [
    { id: 2, title: 'Inspect smoke alarms', dueDate: '2026-10-18' },
    { id: 4, title: 'Cancelled', dueDate: '2026-10-18', status: 2 },
  ]);
  assert.deepEqual(events.map(event => event.category).sort(), ['Lease', 'Lease', 'Maintenance', 'Task']);
  assert.deepEqual(events.find(event => event.title.includes('Move-in')).destination, { tab: 'Leases', screen: 'LeaseDetail', params: { leaseId: '7', archived: false } });
  assert.equal(events.find(event => event.title === 'Fix sink').destination.params.requestId, '3');
});

test('active lease rent due date stays within the selected month and does not claim unpaid status', () => {
  const leases = [{ id: 7, isActive: true, rentDueDay: 31, startDate: '2026-01-01', endDate: '2026-12-31', propertyName: 'Oak House' }];
  const february = buildCalendarEvents(leases, [], [], new Date(2026, 1, 1));
  const rent = february.find(event => event.category === 'Rent');
  assert.equal(dayKey(rent.date), '2026-02-28');
  assert.match(rent.detail, /payment status not shown/);
  assert.equal(buildCalendarEvents([{ ...leases[0], isDrafted: true }], [], [], new Date(2026, 1, 1)).length, 0);
});

test('both landlord entry points lead to the registered calendar route', () => {
  assert.match(source('../src/screens/landlord/DashboardScreen.tsx'), /todayArrow[^\n]*onPress=\{\(\) => navigation\.navigate\('Calendar'\)/);
  assert.match(source('../src/navigation/QuickActionsTabBar.tsx'), /label: 'Calendar'[^\n]*route: 'Dashboard', screen: 'Calendar'/);
  assert.match(source('../src/navigation/MainNavigator.tsx'), /DashboardStack\.Screen name="Calendar" component=\{CalendarScreen\}/);
});

test('calendar header adds tasks while Today sits before the month arrows', () => {
  const calendar = source('../src/screens/landlord/CalendarScreen.tsx');
  const editor = source('../src/screens/landlord/AddCalendarTaskModal.tsx');
  assert.match(calendar, /onPress=\{\(\) => setAddingTask\(true\)\}[^\n]*accessibilityLabel="Add task"/);
  assert.match(calendar, /styles\.monthActions[\s\S]*?accessibilityLabel="Go to today"[\s\S]*?accessibilityLabel="Previous month"[\s\S]*?accessibilityLabel="Next month"/);
  assert.match(calendar, /<AddCalendarTaskModal visible=\{addingTask\} date=\{selected\}/);
  assert.match(editor, /apiClient\.post\('\/api\/task', \{ title: cleanTitle, dueDate: dueDate\.toISOString\(\), category \}\)/);
});
