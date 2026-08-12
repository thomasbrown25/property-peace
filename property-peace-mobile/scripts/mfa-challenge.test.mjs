import test from 'node:test';
import assert from 'node:assert/strict';
import { normalizeAuthResult } from '../src/services/mfaChallenge.ts';

const user = { Id: '42', Email: 'landlord@example.com', jwtToken: 'signed-token' };

test('normalizes an authenticated API response', () => {
  assert.deepEqual(normalizeAuthResult({ success: true, data: user }), {
    kind: 'authenticated',
    user,
  });
});

test('normalizes an SMS MFA challenge without treating it as a user', () => {
  assert.deepEqual(normalizeAuthResult({
    success: true,
    mfaRequired: true,
    mfa: {
      challengeId: 'f9ef62d3-0824-47f8-b8c5-68c7bbf25d9c',
      method: 'Sms',
      maskedPhone: '*******4567',
      expiresAt: '2026-08-06T12:00:00Z',
    },
  }), {
    kind: 'challenge',
    challenge: {
      challengeId: 'f9ef62d3-0824-47f8-b8c5-68c7bbf25d9c',
      method: 'sms',
      maskedDestination: '*******4567',
      expiresAt: '2026-08-06T12:00:00Z',
    },
  });
});

test('normalizes a TOTP MFA challenge', () => {
  const result = normalizeAuthResult({
    mfaRequired: true,
    mfa: { challengeId: 'challenge-2', method: 1 },
  });
  assert.equal(result.kind, 'challenge');
  assert.equal(result.challenge.method, 'totp');
});

test('rejects malformed or unsupported MFA challenges', () => {
  assert.throws(
    () => normalizeAuthResult({ mfaRequired: true, mfa: { method: 'Sms' } }),
    /invalid multi-factor challenge/i,
  );
  assert.throws(
    () => normalizeAuthResult({ mfaRequired: true, mfa: { challengeId: 'x', method: 'Email' } }),
    /unsupported multi-factor method/i,
  );
});

test('rejects authenticated responses without a JWT', () => {
  assert.throws(
    () => normalizeAuthResult({ success: true, data: { Id: '42' } }),
    /valid sign-in session/i,
  );
});
