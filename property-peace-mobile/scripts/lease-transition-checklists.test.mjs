import assert from 'node:assert/strict';
import test from 'node:test';
import { readFileSync } from 'node:fs';

const overviewSource = readFileSync(new URL('../src/screens/landlord/PropertyChecklistsScreen.tsx', import.meta.url), 'utf8');
const detailSource = readFileSync(new URL('../src/screens/landlord/LeaseTransitionChecklistScreen.tsx', import.meta.url), 'utf8');
const transitionModelSource = readFileSync(new URL('../src/features/checklists/leaseTransitionChecklistModel.ts', import.meta.url), 'utf8');

let model;
let loadError;

try {
  model = await import('../src/features/checklists/leaseTransitionChecklistModel.ts');
} catch (error) {
  loadError = error;
}

const required = () => {
  assert.equal(loadError, undefined);
  return model;
};

test('builds a move-in checklist with a required condition report task', () => {
  const { normalizeTransitionChecklist } = required();
  const draft = normalizeTransitionChecklist({
    phase: 'moveIn', propertyId: '7', unitId: '8', unitName: 'Unit B', leaseId: '9',
    items: [{ key: 'condition-report', allowNotApplicable: false }, { key: 'utilities', allowNotApplicable: true }],
  });
  assert.equal(draft.phase, 'moveIn');
  assert.equal(draft.propertyId, '7');
  assert.equal(draft.items.some((item) => item.key === 'condition-report' && item.required), true);
  assert.equal(draft.items.find((item) => item.key === 'utilities').required, false);
  assert.equal(draft.unitName, 'Unit B');
});

test('counts completed ordinary tasks and the completed linked report', () => {
  const { getTransitionChecklistProgress } = required();
  const progress = getTransitionChecklistProgress({
    items: [
      { key: 'lease', status: 'Done' },
      { key: 'funds', status: 'NotApplicable' },
      { key: 'condition-report', status: 'Pending', required: true },
    ],
    conditionReport: { id: 44, isCompleted: true },
  });
  assert.deepEqual(progress, { done: 2, total: 2, percent: 100, complete: true });
});

test('keeps an incomplete report task pending', () => {
  const { getTransitionChecklistProgress } = required();
  const progress = getTransitionChecklistProgress({
    items: [{ key: 'condition-report', status: 'Done', required: true }],
    conditionReport: { id: 44, isCompleted: false },
  });
  assert.deepEqual(progress, { done: 0, total: 1, percent: 0, complete: false });
});

test('normalizes server checklist fields and chooses the linked report action', () => {
  const { normalizeTransitionChecklist, conditionReportAction } = required();
  const checklist = normalizeTransitionChecklist({
    Id: 10,
    Phase: 'moveOut',
    PropertyId: 7,
    UnitId: 8,
    ConditionReport: { Id: 11, IsCompleted: false, Title: 'Condition report' },
    Items: [{ Key: 'condition-report', Label: 'Complete condition report', Status: 'pending', AllowNotApplicable: false }],
  });
  assert.equal(checklist.id, 10);
  assert.equal(checklist.conditionReport?.id, 11);
  assert.deepEqual(conditionReportAction(checklist), { kind: 'continue', label: 'Continue report', reportId: '11' });
});

test('mobile checklist entry separates handoff tasks from condition reports', () => {
  assert.match(overviewSource, /Start move-in checklist/);
  assert.match(overviewSource, /Start move-out checklist/);
  assert.match(overviewSource, /Start condition report/);
  assert.match(transitionModelSource, /Continue report/);
  assert.match(detailSource, /Mark not applicable/);
  assert.match(detailSource, /Detach report/);
  assert.match(detailSource, /Use an existing condition record or start a new report/);
  assert.match(detailSource, /reportCandidates\.map/);
  assert.match(detailSource, /getTransitionChecklistById/);
  assert.doesNotMatch(overviewSource, /startMissing\(/);
});
