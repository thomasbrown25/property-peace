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
import PropertyAPI, { Property } from '../../api/propertyAPI';
import MaintenanceAPI, { MaintenanceRequest } from '../../api/maintenanceAPI';
import NotificationAPI, { AppNotification } from '../../api/notificationAPI';
import { addExpenseDashboardAction, navigateToAddExpense } from '../../features/expenses/dashboardExpenseAction';

const logo = require('../../../assets/property-peace-navbar-logo.png');

const firstString = (...values: any[]) => {
  for (const value of values) {
    if (typeof value === 'string' && value.trim()) return value.trim();
  }
  return '';
};

const getGreeting = () => {
  const hour = new Date().getHours();
  if (hour < 12) return 'Good morning';
  if (hour < 17) return 'Good afternoon';
  return 'Good evening';
};

const getUnits = (property: Property) => property.units || property.Units || [];
const isOpenMaintenance = (request: MaintenanceRequest) => {
  const status = firstString(request.status, request.Status).toLowerCase();
  return !['completed', 'cancelled', 'closed', 'resolved'].includes(status);
};

export default function DashboardScreen() {
  const navigation = useNavigation<any>();
  const dispatch = useAppDispatch();
  const insets = useSafeAreaInsets();
  const { currentUser } = useAppSelector((state) => state.user);
  const [properties, setProperties] = useState<Property[]>([]);
  const [maintenance, setMaintenance] = useState<MaintenanceRequest[]>([]);
  const [notifications, setNotifications] = useState<AppNotification[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [loadError, setLoadError] = useState(false);
  const [profileMenuOpen, setProfileMenuOpen] = useState(false);

  const loadDashboard = useCallback(async () => {
    const results = await Promise.allSettled([
      PropertyAPI.getProperties(),
      MaintenanceAPI.getCurrent(),
      NotificationAPI.getNotifications(),
    ]);

    if (results[0].status === 'fulfilled') setProperties(results[0].value || []);
    if (results[1].status === 'fulfilled') setMaintenance(results[1].value || []);
    if (results[2].status === 'fulfilled') setNotifications((results[2].value || []).slice(0, 3));
    setLoadError(results.some((result) => result.status === 'rejected'));
    setLoading(false);
    setRefreshing(false);
  }, []);

  useEffect(() => { loadDashboard(); }, [loadDashboard]);

  const firstName = firstString(
    currentUser?.FirstName,
    currentUser?.firstName,
    currentUser?.Name,
    currentUser?.name,
    currentUser?.Email,
    currentUser?.email,
  ).split(/[\s@]/)[0] || 'there';
  const displayName = firstString(
    `${currentUser?.FirstName || currentUser?.firstName || ''} ${currentUser?.LastName || currentUser?.lastName || ''}`,
    currentUser?.Name,
    currentUser?.name,
    firstName,
  );
  const email = firstString(currentUser?.Email, currentUser?.email, 'No email');
  const profileImageUrl = firstString(currentUser?.ProfileImageUrl, currentUser?.profileImageUrl);
  const avatarLabel = firstName.slice(0, 1).toUpperCase();

  const portfolio = useMemo(() => {
    const units = properties.reduce((count, property) => count + getUnits(property).length, 0);
    const occupied = properties.reduce((count, property) => count + getUnits(property).filter((unit: any) => {
      const status = firstString(unit.status, unit.Status).toLowerCase();
      return status === 'occupied' || status === 'overdue';
    }).length, 0);
    return {
      properties: properties.length,
      units,
      occupied,
      openMaintenance: maintenance.filter(isOpenMaintenance).length,
      unread: notifications.filter((item: any) => item.isRead === false || item.IsRead === false).length,
    };
  }, [maintenance, notifications, properties]);

  const attentionCount = portfolio.openMaintenance + portfolio.unread;

  if (loading) {
    return <View style={styles.centerContainer}><ActivityIndicator size="large" color="#2475cf" /></View>;
  }

  return (
    <View style={styles.container}>
      <View style={[styles.topBar, { paddingTop: Math.max(insets.top + 10, 18) }]}>
        <Image source={logo} style={styles.logo} resizeMode="contain" />
        <View style={styles.topActions}>
          <TouchableOpacity style={styles.headerButton} onPress={() => navigation.navigate('Notifications')} accessibilityLabel="Open notifications">
            <Ionicons name="notifications-outline" size={23} color="#0b3558" />
            {portfolio.unread > 0 && <View style={styles.unreadDot} />}
          </TouchableOpacity>
          <TouchableOpacity style={[styles.avatar, profileMenuOpen && styles.avatarActive]} onPress={() => setProfileMenuOpen((open) => !open)}>
            {profileImageUrl ? <Image source={{ uri: profileImageUrl }} style={styles.avatarImage} /> : <Text style={styles.avatarText}>{avatarLabel}</Text>}
          </TouchableOpacity>
        </View>
      </View>

      {profileMenuOpen && (
        <View style={styles.profileMenuLayer} pointerEvents="box-none">
          <Pressable style={StyleSheet.absoluteFill} onPress={() => setProfileMenuOpen(false)} />
          <View style={[styles.profileMenu, { top: Math.max(insets.top + 68, 78) }]}>
            <View style={styles.profileIdentity}>
              <Text style={styles.profileName}>{displayName}</Text>
              <Text style={styles.profileEmail} numberOfLines={1}>{email}</Text>
            </View>
            <ProfileAction icon="people-outline" label="Tenants" onPress={() => { setProfileMenuOpen(false); navigation.navigate('Tenants'); }} />
            <ProfileAction icon="document-text-outline" label="Leases" onPress={() => { setProfileMenuOpen(false); navigation.navigate('Leases'); }} />
            <ProfileAction icon="settings-outline" label="Settings" onPress={() => { setProfileMenuOpen(false); navigation.navigate('Settings'); }} />
            <ProfileAction icon="log-out-outline" label="Sign out" destructive onPress={async () => { setProfileMenuOpen(false); await dispatch(logout()); }} />
          </View>
        </View>
      )}

      <ScrollView
        contentContainerStyle={[styles.content, { paddingBottom: Math.max(insets.bottom, 16) + 94 }]}
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); loadDashboard(); }} tintColor="#2475cf" />}
      >
        <Text style={styles.heroTitle}>{getGreeting()}, {firstName}.</Text>
        <Text style={styles.heroSubtitle}>
          {attentionCount > 0 ? `${attentionCount} ${attentionCount === 1 ? 'item needs' : 'items need'} your attention.` : 'Your portfolio is caught up for now.'}
        </Text>

        {loadError && (
          <TouchableOpacity style={styles.warningCard} onPress={loadDashboard} activeOpacity={0.82}>
            <Ionicons name="cloud-offline-outline" size={22} color="#a45f12" />
            <View style={styles.warningCopy}>
              <Text style={styles.warningTitle}>Some information is unavailable</Text>
              <Text style={styles.warningText}>Tap to try loading it again.</Text>
            </View>
          </TouchableOpacity>
        )}

        <View style={styles.portfolioCard}>
          <View style={styles.portfolioHeader}>
            <Text style={styles.portfolioTitle}>{portfolio.properties} {portfolio.properties === 1 ? 'property' : 'properties'}</Text>
          </View>
          <View style={styles.statRow}>
            <PortfolioStat label="Units" value={String(portfolio.units)} />
            <View style={styles.statDivider} />
            <PortfolioStat label="Occupied" value={String(portfolio.occupied)} />
            <View style={styles.statDivider} />
            <PortfolioStat label="Open repairs" value={String(portfolio.openMaintenance)} alert={portfolio.openMaintenance > 0} />
          </View>
        </View>

        <Text style={styles.sectionTitle}>Do it from your phone</Text>
        <View style={styles.quickList}>
          <QuickAction icon="add-circle-outline" title="Add a property" subtitle="Grow your portfolio" color="#2475cf" background="#eaf3ff" onPress={() => navigation.navigate('Properties', { screen: 'AddProperty' })} />
          <QuickAction icon="construct-outline" title="Maintenance workflow" subtitle="Assign and track open repairs" color="#d94d63" background="#fff0f3" onPress={() => navigation.navigate('Maintenance', { screen: 'MaintenanceList' })} />
          <QuickAction icon="clipboard-outline" title="Property checklists" subtitle="Move-in and move-out inspections" color="#2f8f46" background="#edf9ef" onPress={() => navigation.navigate('Checklists', { screen: 'ChecklistPropertySearch' })} />
          <QuickAction {...addExpenseDashboardAction} onPress={() => navigateToAddExpense((route) => navigation.navigate(route))} />
        </View>

        <View style={styles.activityCard}>
          <View style={styles.sectionHeader}>
            <View>
              <Text style={styles.cardEyebrow}>RECENT</Text>
              <Text style={styles.activityTitle}>Activity</Text>
            </View>
            <TouchableOpacity onPress={() => navigation.navigate('Notifications')} style={styles.textButton}>
              <Text style={styles.textButtonLabel}>View all</Text>
            </TouchableOpacity>
          </View>
          {notifications.length === 0 ? (
            <View style={styles.emptyState}>
              <View style={styles.emptyIcon}><Ionicons name="checkmark" size={18} color="#2f8f46" /></View>
              <Text style={styles.emptyText}>No recent notifications.</Text>
            </View>
          ) : notifications.map((notification: any) => (
            <View key={String(notification.id || notification.Id)} style={styles.notificationRow}>
              <View style={styles.notificationDot} />
              <View style={styles.notificationCopy}>
                <Text style={styles.notificationTitle}>{notification.title || notification.Title || 'Notification'}</Text>
                {!!(notification.message || notification.Message) && <Text style={styles.notificationMessage} numberOfLines={2}>{notification.message || notification.Message}</Text>}
              </View>
            </View>
          ))}
        </View>
      </ScrollView>
    </View>
  );
}

function ProfileAction({ icon, label, onPress, destructive }: { icon: keyof typeof Ionicons.glyphMap; label: string; onPress: () => void | Promise<void>; destructive?: boolean }) {
  return (
    <TouchableOpacity style={styles.profileAction} onPress={onPress}>
      <Ionicons name={icon} size={20} color={destructive ? '#c2413b' : '#20394d'} />
      <Text style={[styles.profileActionText, destructive && styles.destructiveText]}>{label}</Text>
    </TouchableOpacity>
  );
}

function PortfolioStat({ label, value, alert }: { label: string; value: string; alert?: boolean }) {
  return (
    <View style={styles.statItem}>
      <Text style={[styles.statValue, alert && styles.statValueAlert]}>{value}</Text>
      <Text style={styles.statLabel}>{label}</Text>
    </View>
  );
}

function QuickAction({ icon, title, subtitle, color, background, onPress }: { icon: keyof typeof Ionicons.glyphMap; title: string; subtitle: string; color: string; background: string; onPress: () => void }) {
  return (
    <TouchableOpacity style={styles.quickAction} onPress={onPress} activeOpacity={0.82}>
      <View style={[styles.quickIcon, { backgroundColor: background }]}><Ionicons name={icon} size={25} color={color} /></View>
      <View style={styles.quickCopy}>
        <Text style={styles.quickTitle}>{title}</Text>
        <Text style={styles.quickSubtitle}>{subtitle}</Text>
      </View>
      <Ionicons name="chevron-forward" size={20} color="#8c9aa6" />
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#fbf7f4' },
  centerContainer: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#fbf7f4' },
  topBar: { minHeight: 72, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 18, paddingBottom: 12, borderBottomWidth: 1, borderBottomColor: '#eee6df' },
  logo: { width: 148, height: 42 },
  topActions: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  headerButton: { width: 44, height: 44, borderRadius: 15, alignItems: 'center', justifyContent: 'center', backgroundColor: '#ffffff', borderWidth: 1, borderColor: '#e7e1dc' },
  unreadDot: { position: 'absolute', top: 10, right: 10, width: 8, height: 8, borderRadius: 4, backgroundColor: '#d94d63', borderWidth: 1.5, borderColor: '#fff' },
  avatar: { width: 44, height: 44, borderRadius: 15, backgroundColor: '#0b3558', alignItems: 'center', justifyContent: 'center', overflow: 'hidden', borderWidth: 2, borderColor: '#ffffff' },
  avatarActive: { borderColor: '#74c86b' },
  avatarImage: { width: '100%', height: '100%' },
  avatarText: { color: '#fff', fontSize: 17, fontWeight: '900' },
  profileMenuLayer: { ...StyleSheet.absoluteFillObject, zIndex: 50, elevation: 50 },
  profileMenu: { position: 'absolute', right: 14, width: 280, maxWidth: '88%', backgroundColor: '#fff', borderRadius: 18, borderWidth: 1, borderColor: '#e3e9ed', overflow: 'hidden', shadowColor: '#001a33', shadowOpacity: 0.18, shadowRadius: 18, shadowOffset: { width: 0, height: 8 }, elevation: 16 },
  profileIdentity: { padding: 18, backgroundColor: '#f8fbfd', borderBottomWidth: 1, borderBottomColor: '#edf1f3' },
  profileName: { color: '#102d43', fontSize: 17, fontWeight: '900' },
  profileEmail: { color: '#6a7885', fontSize: 13, marginTop: 4 },
  profileAction: { minHeight: 50, flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 18, borderBottomWidth: 1, borderBottomColor: '#f0f2f4' },
  profileActionText: { color: '#20394d', fontSize: 15, fontWeight: '800' },
  destructiveText: { color: '#c2413b' },
  content: { paddingHorizontal: 18, paddingTop: 25 },
  heroTitle: { color: '#082941', fontSize: 31, lineHeight: 37, fontWeight: '900', letterSpacing: -1, marginBottom: 7 },
  heroSubtitle: { color: '#536575', fontSize: 16, lineHeight: 23, marginBottom: 22 },
  warningCard: { flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: '#fff8e8', borderWidth: 1, borderColor: '#f1d8a7', borderRadius: 16, padding: 14, marginBottom: 18 },
  warningCopy: { flex: 1 },
  warningTitle: { color: '#7a480f', fontWeight: '900', fontSize: 14 },
  warningText: { color: '#8f6b3b', marginTop: 2, fontSize: 13 },
  portfolioCard: { backgroundColor: '#0b3558', borderRadius: 22, padding: 18, marginBottom: 28, shadowColor: '#062945', shadowOpacity: 0.2, shadowRadius: 16, shadowOffset: { width: 0, height: 8 }, elevation: 5 },
  portfolioHeader: { marginBottom: 21 },
  cardEyebrow: { color: '#2f8f46', fontSize: 10, lineHeight: 14, fontWeight: '900', letterSpacing: 1.1 },
  portfolioTitle: { color: '#ffffff', fontSize: 25, lineHeight: 31, fontWeight: '900', marginTop: 2 },
  statRow: { flexDirection: 'row', alignItems: 'stretch', backgroundColor: 'rgba(255,255,255,0.08)', borderRadius: 16, paddingVertical: 13 },
  statItem: { flex: 1, alignItems: 'center', justifyContent: 'center', minWidth: 0 },
  statDivider: { width: 1, backgroundColor: 'rgba(255,255,255,0.14)' },
  statValue: { color: '#ffffff', fontSize: 22, fontWeight: '900' },
  statValueAlert: { color: '#ffb8c2' },
  statLabel: { color: 'rgba(255,255,255,0.7)', fontSize: 11, lineHeight: 15, textAlign: 'center', marginTop: 3 },
  sectionTitle: { color: '#082941', fontSize: 22, fontWeight: '900', letterSpacing: -0.4, marginBottom: 12 },
  quickList: { gap: 10, marginBottom: 28 },
  quickAction: { minHeight: 74, flexDirection: 'row', alignItems: 'center', gap: 13, padding: 12, backgroundColor: '#fff', borderRadius: 18, borderWidth: 1, borderColor: '#e8e4e0', shadowColor: '#13293d', shadowOpacity: 0.06, shadowRadius: 10, shadowOffset: { width: 0, height: 4 }, elevation: 2 },
  quickIcon: { width: 48, height: 48, borderRadius: 15, alignItems: 'center', justifyContent: 'center' },
  quickCopy: { flex: 1, minWidth: 0 },
  quickTitle: { color: '#102d43', fontSize: 16, lineHeight: 21, fontWeight: '900' },
  quickSubtitle: { color: '#6a7885', fontSize: 13, lineHeight: 18, marginTop: 2 },
  activityCard: { backgroundColor: '#fff', borderRadius: 22, borderWidth: 1, borderColor: '#e8e4e0', padding: 18 },
  sectionHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 },
  activityTitle: { color: '#082941', fontSize: 22, fontWeight: '900', marginTop: 2 },
  textButton: { minHeight: 44, justifyContent: 'center', paddingHorizontal: 4 },
  textButtonLabel: { color: '#2475cf', fontWeight: '900' },
  emptyState: { flexDirection: 'row', alignItems: 'center', gap: 9, paddingVertical: 8 },
  emptyIcon: { width: 32, height: 32, borderRadius: 11, backgroundColor: '#edf9ef', alignItems: 'center', justifyContent: 'center' },
  emptyText: { color: '#607080', fontSize: 14 },
  notificationRow: { flexDirection: 'row', alignItems: 'flex-start', paddingVertical: 12, borderTopWidth: 1, borderTopColor: '#edf1f3' },
  notificationDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: '#2475cf', marginTop: 7, marginRight: 11 },
  notificationCopy: { flex: 1 },
  notificationTitle: { color: '#102d43', fontSize: 14, fontWeight: '900', marginBottom: 3 },
  notificationMessage: { color: '#697887', fontSize: 13, lineHeight: 18 },
});
