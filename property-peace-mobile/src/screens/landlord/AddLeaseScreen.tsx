import React, { useEffect, useState } from 'react';
import { ActivityIndicator, Alert, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import PropertyAPI, { Property, Unit } from '../../api/propertyAPI';
import LeaseAPI from '../../api/leaseAPI';
import { LeasesStackParamList } from '../../navigation/types';
import { useAppTheme } from '../../theme/AppTheme';
import PageBackButton from '../../components/PageBackButton';

export default function AddLeaseScreen() {
  const navigation = useNavigation<NativeStackNavigationProp<LeasesStackParamList, 'AddLease'>>();
  const insets = useSafeAreaInsets();
  const { mode, colors } = useAppTheme();
  const dark = mode === 'dark';
  const [properties, setProperties] = useState<Property[]>([]);
  const [property, setProperty] = useState<Property | null>(null);
  const [units, setUnits] = useState<Unit[]>([]);
  const [unit, setUnit] = useState<Unit | null>(null);
  const [name, setName] = useState('');
  const [loading, setLoading] = useState(true);
  const [loadingUnits, setLoadingUnits] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    PropertyAPI.getProperties()
      .then(data => setProperties(data || []))
      .catch(() => setError('Could not load properties. Go back and try again.'))
      .finally(() => setLoading(false));
  }, []);

  const selectProperty = async (selected: Property) => {
    setProperty(selected);
    setUnit(null);
    setUnits([]);
    setError('');
    setLoadingUnits(true);
    try {
      const data = await PropertyAPI.getUnits(selected.id ?? selected.Id);
      setUnits(data || []);
    } catch {
      setError('Could not load units for this property. Tap the property to retry.');
    } finally {
      setLoadingUnits(false);
    }
  };

  const save = async () => {
    if (!property || !unit || saving) return;
    setSaving(true);
    setError('');
    try {
      await LeaseAPI.addOrUpdateLease({ propertyId: property.id ?? property.Id, unitId: unit.id ?? unit.Id, name: name.trim() || undefined, isDrafted: true });
      Alert.alert('Lease draft saved', 'Your lease draft is in the leases list.', [{ text: 'Done', onPress: () => navigation.goBack() }]);
    } catch (cause: any) {
      setError(cause?.response?.data?.message || 'Could not save the lease draft. Please try again.');
    } finally {
      setSaving(false);
    }
  };

  const label = (value: any) => String(value?.name || value?.Name || value?.streetAddress || value?.StreetAddress || 'Unnamed');
  return (
    <ScrollView style={[styles.container, dark && { backgroundColor: colors.background }]} contentContainerStyle={[styles.content, { paddingTop: insets.top + 4 }]} keyboardShouldPersistTaps="handled">
      <PageBackButton />
      <Text style={[styles.title, dark && { color: colors.text }]}>Add lease</Text>
      <Text style={[styles.subtitle, dark && { color: colors.muted }]}>Start a draft for a property and unit. A draft won't activate a lease or collect rent.</Text>
      <Text style={[styles.label, dark && { color: colors.text }]}>Property</Text>
      {loading ? <ActivityIndicator color={colors.accent} /> : properties.length === 0 && !error ? <Text style={[styles.hint, dark && { color: colors.muted }]}>Add a property before creating a lease.</Text> : properties.map(item => (
        <TouchableOpacity key={String(item.id ?? item.Id)} style={[styles.option, dark && { borderColor: colors.border }, property === item && { borderColor: colors.accent }]} onPress={() => selectProperty(item)} accessibilityRole="radio" accessibilityState={{ checked: property === item }}>
          <Text style={[styles.optionText, dark && { color: colors.text }]}>{label(item)}</Text>
          {property === item && <Ionicons name="checkmark-circle" size={20} color={colors.accent} />}
        </TouchableOpacity>
      ))}
      {property && <>
        <Text style={[styles.label, dark && { color: colors.text }]}>Unit</Text>
        {loadingUnits ? <ActivityIndicator color={colors.accent} /> : units.length === 0 ? <Text style={[styles.hint, dark && { color: colors.muted }]}>No units available for this property.</Text> : units.map(item => (
          <TouchableOpacity key={String(item.id ?? item.Id)} style={[styles.option, dark && { borderColor: colors.border }, unit === item && { borderColor: colors.accent }]} onPress={() => setUnit(item)} accessibilityRole="radio" accessibilityState={{ checked: unit === item }}>
            <Text style={[styles.optionText, dark && { color: colors.text }]}>{label(item)}</Text>
            {unit === item && <Ionicons name="checkmark-circle" size={20} color={colors.accent} />}
          </TouchableOpacity>
        ))}
      </>}
      <Text style={[styles.label, dark && { color: colors.text }]}>Lease name (optional)</Text>
      <TextInput value={name} onChangeText={setName} placeholder="e.g. Upstairs apartment" placeholderTextColor={colors.muted} style={[styles.input, dark && { color: colors.text, borderColor: colors.border, backgroundColor: colors.surface }]} accessibilityLabel="Lease name" />
      {!!error && <Text style={styles.error} accessibilityRole="alert">{error}</Text>}
      <TouchableOpacity style={[styles.saveButton, { backgroundColor: colors.accent }, (!unit || saving) && styles.disabled]} disabled={!unit || saving} onPress={save} accessibilityRole="button" accessibilityLabel="Save lease draft">
        {saving ? <ActivityIndicator color="#fff" /> : <Text style={styles.saveText}>Save lease draft</Text>}
      </TouchableOpacity>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#fff' },
  content: { paddingHorizontal: 22, paddingBottom: 40 },
  title: { fontSize: 28, fontWeight: '800', color: '#102d43', marginTop: 8 },
  subtitle: { fontSize: 14, lineHeight: 21, color: '#617180', marginTop: 6, marginBottom: 24 },
  label: { fontSize: 16, fontWeight: '700', color: '#102d43', marginTop: 16, marginBottom: 8 },
  hint: { color: '#617180', fontSize: 14 },
  option: { minHeight: 48, borderWidth: 1, borderColor: '#dbe2e6', borderRadius: 10, marginBottom: 8, paddingHorizontal: 14, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  optionText: { fontSize: 15, color: '#102d43', flex: 1 },
  input: { minHeight: 48, borderWidth: 1, borderColor: '#dbe2e6', borderRadius: 10, paddingHorizontal: 14, color: '#102d43', backgroundColor: '#fff' },
  error: { marginTop: 18, color: '#a5322e', fontSize: 14 },
  saveButton: { minHeight: 48, borderRadius: 10, alignItems: 'center', justifyContent: 'center', marginTop: 28 },
  disabled: { opacity: 0.5 },
  saveText: { color: '#fff', fontSize: 15, fontWeight: '800' },
});
