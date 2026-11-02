import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { maintenanceTableColumns, maintenanceUnitName, maintenancePriority, maintenanceCreated } from './propertyRecords.mjs';

const source = (path) => readFile(new URL(path, import.meta.url), 'utf8');

test('workflow maintenance rows resolve the unit by ID for multi-unit properties', () => {
  const property = { propertyType: 'MultiFamily', units: [{ id: 12, name: 'Suite B' }] };
  assert.equal(maintenanceUnitName({ unitId: 12 }, property), 'Suite B');
  assert.equal(maintenanceUnitName({ unitId: 13 }, property), '—');
  assert.deepEqual(maintenanceTableColumns(property).map(column => column.label), ['Request', 'Unit', 'Priority', 'Created', 'Status']);
});

test('single-unit home omits the unit column regardless of its internal unit record', () => {
  for (const type of ['SingleFamily', 'Single Family', 'Townhouse', 'Condominium', 'SingleUnit']) {
    assert.deepEqual(maintenanceTableColumns({ propertyType: type, units: [{ id: 12, name: 'Unit 1' }] }).map(column => column.label), ['Request', 'Priority', 'Created', 'Status']);
  }
});

test('maintenance priority and creation use workflow response fields, preserving legacy fallback', () => {
  assert.equal(maintenancePriority({ priority: 0 }), 'Low');
  assert.equal(maintenancePriority({ priority: 2 }), 'High');
  assert.equal(maintenancePriority({ priority: 'Medium' }), 'Medium');
  assert.equal(maintenanceCreated({ createdAtUtc: '2026-10-12T12:00:00Z' }), new Date('2026-10-12T12:00:00Z').toLocaleDateString());
  assert.equal(maintenanceCreated({ createdAt: '2026-10-11T12:00:00Z' }), new Date('2026-10-11T12:00:00Z').toLocaleDateString());
  assert.equal(maintenanceCreated({}), '—');
});

test('property maintenance table passes property-aware columns and backend exposes actual priority', async () => {
  const tabs = await source('./PropertyRecordsTabs.jsx');
  const dto = await source('../../../../../property-peace-api/Dtos/Maintenance/MaintenanceApiDtos.cs');
  const service = await source('../../../../../property-peace-api/Services/Maintenance/MaintenanceRequestApiService.cs');
  assert.match(tabs, /columns=\{maintenanceTableColumns\(property\)\}/);
  assert.match(dto, /EMaintenancePriority Priority/);
  assert.match(service, /request\.Priority, AsUtc\(request\.CreatedAt\)/);
});
