import React, { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, FlatList, RefreshControl, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import NotificationAPI, { AppNotification } from '../../api/notificationAPI';
import { useAppTheme } from '../../theme/AppTheme';
import PageBackButton from '../../components/PageBackButton';

const isUnread = (item: AppNotification) => item.isRead === false || item.IsRead === false;

export default function NotificationsScreen() {
  const { mode, colors } = useAppTheme();
  const styles = mode === 'dark' ? darkStyles : lightStyles;
  const insets = useSafeAreaInsets();
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

  if (loading) return <View style={[styles.centerContainer, { backgroundColor: mode === 'dark' ? colors.background : '#fff' }]}><ActivityIndicator size="large" color={mode === 'dark' ? colors.accent : '#1976d2'} /></View>;

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
        contentContainerStyle={[styles.listContent, { paddingTop: insets.top + 28 }]}
        ItemSeparatorComponent={() => <View style={styles.divider} />}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); loadNotifications(); }} tintColor={mode === 'dark' ? colors.accent : undefined} />}
        ListHeaderComponent={(
          <View>
            <PageBackButton />
            <View style={styles.headingRow}>
              <View><Text style={styles.heading}>Notifications</Text><Text style={styles.headingSub}>{notifications.length} updates{hasUnread ? ` · ${notifications.filter(isUnread).length} unread` : ''}</Text></View>
            </View>
            {loadError && notifications.length > 0 && errorBanner("Couldn't refresh notifications. The list below may be out of date.", loadNotifications)}
            {!!actionError && errorBanner(actionError)}
            {notifications.length > 0 && <View style={styles.sectionRow}>
              <Text style={styles.sectionLabel}>RECENT ACTIVITY</Text>
              {hasUnread && <TouchableOpacity style={styles.markAllButton} onPress={markAllRead} disabled={markingAll || markingId !== null}>
                <Text style={styles.markAllText}>{markingAll ? 'Marking all…' : 'Mark all read'}</Text>
              </TouchableOpacity>}
            </View>}
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
            <View style={styles.notificationRow}>
              <View style={[styles.indicator, unread && styles.unreadIndicator]} />
              <View style={styles.notificationCopy}>
                <Text style={[styles.title, unread && styles.unreadTitle]}>{title}</Text>
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
            </View>
          );
        }}
      />
    </View>
  );
}

const lightStyles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#fff' },
  centerContainer: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  listContent: { paddingHorizontal: 20, paddingBottom: 36, flexGrow: 1 },
  headingRow: { paddingBottom: 20 },
  heading: { color: '#0f2f47', fontSize: 28, fontWeight: '800' },
  headingSub: { color: '#64748b', fontSize: 13, marginTop: 4 },
  sectionRow: { minHeight: 52, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', borderBottomWidth: 1, borderBottomColor: '#e8edf2' },
  sectionLabel: { color: '#64748b', fontSize: 11, fontWeight: '800', letterSpacing: 1.2 },
  errorBanner: { backgroundColor: '#fff8ec', borderLeftWidth: 3, borderLeftColor: '#d99b45', padding: 12, marginBottom: 12 },
  errorText: { color: '#754400', lineHeight: 20 },
  retryButton: { alignSelf: 'flex-start', marginTop: 8, minHeight: 44, justifyContent: 'center' },
  retryText: { color: '#1976d2', fontWeight: '700' },
  markAllButton: { minHeight: 44, justifyContent: 'center' },
  markAllText: { color: '#1976d2', fontWeight: '700' },
  notificationRow: { flexDirection: 'row', paddingVertical: 18, gap: 12 },
  notificationCopy: { flex: 1 },
  indicator: { width: 7, height: 7, borderRadius: 4, marginTop: 7 },
  unreadIndicator: { backgroundColor: '#1976d2' },
  divider: { height: 1, backgroundColor: '#e8edf2', marginLeft: 19 },
  title: { fontSize: 16, fontWeight: '600', color: '#334155', marginBottom: 6 },
  unreadTitle: { fontWeight: '800', color: '#102d43' },
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

const darkStyles = StyleSheet.create({
  ...lightStyles,
  container: { ...lightStyles.container, backgroundColor: '#101923' },
  centerContainer: { ...lightStyles.centerContainer, backgroundColor: '#101923' },
  heading: { ...lightStyles.heading, color: '#f2f6fa' },
  headingSub: { ...lightStyles.headingSub, color: '#b4c3d0' },
  sectionRow: { ...lightStyles.sectionRow, borderBottomColor: '#35495b' },
  sectionLabel: { ...lightStyles.sectionLabel, color: '#b4c3d0' },
  errorBanner: { ...lightStyles.errorBanner, backgroundColor: '#493a25', borderLeftColor: '#f5b967' },
  errorText: { ...lightStyles.errorText, color: '#ffe0a6' },
  retryText: { ...lightStyles.retryText, color: '#72b6ff' },
  markAllText: { ...lightStyles.markAllText, color: '#72b6ff' },
  unreadIndicator: { ...lightStyles.unreadIndicator, backgroundColor: '#72b6ff' },
  divider: { ...lightStyles.divider, backgroundColor: '#35495b' },
  title: { ...lightStyles.title, color: '#dbe5ee' },
  unreadTitle: { ...lightStyles.unreadTitle, color: '#f2f6fa' },
  message: { ...lightStyles.message, color: '#dbe5ee' },
  date: { ...lightStyles.date, color: '#b4c3d0' },
  markReadText: { ...lightStyles.markReadText, color: '#72b6ff' },
  emptyText: { ...lightStyles.emptyText, color: '#f2f6fa' },
  emptySubtext: { ...lightStyles.emptySubtext, color: '#b4c3d0' },
});