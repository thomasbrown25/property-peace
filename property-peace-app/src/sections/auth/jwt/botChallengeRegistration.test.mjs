import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const read = (relative) => fs.readFileSync(new URL(relative, import.meta.url), 'utf8');

test('public email signup renders a Turnstile checkbox and sends its one-time token to the API', () => {
  const form = read('./EmailEntryForm.jsx');
  const widget = read('../../../components/auth/TurnstileCheckbox.jsx');

  assert.match(form, /VITE_TURNSTILE_SITE_KEY/);
  assert.match(form, /<TurnstileCheckbox/);
  assert.match(form, /botChallengeToken/);
  assert.match(form, /disabled=\{isSubmitting \|\| \(turnstileRequired && !botChallengeToken\)\}/);
  assert.match(widget, /challenges\.cloudflare\.com\/turnstile\/v0\/api\.js\?render=explicit/);
  assert.match(widget, /action:\s*'public-signup-email'/);
  assert.match(widget, /'expired-callback'/);
  assert.match(widget, /role="alert"/);
  assert.match(widget, /aria-live="assertive"/);
  assert.match(widget, /'error-callback'/);
});

test('signup account step uses the concise heading and sentence-case Sign up action', () => {
  const form = read('./EmailEntryForm.jsx');

  assert.doesNotMatch(form, /Step 1 of 3 · Account/);
  assert.doesNotMatch(form, /Use your work email and choose a secure password/);
  assert.match(form, /isSubmitting \? 'Please wait…' : 'Sign up'/);
});

test('email signup advances to verification while trusted Google signup skips to details', () => {
  const registerPage = read('../../../pages/auth/jwt/register-landlord.jsx');

  assert.match(registerPage, /onNext=\{\(email, nextPassword\) => \{[\s\S]*?go\('verify'\)/);
  assert.match(registerPage, /onGoogleSuccess=\{\(profile\) => \{[\s\S]*?go\('details'\)/);
});

test('resend uses a fresh Turnstile token and discards it after each attempt', () => {
  const form = read('./EmailVerifierForm.jsx');

  assert.match(form, /<TurnstileCheckbox[\s\S]*?onToken=\{setResendToken\}/);
  assert.match(form, /if \(siteKey && !resendToken\) return/);
  assert.match(form, /post\('\/api\/user\/send-verification-code', \{ email, botChallengeToken: resendToken \}\)/);
  assert.match(form, /finally \{\s*setResendToken\(null\)/);
});

test('expired registration proof returns to verification with an immediate resend and keeps the signup draft', () => {
  const registerPage = read('../../../pages/auth/jwt/register-landlord.jsx');
  const verifier = read('./EmailVerifierForm.jsx');
  const entry = read('./EmailEntryForm.jsx');

  assert.match(registerPage, /onVerificationRequired=\{\(\) => \{\s*setMustReverify\(true\);\s*go\('verify', true\);/);
  assert.match(registerPage, /mustReverify=\{mustReverify\}/);
  assert.match(registerPage, /email=\{draft.email\}/);
  assert.match(verifier, /useState\(mustReverify \? 0 : RESEND_SECONDS\)/);
  assert.doesNotMatch(registerPage + verifier + entry, /emailAlreadyVerified|sessionStorage\.setItem\('emailVerified'/);
});

test('signup marks the workspace setup and completion navigations so the guest guard can leave them mounted', () => {
  const registerPage = read('../../../pages/auth/jwt/register-landlord.jsx');

  assert.match(registerPage, /go\('creating', false, \{ registrationCompleting: true \}\)/);
  assert.match(registerPage, /go\('complete', true, \{ registrationCompleting: true \}\)/);
  assert.match(registerPage, /redirectOnly=\{signedInCompletion\}/);
});

test('both frontend deployment workflows inject an environment-specific Turnstile site key', () => {
  const devWorkflow = read('../../../../../.github/workflows/property-peace-app-deploy-dev.yml');
  const prodWorkflow = read('../../../../../.github/workflows/property-peace-app-deploy.yml');

  assert.match(devWorkflow, /VITE_TURNSTILE_SITE_KEY:\s*\$\{\{ secrets\.VITE_TURNSTILE_SITE_KEY_DEV \}\}/);
  assert.match(prodWorkflow, /VITE_TURNSTILE_SITE_KEY:\s*\$\{\{ secrets\.VITE_TURNSTILE_SITE_KEY \}\}/);
});

test('static web app policies allow the Turnstile script and challenge frame', () => {
  for (const configPath of ['../../../../staticwebapp.config.json', '../../../../staticwebapp.config.dev.json']) {
    const config = JSON.parse(read(configPath));
    const policy = config.globalHeaders['Content-Security-Policy'];
    assert.match(policy, /script-src[^;]*https:\/\/challenges\.cloudflare\.com/);
    assert.match(policy, /frame-src[^;]*https:\/\/challenges\.cloudflare\.com/);
    assert.match(policy, /connect-src[^;]*https:\/\/challenges\.cloudflare\.com/);
  }
});
