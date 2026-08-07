import React, { useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { RouteProp, useNavigation, useRoute } from '@react-navigation/native';
import MaintenanceAPI from '../../api/maintenanceAPI';
import PropertyAPI, { Property } from '../../api/propertyAPI';
import { MaintenanceStackParamList } from '../../navigation/types';

type AddMaintenanceRoute = RouteProp<MaintenanceStackParamList, 'AddMaintenance'>;
const PRIORITIES = ['Low', 'Medium', 'High'] as const;

const stringValue = (...values: any[]) => {
  for (const value of values) {
    if (typeof value === 'string' && value.trim()) return value.trim();
  }
  return '';
};

export default function AddMaintenanceScreen() {
  const navigation = useNavigation<any>();
  const route = useRoute<AddMaintenanceRoute>();
  const initial = route.params || {};
  const [properties, setProperties] = useState<Property[]>([]);
  const [loadingProperties, setLoadingProperties] = useState(true);
  const [propertyId, setPropertyId] = useState(initial.propertyId || '');
  const [unitId, setUnitId] = useState(initial.unitId || '');
  const [description, setDescription] = useState('');
  const [priority, setPriority] = useState<(typeof PRIORITIES)[number]>('Medium');
  const [propertyPickerOpen, setPropertyPickerOpen] = useState(!initial.propertyId);
  const [unitPickerOpen, setUnitPickerOpen] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    PropertyAPI.getProperties()
      .then((data) => setProperties(data || []))
      .catch(() => Alert.alert('Properties unavailable', 'We could not load your properties. Please try this form again.'))
      .finally(() => setLoadingProperties(false));
  }, []);

  const selectedProperty = useMemo(() => properties.find((property) => String(property.id || property.Id) === String(propertyId)), [properties, propertyId]);
  const units = selectedProperty?.units || selectedProperty?.Units || [];
  const selectedUnit = units.find((unit: any) => String(unit.id || unit.Id) === String(unitId));
  const selectedPropertyName = stringValue(selectedProperty?.name, selectedProperty?.Name, selectedProperty?.streetAddress, selectedProperty?.StreetAddress, initial.propertyName, 'Choose a property');
  const selectedUnitName = unitId ? stringValue(selectedUnit?.name, selectedUnit?.Name, selectedUnit?.unitNumber, selectedUnit?.UnitNumber, `Unit ${unitId}`) : 'Whole property / no unit';

  const save = async () => {
    if (!propertyId || !description.trim()) {
      Alert.alert('Missing information', 'Choose a property and describe the issue.');
      return;
    }
    setSaving(true);
    try {
      await MaintenanceAPI.createMaintenanceRequest({
        propertyId: Number(propertyId),
        unitId: unitId ? Number(unitId) : undefined,
        description: description.trim(),
        priority,
        source: 'LandlordMobile',
      });
      Alert.alert('Request added', 'The maintenance request is now in your Property Peace workflow.');
      navigation.goBack();
    } catch (error: any) {
      Alert.alert('Could not add request', error?.message || error?.Message || 'Please try again.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
      <View style={styles.hero}>
        <View style={styles.heroIcon}><Ionicons name="construct-outline" size={27} color="#d94d63" /></View>
        <View style={styles.heroCopy}>
          <Text style={styles.eyebrow}>QUICK FIELD NOTE</Text>
          <Text style={styles.title}>Log the issue</Text>
          <Text style={styles.subtitle}>Choose where it happened and describe what needs attention.</Text>
        </View>
      </View>

      <Text style={styles.label}>Property</Text>
      <TouchableOpacity style={styles.selector} onPress={() => setPropertyPickerOpen((open) => !open)} disabled={loadingProperties}>
        <View style={styles.selectorIcon}><Ionicons name="home-outline" size={20} color="#2475cf" /></View>
        <Text style={[styles.selectorText, !propertyId && styles.placeholder]} numberOfLines={2}>{loadingProperties ? 'Loading properties…' : selectedPropertyName}</Text>
        {loadingProperties ? <ActivityIndicator size="small" color="#2475cf" /> : <Ionicons name={propertyPickerOpen ? 'chevron-up' : 'chevron-down'} size={20} color="#71808d" />}
      </TouchableOpacity>
      {propertyPickerOpen && !loadingProperties && (
        <View style={styles.pickerList}>
          {properties.length === 0 ? <Text style={styles.emptyText}>No properties are available.</Text> : properties.map((property) => {
            const id = String(property.id || property.Id);
            const selected = id === String(propertyId);
            const name = stringValue(property.name, property.Name, property.streetAddress, property.StreetAddress, 'Property');
            const address = stringValue(property.address, property.Address, property.streetAddress, property.StreetAddress);
            return (
              <TouchableOpacity key={id} style={[styles.pickerRow, selected && styles.pickerRowSelected]} onPress={() => { setPropertyId(id); setUnitId(''); setPropertyPickerOpen(false); }}>
                <View style={styles.pickerCopy}><Text style={styles.pickerTitle}>{name}</Text>{!!address && address !== name && <Text style={styles.pickerSubtitle}>{address}</Text>}</View>
                {selected && <Ionicons name="checkmark-circle" size={22} color="#2f8f46" />}
              </TouchableOpacity>
            );
          })}
        </View>
      )}

      {!!propertyId && (
        <>
          <Text style={styles.label}>Unit <Text style={styles.optional}>optional</Text></Text>
          <TouchableOpacity style={styles.selector} onPress={() => setUnitPickerOpen((open) => !open)}>
            <View style={styles.selectorIcon}><Ionicons name="key-outline" size={20} color="#2475cf" /></View>
            <Text style={styles.selectorText}>{selectedUnitName}</Text>
            <Ionicons name={unitPickerOpen ? 'chevron-up' : 'chevron-down'} size={20} color="#71808d" />
          </TouchableOpacity>
          {unitPickerOpen && (
            <View style={styles.pickerList}>
              <TouchableOpacity style={[styles.pickerRow, !unitId && styles.pickerRowSelected]} onPress={() => { setUnitId(''); setUnitPickerOpen(false); }}>
                <Text style={styles.pickerTitle}>Whole property / no unit</Text>
                {!unitId && <Ionicons name="checkmark-circle" size={22} color="#2f8f46" />}
              </TouchableOpacity>
              {units.map((unit: any, index: number) => {
                const id = String(unit.id || unit.Id);
                const selected = id === String(unitId);
                return (
                  <TouchableOpacity key={id} style={[styles.pickerRow, selected && styles.pickerRowSelected]} onPress={() => { setUnitId(id); setUnitPickerOpen(false); }}>
                    <Text style={styles.pickerTitle}>{stringValue(unit.name, unit.Name, unit.unitNumber, unit.UnitNumber, `Unit ${index + 1}`)}</Text>
                    {selected && <Ionicons name="checkmark-circle" size={22} color="#2f8f46" />}
                  </TouchableOpacity>
                );
              })}
            </View>
          )}
        </>
      )}

      <Text style={styles.label}>Priority</Text>
      <View style={styles.priorityRow}>
        {PRIORITIES.map((item) => {
          const selected = priority === item;
          return <TouchableOpacity key={item} style={[styles.priorityChip, selected && styles.priorityChipSelected, selected && item === 'High' && styles.priorityChipHigh]} onPress={() => setPriority(item)}><Text style={[styles.priorityText, selected && styles.priorityTextSelected]}>{item}</Text></TouchableOpacity>;
        })}
      </View>

      <Text style={styles.label}>What happened?</Text>
      <TextInput
        style={styles.textArea}
        placeholder="Example: Water is leaking under the kitchen sink near the shutoff valve."
        placeholderTextColor="#8a98a6"
        multiline
        value={description}
        onChangeText={setDescription}
        textAlignVertical="top"
      />

      <TouchableOpacity style={[styles.primaryButton, (saving || !propertyId || !description.trim()) && styles.disabledButton]} onPress={save} disabled={saving || !propertyId || !description.trim()} activeOpacity={0.84}>
        {saving ? <ActivityIndicator size="small" color="#fff" /> : <Ionicons name="checkmark-circle-outline" size={21} color="#fff" />}
        <Text style={styles.primaryButtonText}>{saving ? 'Adding request…' : 'Add maintenance request'}</Text>
      </TouchableOpacity>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#fbf7f4' },
  content: { padding: 18, paddingBottom: 40 },
  hero: { flexDirection: 'row', alignItems: 'flex-start', gap: 14, marginBottom: 24 },
  heroIcon: { width: 54, height: 54, borderRadius: 18, alignItems: 'center', justifyContent: 'center', backgroundColor: '#fff0f3' },
  heroCopy: { flex: 1 },
  eyebrow: { color: '#d94d63', fontSize: 10, fontWeight: '900', letterSpacing: 1.1, marginBottom: 3 },
  title: { color: '#102d43', fontSize: 25, lineHeight: 31, fontWeight: '900', letterSpacing: -0.6 },
  subtitle: { color: '#617180', fontSize: 14, lineHeight: 20, marginTop: 4 },
  label: { color: '#20394d', fontSize: 13, fontWeight: '900', marginBottom: 7, marginTop: 14 },
  optional: { color: '#8a98a6', fontWeight: '600' },
  selector: { minHeight: 58, flexDirection: 'row', alignItems: 'center', gap: 11, backgroundColor: '#fff', borderWidth: 1, borderColor: '#dce4ea', borderRadius: 16, paddingHorizontal: 12 },
  selectorIcon: { width: 36, height: 36, borderRadius: 12, alignItems: 'center', justifyContent: 'center', backgroundColor: '#eaf3ff' },
  selectorText: { flex: 1, color: '#102d43', fontSize: 15, lineHeight: 20, fontWeight: '800' },
  placeholder: { color: '#8a98a6', fontWeight: '600' },
  pickerList: { marginTop: 7, backgroundColor: '#fff', borderWidth: 1, borderColor: '#dce4ea', borderRadius: 16, overflow: 'hidden' },
  pickerRow: { minHeight: 54, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 10, paddingHorizontal: 14, paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: '#edf1f3' },
  pickerRowSelected: { backgroundColor: '#f1f8f2' },
  pickerCopy: { flex: 1 },
  pickerTitle: { color: '#20394d', fontSize: 14, fontWeight: '800' },
  pickerSubtitle: { color: '#71808d', fontSize: 12, marginTop: 2 },
  emptyText: { color: '#71808d', padding: 15 },
  priorityRow: { flexDirection: 'row', gap: 8 },
  priorityChip: { flex: 1, minHeight: 46, alignItems: 'center', justifyContent: 'center', backgroundColor: '#fff', borderWidth: 1, borderColor: '#dce4ea', borderRadius: 14 },
  priorityChipSelected: { backgroundColor: '#2475cf', borderColor: '#2475cf' },
  priorityChipHigh: { backgroundColor: '#d94d63', borderColor: '#d94d63' },
  priorityText: { color: '#617180', fontSize: 14, fontWeight: '900' },
  priorityTextSelected: { color: '#fff' },
  textArea: { minHeight: 150, backgroundColor: '#fff', borderWidth: 1, borderColor: '#dce4ea', borderRadius: 16, padding: 14, color: '#102d43', fontSize: 15, lineHeight: 22 },
  primaryButton: { minHeight: 54, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, backgroundColor: '#2475cf', borderRadius: 16, marginTop: 20, shadowColor: '#2475cf', shadowOpacity: 0.24, shadowRadius: 10, shadowOffset: { width: 0, height: 5 }, elevation: 4 },
  disabledButton: { opacity: 0.5, shadowOpacity: 0 },
  primaryButtonText: { color: '#fff', fontSize: 15, fontWeight: '900' },
});
