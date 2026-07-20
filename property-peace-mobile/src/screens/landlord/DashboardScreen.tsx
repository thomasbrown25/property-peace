import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Image,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAppDispatch, useAppSelector } from '../../store/hooks';
import { logout } from '../../store/user/user.slice';
import DashboardAPI from '../../api/dashboardAPI';
import NotificationAPI, { AppNotification } from '../../api/notificationAPI';

const logo = require('../../../assets/property-peace-navbar-logo.png');

const pickNumber = (source: any, keys: string[]) => {
  for (const key of keys) {
    const value = source?.[key];
    if (typeof value === 'number') return value;
    if (typeof value === 'string' && value.trim() !== '' && !Number.isNaN(Number(value))) return Number(value);
  }
  return 0;
};

const money = (value: number) =>
  new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: value % 1 === 0 ? 0 : 2 }).format(value || 0);

const getGreeting = () => {
  const hour = new Date().getHours();
  if (hour < 12) return 'Good morning';
  if (hour < 17) return 'Good afternoon';
  return 'Good evening';
};

const getLongDate = () =>
  new Intl.DateTimeFormat('en-US', { weekday: 'long', month: 'long', day: 'numeric' }).format(new Date());

const firstString = (...values: any[]) => {
  for (const value of values) {
    if (typeof value === 'string' && value.trim()) return value.trim();
  }
  return '';
};

export default function DashboardScreen({ onMenuPress }: { onMenuPress?: () => void } = {}) {
  const navigation = useNavigation<any>();
  const dispatch = useAppDispatch();
  const insets = useSafeAreaInsets();
  const { currentUser } = useAppSelector((state) => state.user);
  const [summary, setSummary] = useState<any>(null);
  const [notifications, setNotifications] = useState<AppNotification[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [profileMenuOpen, setProfileMenuOpen] = useState(false);

  const loadDashboard = useCallback(async () => {
    try {
      const [summaryData, notificationData] = await Promise.all([
        DashboardAPI.getSummary().catch(() => null),
        NotificationAPI.getNotifications().catch(() => []),
      ]);
      setSummary(summaryData || {});
      setNotifications((notificationData || []).slice(0, 3));
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => { loadDashboard(); }, [loadDashboard]);

  const firstName = firstString(
    currentUser?.FirstName,
    currentUser?.firstName,
    currentUser?.firstname,
    currentUser?.Name,
    currentUser?.name,
    currentUser?.Email,
    currentUser?.email,
  ).split(/[\s@]/)[0] || 'there';

  const avatarLabel = (firstName || 'P').slice(0, 1).toUpperCase();
  const displayName = firstString(
    `${currentUser?.FirstName || currentUser?.firstName || ''} ${currentUser?.LastName || currentUser?.lastName || ''}`,
    currentUser?.Name,
    currentUser?.name,
    firstName,
  );
  const email = firstString(currentUser?.Email, currentUser?.email, 'No email');
  const profileImageUrl = firstString(currentUser?.ProfileImageUrl, currentUser?.profileImageUrl);

  const metrics = useMemo(() => {
    const rentExpected = pickNumber(summary, ['rentExpected', 'expectedRent', 'monthlyRentExpected', 'totalRentDue', 'totalMonthlyRent', 'rentDue']);
    const rentCollected = pickNumber(summary, ['rentCollected', 'collectedRent', 'monthlyRentCollected', 'totalCollected', 'paymentsCollected']);
    const outstanding = pickNumber(summary, ['outstanding', 'rentOutstanding', 'outstandingRent', 'totalOutstanding', 'balanceDue']) || Math.max(rentExpected - rentCollected, 0);
    const expenses = pickNumber(summary, ['expenses', 'monthlyExpenses', 'totalExpenses', 'expensesThisMonth']);
    const collectionRate = rentExpected > 0 ? Math.min(100, Math.round((rentCollected / rentExpected) * 100)) : 0;
    return { rentExpected, rentCollected, outstanding, expenses, collectionRate };
  }, [summary]);

  const attentionCount = notifications.length;

  if (loading) return <View style={styles.centerContainer}><ActivityIndicator size="large" color="#0b3558" /></View>;

  return (
    <View style={styles.container}>
      <View style={[styles.topBar, { paddingTop: Math.max(insets.top + 12, 20) }]}>
        <TouchableOpacity style={styles.iconButton} onPress={onMenuPress} activeOpacity={0.75}>
          <Ionicons name="menu-outline" size={25} color="#0b2438" />
        </TouchableOpacity>
        <Image source={logo} style={styles.logo} resizeMode="contain" />
        <TouchableOpacity style={[styles.avatar, profileMenuOpen && styles.avatarActive]} onPress={() => setProfileMenuOpen((open) => !open)} activeOpacity={0.8}>
          {profileImageUrl ? <Image source={{ uri: profileImageUrl }} style={styles.avatarImage} /> : <Text style={styles.avatarText}>{avatarLabel}</Text>}
        </TouchableOpacity>
      </View>

      {profileMenuOpen && (
        <ProfileMenu
          topOffset={Math.max(insets.top + 12, 20) + 50}
          displayName={displayName}
          email={email}
          avatarLabel={avatarLabel}
          profileImageUrl={profileImageUrl}
          onClose={() => setProfileMenuOpen(false)}
          onNavigate={(route) => {
            setProfileMenuOpen(false);
            navigation.navigate(route);
          }}
          onLogout={async () => {
            setProfileMenuOpen(false);
            await dispatch(logout());
          }}
        />
      )}

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={[styles.content, { paddingBottom: Math.max(insets.bottom, 16) + 112 }]}
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); loadDashboard(); }} tintColor="#0b3558" />}
      >
        <View style={styles.dateRow}>
          <Ionicons name="calendar-outline" size={17} color="#0f2334" />
          <Text style={styles.dateText}>{getLongDate()}</Text>
        </View>

        <Text style={styles.heroTitle}>{getGreeting()}, {firstName}.</Text>
        <Text style={styles.heroSubtitle}>{attentionCount || 'No'} {attentionCount === 1 ? 'thing needs' : 'things need'} your attention today</Text>

        <Text style={styles.quickSectionTitle}>Quick actions</Text>
        <View style={styles.quickList}>
          <QuickAction
            icon="cash-outline"
            title="Record Payment"
            color="#62c944"
            background="#effbea"
            onPress={() => navigation.navigate('Leases')}
          />
          <QuickAction
            icon="receipt-outline"
            title="Add Expense"
            color="#f2b72e"
            background="#fff7e9"
            onPress={() => navigation.navigate('Properties')}
          />
          <QuickAction
            icon="construct-outline"
            title="Create Maintenance"
            color="#fb5b73"
            background="#fff0f3"
            onPress={() => navigation.navigate('Maintenance', { screen: 'AddMaintenance' })}
          />
          <QuickAction
            icon="chatbubble-ellipses-outline"
            title="Send Rent Reminder"
            color="#34c7c3"
            background="#eafcfb"
            onPress={() => navigation.navigate('Messages')}
          />
        </View>

        <View style={styles.moneyCard}>
          <View style={styles.moneyHeader}>
            <Text style={styles.moneyTitle}>Money{`\n`}Summary</Text>
            <View style={styles.filterCluster}>
              <View style={[styles.filterPill, styles.filterPillActive]}><Text style={styles.filterPillActiveText}>This month</Text></View>
              <View style={styles.filterPill}><Text style={styles.filterPillText}>All time</Text></View>
            </View>
            <TouchableOpacity style={styles.viewAllButton} onPress={() => navigation.navigate('Leases')} activeOpacity={0.75}>
              <Text style={styles.viewAllText}>View all</Text>
              <Ionicons name="arrow-forward" size={18} color="#172533" />
            </TouchableOpacity>
          </View>

          <View style={styles.metricList}>
            <Metric label="Rent Expected" value={money(metrics.rentExpected)} color="#2475cf" />
            <Metric label="Rent Collected" value={money(metrics.rentCollected)} color="#2475cf" />
            <Metric label="Outstanding" value={money(metrics.outstanding)} color="#f05364" />
            <Metric label="Expenses" value={money(metrics.expenses)} color="#0b2438" />
          </View>

          <View style={styles.progressHeader}>
            <Text style={styles.progressLabel}>Collection progress</Text>
            <Text style={styles.progressPercent}>{metrics.collectionRate}%</Text>
          </View>
          <View style={styles.progressTrack}>
            <View style={[styles.progressFill, { width: `${metrics.collectionRate}%` }]} />
          </View>

          <View style={styles.netRow}>
            <Text style={styles.netLabel}>Net this month:</Text>
            <Text style={[styles.netValue, { color: metrics.rentCollected - metrics.expenses >= 0 ? '#5fc73f' : '#f05364' }]}>
              {money(metrics.rentCollected - metrics.expenses)}
            </Text>
          </View>
        </View>

        <View style={styles.notificationsCard}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>Recent Activity</Text>
            <TouchableOpacity onPress={() => navigation.navigate('Notifications')}><Text style={styles.sectionLink}>View all</Text></TouchableOpacity>
          </View>
          {notifications.length === 0 ? (
            <View style={styles.emptyState}>
              <Ionicons name="checkmark-circle-outline" size={22} color="#62c944" />
              <Text style={styles.emptyText}>No new notifications.</Text>
            </View>
          ) : notifications.map((notification: any) => (
            <View key={String(notification.id || notification.Id)} style={styles.notificationRow}>
              <View style={styles.notificationDot} />
              <View style={styles.notificationCopy}>
                <Text style={styles.notificationTitle}>{notification.title || notification.Title || 'Notification'}</Text>
                <Text style={styles.notificationMessage}>{notification.message || notification.Message}</Text>
              </View>
            </View>
          ))}
        </View>
      </ScrollView>
    </View>
  );
}

function ProfileMenu({
  topOffset,
  displayName,
  email,
  avatarLabel,
  profileImageUrl,
  onClose,
  onNavigate,
  onLogout,
}: {
  topOffset: number;
  displayName: string;
  email: string;
  avatarLabel: string;
  profileImageUrl: string;
  onClose: () => void;
  onNavigate: (route: string) => void;
  onLogout: () => void | Promise<void>;
}) {
  return (
    <View style={styles.profileMenuLayer} pointerEvents="box-none">
      <Pressable style={StyleSheet.absoluteFill} onPress={onClose} />
      <View style={[styles.profileMenu, { top: topOffset }]}>
        <TouchableOpacity style={styles.profileHeader} activeOpacity={0.78} onPress={() => onNavigate('Settings')}>
          <View style={styles.profileAvatarLarge}>
            {profileImageUrl ? <Image source={{ uri: profileImageUrl }} style={styles.profileAvatarImage} /> : <Text style={styles.profileAvatarText}>{avatarLabel}</Text>}
          </View>
          <View style={styles.profileHeaderCopy}>
            <Text style={styles.profileName} numberOfLines={1}>{displayName}</Text>
            <View style={styles.profileEmailRow}>
              <Ionicons name="mail-outline" size={14} color="#6a7885" />
              <Text style={styles.profileEmail} numberOfLines={1}>{email}</Text>
            </View>
          </View>
        </TouchableOpacity>

        <View style={styles.profileDivider} />
        <ProfileMenuItem icon="notifications-outline" label="Notifications" onPress={() => onNavigate('Notifications')} />
        <ProfileMenuItem icon="mail-outline" label="Messages" onPress={() => onNavigate('Messages')} />
        <View style={styles.profileDivider} />
        <ProfileMenuItem icon="settings-outline" label="Settings" onPress={() => onNavigate('Settings')} />
        <ProfileMenuItem icon="help-circle-outline" label="Support" onPress={() => onNavigate('Settings')} />
        <ProfileMenuItem icon="chatbox-ellipses-outline" label="Feedback" onPress={() => onNavigate('Settings')} />
        <View style={styles.profileDivider} />
        <ProfileMenuItem icon="log-out-outline" label="Sign out" destructive onPress={onLogout} />
      </View>
    </View>
  );
}

function ProfileMenuItem({ icon, label, onPress, destructive = false }: { icon: keyof typeof Ionicons.glyphMap; label: string; onPress: () => void | Promise<void>; destructive?: boolean }) {
  return (
    <TouchableOpacity style={styles.profileMenuItem} onPress={onPress} activeOpacity={0.76}>
      <Ionicons name={icon} size={20} color={destructive ? '#c2413b' : '#20394d'} />
      <Text style={[styles.profileMenuItemText, destructive && styles.profileMenuItemTextDestructive]}>{label}</Text>
    </TouchableOpacity>
  );
}

function QuickAction({ icon, title, color, background, onPress }: { icon: keyof typeof Ionicons.glyphMap; title: string; color: string; background: string; onPress: () => void }) {
  return (
    <TouchableOpacity style={styles.quickAction} onPress={onPress} activeOpacity={0.82}>
      <View style={[styles.quickIconWrap, { backgroundColor: background }]}>
        <Ionicons name={icon} size={27} color={color} />
      </View>
      <View style={styles.quickCopy}>
        <Text style={styles.quickTitle}>{title}</Text>
      </View>
      <Ionicons name="chevron-forward" size={21} color="#90a0ae" />
    </TouchableOpacity>
  );
}

function Metric({ value, label, color }: { value: string; label: string; color: string }) {
  return (
    <View style={styles.metricItem}>
      <Text style={styles.metricLabel}>{label}</Text>
      <Text style={[styles.metricValue, { color }]} numberOfLines={1} adjustsFontSizeToFit>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#fbf7f4' },
  centerContainer: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#fbf7f4' },
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingBottom: 14,
    backgroundColor: '#fbf7f4',
    borderBottomWidth: 1,
    borderBottomColor: '#eee6df',
  },
  iconButton: { width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(11,36,56,0.04)' },
  logo: { width: 142, height: 42 },
  avatar: {
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: '#0b3558',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: '#e7dfd8',
    overflow: 'hidden',
  },
  avatarActive: { borderColor: '#9cd69a', backgroundColor: '#082f58' },
  avatarImage: { width: '100%', height: '100%' },
  avatarText: { color: '#fff', fontWeight: '800', fontSize: 17 },
  profileMenuLayer: { ...StyleSheet.absoluteFillObject, zIndex: 50, elevation: 50 },
  profileMenu: {
    position: 'absolute',
    right: 14,
    width: 306,
    maxWidth: '86%',
    backgroundColor: '#fff',
    borderRadius: 18,
    borderWidth: 1,
    borderColor: '#e8edf0',
    overflow: 'hidden',
    shadowColor: '#001a33',
    shadowOpacity: 0.18,
    shadowRadius: 18,
    shadowOffset: { width: 0, height: 8 },
    elevation: 16,
  },
  profileHeader: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 18, paddingVertical: 18, backgroundColor: '#fbfdff' },
  profileAvatarLarge: { width: 48, height: 48, borderRadius: 24, backgroundColor: '#0b3558', alignItems: 'center', justifyContent: 'center', overflow: 'hidden' },
  profileAvatarImage: { width: '100%', height: '100%' },
  profileAvatarText: { color: '#fff', fontWeight: '900', fontSize: 19 },
  profileHeaderCopy: { flex: 1, minWidth: 0 },
  profileName: { color: '#102d43', fontSize: 17, lineHeight: 22, fontWeight: '900', textTransform: 'capitalize' },
  profileEmailRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 5 },
  profileEmail: { flex: 1, color: '#6a7885', fontSize: 13, lineHeight: 17 },
  profileDivider: { height: 1, backgroundColor: '#edf1f3' },
  profileMenuItem: { flexDirection: 'row', alignItems: 'center', gap: 13, paddingHorizontal: 18, paddingVertical: 15, backgroundColor: '#fff' },
  profileMenuItemText: { color: '#20394d', fontSize: 16, fontWeight: '700' },
  profileMenuItemTextDestructive: { color: '#c2413b' },
  scroll: { flex: 1 },
  content: { paddingHorizontal: 18, paddingTop: 22 },
  dateRow: { flexDirection: 'row', alignItems: 'center', gap: 5, marginBottom: 14 },
  dateText: { color: '#0f2334', fontSize: 16, fontWeight: '700' },
  heroTitle: { color: '#082941', fontSize: 31, lineHeight: 37, fontWeight: '900', letterSpacing: -1.0, marginBottom: 8 },
  heroSubtitle: { color: '#425466', fontSize: 16, lineHeight: 23, marginBottom: 24 },
  quickSectionTitle: { color: '#082941', fontSize: 22, fontWeight: '900', letterSpacing: -0.4, marginBottom: 12 },
  quickList: { gap: 12, marginBottom: 30 },
  quickAction: {
    width: '100%',
    minHeight: 76,
    backgroundColor: '#fff',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#ece6e2',
    paddingHorizontal: 14,
    paddingVertical: 12,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 13,
    shadowColor: '#13293d',
    shadowOpacity: 0.08,
    shadowRadius: 9,
    shadowOffset: { width: 0, height: 3 },
    elevation: 2,
  },
  quickIconWrap: { width: 48, height: 48, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  quickCopy: { flex: 1, minWidth: 0 },
  quickTitle: { color: '#102d43', fontSize: 18, lineHeight: 23, fontWeight: '900', letterSpacing: -0.2 },
  moneyCard: {
    backgroundColor: '#fff',
    borderRadius: 22,
    borderWidth: 1.4,
    borderColor: '#c6eec2',
    paddingHorizontal: 16,
    paddingVertical: 18,
    marginBottom: 28,
    shadowColor: '#7bc878',
    shadowOpacity: 0.08,
    shadowRadius: 11,
    shadowOffset: { width: 0, height: 5 },
    elevation: 2,
  },
  moneyHeader: { marginBottom: 18 },
  moneyTitle: { color: '#082941', fontSize: 27, lineHeight: 32, fontWeight: '900', letterSpacing: -0.7, marginBottom: 12 },
  filterCluster: { alignSelf: 'flex-start', flexDirection: 'row', backgroundColor: '#f7fafc', borderRadius: 13, borderWidth: 1, borderColor: '#eef0f2', marginBottom: 12, padding: 3 },
  filterPill: { minHeight: 34, justifyContent: 'center', paddingHorizontal: 12, paddingVertical: 7, borderRadius: 10 },
  filterPillActive: { backgroundColor: '#2475cf' },
  filterPillText: { color: '#1f2933', fontWeight: '800', fontSize: 13 },
  filterPillActiveText: { color: '#fff', fontWeight: '900', fontSize: 13 },
  viewAllButton: { alignSelf: 'flex-start', flexDirection: 'row', alignItems: 'center', gap: 6, paddingVertical: 7 },
  viewAllText: { color: '#172533', fontSize: 15, fontWeight: '700' },
  metricList: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginBottom: 22 },
  metricItem: {
    width: '48.4%',
    minHeight: 86,
    borderRadius: 16,
    backgroundColor: '#fbfdff',
    borderWidth: 1,
    borderColor: '#edf2f5',
    paddingHorizontal: 12,
    paddingVertical: 13,
    justifyContent: 'center',
    gap: 5,
  },
  metricValue: { fontSize: 23, lineHeight: 29, fontWeight: '900', letterSpacing: -0.7 },
  metricLabel: { color: '#51606c', fontSize: 11, lineHeight: 15, fontWeight: '900', textTransform: 'uppercase', letterSpacing: 0.5 },
  progressHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 9 },
  progressLabel: { color: '#101820', fontSize: 16, fontWeight: '600' },
  progressPercent: { color: '#2475cf', fontSize: 16, fontWeight: '800' },
  progressTrack: { height: 8, borderRadius: 8, backgroundColor: '#e9f2f9', overflow: 'hidden', marginBottom: 22 },
  progressFill: { height: '100%', borderRadius: 8, backgroundColor: '#2475cf' },
  netRow: { flexDirection: 'row', alignItems: 'center', borderTopWidth: 1, borderTopColor: '#eef2ef', paddingTop: 22, gap: 8 },
  netLabel: { color: '#101820', fontSize: 16 },
  netValue: { fontSize: 20, fontWeight: '900' },
  notificationsCard: {
    backgroundColor: '#fff',
    borderRadius: 22,
    borderWidth: 1.4,
    borderColor: '#d5f0d1',
    padding: 18,
    marginBottom: 20,
  },
  sectionHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 },
  sectionTitle: { color: '#082941', fontSize: 22, fontWeight: '900', letterSpacing: -0.3 },
  sectionLink: { color: '#2475cf', fontWeight: '800' },
  emptyState: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingVertical: 6 },
  emptyText: { color: '#51606c', fontSize: 15 },
  notificationRow: { flexDirection: 'row', alignItems: 'flex-start', paddingVertical: 12, borderTopWidth: 1, borderTopColor: '#eef2ef' },
  notificationDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: '#2475cf', marginTop: 7, marginRight: 12 },
  notificationCopy: { flex: 1 },
  notificationTitle: { fontWeight: '800', color: '#0f2334', marginBottom: 4 },
  notificationMessage: { color: '#51606c', lineHeight: 20 },
});
