import React from 'react';
import { Ionicons } from '@expo/vector-icons';
import { Linking, Pressable, StyleSheet, Text, View } from 'react-native';
import LandlordPageHeader from '../../components/LandlordPageHeader';
import { useAppTheme } from '../../theme/AppTheme';

// Reports are currently served by the web workspace; never send a preview account to production.
const webAppUrl = process.env.EXPO_PUBLIC_WEB_APP_URL?.replace(/\/$/, '')
  || (process.env.EXPO_PUBLIC_API_URL?.replace(/\/$/, '') === 'https://api.propertypeace.io'
    ? 'https://app.propertypeace.io' : undefined);

export default function ReportsScreen() {
  const { colors } = useAppTheme();
  return <View style={[styles.page, { backgroundColor: colors.background }]}>
    <LandlordPageHeader title="Reports" />
    <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}>
      <Ionicons name="bar-chart-outline" size={32} color={colors.accent} />
      <Text style={[styles.title, { color: colors.text }]}>Portfolio reports</Text>
      <Text style={[styles.description, { color: colors.muted }]}>Reports are available in the web workspace.</Text>
      {webAppUrl ? <Pressable style={[styles.button, { backgroundColor: colors.accent }]} accessibilityRole="button" accessibilityLabel="Open reports in web app" onPress={() => { void Linking.openURL(`${webAppUrl}/landlord/reports`); }}>
        <Text style={styles.buttonText}>Open reports</Text>
        <Ionicons name="open-outline" size={18} color="#fff" />
      </Pressable> : <Text style={[styles.description, { color: colors.muted }]}>A web app URL is not configured for this build.</Text>}
    </View>
  </View>;
}

const styles = StyleSheet.create({
  page: { flex: 1 },
  card: { marginHorizontal: 18, marginTop: 20, padding: 24, borderWidth: 1, borderRadius: 18, gap: 12, alignItems: 'flex-start' },
  title: { fontSize: 20, fontWeight: '700' },
  description: { fontSize: 15, lineHeight: 22 },
  button: { minHeight: 48, borderRadius: 12, paddingHorizontal: 18, flexDirection: 'row', alignItems: 'center', gap: 10, marginTop: 8 },
  buttonText: { color: '#fff', fontSize: 15, fontWeight: '700' },
});
