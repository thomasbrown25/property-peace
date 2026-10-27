import React, { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Alert, Modal, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import PropertyAPI, { type Property, type Unit } from '../../api/propertyAPI';
import apiClient from '../../services/apiClient';
import { useAppTheme } from '../../theme/AppTheme';

const idOf = (value: { id?: string | number; Id?: string | number }) => value.id ?? value.Id;
const nameOf = (value: { name?: string; Name?: string }) => value.name ?? value.Name ?? '';

export default function ApplicationInviteModal({ visible, scope, onClose, onSent }: { visible: boolean; scope: string; onClose: () => void; onSent: () => void }) {
  const { colors, mode } = useAppTheme();
  const insets = useSafeAreaInsets();
  const [properties, setProperties] = useState<Property[]>([]);
  const [units, setUnits] = useState<Unit[]>([]);
  const [propertyId, setPropertyId] = useState<string | number | null>(null);
  const [unitId, setUnitId] = useState<string | number | null>(null);
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [unitsLoading, setUnitsLoading] = useState(false);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState('');
  const generation = useRef(0);
  const sendingRef = useRef(false);

  useEffect(() => {
    const request = ++generation.current;
    if (!visible || !scope) return;
    setProperties([]);
    setPropertyId(null);
    setUnitId(null);
    setUnits([]);
    setEmail('');
    setError('');
    setLoading(true);
    PropertyAPI.getProperties().then(result => {
      if (request !== generation.current) return;
      if (!Array.isArray(result)) throw new Error('Invalid properties');
      setProperties(result);
    }).catch(() => { if (request === generation.current) setError('Could not load properties. Close and try again.'); })
      .finally(() => { if (request === generation.current) setLoading(false); });
    return () => { generation.current++; };
  }, [visible, scope]);

  const selectedProperty = properties.find(item => String(idOf(item)) === String(propertyId));
  const multiUnit = String(selectedProperty?.propertyType ?? selectedProperty?.PropertyType ?? '').toLowerCase() === 'multiunit';
  const selectProperty = (item: Property) => {
    const id = idOf(item);
    if (id == null) return;
    setPropertyId(id);
    setUnitId(null);
    setUnits([]);
    setError('');
    const request = ++generation.current;
    setUnitsLoading(true);
    PropertyAPI.getUnits(id).then(result => {
      if (request !== generation.current) return;
      if (!Array.isArray(result)) throw new Error('Invalid units');
      setUnits(result);
    }).catch(() => { if (request === generation.current) setError('Could not load units. Select the property again.'); })
      .finally(() => { if (request === generation.current) setUnitsLoading(false); });
  };
  const submit = async () => {
    if (sendingRef.current || !scope) return;
    const address = email.trim();
    if (!propertyId || (multiUnit && !unitId) || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(address) || unitsLoading || !!error) {
      setError('Choose a property and unit (if applicable), then enter a valid email.');
      return;
    }
    sendingRef.current = true;
    setSending(true);
    setError('');
    const request = generation.current;
    try {
      const response = await apiClient.post<{ success: boolean; message?: string }>('/api/ApplicationInvite', {
        propertyId: Number(propertyId), unitId: unitId == null ? null : Number(unitId), email: address,
      });
      if (request !== generation.current) return;
      if (!response?.success) throw new Error(response?.message || 'Could not send invitation.');
      onClose();
      onSent();
      Alert.alert('Invitation sent', `An application invitation was sent to ${address}.`);
    } catch (reason) {
      if (request === generation.current) setError(reason instanceof Error ? reason.message : 'Could not send invitation. Try again.');
    } finally {
      sendingRef.current = false;
      if (request === generation.current) setSending(false);
    }
  };
  const foreground = mode === 'dark' ? colors.background : '#fff';
  return <Modal visible={visible && !!scope} animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose}>
    <View style={[styles.page, { backgroundColor: colors.background, paddingTop: Math.max(insets.top, 20) }]}>
      <View style={styles.top}><Text accessibilityRole="header" style={[styles.title, { color: colors.text }]}>New application</Text><Pressable accessibilityRole="button" accessibilityLabel="Close new application" onPress={onClose} style={styles.close}><Ionicons name="close" size={24} color={colors.text} /></Pressable></View>
      <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={styles.content}>
        <Text style={[styles.copy, { color: colors.muted }]}>Invite an applicant to complete an application for your property.</Text>
        <Text style={[styles.label, { color: colors.text }]}>Property</Text>
        {loading ? <ActivityIndicator color={colors.accent} /> : properties.length === 0 && !error ? <Text style={{ color: colors.muted }}>No properties available.</Text> : properties.map(item => {
          const id = idOf(item);
          if (id == null) return null;
          const selected = String(id) === String(propertyId);
          return <Pressable key={String(id)} accessibilityRole="radio" accessibilityState={{ checked: selected }} onPress={() => selectProperty(item)} style={[styles.choice, { borderColor: selected ? colors.accent : colors.border, backgroundColor: colors.surface }]}><Text style={[styles.choiceText, { color: colors.text }]}>{nameOf(item) || item.address || item.streetAddress || `Property ${id}`}</Text>{selected && <Ionicons name="checkmark" size={20} color={colors.accent} />}</Pressable>;
        })}
        {multiUnit && <><Text style={[styles.label, { color: colors.text }]}>Unit</Text>{unitsLoading ? <ActivityIndicator color={colors.accent} /> : units.map(item => {
          const id = idOf(item);
          if (id == null) return null;
          const selected = String(id) === String(unitId);
          return <Pressable key={String(id)} accessibilityRole="radio" accessibilityState={{ checked: selected }} onPress={() => { setUnitId(id); setError(''); }} style={[styles.choice, { borderColor: selected ? colors.accent : colors.border, backgroundColor: colors.surface }]}><Text style={[styles.choiceText, { color: colors.text }]}>{nameOf(item) || `Unit ${id}`}</Text>{selected && <Ionicons name="checkmark" size={20} color={colors.accent} />}</Pressable>;
        })}</>}
        <Text style={[styles.label, { color: colors.text }]}>Applicant email</Text>
        <TextInput accessibilityLabel="Applicant email" value={email} onChangeText={text => { setEmail(text); setError(''); }} keyboardType="email-address" autoCapitalize="none" autoComplete="email" placeholder="name@example.com" placeholderTextColor={colors.muted} style={[styles.input, { color: colors.text, backgroundColor: colors.surface, borderColor: colors.border }]} />
        {!!error && <Text accessibilityRole="alert" style={styles.error}>{error}</Text>}
        <Pressable accessibilityRole="button" accessibilityLabel="Send application invitation" accessibilityState={{ disabled: sending || loading || unitsLoading }} disabled={sending || loading || unitsLoading} onPress={() => { void submit(); }} style={[styles.submit, { backgroundColor: colors.accent, opacity: sending || loading || unitsLoading ? 0.5 : 1 }]}>{sending ? <ActivityIndicator color={foreground} /> : <Text style={[styles.submitText, { color: foreground }]}>Send invitation</Text>}</Pressable>
      </ScrollView>
    </View>
  </Modal>;
}

const styles = StyleSheet.create({
  page: { flex: 1 }, top: { paddingHorizontal: 22, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }, title: { fontSize: 24, fontWeight: '800' }, close: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
  content: { padding: 22, paddingBottom: 50 }, copy: { fontSize: 15, lineHeight: 22, marginBottom: 20 }, label: { fontSize: 15, fontWeight: '700', marginTop: 20, marginBottom: 10 }, choice: { minHeight: 48, borderWidth: 1, borderRadius: 10, paddingHorizontal: 14, paddingVertical: 12, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }, choiceText: { fontSize: 15, flex: 1 }, input: { minHeight: 48, borderWidth: 1, borderRadius: 10, paddingHorizontal: 14, fontSize: 15 }, error: { color: '#b93535', fontSize: 14, marginTop: 16 }, submit: { minHeight: 48, borderRadius: 10, alignItems: 'center', justifyContent: 'center', marginTop: 24 }, submitText: { fontSize: 16, fontWeight: '800' },
});
