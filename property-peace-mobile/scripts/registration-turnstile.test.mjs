import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import { challengeUrl, parseChallengeMessage, isAllowedChallengeNavigation, challengeRequired } from '../src/features/auth/registrationChallenge.ts';
const read = (path) => readFileSync(new URL(path, import.meta.url), 'utf8');

test('challenge URL is exact and never carries a token; only same document and Cloudflare widget are allowed', () => {
  const url = challengeUrl('https://app.propertypeace.io/');
  assert.equal(url, 'https://app.propertypeace.io/mobile-signup-challenge');
  assert.equal(isAllowedChallengeNavigation(url, url), true);
  assert.equal(isAllowedChallengeNavigation(url, 'https://challenges.cloudflare.com/cdn-cgi/challenge-platform/foo'), true);
  for (const bad of ['https://evil.example/mobile-signup-challenge', url + '?token=abc', 'http://app.propertypeace.io/mobile-signup-challenge', 'javascript:alert(1)', 'https://app.propertypeace.io/login']) {
    assert.equal(isAllowedChallengeNavigation(url, bad), false, bad);
  }
  assert.throws(() => challengeUrl('http://evil.example'));
  assert.equal(challengeUrl('http://localhost:5173/'), 'http://localhost:5173/mobile-signup-challenge');
});

test('bridge only accepts current page, matching nonce, bounded token and known messages', () => {
  const page = challengeUrl('https://app.propertypeace.io');
  const data = JSON.stringify({ type: 'turnstile-token', nonce: 'nonce-1', token: 'token-abc' });
  assert.deepEqual(parseChallengeMessage(data, page, page, 'nonce-1'), { type: 'token', token: 'token-abc' });
  assert.equal(parseChallengeMessage(data, page, 'https://evil.example/', 'nonce-1'), null);
  assert.equal(parseChallengeMessage(data, page, page, 'other'), null);
  assert.equal(parseChallengeMessage(JSON.stringify({type:'turnstile-token', nonce:'nonce-1', token:'x'.repeat(3000)}), page, page, 'nonce-1'), null);
  assert.deepEqual(parseChallengeMessage(JSON.stringify({type:'turnstile-error', nonce:'nonce-1'}), page, page, 'nonce-1'), {type:'error'});
});

test('protected by default; explicit local-only opt out', () => {
  assert.equal(challengeRequired(false, 'true'), true);
  assert.equal(challengeRequired(true, 'false'), true);
  assert.equal(challengeRequired(true, 'true'), false);
  const service = read('../src/services/authService.ts');
  assert.match(service, /botChallengeToken/);
  assert.match(read('../src/screens/auth/RegisterScreen.tsx'), /resendRegistrationCode/);
});
