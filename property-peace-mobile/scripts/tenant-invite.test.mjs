import test from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
const require = createRequire(import.meta.url);
const ts = require('typescript');
const source = readFileSync(new URL('../src/features/tenants/tenantInvite.ts', import.meta.url), 'utf8');
const exports = {};
vm.runInNewContext(ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS } }).outputText, { exports });
const { invitationStatus, inviteEmail, inviteError } = exports;

test('validates saved email and distinguishes records from portal accounts', () => {
  assert.equal(inviteEmail({ email: ' PERSON@Example.com ' }), 'PERSON@Example.com');
  assert.equal(inviteEmail({ Email: 'person@example.com', UserId: 23 }), null);
  assert.equal(inviteEmail({ email: 'bad address' }), null);
  assert.equal(inviteEmail({ email: '' }), null);
});
test('invites must be unconsumed, unexpired, belong to this tenant and match saved email', () => {
  const tenant = { id: 4, email: 'Person@example.com' };
  const good = { id: 17, tenantId: 4, email: 'person@example.com', isUsed: false, expiresAt: '2030-01-01T00:00:00Z' };
  assert.equal(invitationStatus(tenant, [good], Date.parse('2029-01-01')).id, 17);
  for (const bad of [{ ...good, isUsed: true }, { ...good, expiresAt: '2028-01-01' }, { ...good, email: 'other@example.com' }, { ...good, tenantId: 5 }, { ...good, expiresAt: 'invalid' }]) {
    assert.equal(invitationStatus(tenant, [bad], Date.parse('2029-01-01')), null);
  }
  assert.equal(invitationStatus({ ...tenant, userId: 6 }, [good], Date.parse('2029-01-01')), null);
});
test('API errors preserve server explanation rather than claiming delivery', () => {
  assert.equal(inviteError({ message: 'Forbidden' }), 'Forbidden');
  assert.equal(inviteError({ Message: 'No access' }), 'No access');
  assert.equal(inviteError({ errors: ['Invalid tenant'] }), 'Invalid tenant');
});
test('detail uses invite endpoints, status loading and resend without tenant form mutation', () => {
  const detail = readFileSync(new URL('../src/screens/landlord/TenantDetailScreen.tsx', import.meta.url), 'utf8');
  const api = readFileSync(new URL('../src/api/tenantInviteAPI.ts', import.meta.url), 'utf8');
  const add = readFileSync(new URL('../src/screens/landlord/AddTenantScreen.tsx', import.meta.url), 'utf8');
  assert.match(add, /Open the tenant profile after saving to send a portal invitation/);
  assert.match(add, /TenantAPI\.createTenant\(tenantPayload\(form\)\)/);
  assert.match(api, /\/api\/TenantInvite\/tenant\/\$\{tenantId\}/);
  assert.match(api, /\/api\/TenantInvite['`]/);
  assert.match(api, /\/api\/TenantInvite\/\$\{inviteId\}\/resend/);
  assert.match(detail, /TenantInviteAPI\.getInvitesByTenantId/);
  assert.match(detail, /TenantInviteAPI\.createInvite/);
  assert.match(detail, /TenantInviteAPI\.resendInvite/);
  assert.match(detail, /invitationStatus\(tenant, invites\)/);
  assert.match(detail, /TenantAssociationFields form=\{form\}/);
  assert.doesNotMatch(detail, /To manage portal invitations, use the web app/);
});
