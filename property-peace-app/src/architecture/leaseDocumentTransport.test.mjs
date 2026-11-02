import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';
const api = fs.readFileSync(new URL('../../../shared/api/tenantDocument.js', import.meta.url), 'utf8');
const drawer = fs.readFileSync(new URL('../components/drawers/LeaseDocumentUploadDrawer.jsx', import.meta.url), 'utf8');
test('both upload transports send isPrivate to backend; private documents upload at lease level', () => {
  assert.match(api, /async uploadLeaseDocuments/);
  assert.match(api, /upload-lease-document/);
  assert.equal((api.match(/formData\.append\('isPrivate', options\.isPrivate\)/g) || []).length, 2);
  assert.match(drawer, /if \(!tenantVisible \|\| tenants\.length === 0\)/);
});
