import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';
import { visibleTenantDocuments } from './tenantDocumentVisibility.mjs';

const source = fs.readFileSync(new URL('./documents.jsx', import.meta.url), 'utf8');

test('private tenant documents never enter portal state; generated agreements are a separate resource', () => {
  const visible = { id: 1, isPrivate: false };
  const legacy = { id: 2 };
  assert.deepEqual(visibleTenantDocuments([visible, { id: 3, IsPrivate: true }, legacy]), [visible, legacy]);
});

test('portal filters API documents before merging generated agreements and explicitly marks tenant uploads visible', () => {
  assert.match(source, /visibleTenantDocuments\(tenantDocuments\)/);
  assert.match(source, /isPrivate: false/);
  assert.match(source, /getLeaseAgreement/);
});
