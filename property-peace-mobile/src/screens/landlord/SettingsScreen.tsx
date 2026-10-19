import { useTabScrollReset } from '../../navigation/useTabScrollReset';
import { useNavigation, useRoute } from '@react-navigation/native';
import React, { useRef, useEffect, useState } from 'react';
import { ActivityIndicator, Alert, BackHandler, Image, Linking, ScrollView, StyleSheet, Switch, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Constants from 'expo-constants';
import { useAppDispatch, useAppSelector } from '../../store/hooks';
import { applySavedAccount, logout, setProfileImage } from '../../store/user/user.slice';
import biometricService, { BiometricAvailability } from '../../services/biometricService';
import { getBiometricAccountId } from '../../features/startup/biometricAccountId';
import userAPI from '../../api/userAPI';
import storageService from '../../services/storageService';
import { useAppTheme } from '../../theme/AppTheme';

const PRIVACY_URL = 'https://www.propertypeace.io/privacy';
const TERMS_URL = 'https://www.propertypeace.io/terms';
const SUPPORT_URL = 'mailto:support@propertypeace.io?subject=Property%20Peace%20mobile%20support';
// Same production fallback as QuickActionsTabBar; preview builds require an explicit matching web app URL.
const webAppUrl = process.env.EXPO_PUBLIC_WEB_APP_URL?.replace(/\/$/, '')
  || (process.env.EXPO_PUBLIC_API_URL?.replace(/\/$/, '') === 'https://api.propertypeace.io'
    ? 'https://app.propertypeace.io' : undefined);
const webCategoryPaths = { subscription: '/landlord/settings?tab=subscription', payments: '/landlord/settings?tab=payments', smsnumber: '/landlord/settings?tab=smsnumber' } as const;
type ProfileForm = { firstName: string; lastName: string; email: string; phoneNumber: string; businessName: string; businessEmail: string; businessPhone: string };
const profileFields: { key: keyof ProfileForm; label: string; keyboard?: 'email-address' | 'phone-pad' }[] = [
  { key: 'firstName', label: 'First name' }, { key: 'lastName', label: 'Last name' },
  { key: 'email', label: 'Email', keyboard: 'email-address' }, { key: 'phoneNumber', label: 'Phone', keyboard: 'phone-pad' },
  { key: 'businessName', label: 'Business name' }, { key: 'businessEmail', label: 'Business email', keyboard: 'email-address' },
  { key: 'businessPhone', label: 'Business phone', keyboard: 'phone-pad' },
];
const profileFromUser = (user: Record<string, any>): ProfileForm => ({
  firstName: firstString(user.firstName, user.FirstName, user.firstname, user.Firstname),
  lastName: firstString(user.lastName, user.LastName, user.lastname, user.Lastname),
  email: firstString(user.email, user.Email), phoneNumber: firstString(user.phoneNumber, user.PhoneNumber),
  businessName: firstString(user.businessName, user.BusinessName), businessEmail: firstString(user.businessEmail, user.BusinessEmail),
  businessPhone: firstString(user.businessPhone, user.BusinessPhone),
});
const validEmail = (value: string) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
const preferenceTypes = [
  ['rentReminders', 'Rent reminders'], ['overdueAlerts', 'Overdue alerts'], ['paymentConfirmations', 'Payment confirmations'],
  ['maintenanceUpdates', 'Maintenance updates'], ['leaseExpiration', 'Lease expiration'],
  ['newTenantNotifications', 'New tenants'], ['applicationCompletion', 'Applications'], ['tenantMessages', 'Tenant messages'],
  ['adminSubscriptionNotifications', 'Subscription events'], ['adminNewUserNotifications', 'New registrations'],
] as const;

const categories = [
  { key: 'account', title: 'Account', icon: 'person-circle-outline' },
  { key: 'general', title: 'General', icon: 'settings-outline' },
  { key: 'profile', title: 'Profile', icon: 'person-outline' },
  { key: 'subscription', title: 'Manage Subscription', icon: 'card-outline' },
  { key: 'payments', title: 'Online Rent Payments', icon: 'cash-outline' },
  { key: 'smsnumber', title: 'SMS Number Settings', icon: 'chatbubble-outline' },
  { key: 'notifications', title: 'Notifications', icon: 'notifications-outline' },
  { key: 'appearance', title: 'Appearance', icon: 'color-palette-outline' },
] as const;
type Category = typeof categories[number]['key'];

const firstString = (...values: unknown[]) => {
  for (const value of values) {
    if (typeof value === 'string' && value.trim()) return value.trim();
  }
  return '';
};

export default function SettingsScreen() {
  const scrollRef = useRef<ScrollView>(null);
  useTabScrollReset(scrollRef);
  const navigation = useNavigation();
  const route = useRoute();
  const insets = useSafeAreaInsets();
  const { mode, colors, setMode } = useAppTheme();
  const styles = useSettingsStyles();
  const dispatch = useAppDispatch();
  const { currentUser } = useAppSelector((state) => state.user);
  const accountId = getBiometricAccountId(currentUser);
  const activeAccountId = useRef(accountId);
  activeAccountId.current = accountId;
  const [biometricEnabled, setBiometricEnabled] = useState(false);
  const [biometricAvailability, setBiometricAvailability] = useState<BiometricAvailability>({ available: false, label: 'Face ID' });
  const [deleting, setDeleting] = useState(false);
  const [uploadingPhoto, setUploadingPhoto] = useState(false);
  const photoUploadInProgress = useRef(false);
  const [category, setCategory] = useState<Category | null>(null);
  const [general, setGeneral] = useState<Record<string, any> | null>(null);
  const [notifications, setNotifications] = useState<Record<string, any> | null>(null);
  const [profile, setProfile] = useState<ProfileForm | null>(null);
  const [profileBase, setProfileBase] = useState<ProfileForm | null>(null);
  const [password, setPassword] = useState({ current: '', next: '', confirm: '' });
  const [savingPassword, setSavingPassword] = useState(false);
  const [savingProfile, setSavingProfile] = useState(false);
  const [loadingDetail, setLoadingDetail] = useState(false);
  const [savingDetail, setSavingDetail] = useState(false);
  const requestId = useRef(0);
  const savingProfileRef = useRef(false);
  const savingPasswordRef = useRef(false);
  const savingDetailRef = useRef(false);
  const isCurrent = (id: number, owner: string) => id === requestId.current && !!owner && activeAccountId.current === owner;

  // Settings sections are local state, not stack routes. Re-selecting the avatar
  // (or returning from another tab) should open the Settings index.
  useEffect(() => navigation.addListener('tabPress' as never, (event: { target?: string }) => {
    if (event.target !== route.key) return;
    requestId.current += 1;
    setPassword({ current: '', next: '', confirm: '' });
    setCategory(null);
    scrollRef.current?.scrollTo({ y: 0, animated: false });
  }), [navigation, route.key]);

  useEffect(() => {
    if (!category) return;
    const listener = BackHandler.addEventListener('hardwareBackPress', () => {
      requestId.current += 1;
      setPassword({ current: '', next: '', confirm: '' });
      setCategory(null);
      return true;
    });
    return () => listener.remove();
  }, [category]);

  useEffect(() => {
    const id = ++requestId.current;
    if (category !== 'general' && category !== 'notifications' && category !== 'profile') {
      setLoadingDetail(false);
      return;
    }
    if (category === 'general') setGeneral(null);
    if (category === 'notifications') setNotifications(null);
    if (category === 'profile') { setProfile(null); setProfileBase(null); }
    setLoadingDetail(true);
    const load = category === 'general' ? userAPI.getUserSettings() : category === 'profile' ? userAPI.loadUser() : userAPI.getNotificationSettings();
    load.then((data) => {
      if (!isCurrent(id, accountId)) return;
      if (!data || typeof data !== 'object' || (category === 'notifications' && typeof data.emailEnabled !== 'boolean')) throw new Error('Settings could not be loaded.');
      if (category === 'general') setGeneral(data);
      else if (category === 'notifications') setNotifications(data);
      else {
        if (getBiometricAccountId(data) !== accountId) throw new Error('Account details do not match this session.');
        const fields = profileFromUser(data);
        setProfileBase(fields);
        setProfile(fields);
      }
    }).catch((error) => {
      if (isCurrent(id, accountId)) Alert.alert('Settings unavailable', error?.message || 'Please try again later.');
    }).finally(() => {
      if (isCurrent(id, accountId)) setLoadingDetail(false);
    });
  }, [category, accountId]);

  const openCategory = (next: Category) => {
    requestId.current += 1;
    setGeneral(null);
    setNotifications(null);
    setProfile(null);
    setProfileBase(null);
    setPassword({ current: '', next: '', confirm: '' });
    setCategory(next);
    scrollRef.current?.scrollTo({ y: 0, animated: false });
  };

  const updateGeneral = async (field: string, value: string) => {
    if (!general || savingDetailRef.current) return;
    const id = requestId.current;
    savingDetailRef.current = true;
    setSavingDetail(true);
    try {
      const saved = await userAPI.saveUserSettings({ ...general, [field]: value });
      if (!saved || saved[field] !== value) throw new Error('Settings were not confirmed by the server.');
      if (isCurrent(id, accountId)) setGeneral(saved);
    } catch (error: any) {
      if (isCurrent(id, accountId)) Alert.alert('Setting not saved', error?.message || 'Please try again.');
    } finally {
      savingDetailRef.current = false;
      setSavingDetail(false);
    }
  };

  const updateNotification = async (field: string, value: boolean) => {
    if (!notifications || savingDetailRef.current) return;
    const id = requestId.current;
    if (value && field === 'emailEnabled' && !notifications.emailAddress) {
      Alert.alert('Email required', 'Add an email address to your account before enabling email notifications.');
      return;
    }
    if (value && field === 'phoneEnabled' && !notifications.phoneNumber) {
      Alert.alert('Phone required', 'Add a phone number to your account before enabling phone notifications.');
      return;
    }
    savingDetailRef.current = true;
    setSavingDetail(true);
    try {
      const saved = await userAPI.saveNotificationSettings({ ...notifications, [field]: value });
      if (!saved || saved[field] !== value) throw new Error('Settings were not confirmed by the server.');
      if (isCurrent(id, accountId)) setNotifications(saved);
    } catch (error: any) {
      if (isCurrent(id, accountId)) Alert.alert('Setting not saved', error?.message || 'Please try again.');
    } finally {
      savingDetailRef.current = false;
      setSavingDetail(false);
    }
  };

  const updatePreference = (key: string, channel: 'email' | 'phone' | 'inApp', value: boolean) => {
    if (!notifications || typeof notifications[key]?.[channel] !== 'boolean' || savingDetailRef.current) return;
    const next = { ...notifications, [key]: { ...notifications[key], [channel]: value } };
    const id = requestId.current;
    savingDetailRef.current = true;
    setSavingDetail(true);
    userAPI.saveNotificationSettings(next).then((saved) => {
      if (!saved || saved[key]?.[channel] !== value) throw new Error('Preference was not confirmed by the server.');
      if (isCurrent(id, accountId)) setNotifications(saved);
    }).catch((error) => {
      if (isCurrent(id, accountId)) Alert.alert('Preference not saved', error?.message || 'Please try again.');
    }).finally(() => { savingDetailRef.current = false; setSavingDetail(false); });
  };

  const saveProfile = async () => {
    if (!profile || !profileBase || !accountId || savingProfileRef.current || photoUploadInProgress.current) return;
    const next = Object.fromEntries(Object.entries(profile).map(([key, value]) => [key, value.trim()])) as ProfileForm;
    if (!next.firstName || !next.lastName || !validEmail(next.email) ||
        (next.businessEmail && !validEmail(next.businessEmail)) ||
        (next.phoneNumber && !/^[+\d\s().-]{7,25}$/.test(next.phoneNumber)) ||
        (next.businessPhone && !/^[+\d\s().-]{7,25}$/.test(next.businessPhone))) {
      Alert.alert('Check profile', 'First and last name and a valid email are required. Check any business email and phone numbers too.');
      return;
    }
    const id = requestId.current;
    savingProfileRef.current = true;
    setSavingProfile(true);
    let serverSaved = false;
    try {
      const saved = await userAPI.updateAccount(next);
      serverSaved = true;
      if (!isCurrent(id, accountId)) return;
      if (getBiometricAccountId(saved) !== accountId) throw new Error('Server returned a different account.');
      const confirmed = profileFromUser(saved);
      if (Object.keys(next).some((key) => confirmed[key as keyof ProfileForm] !== next[key as keyof ProfileForm])) {
        throw new Error('Server did not confirm the requested account details. Reopen Profile to refresh.');
      }
      const cached = await storageService.getUser<Record<string, any>>();
      if (!isCurrent(id, accountId)) return;
      if (!cached || getBiometricAccountId(cached) !== accountId || !await storageService.getToken()) {
        throw new Error('Server saved your changes, but your local session could not be refreshed. Sign in again or reopen Profile.');
      }
      const merged = { ...cached, ...saved, FirstName: confirmed.firstName, LastName: confirmed.lastName,
        firstName: confirmed.firstName, lastName: confirmed.lastName,
        Email: confirmed.email, PhoneNumber: confirmed.phoneNumber, BusinessName: confirmed.businessName,
        BusinessEmail: confirmed.businessEmail, BusinessPhone: confirmed.businessPhone };
      await storageService.setUser(merged);
      if (!isCurrent(id, accountId)) return;
      dispatch(applySavedAccount({ accountId, user: merged as NonNullable<typeof currentUser> }));
      setProfileBase(confirmed);
      setProfile(confirmed);
      Alert.alert('Profile saved', 'Your account details were updated.');
    } catch (error: any) {
      if (isCurrent(id, accountId)) Alert.alert(serverSaved ? 'Profile needs refresh' : 'Profile not saved', error?.message || 'Please reopen Profile to refresh.');
    } finally {
      savingProfileRef.current = false;
      setSavingProfile(false);
    }
  };

  const savePassword = async () => {
    if (!accountId || savingPasswordRef.current) return;
    const setPasswordFlow = currentUser?.hasPassword === false || currentUser?.HasPassword === false;
    if ((!setPasswordFlow && !password.current) || password.next.length < 8 || password.next.length > 128 ||
        !/[A-Z]/.test(password.next) || !/[a-z]/.test(password.next) || !/[0-9]/.test(password.next) ||
        !/[!@#$%^&*()_+\-=\[\]{}|;:,.<>?]/.test(password.next) || password.next !== password.confirm) {
      Alert.alert('Check password', 'Enter your current password (unless setting one for the first time), and confirm a new 8–128 character password with uppercase, lowercase, number and special character.');
      return;
    }
    const id = requestId.current;
    savingPasswordRef.current = true;
    setSavingPassword(true);
    try {
      await userAPI.changePassword(setPasswordFlow ? '' : password.current, password.next);
      if (!isCurrent(id, accountId)) return;
      setPassword({ current: '', next: '', confirm: '' });
      if (setPasswordFlow) {
        try {
          const cached = await storageService.getUser<Record<string, any>>();
          if (isCurrent(id, accountId) && cached && getBiometricAccountId(cached) === accountId && await storageService.getToken()) {
            const updated = { ...cached, hasPassword: true, HasPassword: true };
            await storageService.setUser(updated);
            if (isCurrent(id, accountId)) dispatch(applySavedAccount({ accountId, user: updated as unknown as NonNullable<typeof currentUser> }));
          }
        } catch {
          // The password was already changed remotely; a cache failure must not claim otherwise.
        }
      }
      if (isCurrent(id, accountId)) Alert.alert('Password saved', setPasswordFlow ? 'Your password is set.' : 'Your password was changed.');
    } catch (error: any) {
      if (isCurrent(id, accountId)) Alert.alert('Password not saved', error?.message || 'Please try again.');
    } finally {
      savingPasswordRef.current = false;
      setSavingPassword(false);
    }
  };

  useEffect(() => {
    Promise.all([biometricService.getAvailability(), biometricService.isEnabled(accountId)])
      .then(([availability, enabled]) => {
        setBiometricAvailability(availability);
        setBiometricEnabled(enabled && availability.available);
      })
      .catch(() => setBiometricAvailability({ available: false, label: 'Face ID', reason: 'Biometric unlock is unavailable.' }));
  }, [accountId]);

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

  const handleProfilePhotoPress = async () => {
    if (photoUploadInProgress.current || savingProfileRef.current || !accountId) return;
    photoUploadInProgress.current = true;
    try {
      const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (!permission.granted) {
        Alert.alert('Photo access needed', 'Allow photo library access in device settings to change your profile photo.');
        return;
      }
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ['images'],
        allowsEditing: true,
        aspect: [1, 1],
        quality: 0.8,
        preferredAssetRepresentationMode: ImagePicker.UIImagePickerPreferredAssetRepresentationMode.Compatible,
      });
      if (result.canceled || !result.assets?.[0] || activeAccountId.current !== accountId) return;
      const image = result.assets[0];
      if (image.fileSize && image.fileSize > 5 * 1024 * 1024) {
        Alert.alert('Photo too large', 'Choose a photo smaller than 5 MB after cropping.');
        return;
      }
      const mimeType = image.mimeType === 'image/png' ? 'image/png' : 'image/jpeg';
      if (image.mimeType && image.mimeType !== mimeType) {
        Alert.alert('Unsupported photo', 'Choose a JPEG or PNG photo.');
        return;
      }
      setUploadingPhoto(true);
      const imageUrl = await userAPI.uploadProfileImage({
        uri: image.uri,
        fileName: `profile-photo.${mimeType === 'image/png' ? 'png' : 'jpg'}`,
        mimeType,
      });
      if (activeAccountId.current !== accountId) return;
      dispatch(setProfileImage({ accountId, imageUrl }));
      // Cold session restore reads the cached user until the next server refresh.
      try {
        const cachedUser = await storageService.getUser<Record<string, any>>();
        if (activeAccountId.current === accountId && getBiometricAccountId(cachedUser) === accountId && await storageService.getToken()) {
          await storageService.setUser({ ...cachedUser, ProfileImageUrl: imageUrl, profileImageUrl: imageUrl });
        }
      } catch {
        // The server already saved the photo; a cache failure is not an upload failure.
      }
    } catch (error: any) {
      Alert.alert('Photo not saved', error?.message || error?.Message || 'Please try again.');
    } finally {
      photoUploadInProgress.current = false;
      setUploadingPhoto(false);
    }
  };

  const handleBiometricToggle = async (enabled: boolean) => {
    if (!enabled) {
      await biometricService.setEnabled(accountId, false);
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

    await biometricService.setEnabled(accountId, true);
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
      await biometricService.setEnabled(accountId, false);
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
      'This permanently removes access to Property Peace and anonymizes your personal profile. If you own an organization, ownership may transfer to another eligible member; if none exists, the organization may be deactivated. Financial, lease, and legal records may be retained where required. Active leases or subscriptions may need to be resolved first.',
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
    <View style={styles.container}>
      <View style={[styles.navigationHeader, { paddingTop: insets.top + 8 }]}>
        {category && <TouchableOpacity style={styles.backButton} onPress={() => { requestId.current += 1; setPassword({ current: '', next: '', confirm: '' }); setCategory(null); }} accessibilityRole="button" accessibilityLabel="Back to settings">
          <Ionicons name="arrow-back" size={22} color={colors.text} />
        </TouchableOpacity>}
        <Text style={[styles.navigationTitle, !category && styles.mainNavigationTitle]}>{category ? categories.find((item) => item.key === category)?.title : 'Settings'}</Text>
      </View>
      <ScrollView ref={scrollRef} style={styles.container} contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
      {!category && categories.map((item) => (
        <TouchableOpacity key={item.key} style={styles.menuRow} onPress={() => openCategory(item.key)} activeOpacity={0.7} accessibilityRole="button" accessibilityLabel={item.title}>
          <Ionicons name={item.icon} size={24} color={colors.text} />
          <Text style={styles.menuLabel}>{item.title}</Text>
          <Ionicons name="chevron-forward" size={19} color={colors.muted} />
        </TouchableOpacity>
      ))}

      {category === 'profile' && <View style={styles.profileSection}>
        <View style={styles.profileRow}>
          <TouchableOpacity
            style={styles.avatarButton}
            onPress={handleProfilePhotoPress}
            disabled={uploadingPhoto || !accountId}
            accessibilityRole="button"
            accessibilityLabel="Change profile photo"
            accessibilityHint="Choose and crop a photo; it saves automatically"
            accessibilityState={{ disabled: uploadingPhoto || !accountId, busy: uploadingPhoto }}
          >
            {profileImageUrl ? <Image source={{ uri: profileImageUrl }} style={styles.avatar} /> : <View style={styles.avatarFallback}><Text style={styles.avatarText}>{initials}</Text></View>}
            <View style={styles.cameraBadge}>
              {uploadingPhoto ? <ActivityIndicator size="small" color="#fff" /> : <Ionicons name="camera" size={15} color="#fff" />}
            </View>
          </TouchableOpacity>
          <View style={styles.profileCopy}>
            <Text style={styles.profileName}>{name}</Text>
            <Text style={styles.profileDetail}>{email}</Text>
            <Text style={styles.profileDetail}>{phone}</Text>
          </View>
        </View>
        <Text style={styles.rowValue}>Tap your photo to change it; photo changes save separately.</Text>
        {loadingDetail ? <ActivityIndicator color={colors.accent} /> : profile ? <>
          <Text style={styles.sectionTitle}>Personal information</Text>
          {profileFields.map(({ key, label, keyboard }, index) => <View key={key} style={styles.inputGroup}>
            {index === 4 && <Text style={styles.sectionTitle}>Business information</Text>}
            <Text style={styles.rowLabel}>{label}</Text>
            <TextInput style={[styles.input, { color: colors.text, borderColor: colors.border, backgroundColor: colors.surface }]}
              accessibilityLabel={label} value={profile[key]} onChangeText={(text) => setProfile((prev) => prev ? { ...prev, [key]: text } : prev)}
              editable={!savingProfile} keyboardType={keyboard || 'default'} autoCapitalize={keyboard === 'email-address' ? 'none' : 'words'} autoCorrect={false} />
          </View>)}
          <TouchableOpacity style={[styles.saveButton, (savingProfile || !profileBase || profileFields.every(({ key }) => profile[key] === profileBase[key])) && styles.disabled]}
            onPress={saveProfile} disabled={savingProfile || !profileBase || profileFields.every(({ key }) => profile[key] === profileBase[key])} accessibilityRole="button" accessibilityLabel="Save profile">
            <Text style={styles.saveButtonText}>{savingProfile ? 'Saving…' : 'Save profile'}</Text>
          </TouchableOpacity>
        </> : <Text style={styles.rowValue}>Could not load profile. Reopen this section to retry.</Text>}
      </View>}

      {category === 'appearance' && <>
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

      </>}

      {category === 'general' && (loadingDetail ? <ActivityIndicator color={colors.accent} style={styles.loader} /> : general ? <>
        <Text style={styles.sectionTitle}>Regional preferences</Text>
        <Text style={styles.rowValue}>These preferences are saved to your account. The mobile interface remains in English.</Text>
        <Text style={styles.rowLabel}>Currency</Text>
        {['USD', 'EUR', 'GBP', 'CAD', 'AUD'].map((value) => (
          <TouchableOpacity key={value} style={styles.menuRow} disabled={savingDetail} onPress={() => updateGeneral('currency', value)} accessibilityRole="radio" accessibilityState={{ selected: general.currency === value }}>
            <Text style={styles.menuLabel}>{value}</Text>
            {general.currency === value && <Ionicons name="checkmark" size={22} color={colors.accent} />}
          </TouchableOpacity>
        ))}
        <Text style={styles.rowValue}>Other general preferences are available in the web app.</Text>
        {savingDetail && <ActivityIndicator color={colors.accent} />}
      </> : <Text style={styles.rowValue}>Could not load general settings. Reopen this section to retry.</Text>)}

      {category === 'notifications' && (loadingDetail ? <ActivityIndicator color={colors.accent} style={styles.loader} /> : notifications ? <>
        <Text style={styles.sectionTitle}>Alert channels</Text>
        <Text style={styles.rowValue}>Manage alerts sent to the contact details on your account.</Text>
        {([['emailEnabled', 'Email notifications', notifications.emailAddress], ['phoneEnabled', 'Phone notifications', notifications.phoneNumber], ['dailySummaryEmail', 'Daily summary email', null]] as const).map(([field, label, detail]) => (
          <View key={field} style={styles.settingRow}>
            <View style={styles.rowCopy}><Text style={styles.rowLabel}>{label}</Text>{detail ? <Text style={styles.rowValue}>{detail}</Text> : null}</View>
            <Switch accessibilityLabel={label} value={!!notifications[field]} disabled={savingDetail} onValueChange={(value) => updateNotification(field, value)} trackColor={{ false: colors.border, true: colors.accent }} />
          </View>
        ))}
        <Text style={styles.sectionTitle}>Notification preferences</Text>
        {preferenceTypes.filter(([key]) => !key.startsWith('admin') || currentUser?.Roles?.some((role: string) => role.toLowerCase() === 'admin') || currentUser?.roles?.some((role: string) => role.toLowerCase() === 'admin')).map(([key, label]) => notifications[key] && <View key={key} style={styles.preferenceGroup}>
          <Text style={styles.rowLabel}>{label}</Text>
          {(['email', 'phone', 'inApp'] as const).map((channel) => <View key={channel} style={styles.preferenceRow}>
            <Text style={styles.rowValue}>{channel === 'inApp' ? 'In app' : channel === 'email' ? 'Email' : 'Phone'}</Text>
            <Switch accessibilityLabel={`${label}: ${channel}`} value={!!notifications[key][channel]} disabled={savingDetail}
              onValueChange={(value) => updatePreference(key, channel, value)} trackColor={{ false: colors.border, true: colors.accent }} />
          </View>)}
        </View>)}
        <Text style={styles.rowValue}>Notification delivery depends on your enabled channels. Edit alert addresses in the web app.</Text>
        {savingDetail && <ActivityIndicator color={colors.accent} />}
      </> : <Text style={styles.rowValue}>Could not load notification settings. Reopen this section to retry.</Text>)}

      {(category === 'subscription' || category === 'payments' || category === 'smsnumber') && <View style={styles.infoBlock}>
        <Text style={styles.rowValue}>{category === 'subscription' ? 'Plan management, billing and invoices are available in the web app.' : category === 'payments' ? 'Rent payment access, Stripe setup and payouts are managed in the web app.' : 'Dedicated SMS number setup and routing are managed in the web app.'}</Text>
        {webAppUrl ? <TouchableOpacity style={styles.menuRow} onPress={() => { void Linking.openURL(`${webAppUrl}${webCategoryPaths[category]}`); }} accessibilityRole="link"><Text style={styles.menuLabel}>Open in web app</Text><Ionicons name="open-outline" size={19} color={colors.muted} /></TouchableOpacity>
          : <Text style={styles.rowValue}>Web app link unavailable in this build.</Text>}
      </View>}

      {category === 'account' && <>
      <SectionHeader icon="lock-closed-outline" title={currentUser?.hasPassword === false || currentUser?.HasPassword === false ? 'Set password' : 'Change password'} />
      <Text style={styles.rowValue}>Use a password with 8–128 characters, uppercase and lowercase letters, a number and a special character.</Text>
      {(['current', 'next', 'confirm'] as const).map((key) => {
        if (key === 'current' && (currentUser?.hasPassword === false || currentUser?.HasPassword === false)) return null;
        const label = key === 'current' ? 'Current password' : key === 'next' ? 'New password' : 'Confirm new password';
        return <View key={key} style={styles.inputGroup}><Text style={styles.rowLabel}>{label}</Text>
          <TextInput style={[styles.input, { color: colors.text, borderColor: colors.border, backgroundColor: colors.surface }]}
            accessibilityLabel={label} secureTextEntry autoCapitalize="none" autoCorrect={false} value={password[key]} editable={!savingPassword}
            onChangeText={(text) => setPassword((prev) => ({ ...prev, [key]: text }))} />
        </View>;
      })}
      <TouchableOpacity style={[styles.saveButton, savingPassword && styles.disabled]} onPress={savePassword} disabled={savingPassword} accessibilityRole="button" accessibilityLabel="Save password">
        <Text style={styles.saveButtonText}>{savingPassword ? 'Saving…' : currentUser?.hasPassword === false || currentUser?.HasPassword === false ? 'Set password' : 'Change password'}</Text>
      </TouchableOpacity>
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
        <TouchableOpacity style={[styles.deleteButton, deleting && styles.disabled]} onPress={handleDeleteAccount} disabled={deleting}>
          <Ionicons name="trash-outline" size={20} color={mode === 'dark' ? '#ffa5a0' : '#b42318'} />
          <Text style={styles.deleteText}>{deleting ? 'Deleting…' : 'Delete account'}</Text>
        </TouchableOpacity>
      </View>
      </>}
      </ScrollView>
    </View>
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
    navigationHeader: { ...baseStyles.navigationHeader, borderBottomColor: colors.border },
    navigationTitle: { ...baseStyles.navigationTitle, color: colors.text },
    backButton: { ...baseStyles.backButton, backgroundColor: colors.surface, borderColor: colors.border },
    input: { ...baseStyles.input, borderColor: colors.border, color: colors.text, backgroundColor: colors.surface },
    menuRow: { ...baseStyles.menuRow, borderBottomColor: colors.border },
    menuLabel: { ...baseStyles.menuLabel, color: colors.text },
    eyebrow: { ...baseStyles.eyebrow, color: colors.muted },
    title: { ...baseStyles.title, color: colors.text },
    subtitle: { ...baseStyles.subtitle, color: colors.muted },
    profileSection: { ...baseStyles.profileSection, borderBottomColor: colors.border },
    sectionGroup: { ...baseStyles.sectionGroup, borderBottomColor: colors.border },
    avatarFallback: { ...baseStyles.avatarFallback, backgroundColor: colors.dock },
    avatarText: { ...baseStyles.avatarText, color: colors.dockText },
    profileName: { ...baseStyles.profileName, color: colors.text },
    profileDetail: { ...baseStyles.profileDetail, color: colors.muted },
    sectionTitle: { ...baseStyles.sectionTitle, color: colors.text },
    rowLabel: { ...baseStyles.rowLabel, color: colors.text },
    rowValue: { ...baseStyles.rowValue, color: colors.muted },
    linkRow: { ...baseStyles.linkRow, borderBottomColor: colors.border },
    linkLabel: { ...baseStyles.linkLabel, color: colors.text },
    versionText: { ...baseStyles.versionText, color: colors.muted },
    signOutButton: { ...baseStyles.signOutButton, borderBottomColor: colors.border },
    signOutText: { ...baseStyles.signOutText, color: '#ffa77e' },
    deleteText: { ...baseStyles.deleteText, color: '#ffa5a0' },
  });
}

const baseStyles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#fff' },
  content: { paddingHorizontal: 20, paddingTop: 16, paddingBottom: 32 },
  navigationHeader: { minHeight: 62, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: '#e8edf2', alignItems: 'center', justifyContent: 'flex-end', paddingBottom: 14, paddingHorizontal: 20 },
  navigationTitle: { color: '#102d43', fontSize: 17, fontWeight: '800', textAlign: 'center' },
  mainNavigationTitle: { fontSize: 22 },
  backButton: { position: 'absolute', left: 20, bottom: 4, height: 44, width: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: '#e8edf2', backgroundColor: '#fff', zIndex: 1 },
  menuRow: { minHeight: 63, flexDirection: 'row', alignItems: 'center', gap: 15, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: '#e8edf2' },
  menuLabel: { flex: 1, fontSize: 16, fontWeight: '600', color: '#102d43' },
  loader: { marginTop: 32 },
  infoBlock: { paddingTop: 20, gap: 14 },
  inputGroup: { gap: 6, paddingTop: 12 },
  input: { borderWidth: 1, borderRadius: 10, minHeight: 48, paddingHorizontal: 14, fontSize: 16 },
  saveButton: { marginTop: 18, minHeight: 48, borderRadius: 10, backgroundColor: '#2475cf', alignItems: 'center', justifyContent: 'center' },
  saveButtonText: { color: '#fff', fontSize: 16, fontWeight: '700' },
  preferenceGroup: { paddingTop: 14 },
  preferenceRow: { minHeight: 48, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  intro: { paddingBottom: 28 },
  eyebrow: { color: '#64748b', fontSize: 11, fontWeight: '800', letterSpacing: 1.2, textTransform: 'uppercase', marginBottom: 6 },
  title: { color: '#102d43', fontSize: 30, fontWeight: '800', marginBottom: 5 },
  subtitle: { color: '#64748b', fontSize: 15, lineHeight: 21 },
  profileSection: { paddingTop: 20, paddingBottom: 24, borderBottomWidth: 1, borderBottomColor: '#e8edf2', gap: 18 },
  sectionGroup: { borderBottomWidth: 1, borderBottomColor: '#e8edf2' },
  profileRow: { flexDirection: 'row', alignItems: 'center', gap: 15 },
  avatarButton: { width: 72, height: 74, justifyContent: 'center' },
  avatar: { width: 68, height: 68, borderRadius: 24, backgroundColor: '#d8dde2' },
  cameraBadge: { position: 'absolute', right: 0, bottom: 0, width: 29, height: 29, borderRadius: 15, backgroundColor: '#2475cf', alignItems: 'center', justifyContent: 'center', borderWidth: 2, borderColor: '#fff' },
  avatarFallback: { width: 68, height: 68, borderRadius: 24, backgroundColor: '#0b3558', alignItems: 'center', justifyContent: 'center' },
  avatarText: { color: '#fff', fontWeight: '900', fontSize: 21 },
  profileCopy: { flex: 1, minWidth: 0 },
  profileName: { color: '#102d43', fontSize: 20, fontWeight: '900', marginBottom: 5 },
  profileDetail: { color: '#596876', fontSize: 14, lineHeight: 20 },
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
  deleteButton: { minHeight: 50, flexDirection: 'row', alignItems: 'center', gap: 9 },
  deleteText: { color: '#b42318', fontSize: 15, fontWeight: '900' },
  disabled: { opacity: 0.6 },
});
