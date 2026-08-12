import React, { useEffect, useState } from 'react';
import { ActivityIndicator, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import biometricService from '../services/biometricService';

export default function BiometricUnlockScreen({ onUnlock, onSignOut }: { onUnlock: () => void; onSignOut: () => void }) {
  const [label, setLabel] = useState('Face ID');
  const [checking, setChecking] = useState(true);
  const [message, setMessage] = useState('Confirm it’s you to continue.');

  const unlock = async () => {
    setChecking(true);
    const success = await biometricService.authenticate(`Unlock Property Peace with ${label}`);
    setChecking(false);
    if (success) {
      onUnlock();
    } else {
      setMessage(`${label} did not unlock the app. Try again or sign out.`);
    }
  };

  useEffect(() => {
    biometricService.getAvailability().then((availability) => {
      setLabel(availability.label);
      setChecking(false);
      if (!availability.available) setMessage(availability.reason || 'Biometric unlock is unavailable.');
    });
  }, []);

  return (
    <View style={styles.container}>
      <View style={styles.iconWrap}>
        <Ionicons name="scan-outline" size={44} color="#2563eb" />
      </View>
      <Text style={styles.eyebrow}>Property Peace</Text>
      <Text style={styles.title}>Locked</Text>
      <Text style={styles.message}>{message}</Text>
      <TouchableOpacity style={[styles.unlockButton, checking && styles.disabled]} onPress={unlock} disabled={checking}>
        {checking ? <ActivityIndicator color="#fff" /> : <Ionicons name="scan-outline" size={21} color="#fff" />}
        <Text style={styles.unlockText}>{checking ? 'Checking…' : `Unlock with ${label}`}</Text>
      </TouchableOpacity>
      <TouchableOpacity style={styles.signOutButton} onPress={onSignOut} disabled={checking}>
        <Text style={styles.signOutText}>Sign out and use another account</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 28, backgroundColor: '#f7fafc' },
  iconWrap: { width: 84, height: 84, borderRadius: 26, alignItems: 'center', justifyContent: 'center', backgroundColor: '#eaf3ff', marginBottom: 22 },
  eyebrow: { color: '#2563eb', fontSize: 13, fontWeight: '800', textTransform: 'uppercase', letterSpacing: 1.2, marginBottom: 8 },
  title: { color: '#0f2f47', fontSize: 34, fontWeight: '900', marginBottom: 10 },
  message: { color: '#5b6a78', fontSize: 16, lineHeight: 23, textAlign: 'center', maxWidth: 320, marginBottom: 28 },
  unlockButton: { minHeight: 54, width: '100%', maxWidth: 360, borderRadius: 17, backgroundColor: '#2563eb', flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10, paddingHorizontal: 18 },
  unlockText: { color: '#fff', fontSize: 16, fontWeight: '800' },
  disabled: { opacity: 0.65 },
  signOutButton: { minHeight: 48, justifyContent: 'center', marginTop: 12, paddingHorizontal: 12 },
  signOutText: { color: '#526171', fontSize: 14, fontWeight: '700', textAlign: 'center' },
});
