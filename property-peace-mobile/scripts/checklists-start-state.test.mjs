import assert from 'node:assert/strict';
import test from 'node:test';

let model;
let loadError;
try {
  model = await import('../src/features/checklists/checklistOverviewModel.ts');
} catch (error) {
  loadError = error;
}

test('a precreated move-out remains unstarted until dated or edited', () => {
  assert.equal(loadError, undefined);
  assert.equal(model.isChecklistStarted({ inspectionDate: null, isCompleted: false, items: [] }), false);
  assert.equal(model.isChecklistStarted({ inspectionDate: null, isCompleted: false, items: [{ condition: 'Good' }] }), true);
  assert.equal(model.isChecklistStarted({ inspectionDate: '2026-08-22T12:00:00.000Z', items: [] }), true);
});
