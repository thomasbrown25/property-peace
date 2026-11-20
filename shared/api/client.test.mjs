import assert from 'node:assert/strict';
import { test } from 'node:test';
import ApiClient from './client.js';

const client = new ApiClient({
  baseURL: 'https://example.test',
  getToken: async () => null,
  getOrganizationId: async () => 202,
  httpClient: async ({ headers }) => ({ data: headers })
});

test('the request organization takes precedence over the default organization', async () => {
  for (const header of ['X-Organization-Id', 'x-organization-id']) {
    const result = await client.get('/api/documents', { headers: { [header]: '101' } });
    assert.deepEqual(Object.entries(result).filter(([name]) => name.toLowerCase() === 'x-organization-id'), [[header, '101']]);
  }
});

test('requests without an explicit organization still receive the default', async () => {
  const result = await client.get('/api/documents');
  assert.equal(result['X-Organization-Id'], '202');
});
