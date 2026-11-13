import React, { useCallback, useMemo, useState } from 'react';
import { ActivityIndicator, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect } from '@react-navigation/native';
import TenantAPI, { type Tenant } from '../../api/tenantAPI';
import LeaseAPI, { type Lease } from '../../api/leaseAPI';
import { useAppTheme } from '../../theme/AppTheme';

type Kind = 'Tenants' | 'Leases';
type Props = { kind: Kind; organizationId: string; refreshToken: number; navigate: (tab: Kind, screen: string, params?: object) => void };
const tenantName = (tenant: Tenant) => [tenant.firstname || tenant.Firstname || tenant.firstName || tenant.FirstName, tenant.lastname || tenant.Lastname || tenant.lastName || tenant.LastName].filter(Boolean).join(' ') || tenant.email || tenant.Email || 'Tenant';
const tenantId = (tenant: Tenant) => String(tenant.id ?? tenant.Id ?? '');
const leaseId = (lease: Lease) => String(lease.id ?? lease.Id ?? '');
const leaseDraft = (lease: Lease) => lease.isDrafted === true || lease.IsDrafted === true || lease.leaseAgreement?.isDrafted === true || lease.LeaseAgreement?.IsDrafted === true;
const leaseArchived = (lease: Lease) => lease.archived === true;
const tenantMatches = (tenant: Tenant, term: string) => [tenantName(tenant), tenant.email, tenant.Email, tenant.phoneNumber, tenant.PhoneNumber].some(value => String(value ?? '').toLowerCase().includes(term));
const leaseMatches = (lease: Lease, term: string) => [lease.name, lease.Name, lease.propertyName, lease.PropertyName, lease.unitName, lease.UnitName,
  ...(lease.tenants || lease.Tenants || []).flatMap((tenant: any) => [tenant.name, tenant.Name, tenant.firstName, tenant.FirstName, tenant.lastName, tenant.LastName]),
].some(value => String(value ?? '').toLowerCase().includes(term));

export default function HomeDirectoryTab({ kind, organizationId, refreshToken, navigate }: Props) {
  const { mode, colors } = useAppTheme();
  const dark = mode === 'dark';
  const [query, setQuery] = useState('');
  const [tenants, setTenants] = useState<Tenant[]>([]);
  const [leases, setLeases] = useState<Lease[]>([]);
  const [status, setStatus] = useState<'loading' | 'success' | 'error'>('loading');
  const [retry, setRetry] = useState(0);
  useFocusEffect(useCallback(() => {
    let live = true;
    setStatus('loading');
    if (organizationId) {
      const request = kind === 'Tenants' ? TenantAPI.getTenants() : LeaseAPI.getLeases();
      void request.then(items => {
        if (!live) return;
        if (kind === 'Tenants') setTenants(items as Tenant[] || []);
        else setLeases(items as Lease[] || []);
        setStatus('success');
      }).catch(error => {
        console.error(`Error loading ${kind.toLowerCase()}:`, error);
        if (live) setStatus('error');
      });
    }
    return () => { live = false; };
  }, [kind, organizationId, refreshToken, retry]));
  const term = query.trim().toLowerCase();
  const filteredTenants = useMemo(() => tenants.filter(item => tenantMatches(item, term)), [tenants, term]);
  const filteredLeases = useMemo(() => leases.filter(item => leaseMatches(item, term)), [leases, term]);
  const addLabel = kind === 'Tenants' ? 'Add tenant' : 'Add lease';
  const searchLabel = kind === 'Tenants' ? 'Search tenants' : 'Search leases';
  const empty = kind === 'Tenants' ? 'No tenants yet' : 'No leases yet';
  const noMatch = kind === 'Tenants' ? 'No matching tenants' : 'No matching leases';
  const items = kind === 'Tenants' ? filteredTenants : filteredLeases;
  return <View>
    <View style={styles.toolbar}>
      <View style={[styles.search, dark && { backgroundColor: colors.surface, borderColor: colors.border, borderWidth: 1 }]}>
        <Ionicons name="search" size={19} color={colors.muted} />
        <TextInput value={query} onChangeText={setQuery} placeholder={searchLabel} placeholderTextColor={colors.muted} style={[styles.searchInput, { color: colors.text }]} accessibilityLabel={searchLabel} returnKeyType="search" />
        {!!query && <TouchableOpacity onPress={() => setQuery('')} accessibilityRole="button" accessibilityLabel={`Clear ${kind.toLowerCase()} search`} style={styles.clear}>
          <Ionicons name="close-circle" size={19} color={colors.muted} />
        </TouchableOpacity>}
      </View>
      <TouchableOpacity style={[styles.add, { backgroundColor: colors.accent }]} onPress={() => navigate(kind, kind === 'Tenants' ? 'AddTenant' : 'AddLease')} accessibilityRole="button" accessibilityLabel={addLabel}>
        <Ionicons name="add" size={22} color={dark ? colors.background : '#fff'} />
      </TouchableOpacity>
    </View>
    {status === 'loading' ? <View style={styles.state}><ActivityIndicator color={colors.accent} /></View>
      : status === 'error' ? <View style={styles.state}><Text style={{ color: colors.muted }}>{kind} are unavailable.</Text><TouchableOpacity accessibilityRole="button" accessibilityLabel={`Retry loading ${kind.toLowerCase()}`} style={styles.retry} onPress={() => setRetry(value => value + 1)}><Text style={{ color: colors.accent }}>Retry</Text></TouchableOpacity></View>
      : items.length === 0 ? <Text style={[styles.empty, { color: colors.muted }]}>{term ? noMatch : empty}</Text>
      : kind === 'Tenants' ? filteredTenants.map((tenant, index) => {
        const id = tenantId(tenant);
        const name = tenantName(tenant);
        return <TouchableOpacity key={id || `tenant-${index}`} style={[styles.row, { borderBottomColor: colors.border }]} accessibilityRole="button" accessibilityLabel={`View ${name} profile`} disabled={!/^[1-9]\d*$/.test(id)} onPress={() => navigate('Tenants', 'TenantDetail', { tenantId: id })}>
          <View style={[styles.avatar, { backgroundColor: dark ? '#233c56' : '#eaf3ff' }]}><Text style={[styles.avatarText, { color: colors.accent }]}>{name.charAt(0).toUpperCase()}</Text></View>
          <View style={styles.copy}><Text style={[styles.title, { color: colors.text }]} numberOfLines={1}>{name}</Text>
            {!!(tenant.email || tenant.Email) && <Text style={[styles.meta, { color: colors.muted }]} numberOfLines={1}>{tenant.email || tenant.Email}</Text>}
            {!!(tenant.propertyName || tenant.PropertyName) && <Text style={[styles.meta, { color: colors.muted }]} numberOfLines={1}>{tenant.propertyName || tenant.PropertyName}{(tenant.unitName || tenant.UnitName) ? ` · ${tenant.unitName || tenant.UnitName}` : ''}</Text>}
            {(tenant.isActive ?? tenant.IsActive) === false && <Text style={[styles.meta, { color: colors.muted }]}>Archived</Text>}
          </View><Ionicons name="chevron-forward" size={18} color={colors.muted} />
        </TouchableOpacity>;
      }) : filteredLeases.map((lease, index) => {
        const id = leaseId(lease);
        const draft = leaseDraft(lease);
        return <TouchableOpacity key={`${leaseArchived(lease) ? 'archive' : 'current'}-${id || index}`} style={[styles.row, { borderBottomColor: colors.border }]} accessibilityRole="button" accessibilityLabel={`View lease for ${lease.propertyName || lease.PropertyName || 'property'}`} onPress={() => navigate('Leases', 'LeaseDetail', { leaseId: id, archived: leaseArchived(lease) })}>
          <View style={styles.copy}><Text style={[styles.title, { color: colors.text }]} numberOfLines={1}>{lease.name || lease.Name || lease.propertyName || lease.PropertyName || 'Lease'}</Text>
            {!!(lease.name || lease.Name) && <Text style={[styles.meta, { color: colors.muted }]} numberOfLines={1}>{[lease.propertyName || lease.PropertyName, lease.unitName || lease.UnitName].filter(Boolean).join(' · ')}</Text>}
            {(draft || leaseArchived(lease) || lease.isActive === true || lease.IsActive === true) && <Text style={[styles.meta, { color: draft ? (dark ? '#f0ba72' : '#b76b11') : leaseArchived(lease) ? colors.muted : (dark ? '#75d995' : '#2f8f46') }]}>{draft ? 'Draft' : leaseArchived(lease) ? 'Archived' : 'Active'}</Text>}
          </View><Ionicons name="chevron-forward" size={18} color={colors.muted} />
        </TouchableOpacity>;
      })}
  </View>;
}

const styles = StyleSheet.create({
  toolbar: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 12 },
  search: { flex: 1, minWidth: 0, minHeight: 46, paddingHorizontal: 13, borderRadius: 10, backgroundColor: '#f1f5f9', flexDirection: 'row', alignItems: 'center', gap: 9 },
  searchInput: { flex: 1, minWidth: 0, fontSize: 15, paddingVertical: 10 },
  clear: { minWidth: 44, minHeight: 44, alignItems: 'center', justifyContent: 'center' },
  add: { width: 46, height: 46, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  state: { minHeight: 100, alignItems: 'center', justifyContent: 'center' },
  retry: { minHeight: 44, justifyContent: 'center', paddingHorizontal: 12 },
  empty: { paddingVertical: 20, fontSize: 14 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 12, minHeight: 76, paddingVertical: 12, borderBottomWidth: 1 },
  avatar: { width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center' },
  avatarText: { fontSize: 18, fontWeight: '700' },
  copy: { flex: 1, minWidth: 0 },
  title: { fontSize: 16, fontWeight: '700', marginBottom: 3 },
  meta: { fontSize: 13, lineHeight: 19 },
});
