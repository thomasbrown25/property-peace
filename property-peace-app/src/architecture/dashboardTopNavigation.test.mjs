import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import assert from 'node:assert/strict';

const source = (path) => readFileSync(new URL(path, import.meta.url), 'utf8');

test('dashboard shell uses full-width header and content without a sidenav or collapse button', () => {
  const layout = source('../layout/Dashboard/index.jsx');
  const header = source('../layout/Dashboard/Header/index.jsx');
  assert.doesNotMatch(layout, /<Drawer\s*\/>|<HorizontalBar\s*\/>|DRAWER_WIDTH|MINI_DRAWER_WIDTH/);
  assert.match(layout, /width: '100%'/);
  assert.doesNotMatch(header, /handlerDrawerOpen|MenuFoldOutlined|MenuUnfoldOutlined|AppBarStyled/);
  assert.match(header, /<HeaderContent\s*\/>/);
  assert.match(header, /width: '100%'/);
});

test('mobile More keeps Calendar reachable when the centered desktop links are hidden', () => {
  const mobile = source('../layout/Dashboard/BottomNavBar/index.jsx');
  assert.match(mobile, /id: 'calendar', title: 'Calendar', url: '\/landlord\/calendar'/);
  assert.match(mobile, /flattenedLandlordItems\.map/);
});

test('top bar keeps the logo, mounts the four-link landlord navigation, and places search before messages', () => {
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
