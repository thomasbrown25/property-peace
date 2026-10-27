import React, { useCallback, useEffect, useState } from 'react';
import { AppState } from 'react-native';
import { createNavigationContainerRef, DarkTheme, DefaultTheme, NavigationContainer } from '@react-navigation/native';
import { Notifications, syncPushRegistration } from '../services/pushNotifications';
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
const navigationRef = createNavigationContainerRef<RootStackParamList>();
let lastOpenedPushId: string | null = null;

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
  const [navigationReady, setNavigationReady] = useState(false);

  useEffect(() => {
    if (!isAuthenticated || !userId || !sessionUnlocked || showOptIn || checkingLock) return;
    const sync = () => { void syncPushRegistration().catch(() => { /* Try again on next foreground. */ }); };
    sync();
    const appState = AppState.addEventListener('change', (state) => { if (state === 'active') sync(); });
    return () => appState.remove();
  }, [isAuthenticated, userId, sessionUnlocked, showOptIn, checkingLock]);

  useEffect(() => {
    if (!isAuthenticated || !userId || !sessionUnlocked || showOptIn || checkingLock || !navigationReady) return;
    const open = (response: Notifications.NotificationResponse) => {
      const id = response.notification.request.identifier;
      if (id === lastOpenedPushId || !navigationRef.isReady()) return;
      lastOpenedPushId = id;
      // The push carries no user-controlled route or private payload.
      navigationRef.navigate('Main', { screen: 'Notifications' });
    };
    const subscription = Notifications.addNotificationResponseReceivedListener(open);
    void Notifications.getLastNotificationResponseAsync().then((response) => { if (response) open(response); }).catch(() => {});
    return () => subscription.remove();
  }, [isAuthenticated, userId, sessionUnlocked, showOptIn, checkingLock, currentUser, navigationReady]);

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
        const restoredAt = Date.now();
        const lock = await resolveRestoredSessionLock(
          () => biometricService.isEnabled(restoredUserId),
          async () => {
            const lastActiveAt = await biometricService.getLastActiveAt(restoredUserId);
            if (lastActiveAt !== null) return lastActiveAt;
            // Existing opt-ins predate inactivity tracking; begin their grace period now.
            await biometricService.setLastActiveAt(restoredUserId, restoredAt);
            return restoredAt;
          },
          restoredAt,
        );
        if (!active) return;
        setAutoPromptBiometric(lock.autoPrompt);
        setSessionUnlocked(lock.sessionUnlocked);
        setShowOptIn(lock.sessionUnlocked && lock.biometricEnabled === false && !!restoredUserId);
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
    if (checkingLock || !isAuthenticated || !userId || !sessionUnlocked) return;
    const recordActivity = () => {
      biometricService.setLastActiveAt(userId, Date.now()).catch(() => {
        // Missing/unreadable timestamps are handled on the next cold launch.
      });
    };
    // Keep a recent timestamp even if iOS terminates the process without a background event.
    if (AppState.currentState === 'active') recordActivity();
    const heartbeat = setInterval(() => {
      if (AppState.currentState === 'active') recordActivity();
    }, 30_000);
    const subscription = AppState.addEventListener('change', (nextState) => {
      // Returning from the background in this process never relocks the session.
      if (nextState === 'background' || nextState === 'active') recordActivity();
    });
    return () => {
      clearInterval(heartbeat);
      subscription.remove();
    };
  }, [checkingLock, isAuthenticated, userId, sessionUnlocked]);

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
    <NavigationContainer ref={navigationRef} onReady={() => setNavigationReady(true)} theme={navigationTheme}>
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
