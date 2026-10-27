import assert from 'node:assert/strict';
import test from 'node:test';
import { readFileSync } from 'node:fs';

const source = (file) => readFileSync(new URL(`../src/${file}`, import.meta.url), 'utf8');

test('startup restores expired access tokens through a refresh session before routing', () => {
  const auth = source('services/authService.ts');
  const slice = source('store/user/user.slice.ts');
  assert.match(auth, /async restoreSession\(/);
  assert.match(auth, /refreshSession\(/);
  assert.match(slice, /authService\.restoreSession\(/);
  assert.doesNotMatch(slice, /isAuthenticated \? await authService\.getCurrentUser/);
});

test('refresh bypasses the expired-token guard and failed refresh cannot loop', () => {
  const api = source('services/apiClient.ts');
  assert.match(api, /async refreshSession\(/);
  assert.match(api, /refreshPromise/);
  assert.match(api, /\/api\/user\/refresh/);
  assert.match(api, /_retry/);
  assert.match(api, /invalidateSession\(/);
});

test('mobile auth opts into a persistent HttpOnly refresh cookie across login providers', () => {
  const api = source('services/apiClient.ts');
  const controller = readFileSync(new URL('../../property-peace-api/Controllers/UserController.cs', import.meta.url), 'utf8');
  assert.match(api, /'X-PP-Mobile-Session': 'persistent'/);
  assert.match(controller, /request\.RememberMe \|\| IsMobilePersistentSession\(\)/);
  assert.match(controller, /CreateRefreshSession\(response\.Data\.Id, IsMobilePersistentSession\(\)\)/);
});

test('explicit sign-out revokes the server session and clears local credentials', () => {
  const auth = source('services/authService.ts');
  assert.match(auth, /invalidateSession\(/);
  assert.match(auth, /\/api\/user\/logout/);
  assert.match(auth, /finally\s*\{\s*await storageService\.clearAuthData/);
});
