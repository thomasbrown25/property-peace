import React, { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Linking, Text, TouchableOpacity, View } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import type { PropertiesStackParamList } from '../../navigation/types';
import type { Property } from '../../api/propertyAPI';
import LeaseAPI from '../../api/leaseAPI';
import MaintenanceAPI from '../../api/maintenanceAPI';
import TenantAPI from '../../api/tenantAPI';
import { getListings } from '../../api/listingAPI';
import ApplicationAPI from '../../api/applicationAPI';
import moneyCenterAPI from '../../api/moneyCenterAPI';
import apiClient from '../../services/apiClient';
import storageService from '../../services/storageService';
import { useAppSelector } from '../../store/hooks';
import { recordValue as read, sameProperty as same, scopePropertyRows as scoped, scopePropertyEndpointRows } from '../../features/properties/propertyRecordScope';
import { useAppTheme } from '../../theme/AppTheme';

export type PropertyRecordTab = 'leases' | 'maintenances' | 'listings' | 'applications' | 'occupancy' | 'finances' | 'documents';
export type PropertyRecordPanelProps = {
  tab: PropertyRecordTab;
  propertyId: string;
  property: Property;
  navigation?: NativeStackNavigationProp<PropertiesStackParamList, 'PropertyDetail'>;
};

type Row = Record<string, any>;
const unpack = (response: any, label: string): Row[] => {
  if (response?.success === false) throw new Error(`${label} could not be loaded.`);
  const rows = Array.isArray(response) ? response : response?.data;
  if (!Array.isArray(rows)) throw new Error(`${label} returned an invalid response.`);
  return rows;
};
const date = (value: any) => value && !Number.isNaN(Date.parse(String(value))) ? new Date(value).toLocaleDateString() : '—';
const money = (value: any) => value != null && value !== '' && Number.isFinite(Number(value)) ? new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(Number(value)) : '—';
const leaseStatus = (row: Row) => read(row, 'archived') === true ? 'Archived' : read(row, 'isDrafted') === true ? 'Draft' : read(row, 'endDate') && Date.parse(String(read(row, 'endDate'))) < Date.now() ? 'Expired' : read(row, 'startDate') && Date.parse(String(read(row, 'startDate'))) > Date.now() ? 'Scheduled' : 'Active';
const monthStart = (offset: number) => { const today = new Date(); return new Date(today.getFullYear(), today.getMonth() + offset, 1); };
const dayKey = (value: any) => typeof value === 'string' ? value.slice(0, 10) : '';
const occupant = (unit: Row, day: string) => {
  if ((read(unit, 'leasePeriods') ?? []).some((period: Row) => dayKey(read(period, 'startDate')) <= day && day <= dayKey(read(period, 'endDate')))) return true;
  return (read(unit, 'availabilityPeriods') ?? []).some((period: Row) => read(period, 'isVacant') === false && String(read(period, 'status')).toLowerCase() === 'occupied' && dayKey(read(period, 'startDate')) <= day && day <= dayKey(read(period, 'endDate')));
};
const monthDays = (unit: Row, month: Date) => Array.from({ length: new Date(month.getFullYear(), month.getMonth() + 1, 0).getDate() }, (_, index) => {
  const day = `${month.getFullYear()}-${String(month.getMonth() + 1).padStart(2, '0')}-${String(index + 1).padStart(2, '0')}`;
  return occupant(unit, day);
});

/** Mount in the selected property tab only; requests run only while the panel is focused. */
export default function PropertyRecordPanel({ tab, propertyId, property, navigation }: PropertyRecordPanelProps) {
  const { colors } = useAppTheme();
  const user = useAppSelector(state => state.user.currentUser);
  const accountScope = user?.id || user?.Id ? `${user?.id ?? user?.Id}:${user?.currentOrganizationId ?? user?.CurrentOrganizationId ?? ''}` : '';
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [retry, setRetry] = useState(0);
  const [offset, setOffset] = useState(0);
  const [selectedUnit, setSelectedUnit] = useState<string | null>(null);
  const [note, setNote] = useState('');
  const label = tab[0].toUpperCase() + tab.slice(1);
  const styles = {
    heading: { color: colors.text, fontSize: 19, fontWeight: '700' as const, marginBottom: 12 },
    text: { color: colors.text, fontSize: 15 },
    muted: { color: colors.muted, fontSize: 13, marginTop: 5 },
    card: { backgroundColor: colors.surface, borderColor: colors.border, borderWidth: 1, borderRadius: 12, padding: 15, marginBottom: 10 },
    action: { color: colors.accent, fontWeight: '700' as const, fontSize: 14 },
  };

  useFocusEffect(useCallback(() => {
    let active = true;
    setRows([]); setError(''); setNote(''); setLoading(true);
    const load = async () => {
      try {
        let result: Row[];
        let disclosure = '';
        if (tab === 'leases') result = await LeaseAPI.getLeases();
        else if (tab === 'maintenances') result = await MaintenanceAPI.getAll();
        else if (tab === 'listings') result = await getListings();
        else if (tab === 'applications') result = scopePropertyEndpointRows(unpack(await ApplicationAPI.getApplicationsByProperty(propertyId), label), propertyId);
        else if (tab === 'occupancy') {
          const user = await storageService.getUser<{ id?: number | string; Id?: number | string }>();
          const id = user?.id ?? user?.Id;
          if (!id) throw new Error('Sign in again to view occupancy.');
          const start = monthStart(offset);
          const end = new Date(start.getFullYear(), start.getMonth() + 1, 0, 23, 59, 59);
          const response = await apiClient.get(`/api/PropertyPortfolio/${encodeURIComponent(String(id))}/calendar?propertyId=${encodeURIComponent(propertyId)}&startDate=${encodeURIComponent(start.toISOString())}&endDate=${encodeURIComponent(end.toISOString())}`);
          if (response?.success === false) throw new Error('Occupancy could not be loaded.');
          const calendar = response?.data ?? response;
          if (!calendar || !Array.isArray(calendar.units ?? calendar.Units)) throw new Error('Occupancy returned an invalid response.');
          result = calendar.units ?? calendar.Units;
        } else if (tab === 'finances') {
          const to = new Date(); const from = new Date(to.getFullYear() - 1, to.getMonth(), to.getDate());
          const finance = await moneyCenterAPI.getItems({ from: from.toISOString(), to: to.toISOString(), propertyId: Number(propertyId) });
          result = finance.items;
          if (finance.totalCount > finance.items.length) disclosure = `Showing ${finance.items.length} of ${finance.totalCount} transactions. Narrower dates may show more.`;
          if (finance.disclosures?.length) disclosure += ` ${finance.disclosures.join(' ')}`;
        } else {
          // Property files are independent of tenant documents: a failure in the latter
          // must not hide files that were successfully loaded for this property.
          const files = unpack(await apiClient.get(`/api/file?propertyId=${encodeURIComponent(propertyId)}`), label);
          result = scoped(files, propertyId);
          try {
            const user = await storageService.getUser<{ id?: number | string; Id?: number | string }>();
            const landlordId = user?.id ?? user?.Id;
            if (!landlordId) throw new Error('No landlord session');
            const [tenantDocs, tenants] = await Promise.all([
              apiClient.get(`/api/TenantDocument/landlord/${encodeURIComponent(String(landlordId))}`),
              TenantAPI.getTenants(),
            ]);
            if (!Array.isArray(tenants)) throw new Error('Tenant list unavailable');
            const units: Row[] = property.units ?? property.Units ?? [];
            const unitIds = new Set(units.map(unit => String(read(unit, 'id'))));
            const leaseIds = new Set(units.flatMap(unit => [...(read(unit, 'leases') ?? []), read(unit, 'lease'), read(unit, 'activeLease')].filter(Boolean)).map(lease => String(read(lease, 'id'))));
            const propertyTenants = new Set(tenants.filter(tenant => same(read(tenant, 'propertyId'), propertyId) || unitIds.has(String(read(tenant, 'unitId')))).map(tenant => String(read(tenant, 'id'))));
            result.push(...unpack(tenantDocs, 'Tenant documents').filter(doc =>
              (read(doc, 'tenantId') != null && propertyTenants.has(String(read(doc, 'tenantId')))) ||
              (read(doc, 'leaseId') != null && leaseIds.has(String(read(doc, 'leaseId'))))
            ).map(doc => ({ ...doc, propertyId, title: read(doc, 'fileName'), categoryName: read(doc, 'documentTypeName') })));
          } catch { disclosure = 'Tenant documents could not be loaded; showing property files only.'; }
        }
        if (active) { setRows(scoped(result, propertyId)); setNote(disclosure); }
      } catch (e: any) { if (active) setError(e?.message || `${label} could not be loaded. Please retry.`); }
      finally { if (active) setLoading(false); }
    };
    void load();
    return () => { active = false; };
  }, [tab, propertyId, offset, retry]));

  useEffect(() => { setSelectedUnit(null); setOffset(0); }, [tab, propertyId]);
  const month = monthStart(offset);
  const title = (row: Row) => tab === 'leases' ? read(row, 'leaseNickname') || read(row, 'name') || `Lease #${read(row, 'id')}`
    : tab === 'maintenances' ? read(row, 'title') || `Request #${read(row, 'id')}`
    : tab === 'listings' ? read(row, 'propertyName') || `Listing #${read(row, 'id')}`
    : tab === 'applications' ? [read(row, 'firstName'), read(row, 'lastName')].filter(Boolean).join(' ') || `Application #${read(row, 'id')}`
    : tab === 'finances' ? read(row, 'description') || read(row, 'category') || 'Transaction'
    : read(row, 'title') || read(row, 'fileName') || 'Document';
  const open = async (row: Row) => {
    const id = read(row, 'id');
    if (tab === 'maintenances' && id && navigation) navigation.navigate('LandlordMaintenanceDetail', { requestId: String(id), listItem: row });
    else if (tab === 'leases' && id && navigation) navigation.getParent<any>()?.navigate('Leases', { screen: 'LeaseDetail', params: { leaseId: String(id), archived: read(row, 'archived') === true } });
    else if (tab === 'listings' && id && navigation && accountScope) navigation.getParent<any>()?.navigate('Listings', { screen: 'ListingDetail', params: { item: row, scope: accountScope } });
    else if (tab === 'applications' && id && navigation && accountScope) navigation.getParent<any>()?.navigate('Applications', { screen: 'ApplicationDetail', params: { item: row, scope: accountScope } });
    else if (tab === 'documents') {
      const url = read(row, 'blobUrl');
      if (typeof url === 'string' && /^https:\/\//i.test(url)) {
        try { await Linking.openURL(url); } catch { setError('This document could not be opened.'); }
      }
    }
  };
  const hasLink = (row: Row) => Boolean(navigation && read(row, 'id') && ['leases', 'maintenances', 'listings', 'applications'].includes(tab)) || (tab === 'documents' && /^https:\/\//i.test(read(row, 'blobUrl') ?? ''));

  return <View style={{ paddingVertical: 16 }} accessibilityLabel={`${label} for ${property.name ?? property.Name ?? 'property'}`}>
    <Text style={styles.heading}>{label}</Text>
    {tab === 'maintenances' && navigation && <TouchableOpacity accessibilityRole="button" onPress={() => navigation.navigate('AddMaintenanceRequest', { propertyId })} style={{ alignSelf: 'flex-start', paddingVertical: 12, marginBottom: 6 }}><Text style={styles.action}>+ Add maintenance request</Text></TouchableOpacity>}
    {tab === 'occupancy' && <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
      <TouchableOpacity accessibilityRole="button" accessibilityLabel="Previous month" onPress={() => setOffset(n => n - 1)}><Text style={styles.action}>‹ Previous</Text></TouchableOpacity>
      <Text style={styles.text}>{month.toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}</Text>
      <TouchableOpacity accessibilityRole="button" accessibilityLabel="Next month" onPress={() => setOffset(n => n + 1)}><Text style={styles.action}>Next ›</Text></TouchableOpacity>
    </View>}
    {loading && <ActivityIndicator accessibilityLabel={`Loading ${label}`} color={colors.accent} />}
    {!!error && !loading && <View style={styles.card}><Text style={styles.text}>{error}</Text><TouchableOpacity accessibilityRole="button" onPress={() => setRetry(n => n + 1)} style={{ marginTop: 12 }}><Text style={styles.action}>Try again</Text></TouchableOpacity></View>}
    {!loading && !error && <>
      {!!note && <Text style={[styles.muted, { marginBottom: 10 }]}>{note.trim()}</Text>}
      {!rows.length && <Text style={styles.muted}>No {tab === 'occupancy' ? 'occupancy data' : tab} for this property.</Text>}
      {tab === 'occupancy' ? rows.map(unit => {
        const id = String(read(unit, 'unitId'));
        const days = monthDays(unit, month); const occupied = days.filter(Boolean).length;
        return <View key={id} style={styles.card}>
          <TouchableOpacity accessibilityRole="button" onPress={() => setSelectedUnit(selectedUnit === id ? null : id)}>
            <Text style={styles.text}>{read(unit, 'unitName') || 'Unit'}</Text>
            <Text style={styles.muted}>{occupied} occupied · {days.length - occupied} vacant days · {selectedUnit === id ? 'Hide days' : 'View days'}</Text>
          </TouchableOpacity>
          {selectedUnit === id && <View style={{ flexDirection: 'row', flexWrap: 'wrap', marginTop: 12 }}>{days.map((day, index) => <View key={index} accessibilityLabel={`${index + 1}: ${day ? 'Occupied' : 'Vacant'}`} style={{ width: '13%', margin: '0.6%', paddingVertical: 10, alignItems: 'center', backgroundColor: day ? '#287c4c' : '#ad741b', borderRadius: 5 }}><Text style={{ color: '#fff' }}>{index + 1}</Text></View>)}</View>}
        </View>;
      }) : <>
        {rows.map((row, index) => <TouchableOpacity key={`${read(row, 'id') ?? read(row, 'sourceId') ?? index}-${index}`} disabled={!hasLink(row)} accessibilityRole={hasLink(row) ? 'button' : undefined} onPress={() => void open(row)} style={styles.card}>
          <Text style={[styles.text, { fontWeight: '600' }]}>{title(row)}</Text>
          {tab === 'leases' && <Text style={styles.muted}>{read(row, 'unitName') || 'Unit unspecified'} · {date(read(row, 'startDate'))} – {date(read(row, 'endDate'))} · {leaseStatus(row)}</Text>}
          {tab === 'maintenances' && <Text style={styles.muted}>{read(row, 'status') ?? 'Open'} · {read(row, 'unitName') || 'Property'} · {read(row, 'urgency') ?? read(row, 'priority') ?? ''}</Text>}
          {tab === 'listings' && <Text style={styles.muted}>{read(row, 'unitName') || 'Property'} · {money(read(row, 'monthlyRent'))}/month · {read(row, 'status') ?? 'Draft'}</Text>}
          {tab === 'applications' && <Text style={styles.muted}>{read(row, 'unitName') || 'Property'} · {read(row, 'statusName') || read(row, 'status') || 'Pending'} · Move-in {date(read(row, 'desiredMoveInDate'))}</Text>}
          {tab === 'finances' && <Text style={styles.muted}>{money(read(row, 'amount'))} · {read(row, 'direction') ?? ''} · {date(read(row, 'occurredAt'))} · {read(row, 'unitName') || 'Property'}</Text>}
          {tab === 'documents' && <Text style={styles.muted}>{read(row, 'fileName') || 'File'} · {read(row, 'categoryName') || 'Uncategorized'} · {date(read(row, 'createdAt'))}{hasLink(row) ? ' · Open' : ' · No download link'}</Text>}
        </TouchableOpacity>)}
      </>}
    </>}
  </View>;
}
