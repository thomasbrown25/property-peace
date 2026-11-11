import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { parse } from '@babel/parser';
import { propertyDocumentContext, documentCategory, documentTypeLabel } from './propertyDocuments.mjs';

const property = { id: 1, units: [{ id: 11, name: 'A', lease: { id: 101 } }] };
const leases = [{ id: 99, unitId: 11 }, { id: 101, unitId: 11 }, { id: 102, unitId: 11 }];
const tenants = [{ id: 5, propertyId: 1, unitId: 11, leaseId: 101 }];
const context = doc => propertyDocumentContext(doc, property, leases, tenants);

test('lease-level agreements appear without tenant IDs or loaded tenants', () => {
  const result = propertyDocumentContext({ leaseId: 99, tenantId: null }, property, leases, []);
  assert.equal(result.belongs, true);
  assert.equal(result.unit.name, 'A');
});
test('past, current, and scheduled property leases are supported', () => {
  for (const leaseId of ['99', 101, 102]) assert.equal(context({ leaseId }).belongs, true);
});
test('tenant uploads without a lease are matched to their property', () => {
  assert.equal(context({ tenantId: '5' }).belongs, true);
  assert.equal(context({ tenantId: 500 }).belongs, false);
});
test('explicit document lease wins over a tenant current property', () => {
  assert.equal(context({ tenantId: 5, leaseId: 999 }).belongs, false);
  assert.equal(propertyDocumentContext({ tenantId: 5, leaseId: 99 }, property, leases,
    [{ id: 5, propertyId: 2, unitId: 22 }]).belongs, true);
});
test('singular and scheduled unit projections and PascalCase IDs work', () => {
  assert.equal(propertyDocumentContext({ LeaseId: '101' }, property).belongs, true);
  assert.equal(propertyDocumentContext({ LeaseId: 102 }, { Id: 1, Units: [{ Id: 11, Leases: [{ Id: 102 }] }] }).belongs, true);
});
test('lease agreements and tenant uploads have accurate types without property category collisions', () => {
  assert.equal(documentTypeLabel({ documentType: 10 }), 'Lease Agreement');
  assert.equal(documentTypeLabel({ documentType: 1 }), 'Government ID');
  assert.equal(documentTypeLabel({ documentType: 1, isPropertyFile: true }), 'Landlord Insurance Policy');
  assert.notEqual(documentCategory({ documentType: 1 }), documentCategory({ documentType: 1, isPropertyFile: true }));
  assert.equal(documentTypeLabel({ documentType: 99, documentTypeName: 'Custom type' }), 'Custom type');
});
test('tab parses and loads all saved leases with cancellation and retry guards', () => {
  const source = readFileSync(new URL('./DocumentsTab.jsx', import.meta.url), 'utf8');
  assert.doesNotThrow(() => parse(source, { sourceType: 'module', plugins: ['jsx'] }));
  assert.match(source, /\/api\/lease\/property\/\$\{property.id\}\/all/);
  assert.match(source, /currentRequest !== requestId.current/);
  assert.match(source, /loadedScope !== scope/);
  assert.match(source, /onClick=\{refreshDocuments\}>Retry/);
  assert.match(source, /documentCategory\(group.document\) === categoryFilter/);
});
