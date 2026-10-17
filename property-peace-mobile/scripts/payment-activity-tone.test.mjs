import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { paymentActivityTone } from '../src/features/notifications/paymentActivityTone.ts';

test('dashboard payment dots follow outcome, not read status', () => {
  for (const [title, expected] of [
    ['Payment Received', 'received'],
    ['payment pending', 'pending'],
    ['Payment Processing', 'pending'],
    ['PAYMENT FAILED', 'failed'],
    ['Payment Returned or Disputed', null],
    ['Maintenance request pending', null],
    ['Notification', null],
  ]) {
    assert.equal(paymentActivityTone({ id: 1, title, isRead: false }), expected, title);
    assert.equal(paymentActivityTone({ id: 1, Title: title, isRead: true }), expected, title);
  }
});

test('dashboard uses outcome dots in recent activity while keeping unrelated read markers', async () => {
  const source = await readFile(new URL('../src/screens/landlord/DashboardScreen.tsx', import.meta.url), 'utf8');
  const activity = source.slice(source.indexOf('latestNotifications.map('), source.indexOf('</DashboardSection>', source.indexOf('latestNotifications.map(')));
  for (const tone of ['Received', 'Pending', 'Failed']) {
    assert.match(activity, new RegExp(`styles\\.notificationDot${tone}`));
    assert.match(source, new RegExp(`notificationDot${tone}: \\{ backgroundColor:`));
  }
  assert.match(activity, /notification\.isRead === false/);
});
