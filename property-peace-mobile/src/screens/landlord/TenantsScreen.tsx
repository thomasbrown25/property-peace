import React, { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, FlatList, RefreshControl, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import TenantAPI, { Tenant } from '../../api/tenantAPI';
import { useAppTheme } from '../../theme/AppTheme';
import PageBackButton from '../../components/PageBackButton';

const tenantName = (tenant: Tenant) => [tenant.firstName || tenant.FirstName, tenant.lastName || tenant.LastName].filter(Boolean).join(' ') || tenant.email || tenant.Email || 'Tenant';

export default function TenantsScreen() {
  const { mode, colors } = useAppTheme();
  const dark = mode === 'dark';
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
    return <View style={[styles.centerContainer, dark && { backgroundColor: colors.background }]}><ActivityIndicator size="large" color={dark ? colors.accent : '#1976d2'} /></View>;
  }

  return (
    <View style={[styles.container, dark && { backgroundColor: colors.background }]}>
      <FlatList
        data={tenants}
        keyExtractor={(item, index) => String(item.id || item.Id || index)}
        contentContainerStyle={styles.listContent}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); loadTenants(); }} tintColor={dark ? colors.accent : undefined} />}
        ListHeaderComponent={
          <View>
            <PageBackButton />
            <Text style={[styles.eyebrow, dark && { color: colors.accent }]}>YOUR COMMUNITY</Text>
            <Text style={[styles.pageTitle, dark && { color: colors.text }]} accessibilityRole="header">Tenants</Text>
            <Text style={[styles.pageSubtitle, dark && { color: colors.muted }]}>People and conversations, all in one place.</Text>
            <TouchableOpacity style={[styles.addButton, dark && { backgroundColor: colors.accent }]} onPress={() => navigation.navigate('AddTenant')} accessibilityRole="button">
              <Ionicons name="add" size={20} color={dark ? colors.background : '#fff'} />
              <Text style={[styles.addButtonText, dark && { color: colors.background }]}>Add tenant</Text>
            </TouchableOpacity>
            <View style={styles.sectionHeader}>
              <Text style={[styles.sectionTitle, dark && { color: colors.text }]} accessibilityRole="header">All tenants</Text>
              <Text style={[styles.count, dark && { color: colors.muted }]}>{tenants.length}</Text>
            </View>
          </View>
        }
        ListEmptyComponent={<View style={styles.emptyContainer}><Ionicons name="people-outline" size={30} color={dark ? colors.accent : '#8aa5b8'} /><Text style={[styles.emptyText, dark && { color: colors.text }]}>No tenants yet</Text><Text style={[styles.emptySubtext, dark && { color: colors.muted }]}>Add a tenant to connect them with leases, messages, and portal invites.</Text></View>}
        ItemSeparatorComponent={() => <View style={[styles.separator, dark && { backgroundColor: colors.border }]} />}
        renderItem={({ item }) => (
          <View style={styles.row} accessibilityRole="summary">
            <View style={[styles.avatar, dark && { backgroundColor: '#233c56' }]}><Text style={[styles.avatarText, dark && { color: colors.accent }]}>{tenantName(item).charAt(0).toUpperCase()}</Text></View>
            <View style={styles.rowCopy}>
              <Text style={[styles.title, dark && { color: colors.text }]}>{tenantName(item)}</Text>
              {!!(item.email || item.Email) && <Text style={[styles.meta, dark && { color: colors.muted }]} numberOfLines={1}>{item.email || item.Email}</Text>}
              {!!(item.phoneNumber || item.PhoneNumber) && <Text style={[styles.meta, dark && { color: colors.muted }]}>{item.phoneNumber || item.PhoneNumber}</Text>}
            </View>
          </View>
        )}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#fbf7f4' },
  centerContainer: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#fbf7f4' },
  listContent: { paddingHorizontal: 22, paddingTop: 28, paddingBottom: 100 },
  eyebrow: { color: '#2475cf', fontSize: 11, fontWeight: '800', letterSpacing: 1.8, marginBottom: 8 },
  pageTitle: { color: '#102d43', fontSize: 34, lineHeight: 40, fontWeight: '800', letterSpacing: -1 },
  pageSubtitle: { color: '#617180', fontSize: 15, lineHeight: 22, marginTop: 6, marginBottom: 26 },
  addButton: { flexDirection: 'row', gap: 6, backgroundColor: '#2475cf', borderRadius: 10, minHeight: 44, paddingHorizontal: 18, alignSelf: 'flex-start', alignItems: 'center', justifyContent: 'center', marginBottom: 30 },
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
