import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { isUnitOccupied } from '../utils/occupancy.mjs';
import { occupancyForDay } from '../sections/landlord/property/occupancyDays.mjs';
const require = createRequire(import.meta.url);
const { parse } = require('@babel/parser');
const source = path => readFileSync(new URL(`../${path}`, import.meta.url), 'utf8');
const files = ['pages/landlord/properties.jsx', 'pages/landlord/property.jsx',
  'sections/landlord/property/PropertyHeader.jsx', 'sections/landlord/property/PropertyMetrics.jsx',
  'sections/landlord/property/PropertyMonthlyRent.jsx', 'components/fields/UnitFields.jsx',
  'components/drawers/PropertyAddDrawer.jsx', 'components/OccupancyTimelineGraph.jsx'];
for (const file of files) test(`${file} parses after occupancy changes`, () => {
  parse(source(file), { sourceType: 'module', plugins: ['jsx'] });
});
test('Properties page production summary counts active leases, not saved flags/status', () => {
  const text = source('pages/landlord/properties.jsx');
  const start = text.indexOf('const read =');
  const end = text.indexOf('\nfunction ', text.indexOf('function getPropertySummary') + 10);
  assert.ok(start >= 0 && end > start);
  const getSummary = new Function('isUnitOccupied', 'isHighPriorityMaintenanceRequest', `${text.slice(start, end)}; return getPropertySummary;`)(isUnitOccupied, () => false);
  const active = { isActive: true, startDate: '2020-01-01', endDate: '2099-01-01' };
  const summary = getSummary({ units: [
    { status: 'vacant', lease: active },
    { status: 'occupied', isOccupied: true, tenants: [{}] },
    { status: 'overdue', lease: { ...active, isActive: false } },
    { status: 'occupied', lease: { ...active, isDrafted: true } },
    { status: 'occupied', lease: { ...active, startDate: '2098-01-01' } }
  ] });
  assert.equal(summary.occupied, 1);
  assert.equal(summary.vacant, 4);
});
test('occupancy calendars do not treat inactive history as occupied', () => {
  const period = { startDate: '2026-01-01', endDate: '2026-12-31', isActive: false };
  assert.equal(occupancyForDay({ leasePeriods: [period] }, new Date(2026, 5, 1)).occupied, false);
  assert.equal(occupancyForDay({ leasePeriods: [{ ...period, isActive: true }] }, new Date(2026, 5, 1)).occupied, true);
  assert.match(source('components/OccupancyTimelineGraph.jsx'), /if \(lease\.isActive !== true\) continue/);
});
test('property unit filters and labels use lease occupancy and manual switches are removed', () => {
  assert.doesNotMatch(source('pages/landlord/property.jsx'), /unit\??\.isOccupied/);
  for (const path of ['components/fields/UnitFields.jsx', 'components/drawers/PropertyAddDrawer.jsx']) {
    assert.doesNotMatch(source(path), /checked=\{(?:unit|values)\.isOccupied/);
    assert.match(source(path), /Occupancy is determined/);
  }
});
