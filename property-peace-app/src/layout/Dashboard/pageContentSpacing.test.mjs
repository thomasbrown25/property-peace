import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const layout = readFileSync(new URL('./index.jsx', import.meta.url), 'utf8');
const contentStart = layout.indexOf('<Box data-testid="main-app-page-content"');
const contentEnd = layout.indexOf('</Box>', contentStart);
const content = layout.slice(contentStart, contentEnd);

// Evaluate the actual production spacing expressions, not a duplicate layout policy.
function contentValue(key, isAddPropertyPage = false) {
  const line = content.split('\n').find((line) => line.trim().startsWith(`${key}: `));
  assert.ok(line, `Missing ${key}`);
  const expression = line.trim().slice(key.length + 2).replace(/,$/, '');
  return new Function('isAddPropertyPage', `return (${expression})`)(isAddPropertyPage);
}

test('all shared route content, including the dashboard, stays uncapped with modest responsive gutters', () => {
  assert.ok(contentStart >= 0);
  assert.equal(contentValue('width'), '100%');
  assert.equal(contentValue('maxWidth'), 'none');
  assert.deepEqual(contentValue('px'), { xs: 0, sm: 1, md: 1.5, lg: 2 });
  assert.equal(contentValue('mx'), 'auto');
  assert.equal(contentValue('boxSizing'), 'border-box');
  assert.equal(contentValue('minWidth'), 0);
  assert.match(content, /<Outlet \/>/);
});

test('navigation, footer, outer gutter, and vertical spacing stay unchanged', () => {
  assert.ok(layout.indexOf('<Header ') < contentStart);
  assert.ok(layout.indexOf('<Footer />') > contentEnd);
  assert.doesNotMatch(content, /<Header\b|<Footer\b/);
  assert.match(layout, /p: isAddPropertyPage \? 0 : 2\.5/);
  assert.match(layout, /pb: 0/);
  const header = readFileSync(new URL('./Header/index.jsx', import.meta.url), 'utf8');
  const spacer = layout.match(/minHeight: \{ xs: '(\d+)px !important', sm: '(\d+)px !important' \}/);
  const toolbar = header.match(/minHeight: \{ xs: (\d+), sm: (\d+) \}/);
  assert.ok(spacer && toolbar, 'Header and spacer must declare responsive heights');
  assert.deepEqual(spacer.slice(1), toolbar.slice(1), 'Content spacer must match the existing header height');
});

test('standalone property onboarding keeps its existing edge-to-edge shell', () => {
  const expression = layout.match(/const isAddPropertyPage = ([^;]+);/)[1];
  const isOnboarding = new Function('pathname', `return ${expression}`);
  for (const pathname of ['/landlord/properties/add', '/landlord/property-add-workflow']) {
    assert.equal(isOnboarding(pathname), true, pathname);
  }
  for (const pathname of ['/landlord/dashboard', '/landlord/properties', '/landlord/leases']) {
    assert.equal(isOnboarding(pathname), false, pathname);
  }
  assert.match(layout, /p: isAddPropertyPage \? 0 : 2\.5/);
  assert.equal(contentValue('maxWidth'), 'none');
  assert.equal(contentValue('px', true), 0);
});
