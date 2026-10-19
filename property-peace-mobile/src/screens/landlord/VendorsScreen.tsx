import React, { useCallback, useMemo, useState } from 'react';
import { ActivityIndicator, FlatList, KeyboardAvoidingView, Modal, Platform, Pressable, RefreshControl, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import type { VendorsStackParamList } from '../../navigation/types';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import LandlordPageHeader from '../../components/LandlordPageHeader';
import VendorAPI, { type Vendor, type VendorInput } from '../../api/vendorAPI';
import { useAppTheme } from '../../theme/AppTheme';
import { emptyVendorForm, vendorCreatePayload, vendorFormError, type VendorCreateForm } from '../../features/vendors/vendorForm';

const field = (vendor: Vendor, key: string): string => String(vendor[key] ?? vendor[key[0].toUpperCase() + key.slice(1)] ?? '');
const active = (vendor: Vendor): boolean => (vendor.isActive ?? vendor.IsActive) === true;
const createFields = ['name', 'businessName', 'category', 'description', 'specialties', 'email', 'phone', 'alternatePhone', 'address', 'city', 'state', 'zipCode', 'taxId', 'licenseNumber', 'notes'] as const;
const labels: Record<typeof createFields[number], string> = { name: 'Name *', businessName: 'Business name', category: 'Category / trade', description: 'Description', specialties: 'Specialties', email: 'Email', phone: 'Phone', alternatePhone: 'Alternate phone', address: 'Address', city: 'City', state: 'State', zipCode: 'ZIP code', taxId: 'Tax ID (EIN/SSN)', licenseNumber: 'License number', notes: 'Notes' };

export default function VendorsScreen() {
  const navigation = useNavigation<NativeStackNavigationProp<VendorsStackParamList>>();
  const { colors, mode } = useAppTheme();
  const insets = useSafeAreaInsets();
  const [vendors, setVendors] = useState<Vendor[]>([]);
  const [query, setQuery] = useState('');
  const [showInactive, setShowInactive] = useState(false);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState('');
  const [formOpen, setFormOpen] = useState(false);
  const [form, setForm] = useState<VendorCreateForm>({ ...emptyVendorForm });
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState('');

  useFocusEffect(useCallback(() => {
    let current = true;
    setLoading(true);
    setError('');
    VendorAPI.getVendors().then(data => { if (current) setVendors(data); })
      .catch(() => { if (current) { setVendors([]); setError('Could not load vendors. Try again.'); } })
      .finally(() => { if (current) setLoading(false); });
    return () => { current = false; };
  }, []));

  const refresh = async () => {
    setRefreshing(true);
    try {
      setVendors(await VendorAPI.getVendors());
      setError('');
    } catch {
      setVendors([]);
      setError('Could not load vendors. Try again.');
    } finally {
      setRefreshing(false);
      setLoading(false);
    }
  };

  const filtered = useMemo(() => vendors.filter(vendor => {
    if (!showInactive && !active(vendor)) return false;
    const text = [field(vendor, 'name'), field(vendor, 'businessName'), field(vendor, 'category'), field(vendor, 'email'), field(vendor, 'phone')].join(' ').toLowerCase();
    return text.includes(query.trim().toLowerCase());
  }), [vendors, query, showInactive]);
  const activeCount = useMemo(() => vendors.filter(active).length, [vendors]);

  const openForm = () => {
    setForm({ ...emptyVendorForm });
    setFormError('');
    setFormOpen(true);
  };
  const closeForm = () => {
    if (saving) return;
    setFormOpen(false);
    setForm({ ...emptyVendorForm });
  };

  const save = async () => {
    if (saving) return;
    const invalid = vendorFormError(form);
    if (invalid) { setFormError(invalid); return; }
    const input: VendorInput = vendorCreatePayload(form);
    setSaving(true);
    setFormError('');
    try {
      await VendorAPI.addVendor(input);
      await refresh();
      setFormOpen(false);
      setForm({ ...emptyVendorForm });
    } catch {
      setFormError('Could not save vendor. Check your connection and try again.');
    } finally {
      setSaving(false);
    }
  };

  const bg = mode === 'dark' ? colors.background : '#fff';
  const inputStyle = [styles.input, { backgroundColor: colors.surface, color: colors.text, borderColor: colors.border }];
  return (
    <View style={[styles.container, { backgroundColor: bg }]}>
      <LandlordPageHeader title="Vendors" />
      {loading ? <View style={styles.center}><ActivityIndicator color={colors.accent} /></View> : error ? <View style={styles.center}><Text style={[styles.message, { color: colors.text }]}>{error}</Text><Pressable accessibilityRole="button" onPress={() => { void refresh(); }} style={styles.retry}><Text style={{ color: colors.accent, fontWeight: '700' }}>Retry</Text></Pressable></View> :
        <FlatList data={filtered} keyExtractor={(item, index) => field(item, 'id') || String(index)} contentContainerStyle={styles.list}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { void refresh(); }} tintColor={colors.accent} />}
          ListHeaderComponent={<View>
            <View style={[styles.overview, { borderBottomColor: colors.border }]}>
              <Text style={[styles.overviewEyebrow, { color: mode === 'dark' ? '#75d995' : '#2f8f46' }]}>VENDOR OVERVIEW</Text>
              <View style={styles.overviewRow}>
                <View><Text style={[styles.overviewValue, { color: colors.text }]}>{activeCount}</Text><Text style={[styles.overviewLabel, { color: colors.muted }]}>Active vendors</Text></View>
                <Pressable accessibilityRole="button" accessibilityLabel="Add vendor" onPress={openForm} style={[styles.add, { backgroundColor: colors.accent }]}><Ionicons name="add" size={18} color={mode === 'dark' ? colors.background : '#fff'} /><Text style={[styles.addText, { color: mode === 'dark' ? colors.background : '#fff' }]}>Add vendor</Text></Pressable>
              </View>
            </View>
            <View style={[styles.search, mode === 'dark' ? { backgroundColor: colors.surface, borderColor: colors.border, borderWidth: 1 } : { backgroundColor: '#f1f5f9' }]}>
              <Ionicons name="search" size={19} color={mode === 'dark' ? colors.muted : '#64748b'} />
              <TextInput accessibilityLabel="Search vendors" placeholder="Search name, trade, or contact" placeholderTextColor={mode === 'dark' ? colors.muted : '#94a3b8'} value={query} onChangeText={setQuery} style={[styles.searchInput, { color: colors.text }]} returnKeyType="search" />
              {!!query && <Pressable accessibilityRole="button" accessibilityLabel="Clear search" onPress={() => setQuery('')}><Ionicons name="close-circle" size={20} color={colors.muted} /></Pressable>}
            </View>
            <Pressable accessibilityRole="button" accessibilityState={{ selected: showInactive }} onPress={() => setShowInactive(value => !value)} style={styles.filter}><Ionicons name={showInactive ? 'checkbox' : 'square-outline'} size={22} color={colors.accent} /><Text style={{ color: colors.text }}>Show inactive vendors</Text></Pressable>
            <Text accessibilityRole="header" style={[styles.section, { color: colors.text }]}>{showInactive ? 'All vendors' : 'Active vendors'} <Text style={{ color: colors.muted, fontSize: 14 }}>{filtered.length}</Text></Text>
          </View>}
          ListEmptyComponent={<View style={styles.empty}><Ionicons name="construct-outline" size={34} color={colors.accent} /><Text style={[styles.message, { color: colors.text }]}>{query.trim() ? 'No matching vendors' : showInactive ? 'No vendors yet' : 'No active vendors yet'}</Text><Text style={[styles.hint, { color: colors.muted }]}>{query.trim() ? 'Try a different search.' : 'Add a vendor to start your directory.'}</Text></View>}
          ItemSeparatorComponent={() => <View style={{ height: 1, backgroundColor: colors.border }} />}
          renderItem={({ item }) => {
            const name = field(item, 'name') || 'Unnamed vendor';
            const business = field(item, 'businessName');
            const category = field(item, 'category');
            return <Pressable accessibilityRole="button" accessibilityLabel={`View ${name}`} onPress={() => navigation.navigate('VendorDetail', { vendorId: field(item, 'id') })} style={styles.row}>
              <View style={[styles.avatar, { backgroundColor: mode === 'dark' ? '#233c56' : '#eaf3ff' }]}><Text style={[styles.initial, { color: colors.accent }]}>{(business || name).charAt(0).toUpperCase()}</Text></View>
              <View style={styles.rowCopy}><Text style={[styles.rowTitle, { color: colors.text }]}>{name}</Text><Text style={[styles.meta, { color: colors.muted }]}>{[business, category].filter(Boolean).join(' · ') || 'Category not set'}</Text>{!!(field(item, 'phone') || field(item, 'email')) && <Text numberOfLines={1} style={[styles.meta, { color: colors.muted }]}>{field(item, 'phone') || field(item, 'email')}</Text>}{!active(item) && <Text style={[styles.meta, { color: colors.muted }]}>Inactive</Text>}</View>
              <Ionicons name="chevron-forward" size={19} color={colors.muted} />
            </Pressable>;
          }} />}
      <Modal visible={formOpen} animationType="slide" presentationStyle="pageSheet" onRequestClose={closeForm}>
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={[styles.container, { backgroundColor: bg }]}>
          <View style={[styles.modalHeader, { paddingTop: Math.max(insets.top, 16) }]}><Text accessibilityRole="header" style={[styles.modalTitle, { color: colors.text }]}>Add vendor</Text><Pressable accessibilityRole="button" accessibilityLabel="Close vendor form" disabled={saving} onPress={closeForm} style={styles.close}><Ionicons name="close" size={24} color={colors.text} /></Pressable></View>
          <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={styles.formScroll}>
            {createFields.map(key => <View key={key} style={styles.field}><Text style={[styles.label, { color: colors.text }]}>{labels[key]}</Text><TextInput accessibilityLabel={labels[key]} value={form[key]} onChangeText={value => setForm(previous => ({ ...previous, [key]: value }))} style={[inputStyle, (key === 'notes' || key === 'description') && styles.notes]} multiline={key === 'notes' || key === 'description'} secureTextEntry={key === 'taxId'} keyboardType={key === 'email' ? 'email-address' : key === 'phone' || key === 'alternatePhone' ? 'phone-pad' : 'default'} autoCapitalize={key === 'email' || key === 'taxId' ? 'none' : 'sentences'} /></View>)}
            <Pressable accessibilityRole="checkbox" accessibilityState={{ checked: form.requires1099 }} accessibilityLabel="Requires 1099" onPress={() => setForm(previous => ({ ...previous, requires1099: !previous.requires1099 }))} style={styles.filter}><Ionicons name={form.requires1099 ? 'checkbox' : 'square-outline'} size={22} color={colors.accent} /><Text style={{ color: colors.text }}>Requires 1099</Text></Pressable>
            {!!formError && <Text accessibilityRole="alert" style={styles.error}>{formError}</Text>}
            <Pressable accessibilityRole="button" accessibilityLabel="Save vendor" disabled={saving} onPress={() => { void save(); }} style={[styles.save, { backgroundColor: colors.accent }]}>{saving ? <ActivityIndicator color={bg} /> : <Text style={[styles.saveText, { color: bg }]}>Save vendor</Text>}</Pressable>
          </ScrollView>
        </KeyboardAvoidingView>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  overview: { marginBottom: 20, paddingTop: 8, paddingBottom: 20, borderBottomWidth: StyleSheet.hairlineWidth },
  overviewEyebrow: { fontSize: 11, fontWeight: '800', letterSpacing: 1.2, marginBottom: 12 },
  overviewRow: { flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'space-between', gap: 12 },
  overviewValue: { fontSize: 34, lineHeight: 39, fontWeight: '800' },
  overviewLabel: { fontSize: 13, marginTop: 1 },
  add: { minHeight: 44, paddingHorizontal: 12, borderRadius: 10, flexDirection: 'row', gap: 6, alignItems: 'center', justifyContent: 'center' }, addText: { fontSize: 12, fontWeight: '800' },
  search: { borderRadius: 10, minHeight: 46, flexDirection: 'row', alignItems: 'center', paddingHorizontal: 13, gap: 9 }, searchInput: { flex: 1, fontSize: 15, paddingVertical: 10 }, filter: { minHeight: 48, alignSelf: 'flex-start', flexDirection: 'row', alignItems: 'center', gap: 8 },
  list: { paddingHorizontal: 20, paddingTop: 8, paddingBottom: 28, flexGrow: 1 }, section: { fontSize: 20, fontWeight: '800', marginBottom: 12 }, row: { minHeight: 84, flexDirection: 'row', alignItems: 'center', gap: 14, paddingVertical: 14 }, avatar: { width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center' }, initial: { fontSize: 18, fontWeight: '700' }, rowCopy: { flex: 1, minWidth: 0 }, rowTitle: { fontSize: 16, fontWeight: '700' }, meta: { fontSize: 13, marginTop: 3 }, center: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24 }, empty: { alignItems: 'center', paddingVertical: 48 }, message: { fontSize: 18, fontWeight: '700', marginTop: 12, textAlign: 'center' }, hint: { fontSize: 14, marginTop: 8, textAlign: 'center' }, retry: { minHeight: 44, justifyContent: 'center' },
  modalHeader: { paddingHorizontal: 22, paddingBottom: 18, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }, modalTitle: { fontSize: 26, fontWeight: '800' }, close: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' }, formScroll: { paddingHorizontal: 22, paddingBottom: 48 }, field: { marginBottom: 16 }, label: { fontSize: 14, fontWeight: '700', marginBottom: 7 }, detailRow: { borderTopWidth: 1, paddingVertical: 14 }, detailValue: { fontSize: 16 }, input: { minHeight: 48, borderWidth: 1, borderRadius: 10, paddingHorizontal: 12, fontSize: 16 }, notes: { minHeight: 90, textAlignVertical: 'top', paddingTop: 12 }, error: { color: '#bc3131', marginBottom: 14 }, save: { minHeight: 48, borderRadius: 10, alignItems: 'center', justifyContent: 'center' }, saveText: { fontSize: 16, fontWeight: '700' },
});
