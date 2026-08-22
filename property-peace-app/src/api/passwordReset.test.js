import test from 'node:test';
import assert from 'node:assert/strict';

import { createPasswordResetApi } from './passwordReset.js';

test('requestReset posts the email to the shared forgot-password endpoint', async () => {
  const calls = [];
  const api = createPasswordResetApi({
    post: async (url, body) => {
      calls.push({ url, body });
      return { data: { success: true } };
    }
  });

  const result = await api.requestReset('person@example.com');

  assert.deepEqual(calls, [{
    url: '/api/user/forgot-password',
    body: { email: 'person@example.com' }
  }]);
  assert.deepEqual(result, { success: true });
});

test('completeReset posts the token and new password to the reset endpoint', async () => {
  const calls = [];
  const api = createPasswordResetApi({
    post: async (url, body) => {
      calls.push({ url, body });
      return { data: { success: true, message: 'Your password has been reset.' } };
    }
  });

  await api.completeReset('opaque-token', 'NewPassword1!');

  assert.deepEqual(calls, [{
    url: '/api/user/reset-password',
    body: { token: 'opaque-token', newPassword: 'NewPassword1!' }
  }]);
});
