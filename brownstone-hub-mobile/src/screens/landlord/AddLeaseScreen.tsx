import React, { useState } from 'react';
import { Alert, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import LeaseAPI from '../../api/leaseAPI';

export default function AddLeaseScreen() {
  const navigation = useNavigation<any>();
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({ propertyId: '', unitId: '', tenantId: '', startDate: '', endDate: '', rentAmount: '', securityDeposit: '' });
  const update = (key: string, value: string) => setForm((current) => ({ ...current, [key]: value }));

  const save = async () => {
    if (!form.propertyId.trim() || !form.unitId.trim() || !form.startDate.trim() || !form.rentAmount.trim()) {
      Alert.alert('Missing info', 'Property ID, unit ID, start date, and rent amount are required.');
      return;
    }
    setSaving(true);
    try {
      const lease = await LeaseAPI.addOrUpdateLease({
        propertyId: Number(form.propertyId),
        unitId: Number(form.unitId),
        startDate: form.startDate,
        endDate: form.endDate || undefined,
        rentAmount: Number(form.rentAmount),
        securityDeposit: form.securityDeposit ? Number(form.securityDeposit) : undefined,
        isDrafted: true,
      });
      const leaseId = lease?.id || lease?.Id;
      if (leaseId && form.tenantId.trim()) {
        await LeaseAPI.addTenantToLease(leaseId, Number(form.tenantId));
        await LeaseAPI.notifyTenant(leaseId, Number(form.tenantId));
      }
      Alert.alert('Lease added', 'The lease was saved as a draft. Use web for full lease-builder details when needed.');
      navigation.goBack();
    } catch (error: any) {
      Alert.alert('Could not add lease', error?.message || error?.Message || 'Please try again.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <Text style={styles.helper}>Quick mobile leases create the operational draft. Full legal clauses, signatures, and advanced lease-builder work stay in the web app.</Text>
      <View style={styles.row}>
        <TextInput style={[styles.input, styles.rowInput]} placeholder="Property ID" keyboardType="number-pad" value={form.propertyId} onChangeText={(v) => update('propertyId', v)} />
        <TextInput style={[styles.input, styles.rowInput]} placeholder="Unit ID" keyboardType="number-pad" value={form.unitId} onChangeText={(v) => update('unitId', v)} />
      </View>
      <TextInput style={styles.input} placeholder="Tenant ID (optional)" keyboardType="number-pad" value={form.tenantId} onChangeText={(v) => update('tenantId', v)} />
      <TextInput style={styles.input} placeholder="Start date (YYYY-MM-DD)" value={form.startDate} onChangeText={(v) => update('startDate', v)} />
      <TextInput style={styles.input} placeholder="End date (YYYY-MM-DD, optional)" value={form.endDate} onChangeText={(v) => update('endDate', v)} />
      <TextInput style={styles.input} placeholder="Monthly rent" keyboardType="decimal-pad" value={form.rentAmount} onChangeText={(v) => update('rentAmount', v)} />
      <TextInput style={styles.input} placeholder="Security deposit" keyboardType="decimal-pad" value={form.securityDeposit} onChangeText={(v) => update('securityDeposit', v)} />
      <TouchableOpacity style={[styles.primaryButton, saving && styles.disabledButton]} onPress={save} disabled={saving}>
        <Text style={styles.primaryButtonText}>{saving ? 'Saving…' : 'Add Lease Draft'}</Text>
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
