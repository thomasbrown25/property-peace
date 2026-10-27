import type { AppNotification } from '../../api/notificationAPI';

export const NOTIFICATIONS_PAGE_SIZE = 40;

const timestamp = (item: AppNotification) => {
  const value = item.createdAt || item.CreatedAt;
  if (!value) return NaN;
  // The API can return UTC timestamps without a suffix; match the web client's UTC interpretation.
  const normalized = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d+)?$/.test(value) ? `${value}Z` : value;
  return new Date(normalized).getTime();
};

export function filterNotificationPage(items: AppNotification[], from: Date | null, to: Date | null, page: number) {
  const start = from?.getTime();
  const end = to?.getTime();
  const filtered = items.filter((item) => {
    if (start === undefined && end === undefined) return true;
    const time = timestamp(item);
    return Number.isFinite(time) && (start === undefined || time >= start) && (end === undefined || time <= end);
  }).sort((a, b) => (timestamp(b) || 0) - (timestamp(a) || 0));
  const offset = Math.max(0, page) * NOTIFICATIONS_PAGE_SIZE;
  return {
    items: filtered.slice(offset, offset + NOTIFICATIONS_PAGE_SIZE),
    total: filtered.length,
    hasNext: offset + NOTIFICATIONS_PAGE_SIZE < filtered.length,
  };
}
