import React, { createContext, useContext, useEffect, useMemo, useRef } from 'react';
import { Animated, Easing, StyleSheet, useWindowDimensions } from 'react-native';
import { useIsFocused } from '@react-navigation/native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import QuickActionsTabBar from './QuickActionsTabBar';
import { MoreDrawerProvider } from './MoreDrawerContext';

import {
  AnnouncementsStackParamList,
  ApplicationsStackParamList,
  ListingsStackParamList,
  LeasesStackParamList,
  MainTabParamList,
  MarketingStackParamList,
  MaintenanceStackParamList,
  MessagesStackParamList,
  PropertiesStackParamList,
  SettingsStackParamList,
  TenantsStackParamList,
  TenantLeasesStackParamList,
  VendorsStackParamList,
} from './types';
import type { DashboardStackParamList } from './types';

import DashboardScreen from '../screens/landlord/DashboardScreen';
import CalendarScreen from '../screens/landlord/CalendarScreen';
import RentCollectionScreen from '../screens/landlord/RentCollectionScreen';
import AddExpenseScreen from '../screens/landlord/AddExpenseScreen';
import PropertiesScreen from '../screens/landlord/PropertiesScreen';
import PropertyDetailScreen from '../screens/landlord/PropertyDetailScreen';
import ShortStayOwnerScreen from '../screens/landlord/ShortStayOwnerScreen';
import AddPropertyScreen from '../screens/landlord/AddPropertyScreen';

import TenantsScreen from '../screens/landlord/TenantsScreen';
import TenantDetailScreen from '../screens/landlord/TenantDetailScreen';
import VendorsScreen from '../screens/landlord/VendorsScreen';
import VendorDetailScreen from '../screens/landlord/VendorDetailScreen';
import TeamScreen from '../screens/landlord/TeamScreen';
import AnnouncementsScreen, { AnnouncementDetailScreen } from '../screens/landlord/AnnouncementsScreen';
import FinancesScreen from '../screens/landlord/FinancesScreen';
import ListingsScreen, { AddListingScreen, ListingDetailScreen } from '../screens/landlord/ListingsScreen';
import ApplicationsScreen, { ApplicationDetailScreen } from '../screens/landlord/ApplicationsScreen';
import MarketingScreen from '../screens/landlord/MarketingScreen';
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
import TenantPaymentsScreen from '../screens/tenant/TenantPaymentsScreen';
import TenantLeasesScreen, { TenantLeaseDetailScreen } from '../screens/tenant/TenantLeasesScreen';
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
const TenantLeasesStack = createNativeStackNavigator<TenantLeasesStackParamList>();
const SettingsStack = createNativeStackNavigator<SettingsStackParamList>();
const ListingsStack = createNativeStackNavigator<ListingsStackParamList>();
const ApplicationsStack = createNativeStackNavigator<ApplicationsStackParamList>();
const MarketingStack = createNativeStackNavigator<MarketingStackParamList>();
const AnnouncementsStack = createNativeStackNavigator<AnnouncementsStackParamList>();

function useStackOptions() {
  const { mode, colors } = useAppTheme();
  const background = colors.background;
  return {
    headerTintColor: mode === 'dark' ? colors.text : '#0b3558',
    // Native iOS otherwise prints the previous screen's title beside the arrow.
    headerBackTitleVisible: false,
    headerTitleStyle: { fontWeight: '800' as const, color: colors.text },
    headerShadowVisible: false,
    headerStyle: { backgroundColor: background },
    contentStyle: { backgroundColor: background },
    animation: 'slide_from_right' as const,
  };
}

function DashboardNavigator() {
  const stackOptions = useStackOptions();
  return (
    <DashboardStack.Navigator screenOptions={stackOptions}>
      <DashboardStack.Screen name="DashboardHome" component={DashboardScreen} options={{ headerShown: false }} />
      <DashboardStack.Screen name="Calendar" component={CalendarScreen} options={{ headerShown: false }} />
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
      <PropertiesStack.Screen name="ShortStayOwner" component={ShortStayOwnerScreen} options={{ title: 'Short-stay owner setup' }} />
      <PropertiesStack.Screen name="TenantDetail" component={TenantDetailScreen} options={({ navigation }) => ({ title: 'Tenant', headerBackVisible: false, headerLeft: () => <PageBackButton inHeader onPress={() => navigation.goBack()} /> })} />
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
        <MaintenanceStack.Screen name="TenantMaintenanceList" component={TenantMaintenanceScreen} options={{ headerShown: false }} />
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

function TenantLeasesNavigator() {
  const options = useStackOptions();
  return <TenantLeasesStack.Navigator screenOptions={options}>
    <TenantLeasesStack.Screen name="TenantLeasesList" component={TenantLeasesScreen} options={{ headerShown: false }} />
    <TenantLeasesStack.Screen name="TenantLeaseDetail" component={TenantLeaseDetailScreen} options={({ navigation }) => ({ title: 'Lease', headerBackVisible: false, headerLeft: () => <PageBackButton inHeader onPress={() => navigation.goBack()} /> })} />
  </TenantLeasesStack.Navigator>;
}

function SettingsNavigator() {
  const stackOptions = useStackOptions();
  return (
    <SettingsStack.Navigator screenOptions={stackOptions}>
      <SettingsStack.Screen name="SettingsIndex" component={SettingsScreen} options={{ headerShown: false }} />
      <SettingsStack.Screen name="SettingsCategory" component={SettingsScreen} options={{ headerShown: false }} />
    </SettingsStack.Navigator>
  );
}

function ListingsNavigator() {
  const options = useStackOptions();
  return <ListingsStack.Navigator screenOptions={options}>
    <ListingsStack.Screen name="ListingsList" component={ListingsScreen} options={{ headerShown: false }} />
    <ListingsStack.Screen name="AddListing" component={AddListingScreen} options={{ title: 'New listing' }} />
    <ListingsStack.Screen name="ListingDetail" component={ListingDetailScreen} options={({ navigation }) => ({ title: 'Listing details', headerBackVisible: false, headerLeft: () => <PageBackButton inHeader onPress={() => navigation.goBack()} /> })} />
  </ListingsStack.Navigator>;
}

function ApplicationsNavigator() {
  const options = useStackOptions();
  return <ApplicationsStack.Navigator screenOptions={options}>
    <ApplicationsStack.Screen name="ApplicationsList" component={ApplicationsScreen} options={{ headerShown: false }} />
    <ApplicationsStack.Screen name="ApplicationDetail" component={ApplicationDetailScreen} options={({ navigation }) => ({ title: 'Application details', headerBackVisible: false, headerLeft: () => <PageBackButton inHeader onPress={() => navigation.goBack()} /> })} />
  </ApplicationsStack.Navigator>;
}

function MarketingNavigator() {
  const options = useStackOptions();
  return <MarketingStack.Navigator screenOptions={options}>
    <MarketingStack.Screen name="MarketingHome" component={MarketingScreen} options={{ headerShown: false }} />
    <MarketingStack.Screen name="AddListing" component={AddListingScreen as React.ComponentType<any>} options={{ title: 'New listing' }} />
    <MarketingStack.Screen name="ListingDetail" component={ListingDetailScreen as React.ComponentType<any>} options={({ navigation }) => ({ title: 'Listing details', headerBackVisible: false, headerLeft: () => <PageBackButton inHeader onPress={() => navigation.goBack()} /> })} />
    <MarketingStack.Screen name="ApplicationDetail" component={ApplicationDetailScreen as React.ComponentType<any>} options={({ navigation }) => ({ title: 'Application details', headerBackVisible: false, headerLeft: () => <PageBackButton inHeader onPress={() => navigation.goBack()} /> })} />
  </MarketingStack.Navigator>;
}

function AnnouncementsNavigator() {
  const options = useStackOptions();
  return <AnnouncementsStack.Navigator screenOptions={options}>
    <AnnouncementsStack.Screen name="AnnouncementsList" component={AnnouncementsScreen} options={{ headerShown: false }} />
    <AnnouncementsStack.Screen name="AnnouncementDetail" component={AnnouncementDetailScreen} options={({ navigation }) => ({ title: 'Announcement', headerBackVisible: false, headerLeft: () => <PageBackButton inHeader onPress={() => navigation.goBack()} /> })} />
  </AnnouncementsStack.Navigator>;
}

export default function MainNavigator() {
  const currentUser = useAppSelector((state) => state.user.currentUser);
  const audience = maintenanceAudience(currentUser);
  const visibleComponents: MainTabComponentRegistry<React.ComponentType<any>> = {
    DashboardScreen: DashboardNavigator,
    PropertiesNavigator,
    ChecklistsNavigator,
    MaintenanceNavigator,
    MarketingNavigator,
    TenantMaintenanceNavigator,
    TenantPaymentsScreen,
    TenantsNavigator,

    MessagesNavigator,
    NotificationsScreen,
    SettingsScreen: SettingsNavigator,
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
      {audience === 'tenant' && <Tab.Screen name="Leases" component={TenantLeasesNavigator} options={{ tabBarButton: () => null }} />}
      {audience === 'tenant' && <Tab.Screen name="Notifications" component={NotificationsScreen} options={{ tabBarButton: () => null }} />}
      {audience === 'landlord' && <>
        <Tab.Screen name="Maintenance" component={MaintenanceNavigator} options={{ tabBarButton: () => null }} />
        <Tab.Screen name="Vendors" component={VendorsNavigator} options={{ tabBarButton: () => null }} />
        <Tab.Screen name="Team" component={TeamScreen} options={{ tabBarButton: () => null }} />
        <Tab.Screen name="Announcements" component={AnnouncementsNavigator} options={{ tabBarButton: () => null }} />
        <Tab.Screen name="Finances" component={FinancesScreen} options={{ tabBarButton: () => null }} />
        <Tab.Screen name="Checklists" component={ChecklistsNavigator} options={{ tabBarButton: () => null }} />
        <Tab.Screen name="Messages" component={MessagesNavigator} options={{ tabBarButton: () => null }} />
        <Tab.Screen name="Leases" component={LeasesNavigator} options={{ tabBarButton: () => null }} />
        <Tab.Screen name="Applications" component={ApplicationsNavigator} options={{ tabBarButton: () => null }} />
        <Tab.Screen name="Listings" component={ListingsNavigator} options={{ tabBarButton: () => null }} />
        <Tab.Screen name="Settings" component={SettingsNavigator} options={{ tabBarButton: () => null }} />
      </>}
    </Tab.Navigator>
    </MoreDrawerProvider>
    </TabMotionContext.Provider>
  );
}
