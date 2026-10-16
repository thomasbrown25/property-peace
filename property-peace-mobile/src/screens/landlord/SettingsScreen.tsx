import React, { useEffect, useState } from 'react';
import { Alert, Image, Linking, ScrollView, StyleSheet, Switch, Text, TouchableOpacity, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import Constants from 'expo-constants';
import { useAppDispatch, useAppSelector } from '../../store/hooks';
import { logout } from '../../store/user/user.slice';
import biometricService, { BiometricAvailability } from '../../services/biometricService';
import userAPI from '../../api/userAPI';
import { useAppTheme } from '../../theme/AppTheme';

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
  const { mode, colors, setMode } = useAppTheme();
  const styles = useSettingsStyles();
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
      <View style={styles.intro}>
        <Text style={styles.eyebrow}>Account</Text>
        <Text style={styles.title}>Settings</Text>
        <Text style={styles.subtitle}>Manage this device, your account, and legal information.</Text>
      </View>

      <View style={styles.profileSection}>
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

      <SectionHeader icon="color-palette-outline" title="Appearance" />
      <View style={styles.sectionGroup}>
        <View style={styles.settingRow}>
          <View style={styles.rowIcon}><Ionicons name="moon-outline" size={21} color={colors.accent} /></View>
          <View style={styles.rowCopy}>
            <Text style={styles.rowLabel}>Dark mode</Text>
            <Text style={styles.rowValue}>Use a darker appearance on this device.</Text>
          </View>
          <Switch
            accessibilityLabel="Dark mode"
            value={mode === 'dark'}
            onValueChange={(enabled) => setMode(enabled ? 'dark' : 'light')}
            trackColor={{ false: colors.border, true: colors.accent }}
            thumbColor={mode === 'dark' ? colors.dockText : '#fff'}
          />
        </View>
      </View>

      <SectionHeader icon="shield-checkmark-outline" title="Security" />
      <View style={styles.sectionGroup}>
        <View style={styles.settingRow}>
          <View style={styles.rowIcon}><Ionicons name="scan-outline" size={21} color={colors.accent} /></View>
          <View style={styles.rowCopy}>
            <Text style={styles.rowLabel}>Unlock with {biometricAvailability.label}</Text>
            <Text style={styles.rowValue}>{biometricAvailability.available ? 'Require biometric authentication or your device passcode after the app is backgrounded.' : (biometricAvailability.reason || 'Checking this device…')}</Text>
          </View>
          <Switch
            accessibilityLabel={`Unlock with ${biometricAvailability.label}`}
            value={biometricEnabled}
            disabled={!biometricAvailability.available}
            onValueChange={handleBiometricToggle}
            trackColor={{ false: colors.border, true: colors.accent }}
            thumbColor={biometricEnabled ? colors.dockText : '#fff'}
          />
        </View>
      </View>

      <SectionHeader icon="document-text-outline" title="Legal & support" />
      <View style={styles.sectionGroup}>
        <LinkRow icon="shield-outline" label="Privacy Policy" onPress={() => Linking.openURL(PRIVACY_URL)} />
        <LinkRow icon="document-outline" label="Terms of Use" onPress={() => Linking.openURL(TERMS_URL)} />
        <LinkRow icon="help-circle-outline" label="Contact support" onPress={() => Linking.openURL(SUPPORT_URL)} />
        <View style={styles.versionRow}><Text style={styles.versionText}>Property Peace {version} ({build})</Text></View>
      </View>

      <TouchableOpacity style={styles.signOutButton} onPress={handleLogout} activeOpacity={0.82}>
        <Ionicons name="log-out-outline" size={20} color={mode === 'dark' ? '#ffa77e' : '#9a3412'} />
        <Text style={styles.signOutText}>Sign out</Text>
      </TouchableOpacity>

      <View style={styles.dangerSection}>
        <Text style={styles.dangerTitle}>Delete account</Text>
        <Text style={styles.dangerCopy}>Initiate permanent account deletion inside the app. Some records may be retained where legally or financially required.</Text>
        <TouchableOpacity style={[styles.deleteButton, deleting && styles.disabled]} onPress={handleDeleteAccount} disabled={deleting}>
          <Ionicons name="trash-outline" size={20} color={mode === 'dark' ? '#ffa5a0' : '#b42318'} />
          <Text style={styles.deleteText}>{deleting ? 'Deleting…' : 'Delete account'}</Text>
        </TouchableOpacity>
      </View>
    </ScrollView>
  );
}

function SectionHeader({ icon, title }: { icon: keyof typeof Ionicons.glyphMap; title: string }) {
  const styles = useSettingsStyles();
  const { colors } = useAppTheme();
  return <View style={styles.sectionHeader}><Ionicons name={icon} size={18} color={colors.muted} /><Text style={styles.sectionTitle}>{title}</Text></View>;
}

function LinkRow({ icon, label, onPress }: { icon: keyof typeof Ionicons.glyphMap; label: string; onPress: () => void }) {
  const styles = useSettingsStyles();
  const { colors } = useAppTheme();
  return (
    <TouchableOpacity style={styles.linkRow} onPress={onPress} activeOpacity={0.75}>
      <View style={styles.rowIcon}><Ionicons name={icon} size={20} color={colors.muted} /></View>
      <Text style={styles.linkLabel}>{label}</Text>
      <Ionicons name="open-outline" size={18} color={colors.muted} />
    </TouchableOpacity>
  );
}

function useSettingsStyles() {
  const { mode, colors } = useAppTheme();
  if (mode === 'light') return baseStyles;
  return StyleSheet.create({
    ...baseStyles,
    container: { ...baseStyles.container, backgroundColor: colors.background },
    eyebrow: { ...baseStyles.eyebrow, color: colors.muted },
    title: { ...baseStyles.title, color: colors.text },
    subtitle: { ...baseStyles.subtitle, color: colors.muted },
    profileSection: { ...baseStyles.profileSection, borderBottomColor: colors.border },
    sectionGroup: { ...baseStyles.sectionGroup, borderBottomColor: colors.border },
    avatarFallback: { ...baseStyles.avatarFallback, backgroundColor: colors.dock },
    avatarText: { ...baseStyles.avatarText, color: colors.dockText },
    profileName: { ...baseStyles.profileName, color: colors.text },
    profileDetail: { ...baseStyles.profileDetail, color: colors.muted },
    readOnlyNote: { ...baseStyles.readOnlyNote, color: colors.muted },
    sectionTitle: { ...baseStyles.sectionTitle, color: colors.text },
    rowLabel: { ...baseStyles.rowLabel, color: colors.text },
    rowValue: { ...baseStyles.rowValue, color: colors.muted },
    linkRow: { ...baseStyles.linkRow, borderBottomColor: colors.border },
    linkLabel: { ...baseStyles.linkLabel, color: colors.text },
    versionText: { ...baseStyles.versionText, color: colors.muted },
    signOutButton: { ...baseStyles.signOutButton, borderBottomColor: colors.border },
    signOutText: { ...baseStyles.signOutText, color: '#ffa77e' },
    dangerTitle: { ...baseStyles.dangerTitle, color: '#ffa5a0' },
    dangerCopy: { ...baseStyles.dangerCopy, color: '#eebcb7' },
    deleteText: { ...baseStyles.deleteText, color: '#ffa5a0' },
  });
}

const baseStyles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#fff' },
  content: { paddingHorizontal: 20, paddingTop: 22, paddingBottom: 120 },
  intro: { paddingBottom: 28 },
  eyebrow: { color: '#64748b', fontSize: 11, fontWeight: '800', letterSpacing: 1.2, textTransform: 'uppercase', marginBottom: 6 },
  title: { color: '#102d43', fontSize: 30, fontWeight: '800', marginBottom: 5 },
  subtitle: { color: '#64748b', fontSize: 15, lineHeight: 21 },
  profileSection: { paddingBottom: 24, borderBottomWidth: 1, borderBottomColor: '#e8edf2' },
  sectionGroup: { borderBottomWidth: 1, borderBottomColor: '#e8edf2' },
  profileRow: { flexDirection: 'row', alignItems: 'center', gap: 15 },
  avatar: { width: 68, height: 68, borderRadius: 24, backgroundColor: '#d8dde2' },
  avatarFallback: { width: 68, height: 68, borderRadius: 24, backgroundColor: '#0b3558', alignItems: 'center', justifyContent: 'center' },
  avatarText: { color: '#fff', fontWeight: '900', fontSize: 21 },
  profileCopy: { flex: 1, minWidth: 0 },
  profileName: { color: '#102d43', fontSize: 20, fontWeight: '900', marginBottom: 5 },
  profileDetail: { color: '#596876', fontSize: 14, lineHeight: 20 },
  readOnlyNote: { marginTop: 14, color: '#6a7885', fontSize: 12, lineHeight: 18 },
  sectionHeader: { minHeight: 55, flexDirection: 'row', alignItems: 'center', gap: 8, paddingTop: 17 },
  sectionTitle: { color: '#102d43', fontSize: 17, fontWeight: '800' },
  settingRow: { minHeight: 86, flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 12 },
  rowIcon: { width: 30, height: 38, alignItems: 'flex-start', justifyContent: 'center' },
  rowCopy: { flex: 1, minWidth: 0 },
  rowLabel: { color: '#102d43', fontSize: 15, fontWeight: '800', marginBottom: 3 },
  rowValue: { color: '#6a7885', fontSize: 13, lineHeight: 18 },
  linkRow: { minHeight: 56, flexDirection: 'row', alignItems: 'center', gap: 12, borderBottomWidth: 1, borderBottomColor: '#edf1f4' },
  linkLabel: { flex: 1, color: '#102d43', fontSize: 15, fontWeight: '700' },
  versionRow: { minHeight: 46, justifyContent: 'center', paddingLeft: 42 },
  versionText: { color: '#7a8793', fontSize: 12 },
  signOutButton: { minHeight: 64, flexDirection: 'row', alignItems: 'center', gap: 12, borderBottomWidth: 1, borderBottomColor: '#e8edf2' },
  signOutText: { color: '#9a3412', fontSize: 16, fontWeight: '900' },
  dangerSection: { paddingTop: 28 },
  dangerTitle: { color: '#912018', fontSize: 18, fontWeight: '900', marginBottom: 6 },
  dangerCopy: { color: '#7a3b36', fontSize: 13, lineHeight: 19, marginBottom: 14 },
  deleteButton: { minHeight: 50, flexDirection: 'row', alignItems: 'center', gap: 9 },
  deleteText: { color: '#b42318', fontSize: 15, fontWeight: '900' },
  disabled: { opacity: 0.6 },
});
