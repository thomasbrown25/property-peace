import test from 'node:test';
import assert from 'node:assert/strict';
import { maintenanceActionSelected, maintenanceActionUnavailable } from './maintenanceActionState.mjs';

const selected = (status) => ['acknowledge', 'assign', 'schedule', 'in-progress', 'await-tenant'].filter((key) => maintenanceActionSelected(key, status));

test('quick actions indicate cumulative acknowledge, in-progress and awaiting-tenant milestones', () => {
  assert.deepEqual(selected('Reported'), []);
  assert.deepEqual(selected('Acknowledged'), ['acknowledge']);
  assert.deepEqual(selected('InProgress'), ['acknowledge', 'in-progress']);
  assert.deepEqual(selected('AwaitingTenant'), ['acknowledge', 'in-progress', 'await-tenant']);
  assert.deepEqual(selected('Assigned'), ['acknowledge', 'assign']);
});

test('prior status and assignment actions remain available after advancing', () => {
  for (const status of ['InProgress', 'AwaitingTenant']) {
    assert.equal(maintenanceActionUnavailable('acknowledge', status, ''), false);
    assert.equal(maintenanceActionUnavailable('assign', status, ''), false);
  }
  assert.equal(maintenanceActionUnavailable('in-progress', 'AwaitingTenant', ''), false);
  assert.equal(maintenanceActionUnavailable('in-progress', 'InProgress', ''), true);
  assert.equal(maintenanceActionUnavailable('assign', 'Resolved', ''), true);
  assert.equal(maintenanceActionUnavailable('acknowledge', 'AwaitingTenant', 'status:InProgress'), true);
});
