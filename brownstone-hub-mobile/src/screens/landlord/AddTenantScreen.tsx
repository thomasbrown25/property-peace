import React, { useState } from 'react';
import { Alert, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import TenantAPI from '../../api/tenantAPI';

export default function AddTenantScreen() {
  const navigation = useNavigation<any>();
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({ firstName: '', lastName: '', email: '', phoneNumber: '' });
  const update = (key: string, value: string) => setForm((current) => ({ ...current, [key]: value }));

  const save = async () => {
    if (!form.firstName.trim() || !form.lastName.trim() || !form.email.trim()) {
      Alert.alert('Missing info', 'First name, last name, and email are required.');
      return;
    }
    setSaving(true);
    try {
      await TenantAPI.createTenant(form);
      Alert.alert('Tenant added', 'The tenant was added successfully.');
      navigation.goBack();
    } catch (error: any) {
      Alert.alert('Could not add tenant', error?.message || error?.Message || 'Please try again.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <Text style={styles.helper}>Use mobile for quick tenant capture. Portal invites and account details can still be handled from web when needed.</Text>
      <TextInput style={styles.input} placeholder="First name" value={form.firstName} onChangeText={(v) => update('firstName', v)} />
      <TextInput style={styles.input} placeholder="Last name" value={form.lastName} onChangeText={(v) => update('lastName', v)} />
      <TextInput style={styles.input} placeholder="Email" autoCapitalize="none" keyboardType="email-address" value={form.email} onChangeText={(v) => update('email', v)} />
      <TextInput style={styles.input} placeholder="Phone" keyboardType="phone-pad" value={form.phoneNumber} onChangeText={(v) => update('phoneNumber', v)} />
      <TouchableOpacity style={[styles.primaryButton, saving && styles.disabledButton]} onPress={save} disabled={saving}>
        <Text style={styles.primaryButtonText}>{saving ? 'Adding…' : 'Add Tenant'}</Text>
      </TouchableOpacity>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f5f5f5' },
  content: { padding: 16 },
  helper: { color: '#555', marginBottom: 16, lineHeight: 20 },
  input: { backgroundColor: '#fff', borderColor: '#ddd', borderWidth: 1, borderRadius: 8, padding: 12, marginBottom: 12, fontSize: 16 },
  primaryButton: { backgroundColor: '#1976d2', borderRadius: 8, padding: 14, alignItems: 'center', marginTop: 8 },
  disabledButton: { opacity: 0.65 },
  primaryButtonText: { color: '#fff', fontWeight: '700', fontSize: 16 },
});
