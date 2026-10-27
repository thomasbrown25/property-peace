import React, { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Modal, Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import DateTimePicker from '@react-native-community/datetimepicker';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import apiClient from '../../services/apiClient';
import { useAppTheme } from '../../theme/AppTheme';

const categories = ['Task', 'Rent & payment', 'Maintenance', 'Lease'];

export default function AddCalendarTaskModal({ visible, date, onClose, onSaved }: { visible: boolean; date: Date; onClose: () => void; onSaved: () => void }) {
  const { colors } = useAppTheme();
  const insets = useSafeAreaInsets();
  const [title, setTitle] = useState('');
  const [dueDate, setDueDate] = useState(() => new Date());
  const [category, setCategory] = useState(0);
  const [picker, setPicker] = useState<'date' | 'time' | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const savingRef = useRef(false);

  useEffect(() => {
    if (!visible) return;
    setTitle(''); setCategory(0); setError(''); setPicker(null);
    const now = new Date();
    setDueDate(new Date(date.getFullYear(), date.getMonth(), date.getDate(), now.getHours(), now.getMinutes()));
  }, [visible]);

  const save = async () => {
    if (savingRef.current) return;
    const cleanTitle = title.trim();
    if (!cleanTitle) { setError('Enter a task title.'); return; }
    savingRef.current = true;
    setSaving(true); setError('');
    try {
      await apiClient.post('/api/task', { title: cleanTitle, dueDate: dueDate.toISOString(), category });
      onSaved();
    } catch (cause: any) {
      setError(cause?.response?.data?.message || 'Could not add the task. Please try again.');
    } finally {
      savingRef.current = false;
      setSaving(false);
    }
  };

  return <Modal visible={visible} animationType="slide" presentationStyle="pageSheet" onRequestClose={() => { if (!savingRef.current) onClose(); }}>
    <View style={[styles.root, { backgroundColor: colors.background, paddingTop: Math.max(insets.top, 16) }]}>
      <View style={styles.header}>
        <Text style={[styles.heading, { color: colors.text }]}>Add task</Text>
        <Pressable accessibilityRole="button" accessibilityLabel="Close add task" disabled={saving} onPress={onClose} style={styles.close}><Text style={{ color: colors.accent, fontWeight: '700' }}>Close</Text></Pressable>
      </View>
      <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={styles.content}>
        <Text style={[styles.label, { color: colors.text }]}>Task</Text>
        <TextInput accessibilityLabel="Task title" maxLength={300} placeholder="What needs to be done?" placeholderTextColor={colors.muted} value={title} onChangeText={setTitle} style={[styles.input, { backgroundColor: colors.surface, borderColor: colors.border, color: colors.text }]} />
        <Text style={[styles.label, { color: colors.text }]}>Due date and time</Text>
        <View style={styles.dateActions}>
          <Pressable accessibilityRole="button" accessibilityLabel="Choose due date" onPress={() => setPicker('date')} style={[styles.dateButton, { backgroundColor: colors.surface, borderColor: colors.border }]}><Text style={{ color: colors.text }}>{dueDate.toLocaleDateString()}</Text></Pressable>
          <Pressable accessibilityRole="button" accessibilityLabel="Choose due time" onPress={() => setPicker('time')} style={[styles.dateButton, { backgroundColor: colors.surface, borderColor: colors.border }]}><Text style={{ color: colors.text }}>{dueDate.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })}</Text></Pressable>
        </View>
        {!!picker && <DateTimePicker value={dueDate} mode={picker} display={Platform.OS === 'ios' ? 'spinner' : 'default'} onChange={(_, value) => {
          if (Platform.OS !== 'ios') setPicker(null);
          if (!value) return;
          setDueDate(current => {
            const next = new Date(current);
            if (picker === 'date') next.setFullYear(value.getFullYear(), value.getMonth(), value.getDate());
            else next.setHours(value.getHours(), value.getMinutes());
            return next;
          });
        }} />}
        {picker && Platform.OS === 'ios' && <Pressable accessibilityRole="button" accessibilityLabel="Done choosing due date or time" onPress={() => setPicker(null)} style={styles.done}><Text style={{ color: colors.accent, fontWeight: '700' }}>Done</Text></Pressable>}
        <Text style={[styles.label, { color: colors.text }]}>Category</Text>
        <View style={styles.categories}>{categories.map((name, index) => <Pressable key={name} accessibilityRole="radio" accessibilityState={{ checked: category === index }} onPress={() => setCategory(index)} style={[styles.category, { borderColor: category === index ? colors.accent : colors.border, backgroundColor: colors.surface }]}><Text style={{ color: category === index ? colors.accent : colors.text, fontWeight: '700' }}>{name}</Text></Pressable>)}</View>
        {!!error && <Text accessibilityRole="alert" style={styles.error}>{error}</Text>}
        <Pressable accessibilityRole="button" accessibilityLabel="Save task" disabled={saving} onPress={() => void save()} style={[styles.save, { backgroundColor: colors.accent, opacity: saving ? .6 : 1 }]}>{saving ? <ActivityIndicator color="#fff" /> : <Text style={styles.saveText}>Add task</Text>}</Pressable>
      </ScrollView>
    </View>
  </Modal>;
}

const styles = StyleSheet.create({
  root: { flex: 1 }, header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 20, paddingBottom: 12 }, heading: { fontSize: 24, fontWeight: '800' }, close: { minHeight: 44, justifyContent: 'center', paddingHorizontal: 8 },
  content: { paddingHorizontal: 20, paddingBottom: 60 }, label: { fontSize: 15, fontWeight: '700', marginTop: 22, marginBottom: 10 }, input: { borderWidth: 1, borderRadius: 12, minHeight: 50, paddingHorizontal: 14, fontSize: 16 },
  dateActions: { flexDirection: 'row', gap: 10 }, dateButton: { flex: 1, borderWidth: 1, borderRadius: 12, minHeight: 48, justifyContent: 'center', alignItems: 'center' }, done: { alignSelf: 'flex-end', padding: 12 },
  categories: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 }, category: { borderWidth: 1, borderRadius: 12, paddingHorizontal: 14, minHeight: 44, justifyContent: 'center' }, error: { color: '#c2413b', marginTop: 16 }, save: { minHeight: 52, borderRadius: 12, alignItems: 'center', justifyContent: 'center', marginTop: 28 }, saveText: { color: '#fff', fontWeight: '800', fontSize: 16 },
});
