import React, { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, FlatList, RefreshControl, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import TenantAPI, { Tenant } from '../../api/tenantAPI';

const tenantName = (tenant: Tenant) => [tenant.firstName || tenant.FirstName, tenant.lastName || tenant.LastName].filter(Boolean).join(' ') || tenant.email || tenant.Email || 'Tenant';

export default function TenantsScreen() {
  const navigation = useNavigation<any>();
  const [tenants, setTenants] = useState<Tenant[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const loadTenants = useCallback(async () => {
    try {
      const data = await TenantAPI.getTenants();
      setTenants(data || []);
    } catch (error) {
      console.error('Error loading tenants:', error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => { loadTenants(); }, [loadTenants]);

  if (loading) {
    return <View style={styles.centerContainer}><ActivityIndicator size="large" color="#1976d2" /></View>;
  }

  return (
    <View style={styles.container}>
      <FlatList
        data={tenants}
        keyExtractor={(item, index) => String(item.id || item.Id || index)}
        contentContainerStyle={styles.listContent}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); loadTenants(); }} />}
        ListHeaderComponent={
          <TouchableOpacity style={styles.addButton} onPress={() => navigation.navigate('AddTenant')}>
            <Text style={styles.addButtonText}>+ Add Tenant</Text>
          </TouchableOpacity>
        }
        ListEmptyComponent={<View style={styles.emptyContainer}><Text style={styles.emptyText}>No tenants yet</Text><Text style={styles.emptySubtext}>Add a tenant so you can message them, link leases, and send portal invites.</Text></View>}
        renderItem={({ item }) => (
          <View style={styles.card}>
            <Text style={styles.title}>{tenantName(item)}</Text>
            {!!(item.email || item.Email) && <Text style={styles.meta}>{item.email || item.Email}</Text>}
            {!!(item.phoneNumber || item.PhoneNumber) && <Text style={styles.meta}>{item.phoneNumber || item.PhoneNumber}</Text>}
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
  meta: { color: '#666', marginTop: 2 },
  emptyContainer: { padding: 32, alignItems: 'center' },
  emptyText: { fontSize: 17, fontWeight: '700', color: '#333', marginBottom: 6 },
  emptySubtext: { color: '#777', textAlign: 'center', lineHeight: 20 },
});
