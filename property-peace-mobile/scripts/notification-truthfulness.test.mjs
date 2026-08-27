import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const read = (relativePath) => readFile(new URL(relativePath, import.meta.url), 'utf8');

test('dashboard counts every unread notification while limiting only recent activity', async () => {
  const dashboard = await read('../src/screens/landlord/DashboardScreen.tsx');

  assert.match(dashboard, /setNotifications\(results\[2\]\.value \|\| \[\]\)/);
  assert.doesNotMatch(dashboard, /setNotifications\([^\n]*slice\(0,\s*3\)/);
  assert.match(dashboard, /notifications\.filter\([^\n]*isRead === false[^\n]*IsRead === false/);
  assert.match(dashboard, /notifications\.slice\(0,\s*3\)\.map/);
});

test('notification load failures have an explicit error state and retry instead of a false empty state', async () => {
  const screen = await read('../src/screens/landlord/NotificationsScreen.tsx');

  assert.match(screen, /const \[loadError, setLoadError\]/);
  assert.match(screen, /setLoadError\(/);
  assert.match(screen, /Couldn.t load notifications/);
  assert.match(screen, />Retry</);
  assert.match(screen, /loadError\s*\?/);
});

test('notification read mutations report failures and update local read state only after API success', async () => {
  const screen = await read('../src/screens/landlord/NotificationsScreen.tsx');

  assert.match(screen, /const \[actionError, setActionError\]/);
  assert.match(screen, /Couldn.t mark (?:that notification|notifications) as read/);
  assert.match(screen, /try\s*\{[^}]*await NotificationAPI\.markAllRead\(\);[^}]*setNotifications/s);
  assert.match(screen, /try\s*\{[^}]*await NotificationAPI\.markRead\(id\);[^}]*setNotifications/s);
  assert.match(screen, /catch[^}]*setActionError/s);
});

test('notification cards are static content with an explicit mark-read action', async () => {
  const screen = await read('../src/screens/landlord/NotificationsScreen.tsx');

  assert.doesNotMatch(screen, /<TouchableOpacity\s+style=\{\[styles\.card/);
  assert.match(screen, /<View\s+style=\{\[styles\.card/);
  assert.match(screen, /accessibilityLabel=\{`Mark .* as read`\}/);
  assert.match(screen, /['"]Mark read['"]/);
});
