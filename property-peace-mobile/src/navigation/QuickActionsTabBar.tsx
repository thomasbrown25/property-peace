import React, { useEffect, useRef, useState } from 'react';
import { Ionicons } from '@expo/vector-icons';
import type { BottomTabBarProps } from '@react-navigation/bottom-tabs';
import { StackActions } from '@react-navigation/native';
import { Animated, Easing, Image, Linking, Modal, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useAppDispatch, useAppSelector } from '../store/hooks';
import { logout } from '../store/user/user.slice';
import { useMoreDrawer } from './MoreDrawerContext';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAppTheme } from '../theme/AppTheme';
import { mainTabIconNames, type MainAudience } from './mainTabModel';
import PropertyAPI from '../api/propertyAPI';
import { loadPortfolioRentalMode } from '../features/properties/portfolioRentalMode';
import type { PropertyRentalMode } from '../features/properties/rentalMode';

type MenuItem = { label: string; icon: keyof typeof Ionicons.glyphMap; route?: string; screen?: string; webPath?: string };

type MenuSection = { title: string; items: MenuItem[] };

// Group by the landlord's workflow. Routes absent from native remain explicitly web-only.
const landlordMenu: MenuSection[] = [
  { title: 'Leasing', items: [
    { label: 'Calendar', icon: 'calendar-outline', route: 'Dashboard', screen: 'Calendar' },
    { label: 'Leases', icon: 'document-text-outline', route: 'Leases' },
    { label: 'New lease', icon: 'add-circle-outline', route: 'Leases', screen: 'AddLease' },
  ] },
  { title: 'Property Operations', items: [
    { label: 'Maintenance', icon: 'construct-outline', route: 'Maintenance' },
    { label: 'Percy', icon: 'sparkles-outline', webPath: '/landlord/ai-center' },
    { label: 'Checklists', icon: 'clipboard-outline', route: 'Checklists' },
    { label: 'Vendors', icon: 'people-outline', route: 'Vendors' },
  ] },
  { title: 'People & Communication', items: [
    { label: 'Team', icon: 'people-circle-outline', route: 'Team' },
    { label: 'Announcements', icon: 'notifications-outline', route: 'Announcements' },
  ] },
  { title: 'Accounting', items: [
    { label: 'Online Payments', icon: 'card-outline', webPath: '/landlord/online-payments' },
    { label: 'Finances', icon: 'cash-outline', route: 'Finances' },
    { label: 'Tax Center', icon: 'receipt-outline', webPath: '/landlord/accounting/tax-center' },
    { label: 'Reports', icon: 'bar-chart-outline', webPath: '/landlord/reports' },
  ] },
  { title: 'Account & Help', items: [
    { label: 'Settings', icon: 'settings-outline', route: 'Settings' },
    { label: 'Support', icon: 'help-circle-outline', webPath: '/landlord/support/ticket' },
  ] },
];
// Lease history remains available for existing records; only the new-leasing framing changes.
const shortTermLandlordMenu: MenuSection[] = landlordMenu.map(section => section.title === 'Leasing'
  ? { title: 'Calendar & lease history', items: section.items.filter(item => item.screen !== 'AddLease').map(item => item.route === 'Leases' ? { ...item, label: 'Lease history' } : item) }
  : section);
const tenantMenu: MenuSection[] = [
  { title: 'Your home', items: [
    { label: 'Leases', icon: 'document-text-outline', route: 'Leases' },
    { label: 'Payments', icon: 'card-outline', route: 'Payments' },
    { label: 'Maintenance', icon: 'construct-outline', route: 'Maintenance' },
    { label: 'Messages', icon: 'chatbubble-ellipses-outline', route: 'Messages' },
  ] },
  { title: 'Account', items: [
    { label: 'Settings', icon: 'settings-outline', route: 'Settings' },
  ] },
];

// Do not send a development/preview account to production's web app.
const webAppUrl = process.env.EXPO_PUBLIC_WEB_APP_URL?.replace(/\/$/, '')
  || (process.env.EXPO_PUBLIC_API_URL?.replace(/\/$/, '') === 'https://api.propertypeace.io'
    ? 'https://app.propertypeace.io' : undefined);

function AnimatedTab({ label, icon, selected, mode, selectedForeground, onPress, onLongPress }: {
  label: string;
  icon: ReturnType<typeof mainTabIconNames>;
  selected: boolean;
  mode: string;
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
  const color = selected ? selectedForeground : (mode === 'dark' ? '#ffffff' : '#111113');
  return (
    <Pressable
      style={[styles.tab, selected && { backgroundColor: mode === 'dark' ? 'rgba(0, 0, 0, 0.32)' : 'rgba(215, 225, 235, 0.18)' }]}
      accessibilityRole="tab"
      accessibilityState={{ selected }}
      accessibilityLabel={label}
      onPress={press}
      onLongPress={onLongPress}
    >
      <Animated.View style={[styles.tabContent, { transform: [{ scale }] }]}>
        {icon && <Ionicons name={(selected ? icon.active : icon.inactive) as keyof typeof Ionicons.glyphMap} size={22} color={color} />}
      </Animated.View>
    </Pressable>
  );
}

export default function QuickActionsTabBar({ state, descriptors, navigation, audience }: BottomTabBarProps & { audience: MainAudience }) {
  const insets = useSafeAreaInsets();
  const { open, show, hide } = useMoreDrawer();
  const currentUser = useAppSelector((state) => state.user.currentUser);
  const organizationId = String(currentUser?.currentOrganizationId ?? currentUser?.CurrentOrganizationId ?? '');
  const [inventory, setInventory] = useState<{ organizationId: string; mode: PropertyRentalMode | null } | null>(null);
  useEffect(() => {
    if (audience !== 'landlord' || !organizationId) return;
    let active = true;
    setInventory(null);
    void PropertyAPI.getProperties()
      .then(properties => loadPortfolioRentalMode(properties, id => PropertyAPI.getUnits(id)))
      .then(mode => { if (active) setInventory({ organizationId, mode }); })
      .catch(() => { if (active) setInventory({ organizationId, mode: null }); });
    return () => { active = false; };
  }, [audience, organizationId, open]);
  const dispatch = useAppDispatch();
  const profileImageUrl = currentUser?.ProfileImageUrl ?? currentUser?.profileImageUrl;
  const avatarLabel = String(currentUser?.FirstName ?? currentUser?.firstName ?? currentUser?.Email ?? currentUser?.email ?? '?').slice(0, 1).toUpperCase();
  const { mode, colors } = useAppTheme();
  const sheetOffset = useRef(new Animated.Value(-360)).current;
  const closing = useRef(false);
  const showSheet = () => {
    if (open || closing.current) return;
    sheetOffset.setValue(-360);
    show();
  };
  const hideSheet = (afterClose?: () => void) => {
    if (!open || closing.current) return;
    closing.current = true;
    Animated.timing(sheetOffset, { toValue: -360, duration: 260, easing: Easing.inOut(Easing.cubic), useNativeDriver: true }).start(({ finished }) => {
      closing.current = false;
      if (finished) {
        hide();
        afterClose?.();
      }
    });
  };
  const menu = audience === 'landlord'
    ? inventory?.organizationId === organizationId && inventory.mode === 'ShortTerm' ? shortTermLandlordMenu : landlordMenu
    : tenantMenu;
  // The dock represents section roots, not the last detail visited in each stack.
  const openTabRoot = (routeName: string) => {
    const route = state.routes.find((item) => item.name === routeName);
    if (!route) return;
    const event = navigation.emit({ type: 'tabPress', target: route.key, canPreventDefault: true });
    if (event.defaultPrevented) return;
    if (route.state?.key && (route.state.index ?? 0) > 0) {
      navigation.dispatch({ ...StackActions.popToTop(), target: route.state.key });
    }
    if (state.routes[state.index]?.key !== route.key) navigation.navigate(route.name);
  };
  const navigateItem = (item: MenuItem) => {
    if (item.route && state.routes.some((route) => route.name === item.route)) {
      hideSheet(() => item.screen ? navigation.navigate(item.route!, { screen: item.screen }) : openTabRoot(item.route!));
    } else if (item.webPath && webAppUrl) {
      hideSheet(() => { void Linking.openURL(`${webAppUrl}${item.webPath}`); });
    }
  };

  const visibleRoutes = state.routes.filter((route) => !['Leases', 'Listings', 'Applications', 'Vendors', 'Team', 'Announcements', 'Finances'].includes(route.name)
    && !(audience === 'landlord' && route.name === 'Maintenance')
    && !(audience === 'landlord' && route.name === 'Messages')
    && !(audience === 'tenant' && route.name === 'Notifications')
    && !['Checklists', 'Settings'].includes(route.name));
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
        selectedForeground={colors.accent}
        onPress={() => {
          if (open) hideSheet();
          openTabRoot(route.name);
        }}
        onLongPress={() => navigation.emit({ type: 'tabLongPress', target: route.key })}
      />
    );
  };

  return (
    <View pointerEvents="box-none" style={[styles.dockArea, { paddingBottom: Math.max(insets.bottom, 10) + 6 }]}>
      <View style={[styles.pill, { backgroundColor: mode === 'dark' ? 'rgba(24, 27, 31, 0.82)' : 'rgba(255, 255, 255, 0.88)', borderColor: mode === 'dark' ? 'rgba(255,255,255,0.28)' : '#e1e7eb', shadowOpacity: mode === 'dark' ? 0.22 : 0.12 }]} accessibilityRole="tablist">
        {visibleRoutes.map(renderTab)}
        <Pressable style={styles.tab} accessibilityRole="tab" accessibilityLabel="Settings" accessibilityHint="Open your settings"
          accessibilityState={{ selected: state.routes[state.index]?.name === 'Settings' }}
          onPress={() => openTabRoot('Settings')}>
          {profileImageUrl ? <Image source={{ uri: profileImageUrl }} style={[styles.avatar, { borderColor: state.routes[state.index]?.name === 'Settings' ? colors.accent : colors.border }]} />
            : <View style={[styles.avatar, { borderColor: state.routes[state.index]?.name === 'Settings' ? colors.accent : colors.border, backgroundColor: colors.accent }]}><Text style={styles.avatarInitial}>{avatarLabel}</Text></View>}
        </Pressable>
      </View>
      <Modal visible={open} transparent animationType="none" onShow={() => {
        Animated.timing(sheetOffset, { toValue: 0, duration: 300, easing: Easing.out(Easing.cubic), useNativeDriver: true }).start();
      }} onRequestClose={() => hideSheet()}>
        <View style={styles.modalRoot}>
          <Pressable style={styles.backdrop} accessibilityLabel="Close menu" onPress={() => hideSheet()} />
          <Animated.View style={[styles.sheet, { backgroundColor: colors.surface, paddingBottom: Math.max(insets.bottom, 18) + 12, paddingTop: insets.top + 18, transform: [{ translateX: sheetOffset }] }]}>
            <View style={styles.sheetHeader}>
              <View>
                <Text style={[styles.sheetEyebrow, mode === 'dark' && { color: '#7bd793' }]}>PROPERTY PEACE</Text>
              </View>
              <Pressable style={[styles.closeButton, { backgroundColor: colors.background }]} accessibilityRole="button" accessibilityLabel="Close menu" onPress={() => hideSheet()}>
                <Ionicons name="close" size={22} color={colors.text} />
              </Pressable>
            </View>
            <ScrollView bounces={false} style={styles.actionScroll} contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator>
              {menu.map((section) => (
                <View key={section.title} style={styles.menuSection}>
                  <Text style={[styles.sectionHeading, { color: colors.muted }]} accessibilityRole="header">{section.title}</Text>
                  {section.items.map((item) => {
                    const unavailable = !!item.webPath && !webAppUrl;
                    const currentRoute = state.routes[state.index];
                    const selected = !!item.route && currentRoute?.name === item.route && (!item.screen || currentRoute.state?.routes[currentRoute.state.index ?? 0]?.name === item.screen);
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
                  {section === menu[menu.length - 1] && (
                    <Pressable style={[styles.action, { borderTopColor: colors.border }]} accessibilityRole="button" accessibilityLabel="Sign out"
                      onPress={() => hideSheet(() => { void dispatch(logout()); })}>
                      <View style={[styles.actionIcon, { backgroundColor: colors.background }]}><Ionicons name="log-out-outline" size={22} color={colors.text} /></View>
                      <View style={styles.actionCopy}><Text style={[styles.actionLabel, { color: colors.text }]}>Sign out</Text></View>
                    </Pressable>
                  )}
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
  // Float above the scrolling scene; only the pill is tinted, not the safe-area canvas.
  dockArea: { position: 'absolute', bottom: 0, left: 0, right: 0, paddingHorizontal: 16, paddingTop: 12 },
  pill: { minHeight: 54, borderRadius: 30, borderWidth: 1, padding: 4, flexDirection: 'row', alignItems: 'center', shadowColor: '#001a33', shadowOpacity: 0.22, shadowRadius: 16, shadowOffset: { width: 0, height: 7 }, elevation: 10 },
  tab: { flex: 1, minWidth: 0, minHeight: 46, borderRadius: 24, alignItems: 'center', justifyContent: 'center' },
  avatar: { width: 30, height: 30, borderRadius: 15, borderWidth: 2, alignItems: 'center', justifyContent: 'center' },
  avatarInitial: { color: '#fff', fontSize: 16, fontWeight: '700' },
  tabContent: { alignItems: 'center', justifyContent: 'center', gap: 2 },
  modalRoot: { flex: 1, justifyContent: 'flex-start' },
  backdrop: { position: 'absolute', top: 0, right: 0, bottom: 0, left: 0, backgroundColor: 'rgba(4, 20, 35, 0.52)' },
  sheet: { width: '86%', maxWidth: 360, height: '100%', paddingHorizontal: 20, paddingTop: 56, shadowColor: '#001a33', shadowOpacity: 0.18, shadowRadius: 20, elevation: 18 },
  handle: { alignSelf: 'center', width: 38, height: 4, borderRadius: 2, marginBottom: 24 },
  sheetHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 18 },
  sheetEyebrow: { color: '#2f8f46', fontSize: 11, fontWeight: '800', letterSpacing: 1.2 },
  closeButton: { width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center' },
  actionScroll: { flexShrink: 1 },
  scrollContent: { paddingBottom: 8 },
  menuSection: { marginTop: 12 },
  sectionHeading: { fontSize: 11, fontWeight: '800', letterSpacing: 1, textTransform: 'uppercase', marginBottom: 8, paddingHorizontal: 2 },
  action: { minHeight: 64, flexDirection: 'row', alignItems: 'center', gap: 14, borderTopWidth: 1 },
  actionIcon: { width: 46, height: 46, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
  actionCopy: { flex: 1, minWidth: 0 },
  actionLabel: { fontSize: 16, fontWeight: '800' },
  actionDetail: { fontSize: 13, marginTop: 3 },
});
