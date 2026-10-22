import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';

const workspaceSource = fs.readFileSync(new URL('../pages/landlord/dashboard.jsx', import.meta.url), 'utf8');
const overviewSource = fs.readFileSync(new URL('../pages/landlord/dashboard-overview.jsx', import.meta.url), 'utf8');
const routesSource = fs.readFileSync(new URL('../routes/MainRoutes.jsx', import.meta.url), 'utf8');
const calendarSource = fs.readFileSync(new URL('../pages/landlord/calendar.jsx', import.meta.url), 'utf8');

test('dashboard defaults to the plain URL and preserves Calendar/Tasks deep links without top tabs', () => {
  assert.match(workspaceSource, /const workspaceComponents = \{[\s\S]*overview: DashboardOverview,[\s\S]*calendar: CalendarPage,[\s\S]*tasks: TasksPage/);
  assert.match(workspaceSource, /getDashboardWorkspaceTab\(location\.pathname, location\.search\)/);
  assert.match(workspaceSource, /canonicalSearchParams\.delete\('tab'\)/);
  assert.match(workspaceSource, /setSearchParams\(canonicalSearchParams, \{ replace: true \}\)/);
  assert.match(workspaceSource, /<ActiveComponent embedded \/>/);
  assert.doesNotMatch(workspaceSource, /<DashboardHeader|role="tabpanel"|aria-labelledby=\{`dashboard-/);
});

test('dashboard page swaps retain reduced-motion-aware transition without orphaned tab semantics', () => {
  assert.match(workspaceSource, /<AnimatePresence mode="wait" initial=\{false\}>/);
  assert.match(workspaceSource, /component=\{motion\.section\}/);
  assert.match(workspaceSource, /prefers-reduced-motion: reduce/);
  assert.match(workspaceSource, /id="dashboard-workspace-panel"/);
  assert.doesNotMatch(workspaceSource, /role="tabpanel"/);
});

test('Calendar has its own canonical URL while the old dashboard tab redirects there', () => {
  assert.match(routesSource, /path: 'landlord\/calendar',[\s\S]{0,130}<Dashboard \/>/);
  assert.match(routesSource, /params\.get\('tab'\) === 'calendar'[\s\S]*<Navigate to=\{`\/landlord\/calendar/);
  assert.match(workspaceSource, /location\.pathname === '\/landlord\/calendar'/);
  assert.match(routesSource, /path: 'landlord\/tasks',[\s\S]{0,120}<Navigate to="\/landlord\/dashboard\?tab=tasks" replace \/>/);
});

test('calendar omits the top-right Add task button while keeping contextual task actions', () => {
  const calendarHeading = calendarSource.match(/<Box sx=\{\{ mb: 2\.25 \}\}>[\s\S]*?<\/Box>\r?\n\r?\n      \{\/\* Filter bar \*\/\}/)?.[0] || '';

  assert.doesNotMatch(calendarHeading, /Add task/);
  assert.match(calendarSource, /function Sidebar\([\s\S]*?Add task[\s\S]*?function EventDetailsDrawer/);
});

test('dashboard has no bottom detailed-operations disclosure; optional details stay behind settings', () => {
  assert.doesNotMatch(overviewSource, /Show detailed operations|aria-controls="owner-operations"/);
  const operations = overviewSource.indexOf('<Collapse in={operationsOpen}');
  assert.ok(operations >= 0);
  assert.ok(overviewSource.indexOf('<MoneySummary', operations) > operations);
  assert.ok(overviewSource.indexOf('<RecentlyViewedProperties', operations) > operations);
  assert.doesNotMatch(overviewSource, /<TodaysPriorities/);
});
