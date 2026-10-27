import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import vm from 'node:vm';
const require = createRequire(import.meta.url);
const ts = require('typescript');
import { validatePhotoSelection, toPhotoUpload, orderedPhotos } from '../src/features/properties/shortStayPhotos.ts';
const source = path => readFileSync(new URL(path, import.meta.url), 'utf8');
const jpg = { uri: 'file:///a.jpg', mimeType: 'image/jpeg', fileSize: 1024, fileName: 'a.jpg' };
test('photo selection enforces JPEG/PNG, size, batch and listing limits before upload', () => {
  assert.equal(validatePhotoSelection([jpg], 0), null);
  assert.match(validatePhotoSelection([{ ...jpg, mimeType: 'image/heic' }], 0), /JPEG or PNG/);
  assert.match(validatePhotoSelection([{ ...jpg, mimeType: 'image/png', fileSize: 5 * 1024 * 1024 + 1 }], 0), /5 MB/);
  assert.match(validatePhotoSelection([{ ...jpg, fileSize: undefined }], 0), /size/);
  assert.match(validatePhotoSelection([jpg], 20), /20/);
  assert.match(validatePhotoSelection(Array(6).fill(jpg), 0), /5/);
  assert.deepEqual(toPhotoUpload({ ...jpg, mimeType: 'image/png', fileName: 'something.heic' }, 0), { uri: jpg.uri, name: 'listing-0.png', type: 'image/png' });
  assert.deepEqual(orderedPhotos([{ id: 2, displayOrder: 3 }, { id: 1, displayOrder: 0 }]).map(p => p.id), [1, 2]);
});
test('owner photo API maps authenticated owner endpoints and native multipart without forced content-type', () => {
  const api = source('../src/api/shortStayAPI.ts');
  const client = source('../src/services/apiClient.ts');
  assert.match(api, /getPhotos\(unitId/);
  assert.match(api, /post<ApiResponse<[^>]+>>\(`\$\{unitPath\(unitId\)\}\/listing\/photos`, body\)/);
  assert.match(api, /body\.append\('files'/);
  assert.match(api, /\/\$\{photoId\}\/cover/);
  assert.match(api, /deletePhoto\(unitId/);
  assert.match(api, /Cache-Control.*no-store/);
  assert.doesNotMatch(api, /multipart\/form-data|fetch\(|AsyncStorage/);
  assert.match(client, /'X-Organization-Id'/);
  assert.match(client, /'Content-Type': undefined/);
});
test('photo API unwraps ServiceResponse and sends exact paths and file parts through shared client', async () => {
  const calls = [];
  const http = Object.fromEntries(['get', 'post', 'put', 'delete'].map(method => [method, async (...args) => { calls.push({ method, args }); return { success: true, data: method === 'get' ? [{ id: 9, displayOrder: 0, isCoverPhoto: true, url: 'signed-url' }] : method === 'post' ? [9] : true }; }]));
  class Multipart { parts = []; append(...args) { this.parts.push(args); } }
  const compiled = ts.transpileModule(source('../src/api/shortStayAPI.ts'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText;
  const exports = {};
  vm.runInNewContext(compiled, { exports, FormData: Multipart, require: id => id === '../services/apiClient' ? { __esModule: true, default: http } : id === '../features/properties/shortStayOwner' ? { validLocalRange() {}, parseLocalDate() {}, listingPayload() {}, ratePayload() {} } : (() => { throw Error(id); })() });
  const api = exports.default;
  assert.equal((await api.getPhotos('123')).at(0).url, 'signed-url');
  assert.deepEqual(Array.from(await api.uploadPhotos('123', [toPhotoUpload(jpg, 0)])), [9]);
  await api.setCover('123', 9);
  await api.deletePhoto('123', 9);
  assert.deepEqual(calls.map(c => [c.method, c.args[0]]), [
    ['get', '/api/short-stay/units/123/listing/photos'],
    ['post', '/api/short-stay/units/123/listing/photos'],
    ['put', '/api/short-stay/units/123/listing/photos/9/cover'],
    ['delete', '/api/short-stay/units/123/listing/photos/9'],
  ]);
  assert.equal(calls[0].args[1].headers['Cache-Control'], 'no-store');
  assert.equal(calls[1].args[1].parts[0][0], 'files');
  assert.equal(calls[1].args[1].parts[0][1].type, 'image/jpeg');
  http.get = async () => ({ success: false, message: 'Not authorized' });
  await assert.rejects(api.getPhotos('123'), /Not authorized/);
});
test('owner photo state refreshes on mutation, reports load failures, and confirms deletion', () => {
  const screen = source('../src/screens/landlord/ShortStayOwnerScreen.tsx');
  assert.match(screen, /listingLoaded && \(hasDraft \? <ShortStayPhotos/);
  assert.match(screen, /refreshPhotos/);
  assert.match(screen, /shortStayAPI\.uploadPhotos/);
  assert.match(screen, /shortStayAPI\.setCover/);
  assert.match(screen, /shortStayAPI\.deletePhoto/);
  assert.match(screen, /Alert\.alert\('Remove listing photo\?'/);
  assert.match(screen, /accessibilityRole="alert"/);
  assert.doesNotMatch(screen, /AsyncStorage|FileSystem\.download/);
});
