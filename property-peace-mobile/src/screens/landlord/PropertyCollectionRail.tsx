import React from 'react';
import { RefreshControl, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import type { Property } from '../../api/propertyAPI';
import type { PropertyCollection } from '../../features/rentCollection/propertyCollection';
import { useAppTheme } from '../../theme/AppTheme';

const money = (value: number) => new Intl.NumberFormat('en-US', {
  style: 'currency', currency: 'USD', maximumFractionDigits: 0,
}).format(value);
const segments = [
  { left: 3, top: 57, rotate: '-74deg' }, { left: 9, top: 40, rotate: '-55deg' },
  { left: 20, top: 26, rotate: '-36deg' }, { left: 35, top: 17, rotate: '-18deg' },
  { left: 52, top: 14, rotate: '0deg' }, { left: 69, top: 17, rotate: '18deg' },
  { left: 84, top: 26, rotate: '36deg' }, { left: 95, top: 40, rotate: '55deg' },
  { left: 101, top: 57, rotate: '74deg' },
];

type Props = {
  properties: Property[];
  collections: Map<string, PropertyCollection> | null;
  status: 'loading' | 'success' | 'error';
  onProperty: (id: string) => void;
  onRent: () => void;
  onAddProperty: () => void;
  onMaintenance: () => void;
  onLeases: () => void;
  onRetry: () => void;
};

export default function PropertyCollectionRail({ properties, collections, status, onProperty, onRent, onAddProperty, onMaintenance, onLeases, onRetry }: Props) {
  const { mode, colors } = useAppTheme();
  const dark = mode === 'dark';
  const active = properties.filter(p => p.isActive !== false && p.IsActive !== false && String(p.id ?? p.Id ?? ''));
  const ink = dark ? colors.text : '#061e35';
  const muted = dark ? colors.muted : '#657685';
  const accent = dark ? '#75d995' : '#2f8f46';
  return (
    <View style={[styles.shell, { borderColor: colors.border }]}>
      <View style={[styles.left, { borderRightColor: colors.border }]}>
        <Text style={[styles.columnLabel, { color: muted }]}>PROPERTIES · RENT COLLECTED</Text>
        <ScrollView nestedScrollEnabled showsVerticalScrollIndicator accessibilityLabel="Property rent collection cards" style={styles.list} contentContainerStyle={styles.listContent} refreshControl={<RefreshControl refreshing={status === 'loading'} onRefresh={onRetry} tintColor={accent} />}>
          {status === 'loading' ? <Text style={[styles.placeholder, { color: muted }]}>Loading properties…</Text>
            : status === 'error' || !collections ? <TouchableOpacity onPress={onRetry} accessibilityRole="button"><Text style={[styles.placeholder, { color: muted }]}>Rent data unavailable. Tap to retry.</Text></TouchableOpacity>
            : active.length === 0 ? <Text style={[styles.placeholder, { color: muted }]}>No active properties yet.</Text>
            : active.map(property => {
              const id = String(property.id ?? property.Id);
              const item = collections.get(id);
              const expected = item?.expected ?? 0;
              const collected = item?.collected ?? 0;
              const pct = expected > 0 ? Math.min(100, Math.round(collected / expected * 100)) : 0;
              const name = property.name || property.Name || property.streetAddress || property.StreetAddress || 'Unnamed property';
              return <TouchableOpacity key={id} style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]} onPress={() => onProperty(id)} accessibilityRole="button" accessibilityLabel={`${name}, ${money(collected)} collected of ${money(expected)} expected this month. View property`}>
                <Text style={[styles.name, { color: ink }]} numberOfLines={2}>{name}</Text>
                <Text style={[styles.amount, { color: ink }]} adjustsFontSizeToFit numberOfLines={1}>{money(collected)}</Text>
                <Text style={[styles.caption, { color: muted }]}>of {money(expected)} expected</Text>
                {expected > 0 ? <>
                  <View style={styles.gauge} accessibilityRole="progressbar" accessibilityLabel={`${name} rent collected`} accessibilityValue={{ min: 0, max: 100, now: pct }}>
                    {segments.map((segment, index) => <View key={index} style={[styles.segment, { left: segment.left, top: segment.top, transform: [{ rotate: segment.rotate }], backgroundColor: index < Math.ceil(pct / 100 * segments.length) ? accent : dark ? '#355044' : '#dcece1' }]} />)}
                    <View style={[styles.pointer, { left: segments[Math.min(8, Math.max(0, Math.round(pct / 100 * 8)))].left + 2, top: segments[Math.min(8, Math.max(0, Math.round(pct / 100 * 8)))].top - 13, borderBottomColor: ink }]} />
                  </View>
                  <Text style={[styles.percent, { color: accent }]}>{pct}% collected</Text>
                </> : <Text style={[styles.noRent, { color: muted }]}>No rent expected this month</Text>}
                {!!item?.overdue && <Text style={[styles.overdue, { color: dark ? '#ffab99' : '#a34531' }]}>{money(item.overdue)} overdue</Text>}
              </TouchableOpacity>;
            })}
        </ScrollView>
      </View>
      <ScrollView style={styles.right} contentContainerStyle={styles.rightContent} showsVerticalScrollIndicator={false}>
        <Text style={[styles.columnLabel, { color: muted }]}>GET THINGS DONE</Text>
        <Text style={[styles.rightTitle, { color: ink }]}>Quick actions</Text>
        {([
          { label: 'Add property', icon: 'add-circle-outline', onPress: onAddProperty },
          { label: 'View rent', icon: 'wallet-outline', onPress: onRent },
          { label: 'Maintenance', icon: 'construct-outline', onPress: onMaintenance },
          { label: 'Leases', icon: 'document-text-outline', onPress: onLeases },
        ] as const).map(action => (
          <TouchableOpacity key={action.label} style={[styles.action, { borderColor: colors.border, backgroundColor: colors.surface }]} onPress={action.onPress} accessibilityRole="button" accessibilityLabel={action.label}>
            <Ionicons name={action.icon} size={19} color={dark ? colors.accent : '#2475cf'} />
            <Text style={[styles.actionText, { color: ink }]} numberOfLines={2}>{action.label}</Text>
          </TouchableOpacity>
        ))}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  shell: { flex: 1, minHeight: 0, flexDirection: 'row', borderTopWidth: 1, borderBottomWidth: 1 },
  left: { width: '50%', minHeight: 0, borderRightWidth: 1, paddingLeft: 12, paddingRight: 9, paddingTop: 13 },
  right: { width: '50%', minHeight: 0 },
  rightContent: { paddingHorizontal: 10, paddingTop: 16, paddingBottom: 12 },
  columnLabel: { fontSize: 9, lineHeight: 13, fontWeight: '800', letterSpacing: 0.5 },
  list: { flex: 1, marginTop: 10 },
  listContent: { paddingBottom: 16, gap: 10 },
  card: { padding: 11, borderWidth: 1, borderRadius: 13, minHeight: 142 },
  name: { fontSize: 14, lineHeight: 17, fontWeight: '800' },
  amount: { fontSize: 24, lineHeight: 29, fontWeight: '900', marginTop: 8, letterSpacing: -0.7 },
  caption: { fontSize: 11, lineHeight: 15 },
  gauge: { width: 114, height: 75, alignSelf: 'center', marginTop: 2, marginBottom: -4 },
  segment: { position: 'absolute', width: 12, height: 9, borderRadius: 2 },
  pointer: { position: 'absolute', top: 0, width: 0, height: 0, borderLeftWidth: 5, borderRightWidth: 5, borderBottomWidth: 7, borderLeftColor: 'transparent', borderRightColor: 'transparent', transform: [{ rotate: '180deg' }] },
  percent: { textAlign: 'center', fontSize: 11, fontWeight: '800' },
  noRent: { fontSize: 11, marginTop: 13 },
  overdue: { fontSize: 11, marginTop: 7, fontWeight: '700' },
  placeholder: { fontSize: 12, lineHeight: 18, paddingVertical: 12 },
  rightTitle: { fontSize: 18, lineHeight: 22, fontWeight: '900', marginTop: 10, marginBottom: 12 },
  action: { minHeight: 52, borderWidth: 1, borderRadius: 12, marginBottom: 10, flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 9 },
  actionText: { flex: 1, fontSize: 12, fontWeight: '800' },
});
