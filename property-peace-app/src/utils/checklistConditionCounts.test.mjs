import assert from 'node:assert/strict';
import test from 'node:test';
import { countChecklistConditions } from './checklistConditionCounts.mjs';

test('counts each saved condition independently, ignoring unrated and unknown values', () => {
  const items = [
    { condition: 'Good' }, { condition: 'Good' }, { condition: 'NC' },
    { condition: 'NP' }, { condition: 'NR' }, { condition: 'NSC' },
    { condition: 'NSP' }, { condition: 'RP' }, { condition: null },
    { condition: '' }, { condition: 'Other' }
  ];
  assert.deepEqual(countChecklistConditions(items), {
    Good: 2, NC: 1, NP: 1, NR: 1, NSC: 1, NSP: 1, RP: 1
  });
  assert.deepEqual(countChecklistConditions([]), {
    Good: 0, NC: 0, NP: 0, NR: 0, NSC: 0, NSP: 0, RP: 0
  });
});
