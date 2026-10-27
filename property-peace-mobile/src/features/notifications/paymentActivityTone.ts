import type { AppNotification } from '../../api/notificationAPI';

export type PaymentActivityTone = 'received' | 'pending' | 'failed' | null;

// Notification read state is separate from payment outcome. Only explicit payment
// titles get an outcome color; unrelated activity keeps its existing indicator.
export function paymentActivityTone(notification: AppNotification): PaymentActivityTone {
  const title = String(notification.title ?? notification.Title ?? '').trim().toLowerCase();
  if (!/^payment\b/.test(title)) return null;
  if (/\bfailed\b/.test(title)) return 'failed';
  if (/\b(pending|processing)\b/.test(title)) return 'pending';
  if (/\breceived\b/.test(title)) return 'received';
  return null;
}
