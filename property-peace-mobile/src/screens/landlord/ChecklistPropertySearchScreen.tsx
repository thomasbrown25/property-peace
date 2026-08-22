import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  RefreshControl,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
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
import { buildChecklistHomeParams, findPreselectedProperty } from '../../features/checklists/checklistNavigationModel';
import { ChecklistsStackParamList } from '../../navigation/checklistsTypes';

type Props = NativeStackScreenProps<ChecklistsStackParamList, 'ChecklistPropertySearch'>;

const propertyId = (property: Property) => String(property.id ?? property.Id ?? '');
const unitId = (unit: Unit) => String(unit.id ?? unit.Id ?? '');
const unitName = (unit: Unit) => String(unit.name ?? unit.Name ?? `Unit ${unitId(unit)}`);

export default function ChecklistPropertySearchScreen({ navigation, route }: Props) {
  const [properties, setProperties] = useState<Property[]>([]);
  const [selectedProperty, setSelectedProperty] = useState<Property | null>(null);
  const [units, setUnits] = useState<Unit[]>([]);
  const [selectedUnit, setSelectedUnit] = useState<Unit | null>(null);
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
      setSelectedProperty((current) => current
        ?? findPreselectedProperty(loaded, route.params?.preselectedPropertyId));
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
    setSelectedUnit(null);
    setUnitsError('');
    if (!selectedProperty || !isMultiUnitProperty(selectedProperty)) return;
    let active = true;
    setUnitsLoading(true);
    PropertyAPI.getUnits(propertyId(selectedProperty))
      .then((loaded) => { if (active) setUnits(loaded); })
      .catch((loadError: any) => { if (active) setUnitsError(loadError?.message || 'Units could not be loaded.'); })
      .finally(() => { if (active) setUnitsLoading(false); });
    return () => { active = false; };
  }, [selectedProperty]);

  const visibleProperties = useMemo(
    () => filterChecklistProperties(properties, search),
    [properties, search],
  );
  const needsUnit = isMultiUnitProperty(selectedProperty);
  const canContinue = Boolean(selectedProperty && (!needsUnit || selectedUnit));

  const openHome = () => {
    if (!selectedProperty) return;
    const params = buildChecklistHomeParams(selectedProperty, selectedUnit);
    navigation.navigate('PropertyChecklists', params);
  };

  if (loading) return <View style={styles.center}><ActivityIndicator size="large" color="#2475cf" /></View>;

  return (
    <FlatList
      style={styles.container}
      contentContainerStyle={styles.content}
      data={visibleProperties}
      keyExtractor={(item) => propertyId(item)}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); load(); }} tintColor="#2475cf" />}
      ListHeaderComponent={(
        <View>
          <View style={styles.hero}>
            <View style={styles.heroIcon}><Ionicons name="clipboard-outline" size={28} color="#2f8f46" /></View>
            <View style={styles.heroCopy}>
              <Text style={styles.eyebrow}>PROPERTY INSPECTIONS</Text>
              <Text style={styles.title}>Find the home</Text>
              <Text style={styles.subtitle}>Choose a property to start or continue move-in and move-out checklists.</Text>
            </View>
          </View>
          <View style={styles.searchWrap}>
            <Ionicons name="search" size={20} color="#70808d" />
            <TextInput
              value={search}
              onChangeText={setSearch}
              placeholder="Search name or address"
              placeholderTextColor="#8795a1"
              style={styles.searchInput}
              accessibilityLabel="Search properties"
              autoCapitalize="none"
            />
          </View>
          {!!error && (
            <TouchableOpacity style={styles.errorCard} onPress={load}>
              <Ionicons name="cloud-offline-outline" size={21} color="#a45f12" />
              <View style={styles.flex}><Text style={styles.errorTitle}>Properties are unavailable</Text><Text style={styles.errorText}>{error} Tap to retry.</Text></View>
            </TouchableOpacity>
          )}
        </View>
      )}
      renderItem={({ item }) => {
        const selected = propertyId(selectedProperty ?? {}) === propertyId(item);
        const address = getChecklistPropertyAddress(item);
        return (
          <TouchableOpacity
            style={[styles.propertyCard, selected && styles.propertyCardSelected]}
            onPress={() => setSelectedProperty(item)}
            accessibilityRole="radio"
            accessibilityState={{ selected }}
          >
            <View style={[styles.propertyIcon, selected && styles.propertyIconSelected]}><Ionicons name="home-outline" size={23} color={selected ? '#fff' : '#2475cf'} /></View>
            <View style={styles.flex}>
              <Text style={styles.propertyName}>{getChecklistPropertyLabel(item)}</Text>
              {!!address && <Text style={styles.propertyAddress}>{address}</Text>}
            </View>
            <Ionicons name={selected ? 'checkmark-circle' : 'ellipse-outline'} size={23} color={selected ? '#2f8f46' : '#aab5be'} />
          </TouchableOpacity>
        );
      }}
      ItemSeparatorComponent={() => <View style={styles.separator} />}
      ListEmptyComponent={!error ? <View style={styles.empty}><Text style={styles.emptyTitle}>No matching properties</Text><Text style={styles.emptyText}>Try a different name or address.</Text></View> : null}
      ListFooterComponent={selectedProperty ? (
        <View style={styles.footer}>
          {needsUnit && (
            <View style={styles.unitCard}>
              <Text style={styles.unitTitle}>Select a unit</Text>
              <Text style={styles.unitHelp}>Checklists for this property are organized by unit.</Text>
              {unitsLoading && <ActivityIndicator color="#2475cf" style={styles.unitLoader} />}
              {!!unitsError && <TouchableOpacity onPress={() => setSelectedProperty({ ...selectedProperty })}><Text style={styles.unitError}>{unitsError} Tap to retry.</Text></TouchableOpacity>}
              {!unitsLoading && !unitsError && units.map((unit) => {
                const selected = unitId(selectedUnit ?? {}) === unitId(unit);
                return (
                  <TouchableOpacity key={unitId(unit)} style={[styles.unitRow, selected && styles.unitRowSelected]} onPress={() => setSelectedUnit(unit)}>
                    <Text style={[styles.unitName, selected && styles.unitNameSelected]}>{unitName(unit)}</Text>
                    {selected && <Ionicons name="checkmark" size={19} color="#2f8f46" />}
                  </TouchableOpacity>
                );
              })}
              {!unitsLoading && !unitsError && units.length === 0 && <Text style={styles.unitError}>No units were found for this property.</Text>}
            </View>
          )}
          <TouchableOpacity
            style={[styles.continueButton, !canContinue && styles.continueButtonDisabled]}
            disabled={!canContinue}
            onPress={openHome}
          >
            <Text style={styles.continueText}>Open checklists</Text>
            <Ionicons name="arrow-forward" size={19} color="#fff" />
          </TouchableOpacity>
        </View>
      ) : <View style={styles.bottomSpace} />}
    />
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#fbf7f4' },
  content: { padding: 18, paddingBottom: 110 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: '#fbf7f4' },
  flex: { flex: 1 },
  hero: { flexDirection: 'row', gap: 14, marginBottom: 18 },
  heroIcon: { width: 54, height: 54, borderRadius: 18, alignItems: 'center', justifyContent: 'center', backgroundColor: '#edf9ef' },
  heroCopy: { flex: 1 },
  eyebrow: { color: '#2f8f46', fontSize: 10, fontWeight: '900', letterSpacing: 1.1, marginBottom: 3 },
  title: { color: '#102d43', fontSize: 28, lineHeight: 33, fontWeight: '900', letterSpacing: -0.7 },
  subtitle: { color: '#617180', fontSize: 14, lineHeight: 20, marginTop: 4 },
  searchWrap: { height: 50, flexDirection: 'row', alignItems: 'center', gap: 9, backgroundColor: '#fff', borderWidth: 1, borderColor: '#dce4ea', borderRadius: 15, paddingHorizontal: 14, marginBottom: 14 },
  searchInput: { flex: 1, color: '#102d43', fontSize: 15, paddingVertical: 0 },
  errorCard: { flexDirection: 'row', alignItems: 'center', gap: 10, padding: 14, borderRadius: 15, borderWidth: 1, borderColor: '#f1d8a7', backgroundColor: '#fff8e8', marginBottom: 14 },
  errorTitle: { color: '#7a480f', fontWeight: '900' },
  errorText: { color: '#8f6b3b', marginTop: 2, fontSize: 12 },
  propertyCard: { minHeight: 78, flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: '#fff', borderWidth: 1, borderColor: '#e2e8ed', borderRadius: 18, padding: 12 },
  propertyCardSelected: { borderColor: '#65aa62', backgroundColor: '#f8fff8' },
  propertyIcon: { width: 46, height: 46, borderRadius: 15, backgroundColor: '#eaf3ff', alignItems: 'center', justifyContent: 'center' },
  propertyIconSelected: { backgroundColor: '#2f8f46' },
  propertyName: { color: '#102d43', fontSize: 16, lineHeight: 21, fontWeight: '900' },
  propertyAddress: { color: '#697887', fontSize: 12, lineHeight: 17, marginTop: 2 },
  separator: { height: 10 },
  empty: { alignItems: 'center', padding: 28, backgroundColor: '#fff', borderRadius: 18, borderWidth: 1, borderColor: '#e4e9ee' },
  emptyTitle: { color: '#102d43', fontSize: 16, fontWeight: '900' },
  emptyText: { color: '#697887', marginTop: 5 },
  footer: { marginTop: 16 },
  unitCard: { backgroundColor: '#fff', borderWidth: 1, borderColor: '#e2e8ed', borderRadius: 18, padding: 15, marginBottom: 12 },
  unitTitle: { color: '#102d43', fontSize: 17, fontWeight: '900' },
  unitHelp: { color: '#697887', fontSize: 13, marginTop: 3, marginBottom: 10 },
  unitLoader: { marginVertical: 12 },
  unitError: { color: '#a45f12', lineHeight: 19, paddingVertical: 8 },
  unitRow: { minHeight: 48, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 13, borderRadius: 13, backgroundColor: '#f6f8fa', marginTop: 7 },
  unitRowSelected: { backgroundColor: '#edf9ef', borderWidth: 1, borderColor: '#b9dfbd' },
  unitName: { color: '#405566', fontWeight: '800' },
  unitNameSelected: { color: '#245f31' },
  continueButton: { minHeight: 52, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, borderRadius: 15, backgroundColor: '#2475cf' },
  continueButtonDisabled: { opacity: 0.45 },
  continueText: { color: '#fff', fontSize: 15, fontWeight: '900' },
  bottomSpace: { height: 30 },
});
