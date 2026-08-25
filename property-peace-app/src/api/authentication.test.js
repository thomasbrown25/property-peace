import assert from 'node:assert/strict';
import test from 'node:test';

let authentication = {};
try {
  authentication = await import('./authentication.js');
} catch {
  // The first red run intentionally exercises the missing authentication boundary.
}

const createHttp = () => {
  const calls = [];
  return {
    calls,
    post: async (url, body) => {
      calls.push({ url, body });
      return { data: { success: true, data: { id: 42, jwtToken: 'token' } } };
    }
  };
};

test('password login sends the remember-me choice to the API', async () => {
  assert.equal(typeof authentication.createAuthenticationApi, 'function');
  const http = createHttp();
  const api = authentication.createAuthenticationApi(http);

  await api.login('user@example.test', 'password', true);

  assert.deepEqual(http.calls, [
    {
      url: '/api/user/login',
      body: { email: 'user@example.test', password: 'password', rememberMe: true }
    }
  ]);
});

test('MFA completion sends the remember-me choice to the API', async () => {
  assert.equal(typeof authentication.createAuthenticationApi, 'function');
  const http = createHttp();
  const api = authentication.createAuthenticationApi(http);

  await api.verifyMfa('challenge-id', '123456', false);

  assert.deepEqual(http.calls, [
    {
      url: '/api/mfa/login/verify',
      body: { challengeId: 'challenge-id', code: '123456', rememberMe: false }
    }
  ]);
});

test('legacy MFA completion omits remember-me when no choice was provided', async () => {
  assert.equal(typeof authentication.createAuthenticationApi, 'function');
  const http = createHttp();
  const api = authentication.createAuthenticationApi(http);

  await api.verifyMfa('challenge-id', '123456');

  assert.deepEqual(http.calls, [
    {
      url: '/api/mfa/login/verify',
      body: { challengeId: 'challenge-id', code: '123456' }
    }
  ]);
});
