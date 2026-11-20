import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

async function workflowWith(axios, crypto = { randomUUID: () => 'generated-key' }) {
  const url = new URL('./maintenanceWorkflow.js', import.meta.url);
  const source = (await readFile(url, 'utf8'))
    .replace(/^import .*;\r?\n/gm, '')
    .replace(/^export /gm, '');
  return new Function('axiosServices', 'crypto', 'FormData', `${source}\nreturn { maintenanceWorkflowAPI, getTenantMaintenanceLeases };`)(
    axios,
    crypto,
    class TestFormData { append() {} }
  );
}

test('tenant maintenance transport preserves selected organization and idempotency headers', async () => {
  const calls = [];
  const axios = {
    get: async (url, config) => {
      calls.push({ method: 'get', url, config });
      return { data: { success: true } };
    },
    post: async (url, body, config) => {
      calls.push({ method: 'post', url, body, config });
      return { data: { data: { id: 14 } } };
    }
  };
  const { maintenanceWorkflowAPI, getTenantMaintenanceLeases } = await workflowWith(axios);
  const scope = { headers: { 'X-Organization-Id': '42' } };

  const leaseResponse = await getTenantMaintenanceLeases();
  await maintenanceWorkflowAPI.create({ title: 'Leak' }, 'create-key', scope);
  await maintenanceWorkflowAPI.uploadAttachment(14, 'Intake', { name: 'photo.jpg' }, 'upload-key', scope);

  assert.equal(leaseResponse.data.success, true);
  assert.deepEqual(calls[0], {
    method: 'get',
    url: '/api/lease/tenant/my-leases',
    config: { headers: { 'X-Organization-Id': false } }
  });
  assert.deepEqual(calls[1].config.headers, { 'X-Organization-Id': '42', 'Idempotency-Key': 'create-key' });
  assert.deepEqual(calls[2].config.headers, {
    'X-Organization-Id': '42',
    'Idempotency-Key': 'upload-key',
    'Content-Type': 'multipart/form-data'
  });
});

test('implicit create idempotency keys do not cross organization scopes', async () => {
  const headers = [];
  const axios = {
    get: async () => ({ data: {} }),
    post: async (_url, _body, config) => {
      headers.push(config.headers);
      if (headers.length === 1) throw new Error('temporary network failure');
      return { data: { data: { id: 14 } } };
    }
  };
  let key = 0;
  const { maintenanceWorkflowAPI } = await workflowWith(axios, { randomUUID: () => `generated-${++key}` });

  await assert.rejects(maintenanceWorkflowAPI.create({ title: 'Leak' }, undefined, { headers: { 'X-Organization-Id': '42' } }));
  await maintenanceWorkflowAPI.create({ title: 'Leak' }, undefined, { headers: { 'X-Organization-Id': '43' } });

  assert.equal(headers[0]['Idempotency-Key'], 'generated-1');
  assert.equal(headers[1]['Idempotency-Key'], 'generated-2');
});
