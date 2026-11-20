import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import test from 'node:test';
import { fileURLToPath } from 'node:url';
import { buildSync } from 'esbuild';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';

const source = (path) => readFileSync(new URL(path, import.meta.url), 'utf8');

for (const [page, controlRow] of [
  ['payments', /<TenantLeaseFilter\b[\s\S]*?<LeaseChargeList\b/],
  ['lease', /<TenantLeaseFilter\b[\s\S]*?<StatCard\b/],
  ['maintenance', /<TenantLeaseFilter\b[\s\S]*?placeholder="Search requests[^\"]*"[\s\S]*?<TableContainer\b/],
  ['documents', /Search documents\.\.\.[\s\S]*?<TenantLeaseFilter\b[\s\S]*?<TableContainer\b/]
]) {
  test(`${page} has one lease filter above the results in place of the lease column`, () => {
    const content = source(`./${page}.jsx`);

    assert.match(content, controlRow);
    assert.equal((content.match(/<TenantLeaseFilter\b/g) || []).length, 1);
    const leaseChangeHandler = page === 'maintenance' ? 'handleLeaseChange' : 'setSelectedLeaseId';
    assert.match(content, new RegExp(`<TenantLeaseFilter\\b[^>]*leases=\\{leases\\}[^>]*selectedLeaseId=\\{selectedLeaseId\\}[^>]*onChange=\\{${leaseChangeHandler}\\}`));
    assert.doesNotMatch(content, /function LeaseListItem\b|function LeaseFilterItem\b/);
  });
}

function renderLeaseFilter(props = {}) {
  const path = new URL('../../components/filters/TenantLeaseFilter.jsx', import.meta.url);
  const { outputFiles } = buildSync({
    entryPoints: [fileURLToPath(path)],
    bundle: true,
    write: false,
    platform: 'node',
    packages: 'external',
    format: 'cjs',
    jsx: 'automatic',
    logLevel: 'silent'
  });
  const module = { exports: {} };
  new Function('module', 'require', outputFiles[0].text)(module, createRequire(path));

  return renderToStaticMarkup(createElement(module.exports.default, {
    leases: [
      { id: 12, unit: { name: '2B', property: { name: 'Maple Court' } }, isActive: true },
      { Id: 34, PropertyName: 'Oak House', UnitName: 'Unit 1', PropertyType: 'SingleFamily', IsActive: false }
    ],
    selectedLeaseId: 12,
    onChange: () => {},
    ...props
  }));
}

test('lease filter labels its control and shows the selected lease among active and inactive options', () => {
  const html = renderLeaseFilter();
  const label = html.match(/<label[^>]*for="([^"]+)"[^>]*>Lease<\/label>/);
  const select = html.match(/<select[^>]*id="([^"]+)"/);
  assert.ok(label && select);
  assert.equal(label[1], select[1]);
  assert.match(html, /<option value="12" selected="">Maple Court · 2B<\/option>/);
  assert.match(html, /<option value="34">Oak House \(Inactive\)<\/option>/);
});

test('My Lease uses a left-aligned dropdown with an associated Select Lease caption above it', () => {
  assert.match(source('./lease.jsx'), /<Box sx=\{\{ display: 'flex', justifyContent: 'flex-start', mb: 2 \}\}>\s*<TenantLeaseFilter\b[^>]*\blabelAbove\s*\/>/);
  const html = renderLeaseFilter({ labelAbove: true });
  const label = html.match(/<label[^>]*for="([^"]+)"[^>]*>Select Lease<\/label>/);
  const select = html.match(/<select[^>]*id="([^"]+)"/);
  assert.ok(label && select);
  assert.equal(label[1], select[1]);
  assert.ok(label.index < select.index);
});

test('Maintenance displays the lease label inside the dropdown and keeps it accessible', () => {
  assert.match(source('./maintenance.jsx'), /<TenantLeaseFilter\b[^>]*\blabelInline\b/);
  const html = renderLeaseFilter({ labelInline: true });
  assert.match(html, /<select\b[^>]*aria-label="Lease"/);
  assert.doesNotMatch(html, /<label\b/);
  assert.match(html, /<option value="12" selected="">Lease: Maple Court · 2B<\/option>/);
  assert.match(html, /<option value="34">Lease: Oak House \(Inactive\)<\/option>/);
});

test('the dashboard places its compact lease selector below the greeting and labels each option inline', () => {
  assert.match(source('./dashboard.jsx'), /\{greeting\}\s*<\/Typography>\s*<LeaseSelector\b[^>]*gridRow: 2[^>]*justifySelf: 'start'/);

  const selector = source('../../components/LeaseSelector.jsx');
  assert.match(selector, /<Select\b[^>]*inputProps=\{\{ 'aria-label': 'Select lease' \}\}[^>]*IconComponent=\{DownOutlined\}[^>]*filterControlSx/);
  assert.match(selector, /<MenuItem\b[^>]*>\s*Lease: \{formatLeaseLabel\(lease\)\}/);
  assert.doesNotMatch(selector, />\s*Select Lease\s*</);
});
