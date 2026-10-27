import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import { getBiometricAccountId } from '../src/features/startup/biometricAccountId.ts';

const source = (path) => readFileSync(new URL(`../src/${path}`, import.meta.url), 'utf8');

test('camelCase API user ID resolves the account-specific biometric preference', () => {
  assert.equal(getBiometricAccountId({ id: 42 }), '42');
  assert.equal(getBiometricAccountId({ Id: 'legacy-id' }), 'legacy-id');
  assert.equal(getBiometricAccountId(null), '');
  assert.equal(getBiometricAccountId({ email: 'someone@example.com' }), '');
});

test('restore, background checks and Settings share the account ID resolver', () => {
  const navigation = source('navigation/AppNavigator.tsx');
  const settings = source('screens/landlord/SettingsScreen.tsx');
  assert.match(navigation, /getBiometricAccountId\(currentUser\)/);
  assert.match(navigation, /getBiometricAccountId\(restoredSession\.user\)/);
  assert.match(settings, /getBiometricAccountId\(currentUser\)/);
  assert.doesNotMatch(settings, /currentUser\?\.Id \|\| ''/);
});

test('an authenticated session without an account ID has a recovery path instead of an endless spinner', () => {
  const navigation = source('navigation/AppNavigator.tsx');
  assert.match(navigation, /if \(isAuthenticated && !userId\) return <MissingAccountScreen onSignOut=\{signOut\} \/>;/);
});
