import React, { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import LandlordPageHeader from '../../components/LandlordPageHeader';
import { useAppTheme } from '../../theme/AppTheme';
import ListingsScreen from './ListingsScreen';
import ApplicationsScreen from './ApplicationsScreen';

type Section = 'Listings' | 'Applications';

export default function MarketingScreen() {
  const [section, setSection] = useState<Section>('Listings');
  const { colors } = useAppTheme();

  return <View style={[styles.root, { backgroundColor: colors.background }]}>
    <LandlordPageHeader title="Marketing" />
    <View accessibilityRole="tablist" style={[styles.tabs, { borderBottomColor: colors.border }]}>
      {(['Listings', 'Applications'] as const).map(name => <Pressable
        key={name}
        accessibilityRole="tab"
        accessibilityLabel={name}
        accessibilityState={{ selected: section === name }}
        onPress={() => setSection(name)}
        style={[styles.tab, section === name && { borderBottomColor: colors.accent }]}
      ><Text style={[styles.label, { color: section === name ? colors.accent : colors.muted }]}>{name}</Text></Pressable>)}
    </View>
    {section === 'Listings' ? <ListingsScreen embedded /> : <ApplicationsScreen embedded />}
  </View>;
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  tabs: { flexDirection: 'row', borderBottomWidth: 1, marginHorizontal: 22 },
  tab: { flex: 1, minHeight: 48, alignItems: 'center', justifyContent: 'center', borderBottomWidth: 2, borderBottomColor: 'transparent' },
  label: { fontSize: 15, fontWeight: '800' },
});
