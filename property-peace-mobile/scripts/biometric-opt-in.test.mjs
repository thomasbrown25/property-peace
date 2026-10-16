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

test('each background transition locks before checking the setting and schedules automatic unlock', () => {
  const navigation = source('navigation/AppNavigator.tsx');
  const background = navigation.indexOf("nextState !== 'background'");
  const locked = navigation.indexOf('setSessionUnlocked(false);', background);
  const autoPrompt = navigation.indexOf('setAutoPromptBiometric(true);', background);
  const read = navigation.indexOf('biometricService.isEnabled(userId)', background);
  assert.ok(background > 0 && locked > background && autoPrompt > locked && read > autoPrompt);
});
