import test from 'node:test';
import assert from 'node:assert/strict';

import { createApplicationRequestGuard, getPositiveApplicationId, makeApplicationLoadScope } from './applicationCollection.js';

test('application request guard accepts only the latest matching generation and scope', () => {
  const guard = createApplicationRequestGuard();
  const firstScope = makeApplicationLoadScope({ userId: 7, organizationId: 9, propertyId: 11 });
  const secondScope = makeApplicationLoadScope({ userId: 7, organizationId: 9, propertyId: 12 });
  const first = guard.begin(firstScope);
  const second = guard.begin(secondScope);

  assert.equal(guard.isCurrent(first, firstScope), false, 'older responses must be ignored');
  assert.equal(guard.isCurrent(second, firstScope), false, 'a response cannot resolve a different render scope');
  assert.equal(guard.isCurrent(second, secondScope), true);
  assert.ok(second.generation > first.generation);
});

test('application deep-link IDs are exact positive safe integers only', () => {
  assert.equal(getPositiveApplicationId('42'), 42);
  for (const value of [null, '', '0', '-1', '1.5', '01', '9007199254740992', 42, ' 42', '42x']) {
    assert.equal(getPositiveApplicationId(value), null, String(value));
  }
});
