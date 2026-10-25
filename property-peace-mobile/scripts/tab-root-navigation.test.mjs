import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const dock = await readFile(new URL('../src/navigation/QuickActionsTabBar.tsx', import.meta.url), 'utf8');
const settings = await readFile(new URL('../src/screens/landlord/SettingsScreen.tsx', import.meta.url), 'utf8');

test('dock and native More destinations use a common root-navigation action', () => {
  assert.match(dock, /const openTabRoot = \(routeName: string\) => \{/);
  assert.match(dock, /navigation\.emit\(\{ type: 'tabPress', target: route\.key, canPreventDefault: true \}\)/);
  assert.match(dock, /if \(event\.defaultPrevented\) return;/);
  assert.match(dock, /if \(route\.state\?\.key && \(route\.state\.index \?\? 0\) > 0\) \{\s*navigation\.dispatch\(\{ \.\.\.StackActions\.popToTop\(\), target: route\.state\.key \}\)/);
  assert.match(dock, /if \(state\.routes\[state\.index\]\?\.key !== route\.key\) navigation\.navigate\(route\.name\)/);
  assert.match(dock, /onPress=\{\(\) => \{\s*if \(open\) hideSheet\(\);\s*openTabRoot\(route\.name\)/);
  assert.match(dock, /onPress=\{\(\) => openTabRoot\('Settings'\)\}/);
  assert.match(dock, /visibleRoutes\.map\(renderTab\)/);
  assert.match(dock, /hideSheet\(\(\) => item\.screen \? navigation\.navigate\(item\.route!, \{ screen: item\.screen \}\) : openTabRoot\(item\.route!\)\)/);
});

test('Settings categories use a native detail stack and avatar returns to its index', async () => {
  const navigator = await readFile(new URL('../src/navigation/MainNavigator.tsx', import.meta.url), 'utf8');
  assert.match(navigator, /SettingsStack\.Screen name="SettingsIndex" component=\{SettingsScreen\}/);
  assert.match(navigator, /SettingsStack\.Screen name="SettingsCategory" component=\{SettingsScreen\}/);
  assert.match(navigator, /animation: 'slide_from_right'/);
  assert.match(navigator, /Tab\.Screen name="Settings" component=\{SettingsNavigator\}/);
  assert.match(settings, /navigation\.navigate\('SettingsCategory', \{ category: next \}\)/);
  assert.match(settings, /onPress=\{\(\) => navigation\.goBack\(\)\}/);
  assert.doesNotMatch(settings, /setCategory\(/);
});
