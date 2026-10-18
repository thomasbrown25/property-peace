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
  const { colors } = useAppTheme();
  const [searchOpen, setSearchOpen] = useState(false);
  const tabs = navigation.getParent();

  return <>
    <View style={[styles.header, { paddingTop: insets.top + 16 }]}>
      <View style={styles.side}>
        <TouchableOpacity style={styles.action} onPress={moreDrawer.show} accessibilityRole="button" accessibilityLabel="Open more menu" accessibilityState={{ expanded: moreDrawer.open }}>
          <Ionicons name="menu-outline" size={27} color={colors.text} />
        </TouchableOpacity>
      </View>
      <Text style={[styles.title, { color: colors.text }]} numberOfLines={1} accessibilityRole="header">{title}</Text>
      <View style={[styles.side, styles.right]}>
        <TouchableOpacity style={styles.action} onPress={() => setSearchOpen(true)} accessibilityRole="button" accessibilityLabel="Search properties, tenants, and leases">
          <Ionicons name="search-outline" size={25} color={colors.text} />
        </TouchableOpacity>
        <TouchableOpacity style={styles.action} onPress={onMessage ?? (() => tabs?.navigate('Messages', { screen: 'MessagesList' }))} accessibilityRole="button" accessibilityLabel={onMessage ? 'New message' : 'Messages'}>
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
  header: { paddingHorizontal: 20, paddingBottom: 18, flexDirection: 'row', alignItems: 'center' },
  side: { width: 88, flexDirection: 'row', alignItems: 'center' },
  right: { justifyContent: 'flex-end' },
  action: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
  title: { flex: 1, textAlign: 'center', fontSize: 22, fontWeight: '800' },
});
