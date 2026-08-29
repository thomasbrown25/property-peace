import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
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
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAppDispatch, useAppSelector } from '../../store/hooks';
import { logout } from '../../store/user/user.slice';
import PropertyAPI, { Property } from '../../api/propertyAPI';
import MaintenanceAPI, { MaintenanceRequest } from '../../api/maintenanceAPI';
import NotificationAPI, { AppNotification } from '../../api/notificationAPI';
import RentCollectionAPI from '../../api/rentCollectionAPI';
import { displayStatus } from '../../features/maintenance/maintenanceModel';
import { addExpenseDashboardAction, navigateToAddExpense } from '../../features/expenses/dashboardExpenseAction';

const logo = require('../../../assets/property-peace-navbar-logo.png');

type LoadStatus = 'loading' | 'success' | 'error';
type RentMetrics = {
  expected: number;
  collected: number;
  remaining: number;
  outstanding: number;
};

const firstString = (...values: any[]) => {
  for (const value of values) {
    if (typeof value === 'string' && value.trim()) return value.trim();
  }
  return '';
};

const firstNumber = (...values: any[]) => {
  for (const value of values) {
    const number = Number(value);
    if (Number.isFinite(number)) return number;
  }
  return 0;
};

const read = (item: any, camel: string, pascal: string) => item?.[camel] ?? item?.[pascal];
const getUnits = (property: Property) => property.units || property.Units || [];
const getUnitStatus = (unit: any) => firstString(unit.status, unit.Status).toLowerCase();
const getLease = (unit: any) => unit.lease || unit.Lease || unit.activeLease || unit.ActiveLease;
const getPropertyId = (property: Property) => String(property.id ?? property.Id ?? '');
const getRequestId = (request: MaintenanceRequest) => String(request.id ?? request.Id ?? '');

const getGreeting = () => {
  const hour = new Date().getHours();
  if (hour < 12) return 'Good morning';
  if (hour < 18) return 'Good afternoon';
  return 'Good evening';
};

const formatMoney = (value: number) => new Intl.NumberFormat('en-US', {
  style: 'currency',
  currency: 'USD',
  maximumFractionDigits: 0,
}).format(value || 0);

const isOpenMaintenance = (request: MaintenanceRequest) => {
  const status = firstString(request.status, request.Status).toLowerCase().replace(/[-_\s]/g, '');
  return !['completed', 'cancelled', 'closed', 'resolved'].includes(status);
};

const requestTime = (request: MaintenanceRequest) => {
  const raw = read(request, 'createdAt', 'CreatedAt') || read(request, 'createdAtUtc', 'CreatedAtUtc');
  const time = raw ? new Date(raw).getTime() : 0;
  return Number.isNaN(time) ? 0 : time;
};

const notificationTime = (notification: AppNotification) => {
  const raw = read(notification, 'createdAt', 'CreatedAt');
  const time = raw ? new Date(raw).getTime() : 0;
  return Number.isNaN(time) ? 0 : time;
};

const normalizeRentMetrics = (payload: any): RentMetrics => {
  const source = payload?.summary || payload?.Summary || payload || {};
  const expected = firstNumber(source.expectedThisMonth, source.ExpectedThisMonth, source.totalMonthlyRent, source.TotalMonthlyRent);
  const collected = firstNumber(source.collectedThisMonth, source.CollectedThisMonth);
  const remaining = Math.max(expected - Math.min(expected, collected), 0);
  const outstanding = firstNumber(source.outstanding, source.Outstanding);
  return {
    expected: Math.max(expected, 0),
    collected: Math.max(collected, 0),
    remaining: Math.max(remaining, 0),
    outstanding: Math.max(outstanding, 0),
  };
};

export default function DashboardScreen() {
  const navigation = useNavigation<any>();
  const dispatch = useAppDispatch();
  const insets = useSafeAreaInsets();
  const { currentUser } = useAppSelector((state) => state.user);
  const [properties, setProperties] = useState<Property[]>([]);
  const [maintenance, setMaintenance] = useState<MaintenanceRequest[]>([]);
  const [notifications, setNotifications] = useState<AppNotification[]>([]);
  const [rentMetrics, setRentMetrics] = useState<RentMetrics>({ expected: 0, collected: 0, remaining: 0, outstanding: 0 });
  const [refreshing, setRefreshing] = useState(false);
  const [propertiesStatus, setPropertiesStatus] = useState<LoadStatus>('loading');
  const [maintenanceStatus, setMaintenanceStatus] = useState<LoadStatus>('loading');
  const [notificationsStatus, setNotificationsStatus] = useState<LoadStatus>('loading');
  const [rentStatus, setRentStatus] = useState<LoadStatus>('loading');
  const [profileMenuOpen, setProfileMenuOpen] = useState(false);
  const [quickActionsOpen, setQuickActionsOpen] = useState(false);
  const loadGeneration = useRef(0);
  const organizationId = String(currentUser?.currentOrganizationId ?? currentUser?.CurrentOrganizationId ?? '');
  const currentOrganizationId = useRef(organizationId);
  const [loadedOrganizationId, setLoadedOrganizationId] = useState<string | null>(null);
  currentOrganizationId.current = organizationId;

  const clearDashboard = useCallback(() => {
    setProperties([]);
    setMaintenance([]);
    setNotifications([]);
    setRentMetrics({ expected: 0, collected: 0, remaining: 0, outstanding: 0 });
    setPropertiesStatus('loading');
    setMaintenanceStatus('loading');
    setNotificationsStatus('loading');
    setRentStatus('loading');
    setRefreshing(false);
    setLoadedOrganizationId(null);
  }, []);

  const loadDashboard = useCallback(async () => {
    const capturedOrganizationId = organizationId;
    if (!capturedOrganizationId) {
      clearDashboard();
      return;
    }
    const generation = ++loadGeneration.current;
    const results = await Promise.allSettled([
      PropertyAPI.getProperties(),
      MaintenanceAPI.getCurrent(),
      NotificationAPI.getNotifications(),
      RentCollectionAPI.getRentCollection(),
    ]);

    if (generation !== loadGeneration.current || capturedOrganizationId !== currentOrganizationId.current) return;

    if (results[0].status === 'fulfilled') {
      setProperties(results[0].value || []);
      setPropertiesStatus('success');
    } else {
      setPropertiesStatus('error');
    }
    if (results[1].status === 'fulfilled') {
      setMaintenance(results[1].value || []);
      setMaintenanceStatus('success');
    } else {
      setMaintenanceStatus('error');
    }
    if (results[2].status === 'fulfilled') {
      setNotifications(results[2].value || []);
      setNotificationsStatus('success');
    } else {
      setNotificationsStatus('error');
    }
    if (results[3].status === 'fulfilled') {
      setRentMetrics(normalizeRentMetrics(results[3].value));
      setRentStatus('success');
    } else {
      setRentStatus('error');
    }
    setLoadedOrganizationId(capturedOrganizationId);
    setRefreshing(false);
  }, [clearDashboard, organizationId]);

  useEffect(() => {
    ++loadGeneration.current;
    clearDashboard();
  }, [clearDashboard, organizationId]);

  useFocusEffect(useCallback(() => {
    void loadDashboard();
    return () => {
      ++loadGeneration.current;
    };
  }, [loadDashboard]));

  const dashboardScopeIsCurrent = loadedOrganizationId === organizationId;
  const scopedProperties = dashboardScopeIsCurrent ? properties : [];
  const scopedMaintenance = dashboardScopeIsCurrent ? maintenance : [];
  const scopedNotifications = dashboardScopeIsCurrent ? notifications : [];
  const scopedRentMetrics = dashboardScopeIsCurrent
    ? rentMetrics
    : { expected: 0, collected: 0, remaining: 0, outstanding: 0 };
  const scopedPropertiesStatus: LoadStatus = dashboardScopeIsCurrent ? propertiesStatus : 'loading';
  const scopedMaintenanceStatus: LoadStatus = dashboardScopeIsCurrent ? maintenanceStatus : 'loading';
  const scopedNotificationsStatus: LoadStatus = dashboardScopeIsCurrent ? notificationsStatus : 'loading';
  const scopedRentStatus: LoadStatus = dashboardScopeIsCurrent ? rentStatus : 'loading';

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
    const activeProperties = scopedProperties.filter((property: any) => property.isActive !== false && property.IsActive !== false);
    const units = activeProperties.flatMap(getUnits);
    const occupied = units.filter((unit: any) => ['occupied', 'overdue'].includes(getUnitStatus(unit))).length;
    const vacant = Math.max(units.length - occupied, 0);
    const monthlyRent = units.reduce((total: number, unit: any) => {
      const lease = getLease(unit);
      return total + firstNumber(lease?.rentAmount, lease?.RentAmount, unit.rentAmount, unit.RentAmount);
    }, 0);
    const attentionPropertyIds = new Set<string>();
    activeProperties.forEach((property: any) => {
      if (getUnits(property).some((unit: any) => getUnitStatus(unit) === 'overdue')) attentionPropertyIds.add(getPropertyId(property));
    });
    scopedMaintenance.filter(isOpenMaintenance).forEach((request) => {
      const propertyId = String(read(request, 'propertyId', 'PropertyId') ?? '');
      if (propertyId) attentionPropertyIds.add(propertyId);
    });
    return {
      properties: activeProperties.length,
      units: units.length,
      occupied,
      vacant,
      occupancy: units.length ? Math.round((occupied / units.length) * 100) : 0,
      monthlyRent,
      needsAttention: attentionPropertyIds.size,
      openMaintenance: scopedMaintenance.filter(isOpenMaintenance).length,
      unread: scopedNotifications.filter((item: any) => item.isRead === false || item.IsRead === false).length,
    };
  }, [scopedMaintenance, scopedNotifications, scopedProperties]);

  const collectionPct = scopedRentMetrics.expected > 0
    ? Math.min(Math.max((scopedRentMetrics.collected / scopedRentMetrics.expected) * 100, 0), 100)
    : 0;
  const attentionCount = portfolio.openMaintenance + portfolio.unread;
  const attentionDataLoading = scopedMaintenanceStatus === 'loading' || scopedNotificationsStatus === 'loading';
  const attentionDataAvailable = scopedMaintenanceStatus === 'success' && scopedNotificationsStatus === 'success';
  const hasUnavailableData = [scopedPropertiesStatus, scopedMaintenanceStatus, scopedNotificationsStatus, scopedRentStatus].includes('error');
  const currentDate = new Date();
  const latestMaintenance = useMemo(
    () => [...scopedMaintenance].filter(isOpenMaintenance).sort((a, b) => requestTime(b) - requestTime(a)).slice(0, 3),
    [scopedMaintenance],
  );
  const latestNotifications = useMemo(
    () => [...scopedNotifications].sort((a, b) => notificationTime(b) - notificationTime(a)).slice(0, 3),
    [scopedNotifications],
  );

  const quickActions = [
    {
      icon: 'business-outline' as const,
      title: 'Add property',
      subtitle: 'Grow your portfolio',
      color: '#2475cf',
      background: '#eaf3ff',
      onPress: () => navigation.navigate('Properties', { screen: 'AddProperty' }),
    },
    {
      ...addExpenseDashboardAction,
      onPress: () => navigateToAddExpense((route) => navigation.navigate(route)),
    },
    {
      icon: 'construct-outline' as const,
      title: 'Maintenance',
      subtitle: 'Review open workflows',
      color: '#b76a11',
      background: '#fff7e8',
      onPress: () => navigation.navigate('Maintenance', { screen: 'MaintenanceList' }),
    },
    {
      icon: 'document-text-outline' as const,
      title: 'Leases',
      subtitle: 'Review rent and balances',
      color: '#287d43',
      background: '#edf8f0',
      onPress: () => navigation.navigate('Leases'),
    },
  ];

  return (
    <View style={styles.container}>
      <View style={[styles.topBar, { paddingTop: Math.max(insets.top + 10, 18) }]}>
        <Image source={logo} style={styles.logo} resizeMode="contain" />
        <View style={styles.topActions}>
          <TouchableOpacity style={styles.headerButton} onPress={() => navigation.navigate('Notifications')} accessibilityLabel="Open notifications">
            <Ionicons name="notifications-outline" size={23} color="#0b3558" />
            {scopedNotificationsStatus === 'success' && portfolio.unread > 0 && <View style={styles.unreadDot} />}
          </TouchableOpacity>
          <TouchableOpacity style={[styles.avatar, profileMenuOpen && styles.avatarActive]} onPress={() => setProfileMenuOpen((open) => !open)} accessibilityLabel="Open profile menu">
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
        <Text style={styles.heroTitle}>{getGreeting()}, {firstName}</Text>

        <View style={styles.todayCard}>
          <View style={styles.dateBlock}>
            <Text style={styles.dateMonth}>{currentDate.toLocaleDateString('en-US', { month: 'short' }).toUpperCase()}</Text>
            <Text style={styles.dateDay}>{currentDate.getDate()}</Text>
            <Text style={styles.dateWeekday}>{currentDate.toLocaleDateString('en-US', { weekday: 'short' }).toUpperCase()}</Text>
          </View>
          <View style={styles.todayCopy}>
            <View style={styles.todayTitleRow}>
              <View style={[styles.focusDot, attentionCount > 0 && styles.focusDotActive]} />
              <Text style={styles.todayTitle}>Today at a glance</Text>
            </View>
            <Text style={styles.todayText} numberOfLines={2}>
              {attentionDataLoading
                ? 'Loading portfolio updates…'
                : !attentionDataAvailable
                  ? 'Some portfolio attention data is unavailable.'
                  : attentionCount > 0
                  ? `${portfolio.openMaintenance} open ${portfolio.openMaintenance === 1 ? 'repair' : 'repairs'} · ${portfolio.unread} unread ${portfolio.unread === 1 ? 'update' : 'updates'}`
                  : 'Nothing urgent across your portfolio.'}
            </Text>
          </View>
          <TouchableOpacity style={styles.todayArrow} onPress={() => navigation.navigate('Notifications')} accessibilityLabel="View portfolio updates">
            <Ionicons name="arrow-forward" size={18} color="#0b3558" />
          </TouchableOpacity>
        </View>

        {hasUnavailableData && (
          <TouchableOpacity style={styles.warningCard} onPress={loadDashboard} activeOpacity={0.82} accessibilityLabel="Retry unavailable dashboard information">
            <Ionicons name="cloud-offline-outline" size={22} color="#a45f12" />
            <View style={styles.warningCopy}>
              <Text style={styles.warningTitle}>Some information is unavailable</Text>
              <Text style={styles.warningText}>Tap to retry the missing dashboard sections.</Text>
            </View>
          </TouchableOpacity>
        )}

        <View style={styles.quickSection}>
          <TouchableOpacity
            style={[styles.quickTrigger, quickActionsOpen && styles.quickTriggerOpen]}
            onPress={() => setQuickActionsOpen((open) => !open)}
            accessibilityRole="button"
            accessibilityState={{ expanded: quickActionsOpen }}
          >
            <View style={styles.quickTriggerIcon}><Ionicons name="flash-outline" size={20} color="#0b3558" /></View>
            <Text style={styles.quickTriggerText}>Quick actions</Text>
            <Ionicons name={quickActionsOpen ? 'chevron-up' : 'chevron-down'} size={20} color="#0b3558" />
          </TouchableOpacity>
          {quickActionsOpen && (
            <View style={styles.quickMenu}>
              {quickActions.map((action) => (
                <QuickAction
                  key={action.title}
                  {...action}
                  onPress={() => {
                    setQuickActionsOpen(false);
                    action.onPress();
                  }}
                />
              ))}
            </View>
          )}
        </View>

        <View style={styles.progressCard}>
          <View style={styles.progressHeader}>
            <View style={styles.progressTitleRow}>
              <Text style={styles.progressTitle}>Rent collection progress</Text>
              {scopedRentStatus === 'success' && <Text style={styles.progressPercent}>{Math.round(collectionPct)}%</Text>}
            </View>
            {scopedRentStatus === 'loading' ? <ActivityIndicator size="small" color="#2f8f46" /> : null}
          </View>
          {scopedRentStatus === 'error' ? (
            <SectionError text="Rent collection is unavailable." onRetry={loadDashboard} />
          ) : scopedRentStatus === 'success' ? (
            <>
              <Text style={styles.progressHelper}>
                {scopedRentMetrics.remaining > 0 ? `${formatMoney(scopedRentMetrics.remaining)} remaining this month` : 'Expected rent collected'}
              </Text>
              <View
                style={styles.progressTrack}
                accessibilityRole="progressbar"
                accessibilityLabel="Rent collection progress"
                accessibilityValue={{ min: 0, max: 100, now: Math.round(collectionPct) }}
              >
                <View style={[styles.progressFill, { width: `${collectionPct}%` }]} />
              </View>
            </>
          ) : (
            <View style={styles.loadingLine} />
          )}
        </View>

        <DashboardCard accent="#2f8f46">
          <View style={styles.cardHeader}>
            <View>
              <Text style={styles.cardEyebrow}>THIS MONTH</Text>
              <Text style={styles.cardTitle}>Money summary</Text>
            </View>
          </View>
          {scopedRentStatus === 'error' ? (
            <SectionError text="Money summary is unavailable." onRetry={loadDashboard} />
          ) : scopedRentStatus === 'loading' ? (
            <CardLoading />
          ) : (
            <View style={styles.metricList}>
              <MoneyMetric label="Expected rent" value={formatMoney(scopedRentMetrics.expected)} color="#0b3558" />
              <MoneyMetric label="Collected" value={formatMoney(scopedRentMetrics.collected)} color="#2f8f46" />
              <MoneyMetric label="Remaining" value={formatMoney(scopedRentMetrics.remaining)} color="#b76a11" />
              {scopedRentMetrics.outstanding > scopedRentMetrics.remaining && (
                <Text style={styles.outstandingNote}>{formatMoney(scopedRentMetrics.outstanding)} total outstanding including prior months</Text>
              )}
            </View>
          )}
        </DashboardCard>

        <DashboardCard accent="#2475cf">
          <View style={styles.cardHeader}>
            <Text style={styles.cardTitle}>Portfolio</Text>
            <TouchableOpacity style={styles.cardLink} onPress={() => navigation.navigate('Properties', { screen: 'PropertiesList' })}>
              <Text style={styles.cardLinkText}>View properties</Text>
              <Ionicons name="arrow-forward" size={14} color="#647585" />
            </TouchableOpacity>
          </View>
          {scopedPropertiesStatus === 'error' ? (
            <SectionError text="Portfolio details are unavailable." onRetry={loadDashboard} />
          ) : scopedPropertiesStatus === 'loading' ? (
            <CardLoading />
          ) : (
            <View style={styles.portfolioGrid}>
              <PortfolioMetric icon="home-outline" label="Portfolio occupancy" value={`${portfolio.occupancy}%`} helper={`${portfolio.occupied} of ${portfolio.units} units occupied`} color="#2f8f46" background="#edf8f0" />
              <PortfolioMetric icon="business-outline" label="Vacant units" value={String(portfolio.vacant)} helper={`Across ${portfolio.properties} active ${portfolio.properties === 1 ? 'property' : 'properties'}`} color="#b76a11" background="#fff7e8" />
              <PortfolioMetric icon="cash-outline" label="Monthly rent" value={formatMoney(portfolio.monthlyRent)} helper="Scheduled rent, not collections" color="#2475cf" background="#eaf3ff" />
              <PortfolioMetric
                icon="warning-outline"
                label="Needs attention"
                value={scopedMaintenanceStatus === 'success' ? String(portfolio.needsAttention) : '—'}
                helper={scopedMaintenanceStatus === 'success' ? 'Overdue rent or open repairs' : scopedMaintenanceStatus === 'loading' ? 'Loading attention data' : 'Maintenance data unavailable'}
                color="#c2413b"
                background="#fff0f1"
              />
            </View>
          )}
        </DashboardCard>

        <DashboardCard accent="#d39424">
          <View style={styles.cardHeader}>
            <View style={styles.cardTitleWithIcon}>
              <Ionicons name="construct-outline" size={20} color="#b76a11" />
              <Text style={styles.cardTitle}>Maintenance</Text>
            </View>
            <TouchableOpacity style={styles.cardLink} onPress={() => navigation.navigate('Maintenance', { screen: 'MaintenanceList' })}>
              <Text style={styles.cardLinkText}>View all</Text>
              <Ionicons name="arrow-forward" size={14} color="#647585" />
            </TouchableOpacity>
          </View>
          {scopedMaintenanceStatus === 'error' ? (
            <SectionError text="Maintenance requests are unavailable." onRetry={loadDashboard} />
          ) : scopedMaintenanceStatus === 'loading' ? (
            <CardLoading />
          ) : latestMaintenance.length === 0 ? (
            <EmptyState icon="checkmark-circle-outline" title="No current maintenance requests" text="New requests and their status will appear here." />
          ) : latestMaintenance.map((request, index) => (
            <MaintenanceRow
              key={getRequestId(request) || String(index)}
              request={request}
              isLast={index === latestMaintenance.length - 1}
              onPress={() => navigation.navigate('Maintenance', {
                screen: 'LandlordMaintenanceDetail',
                params: { requestId: getRequestId(request), listItem: request },
              })}
            />
          ))}
        </DashboardCard>

        <DashboardCard accent="#2475cf">
          <View style={styles.cardHeader}>
            <View>
              <Text style={styles.cardEyebrow}>RECENT</Text>
              <Text style={styles.cardTitle}>Activity</Text>
            </View>
            <TouchableOpacity style={styles.cardLink} onPress={() => navigation.navigate('Notifications')}>
              <Text style={styles.cardLinkText}>View all</Text>
              <Ionicons name="arrow-forward" size={14} color="#647585" />
            </TouchableOpacity>
          </View>
          {scopedNotificationsStatus === 'error' ? (
            <SectionError text="Recent activity is unavailable." onRetry={loadDashboard} />
          ) : scopedNotificationsStatus === 'loading' ? (
            <CardLoading />
          ) : latestNotifications.length === 0 ? (
            <EmptyState icon="checkmark-circle-outline" title="No recent notifications" text="Portfolio updates will appear here." />
          ) : latestNotifications.map((notification: any, index) => (
            <View key={String(notification.id || notification.Id || index)} style={[styles.notificationRow, index === latestNotifications.length - 1 && styles.lastRow]}>
              <View style={[styles.notificationDot, (notification.isRead === false || notification.IsRead === false) && styles.notificationDotUnread]} />
              <View style={styles.notificationCopy}>
                <Text style={styles.notificationTitle}>{notification.title || notification.Title || 'Notification'}</Text>
                {!!(notification.message || notification.Message) && <Text style={styles.notificationMessage} numberOfLines={2}>{notification.message || notification.Message}</Text>}
              </View>
            </View>
          ))}
        </DashboardCard>
      </ScrollView>
    </View>
  );
}

function DashboardCard({ accent, children }: { accent: string; children: React.ReactNode }) {
  return <View style={[styles.dashboardCard, { borderTopColor: accent }]}>{children}</View>;
}

function ProfileAction({ icon, label, onPress, destructive }: { icon: keyof typeof Ionicons.glyphMap; label: string; onPress: () => void | Promise<void>; destructive?: boolean }) {
  return (
    <TouchableOpacity style={styles.profileAction} onPress={onPress}>
      <Ionicons name={icon} size={20} color={destructive ? '#c2413b' : '#20394d'} />
      <Text style={[styles.profileActionText, destructive && styles.destructiveText]}>{label}</Text>
    </TouchableOpacity>
  );
}

function QuickAction({ icon, title, subtitle, color, background, onPress }: { icon: keyof typeof Ionicons.glyphMap; title: string; subtitle: string; color: string; background: string; onPress: () => void }) {
  return (
    <TouchableOpacity style={styles.quickAction} onPress={onPress} activeOpacity={0.82}>
      <View style={[styles.quickIcon, { backgroundColor: background }]}><Ionicons name={icon} size={22} color={color} /></View>
      <View style={styles.quickCopy}>
        <Text style={styles.quickTitle}>{title}</Text>
        <Text style={styles.quickSubtitle}>{subtitle}</Text>
      </View>
      <Ionicons name="chevron-forward" size={18} color="#8c9aa6" />
    </TouchableOpacity>
  );
}

function MoneyMetric({ label, value, color }: { label: string; value: string; color: string }) {
  return (
    <View style={styles.moneyMetric}>
      <Text style={styles.moneyLabel}>{label}</Text>
      <Text style={[styles.moneyValue, { color }]}>{value}</Text>
    </View>
  );
}

function PortfolioMetric({ icon, label, value, helper, color, background }: { icon: keyof typeof Ionicons.glyphMap; label: string; value: string; helper: string; color: string; background: string }) {
  return (
    <View style={[styles.portfolioMetric, { borderColor: `${color}33`, backgroundColor: `${background}` }]}>
      <View style={styles.portfolioMetricTop}>
        <Text style={styles.portfolioLabel}>{label}</Text>
        <View style={[styles.portfolioIcon, { backgroundColor: `${color}18` }]}><Ionicons name={icon} size={18} color={color} /></View>
      </View>
      <Text style={styles.portfolioValue}>{value}</Text>
      <Text style={styles.portfolioHelper}>{helper}</Text>
    </View>
  );
}

function MaintenanceRow({ request, isLast, onPress }: { request: MaintenanceRequest; isLast: boolean; onPress: () => void }) {
  const title = firstString(request.title, request.Title, 'Maintenance request');
  const property = firstString(request.propertyName, request.PropertyName, request.location, request.Location, 'Portfolio request');
  const status = displayStatus(request.status ?? request.Status);
  return (
    <TouchableOpacity style={[styles.maintenanceRow, isLast && styles.lastRow]} onPress={onPress} accessibilityLabel={`Open maintenance request ${title}`}>
      <View style={styles.maintenanceCopy}>
        <Text style={styles.maintenanceTitle} numberOfLines={1}>{title}</Text>
        <Text style={styles.maintenanceLocation} numberOfLines={1}>{property}</Text>
      </View>
      <View style={styles.statusChip}><Text style={styles.statusChipText}>{status}</Text></View>
    </TouchableOpacity>
  );
}

function EmptyState({ icon, title, text }: { icon: keyof typeof Ionicons.glyphMap; title: string; text: string }) {
  return (
    <View style={styles.emptyState}>
      <View style={styles.emptyIcon}><Ionicons name={icon} size={22} color="#2f8f46" /></View>
      <Text style={styles.emptyTitle}>{title}</Text>
      <Text style={styles.emptyText}>{text}</Text>
    </View>
  );
}

function SectionError({ text, onRetry }: { text: string; onRetry: () => void }) {
  return (
    <View style={styles.sectionError} accessibilityRole="alert">
      <Text style={styles.sectionErrorText}>{text}</Text>
      <TouchableOpacity onPress={onRetry} style={styles.inlineRetry}><Text style={styles.inlineRetryText}>Retry</Text></TouchableOpacity>
    </View>
  );
}

function CardLoading() {
  return (
    <View style={styles.cardLoading}>
      <ActivityIndicator size="small" color="#2475cf" />
      <Text style={styles.loadingText}>Loading dashboard data…</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f7f8fa' },
  topBar: { minHeight: 72, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 18, paddingBottom: 12, backgroundColor: '#ffffff', borderBottomWidth: 1, borderBottomColor: '#e9edf0' },
  logo: { width: 148, height: 42 },
  topActions: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  headerButton: { width: 44, height: 44, borderRadius: 14, alignItems: 'center', justifyContent: 'center', backgroundColor: '#f8fafc', borderWidth: 1, borderColor: '#e1e7eb' },
  unreadDot: { position: 'absolute', top: 10, right: 10, width: 8, height: 8, borderRadius: 4, backgroundColor: '#d94d63', borderWidth: 1.5, borderColor: '#fff' },
  avatar: { width: 44, height: 44, borderRadius: 14, backgroundColor: '#061e35', alignItems: 'center', justifyContent: 'center', overflow: 'hidden', borderWidth: 2, borderColor: '#ffffff' },
  avatarActive: { borderColor: '#5ebc68' },
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
  content: { paddingHorizontal: 16, paddingTop: 24, gap: 16 },
  heroTitle: { color: '#061e35', fontSize: 29, lineHeight: 35, fontWeight: '900', letterSpacing: -0.9, marginBottom: 2 },
  todayCard: { minHeight: 82, flexDirection: 'row', alignItems: 'stretch', overflow: 'hidden', borderRadius: 18, backgroundColor: '#fff', borderWidth: 1, borderColor: '#cfe6d3', shadowColor: '#061e35', shadowOpacity: 0.06, shadowRadius: 12, shadowOffset: { width: 0, height: 6 }, elevation: 2 },
  dateBlock: { width: 67, backgroundColor: '#061e35', alignItems: 'center', justifyContent: 'center' },
  dateMonth: { color: 'rgba(255,255,255,0.7)', fontSize: 9, fontWeight: '900', letterSpacing: 1 },
  dateDay: { color: '#fff', fontSize: 25, lineHeight: 29, fontWeight: '900' },
  dateWeekday: { color: 'rgba(255,255,255,0.7)', fontSize: 9, fontWeight: '800', letterSpacing: 0.8 },
  todayCopy: { flex: 1, justifyContent: 'center', paddingHorizontal: 13, paddingVertical: 10, minWidth: 0 },
  todayTitleRow: { flexDirection: 'row', alignItems: 'center', gap: 7 },
  focusDot: { width: 7, height: 7, borderRadius: 4, backgroundColor: '#aab5bd' },
  focusDotActive: { backgroundColor: '#2f8f46', shadowColor: '#2f8f46', shadowOpacity: 0.3, shadowRadius: 4 },
  todayTitle: { color: '#102d43', fontSize: 14, fontWeight: '900' },
  todayText: { color: '#657685', fontSize: 12, lineHeight: 17, marginTop: 4 },
  todayArrow: { width: 44, alignItems: 'center', justifyContent: 'center' },
  warningCard: { flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: '#fff8e8', borderWidth: 1, borderColor: '#f1d8a7', borderRadius: 16, padding: 14 },
  warningCopy: { flex: 1 },
  warningTitle: { color: '#7a480f', fontWeight: '900', fontSize: 14 },
  warningText: { color: '#8f6b3b', marginTop: 2, fontSize: 13 },
  quickSection: { gap: 8 },
  quickTrigger: { minHeight: 54, flexDirection: 'row', alignItems: 'center', gap: 11, paddingHorizontal: 14, backgroundColor: '#fff', borderRadius: 14, borderWidth: 1, borderColor: '#dce3e8', shadowColor: '#061e35', shadowOpacity: 0.07, shadowRadius: 10, shadowOffset: { width: 0, height: 5 }, elevation: 2 },
  quickTriggerOpen: { borderColor: '#b8c9d6' },
  quickTriggerIcon: { width: 34, height: 34, borderRadius: 11, alignItems: 'center', justifyContent: 'center', backgroundColor: '#eef3f7' },
  quickTriggerText: { flex: 1, color: '#061e35', fontSize: 15, fontWeight: '900' },
  quickMenu: { gap: 7, padding: 7, backgroundColor: '#f2f5f7', borderRadius: 16, borderWidth: 1, borderColor: '#dce3e8' },
  quickAction: { minHeight: 60, flexDirection: 'row', alignItems: 'center', gap: 12, padding: 10, backgroundColor: '#fff', borderRadius: 13, borderWidth: 1, borderColor: '#dfe6ea' },
  quickIcon: { width: 40, height: 40, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  quickCopy: { flex: 1, minWidth: 0 },
  quickTitle: { color: '#102d43', fontSize: 15, lineHeight: 19, fontWeight: '900' },
  quickSubtitle: { color: '#6a7885', fontSize: 12, lineHeight: 16, marginTop: 2 },
  progressCard: { backgroundColor: '#fff', borderWidth: 1, borderColor: '#dce3e8', borderRadius: 18, padding: 16, shadowColor: '#061e35', shadowOpacity: 0.055, shadowRadius: 12, shadowOffset: { width: 0, height: 6 }, elevation: 2 },
  progressHeader: { minHeight: 25, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  progressTitleRow: { flexDirection: 'row', alignItems: 'baseline', gap: 8, flexWrap: 'wrap' },
  progressTitle: { color: '#061e35', fontSize: 16, fontWeight: '900' },
  progressPercent: { color: '#2f8f46', fontSize: 16, fontWeight: '900' },
  progressHelper: { color: '#6b7b88', fontSize: 12, marginTop: 4, marginBottom: 11 },
  progressTrack: { height: 8, borderRadius: 4, overflow: 'hidden', backgroundColor: '#dff0e3' },
  progressFill: { height: '100%', borderRadius: 4, backgroundColor: '#2f8f46' },
  loadingLine: { height: 8, marginTop: 12, borderRadius: 4, backgroundColor: '#e8edf0' },
  dashboardCard: { backgroundColor: '#fff', borderRadius: 20, borderWidth: 1, borderColor: '#dde4e8', borderTopWidth: 3, padding: 16, shadowColor: '#061e35', shadowOpacity: 0.06, shadowRadius: 14, shadowOffset: { width: 0, height: 7 }, elevation: 2 },
  cardHeader: { minHeight: 44, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12, marginBottom: 10 },
  cardEyebrow: { color: '#2f8f46', fontSize: 9, lineHeight: 12, fontWeight: '900', letterSpacing: 1.2 },
  cardTitle: { color: '#061e35', fontSize: 20, lineHeight: 25, fontWeight: '900', letterSpacing: -0.35 },
  cardTitleWithIcon: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  cardLink: { minHeight: 44, flexDirection: 'row', alignItems: 'center', gap: 5, paddingLeft: 8 },
  cardLinkText: { color: '#647585', fontSize: 12, fontWeight: '800' },
  metricList: { gap: 8 },
  moneyMetric: { minHeight: 58, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12, paddingHorizontal: 14, paddingVertical: 10, backgroundColor: '#f8fafb', borderRadius: 14, borderWidth: 1, borderColor: '#e3e8eb' },
  moneyLabel: { color: '#617280', fontSize: 13, fontWeight: '800' },
  moneyValue: { fontSize: 19, fontWeight: '900' },
  outstandingNote: { color: '#7b6a4c', fontSize: 12, lineHeight: 17, paddingHorizontal: 4, marginTop: 2 },
  portfolioGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  portfolioMetric: { width: '48%', minHeight: 145, padding: 13, borderRadius: 16, borderWidth: 1, justifyContent: 'space-between' },
  portfolioMetricTop: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', gap: 5 },
  portfolioLabel: { flex: 1, color: '#60717f', fontSize: 10, lineHeight: 14, fontWeight: '900', letterSpacing: 0.4, textTransform: 'uppercase' },
  portfolioIcon: { width: 31, height: 31, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  portfolioValue: { color: '#102d43', fontSize: 24, lineHeight: 29, fontWeight: '900', marginTop: 8 },
  portfolioHelper: { color: '#6d7c88', fontSize: 10, lineHeight: 14, marginTop: 4 },
  maintenanceRow: { minHeight: 68, flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 11, borderBottomWidth: 1, borderBottomColor: '#e9edf0' },
  maintenanceCopy: { flex: 1, minWidth: 0 },
  maintenanceTitle: { color: '#102d43', fontSize: 14, fontWeight: '900' },
  maintenanceLocation: { color: '#6a7a87', fontSize: 12, marginTop: 4 },
  statusChip: { maxWidth: '42%', minHeight: 28, justifyContent: 'center', paddingHorizontal: 10, borderRadius: 14, borderWidth: 1, borderColor: '#e2bf75', backgroundColor: '#fffaf0' },
  statusChipText: { color: '#8a5a12', fontSize: 10, fontWeight: '900', textAlign: 'center' },
  notificationRow: { flexDirection: 'row', alignItems: 'flex-start', paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: '#e9edf0' },
  lastRow: { borderBottomWidth: 0 },
  notificationDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: '#aeb9c1', marginTop: 6, marginRight: 11 },
  notificationDotUnread: { backgroundColor: '#2475cf' },
  notificationCopy: { flex: 1 },
  notificationTitle: { color: '#102d43', fontSize: 14, fontWeight: '900', marginBottom: 3 },
  notificationMessage: { color: '#697887', fontSize: 12, lineHeight: 17 },
  emptyState: { minHeight: 130, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 18, paddingVertical: 18 },
  emptyIcon: { width: 42, height: 42, borderRadius: 14, backgroundColor: '#edf8f0', alignItems: 'center', justifyContent: 'center', marginBottom: 9 },
  emptyTitle: { color: '#20394d', fontSize: 14, fontWeight: '900', textAlign: 'center' },
  emptyText: { color: '#6b7b88', fontSize: 12, lineHeight: 17, textAlign: 'center', marginTop: 4 },
  sectionError: { minHeight: 86, alignItems: 'flex-start', justifyContent: 'center' },
  sectionErrorText: { color: '#8d2923', fontSize: 13, fontWeight: '800' },
  inlineRetry: { minHeight: 44, justifyContent: 'center', paddingRight: 12 },
  inlineRetryText: { color: '#2475cf', fontSize: 13, fontWeight: '900' },
  cardLoading: { minHeight: 100, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10 },
  loadingText: { color: '#6b7b88', fontSize: 12 },
});
