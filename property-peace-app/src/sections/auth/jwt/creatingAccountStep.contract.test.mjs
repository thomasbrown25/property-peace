import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const source = fs.readFileSync(new URL('./CreatingAccountStep.jsx', import.meta.url), 'utf8');

test('creating an account runs only for the initial attempt and explicit retries', () => {
  assert.match(source, /\}, \[retryCount\]\);/);
  assert.doesNotMatch(source, /\}, \[isLoggedIn, user, updateUser, register, password, retryCount\]\);/);
});

test('an expired email proof returns the registration flow to verification', () => {
  assert.match(source, /onVerificationRequired\?\.\(\)/);
  assert.match(source, /status === 403/);
  assert.match(source, /Email verification is required before registration/);
});

test('an authenticated workspace-recovery error does not offer a guest-only review step', () => {
  assert.match(source, /\{onBack && !isLoggedIn && \(/);
  assert.match(source, /Your account is ready\. Try again to finish setting up your organization\./);
});
