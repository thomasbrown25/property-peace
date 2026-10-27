export type MainAudience = 'landlord' | 'tenant' | 'unsupported';

export type MainTabName =
  | 'Dashboard'
  | 'Properties'
  | 'Checklists'
  | 'Maintenance'
  | 'Payments'
  | 'Marketing'
  | 'Messages'
  | 'Notifications'
  | 'Tenants'
  | 'Leases'
  | 'Settings';

export type MainTabComponentName =
  | 'DashboardScreen'
  | 'PropertiesNavigator'
  | 'ChecklistsNavigator'
  | 'MaintenanceNavigator'
  | 'MarketingNavigator'
  | 'TenantMaintenanceNavigator'
  | 'TenantPaymentsScreen'
  | 'TenantLeasesNavigator'
  | 'TenantsNavigator'
  | 'MessagesNavigator'
  | 'NotificationsScreen'
  | 'SettingsScreen';

export type VisibleMainTab = {
  name: MainTabName;
  component: MainTabComponentName;
  label?: string;
};

export type MainTabComponentRegistry<T> = Record<MainTabComponentName, T>;
export type ResolvedVisibleMainTab<T> = Omit<VisibleMainTab, 'component'> & {
  component: T;
};

const visibleTabsByAudience: Record<MainAudience, readonly VisibleMainTab[]> = {
  landlord: [
    { name: 'Dashboard', component: 'DashboardScreen', label: 'Home' },
    { name: 'Properties', component: 'PropertiesNavigator' },
    { name: 'Tenants', component: 'TenantsNavigator' },
    { name: 'Marketing', component: 'MarketingNavigator' },
    { name: 'Notifications', component: 'NotificationsScreen' },
  ],
  tenant: [
    { name: 'Payments', component: 'TenantPaymentsScreen' },
    { name: 'Leases', component: 'TenantLeasesNavigator' },
    { name: 'Maintenance', component: 'TenantMaintenanceNavigator' },
    { name: 'Messages', component: 'MessagesNavigator' },
    { name: 'Settings', component: 'SettingsScreen' },
  ],
  unsupported: [],
};

const icons: Partial<Record<MainTabName, { active: string; inactive: string }>> = {
  Dashboard: { active: 'home', inactive: 'home-outline' },
  Properties: { active: 'business', inactive: 'business-outline' },
  Checklists: { active: 'clipboard', inactive: 'clipboard-outline' },
  Maintenance: { active: 'construct', inactive: 'construct-outline' },
  Payments: { active: 'card', inactive: 'card-outline' },
  Leases: { active: 'document-text', inactive: 'document-text-outline' },
  Marketing: { active: 'megaphone', inactive: 'megaphone-outline' },
  Tenants: { active: 'people', inactive: 'people-outline' },
  Messages: { active: 'chatbubble-ellipses', inactive: 'chatbubble-ellipses-outline' },
  Notifications: { active: 'notifications', inactive: 'notifications-outline' },
  Settings: { active: 'settings', inactive: 'settings-outline' },
};

export function visibleMainTabsForAudience(audience: MainAudience): readonly VisibleMainTab[] {
  return visibleTabsByAudience[audience];
}

export function resolveVisibleMainTabs<T>(
  audience: MainAudience,
  components: MainTabComponentRegistry<T>,
): readonly ResolvedVisibleMainTab<T>[] {
  return visibleMainTabsForAudience(audience).map((tab) => ({
    ...tab,
    component: components[tab.component],
  }));
}

export function mainTabIconNames(name: string) {
  return icons[name as MainTabName];
}

export function dockSplitIndex(visibleCount: number) {
  return Math.ceil(visibleCount / 2);
}
