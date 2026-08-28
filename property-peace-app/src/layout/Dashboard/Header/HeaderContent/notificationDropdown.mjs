export function getUnreadRecentNotificationIds(notifications = [], limit = 5) {
  return notifications
    .slice(0, limit)
    .filter((notification) => notification.isRead === false)
    .map((notification) => notification.id);
}
