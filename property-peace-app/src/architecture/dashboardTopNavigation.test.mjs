import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import assert from 'node:assert/strict';

const source = (path) => readFileSync(new URL(path, import.meta.url), 'utf8');

test('admin drawer and standalone property onboarding remain route-scoped', () => {
  const layout = source('../layout/Dashboard/index.jsx');
  const drawer = source('../layout/Dashboard/Drawer/index.jsx');
  assert.match(layout, /pathname === '\/admin' \|\| pathname\.startsWith\('\/admin\/'\)/);
  assert.match(layout, /\{isAdminPortal && <MainDrawer mobileOpen=\{adminMobileMenuOpen\}/);
  assert.match(layout, /const isLandlordPortal = .*pathname\.startsWith\('\/landlord\/'\).*&& !isAddPropertyPage/);
  assert.match(layout, /\{isLandlordPortal && <LandlordSidebar mobileOpen=\{landlordMobileMenuOpen\}/);
  assert.match(drawer, /variant="permanent"/);
  assert.match(drawer, /variant="temporary"/);
});

test('landlord shell reserves one green property rail rather than two sidebars', () => {
  const layout = source('../layout/Dashboard/index.jsx');
  const header = source('../layout/Dashboard/Header/index.jsx');
  const sidebar = source('../layout/Dashboard/LandlordSidebar.jsx');
  assert.match(sidebar, /LANDLORD_SIDEBAR_WIDTH = 260/);
  for (const text of [layout, header]) assert.match(text, /lg: `calc\(100% - \$\{LANDLORD_SIDEBAR_WIDTH\}px\)`/);
  assert.doesNotMatch(sidebar, /LANDLORD_PROPERTY_SIDEBAR_WIDTH|LANDLORD_PRIMARY_SIDEBAR_WIDTH|aria-label="Property sidebar"|\{navigation\}/);
  assert.match(sidebar, /bgcolor: brand\.forest/);
  assert.match(sidebar, /<Logo darkSurface[\s\S]*?to="\/landlord\/dashboard"/);
});

test('desktop top bar has ordered landlord links, More, and icon search', () => {
  const content = source('../layout/Dashboard/Header/HeaderContent/index.jsx');
  const primary = source('../layout/Dashboard/Header/HeaderContent/LandlordPrimaryNavigation.jsx');
  const more = source('../layout/Dashboard/Header/HeaderContent/TopNavigation.jsx');
  assert.match(content, /landlordPortal && <LandlordPrimaryNavigation \/>/);
  assert.match(content, /!hasTenantRole && <MobileSearch \/>[\s\S]*?<Message \/>/);
  assert.doesNotMatch(content, /<Search \/>/);
  assert.match(primary, /landlordPrimaryLinks\.map/);
  assert.match(primary, /<TopNavigation \/>/);
  assert.match(primary, /display: \{ xs: 'none', lg: 'flex' \}/);
  assert.match(primary, /aria-disabled=\{trialExpired \|\| undefined\}/);
  assert.match(more, /groupLandlordMoreNavigation\(landlordPagesForInventory/);
  assert.match(more, /primaryDestinations\.has\(item\.url\)/);
  assert.doesNotMatch(more, /const tenantsItem/);
});

test('property rail snapshots visit order until page reload, while still recording clicks for the next load', () => {
  const sidebar = source('../layout/Dashboard/LandlordSidebar.jsx');
  assert.match(sidebar, /const sidebarVisitDates = new Map\(\)/);
  assert.match(sidebar, /if \(!sidebarVisitDates\.has\(scope\)\) sidebarVisitDates\.set\(scope, readPropertyVisitDates\(user\)\)/);
  assert.match(sidebar, /const visitDates = visitDatesForSidebar\(user\)/);
  assert.match(sidebar, /recordRecentlyViewedProperty\(property\.id, user\)/);
  assert.doesNotMatch(sidebar, /addEventListener\((?:PROPERTY_VISITED_EVENT|'storage')/);
});

test('properties are searchable, accessible, and scroll in the single green rail', () => {
  const sidebar = source('../layout/Dashboard/LandlordSidebar.jsx');
  for (const token of ['useFetchProperties()', 'visibleProperties = propertyRows.filter', 'sortPropertiesByLastVisit',
    'readPropertyVisitDates(user)', 'recordRecentlyViewedProperty(property.id, user)',
    'placeholder="Search properties"', "'aria-label': 'Search properties'", '<HomeOutlined aria-hidden="true" />',
    'component="span" variant="caption"', "sx: { color: '#FFFFFF' }", 'aria-label="Add property"',
    'component="img" src={property.image}', 'No matching properties.',
    'Loading properties…', 'Properties could not be loaded.', 'No properties yet.', 'ResizeObserver(updateOverflow)',
    "overflowY: 'auto'", 'maxWidth: \'90vw\'']) assert.ok(sidebar.includes(token), token);
  assert.match(sidebar, /<Box component=\{Link\} to="\/landlord\/properties"/);
  assert.doesNotMatch(sidebar, /primary="All properties"/);
  assert.match(sidebar, /\/landlord\/property\/\$\{encodeURIComponent\(property\.id\)\}/);
  assert.match(sidebar, /variant="temporary" open=\{mobileOpen\} onClose=\{onMobileClose\}/);
  assert.match(sidebar, /aria-label="Landlord pages"/);
  assert.match(sidebar, /landlordPrimaryLinks\.map/);
  assert.match(sidebar, /landlordMoreLinks\.map/);
  assert.match(sidebar, /renderPropertyNavigation\(\)/);
  assert.match(sidebar, /disabled=\{trialExpired\}/);
});
