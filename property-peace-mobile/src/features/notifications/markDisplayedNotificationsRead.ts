import type { AppNotification } from '../../api/notificationAPI';

// Accept only the dropdown's displayed items, never the full notification feed.
export async function markDisplayedNotificationsRead(
  displayed: AppNotification[],
  markRead: (id: string | number) => Promise<void>,
): Promise<{ readIds: Set<string>; failed: boolean }> {
  const ids = new Map<string, string | number>();
  for (const item of displayed) {
    const id = item.id ?? item.Id;
    if ((item.isRead === false || item.IsRead === false) && id != null && String(id) !== '') {
      ids.set(String(id), id);
    }
  }
  const entries = [...ids.entries()];
  const results = await Promise.allSettled(entries.map(([, id]) => markRead(id)));
  const readIds = new Set<string>();
  results.forEach((result, index) => {
    if (result.status === 'fulfilled') readIds.add(entries[index][0]);
  });
  return { readIds, failed: results.some(result => result.status === 'rejected') };
}
