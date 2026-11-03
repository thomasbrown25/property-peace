import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { daysInOccupancyMonth, occupancyForDay } from './occupancyDays.mjs';

const read = path => readFile(new URL(path, import.meta.url), 'utf8');

test('daily occupancy is inclusive and scoped to the selected unit, even across a month boundary', () => {
  const unit = { unitId: 1, leasePeriods: [{ startDate: '2026-01-31T00:00:00Z', endDate: '2026-02-02T00:00:00Z', tenantNames: 'A' }] };
  const otherUnit = { unitId: 2, leasePeriods: [{ startDate: '2026-02-01', endDate: '2026-02-28' }] };
  const days = daysInOccupancyMonth(unit, new Date(2026, 1, 1));
  assert.equal(days.length, 28);
  assert.deepEqual(days.slice(0, 3).map(day => day.occupied), [true, true, false]);
  assert.equal(days[0].lease.tenantNames, 'A');
  assert.equal(occupancyForDay(otherUnit, new Date(2026, 1, 3)).occupied, true);
  assert.equal(occupancyForDay(unit, new Date(2026, 1, 3)).occupied, false);
});

test('leap years, occupied availability and vacant gaps render daily', () => {
  const unit = { availabilityPeriods: [{ startDate: '2028-02-28', endDate: '2028-02-29', isVacant: false, status: 'Occupied' }] };
  const days = daysInOccupancyMonth(unit, new Date(2028, 1, 1));
  assert.equal(days.length, 29);
  assert.equal(days[26].occupied, false);
  assert.equal(days[27].occupied, true);
  assert.equal(days[28].occupied, true);
});

test('property occupancy tab precedes finances and uses the scoped 12-month calendar and unit modal', async () => {
  const tabs = await read('./PropertyRecordsTabs.jsx');
  const view = await read('./PropertyOccupancyTab.jsx');
  const timeline = await read('../../../components/OccupancyTimelineGraph.jsx');
  assert.match(tabs, /value="occupancy" label="Occupancy"\s*\/><Tab value="finances" label="Finances"/);
  assert.match(tabs, /active === 'occupancy' && <PropertyOccupancyTab/);
  assert.match(view, /getUnitAvailabilityCalendar\(landlordId, propertyId, windowStart, endOfMonth\(addMonths\(windowStart, 11\)\), controller.signal\)/);
  assert.match(view, /Promise.race\(/);
  assert.match(view, /String\(unit.propertyId\) === String\(propertyId\)/);
  assert.match(view, /maxVisibleUnits=\{10\} onMonthClick=/);
  assert.match(view, /addMonths\(start, 12\)/);
  assert.match(view, /daysInOccupancyMonth\(selection.unit, selection.month\)/);
  assert.match(view, /AbortController/);
  assert.match(view, /setTimeout\(\(\) => \{ controller.abort\(\); reject\(new Error\('Occupancy request timed out'\)\); \}, 20000\)/);
  assert.match(view, /clearTimeout\(timeoutId\)/);
  assert.match(view, /Retry/);
  assert.match(view, /onClick=\{\(\) => setRequestAttempt\(attempt => attempt \+ 1\)\}/);
  assert.match(timeline, /onClick=\{onMonthClick \? \(\) => onMonthClick\(unit, month\)/);
});
