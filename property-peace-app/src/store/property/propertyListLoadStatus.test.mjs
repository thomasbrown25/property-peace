import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import { createSelector } from '@reduxjs/toolkit';

const source = (file) => readFileSync(new URL(file, import.meta.url), 'utf8')
  .replace(/^import .*;\r?\n/gm, '')
  .replace(/^export (?:default )?/gm, '');

function createStore() {
  const requests = [];
  const axios = { get: () => new Promise((resolve, reject) => requests.push({ resolve, reject })) };
  const { getProperties, propertyReducer, selectPropertiesLoadStatus } = new Function('axiosServices', 'createSelector', 'console', `
    ${source('./property.types.js')}
    ${source('./property.action.js')}
    ${source('./property.reducer.js')}
    ${source('./property.selector.js')}
    return { getProperties, propertyReducer, selectPropertiesLoadStatus };
  `)(axios, createSelector, { log() {} });
  let property = propertyReducer(undefined, { type: 'init' });
  const dispatch = (action) => { property = propertyReducer(property, action); };

  return {
    status: (organizationId) => selectPropertiesLoadStatus({ property }, organizationId),
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
