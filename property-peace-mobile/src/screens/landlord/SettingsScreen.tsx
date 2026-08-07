import React, { useEffect, useState } from 'react';
import { Alert, Image, Linking, ScrollView, StyleSheet, Switch, Text, TouchableOpacity, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import Constants from 'expo-constants';
import { useAppDispatch, useAppSelector } from '../../store/hooks';
import { logout } from '../../store/user/user.slice';
import biometricService, { BiometricAvailability } from '../../services/biometricService';
import userAPI from '../../api/userAPI';

const PRIVACY_URL = 'https://www.propertypeace.io/privacy';
const TERMS_URL = 'https://www.propertypeace.io/terms';
const SUPPORT_URL = 'mailto:support@propertypeace.io?subject=Property%20Peace%20mobile%20support';

const firstString = (...values: unknown[]) => {
  for (const value of values) {
    if (typeof value === 'string' && value.trim()) return value.trim();
  }
  return '';
};

export default function SettingsScreen() {
  const dispatch = useAppDispatch();
  const { currentUser } = useAppSelector((state) => state.user);
  const [biometricEnabled, setBiometricEnabled] = useState(false);
  const [biometricAvailability, setBiometricAvailability] = useState<BiometricAvailability>({ available: false, label: 'Face ID' });
  const [deleting, setDeleting] = useState(false);

  useEffect(() => {
    Promise.all([biometricService.getAvailability(), biometricService.isEnabled()])
      .then(([availability, enabled]) => {
        setBiometricAvailability(availability);
        setBiometricEnabled(enabled && availability.available);
      })
      .catch(() => setBiometricAvailability({ available: false, label: 'Face ID', reason: 'Biometric unlock is unavailable.' }));
  }, []);

  const name = firstString(
    `${currentUser?.FirstName || currentUser?.firstName || ''} ${currentUser?.LastName || currentUser?.lastName || ''}`,
    currentUser?.Name,
    currentUser?.name,
    'Property Peace user',
  );
  const email = firstString(currentUser?.Email, currentUser?.email, 'No email on file');
  const phone = firstString(currentUser?.PhoneNumber, currentUser?.phoneNumber, 'No phone on file');
  const profileImageUrl = firstString(currentUser?.ProfileImageUrl, currentUser?.profileImageUrl);
  const initials = name.split(/\s+/).map((part) => part[0]).join('').slice(0, 2).toUpperCase() || 'PP';
  const version = Constants.expoConfig?.version || '1.0.0';
  const build = Constants.expoConfig?.ios?.buildNumber || '1';

  const handleBiometricToggle = async (enabled: boolean) => {
    if (!enabled) {
      await biometricService.setEnabled(false);
      setBiometricEnabled(false);
      return;
    }

    const availability = await biometricService.getAvailability();
    setBiometricAvailability(availability);
    if (!availability.available) {
      Alert.alert(`${availability.label} unavailable`, availability.reason || 'Set up biometric authentication in your device settings first.');
      return;
    }

    const authenticated = await biometricService.authenticate(`Enable ${availability.label} for Property Peace`);
    if (!authenticated) return;

    await biometricService.setEnabled(true);
    setBiometricEnabled(true);
    Alert.alert(`${availability.label} enabled`, `Property Peace will lock when it moves to the background and use ${availability.label} or your device passcode to unlock.`);
  };

  const handleLogout = () => {
    Alert.alert('Sign out', 'Are you sure you want to sign out?', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Sign out', style: 'destructive', onPress: () => dispatch(logout()) },
    ]);
  };

  const performDelete = async () => {
    setDeleting(true);
    try {
      await userAPI.deleteAccount();
      await biometricService.setEnabled(false);
      Alert.alert('Account deleted', 'Your account has been deactivated and your personal information will be anonymized subject to legal and financial retention requirements.', [
        { text: 'Done', onPress: () => dispatch(logout()) },
      ]);
    } catch (error: any) {
      const message = error?.message || error?.Message || 'We could not delete your account. Resolve any active leases or subscriptions and try again.';
      Alert.alert('Account could not be deleted', message);
    } finally {
      setDeleting(false);
    }
  };

  const handleDeleteAccount = () => {
    Alert.alert(
      'Delete account?',
      'This permanently removes access to Property Peace and anonymizes your personal profile. Financial, lease, and legal records may be retained where required. Active leases or subscriptions may need to be resolved first.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Continue',
          style: 'destructive',
          onPress: () => Alert.alert(
            'Final confirmation',
            'This action cannot be undone. Delete your Property Peace account now?',
            [
              { text: 'Keep account', style: 'cancel' },
              { text: 'Delete account', style: 'destructive', onPress: performDelete },
            ],
          ),
        },
      ],
    );
  };

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
      <View style={styles.heroCard}>
        <Text style={styles.eyebrow}>Account</Text>
        <Text style={styles.title}>Settings</Text>
        <Text style={styles.subtitle}>Manage this device, your account, and legal information.</Text>
      </View>

      <View style={styles.card}>
        <View style={styles.profileRow}>
          {profileImageUrl ? <Image source={{ uri: profileImageUrl }} style={styles.avatar} /> : <View style={styles.avatarFallback}><Text style={styles.avatarText}>{initials}</Text></View>}
          <View style={styles.profileCopy}>
            <Text style={styles.profileName}>{name}</Text>
            <Text style={styles.profileDetail}>{email}</Text>
            <Text style={styles.profileDetail}>{phone}</Text>
          </View>
        </View>
        <Text style={styles.readOnlyNote}>Profile details are shown read-only in this release.</Text>
      </View>

      <SectionHeader icon="shield-checkmark-outline" title="Security" />
      <View style={styles.card}>
        <View style={styles.settingRow}>
          <View style={styles.rowIcon}><Ionicons name="scan-outline" size={21} color="#2475cf" /></View>
          <View style={styles.rowCopy}>
            <Text style={styles.rowLabel}>Unlock with {biometricAvailability.label}</Text>
            <Text style={styles.rowValue}>{biometricAvailability.available ? 'Require biometric authentication or your device passcode after the app is backgrounded.' : (biometricAvailability.reason || 'Checking this device…')}</Text>
          </View>
          <Switch
            accessibilityLabel={`Unlock with ${biometricAvailability.label}`}
            value={biometricEnabled}
            disabled={!biometricAvailability.available}
            onValueChange={handleBiometricToggle}
            trackColor={{ false: '#d7dde2', true: '#9bd3ff' }}
            thumbColor={biometricEnabled ? '#2475cf' : '#fff'}
          />
        </View>
      </View>

      <SectionHeader icon="document-text-outline" title="Legal & support" />
      <View style={styles.card}>
        <LinkRow icon="shield-outline" label="Privacy Policy" onPress={() => Linking.openURL(PRIVACY_URL)} />
        <LinkRow icon="document-outline" label="Terms of Use" onPress={() => Linking.openURL(TERMS_URL)} />
        <LinkRow icon="help-circle-outline" label="Contact support" onPress={() => Linking.openURL(SUPPORT_URL)} />
        <View style={styles.versionRow}><Text style={styles.versionText}>Property Peace {version} ({build})</Text></View>
      </View>

      <TouchableOpacity style={styles.signOutButton} onPress={handleLogout} activeOpacity={0.82}>
        <Ionicons name="log-out-outline" size={20} color="#9a3412" />
        <Text style={styles.signOutText}>Sign out</Text>
      </TouchableOpacity>

      <View style={styles.dangerCard}>
        <Text style={styles.dangerTitle}>Delete account</Text>
        <Text style={styles.dangerCopy}>Initiate permanent account deletion inside the app. Some records may be retained where legally or financially required.</Text>
        <TouchableOpacity style={[styles.deleteButton, deleting && styles.disabled]} onPress={handleDeleteAccount} disabled={deleting}>
          <Ionicons name="trash-outline" size={20} color="#b42318" />
          <Text style={styles.deleteText}>{deleting ? 'Deleting…' : 'Delete account'}</Text>
        </TouchableOpacity>
      </View>
    </ScrollView>
  );
}

function SectionHeader({ icon, title }: { icon: keyof typeof Ionicons.glyphMap; title: string }) {
  return <View style={styles.sectionHeader}><Ionicons name={icon} size={20} color="#2475cf" /><Text style={styles.sectionTitle}>{title}</Text></View>;
}

function LinkRow({ icon, label, onPress }: { icon: keyof typeof Ionicons.glyphMap; label: string; onPress: () => void }) {
  return (
    <TouchableOpacity style={styles.linkRow} onPress={onPress} activeOpacity={0.75}>
      <View style={styles.rowIcon}><Ionicons name={icon} size={20} color="#2475cf" /></View>
      <Text style={styles.linkLabel}>{label}</Text>
      <Ionicons name="open-outline" size={18} color="#6a7885" />
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#fbf7f4' },
  content: { padding: 18, paddingBottom: 120, gap: 14 },
  heroCard: { borderRadius: 22, padding: 20, backgroundColor: '#0b3558' },
  eyebrow: { color: '#93c5fd', fontSize: 12, fontWeight: '800', letterSpacing: 1.1, textTransform: 'uppercase', marginBottom: 6 },
  title: { color: '#fff', fontSize: 30, fontWeight: '900', marginBottom: 5 },
  subtitle: { color: 'rgba(255,255,255,0.72)', fontSize: 15, lineHeight: 21 },
  card: { backgroundColor: '#fff', borderRadius: 20, borderWidth: 1, borderColor: '#e4ebf0', padding: 16 },
  profileRow: { flexDirection: 'row', alignItems: 'center', gap: 15 },
  avatar: { width: 68, height: 68, borderRadius: 24, backgroundColor: '#d8dde2' },
  avatarFallback: { width: 68, height: 68, borderRadius: 24, backgroundColor: '#0b3558', alignItems: 'center', justifyContent: 'center' },
  avatarText: { color: '#fff', fontWeight: '900', fontSize: 21 },
  profileCopy: { flex: 1, minWidth: 0 },
  profileName: { color: '#102d43', fontSize: 20, fontWeight: '900', marginBottom: 5 },
  profileDetail: { color: '#596876', fontSize: 14, lineHeight: 20 },
  readOnlyNote: { marginTop: 14, color: '#6a7885', fontSize: 12, lineHeight: 18 },
  sectionHeader: { minHeight: 36, flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 4, marginTop: 4 },
  sectionTitle: { color: '#102d43', fontSize: 17, fontWeight: '900' },
  settingRow: { minHeight: 62, flexDirection: 'row', alignItems: 'center', gap: 12 },
  rowIcon: { width: 38, height: 38, borderRadius: 12, backgroundColor: '#edf6ff', alignItems: 'center', justifyContent: 'center' },
  rowCopy: { flex: 1, minWidth: 0 },
  rowLabel: { color: '#102d43', fontSize: 15, fontWeight: '800', marginBottom: 3 },
  rowValue: { color: '#6a7885', fontSize: 13, lineHeight: 18 },
  linkRow: { minHeight: 54, flexDirection: 'row', alignItems: 'center', gap: 12, borderBottomWidth: 1, borderBottomColor: '#edf1f4' },
  linkLabel: { flex: 1, color: '#102d43', fontSize: 15, fontWeight: '700' },
  versionRow: { minHeight: 44, justifyContent: 'center', paddingLeft: 50 },
  versionText: { color: '#7a8793', fontSize: 12 },
  signOutButton: { minHeight: 54, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10, backgroundColor: '#fff', borderRadius: 18, borderWidth: 1, borderColor: '#fed7aa' },
  signOutText: { color: '#9a3412', fontSize: 16, fontWeight: '900' },
  dangerCard: { backgroundColor: '#fff8f7', borderRadius: 20, borderWidth: 1, borderColor: '#fecdca', padding: 17 },
  dangerTitle: { color: '#912018', fontSize: 18, fontWeight: '900', marginBottom: 6 },
  dangerCopy: { color: '#7a3b36', fontSize: 13, lineHeight: 19, marginBottom: 14 },
  deleteButton: { minHeight: 50, borderRadius: 15, borderWidth: 1, borderColor: '#fda29b', backgroundColor: '#fff', flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 9 },
  deleteText: { color: '#b42318', fontSize: 15, fontWeight: '900' },
  disabled: { opacity: 0.6 },
});
