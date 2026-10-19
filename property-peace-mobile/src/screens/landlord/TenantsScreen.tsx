import React, { useCallback, useMemo, useState } from 'react';
import { ActivityIndicator, FlatList, RefreshControl, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import TenantAPI, { Tenant } from '../../api/tenantAPI';
import { useAppTheme } from '../../theme/AppTheme';
import LandlordPageHeader from '../../components/LandlordPageHeader';

const tenantName = (tenant: Tenant) => [tenant.firstname || tenant.Firstname || tenant.firstName || tenant.FirstName, tenant.lastname || tenant.Lastname || tenant.lastName || tenant.LastName].filter(Boolean).join(' ') || tenant.email || tenant.Email || 'Tenant';

export default function TenantsScreen() {
  const { mode, colors } = useAppTheme();
  const dark = mode === 'dark';
  const navigation = useNavigation<any>();

  const [tenants, setTenants] = useState<Tenant[]>([]);
  const [query, setQuery] = useState('');
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

  useFocusEffect(useCallback(() => { void loadTenants(); }, [loadTenants]));

  const filteredTenants = useMemo(() => {
    const term = query.trim().toLowerCase();
    if (!term) return tenants;
    return tenants.filter(tenant => [tenantName(tenant), tenant.email, tenant.Email, tenant.phoneNumber, tenant.PhoneNumber]
      .some(value => String(value ?? '').toLowerCase().includes(term)));
  }, [tenants, query]);

  return (
    <View style={[styles.container, dark && { backgroundColor: colors.background }]}>
      <LandlordPageHeader title="Tenants" />
      <View style={styles.pageHeader}>
        <View style={styles.titleRow}>
          <View style={styles.headerCopy}>
            <Text style={[styles.eyebrow, dark && { color: colors.accent }]}>YOUR COMMUNITY</Text>
            <Text style={[styles.pageSubtitle, dark && { color: colors.muted }]}>Your people, all in one place.</Text>
          </View>
          <TouchableOpacity style={[styles.addButton, dark && { backgroundColor: colors.accent }]} onPress={() => navigation.navigate('AddTenant')} accessibilityRole="button" accessibilityLabel="Add tenant">
            <Ionicons name="add" size={20} color={dark ? colors.background : '#fff'} />
            <Text style={[styles.addButtonText, dark && { color: colors.background }]}>Tenant</Text>
          </TouchableOpacity>
        </View>
        <View style={[styles.search, dark && { backgroundColor: colors.surface, borderColor: colors.border, borderWidth: 1 }]}>
          <Ionicons name="search" size={19} color={dark ? colors.muted : '#64748b'} />
          <TextInput value={query} onChangeText={setQuery} placeholder="Search tenants by name, email, or phone" placeholderTextColor={dark ? colors.muted : '#94a3b8'} style={[styles.searchInput, dark && { color: colors.text }]} accessibilityLabel="Search tenants" returnKeyType="search" />
          {!!query && <TouchableOpacity accessibilityRole="button" accessibilityLabel="Clear search" onPress={() => setQuery('')}><Ionicons name="close-circle" size={19} color={dark ? colors.muted : '#94a3b8'} /></TouchableOpacity>}
        </View>
      </View>
      {loading ? <View style={[styles.centerContainer, dark && { backgroundColor: colors.background }]}><ActivityIndicator size="large" color={dark ? colors.accent : '#1976d2'} /></View> : <FlatList
        data={filteredTenants}
        keyExtractor={(item, index) => String(item.id || item.Id || index)}
        contentContainerStyle={styles.listContent}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); loadTenants(); }} tintColor={dark ? colors.accent : undefined} />}
        ListHeaderComponent={
          <View>
            <View style={styles.sectionHeader}>
              <Text style={[styles.sectionTitle, dark && { color: colors.text }]} accessibilityRole="header">All tenants</Text>
              <Text style={[styles.count, dark && { color: colors.muted }]}>{tenants.length}</Text>
            </View>
          </View>
        }
        ListEmptyComponent={<View style={styles.emptyContainer}><Ionicons name={query.trim() ? 'search-outline' : 'people-outline'} size={30} color={dark ? colors.accent : '#8aa5b8'} /><Text style={[styles.emptyText, dark && { color: colors.text }]}>{query.trim() ? 'No matching tenants' : 'No tenants yet'}</Text><Text style={[styles.emptySubtext, dark && { color: colors.muted }]}>{query.trim() ? 'Try another name, email, or phone number.' : 'Add a tenant to connect them with leases, messages, and portal invites.'}</Text></View>}
        ItemSeparatorComponent={() => <View style={[styles.separator, dark && { backgroundColor: colors.border }]} />}
        renderItem={({ item }) => (
          <TouchableOpacity style={styles.row} accessibilityRole="button" accessibilityLabel={`View ${tenantName(item)} profile`} disabled={!/^[1-9]\d*$/.test(String(item.id ?? item.Id ?? ''))} onPress={() => navigation.navigate('TenantDetail', { tenantId: String(item.id ?? item.Id) })}>
            <View style={[styles.avatar, dark && { backgroundColor: '#233c56' }]}><Text style={[styles.avatarText, dark && { color: colors.accent }]}>{tenantName(item).charAt(0).toUpperCase()}</Text></View>
            <View style={styles.rowCopy}>
              <Text style={[styles.title, dark && { color: colors.text }]}>{tenantName(item)}</Text>
              {!!(item.email || item.Email) && <Text style={[styles.meta, dark && { color: colors.muted }]} numberOfLines={1}>{item.email || item.Email}</Text>}
              {!!(item.phoneNumber || item.PhoneNumber) && <Text style={[styles.meta, dark && { color: colors.muted }]}>{item.phoneNumber || item.PhoneNumber}</Text>}
            </View>
            <Ionicons name="chevron-forward" size={18} color={dark ? colors.muted : '#788995'} />
          </TouchableOpacity>
        )}
      />}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#fbf7f4' },
  centerContainer: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#fbf7f4' },

  pageHeader: { paddingHorizontal: 22, paddingBottom: 22 },
  eyebrow: { color: '#2475cf', fontSize: 11, fontWeight: '800', letterSpacing: 1.8 },
  titleRow: { flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 18 },
  headerCopy: { flex: 1, minWidth: 0, gap: 4 },
  listContent: { paddingHorizontal: 22, paddingTop: 8, paddingBottom: 28 },

  pageSubtitle: { color: '#617180', fontSize: 15, lineHeight: 22 },
  addButton: { flexDirection: 'row', gap: 4, backgroundColor: '#2475cf', borderRadius: 10, minHeight: 44, paddingHorizontal: 12, alignItems: 'center', justifyContent: 'center' },
  search: { minHeight: 46, paddingHorizontal: 13, borderRadius: 10, backgroundColor: '#f1f5f9', flexDirection: 'row', alignItems: 'center', gap: 9 },
  searchInput: { flex: 1, color: '#0f172a', fontSize: 15, paddingVertical: 10 },
  addButtonText: { color: '#fff', fontSize: 14, fontWeight: '700' },
  sectionHeader: { flexDirection: 'row', alignItems: 'baseline', gap: 8, marginBottom: 10 },
  sectionTitle: { color: '#102d43', fontSize: 20, fontWeight: '800', letterSpacing: -0.4 },
  count: { color: '#788995', fontSize: 14 },
  separator: { height: StyleSheet.hairlineWidth, backgroundColor: '#dbe2e6' },
  row: { flexDirection: 'row', alignItems: 'center', gap: 14, minHeight: 82, paddingVertical: 15 },
  avatar: { width: 44, height: 44, borderRadius: 22, backgroundColor: '#eaf3ff', alignItems: 'center', justifyContent: 'center' },
  avatarText: { color: '#2475cf', fontWeight: '700', fontSize: 18 },
  rowCopy: { flex: 1, minWidth: 0 },
  title: { fontSize: 16, fontWeight: '700', color: '#102d43', marginBottom: 3 },
  meta: { color: '#697887', fontSize: 13, lineHeight: 19 },
  emptyContainer: { paddingVertical: 46, alignItems: 'center' },
  emptyText: { fontSize: 18, fontWeight: '700', color: '#102d43', marginTop: 12, marginBottom: 6 },
  emptySubtext: { color: '#697887', textAlign: 'center', lineHeight: 20, fontSize: 14 },
});
