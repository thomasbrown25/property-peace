import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import assert from 'node:assert/strict';

const source = (path) => readFileSync(new URL(path, import.meta.url), 'utf8');

test('dashboard shell restores the existing drawer only for admin routes', () => {
  const layout = source('../layout/Dashboard/index.jsx');
  const header = source('../layout/Dashboard/Header/index.jsx');
  const content = source('../layout/Dashboard/Header/HeaderContent/index.jsx');
  const drawer = source('../layout/Dashboard/Drawer/index.jsx');
  const navigation = source('../layout/Dashboard/Drawer/DrawerContent/Navigation/index.jsx');
  assert.match(layout, /pathname === '\/admin' \|\| pathname\.startsWith\('\/admin\/'\)/);
  assert.match(layout, /\{isAdminPortal && <MainDrawer mobileOpen=\{adminMobileMenuOpen\}/);
  assert.match(layout, /width: isAdminPortal \?/);
  assert.match(header, /width: adminPortal \?/);
  assert.match(header, /<HeaderContent adminPortal=\{adminPortal\}/);
  assert.match(content, /adminPortal && \([\s\S]*?aria-label="Open admin navigation"/);
  assert.match(drawer, /variant="permanent"/);
  assert.match(drawer, /variant="temporary"/);
  assert.match(drawer, /onClose=\{onMobileClose\}/);
  assert.match(navigation, /menuData = \{ items: \[adminPages\] \}/);
});

test('mobile More keeps Calendar reachable when the centered desktop links are hidden', () => {
  const mobile = source('../layout/Dashboard/BottomNavBar/index.jsx');
  assert.match(mobile, /id: 'calendar', title: 'Calendar', url: '\/landlord\/calendar'/);
  assert.match(mobile, /flattenedLandlordItems\.map/);
});

test('desktop More follows the primary links and exposes Properties with the former landlord destinations', () => {
  const navigation = source('../layout/Dashboard/Header/HeaderContent/LandlordPrimaryNavigation.jsx');
  const more = source('../layout/Dashboard/Header/HeaderContent/TopNavigation.jsx');
  const pages = source('../menu-items/pages.js');
  assert.match(navigation, /landlordPrimaryLinks\.map\([\s\S]*?<TopNavigation \/>/);
  assert.match(more, /primaryDestinations = new Set\(landlordPrimaryLinks\.map/);
  assert.match(more, /landlordPagesForInventory\(pages, shortTermOnly\)/);
  assert.match(pages, /title: 'Properties',[\s\S]*?url: '\/landlord\/properties'/);
  assert.match(more, /if \(primaryDestinations\.has\(item\.url\)\) return \[\]/);
  assert.match(more, /id: 'tenants', title: 'Tenants'[\s\S]*?\/landlord\/leases\?tab=tenants/);
  assert.match(more, /aria-expanded=\{Boolean\(anchor\)\}/);
  assert.match(more, /maxHeight: 'calc\(100dvh - 88px\)'/);
  assert.match(more, /minHeight: 34, py: 0\.5/);
  assert.match(navigation, /color: 'inherit'/);
  assert.match(more, /component="button"[\s\S]*?color: 'inherit'/);
  assert.match(more, /fontWeight: moreSelected \? 700 : 500/);
  assert.match(more, /component="span"[\s\S]*?'&::after': \{[\s\S]*?bottom: -6,[\s\S]*?opacity: moreSelected \? 1 : 0/);
  assert.match(more, /disabled=\{item\.disabled \|\| trialExpired\}/);
  for (const title of ['Leases', 'Percy', 'Checklists', 'Maintenance', 'Vendors', 'Team', 'Announcements', 'Online Payments', 'Finances', 'Tax Center', 'Reports']) {
    assert.ok(pages.includes(`title: '${title}'`), `Missing former sidebar destination: ${title}`);
  }
  assert.match(more, /Support/);
  assert.match(more, /Settings/);
});

test('top bar keeps the logo, mounts the landlord navigation, and places search before messages', () => {
  const content = source('../layout/Dashboard/Header/HeaderContent/index.jsx');
  const search = source('../layout/Dashboard/Header/HeaderContent/MobileSearch.jsx');
  const field = source('../layout/Dashboard/Header/HeaderContent/Search.jsx');
  assert.match(content, /<Logo[\s\S]*?to={`\$\{basePath\}\/dashboard`}/);
  assert.doesNotMatch(content, /<TopNavigation\s*\/>|<Search shrink\s*\/>/);
  assert.match(content, /!isAdmin && !hasTenantRole && <LandlordPrimaryNavigation\s*\/>/);
  const navigation = source('../layout/Dashboard/Header/HeaderContent/LandlordPrimaryNavigation.jsx');
  assert.match(navigation, /component="nav" aria-label="Landlord primary navigation"/);
  assert.match(navigation, /aria-current=\{active === label \? 'page' : undefined\}/);
  assert.match(navigation, /display: \{ xs: 'none', md: 'flex' \}/);
  assert.match(navigation, /component="span"[\s\S]*?'&::after': \{[\s\S]*?bottom: -6,[\s\S]*?opacity: active === label \? 1 : 0/);
  assert.doesNotMatch(navigation, /borderBottom:/);
  assert.match(content, /<MobileSearch\s*\/>[\s\S]*?<Message\s*\/>/);
  assert.match(search, /<Popper[\s\S]*?placement="bottom-end"/);
  assert.match(search, /<Search autoFocus onResultSelect=/);
  assert.match(search, /ClickAwayListener/);
  assert.match(search, /event\.key === 'Escape'/);
  assert.match(field, /useGlobalSearch\(debouncedQuery, 10\)/);
  assert.match(field, /onResultSelect\?\.\(\)/);
});
