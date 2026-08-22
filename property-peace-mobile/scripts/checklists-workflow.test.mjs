import assert from 'node:assert/strict';
import test from 'node:test';

let workflow;
let transport;
let loadError;

try {
  workflow = await import('../src/features/checklists/checklistWorkflow.ts');
  transport = await import('../src/features/checklists/checklistTransportModel.ts');
} catch (error) {
  loadError = error;
}

const required = () => {
  assert.equal(loadError, undefined);
  return { ...workflow, ...transport };
};

const home = {
  propertyId: '7',
  propertyName: 'Maple House',
  unitId: '8',
  unitName: 'Unit A',
};

const fixedNow = '2026-08-22T12:00:00.000Z';

const gatewayFrom = (responses, failMethod) => {
  const calls = [];
  const removed = [];
  let index = 0;
  const invoke = async (method, ...args) => {
    calls.push({ method, args });
    if (failMethod === `${method}:${calls.filter((call) => call.method === method).length}`) {
      throw new Error(`failed ${method}`);
    }
    return responses[index++];
  };
  return {
    calls,
    removed,
    gateway: {
      create: (payload) => invoke('create', payload),
      update: (id, payload) => invoke('update', id, payload),
      remove: async (id) => {
        calls.push({ method: 'remove', args: [id] });
        removed.push(id);
      },
    },
  };
};

test('request paths preserve checklist scope and encode image blob names', () => {
  const { checklistCollectionPath, checklistItemImagePath, checklistItemImageDeletePath } = required();
  assert.equal(checklistCollectionPath('property', 7), '/api/Checklist/property/7');
  assert.equal(checklistCollectionPath('unit', 'unit A'), '/api/Checklist/unit/unit%20A');
  assert.equal(checklistItemImagePath(10, 11), '/api/Checklist/10/items/11/upload-image');
  assert.equal(
    checklistItemImageDeletePath(10, 11, 'room/a photo.jpg'),
    '/api/Checklist/10/items/11/images/room%2Fa%20photo.jpg',
  );
});

test('starting move in creates and links a paired move out in order', async () => {
  const { startChecklistCycle } = required();
  const pair = gatewayFrom([
    { id: 10, checklistType: 40, title: 'Move in', items: [] },
    { id: 11, checklistType: 41, title: 'Move out', counterpartChecklistId: 10, items: [] },
    { id: 10, checklistType: 40, title: 'Move in', counterpartChecklistId: 11, items: [] },
  ]);
  const result = await startChecklistCycle({ type: 40, home, now: fixedNow }, pair.gateway);
  assert.deepEqual(pair.calls.map(({ method }) => method), ['create', 'create', 'update']);
  assert.equal(pair.calls[0].args[0].ChecklistType, 40);
  assert.equal(pair.calls[0].args[0].InspectionDate, fixedNow);
  assert.equal(pair.calls[1].args[0].ChecklistType, 41);
  assert.equal(pair.calls[1].args[0].InspectionDate, null);
  assert.equal(pair.calls[2].args[1].CounterpartChecklistId, 11);
  assert.equal(result.primary.id, 10);
  assert.equal(result.counterpart.id, 11);
});

test('default checklist payload exactly mirrors the web room template', async () => {
  const { startChecklistCycle } = required();
  const pair = gatewayFrom([
    { id: 20, checklistType: 41, items: [] },
  ]);
  await startChecklistCycle({ type: 41, home, now: fixedNow }, pair.gateway);
  const payload = pair.calls[0].args[0];
  assert.deepEqual(payload.RoomNames, ['Kitchen', 'Living Room', 'Bedroom', 'Bathroom', 'Laundry', 'General']);
  assert.equal(payload.Items.length, 34);
  assert.deepEqual(payload.Items[0], {
    Name: 'Walls & Ceiling', Category: 'Kitchen', SortOrder: 0,
  });
  assert.deepEqual(payload.Items.at(-1), {
    Name: 'Keys & Access Cards', Category: 'General', SortOrder: 33,
  });
});

test('starting a missing side copies structure but clears inspection evidence', async () => {
  const { startChecklistCycle } = required();
  const counterpart = {
    id: 30,
    checklistType: 40,
    propertyId: 7,
    unitId: 8,
    leaseId: 12,
    tenantId: 13,
    roomNames: ['Kitchen'],
    items: [{
      id: 31,
      name: 'Floors',
      category: 'Kitchen',
      sortOrder: 4,
      condition: 'NR',
      notes: 'Old evidence',
      photoBlobNames: ['old.jpg'],
      isChecked: true,
    }],
  };
  const pair = gatewayFrom([
    { id: 32, checklistType: 41, counterpartChecklistId: 30, items: [] },
    { ...counterpart, counterpartChecklistId: 32 },
  ]);
  const result = await startChecklistCycle({ type: 41, home, now: fixedNow, counterpart }, pair.gateway);
  assert.deepEqual(pair.calls.map(({ method }) => method), ['create', 'update']);
  assert.deepEqual(pair.calls[0].args[0].Items, [{
    Name: 'Floors', Category: 'Kitchen', SortOrder: 4,
  }]);
  assert.equal(pair.calls[0].args[0].LeaseId, 12);
  assert.equal(pair.calls[0].args[0].TenantId, 13);
  assert.equal(result.primary.id, 32);
  assert.equal(result.counterpart.id, 30);
});

test('pair link failure removes both records created by the attempt in reverse order', async () => {
  const { startChecklistCycle } = required();
  const pair = gatewayFrom([
    { id: 40, checklistType: 40, items: [] },
    { id: 41, checklistType: 41, items: [] },
  ], 'update:1');
  await assert.rejects(
    startChecklistCycle({ type: 40, home, now: fixedNow }, pair.gateway),
    /failed update/,
  );
  assert.deepEqual(pair.removed, [41, 40]);
});
