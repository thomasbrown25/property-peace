import React, { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, FlatList, RefreshControl, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import MaintenanceAPI, { MaintenanceRequest } from '../../api/maintenanceAPI';

export default function MaintenanceScreen() {
  const navigation = useNavigation<any>();
  const [requests, setRequests] = useState<MaintenanceRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const loadRequests = useCallback(async () => {
    try {
      const data = await MaintenanceAPI.getCurrent();
      setRequests(data || []);
    } catch (error) {
      console.error('Error loading maintenance:', error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => { loadRequests(); }, [loadRequests]);

  if (loading) return <View style={styles.centerContainer}><ActivityIndicator size="large" color="#1976d2" /></View>;

  return (
    <View style={styles.container}>
      <FlatList
        data={requests}
        keyExtractor={(item, index) => String(item.id || item.Id || index)}
        contentContainerStyle={styles.listContent}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); loadRequests(); }} />}
        ListHeaderComponent={<TouchableOpacity style={styles.addButton} onPress={() => navigation.navigate('AddMaintenance')}><Text style={styles.addButtonText}>+ Add Maintenance Request</Text></TouchableOpacity>}
        ListEmptyComponent={<View style={styles.emptyContainer}><Text style={styles.emptyText}>No open maintenance</Text><Text style={styles.emptySubtext}>Create urgent requests here. Premium accounts still use the maintenance AI agent to classify and enrich requests.</Text></View>}
        renderItem={({ item }) => (
          <View style={styles.card}>
            <Text style={styles.title}>{item.title || item.Title || 'Maintenance request'}</Text>
            {!!(item.description || item.Description) && <Text style={styles.meta}>{item.description || item.Description}</Text>}
            {!!(item.status || item.Status) && <Text style={styles.status}>{item.status || item.Status}</Text>}
          </View>
        )}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f5f5f5' },
  centerContainer: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  listContent: { padding: 16 },
  addButton: { backgroundColor: '#1976d2', borderRadius: 8, padding: 14, alignItems: 'center', marginBottom: 16 },
  addButtonText: { color: '#fff', fontSize: 16, fontWeight: '700' },
  card: { backgroundColor: '#fff', borderRadius: 8, padding: 16, marginBottom: 12, borderWidth: 1, borderColor: '#e6e6e6' },
  title: { fontSize: 17, fontWeight: '700', color: '#333', marginBottom: 4 },
  meta: { color: '#666', marginTop: 2, lineHeight: 20 },
  status: { color: '#1976d2', marginTop: 8, fontWeight: '700' },
  emptyContainer: { padding: 32, alignItems: 'center' },
  emptyText: { fontSize: 17, fontWeight: '700', color: '#333', marginBottom: 6 },
  emptySubtext: { color: '#777', textAlign: 'center', lineHeight: 20 },
});
