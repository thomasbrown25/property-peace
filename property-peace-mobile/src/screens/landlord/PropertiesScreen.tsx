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
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { PropertiesStackParamList } from '../../navigation/types';
import PropertyAPI, { Property } from '../../api/propertyAPI';
import { filterPropertiesForList } from '../../features/properties/propertiesList';
import { useAppTheme } from '../../theme/AppTheme';
import PageBackButton from '../../components/PageBackButton';

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
  const styles = useScreenStyles();
  const { mode, colors } = useAppTheme();
  const navigation = useNavigation<PropertiesScreenNavigationProp>();
  const insets = useSafeAreaInsets();
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

  if (loading) return <View style={styles.centerContainer}><ActivityIndicator size="large" color={colors.accent} /></View>;

  return (
    <View style={styles.container}>
      <FlatList
        data={filteredProperties}
        keyExtractor={(item, index) => String(item.id || item.Id || index)}
        renderItem={({ item }) => <PropertyRow property={item} onPress={() => navigation.navigate('PropertyDetail', { propertyId: String(item.id || item.Id) })} />}
        contentContainerStyle={[styles.listContent, { paddingTop: insets.top + 28 }]}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); loadProperties(); }} tintColor={colors.accent} />}
        ListHeaderComponent={
          <View>
            <PageBackButton />
            <View style={styles.pageHeader}>
              <Text style={styles.eyebrow}>YOUR PORTFOLIO</Text>
              <Text style={styles.pageTitle} accessibilityRole="header">Properties</Text>
              <Text style={styles.pageSubtitle}>A clearer view of every place you manage.</Text>
            </View>

            <View style={styles.searchWrap}>
              <Ionicons name="search-outline" size={18} color={mode === 'dark' ? colors.muted : '#667789'} />
              <TextInput
                value={search}
                onChangeText={setSearch}
                placeholder="Search by name, address, tenant..."
                placeholderTextColor={mode === 'dark' ? colors.muted : '#8a98a6'}
                style={styles.searchInput}
                accessibilityLabel="Search properties"
              />
            </View>

            <View style={styles.actionRow}>
              <TouchableOpacity style={styles.primaryButton} onPress={() => navigation.navigate('AddProperty')} activeOpacity={0.85} accessibilityRole="button">
                <Ionicons name="add" size={20} color="#fff" />
                <Text style={styles.primaryButtonText}>Add property</Text>
              </TouchableOpacity>
            </View>
            <View style={styles.sectionHeader}>
              <Text style={styles.sectionTitle} accessibilityRole="header">All properties</Text>
              <Text style={styles.sectionCount}>{filteredProperties.length}</Text>
            </View>
          </View>
        }
        ListEmptyComponent={<EmptyState searching={Boolean(search.trim())} onAdd={() => navigation.navigate('AddProperty')} />}
        ItemSeparatorComponent={() => <View style={styles.separator} />}
      />
    </View>
  );
}

function PropertyRow({ property, onPress }: { property: Property; onPress: () => void }) {
  const styles = useScreenStyles();
  const { mode, colors } = useAppTheme();
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
    <TouchableOpacity style={styles.propertyCard} onPress={onPress} activeOpacity={0.84} accessibilityRole="button">
      {imageUrl ? (
        <Image source={{ uri: imageUrl }} style={styles.thumbnail} />
      ) : (
        <View style={styles.thumbnailFallback}><Ionicons name="home-outline" size={28} color={colors.accent} /></View>
      )}
      <View style={styles.propertyCopy}>
        <Text style={styles.propertyName} numberOfLines={2}>{name}</Text>
        {!!address && <Text style={styles.propertyAddress} numberOfLines={1}>{address}</Text>}
        <Text style={[styles.statusText, statusType === 'error' && styles.statusTextError, statusType === 'warning' && styles.statusTextWarning]}>{statusLabel}</Text>
        <View style={styles.propertyMetaRow}>
          {beds > 0 && <Text style={styles.propertyMeta}>🛏 {beds}</Text>}
          {baths > 0 && <Text style={styles.propertyMeta}>🛁 {baths}</Text>}
          {sqft > 0 && <Text style={styles.propertyMeta}>· {sqft.toLocaleString()} sqft</Text>}
          {rent > 0 && <Text style={styles.propertyRent}>· {currency(rent)}/mo</Text>}
        </View>
        {!!attentionText && (
          <View style={styles.attentionRow}>
            <Ionicons name="warning-outline" size={13} color={mode === 'dark' ? '#ff8b86' : '#c2413b'} />
            <Text style={styles.attentionText}>{attentionText}</Text>
          </View>
        )}
      </View>
    </TouchableOpacity>
  );
}

function EmptyState({ onAdd, searching }: { onAdd: () => void; searching: boolean }) {
  const styles = useScreenStyles();
  const { mode, colors } = useAppTheme();
  return (
    <View style={styles.emptyContainer}>
      <Ionicons name="home-outline" size={30} color={mode === 'dark' ? colors.muted : '#8aa5b8'} />
      <Text style={styles.emptyText}>{searching ? 'No matching properties' : 'No properties yet'}</Text>
      <Text style={styles.emptySubtext}>{searching ? 'Try another name, address, or tenant.' : 'Add a property to start managing your portfolio.'}</Text>
      {!searching && <TouchableOpacity style={styles.emptyButton} onPress={onAdd} activeOpacity={0.84} accessibilityRole="button">
        <Text style={styles.emptyButtonText}>Add property</Text>
      </TouchableOpacity>}
    </View>
  );
}

function useScreenStyles() {
  const { mode, colors } = useAppTheme();
  return useMemo(() => mode === 'light' ? styles : {
    ...styles,
    ...StyleSheet.create({
      container: { ...styles.container, backgroundColor: colors.background },
      centerContainer: { ...styles.centerContainer, backgroundColor: colors.background },
      eyebrow: { ...styles.eyebrow, color: colors.accent },
      pageTitle: { ...styles.pageTitle, color: colors.text },
      pageSubtitle: { ...styles.pageSubtitle, color: colors.muted },
      searchWrap: { ...styles.searchWrap, backgroundColor: colors.surface, borderColor: colors.border },
      searchInput: { ...styles.searchInput, color: colors.text },
      sectionTitle: { ...styles.sectionTitle, color: colors.text },
      sectionCount: { ...styles.sectionCount, color: colors.muted },
      separator: { ...styles.separator, backgroundColor: colors.border },
      thumbnail: { ...styles.thumbnail, backgroundColor: colors.surface },
      thumbnailFallback: { ...styles.thumbnailFallback, backgroundColor: colors.surface },
      propertyName: { ...styles.propertyName, color: colors.text },
      propertyAddress: { ...styles.propertyAddress, color: colors.muted },
      propertyMeta: { ...styles.propertyMeta, color: colors.muted },
      propertyRent: { ...styles.propertyRent, color: colors.accent },
      statusText: { ...styles.statusText, color: '#75d995' },
      statusTextError: { ...styles.statusTextError, color: '#ff8b86' },
      statusTextWarning: { ...styles.statusTextWarning, color: '#f0ba72' },
      attentionText: { ...styles.attentionText, color: '#ff8b86' },
      emptyText: { ...styles.emptyText, color: colors.text },
      emptySubtext: { ...styles.emptySubtext, color: colors.muted },
      emptyButtonText: { ...styles.emptyButtonText, color: colors.accent },
    }),
  }, [mode, colors]);
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#fbf7f4' },
  centerContainer: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#fbf7f4' },
  listContent: { paddingHorizontal: 22, paddingTop: 28, paddingBottom: 120 },
  pageHeader: { marginBottom: 26 },
  eyebrow: { color: '#2475cf', fontSize: 11, fontWeight: '800', letterSpacing: 1.8, marginBottom: 8 },
  pageTitle: { color: '#102d43', fontSize: 34, lineHeight: 40, fontWeight: '800', letterSpacing: -1 },
  pageSubtitle: { color: '#617180', fontSize: 15, lineHeight: 22, marginTop: 6 },
  actionRow: { flexDirection: 'row', marginBottom: 30 },
  primaryButton: { minHeight: 44, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, backgroundColor: '#2475cf', borderRadius: 10, paddingHorizontal: 18 },
  primaryButtonText: { color: '#fff', fontSize: 14, fontWeight: '700' },
  searchWrap: { flexDirection: 'row', alignItems: 'center', gap: 9, backgroundColor: '#fff', borderRadius: 10, borderWidth: 1, borderColor: '#e2e5e8', paddingHorizontal: 14, height: 48, marginBottom: 14 },
  searchInput: { flex: 1, color: '#102d43', fontSize: 15, fontWeight: '600', paddingVertical: 0 },
  sectionHeader: { flexDirection: 'row', alignItems: 'baseline', gap: 8, marginBottom: 10 },
  sectionTitle: { color: '#102d43', fontSize: 20, fontWeight: '800', letterSpacing: -0.4 },
  sectionCount: { color: '#788995', fontSize: 14 },
  separator: { height: StyleSheet.hairlineWidth, backgroundColor: '#dbe2e6' },
  propertyCard: { flexDirection: 'row', alignItems: 'center', gap: 14, paddingVertical: 17, minHeight: 104 },
  thumbnail: { width: 74, height: 74, borderRadius: 9, backgroundColor: '#eaf3ff' },
  thumbnailFallback: { width: 74, height: 74, borderRadius: 9, backgroundColor: '#eaf3ff', alignItems: 'center', justifyContent: 'center' },
  propertyCopy: { flex: 1, minWidth: 0 },
  propertyName: { color: '#102d43', fontSize: 16, lineHeight: 21, fontWeight: '700', marginBottom: 2 },
  statusText: { color: '#2f8f46', fontSize: 12, lineHeight: 18, fontWeight: '700', marginTop: 3 },
  statusTextError: { color: '#c2413b' },
  statusTextWarning: { color: '#b76b11' },
  propertyAddress: { color: '#697887', fontSize: 13, lineHeight: 18 },
  propertyMetaRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 4 },
  propertyMeta: { color: '#697887', fontSize: 12, lineHeight: 17 },
  propertyRent: { color: '#2475cf', fontSize: 12, lineHeight: 17, fontWeight: '900' },
  attentionRow: { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 4 },
  attentionText: { color: '#c2413b', fontSize: 12, lineHeight: 16, fontWeight: '700' },
  emptyContainer: { paddingVertical: 46, alignItems: 'center' },
  emptyText: { fontSize: 18, fontWeight: '700', color: '#102d43', marginTop: 12, marginBottom: 6 },
  emptySubtext: { fontSize: 14, color: '#697887', textAlign: 'center', lineHeight: 20, marginBottom: 16 },
  emptyButton: { minHeight: 44, justifyContent: 'center', paddingHorizontal: 12 },
  emptyButtonText: { color: '#2475cf', fontWeight: '700' },
});
