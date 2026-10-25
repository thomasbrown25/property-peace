import React, { useEffect, useState } from 'react';
import { ActivityIndicator, Alert, Image, SafeAreaView, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import biometricService, { BiometricAvailability } from '../services/biometricService';

type Props = { userId: string; onContinue: () => void };

export default function BiometricOptInScreen({ userId, onContinue }: Props) {
  const [availability, setAvailability] = useState<BiometricAvailability | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let active = true;
    biometricService.getAvailability()
      .then((value) => { if (active) setAvailability(value); })
      .catch(() => { if (active) setAvailability({ available: false, label: 'Face ID', reason: 'Device unlock is unavailable right now.' }); });
    return () => { active = false; };
  }, []);

  const enable = async () => {
    if (busy || !availability) return;
    if (!availability.available) {
      Alert.alert(`${availability.label} unavailable`, availability.reason || 'Set up biometrics on your device first.');
      return;
    }
    setBusy(true);
    try {
      const verified = await biometricService.authenticate(`Enable ${availability.label} for Property Peace`);
      if (!verified) return;
      await biometricService.setEnabled(userId, true);
      onContinue();
    } catch {
      Alert.alert('Could not enable device unlock', 'Please try again or enable it later in Settings.');
    } finally {
      setBusy(false);
    }
  };

  const label = availability?.label || 'Face ID';
  return (
    <LinearGradient colors={['#061e35', '#0a2d52', '#0d2040']} style={styles.screen}>
      <SafeAreaView style={styles.safeArea}>
        <ScrollView contentContainerStyle={styles.content}>
          <View style={styles.center}>
            <Image
              source={require('../../assets/property-peace-logo.png')}
              style={styles.logo}
              resizeMode="contain"
              accessibilityLabel="Property Peace"
            />
            <Text style={styles.title}>Enable {label} to unlock quickly and securely</Text>
            <Text style={styles.description}>Use {label} or your device passcode to unlock Property Peace whenever you return to the app.</Text>
          </View>
          <View style={styles.actions}>
            <TouchableOpacity accessibilityRole="button" style={[styles.primary, busy && styles.disabled]} onPress={enable} disabled={busy || !availability}>
              {busy ? <ActivityIndicator color="#fff" /> : <Text style={styles.primaryText}>Enable {label}</Text>}
            </TouchableOpacity>
            <TouchableOpacity accessibilityRole="button" style={styles.secondary} onPress={onContinue} disabled={busy}>
              <Text style={styles.secondaryText}>Not Now</Text>
            </TouchableOpacity>
          </View>
        </ScrollView>
      </SafeAreaView>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: '#061e35' },
  safeArea: { flex: 1 },
  content: { flexGrow: 1, paddingHorizontal: 18, paddingTop: 24, paddingBottom: 22 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingVertical: 32 },
  logo: { width: 224, height: 66, marginBottom: 16 },
  title: { color: '#fff', fontSize: 26, lineHeight: 34, fontWeight: '700', textAlign: 'center', marginBottom: 16, maxWidth: 350 },
  description: { color: 'rgba(255, 255, 255, 0.70)', fontSize: 16, lineHeight: 25, textAlign: 'center', maxWidth: 340 },
  actions: { width: '100%', alignSelf: 'center', maxWidth: 360, gap: 12 },
  primary: {
    minHeight: 54, backgroundColor: '#2563eb', alignItems: 'center', justifyContent: 'center',
    borderRadius: 16, borderWidth: 1, borderColor: 'rgba(147, 197, 253, 0.45)',
  },
  primaryText: { color: '#fff', fontWeight: '700', fontSize: 16 },
  secondary: {
    minHeight: 48, borderWidth: 1, borderColor: 'rgba(255, 255, 255, 0.25)',
    borderRadius: 16, alignItems: 'center', justifyContent: 'center',
  },
  secondaryText: { color: '#fff', fontWeight: '700', fontSize: 16 },
  disabled: { opacity: 0.6 },
});
