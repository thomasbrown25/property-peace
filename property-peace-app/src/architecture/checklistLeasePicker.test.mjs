import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const page = readFileSync(new URL('../pages/landlord/checklists.jsx', import.meta.url), 'utf8');
const leaseController = readFileSync(new URL('../../../property-peace-api/Controllers/LeaseController.cs', import.meta.url), 'utf8');
const repository = readFileSync(new URL('../../../property-peace-api/Repositories/Checklists/ChecklistRepository.cs', import.meta.url), 'utf8');

test('lease options API includes organization-owned active, upcoming, and ended contracts', () => {
  const endpoint = leaseController.slice(leaseController.indexOf('[HttpGet("property/{propertyId:long}/checklist-options")]'));
  assert.match(endpoint, /RequireLeaseManagementPermissionAsync/);
  assert.match(endpoint, /lease\.Unit\.PropertyId == propertyId/);
  assert.match(endpoint, /lease\.OrganizationId == organizationId/);
  assert.match(endpoint, /!lease\.IsDeleted/);
  assert.doesNotMatch(endpoint.slice(0, endpoint.indexOf('ToListAsync')), /&& lease\.IsActive/);
});

test('server rejects cross-property lease links and duplicate lease/type before insert', () => {
  const insert = repository.slice(repository.indexOf('public async Task<LoadChecklistDto> AddChecklist('), repository.indexOf('// Serialize image arrays'));
  assert.match(insert, /checklist\.LeaseId\.HasValue/);
  assert.match(insert, /lease\.Unit\.PropertyId == checklist\.PropertyId/);
  assert.match(insert, /lease\.OrganizationId == organizationId/);
  assert.match(insert, /existing\.LeaseId == checklist\.LeaseId && existing\.ChecklistType == checklist\.ChecklistType/);
});

test('after a duplicate create race the drawer checks the linked lease again and opens the existing checklist', () => {
  const creation = page.slice(page.indexOf('const createChecklist = async () =>'), page.indexOf('\n  return (\n', page.indexOf('const createChecklist = async () =>')));
  assert.match(creation, /catch \(error\) \{[\s\S]*?getChecklistsByLease\(selectedLeaseId\)/);
  assert.match(creation, /navigate\(buildChecklistWorkspacePath\(existingChecklist\)\)/);
});

test('drawer loads lease options and requires a decision before linking a suggested lease', () => {
  assert.match(page, /\/api\/Lease\/property\/\$\{selectedProperty\.id\}\/checklist-options/);
  assert.match(page, /Is this checklist for lease #/);
  assert.match(page, /LeaseId: leaseDecision === 'linked' \? selectedLeaseId : null/);
  assert.match(page, /leaseDecision === 'unanswered'/);
  assert.match(page, /Already linked to a .* checklist/);
});

test('selecting a lease with an existing checklist opens it and create rechecks duplicates', () => {
  assert.match(page, /findLinkedChecklist\(checklists, leaseId, createType\)/);
  assert.match(page, /getChecklistsByLease\(selectedLeaseId\)/);
  assert.match(page, /navigate\(buildChecklistWorkspacePath\(existingChecklist\)\)/);
});
