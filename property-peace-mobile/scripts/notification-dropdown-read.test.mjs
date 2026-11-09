import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import { markDisplayedNotificationsRead } from '../src/features/notifications/markDisplayedNotificationsRead.ts';

test('only the five displayed items are read; older unread items stay unread', async () => {
  const notifications = Array.from({ length: 12 }, (_, index) => ({ id: index + 1, isRead: false }));
  const calls = [];
  const { readIds, failed } = await markDisplayedNotificationsRead(notifications.slice(0, 5), async id => { calls.push(id); });
  assert.deepEqual(calls, [1, 2, 3, 4, 5]);
  assert.equal(readIds.size, 5);
  assert.equal(failed, false);
  assert.ok(notifications.slice(5).every(item => !readIds.has(String(item.id))));
});

test('skip already-read items rather than replacing them with older unread items', async () => {
  const calls = [];
  const { readIds } = await markDisplayedNotificationsRead([
    { id: 1, isRead: true }, { id: 2, isRead: false }, { id: 3, IsRead: true },
    { Id: 4, IsRead: false }, { id: 5, isRead: true },
  ], async id => { calls.push(id); });
  assert.deepEqual(calls, [2, 4]);
  assert.deepEqual([...readIds], ['2', '4']);
});

test('failed requests stay unread while successful requests are applied', async () => {
  const result = await markDisplayedNotificationsRead([{ id: 1, isRead: false }, { id: 2, isRead: false }], async id => {
    if (id === 2) throw new Error('offline');
  });
  assert.deepEqual([...result.readIds], ['1']);
  assert.equal(result.failed, true);
});

test('deduplicates IDs and skips missing IDs, but accepts numeric zero', async () => {
  const calls = [];
  await markDisplayedNotificationsRead([
    { id: 1, isRead: false }, { id: '1', IsRead: false }, { isRead: false },
    { id: '', isRead: false }, { id: 0, isRead: false },
  ], async id => { calls.push(id); });
  assert.deepEqual(calls, ['1', 0]);
});

test('empty and already-read dropdowns make no requests', async () => {
  const unexpected = async () => { assert.fail('unexpected read request'); };
  for (const items of [[], [{ id: 1, isRead: true }]]) {
    const result = await markDisplayedNotificationsRead(items, unexpected);
    assert.equal(result.readIds.size, 0);
    assert.equal(result.failed, false);
  }
});

test('dashboard only auto-reads its rendered recent list while open and loaded', async () => {
  const dashboard = await readFile(new URL('../src/screens/landlord/DashboardScreen.tsx', import.meta.url), 'utf8');
  assert.match(dashboard, /sort\([^\n]+\.slice\(0, 5\)/);
  assert.match(dashboard, /recentNotifications\.map\(/);
  assert.match(dashboard, /if \(openMenu !== 'notifications'\)/);
  assert.match(dashboard, /if \(scopedNotificationsStatus !== 'success'\) return/);
  assert.match(dashboard, /displayedUnread = recentNotifications\.filter/);
  assert.match(dashboard, /markDisplayedNotificationsRead\(displayedUnread, id => NotificationAPI\.markRead\(id\)\)/);
  assert.doesNotMatch(dashboard, /markAllRead/);
  assert.match(dashboard, /readIds\.has\(String\(item\.id \?\? item\.Id\)\)/);
  assert.match(dashboard, /capturedOrganizationId !== currentOrganizationId\.current/);
  assert.match(dashboard, /attempted\.has\(key\)/);
  assert.match(dashboard, /Couldn't mark some notifications as read/);
});
