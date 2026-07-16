import React from 'react';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { MaintenanceStackParamList } from './types';

// Screens
import MaintenanceScreen from '../screens/tenant/MaintenanceScreen';
import MaintenanceDetailScreen from '../screens/tenant/MaintenanceDetailScreen';
import CreateMaintenanceStep1Screen from '../screens/tenant/CreateMaintenanceStep1Screen';
import CreateMaintenanceStep2Screen from '../screens/tenant/CreateMaintenanceStep2Screen';
import CreateMaintenanceCreatingScreen from '../screens/tenant/CreateMaintenanceCreatingScreen';

const Stack = createNativeStackNavigator<MaintenanceStackParamList>();

export default function MaintenanceNavigator() {
  return (
    <Stack.Navigator
      screenOptions={{
        headerShown: false,
      }}
    >
      <Stack.Screen
        name="MaintenanceList"
        component={MaintenanceScreen}
      />
      <Stack.Screen
        name="MaintenanceDetail"
        component={MaintenanceDetailScreen}
      />
      <Stack.Screen
        name="CreateMaintenanceStep1"
        component={CreateMaintenanceStep1Screen}
      />
      <Stack.Screen
        name="CreateMaintenanceStep2"
        component={CreateMaintenanceStep2Screen}
      />
      <Stack.Screen
        name="CreateMaintenanceCreating"
        component={CreateMaintenanceCreatingScreen}
      />
    </Stack.Navigator>
  );
}
