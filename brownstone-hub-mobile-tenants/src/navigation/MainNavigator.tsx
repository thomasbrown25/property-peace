import React, { useState } from 'react';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { TouchableOpacity, View, Text, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { MainTabParamList, MessagesStackParamList } from './types';
import ActionSheet from '../components/ActionSheet';
import MaintenanceNavigator from './MaintenanceNavigator';

// Screens
import DashboardScreen from '../screens/tenant/DashboardScreen';
import ApplicationsScreen from '../screens/tenant/ApplicationsScreen';
import PaymentsScreen from '../screens/tenant/PaymentsScreen';
import MessagesScreen from '../screens/tenant/MessagesScreen';
import SettingsScreen from '../screens/tenant/SettingsScreen';
import SearchScreen from '../screens/tenant/SearchScreen';
import FiltersScreen from '../screens/tenant/FiltersScreen';

const Tab = createBottomTabNavigator<MainTabParamList>();
const MessagesStack = createNativeStackNavigator<MessagesStackParamList>();

function MessagesNavigator() {
  return (
    <MessagesStack.Navigator screenOptions={{ headerShown: false }}>
      <MessagesStack.Screen name="MessagesList" component={MessagesScreen} />
      <MessagesStack.Screen name="Search" component={SearchScreen} />
      <MessagesStack.Screen name="Filters" component={FiltersScreen} />
    </MessagesStack.Navigator>
  );
}


function TabNavigator() {
  const insets = useSafeAreaInsets();
  const navigation = useNavigation<any>();
  const [actionSheetVisible, setActionSheetVisible] = useState(false);

  const actionSheetOptions = [
    {
      label: 'Create new maintenance',
      icon: 'construct',
      onPress: () => {
        navigation.navigate('Maintenance', { screen: 'CreateMaintenanceStep1' });
      },
    },
    {
      label: 'Make payment',
      icon: 'card',
      onPress: () => {
        navigation.navigate('Payments');
      },
    },
    {
      label: 'Upload a document',
      icon: 'document-attach',
      onPress: () => {
        navigation.navigate('Documents');
      },
    },
    {
      label: 'Invite a landlord',
      icon: 'person-add',
      onPress: () => {
        // TODO: Implement invite landlord functionality
        console.log('Invite landlord');
      },
    },
  ];

  return (
    <>
      <Tab.Navigator
        tabBar={(props) => (
          <View style={[styles.tabBarContainer, { paddingBottom: Math.max(insets.bottom, 8) + 7 }]}>
            <View style={styles.tabBar}>
              {/* Dashboard tab */}
              <TouchableOpacity
                style={styles.tab}
                onPress={() => props.navigation.navigate('Dashboard')}
              >
                <Ionicons
                  name="home"
                  size={24}
                  color={props.state.routeNames[props.state.index] === 'Dashboard' ? '#1976d2' : '#999'}
                />
                <Text style={[styles.tabLabel, { color: props.state.routeNames[props.state.index] === 'Dashboard' ? '#1976d2' : '#999' }]}>
                  Home
                </Text>
              </TouchableOpacity>

              {/* Payments tab */}
              <TouchableOpacity
                style={styles.tab}
                onPress={() => props.navigation.navigate('Payments')}
              >
                <Ionicons
                  name="cash"
                  size={24}
                  color={props.state.routeNames[props.state.index] === 'Payments' ? '#1976d2' : '#999'}
                />
                <Text style={[styles.tabLabel, { color: props.state.routeNames[props.state.index] === 'Payments' ? '#1976d2' : '#999' }]}>
                  Rent
                </Text>
              </TouchableOpacity>

              {/* "+" button in the middle */}
              <TouchableOpacity
                style={styles.addButton}
                onPress={() => setActionSheetVisible(true)}
              >
                <View style={styles.addButtonInner}>
                  <Ionicons name="add" size={28} color="#fff" />
                  <Text style={styles.addButtonText}>New</Text>
                </View>
              </TouchableOpacity>

              {/* Messages tab */}
              <TouchableOpacity
                style={styles.tab}
                onPress={() => props.navigation.navigate('Messages')}
              >
                <Ionicons
                  name="chatbubbles"
                  size={24}
                  color={props.state.routeNames[props.state.index] === 'Messages' ? '#1976d2' : '#999'}
                />
                <Text style={[styles.tabLabel, { color: props.state.routeNames[props.state.index] === 'Messages' ? '#1976d2' : '#999' }]}>
                  Messages
                </Text>
              </TouchableOpacity>

              {/* Settings tab */}
              <TouchableOpacity
                style={styles.tab}
                onPress={() => props.navigation.navigate('Settings')}
              >
                <Ionicons
                  name="ellipsis-horizontal"
                  size={24}
                  color={props.state.routeNames[props.state.index] === 'Settings' ? '#1976d2' : '#999'}
                />
                <Text style={[styles.tabLabel, { color: props.state.routeNames[props.state.index] === 'Settings' ? '#1976d2' : '#999' }]}>
                  More
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        )}
        screenOptions={{
          headerShown: false,
        }}
      >
        <Tab.Screen
          name="Dashboard"
          options={{
            tabBarButton: () => null, // Hide from default tab bar
          }}
        >
          {() => <DashboardScreen />}
        </Tab.Screen>
        <Tab.Screen
          name="Payments"
          options={{
            tabBarButton: () => null, // Hide from default tab bar
          }}
        >
          {() => <PaymentsScreen />}
        </Tab.Screen>
        <Tab.Screen
          name="Applications"
          options={{
            tabBarButton: () => null, // Hide from default tab bar
          }}
        >
          {() => <ApplicationsScreen />}
        </Tab.Screen>
        <Tab.Screen
          name="Maintenance"
          options={{
            tabBarButton: () => null, // Hide from default tab bar
          }}
        >
          {() => <MaintenanceNavigator />}
        </Tab.Screen>
        <Tab.Screen
          name="Messages"
          options={{
            tabBarButton: () => null, // Hide from default tab bar
          }}
        >
          {() => <MessagesNavigator />}
        </Tab.Screen>
        <Tab.Screen
          name="Settings"
          options={{
            tabBarButton: () => null, // Hide from default tab bar
          }}
        >
          {() => <SettingsScreen />}
        </Tab.Screen>
      </Tab.Navigator>
      <ActionSheet
        visible={actionSheetVisible}
        onClose={() => setActionSheetVisible(false)}
        options={actionSheetOptions}
      />
    </>
  );
}

export default function MainNavigator() {
  return (
    <TabNavigator />
  );
}

const styles = StyleSheet.create({
  tabBarContainer: {
    backgroundColor: '#FFFFFF',
    borderTopWidth: 1,
    borderTopColor: '#E0E0E0',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 5,
  },
  tabBar: {
    flexDirection: 'row',
    height: 50,
    alignItems: 'center',
    justifyContent: 'space-around',
    paddingHorizontal: 8,
  },
  tab: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 4,
  },
  tabLabel: {
    fontSize: 11,
    marginTop: 4,
    fontWeight: '500',
  },
  addButton: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 4,
    marginHorizontal: 8,
  },
  addButtonInner: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: '#1976d2',
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#1976d2',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 8,
  },
  addButtonText: {
    fontSize: 10,
    color: '#fff',
    fontWeight: '600',
    marginTop: 2,
  },
});
