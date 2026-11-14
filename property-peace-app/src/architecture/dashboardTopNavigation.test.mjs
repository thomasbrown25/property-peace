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

test('landlord routes use a persistent desktop sidenav and a compact temporary drawer', () => {
  const layout = source('../layout/Dashboard/index.jsx');
  const header = source('../layout/Dashboard/Header/index.jsx');
  const content = source('../layout/Dashboard/Header/HeaderContent/index.jsx');
  const sidebar = source('../layout/Dashboard/LandlordSidebar.jsx');
  assert.match(layout, /const isLandlordPortal = .*pathname\.startsWith\('\/landlord\/'\).*&& !isAddPropertyPage/);
  assert.match(layout, /\{isLandlordPortal && <LandlordSidebar mobileOpen=\{landlordMobileMenuOpen\}/);
  assert.match(layout, /isLandlordPortal \? \{ xs: '100%', lg: `calc\(100% - \$\{LANDLORD_SIDEBAR_WIDTH\}px\)` \}/);
  assert.match(header, /landlordPortal \? \{ xs: '100%', lg: `calc\(100% - \$\{LANDLORD_SIDEBAR_WIDTH\}px\)` \}/);
  assert.match(content, /aria-label="Open landlord navigation"/);
  assert.doesNotMatch(content, /<LandlordPrimaryNavigation\s*\/>/);
  assert.match(sidebar, /variant="permanent"/);
  assert.match(sidebar, /variant="temporary"/);
  assert.match(sidebar, /aria-label="Landlord navigation"/);
  assert.match(sidebar, /<Logo reverse[\s\S]*?to="\/landlord\/dashboard"/);
  assert.match(content, /display: landlordPortal \? \{ xs: 'flex', lg: 'none' \}/);
  assert.match(sidebar, /onClose=\{onMobileClose\}/);
});

test('sidenav shows primary links without a workspace heading and real property links with thumbnails', () => {
  const sidebar = source('../layout/Dashboard/LandlordSidebar.jsx');
  const primary = source('../utils/landlordPrimaryNavigation.js');
  for (const label of ['Dashboard', 'Calendar', 'Listings', 'Bookings']) assert.ok(primary.includes(`label: '${label}'`));
  assert.match(sidebar, /landlordPrimaryLinks\.map/);
  assert.match(sidebar, /useFetchProperties\(\)/);
  assert.match(sidebar, /visibleProperties\.map/);
  assert.match(sidebar, /\/landlord\/property\/\$\{encodeURIComponent\(property\.id\)\}/);
  assert.match(sidebar, /component="img" src=\{property\.image\}/);
  assert.match(sidebar, /placeholderImage/);
  assert.match(sidebar, /trialExpired/);
  assert.match(sidebar, /aria-current=\{isActive \? 'page' : undefined\}/);
  assert.doesNotMatch(sidebar, />Workspace<\/Typography>/);
  assert.match(sidebar, />Properties<\/Typography>/);
  assert.match(sidebar, /<IconButton component=\{Link\} to="\/landlord\/properties\/add" aria-label="Add property"/);
  assert.match(sidebar, /disabled=\{trialExpired\} onClick=\{onMobileClose\} size="small"/);
  assert.doesNotMatch(sidebar, />More<\/Typography>|Property Operations|groupLandlordMoreNavigation|Support'|Settings'/);
});

test('property section searches and caps its rows at eight, with a list-page link for larger portfolios', () => {
  const sidebar = source('../layout/Dashboard/LandlordSidebar.jsx');
  assert.match(sidebar, /const MAX_SIDEBAR_PROPERTIES = 8/);
  assert.match(sidebar, /const hasMoreProperties = propertyRows\.length > MAX_SIDEBAR_PROPERTIES/);
  assert.match(sidebar, /\{hasMoreProperties && <TextField[\s\S]*?value=\{propertySearch\} onChange=\{\(event\) => setPropertySearch\(event\.target\.value\)\}[\s\S]*?'aria-label': 'Search properties'/);
  assert.match(sidebar, /\.filter\(\(property\) => !hasMoreProperties \|\| property\.name\.toLocaleLowerCase\(\)\.includes\(searchTerm\)\)\s*\.slice\(0, MAX_SIDEBAR_PROPERTIES\)/);
  assert.match(sidebar, /No matching properties\./);
  assert.match(sidebar, /\{hasMoreProperties && <List disablePadding>[\s\S]*?to="\/landlord\/properties"[\s\S]*?onClick=\{onMobileClose\}[\s\S]*?primary="View more"/);
});

test('sidenav reorders on a property-page visit and keeps the current portfolio scope', () => {
  const sidebar = source('../layout/Dashboard/LandlordSidebar.jsx');
  assert.match(sidebar, /readPropertyVisitDates\(user\)/);
  assert.match(sidebar, /sortPropertiesByLastVisit\([\s\S]*?visitDates\)/);
  assert.match(sidebar, /addEventListener\(PROPERTY_VISITED_EVENT/);
  assert.match(sidebar, /removeEventListener\(PROPERTY_VISITED_EVENT/);
  assert.match(sidebar, /recordRecentlyViewedProperty\(property\.id, user\)/);
});

test('header retains logo, search and messaging utilities without landlord page links', () => {
  const content = source('../layout/Dashboard/Header/HeaderContent/index.jsx');
  assert.match(content, /<Logo[\s\S]*?to={`\$\{basePath\}\/dashboard`}/);
  assert.match(content, /<MobileSearch\s*\/>[\s\S]*?<Message\s*\/>/);
  assert.doesNotMatch(content, /<TopNavigation\s*\/>|<LandlordPrimaryNavigation\s*\/>/);
});
