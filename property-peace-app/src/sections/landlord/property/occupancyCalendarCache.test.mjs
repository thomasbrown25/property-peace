import assert from 'node:assert/strict';
import test from 'node:test';
import { readOccupancyCalendar, storeOccupancyCalendar } from './occupancyCalendarCache.mjs';

const jan = new Date(2026, 0, 1);
const feb = new Date(2026, 1, 1);

test('reuses only the matching account, property, and month before expiry', () => {
  const data = { units: [{ propertyId: 101 }] };
  storeOccupancyCalendar(77, 101, jan, data, 1000);
  assert.equal(readOccupancyCalendar(77, 101, jan, 1001), data);
  assert.equal(readOccupancyCalendar(78, 101, jan, 1001), null);
  assert.equal(readOccupancyCalendar(77, 102, jan, 1001), null);
  assert.equal(readOccupancyCalendar(77, 101, feb, 1001), null);
  assert.equal(readOccupancyCalendar(77, 101, jan, 31000), null);
});

test('a new successful response replaces the cached value', () => {
  storeOccupancyCalendar(77, 101, jan, { units: [] }, 40000);
  const fresh = { units: [{ unitId: 1 }] };
  storeOccupancyCalendar(77, 101, jan, fresh, 41000);
  assert.equal(readOccupancyCalendar(77, 101, jan, 41001), fresh);
});
