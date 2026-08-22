import assert from 'node:assert/strict';
import test from 'node:test';

let model;
let loadError;

try {
  model = await import('../src/features/checklists/checklistOverviewModel.ts');
} catch (error) {
  loadError = error;
}

const required = () => {
  assert.equal(loadError, undefined);
  return model;
};

test('overview sides expose condition progress and completion state', () => {
  const { buildChecklistOverviewCards } = required();
  const cards = buildChecklistOverviewCards([{ id: 'cycle-1', moveIn: {
    id: 1,
    checklistType: 40,
    title: 'Move in',
    items: [{ id: 1, name: 'Walls', condition: 'Good' }, { id: 2, name: 'Floors', condition: '' }],
  }, moveOut: null }]);
  assert.deepEqual(cards[0].moveIn, {
    checklistId: '1',
    label: 'Move-in',
    title: 'Move in',
    done: 1,
    total: 2,
    percent: 50,
    complete: false,
    date: null,
    tenantName: '',
  });
  assert.equal(cards[0].moveOut, null);
});

test('completed overview side reports 100 percent even when API completion flag is stale', () => {
  const { buildChecklistOverviewCards } = required();
  const cards = buildChecklistOverviewCards([{ id: 'cycle-2', moveIn: null, moveOut: {
    id: 2,
    checklistType: 41,
    title: 'Move out',
    inspectionDate: '2026-08-22T12:00:00.000Z',
    tenantName: 'Alex Smith',
    isCompleted: false,
    items: [{ id: 3, name: 'Walls', condition: 'Good' }],
  } }]);
  assert.equal(cards[0].moveOut.percent, 100);
  assert.equal(cards[0].moveOut.complete, true);
  assert.equal(cards[0].moveOut.tenantName, 'Alex Smith');
});

test('history scope chooses the unit endpoint only when a unit is selected', () => {
  const { checklistHistoryScope } = required();
  assert.deepEqual(checklistHistoryScope({ propertyId: '7', propertyName: 'Maple' }), { scope: 'property', id: '7' });
  assert.deepEqual(checklistHistoryScope({ propertyId: '7', propertyName: 'Maple', unitId: '8' }), { scope: 'unit', id: '8' });
});

test('active lease lookup uses the selected unit when one is present', () => {
  const { activeLeaseScope } = required();
  assert.deepEqual(activeLeaseScope({ propertyId: '7', propertyName: 'Maple' }), { scope: 'property', id: '7' });
  assert.deepEqual(activeLeaseScope({ propertyId: '7', propertyName: 'Maple', unitId: '9' }), { scope: 'unit', id: '9' });
});

test('selected-unit lease lookup accepts only the exact active unit lease', () => {
  const { selectChecklistLease } = required();
  const active = { id: 5, unitId: 9, isActive: true };
  assert.equal(selectChecklistLease(active, '9'), active);
  assert.equal(selectChecklistLease({ ...active, isActive: false }, '9'), null);
  assert.equal(selectChecklistLease({ ...active, unitId: 10 }, '9'), null);
  assert.deepEqual(
    selectChecklistLease({ Id: 6, UnitId: 9, IsActive: true }, '9'),
    { Id: 6, UnitId: 9, IsActive: true },
  );
  const propertyLease = { id: 7, isActive: false };
  assert.equal(selectChecklistLease(propertyLease), propertyLease);
});
