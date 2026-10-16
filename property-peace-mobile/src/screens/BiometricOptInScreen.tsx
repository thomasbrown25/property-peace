import React, { useEffect, useState } from 'react';
import { ActivityIndicator, Alert, SafeAreaView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
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
    <SafeAreaView style={styles.screen}>
      <View style={styles.center}>
        <View style={styles.icon}>
          <View style={styles.iconHighlight} />
          <Ionicons name="scan-outline" size={88} color="#061e35" />
        </View>
        <Text style={styles.title}>Enable {label} to unlock quickly and securely</Text>
        <Text style={styles.description}>Use {label} or your device passcode to unlock Property Peace whenever you return to the app.</Text>
      </View>
      <View style={styles.actions}>
        <TouchableOpacity accessibilityRole="button" style={[styles.primary, busy && styles.disabled]} onPress={enable} disabled={busy || !availability}>
          <View style={styles.accent} />
          {busy ? <ActivityIndicator color="#fff" /> : <Text style={styles.primaryText}>Enable {label}</Text>}
        </TouchableOpacity>
        <TouchableOpacity accessibilityRole="button" style={styles.secondary} onPress={onContinue} disabled={busy}>
          <Text style={styles.secondaryText}>Not Now</Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: '#fff', paddingHorizontal: 20 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingBottom: 14 },
  icon: { width: 100, height: 100, alignItems: 'center', justifyContent: 'center', marginBottom: 35 },
  iconHighlight: { position: 'absolute', width: 52, height: 86, backgroundColor: '#7fe6f3', borderRadius: 11, right: 13 },
  title: { color: '#111', fontSize: 26, lineHeight: 34, fontWeight: '700', textAlign: 'center', marginBottom: 16 },
  description: { color: '#333', fontSize: 16, lineHeight: 25, textAlign: 'center', maxWidth: 340 },
  actions: { paddingBottom: 22, gap: 12 },
  primary: { minHeight: 56, backgroundColor: '#073e73', alignItems: 'center', justifyContent: 'center', borderRadius: 4, overflow: 'hidden' },
  accent: { position: 'absolute', left: 0, top: 0, bottom: 0, width: 6, backgroundColor: '#05c7ef' },
  primaryText: { color: '#fff', fontWeight: '700', fontSize: 16 },
  secondary: { minHeight: 56, borderWidth: 1, borderColor: '#b4bcc6', borderRadius: 4, alignItems: 'center', justifyContent: 'center' },
  secondaryText: { color: '#073e73', fontWeight: '700', fontSize: 16 },
  disabled: { opacity: 0.6 },
});
