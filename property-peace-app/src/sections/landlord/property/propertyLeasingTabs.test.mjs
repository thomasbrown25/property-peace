import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const { parse } = require('@babel/parser');
const source = readFileSync(new URL('./PropertyRecordsTabs.jsx', import.meta.url), 'utf8');
const ast = parse(source, { sourceType: 'module', plugins: ['jsx'] });
const expected = ['overview', 'leases', 'tenants', 'payments', 'maintenances', 'listings', 'applications', 'expenses', 'documents', 'settings'];

function walk(node, visit) {
  if (!node || typeof node !== 'object') return;
  visit(node);
  for (const value of Object.values(node)) {
    if (Array.isArray(value)) value.forEach(child => walk(child, visit));
    else if (value && typeof value === 'object') walk(value, visit);
  }
}

test('property tab validation retains URL ids while primary navigation is compact', () => {
  const rendered = [];
  let accepted;
  walk(ast, node => {
    if (node.type === 'VariableDeclarator' && node.id.name === 'tabs') accepted = node.init.elements.map(element => element.value);
    if (node.type === 'JSXOpeningElement' && node.name.name === 'Tab') {
      rendered.push(node.attributes.find(attribute => attribute.name.name === 'value').value.value);
    }
  });
  assert.deepEqual(accepted, expected);
  assert.deepEqual(rendered, ['overview', 'tenants', 'leases', 'payments', 'maintenances', 'more']);
});

test('More exposes every secondary URL tab, marks deep links selected and uses accessible keyboard navigation', () => {
  const secondary = ['listings', 'applications', 'expenses', 'documents', 'settings'];
  for (const id of secondary) {
    assert.match(source, new RegExp(`\\{ id: '${id}', label: '[A-Z]`));
    assert.ok(source.includes(`active === '${id}' &&`), `${id} panel remains reachable`);
  }
  assert.match(source, /const activeMore = moreSections\.find\(section => section\.id === active\)/);
  assert.match(source, /value=\{activeMore \? 'more' : active\}/);
  assert.match(source, /label=\{activeMore \? `More: \$\{activeMore\.label\}` : 'More'\}/);
  assert.match(source, /selected=\{active === section\.id\}/);
  assert.match(source, /onTabChange\(section\.id\)/);
  assert.match(source, /if \(value !== 'more'\) onTabChange\(value\)/);
  assert.match(source, /aria-haspopup="menu" aria-controls=/);
  assert.match(source, /aria-expanded=\{Boolean\(moreAnchor\)\}/);
  assert.match(source, /event\.key === 'ArrowDown'/);
  assert.match(source, /onClose=\{\(\) => setMoreAnchor\(null\)\}/);
  assert.match(source, /value="maintenances" label="Maintenance"/);
  assert.match(source, /active === 'maintenances' && <RecordsTable label="Maintenance"/);
});

test('leasing tabs load property-scoped records only and guard stale requests', () => {
  assert.match(source, /listingApi\.getListingsByPropertyId\(propertyId\)/);
  assert.match(source, /getApplicationsByProperty\(propertyId\)/);
  assert.match(source, /return \(\) => \{ cancelled = true; \}/);
  assert.match(source, /const current = result\.propertyId === propertyId/);
  assert.match(source, /rows=\{current \? result\.rows : \[\]\}/);
  for (const kind of ['listings', 'applications']) {
    assert.ok(source.includes(`active === '${kind}' && <PropertyLeasingRecords key="${kind}" kind="${kind}" propertyId={propertyId}`));
  }
});

test('leasing records retain table controls, empty/error states, and valid detail links', () => {
  assert.match(source, /link: row => `\/landlord\/listings\/\$\{read\(row, 'id'\)\}`/);
  assert.match(source, /\/landlord\/listings\?tab=applications&applicationId=/);
  assert.match(source, /emptyMessage=\{`No \$\{kind\} for this property\.`\}/);
  assert.match(source, /\$\{label\} could not be loaded\. Try again later\./);
  assert.match(source, /filterPropertyRows\(rows, query, status, searchFields, getStatus\)/);
  assert.match(source, /<TablePagination/);
});
