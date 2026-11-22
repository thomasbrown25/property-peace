import type { IconsaxIconName } from '@property-peace/shared/iconsax-icons';

export type MainAudience = 'landlord' | 'tenant' | 'unsupported';

export type MainTabName =
  | 'Dashboard'
  | 'Team'
  | 'Reports'
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
  | 'TeamScreen'
  | 'ReportsScreen'
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
    { name: 'Team', component: 'TeamScreen' },
    { name: 'Checklists', component: 'ChecklistsNavigator' },
    { name: 'Reports', component: 'ReportsScreen' },
    { name: 'Messages', component: 'MessagesNavigator' },
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

const icons: Partial<Record<MainTabName, IconsaxIconName>> = {
  Dashboard: 'home',
  Team: 'team',
  Checklists: 'checklists',
  Reports: 'reports',
  Messages: 'messages',
  Payments: 'payments',
  Leases: 'leases',
  Maintenance: 'maintenance',
  Settings: 'settings',
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

export function mainTabIconName(name: string) {
  return icons[name as MainTabName];
}

export function dockSplitIndex(visibleCount: number) {
  return Math.ceil(visibleCount / 2);
}
