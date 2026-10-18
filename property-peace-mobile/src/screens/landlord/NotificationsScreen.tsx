import React, { useCallback, useEffect, useRef, useState } from 'react';
import { ActivityIndicator, FlatList, RefreshControl, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import type { BottomTabNavigationProp } from '@react-navigation/bottom-tabs';
import { notificationFeedPage, relativeNotificationTime, isUnreadNotification, NOTIFICATIONS_PAGE_SIZE, type FeedRow } from '../../features/notifications/notificationFeed';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import NotificationAPI, { AppNotification } from '../../api/notificationAPI';
import { useAppTheme } from '../../theme/AppTheme';
import GlobalSearchModal from '../../components/GlobalSearchModal';
import { useMoreDrawer } from '../../navigation/MoreDrawerContext';
import type { MainTabParamList } from '../../navigation/types';

const isUnread = isUnreadNotification;

export default function NotificationsScreen() {
  const { mode, colors } = useAppTheme();
  const styles = mode === 'dark' ? darkStyles : lightStyles;
  const insets = useSafeAreaInsets();
  const navigation = useNavigation<BottomTabNavigationProp<MainTabParamList>>();
  const moreDrawer = useMoreDrawer();
  const [searchOpen, setSearchOpen] = useState(false);
  const [notifications, setNotifications] = useState<AppNotification[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [loadError, setLoadError] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);
  const [markingAll, setMarkingAll] = useState(false);
  const [markingId, setMarkingId] = useState<string | number | null>(null);
  const [page, setPage] = useState(0);
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const timer = setInterval(() => setNow(new Date()), 60_000);
    return () => clearInterval(timer);
  }, []);
  const listRef = useRef<FlatList<FeedRow>>(null);
  const changePage = (nextPage: number) => {
    setPage(nextPage);
    listRef.current?.scrollToOffset({ offset: 0, animated: false });
  };
  const visible = notificationFeedPage(notifications, page, now);

  const loadNotifications = useCallback(async () => {
    setLoadError(false);
    try {
      const data = await NotificationAPI.getNotifications();
      setNotifications(data || []);
      setNow(new Date());
      setPage(0);
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

  const hasUnread = notifications.some(isUnread);

  const errorBanner = (message: string, retry?: () => void) => (
    <View style={styles.errorBanner} accessibilityRole="alert">
      <Text style={styles.errorText}>{message}</Text>
      {retry && <TouchableOpacity style={styles.retryButton} onPress={retry}><Text style={styles.retryText}>Retry</Text></TouchableOpacity>}
    </View>
  );

  return (
    <View style={styles.container}>
      <View style={[styles.header, { paddingTop: insets.top + 16 }]}>
        <View style={styles.headerRow}>
          <TouchableOpacity style={styles.headerAction} onPress={moreDrawer.show} accessibilityRole="button" accessibilityLabel="Open more menu" accessibilityState={{ expanded: moreDrawer.open }}>
            <Ionicons name="menu-outline" size={27} color={colors.text} />
          </TouchableOpacity>
          <Text style={styles.heading} accessibilityRole="header">Notifications</Text>
          <TouchableOpacity style={styles.headerAction} onPress={() => setSearchOpen(true)} accessibilityRole="button" accessibilityLabel="Search properties, tenants, and leases">
            <Ionicons name="search-outline" size={25} color={colors.text} />
          </TouchableOpacity>
          <TouchableOpacity style={styles.headerAction} onPress={() => navigation.navigate('Messages')} accessibilityRole="button" accessibilityLabel="Messages">
            <Ionicons name="chatbubble-ellipses-outline" size={25} color={colors.text} />
          </TouchableOpacity>
        </View>
      </View>
      <GlobalSearchModal visible={searchOpen} onClose={() => setSearchOpen(false)} onSelect={(type, id) => {
        if (type === 'property') navigation.navigate('Properties', { screen: 'PropertyDetail', params: { propertyId: String(id) } });
        if (type === 'tenant') navigation.navigate('Tenants', { screen: 'TenantDetail', params: { tenantId: String(id) } });
        if (type === 'lease') navigation.navigate('Leases', { screen: 'LeaseDetail', params: { leaseId: String(id), archived: false } });
      }} />
      {loading ? <View style={styles.centerContainer}><ActivityIndicator size="large" color={mode === 'dark' ? colors.accent : '#1976d2'} /></View> : <FlatList
        ref={listRef}
        data={visible.rows}
        keyExtractor={(row, index) => row.kind === 'heading' ? `heading-${index}-${row.title}` : `notification-${row.item.id ?? row.item.Id ?? index}`}
        contentContainerStyle={styles.listContent}
        ItemSeparatorComponent={() => <View style={styles.divider} />}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); loadNotifications(); }} tintColor={mode === 'dark' ? colors.accent : undefined} />}
        ListHeaderComponent={(
          <View>
            {loadError && notifications.length > 0 && errorBanner("Couldn't refresh notifications. The list below may be out of date.", loadNotifications)}
            {!!actionError && errorBanner(actionError)}
          </View>
        )}
        ListEmptyComponent={loadError && notifications.length === 0 ? (
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
        ListFooterComponent={visible.total > 0 ? <View style={styles.pagination}>
          <Text style={styles.pageText}>Showing {page * NOTIFICATIONS_PAGE_SIZE + 1}–{page * NOTIFICATIONS_PAGE_SIZE + visible.count} of {visible.total}</Text>
          <View style={styles.pageActions}>
            {page > 0 && <TouchableOpacity accessibilityRole="button" style={styles.pageButton} onPress={() => changePage(page - 1)}><Text style={styles.clearText}>Newer</Text></TouchableOpacity>}
            {visible.hasNext && <TouchableOpacity accessibilityRole="button" style={styles.pageButton} onPress={() => changePage(page + 1)}><Text style={styles.clearText}>Older</Text></TouchableOpacity>}
          </View>
        </View> : null}
        renderItem={({ item: row }) => {
          if (row.kind === 'heading') return <View style={styles.sectionRow}>
            <Text style={styles.sectionLabel} accessibilityRole="header">{row.title}</Text>
            {row.title === 'New' && hasUnread && <TouchableOpacity style={styles.markAllButton} onPress={markAllRead} disabled={markingAll || markingId !== null}>
              <Text style={styles.markAllText}>{markingAll ? 'Marking all…' : 'Mark all read'}</Text>
            </TouchableOpacity>}
          </View>;
          const item = row.item;
          const unread = isUnread(item);
          const id = item.id ?? item.Id;
          const title = item.title || item.Title || 'Notification';
          const markingThis = markingId === id;
          const relativeTime = relativeNotificationTime(item, now);
          return (
            <View style={[styles.notificationRow, unread && styles.unreadRow]}>
              <View style={[styles.notificationIcon, unread && styles.unreadIcon]}>
                <Ionicons name={String(item.type ?? item.Type ?? '').toLowerCase().includes('payment') ? 'card-outline' : 'notifications-outline'} size={24} color={unread ? '#fff' : colors.accent} />
              </View>
              <View style={styles.notificationCopy}>
                <Text style={[styles.title, unread && styles.unreadTitle]}>{title}</Text>
                {!!(item.message || item.Message) && <Text style={styles.message} numberOfLines={3}>{item.message || item.Message}</Text>}
                {relativeTime !== null && <Text style={styles.date}>{relativeTime}</Text>}
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
              {unread && <View style={styles.unreadDot} />}
            </View>
          );
        }}
      />}
    </View>
  );
}

const lightStyles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#fff' },
  centerContainer: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  listContent: { paddingBottom: 120, flexGrow: 1 },
  header: { paddingHorizontal: 12, paddingBottom: 10, backgroundColor: '#fff' },
  headerRow: { flexDirection: 'row', alignItems: 'center', gap: 2 },
  headerAction: { width: 42, height: 48, alignItems: 'center', justifyContent: 'center' },
  heading: { flex: 1, color: '#102d43', fontSize: 25, fontWeight: '800', marginLeft: 2 },
  clearText: { color: '#1976d2', fontWeight: '700' },
  pagination: { alignItems: 'center', paddingVertical: 18, gap: 4 },
  pageText: { color: '#64748b', fontSize: 13 },
  pageActions: { flexDirection: 'row', gap: 24 },
  pageButton: { minHeight: 44, justifyContent: 'center', paddingHorizontal: 12 },
  sectionRow: { minHeight: 44, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, backgroundColor: '#fff' },
  sectionLabel: { color: '#102d43', fontSize: 18, fontWeight: '800' },
  errorBanner: { backgroundColor: '#fff8ec', borderLeftWidth: 3, borderLeftColor: '#d99b45', padding: 12, marginBottom: 12 },
  errorText: { color: '#754400', lineHeight: 20 },
  retryButton: { alignSelf: 'flex-start', marginTop: 8, minHeight: 44, justifyContent: 'center' },
  retryText: { color: '#1976d2', fontWeight: '700' },
  markAllButton: { minHeight: 44, justifyContent: 'center' },
  markAllText: { color: '#1976d2', fontWeight: '700' },
  notificationRow: { flexDirection: 'row', paddingVertical: 16, paddingHorizontal: 16, gap: 12, alignItems: 'flex-start' },
  unreadRow: { backgroundColor: '#eaf4ff' },
  notificationCopy: { flex: 1 },
  notificationIcon: { width: 52, height: 52, borderRadius: 26, backgroundColor: '#e8edf2', alignItems: 'center', justifyContent: 'center' },
  unreadIcon: { backgroundColor: '#2475cf' },
  unreadDot: { width: 9, height: 9, borderRadius: 5, backgroundColor: '#2475cf', alignSelf: 'center' },
  divider: { height: 1, backgroundColor: '#e8edf2' },
  title: { fontSize: 16, fontWeight: '600', color: '#25384b', marginBottom: 3 },
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
  header: { ...lightStyles.header, backgroundColor: '#101923' },
  heading: { ...lightStyles.heading, color: '#f2f6fa' },
  unreadRow: { ...lightStyles.unreadRow, backgroundColor: '#1c3042' },
  notificationIcon: { ...lightStyles.notificationIcon, backgroundColor: '#30465a' },
  unreadIcon: { ...lightStyles.unreadIcon, backgroundColor: '#2475cf' },
  clearText: { ...lightStyles.clearText, color: '#72b6ff' },
  pageText: { ...lightStyles.pageText, color: '#b4c3d0' },
  sectionRow: { ...lightStyles.sectionRow, backgroundColor: '#101923' },
  sectionLabel: { ...lightStyles.sectionLabel, color: '#f2f6fa' },
  errorBanner: { ...lightStyles.errorBanner, backgroundColor: '#493a25', borderLeftColor: '#f5b967' },
  errorText: { ...lightStyles.errorText, color: '#ffe0a6' },
  retryText: { ...lightStyles.retryText, color: '#72b6ff' },
  markAllText: { ...lightStyles.markAllText, color: '#72b6ff' },
  unreadDot: { ...lightStyles.unreadDot, backgroundColor: '#72b6ff' },
  divider: { ...lightStyles.divider, backgroundColor: '#35495b' },
  title: { ...lightStyles.title, color: '#dbe5ee' },
  unreadTitle: { ...lightStyles.unreadTitle, color: '#f2f6fa' },
  message: { ...lightStyles.message, color: '#dbe5ee' },
  date: { ...lightStyles.date, color: '#b4c3d0' },
  markReadText: { ...lightStyles.markReadText, color: '#72b6ff' },
  emptyText: { ...lightStyles.emptyText, color: '#f2f6fa' },
  emptySubtext: { ...lightStyles.emptySubtext, color: '#b4c3d0' },
});