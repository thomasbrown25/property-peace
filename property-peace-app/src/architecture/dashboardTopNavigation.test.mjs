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

test('tenant top bar links to tenant support immediately after Notifications at both widths', () => {
  const header = source('../layout/Dashboard/Header/HeaderContent/index.jsx');
  const mobile = source('../layout/Dashboard/Header/HeaderContent/MobileSection.jsx');
  const routes = source('../routes/MainRoutes.jsx');

  const actions = header.slice(header.indexOf("justifyContent: 'flex-end'"));
  assert.match(actions, /<Message \/>\s*<Notification \/>\s*\{tenantPortal && \(\s*<Tooltip title="Support">\s*<IconButton component=\{Link\} to="\/tenant\/help" aria-label="Support"/);
  assert.match(actions, /<\/Tooltip>\s*\)\}\s*\{!downMD && \(/);
  assert.match(header, /\{downMD && <MobileSection \/>\}/);
  assert.doesNotMatch(mobile, /<(?:Message|Notification)\b/);
  assert.match(routes, /path: 'tenant\/help',\s*element: <Help \/>/);
});

test('landlord shell reserves one green property rail rather than two sidebars', () => {
  const layout = source('../layout/Dashboard/index.jsx');
  const header = source('../layout/Dashboard/Header/index.jsx');
  const sidebar = source('../layout/Dashboard/LandlordSidebar.jsx');
  assert.match(sidebar, /LANDLORD_SIDEBAR_WIDTH = 260/);
  for (const text of [layout, header]) assert.match(text, /lg: `calc\(100% - \$\{LANDLORD_SIDEBAR_WIDTH\}px\)`/);
  assert.doesNotMatch(sidebar, /LANDLORD_PROPERTY_SIDEBAR_WIDTH|LANDLORD_PRIMARY_SIDEBAR_WIDTH|aria-label="Property sidebar"|\{navigation\}/);
  assert.match(sidebar, /const sidebarBackground = brand\.forest/);
  assert.match(source('../themes/brand.js'), /forest: '#102C29'/);
  assert.equal((sidebar.match(/bgcolor: sidebarBackground/g) || []).length, 4);
  assert.match(sidebar, /linear-gradient\(transparent, \$\{sidebarBackground\}\)/);
  assert.match(sidebar, /<Logo darkSurface[\s\S]*?to="\/landlord\/dashboard"/);
});

test('desktop top bar has ordered landlord links, More, and icon search', () => {
  const content = source('../layout/Dashboard/Header/HeaderContent/index.jsx');
  const primary = source('../layout/Dashboard/Header/HeaderContent/LandlordPrimaryNavigation.jsx');
  const more = source('../layout/Dashboard/Header/HeaderContent/TopNavigation.jsx');
  assert.match(content, /landlordPortal && <LandlordPrimaryNavigation \/>/);
  assert.match(content, /gridTemplateColumns: 'minmax\(0, 1fr\) auto minmax\(max-content, 1fr\)'/);
  assert.match(content, /gridTemplateAreas: '"\. navigation actions"'/);
  assert.match(content, /gap: landlordPortal \? \{ xs: 0\.5, sm: 0\.75, xl: 1\.25 \}/);
  assert.match(content, /!hasTenantRole && <MobileSearch \/>[\s\S]*?<Message \/>/);
  assert.doesNotMatch(content, /<Search \/>/);
  assert.match(source('../layout/Dashboard/Header/HeaderContent/MobileSearch.jsx'), /<AppIcon name="magnifier" \/>/);
  assert.match(source('../layout/Dashboard/Header/HeaderContent/Message.jsx'), /<AppIcon name=\{isAdmin \? 'support' : 'chatBubbles'\} \/>/);
  assert.match(source('../layout/Dashboard/Header/HeaderContent/Notification.jsx'), /<AppIcon name="notification" \/>/);
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
    'placeholder="Search properties"', "'aria-label': 'Search properties'", '<AppIcon name="properties" />',
    'component="span" variant="caption"', "sx: { color: '#FFFFFF' }", 'aria-label="Add property"',
    'component="img" src={property.image}', 'No matching properties.',
    'ResizeObserver(updateOverflow)',
    "overflowY: 'auto'", 'maxWidth: \'90vw\'']) assert.ok(sidebar.includes(token), token);
  assert.match(sidebar, /<Box component=\{Link\} to="\/landlord\/properties"/);
  assert.doesNotMatch(sidebar, /primary="All properties"/);
  assert.match(sidebar, /\/landlord\/property\/\$\{encodeURIComponent\(property\.id\)\}/);
  assert.match(sidebar, /variant="temporary" open=\{mobileOpen\} onClose=\{onMobileClose\}/);
  assert.match(sidebar, /aria-label="Landlord pages"/);
  assert.match(sidebar, /landlordPrimaryLinks\.map/);
  assert.match(sidebar, /landlordMoreLinks\.filter\(\(\{ label \}\) => label !== 'Settings'\)\.map/);
  assert.match(sidebar, /renderPropertyNavigation\('desktop'\)/);
  assert.match(sidebar, /renderPropertyNavigation\('mobile'\)/);
  assert.match(sidebar, /aria-label="Search properties" title="Search properties"[\s\S]*?<AppIcon name="search" \/>[\s\S]*?aria-label="Add property"/);
  assert.match(sidebar, /\{!loading && !isEmptyPortfolio && <Collapse in=\{searchOpen\} timeout=\{reducedMotion \? 0 : 240\} unmountOnExit/);
  assert.match(sidebar, /onKeyDown=\{\(event\) => \{ if \(event\.key === 'Escape'\)/);
  assert.match(sidebar, /disabled=\{trialExpired\}/);
  assert.match(sidebar, /borderBottom: '1px solid', borderColor: 'rgba\(255, 255, 255, 0\.14\)'/);
  assert.match(sidebar, /borderTop: '1px solid rgba\(255, 255, 255, 0\.14\)'[\s\S]*?to="\/landlord\/settings"[\s\S]*?primary="Settings"/);
  assert.match(sidebar, /<AppIcon name="settings" \/>/);
});

test('the property rail keeps the count and rows hidden until the current list is ready', () => {
  const sidebar = source('../layout/Dashboard/LandlordSidebar.jsx');
  assert.match(sidebar, /selectPropertiesLoadStatus\(state, organizationId\)/);
  assert.match(sidebar, /const propertiesReady = propertiesStatus === 'ready'/);
  assert.match(sidebar, /properties=\{propertiesReady \? visibleProperties : \[\]\} total=\{propertiesReady \? propertyRows\.length : null\}/);
  assert.match(sidebar, /loading=\{propertiesStatus === 'pending'\}/);
  assert.match(sidebar, /total != null && <Typography component="span"/);
  assert.match(sidebar, /\{!loading && !isEmptyPortfolio && <Box[^\n]*\n\s*<IconButton ref=\{searchButtonRef\}/);
  assert.match(sidebar, /status=\{propertiesStatus === 'failed' \? 'Failed to load properties' : propertiesReady && propertyRows\.length \? 'No matching properties\.' : null\}/);
  assert.match(sidebar, /!properties\.length && status && <Typography role="status"/);
});

test('the property rail offers to add a property when the loaded portfolio is empty', () => {
  const sidebar = source('../layout/Dashboard/LandlordSidebar.jsx');
  assert.match(sidebar, /const isEmptyPortfolio = total === 0/);
  assert.match(sidebar, /const addPropertyPath = '\/landlord\/properties\/add'/);
  assert.match(sidebar, /\{isEmptyPortfolio && \([\s\S]*?No properties yet[\s\S]*?<Button component=\{Link\} to=\{addPropertyPath\}[\s\S]*?disabled=\{disabled\} onClick=\{onNavigate\}[\s\S]*?>\s*Add property\s*<\/Button>/);
});
