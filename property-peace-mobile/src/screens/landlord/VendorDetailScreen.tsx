import React, { useCallback, useState } from 'react';
import { ActivityIndicator, KeyboardAvoidingView, Platform, Pressable, RefreshControl, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect } from '@react-navigation/native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import VendorAPI, { type Vendor, type VendorMaintenance } from '../../api/vendorAPI';
import type { VendorsStackParamList } from '../../navigation/types';
import { useAppTheme } from '../../theme/AppTheme';

type Props = NativeStackScreenProps<VendorsStackParamList, 'VendorDetail'>;
const editable = ['name', 'businessName', 'description', 'category', 'specialties', 'phone', 'alternatePhone', 'email', 'address', 'city', 'state', 'zipCode', 'licenseNumber', 'notes'] as const;
type Field = typeof editable[number];
const labels: Record<Field, string> = { name: 'Name', businessName: 'Business name', description: 'Description', category: 'Category / trade', specialties: 'Specialties', phone: 'Phone', alternatePhone: 'Alternate phone', email: 'Email', address: 'Address', city: 'City', state: 'State', zipCode: 'ZIP code', licenseNumber: 'License number', notes: 'Notes' };
const limits: Record<Field, number> = { name: 200, businessName: 200, description: 1000, category: 100, specialties: 500, phone: 50, alternatePhone: 50, email: 200, address: 500, city: 100, state: 50, zipCode: 20, licenseNumber: 100, notes: 2000 };
const value = (vendor: Vendor, key: string): string => String(vendor[key] ?? vendor[key[0].toUpperCase() + key.slice(1)] ?? '');
const boolean = (item: Record<string, unknown>, key: string): boolean => (item[key] ?? item[key[0].toUpperCase() + key.slice(1)]) === true;
const date = (raw?: string | null) => raw && !Number.isNaN(Date.parse(raw)) ? new Date(raw).toLocaleDateString() : 'Date unavailable';

export default function VendorDetailScreen({ route, navigation }: Props) {
  const { vendorId } = route.params;
  const { colors, mode } = useAppTheme();
  const [vendor, setVendor] = useState<Vendor | null>(null);
  const [work, setWork] = useState<VendorMaintenance[]>([]);
  const [loading, setLoading] = useState(true);
  const [workLoading, setWorkLoading] = useState(true);
  const [error, setError] = useState('');
  const [workError, setWorkError] = useState('');
  const [refreshing, setRefreshing] = useState(false);
  const [editing, setEditing] = useState(false);
  const [form, setForm] = useState<Record<Field, string>>({} as Record<Field, string>);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState('');
  const [reload, setReload] = useState(0);

  useFocusEffect(useCallback(() => {
    let current = true;
    setLoading(true);
    setWorkLoading(true);
    setError('');
    setWorkError('');
    VendorAPI.getVendor(vendorId).then(data => { if (current) setVendor(data); })
      .catch(() => { if (current) { setVendor(null); setError('Could not load this vendor.'); } })
      .finally(() => { if (current) setLoading(false); });
    VendorAPI.getMaintenance(vendorId).then(data => { if (current) setWork(data); })
      .catch(() => { if (current) { setWork([]); setWorkError('Could not load recent work.'); } })
      .finally(() => { if (current) { setWorkLoading(false); setRefreshing(false); } });
    return () => { current = false; };
  }, [vendorId, reload]));

  const startEdit = () => {
    if (!vendor) return;
    setForm(Object.fromEntries(editable.map(key => [key, value(vendor, key)])) as Record<Field, string>);
    setSaveError('');
    setEditing(true);
  };
  const save = async () => {
    if (!vendor || saving) return;
    const name = form.name.trim();
    if (!name) { setSaveError('Enter a vendor name.'); return; }
    if (editable.some(key => form[key].trim().length > limits[key])) { setSaveError('One or more fields exceed the allowed length.'); return; }
    if (form.email.trim() && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email.trim())) { setSaveError('Enter a valid email address.'); return; }
    const changes: Record<string, string | null> = {};
    for (const key of editable) {
      const next = form[key].trim();
      if (next !== value(vendor, key)) changes[key] = key === 'name' ? next : next || null;
    }
    if (!Object.keys(changes).length) { setEditing(false); return; }
    setSaving(true);
    setSaveError('');
    try {
      const updated = await VendorAPI.patchVendor(vendorId, changes);
      setVendor(updated);
      setEditing(false);
      setReload(n => n + 1);
    } catch {
      setSaveError('Could not save changes. Check your connection and try again.');
    } finally { setSaving(false); }
  };

  const background = colors.background;
  return <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={[styles.container, { backgroundColor: background }]}>
    <ScrollView keyboardShouldPersistTaps="handled" refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); setReload(n => n + 1); }} tintColor={colors.accent} />} contentContainerStyle={styles.content}>
      {loading ? <ActivityIndicator color={colors.accent} /> : error || !vendor ? <View style={styles.center}><Text style={{ color: colors.text }}>{error || 'Vendor unavailable.'}</Text><Pressable onPress={() => setReload(n => n + 1)} style={styles.action}><Text style={{ color: colors.accent }}>Retry</Text></Pressable></View> : <>
        <View style={styles.heading}><View style={styles.headingText}><Text accessibilityRole="header" style={[styles.title, { color: colors.text }]}>{value(vendor, 'name')}</Text><Text style={{ color: colors.muted }}>{[value(vendor, 'businessName'), value(vendor, 'category')].filter(Boolean).join(' · ') || 'Category not set'}</Text></View><Pressable accessibilityRole="button" accessibilityLabel={editing ? 'Cancel editing' : 'Edit vendor'} disabled={saving} onPress={() => editing ? setEditing(false) : startEdit()} style={[styles.edit, { borderColor: colors.border }]}><Ionicons name={editing ? 'close' : 'create-outline'} size={18} color={colors.accent} /><Text style={{ color: colors.accent, fontWeight: '700' }}>{editing ? 'Cancel' : 'Edit'}</Text></Pressable></View>
        <Text style={[styles.section, { color: colors.text }]}>{editing ? 'Edit details' : 'Vendor details'}</Text>
        {editing ? <>
          {editable.map(key => <View key={key} style={styles.field}><Text style={[styles.label, { color: colors.muted }]}>{labels[key]}{key === 'name' ? ' *' : ''}</Text><TextInput accessibilityLabel={labels[key]} value={form[key]} onChangeText={text => setForm(previous => ({ ...previous, [key]: text }))} multiline={key === 'notes' || key === 'description'} autoCapitalize={key === 'email' ? 'none' : 'sentences'} keyboardType={key === 'email' ? 'email-address' : key === 'phone' || key === 'alternatePhone' ? 'phone-pad' : 'default'} style={[styles.input, (key === 'notes' || key === 'description') && styles.multiline, { color: colors.text, backgroundColor: colors.surface, borderColor: colors.border }]} /></View>)}
          {!!saveError && <Text accessibilityRole="alert" style={styles.error}>{saveError}</Text>}
          <Pressable accessibilityRole="button" disabled={saving} onPress={() => { void save(); }} style={[styles.save, { backgroundColor: colors.accent }]}>{saving ? <ActivityIndicator color={background} /> : <Text style={{ color: background, fontWeight: '700' }}>Save changes</Text>}</Pressable>
        </> : <>
          {editable.map(key => <View key={key} style={[styles.detailRow, { borderBottomColor: colors.border }]}><Text style={[styles.label, { color: colors.muted }]}>{labels[key]}</Text><Text style={[styles.detailValue, { color: colors.text }]}>{value(vendor, key) || 'Not provided'}</Text></View>)}
          {([['Status', boolean(vendor, 'isActive') ? 'Active' : 'Inactive'], ['Ready for assignment', boolean(vendor, 'isReadyForAssignment') ? 'Yes' : 'No'], ['1099 required', boolean(vendor, 'requires1099') ? 'Yes' : 'No'], ['Maintenance requests', String(vendor.maintenanceRequestCount ?? 0)], ['Expenses', String(vendor.expenseCount ?? 0)], ['Total expenses', `$${Number(vendor.totalExpenseAmount ?? 0).toFixed(2)}`], ['Added', date(value(vendor, 'createdAt'))], ['Updated', date(value(vendor, 'updatedAt'))]] as const).map(([label, display]) => <View key={label} style={[styles.detailRow, { borderBottomColor: colors.border }]}><Text style={[styles.label, { color: colors.muted }]}>{label}</Text><Text style={[styles.detailValue, { color: colors.text }]}>{display}</Text></View>)}
        </>}
        <Text accessibilityRole="header" style={[styles.section, styles.workHeader, { color: colors.text }]}>Recent work</Text>
        {workLoading ? <ActivityIndicator color={colors.accent} /> : workError ? <View><Text style={{ color: colors.muted }}>{workError}</Text><Pressable onPress={() => setReload(n => n + 1)} style={styles.action}><Text style={{ color: colors.accent }}>Retry</Text></Pressable></View> : work.length === 0 ? <Text style={{ color: colors.muted }}>No maintenance assignments recorded for this vendor.</Text> : work.map(item => {
          const reassigned = boolean(item as unknown as Record<string, unknown>, 'wasReassigned');
          const current = boolean(item as unknown as Record<string, unknown>, 'isCurrentAssignment');
          const assignmentLabel = reassigned ? 'Reassigned' : current ? (item.status ?? (item as any).Status) : 'No longer assigned';
          const requestId = String(item.id ?? (item as any).Id);
          return <Pressable key={requestId} accessibilityRole="button" accessibilityLabel={`View maintenance ${item.title}${reassigned ? ', reassigned' : ''}`} onPress={() => navigation.navigate('VendorMaintenanceDetail', { requestId })} style={[styles.workRow, { borderColor: colors.border, backgroundColor: colors.surface }]}><View style={styles.workTop}><Text style={[styles.workTitle, { color: colors.text }]}>{item.title ?? (item as any).Title}</Text><Text style={[styles.badge, { color: reassigned ? colors.muted : colors.accent }]}>{assignmentLabel}</Text></View><Text style={{ color: colors.muted }}>{[item.propertyName ?? (item as any).PropertyName, item.unitName ?? (item as any).UnitName].filter(Boolean).join(' · ')}</Text><Text style={{ color: colors.muted, marginTop: 5 }}>Assigned {date(item.assignedAt ?? (item as any).AssignedAt ?? item.createdAt)}{reassigned ? ' · No longer assigned' : ''}</Text></Pressable>;
        })}
      </>}
    </ScrollView>
  </KeyboardAvoidingView>;
}

const styles = StyleSheet.create({
  container: { flex: 1 }, content: { paddingHorizontal: 22, paddingTop: 24, paddingBottom: 48 }, center: { alignItems: 'center', padding: 24, gap: 12 }, heading: { flexDirection: 'row', alignItems: 'flex-start', gap: 12, marginBottom: 26 }, headingText: { flex: 1 }, title: { fontSize: 28, lineHeight: 36, fontWeight: '800', marginBottom: 4 }, edit: { minHeight: 44, paddingHorizontal: 12, flexDirection: 'row', alignItems: 'center', gap: 5, borderWidth: 1, borderRadius: 10 }, section: { fontSize: 20, fontWeight: '800', marginBottom: 14 }, workHeader: { marginTop: 28 }, detailRow: { paddingVertical: 13, borderBottomWidth: 1 }, label: { fontSize: 13, fontWeight: '700', marginBottom: 5 }, detailValue: { fontSize: 16 }, field: { marginBottom: 16 }, input: { minHeight: 48, borderWidth: 1, borderRadius: 10, paddingHorizontal: 12, fontSize: 16 }, multiline: { minHeight: 88, paddingTop: 12, textAlignVertical: 'top' }, error: { color: '#bc3131', marginBottom: 12 }, save: { minHeight: 48, alignItems: 'center', justifyContent: 'center', borderRadius: 10 }, action: { minHeight: 44, justifyContent: 'center' }, workRow: { borderWidth: 1, borderRadius: 12, padding: 14, marginBottom: 10, minHeight: 88 }, workTop: { flexDirection: 'row', alignItems: 'flex-start', gap: 8, marginBottom: 6 }, workTitle: { flex: 1, fontSize: 16, fontWeight: '700' }, badge: { fontSize: 12, fontWeight: '700' },
});
