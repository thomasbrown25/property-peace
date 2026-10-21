import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { test } from 'node:test';

import { validatePhotoSelection, createPhotoGallery } from './short-stay-photos.js';

const root = new URL('../../api/shortStay.js', import.meta.url);
const page = new URL('./short-stay-setup.jsx', import.meta.url);
const file = (type = 'image/png', size = 100) => ({ type, size });

test('validates photo selection before upload', () => {
  assert.equal(validatePhotoSelection([file()], 0).length, 1);
  for (const [files, count, pattern] of [
    [[], 0, /Select/], [Array(6).fill(file()), 0, /5/], [[file()], 20, /20/],
    [[file('image/gif')], 0, /PNG or JPEG/], [[file('image/jpeg', 5 * 1024 * 1024 + 1)], 0, /5 MB/]
  ]) assert.throws(() => validatePhotoSelection(files, count), pattern);
});

test('gallery loads only when draft exists, refreshes after mutations and ignores stale results', async () => {
  let resolveFirst;
  const updates = [];
  let loads = 0;
  const api = {
    getPhotos: () => { loads++; return loads === 1 ? new Promise((resolve) => { resolveFirst = resolve; }) : Promise.resolve([{ id: loads, url: 'signed' }]); },
    uploadPhotos: async () => {}, setCoverPhoto: async () => {}, deletePhoto: async () => {}
  };
  const gallery = createPhotoGallery({ api, unitId: 42, update: (state) => updates.push(state) });
  await gallery.load(false);
  assert.equal(loads, 0);
  gallery.activate();
  const pending = gallery.load(true);
  gallery.invalidate();
  resolveFirst([{ id: 1, url: 'expired' }]);
  await pending;
  assert.ok(!updates.some((state) => state.photos?.[0]?.url === 'expired'));
  gallery.activate();
  await gallery.load(true);
  assert.equal(updates.at(-1).loading, false);
  await gallery.upload([file()]);
  await gallery.cover(2);
  await gallery.remove(2);
  assert.equal(loads, 5);
});

test('gallery surfaces backend errors and does not keep stale signed links after a failed refresh', async () => {
  const updates = [];
  let fail = false;
  const gallery = createPhotoGallery({ unitId: 1, api: {
    getPhotos: async () => { if (fail) throw { message: 'Access denied' }; return [{ id: 1, url: 'signed' }]; },
    deletePhoto: async () => { throw { message: 'Cannot delete cover' }; }
  }, update: (state) => updates.push(state) });
  gallery.activate();
  await gallery.load(true);
  await assert.rejects(gallery.remove(1), { message: 'Cannot delete cover' });
  fail = true;
  await gallery.load(true);
  assert.ok(updates.some((state) => state.error === 'Access denied'));
  assert.deepEqual(updates.filter((state) => 'photos' in state).at(-1).photos, []);
});

test('photo API uses authenticated client, multipart files, no-store and encoded identifiers', async () => {
  const source = (await readFile(root, 'utf8')).replace("import axios from 'utils/axios';", 'const axios = globalThis.__photoAxios;');

  const calls = [];
  globalThis.__photoAxios = Object.fromEntries(['get', 'post', 'put', 'delete'].map((method) => [method, async (...args) => {
    calls.push([method, ...args]); return { data: { success: true, data: method === 'get' ? [] : null } };
  }]));
  try {
    const { shortStayAPI } = await import(`data:text/javascript;base64,${Buffer.from(source).toString('base64')}`);
    await shortStayAPI.getPhotos('12/3');
    await shortStayAPI.uploadPhotos('12/3', [new Blob(['a'], { type: 'image/png' }), new Blob(['b'], { type: 'image/jpeg' })]);
    await shortStayAPI.setCoverPhoto('12/3', '4/5');
    await shortStayAPI.deletePhoto('12/3', '4/5');
    assert.equal(calls[0][1], '/api/short-stay/units/12%2F3/listing/photos');
    assert.equal(calls[0][2].headers['Cache-Control'], 'no-store');
    assert.equal(calls[0][2].headers.Pragma, 'no-cache');
    assert.deepEqual([...calls[1][2].keys()], ['files', 'files']);
    assert.equal(calls[1][3]?.headers?.['Content-Type'], undefined); // browser sets multipart boundary
    assert.equal(calls[2][1], '/api/short-stay/units/12%2F3/listing/photos/4%2F5/cover');
    assert.equal(calls[3][1], '/api/short-stay/units/12%2F3/listing/photos/4%2F5');
  } finally { delete globalThis.__photoAxios; }
});

test('owner page gates photo controls by persisted draft and binds gallery actions', async () => {
  const source = await readFile(page, 'utf8');
  assert.match(source, /listingExists\s*&&\s*<Paper/);
  assert.match(source, /gallery\.upload\(/);
  assert.match(source, /gallery\.cover\(/);
  assert.match(source, /gallery\.remove\(/);
  assert.doesNotMatch(source, /localStorage|sessionStorage/);
});
