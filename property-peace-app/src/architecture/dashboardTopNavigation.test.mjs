import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import assert from 'node:assert/strict';

const source = (path) => readFileSync(new URL(path, import.meta.url), 'utf8');

test('admin and landlord drawers remain scoped to their respective portals', () => {
  const layout = source('../layout/Dashboard/index.jsx');
  const drawer = source('../layout/Dashboard/Drawer/index.jsx');
  assert.match(layout, /pathname === '\/admin' \|\| pathname\.startsWith\('\/admin\/'\)/);
  assert.match(layout, /\{isAdminPortal && \(\s*<MainDrawer\b[^<]*mobileOpen=\{adminMobileMenuOpen\}/);
  assert.match(layout, /const isLandlordPortal = pathname === '\/landlord' \|\| pathname\.startsWith\('\/landlord\/'\);/);
  assert.match(layout, /\{isLandlordPortal && \(\s*<LandlordSidebar\b[^<]*mobileOpen=\{landlordMobileMenuOpen\}/);
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

test('landlord shell reserves one property rail that uses the top bar colors', () => {
  const layout = source('../layout/Dashboard/index.jsx');
  const header = source('../layout/Dashboard/Header/index.jsx');
  const sidebar = source('../layout/Dashboard/LandlordSidebar.jsx');
  assert.match(sidebar, /LANDLORD_SIDEBAR_WIDTH = 260/);
  assert.match(layout, /lg: `calc\(100% - \$\{landlordSidebarWidth\}px\)`/);
  assert.match(header, /lg: `calc\(100% - \$\{sidebarWidth\}px\)`/);
  assert.doesNotMatch(sidebar, /LANDLORD_PROPERTY_SIDEBAR_WIDTH|LANDLORD_PRIMARY_SIDEBAR_WIDTH|aria-label="Property sidebar"|\{navigation\}/);
  assert.match(header, /\.\.\.portalHeaderColors\(theme\.palette\.mode\)/);
  assert.match(sidebar, /const surface = portalHeaderColors\(palette\.mode\)/);
  assert.match(sidebar, /aria-label="Property navigation"\s+sx=\{\{[^\n]+\.\.\.surface/);
  assert.match(sidebar, /linear-gradient\(transparent, \$\{surface\.bgcolor\}\)/);
  assert.match(sidebar, /<Typography component="h1" variant="h5"[\s\S]*?>\s*Wren\s*<\/Typography>/);
});

test('the desktop property rail shares its width with the shell and is toggled from the top bar', () => {
  const layout = source('../layout/Dashboard/index.jsx');
  const header = source('../layout/Dashboard/Header/index.jsx');
  const sidebar = source('../layout/Dashboard/LandlordSidebar.jsx');
  assert.match(layout, /selectIsEmptyPropertyPortfolio\(state, organizationId\)/);
  assert.match(layout, /const landlordSidebarWidth = landlordDesktopMenuOpen \? LANDLORD_SIDEBAR_WIDTH : MINI_DRAWER_WIDTH/);
  assert.match(layout, /landlordSidebarWidth=\{landlordSidebarWidth\}/);
  assert.match(layout, /desktopWidth=\{landlordSidebarWidth\}/);
  assert.match(layout, /<Header\b[\s\S]*?landlordDesktopMenuOpen=\{landlordDesktopMenuOpen\}[\s\S]*?onLandlordMenuToggle=\{emptyPropertyPortfolio \? \(\) => setLandlordDesktopMenu\(\{ organizationId, open: !landlordDesktopMenuOpen \}\) : undefined\}/);
  assert.match(header, /const sidebarWidth = .* : landlordSidebarWidth;/);
  assert.match(sidebar, /<Drawer variant="permanent" open sx=\{\{[^\n]*width: desktopWidth/);
  assert.match(sidebar, /'& \.MuiDrawer-paper': \{ width: desktopWidth/);
  assert.match(header, /<Toolbar\b[\s\S]*?\{landlordPortal && onLandlordMenuToggle && \([\s\S]*?aria-controls="landlord-property-navigation"\s+aria-expanded=\{landlordDesktopMenuOpen\}\s+onClick=\{onLandlordMenuToggle\}[\s\S]*?<HeaderContent\b/);
  assert.match(sidebar, /id="landlord-property-navigation"/);
  assert.doesNotMatch(sidebar, /aria-controls="landlord-property-navigation"/);
});

test('a populated portfolio expands the desktop sidebar even after a manual collapse', () => {
  const layout = source('../layout/Dashboard/index.jsx');
  const expression = layout.match(/const landlordDesktopMenuOpen = ([^;]+);/)?.[1];
  assert.ok(expression, 'Missing the desktop sidebar state');
  const sidebarIsOpen = new Function('emptyPropertyPortfolio', 'landlordDesktopMenu', 'organizationId', `return (${expression});`);

  assert.equal(sidebarIsOpen(false, { organizationId: 7, open: false }, 7), true);
  assert.equal(sidebarIsOpen(true, null, 7), false);
  assert.equal(sidebarIsOpen(true, { organizationId: 7, open: true }, 7), true);
  assert.equal(sidebarIsOpen(true, { organizationId: 8, open: true }, 7), false);
});

test('the collapsed property rail shows a mode-appropriate dashboard logo link', () => {
  const sidebar = source('../layout/Dashboard/LandlordSidebar.jsx');
  assert.match(sidebar, /import compactLightLogo from 'assets\/images\/logos\/logo-white\.png'/);
  assert.match(sidebar, /import compactDarkLogo from 'assets\/images\/logos\/logo-dark\.png'/);
  assert.match(sidebar, /const compactLogo = isDark \? compactLightLogo : compactDarkLogo/);
  assert.match(sidebar, /\{!desktopOpen && \(\s*<Box[\s\S]*?<Box\s+component=\{Link\}\s+to="\/landlord\/dashboard"[\s\S]*?<Box component="img" src=\{compactLogo\} alt="Property Peace home"[\s\S]*?id="landlord-property-navigation"/);
});

test('desktop top bar has ordered landlord links and More', () => {
  const content = source('../layout/Dashboard/Header/HeaderContent/index.jsx');
  const primary = source('../layout/Dashboard/Header/HeaderContent/LandlordPrimaryNavigation.jsx');
  const more = source('../layout/Dashboard/Header/HeaderContent/TopNavigation.jsx');
  assert.match(content, /landlordPortal && <LandlordPrimaryNavigation \/>/);
  assert.match(content, /gridTemplateColumns: 'minmax\(0, 1fr\) auto minmax\(max-content, 1fr\)'/);
  assert.match(content, /gap: landlordPortal \? \{ xs: 0\.5, sm: 0\.75, xl: 1\.25 \}/);
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

test('landlord top bar uses the requested logo on the left and a search button on the right at every width', () => {
  const content = source('../layout/Dashboard/Header/HeaderContent/index.jsx');
  const mobileSearch = source('../layout/Dashboard/Header/HeaderContent/MobileSearch.jsx');
  assert.match(content, /import landlordHeaderLogo from 'assets\/images\/logos\/property-peace-dark-2\.png'/);
  assert.match(content, /gridTemplateAreas: '"logo navigation actions"'/);
  assert.match(content, /component="img"\s+src=\{landlordHeaderLogo\}\s+alt="Property Peace"/);
  assert.doesNotMatch(content, /<Search \/>/);
  assert.match(content, /!hasTenantRole && <MobileSearch \/>[\s\S]*?<Message \/>/);
  assert.match(mobileSearch, /<AppIcon name="magnifier" \/>/);
  assert.match(mobileSearch, /<Search autoFocus /);
});

test('mobile landlord navigation inherits the top bar text color for primary and More labels', () => {
  const sidebar = source('../layout/Dashboard/LandlordSidebar.jsx');
  const mobileMenu = sidebar.match(/aria-label="Landlord pages"[\s\S]*?<\/List>/)?.[0];
  assert.ok(mobileMenu);
  assert.match(sidebar, /width: 300, maxWidth: '90vw', boxSizing: 'border-box', \.\.\.surface/);
  assert.match(mobileMenu, /<List\b[^>]*\[`& \.\$\{listItemTextClasses\.primary\}`\]: \{ color: 'inherit' \}/);
  assert.match(mobileMenu, /landlordPrimaryLinks\.map[\s\S]*?<ListItemText primary=\{label\}/);
  assert.match(mobileMenu, /<ListItemText primary="More"/);
  assert.match(mobileMenu, /landlordMoreLinks[\s\S]*?<ListItemText primary=\{label\}/);
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
    'placeholder="Search properties"', "'aria-label': 'Search properties'", '<BrandedIcon name="properties" />',
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
  assert.match(sidebar, /disabled=\{trialExpired\}/);
  assert.match(sidebar, /borderBottom: '1px solid', borderColor: 'rgba\(255, 255, 255, 0\.14\)'/);
  assert.match(sidebar, /borderTop: '1px solid', borderColor: divider[\s\S]*?to="\/landlord\/settings"[\s\S]*?primary="Settings"/);
  assert.match(sidebar, /<BrandedIcon name="settings" \/>/);
});

test('the Properties row shows search immediately before Add property', () => {
  const sidebar = source('../layout/Dashboard/LandlordSidebar.jsx');
  const propertiesRow = sidebar.match(/>\s*Properties\s*<\/Typography>[\s\S]*?(?=<Collapse in=\{searchOpen\})/)?.[0];
  assert.ok(propertiesRow, 'Expected the search field below the Properties row');
  assert.match(propertiesRow, /<IconButton\s+ref=\{searchButtonRef\}\s+aria-label="Search properties"[\s\S]*?<AppIcon name="search" \/>\s*<\/IconButton>\s*\)\}\s*<IconButton\s+component=\{Link\}\s+to=\{addPropertyPath\}\s+aria-label="Add property"/);
  assert.match(sidebar, /\{!loading && !isEmptyPortfolio && \(\s*<Collapse in=\{searchOpen\} timeout=\{reducedMotion \? 0 : 240\} unmountOnExit/);
  assert.match(sidebar, /onKeyDown=\{\(event\) => \{\s*if \(event\.key === 'Escape'\) \{\s*event\.stopPropagation\(\);\s*closeSearch\(\);/);
});

test('long property addresses truncate within the sidebar layout', () => {
  const sidebar = source('../layout/Dashboard/LandlordSidebar.jsx');
  assert.match(sidebar, /aria-label="Property navigation" sx=\{\{[^\n]*minWidth: 0/);
  assert.match(sidebar, /secondaryTypographyProps=\{\{[^\n]*noWrap: true, title: property\.address/);
});

test('the property rail keeps the count and rows hidden until the current list is ready', () => {
  const sidebar = source('../layout/Dashboard/LandlordSidebar.jsx');
  assert.match(sidebar, /selectPropertiesLoadStatus\(state, organizationId\)/);
  assert.match(sidebar, /const propertiesReady = propertiesStatus === 'ready'/);
  assert.match(sidebar, /properties=\{propertiesReady \? visibleProperties : \[\]\} total=\{propertiesReady \? propertyRows\.length : null\}/);
  assert.match(sidebar, /loading=\{propertiesStatus === 'pending'\}/);
  assert.match(sidebar, /total != null && <Typography component="span"/);
  assert.match(sidebar, /\{!loading && !isEmptyPortfolio && \(\s*<IconButton\s+ref=\{searchButtonRef\}/);
  assert.match(sidebar, /status=\{propertiesStatus === 'failed' \? 'Failed to load properties' : propertiesReady && propertyRows\.length \? 'No matching properties\.' : null\}/);
  assert.match(sidebar, /!properties\.length && status && <Typography role="status"/);
});

test('the property rail offers to add a property when the loaded portfolio is empty', () => {
  const sidebar = source('../layout/Dashboard/LandlordSidebar.jsx');
  assert.match(sidebar, /const isEmptyPortfolio = total === 0/);
  assert.match(sidebar, /const addPropertyPath = '\/landlord\/properties\/add'/);
  assert.match(sidebar, /\{isEmptyPortfolio && \([\s\S]*?No properties yet[\s\S]*?<Button component=\{Link\} to=\{addPropertyPath\}[\s\S]*?disabled=\{disabled\} onClick=\{onNavigate\}[\s\S]*?>\s*Add property\s*<\/Button>/);
});

test('the property rail expands in place with six compact icon-and-title actions', () => {
  const sidebar = source('../layout/Dashboard/LandlordSidebar.jsx');
  const actions = sidebar.match(/const propertyActions = \[([\s\S]*?)\];/)?.[1] || '';
  assert.deepEqual(Array.from(actions.matchAll(/label: '([^']+)', icon: '([^']+)'/g), ([, label, icon]) => [label, icon]), [
    ['View property', 'house'], ['Edit property', 'edit'], ['Record payment', 'payment'],
    ['Create lease', 'createLease'], ['Create task', 'createTask'], ['Upload document', 'uploadDocument']
  ]);
  assert.match(sidebar, /component="button"[\s\S]*?aria-expanded=\{expanded\}[\s\S]*?setExpandedPropertyId\(expanded \? null : property\.id\)/);
  const dropdown = sidebar.match(/<Collapse in=\{expanded\}[\s\S]*?<\/Collapse>/)?.[0];
  assert.ok(dropdown);
  assert.match(dropdown, /timeout=\{reducedMotion \? 0 : 240\}/);
  assert.match(dropdown, /minHeight: 36/);
  assert.match(dropdown, /<BrandedIcon name=\{icon\}[\s\S]*?<Typography[^>]*>\{label\}<\/Typography>/);
  assert.match(sidebar, /muted: propertySubtitleColor/);
  assert.match(sidebar, /secondaryTypographyProps=\{\{[^\n]*color: propertySubtitleColor/);
  assert.match(dropdown, /<Typography[^>]*color: propertySubtitleColor[^>]*>\{label\}<\/Typography>/);
  assert.doesNotMatch(dropdown, /secondary|subtitle|description/);
});

test('sidebar actions keep the selected property when opening a page or drawer', () => {
  const sidebar = source('../layout/Dashboard/LandlordSidebar.jsx');
  assert.match(sidebar, /navigate\(to, \{ state: \{ propertySidebarAction: action \} \}\)/);
  assert.match(sidebar, /drawer\.openPaymentAddDrawer\(\{ property: \{ id: property\.id, name: property\.name \} \}\)/);
  assert.match(sidebar, /setTaskDraft\(\{ propertyId: property\.id \}\)/);
  assert.match(sidebar, /<TaskEditorDrawer[\s\S]*?initialValues=\{taskDraft\}[\s\S]*?dispatch\(createTask\(form\)\)/);
});
