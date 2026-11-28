import test from 'node:test';
import assert from 'node:assert/strict';
import { buildReportComparisonPath, buildReportPath, formatHandoffProgress, getChecklistIntent, getLegacyReportPhase } from './leaseTransitionChecklists.mjs';
import { buildLeaseMoveInReadiness } from './leaseMoveIn.js';

test('returns to the originating checklist from its scoped report', () => {
  assert.equal(buildReportPath({ id: 12, propertyId: 3, unitId: 5 }, 9), '/landlord/checklists/property/3/unit/5/checklist/12?handoff=9');
  assert.equal(buildReportPath({ id: 12, propertyId: 3 }), '/landlord/checklists/property/3/checklist/12');
});

test('counts applicable tasks and only saved completion', () => {
  assert.deepEqual(formatHandoffProgress([{ status: 'done' }, { status: 'notApplicable' }, { status: 'pending' }]), { done: 1, total: 2, percent: 50 });
});

test('compares reports for the same rental and preserves legacy enum recognition', () => {
  const baseline = { id: 9, propertyId: 3, unitId: 5 };
  assert.equal(buildReportComparisonPath(baseline, { ...baseline, id: 12 }), '/landlord/checklists/property/3/unit/5/compare/9/12');
  assert.equal(buildReportComparisonPath(baseline, { ...baseline, id: 12, unitId: 8 }), null);
  assert.equal(getLegacyReportPhase('moveInChecklist'), 'moveIn');
  assert.equal(getLegacyReportPhase(41), 'moveOut');
  assert.equal(getLegacyReportPhase('conditionReport'), null);
});

test('only the allowlisted campaign intent can continue through registration', () => {
  assert.equal(getChecklistIntent('?intent=move-in-checklist'), 'move-in-checklist');
  assert.equal(getChecklistIntent('?intent=https://example.com'), null);
});

test('a historical inspection cannot mark a live handoff complete', () => {
  const evidence = { lease: { id: 7 }, checklists: [{ id: 2, leaseId: 7, checklistType: 40, isCompleted: true }] };
  const status = (transitionChecklists) => buildLeaseMoveInReadiness({ ...evidence, transitionChecklists }).steps.find((step) => step.key === 'checklist').status;
  assert.equal(status([]), 'pending');
  assert.equal(status(null), 'unavailable');
  assert.equal(status([{ leaseId: 7, phase: 'moveIn', items: [{ status: 'done' }] }]), 'complete');
});
