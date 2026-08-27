export type MainAudience = 'landlord' | 'tenant' | 'unsupported';

export type MainTabName =
  | 'Dashboard'
  | 'Properties'
  | 'Checklists'
  | 'Maintenance'
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
  | 'TenantMaintenanceNavigator'
  | 'MessagesNavigator'
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
    { name: 'Checklists', component: 'ChecklistsNavigator' },
    { name: 'Maintenance', component: 'MaintenanceNavigator' },
    { name: 'Messages', component: 'MessagesNavigator' },
  ],
  tenant: [
    { name: 'Maintenance', component: 'TenantMaintenanceNavigator', label: 'Repairs' },
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
  Messages: { active: 'chatbubble-ellipses', inactive: 'chatbubble-ellipses-outline' },
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
