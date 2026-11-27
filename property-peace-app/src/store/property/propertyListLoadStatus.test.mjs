import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import { selectIsEmptyPropertyPortfolio, selectPropertiesLoadStatus } from './property.selector.js';

const source = (file) => readFileSync(new URL(file, import.meta.url), 'utf8')
  .replace(/^import .*;\r?\n/gm, '')
  .replace(/^export (?:default )?/gm, '');

function createStore() {
  const requests = [];
  const axios = { get: () => new Promise((resolve, reject) => requests.push({ resolve, reject })) };
  const { getProperties, propertyReducer } = new Function('axiosServices', 'console', `
    ${source('./property.types.js')}
    ${source('./property.action.js')}
    ${source('./property.reducer.js')}
    return { getProperties, propertyReducer };
  `)(axios, { log() {} });
  let property = propertyReducer(undefined, { type: 'init' });
  const dispatch = (action) => { property = propertyReducer(property, action); };

  return {
    status: (organizationId) => selectPropertiesLoadStatus({ property }, organizationId),
    isEmpty: (organizationId) => selectIsEmptyPropertyPortfolio({ property }, organizationId),
    load(organizationId) {
      const completion = getProperties(organizationId)(dispatch);
      const { resolve, reject } = requests.at(-1);
      return { completion, succeed: (properties) => resolve({ data: { data: properties } }), fail: reject };
    }
  };
}

test('property list stays pending until a successful response, including an empty portfolio', async () => {
  const store = createStore();
  assert.equal(store.status(null), 'pending');
  assert.equal(store.status(7), 'pending');
  const request = store.load(7);
  assert.equal(store.status(7), 'pending');
  request.succeed([]);
  await request.completion;
  assert.equal(store.status(7), 'ready');
  assert.equal(store.status(8), 'pending');
});

test('an empty portfolio is confirmed only by a successful current-organization load', async () => {
  const store = createStore();
  assert.equal(store.isEmpty(null), false);
  assert.equal(store.isEmpty(7), false);

  const empty = store.load(7);
  assert.equal(store.isEmpty(7), false);
  empty.succeed([]);
  await empty.completion;
  assert.equal(store.isEmpty(7), true);
  assert.equal(store.isEmpty(8), false);

  const populated = store.load(7);
  populated.succeed([{ id: 1 }]);
  await populated.completion;
  assert.equal(store.isEmpty(7), false);

  const failed = store.load(8);
  failed.fail(new Error('Offline'));
  await failed.completion;
  assert.equal(store.isEmpty(8), false);
  assert.equal(store.isEmpty(7), false);
});

test('the result of the latest request controls the current organization even with overlapping callers', async () => {
  const store = createStore();
  const superseded = store.load(7);
  const latest = store.load(7);
  superseded.succeed([{ id: 1 }]);
  await superseded.completion;
  assert.equal(store.status(7), 'pending');
  latest.fail(new Error('Offline'));
  await latest.completion;
  assert.equal(store.status(7), 'failed');
  assert.equal(store.status(8), 'pending');

  const retry = store.load(7);
  assert.equal(store.status(7), 'pending');
  retry.succeed([{ id: 1 }]);
  await retry.completion;
  assert.equal(store.status(7), 'ready');
});
