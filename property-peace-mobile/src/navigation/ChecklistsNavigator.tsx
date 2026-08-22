import React from 'react';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { ChecklistsStackParamList } from './checklistsTypes';
import ChecklistPropertySearchScreen from '../screens/landlord/ChecklistPropertySearchScreen';
import ChecklistsScreen from '../screens/landlord/ChecklistsScreen';

const Stack = createNativeStackNavigator<ChecklistsStackParamList>();

export default function ChecklistsNavigator() {
  return (
    <Stack.Navigator
      screenOptions={{
        headerTintColor: '#0b3558',
        headerTitleStyle: { fontWeight: '800', color: '#102d43' },
        headerShadowVisible: false,
        headerStyle: { backgroundColor: '#fbf7f4' },
        contentStyle: { backgroundColor: '#fbf7f4' },
      }}
    >
      <Stack.Screen name="ChecklistPropertySearch" component={ChecklistPropertySearchScreen} options={{ title: 'Property checklists' }} />
      <Stack.Screen name="PropertyChecklists" component={ChecklistsScreen as any} options={{ title: 'Checklists' }} />
      <Stack.Screen name="ChecklistEditor" component={ChecklistsScreen as any} options={{ title: 'Inspection' }} />
    </Stack.Navigator>
  );
}
