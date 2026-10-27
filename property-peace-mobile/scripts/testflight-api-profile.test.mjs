import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const eas = JSON.parse(readFileSync(new URL('../eas.json', import.meta.url), 'utf8'));
const workflow = readFileSync(new URL('../../.github/workflows/property-peace-testflight.yml', import.meta.url), 'utf8');

test('dev TestFlight workflow uses a distributable profile targeting the dev API', () => {
  assert.match(workflow, /eas build --platform ios --profile testflight --auto-submit --non-interactive/);
  assert.equal(eas.build.testflight.extends, 'production');
  assert.equal(eas.build.testflight.env.EXPO_PUBLIC_API_URL, 'https://api-dev.propertypeace.io/');
  assert.equal(eas.build.testflight.env.EXPO_PUBLIC_SIGNALR_URL, 'https://api-dev.propertypeace.io/notificationHub');
  assert.equal(eas.submit.testflight.ios.ascAppId, eas.submit.production.ios.ascAppId);
});

test('production build still targets production API', () => {
  assert.equal(eas.build.production.env.EXPO_PUBLIC_API_URL, 'https://api.propertypeace.io/');
  assert.equal(eas.build.production.env.EXPO_PUBLIC_SIGNALR_URL, 'https://api.propertypeace.io/notificationHub');
});
