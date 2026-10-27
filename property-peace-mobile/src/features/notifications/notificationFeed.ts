import type { AppNotification } from '../../api/notificationAPI';

export const NOTIFICATIONS_PAGE_SIZE = 40;
export type NotificationSection = 'New' | 'Today' | 'Yesterday' | 'Earlier';
export type FeedRow = { kind: 'heading'; title: NotificationSection } | { kind: 'notification'; item: AppNotification };

export function notificationTimestamp(item: AppNotification): number {
  const value = item.createdAt || item.CreatedAt;
  if (!value) return NaN;
  // API timestamps without a timezone are UTC, not device-local time.
  const normalized = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d+)?$/.test(value) ? `${value}Z` : value;
  return new Date(normalized).getTime();
}

export function isUnreadNotification(item: AppNotification): boolean {
  return item.isRead === false || item.IsRead === false;
}

export function relativeNotificationTime(item: AppNotification, now: Date = new Date()): string | null {
  const time = notificationTimestamp(item);
  if (!Number.isFinite(time)) return null;
  const minutes = Math.max(0, Math.floor((now.getTime() - time) / 60000));
  if (minutes < 60) return `${minutes}m`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h`;
  const days = Math.floor(hours / 24);
  return days < 30 ? `${days}d` : `${Math.floor(days / 30)}mo`;
}

export function notificationSection(item: AppNotification, now: Date = new Date()): NotificationSection {
  if (isUnreadNotification(item)) return 'New';
  const time = notificationTimestamp(item);
  if (!Number.isFinite(time)) return 'Earlier';
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
  const yesterday = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 1).getTime();
  if (time >= today) return 'Today';
  if (time >= yesterday) return 'Yesterday';
  return 'Earlier';
}

export function notificationFeedPage(items: AppNotification[], page: number, now: Date = new Date()) {
  const sections: NotificationSection[] = ['New', 'Today', 'Yesterday', 'Earlier'];
  const sorted = [...items].sort((a, b) => {
    const bySection = sections.indexOf(notificationSection(a, now)) - sections.indexOf(notificationSection(b, now));
    return bySection || (notificationTimestamp(b) || 0) - (notificationTimestamp(a) || 0);
  });
  const offset = Math.max(0, page) * NOTIFICATIONS_PAGE_SIZE;
  const pageItems = sorted.slice(offset, offset + NOTIFICATIONS_PAGE_SIZE);
  const rows: FeedRow[] = [];
  let previous: NotificationSection | null = null;
  for (const item of pageItems) {
    const section = notificationSection(item, now);
    if (section !== previous) rows.push({ kind: 'heading', title: section });
    rows.push({ kind: 'notification', item });
    previous = section;
  }
  return { rows, count: pageItems.length, total: sorted.length, hasNext: offset + NOTIFICATIONS_PAGE_SIZE < sorted.length };
}
