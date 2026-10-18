import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import { filterNotificationPage } from '../src/features/notifications/filterNotifications.ts';

const notification = (id, createdAt) => ({ id, createdAt });

test('orders newest first and never shows more than 40 notifications per page', () => {
  const items = Array.from({ length: 85 }, (_, i) => notification(i, `2026-10-16T${String(Math.floor(i / 60)).padStart(2, '0')}:${String(i % 60).padStart(2, '0')}:00Z`));
  const first = filterNotificationPage(items, null, null, 0);
  const second = filterNotificationPage(items, null, null, 1);
  const last = filterNotificationPage(items, null, null, 2);
  assert.equal(first.items.length, 40);
  assert.equal(second.items.length, 40);
  assert.equal(last.items.length, 5);
  assert.equal(first.items[0].id, 84);
  assert.equal(second.items[0].id, 44);
  assert.equal(first.total, 85);
  assert.equal(last.hasNext, false);
});

test('filters inclusively by local date and time before paginating', () => {
  const at = (hour, minute, second) => new Date(2026, 9, 16, hour, minute, second).toISOString();
  const items = [notification(1, at(9, 59, 59)), notification(2, at(10, 0, 0)), notification(3, at(10, 30, 0)), notification(4, at(10, 30, 1)), notification(5, 'invalid')];
  const result = filterNotificationPage(items, new Date(2026, 9, 16, 10, 0), new Date(2026, 9, 16, 10, 30), 0);
  assert.deepEqual(result.items.map((n) => n.id), [3, 2]);
  assert.equal(result.total, 2);
});

test('empty and out-of-range pages are safe', () => {
  assert.deepEqual(filterNotificationPage([], null, null, 0).items, []);
  assert.deepEqual(filterNotificationPage([notification(1, '2026-10-16T09:00:00')], new Date(2026, 9, 17), null, 0).items, []);
  assert.deepEqual(filterNotificationPage([notification(1, '2026-10-16T09:00:00')], null, null, 5).items, []);
});

test('notification feed replaces date controls with unread and calendar sections', async () => {
  const screen = await readFile(new URL('../src/screens/landlord/NotificationsScreen.tsx', import.meta.url), 'utf8');
  assert.match(screen, /notificationFeedPage\(notifications, page, now\)/);
  assert.match(screen, /data=\{visible\.rows\}/);
  assert.match(screen, /row\.kind === 'heading'/);
  assert.match(screen, /relativeNotificationTime\(item, now\)/);
  assert.doesNotMatch(screen, /DateTimePicker|Filter dates|Recent activity/);
  assert.match(screen, /Older/);
});
