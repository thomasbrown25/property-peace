import React from 'react';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import QuickActionsTabBar from './QuickActionsTabBar';

import {
  LeasesStackParamList,
  MainTabParamList,
  MaintenanceStackParamList,
  MessagesStackParamList,
  PropertiesStackParamList,
  TenantsStackParamList,
} from './types';
import type { DashboardStackParamList } from './types';

import DashboardScreen from '../screens/landlord/DashboardScreen';
import RentCollectionScreen from '../screens/landlord/RentCollectionScreen';
import AddExpenseScreen from '../screens/landlord/AddExpenseScreen';
import PropertiesScreen from '../screens/landlord/PropertiesScreen';
import PropertyDetailScreen from '../screens/landlord/PropertyDetailScreen';
import AddPropertyScreen from '../screens/landlord/AddPropertyScreen';

import TenantsScreen from '../screens/landlord/TenantsScreen';
import AddTenantScreen from '../screens/landlord/AddTenantScreen';
import MaintenanceScreen from '../screens/landlord/MaintenanceScreen';
import LandlordMaintenanceDetailScreen from '../screens/landlord/LandlordMaintenanceDetailScreen';
import LeasesScreen from '../screens/landlord/LeasesScreen';

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

const Tab = createBottomTabNavigator<MainTabParamList>();
const DashboardStack = createNativeStackNavigator<DashboardStackParamList>();
const PropertiesStack = createNativeStackNavigator<PropertiesStackParamList>();
const MaintenanceStack = createNativeStackNavigator<MaintenanceStackParamList>();
const MessagesStack = createNativeStackNavigator<MessagesStackParamList>();
const TenantsStack = createNativeStackNavigator<TenantsStackParamList>();
const LeasesStack = createNativeStackNavigator<LeasesStackParamList>();

const stackOptions = {
  headerTintColor: '#0b3558',
  headerTitleStyle: { fontWeight: '800' as const, color: '#102d43' },
  headerShadowVisible: false,
  headerStyle: { backgroundColor: '#fbf7f4' },
  contentStyle: { backgroundColor: '#fbf7f4' },
};

function DashboardNavigator() {
  return (
    <DashboardStack.Navigator screenOptions={stackOptions}>
      <DashboardStack.Screen name="DashboardHome" component={DashboardScreen} options={{ headerShown: false }} />
      <DashboardStack.Screen name="RentCollection" component={RentCollectionScreen} options={{ headerShown: false }} />
      <DashboardStack.Screen name="AddExpense" component={AddExpenseScreen} options={{ title: 'Add expense' }} />
    </DashboardStack.Navigator>
  );
}

function PropertiesNavigator() {
  return (
    <PropertiesStack.Navigator screenOptions={stackOptions}>
      <PropertiesStack.Screen name="PropertiesList" component={PropertiesScreen} options={{ headerShown: false }} />
      <PropertiesStack.Screen name="PropertyDetail" component={PropertyDetailScreen} options={{ title: 'Property' }} />
      <PropertiesStack.Screen name="AddProperty" component={AddPropertyScreen} options={{ title: 'Add property' }} />

    </PropertiesStack.Navigator>
  );
}

function MaintenanceNavigator({ tenant = false }: { tenant?: boolean }) {
  return (
    <MaintenanceStack.Navigator screenOptions={stackOptions}>
      {tenant ? <>
        <MaintenanceStack.Screen name="TenantMaintenanceList" component={TenantMaintenanceScreen} options={{ title: 'Maintenance' }} />
        <MaintenanceStack.Screen name="TenantMaintenanceIntake" component={TenantMaintenanceIntakeScreen} options={{ title: 'Report an issue' }} />
        <MaintenanceStack.Screen name="MaintenanceEmergency" component={MaintenanceEmergencyScreen} options={{ title: 'Emergency safety', presentation: 'modal' }} />
        <MaintenanceStack.Screen name="TenantMaintenanceReceipt" component={TenantMaintenanceReceiptScreen} options={{ title: 'Report received', headerBackVisible: false }} />
        <MaintenanceStack.Screen name="TenantMaintenanceDetail" component={TenantMaintenanceDetailScreen} options={{ title: 'Request detail' }} />
      </> : <>
        <MaintenanceStack.Screen name="MaintenanceList" component={MaintenanceScreen} options={{ headerShown: false }} />
        <MaintenanceStack.Screen name="LandlordMaintenanceDetail" component={LandlordMaintenanceDetailScreen} options={{ title: 'Maintenance workflow' }} />
      </>}
    </MaintenanceStack.Navigator>
  );
}

function TenantMaintenanceNavigator() {
  return <MaintenanceNavigator tenant />;
}


function MessagesNavigator() {
  return (
    <MessagesStack.Navigator screenOptions={stackOptions}>
      <MessagesStack.Screen name="MessagesList" component={MessagesScreen} options={{ headerShown: false }} />
      <MessagesStack.Screen name="ConversationDetail" component={ConversationDetailScreen} options={{ title: 'Conversation' }} />
    </MessagesStack.Navigator>
  );
}

function TenantsNavigator() {
  return (
    <TenantsStack.Navigator screenOptions={stackOptions}>
      <TenantsStack.Screen name="TenantsList" component={TenantsScreen} options={{ title: 'Tenants' }} />
      <TenantsStack.Screen name="AddTenant" component={AddTenantScreen} options={{ title: 'Add tenant' }} />
    </TenantsStack.Navigator>
  );
}

function LeasesNavigator() {
  return (
    <LeasesStack.Navigator screenOptions={stackOptions}>
      <LeasesStack.Screen name="LeasesList" component={LeasesScreen} options={{ title: 'Leases' }} />

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

    MessagesNavigator,
    SettingsScreen,
  };
  const visibleTabs = resolveVisibleMainTabs(audience, visibleComponents);

  if (audience === 'unsupported') return <UnsupportedRoleScreen />;

  return (
    <Tab.Navigator
      tabBar={(props) => <QuickActionsTabBar {...props} audience={audience} />}
      screenOptions={{ headerShown: false }}
    >
      {visibleTabs.map((tab) => {
        return <Tab.Screen key={tab.name} name={tab.name} component={tab.component} options={tab.label ? { tabBarLabel: tab.label } : undefined} />;
      })}
      {audience === 'landlord' && <>
        <Tab.Screen name="Checklists" component={ChecklistsNavigator} options={{ tabBarButton: () => null }} />
        <Tab.Screen name="Notifications" component={NotificationsScreen} options={{ tabBarButton: () => null }} />
        <Tab.Screen name="Tenants" component={TenantsNavigator} options={{ tabBarButton: () => null }} />
        <Tab.Screen name="Leases" component={LeasesNavigator} options={{ tabBarButton: () => null }} />
        <Tab.Screen name="Settings" component={SettingsScreen} options={{ tabBarButton: () => null }} />
      </>}
    </Tab.Navigator>
  );
}
