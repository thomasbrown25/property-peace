import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';

const dashboardSource = fs.readFileSync(new URL('../pages/landlord/dashboard-overview.jsx', import.meta.url), 'utf8');
const propertySource = fs.readFileSync(new URL('../pages/landlord/property.jsx', import.meta.url), 'utf8');
const componentSource = fs.readFileSync(
  new URL('../sections/landlord/dashboard/RecentlyViewedProperties.jsx', import.meta.url),
  'utf8'
);

test('recently viewed is mounted below quick actions and before payments', () => {
  assert.match(dashboardSource, /readRecentlyViewedPropertyIds|resolveRecentlyViewedProperties/);
  assert.match(dashboardSource, /<RecentlyViewedProperties[\s\S]*?properties=\{recentlyViewedProperties\}/);

  const quickActionsIndex = dashboardSource.indexOf('Quick actions');
  const recentlyViewedIndex = dashboardSource.indexOf('<RecentlyViewedProperties');
  const paymentsIndex = dashboardSource.indexOf('<PaymentsCard />', recentlyViewedIndex);

  assert.ok(quickActionsIndex >= 0 && quickActionsIndex < recentlyViewedIndex);
  assert.ok(paymentsIndex > recentlyViewedIndex);
  assert.match(dashboardSource, /<MoneySummary/);
});

test('recently viewed header typography matches Money Summary', () => {
  assert.match(componentSource, /<Typography variant="h5" fontWeight=\{700\} sx=\{\{ color: 'text\.primary', whiteSpace: 'nowrap' \}\}>\s*Recently viewed/);
});

test('recently viewed header does not render a View all action', () => {
  assert.doesNotMatch(componentSource, /View all/);
  assert.doesNotMatch(componentSource, /secondary=\{/);
  assert.doesNotMatch(componentSource, /ArrowRightOutlined/);
});

test('property detail records real scoped view history', () => {
  assert.match(propertySource, /recordRecentlyViewedProperty\(selectedPropertyId, currentUser\)/);
  assert.match(propertySource, /String\(selectedPropertyId\) === String\(propertyId\)/);
});

test('recently viewed rows use real images, fallback imagery, dividers, and occupancy chips', () => {
  assert.match(componentSource, /mainImageUrl/);
  assert.match(componentSource, /placeholder-house\.png/);
  assert.match(componentSource, /onError=\{\(\) => setSource\(placeholderImage\)\}/);
  assert.match(componentSource, /borderBottom:/);
  assert.match(componentSource, /'Occupied'/);
  assert.match(componentSource, /'Vacant'/);
  assert.doesNotMatch(componentSource, /Steadily/i);
});

test('recently viewed uses a compact row layout for the narrower dashboard column', () => {
  assert.match(componentSource, /width: 68,\s*height: 52/);
  assert.match(componentSource, /px: 2,\s*py: 1\.45/);
  assert.doesNotMatch(componentSource, /display: \{ xs: 'none', sm: 'block' \}/);
});
