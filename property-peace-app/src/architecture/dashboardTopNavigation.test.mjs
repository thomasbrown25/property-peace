import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import assert from 'node:assert/strict';

const source = (path) => readFileSync(new URL(path, import.meta.url), 'utf8');

test('admin keeps its own route-scoped drawer', () => {
  const layout = source('../layout/Dashboard/index.jsx');
  const drawer = source('../layout/Dashboard/Drawer/index.jsx');
  assert.match(layout, /pathname === '\/admin' \|\| pathname\.startsWith\('\/admin\/'\)/);
  assert.match(layout, /\{isAdminPortal && <MainDrawer mobileOpen=\{adminMobileMenuOpen\}/);
  assert.match(drawer, /variant="permanent"/);
  assert.match(drawer, /variant="temporary"/);
});

test('desktop layout and header reserve room for both sidebars without changing standalone onboarding', () => {
  const layout = source('../layout/Dashboard/index.jsx');
  const header = source('../layout/Dashboard/Header/index.jsx');
  const content = source('../layout/Dashboard/Header/HeaderContent/index.jsx');
  const sidebar = source('../layout/Dashboard/LandlordSidebar.jsx');
  assert.match(layout, /const isLandlordPortal = .*pathname\.startsWith\('\/landlord\/'\).*&& !isAddPropertyPage/);
  assert.match(layout, /\{isLandlordPortal && <LandlordSidebar mobileOpen=\{landlordMobileMenuOpen\}/);
  for (const text of [layout, header]) assert.match(text, /lg: `calc\(100% - \$\{LANDLORD_SIDEBAR_WIDTH\}px\)`/);
  assert.match(sidebar, /LANDLORD_SIDEBAR_WIDTH = LANDLORD_PRIMARY_SIDEBAR_WIDTH \+ LANDLORD_PROPERTY_SIDEBAR_WIDTH/);
  assert.match(sidebar, /component="aside" aria-label="Property sidebar"/);
  assert.match(sidebar, /left: LANDLORD_PRIMARY_SIDEBAR_WIDTH/);
  assert.match(sidebar, /bgcolor: 'background.paper'/);
  assert.match(sidebar, /<Logo darkSurface[\s\S]*?to="\/landlord\/dashboard"/);
  assert.match(content, /aria-label="Open landlord navigation"/);
  assert.doesNotMatch(content, /calc\(100% \+|lg: `-\$/);
});

test('outer navigation has the requested sections and an expandable More menu', () => {
  const sidebar = source('../layout/Dashboard/LandlordSidebar.jsx');
  const primary = source('../utils/landlordPrimaryNavigation.js');
  for (const label of ['Home', 'Tenants', 'Maintenance', 'Finances', 'Documents']) assert.ok(primary.includes(`label: '${label}'`));
  assert.doesNotMatch(primary, /label: 'Properties'/);
  assert.match(sidebar, /landlordPrimaryLinks\.map/);
  assert.match(sidebar, /primary="More"/);
  assert.match(sidebar, /aria-expanded=\{moreOpen\}/);
  assert.match(sidebar, /landlordMoreLinks\.map/);
  assert.doesNotMatch(sidebar, />Workspace<\/Typography>|PORTFOLIO CONVERSATIONS|fresh conversation/);
});

test('inner property navigation always searches the full portfolio, with real thumbnails and links', () => {
  const sidebar = source('../layout/Dashboard/LandlordSidebar.jsx');
  assert.match(sidebar, /useFetchProperties\(\)/);
  assert.match(sidebar, /visibleProperties = propertyRows\.filter/);
  assert.match(sidebar, /property\.name} \$\{property\.address/);
  assert.doesNotMatch(sidebar, /MAX_SIDEBAR_PROPERTIES|hasMoreProperties/);
  assert.match(sidebar, /placeholder="Search properties" value=\{search\}/);
  assert.match(sidebar, /'aria-label': 'Search properties'/);
  assert.match(sidebar, /\/landlord\/property\/\$\{encodeURIComponent\(property\.id\)\}/);
  assert.match(sidebar, /component="img" src=\{property\.image\}/);
  assert.match(sidebar, /aria-current=\{isActive \? 'page' : undefined\}/);
  assert.match(sidebar, /primary="All properties"/);
  assert.match(sidebar, /aria-label="Add property"/);
  assert.match(sidebar, /No matching properties\./);
  assert.match(sidebar, /Loading properties…/);
  assert.match(sidebar, /Properties could not be loaded\./);
  assert.match(sidebar, /No properties yet\./);
  assert.match(sidebar, /role="status"/);
});

test('property list preserves readable rows, visible scrolling and conditional overflow fade', () => {
  const sidebar = source('../layout/Dashboard/LandlordSidebar.jsx');
  assert.match(sidebar, /minHeight: 56/);
  assert.match(sidebar, /overflowY: 'scroll', scrollbarWidth: 'thin'/);
  assert.match(sidebar, /onScroll=\{updateOverflow\}/);
  assert.match(sidebar, /ResizeObserver\(updateOverflow\)/);
  assert.match(sidebar, /observer\.disconnect\(\)/);
  assert.match(sidebar, /\{hasMoreBelow && <Box aria-hidden="true"/);
});

test('sidenav preserves property recency, account scope, and subscription gating', () => {
  const sidebar = source('../layout/Dashboard/LandlordSidebar.jsx');
  assert.match(sidebar, /readPropertyVisitDates\(user\)/);
  assert.match(sidebar, /sortPropertiesByLastVisit\([\s\S]*?visitDates\)/);
  for (const event of ['PROPERTY_VISITED_EVENT', "'storage'"]) {
    assert.ok(sidebar.includes(`window.addEventListener(${event}, refreshVisits)`));
    assert.ok(sidebar.includes(`window.removeEventListener(${event}, refreshVisits)`));
  }
  assert.match(sidebar, /recordRecentlyViewedProperty\(property\.id, user\)/);
  assert.match(sidebar, /disabled=\{trialExpired\}/);
});

test('mobile keeps both menus accessible without reserving desktop sidebar space', () => {
  const sidebar = source('../layout/Dashboard/LandlordSidebar.jsx');
  const content = source('../layout/Dashboard/Header/HeaderContent/index.jsx');
  assert.match(sidebar, /variant="temporary" open=\{mobileOpen\} onClose=\{onMobileClose\}/);
  assert.match(sidebar, /maxWidth: '90vw'/);
  assert.match(sidebar, /minHeight: 0, bgcolor: 'background.paper' }}>\{propertyNavigation\}/);
  for (const utility of ['MobileSearch', 'Search', 'Message', 'Notification', 'Profile']) assert.ok(content.includes(`<${utility} />`));
  assert.doesNotMatch(content, /<TopNavigation\s*\/>|<LandlordPrimaryNavigation\s*\/>/);
});
