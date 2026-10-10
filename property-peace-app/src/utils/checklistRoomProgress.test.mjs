import assert from 'node:assert/strict';
import test from 'node:test';
import { getRoomProgress, getRoomTone } from './checklistRoomProgress.mjs';

const item = (condition, extra = {}) => ({ condition, ...extra });

test('all rated conditions count as completed, including warnings and repairs', () => {
  const items = [item('Good'), item('NC'), item('NP'), item('NSC'), item('NSP'), item('NR'), item('RP'), item(null)];
  assert.deepEqual(getRoomProgress(items), { total: 8, done: 7, pct: 88 });
  assert.equal(getRoomTone(items), 'error');
  assert.deepEqual(getRoomProgress([item(null, { isChecked: true }), item(null, { IsChecked: true })]), { total: 2, done: 2, pct: 100 });
});

test('repair/replacement takes precedence over warning regardless of item order', () => {
  for (const condition of ['NR', 'RP']) {
    assert.equal(getRoomTone([item('Good'), item('NC'), item(condition)]), 'error');
    assert.equal(getRoomTone([item(condition), item('NP')]), 'error');
  }
});

test('cleaning and painting ratings give warning, even when the room is complete', () => {
  for (const condition of ['NC', 'NP', 'NSC', 'NSP']) {
    assert.equal(getRoomTone([item('Good'), item(condition)]), 'warning');
    assert.equal(getRoomProgress([item('Good'), item(condition)]).pct, 100);
  }
});

test('only Good produces a green completed room; incomplete and empty rooms remain neutral', () => {
  assert.equal(getRoomTone([item('Good'), item('Good')]), 'success');
  assert.equal(getRoomTone([item('Good'), item(null)]), 'neutral');
  assert.equal(getRoomTone([item(null)]), 'neutral');
  assert.equal(getRoomTone([]), 'neutral');
  assert.equal(getRoomTone([item(null, { isChecked: true })]), 'neutral');
});
