import React, { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, FlatList, RefreshControl, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import NotificationAPI, { AppNotification } from '../../api/notificationAPI';

export default function NotificationsScreen() {
  const [notifications, setNotifications] = useState<AppNotification[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const loadNotifications = useCallback(async () => {
    try {
      const data = await NotificationAPI.getNotifications();
      setNotifications(data || []);
    } catch (error) {
      console.error('Error loading notifications:', error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => { loadNotifications(); }, [loadNotifications]);

  const markAllRead = async () => {
    await NotificationAPI.markAllRead();
    setNotifications((items) => items.map((item) => ({ ...item, isRead: true, IsRead: true })));
  };

  if (loading) return <View style={styles.centerContainer}><ActivityIndicator size="large" color="#1976d2" /></View>;

  return (
    <View style={styles.container}>
      <FlatList
        data={notifications}
        keyExtractor={(item, index) => String(item.id || item.Id || index)}
        contentContainerStyle={styles.listContent}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); loadNotifications(); }} />}
        ListHeaderComponent={notifications.length ? <TouchableOpacity style={styles.markAllButton} onPress={markAllRead}><Text style={styles.markAllText}>Mark all read</Text></TouchableOpacity> : null}
        ListEmptyComponent={<View style={styles.emptyContainer}><Text style={styles.emptyText}>No notifications</Text><Text style={styles.emptySubtext}>Tenant replies, maintenance updates, payments, and Percy follow-ups will show here.</Text></View>}
        renderItem={({ item }) => {
          const unread = item.isRead === false || item.IsRead === false;
          return (
            <TouchableOpacity
              style={[styles.card, unread && styles.unreadCard]}
              onPress={async () => {
                const id = item.id || item.Id;
                if (id) await NotificationAPI.markRead(id);
                setNotifications((items) => items.map((n) => (n === item ? { ...n, isRead: true, IsRead: true } : n)));
              }}
            >
              <Text style={styles.title}>{item.title || item.Title || 'Notification'}</Text>
              {!!(item.message || item.Message) && <Text style={styles.message}>{item.message || item.Message}</Text>}
              {!!(item.createdAt || item.CreatedAt) && <Text style={styles.date}>{new Date(item.createdAt || item.CreatedAt).toLocaleString()}</Text>}
            </TouchableOpacity>
          );
        }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f5f5f5' },
  centerContainer: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  listContent: { padding: 16 },
  markAllButton: { alignSelf: 'flex-end', marginBottom: 12 },
  markAllText: { color: '#1976d2', fontWeight: '700' },
  card: { backgroundColor: '#fff', borderRadius: 8, padding: 16, marginBottom: 12, borderWidth: 1, borderColor: '#e6e6e6' },
  unreadCard: { borderColor: '#1976d2', backgroundColor: '#eef6ff' },
  title: { fontSize: 16, fontWeight: '700', color: '#333', marginBottom: 6 },
  message: { color: '#555', lineHeight: 20 },
  date: { marginTop: 8, color: '#888', fontSize: 12 },
  emptyContainer: { padding: 32, alignItems: 'center' },
  emptyText: { fontSize: 17, fontWeight: '700', color: '#333', marginBottom: 6 },
  emptySubtext: { color: '#777', textAlign: 'center', lineHeight: 20 },
});
