import React from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Switch, Text, TextInput, View } from 'react-native';
import { useAppTheme } from '../../theme/AppTheme';

export function FormText({ title, value, onChange, number = false, multiline = false }: { title: string; value: string; onChange: (value: string) => void; number?: boolean; multiline?: boolean }) {
  const { colors } = useAppTheme();
  return <View style={styles.field}><Text style={[styles.label, { color: colors.text }]}>{title}</Text><TextInput accessibilityLabel={title} value={value} onChangeText={onChange} keyboardType={number ? 'decimal-pad' : title.toLowerCase().includes('email') ? 'email-address' : 'default'} autoCapitalize={title.toLowerCase().includes('email') || title.toLowerCase().includes('url') ? 'none' : 'sentences'} multiline={multiline} placeholder={title.includes('date') || title.includes('Date') ? 'YYYY-MM-DD' : undefined} placeholderTextColor={colors.muted} style={[styles.input, multiline && { minHeight: 90, textAlignVertical: 'top' }, { color: colors.text, borderColor: colors.border, backgroundColor: colors.surface }]} /></View>;
}
export function FormSwitch({ title, value, onChange }: { title: string; value: boolean; onChange: (value: boolean) => void }) {
  const { colors } = useAppTheme();
  return <View style={styles.switchRow}><Text style={[styles.label, { color: colors.text, flex: 1 }]}>{title}</Text><Switch accessibilityLabel={title} value={value} onValueChange={onChange} trackColor={{ true: colors.accent }} /></View>;
}
export function FormAction({ label, busy, onPress }: { label: string; busy: boolean; onPress: () => void }) {
  const { colors, mode } = useAppTheme();
  return <Pressable accessibilityRole="button" accessibilityLabel={label} accessibilityState={{ disabled: busy }} disabled={busy} onPress={onPress} style={[styles.action, { backgroundColor: colors.accent, opacity: busy ? 0.5 : 1 }]}>{busy ? <ActivityIndicator color="#fff" /> : <Text style={{ color: mode === 'dark' ? colors.background : '#fff', fontWeight: '800' }}>{label}</Text>}</Pressable>;
}
export const formTitle = (key: string): string => key.replace(/([a-z])([A-Z])/g, '$1 $2').replace(/^./, char => char.toUpperCase());
const styles = StyleSheet.create({ field: { marginTop: 14 }, label: { fontSize: 15, fontWeight: '600', marginBottom: 6 }, input: { minHeight: 48, borderWidth: 1, borderRadius: 9, paddingHorizontal: 12, paddingVertical: 10, fontSize: 15 }, switchRow: { minHeight: 52, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12 }, action: { minHeight: 50, borderRadius: 10, alignItems: 'center', justifyContent: 'center', marginTop: 24, marginBottom: 30 } });
