import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';

import { getUnreadRecentNotificationIds } from '../layout/Dashboard/Header/HeaderContent/notificationDropdown.mjs';

const notification = (id, isRead) => ({ id, isRead });

test('selects only unread notifications among the latest five dropdown items', () => {
  const notifications = [
    notification(1, false),
    notification(2, true),
    notification(3, false),
    notification(4, false),
    notification(5, true),
    notification(6, false)
  ];

  assert.deepEqual(getUnreadRecentNotificationIds(notifications), [1, 3, 4]);
});

test('handles an empty or missing notification list', () => {
  assert.deepEqual(getUnreadRecentNotificationIds([]), []);
  assert.deepEqual(getUnreadRecentNotificationIds(), []);
});

test('the top-nav bell marks recent notifications only when opening the dropdown', () => {
  const source = fs.readFileSync(
    new URL('../layout/Dashboard/Header/HeaderContent/Notification.jsx', import.meta.url),
    'utf8'
  );

  assert.match(source, /if \(open\) \{[\s\S]*setOpen\(false\);[\s\S]*return;[\s\S]*\}/);
  assert.match(source, /setOpen\(true\);[\s\S]*markRecentNotificationsAsRead\(\);/);
  assert.match(source, /getUnreadRecentNotificationIds\(notifications\)/);
  assert.match(source, /Promise\.allSettled\([\s\S]*mark-read\/\$\{notificationId\}/);
});

test('the top-nav bell opens rent-payment access requests in the admin portal', () => {
  const source = fs.readFileSync(
    new URL('../layout/Dashboard/Header/HeaderContent/Notification.jsx', import.meta.url),
    'utf8'
  );

  assert.match(source, /case 'rentPaymentAccessRequest':[\s\S]*if \(isAdmin\)[\s\S]*navigate\('\/admin\/rent-payment-access'\)/);
});
