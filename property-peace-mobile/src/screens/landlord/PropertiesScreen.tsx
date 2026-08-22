import React, { useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  Image,
  RefreshControl,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { PropertiesStackParamList } from '../../navigation/types';
import PropertyAPI, { Property } from '../../api/propertyAPI';
import { filterPropertiesForList } from '../../features/properties/propertiesList';

type PropertiesScreenNavigationProp = NativeStackNavigationProp<PropertiesStackParamList, 'PropertiesList'>;
const numberValue = (...values: any[]) => {
  for (const value of values) {
    if (typeof value === 'number' && !Number.isNaN(value)) return value;
    if (typeof value === 'string' && value.trim() !== '' && !Number.isNaN(Number(value))) return Number(value);
  }
  return 0;
};

const stringValue = (...values: any[]) => {
  for (const value of values) {
    if (typeof value === 'string' && value.trim()) return value.trim();
  }
  return '';
};

const getUnits = (property: Property) => property.units || property.Units || [];
const currency = (value: number) => new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(value || 0);

function getUnitSummary(property: Property) {
  const units = getUnits(property);
  let occupied = 0;
  let vacant = 0;
  let overdue = 0;
  units.forEach((unit: any) => {
    const status = stringValue(unit.status, unit.Status).toLowerCase();
    if (status === 'vacant') vacant += 1;
    else if (status === 'overdue') { occupied += 1; overdue += 1; }
    else if (status === 'occupied') occupied += 1;
  });
  const highMaint = (property.maintenanceRequests || property.MaintenanceRequests || []).filter((request: any) => {
    const priority = stringValue(request.priority, request.Priority).toLowerCase();
    const status = stringValue(request.status, request.Status).toLowerCase();
    return priority === 'high' && !['completed', 'cancelled'].includes(status);
  }).length;
  return { occupied, vacant, overdue, highMaint, total: units.length };
}

function isOccupied(property: Property) {
  const units = getUnits(property);
  if (units.length) return units.some((unit: any) => ['occupied', 'overdue'].includes(stringValue(unit.status, unit.Status).toLowerCase()));
  return Boolean(property.isOccupied || property.IsOccupied);
}

function needsAttention(property: Property) {
  const summary = getUnitSummary(property);
  return summary.overdue > 0 || summary.highMaint > 0;
}

export default function PropertiesScreen() {
  const navigation = useNavigation<PropertiesScreenNavigationProp>();
  const [properties, setProperties] = useState<Property[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [search, setSearch] = useState('');

  const loadProperties = async () => {
    try {
      const data = await PropertyAPI.getProperties();
      setProperties(data || []);
    } catch (error) {
      console.error('Error loading properties:', error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => { loadProperties(); }, []);

  const filteredProperties = useMemo(() => {
    return filterPropertiesForList(properties, search)
      .sort((a, b) => Number(needsAttention(b)) - Number(needsAttention(a)));
  }, [properties, search]);

  if (loading) return <View style={styles.centerContainer}><ActivityIndicator size="large" color="#2475cf" /></View>;

  return (
    <View style={styles.container}>
      <FlatList
        data={filteredProperties}
        keyExtractor={(item, index) => String(item.id || item.Id || index)}
        renderItem={({ item }) => <PropertyRow property={item} onPress={() => navigation.navigate('PropertyDetail', { propertyId: String(item.id || item.Id) })} />}
        contentContainerStyle={styles.listContent}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); loadProperties(); }} tintColor="#2475cf" />}
        ListHeaderComponent={
          <View>
            <View style={styles.pageHeader}>
              <View style={styles.pageIconWrap}><Ionicons name="home-outline" size={28} color="#2475cf" /></View>
              <View style={styles.pageHeaderCopy}>
                <Text style={styles.pageTitle}>Properties</Text>
                <Text style={styles.pageSubtitle}>Manage your property portfolio, view details, and track performance.</Text>
              </View>
            </View>

            <View style={styles.searchWrap}>
              <Ionicons name="search-outline" size={18} color="#667789" />
              <TextInput
                value={search}
                onChangeText={setSearch}
                placeholder="Search by name, address, tenant..."
                placeholderTextColor="#8a98a6"
                style={styles.searchInput}
              />
            </View>

            <View style={styles.actionRow}>
              <TouchableOpacity style={styles.primaryButton} onPress={() => navigation.navigate('AddProperty')} activeOpacity={0.85}>
                <Ionicons name="add" size={20} color="#fff" />
                <Text style={styles.primaryButtonText}>Add property</Text>
              </TouchableOpacity>
            </View>

          </View>
        }
        ListEmptyComponent={<EmptyState onAdd={() => navigation.navigate('AddProperty')} />}
        ItemSeparatorComponent={() => <View style={{ height: 10 }} />}
      />
    </View>
  );
}

function PropertyRow({ property, onPress }: { property: Property; onPress: () => void }) {
  const units = getUnits(property);
  const summary = getUnitSummary(property);
  const firstUnit = units[0] || {};
  const imageUrl = stringValue(property.mainImageUrl, property.MainImageUrl, property.images?.[0]?.blobUrl, property.Images?.[0]?.BlobUrl);
  const name = stringValue(property.name, property.Name, property.streetAddress, property.StreetAddress, 'Unnamed Property');
  const address = [stringValue(property.streetAddress, property.StreetAddress, property.address, property.Address), stringValue(property.city, property.City)].filter(Boolean).join(', ');
  const rent = numberValue(firstUnit.rentAmount, firstUnit.RentAmount, property.targetRent, property.TargetRent, property.monthlyRent, property.MonthlyRent);
  const beds = numberValue(firstUnit.bedrooms, firstUnit.Bedrooms, property.bedrooms, property.Bedrooms);
  const baths = numberValue(firstUnit.baths, firstUnit.Baths, property.baths, property.Baths);
  const sqft = numberValue(firstUnit.squareFeet, firstUnit.SquareFeet, property.squareFeet, property.SquareFeet);
  const attentionText = summary.overdue > 0
    ? `${summary.overdue} unit${summary.overdue > 1 ? 's' : ''} overdue`
    : summary.highMaint > 0
      ? `${summary.highMaint} high priority maintenance`
      : '';
  const statusLabel = summary.total === 0
    ? isOccupied(property) ? 'Occupied' : 'Vacant'
    : summary.vacant === summary.total ? 'Vacant'
      : summary.overdue > 0 ? 'Overdue'
        : summary.occupied === summary.total ? 'Occupied'
          : `${summary.occupied}/${summary.total} occupied`;
  const statusType = summary.overdue > 0 ? 'error' : statusLabel === 'Vacant' ? 'warning' : 'success';

  return (
    <TouchableOpacity style={styles.propertyCard} onPress={onPress} activeOpacity={0.84}>
      {imageUrl ? (
        <Image source={{ uri: imageUrl }} style={styles.thumbnail} />
      ) : (
        <View style={styles.thumbnailFallback}><Ionicons name="home-outline" size={28} color="#2475cf" /></View>
      )}
      <View style={styles.propertyCopy}>
        <View style={[styles.statusChip, statusType === 'error' && styles.statusChipError, statusType === 'warning' && styles.statusChipWarning]}>
          <Text style={[styles.statusChipText, statusType === 'error' && styles.statusChipTextError, statusType === 'warning' && styles.statusChipTextWarning]}>{statusLabel}</Text>
        </View>
        <Text style={styles.propertyName} numberOfLines={2}>{name}</Text>
        {!!address && <Text style={styles.propertyAddress} numberOfLines={1}>{address}</Text>}
        <View style={styles.propertyMetaRow}>
          {beds > 0 && <Text style={styles.propertyMeta}>🛏 {beds}</Text>}
          {baths > 0 && <Text style={styles.propertyMeta}>🛁 {baths}</Text>}
          {sqft > 0 && <Text style={styles.propertyMeta}>· {sqft.toLocaleString()} sqft</Text>}
          {rent > 0 && <Text style={styles.propertyRent}>· {currency(rent)}/mo</Text>}
        </View>
        {!!attentionText && (
          <View style={styles.attentionRow}>
            <Ionicons name="warning-outline" size={13} color="#c2413b" />
            <Text style={styles.attentionText}>{attentionText}</Text>
          </View>
        )}
      </View>
    </TouchableOpacity>
  );
}

function EmptyState({ onAdd }: { onAdd: () => void }) {
  return (
    <View style={styles.emptyContainer}>
      <View style={styles.emptyIcon}><Ionicons name="home-outline" size={34} color="#2475cf" /></View>
      <Text style={styles.emptyText}>No properties found</Text>
      <Text style={styles.emptySubtext}>Add a property to start using mobile landlord workflows.</Text>
      <TouchableOpacity style={styles.emptyButton} onPress={onAdd} activeOpacity={0.84}>
        <Text style={styles.emptyButtonText}>Add property</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#fbf7f4' },
  centerContainer: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#fbf7f4' },
  listContent: { padding: 18, paddingBottom: 120 },
  pageHeader: { flexDirection: 'row', alignItems: 'center', gap: 14, marginBottom: 18 },
  pageIconWrap: { width: 52, height: 52, borderRadius: 18, backgroundColor: '#eaf3ff', alignItems: 'center', justifyContent: 'center' },
  pageHeaderCopy: { flex: 1, minWidth: 0 },
  pageTitle: { color: '#102d43', fontSize: 30, lineHeight: 36, fontWeight: '900', letterSpacing: -0.8 },
  pageSubtitle: { color: '#617180', fontSize: 15, lineHeight: 21, marginTop: 2 },
  actionRow: { flexDirection: 'row', gap: 10, marginBottom: 14 },
  primaryButton: { flex: 1, minHeight: 48, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 7, backgroundColor: '#2475cf', borderRadius: 14, paddingVertical: 12, shadowColor: '#2475cf', shadowOpacity: 0.24, shadowRadius: 9, shadowOffset: { width: 0, height: 4 }, elevation: 4 },
  primaryButtonText: { color: '#fff', fontSize: 14, fontWeight: '900' },
  searchWrap: { flexDirection: 'row', alignItems: 'center', gap: 9, backgroundColor: '#fff', borderRadius: 15, borderWidth: 1, borderColor: '#dde4ea', paddingHorizontal: 14, height: 50, marginBottom: 10 },
  searchInput: { flex: 1, color: '#102d43', fontSize: 15, fontWeight: '600', paddingVertical: 0 },
  propertyCard: { flexDirection: 'row', gap: 13, padding: 12, borderRadius: 20, borderWidth: 1, borderColor: '#e4e9ee', backgroundColor: '#fff', shadowColor: '#2475cf', shadowOpacity: 0.07, shadowRadius: 14, shadowOffset: { width: 0, height: 6 }, elevation: 2 },
  thumbnail: { width: 82, height: 82, borderRadius: 16, overflow: 'hidden', backgroundColor: '#eaf3ff' },

  thumbnailFallback: { width: 82, height: 82, borderRadius: 16, backgroundColor: '#eaf3ff', borderWidth: 1, borderColor: '#d8e8fa', alignItems: 'center', justifyContent: 'center' },
  propertyCopy: { flex: 1, minWidth: 0 },
  propertyName: { color: '#102d43', fontSize: 16, lineHeight: 21, fontWeight: '900', marginBottom: 2 },
  statusChip: { alignSelf: 'flex-start', borderRadius: 10, backgroundColor: '#eaf8ee', paddingHorizontal: 8, paddingVertical: 4, marginBottom: 6 },
  statusChipError: { backgroundColor: '#fdecec' },
  statusChipWarning: { backgroundColor: '#fff3df' },
  statusChipText: { color: '#2f8f46', fontSize: 11, lineHeight: 13, fontWeight: '900' },
  statusChipTextError: { color: '#c2413b' },
  statusChipTextWarning: { color: '#b76b11' },
  propertyAddress: { color: '#697887', fontSize: 12, lineHeight: 17, marginBottom: 4 },
  propertyMetaRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 4 },
  propertyMeta: { color: '#697887', fontSize: 12, lineHeight: 17 },
  propertyRent: { color: '#2475cf', fontSize: 12, lineHeight: 17, fontWeight: '900' },
  attentionRow: { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 4 },
  attentionText: { color: '#c2413b', fontSize: 12, lineHeight: 16, fontWeight: '700' },
  emptyContainer: { marginTop: 14, padding: 28, alignItems: 'center', backgroundColor: '#fff', borderRadius: 18, borderWidth: 1, borderColor: '#e4e9ee' },
  emptyIcon: { width: 62, height: 62, borderRadius: 20, backgroundColor: '#eaf3ff', alignItems: 'center', justifyContent: 'center', marginBottom: 14 },
  emptyText: { fontSize: 17, fontWeight: '900', color: '#102d43', marginBottom: 6 },
  emptySubtext: { fontSize: 14, color: '#697887', textAlign: 'center', lineHeight: 20, marginBottom: 16 },
  emptyButton: { backgroundColor: '#2475cf', borderRadius: 13, paddingHorizontal: 18, paddingVertical: 11 },
  emptyButtonText: { color: '#fff', fontWeight: '900' },
});
