import React, { useEffect, useRef, useState } from 'react';
import { AppState } from 'react-native';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { useAppSelector, useAppDispatch } from '../store/hooks';
import { RootStackParamList } from './types';
import AuthNavigator from './AuthNavigator';
import MainNavigator from './MainNavigator';
import LoadingScreen from '../screens/LoadingScreen';
import BiometricUnlockScreen from '../screens/BiometricUnlockScreen';
import biometricService from '../services/biometricService';
import { initializeAuth, logout } from '../store/user/user.slice';

const Stack = createNativeStackNavigator<RootStackParamList>();

export default function AppNavigator() {
  const dispatch = useAppDispatch();
  const { isAuthenticated, loading } = useAppSelector((state) => state.user);
  const [checkingLock, setCheckingLock] = useState(true);
  const [sessionUnlocked, setSessionUnlocked] = useState(true);
  const checkedRestoredSession = useRef(false);

  useEffect(() => {
    dispatch(initializeAuth());
  }, [dispatch]);

  useEffect(() => {
    if (loading) return;
    if (!isAuthenticated) {
      checkedRestoredSession.current = false;
      setSessionUnlocked(true);
      setCheckingLock(false);
      return;
    }
    if (checkedRestoredSession.current) return;

    checkedRestoredSession.current = true;
    setCheckingLock(true);
    biometricService.isEnabled()
      .then((enabled) => setSessionUnlocked(!enabled))
      .finally(() => setCheckingLock(false));
  }, [isAuthenticated, loading]);

  useEffect(() => {
    const subscription = AppState.addEventListener('change', (nextState) => {
      if (nextState === 'background' && isAuthenticated) {
        biometricService.isEnabled().then((enabled) => {
          if (enabled) setSessionUnlocked(false);
        });
      }
    });
    return () => subscription.remove();
  }, [isAuthenticated]);

  if (loading || checkingLock) return <LoadingScreen />;

  if (isAuthenticated && !sessionUnlocked) {
    return (
      <BiometricUnlockScreen
        onUnlock={() => setSessionUnlocked(true)}
        onSignOut={() => dispatch(logout())}
      />
    );
  }

  return (
    <NavigationContainer>
      <Stack.Navigator screenOptions={{ headerShown: false }}>
        {isAuthenticated ? (
          <Stack.Screen name="Main" component={MainNavigator} />
        ) : (
          <Stack.Screen name="Auth" component={AuthNavigator} />
        )}
      </Stack.Navigator>
    </NavigationContainer>
  );
}
