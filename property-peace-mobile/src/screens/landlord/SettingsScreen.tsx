import React, { useMemo, useState } from 'react';
import { Alert, Image, ScrollView, StyleSheet, Switch, Text, TouchableOpacity, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useAppDispatch, useAppSelector } from '../../store/hooks';
import { logout } from '../../store/user/user.slice';

type SettingsTab = {
  key: string;
  label: string;
  description: string;
  icon: keyof typeof Ionicons.glyphMap;
};

const tabs: SettingsTab[] = [
  { key: 'profile', label: 'Profile', description: 'Your name, contact details, and public identity.', icon: 'id-card-outline' },
  { key: 'general', label: 'General', description: 'Default app behavior and landlord preferences.', icon: 'settings-outline' },
  { key: 'account', label: 'Account Settings', description: 'Login, security, and account-level controls.', icon: 'person-outline' },
  { key: 'payments', label: 'Bank Settings', description: 'Payment accounts, payouts, and billing rails.', icon: 'card-outline' },
  { key: 'smsnumber', label: 'SMS Number Settings', description: 'Tenant texting number, routing, and setup.', icon: 'phone-portrait-outline' },
  { key: 'notifications', label: 'Notifications', description: 'Alerts, reminders, and communication preferences.', icon: 'notifications-outline' },
  { key: 'appearance', label: 'Appearance', description: 'Theme, color, and display customization.', icon: 'color-palette-outline' },
  { key: 'aiSummary', label: 'AI Summary', description: 'Automated summaries and AI assistance.', icon: 'sparkles-outline' },
];

const firstString = (...values: any[]) => {
  for (const value of values) {
    if (typeof value === 'string' && value.trim()) return value.trim();
  }
  return '';
};

export default function SettingsScreen() {
  const dispatch = useAppDispatch();
  const { currentUser } = useAppSelector((state) => state.user);
  const [activeIndex, setActiveIndex] = useState(0);
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const [emailAlerts, setEmailAlerts] = useState(true);
  const [smsAlerts, setSmsAlerts] = useState(false);
  const [darkMode, setDarkMode] = useState(false);

  const activeTab = tabs[activeIndex];
  const name = firstString(
    `${currentUser?.FirstName || currentUser?.firstName || ''} ${currentUser?.LastName || currentUser?.lastName || ''}`,
    currentUser?.Name,
    currentUser?.name,
    'Property Peace user',
  );
  const email = firstString(currentUser?.Email, currentUser?.email, 'No email on file');
  const phone = firstString(currentUser?.PhoneNumber, currentUser?.phoneNumber, 'No phone on file');
  const businessName = firstString(currentUser?.BusinessName, currentUser?.businessName, 'Not set');
  const businessEmail = firstString(currentUser?.BusinessEmail, currentUser?.businessEmail, 'Not set');
  const businessPhone = firstString(currentUser?.BusinessPhone, currentUser?.businessPhone, 'Not set');
  const profileImageUrl = firstString(currentUser?.ProfileImageUrl, currentUser?.profileImageUrl);
  const initials = name.split(/\s+/).map((part) => part[0]).join('').slice(0, 2).toUpperCase() || 'PP';

  const handleLogout = () => {
    Alert.alert('Sign out', 'Are you sure you want to sign out?', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Sign out', style: 'destructive', onPress: () => dispatch(logout()) },
    ]);
  };

  const panelRows = useMemo(() => {
    switch (activeTab.key) {
      case 'general':
        return [
          { label: 'Default dashboard', value: 'Landlord overview', icon: 'speedometer-outline' as const },
          { label: 'Currency', value: 'USD', icon: 'cash-outline' as const },
          { label: 'Date format', value: 'Month day, year', icon: 'calendar-outline' as const },
        ];
      case 'account':
        return [
          { label: 'Password', value: 'Managed from web app', icon: 'lock-closed-outline' as const },
          { label: 'Two-factor auth', value: 'Available soon', icon: 'shield-checkmark-outline' as const },
          { label: 'Connected sessions', value: 'This device', icon: 'phone-portrait-outline' as const },
        ];
      case 'payments':
        return [
          { label: 'Bank account', value: 'Connect in web app', icon: 'business-outline' as const },
          { label: 'Payout schedule', value: 'Standard', icon: 'repeat-outline' as const },
          { label: 'Payment rails', value: 'Stripe / ACH', icon: 'card-outline' as const },
        ];
      case 'smsnumber':
        return [
          { label: 'Dedicated number', value: 'Configure in web app', icon: 'call-outline' as const },
          { label: 'Tenant routing', value: 'Messages inbox', icon: 'chatbubbles-outline' as const },
          { label: 'Reminders', value: 'Rent and maintenance', icon: 'alarm-outline' as const },
        ];
      default:
        return [
          { label: 'Daily summary', value: 'Enabled in web app', icon: 'newspaper-outline' as const },
          { label: 'Maintenance digest', value: 'Available soon', icon: 'construct-outline' as const },
          { label: 'Rent insights', value: 'Monthly rollups', icon: 'analytics-outline' as const },
        ];
    }
  }, [activeTab.key]);

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
      <View style={styles.settingsNavCard}>
        <Text style={styles.navTitle}>Settings</Text>
        <Text style={styles.navSubtitle}>Choose the area you want to manage.</Text>

        <TouchableOpacity style={styles.selector} activeOpacity={0.8} onPress={() => setDropdownOpen((open) => !open)}>
          <View style={styles.selectorLeading}>
            <Ionicons name={activeTab.icon} size={22} color="#0f2f47" />
            <Text style={styles.selectorText}>{activeTab.label}</Text>
          </View>
          <Ionicons name={dropdownOpen ? 'chevron-up' : 'chevron-down'} size={20} color="#7b858f" />
        </TouchableOpacity>

        {dropdownOpen && (
          <View style={styles.dropdownList}>
            {tabs.map((tab, index) => {
              const selected = index === activeIndex;
              return (
                <TouchableOpacity
                  key={tab.key}
                  style={[styles.dropdownOption, selected && styles.dropdownOptionActive]}
                  onPress={() => {
                    setActiveIndex(index);
                    setDropdownOpen(false);
                  }}
                  activeOpacity={0.78}
                >
                  <Ionicons name={tab.icon} size={18} color={selected ? '#2475cf' : '#526171'} />
                  <Text style={[styles.dropdownOptionText, selected && styles.dropdownOptionTextActive]}>{tab.label}</Text>
                </TouchableOpacity>
              );
            })}
          </View>
        )}
      </View>

      <View style={styles.panelCard}>
        <View style={styles.panelHeader}>
          <View style={styles.panelIconWrap}>
            <Ionicons name={activeTab.icon} size={24} color="#2475cf" />
          </View>
          <View style={styles.panelHeaderCopy}>
            <Text style={styles.panelTitle}>{activeTab.label}</Text>
            <Text style={styles.panelDescription}>{activeTab.description}</Text>
          </View>
        </View>

        {activeTab.key === 'profile' ? (
          <View style={styles.profileSections}>
            <SettingsSection icon="person-outline" title="Profile Information" description="Manage your profile information and personal details.">
              <View style={styles.profileSummary}>
                <View style={styles.avatarWrap}>
                  {profileImageUrl ? (
                    <Image source={{ uri: profileImageUrl }} style={styles.avatarImage} />
                  ) : (
                    <View style={styles.avatarFallback}><Text style={styles.avatarText}>{initials}</Text></View>
                  )}
                  <View style={styles.cameraBadge}>
                    <Ionicons name="camera-outline" size={16} color="#fff" />
                  </View>
                </View>
                <View style={styles.profileCopy}>
                  <Text style={styles.profileName}>{name}</Text>
                  <View style={styles.contactRow}>
                    <Ionicons name="mail-outline" size={18} color="#596876" />
                    <Text style={styles.contactText}>{email}</Text>
                  </View>
                  <View style={styles.contactRow}>
                    <Ionicons name="call-outline" size={18} color="#596876" />
                    <Text style={styles.contactText}>{phone}</Text>
                  </View>
                </View>
              </View>
            </SettingsSection>

            <SettingsSection icon="storefront-outline" title="Business Information" description="Update your business information and contact details.">
              <DetailBlock label="Business Name" value={businessName} />
              <DetailBlock label="Business Email" value={businessEmail} />
              <DetailBlock label="Business Phone" value={businessPhone} />
            </SettingsSection>
          </View>
        ) : activeTab.key === 'notifications' ? (
          <View style={styles.rowGroup}>
            <ToggleRow icon="mail-outline" label="Email alerts" description="Lease, payment, and maintenance updates." value={emailAlerts} onValueChange={setEmailAlerts} />
            <ToggleRow icon="chatbubble-ellipses-outline" label="SMS alerts" description="Urgent tenant and rent reminders." value={smsAlerts} onValueChange={setSmsAlerts} />
          </View>
        ) : activeTab.key === 'appearance' ? (
          <View style={styles.rowGroup}>
            <ToggleRow icon="moon-outline" label="Dark mode" description="Match the main app appearance settings." value={darkMode} onValueChange={setDarkMode} />
            <InfoRow icon="color-palette-outline" label="Accent color" value="Property Peace blue" />
            <InfoRow icon="phone-portrait-outline" label="Mobile density" value="Comfortable" />
          </View>
        ) : (
          <View style={styles.rowGroup}>
            {panelRows.map((row) => <InfoRow key={row.label} icon={row.icon} label={row.label} value={row.value} />)}
          </View>
        )}
      </View>

      <TouchableOpacity style={styles.signOutButton} onPress={handleLogout} activeOpacity={0.82}>
        <Ionicons name="log-out-outline" size={20} color="#c2413b" />
        <Text style={styles.signOutText}>Sign out</Text>
      </TouchableOpacity>
    </ScrollView>
  );
}

function SettingsSection({ icon, title, description, children }: { icon: keyof typeof Ionicons.glyphMap; title: string; description: string; children: React.ReactNode }) {
  return (
    <View style={styles.sectionCard}>
      <View style={styles.sectionHeaderRow}>
        <View style={styles.sectionTitleRow}>
          <Ionicons name={icon} size={24} color="#2475cf" />
          <Text style={styles.sectionTitle}>{title}</Text>
        </View>
        <TouchableOpacity style={styles.editButton} activeOpacity={0.78}>
          <Ionicons name="pencil-outline" size={19} color="#2475cf" />
          <Text style={styles.editButtonText}>Edit</Text>
        </TouchableOpacity>
      </View>
      <Text style={styles.sectionDescription}>{description}</Text>
      <View style={styles.sectionBody}>{children}</View>
    </View>
  );
}

function DetailBlock({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.detailBlock}>
      <Text style={styles.detailLabel}>{label}</Text>
      <Text style={styles.detailValue}>{value}</Text>
    </View>
  );
}

function InfoRow({ icon, label, value }: { icon: keyof typeof Ionicons.glyphMap; label: string; value: string }) {
  return (
    <View style={styles.infoRow}>
      <View style={styles.rowIcon}><Ionicons name={icon} size={19} color="#2475cf" /></View>
      <View style={styles.rowCopy}>
        <Text style={styles.rowLabel}>{label}</Text>
        <Text style={styles.rowValue}>{value}</Text>
      </View>
    </View>
  );
}

function ToggleRow({ icon, label, description, value, onValueChange }: { icon: keyof typeof Ionicons.glyphMap; label: string; description: string; value: boolean; onValueChange: (value: boolean) => void }) {
  return (
    <View style={styles.infoRow}>
      <View style={styles.rowIcon}><Ionicons name={icon} size={19} color="#2475cf" /></View>
      <View style={styles.rowCopy}>
        <Text style={styles.rowLabel}>{label}</Text>
        <Text style={styles.rowValue}>{description}</Text>
      </View>
      <Switch value={value} onValueChange={onValueChange} trackColor={{ false: '#d7dde2', true: '#9bd3ff' }} thumbColor={value ? '#2475cf' : '#fff'} />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#fbf7f4' },
  content: { padding: 18, paddingBottom: 120, gap: 16 },
  settingsNavCard: {
    backgroundColor: '#fff',
    borderRadius: 22,
    padding: 18,
    borderWidth: 1,
    borderColor: '#edf0f2',
    shadowColor: '#102d43',
    shadowOpacity: 0.07,
    shadowRadius: 14,
    shadowOffset: { width: 0, height: 6 },
    elevation: 2,
  },
  navTitle: { color: '#102d43', fontSize: 26, lineHeight: 31, fontWeight: '900', marginBottom: 5, letterSpacing: -0.5 },
  navSubtitle: { color: '#556474', fontSize: 15, lineHeight: 21, marginBottom: 18 },
  selector: {
    minHeight: 56,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#dfe7ee',
    backgroundColor: '#f9fbfd',
    paddingHorizontal: 14,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  selectorLeading: { flex: 1, minWidth: 0, flexDirection: 'row', alignItems: 'center', gap: 12 },
  selectorText: { color: '#0f2f47', fontSize: 17, fontWeight: '800', flexShrink: 1 },
  dropdownList: { marginTop: 10, borderRadius: 16, borderWidth: 1, borderColor: '#e3e8ec', backgroundColor: '#fff', overflow: 'hidden' },
  dropdownOption: { minHeight: 48, flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 14, paddingVertical: 13, borderBottomWidth: 1, borderBottomColor: '#f0f3f5' },
  dropdownOptionActive: { backgroundColor: '#f0f7ff' },
  dropdownOptionText: { color: '#526171', fontSize: 15, fontWeight: '700' },
  dropdownOptionTextActive: { color: '#2475cf' },
  panelCard: {
    backgroundColor: '#fff',
    borderRadius: 22,
    borderWidth: 1,
    borderColor: '#dceafa',
    overflow: 'hidden',
  },
  panelHeader: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 18, paddingTop: 20, paddingBottom: 16, backgroundColor: '#fff' },
  panelIconWrap: { width: 48, height: 48, borderRadius: 16, backgroundColor: '#eaf3ff', alignItems: 'center', justifyContent: 'center' },
  panelHeaderCopy: { flex: 1, minWidth: 0 },
  panelTitle: { color: '#102d43', fontSize: 25, lineHeight: 31, fontWeight: '900', marginBottom: 3, letterSpacing: -0.4 },
  panelDescription: { color: '#556474', fontSize: 15, lineHeight: 21 },
  profileSections: { paddingHorizontal: 16, paddingBottom: 18, gap: 14 },
  sectionCard: { borderWidth: 1, borderColor: '#e6eaee', borderRadius: 18, backgroundColor: '#fff', padding: 16 },
  sectionHeaderRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12, marginBottom: 14 },
  sectionTitleRow: { flexDirection: 'row', alignItems: 'center', gap: 10, flex: 1, minWidth: 0 },
  sectionTitle: { color: '#102d43', fontSize: 19, lineHeight: 24, fontWeight: '900', flexShrink: 1 },
  editButton: { minHeight: 44, flexDirection: 'row', alignItems: 'center', gap: 7, paddingVertical: 6, paddingHorizontal: 6 },
  editButtonText: { color: '#2475cf', fontSize: 16, fontWeight: '700' },
  sectionDescription: { color: '#556474', fontSize: 14, lineHeight: 21, marginBottom: 18 },
  sectionBody: { gap: 14 },
  profileSummary: { flexDirection: 'row', alignItems: 'center', gap: 16 },
  avatarWrap: { width: 76, height: 76, borderRadius: 38 },
  avatarImage: { width: 76, height: 76, borderRadius: 38, backgroundColor: '#d8dde2' },
  avatarFallback: { width: 76, height: 76, borderRadius: 38, backgroundColor: '#0b3558', alignItems: 'center', justifyContent: 'center' },
  avatarText: { color: '#fff', fontWeight: '900', fontSize: 23 },
  cameraBadge: { position: 'absolute', right: -1, bottom: -1, width: 30, height: 30, borderRadius: 10, backgroundColor: '#2475cf', alignItems: 'center', justifyContent: 'center' },
  profileCopy: { flex: 1, minWidth: 0 },
  profileName: { color: '#102d43', fontSize: 21, lineHeight: 26, fontWeight: '900', marginBottom: 8, textTransform: 'capitalize' },
  contactRow: { flexDirection: 'row', alignItems: 'center', gap: 9, marginTop: 6 },
  contactText: { color: '#263744', fontSize: 14, lineHeight: 20, flexShrink: 1 },
  detailBlock: { gap: 7, padding: 14, borderRadius: 14, backgroundColor: '#fbfdff', borderWidth: 1, borderColor: '#eef3f6' },
  detailLabel: { color: '#657381', fontSize: 12, lineHeight: 16, fontWeight: '900', letterSpacing: 0.5, textTransform: 'uppercase' },
  detailValue: { color: '#102d43', fontSize: 16, lineHeight: 22, fontWeight: '700' },
  rowGroup: { padding: 16, gap: 10 },
  infoRow: { minHeight: 58, flexDirection: 'row', alignItems: 'center', gap: 12, padding: 14, borderRadius: 16, borderWidth: 1, borderColor: '#edf1f4', backgroundColor: '#fff' },
  rowIcon: { width: 34, height: 34, borderRadius: 11, backgroundColor: '#edf6ff', alignItems: 'center', justifyContent: 'center' },
  rowCopy: { flex: 1, minWidth: 0 },
  rowLabel: { color: '#102d43', fontSize: 15, fontWeight: '800', marginBottom: 2 },
  rowValue: { color: '#6a7885', fontSize: 13, lineHeight: 18 },
  signOutButton: { minHeight: 52, flexDirection: 'row', alignItems: 'center', gap: 10, backgroundColor: '#fff', borderRadius: 17, borderWidth: 1, borderColor: '#f0d8d6', padding: 16 },
  signOutText: { color: '#c2413b', fontSize: 16, fontWeight: '900' },
});
