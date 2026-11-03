import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const layout = readFileSync(new URL('./index.jsx', import.meta.url), 'utf8');
const contentStart = layout.indexOf('<Box data-testid="main-app-page-content"');
const contentEnd = layout.indexOf('</Box>', contentStart);
const content = layout.slice(contentStart, contentEnd);

test('shared route content has centered, responsive dashboard-sized gutters', () => {
  assert.ok(contentStart >= 0);
  assert.match(content, /width: '100%'/);
  assert.match(content, /maxWidth: isAddPropertyPage \? 'none' : 1120/);
  assert.match(content, /mx: 'auto'/);
  assert.match(content, /px: isAddPropertyPage \? 0 : \{ xs: 0, sm: 1, md: 2, lg: 3 \}/);
  assert.match(content, /boxSizing: 'border-box'/);
  assert.match(content, /minWidth: 0/);
  assert.match(content, /<Outlet \/>/);
});

test('navigation and footer stay outside the page-only spacing wrapper', () => {
  assert.ok(layout.indexOf('<Header ') < contentStart);
  assert.ok(layout.indexOf('<Footer />') > contentEnd);
  assert.doesNotMatch(content, /<Header\b|<Footer\b/);
  assert.match(layout, /p: isAddPropertyPage \? 0 : 2\.5/);
});

test('standalone property onboarding keeps its existing edge-to-edge shell', () => {
  assert.match(layout, /const isAddPropertyPage = pathname === '\/landlord\/properties\/add' \|\| pathname === '\/landlord\/property-add-workflow'/);
  assert.match(content, /maxWidth: isAddPropertyPage \? 'none'/);
  assert.match(content, /px: isAddPropertyPage \? 0/);
});
