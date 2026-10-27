import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

test('mobile removal passes the membership primary key to the member-id API route', async () => {
  const screen = await readFile(new URL('../src/screens/landlord/TeamScreen.tsx', import.meta.url), 'utf8');
  const api = await readFile(new URL('../src/api/teamAPI.ts', import.meta.url), 'utf8');
  const service = await readFile(new URL('../../property-peace-api/Services/OrganizationMemberService/OrganizationMemberService.cs', import.meta.url), 'utf8');

  assert.match(service, /GetMemberByMemberIdAsync\(organizationId, memberId\)/);
  assert.match(screen, /teamAPI\.remove\(current\.scope, person\.id\)/);
  assert.match(api, /async remove\(organizationId: string, memberId: number\)/);
  assert.match(api, /members\/\$\{organizationId\}\/\$\{memberId\}/);
});
