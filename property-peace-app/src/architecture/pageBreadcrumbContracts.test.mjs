import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';

test('Leads & Showings provides the current breadcrumb items contract', () => {
  const source = fs.readFileSync(new URL('../pages/landlord/leads.jsx', import.meta.url), 'utf8');

  assert.match(
    source,
    /<PageBreadcrumbs\s+items=\{\[\{ label: 'Dashboard', path: '\/landlord\/dashboard' \}, \{ label: 'Leads & Showings' \}\]\}\s*\/>/
  );
  assert.doesNotMatch(source, /<PageBreadcrumbs\s+title=/);
});
