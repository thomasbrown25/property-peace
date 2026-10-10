import assert from 'node:assert/strict';
import test from 'node:test';
import { createConditionSaveQueue } from './checklistConditionSaveQueue.mjs';

const deferred = () => {
  let resolve;
  let reject;
  const promise = new Promise((res, rej) => { resolve = res; reject = rej; });
  return { promise, resolve, reject };
};
const tick = () => new Promise((resolve) => setImmediate(resolve));

test('selects immediately, serializes rapid choices and saves latest intent', async () => {
  const requests = [];
  const selections = [];
  const queue = createConditionSaveQueue({
    initialCondition: null,
    onSelectionChange: (value) => selections.push(value),
    save: (value) => { const request = deferred(); requests.push({ value, ...request }); return request.promise; },
    onError: () => assert.fail('unexpected error')
  });
  queue.select('Good');
  assert.equal(queue.getSelection(), 'Good');
  assert.deepEqual(requests.map(({ value }) => value), ['Good']);
  queue.select('NC');
  queue.select('NP');
  assert.equal(queue.getSelection(), 'NP');
  assert.deepEqual(requests.map(({ value }) => value), ['Good']);
  requests[0].resolve();
  await tick();
  assert.deepEqual(requests.map(({ value }) => value), ['Good', 'NP']);
  requests[1].resolve();
  await queue.whenIdle();
  assert.equal(queue.getSelection(), 'NP');
  assert.deepEqual(selections, ['Good', 'NC', 'NP']);
});

test('a second click clears immediately and a failed save rolls back to the last confirmed condition', async () => {
  const request = deferred();
  const errors = [];
  const queue = createConditionSaveQueue({
    initialCondition: 'Good',
    onSelectionChange: () => {},
    save: () => request.promise,
    onError: (error) => errors.push(error.message)
  });
  queue.select('Good');
  assert.equal(queue.getSelection(), null);
  request.reject(new Error('Network unavailable'));
  await queue.whenIdle();
  assert.equal(queue.getSelection(), 'Good');
  assert.deepEqual(errors, ['Network unavailable']);
});

test('a parent refresh does not overwrite an in-flight choice', async () => {
  const request = deferred();
  const queue = createConditionSaveQueue({ initialCondition: null, onSelectionChange: () => {}, save: () => request.promise, onError: () => {} });
  queue.select('NR');
  queue.sync(null);
  assert.equal(queue.getSelection(), 'NR');
  request.resolve();
  await queue.whenIdle();
  queue.sync('NR');
  assert.equal(queue.getSelection(), 'NR');
});
