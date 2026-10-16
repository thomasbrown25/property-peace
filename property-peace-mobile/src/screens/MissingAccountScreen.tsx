import React from 'react';
import { SafeAreaView, StyleSheet, Text, TouchableOpacity } from 'react-native';

type Props = { onSignOut: () => void };

export default function MissingAccountScreen({ onSignOut }: Props) {
  return (
    <SafeAreaView style={styles.container}>
      <Text style={styles.title}>Your session needs to be refreshed</Text>
      <Text style={styles.message}>We couldn't identify this account on your device. Sign out and sign in again to continue.</Text>
      <TouchableOpacity accessibilityRole="button" onPress={onSignOut} style={styles.button}>
        <Text style={styles.buttonText}>Sign out</Text>
      </TouchableOpacity>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#061E35', justifyContent: 'center', padding: 28 },
  title: { color: '#fff', fontSize: 24, fontWeight: '700', marginBottom: 12 },
  message: { color: '#D3E3E8', fontSize: 16, lineHeight: 24, marginBottom: 28 },
  button: { backgroundColor: '#21876F', borderRadius: 8, minHeight: 48, alignItems: 'center', justifyContent: 'center' },
  buttonText: { color: '#fff', fontSize: 16, fontWeight: '700' },
});
