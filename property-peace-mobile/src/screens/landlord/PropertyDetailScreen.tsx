import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Image,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { RouteProp, useNavigation, useRoute } from '@react-navigation/native';
import { PropertiesStackParamList } from '../../navigation/types';
import PropertyAPI, { Property } from '../../api/propertyAPI';
import { buildPropertyChecklistEntry } from '../../features/checklists/checklistNavigationModel';
type PropertyDetailRoute = RouteProp<PropertiesStackParamList, 'PropertyDetail'>;

type PropertyDetailNavigation = NativeStackNavigationProp<PropertiesStackParamList, 'PropertyDetail'>;

const stringValue = (...values: any[]) => {
  for (const value of values) {
    if (typeof value === 'string' && value.trim()) return value.trim();
  }
  return '';
};

const numberValue = (...values: any[]) => {
  for (const value of values) {
    if (typeof value === 'number' && !Number.isNaN(value)) return value;
    if (typeof value === 'string' && value.trim() && !Number.isNaN(Number(value))) return Number(value);
  }
  return 0;
};

const currency = (value: number) => new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(value);

export default function PropertyDetailScreen() {
  const route = useRoute<PropertyDetailRoute>();
  const navigation = useNavigation<PropertyDetailNavigation>();
  const { propertyId } = route.params;
  const [property, setProperty] = useState<Property | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState(false);

  const loadProperty = useCallback(async () => {
    try {
      setProperty(await PropertyAPI.getPropertyById(propertyId));
      setError(false);
    } catch {
      setError(true);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [propertyId]);

  useEffect(() => { loadProperty(); }, [loadProperty]);

  const details = useMemo(() => {
    if (!property) return null;
    const units = property.units || property.Units || [];
    const name = stringValue(property.name, property.Name, property.streetAddress, property.StreetAddress, 'Property');
    const street = stringValue(property.streetAddress, property.StreetAddress, property.address, property.Address);
    const locality = [stringValue(property.city, property.City), stringValue(property.state, property.State), stringValue(property.zipCode, property.ZipCode)].filter(Boolean).join(', ').replace(', ,', ',');
    const imageUrl = stringValue(property.mainImageUrl, property.MainImageUrl, property.images?.[0]?.blobUrl, property.Images?.[0]?.BlobUrl);
    const occupied = units.filter((unit: any) => ['occupied', 'overdue'].includes(stringValue(unit.status, unit.Status).toLowerCase())).length;
    const rent = units.reduce((sum: number, unit: any) => sum + numberValue(unit.rentAmount, unit.RentAmount, unit.monthlyRent, unit.MonthlyRent), 0);
    return { units, name, street, locality, imageUrl, occupied, rent };
  }, [property]);

  if (loading) return <View style={styles.center}><ActivityIndicator size="large" color="#2475cf" /></View>;

  if (error || !property || !details) {
    return (
      <View style={styles.center}>
        <View style={styles.errorIcon}><Ionicons name="cloud-offline-outline" size={30} color="#a45f12" /></View>
        <Text style={styles.errorTitle}>Property unavailable</Text>
        <Text style={styles.errorText}>We couldn't load this property.</Text>
        <TouchableOpacity style={styles.retryButton} onPress={loadProperty}><Text style={styles.retryText}>Try again</Text></TouchableOpacity>
      </View>
    );
  }

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.content}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); loadProperty(); }} tintColor="#2475cf" />}
    >
      <View style={styles.heroCard}>
        {details.imageUrl ? <Image source={{ uri: details.imageUrl }} style={styles.heroImage} /> : (
          <View style={styles.heroImageFallback}><Ionicons name="home" size={52} color="#2475cf" /></View>
        )}
        <View style={styles.heroBody}>
          <Text style={styles.eyebrow}>PROPERTY HUB</Text>
          <Text style={styles.title}>{details.name}</Text>
          {!!details.street && <Text style={styles.address}>{details.street}</Text>}
          {!!details.locality && <Text style={styles.locality}>{details.locality}</Text>}
          <View style={styles.snapshotRow}>
            <Snapshot label="Units" value={String(details.units.length)} />
            <View style={styles.snapshotDivider} />
            <Snapshot label="Occupied" value={String(details.occupied)} />
            <View style={styles.snapshotDivider} />
            <Snapshot label="Rent roll" value={details.rent > 0 ? currency(details.rent) : '—'} />
          </View>
        </View>
      </View>

      <Text style={styles.sectionTitle}>On-site actions</Text>
      <View style={styles.actionList}>
        <ActionRow icon="clipboard-outline" title="Open checklists" subtitle="Complete move-in and move-out items" color="#2f8f46" background="#edf9ef" onPress={() => navigation.getParent<any>()?.navigate('Checklists', buildPropertyChecklistEntry(property))} />
        <ActionRow icon="construct-outline" title="Maintenance workflow" subtitle="Review and manage open requests" color="#d94d63" background="#fff0f3" onPress={() => navigation.getParent<any>()?.navigate('Maintenance', { screen: 'MaintenanceList' })} />
        <ActionRow icon="people-outline" title="View tenants" subtitle="Open your tenant directory" color="#2475cf" background="#eaf3ff" onPress={() => navigation.getParent<any>()?.navigate('Tenants')} />
        <ActionRow icon="document-text-outline" title="View leases" subtitle="Review lease status and dates" color="#8b5bb7" background="#f5effb" onPress={() => navigation.getParent<any>()?.navigate('Leases')} />
      </View>

      <View style={styles.sectionHeader}>
        <Text style={styles.sectionTitle}>Units</Text>
        <View style={styles.countChip}><Text style={styles.countText}>{details.units.length}</Text></View>
      </View>
      {details.units.length === 0 ? (
        <View style={styles.emptyCard}>
          <Ionicons name="business-outline" size={27} color="#71808d" />
          <Text style={styles.emptyTitle}>No units to show</Text>
          <Text style={styles.emptyText}>Add or manage units in the web app, then use them here for maintenance and checklists.</Text>
        </View>
      ) : (
        <View style={styles.unitList}>
          {details.units.map((unit: any, index: number) => {
            const status = stringValue(unit.status, unit.Status, 'Unknown');
            const rent = numberValue(unit.rentAmount, unit.RentAmount, unit.monthlyRent, unit.MonthlyRent);
            const unitId = String(unit.id || unit.Id || index);
            return (
              <View key={unitId} style={styles.unitCard}>
                <View style={styles.unitIcon}><Ionicons name="key-outline" size={21} color="#2475cf" /></View>
                <View style={styles.unitCopy}>
                  <Text style={styles.unitName}>{stringValue(unit.name, unit.Name, unit.unitNumber, unit.UnitNumber, `Unit ${index + 1}`)}</Text>
                  <Text style={styles.unitMeta}>{status}{rent > 0 ? ` · ${currency(rent)}/mo` : ''}</Text>
                </View>
                <TouchableOpacity style={styles.unitAction} onPress={() => navigation.getParent<any>()?.navigate('Maintenance', { screen: 'MaintenanceList' })} accessibilityLabel="Open maintenance workflow">
                  <Ionicons name="construct-outline" size={20} color="#0b3558" />
                </TouchableOpacity>
              </View>
            );
          })}
        </View>
      )}
    </ScrollView>
  );
}

function Snapshot({ label, value }: { label: string; value: string }) {
  return <View style={styles.snapshot}><Text style={styles.snapshotValue} numberOfLines={1} adjustsFontSizeToFit>{value}</Text><Text style={styles.snapshotLabel}>{label}</Text></View>;
}

function ActionRow({ icon, title, subtitle, color, background, onPress }: { icon: keyof typeof Ionicons.glyphMap; title: string; subtitle: string; color: string; background: string; onPress: () => void }) {
  return (
    <TouchableOpacity style={styles.actionRow} onPress={onPress} activeOpacity={0.82}>
      <View style={[styles.actionIcon, { backgroundColor: background }]}><Ionicons name={icon} size={24} color={color} /></View>
      <View style={styles.actionCopy}><Text style={styles.actionTitle}>{title}</Text><Text style={styles.actionSubtitle}>{subtitle}</Text></View>
      <Ionicons name="chevron-forward" size={20} color="#8c9aa6" />
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#fbf7f4' },
  content: { padding: 18, paddingBottom: 40 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24, backgroundColor: '#fbf7f4' },
  errorIcon: { width: 58, height: 58, borderRadius: 18, backgroundColor: '#fff8e8', alignItems: 'center', justifyContent: 'center', marginBottom: 13 },
  errorTitle: { color: '#102d43', fontSize: 19, fontWeight: '900' },
  errorText: { color: '#697887', marginTop: 5 },
  retryButton: { minHeight: 44, justifyContent: 'center', backgroundColor: '#2475cf', borderRadius: 13, paddingHorizontal: 18, marginTop: 16 },
  retryText: { color: '#fff', fontWeight: '900' },
  heroCard: { backgroundColor: '#fff', borderRadius: 22, borderWidth: 1, borderColor: '#e5e9ed', overflow: 'hidden', marginBottom: 27, shadowColor: '#13293d', shadowOpacity: 0.08, shadowRadius: 14, shadowOffset: { width: 0, height: 6 }, elevation: 2 },
  heroImage: { width: '100%', height: 178, backgroundColor: '#eaf3ff' },
  heroImageFallback: { width: '100%', height: 148, alignItems: 'center', justifyContent: 'center', backgroundColor: '#eaf3ff' },
  heroBody: { padding: 18 },
  eyebrow: { color: '#2f8f46', fontSize: 10, fontWeight: '900', letterSpacing: 1.1, marginBottom: 4 },
  title: { color: '#102d43', fontSize: 26, lineHeight: 32, fontWeight: '900', letterSpacing: -0.7 },
  address: { color: '#516576', fontSize: 15, lineHeight: 21, marginTop: 6 },
  locality: { color: '#71808d', fontSize: 14, lineHeight: 20 },
  snapshotRow: { flexDirection: 'row', alignItems: 'stretch', backgroundColor: '#f7fafc', borderRadius: 16, marginTop: 17, paddingVertical: 12 },
  snapshot: { flex: 1, minWidth: 0, alignItems: 'center', justifyContent: 'center' },
  snapshotDivider: { width: 1, backgroundColor: '#e0e7ec' },
  snapshotValue: { color: '#102d43', fontSize: 18, fontWeight: '900', paddingHorizontal: 4 },
  snapshotLabel: { color: '#71808d', fontSize: 10, marginTop: 3 },
  sectionTitle: { color: '#102d43', fontSize: 21, fontWeight: '900', letterSpacing: -0.3, marginBottom: 11 },
  actionList: { gap: 10, marginBottom: 28 },
  actionRow: { minHeight: 74, flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: '#fff', borderRadius: 18, borderWidth: 1, borderColor: '#e5e9ed', padding: 12 },
  actionIcon: { width: 48, height: 48, borderRadius: 15, alignItems: 'center', justifyContent: 'center' },
  actionCopy: { flex: 1, minWidth: 0 },
  actionTitle: { color: '#102d43', fontSize: 15, fontWeight: '900' },
  actionSubtitle: { color: '#71808d', fontSize: 12, lineHeight: 17, marginTop: 2 },
  sectionHeader: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  countChip: { minWidth: 25, height: 25, borderRadius: 9, alignItems: 'center', justifyContent: 'center', backgroundColor: '#eaf3ff', marginBottom: 11 },
  countText: { color: '#2475cf', fontSize: 12, fontWeight: '900' },
  emptyCard: { alignItems: 'center', backgroundColor: '#fff', borderRadius: 18, borderWidth: 1, borderColor: '#e5e9ed', padding: 24 },
  emptyTitle: { color: '#102d43', fontSize: 16, fontWeight: '900', marginTop: 9 },
  emptyText: { color: '#71808d', fontSize: 13, lineHeight: 19, textAlign: 'center', marginTop: 5 },
  unitList: { gap: 9 },
  unitCard: { minHeight: 68, flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: '#fff', borderRadius: 17, borderWidth: 1, borderColor: '#e5e9ed', padding: 11 },
  unitIcon: { width: 42, height: 42, borderRadius: 14, alignItems: 'center', justifyContent: 'center', backgroundColor: '#eaf3ff' },
  unitCopy: { flex: 1 },
  unitName: { color: '#102d43', fontSize: 15, fontWeight: '900' },
  unitMeta: { color: '#71808d', fontSize: 12, marginTop: 3 },
  unitAction: { width: 44, height: 44, borderRadius: 14, alignItems: 'center', justifyContent: 'center', backgroundColor: '#f4f7f9' },
});
