import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';

const workspaceSource = fs.readFileSync(new URL('../pages/landlord/dashboard.jsx', import.meta.url), 'utf8');
const overviewSource = fs.readFileSync(new URL('../pages/landlord/dashboard-overview.jsx', import.meta.url), 'utf8');
const routesSource = fs.readFileSync(new URL('../routes/MainRoutes.jsx', import.meta.url), 'utf8');
const headerSource = fs.readFileSync(new URL('../sections/landlord/dashboard/DashboardHeader.jsx', import.meta.url), 'utf8');
const calendarSource = fs.readFileSync(new URL('../pages/landlord/calendar.jsx', import.meta.url), 'utf8');

test('dashboard owns Overview, Calendar, and Tasks as component tabs on one route', () => {
  assert.match(workspaceSource, /const workspaceComponents = \{[\s\S]*overview: DashboardOverview,[\s\S]*calendar: CalendarPage,[\s\S]*tasks: TasksPage/);
  assert.match(workspaceSource, /getDashboardWorkspaceTab\(location\.pathname, location\.search\)/);
  assert.match(workspaceSource, /nextSearchParams\.set\('tab', nextTab\)/);
  assert.match(workspaceSource, /canonicalSearchParams\.set\('tab', activeTab\)/);
  assert.match(workspaceSource, /setSearchParams\(canonicalSearchParams, \{ replace: true \}\)/);
  assert.match(workspaceSource, /<ActiveComponent embedded \/>/);
});

test('dashboard component swaps use an accessible reduced-motion-aware transition', () => {
  assert.match(workspaceSource, /<AnimatePresence mode="wait" initial=\{false\}>/);
  assert.match(workspaceSource, /component=\{motion\.section\}/);
  assert.match(workspaceSource, /role="tabpanel"/);
  assert.match(workspaceSource, /prefers-reduced-motion: reduce/);
  assert.match(headerSource, /role="tablist"/);
  assert.match(headerSource, /role="tab"/);
  assert.match(headerSource, /aria-selected=\{active\}/);
  assert.match(headerSource, /tabIndex=\{active \? 0 : -1\}/);
  assert.match(headerSource, /event\.key === 'ArrowRight'/);
  assert.match(headerSource, /event\.key === 'ArrowLeft'/);
  assert.match(headerSource, /event\.key === 'Home'/);
  assert.match(headerSource, /event\.key === 'End'/);
  assert.match(headerSource, /aria-controls="dashboard-workspace-panel"/);
  assert.match(workspaceSource, /id="dashboard-workspace-panel"/);
});

test('legacy Calendar and Tasks URLs redirect into dashboard tabs', () => {
  assert.match(routesSource, /path: 'landlord\/calendar',[\s\S]{0,120}<Navigate to="\/landlord\/dashboard\?tab=calendar" replace \/>/);
  assert.match(routesSource, /path: 'landlord\/tasks',[\s\S]{0,120}<Navigate to="\/landlord\/dashboard\?tab=tasks" replace \/>/);
});

test('calendar omits the top-right Add task button while keeping contextual task actions', () => {
  const calendarHeading = calendarSource.match(/<Box sx=\{\{ mb: 2\.25 \}\}>[\s\S]*?<\/Box>\r?\n\r?\n      \{\/\* Filter bar \*\/\}/)?.[0] || '';

  assert.doesNotMatch(calendarHeading, /Add task/);
  assert.match(calendarSource, /function Sidebar\([\s\S]*?Add task[\s\S]*?function EventDetailsDrawer/);
});

test('dashboard overview omits recently viewed and retains money summary', () => {
  assert.doesNotMatch(overviewSource, /RecentlyViewedProperties/);
  assert.match(overviewSource, /<MoneySummary/);
  assert.doesNotMatch(overviewSource, /<TodaysPriorities/);
});
