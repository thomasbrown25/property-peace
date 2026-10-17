import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const source = (path) => readFileSync(new URL(`../src/${path}`, import.meta.url), 'utf8');

test('the post-login opt-in is gated by the account-specific preference before main navigation', () => {
  const navigation = source('navigation/AppNavigator.tsx');
  assert.match(navigation, /biometricService\.isEnabled\(userId\)/);
  assert.match(navigation, /setShowOptIn\(!enabled\)/);
  assert.match(navigation, /checkedUserId !== userId/);
  assert.ok(navigation.indexOf('if (isAuthenticated && showOptIn)') < navigation.indexOf('<NavigationContainer theme='));
  assert.match(navigation, /<BiometricOptInScreen userId=\{userId\} onContinue=\{dismissOptIn\}/);
});

test('enabling requires successful device authentication and stores the preference for this account', () => {
  const screen = source('screens/BiometricOptInScreen.tsx');
  const verified = screen.indexOf('if (!verified) return;');
  const stored = screen.indexOf('await biometricService.setEnabled(userId, true);');
  const continueAt = screen.indexOf('onContinue();', stored);
  assert.ok(verified > 0 && stored > verified && continueAt > stored);
  assert.match(screen, /onPress=\{onContinue\}/);
  assert.match(source('services/biometricService.ts'), /biometricUnlockEnabled\.\$\{userId\}/);
});

test('background records inactivity without relocking; cold restore checks the account-specific timestamp', () => {
  const navigation = source('navigation/AppNavigator.tsx');
  const background = navigation.indexOf("nextState === 'background' || nextState === 'active'");
  assert.ok(background > 0);
  assert.match(navigation, /const recordActivity = \(\) => \{\s*biometricService\.setLastActiveAt\(userId, Date\.now\(\)\)/);
  assert.match(navigation, /setInterval\(\(\) => \{\s*if \(AppState\.currentState === 'active'\) recordActivity\(\)/);
  assert.doesNotMatch(navigation.slice(background), /setSessionUnlocked\(false\)/);
  assert.match(navigation, /biometricService\.getLastActiveAt\(restoredUserId\)/);
  assert.match(navigation, /if \(lastActiveAt !== null\) return lastActiveAt;/);
  assert.match(navigation, /biometricService\.setLastActiveAt\(restoredUserId, restoredAt\)/);
  const service = source('services/biometricService.ts');
  assert.match(service, /biometricLastActiveAt\.\$\{userId\}/);
  assert.match(service, /await this\.setLastActiveAt\(userId, Date\.now\(\)\);\s*await SecureStore\.setItemAsync\(preferenceKey\(userId\), 'true'\)/);
});
