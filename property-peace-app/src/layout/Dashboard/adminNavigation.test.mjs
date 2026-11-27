import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const read = (path) => readFileSync(new URL(path, import.meta.url), 'utf8');
const layout = read('./index.jsx');
const header = read('./Header/index.jsx');
const drawer = read('./Drawer/index.jsx');

test('desktop admin navigation starts expanded and can be reopened with the same control', () => {
  assert.match(layout, /\[adminDesktopMenuOpen, setAdminDesktopMenuOpen\] = useState\(true\)/);
  assert.match(layout, /onAdminMenuToggle=\{\(\) => setAdminDesktopMenuOpen\(\(open\) => !open\)\}/);
  assert.match(header, /aria-expanded=\{adminDesktopMenuOpen\}/);
  assert.match(header, /onClick=\{onAdminMenuToggle\}/);
  assert.match(header, /display: \{ xs: 'none', lg: 'inline-flex' \}/);
  assert.match(layout, /desktopOpen=\{adminDesktopMenuOpen\}/);
});

test('admin drawer keeps mobile visibility independent and updates icon-only navigation', () => {
  assert.match(drawer, /const drawerOpen = downLG \? mobileOpen : desktopOpen/);
  assert.match(drawer, /handlerDrawerOpen\(drawerOpen\)/);
  assert.match(drawer, /<MiniDrawerStyled variant="permanent" open=\{drawerOpen\}/);
  assert.match(drawer, /variant="temporary"\s+open=\{drawerOpen\}\s+onClose=\{onMobileClose\}/);
  assert.match(read('./Drawer/MiniDrawerStyled.js'), /width: MINI_DRAWER_WIDTH/);
  assert.match(header, /adminDesktopMenuOpen \? DRAWER_WIDTH : MINI_DRAWER_WIDTH/);
});
