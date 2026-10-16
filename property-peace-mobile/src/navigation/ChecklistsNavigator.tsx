import React from 'react';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { ChecklistsStackParamList } from './checklistsTypes';
import ChecklistPropertySearchScreen from '../screens/landlord/ChecklistPropertySearchScreen';
import PropertyChecklistsScreen from '../screens/landlord/PropertyChecklistsScreen';
import ChecklistEditorScreen from '../screens/landlord/ChecklistEditorScreen';
import { useAppTheme } from '../theme/AppTheme';

const Stack = createNativeStackNavigator<ChecklistsStackParamList>();

export default function ChecklistsNavigator() {
  const { mode, colors } = useAppTheme();
  return (
    <Stack.Navigator
      screenOptions={{
        headerTintColor: mode === 'dark' ? colors.text : '#0b3558',
        headerTitleStyle: { fontWeight: '800', color: mode === 'dark' ? colors.text : '#102d43' },
        headerShadowVisible: false,
        headerStyle: { backgroundColor: mode === 'dark' ? colors.background : '#fbf7f4' },
        contentStyle: { backgroundColor: mode === 'dark' ? colors.background : '#fbf7f4' },
      }}
    >
      <Stack.Screen name="ChecklistPropertySearch" component={ChecklistPropertySearchScreen} options={{ title: 'Property checklists' }} />
      <Stack.Screen name="PropertyChecklists" component={PropertyChecklistsScreen} options={{ title: 'Checklists' }} />
      <Stack.Screen name="ChecklistEditor" component={ChecklistEditorScreen} options={{ title: 'Inspection' }} />
    </Stack.Navigator>
  );
}
