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
  for (const destination of ['Notifications', 'Settings']) {
    assert.match(dock, new RegExp(`onPress=\\{\\(\\) => openTabRoot\\('${destination}'\\)\\}`));
  }
  assert.match(dock, /hideSheet\(\(\) => openTabRoot\(item\.route!\)\)/);
});

test('Settings avatar resets locally-rendered categories to the settings index', () => {
  assert.match(settings, /navigation\.addListener\('tabPress' as never, \(event: \{ target\?: string \}\) => \{/);
  assert.match(settings, /if \(event\.target !== route\.key\) return;\s*requestId\.current \+= 1;\s*setPassword\(\{ current: '', next: '', confirm: '' \}\);\s*setCategory\(null\);/);
  assert.match(settings, /scrollRef\.current\?\.scrollTo\(\{ y: 0, animated: false \}\)/);
});
