import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const source = readFileSync(new URL('../pages/landlord/checklists.jsx', import.meta.url), 'utf8');

test('checklists load from the active JWT session rather than the dormant Redux auth state', () => {
  assert.match(source, /import useAuth from 'hooks\/useAuth'/);
  assert.match(source, /const \{\s*user,\s*isInitialized/);
  assert.match(source, /if \(!isInitialized\) return;/);
  assert.match(source, /getChecklistsByLandlord\(userId\)/);
  assert.doesNotMatch(source, /selectIsLoadingAuth|selectCurrentUser/);
});
