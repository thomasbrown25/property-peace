import React, { useEffect, useRef, useState } from 'react';
import {
  AccessibilityInfo,
  Animated,
  AppState,
  Easing,
  Image,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import biometricService, { BiometricAvailability } from '../services/biometricService';
import { createAutomaticBiometricPrompt } from '../features/startup/automaticBiometricPrompt';

type BiometricUnlockScreenProps = {
  autoPrompt?: boolean;
  onAutoPromptConsumed: () => void;
  onUnlock: () => void;
  onSignOut: () => void;
};

function UnlockLoadingDots({ active }: { active: boolean }) {
  const dots = useRef(Array.from({ length: 4 }, () => new Animated.Value(0))).current;
  const [reduceMotion, setReduceMotion] = useState(true);

  useEffect(() => {
    let mounted = true;
    AccessibilityInfo.isReduceMotionEnabled().then((enabled) => {
      if (mounted) setReduceMotion(enabled);
    }).catch(() => {});
    const subscription = AccessibilityInfo.addEventListener('reduceMotionChanged', setReduceMotion);
    return () => {
      mounted = false;
      subscription.remove();
    };
  }, []);

  useEffect(() => {
    if (!active || reduceMotion) {
      dots.forEach((dot) => dot.setValue(0));
      return undefined;
    }

    const animations = dots.map((dot, index) => Animated.loop(Animated.sequence([
      Animated.delay(index * 140),
      Animated.timing(dot, {
        toValue: 1,
        duration: 210,
        easing: Easing.out(Easing.quad),
        useNativeDriver: true,
      }),
      Animated.timing(dot, {
        toValue: 0,
        duration: 260,
        easing: Easing.in(Easing.quad),
        useNativeDriver: true,
      }),
      Animated.delay((3 - index) * 140 + 170),
    ])));
    animations.forEach((animation) => animation.start());
    return () => {
      animations.forEach((animation) => animation.stop());
      dots.forEach((dot) => dot.setValue(0));
    };
  }, [active, dots, reduceMotion]);

  return (
    <View accessibilityElementsHidden importantForAccessibility="no-hide-descendants" style={styles.loadingDots}>
      {dots.map((dot, index) => (
        <Animated.View
          key={index}
          style={[styles.loadingDot, { transform: [{ translateY: dot.interpolate({
            inputRange: [0, 1],
            outputRange: [0, -10],
          }) }] }]}
        />
      ))}
    </View>
  );
}

export default function BiometricUnlockScreen({
  autoPrompt = false,
  onAutoPromptConsumed,
  onUnlock,
  onSignOut,
}: BiometricUnlockScreenProps) {
  const [label, setLabel] = useState('Face ID');
  const [checking, setChecking] = useState(true);
  const [message, setMessage] = useState('Confirm it’s you to continue.');
  const [availability, setAvailability] = useState<BiometricAvailability | null>(null);
  const [appState, setAppState] = useState(AppState.currentState);
  const automaticPrompt = useRef(createAutomaticBiometricPrompt()).current;
  const automaticAttemptInFlight = useRef(false);
  const mounted = useRef(true);

  const showFailure = (nextMessage: string) => {
    setMessage(nextMessage);
    AccessibilityInfo.announceForAccessibility(nextMessage);
  };

  const unlock = async () => {
    setChecking(true);
    try {
      const success = await biometricService.authenticate('Unlock Property Peace with ' + label);
      if (success) {
        onUnlock();
        return;
      }
      showFailure(label + ' did not unlock the app. Try again or sign out.');
    } catch {
      showFailure(label + ' could not be started. Try again or sign out.');
    }
    setChecking(false);
  };

  useEffect(() => {
    return () => {
      mounted.current = false;
    };
  }, []);

  useEffect(() => {
    const subscription = AppState.addEventListener('change', setAppState);
    return () => subscription.remove();
  }, []);

  useEffect(() => {
    biometricService.getAvailability()
      .then((nextAvailability) => {
        if (!mounted.current) return;
        setAvailability(nextAvailability);
        setLabel(nextAvailability.label);
        if (!nextAvailability.available) {
          setChecking(false);
          showFailure(nextAvailability.reason || 'Biometric unlock is unavailable.');
        }
      })
      .catch(() => {
        if (!mounted.current) return;
        setChecking(false);
        showFailure('Biometric unlock could not be checked. Try again or sign out.');
      });
  }, []);

  useEffect(() => {
    if (!availability?.available) return;

    if (!autoPrompt) {
      if (!automaticAttemptInFlight.current) setChecking(false);
      return;
    }

    if (appState !== 'active') {
      setMessage('Return to Property Peace to continue with ' + availability.label + '.');
      return;
    }

    automaticAttemptInFlight.current = true;
    setChecking(true);
    setMessage('Looking for ' + availability.label + '…');

    automaticPrompt.attempt({
      appState,
      autoPrompt,
      available: availability.available,
      authenticate: () => biometricService.authenticate(
        'Unlock Property Peace with ' + availability.label,
      ),
      onAttemptStarted: onAutoPromptConsumed,
    }).then((result) => {
      automaticAttemptInFlight.current = false;
      if (!mounted.current) return;
      if (result === 'unlocked') {
        onUnlock();
        return;
      }
      if (result === 'already-attempted' || result === 'waiting-for-active') return;

      setChecking(false);
      showFailure(availability.label + ' did not unlock the app. Try again or sign out.');
    }).catch(() => {
      automaticAttemptInFlight.current = false;
      if (!mounted.current) return;
      setChecking(false);
      showFailure('Biometric unlock could not be started. Try again or sign out.');
    });
  }, [
    appState,
    autoPrompt,
    automaticPrompt,
    availability,
    onAutoPromptConsumed,
    onUnlock,
  ]);

  return (
    <LinearGradient colors={['#061e35', '#0a2d52', '#0d2040']} style={styles.container}>
      <View style={styles.iconWrap}>
        <Ionicons name="scan-outline" size={44} color="#93c5fd" />
      </View>
      <Image
        source={require('../../assets/property-peace-logo.png')}
        style={styles.logo}
        resizeMode="contain"
        accessibilityLabel="Property Peace"
      />
      <UnlockLoadingDots active={checking} />
      <Text accessibilityLiveRegion="polite" style={styles.message}>{message}</Text>
      <TouchableOpacity
        accessibilityRole="button"
        style={[styles.unlockButton, checking && styles.disabled]}
        onPress={unlock}
        disabled={checking}
      >
        {!checking && <Ionicons name="scan-outline" size={21} color="#fff" />}
        <Text style={styles.unlockText}>
          {checking ? 'Checking…' : 'Unlock with ' + label}
        </Text>
      </TouchableOpacity>
      <TouchableOpacity
        accessibilityRole="button"
        style={styles.signOutButton}
        onPress={onSignOut}
        disabled={checking}
      >
        <Text style={styles.signOutText}>Sign out and use another account</Text>
      </TouchableOpacity>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    backgroundColor: '#061e35',
    flex: 1,
    justifyContent: 'center',
    paddingHorizontal: 18,
    paddingVertical: 24,
  },
  iconWrap: {
    alignItems: 'center',
    backgroundColor: 'rgba(96, 165, 250, 0.12)',
    borderColor: 'rgba(147, 197, 253, 0.25)',
    borderRadius: 26,
    borderWidth: 1,
    height: 84,
    justifyContent: 'center',
    marginBottom: 20,
    width: 84,
  },
  logo: {
    width: 224,
    height: 66,
    marginBottom: 16,
  },
  message: {
    color: 'rgba(255, 255, 255, 0.70)',
    fontSize: 16,
    lineHeight: 23,
    marginBottom: 24,
    maxWidth: 320,
    textAlign: 'center',
  },
  loadingDots: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 10,
    height: 32,
    justifyContent: 'center',
    marginBottom: 12,
  },
  loadingDot: {
    backgroundColor: '#70cf73',
    borderRadius: 6,
    height: 10,
    width: 10,
  },
  unlockButton: {
    alignItems: 'center',
    backgroundColor: '#2563eb',
    borderRadius: 17,
    flexDirection: 'row',
    gap: 10,
    justifyContent: 'center',
    maxWidth: 360,
    minHeight: 54,
    paddingHorizontal: 18,
    width: '100%',
  },
  unlockText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '800',
  },
  disabled: {
    opacity: 0.65,
  },
  signOutButton: {
    justifyContent: 'center',
    marginTop: 12,
    minHeight: 48,
    paddingHorizontal: 12,
  },
  signOutText: {
    color: 'rgba(255, 255, 255, 0.72)',
    fontSize: 14,
    fontWeight: '700',
    textAlign: 'center',
  },
});
