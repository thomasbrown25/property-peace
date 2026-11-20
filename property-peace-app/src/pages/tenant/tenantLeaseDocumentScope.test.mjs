import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';

const source = fs.readFileSync(new URL('./lease.jsx', import.meta.url), 'utf8');

test('lease agreement reads use the selected lease organization scope', () => {
  assert.match(source, /if \(!selectedLeaseId \|\| !selectedLease \|\| organizationId === undefined \|\| organizationId === null\) return/);
  assert.match(source, /getLeaseAgreement\(selectedLeaseId, organizationRequestOptions\(organizationId\)\)/);
  assert.match(source, /getLeaseAgreement\(selectedLease\.id, organizationRequestOptions\(organizationId\)\)/);
});
