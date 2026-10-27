import React, { useCallback, useState } from 'react';
import { Image, StyleSheet, Text, TouchableOpacity, useWindowDimensions, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useMoreDrawer } from '../navigation/MoreDrawerContext';
import { useAppTheme } from '../theme/AppTheme';
import GlobalSearchModal from './GlobalSearchModal';
import { useAppSelector } from '../store/hooks';
import { maintenanceAudience } from '../features/maintenance/maintenanceModel';
import { buildMessagingScopeKey } from '../features/messages/messagesModel';
import ConversationAPI from '../api/conversationAPI';
import signalRService from '../services/signalRService';

const lightLogo = require('../../assets/property-peace-navbar-logo.png');
const darkLogo = require('../../assets/property-peace-logo.png');

/** Shared list-page chrome. The side slots have equal width so the title or logo stays centered. */
export default function LandlordPageHeader({ title, onMessage, logo = false }: { title: string; onMessage?: () => void; logo?: boolean }) {
  const navigation = useNavigation<any>();
  const insets = useSafeAreaInsets();
  const moreDrawer = useMoreDrawer();
  const { mode, colors } = useAppTheme();
  const { width } = useWindowDimensions();
  const [searchOpen, setSearchOpen] = useState(false);
  const currentUser = useAppSelector(state => state.user.currentUser);
  const isTenant = maintenanceAudience(currentUser) === 'tenant';
  const messageScope = buildMessagingScopeKey(currentUser, 'tenant');
  const organizationId = currentUser?.currentOrganizationId ?? currentUser?.CurrentOrganizationId;
  const [messageBadge, setMessageBadge] = useState<{ scope: string; count: number } | null>(null);
  const unreadMessages = isTenant && messageBadge?.scope === messageScope ? messageBadge.count : 0;

  useFocusEffect(useCallback(() => {
    if (!isTenant) return undefined;
    let active = true;
    let sequence = 0;
    const refresh = () => {
      const request = ++sequence;
      void ConversationAPI.getConversations('tenant').then(conversations => {
        if (active && request === sequence) setMessageBadge({
          scope: messageScope,
          count: conversations.reduce((sum, item) => sum + (item.isArchived ? 0 : Math.max(0, Number(item.unreadCount) || 0)), 0),
        });
      }).catch(() => {
        if (active && request === sequence) setMessageBadge(null);
      });
    };
    refresh();
    void signalRService.connect(organizationId).then(connection => {
      if (active) connection.on('ConversationListUpdated', refresh);
    }).catch(() => undefined);
    return () => {
      active = false;
      signalRService.getConnection()?.off('ConversationListUpdated', refresh);
    };
  }, [isTenant, messageScope, organizationId]));

  const parent = navigation.getParent();
  const tabs = parent?.getState().routeNames.includes('Messages') ? parent : navigation;

  return <>
    <View style={[styles.header, { paddingTop: insets.top + 16 }]}>
      <View style={styles.side}>
        <TouchableOpacity style={[styles.action, mode === 'dark' && { backgroundColor: colors.surface, borderColor: colors.border }]} onPress={moreDrawer.show} accessibilityRole="button" accessibilityLabel="Open more menu" accessibilityState={{ expanded: moreDrawer.open }}>
          <Ionicons name="menu-outline" size={27} color={colors.text} />
        </TouchableOpacity>
      </View>
      {logo ? <View style={styles.logoSlot}><Image source={mode === 'dark' ? darkLogo : lightLogo} style={width < 370 ? styles.compactLogo : styles.logo} resizeMode="contain" accessibilityLabel="Property Peace" /></View>
        : <Text style={[styles.title, { color: colors.text }]} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.8} accessibilityRole="header">{title}</Text>}
      <View style={[styles.side, styles.right]}>
        {!isTenant && <TouchableOpacity style={[styles.action, mode === 'dark' && { backgroundColor: colors.surface, borderColor: colors.border }]} onPress={() => setSearchOpen(true)} accessibilityRole="button" accessibilityLabel="Search properties, tenants, and leases">
          <Ionicons name="search-outline" size={25} color={colors.text} />
        </TouchableOpacity>}
        <TouchableOpacity style={[styles.action, mode === 'dark' && { backgroundColor: colors.surface, borderColor: colors.border }]} onPress={onMessage ?? (() => tabs?.navigate('Messages', { screen: 'MessagesList' }))} accessibilityRole="button" accessibilityLabel={onMessage ? 'New message' : unreadMessages > 0 ? `Messages, ${unreadMessages} unread` : 'Messages'}>
          <Ionicons name="chatbubble-ellipses-outline" size={25} color={colors.text} />
          {unreadMessages > 0 && <View style={styles.messageBadge}><Text style={styles.messageBadgeText}>{unreadMessages > 99 ? '99+' : unreadMessages}</Text></View>}
        </TouchableOpacity>
      </View>
    </View>
    {!isTenant && <GlobalSearchModal visible={searchOpen} onClose={() => setSearchOpen(false)} onSelect={(type, id) => {
      if (type === 'property') tabs?.navigate('Properties', { screen: 'PropertyDetail', params: { propertyId: String(id) } });
      if (type === 'tenant') tabs?.navigate('Tenants', { screen: 'TenantDetail', params: { tenantId: String(id) } });
      if (type === 'lease') tabs?.navigate('Leases', { screen: 'LeaseDetail', params: { leaseId: String(id), archived: false } });
    }} />}
  </>;
}

const styles = StyleSheet.create({
  header: { paddingHorizontal: 12, paddingBottom: 18, flexDirection: 'row', alignItems: 'center' },
  side: { width: 92, flexDirection: 'row', alignItems: 'center' },
  right: { justifyContent: 'flex-end', gap: 4 },
  action: { width: 44, height: 44, borderRadius: 22, backgroundColor: '#f8fafc', borderWidth: 1, borderColor: '#e1e7eb', alignItems: 'center', justifyContent: 'center' },
  messageBadge: { position: 'absolute', top: -7, right: -8, minWidth: 21, height: 21, paddingHorizontal: 4, borderRadius: 11, backgroundColor: '#dc2626', alignItems: 'center', justifyContent: 'center' },
  messageBadgeText: { color: '#fff', fontSize: 12, fontWeight: '800', lineHeight: 16, textAlign: 'center' },
  title: { flex: 1, textAlign: 'center', fontSize: 22, fontWeight: '800' },
  logoSlot: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  logo: { width: 148, height: 42 },
  compactLogo: { width: 112, height: 42 },
});
