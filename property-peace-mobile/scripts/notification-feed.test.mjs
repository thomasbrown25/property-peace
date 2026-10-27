import assert from 'node:assert/strict';
import test from 'node:test';
import { notificationFeedPage, notificationSection, relativeNotificationTime } from '../src/features/notifications/notificationFeed.ts';

const now = new Date(2026, 9, 18, 0, 30, 0);
const item = (id, date, isRead = true) => ({ id, createdAt: date, isRead });
const at = (day, hour, minute) => new Date(2026, 9, day, hour, minute).toISOString();
const headings = (page) => page.rows.filter((row) => row.kind === 'heading').map((row) => row.title);
const ids = (page) => page.rows.filter((row) => row.kind === 'notification').map((row) => row.item.id);

test('unseen items form New regardless of age; read items use local calendar days', () => {
  const data = [item(1, at(16, 20, 0)), item(2, at(18, 0, 1)), item(3, at(17, 23, 59)), item(4, at(1, 1, 0), false), item(5, at(17, 1, 0), false), item(6, 'bad')];
  const page = notificationFeedPage(data, 0, now);
  assert.deepEqual(headings(page), ['New', 'Today', 'Yesterday', 'Earlier']);
  assert.deepEqual(ids(page), [5, 4, 2, 3, 1, 6]);
  assert.equal(notificationSection(item(7, at(17, 23, 59)), now), 'Yesterday');
  assert.equal(notificationSection(item(8, at(18, 0, 0)), now), 'Today');
});

test('relative timestamps use elapsed whole minutes, hours, days, then 30-day months', () => {
  const elapsed = (ms) => item(1, new Date(now.getTime() - ms).toISOString());
  const minute = 60_000;
  const hour = 60 * minute;
  const day = 24 * hour;
  assert.equal(relativeNotificationTime(elapsed(0), now), '0m');
  assert.equal(relativeNotificationTime(elapsed(36 * minute), now), '36m');
  assert.equal(relativeNotificationTime(elapsed(60 * minute - 1), now), '59m');
  assert.equal(relativeNotificationTime(elapsed(hour), now), '1h');
  assert.equal(relativeNotificationTime(elapsed(119 * minute), now), '1h');
  assert.equal(relativeNotificationTime(elapsed(day - 1), now), '23h');
  assert.equal(relativeNotificationTime(elapsed(day), now), '1d');
  assert.equal(relativeNotificationTime(elapsed(36 * hour), now), '1d');
  assert.equal(relativeNotificationTime(elapsed(29 * day + 23 * hour), now), '29d');
  assert.equal(relativeNotificationTime(elapsed(30 * day - 1), now), '29d');
  assert.equal(relativeNotificationTime(elapsed(30 * day), now), '1mo');
  assert.equal(relativeNotificationTime(elapsed(59 * day), now), '1mo');
  assert.equal(relativeNotificationTime(elapsed(60 * day), now), '2mo');
  assert.equal(relativeNotificationTime(item(9, 'bad'), now), null);
  assert.equal(relativeNotificationTime(item(10, '2026-10-17T23:30:00'), new Date('2026-10-18T00:30:00Z')), '1h');
});

test('pagination caps notifications rather than counting headings and reopens a section on the next page', () => {
  const data = Array.from({ length: 43 }, (_, i) => item(i, at(17, 23, i % 60), false));
  const first = notificationFeedPage(data, 0, now);
  const second = notificationFeedPage(data, 1, now);
  assert.equal(first.count, 40);
  assert.equal(second.count, 3);
  assert.deepEqual(headings(first), ['New']);
  assert.deepEqual(headings(second), ['New']);
  assert.equal(first.hasNext, true);
  assert.equal(second.hasNext, false);
  assert.deepEqual(notificationFeedPage([], 0, now).rows, []);
});
