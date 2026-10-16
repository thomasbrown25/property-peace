import React, { useCallback, useEffect, useState } from 'react';
import { AppState } from 'react-native';
import { DarkTheme, DefaultTheme, NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { useAppSelector, useAppDispatch } from '../store/hooks';
import { RootStackParamList } from './types';
import AuthNavigator from './AuthNavigator';
import MainNavigator from './MainNavigator';
import AnimatedLoadingScreen from '../screens/AnimatedLoadingScreen';
import BiometricUnlockScreen from '../screens/BiometricUnlockScreen';
import BiometricOptInScreen from '../screens/BiometricOptInScreen';
import MissingAccountScreen from '../screens/MissingAccountScreen';
import biometricService from '../services/biometricService';
import { initializeAuth, logout } from '../store/user/user.slice';
import { resolveStartupPresentation } from '../features/startup/startupPresentation';
import { resolveRestoredSessionLock } from '../features/startup/automaticBiometricPrompt';
import { getBiometricAccountId } from '../features/startup/biometricAccountId';
import { useAppTheme } from '../theme/AppTheme';

const Stack = createNativeStackNavigator<RootStackParamList>();

export default function AppNavigator() {
  const { mode, colors } = useAppTheme();
  const navigationTheme = {
    ...(mode === 'dark' ? DarkTheme : DefaultTheme),
    colors: {
      ...(mode === 'dark' ? DarkTheme.colors : DefaultTheme.colors),
      primary: colors.accent,
      background: colors.background,
      card: colors.surface,
      text: colors.text,
      border: colors.border,
      notification: colors.accent,
    },
  };
  const dispatch = useAppDispatch();
  const { isAuthenticated, loading, currentUser } = useAppSelector((state) => state.user);
  const userId = getBiometricAccountId(currentUser);
  const [checkedUserId, setCheckedUserId] = useState<string | null>(null);
  const [showOptIn, setShowOptIn] = useState(false);
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
  const dismissOptIn = useCallback(() => {
    setShowOptIn(false);
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
          setCheckedUserId(null);
          return;
        }

        const restoredUserId = getBiometricAccountId(restoredSession.user);
        const lock = await resolveRestoredSessionLock(() => biometricService.isEnabled(restoredUserId));
        if (!active) return;
        setAutoPromptBiometric(lock.autoPrompt);
        setSessionUnlocked(lock.sessionUnlocked);
        setShowOptIn(lock.sessionUnlocked && !!restoredUserId);
        setCheckedUserId(restoredUserId || null);
      } catch {
        if (!active) return;
        setAutoPromptBiometric(false);
        setSessionUnlocked(false);
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
      setCheckedUserId(null);
      setShowOptIn(false);
    }
  }, [isAuthenticated]);

  useEffect(() => {
    if (checkingLock || !isAuthenticated || !userId || checkedUserId === userId) return;
    let active = true;
    biometricService.isEnabled(userId)
      .then((enabled) => {
        if (!active) return;
        setShowOptIn(!enabled);
        setCheckedUserId(userId);
      })
      .catch(() => {
        if (!active) return;
        setShowOptIn(true);
        setCheckedUserId(userId);
      });
    return () => { active = false; };
  }, [checkingLock, isAuthenticated, userId, checkedUserId]);

  useEffect(() => {
    let active = true;
    const subscription = AppState.addEventListener('change', (nextState) => {
      if (nextState !== 'background' || !isAuthenticated || !userId) return;
      // Hide private screens immediately, before the asynchronous preference read completes.
      setSessionUnlocked(false);
      setAutoPromptBiometric(true);
      biometricService.isEnabled(userId)
        .then((enabled) => {
          if (!active) return;
          if (!enabled) {
            setAutoPromptBiometric(false);
            setSessionUnlocked(true);
          }
        })
        .catch(() => {
          if (!active) return;
          setAutoPromptBiometric(false);
        });
    });

    return () => {
      active = false;
      subscription.remove();
    };
  }, [isAuthenticated, userId]);

  const startupPresentation = resolveStartupPresentation({
    introComplete,
    authLoading: loading,
    checkingLock,
  });

  if (startupPresentation === 'animated-intro') {
    return <AnimatedLoadingScreen playIntro onIntroComplete={finishIntro} />;
  }

  if (startupPresentation === 'waiting') return <AnimatedLoadingScreen />;

  if (isAuthenticated && !userId) return <MissingAccountScreen onSignOut={signOut} />;
  if (isAuthenticated && checkedUserId !== userId) return <AnimatedLoadingScreen />;

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

  if (isAuthenticated && showOptIn) {
    return <BiometricOptInScreen userId={userId} onContinue={dismissOptIn} />;
  }

  return (
    <NavigationContainer theme={navigationTheme}>
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
