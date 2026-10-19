import assert from 'node:assert/strict';
import test from 'node:test';
import { inspectionDateDraft, parseInspectionDateDraft, checklistFormDraft, applyChecklistFormDraft } from '../src/features/checklists/checklistFormModel.ts';
import { withChecklistItemDetails } from '../src/features/checklists/checklistEditorModel.ts';

test('schedule prefill is local time and round trips to UTC, rejects invalid dates', () => {
  const date = new Date(2026, 5, 12, 9, 35).toISOString();
  assert.equal(inspectionDateDraft(date), '2026-06-12 09:35');
  assert.equal(parseInspectionDateDraft('2026-06-12 09:35'), date);
  assert.equal(parseInspectionDateDraft('2026-02-30 09:00'), null);
  assert.equal(parseInspectionDateDraft('2026-06-12 25:00'), null);
  assert.equal(parseInspectionDateDraft(''), null);
});

test('editing inspection metadata preserves existing associations and items', () => {
  const original = { id: 1, propertyId: 2, unitId: 3, leaseId: 4, tenantId: 5, counterpartChecklistId: 6, title: 'Walkthrough', inspectionDate: null, generalNotes: 'Old', conditionNotes: 'Old condition', items: [{ id: 7, condition: 'Good' }] };
  const draft = checklistFormDraft(original);
  assert.equal(draft.title, 'Walkthrough');
  assert.equal(draft.inspectionDate, '');
  const updated = applyChecklistFormDraft(original, { ...draft, title: 'New', inspectionDate: '2026-06-12 09:35', generalNotes: '  Note  ', conditionNotes: '  Condition  ' });
  assert.equal(updated.inspectionDate, parseInspectionDateDraft('2026-06-12 09:35'));
  assert.equal(updated.generalNotes, 'Note');
  assert.equal(updated.conditionNotes, 'Condition');
  for (const key of ['propertyId', 'unitId', 'leaseId', 'tenantId', 'counterpartChecklistId', 'items']) assert.deepEqual(updated[key], original[key]);
  assert.throws(() => applyChecklistFormDraft(original, { ...draft, inspectionDate: 'bad' }), /valid visit date/i);
  assert.throws(() => applyChecklistFormDraft(original, { ...draft, title: '   ' }), /title/i);
  assert.throws(() => applyChecklistFormDraft({ ...original, inspectionDate: '2026-06-12T09:35:00Z' }, draft), /cannot clear/i);
});

test('item notes are editable without losing the existing damage details', () => {
  const checklist = { items: [{ id: 1, notes: 'Before', damageDescription: 'Scratch', hasDamage: true }] };
  const updated = withChecklistItemDetails(checklist, 1, { notes: 'After', damageDescription: 'Scratch' });
  assert.equal(updated.items[0].notes, 'After');
  assert.equal(updated.items[0].damageDescription, 'Scratch');
});
