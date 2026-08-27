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
