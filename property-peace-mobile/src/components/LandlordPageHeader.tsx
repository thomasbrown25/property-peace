import React, { useState } from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useMoreDrawer } from '../navigation/MoreDrawerContext';
import { useAppTheme } from '../theme/AppTheme';
import GlobalSearchModal from './GlobalSearchModal';

/** Shared landlord list-page chrome. The side slots have equal width so the title stays centered. */
export default function LandlordPageHeader({ title, onMessage }: { title: string; onMessage?: () => void }) {
  const navigation = useNavigation<any>();
  const insets = useSafeAreaInsets();
  const moreDrawer = useMoreDrawer();
  const { mode, colors } = useAppTheme();
  const [searchOpen, setSearchOpen] = useState(false);
  const parent = navigation.getParent();
  const tabs = parent?.getState().routeNames.includes('Messages') ? parent : navigation;

  return <>
    <View style={[styles.header, { paddingTop: insets.top + 16 }]}>
      <View style={styles.side}>
        <TouchableOpacity style={[styles.action, mode === 'dark' && { backgroundColor: colors.surface, borderColor: colors.border }]} onPress={moreDrawer.show} accessibilityRole="button" accessibilityLabel="Open more menu" accessibilityState={{ expanded: moreDrawer.open }}>
          <Ionicons name="menu-outline" size={27} color={colors.text} />
        </TouchableOpacity>
      </View>
      <Text style={[styles.title, { color: colors.text }]} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.8} accessibilityRole="header">{title}</Text>
      <View style={[styles.side, styles.right]}>
        <TouchableOpacity style={[styles.action, mode === 'dark' && { backgroundColor: colors.surface, borderColor: colors.border }]} onPress={() => setSearchOpen(true)} accessibilityRole="button" accessibilityLabel="Search properties, tenants, and leases">
          <Ionicons name="search-outline" size={25} color={colors.text} />
        </TouchableOpacity>
        <TouchableOpacity style={[styles.action, mode === 'dark' && { backgroundColor: colors.surface, borderColor: colors.border }]} onPress={onMessage ?? (() => tabs?.navigate('Messages', { screen: 'MessagesList' }))} accessibilityRole="button" accessibilityLabel={onMessage ? 'New message' : 'Messages'}>
          <Ionicons name="chatbubble-ellipses-outline" size={25} color={colors.text} />
        </TouchableOpacity>
      </View>
    </View>
    <GlobalSearchModal visible={searchOpen} onClose={() => setSearchOpen(false)} onSelect={(type, id) => {
      if (type === 'property') tabs?.navigate('Properties', { screen: 'PropertyDetail', params: { propertyId: String(id) } });
      if (type === 'tenant') tabs?.navigate('Tenants', { screen: 'TenantDetail', params: { tenantId: String(id) } });
      if (type === 'lease') tabs?.navigate('Leases', { screen: 'LeaseDetail', params: { leaseId: String(id), archived: false } });
    }} />
  </>;
}

const styles = StyleSheet.create({
  header: { paddingHorizontal: 12, paddingBottom: 18, flexDirection: 'row', alignItems: 'center' },
  side: { width: 92, flexDirection: 'row', alignItems: 'center' },
  right: { justifyContent: 'flex-end', gap: 4 },
  action: { width: 44, height: 44, borderRadius: 22, backgroundColor: '#f8fafc', borderWidth: 1, borderColor: '#e1e7eb', alignItems: 'center', justifyContent: 'center' },
  title: { flex: 1, textAlign: 'center', fontSize: 22, fontWeight: '800' },
});
