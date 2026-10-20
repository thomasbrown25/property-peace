import { useTabScrollReset } from '../../navigation/useTabScrollReset';
import React, { useRef, useCallback, useMemo, useState } from 'react';
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
import LandlordPageHeader from '../../components/LandlordPageHeader';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { PropertiesStackParamList } from '../../navigation/types';
import PropertyAPI, { Property } from '../../api/propertyAPI';
import { filterPropertiesForList } from '../../features/properties/propertiesList';
import { useAppTheme } from '../../theme/AppTheme';


type PropertiesScreenNavigationProp = NativeStackNavigationProp<PropertiesStackParamList, 'PropertiesList'>;
const stringValue = (...values: any[]) => {
  for (const value of values) {
    if (typeof value === 'string' && value.trim()) return value.trim();
  }
  return '';
};

const getUnits = (property: Property) => property.units || property.Units || [];

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
  const scrollRef = useRef<FlatList>(null);
  useTabScrollReset(scrollRef);
  const styles = useScreenStyles();
  const { mode, colors } = useAppTheme();
  const navigation = useNavigation<PropertiesScreenNavigationProp>();
  const insets = useSafeAreaInsets();
  const [properties, setProperties] = useState<Property[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [loadError, setLoadError] = useState(false);
  const [search, setSearch] = useState('');
  const [reloadKey, setReloadKey] = useState(0);

  useFocusEffect(useCallback(() => {
    let active = true;
    const load = async () => {
      try {
        const data = await PropertyAPI.getProperties();
        if (active) {
          setProperties(data || []);
          setLoadError(false);
        }
      } catch (error) {
        console.error('Error loading properties:', error);
        if (active) {
          setProperties([]);
          setLoadError(true);
        }
      } finally {
        if (active) {
          setLoading(false);
          setRefreshing(false);
        }
      }
    };
    void load();
    return () => { active = false; };
  }, [reloadKey]));

  const refreshProperties = () => {
    setRefreshing(true);
    setReloadKey((key) => key + 1);
  };

  const overview = useMemo(() => {
    const activeProperties = properties.filter((property) => property.isActive !== false && property.IsActive !== false);
    const units = activeProperties.flatMap(getUnits);
    const occupied = units.filter((unit: any) => ['occupied', 'overdue'].includes(stringValue(unit.status, unit.Status).toLowerCase())).length;
    return { properties: activeProperties.length, total: units.length, occupied, vacant: units.length - occupied };
  }, [properties]);

  const filteredProperties = useMemo(() => {
    return filterPropertiesForList(properties, search)
      .sort((a, b) => Number(needsAttention(b)) - Number(needsAttention(a)));
  }, [properties, search]);

  return (
    <View style={styles.container}>
      <LandlordPageHeader title="Properties" />
      {loading ? <View style={styles.centerContainer}><ActivityIndicator size="large" color={colors.accent} /></View> : loadError ? (
        <View style={styles.centerContainer}>
          <Text style={styles.emptyText}>Properties are unavailable</Text>
          <TouchableOpacity style={styles.emptyButton} onPress={refreshProperties} accessibilityRole="button"><Text style={styles.emptyButtonText}>Retry</Text></TouchableOpacity>
        </View>
      ) : <FlatList
        ref={scrollRef}
        data={filteredProperties}
        keyExtractor={(item, index) => String(item.id || item.Id || index)}
        renderItem={({ item }) => <PropertyRow property={item} onPress={() => navigation.navigate('PropertyDetail', { propertyId: String(item.id || item.Id) })} />}
        contentContainerStyle={[styles.listContent, { paddingTop: 8, paddingBottom: 72 + Math.max(insets.bottom, 10) + 30 }]}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={refreshProperties} tintColor={colors.accent} />}
        ListHeaderComponent={
          <View>
            <View style={styles.portfolioOverview}>
              <Text style={styles.overviewEyebrow}>PORTFOLIO OVERVIEW</Text>
              <View style={styles.overviewTop}>
                <View>
                  <Text style={[styles.overviewValue, { color: colors.accent }]}>{overview.total ? `${Math.round(overview.occupied / overview.total * 100)}%` : '—'}</Text>
                  <Text style={styles.overviewLabel}>Occupancy</Text>
                </View>
                <TouchableOpacity style={[styles.primaryButton, { backgroundColor: colors.accent }]} onPress={() => navigation.navigate('AddProperty')} activeOpacity={0.85} accessibilityRole="button" accessibilityLabel="Add property">
                  <Ionicons name="add" size={20} color={mode === 'dark' ? colors.background : '#fff'} />
                  <Text style={[styles.primaryButtonText, mode === 'dark' && { color: colors.background }]}>Add property</Text>
                </TouchableOpacity>
              </View>
              <View style={styles.overviewStats}>
                <View style={styles.overviewStat}><Text style={styles.overviewStatValue}>{overview.properties}</Text><Text style={styles.overviewStatLabel}>Properties</Text></View>
                <View style={styles.overviewStat}><Text style={styles.overviewStatValue}>{overview.occupied}</Text><Text style={styles.overviewStatLabel}>Occupied units</Text></View>
                <View style={styles.overviewStat}><Text style={styles.overviewStatValue}>{overview.vacant}</Text><Text style={styles.overviewStatLabel}>Vacant units</Text></View>
              </View>
            </View>
            <View style={styles.searchWrap}>
              <Ionicons name="search" size={19} color={mode === 'dark' ? colors.muted : '#64748b'} />
              <TextInput
                value={search}
                onChangeText={setSearch}
                placeholder="Search by name, address, tenant..."
                placeholderTextColor={mode === 'dark' ? colors.muted : '#94a3b8'}
                style={styles.searchInput}
                accessibilityLabel="Search properties"
                returnKeyType="search"
              />
              {!!search && <TouchableOpacity accessibilityLabel="Clear search" onPress={() => setSearch('')}><Ionicons name="close-circle" size={19} color={mode === 'dark' ? colors.muted : '#94a3b8'} /></TouchableOpacity>}
            </View>

          </View>
        }
        ListEmptyComponent={<EmptyState searching={Boolean(search.trim())} onAdd={() => navigation.navigate('AddProperty')} />}
        ItemSeparatorComponent={() => <View style={styles.separator} />}
      />}
    </View>
  );
}

function PropertyRow({ property, onPress }: { property: Property; onPress: () => void }) {
  const styles = useScreenStyles();
  const { mode, colors } = useAppTheme();
  const summary = getUnitSummary(property);
  const imageUrl = stringValue(property.mainImageUrl, property.MainImageUrl, property.images?.[0]?.blobUrl, property.Images?.[0]?.BlobUrl);
  const name = stringValue(property.name, property.Name, property.streetAddress, property.StreetAddress, 'Unnamed Property');
  const address = [stringValue(property.streetAddress, property.StreetAddress, property.address, property.Address), stringValue(property.city, property.City)].filter(Boolean).join(', ');
  const overdueText = summary.overdue > 0
    ? `${summary.overdue} unit${summary.overdue > 1 ? 's' : ''} overdue`
    : '';
  const maintenanceText = summary.highMaint > 0
    ? `${summary.highMaint} high priority maintenance`
    : '';
  const isMultiUnit = stringValue(property.propertyType, property.PropertyType).toLowerCase() === 'multiunit';
  const statusLabel = isMultiUnit
    ? summary.total === 0 ? 'No units yet'
      : summary.occupied === summary.total ? `Occupied ${summary.occupied}/${summary.total}`
        : `Some vacancy ${summary.occupied}/${summary.total}`
    : summary.total === 0
      ? isOccupied(property) ? 'Occupied' : 'Vacant'
      : summary.vacant === summary.total ? 'Vacant'
        : summary.overdue > 0 ? 'Overdue'
          : summary.occupied === summary.total ? 'Occupied'
            : `${summary.occupied}/${summary.total} occupied`;
  const statusType = isMultiUnit
    ? summary.total === 0 ? 'neutral' : summary.occupied === summary.total ? 'success' : 'warning'
    : summary.overdue > 0 ? 'error' : statusLabel === 'Vacant' ? 'warning' : 'success';

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
        <View style={styles.statusRow}>
          <Text style={[styles.statusText, statusType === 'error' && styles.statusTextError, statusType === 'warning' && styles.statusTextWarning, statusType === 'neutral' && styles.statusTextNeutral]}>{statusLabel}</Text>
          {!!maintenanceText && (
            <View style={styles.maintenanceAlert}>
              <Ionicons name="warning-outline" size={13} color={mode === 'dark' ? '#ff8b86' : '#c2413b'} />
              <Text style={styles.maintenanceText}>{maintenanceText}</Text>
            </View>
          )}
        </View>
        {!!overdueText && (
          <View style={styles.attentionRow}>
            <Ionicons name="warning-outline" size={13} color={mode === 'dark' ? '#ff8b86' : '#c2413b'} />
            <Text style={styles.attentionText}>{overdueText}</Text>
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
      {!searching && <TouchableOpacity style={[styles.emptyButton, { backgroundColor: colors.accent }]} onPress={onAdd} activeOpacity={0.84} accessibilityRole="button">
        <Text style={[styles.emptyButtonText, mode === 'dark' && { color: colors.background }]}>Add property</Text>
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
      primaryButton: { ...styles.primaryButton, backgroundColor: '#061e35' },
      primaryButtonText: { ...styles.primaryButtonText, color: '#fff' },

      searchWrap: { ...styles.searchWrap, backgroundColor: colors.surface, borderColor: colors.border, borderWidth: 1 },
      portfolioOverview: { ...styles.portfolioOverview, borderColor: colors.border },
      overviewEyebrow: { ...styles.overviewEyebrow, color: '#75d995' },
      overviewValue: { ...styles.overviewValue, color: colors.text },
      overviewLabel: { ...styles.overviewLabel, color: colors.muted },
      overviewStats: { ...styles.overviewStats, borderTopColor: colors.border },
      overviewStatValue: { ...styles.overviewStatValue, color: colors.text },
      overviewStatLabel: { ...styles.overviewStatLabel, color: colors.muted },
      searchInput: { ...styles.searchInput, color: colors.text },
      separator: { ...styles.separator, backgroundColor: colors.border },
      thumbnail: { ...styles.thumbnail, backgroundColor: colors.surface },
      thumbnailFallback: { ...styles.thumbnailFallback, backgroundColor: colors.surface },
      propertyName: { ...styles.propertyName, color: colors.text },
      propertyAddress: { ...styles.propertyAddress, color: colors.muted },
      statusText: { ...styles.statusText, color: '#75d995' },
      statusTextError: { ...styles.statusTextError, color: '#ff8b86' },
      statusTextWarning: { ...styles.statusTextWarning, color: '#f0ba72' },
      statusTextNeutral: { ...styles.statusTextNeutral, color: colors.muted },
      maintenanceText: { ...styles.maintenanceText, color: '#ff8b86' },
      attentionText: { ...styles.attentionText, color: '#ff8b86' },
      emptyText: { ...styles.emptyText, color: colors.text },
      emptySubtext: { ...styles.emptySubtext, color: colors.muted },
      emptyButtonText: { ...styles.emptyButtonText, color: '#fff' },
    }),
  }, [mode, colors]);
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#fff' },

  centerContainer: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#fff' },
  listContent: { paddingHorizontal: 20, paddingTop: 8, paddingBottom: 120 },

  primaryButton: { minHeight: 44, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 4, backgroundColor: '#061e35', borderRadius: 10, paddingHorizontal: 12 },
  primaryButtonText: { color: '#fff', fontSize: 12, fontWeight: '800' },
  portfolioOverview: { marginBottom: 24, borderBottomWidth: StyleSheet.hairlineWidth, borderColor: '#dbe2e6', paddingTop: 8, paddingBottom: 20 },
  overviewEyebrow: { color: '#2f8f46', fontSize: 11, fontWeight: '800', letterSpacing: 1.2, marginBottom: 12 },
  overviewTop: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12, marginBottom: 18 },
  overviewValue: { color: '#102d43', fontSize: 34, lineHeight: 39, fontWeight: '800' },
  overviewLabel: { color: '#617180', fontSize: 13, marginTop: 1 },
  overviewStats: { flexDirection: 'row', borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: '#dbe2e6', paddingTop: 16 },
  overviewStat: { flex: 1, minWidth: 0, paddingRight: 6 },
  overviewStatValue: { color: '#102d43', fontSize: 20, fontWeight: '800' },
  overviewStatLabel: { color: '#617180', fontSize: 11, lineHeight: 15, marginTop: 3 },
  searchWrap: { flexDirection: 'row', alignItems: 'center', gap: 9, backgroundColor: '#f1f5f9', borderRadius: 10, paddingHorizontal: 13, minHeight: 46, marginBottom: 22 },
  searchInput: { flex: 1, color: '#0f172a', fontSize: 15, paddingVertical: 10 },
  separator: { height: StyleSheet.hairlineWidth, backgroundColor: '#dbe2e6' },
  propertyCard: { flexDirection: 'row', alignItems: 'center', gap: 14, paddingVertical: 17, minHeight: 104 },
  thumbnail: { width: 74, height: 74, borderRadius: 9, backgroundColor: '#eaf3ff' },
  thumbnailFallback: { width: 74, height: 74, borderRadius: 9, backgroundColor: '#eaf3ff', alignItems: 'center', justifyContent: 'center' },
  propertyCopy: { flex: 1, minWidth: 0 },
  propertyName: { color: '#102d43', fontSize: 16, lineHeight: 21, fontWeight: '700', marginBottom: 2 },
  statusRow: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', gap: 8, marginTop: 3 },
  statusText: { color: '#2f8f46', fontSize: 12, lineHeight: 18, fontWeight: '700', flexShrink: 1 },
  statusTextError: { color: '#c2413b' },
  statusTextWarning: { color: '#b76b11' },
  statusTextNeutral: { color: '#697887' },
  propertyAddress: { color: '#697887', fontSize: 13, lineHeight: 18 },
  maintenanceAlert: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'flex-end', gap: 4, flexShrink: 1, maxWidth: '65%' },
  maintenanceText: { color: '#c2413b', fontSize: 12, lineHeight: 16, fontWeight: '700', flexShrink: 1, textAlign: 'right' },
  attentionRow: { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 4 },
  attentionText: { color: '#c2413b', fontSize: 12, lineHeight: 16, fontWeight: '700' },
  emptyContainer: { paddingVertical: 46, alignItems: 'center' },
  emptyText: { fontSize: 18, fontWeight: '700', color: '#102d43', marginTop: 12, marginBottom: 6 },
  emptySubtext: { fontSize: 14, color: '#697887', textAlign: 'center', lineHeight: 20, marginBottom: 16 },
  emptyButton: { minHeight: 44, justifyContent: 'center', paddingHorizontal: 12, backgroundColor: '#061e35', borderRadius: 10 },
  emptyButtonText: { color: '#fff', fontWeight: '700' },
});
