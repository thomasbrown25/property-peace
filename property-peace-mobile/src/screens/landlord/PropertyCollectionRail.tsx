import React from 'react';
import { Ionicons } from '@expo/vector-icons';
import { RefreshControl, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import type { Property } from '../../api/propertyAPI';
import type { PropertyCollection } from '../../features/rentCollection/propertyCollection';
import { dashboardPropertiesWithExpectedRent } from '../../features/properties/dashboardPropertyOrder';
import { useAppTheme } from '../../theme/AppTheme';

const money = (value: number) => new Intl.NumberFormat('en-US', {
  style: 'currency', currency: 'USD', maximumFractionDigits: 0,
}).format(value);

type Props = {
  properties: Property[];
  collections: Map<string, PropertyCollection> | null;
  status: 'loading' | 'success' | 'error';
  onProperty: (id: string) => void;
  onRetry: () => void;
};

export default function PropertyCollectionRail({ properties, collections, status, onProperty, onRetry }: Props) {
  const { mode, colors } = useAppTheme();
  const dark = mode === 'dark';
  const active = dashboardPropertiesWithExpectedRent(properties.filter(p => p.isActive !== false && p.IsActive !== false && String(p.id ?? p.Id ?? '')), collections);
  const ink = dark ? colors.text : '#061e35';
  const muted = dark ? colors.muted : '#657685';
  const accent = dark ? '#75d995' : '#2f8f46';
  return (
    <View style={[styles.shell, { borderColor: colors.border }]}>
      <View style={styles.collection}>
        <ScrollView nestedScrollEnabled showsVerticalScrollIndicator accessibilityLabel="Property rent collection cards" style={styles.list} contentContainerStyle={styles.listContent} refreshControl={<RefreshControl refreshing={status === 'loading'} onRefresh={onRetry} tintColor={accent} />}>
          {status === 'loading' ? <Text style={[styles.placeholder, { color: muted }]}>Loading properties…</Text>
            : status === 'error' || !collections ? <TouchableOpacity onPress={onRetry} accessibilityRole="button"><Text style={[styles.placeholder, { color: muted }]}>Rent data unavailable. Tap to retry.</Text></TouchableOpacity>
            : active.length === 0 ? <Text style={[styles.placeholder, { color: muted }]}>No rent expected from active properties this month.</Text>
            : active.map(property => {
              const id = String(property.id ?? property.Id);
              const item = collections.get(id)!;
              const { expected, collected } = item;
              const pct = Math.min(100, Math.max(0, Math.round(collected / expected * 100)));
              const name = property.name || property.Name || property.streetAddress || property.StreetAddress || 'Unnamed property';
              return <TouchableOpacity key={id} style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]} onPress={() => onProperty(id)} accessibilityRole="button" accessibilityLabel={`${name}, ${money(collected)} collected of ${money(expected)} expected this month. View property`}>
                <View style={styles.heading}>
                  <Text style={[styles.name, { color: ink }]} numberOfLines={2}>{name}</Text>
                  <View style={[styles.chevron, { backgroundColor: dark ? '#22392d' : '#edf5ef' }]}><Ionicons name="chevron-forward" size={17} color={accent} /></View>
                </View>
                <Text style={[styles.amount, { color: ink }]} adjustsFontSizeToFit numberOfLines={1}>{money(collected)}</Text>
                <Text style={[styles.caption, { color: muted }]}>of {money(expected)} expected</Text>
                <View style={styles.progressHeader}>
                  <Text style={[styles.progressLabel, { color: muted }]}>Collected this month</Text>
                  <Text style={[styles.percent, { color: accent }]}>{pct}%</Text>
                </View>
                <View style={[styles.progressTrack, { backgroundColor: dark ? '#355044' : '#dcece1' }]} accessibilityRole="progressbar" accessibilityLabel={`${name} rent collected`} accessibilityValue={{ min: 0, max: 100, now: pct }}>
                  <View style={[styles.progressFill, { width: `${pct}%`, backgroundColor: accent }]} />
                </View>
                {!!item.overdue && <Text style={[styles.overdue, { color: dark ? '#ffab99' : '#a34531' }]}>{money(item.overdue)} overdue</Text>}
              </TouchableOpacity>;
            })}
        </ScrollView>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  shell: { flex: 1, minHeight: 0, borderTopWidth: 1, borderBottomWidth: 1 },
  collection: { flex: 1, minHeight: 0, paddingHorizontal: 16, paddingTop: 13 },
  list: { flex: 1 },
  listContent: { paddingBottom: 16, gap: 10 },
  card: { padding: 15, borderWidth: 1, borderRadius: 15 },
  heading: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12 },
  name: { flex: 1, fontSize: 15, lineHeight: 20, fontWeight: '800' },
  chevron: { width: 29, height: 29, borderRadius: 15, alignItems: 'center', justifyContent: 'center' },
  amount: { fontSize: 25, lineHeight: 30, fontWeight: '900', marginTop: 8, letterSpacing: -0.7 },
  caption: { fontSize: 12, lineHeight: 17 },
  progressHeader: { marginTop: 19, marginBottom: 8, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  progressLabel: { fontSize: 12, fontWeight: '600' },
  percent: { fontSize: 13, fontWeight: '800' },
  progressTrack: { height: 8, borderRadius: 4, overflow: 'hidden' },
  progressFill: { height: '100%', borderRadius: 4 },
  overdue: { fontSize: 12, marginTop: 13, fontWeight: '700' },
  placeholder: { fontSize: 12, lineHeight: 18, paddingVertical: 12 },
});
