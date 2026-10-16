import React, { useEffect, useRef, useState } from 'react';
import { Ionicons } from '@expo/vector-icons';
import type { BottomTabBarProps } from '@react-navigation/bottom-tabs';
import { Animated, Modal, Pressable, ScrollView, StyleSheet, Text, useWindowDimensions, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAppTheme } from '../theme/AppTheme';
import { dockSplitIndex, mainTabIconNames, type MainAudience } from './mainTabModel';

type Action = { label: string; detail: string; icon: keyof typeof Ionicons.glyphMap; navigate: () => void };

export default function QuickActionsTabBar({ state, descriptors, navigation, audience }: BottomTabBarProps & { audience: MainAudience }) {
  const insets = useSafeAreaInsets();
  const { height } = useWindowDimensions();
  const { mode, colors } = useAppTheme();
  const [open, setOpen] = useState(false);
  const spin = useRef(new Animated.Value(0)).current;
  const sheetOffset = useRef(new Animated.Value(height)).current;
  const closing = useRef(false);
  useEffect(() => {
    Animated.spring(spin, { toValue: open ? 1 : 0, useNativeDriver: true, friction: 8, tension: 90 }).start();
  }, [open, spin]);
  const showSheet = () => {
    if (open) return;
    closing.current = false;
    sheetOffset.setValue(height);
    setOpen(true);
  };
  const hideSheet = (afterClose?: () => void) => {
    if (closing.current) return;
    closing.current = true;
    Animated.timing(sheetOffset, { toValue: height, duration: 260, useNativeDriver: true }).start(({ finished }) => {
      if (finished) {
        setOpen(false);
        afterClose?.();
      }
      closing.current = false;
    });
  };
  const actions: Action[] = audience === 'landlord' ? [
    { label: 'Add property', detail: 'Grow your portfolio', icon: 'business-outline', navigate: () => navigation.navigate('Properties', { screen: 'AddProperty' }) },
    { label: 'Add expense', detail: 'Record a property expense', icon: 'receipt-outline', navigate: () => navigation.navigate('Dashboard', { screen: 'AddExpense' }) },
    { label: 'Add tenant', detail: 'Invite a renter', icon: 'person-add-outline', navigate: () => navigation.navigate('Tenants', { screen: 'AddTenant' }) },
    { label: 'Property checklists', detail: 'Open move-in and move-out lists', icon: 'clipboard-outline', navigate: () => navigation.navigate('Checklists', { screen: 'ChecklistPropertySearch' }) },
    { label: 'Leases', detail: 'Review rent and balances', icon: 'document-text-outline', navigate: () => navigation.navigate('Leases') },
  ] : [
    { label: 'Report an issue', detail: 'Start a maintenance request', icon: 'construct-outline', navigate: () => navigation.navigate('Maintenance', { screen: 'TenantMaintenanceIntake' }) },
    { label: 'Messages', detail: 'Open your conversations', icon: 'chatbubbles-outline', navigate: () => navigation.navigate('Messages') },
  ];

  const visibleRoutes = state.routes.filter((route) => !['Notifications', 'Tenants', 'Leases'].includes(route.name)
    && !(audience === 'landlord' && ['Checklists', 'Settings'].includes(route.name)));
  const midpoint = dockSplitIndex(visibleRoutes.length);
  const renderTab = (route: typeof visibleRoutes[number]) => {
    const index = state.routes.findIndex((item) => item.key === route.key);
    const selected = state.index === index;
    const label = typeof descriptors[route.key].options.tabBarLabel === 'string'
      ? descriptors[route.key].options.tabBarLabel as string : route.name;
    const icon = mainTabIconNames(route.name);
    return (
      <Pressable
        key={route.key}
        style={[styles.tab, selected && { backgroundColor: mode === 'dark' ? 'rgba(255,255,255,0.16)' : 'rgba(255,255,255,0.48)' }]}
        accessibilityRole="tab"
        accessibilityState={{ selected }}
        accessibilityLabel={label}
        onPress={() => {
          if (open) hideSheet();
          const event = navigation.emit({ type: 'tabPress', target: route.key, canPreventDefault: true });
          if (!selected && !event.defaultPrevented) navigation.navigate(route.name);
        }}
        onLongPress={() => navigation.emit({ type: 'tabLongPress', target: route.key })}
      >
        {icon && <Ionicons name={(selected ? icon.active : icon.inactive) as keyof typeof Ionicons.glyphMap} size={22} color={selected ? (mode === 'dark' ? '#fff' : '#0b3558') : (mode === 'dark' ? '#b4c3d0' : '#385369')} />}
        <Text numberOfLines={1} style={[styles.tabText, { color: selected ? (mode === 'dark' ? '#fff' : '#0b3558') : (mode === 'dark' ? '#b4c3d0' : '#385369') }]}>{label}</Text>
      </Pressable>
    );
  };

  return (
    <View style={[styles.dockArea, { bottom: Math.max(insets.bottom, 10) + 6 }]}>
      <View style={[styles.pill, { backgroundColor: mode === 'dark' ? 'rgba(34, 47, 62, 0.82)' : 'rgba(241, 245, 245, 0.82)', borderColor: mode === 'dark' ? 'rgba(255,255,255,0.22)' : 'rgba(255,255,255,0.75)' }]} accessibilityRole="tablist">
        {visibleRoutes.slice(0, midpoint).map(renderTab)}
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Quick actions"
          accessibilityHint="Opens quick actions from the bottom"
          accessibilityState={{ expanded: open }}
          style={[styles.plusButton, { backgroundColor: mode === 'dark' ? '#ffffff' : '#0b3558' }]}
          onPress={showSheet}
        >
          <Animated.View style={{ transform: [{ rotate: spin.interpolate({ inputRange: [0, 1], outputRange: ['0deg', '45deg'] }) }] }}>
            <Ionicons name="add" size={29} color={mode === 'dark' ? '#081e32' : '#ffffff'} />
          </Animated.View>
        </Pressable>
        {visibleRoutes.slice(midpoint).map(renderTab)}
        {visibleRoutes.length % 2 !== 0 && <View style={styles.tab} accessibilityElementsHidden importantForAccessibility="no-hide-descendants" />}
      </View>
      <Modal visible={open} transparent animationType="none" onShow={() => {
        Animated.timing(sheetOffset, { toValue: 0, duration: 300, useNativeDriver: true }).start();
      }} onRequestClose={() => hideSheet()}>
        <View style={styles.modalRoot}>
          <Pressable style={styles.backdrop} accessibilityLabel="Close quick actions" onPress={() => hideSheet()} />
          <Animated.View style={[styles.sheet, { backgroundColor: colors.surface, paddingBottom: Math.max(insets.bottom, 18) + 12, transform: [{ translateY: sheetOffset }] }]}>
            <View style={[styles.handle, { backgroundColor: colors.border }]} />
            <View style={styles.sheetHeader}>
              <View>
                <Text style={[styles.sheetEyebrow, mode === 'dark' && { color: '#7bd793' }]}>PROPERTY PEACE</Text>
                <Text style={[styles.sheetTitle, { color: colors.text }]}>Quick actions</Text>
              </View>
              <Pressable style={[styles.closeButton, { backgroundColor: colors.background }]} accessibilityRole="button" accessibilityLabel="Close quick actions" onPress={() => hideSheet()}>
                <Ionicons name="close" size={22} color={colors.text} />
              </Pressable>
            </View>
            <ScrollView bounces={false} style={styles.actionScroll}>
              {actions.map((action) => (
                <Pressable key={action.label} style={[styles.action, { borderTopColor: colors.border }]} accessibilityRole="button" accessibilityLabel={action.label} onPress={() => hideSheet(action.navigate)}>
                  <View style={[styles.actionIcon, { backgroundColor: colors.background }]}><Ionicons name={action.icon} size={22} color={colors.accent} /></View>
                  <View style={styles.actionCopy}>
                    <Text style={[styles.actionLabel, { color: colors.text }]}>{action.label}</Text>
                    <Text style={[styles.actionDetail, { color: colors.muted }]}>{action.detail}</Text>
                  </View>
                  <Ionicons name="arrow-forward" size={19} color={colors.muted} />
                </Pressable>
              ))}
            </ScrollView>
          </Animated.View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  dockArea: { position: 'absolute', left: 16, right: 16, zIndex: 10 },
  pill: { minHeight: 72, borderRadius: 38, borderWidth: 1, padding: 5, flexDirection: 'row', alignItems: 'center', shadowColor: '#001a33', shadowOpacity: 0.22, shadowRadius: 16, shadowOffset: { width: 0, height: 7 }, elevation: 10 },
  tab: { flex: 1, minWidth: 0, minHeight: 60, borderRadius: 30, alignItems: 'center', justifyContent: 'center', gap: 2 },
  tabText: { fontSize: 10, fontWeight: '700', textAlign: 'center' },
  plusButton: { width: 56, height: 56, borderRadius: 28, marginHorizontal: 2, alignItems: 'center', justifyContent: 'center', shadowColor: '#001a33', shadowOpacity: 0.22, shadowRadius: 8, shadowOffset: { width: 0, height: 3 }, elevation: 5 },
  modalRoot: { flex: 1, justifyContent: 'flex-end' },
  backdrop: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(4, 20, 35, 0.52)' },
  sheet: { maxHeight: '78%', borderTopLeftRadius: 28, borderTopRightRadius: 28, paddingHorizontal: 24, paddingTop: 10, shadowColor: '#001a33', shadowOpacity: 0.18, shadowRadius: 20, elevation: 18 },
  handle: { alignSelf: 'center', width: 38, height: 4, borderRadius: 2, marginBottom: 24 },
  sheetHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 18 },
  sheetEyebrow: { color: '#2f8f46', fontSize: 11, fontWeight: '800', letterSpacing: 1.2, marginBottom: 5 },
  sheetTitle: { fontSize: 26, fontWeight: '800', letterSpacing: -0.6 },
  closeButton: { width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center' },
  actionScroll: { flexGrow: 0 },
  action: { minHeight: 72, flexDirection: 'row', alignItems: 'center', gap: 14, borderTopWidth: 1 },
  actionIcon: { width: 46, height: 46, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
  actionCopy: { flex: 1, minWidth: 0 },
  actionLabel: { fontSize: 16, fontWeight: '800' },
  actionDetail: { fontSize: 13, marginTop: 3 },
});
