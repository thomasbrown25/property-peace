import React from 'react';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import {
  LeasesStackParamList,
  MainTabParamList,
  MaintenanceStackParamList,
  MessagesStackParamList,
  PropertiesStackParamList,
  TenantsStackParamList,
} from './types';

import DashboardScreen from '../screens/landlord/DashboardScreen';
import PropertiesScreen from '../screens/landlord/PropertiesScreen';
import PropertyDetailScreen from '../screens/landlord/PropertyDetailScreen';
import AddPropertyScreen from '../screens/landlord/AddPropertyScreen';
import ChecklistsScreen from '../screens/landlord/ChecklistsScreen';
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

function PropertiesNavigator() {
  return (
    <PropertiesStack.Navigator screenOptions={stackOptions}>
      <PropertiesStack.Screen name="PropertiesList" component={PropertiesScreen} options={{ title: 'Properties' }} />
      <PropertiesStack.Screen name="PropertyDetail" component={PropertyDetailScreen} options={{ title: 'Property' }} />
      <PropertiesStack.Screen name="AddProperty" component={AddPropertyScreen} options={{ title: 'Add property' }} />
      <PropertiesStack.Screen name="Checklists" component={ChecklistsScreen} options={{ title: 'Property checklists' }} />
    </PropertiesStack.Navigator>
  );
}

function MaintenanceNavigator() {
  return (
    <MaintenanceStack.Navigator screenOptions={stackOptions}>
      <MaintenanceStack.Screen name="MaintenanceList" component={MaintenanceScreen} options={{ title: 'Maintenance' }} />
      <MaintenanceStack.Screen name="AddMaintenance" component={AddMaintenanceScreen} options={{ title: 'New request' }} />
    </MaintenanceStack.Navigator>
  );
}

function MessagesNavigator() {
  return (
    <MessagesStack.Navigator screenOptions={stackOptions}>
      <MessagesStack.Screen name="MessagesList" component={MessagesScreen} options={{ title: 'Messages' }} />
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
      <LeasesStack.Screen name="LeaseDetail" component={LeaseDetailScreen} options={{ title: 'Lease' }} />
      <LeasesStack.Screen name="AddLease" component={AddLeaseScreen} options={{ title: 'Add lease' }} />
    </LeasesStack.Navigator>
  );
}

export default function MainNavigator() {
  const insets = useSafeAreaInsets();
  const bottomInset = Math.max(insets.bottom, 8);

  return (
    <Tab.Navigator
      screenOptions={({ route }) => ({
        headerShown: false,
        tabBarActiveTintColor: '#ffffff',
        tabBarInactiveTintColor: 'rgba(255,255,255,0.68)',
        tabBarLabelStyle: { fontSize: 12, fontWeight: '700', marginTop: 1 },
        tabBarStyle: {
          height: 66 + bottomInset,
          paddingTop: 8,
          paddingBottom: bottomInset,
          backgroundColor: '#082f58',
          borderTopWidth: 0,
          elevation: 12,
          shadowColor: '#001a33',
          shadowOpacity: 0.22,
          shadowRadius: 14,
          shadowOffset: { width: 0, height: -4 },
        },
        tabBarIcon: ({ color, size, focused }) => {
          const icons: Record<string, { active: keyof typeof Ionicons.glyphMap; inactive: keyof typeof Ionicons.glyphMap }> = {
            Dashboard: { active: 'home', inactive: 'home-outline' },
            Properties: { active: 'business', inactive: 'business-outline' },
            Maintenance: { active: 'construct', inactive: 'construct-outline' },
            Messages: { active: 'chatbubble-ellipses', inactive: 'chatbubble-ellipses-outline' },
          };
          const icon = icons[route.name];
          return icon ? <Ionicons name={focused ? icon.active : icon.inactive} size={size + 1} color={color} /> : null;
        },
      })}
    >
      <Tab.Screen name="Dashboard" component={DashboardScreen} options={{ tabBarLabel: 'Home' }} />
      <Tab.Screen name="Properties" component={PropertiesNavigator} />
      <Tab.Screen name="Maintenance" component={MaintenanceNavigator} />
      <Tab.Screen name="Messages" component={MessagesNavigator} />

      <Tab.Screen name="Notifications" component={NotificationsScreen} options={{ tabBarButton: () => null }} />
      <Tab.Screen name="Tenants" component={TenantsNavigator} options={{ tabBarButton: () => null }} />
      <Tab.Screen name="Leases" component={LeasesNavigator} options={{ tabBarButton: () => null }} />
      <Tab.Screen name="Settings" component={SettingsScreen} options={{ tabBarButton: () => null }} />
    </Tab.Navigator>
  );
}
