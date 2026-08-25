import test from 'node:test';
import assert from 'node:assert/strict';

import { createTeamMemberRemovalModel } from './teamMemberRemoval.js';

test('builds a removal confirmation for the selected team member and organization', () => {
  const model = createTeamMemberRemovalModel(
    {
      name: 'Thomas Brown',
      email: 'thomas@example.com',
      role: 'Manager'
    },
    { name: 'Brownstone Hub LLC' }
  );

  assert.deepEqual(model, {
    title: 'Remove team member?',
    name: 'Thomas Brown',
    email: 'thomas@example.com',
    role: 'Manager',
    initials: 'TB',
    consequence: 'Thomas Brown will immediately lose access to Brownstone Hub LLC.',
    cancelLabel: 'Keep team member',
    confirmLabel: 'Remove access'
  });
});

test('uses the member email when a display name is unavailable', () => {
  const model = createTeamMemberRemovalModel({ email: 'viewer@example.com', role: 'Viewer' }, { name: 'Brownstone Hub LLC' });

  assert.equal(model.name, 'viewer@example.com');
  assert.equal(model.initials, 'VI');
  assert.equal(model.consequence, 'viewer@example.com will immediately lose access to Brownstone Hub LLC.');
});

test('uses fallback removal details while the closed dialog has null inputs', () => {
  const model = createTeamMemberRemovalModel(null, null);

  assert.equal(model.name, 'This team member');
  assert.equal(model.email, '');
  assert.equal(model.role, 'Viewer');
  assert.equal(model.initials, '?');
  assert.equal(model.consequence, 'This team member will immediately lose access to this organization.');
});
