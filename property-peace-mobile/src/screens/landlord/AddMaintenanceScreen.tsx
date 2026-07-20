import React, { useState } from 'react';
import { Alert, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import MaintenanceAPI from '../../api/maintenanceAPI';

export default function AddMaintenanceScreen() {
  const navigation = useNavigation<any>();
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({ propertyId: '', unitId: '', description: '', priority: 'Normal' });
  const update = (key: string, value: string) => setForm((current) => ({ ...current, [key]: value }));

  const save = async () => {
    if (!form.propertyId.trim() || !form.description.trim()) {
      Alert.alert('Missing info', 'Property ID and issue description are required.');
      return;
    }
    setSaving(true);
    try {
      await MaintenanceAPI.createMaintenanceRequest({
        propertyId: Number(form.propertyId),
        unitId: form.unitId ? Number(form.unitId) : undefined,
        description: form.description,
        priority: form.priority,
        source: 'LandlordMobile',
      });
      Alert.alert('Maintenance request added', 'Premium users will continue through the maintenance AI agent flow on the backend.');
      navigation.goBack();
    } catch (error: any) {
      Alert.alert('Could not add request', error?.message || error?.Message || 'Please try again.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <Text style={styles.helper}>Add the maintenance issue quickly. The API removes manual categories so the maintenance AI agent can choose the right category.</Text>
      <View style={styles.row}>
        <TextInput style={[styles.input, styles.rowInput]} placeholder="Property ID" keyboardType="number-pad" value={form.propertyId} onChangeText={(v) => update('propertyId', v)} />
        <TextInput style={[styles.input, styles.rowInput]} placeholder="Unit ID" keyboardType="number-pad" value={form.unitId} onChangeText={(v) => update('unitId', v)} />
      </View>
      <TextInput style={[styles.input, styles.multiline]} placeholder="What happened?" multiline value={form.description} onChangeText={(v) => update('description', v)} />
      <TouchableOpacity style={[styles.primaryButton, saving && styles.disabledButton]} onPress={save} disabled={saving}>
        <Text style={styles.primaryButtonText}>{saving ? 'Adding…' : 'Add Maintenance Request'}</Text>
      </TouchableOpacity>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f5f5f5' },
  content: { padding: 16 },
  helper: { color: '#555', marginBottom: 16, lineHeight: 20 },
  input: { backgroundColor: '#fff', borderColor: '#ddd', borderWidth: 1, borderRadius: 8, padding: 12, marginBottom: 12, fontSize: 16 },
  multiline: { minHeight: 120, textAlignVertical: 'top' },
  row: { flexDirection: 'row', gap: 12 },
  rowInput: { flex: 1 },
  primaryButton: { backgroundColor: '#1976d2', borderRadius: 8, padding: 14, alignItems: 'center', marginTop: 8 },
  disabledButton: { opacity: 0.65 },
  primaryButtonText: { color: '#fff', fontWeight: '700', fontSize: 16 },
});
