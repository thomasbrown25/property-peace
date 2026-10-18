import React, { createContext, useContext, useEffect, useMemo, useRef } from 'react';
import { Animated, Easing, StyleSheet, useWindowDimensions } from 'react-native';
import { useIsFocused } from '@react-navigation/native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import QuickActionsTabBar from './QuickActionsTabBar';
import { MoreDrawerProvider } from './MoreDrawerContext';

import {
  LeasesStackParamList,
  MainTabParamList,
  MaintenanceStackParamList,
  MessagesStackParamList,
  PropertiesStackParamList,
  TenantsStackParamList,
  VendorsStackParamList,
} from './types';
import type { DashboardStackParamList } from './types';

import DashboardScreen from '../screens/landlord/DashboardScreen';
import RentCollectionScreen from '../screens/landlord/RentCollectionScreen';
import AddExpenseScreen from '../screens/landlord/AddExpenseScreen';
import PropertiesScreen from '../screens/landlord/PropertiesScreen';
import PropertyDetailScreen from '../screens/landlord/PropertyDetailScreen';
import AddPropertyScreen from '../screens/landlord/AddPropertyScreen';

import TenantsScreen from '../screens/landlord/TenantsScreen';
import TenantDetailScreen from '../screens/landlord/TenantDetailScreen';
import VendorsScreen from '../screens/landlord/VendorsScreen';
import VendorDetailScreen from '../screens/landlord/VendorDetailScreen';
import TeamScreen from '../screens/landlord/TeamScreen';
import AnnouncementsScreen from '../screens/landlord/AnnouncementsScreen';
import FinancesScreen from '../screens/landlord/FinancesScreen';
import ListingsScreen from '../screens/landlord/ListingsScreen';
import ApplicationsScreen from '../screens/landlord/ApplicationsScreen';
import AddTenantScreen from '../screens/landlord/AddTenantScreen';
import MaintenanceScreen from '../screens/landlord/MaintenanceScreen';
import AddMaintenanceRequestScreen from '../screens/landlord/AddMaintenanceRequestScreen';
import LandlordMaintenanceDetailScreen from '../screens/landlord/LandlordMaintenanceDetailScreen';
import LeasesScreen from '../screens/landlord/LeasesScreen';
import AddLeaseScreen from '../screens/landlord/AddLeaseScreen';
import LeaseDetailScreen from '../screens/landlord/LeaseDetailScreen';

import MessagesScreen from '../screens/landlord/MessagesScreen';
import ConversationDetailScreen from '../screens/landlord/ConversationDetailScreen';
import NotificationsScreen from '../screens/landlord/NotificationsScreen';
import SettingsScreen from '../screens/landlord/SettingsScreen';
import TenantMaintenanceScreen from '../screens/tenant/TenantMaintenanceScreen';
import TenantMaintenanceIntakeScreen from '../screens/tenant/TenantMaintenanceIntakeScreen';
import TenantMaintenanceDetailScreen from '../screens/tenant/TenantMaintenanceDetailScreen';
import TenantMaintenanceReceiptScreen from '../screens/tenant/TenantMaintenanceReceiptScreen';
import MaintenanceEmergencyScreen from '../screens/tenant/MaintenanceEmergencyScreen';
import { useAppSelector } from '../store/hooks';
import { maintenanceAudience } from '../features/maintenance/maintenanceModel';
import ChecklistsNavigator from './ChecklistsNavigator';
import { resolveVisibleMainTabs, type MainTabComponentRegistry } from './mainTabModel';
import UnsupportedRoleScreen from '../screens/UnsupportedRoleScreen';
import { useAppTheme } from '../theme/AppTheme';
import PageBackButton from '../components/PageBackButton';

// A tab's stack stays mounted; animate the scene only when the tab itself gains focus.
const TabMotionContext = createContext<{ previous: React.MutableRefObject<number | null> } | null>(null);

function withTabTransition<P extends object>(Screen: React.ComponentType<P>, tabIndex: number) {
  return function TabTransition(props: P) {
    const focused = useIsFocused();
    const motion = useContext(TabMotionContext);
    const { width } = useWindowDimensions();
    const offset = useRef(new Animated.Value(0)).current;
    const opacity = useRef(new Animated.Value(1)).current;
    useEffect(() => {
      if (!focused || !motion) return;
      const previous = motion.previous.current;
      motion.previous.current = tabIndex;
      if (previous === null || previous === tabIndex) {
        offset.setValue(0);
        opacity.setValue(1);
        return;
      }
      offset.stopAnimation();
      opacity.stopAnimation();
      offset.setValue((tabIndex > previous ? 1 : -1) * Math.min(width * 0.18, 72));
      opacity.setValue(0.75);
      const animation = Animated.parallel([
        Animated.timing(offset, { toValue: 0, duration: 260, easing: Easing.out(Easing.cubic), useNativeDriver: true }),
        Animated.timing(opacity, { toValue: 1, duration: 260, useNativeDriver: true }),
      ]);
      animation.start();
      return () => animation.stop();
    }, [focused, motion, offset, opacity, width]);
    return (
      <Animated.View style={[styles.tabScene, {
        opacity,
        transform: [{ translateX: offset }],
      }]}>
        <Screen {...props} />
      </Animated.View>
    );
  };
}

const styles = StyleSheet.create({ tabScene: { flex: 1 } });
const Tab = createBottomTabNavigator<MainTabParamList>();
const DashboardStack = createNativeStackNavigator<DashboardStackParamList>();
const PropertiesStack = createNativeStackNavigator<PropertiesStackParamList>();
const MaintenanceStack = createNativeStackNavigator<MaintenanceStackParamList>();
const MessagesStack = createNativeStackNavigator<MessagesStackParamList>();
const TenantsStack = createNativeStackNavigator<TenantsStackParamList>();
const VendorsStack = createNativeStackNavigator<VendorsStackParamList>();
const LeasesStack = createNativeStackNavigator<LeasesStackParamList>();

function useStackOptions() {
  const { mode, colors } = useAppTheme();
  const background = mode === 'dark' ? colors.background : '#fbf7f4';
  return {
    headerTintColor: mode === 'dark' ? colors.text : '#0b3558',
    headerTitleStyle: { fontWeight: '800' as const, color: colors.text },
    headerShadowVisible: false,
    headerStyle: { backgroundColor: background },
    contentStyle: { backgroundColor: background },
  };
}

function DashboardNavigator() {
  const stackOptions = useStackOptions();
  return (
    <DashboardStack.Navigator screenOptions={stackOptions}>
      <DashboardStack.Screen name="DashboardHome" component={DashboardScreen} options={{ headerShown: false }} />
      <DashboardStack.Screen name="RentCollection" component={RentCollectionScreen} options={{ headerShown: false }} />
      <DashboardStack.Screen name="AddExpense" component={AddExpenseScreen} options={{ title: 'Add expense' }} />
    </DashboardStack.Navigator>
  );
}

function PropertiesNavigator() {
  const stackOptions = useStackOptions();
  return (
    <PropertiesStack.Navigator screenOptions={stackOptions}>
      <PropertiesStack.Screen name="PropertiesList" component={PropertiesScreen} options={{ headerShown: false }} />
      <PropertiesStack.Screen name="PropertyDetail" component={PropertyDetailScreen} options={({ navigation }) => ({ title: 'Property', headerBackVisible: false, headerLeft: () => <PageBackButton inHeader onPress={() => navigation.popToTop()} /> })} />
      <PropertiesStack.Screen name="PropertyMaintenance" component={MaintenanceScreen} options={{ headerShown: false }} />
      <PropertiesStack.Screen name="AddMaintenanceRequest" component={AddMaintenanceRequestScreen} options={{ title: 'Add request' }} />
      <PropertiesStack.Screen name="LandlordMaintenanceDetail" component={LandlordMaintenanceDetailScreen} options={({ route }) => ({ title: `Maintenance #${route.params.requestId}`, headerTitleAlign: 'center', headerBackVisible: false, headerLeft: () => <PageBackButton inHeader /> })} />
      <PropertiesStack.Screen name="AddProperty" component={AddPropertyScreen} options={{ title: 'Add property' }} />

    </PropertiesStack.Navigator>
  );
}

function MaintenanceNavigator({ tenant = false }: { tenant?: boolean }) {
  const stackOptions = useStackOptions();
  return (
    <MaintenanceStack.Navigator screenOptions={stackOptions}>
      {tenant ? <>
        <MaintenanceStack.Screen name="TenantMaintenanceList" component={TenantMaintenanceScreen} options={{ title: 'Maintenance', headerLeft: () => <PageBackButton /> }} />
        <MaintenanceStack.Screen name="TenantMaintenanceIntake" component={TenantMaintenanceIntakeScreen} options={{ title: 'Report an issue' }} />
        <MaintenanceStack.Screen name="MaintenanceEmergency" component={MaintenanceEmergencyScreen} options={{ title: 'Emergency safety', presentation: 'modal' }} />
        <MaintenanceStack.Screen name="TenantMaintenanceReceipt" component={TenantMaintenanceReceiptScreen} options={{ title: 'Report received', headerBackVisible: false }} />
        <MaintenanceStack.Screen name="TenantMaintenanceDetail" component={TenantMaintenanceDetailScreen} options={{ title: 'Request detail' }} />
      </> : <>
        <MaintenanceStack.Screen name="MaintenanceList" component={MaintenanceScreen} options={{ headerShown: false }} />
        <MaintenanceStack.Screen name="AddMaintenanceRequest" component={AddMaintenanceRequestScreen} options={{ title: 'Add request' }} />
        <MaintenanceStack.Screen name="LandlordMaintenanceDetail" component={LandlordMaintenanceDetailScreen} options={({ route }) => ({ title: `Maintenance #${route.params.requestId}`, headerTitleAlign: 'center', headerBackVisible: false, headerLeft: () => <PageBackButton inHeader /> })} />
      </>}
    </MaintenanceStack.Navigator>
  );
}

function TenantMaintenanceNavigator() {
  return <MaintenanceNavigator tenant />;
}


function MessagesNavigator() {
  const stackOptions = useStackOptions();
  return (
    <MessagesStack.Navigator screenOptions={stackOptions}>
      <MessagesStack.Screen name="MessagesList" component={MessagesScreen} options={{ headerShown: false }} />
      <MessagesStack.Screen name="ConversationDetail" component={ConversationDetailScreen} options={{ title: 'Conversation' }} />
    </MessagesStack.Navigator>
  );
}

function TenantsNavigator() {
  const stackOptions = useStackOptions();
  return (
    <TenantsStack.Navigator screenOptions={stackOptions}>
      <TenantsStack.Screen name="TenantsList" component={TenantsScreen} options={{ headerShown: false }} />
      <TenantsStack.Screen name="TenantDetail" component={TenantDetailScreen} options={({ navigation }) => ({ title: 'Tenant', headerBackVisible: false, headerLeft: () => <PageBackButton inHeader onPress={() => navigation.goBack()} /> })} />
      <TenantsStack.Screen name="AddTenant" component={AddTenantScreen} options={{ title: 'Add tenant' }} />
    </TenantsStack.Navigator>
  );
}

function VendorsNavigator() {
  const stackOptions = useStackOptions();
  return <VendorsStack.Navigator screenOptions={stackOptions}>
    <VendorsStack.Screen name="VendorsList" component={VendorsScreen} options={{ headerShown: false }} />
    <VendorsStack.Screen name="VendorDetail" component={VendorDetailScreen} options={{ title: 'Vendor', headerBackVisible: false, headerLeft: () => <PageBackButton inHeader /> }} />
    <VendorsStack.Screen name="VendorMaintenanceDetail" component={LandlordMaintenanceDetailScreen} options={{ title: 'Maintenance' }} />
  </VendorsStack.Navigator>;
}

function LeasesNavigator() {
  const stackOptions = useStackOptions();
  return (
    <LeasesStack.Navigator screenOptions={stackOptions}>
      <LeasesStack.Screen name="LeasesList" component={LeasesScreen} options={{ headerShown: false }} />
      <LeasesStack.Screen name="AddLease" component={AddLeaseScreen} options={{ headerShown: false }} />
      <LeasesStack.Screen name="LeaseDetail" component={LeaseDetailScreen} options={({ navigation }) => ({ title: 'Lease', headerBackVisible: false, headerLeft: () => <PageBackButton inHeader onPress={() => navigation.goBack()} /> })} />

    </LeasesStack.Navigator>
  );
}

export default function MainNavigator() {
  const currentUser = useAppSelector((state) => state.user.currentUser);
  const audience = maintenanceAudience(currentUser);
  const visibleComponents: MainTabComponentRegistry<React.ComponentType<any>> = {
    DashboardScreen: DashboardNavigator,
    PropertiesNavigator,
    ChecklistsNavigator,
    MaintenanceNavigator,
    TenantMaintenanceNavigator,
    TenantsNavigator,

    MessagesNavigator,
    SettingsScreen,
  };
  const visibleTabs = resolveVisibleMainTabs(audience, visibleComponents);
  const animatedTabs = useMemo(() => visibleTabs.map((tab, index) => ({ ...tab, component: withTabTransition(tab.component, index) })), [audience]);
  const motion = useRef<{ previous: React.MutableRefObject<number | null> }>({ previous: { current: null } }).current;

  if (audience === 'unsupported') return <UnsupportedRoleScreen />;

  return (
    <TabMotionContext.Provider value={motion}>
    <MoreDrawerProvider>
    <Tab.Navigator
      tabBar={(props) => <QuickActionsTabBar {...props} audience={audience} />}
      screenOptions={{ headerShown: false }}
    >
      {animatedTabs.map((tab) => {
        return <Tab.Screen key={tab.name} name={tab.name} component={tab.component} options={tab.label ? { tabBarLabel: tab.label } : undefined} />;
      })}
      {audience === 'landlord' && <>
        <Tab.Screen name="Vendors" component={VendorsNavigator} options={{ tabBarButton: () => null }} />
        <Tab.Screen name="Team" component={TeamScreen} options={{ tabBarButton: () => null }} />
        <Tab.Screen name="Announcements" component={AnnouncementsScreen} options={{ tabBarButton: () => null }} />
        <Tab.Screen name="Finances" component={FinancesScreen} options={{ tabBarButton: () => null }} />
        <Tab.Screen name="Checklists" component={ChecklistsNavigator} options={{ tabBarButton: () => null }} />
        <Tab.Screen name="Notifications" component={NotificationsScreen} options={{ tabBarButton: () => null }} />
        <Tab.Screen name="Messages" component={MessagesNavigator} options={{ tabBarButton: () => null }} />
        <Tab.Screen name="Leases" component={LeasesNavigator} options={{ tabBarButton: () => null }} />
        <Tab.Screen name="Applications" component={ApplicationsScreen} options={{ tabBarButton: () => null }} />
        <Tab.Screen name="Listings" component={ListingsScreen} options={{ tabBarButton: () => null }} />
        <Tab.Screen name="Settings" component={SettingsScreen} options={{ tabBarButton: () => null }} />
      </>}
    </Tab.Navigator>
    </MoreDrawerProvider>
    </TabMotionContext.Provider>
  );
}
