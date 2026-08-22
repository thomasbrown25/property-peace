import React, { useCallback, useEffect, useState } from 'react';
import { AppState } from 'react-native';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { useAppSelector, useAppDispatch } from '../store/hooks';
import { RootStackParamList } from './types';
import AuthNavigator from './AuthNavigator';
import MainNavigator from './MainNavigator';
import AnimatedLoadingScreen from '../screens/AnimatedLoadingScreen';
import BiometricUnlockScreen from '../screens/BiometricUnlockScreen';
import biometricService from '../services/biometricService';
import { initializeAuth, logout } from '../store/user/user.slice';
import { resolveStartupPresentation } from '../features/startup/startupPresentation';
import { resolveRestoredSessionLock } from '../features/startup/automaticBiometricPrompt';

const Stack = createNativeStackNavigator<RootStackParamList>();

export default function AppNavigator() {
  const dispatch = useAppDispatch();
  const { isAuthenticated, loading } = useAppSelector((state) => state.user);
  const [checkingLock, setCheckingLock] = useState(true);
  const [introComplete, setIntroComplete] = useState(false);
  const [sessionUnlocked, setSessionUnlocked] = useState(true);
  const [autoPromptBiometric, setAutoPromptBiometric] = useState(false);

  const finishIntro = useCallback(() => {
    setIntroComplete(true);
  }, []);
  const unlockSession = useCallback(() => {
    setAutoPromptBiometric(false);
    setSessionUnlocked(true);
  }, []);
  const consumeAutoPrompt = useCallback(() => {
    setAutoPromptBiometric(false);
  }, []);
  const signOut = useCallback(() => {
    dispatch(logout());
  }, [dispatch]);

  useEffect(() => {
    let active = true;

    const restoreSession = async () => {
      try {
        const restoredSession = await dispatch(initializeAuth()).unwrap();
        if (!active) return;

        if (!restoredSession.isAuthenticated) {
          setAutoPromptBiometric(false);
          setSessionUnlocked(true);
          return;
        }

        const lock = await resolveRestoredSessionLock(() => biometricService.isEnabled());
        if (!active) return;
        setAutoPromptBiometric(lock.autoPrompt);
        setSessionUnlocked(lock.sessionUnlocked);
      } catch {
        if (!active) return;
        setAutoPromptBiometric(false);
        setSessionUnlocked(true);
      } finally {
        if (active) setCheckingLock(false);
      }
    };

    restoreSession();

    return () => {
      active = false;
    };
  }, [dispatch]);

  useEffect(() => {
    if (isAuthenticated === false) {
      setAutoPromptBiometric(false);
      setSessionUnlocked(true);
    }
  }, [isAuthenticated]);

  useEffect(() => {
    let active = true;
    const subscription = AppState.addEventListener('change', (nextState) => {
      if (nextState !== 'background' || !isAuthenticated) return;

      biometricService.isEnabled()
        .then((enabled) => {
          if (!active || !enabled) return;
          setAutoPromptBiometric(false);
          setSessionUnlocked(false);
        })
        .catch(() => {
          if (!active) return;
          setAutoPromptBiometric(false);
          setSessionUnlocked(false);
        });
    });

    return () => {
      active = false;
      subscription.remove();
    };
  }, [isAuthenticated]);

  const startupPresentation = resolveStartupPresentation({
    introComplete,
    authLoading: loading,
    checkingLock,
  });

  if (startupPresentation === 'animated-intro') {
    return <AnimatedLoadingScreen playIntro onIntroComplete={finishIntro} />;
  }

  if (startupPresentation === 'waiting') return <AnimatedLoadingScreen />;

  if (isAuthenticated && !sessionUnlocked) {
    return (
      <BiometricUnlockScreen
        autoPrompt={autoPromptBiometric}
        onAutoPromptConsumed={consumeAutoPrompt}
        onUnlock={unlockSession}
        onSignOut={signOut}
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
