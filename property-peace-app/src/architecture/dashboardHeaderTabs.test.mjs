import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';

const source = fs.readFileSync(new URL('../sections/landlord/dashboard/DashboardHeader.jsx', import.meta.url), 'utf8');

test('selected dashboard workspace tab uses the navy brand color and underline without a green fill', () => {
  assert.match(source, /const dashboardNavy = '#061e35';/);
  assert.match(source, /color: active \? dashboardNavy : 'text\.secondary'/);
  assert.match(source, /borderBottom: '3px solid'/);
  assert.match(source, /borderBottomColor: active \? dashboardNavy : 'transparent'/);
  assert.match(source, /backgroundColor: 'transparent'/);
  assert.doesNotMatch(source, /color: active \? 'success\.(?:main|dark)'/);
  assert.doesNotMatch(source, /bgcolor: active \? 'success\.(?:main|dark)'/);
});

test('dashboard workspace tabs use a light full-width baseline behind the selected underline', () => {
  assert.match(source, /width: '100%'/);
  assert.match(source, /'&::after': \{/);
  assert.match(source, /right: 0,[\s\S]*bottom: 0,[\s\S]*left: 0,[\s\S]*height: '1px'/);
  assert.match(source, /bgcolor: alpha\(theme\.palette\.text\.primary, theme\.palette\.mode === 'dark' \? 0\.22 : 0\.12\)/);
  assert.match(source, /position: 'relative',[\s\S]*zIndex: 1,[\s\S]*borderBottom: '3px solid'/);
});

test('dashboard reminder card uses a solid navy date panel and navy calendar action', () => {
  assert.match(source, /export function DashboardReminderCard/);
  assert.match(source, /bgcolor: dashboardNavy/);
  assert.match(source, /View calendar/);
  assert.match(source, /color: dashboardNavy/);
  assert.doesNotMatch(source, /linear-gradient\(145deg, #061e35/);
  assert.doesNotMatch(source, /color: 'success\.dark'/);
});

test('dashboard reminder card is mounted in the left column above account setup', () => {
  const dashboardSource = fs.readFileSync(new URL('../pages/landlord/dashboard-overview.jsx', import.meta.url), 'utf8');
  const leftColumn = dashboardSource.indexOf('<Grid size={{ xs: 12, md: 4 }}');
  const reminderCard = dashboardSource.indexOf('<DashboardReminderCard reminders={todayReminders} />', leftColumn);
  const setupCard = dashboardSource.indexOf('{showSetupCard && (', leftColumn);
  const rightColumn = dashboardSource.indexOf('<Grid size={{ xs: 12, md: 8 }}', leftColumn);

  assert.ok(leftColumn >= 0);
  assert.ok(reminderCard > leftColumn && reminderCard < rightColumn);
  assert.ok(setupCard > reminderCard && setupCard < rightColumn);
});

test('needs your attention is not mounted in the dashboard main column', () => {
  const dashboardSource = fs.readFileSync(new URL('../pages/landlord/dashboard-overview.jsx', import.meta.url), 'utf8');
  assert.doesNotMatch(dashboardSource, /TodaysPriorities/);
});
