import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  LayoutAnimation,
  Platform,
  RefreshControl,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  UIManager,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import PropertyAPI, { Property, Unit } from '../../api/propertyAPI';
import {
  filterChecklistProperties,
  getChecklistPropertyAddress,
  getChecklistPropertyLabel,
  isMultiUnitProperty,
} from '../../features/checklists/checklistHomeModel';
import { buildChecklistHomeParams, buildPropertyChecklistHistoryEntry, findPreselectedProperty } from '../../features/checklists/checklistNavigationModel';
import { ChecklistsStackParamList } from '../../navigation/checklistsTypes';
import { useAppTheme } from '../../theme/AppTheme';

type Props = NativeStackScreenProps<ChecklistsStackParamList, 'ChecklistPropertySearch'>;

const propertyId = (property: Property) => String(property.id ?? property.Id ?? '');
const unitId = (unit: Unit) => String(unit.id ?? unit.Id ?? '');
const unitName = (unit: Unit) => String(unit.name ?? unit.Name ?? `Unit ${unitId(unit)}`);

if (Platform.OS === 'android' && UIManager.setLayoutAnimationEnabledExperimental) {
  UIManager.setLayoutAnimationEnabledExperimental(true);
}

export default function ChecklistPropertySearchScreen({ navigation, route }: Props) {
  const { mode, colors } = useAppTheme();
  const themed = mode === 'dark' ? darkStyles : styles;
  const [properties, setProperties] = useState<Property[]>([]);
  const [selectedProperty, setSelectedProperty] = useState<Property | null>(null);
  const [units, setUnits] = useState<Unit[]>([]);
  const [unitsForPropertyId, setUnitsForPropertyId] = useState('');
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [unitsLoading, setUnitsLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState('');
  const [unitsError, setUnitsError] = useState('');

  const load = useCallback(async () => {
    try {
      const loaded = await PropertyAPI.getProperties();
      setProperties(loaded);
      setSelectedProperty((current) => route.params?.preselectedPropertyId
        ? findPreselectedProperty(loaded, route.params.preselectedPropertyId)
        : current && loaded.find((property) => propertyId(property) === propertyId(current)) || null);
      setError('');
    } catch (loadError: any) {
      setError(loadError?.message || 'Properties could not be loaded.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [route.params?.preselectedPropertyId]);

  useEffect(() => { load(); }, [load]);

  useEffect(() => {
    setUnits([]);
    setUnitsForPropertyId('');
    setUnitsError('');
    if (!selectedProperty || !isMultiUnitProperty(selectedProperty)) return;
    let active = true;
    setUnitsLoading(true);
    PropertyAPI.getUnits(propertyId(selectedProperty))
      .then((loaded) => { if (active) { LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut); setUnits(loaded); setUnitsForPropertyId(propertyId(selectedProperty)); } })
      .catch((loadError: any) => { if (active) setUnitsError(loadError?.message || 'Units could not be loaded.'); })
      .finally(() => { if (active) setUnitsLoading(false); });
    return () => { active = false; };
  }, [selectedProperty]);

  const visibleProperties = useMemo(
    () => filterChecklistProperties(properties, search),
    [properties, search],
  );
  const openProperty = (property: Property) => {
    if (isMultiUnitProperty(property)) {
      LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
      setUnitsError('');
      setSelectedProperty((current) => current && propertyId(current) === propertyId(property) ? null : property);
    } else {
      navigation.navigate('PropertyChecklists', buildChecklistHomeParams(property));
    }
  };

  if (loading) return <View style={themed.center}><ActivityIndicator size="large" color={mode === 'dark' ? colors.accent : '#2475cf'} /></View>;

  return (
    <FlatList
      style={themed.container}
      contentContainerStyle={themed.content}
      data={visibleProperties}
      keyExtractor={(item) => propertyId(item)}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); load(); }} tintColor={mode === 'dark' ? colors.accent : '#2475cf'} />}
      ListHeaderComponent={(
        <View>
          <View style={themed.hero}>
            <View style={themed.heroIcon}><Ionicons name="clipboard-outline" size={28} color={mode === 'dark' ? '#86dc9a' : '#2f8f46'} /></View>
            <View style={themed.heroCopy}>
              <Text style={themed.eyebrow}>PROPERTY INSPECTIONS</Text>
              <Text style={themed.title}>Find the home</Text>
              <Text style={themed.subtitle}>Tap a property to see its units or open its checklists.</Text>
            </View>
          </View>
          <View style={themed.searchWrap}>
            <Ionicons name="search" size={20} color={mode === 'dark' ? colors.muted : '#70808d'} />
            <TextInput
              value={search}
              onChangeText={setSearch}
              placeholder="Search name or address"
              placeholderTextColor={mode === 'dark' ? colors.muted : '#8795a1'}
              style={themed.searchInput}
              accessibilityLabel="Search properties"
              autoCapitalize="none"
            />
          </View>
          {!!error && (
            <TouchableOpacity style={themed.errorCard} onPress={load}>
              <Ionicons name="cloud-offline-outline" size={21} color={mode === 'dark' ? '#f0b669' : '#a45f12'} />
              <View style={themed.flex}><Text style={themed.errorTitle}>Properties are unavailable</Text><Text style={themed.errorText}>{error} Tap to retry.</Text></View>
            </TouchableOpacity>
          )}
        </View>
      )}
      renderItem={({ item }) => {
        const selected = propertyId(selectedProperty ?? {}) === propertyId(item);
        const needsUnit = isMultiUnitProperty(item);
        const displayedUnits = unitsForPropertyId === propertyId(item) ? units : [];
        const waitingForUnits = unitsLoading || (unitsForPropertyId !== propertyId(item) && !unitsError);
        const address = getChecklistPropertyAddress(item);
        return (
          <View>
            <TouchableOpacity
              style={[themed.propertyCard, selected && themed.propertyCardSelected]}
              onPress={() => openProperty(item)}
              accessibilityRole="button"
              accessibilityState={needsUnit ? { expanded: selected } : undefined}
              accessibilityLabel={`${needsUnit ? 'Show units for' : 'Open checklists for'} ${getChecklistPropertyLabel(item)}`}
            >
              <View style={[themed.propertyIcon, selected && themed.propertyIconSelected]}><Ionicons name="home-outline" size={23} color={selected ? '#fff' : mode === 'dark' ? colors.accent : '#2475cf'} /></View>
              <View style={themed.flex}>
                <Text style={themed.propertyName}>{getChecklistPropertyLabel(item)}</Text>
                {!!address && <Text style={themed.propertyAddress}>{address}</Text>}
              </View>
              {needsUnit && <Ionicons name={selected ? 'chevron-up' : 'chevron-down'} size={20} color={mode === 'dark' ? colors.muted : '#697887'} />}
            </TouchableOpacity>
            {selected && needsUnit && (
              <View style={themed.unitCard}>
                <Text style={themed.unitTitle}>Units</Text>
                {waitingForUnits && <ActivityIndicator color={mode === 'dark' ? colors.accent : '#2475cf'} style={themed.unitLoader} />}
                {!!unitsError && <TouchableOpacity accessibilityRole="button" onPress={() => setSelectedProperty({ ...item })}><Text style={themed.unitError}>{unitsError} Tap to retry.</Text></TouchableOpacity>}
                {!waitingForUnits && !unitsError && displayedUnits.map((unit) => (
                  <TouchableOpacity key={unitId(unit)} style={themed.unitRow} accessibilityRole="button" accessibilityLabel={`Open checklists for ${unitName(unit)}`} onPress={() => navigation.navigate('PropertyChecklists', buildChecklistHomeParams(item, unit))}>
                    <Text style={themed.unitName}>{unitName(unit)}</Text>
                    <Ionicons name="arrow-forward" size={18} color={mode === 'dark' ? colors.accent : '#2475cf'} />
                  </TouchableOpacity>
                ))}
                {!waitingForUnits && !unitsError && displayedUnits.length === 0 && <Text style={themed.unitError}>No units were found for this property.</Text>}
                <TouchableOpacity style={themed.historyRow} accessibilityRole="button" onPress={() => {
                  const entry = buildPropertyChecklistHistoryEntry(item);
                  navigation.navigate(entry.screen, entry.params);
                }}>
                  <Text style={themed.historyText}>View all property checklists</Text>
                  <Ionicons name="arrow-forward" size={18} color={mode === 'dark' ? colors.accent : '#2475cf'} />
                </TouchableOpacity>
              </View>
            )}
          </View>
        );
      }}
      ItemSeparatorComponent={() => <View style={themed.separator} />}
      ListEmptyComponent={!error ? <View style={themed.empty}><Text style={themed.emptyTitle}>No matching properties</Text><Text style={themed.emptyText}>Try a different name or address.</Text></View> : null}
      ListFooterComponent={<View style={themed.bottomSpace} />}
    />
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#fbf7f4' },
  content: { padding: 18, paddingBottom: 28 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: '#fbf7f4' },
  flex: { flex: 1 },
  hero: { flexDirection: 'row', gap: 14, marginBottom: 24 },
  heroIcon: { width: 54, height: 54, borderRadius: 18, alignItems: 'center', justifyContent: 'center', backgroundColor: '#edf9ef' },
  heroCopy: { flex: 1 },
  eyebrow: { color: '#2f8f46', fontSize: 10, fontWeight: '900', letterSpacing: 1.1, marginBottom: 3 },
  title: { color: '#102d43', fontSize: 28, lineHeight: 33, fontWeight: '900', letterSpacing: -0.7 },
  subtitle: { color: '#617180', fontSize: 14, lineHeight: 20, marginTop: 4 },
  searchWrap: { height: 50, flexDirection: 'row', alignItems: 'center', gap: 9, backgroundColor: '#fff', borderWidth: 1, borderColor: '#dce4ea', borderRadius: 15, paddingHorizontal: 16, marginBottom: 16 },
  searchInput: { flex: 1, color: '#102d43', fontSize: 15, paddingVertical: 0 },
  errorCard: { flexDirection: 'row', alignItems: 'center', gap: 10, padding: 14, borderRadius: 15, borderWidth: 1, borderColor: '#f1d8a7', backgroundColor: '#fff8e8', marginBottom: 14 },
  errorTitle: { color: '#7a480f', fontWeight: '900' },
  errorText: { color: '#8f6b3b', marginTop: 2, fontSize: 12 },
  propertyCard: { minHeight: 82, flexDirection: 'row', alignItems: 'center', gap: 12, borderBottomWidth: 1, borderBottomColor: '#e2e8ed', paddingVertical: 14, paddingHorizontal: 4 },
  propertyCardSelected: { borderBottomColor: '#65aa62', backgroundColor: '#f0f8ef' },
  propertyIcon: { width: 46, height: 46, borderRadius: 15, backgroundColor: '#eaf3ff', alignItems: 'center', justifyContent: 'center' },
  propertyIconSelected: { backgroundColor: '#2f8f46' },
  propertyName: { color: '#102d43', fontSize: 16, lineHeight: 21, fontWeight: '900' },
  propertyAddress: { color: '#697887', fontSize: 12, lineHeight: 17, marginTop: 2 },
  separator: { height: 0 },
  empty: { alignItems: 'center', padding: 28, borderTopWidth: 1, borderTopColor: '#e2e8ed' },
  emptyTitle: { color: '#102d43', fontSize: 16, fontWeight: '900' },
  emptyText: { color: '#697887', marginTop: 5 },
  unitCard: { backgroundColor: '#f5faf5', borderBottomWidth: 1, borderBottomColor: '#dce4e8', paddingHorizontal: 16, paddingTop: 12, paddingBottom: 8 },
  unitTitle: { color: '#102d43', fontSize: 13, fontWeight: '900', marginBottom: 4 },
  unitLoader: { marginVertical: 12 },
  unitError: { color: '#a45f12', lineHeight: 19, paddingVertical: 8 },
  unitRow: { minHeight: 50, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 8, borderBottomWidth: 1, borderBottomColor: '#e2e8ed' },
  unitName: { color: '#405566', fontWeight: '800' },
  historyRow: { minHeight: 48, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 8 },
  historyText: { color: '#2475cf', fontSize: 13, fontWeight: '800' },
  bottomSpace: { height: 30 },
});

const darkStyles = StyleSheet.create({
  ...styles,
  container: { ...styles.container, backgroundColor: '#101923' },
  center: { ...styles.center, backgroundColor: '#101923' },
  heroIcon: { ...styles.heroIcon, backgroundColor: '#1c3a34' },
  eyebrow: { ...styles.eyebrow, color: '#86dc9a' },
  title: { ...styles.title, color: '#f2f6fa' },
  subtitle: { ...styles.subtitle, color: '#b4c3d0' },
  searchWrap: { ...styles.searchWrap, backgroundColor: '#1b2937', borderColor: '#35495b' },
  searchInput: { ...styles.searchInput, color: '#f2f6fa' },
  errorCard: { ...styles.errorCard, backgroundColor: '#382d21', borderColor: '#8b6531' },
  errorTitle: { ...styles.errorTitle, color: '#f8d39b' },
  errorText: { ...styles.errorText, color: '#e5c59d' },
  propertyCard: { ...styles.propertyCard, borderBottomColor: '#35495b' },
  propertyCardSelected: { ...styles.propertyCardSelected, backgroundColor: '#1c3a34', borderBottomColor: '#5baf73' },
  propertyIcon: { ...styles.propertyIcon, backgroundColor: '#25394b' },
  propertyIconSelected: { ...styles.propertyIconSelected, backgroundColor: '#2f8f46' },
  propertyName: { ...styles.propertyName, color: '#f2f6fa' },
  propertyAddress: { ...styles.propertyAddress, color: '#b4c3d0' },
  empty: { ...styles.empty, borderTopColor: '#35495b' },
  emptyTitle: { ...styles.emptyTitle, color: '#f2f6fa' },
  emptyText: { ...styles.emptyText, color: '#b4c3d0' },
  unitCard: { ...styles.unitCard, backgroundColor: '#1c302d', borderBottomColor: '#35495b' },
  unitTitle: { ...styles.unitTitle, color: '#f2f6fa' },
  unitError: { ...styles.unitError, color: '#f0b669' },
  unitRow: { ...styles.unitRow, borderBottomColor: '#35495b' },
  unitName: { ...styles.unitName, color: '#d9e6ef' },
  historyText: { ...styles.historyText, color: '#72b6ff' },
});
