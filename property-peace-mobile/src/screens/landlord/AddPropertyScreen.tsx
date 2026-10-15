import React, { useState } from 'react';
import { Alert, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import PropertyAPI from '../../api/propertyAPI';
import AddressAutocompleteInput from '../../components/properties/AddressAutocompleteInput';
import {
  applyGooglePlaceDetails,
  PropertyDraft,
} from '../../features/properties/addressAutocomplete';

export default function AddPropertyScreen() {
  const navigation = useNavigation<any>();
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState<PropertyDraft>({ name: '', address: '', city: '', state: '', zipCode: '', propertyType: 'Residential' });

  const update = (key: keyof PropertyDraft, value: string) => setForm((current) => ({ ...current, [key]: value }));

  const save = async () => {
    if (!form.name.trim() || !form.address.trim()) {
      Alert.alert('Missing info', 'Property name and address are required.');
      return;
    }
    setSaving(true);
    try {
      await PropertyAPI.createProperty(form);
      Alert.alert('Property added', 'The property was added successfully.');
      navigation.goBack();
    } catch (error: any) {
      Alert.alert('Could not add property', error?.message || error?.Message || 'Please try again.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.content}
      keyboardShouldPersistTaps="handled"
      keyboardDismissMode="on-drag"
    >
      <Text style={styles.eyebrow}>NEW PROPERTY</Text>
      <Text style={styles.title}>Add a property</Text>
      <Text style={styles.helper}>Start with the address. Listing details and media can be completed on the web.</Text>
      <Text style={styles.sectionLabel}>PROPERTY DETAILS</Text>
      <TextInput style={styles.input} placeholder="Property name" value={form.name} onChangeText={(v) => update('name', v)} />
      <AddressAutocompleteInput
        value={form.address}
        onChangeText={(value) => update('address', value)}
        onPlaceSelected={(details) =>
          setForm((current) => applyGooglePlaceDetails(current, details))
        }
        disabled={saving}
      />
      <TextInput style={styles.input} placeholder="City" value={form.city} onChangeText={(v) => update('city', v)} />
      <View style={styles.row}>
        <TextInput style={[styles.input, styles.rowInput]} placeholder="State" autoCapitalize="characters" value={form.state} onChangeText={(v) => update('state', v)} />
        <TextInput style={[styles.input, styles.rowInput]} placeholder="ZIP" keyboardType="number-pad" value={form.zipCode} onChangeText={(v) => update('zipCode', v)} />
      </View>
      <TouchableOpacity style={[styles.primaryButton, saving && styles.disabledButton]} onPress={save} disabled={saving}>
        <Text style={styles.primaryButtonText}>{saving ? 'Adding…' : 'Add Property'}</Text>
      </TouchableOpacity>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#fbf7f4' },
  content: { paddingHorizontal: 22, paddingTop: 30, paddingBottom: 48 },
  eyebrow: { color: '#2f8f46', fontSize: 12, fontWeight: '800', letterSpacing: 1.4, marginBottom: 8 },
  title: { color: '#082941', fontSize: 30, fontWeight: '800', letterSpacing: -0.7, marginBottom: 8 },
  helper: { color: '#596b79', marginBottom: 30, lineHeight: 22, fontSize: 15 },
  sectionLabel: { color: '#647888', fontSize: 11, fontWeight: '800', letterSpacing: 1.2, marginBottom: 14 },
  input: { backgroundColor: '#fff', borderColor: '#dce3e5', borderWidth: 1, borderRadius: 12, minHeight: 50, paddingHorizontal: 14, paddingVertical: 12, marginBottom: 14, fontSize: 16, color: '#102d43' },
  row: { flexDirection: 'row', gap: 12 },
  rowInput: { flex: 1 },
  primaryButton: { backgroundColor: '#2475cf', borderRadius: 12, minHeight: 50, padding: 14, alignItems: 'center', justifyContent: 'center', marginTop: 16 },
  disabledButton: { opacity: 0.65 },
  primaryButtonText: { color: '#fff', fontWeight: '700', fontSize: 16 },
});
