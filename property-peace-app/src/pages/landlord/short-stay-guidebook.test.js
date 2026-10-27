import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { createGuidebookDraft, guidebookPayload } from './short-stay-guidebook.js';

const deferred = () => { let resolve; let reject; const promise = new Promise((yes, no) => { resolve = yes; reject = no; }); return { promise, resolve, reject }; };
const last = (updates) => Object.assign({}, ...updates);

test('API uses authenticated client and exact owner draft contract, with no-store and error unwrapping', async () => {
  const source = (await readFile(new URL('../../api/shortStay.js', import.meta.url), 'utf8')).replace("import axios from 'utils/axios';", 'const axios = globalThis.__guidebookAxios;');
  const calls = [];
  globalThis.__guidebookAxios = {
    get: async (...args) => { calls.push(['get', ...args]); return { data: { success: true, data: null } }; },
    put: async (...args) => { calls.push(['put', ...args]); return { data: { success: true, data: { unitId: 12, ...args[1] } } }; },
    delete: async (...args) => { calls.push(['delete', ...args]); return { data: { success: true, data: null } }; }
  };
  try {
    const { shortStayAPI } = await import(`data:text/javascript;base64,${Buffer.from(source).toString('base64')}`);
    assert.equal(await shortStayAPI.getGuidebookDraft('12/3'), null);
    const body = { houseRules: 'Quiet', arrivalOverview: '', localNotes: 'Park nearby' };
    assert.deepEqual(await shortStayAPI.saveGuidebookDraft('12/3', body), { unitId: 12, ...body });
    assert.equal(await shortStayAPI.deleteGuidebookDraft('12/3'), null);
    assert.deepEqual(calls.map(([method, url]) => [method, url]), [
      ['get', '/api/short-stay/units/12%2F3/guidebook-draft'],
      ['put', '/api/short-stay/units/12%2F3/guidebook-draft'],
      ['delete', '/api/short-stay/units/12%2F3/guidebook-draft']
    ]);
    assert.deepEqual(calls[1][2], body);
    for (const call of calls) assert.equal(call.at(-1).headers['Cache-Control'], 'no-store');
    globalThis.__guidebookAxios.put = async () => ({ data: { success: false, statusCode: 400, message: 'Invalid guidebook draft' } });
    await assert.rejects(shortStayAPI.saveGuidebookDraft('12', body), (err) => err.status === 400 && err.message === 'Invalid guidebook draft');
    globalThis.__guidebookAxios.delete = async () => ({ data: { success: false, statusCode: 403, message: 'Not owner' } });
    await assert.rejects(shortStayAPI.deleteGuidebookDraft('12'), (err) => err.status === 403 && err.message === 'Not owner');
  } finally { delete globalThis.__guidebookAxios; }
});

test('payload accepts plain text and clears all fields, rejects unsafe content and overlong text', () => {
  assert.deepEqual(guidebookPayload({ houseRules: 'Quiet\nplease', arrivalOverview: '', localNotes: 'Museum' }), { houseRules: 'Quiet\nplease', arrivalOverview: '', localNotes: 'Museum' });
  assert.deepEqual(guidebookPayload({}), { houseRules: '', arrivalOverview: '', localNotes: '' });
  assert.doesNotThrow(() => guidebookPayload({ localNotes: 'a'.repeat(2000) }));
  for (const text of ['a'.repeat(2001), '<script>bad</script>', 'Door code 1234', 'email me at a@b.com', 'wifi password', 'x\u0000']) {
    assert.throws(() => guidebookPayload({ houseRules: text }), /plain text|2000|sensitive/i);
  }
});

test('loads null as empty, errors allow retry, save shows success and only sends safe fields', async () => {
  const updates = []; let reads = 0; const sent = [];
  const editor = createGuidebookDraft({ unitId: '8', api: {
    getGuidebookDraft: async () => { if (++reads === 1) throw new Error('Unavailable'); return null; },
    saveGuidebookDraft: async (id, body) => { sent.push([id, body]); return { unitId: 8, ...body }; }
  }, update: (change) => updates.push(change) });
  editor.activate();
  await editor.load();
  assert.match(last(updates).error, /Unavailable/);
  await editor.load();
  assert.deepEqual(last(updates).draft, { houseRules: '', arrivalOverview: '', localNotes: '' });
  await editor.save({ houseRules: 'Quiet', arrivalOverview: '', localNotes: '', secret: 'never send' });
  assert.deepEqual(sent, [['8', { houseRules: 'Quiet', arrivalOverview: '', localNotes: '' }]]);
  assert.match(last(updates).notice, /saved/i);
});

test('validation and service failures never claim success or send unsafe content', async () => {
  const updates = []; let calls = 0;
  const editor = createGuidebookDraft({ unitId: '8', api: {
    getGuidebookDraft: async () => null,
    saveGuidebookDraft: async () => { calls++; throw { status: 400, message: 'Invalid guidebook draft' }; }
  }, update: (change) => updates.push(change) });
  editor.activate(); await editor.load();
  await editor.save({ houseRules: 'door code 1234' });
  assert.equal(calls, 0);
  assert.match(last(updates).error, /plain text/i);
  await editor.save({ houseRules: 'Quiet' });
  assert.equal(calls, 1);
  assert.match(last(updates).error, /Invalid guidebook draft/);
  assert.equal(last(updates).notice, '');
  assert.deepEqual(last(updates).draft, { houseRules: '', arrivalOverview: '', localNotes: '' });
});

test('stale loads, pending saves and old-route completions cannot overwrite current editor', async () => {
  const first = deferred(); const save = deferred(); const updates = [];
  let reads = 0;
  const editor = createGuidebookDraft({ unitId: '8', api: {
    getGuidebookDraft: () => ++reads === 1 ? first.promise : Promise.resolve({ unitId: 8, houseRules: 'New' }),
    saveGuidebookDraft: () => save.promise
  }, update: (change) => updates.push(change) });
  editor.activate();
  const old = editor.load();
  await editor.load();
  first.resolve({ unitId: 8, houseRules: 'Old' }); await old;
  assert.equal(last(updates).draft.houseRules, 'New');
  const writing = editor.save({ houseRules: 'Updated' });
  editor.invalidate();
  save.resolve({ unitId: 8, houseRules: 'Updated' }); await writing;
  assert.equal(last(updates).notice, '');
  const other = deferred(); const otherUpdates = [];
  const oldRoute = createGuidebookDraft({ unitId: '9', api: { getGuidebookDraft: () => other.promise }, update: (change) => otherUpdates.push(change) });
  oldRoute.activate(); const request = oldRoute.load(); oldRoute.invalidate(); other.resolve({ unitId: 9, houseRules: 'stale' }); await request;
  assert.equal(last(otherUpdates).draft, null);
});

test('unit mismatch is rejected; component labels private draft and does not expose guest publishing', async () => {
  const updates = [];
  const editor = createGuidebookDraft({ unitId: '8', api: { getGuidebookDraft: async () => ({ unitId: 9, houseRules: 'Other org' }) }, update: (change) => updates.push(change) });
  editor.activate(); await editor.load();
  assert.equal(last(updates).draft, null);
  assert.match(last(updates).error, /unit/i);
  const page = await readFile(new URL('./short-stay-setup.jsx', import.meta.url), 'utf8');
  assert.match(page, /Private owner guidebook draft/);
  assert.match(page, /guidebookController\.load\(\)/);
  assert.match(page, /guidebookController\.save\(/);
  assert.doesNotMatch(page, /Publish guidebook|guest guidebook/i);
});

test('discard only applies to a persisted draft; blank saves never delete', async () => {
  const updates = []; const calls = []; let stored = null;
  const editor = createGuidebookDraft({ unitId: '8', api: {
    getGuidebookDraft: async () => stored,
    saveGuidebookDraft: async (id, body) => { calls.push(['put', id, body]); stored = { unitId: 8, ...body }; return stored; },
    deleteGuidebookDraft: async (id) => { calls.push(['delete', id]); stored = null; return null; }
  }, update: (change) => updates.push(change) });
  editor.activate(); await editor.load();
  assert.equal(last(updates).exists, false);
  await editor.discard();
  assert.deepEqual(calls, []);
  await editor.save({});
  assert.deepEqual(calls.map(([method]) => method), ['put']);
  assert.equal(last(updates).exists, true);
  await editor.discard();
  assert.deepEqual(calls.map(([method]) => method), ['put', 'delete']);
  assert.equal(last(updates).exists, false);
  assert.deepEqual(last(updates).draft, { houseRules: '', arrivalOverview: '', localNotes: '' });
  assert.match(last(updates).notice, /discarded/i);
  await editor.discard();
  assert.equal(calls.length, 2);
});

test('failed discard preserves local edits and persisted status for retry', async () => {
  const updates = []; let attempts = 0;
  const editor = createGuidebookDraft({ unitId: '8', api: {
    getGuidebookDraft: async () => ({ unitId: 8, houseRules: 'Stored' }),
    deleteGuidebookDraft: async () => { attempts++; throw new Error('Deletion failed'); }
  }, update: (change) => updates.push(change) });
  editor.activate(); await editor.load();
  updates.push({ draft: { houseRules: 'Unsaved edit', arrivalOverview: '', localNotes: '' } });
  await editor.discard();
  assert.equal(attempts, 1);
  assert.equal(last(updates).draft.houseRules, 'Unsaved edit');
  assert.equal(last(updates).exists, true);
  assert.equal(last(updates).busy, false);
  assert.match(last(updates).error, /Deletion failed/);
});

test('pending discard cannot update old route or race with save', async () => {
  const deletion = deferred(); const updates = []; let saves = 0;
  const editor = createGuidebookDraft({ unitId: '8', api: {
    getGuidebookDraft: async () => ({ unitId: 8, houseRules: 'Stored' }),
    deleteGuidebookDraft: () => deletion.promise,
    saveGuidebookDraft: async () => { saves++; }
  }, update: (change) => updates.push(change) });
  editor.activate(); await editor.load();
  const pending = editor.discard();
  await editor.save({ houseRules: 'Another' });
  assert.equal(saves, 0);
  editor.invalidate();
  deletion.resolve(null); await pending;
  assert.equal(last(updates).draft.houseRules, 'Stored');
  assert.equal(last(updates).notice, '');
});

test('owner editor offers explicit permanent confirmation only for persisted draft', async () => {
  const page = await readFile(new URL('./short-stay-setup.jsx', import.meta.url), 'utf8');
  assert.match(page, /guidebook\.exists\s*&&[\s\S]*?Discard guidebook draft/);
  assert.match(page, /window\.confirm\([^)]*permanent[^)]*\)/i);
  assert.match(page, /if\s*\(window\.confirm\([^)]*\)\)\s*guidebookController\.discard\(\)/);
});
