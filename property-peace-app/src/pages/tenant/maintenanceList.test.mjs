import test from 'node:test';
import assert from 'node:assert/strict';
import { getMaintenanceRequestDate, getMaintenanceRows } from './maintenanceList.mjs';

const requests = [
  {
    id: 'newest',
    title: 'Kitchen leak',
    description: 'Water is dripping below the sink',
    location: 'Maple House · Unit 4B',
    category: 'Plumbing',
    status: 'Awaiting_Approval',
    priority: 'HIGH',
    createdAtUtc: '2026-11-18T10:00:00.000Z',
    referenceNumber: 'MR-104'
  },
  {
    id: 'legacy',
    title: 'Hall light',
    description: 'Bulb is out',
    propertyName: 'Maple House',
    unitName: 'Unit 4A',
    category: 'Electrical',
    status: 'in-progress',
    priority: 'medium',
    createdAt: '2026-11-17T10:00:00.000Z',
    workOrderNumber: 'WO-19'
  },
  {
    id: 'undated',
    title: 'Door hinge',
    location: 'Oak Court',
    category: 'Carpentry',
    status: 'Reported',
    priority: 'low'
  }
];

test('search is case-insensitive and includes legacy location fields and work-order references', () => {
  assert.deepEqual(
    getMaintenanceRows(requests, { search: '  MAPLE HOUSE  ' }).map((request) => request.id),
    ['newest', 'legacy']
  );
  assert.deepEqual(
    getMaintenanceRows(requests, { search: 'wo-19' }).map((request) => request.id),
    ['legacy']
  );
});

test('orders requests newest first using either date field and keeps missing dates last', () => {
  assert.equal(getMaintenanceRequestDate(requests[0]), '2026-11-18T10:00:00.000Z');
  assert.equal(getMaintenanceRequestDate(requests[1]), '2026-11-17T10:00:00.000Z');
  assert.deepEqual(
    getMaintenanceRows([...requests].reverse()).map((request) => request.id),
    ['newest', 'legacy', 'undated']
  );
});
