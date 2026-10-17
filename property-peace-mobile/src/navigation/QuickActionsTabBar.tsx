import React, { useRef, useState } from 'react';
import { Ionicons } from '@expo/vector-icons';
import type { BottomTabBarProps } from '@react-navigation/bottom-tabs';
import { StackActions } from '@react-navigation/native';
import { Animated, Easing, Linking, Modal, Pressable, ScrollView, StyleSheet, Text, useWindowDimensions, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAppTheme } from '../theme/AppTheme';
import { mainTabIconNames, type MainAudience } from './mainTabModel';

type MenuItem = { label: string; icon: keyof typeof Ionicons.glyphMap; route?: string; webPath?: string };
type MenuGroup = { title?: string; items: MenuItem[] };

// Match the main app sidebar's order. Routes absent from the native app are explicitly web-only.
const landlordMenu: MenuGroup[] = [
  { items: [
    { label: 'Leases', icon: 'document-text-outline', route: 'Leases' },
    { label: 'Listings & Applications', icon: 'megaphone-outline', webPath: '/landlord/listings' },
  ] },
  { title: 'Property Operations', items: [
    { label: 'Percy', icon: 'sparkles-outline', webPath: '/landlord/ai-center' },
    { label: 'Checklists', icon: 'clipboard-outline', route: 'Checklists' },
    { label: 'Vendors', icon: 'people-outline', webPath: '/landlord/vendors' },
  ] },
  { title: 'Admin Operations', items: [
    { label: 'Team', icon: 'people-circle-outline', webPath: '/landlord/admin-members' },
    { label: 'Announcements', icon: 'notifications-outline', webPath: '/landlord/announcements' },
  ] },
  { title: 'Accounting', items: [
    { label: 'Online Payments', icon: 'card-outline', webPath: '/landlord/online-payments' },
    { label: 'Finances', icon: 'cash-outline', webPath: '/landlord/finances' },
    { label: 'Tax Center', icon: 'receipt-outline', webPath: '/landlord/accounting/tax-center' },
    { label: 'Reports', icon: 'bar-chart-outline', webPath: '/landlord/reports' },
  ] },
  { title: 'Account', items: [
    { label: 'Tenants', icon: 'person-outline', route: 'Tenants' },
    { label: 'Notifications', icon: 'notifications-outline', route: 'Notifications' },
    { label: 'Support', icon: 'help-circle-outline', webPath: '/landlord/support/ticket' },
    { label: 'Settings', icon: 'settings-outline', route: 'Settings' },
  ] },
];
const tenantMenu: MenuGroup[] = [
  { items: [
    { label: 'Dashboard', icon: 'home-outline', webPath: '/tenant/dashboard' },
    { label: 'My Lease', icon: 'document-text-outline', webPath: '/tenant/lease' },
    { label: 'Applications', icon: 'clipboard-outline', webPath: '/tenant/applications' },
    { label: 'Payments', icon: 'card-outline', webPath: '/tenant/payments' },
    { label: 'Documents', icon: 'folder-outline', webPath: '/tenant/documents' },
  ] },
];

// Do not send a development/preview account to production's web app.
const webAppUrl = process.env.EXPO_PUBLIC_WEB_APP_URL?.replace(/\/$/, '')
  || (process.env.EXPO_PUBLIC_API_URL?.replace(/\/$/, '') === 'https://api.propertypeace.io'
    ? 'https://app.propertypeace.io' : undefined);

function AnimatedTab({ label, icon, selected, mode, accent, selectedForeground, onPress, onLongPress }: {
  label: string;
  icon: ReturnType<typeof mainTabIconNames>;
  selected: boolean;
  mode: string;
  accent: string;
  selectedForeground: string;
  onPress: () => void;
  onLongPress: () => void;
}) {
  const scale = useRef(new Animated.Value(1)).current;
  const press = () => {
    scale.stopAnimation();
    scale.setValue(0.86);
    Animated.spring(scale, { toValue: 1, friction: 5, tension: 210, useNativeDriver: true }).start();
    onPress();
  };
  const color = selected ? selectedForeground : (mode === 'dark' ? '#b4c3d0' : '#385369');
  return (
    <Pressable
      style={[styles.tab, selected && { backgroundColor: accent }]}
      accessibilityRole="tab"
      accessibilityState={{ selected }}
      accessibilityLabel={label}
      onPress={press}
      onLongPress={onLongPress}
    >
      <Animated.View style={[styles.tabContent, { transform: [{ scale }] }]}>
        {icon && <Ionicons name={(selected ? icon.active : icon.inactive) as keyof typeof Ionicons.glyphMap} size={22} color={color} />}
        <Text numberOfLines={1} style={[styles.tabText, { color }]}>{label}</Text>
      </Animated.View>
    </Pressable>
  );
}

export default function QuickActionsTabBar({ state, descriptors, navigation, audience }: BottomTabBarProps & { audience: MainAudience }) {
  const insets = useSafeAreaInsets();
  const { height } = useWindowDimensions();
  const { mode, colors } = useAppTheme();
  const [open, setOpen] = useState(false);
  const sheetOffset = useRef(new Animated.Value(height)).current;
  const closing = useRef(false);
  const showSheet = () => {
    if (open || closing.current) return;
    sheetOffset.setValue(height);
    setOpen(true);
  };
  const hideSheet = (afterClose?: () => void) => {
    if (!open || closing.current) return;
    closing.current = true;
    Animated.timing(sheetOffset, { toValue: height, duration: 260, easing: Easing.inOut(Easing.cubic), useNativeDriver: true }).start(({ finished }) => {
      closing.current = false;
      if (finished) {
        setOpen(false);
        afterClose?.();
      }
    });
  };
  const menu = audience === 'landlord' ? landlordMenu : tenantMenu;
  const moreSelected = menu.some((group) => group.items.some((item) => item.route === state.routes[state.index]?.name));
  const navigateItem = (item: MenuItem) => {
    if (item.route && state.routes.some((route) => route.name === item.route)) {
      hideSheet(() => navigation.navigate(item.route as never));
    } else if (item.webPath && webAppUrl) {
      hideSheet(() => { void Linking.openURL(`${webAppUrl}${item.webPath}`); });
    }
  };

  const visibleRoutes = state.routes.filter((route) => !['Notifications', 'Tenants', 'Leases'].includes(route.name)
    && !(audience === 'landlord' && ['Checklists', 'Settings'].includes(route.name)));
  const renderTab = (route: typeof visibleRoutes[number]) => {
    const index = state.routes.findIndex((item) => item.key === route.key);
    const selected = state.index === index;
    const label = typeof descriptors[route.key].options.tabBarLabel === 'string'
      ? descriptors[route.key].options.tabBarLabel as string : route.name;
    const icon = mainTabIconNames(route.name);
    return (
      <AnimatedTab
        key={route.key}
        label={label}
        icon={icon}
        selected={selected}
        mode={mode}
        accent={colors.accent}
        selectedForeground={mode === 'dark' ? colors.background : '#fff'}
        onPress={() => {
          if (open) hideSheet();
          const event = navigation.emit({ type: 'tabPress', target: route.key, canPreventDefault: true });
          if (event.defaultPrevented) return;
          // Properties always opens its list, even when returning from another tab
          // whose Properties stack was left on a detail page.
          if (route.name === 'Properties' && route.state?.key) {
            navigation.dispatch({ ...StackActions.popToTop(), target: route.state.key });
          } else if (selected && (route.state?.index ?? 0) > 0 && route.state?.key) {
            navigation.dispatch({ ...StackActions.popToTop(), target: route.state.key });
          }
          if (route.name === 'Properties' && !route.state?.key) {
            navigation.navigate('Properties', { screen: 'PropertiesList' });
          } else if (!selected) navigation.navigate(route.name);
        }}
        onLongPress={() => navigation.emit({ type: 'tabLongPress', target: route.key })}
      />
    );
  };

  return (
    <View style={[styles.dockArea, { paddingBottom: Math.max(insets.bottom, 10) + 6 }]}>
      <View style={[styles.pill, { backgroundColor: mode === 'dark' ? 'rgba(34, 47, 62, 0.82)' : 'rgba(241, 245, 245, 0.82)', borderColor: mode === 'dark' ? 'rgba(255,255,255,0.22)' : 'rgba(255,255,255,0.75)' }]} accessibilityRole="tablist">
        {visibleRoutes.map(renderTab)}
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="More"
          accessibilityHint="Opens the rest of the navigation menu"
          accessibilityState={{ expanded: open, selected: moreSelected }}
          style={[styles.tab, (moreSelected || open) && { backgroundColor: colors.accent }]}
          onPress={showSheet}
        >
          <Ionicons name="menu-outline" size={22} color={(moreSelected || open) ? (mode === 'dark' ? colors.background : '#fff') : mode === 'dark' ? '#b4c3d0' : '#385369'} />
          <Text style={[styles.tabText, { color: (moreSelected || open) ? (mode === 'dark' ? colors.background : '#fff') : mode === 'dark' ? '#b4c3d0' : '#385369' }]}>More</Text>
        </Pressable>
      </View>
      <Modal visible={open} transparent animationType="none" onShow={() => {
        Animated.timing(sheetOffset, { toValue: 0, duration: 300, easing: Easing.out(Easing.cubic), useNativeDriver: true }).start();
      }} onRequestClose={() => hideSheet()}>
        <View style={styles.modalRoot}>
          <Pressable style={styles.backdrop} accessibilityLabel="Close menu" onPress={() => hideSheet()} />
          <Animated.View style={[styles.sheet, { backgroundColor: colors.surface, paddingBottom: Math.max(insets.bottom, 18) + 12, transform: [{ translateY: sheetOffset }] }]}>
            <View style={[styles.handle, { backgroundColor: colors.border }]} />
            <View style={styles.sheetHeader}>
              <View>
                <Text style={[styles.sheetEyebrow, mode === 'dark' && { color: '#7bd793' }]}>PROPERTY PEACE</Text>
              </View>
              <Pressable style={[styles.closeButton, { backgroundColor: colors.background }]} accessibilityRole="button" accessibilityLabel="Close menu" onPress={() => hideSheet()}>
                <Ionicons name="close" size={22} color={colors.text} />
              </Pressable>
            </View>
            <ScrollView bounces={false} style={styles.actionScroll} contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator>
              {menu.map((group, index) => (
                <View key={group.title || `primary-${index}`}>
                  {group.title && <Text style={[styles.groupTitle, { color: colors.muted }]}>{group.title}</Text>}
                  {group.items.map((item) => {
                    const unavailable = !!item.webPath && !webAppUrl;
                    const selected = !!item.route && state.routes[state.index]?.name === item.route;
                    return (
                      <Pressable key={item.label} style={[styles.action, { borderTopColor: colors.border }, selected && { backgroundColor: colors.background }]}
                        accessibilityRole="button" accessibilityLabel={item.label}
                        accessibilityHint={unavailable ? 'Web app link not configured for this build' : item.webPath ? 'Opens in the web app' : undefined}
                        accessibilityState={{ disabled: unavailable, selected }} disabled={unavailable} onPress={() => navigateItem(item)}>
                        <View style={[styles.actionIcon, { backgroundColor: colors.background }]}><Ionicons name={item.icon} size={22} color={unavailable ? colors.muted : colors.accent} /></View>
                        <View style={styles.actionCopy}>
                          <Text style={[styles.actionLabel, { color: unavailable ? colors.muted : colors.text }]}>{item.label}</Text>
                          {item.webPath && <Text style={[styles.actionDetail, { color: colors.muted }]}>{unavailable ? 'Web app · unavailable in this build' : 'Opens in web app'}</Text>}
                        </View>
                        <Ionicons name={item.webPath ? 'open-outline' : 'chevron-forward'} size={19} color={colors.muted} />
                      </Pressable>
                    );
                  })}
                </View>
              ))}
            </ScrollView>
          </Animated.View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  // Keep the dock in layout so every tab and nested detail ends above it.
  dockArea: { paddingHorizontal: 16, zIndex: 10 },
  pill: { minHeight: 72, borderRadius: 38, borderWidth: 1, padding: 5, flexDirection: 'row', alignItems: 'center', shadowColor: '#001a33', shadowOpacity: 0.22, shadowRadius: 16, shadowOffset: { width: 0, height: 7 }, elevation: 10 },
  tab: { flex: 1, minWidth: 0, minHeight: 60, borderRadius: 30, alignItems: 'center', justifyContent: 'center', gap: 2 },
  tabContent: { alignItems: 'center', justifyContent: 'center', gap: 2 },
  tabText: { fontSize: 10, fontWeight: '700', textAlign: 'center' },
  modalRoot: { flex: 1, justifyContent: 'flex-end' },
  backdrop: { position: 'absolute', top: 0, right: 0, bottom: 0, left: 0, backgroundColor: 'rgba(4, 20, 35, 0.52)' },
  sheet: { maxHeight: '78%', borderTopLeftRadius: 28, borderTopRightRadius: 28, paddingHorizontal: 24, paddingTop: 10, shadowColor: '#001a33', shadowOpacity: 0.18, shadowRadius: 20, elevation: 18 },
  handle: { alignSelf: 'center', width: 38, height: 4, borderRadius: 2, marginBottom: 24 },
  sheetHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 18 },
  sheetEyebrow: { color: '#2f8f46', fontSize: 11, fontWeight: '800', letterSpacing: 1.2 },
  closeButton: { width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center' },
  actionScroll: { flexShrink: 1 },
  scrollContent: { paddingBottom: 8 },
  groupTitle: { fontSize: 11, fontWeight: '800', letterSpacing: 1, textTransform: 'uppercase', marginTop: 22, marginBottom: 8 },
  action: { minHeight: 64, flexDirection: 'row', alignItems: 'center', gap: 14, borderTopWidth: 1 },
  actionIcon: { width: 46, height: 46, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
  actionCopy: { flex: 1, minWidth: 0 },
  actionLabel: { fontSize: 16, fontWeight: '800' },
  actionDetail: { fontSize: 13, marginTop: 3 },
});
