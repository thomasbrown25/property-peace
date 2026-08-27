import React from 'react';
import { SafeAreaView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { useAppDispatch } from '../store/hooks';
import { logout } from '../store/user/user.slice';

export default function UnsupportedRoleScreen() {
  const dispatch = useAppDispatch();

  return (
    <SafeAreaView style={styles.page}>
      <View style={styles.content}>
        <Text style={styles.eyebrow}>ACCOUNT ACCESS</Text>
        <Text style={styles.title}>This mobile experience is not available for your role</Text>
        <Text style={styles.body}>
          Property Peace mobile currently supports active landlord, administrator, and tenant roles. Vendor and other account workflows are not available in this version.
        </Text>
        <Text style={styles.body}>
          Sign out and use an account with a supported role, or continue with the web experience provided for your organization.
        </Text>
        <TouchableOpacity
          accessibilityRole="button"
          style={styles.button}
          onPress={() => dispatch(logout())}
        >
          <Text style={styles.buttonText}>Sign out</Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  page: { flex: 1, backgroundColor: '#fbf7f4' },
  content: { flex: 1, justifyContent: 'center', padding: 28 },
  eyebrow: { color: '#8a4b16', fontSize: 12, fontWeight: '800', letterSpacing: 1.2, marginBottom: 12 },
  title: { color: '#102d43', fontSize: 28, fontWeight: '800', lineHeight: 35, marginBottom: 18 },
  body: { color: '#526874', fontSize: 16, lineHeight: 24, marginBottom: 14 },
  button: { minHeight: 52, alignItems: 'center', justifyContent: 'center', backgroundColor: '#0b3558', borderRadius: 14, marginTop: 16 },
  buttonText: { color: '#fff', fontSize: 16, fontWeight: '800' },
});