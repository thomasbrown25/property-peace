import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import vm from 'node:vm';
const require = createRequire(import.meta.url);
const ts = require('typescript');
const source = readFileSync(new URL('../src/api/shortStayAPI.ts', import.meta.url), 'utf8');
const compiled = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText;
function harness(result = { success: true, data: null }) {
  const calls = [];
  const client = {
    get: async (...args) => { calls.push(['GET', ...args]); return result; },
    put: async (...args) => { calls.push(['PUT', ...args]); return result; },
    delete: async (...args) => { calls.push(['DELETE', ...args]); return result; },
  };
  const exports = {};
  vm.runInNewContext(compiled, { exports, require: id => {
    if (id === '../services/apiClient') return { __esModule: true, default: client };
    if (id === '../features/properties/shortStayOwner') return require('../src/features/properties/shortStayOwner.ts');
    throw Error(`Unexpected import: ${id}`);
  } });
  return { api: exports.default, calls };
}
test('range-rate API validates before network and sends exact authenticated PUT body', async () => {
  const h = harness({ success: true, data: [{ date: '2026-12-01', nightlyRate: 150.25 }] });
  await assert.rejects(h.api.putRateRange('12', '2026-12-01', '2026-12-01', '150'), /exclusive/);
  await assert.rejects(h.api.putRateRange('12', '2026-12-01', '2026-12-02', '0'), /positive/);
  assert.deepEqual(h.calls, []);
  assert.equal((await h.api.putRateRange('12', '2026-12-01', '2026-12-02', '150.25'))[0].nightlyRate, 150.25);
  assert.deepEqual(JSON.parse(JSON.stringify(h.calls)), [['PUT', '/api/short-stay/units/12/calendar/rates/range', { startDate: '2026-12-01', endDate: '2026-12-02', nightlyRate: 150.25 }]]);
  const denied = harness({ success: false, message: 'Forbidden', data: null });
  await assert.rejects(denied.api.putRateRange('12', '2026-12-01', '2026-12-02', '150'), /Forbidden/);
});
test('owner guidebook GET uses unit-scoped path without cache; null is an empty draft', async () => {
  const h = harness();
  assert.equal(await h.api.getGuidebookDraft('12'), null);
  assert.deepEqual(JSON.parse(JSON.stringify(h.calls)), [['GET', '/api/short-stay/units/12/guidebook-draft', { headers: { 'Cache-Control': 'no-store' } }]]);
});
test('owner guidebook PUT sends only the three text fields, unwrapping ServiceResponse', async () => {
  const result = { unitId: 12, houseRules: 'Quiet hours', arrivalOverview: null, localNotes: 'Park' };
  const h = harness({ success: true, data: result });
  const input = { houseRules: 'Quiet hours', arrivalOverview: null, localNotes: 'Park' };
  assert.equal(await h.api.putGuidebookDraft('12', input), result);
  assert.deepEqual(JSON.parse(JSON.stringify(h.calls)), [['PUT', '/api/short-stay/units/12/guidebook-draft', input]]);
});
test('ServiceResponse failures on read or write reject instead of replacing the editor', async () => {
  const h = harness({ success: false, message: 'Forbidden', data: null });
  await assert.rejects(h.api.getGuidebookDraft('12'), /Forbidden/);
  await assert.rejects(h.api.putGuidebookDraft('12', { houseRules: null, arrivalOverview: null, localNotes: null }), /Forbidden/);
});
test('explicit guidebook discard uses unit-scoped DELETE and rejects failed ServiceResponse', async () => {
  const h = harness({ success: true, data: true });
  assert.equal(await h.api.deleteGuidebookDraft('12'), true);
  assert.deepEqual(JSON.parse(JSON.stringify(h.calls)), [['DELETE', '/api/short-stay/units/12/guidebook-draft']]);
  const denied = harness({ success: false, message: 'Forbidden', data: false });
  await assert.rejects(denied.api.deleteGuidebookDraft('12'), /Forbidden/);
});
