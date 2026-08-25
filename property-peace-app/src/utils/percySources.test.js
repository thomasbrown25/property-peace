import assert from 'node:assert/strict';
import test from 'node:test';
import { mapPercySource, safePercyWorkflowRoute } from './percySources.js';

test('safe Percy workflow routes use an explicit landlord allowlist', () => {
  const allowed = [
    '/landlord/properties',
    '/landlord/finances?tab=payments',
    '/landlord/maintenances',
    '/landlord/leases',
    '/landlord/applications',
    '/landlord/urgent-messages'
  ];

  for (const route of allowed) assert.equal(safePercyWorkflowRoute(route), route);
  for (const route of [
    'javascript:alert(1)',
    'https://evil.example/landlord/properties',
    '//evil.example',
    '/tenant/messages',
    '/landlord/properties/123',
    '/landlord/properties?organizationId=999',
    '/landlord/leases/123'
  ]) assert.equal(safePercyWorkflowRoute(route), null);
});

test('Percy source render data retains safe display fields and removes unsafe links', () => {
  assert.deepEqual(mapPercySource({
    Kind: 'portfolio',
    Label: 'Portfolio',
    WorkflowRoute: '/landlord/properties',
    RecordReference: 'prop_opaque',
    RetrievedAtUtc: '2026-08-11T12:30:00Z'
  }), {
    kind: 'portfolio',
    label: 'Portfolio',
    workflowRoute: '/landlord/properties',
    recordReference: 'prop_opaque',
    retrievedAtUtc: '2026-08-11T12:30:00Z'
  });

  assert.equal(mapPercySource({ label: 'Bad', workflowRoute: 'javascript:alert(1)' }).workflowRoute, null);
  assert.equal(mapPercySource({ label: 'Bad', workflowRoute: 'https://evil.example' }).workflowRoute, null);
});
