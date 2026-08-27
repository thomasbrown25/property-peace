import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';

const overviewSource = fs.readFileSync(new URL('../pages/landlord/dashboard-overview.jsx', import.meta.url), 'utf8');
const maintenanceSource = fs.readFileSync(new URL('../sections/landlord/dashboard/Maintenance.jsx', import.meta.url), 'utf8');
const applicationsSource = fs.readFileSync(new URL('../sections/landlord/dashboard/Applications.jsx', import.meta.url), 'utf8');
const dashboardSelectorSource = fs.readFileSync(new URL('../store/dashboard/dashboard.selector.js', import.meta.url), 'utf8');

test('dashboard places Maintenance and Applications side by side beneath Portfolio', () => {
  const portfolioIndex = overviewSource.indexOf('<Portfolio');
  const maintenanceIndex = overviewSource.indexOf('<Maintenance');
  const applicationsIndex = overviewSource.indexOf('<Applications');

  assert.ok(portfolioIndex >= 0);
  assert.ok(maintenanceIndex > portfolioIndex);
  assert.ok(applicationsIndex > maintenanceIndex);
  assert.match(overviewSource, /gridArea:\s*'maintenance'[\s\S]*?<Maintenance/);
  assert.match(overviewSource, /gridArea:\s*'applications'[\s\S]*?<Applications/);
  assert.match(
    overviewSource,
    /payments payments payments payments maintenance maintenance maintenance maintenance applications applications applications applications/
  );
  assert.match(overviewSource, /minHeight: 58/);
});

test('Maintenance uses dashboard data and distinguishes loading, failure, empty, and populated states', () => {
  assert.match(overviewSource, /requests=\{dashboardSummaryData\?\.maintenanceRequests\?\.maintenanceRequests \|\| \[\]\}/);
  assert.match(overviewSource, /hasError=\{Boolean\(dashboardError\)\}/);
  assert.match(dashboardSelectorSource, /selectDashboardError/);
  assert.match(maintenanceSource, /slice\(0, 3\)/);
  assert.match(maintenanceSource, /role="status"/);
  assert.match(maintenanceSource, /role="alert"/);
  assert.match(maintenanceSource, /No current maintenance requests/);
});

test('Applications uses scoped real API data and reports its asynchronous state', () => {
  assert.match(applicationsSource, /applicationAPI\.getApplicationsByProperty\(propertyId\)/);
  assert.match(applicationsSource, /applicationAPI\.getApplicationsByLandlord\(userId\)/);
  assert.match(applicationsSource, /currentOrganization/);
  assert.match(applicationsSource, /const scopeKey =/);
  assert.match(applicationsSource, /const visibleApplications = hasCurrentScope \? applications : \[\]/);
  assert.match(applicationsSource, /slice\(0, 3\)/);
  assert.match(applicationsSource, /onLoadingChange\?\.\(displayLoading\)/);
  assert.match(applicationsSource, /role="status"/);
  assert.match(applicationsSource, /role="alert"/);
});
