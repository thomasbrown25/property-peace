import React, { useState } from 'react';
import { Alert, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import TenantAPI from '../../api/tenantAPI';
import { useAppTheme } from '../../theme/AppTheme';

export default function AddTenantScreen() {
  const { mode, colors } = useAppTheme();
  const dark = mode === 'dark';
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
    <ScrollView style={[styles.container, dark && { backgroundColor: colors.background }]} contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled" keyboardDismissMode="on-drag">
      <Text style={[styles.eyebrow, dark && { color: colors.accent }]}>NEW TENANT</Text>
      <Text style={[styles.title, dark && { color: colors.text }]}>Add a tenant</Text>
      <Text style={[styles.helper, dark && { color: colors.muted }]}>Capture contact details here. Portal invitations and account setup can be handled on the web.</Text>
      <Text style={[styles.sectionLabel, dark && { color: colors.muted }]}>CONTACT DETAILS</Text>
      <TextInput style={[styles.input, dark && { backgroundColor: colors.surface, borderColor: colors.border, color: colors.text }]} placeholderTextColor={dark ? colors.muted : undefined} placeholder="First name" value={form.firstName} onChangeText={(v) => update('firstName', v)} />
      <TextInput style={[styles.input, dark && { backgroundColor: colors.surface, borderColor: colors.border, color: colors.text }]} placeholderTextColor={dark ? colors.muted : undefined} placeholder="Last name" value={form.lastName} onChangeText={(v) => update('lastName', v)} />
      <TextInput style={[styles.input, dark && { backgroundColor: colors.surface, borderColor: colors.border, color: colors.text }]} placeholderTextColor={dark ? colors.muted : undefined} placeholder="Email" autoCapitalize="none" keyboardType="email-address" value={form.email} onChangeText={(v) => update('email', v)} />
      <TextInput style={[styles.input, dark && { backgroundColor: colors.surface, borderColor: colors.border, color: colors.text }]} placeholderTextColor={dark ? colors.muted : undefined} placeholder="Phone" keyboardType="phone-pad" value={form.phoneNumber} onChangeText={(v) => update('phoneNumber', v)} />
      <TouchableOpacity style={[styles.primaryButton, dark && { backgroundColor: colors.accent }, saving && styles.disabledButton]} onPress={save} disabled={saving}>
        <Text style={[styles.primaryButtonText, dark && { color: colors.background }]}>{saving ? 'Adding…' : 'Add Tenant'}</Text>
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
  primaryButton: { backgroundColor: '#2475cf', borderRadius: 12, minHeight: 50, padding: 14, alignItems: 'center', justifyContent: 'center', marginTop: 16 },
  disabledButton: { opacity: 0.65 },
  primaryButtonText: { color: '#fff', fontWeight: '700', fontSize: 16 },
});
