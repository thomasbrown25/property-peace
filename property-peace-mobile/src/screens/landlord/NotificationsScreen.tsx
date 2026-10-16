import React, { useCallback, useEffect, useRef, useState } from 'react';
import { ActivityIndicator, FlatList, Platform, RefreshControl, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import DateTimePicker from '@react-native-community/datetimepicker';
import { filterNotificationPage, NOTIFICATIONS_PAGE_SIZE } from '../../features/notifications/filterNotifications';
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
  const [from, setFrom] = useState<Date | null>(null);
  const [to, setTo] = useState<Date | null>(null);
  const [page, setPage] = useState(0);
  const listRef = useRef<FlatList<AppNotification>>(null);
  const changePage = (nextPage: number) => {
    setPage(nextPage);
    listRef.current?.scrollToOffset({ offset: 0, animated: false });
  };
  const [picker, setPicker] = useState<{ field: 'from' | 'to'; mode: 'date' | 'time' } | null>(null);
  const visible = filterNotificationPage(notifications, from, to, page);

  const updateBoundary = (field: 'from' | 'to', part: 'date' | 'time', selected: Date) => {
    const current = field === 'from' ? from : to;
    const next = current ? new Date(current) : new Date(selected);
    if (part === 'date') {
      next.setFullYear(selected.getFullYear(), selected.getMonth(), selected.getDate());
      if (!current) next.setHours(field === 'from' ? 0 : 23, field === 'from' ? 0 : 59, field === 'from' ? 0 : 59, field === 'from' ? 0 : 999);
    } else {
      next.setHours(selected.getHours(), selected.getMinutes(), field === 'from' ? 0 : 59, field === 'from' ? 0 : 999);
    }
    (field === 'from' ? setFrom : setTo)(next);
    setPage(0);
  };

  const loadNotifications = useCallback(async () => {
    setLoadError(false);
    try {
      const data = await NotificationAPI.getNotifications();
      setNotifications(data || []);
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
        ref={listRef}
        data={visible.items}
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
            <View style={styles.filters}>
              {(['from', 'to'] as const).map((field) => {
                const value = field === 'from' ? from : to;
                return <View key={field} style={styles.filterRow}>
                  <Text style={styles.filterLabel}>{field === 'from' ? 'From' : 'To'}</Text>
                  <TouchableOpacity style={styles.filterButton} accessibilityRole="button" accessibilityLabel={`${field} date`} onPress={() => setPicker({ field, mode: 'date' })}>
                    <Text style={styles.filterText}>{value ? value.toLocaleDateString() : 'Any date'}</Text>
                  </TouchableOpacity>
                  <TouchableOpacity style={styles.filterButton} accessibilityRole="button" accessibilityLabel={`${field} time`} onPress={() => setPicker({ field, mode: 'time' })}>
                    <Text style={styles.filterText}>{value ? value.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' }) : 'Any time'}</Text>
                  </TouchableOpacity>
                </View>;
              })}
              {(from || to) && <TouchableOpacity accessibilityRole="button" accessibilityLabel="Clear date and time filters" style={styles.clearButton} onPress={() => { setFrom(null); setTo(null); setPicker(null); setPage(0); }}><Text style={styles.clearText}>Clear filters</Text></TouchableOpacity>}
              {picker && <View>
                <DateTimePicker
                  value={(picker.field === 'from' ? from : to) || new Date()}
                  mode={picker.mode}
                  themeVariant={mode}
                  onChange={(event, selected) => {
                    if (Platform.OS === 'android' || event.type === 'dismissed') setPicker(null);
                    if (event.type !== 'dismissed' && selected) updateBoundary(picker.field, picker.mode, selected);
                  }}
                />
                {Platform.OS === 'ios' && <TouchableOpacity style={styles.clearButton} onPress={() => setPicker(null)}><Text style={styles.clearText}>Done</Text></TouchableOpacity>}
              </View>}
              {from && to && from > to && <Text style={styles.filterWarning}>From must be before To.</Text>}
            </View>
            {loadError && notifications.length > 0 && errorBanner("Couldn't refresh notifications. The list below may be out of date.", loadNotifications)}
            {!!actionError && errorBanner(actionError)}
            {notifications.length > 0 && <View style={styles.sectionRow}>              <Text style={styles.sectionLabel}>RECENT ACTIVITY</Text>
              {hasUnread && <TouchableOpacity style={styles.markAllButton} onPress={markAllRead} disabled={markingAll || markingId !== null}>
                <Text style={styles.markAllText}>{markingAll ? 'Marking all…' : 'Mark all read'}</Text>
              </TouchableOpacity>}
            </View>}
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
            <Text style={styles.emptyText}>{notifications.length ? 'No notifications match your filters' : 'No notifications'}</Text>
            <Text style={styles.emptySubtext}>Tenant replies, maintenance updates, payments, and Percy follow-ups will show here.</Text>
          </View>
        )}
        ListFooterComponent={visible.total > 0 ? <View style={styles.pagination}>
          <Text style={styles.pageText}>Showing {page * NOTIFICATIONS_PAGE_SIZE + 1}–{page * NOTIFICATIONS_PAGE_SIZE + visible.items.length} of {visible.total}</Text>
          <View style={styles.pageActions}>
            {page > 0 && <TouchableOpacity accessibilityRole="button" style={styles.pageButton} onPress={() => changePage(page - 1)}><Text style={styles.clearText}>Newer</Text></TouchableOpacity>}
            {visible.hasNext && <TouchableOpacity accessibilityRole="button" style={styles.pageButton} onPress={() => changePage(page + 1)}><Text style={styles.clearText}>Older</Text></TouchableOpacity>}
          </View>
        </View> : null}
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
  filters: { marginBottom: 16, gap: 8 },
  filterRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  filterLabel: { width: 40, fontSize: 13, fontWeight: '700', color: '#334155' },
  filterButton: { flex: 1, borderWidth: 1, borderColor: '#d3dce5', borderRadius: 8, minHeight: 44, justifyContent: 'center', paddingHorizontal: 10 },
  filterText: { color: '#102d43', fontSize: 13 },
  clearButton: { alignSelf: 'flex-start', minHeight: 44, justifyContent: 'center' },
  clearText: { color: '#1976d2', fontWeight: '700' },
  filterWarning: { color: '#a43c24', fontSize: 13 },
  pagination: { alignItems: 'center', paddingVertical: 18, gap: 4 },
  pageText: { color: '#64748b', fontSize: 13 },
  pageActions: { flexDirection: 'row', gap: 24 },
  pageButton: { minHeight: 44, justifyContent: 'center', paddingHorizontal: 12 },
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
  filterLabel: { ...lightStyles.filterLabel, color: '#dbe5ee' },
  filterButton: { ...lightStyles.filterButton, borderColor: '#35495b' },
  filterText: { ...lightStyles.filterText, color: '#f2f6fa' },
  clearText: { ...lightStyles.clearText, color: '#72b6ff' },
  filterWarning: { ...lightStyles.filterWarning, color: '#ffb099' },
  pageText: { ...lightStyles.pageText, color: '#b4c3d0' },
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