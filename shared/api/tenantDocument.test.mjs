import assert from 'node:assert/strict';
import test from 'node:test';
import { TenantDocumentAPI } from './tenantDocument.js';

test('tenant document reads forward an explicit organization header', async () => {
  const calls = [];
  const api = new TenantDocumentAPI({
    get: async (...args) => {
      calls.push(args);
      return { success: true };
    }
  });

  const options = { headers: { 'X-Organization-Id': '42' } };
  await api.getTenantDocumentsByTenant(7, options);
  await api.getLeaseAgreement(13, options);

  assert.deepEqual(calls, [
    ['/api/TenantDocument/tenant/7', options],
    ['/api/TenantDocument/lease/13/agreement', options]
  ]);
});
