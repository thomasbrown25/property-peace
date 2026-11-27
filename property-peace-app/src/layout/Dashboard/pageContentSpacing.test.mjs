import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const layout = readFileSync(new URL('./index.jsx', import.meta.url), 'utf8');
const contentStart = layout.indexOf('<Box data-testid="main-app-page-content"');
const contentEnd = layout.indexOf('</Box>', contentStart);
const content = layout.slice(contentStart, contentEnd);
const main = layout.slice(layout.indexOf('component="main"'), layout.indexOf('<Container'));

// Evaluate the actual production spacing expressions, not a duplicate layout policy.
function spacingValue(styles, key, isFullWidthPage = false) {
  const line = styles.split('\n').find((line) => line.trim().startsWith(`${key}: `));
  assert.ok(line, `Missing ${key}`);
  const expression = line.trim().slice(key.length + 2).replace(/,$/, '');
  return new Function('isFullWidthPage', `return (${expression})`)(isFullWidthPage);
}

const contentValue = (key, isFullWidthPage) => spacingValue(content, key, isFullWidthPage);

test('standard shared route content stays uncapped with modest responsive gutters', () => {
  assert.ok(contentStart >= 0);
  assert.equal(contentValue('width'), '100%');
  assert.equal(contentValue('maxWidth'), 'none');
  assert.deepEqual(contentValue('px'), { xs: 0, sm: 1, md: 1.5, lg: 2 });
  assert.equal(contentValue('mx'), 'auto');
  assert.equal(contentValue('boxSizing'), 'border-box');
  assert.equal(contentValue('minWidth'), 0);
  assert.match(content, /<Outlet \/>/);
});

test('navigation and footer sit outside the page gutters and content clears the fixed header', () => {
  const headerStart = layout.search(/<Header\b/);
  assert.ok(headerStart >= 0 && headerStart < contentStart);
  assert.ok(layout.indexOf('<Footer />') > contentEnd);
  assert.doesNotMatch(content, /<Header\b|<Footer\b/);
  assert.equal(spacingValue(main, 'p'), 2.5);
  assert.match(layout, /pb: 0/);
  const header = readFileSync(new URL('./Header/index.jsx', import.meta.url), 'utf8');
  const spacer = layout.match(/minHeight: \{ xs: '(\d+)px !important', sm: '(\d+)px !important' \}/);
  const toolbar = header.match(/const HEADER_HEIGHT = \{ xs: (\d+), sm: (\d+) \}/);
  assert.ok(spacer && toolbar, 'Header and spacer must declare responsive heights');
  assert.deepEqual(spacer.slice(1), toolbar.slice(1), 'Content spacer must match the existing header height');
  assert.match(header, /const height = tenantPortal \? TENANT_HEADER_HEIGHT : HEADER_HEIGHT/);
  assert.match(header, /<Toolbar sx=\{\{ minHeight: height, height,/);
  assert.match(layout, /<Toolbar[^\n]*height: isTenantPortal \? TENANT_HEADER_HEIGHT : undefined/);
});

test('both add-property routes use the standard landlord shell and gutters', () => {
  const expression = layout.match(/const isLandlordPortal = ([^;]+);/)[1];
  const isLandlord = new Function('pathname', `return ${expression}`);
  for (const pathname of ['/landlord/properties/add', '/landlord/property-add-workflow']) {
    assert.equal(isLandlord(pathname), true, pathname);
  }
  assert.match(layout, /const isFullWidthPage = isSettingsPage;/);
  assert.match(layout, /\{isLandlordPortal && \(\s*<LandlordSidebar\b/);
  assert.doesNotMatch(layout, /isAddPropertyPage/);
});

test('landlord and tenant Settings sit flush against the dashboard navigation', () => {
  assert.match(layout, /matchPath\('\/landlord\/settings', pathname\)/);
  assert.match(layout, /matchPath\('\/tenant\/settings', pathname\)/);
  assert.match(layout, /const isFullWidthPage = isSettingsPage;/);
  assert.equal(spacingValue(main, 'p', true), 0);
  assert.equal(contentValue('px', true), 0);
});
