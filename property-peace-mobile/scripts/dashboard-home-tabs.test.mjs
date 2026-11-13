import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const dashboard = readFileSync(new URL('../src/screens/landlord/DashboardScreen.tsx', import.meta.url), 'utf8');
const calendar = readFileSync(new URL('../src/screens/landlord/CalendarScreen.tsx', import.meta.url), 'utf8');
const directory = readFileSync(new URL('../src/screens/landlord/HomeDirectoryTab.tsx', import.meta.url), 'utf8');

test('home tabs sit between the top navigation and collection rail', () => {
  const topNav = dashboard.indexOf('<View style={[styles.topBar');
  const tabs = dashboard.indexOf('<View style={[styles.homeTabBar');
  const rail = dashboard.indexOf('<PropertyCollectionRail');
  assert.ok(topNav < tabs && tabs < rail);
  assert.match(dashboard, /\['Dashboard', 'Calendar', 'Properties', 'Rent', 'Tenants', 'Maintenances', 'Leases'\]/);
  assert.match(dashboard, /accessibilityState=\{\{ selected: activeHomeTab === tab \}\}/);
});

test('dashboard sections render only on their respective home tabs', () => {
  for (const [tab, heading] of [['Rent', 'rentProgressHeading'], ['Properties', 'home-outline'], ['Maintenances', 'maintenanceToolbar']]) {
    const marker = tab === 'Rent' ? `{activeHomeTab === 'Rent' && (` : `{activeHomeTab === '${tab}' && <DashboardSection borderless>`;
    const start = dashboard.indexOf(marker);
    assert.ok(start >= 0, `${tab} tab section missing`);
    const section = dashboard.slice(start);
    assert.ok(section.slice(0, section.indexOf('</DashboardSection>')).includes(heading), `${tab} section missing ${heading}`);
  }
  assert.match(dashboard, /activeHomeTab === 'Dashboard' && <>[\s\S]*?<PropertyCollectionRail/);
  assert.match(dashboard, /activeHomeTab !== 'Dashboard' && <ScrollView/);
  assert.doesNotMatch(dashboard, /Recent activity is unavailable|<Text style=\{styles\.cardEyebrow\}>RECENT/);
  assert.match(dashboard, /activeHomeTab === 'Calendar' \? <CalendarScreen embedded todayAtAGlance=\{todayAtAGlance\}/);
  assert.equal((dashboard.match(/Today at a glance/g) || []).length, 1);
});

test('tenant and lease tabs remain on Home with full searchable directories and add actions', () => {
  assert.doesNotMatch(dashboard, /if \(tab === 'Tenants' \|\| tab === 'Leases'\)/);
  assert.match(dashboard, /\(activeHomeTab === 'Tenants' \|\| activeHomeTab === 'Leases'\) && <DashboardSection borderless>/);
  assert.match(dashboard, /<HomeDirectoryTab key=\{`\$\{organizationId\}:\$\{activeHomeTab\}`\}/);
  assert.match(directory, /kind === 'Tenants' \? TenantAPI\.getTenants\(\) : LeaseAPI\.getLeases\(\)/);
  assert.match(directory, /kind === 'Tenants' \? 'AddTenant' : 'AddLease'/);
  assert.match(directory, /navigate\('Tenants', 'TenantDetail'/);
  assert.match(directory, /navigate\('Leases', 'LeaseDetail'/);
  assert.match(directory, /items\.length === 0/);
  assert.doesNotMatch(directory, /\.slice\(0,/);
});

test('calendar tab preserves the calendar grid, agenda, and add-task action', () => {
  assert.match(calendar, /\{todayAtAGlance\}[\s\S]*?<View style=\{styles\.monthHeader\}>/);
  assert.match(calendar, /\{!embedded && <View style=\{\[styles\.header/);
  assert.match(calendar, /embedded && <Pressable onPress=\{\(\) => setAddingTask\(true\)\}/);
  assert.match(calendar, /<AddCalendarTaskModal visible=\{addingTask\}/);
  assert.match(calendar, /eventsByDay\.get\(key\)/);
  assert.match(calendar, /dayEvents\.map\(event/);
});
