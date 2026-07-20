import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, FlatList, TouchableOpacity, RefreshControl, ActivityIndicator } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { LeasesStackParamList } from '../../navigation/types';
import LeaseAPI, { Lease } from '../../api/leaseAPI';

type LeasesScreenNavigationProp = NativeStackNavigationProp<LeasesStackParamList, 'LeasesList'>;

export default function LeasesScreen() {
  const navigation = useNavigation<LeasesScreenNavigationProp>();
  const [leases, setLeases] = useState<Lease[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const loadLeases = async () => {
    try {
      const data = await LeaseAPI.getLeases();
      setLeases(data || []);
    } catch (error) {
      console.error('Error loading leases:', error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => { loadLeases(); }, []);

  const renderLease = ({ item }: { item: Lease }) => {
    const leaseId = item.id || item.Id;
    const unitId = item.unitId || item.UnitId || leaseId;
    return (
      <TouchableOpacity style={styles.leaseCard} onPress={() => navigation.navigate('LeaseDetail', { leaseId: String(unitId) })}>
        <Text style={styles.leaseTitle}>{item.propertyName || item.PropertyName || `Lease #${leaseId || unitId}`}</Text>
        {!!(item.rentAmount || item.RentAmount) && <Text style={styles.leaseMeta}>Rent: ${item.rentAmount || item.RentAmount}</Text>}
        {!!(item.startDate || item.StartDate) && <Text style={styles.leaseMeta}>Starts: {String(item.startDate || item.StartDate).slice(0, 10)}</Text>}
      </TouchableOpacity>
    );
  };

  if (loading) return <View style={styles.centerContainer}><ActivityIndicator size="large" color="#1976d2" /></View>;

  return (
    <View style={styles.container}>
      <FlatList
        data={leases}
        renderItem={renderLease}
        keyExtractor={(item, index) => String(item.id || item.Id || index)}
        contentContainerStyle={styles.listContent}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); loadLeases(); }} />}
        ListHeaderComponent={<TouchableOpacity style={styles.addButton} onPress={() => navigation.navigate('AddLease')}><Text style={styles.addButtonText}>+ Add Lease</Text></TouchableOpacity>}
        ListEmptyComponent={<View style={styles.emptyContainer}><Text style={styles.emptyText}>No leases found</Text><Text style={styles.emptySubtext}>Add quick lease drafts here; use web for full lease-builder setup.</Text></View>}
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
  leaseCard: { backgroundColor: '#fff', borderRadius: 8, padding: 16, marginBottom: 12, borderWidth: 1, borderColor: '#e6e6e6' },
  leaseTitle: { fontSize: 18, fontWeight: '600', color: '#333' },
  leaseMeta: { color: '#666', marginTop: 4 },
  emptyContainer: { padding: 32, alignItems: 'center' },
  emptyText: { fontSize: 16, fontWeight: '700', color: '#333', marginBottom: 6 },
  emptySubtext: { fontSize: 14, color: '#777', textAlign: 'center' },
});
