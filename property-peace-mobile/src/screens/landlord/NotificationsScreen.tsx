import React, { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, FlatList, RefreshControl, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import NotificationAPI, { AppNotification } from '../../api/notificationAPI';

const isUnread = (item: AppNotification) => item.isRead === false || item.IsRead === false;

export default function NotificationsScreen() {
  const [notifications, setNotifications] = useState<AppNotification[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [loadError, setLoadError] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);
  const [markingAll, setMarkingAll] = useState(false);
  const [markingId, setMarkingId] = useState<string | number | null>(null);

  const loadNotifications = useCallback(async () => {
    setLoadError(false);
    try {
      const data = await NotificationAPI.getNotifications();
      setNotifications(data || []);
    } catch (error) {
      console.error('Error loading notifications:', error);
      setLoadError(true);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => { loadNotifications(); }, [loadNotifications]);

  const markAllRead = async () => {
    setActionError(null);
    setMarkingAll(true);
    try {
      await NotificationAPI.markAllRead();
      setNotifications((items) => items.map((item) => ({ ...item, isRead: true, IsRead: true })));
    } catch (error) {
      console.error('Error marking notifications as read:', error);
      setActionError("Couldn't mark notifications as read. Please try again.");
    } finally {
      setMarkingAll(false);
    }
  };

  const markNotificationRead = async (item: AppNotification) => {
    const id = item.id ?? item.Id;
    if (id === undefined || id === null) return;

    setActionError(null);
    setMarkingId(id);
    try {
      await NotificationAPI.markRead(id);
      setNotifications((items) => items.map((notification) => (
        notification === item ? { ...notification, isRead: true, IsRead: true } : notification
      )));
    } catch (error) {
      console.error('Error marking notification as read:', error);
      setActionError("Couldn't mark that notification as read. Please try again.");
    } finally {
      setMarkingId(null);
    }
  };

  if (loading) return <View style={styles.centerContainer}><ActivityIndicator size="large" color="#1976d2" /></View>;

  const hasUnread = notifications.some(isUnread);

  const errorBanner = (message: string, retry?: () => void) => (
    <View style={styles.errorBanner} accessibilityRole="alert">
      <Text style={styles.errorText}>{message}</Text>
      {retry && <TouchableOpacity style={styles.retryButton} onPress={retry}><Text style={styles.retryText}>Retry</Text></TouchableOpacity>}
    </View>
  );

  return (
    <View style={styles.container}>
      <FlatList
        data={notifications}
        keyExtractor={(item, index) => String(item.id ?? item.Id ?? index)}
        contentContainerStyle={styles.listContent}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); loadNotifications(); }} />}
        ListHeaderComponent={(
          <View>
            {loadError && notifications.length > 0 && errorBanner("Couldn't refresh notifications. The list below may be out of date.", loadNotifications)}
            {!!actionError && errorBanner(actionError)}
            {hasUnread && (
              <TouchableOpacity style={styles.markAllButton} onPress={markAllRead} disabled={markingAll || markingId !== null}>
                <Text style={styles.markAllText}>{markingAll ? 'Marking all…' : 'Mark all read'}</Text>
              </TouchableOpacity>
            )}
          </View>
        )}
        ListEmptyComponent={loadError ? (
          <View style={styles.emptyContainer}>
            <Text style={styles.emptyText}>Couldn't load notifications</Text>
            <Text style={styles.emptySubtext}>Check your connection and try again.</Text>
            <TouchableOpacity style={styles.emptyRetryButton} onPress={loadNotifications}><Text style={styles.emptyRetryText}>Retry</Text></TouchableOpacity>
          </View>
        ) : (
          <View style={styles.emptyContainer}>
            <Text style={styles.emptyText}>No notifications</Text>
            <Text style={styles.emptySubtext}>Tenant replies, maintenance updates, payments, and Percy follow-ups will show here.</Text>
          </View>
        )}
        renderItem={({ item }) => {
          const unread = isUnread(item);
          const id = item.id ?? item.Id;
          const title = item.title || item.Title || 'Notification';
          const markingThis = markingId === id;
          return (
            <View style={[styles.card, unread && styles.unreadCard]}>
              <Text style={styles.title}>{title}</Text>
              {!!(item.message || item.Message) && <Text style={styles.message}>{item.message || item.Message}</Text>}
              {!!(item.createdAt || item.CreatedAt) && <Text style={styles.date}>{new Date(item.createdAt || item.CreatedAt).toLocaleString()}</Text>}
              {unread && id !== undefined && id !== null && (
                <TouchableOpacity
                  style={styles.markReadButton}
                  onPress={() => markNotificationRead(item)}
                  disabled={markingThis || markingAll}
                  accessibilityLabel={`Mark ${title} as read`}
                >
                  <Text style={styles.markReadText}>{markingThis ? 'Marking…' : 'Mark read'}</Text>
                </TouchableOpacity>
              )}
            </View>
          );
        }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f5f5f5' },
  centerContainer: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  listContent: { padding: 16, flexGrow: 1 },
  errorBanner: { backgroundColor: '#fff3e0', borderColor: '#edb76b', borderWidth: 1, borderRadius: 8, padding: 12, marginBottom: 12 },
  errorText: { color: '#754400', lineHeight: 20 },
  retryButton: { alignSelf: 'flex-start', marginTop: 8, minHeight: 44, justifyContent: 'center' },
  retryText: { color: '#1976d2', fontWeight: '700' },
  markAllButton: { alignSelf: 'flex-end', marginBottom: 12, minHeight: 44, justifyContent: 'center' },
  markAllText: { color: '#1976d2', fontWeight: '700' },
  card: { backgroundColor: '#fff', borderRadius: 8, padding: 16, marginBottom: 12, borderWidth: 1, borderColor: '#e6e6e6' },
  unreadCard: { borderColor: '#1976d2', backgroundColor: '#eef6ff' },
  title: { fontSize: 16, fontWeight: '700', color: '#333', marginBottom: 6 },
  message: { color: '#555', lineHeight: 20 },
  date: { marginTop: 8, color: '#888', fontSize: 12 },
  markReadButton: { alignSelf: 'flex-start', minHeight: 44, justifyContent: 'center', marginTop: 6 },
  markReadText: { color: '#1976d2', fontWeight: '700' },
  emptyContainer: { flex: 1, padding: 32, alignItems: 'center', justifyContent: 'center' },
  emptyText: { fontSize: 17, fontWeight: '700', color: '#333', marginBottom: 6, textAlign: 'center' },
  emptySubtext: { color: '#777', textAlign: 'center', lineHeight: 20 },
  emptyRetryButton: { marginTop: 16, minHeight: 44, paddingHorizontal: 20, justifyContent: 'center', borderRadius: 8, backgroundColor: '#1976d2' },
  emptyRetryText: { color: '#fff', fontWeight: '700' },
});