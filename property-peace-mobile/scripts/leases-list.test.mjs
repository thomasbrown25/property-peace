import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { createRequire } from 'node:module';
import vm from 'node:vm';
import test from 'node:test';

const require = createRequire(import.meta.url);
const ts = require('typescript');
const source = await readFile(new URL('../src/api/leaseAPI.ts', import.meta.url), 'utf8');
const js = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS } }).outputText;

function subject(responses) {
  const requests = [];
  const apiClient = { get: async (path) => {
    requests.push(path);
    const response = responses[path];
    if (response instanceof Error) throw response;
    return response;
  }};
  const exports = {};
  vm.runInNewContext(js, { exports, require: (path) => {
    if (path === '../services/apiClient') return { default: apiClient };
    throw new Error(`Unexpected import: ${path}`);
  }});
  return { api: exports.default, requests };
}

test('lists saved current, scheduled successor, and archived leases without vacant projections or duplicates', async () => {
  const { api, requests } = subject({
    '/api/Property/list': { data: [
      { id: 7, name: 'Oak House', units: [
        { id: 11, name: 'A', lease: { id: 1, rentAmount: 1200 }, leases: [{ id: 1, rentAmount: 1200 }, { id: 2, rentAmount: 1300 }] },
        { id: 12, name: 'B', lease: {}, leases: [{ id: 3, isDraft: true, rentAmount: 0 }] },
        { id: 13, name: 'C', lease: { id: 0 }, leases: [] },
      ] },
    ] },
    '/api/Lease/history': { data: [{ id: 1, propertyName: 'Past House' }] },
  });
  const leases = await api.getLeases();
  assert.deepEqual(Array.from(leases, l => l.id), [1, 2, 3, 1]);
  assert.equal(leases[3].archived, true);
  assert.equal(leases[0].propertyName, 'Oak House');
  assert.equal(leases[1].unitName, 'A');
  assert.deepEqual(requests.sort(), ['/api/Lease/history', '/api/Property/list']);
});

test('malformed property response fails rather than showing a false empty state', async () => {
  const { api } = subject({ '/api/Property/list': {}, '/api/Lease/history': { data: [] } });
  await assert.rejects(api.getLeases(), /property/i);
});
