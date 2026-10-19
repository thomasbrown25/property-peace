import { useTabScrollReset } from '../../navigation/useTabScrollReset';
import { useMoreDrawer } from '../../navigation/MoreDrawerContext';
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Animated,
  Image,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  useWindowDimensions,
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
import ConversationAPI from '../../api/conversationAPI';
import { ConversationSummary } from '../../features/messages/messagesModel';
import RentCollectionAPI from '../../api/rentCollectionAPI';
import { propertyOverdueAmounts } from '../../features/rentCollection/propertyOverdue';
import { displayStatus } from '../../features/maintenance/maintenanceModel';
import { useAppTheme } from '../../theme/AppTheme';
import { paymentActivityTone } from '../../features/notifications/paymentActivityTone';
import GlobalSearchModal from '../../components/GlobalSearchModal';

const lightLogo = require('../../../assets/property-peace-navbar-logo.png');
const darkLogo = require('../../../assets/property-peace-logo.png');

type LoadStatus = 'loading' | 'success' | 'error';
type RentMetrics = {
  expected: number;
  collected: number;
  remaining: number;
  outstanding: number;
  overdue: number;
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
const getPropertyId = (property: Property) => String(property.id ?? property.Id ?? '');
const getRequestId = (request: MaintenanceRequest) => String(request.id ?? request.Id ?? '');

const formatMoney = (value: number) => new Intl.NumberFormat('en-US', {
  style: 'currency',
  currency: 'USD',
  minimumFractionDigits: value % 1 === 0 ? 0 : 2,
  maximumFractionDigits: 2,
}).format(value || 0);

const isOpenMaintenance = (request: MaintenanceRequest) => {
  const status = firstString(request.status, request.Status).toLowerCase().replace(/[-_\s]/g, '');
  return !['completed', 'cancelled', 'closed', 'resolved'].includes(status);
};

const requestTime = (request: MaintenanceRequest) => {
  const raw = read(request, 'createdAtUtc', 'CreatedAtUtc') || read(request, 'createdAt', 'CreatedAt');
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
    overdue: Math.max(firstNumber(source.overdue, source.Overdue), 0),
  };
};

export default function DashboardScreen() {
  const scrollRef = useRef<ScrollView>(null);
  useTabScrollReset(scrollRef);
  const styles = useScreenStyles();
  const { mode, colors } = useAppTheme();
  const navigation = useNavigation<any>();
  const moreDrawer = useMoreDrawer();
  const dispatch = useAppDispatch();
  const insets = useSafeAreaInsets();
  const { width: screenWidth } = useWindowDimensions();
  const { currentUser } = useAppSelector((state) => state.user);
  const [properties, setProperties] = useState<Property[]>([]);
  const [maintenance, setMaintenance] = useState<MaintenanceRequest[]>([]);
  const [notifications, setNotifications] = useState<AppNotification[]>([]);
  const [conversations, setConversations] = useState<ConversationSummary[]>([]);
  const [searchOpen, setSearchOpen] = useState(false);
  const [rentMetrics, setRentMetrics] = useState<RentMetrics>({ expected: 0, collected: 0, remaining: 0, outstanding: 0, overdue: 0 });
  const [overdueByProperty, setOverdueByProperty] = useState<Map<string, number> | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [propertiesStatus, setPropertiesStatus] = useState<LoadStatus>('loading');
  const [maintenanceStatus, setMaintenanceStatus] = useState<LoadStatus>('loading');
  const [notificationsStatus, setNotificationsStatus] = useState<LoadStatus>('loading');
  const [conversationsStatus, setConversationsStatus] = useState<LoadStatus>('loading');
  const [rentStatus, setRentStatus] = useState<LoadStatus>('loading');
  const [openMenu, setOpenMenu] = useState<'profile' | 'notifications' | null>(null);
  const [notificationMenuMounted, setNotificationMenuMounted] = useState(false);
  const notificationMenuProgress = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    if (openMenu === 'notifications') setNotificationMenuMounted(true);
    const animation = Animated.timing(notificationMenuProgress, {
      toValue: openMenu === 'notifications' ? 1 : 0,
      duration: openMenu === 'notifications' ? 240 : 180,
      useNativeDriver: true,
    });
    animation.start(({ finished }) => {
      if (finished && openMenu !== 'notifications') setNotificationMenuMounted(false);
    });
    return () => animation.stop();
  }, [openMenu, notificationMenuProgress]);
  const loadGeneration = useRef(0);
  const organizationId = String(currentUser?.currentOrganizationId ?? currentUser?.CurrentOrganizationId ?? '');
  const currentOrganizationId = useRef(organizationId);
  const [loadedOrganizationId, setLoadedOrganizationId] = useState<string | null>(null);
  currentOrganizationId.current = organizationId;

  const clearDashboard = useCallback(() => {
    setProperties([]);
    setMaintenance([]);
    setNotifications([]);
    setConversations([]);
    setRentMetrics({ expected: 0, collected: 0, remaining: 0, outstanding: 0, overdue: 0 });
    setOverdueByProperty(null);
    setPropertiesStatus('loading');
    setMaintenanceStatus('loading');
    setNotificationsStatus('loading');
    setConversationsStatus('loading');
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
      ConversationAPI.getConversations('landlord', true),
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
      setOverdueByProperty(propertyOverdueAmounts(results[3].value));
      setRentStatus('success');
    } else {
      setOverdueByProperty(null);
      setRentStatus('error');
    }
    if (results[4].status === 'fulfilled') {
      setConversations(results[4].value || []);
      setConversationsStatus('success');
    } else {
      setConversationsStatus('error');
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
      setOpenMenu(null);
      ++loadGeneration.current;
    };
  }, [loadDashboard]));

  const dashboardScopeIsCurrent = loadedOrganizationId === organizationId;
  const scopedProperties = dashboardScopeIsCurrent ? properties : [];
  const scopedMaintenance = dashboardScopeIsCurrent ? maintenance : [];
  const scopedNotifications = dashboardScopeIsCurrent ? notifications : [];
  const scopedConversations = dashboardScopeIsCurrent ? conversations : [];
  const scopedRentMetrics = dashboardScopeIsCurrent
    ? rentMetrics
    : { expected: 0, collected: 0, remaining: 0, outstanding: 0, overdue: 0 };
  const scopedOverdueByProperty = dashboardScopeIsCurrent ? overdueByProperty : null;
  const scopedPropertiesStatus: LoadStatus = dashboardScopeIsCurrent ? propertiesStatus : 'loading';
  const scopedMaintenanceStatus: LoadStatus = dashboardScopeIsCurrent ? maintenanceStatus : 'loading';
  const scopedNotificationsStatus: LoadStatus = dashboardScopeIsCurrent ? notificationsStatus : 'loading';
  const scopedConversationsStatus: LoadStatus = dashboardScopeIsCurrent ? conversationsStatus : 'loading';
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

  const portfolio = useMemo(() => ({
    openMaintenance: scopedMaintenance.filter(isOpenMaintenance).length,
    unreadNotifications: scopedNotifications.filter((item: any) => item.isRead === false || item.IsRead === false).length,
  }), [scopedMaintenance, scopedNotifications]);

  const unreadMessages = scopedConversations.reduce((total, conversation) =>
    total + (conversation.isArchived ? 0 : Math.max(0, Number(conversation.unreadCount) || 0)), 0);
  const attentionProperties = useMemo(() => {
    if (scopedPropertiesStatus !== 'success' || scopedMaintenanceStatus !== 'success' || scopedRentStatus !== 'success' || !scopedOverdueByProperty) return [];
    const repairsByProperty = new Map<string, number>();
    scopedMaintenance.filter(isOpenMaintenance).forEach((request) => {
      const id = String(read(request, 'propertyId', 'PropertyId') ?? '');
      if (id) repairsByProperty.set(id, (repairsByProperty.get(id) || 0) + 1);
    });
    return scopedProperties.flatMap((property) => {
      if (property.isActive === false || property.IsActive === false) return [];
      const id = getPropertyId(property);
      if (!id) return [];
      const openRepairs = repairsByProperty.get(id) || 0;
      const overdueAmount = scopedOverdueByProperty.get(id) || 0;
      return [{
        property,
        name: firstString(property.name, property.Name, property.streetAddress, property.StreetAddress, 'Unnamed property'),
        overdueAmount,
        openRepairs,
        reason: `${openRepairs} open ${openRepairs === 1 ? 'repair' : 'repairs'} · ${overdueAmount > 0 ? `${formatMoney(overdueAmount)} overdue rent` : 'Paid'}`,
      }];
    }).slice(0, 5);
  }, [scopedProperties, scopedMaintenance, scopedOverdueByProperty, scopedPropertiesStatus, scopedMaintenanceStatus, scopedRentStatus]);

  const collectionPct = scopedRentMetrics.expected > 0
    ? Math.min(Math.max((scopedRentMetrics.collected / scopedRentMetrics.expected) * 100, 0), 100)
    : 0;
  const attentionCount = portfolio.openMaintenance + unreadMessages;
  const attentionDataLoading = scopedMaintenanceStatus === 'loading' || scopedConversationsStatus === 'loading';
  const attentionDataAvailable = scopedMaintenanceStatus === 'success' && scopedConversationsStatus === 'success';
  const hasUnavailableData = [scopedPropertiesStatus, scopedMaintenanceStatus, scopedNotificationsStatus, scopedConversationsStatus, scopedRentStatus].includes('error');
  const currentDate = new Date();
  const latestMaintenance = useMemo(
    () => [...scopedMaintenance].filter(isOpenMaintenance).sort((a, b) => requestTime(b) - requestTime(a)).slice(0, 3),
    [scopedMaintenance],
  );
  const recentNotifications = useMemo(
    () => [...scopedNotifications].sort((a, b) => notificationTime(b) - notificationTime(a)).slice(0, 5),
    [scopedNotifications],
  );
  const latestNotifications = recentNotifications.slice(0, 3);

  return (
    <View style={styles.container}>
      <View style={[styles.topBar, { paddingTop: Math.max(insets.top + 10, 18) }]}>
        <TouchableOpacity style={styles.headerButton} onPress={moreDrawer.show} accessibilityRole="button" accessibilityLabel="Open more menu" accessibilityState={{ expanded: moreDrawer.open }}>
          <Ionicons name="menu-outline" size={25} color={mode === 'dark' ? colors.text : '#0b3558'} />
        </TouchableOpacity>
        <Image source={mode === 'dark' ? darkLogo : lightLogo} style={[styles.logo, screenWidth < 370 && styles.compactLogo]} resizeMode="contain" accessibilityLabel="Property Peace" />
        <View style={styles.headerActions}>
          <TouchableOpacity style={styles.headerButton} onPress={() => setSearchOpen(true)} accessibilityRole="button" accessibilityLabel="Search properties, tenants, and leases">
            <Ionicons name="search-outline" size={25} color={mode === 'dark' ? colors.text : '#0b3558'} />
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.headerButton}
            onPress={() => navigation.getParent()?.navigate('Messages', { screen: 'MessagesList' })}
            accessibilityRole="button"
            accessibilityLabel={unreadMessages > 0 ? `Messages, ${unreadMessages} unread` : 'Messages'}
          >
            <Ionicons name="chatbubble-ellipses-outline" size={25} color={mode === 'dark' ? colors.text : '#0b3558'} />
            {scopedConversationsStatus === 'success' && unreadMessages > 0 && (
              <View style={styles.messageBadge}>
                <Text style={styles.messageBadgeText}>{unreadMessages > 99 ? '99+' : unreadMessages}</Text>
              </View>
            )}
          </TouchableOpacity>
        </View>
      </View>

      <GlobalSearchModal visible={searchOpen} onClose={() => setSearchOpen(false)} onSelect={(type, id) => {
        const tabs = navigation.getParent();
        if (type === 'property') tabs?.navigate('Properties', { screen: 'PropertyDetail', params: { propertyId: String(id) } });
        if (type === 'tenant') tabs?.navigate('Tenants', { screen: 'TenantDetail', params: { tenantId: String(id) } });
        if (type === 'lease') tabs?.navigate('Leases', { screen: 'LeaseDetail', params: { leaseId: String(id), archived: false } });
      }} />

      {(openMenu || notificationMenuMounted) && (
        <View style={styles.profileMenuLayer} pointerEvents="box-none">
          <Pressable style={StyleSheet.absoluteFill} onPress={() => setOpenMenu(null)} accessibilityLabel="Close menu" />
          {openMenu === 'profile' ? (
          <View style={[styles.profileMenu, { top: Math.max(insets.top + 68, 78) }]}>
            <View style={styles.profileIdentity}>
              <Text style={styles.profileName}>{displayName}</Text>
              <Text style={styles.profileEmail} numberOfLines={1}>{email}</Text>
            </View>
            <ProfileAction icon="people-outline" label="Tenants" onPress={() => { setOpenMenu(null); navigation.navigate('Tenants'); }} />
            <ProfileAction icon="document-text-outline" label="Leases" onPress={() => { setOpenMenu(null); navigation.navigate('Leases'); }} />
            <ProfileAction icon="settings-outline" label="Settings" onPress={() => { setOpenMenu(null); navigation.navigate('Settings'); }} />
            <ProfileAction icon="log-out-outline" label="Sign out" destructive onPress={async () => { setOpenMenu(null); await dispatch(logout()); }} />
          </View>
          ) : (
            <Animated.View style={[styles.notificationsMenu, {
              top: Math.max(insets.top + 68, 78),
              opacity: notificationMenuProgress,
              transform: [{ translateY: notificationMenuProgress.interpolate({ inputRange: [0, 1], outputRange: [-16, 0] }) }],
            }]}>
              <Text style={styles.notificationsMenuHeading}>Recent notifications</Text>
              <ScrollView style={styles.notificationsMenuList} nestedScrollEnabled>
                {scopedNotificationsStatus === 'loading' ? (
                  <View style={styles.notificationsMenuState}><ActivityIndicator color={colors.accent} /></View>
                ) : scopedNotificationsStatus === 'error' ? (
                  <View style={styles.notificationsMenuState}>
                    <Text style={styles.notificationsMenuHint}>Couldn't load notifications.</Text>
                    <TouchableOpacity onPress={loadDashboard} style={styles.notificationsMenuRetry} accessibilityRole="button"><Text style={styles.notificationsMenuLink}>Retry</Text></TouchableOpacity>
                  </View>
                ) : recentNotifications.length === 0 ? (
                  <Text style={styles.notificationsMenuHint}>No recent notifications.</Text>
                ) : recentNotifications.map((notification, index) => (
                  <View key={String(notification.id ?? notification.Id ?? index)} style={styles.notificationsMenuRow}>
                    <View style={[styles.notificationDot,
                      paymentActivityTone(notification) === 'received' ? styles.notificationDotReceived
                        : paymentActivityTone(notification) === 'pending' ? styles.notificationDotPending
                        : paymentActivityTone(notification) === 'failed' ? styles.notificationDotFailed
                        : (notification.isRead === false || notification.IsRead === false) && styles.notificationDotUnread,
                    ]} />
                    <View style={styles.notificationCopy}>
                      <Text style={styles.notificationTitle} numberOfLines={1}>{notification.title || notification.Title || 'Notification'}</Text>
                      {!!(notification.message || notification.Message) && <Text style={styles.notificationMessage} numberOfLines={2}>{notification.message || notification.Message}</Text>}
                    </View>
                  </View>
                ))}
              </ScrollView>
              <TouchableOpacity style={styles.notificationsMenuFooter} onPress={() => { setOpenMenu(null); navigation.navigate('Notifications'); }} accessibilityRole="button" accessibilityLabel="View all notifications">
                <Text style={styles.notificationsMenuLink}>View all</Text>
                <Ionicons name="arrow-forward" size={16} color={mode === 'dark' ? colors.accent : '#2475cf'} />
              </TouchableOpacity>
            </Animated.View>
          )}
        </View>
      )}

      <ScrollView
        ref={scrollRef}
        contentContainerStyle={[styles.content, { paddingBottom: 24 }]}
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); loadDashboard(); }} tintColor={colors.accent} />}
      >
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
                    ? <>
                        <Text style={portfolio.openMaintenance > 0 ? styles.todayRepairAttention : undefined}>
                          {portfolio.openMaintenance} open {portfolio.openMaintenance === 1 ? 'repair' : 'repairs'}
                        </Text>
                        {' · '}
                        <Text style={unreadMessages > 0 ? styles.todayUnreadAttention : undefined}>
                          {unreadMessages} unread {unreadMessages === 1 ? 'message' : 'messages'}
                        </Text>
                      </>
                    : 'Nothing urgent across your portfolio.'}
            </Text>
          </View>
          <TouchableOpacity style={styles.todayArrow} onPress={() => navigation.navigate('Calendar')} accessibilityRole="button" accessibilityLabel="View calendar">
            <Ionicons name="arrow-forward" size={18} color={mode === 'dark' ? colors.text : '#0b3558'} />
          </TouchableOpacity>
        </View>

        <DashboardSection borderless>
          <View style={styles.cardHeader}>
            <Text style={[styles.cardTitle, styles.rentProgressHeading]}>{currentDate.toLocaleDateString('en-US', { month: 'long' })} rent</Text>
            <TouchableOpacity style={styles.cardLink} onPress={() => navigation.navigate('RentCollection')} accessibilityRole="button" accessibilityLabel="View all rent collection">
              <Text style={styles.cardLinkText}>View all</Text>
              <Ionicons name="arrow-forward" size={14} color={mode === 'dark' ? colors.muted : '#647585'} />
            </TouchableOpacity>
          </View>
          {scopedRentStatus === 'error' ? (
            <SectionError text="Rent collection is unavailable." onRetry={loadDashboard} />
          ) : scopedRentStatus === 'loading' ? (
            <CardLoading />
          ) : scopedRentMetrics.expected === 0 && scopedRentMetrics.collected === 0 && scopedRentMetrics.overdue === 0 ? (
            <Text style={styles.rentEmpty}>No active rent expected this month. Rent figures will appear when a lease is active.</Text>
          ) : (
            <View style={styles.rentSummary}>
              <Text style={styles.rentCaption}>COLLECTED THIS MONTH</Text>
              <View style={styles.rentHeroRow}>
                <Text style={styles.rentHeroAmount} adjustsFontSizeToFit numberOfLines={1}>{formatMoney(scopedRentMetrics.collected)}</Text>
                {scopedRentMetrics.expected > 0 && <Text style={styles.rentPercent}>{Math.round(collectionPct)}%</Text>}
              </View>
              {scopedRentMetrics.expected > 0 && (
                <View style={styles.progressTrack} accessibilityRole="progressbar" accessibilityLabel="Rent collected this month" accessibilityValue={{ min: 0, max: 100, now: Math.round(collectionPct) }}>
                  <View style={[styles.progressFill, { width: `${collectionPct}%` }]} />
                </View>
              )}
              <View style={styles.rentDetails}>
                <View style={styles.rentDetail}><Text style={styles.rentDetailLabel}>Expected this month</Text><Text style={styles.rentDetailValue}>{formatMoney(scopedRentMetrics.expected)}</Text></View>
                <View style={[styles.rentDetail, styles.rentDetailLast]}><Text style={styles.rentDetailLabel}>Overdue rent</Text><Text style={[styles.rentDetailValue, scopedRentMetrics.overdue > 0 && styles.rentOverdue]}>{formatMoney(scopedRentMetrics.overdue)}</Text></View>
              </View>
            </View>
          )}
        </DashboardSection>

        {hasUnavailableData && (
          <TouchableOpacity style={styles.warningCard} onPress={loadDashboard} activeOpacity={0.82} accessibilityLabel="Retry unavailable dashboard information">
            <Ionicons name="cloud-offline-outline" size={22} color={mode === 'dark' ? '#f0ba72' : '#a45f12'} />
            <View style={styles.warningCopy}>
              <Text style={styles.warningTitle}>Some information is unavailable</Text>
              <Text style={styles.warningText}>Tap to retry the missing dashboard sections.</Text>
            </View>
          </TouchableOpacity>
        )}

        <DashboardSection borderless>
          <View style={styles.cardHeader}>
            <View style={styles.cardTitleWithIcon}>
              <Ionicons name="home-outline" size={20} color={mode === 'dark' ? '#72b4ff' : '#2475cf'} />
              <Text style={styles.cardTitle}>Properties</Text>
            </View>
            <TouchableOpacity style={styles.cardLink} onPress={() => navigation.navigate('Properties', { screen: 'PropertiesList' })} accessibilityRole="button" accessibilityLabel="View all properties">
              <Text style={styles.cardLinkText}>View all</Text>
              <Ionicons name="arrow-forward" size={14} color={mode === 'dark' ? colors.muted : '#647585'} />
            </TouchableOpacity>
          </View>
          {scopedPropertiesStatus === 'error' || scopedMaintenanceStatus === 'error' || scopedRentStatus === 'error' || (scopedRentStatus === 'success' && !scopedOverdueByProperty) ? (
            <SectionError text="Property rent balances are unavailable." onRetry={loadDashboard} />
          ) : scopedPropertiesStatus === 'loading' || scopedMaintenanceStatus === 'loading' || scopedRentStatus === 'loading' ? (
            <CardLoading />
          ) : attentionProperties.length === 0 ? (
            <Text style={styles.rentEmpty}>No active properties yet.</Text>
          ) : attentionProperties.map((item) => (
            <TouchableOpacity key={getPropertyId(item.property)} style={styles.attentionProperty} onPress={() => navigation.navigate('Properties', { screen: 'PropertyDetail', params: { propertyId: getPropertyId(item.property) } })} accessibilityRole="button" accessibilityLabel={`View ${item.name}, ${item.reason}`}>
              <View style={styles.attentionCopy}>
                <Text style={styles.attentionName} numberOfLines={1}>{item.name}</Text>
                <Text style={styles.attentionReason}>
                  <Text style={item.openRepairs > 0 ? styles.todayRepairAttention : undefined}>
                    {item.openRepairs} open {item.openRepairs === 1 ? 'repair' : 'repairs'}
                  </Text>
                  {' · '}
                  <Text style={item.overdueAmount > 0 ? styles.rentOverdue : styles.propertyPaid}>
                    {item.overdueAmount > 0 ? `${formatMoney(item.overdueAmount)} overdue rent` : 'Paid'}
                  </Text>
                </Text>
              </View>
              <Ionicons name="arrow-forward" size={19} color={mode === 'dark' ? colors.text : '#0b3558'} />
            </TouchableOpacity>
          ))}
        </DashboardSection>

        <DashboardSection borderless>
          <View style={styles.cardHeader}>
            <View style={styles.cardTitleWithIcon}>
              <Ionicons name="construct-outline" size={20} color={mode === 'dark' ? '#f0ba72' : '#b76a11'} />
              <Text style={styles.cardTitle}>Maintenance</Text>
            </View>
            <TouchableOpacity style={styles.cardLink} onPress={() => navigation.navigate('Maintenance', { screen: 'MaintenanceList' })}>
              <Text style={styles.cardLinkText}>View all</Text>
              <Ionicons name="arrow-forward" size={14} color={mode === 'dark' ? colors.muted : '#647585'} />
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
        </DashboardSection>

        <DashboardSection borderless>
          <View style={styles.cardHeader}>
            <View>
              <Text style={styles.cardEyebrow}>RECENT</Text>
              <Text style={styles.cardTitle}>Activity</Text>
            </View>
            <TouchableOpacity style={styles.cardLink} onPress={() => navigation.navigate('Notifications')}>
              <Text style={styles.cardLinkText}>View all</Text>
              <Ionicons name="arrow-forward" size={14} color={mode === 'dark' ? colors.muted : '#647585'} />
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
              <View style={[styles.notificationDot,
                paymentActivityTone(notification) === 'received' ? styles.notificationDotReceived
                  : paymentActivityTone(notification) === 'pending' ? styles.notificationDotPending
                  : paymentActivityTone(notification) === 'failed' ? styles.notificationDotFailed
                  : (notification.isRead === false || notification.IsRead === false) && styles.notificationDotUnread,
              ]} />
              <View style={styles.notificationCopy}>
                <Text style={styles.notificationTitle}>{notification.title || notification.Title || 'Notification'}</Text>
                {!!(notification.message || notification.Message) && <Text style={styles.notificationMessage} numberOfLines={2}>{notification.message || notification.Message}</Text>}
              </View>
            </View>
          ))}
        </DashboardSection>
      </ScrollView>
    </View>
  );
}

function DashboardSection({ children, borderless = false }: { children: React.ReactNode; borderless?: boolean }) {
  const styles = useScreenStyles();
  return <View style={[styles.dashboardSection, borderless && styles.borderlessSection]}>{children}</View>;
}

function ProfileAction({ icon, label, onPress, destructive }: { icon: keyof typeof Ionicons.glyphMap; label: string; onPress: () => void | Promise<void>; destructive?: boolean }) {
  const styles = useScreenStyles();
  const { mode, colors } = useAppTheme();
  return (
    <TouchableOpacity style={styles.profileAction} onPress={onPress}>
      <Ionicons name={icon} size={20} color={destructive ? (mode === 'dark' ? '#ff8b86' : '#c2413b') : (mode === 'dark' ? colors.text : '#20394d')} />
      <Text style={[styles.profileActionText, destructive && styles.destructiveText]}>{label}</Text>
    </TouchableOpacity>
  );
}

function MaintenanceRow({ request, isLast, onPress }: { request: MaintenanceRequest; isLast: boolean; onPress: () => void }) {
  const styles = useScreenStyles();
  const title = firstString(request.title, request.Title, 'Maintenance request');
  const createdAt = requestTime(request);
  const createdDate = createdAt ? new Date(createdAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : 'Date unavailable';
  const status = displayStatus(request.status ?? request.Status);
  return (
    <TouchableOpacity style={[styles.maintenanceRow, isLast && styles.lastRow]} onPress={onPress} accessibilityLabel={`Open maintenance request ${title}`}>
      <View style={styles.maintenanceCopy}>
        <Text style={styles.maintenanceTitle} numberOfLines={1}>{title}</Text>
        <Text style={styles.maintenanceLocation} numberOfLines={1}>Created {createdDate}</Text>
      </View>
      <View style={styles.statusChip}><Text style={styles.statusChipText}>{status}</Text></View>
    </TouchableOpacity>
  );
}

function EmptyState({ icon, title, text }: { icon: keyof typeof Ionicons.glyphMap; title: string; text: string }) {
  const styles = useScreenStyles();
  const { mode } = useAppTheme();
  return (
    <View style={styles.emptyState}>
      <View style={styles.emptyIcon}><Ionicons name={icon} size={22} color={mode === 'dark' ? '#75d995' : '#2f8f46'} /></View>
      <Text style={styles.emptyTitle}>{title}</Text>
      <Text style={styles.emptyText}>{text}</Text>
    </View>
  );
}

function SectionError({ text, onRetry }: { text: string; onRetry: () => void }) {
  const styles = useScreenStyles();
  return (
    <View style={styles.sectionError} accessibilityRole="alert">
      <Text style={styles.sectionErrorText}>{text}</Text>
      <TouchableOpacity onPress={onRetry} style={styles.inlineRetry}><Text style={styles.inlineRetryText}>Retry</Text></TouchableOpacity>
    </View>
  );
}

function CardLoading() {
  const styles = useScreenStyles();
  const { colors } = useAppTheme();
  return (
    <View style={styles.cardLoading}>
      <ActivityIndicator size="small" color={colors.accent} />
      <Text style={styles.loadingText}>Loading dashboard data…</Text>
    </View>
  );
}

function useScreenStyles() {
  const { mode, colors } = useAppTheme();
  return useMemo(() => mode === 'light' ? styles : {
    ...styles,
    ...StyleSheet.create({
      container: { ...styles.container, backgroundColor: colors.background },
      topBar: { ...styles.topBar, backgroundColor: colors.background },
      headerButton: { ...styles.headerButton, backgroundColor: colors.surface, borderColor: colors.border },
      unreadDot: { ...styles.unreadDot, borderColor: colors.surface },
      avatar: { ...styles.avatar, borderColor: colors.border },
      profileMenu: { ...styles.profileMenu, backgroundColor: colors.surface, borderColor: colors.border },
      notificationsMenu: { ...styles.notificationsMenu, backgroundColor: colors.surface, borderColor: colors.border },
      notificationsMenuHeading: { ...styles.notificationsMenuHeading, color: colors.text, borderBottomColor: colors.border },
      notificationsMenuRow: { ...styles.notificationsMenuRow, borderBottomColor: colors.border },
      notificationsMenuHint: { ...styles.notificationsMenuHint, color: colors.muted },
      notificationsMenuFooter: { ...styles.notificationsMenuFooter, borderTopColor: colors.border },
      notificationsMenuLink: { ...styles.notificationsMenuLink, color: colors.accent },
      profileIdentity: { ...styles.profileIdentity, backgroundColor: colors.background, borderBottomColor: colors.border },
      profileName: { ...styles.profileName, color: colors.text },
      profileEmail: { ...styles.profileEmail, color: colors.muted },
      profileAction: { ...styles.profileAction, borderBottomColor: colors.border },
      profileActionText: { ...styles.profileActionText, color: colors.text },
      destructiveText: { ...styles.destructiveText, color: '#ff8b86' },
      todayCard: { ...styles.todayCard, borderBottomColor: colors.border },
      dateBlock: { ...styles.dateBlock, borderRightColor: colors.border },
      dateMonth: { ...styles.dateMonth, color: colors.accent },
      dateDay: { ...styles.dateDay, color: colors.text },
      dateWeekday: { ...styles.dateWeekday, color: colors.muted },
      focusDot: { ...styles.focusDot, backgroundColor: colors.muted },
      focusDotActive: styles.focusDotActive,
      todayTitle: { ...styles.todayTitle, color: colors.text },
      todayText: { ...styles.todayText, color: colors.muted },
      todayRepairAttention: { ...styles.todayRepairAttention, color: '#ff8b86' },
      todayUnreadAttention: { ...styles.todayUnreadAttention, color: colors.accent },
      warningCard: { ...styles.warningCard, borderTopColor: colors.border },
      warningTitle: { ...styles.warningTitle, color: '#f0ba72' },
      warningText: { ...styles.warningText, color: colors.muted },
      rentSummary: { ...styles.rentSummary, backgroundColor: colors.surface },
      rentEmpty: { ...styles.rentEmpty, color: colors.muted },
      rentCaption: { ...styles.rentCaption, color: colors.accent },
      rentHeroAmount: { ...styles.rentHeroAmount, color: colors.text },
      rentPercent: { ...styles.rentPercent, color: '#75d995' },
      rentDetail: { ...styles.rentDetail, borderBottomColor: colors.border },
      rentDetailLabel: { ...styles.rentDetailLabel, color: colors.muted },
      rentDetailValue: { ...styles.rentDetailValue, color: colors.text },
      rentOverdue: { ...styles.rentOverdue, color: '#ff8b86' },
      propertyPaid: { ...styles.propertyPaid, color: '#75d995' },
      attentionProperty: { ...styles.attentionProperty, borderBottomColor: colors.border },
      attentionName: { ...styles.attentionName, color: colors.text },
      attentionReason: { ...styles.attentionReason, color: colors.muted },
      progressTrack: { ...styles.progressTrack, backgroundColor: colors.border },
      dashboardSection: { ...styles.dashboardSection, borderTopColor: colors.border },
      cardEyebrow: { ...styles.cardEyebrow, color: '#75d995' },
      cardTitle: { ...styles.cardTitle, color: colors.text },
      cardLinkText: { ...styles.cardLinkText, color: colors.muted },
      maintenanceRow: { ...styles.maintenanceRow, borderBottomColor: colors.border },
      maintenanceTitle: { ...styles.maintenanceTitle, color: colors.text },
      maintenanceLocation: { ...styles.maintenanceLocation, color: colors.muted },
      statusChip: { ...styles.statusChip, backgroundColor: '#3b3225', borderColor: '#947143' },
      statusChipText: { ...styles.statusChipText, color: '#f0ba72' },
      notificationRow: { ...styles.notificationRow, borderBottomColor: colors.border },
      notificationDot: { ...styles.notificationDot, backgroundColor: colors.muted },
      notificationDotUnread: { ...styles.notificationDotUnread, backgroundColor: colors.accent },
      notificationDotReceived: { ...styles.notificationDotReceived, backgroundColor: '#75d995' },
      notificationDotPending: { ...styles.notificationDotPending, backgroundColor: '#f0ba72' },
      notificationDotFailed: { ...styles.notificationDotFailed, backgroundColor: '#ff8b86' },
      notificationTitle: { ...styles.notificationTitle, color: colors.text },
      notificationMessage: { ...styles.notificationMessage, color: colors.muted },
      emptyIcon: { ...styles.emptyIcon, backgroundColor: colors.surface },
      emptyTitle: { ...styles.emptyTitle, color: colors.text },
      emptyText: { ...styles.emptyText, color: colors.muted },
      sectionErrorText: { ...styles.sectionErrorText, color: '#ff8b86' },
      inlineRetryText: { ...styles.inlineRetryText, color: colors.accent },
      loadingText: { ...styles.loadingText, color: colors.muted },
    }),
  }, [mode, colors]);
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#ffffff' },
  topBar: { minHeight: 72, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 12, paddingBottom: 12, backgroundColor: '#ffffff' },
  logo: { position: 'absolute', width: 148, height: 42, left: '50%', marginLeft: -74, bottom: 13 },
  compactLogo: { width: 112, marginLeft: -56 },
  headerActions: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  headerButton: { width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center', backgroundColor: '#f8fafc', borderWidth: 1, borderColor: '#e1e7eb' },
  unreadDot: { position: 'absolute', top: 10, right: 10, width: 8, height: 8, borderRadius: 4, backgroundColor: '#d94d63', borderWidth: 1.5, borderColor: '#fff' },
  messageBadge: { position: 'absolute', top: -7, right: -8, minWidth: 21, height: 21, paddingHorizontal: 4, borderRadius: 11, backgroundColor: '#dc2626', alignItems: 'center', justifyContent: 'center' },
  messageBadgeText: { color: '#fff', fontSize: 12, fontWeight: '800', lineHeight: 16, textAlign: 'center' },
  avatar: { width: 44, height: 44, borderRadius: 22, backgroundColor: '#061e35', alignItems: 'center', justifyContent: 'center', overflow: 'hidden', borderWidth: 2, borderColor: '#ffffff' },
  avatarActive: { borderColor: '#5ebc68' },
  avatarImage: { width: '100%', height: '100%' },
  avatarText: { color: '#fff', fontSize: 17, fontWeight: '900' },
  profileMenuLayer: { position: 'absolute', top: 0, right: 0, bottom: 0, left: 0, zIndex: 50, elevation: 50 },
  profileMenu: { position: 'absolute', left: 14, width: 280, maxWidth: '88%', backgroundColor: '#fff', borderRadius: 18, borderWidth: 1, borderColor: '#e3e9ed', overflow: 'hidden', shadowColor: '#001a33', shadowOpacity: 0.18, shadowRadius: 18, shadowOffset: { width: 0, height: 8 }, elevation: 16 },
  notificationsMenu: { position: 'absolute', right: 14, width: 320, maxWidth: '88%', backgroundColor: '#fff', borderRadius: 18, borderWidth: 1, borderColor: '#e3e9ed', overflow: 'hidden', shadowColor: '#001a33', shadowOpacity: 0.18, shadowRadius: 18, shadowOffset: { width: 0, height: 8 }, elevation: 16 },
  notificationsMenuHeading: { color: '#102d43', fontSize: 16, fontWeight: '900', paddingHorizontal: 16, paddingVertical: 14, borderBottomWidth: 1, borderBottomColor: '#edf1f3' },
  notificationsMenuList: { maxHeight: 340 },
  notificationsMenuRow: { flexDirection: 'row', alignItems: 'flex-start', paddingHorizontal: 16, paddingVertical: 13, borderBottomWidth: 1, borderBottomColor: '#edf1f3' },
  notificationsMenuState: { alignItems: 'center', padding: 18 },
  notificationsMenuHint: { color: '#697887', fontSize: 13, lineHeight: 19, padding: 16 },
  notificationsMenuRetry: { minHeight: 44, justifyContent: 'center' },
  notificationsMenuFooter: { minHeight: 52, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, borderTopWidth: 1, borderTopColor: '#edf1f3' },
  notificationsMenuLink: { color: '#2475cf', fontSize: 14, fontWeight: '800' },
  profileIdentity: { padding: 18, backgroundColor: '#f8fbfd', borderBottomWidth: 1, borderBottomColor: '#edf1f3' },
  profileName: { color: '#102d43', fontSize: 17, fontWeight: '900' },
  profileEmail: { color: '#6a7885', fontSize: 13, marginTop: 4 },
  profileAction: { minHeight: 50, flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 18, borderBottomWidth: 1, borderBottomColor: '#f0f2f4' },
  profileActionText: { color: '#20394d', fontSize: 15, fontWeight: '800' },
  destructiveText: { color: '#c2413b' },
  content: { paddingHorizontal: 24, paddingTop: 14, gap: 0 },
  todayCard: { minHeight: 105, flexDirection: 'row', alignItems: 'center', paddingBottom: 12, borderBottomWidth: 1, borderBottomColor: '#dce4e8' },
  dateBlock: { width: 76, alignItems: 'center', justifyContent: 'center', borderRightWidth: 1, borderRightColor: '#dce4e8' },
  dateMonth: { color: '#2475cf', fontSize: 11, fontWeight: '900', letterSpacing: 1.6 },
  dateDay: { color: '#061e35', fontSize: 43, lineHeight: 48, fontWeight: '900', letterSpacing: -2 },
  dateWeekday: { color: '#657685', fontSize: 10, fontWeight: '800', letterSpacing: 1 },
  todayCopy: { flex: 1, justifyContent: 'center', paddingLeft: 18, minWidth: 0 },
  todayTitleRow: { flexDirection: 'row', alignItems: 'center', gap: 7 },
  focusDot: { width: 7, height: 7, borderRadius: 4, backgroundColor: '#aab5bd' },
  focusDotActive: { backgroundColor: '#2f8f46', shadowColor: '#2f8f46', shadowOpacity: 0.3, shadowRadius: 4 },
  todayTitle: { color: '#061e35', fontSize: 19, lineHeight: 24, fontWeight: '900', letterSpacing: -0.5 },
  todayText: { color: '#657685', fontSize: 13, lineHeight: 19, marginTop: 7 },
  todayRepairAttention: { color: '#c2413b' },
  todayUnreadAttention: { color: '#2475cf' },
  todayArrow: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
  warningCard: { flexDirection: 'row', alignItems: 'center', gap: 12, borderTopWidth: 1, borderTopColor: '#e9edf0', paddingVertical: 16 },
  warningCopy: { flex: 1 },
  warningTitle: { color: '#7a480f', fontWeight: '900', fontSize: 14 },
  warningText: { color: '#8f6b3b', marginTop: 2, fontSize: 13 },
  rentSummary: { backgroundColor: '#f0f8f2', borderRadius: 16, paddingHorizontal: 18, paddingTop: 17, paddingBottom: 6 },
  rentEmpty: { color: '#657685', fontSize: 13, lineHeight: 19, paddingVertical: 10 },
  rentCaption: { color: '#2f8f46', fontSize: 10, fontWeight: '900', letterSpacing: 1.2 },
  rentHeroRow: { flexDirection: 'row', alignItems: 'baseline', gap: 12, marginTop: 4, marginBottom: 14 },
  rentHeroAmount: { flexShrink: 1, color: '#061e35', fontSize: 34, lineHeight: 42, fontWeight: '900', letterSpacing: -1.2 },
  rentPercent: { color: '#2f8f46', fontSize: 13, fontWeight: '900' },
  rentDetails: { marginTop: 11 },
  rentDetail: { minHeight: 42, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12, borderBottomWidth: 1, borderBottomColor: '#d8e8dd' },
  rentDetailLast: { borderBottomWidth: 0 },
  rentDetailLabel: { color: '#536777', fontSize: 12 },
  rentDetailValue: { color: '#102d43', fontSize: 14, fontWeight: '900' },
  rentOverdue: { color: '#c2413b' },
  propertyPaid: { color: '#2f8f46' },
  attentionProperty: { minHeight: 68, flexDirection: 'row', alignItems: 'center', gap: 12, borderBottomWidth: 1, borderBottomColor: '#e9edf0', paddingVertical: 12 },
  attentionCopy: { flex: 1, minWidth: 0 },
  attentionName: { color: '#061e35', fontSize: 16, fontWeight: '800' },
  attentionReason: { color: '#536777', fontSize: 12, lineHeight: 18, marginTop: 4 },
  progressTrack: { height: 8, borderRadius: 4, overflow: 'hidden', backgroundColor: '#dff0e3' },
  progressFill: { height: '100%', borderRadius: 4, backgroundColor: '#2f8f46' },
  dashboardSection: { borderTopWidth: 1, borderTopColor: '#dce4e8', paddingTop: 16, paddingBottom: 18 },
  borderlessSection: { borderTopWidth: 0 },
  cardHeader: { minHeight: 44, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12, marginBottom: 8 },
  cardEyebrow: { color: '#2f8f46', fontSize: 9, lineHeight: 12, fontWeight: '900', letterSpacing: 1.2 },
  cardTitle: { color: '#061e35', fontSize: 20, lineHeight: 25, fontWeight: '900', letterSpacing: -0.35 },
  rentProgressHeading: { flex: 1, minWidth: 0 },
  cardTitleWithIcon: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  cardLink: { minHeight: 44, flexDirection: 'row', alignItems: 'center', gap: 5, paddingLeft: 8 },
  cardLinkText: { color: '#647585', fontSize: 12, fontWeight: '800' },
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
  notificationDotReceived: { backgroundColor: '#2f8f46' },
  notificationDotPending: { backgroundColor: '#b76a11' },
  notificationDotFailed: { backgroundColor: '#c2413b' },
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