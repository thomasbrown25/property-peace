import React, { useState } from 'react';
import { Ionicons } from '@expo/vector-icons';
import type { BottomTabBarProps } from '@react-navigation/bottom-tabs';
import { Modal, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { mainTabIconNames, type MainAudience } from './mainTabModel';

type Action = { label: string; detail: string; icon: keyof typeof Ionicons.glyphMap; navigate: () => void };

export default function QuickActionsTabBar({ state, descriptors, navigation, audience }: BottomTabBarProps & { audience: MainAudience }) {
  const insets = useSafeAreaInsets();
  const [open, setOpen] = useState(false);
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

  // A focused detail/form needs its own space and contextual controls, not persistent global actions.
  const focusedRoute = state.routes[state.index];
  const nestedState = focusedRoute.state;
  if (nestedState && nestedState.index !== undefined && nestedState.index > 0) return null;

  const visibleRoutes = state.routes.filter((route) => !['Notifications', 'Tenants', 'Leases'].includes(route.name)
    && !(audience === 'landlord' && ['Checklists', 'Settings'].includes(route.name)));

  return (
    <View style={[styles.dockArea, { paddingBottom: Math.max(insets.bottom, 10) }]}>
      <View style={styles.dockRow}>
        <View style={styles.pill} accessibilityRole="tablist">
          {visibleRoutes.map((route) => {
            const index = state.routes.findIndex((item) => item.key === route.key);
            const selected = state.index === index;
            const label = typeof descriptors[route.key].options.tabBarLabel === 'string'
              ? descriptors[route.key].options.tabBarLabel as string : route.name;
            const icon = mainTabIconNames(route.name);
            return (
              <Pressable
                key={route.key}
                style={[styles.tab, selected && styles.selectedTab]}
                accessibilityRole="tab"
                accessibilityState={{ selected }}
                accessibilityLabel={label}
                onPress={() => {
                  const event = navigation.emit({ type: 'tabPress', target: route.key, canPreventDefault: true });
                  if (!selected && !event.defaultPrevented) navigation.navigate(route.name);
                }}
                onLongPress={() => navigation.emit({ type: 'tabLongPress', target: route.key })}
              >
                {icon && <Ionicons name={(selected ? icon.active : icon.inactive) as keyof typeof Ionicons.glyphMap} size={22} color={selected ? '#ffffff' : '#b9cbd9'} />}
                <Text numberOfLines={1} style={[styles.tabText, selected && styles.selectedText]}>{label}</Text>
              </Pressable>
            );
          })}
        </View>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Quick actions"
          accessibilityHint="Opens quick actions from the bottom"
          accessibilityState={{ expanded: open }}
          style={styles.plusButton}
          onPress={() => setOpen(true)}
        >
          <Ionicons name="add" size={34} color="#ffffff" />
        </Pressable>
      </View>
      <Modal visible={open} transparent animationType="slide" onRequestClose={() => setOpen(false)}>
        <View style={styles.modalRoot}>
          <Pressable style={styles.backdrop} accessibilityLabel="Close quick actions" onPress={() => setOpen(false)} />
          <View style={[styles.sheet, { paddingBottom: Math.max(insets.bottom, 18) + 12 }]}>
            <View style={styles.handle} />
            <View style={styles.sheetHeader}>
              <View>
                <Text style={styles.sheetEyebrow}>PROPERTY PEACE</Text>
                <Text style={styles.sheetTitle}>Quick actions</Text>
              </View>
              <Pressable style={styles.closeButton} accessibilityRole="button" accessibilityLabel="Close quick actions" onPress={() => setOpen(false)}>
                <Ionicons name="close" size={22} color="#17374d" />
              </Pressable>
            </View>
            <ScrollView bounces={false} style={styles.actionScroll}>
              {actions.map((action) => (
                <Pressable key={action.label} style={styles.action} accessibilityRole="button" accessibilityLabel={action.label} onPress={() => { setOpen(false); action.navigate(); }}>
                  <View style={styles.actionIcon}><Ionicons name={action.icon} size={22} color="#0b3558" /></View>
                  <View style={styles.actionCopy}>
                    <Text style={styles.actionLabel}>{action.label}</Text>
                    <Text style={styles.actionDetail}>{action.detail}</Text>
                  </View>
                  <Ionicons name="arrow-forward" size={19} color="#8193a0" />
                </Pressable>
              ))}
            </ScrollView>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  dockArea: { backgroundColor: '#ffffff', paddingTop: 9, paddingHorizontal: 16 },
  dockRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  pill: { flex: 1, minWidth: 0, minHeight: 66, borderRadius: 34, padding: 5, backgroundColor: '#082f58', flexDirection: 'row', alignItems: 'stretch', shadowColor: '#001a33', shadowOpacity: 0.19, shadowRadius: 12, shadowOffset: { width: 0, height: 5 }, elevation: 7 },
  tab: { flex: 1, minWidth: 0, minHeight: 56, borderRadius: 29, alignItems: 'center', justifyContent: 'center', gap: 2 },
  selectedTab: { backgroundColor: '#315374' },
  tabText: { color: '#b9cbd9', fontSize: 10, fontWeight: '700', textAlign: 'center' },
  selectedText: { color: '#ffffff' },
  plusButton: { width: 66, height: 66, borderRadius: 33, backgroundColor: '#082f58', alignItems: 'center', justifyContent: 'center', shadowColor: '#001a33', shadowOpacity: 0.19, shadowRadius: 12, shadowOffset: { width: 0, height: 5 }, elevation: 7 },
  modalRoot: { flex: 1, justifyContent: 'flex-end' },
  backdrop: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(4, 20, 35, 0.52)' },
  sheet: { maxHeight: '78%', backgroundColor: '#ffffff', borderTopLeftRadius: 28, borderTopRightRadius: 28, paddingHorizontal: 24, paddingTop: 10, shadowColor: '#001a33', shadowOpacity: 0.18, shadowRadius: 20, elevation: 18 },
  handle: { alignSelf: 'center', width: 38, height: 4, borderRadius: 2, backgroundColor: '#c7d2d9', marginBottom: 24 },
  sheetHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 18 },
  sheetEyebrow: { color: '#2f8f46', fontSize: 11, fontWeight: '800', letterSpacing: 1.2, marginBottom: 5 },
  sheetTitle: { color: '#061e35', fontSize: 26, fontWeight: '800', letterSpacing: -0.6 },
  closeButton: { width: 44, height: 44, borderRadius: 22, backgroundColor: '#f2f5f6', alignItems: 'center', justifyContent: 'center' },
  actionScroll: { flexGrow: 0 },
  action: { minHeight: 72, flexDirection: 'row', alignItems: 'center', gap: 14, borderTopWidth: 1, borderTopColor: '#e6ebee' },
  actionIcon: { width: 46, height: 46, borderRadius: 14, backgroundColor: '#edf4f8', alignItems: 'center', justifyContent: 'center' },
  actionCopy: { flex: 1, minWidth: 0 },
  actionLabel: { color: '#102d43', fontSize: 16, fontWeight: '800' },
  actionDetail: { color: '#657685', fontSize: 13, marginTop: 3 },
});
