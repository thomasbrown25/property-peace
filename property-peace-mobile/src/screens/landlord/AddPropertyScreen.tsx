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
      <Text style={styles.helper}>Mobile keeps this quick: add the property shell here, then use the web app for full listing/media setup.</Text>
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
  container: { flex: 1, backgroundColor: '#f5f5f5' },
  content: { padding: 16 },
  helper: { color: '#555', marginBottom: 16, lineHeight: 20 },
  input: { backgroundColor: '#fff', borderColor: '#ddd', borderWidth: 1, borderRadius: 8, padding: 12, marginBottom: 12, fontSize: 16 },
  row: { flexDirection: 'row', gap: 12 },
  rowInput: { flex: 1 },
  primaryButton: { backgroundColor: '#1976d2', borderRadius: 8, padding: 14, alignItems: 'center', marginTop: 8 },
  disabledButton: { opacity: 0.65 },
  primaryButtonText: { color: '#fff', fontWeight: '700', fontSize: 16 },
});
