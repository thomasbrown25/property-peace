import React, { useState } from 'react';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { ScrollView, StyleSheet, TouchableOpacity, View, Text } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { MainTabParamList, PropertiesStackParamList, LeasesStackParamList, MessagesStackParamList, TenantsStackParamList, MaintenanceStackParamList } from './types';
import SimpleDrawer from '../components/SimpleDrawer';

import DashboardScreen from '../screens/landlord/DashboardScreen';
import PropertiesScreen from '../screens/landlord/PropertiesScreen';
import PropertyDetailScreen from '../screens/landlord/PropertyDetailScreen';
import AddPropertyScreen from '../screens/landlord/AddPropertyScreen';
import TenantsScreen from '../screens/landlord/TenantsScreen';
import AddTenantScreen from '../screens/landlord/AddTenantScreen';
import MaintenanceScreen from '../screens/landlord/MaintenanceScreen';
import AddMaintenanceScreen from '../screens/landlord/AddMaintenanceScreen';
import LeasesScreen from '../screens/landlord/LeasesScreen';
import LeaseDetailScreen from '../screens/landlord/LeaseDetailScreen';
import AddLeaseScreen from '../screens/landlord/AddLeaseScreen';
import MessagesScreen from '../screens/landlord/MessagesScreen';
import ConversationDetailScreen from '../screens/landlord/ConversationDetailScreen';
import NotificationsScreen from '../screens/landlord/NotificationsScreen';
import SettingsScreen from '../screens/landlord/SettingsScreen';

const Tab = createBottomTabNavigator<MainTabParamList>();
const PropertiesStack = createNativeStackNavigator<PropertiesStackParamList>();
const TenantsStack = createNativeStackNavigator<TenantsStackParamList>();
const MaintenanceStack = createNativeStackNavigator<MaintenanceStackParamList>();
const LeasesStack = createNativeStackNavigator<LeasesStackParamList>();
const MessagesStack = createNativeStackNavigator<MessagesStackParamList>();

const menuButton = (onMenuPress: () => void, topInset: number) => () => (
  <TouchableOpacity onPress={onMenuPress} style={{ marginLeft: 16, marginTop: topInset > 0 ? 8 : 0 }}>
    <Ionicons name="menu" size={24} color="#1976d2" />
  </TouchableOpacity>
);

function PropertiesNavigator({ onMenuPress }: { onMenuPress: () => void }) {
  const insets = useSafeAreaInsets();
  return (
    <PropertiesStack.Navigator screenOptions={{ headerLeft: menuButton(onMenuPress, insets.top) }}>
      <PropertiesStack.Screen name="PropertiesList" component={PropertiesScreen} options={{ title: 'Properties' }} />
      <PropertiesStack.Screen name="PropertyDetail" component={PropertyDetailScreen} options={{ title: 'Property Details' }} />
      <PropertiesStack.Screen name="AddProperty" component={AddPropertyScreen} options={{ title: 'Add Property' }} />
    </PropertiesStack.Navigator>
  );
}

function TenantsNavigator({ onMenuPress }: { onMenuPress: () => void }) {
  const insets = useSafeAreaInsets();
  return (
    <TenantsStack.Navigator screenOptions={{ headerLeft: menuButton(onMenuPress, insets.top) }}>
      <TenantsStack.Screen name="TenantsList" component={TenantsScreen} options={{ title: 'Tenants' }} />
      <TenantsStack.Screen name="AddTenant" component={AddTenantScreen} options={{ title: 'Add Tenant' }} />
    </TenantsStack.Navigator>
  );
}

function MaintenanceNavigator({ onMenuPress }: { onMenuPress: () => void }) {
  const insets = useSafeAreaInsets();
  return (
    <MaintenanceStack.Navigator screenOptions={{ headerLeft: menuButton(onMenuPress, insets.top) }}>
      <MaintenanceStack.Screen name="MaintenanceList" component={MaintenanceScreen} options={{ title: 'Maintenance' }} />
      <MaintenanceStack.Screen name="AddMaintenance" component={AddMaintenanceScreen} options={{ title: 'Add Maintenance' }} />
    </MaintenanceStack.Navigator>
  );
}

function LeasesNavigator({ onMenuPress }: { onMenuPress: () => void }) {
  const insets = useSafeAreaInsets();
  return (
    <LeasesStack.Navigator screenOptions={{ headerLeft: menuButton(onMenuPress, insets.top) }}>
      <LeasesStack.Screen name="LeasesList" component={LeasesScreen} options={{ title: 'Leases' }} />
      <LeasesStack.Screen name="LeaseDetail" component={LeaseDetailScreen} options={{ title: 'Lease Details' }} />
      <LeasesStack.Screen name="AddLease" component={AddLeaseScreen} options={{ title: 'Add Lease' }} />
    </LeasesStack.Navigator>
  );
}

function MessagesNavigator({ onMenuPress }: { onMenuPress: () => void }) {
  const insets = useSafeAreaInsets();
  return (
    <MessagesStack.Navigator screenOptions={{ headerLeft: menuButton(onMenuPress, insets.top) }}>
      <MessagesStack.Screen name="MessagesList" component={MessagesScreen} options={{ title: 'Messages' }} />
      <MessagesStack.Screen name="ConversationDetail" component={ConversationDetailScreen} options={{ title: 'Conversation' }} />
    </MessagesStack.Navigator>
  );
}

function HeaderWrapper({ onMenuPress, title, children }: { onMenuPress: () => void; title: string; children: React.ReactNode }) {
  const insets = useSafeAreaInsets();
  return (
    <>
      <View style={{ flexDirection: 'row', alignItems: 'center', padding: 16, paddingTop: Math.max(insets.top + 8, 24), backgroundColor: '#fff', borderBottomWidth: 1, borderBottomColor: '#e0e0e0' }}>
        <TouchableOpacity onPress={onMenuPress} style={{ marginRight: 16 }}><Ionicons name="menu" size={24} color="#1976d2" /></TouchableOpacity>
        <Text style={{ fontSize: 20, fontWeight: 'bold', color: '#333' }}>{title}</Text>
      </View>
      {children}
    </>
  );
}

function PlaceholderScreen() {
  return null;
}

function PlusTabButton({ onPress }: { onPress: () => void }) {
  return (
    <TouchableOpacity style={tabStyles.plusButtonWrap} onPress={onPress} activeOpacity={0.85}>
      <View style={tabStyles.plusButton}>
        <Ionicons name="add" size={34} color="#fff" />
      </View>
    </TouchableOpacity>
  );
}

function MoreTabButton({ onPress, isOpen }: { onPress: () => void; isOpen: boolean }) {
  return (
    <TouchableOpacity style={[tabStyles.moreButton, isOpen && tabStyles.moreButtonOpen]} onPress={onPress} activeOpacity={0.8}>
      <Ionicons name={isOpen ? 'close-outline' : 'grid-outline'} size={32} color="#fff" />
      <Text style={tabStyles.moreLabel}>{isOpen ? 'Close' : 'More'}</Text>
    </TouchableOpacity>
  );
}

function TabNavigator({ onMenuPress, onMorePress, moreMenuVisible }: { onMenuPress: () => void; onMorePress: () => void; moreMenuVisible: boolean }) {
  const insets = useSafeAreaInsets();
  const navigation = useNavigation<any>();
  const bottomInset = Math.max(insets.bottom, 8);
  return (
    <Tab.Navigator
      screenOptions={({ route }) => ({
        headerShown: false,
        tabBarActiveTintColor: '#fff',
        tabBarInactiveTintColor: 'rgba(255,255,255,0.88)',
        tabBarLabelStyle: { fontSize: 12, fontWeight: '500', marginTop: 0 },
        tabBarIconStyle: { marginTop: 6 },
        tabBarStyle: {
          position: 'absolute',
          left: 0,
          right: 0,
          bottom: 0,
          height: 72 + bottomInset,
          paddingTop: 10,
          paddingBottom: bottomInset,
          backgroundColor: '#082f58',
          borderTopWidth: 0,
          elevation: 12,
          shadowColor: '#001a33',
          shadowOpacity: 0.25,
          shadowRadius: 14,
          shadowOffset: { width: 0, height: -4 },
        },
        tabBarIcon: ({ color, size }) => {
          const icons: Record<string, keyof typeof Ionicons.glyphMap> = {
            Dashboard: 'speedometer-outline',
            Properties: 'home-outline',
            Messages: 'chatbubble-ellipses-outline',
            Notifications: 'notifications-outline',
            Maintenance: 'construct-outline',
            Tenants: 'people-outline',
            Leases: 'document-text-outline',
            Settings: 'settings-outline',
          };
          if (route.name === 'QuickAdd' || route.name === 'More') return null;
          return <Ionicons name={icons[route.name] || 'ellipse-outline'} size={size + 2} color={color} />;
        },
      })}
    >
      <Tab.Screen name="Dashboard" options={{ tabBarLabel: 'Dashboard' }}>{() => <DashboardScreen onMenuPress={onMenuPress} />}</Tab.Screen>
      <Tab.Screen name="Properties" options={{ tabBarLabel: 'Properties' }}>{() => <PropertiesNavigator onMenuPress={onMenuPress} />}</Tab.Screen>
      <Tab.Screen
        name="QuickAdd"
        component={PlaceholderScreen}
        options={{
          tabBarLabel: '',
          tabBarButton: () => <PlusTabButton onPress={() => navigation.navigate('Properties', { screen: 'AddProperty' })} />,
        }}
      />
      <Tab.Screen name="Messages" options={{ tabBarLabel: 'Messages' }}>{() => <MessagesNavigator onMenuPress={onMenuPress} />}</Tab.Screen>
      <Tab.Screen
        name="More"
        component={PlaceholderScreen}
        options={{
          tabBarLabel: 'More',
          tabBarButton: () => <MoreTabButton onPress={onMorePress} isOpen={moreMenuVisible} />,
        }}
      />
      <Tab.Screen name="Notifications" options={{ tabBarButton: () => null }}>{() => <HeaderWrapper onMenuPress={onMenuPress} title="Notifications"><NotificationsScreen /></HeaderWrapper>}</Tab.Screen>
      <Tab.Screen name="Maintenance" options={{ tabBarButton: () => null }}>{() => <MaintenanceNavigator onMenuPress={onMenuPress} />}</Tab.Screen>
      <Tab.Screen name="Tenants" options={{ tabBarButton: () => null }}>{() => <TenantsNavigator onMenuPress={onMenuPress} />}</Tab.Screen>
      <Tab.Screen name="Leases" options={{ tabBarButton: () => null }}>{() => <LeasesNavigator onMenuPress={onMenuPress} />}</Tab.Screen>
      <Tab.Screen name="Settings" options={{ tabBarButton: () => null }}>{() => <HeaderWrapper onMenuPress={onMenuPress} title="Settings"><SettingsScreen /></HeaderWrapper>}</Tab.Screen>
    </Tab.Navigator>
  );
}

const moreMenuItems: Array<{ label: string; icon: keyof typeof Ionicons.glyphMap; action: (navigation: any) => void }> = [
  { label: 'Dashboard', icon: 'speedometer-outline', action: (navigation) => navigation.navigate('Dashboard') },
  { label: 'Calendar', icon: 'calendar-outline', action: () => {} },
  { label: 'Messages', icon: 'chatbubble-ellipses-outline', action: (navigation) => navigation.navigate('Messages') },
  { label: 'Properties', icon: 'home-outline', action: (navigation) => navigation.navigate('Properties') },
  { label: 'Tenants', icon: 'person-outline', action: (navigation) => navigation.navigate('Tenants') },
  { label: 'Leases', icon: 'cash-outline', action: (navigation) => navigation.navigate('Leases') },
  { label: 'Listings', icon: 'rocket-outline', action: (navigation) => navigation.navigate('Properties') },
  { label: 'Expenses', icon: 'trending-down-outline', action: (navigation) => navigation.navigate('Leases') },
  { label: 'Payments', icon: 'arrow-up-outline', action: (navigation) => navigation.navigate('Leases') },
  { label: 'Ledger', icon: 'create-outline', action: (navigation) => navigation.navigate('Leases') },
  { label: 'Reports &\nAnalytics', icon: 'analytics-outline', action: (navigation) => navigation.navigate('Dashboard') },
  { label: 'Team & Staff', icon: 'people-outline', action: (navigation) => navigation.navigate('Settings') },
  { label: 'Announcements', icon: 'megaphone-outline', action: (navigation) => navigation.navigate('Notifications') },
  { label: 'Maintenance', icon: 'build-outline', action: (navigation) => navigation.navigate('Maintenance') },
  { label: 'Vendors', icon: 'storefront-outline', action: (navigation) => navigation.navigate('Maintenance') },
  { label: 'Inspections', icon: 'clipboard-outline', action: (navigation) => navigation.navigate('Maintenance') },
  { label: 'AI Center', icon: 'sparkles-outline', action: (navigation) => navigation.navigate('Dashboard') },
  { label: 'LeaseShield', icon: 'shield-checkmark-outline', action: (navigation) => navigation.navigate('Leases') },
  { label: 'Help &\nSupport', icon: 'headset-outline', action: (navigation) => navigation.navigate('Settings') },
  { label: 'Subscription', icon: 'card-outline', action: (navigation) => navigation.navigate('Settings') },
  { label: 'Settings', icon: 'settings-outline', action: (navigation) => navigation.navigate('Settings') },
];

function BottomMoreMenu({ visible, onClose }: { visible: boolean; onClose: () => void }) {
  const insets = useSafeAreaInsets();
  const navigation = useNavigation<any>();
  if (!visible) return null;

  return (
    <View style={[tabStyles.moreSheet, { bottom: 72 + Math.max(insets.bottom, 8) }]} pointerEvents="box-none">
      <ScrollView contentContainerStyle={tabStyles.moreSheetContent} showsVerticalScrollIndicator={false}>
        {moreMenuItems.map((item) => (
          <TouchableOpacity
            key={item.label}
            style={tabStyles.moreMenuItem}
            onPress={() => {
              onClose();
              item.action(navigation);
            }}
            activeOpacity={0.78}
          >
            <Ionicons name={item.icon} size={31} color="#fff" />
            <Text style={tabStyles.moreMenuText}>{item.label}</Text>
          </TouchableOpacity>
        ))}
      </ScrollView>
    </View>
  );
}

export default function MainNavigator() {
  const [drawerVisible, setDrawerVisible] = useState(false);
  const [moreMenuVisible, setMoreMenuVisible] = useState(false);
  const navigation = useNavigation();

  return (
    <>
      <TabNavigator
        onMenuPress={() => setDrawerVisible(true)}
        onMorePress={() => setMoreMenuVisible((visible) => !visible)}
        moreMenuVisible={moreMenuVisible}
      />
      <BottomMoreMenu visible={moreMenuVisible} onClose={() => setMoreMenuVisible(false)} />
      <SimpleDrawer visible={drawerVisible} onClose={() => setDrawerVisible(false)} navigation={navigation} />
    </>
  );
}

const tabStyles = StyleSheet.create({
  plusButtonWrap: {
    top: -18,
    alignItems: 'center',
    justifyContent: 'center',
    width: 86,
    height: 86,
  },
  plusButton: {
    width: 74,
    height: 74,
    borderRadius: 37,
    backgroundColor: '#062945',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: 'rgba(255,255,255,0.12)',
    shadowColor: '#001a33',
    shadowOpacity: 0.36,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 6 },
    elevation: 9,
  },
  moreButton: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingTop: 7,
  },
  moreButtonOpen: {
    backgroundColor: 'rgba(255,255,255,0.09)',
  },
  moreLabel: {
    marginTop: 2,
    color: '#fff',
    fontSize: 12,
    fontWeight: '500',
  },
  moreSheet: {
    position: 'absolute',
    left: 0,
    right: 0,
    top: 214,
    backgroundColor: '#082f58',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    overflow: 'hidden',
    shadowColor: '#001a33',
    shadowOpacity: 0.28,
    shadowRadius: 18,
    shadowOffset: { width: 0, height: -6 },
    elevation: 14,
    zIndex: 20,
  },
  moreSheetContent: {
    paddingHorizontal: 18,
    paddingTop: 28,
    paddingBottom: 28,
    flexDirection: 'row',
    flexWrap: 'wrap',
  },
  moreMenuItem: {
    width: '25%',
    minHeight: 92,
    alignItems: 'center',
    justifyContent: 'flex-start',
    paddingHorizontal: 4,
    paddingVertical: 10,
  },
  moreMenuText: {
    color: '#fff',
    fontSize: 15,
    lineHeight: 18,
    textAlign: 'center',
    marginTop: 9,
    fontWeight: '500',
  },
});
