import assert from 'node:assert/strict';
import test from 'node:test';
import {
  getFeaturesDropdownKeyAction,
  shouldOpenFeaturesDropdownOnFocus,
} from '../lib/navigation-features-key-action.ts';

test('Features trigger activation keys open the dropdown and move focus into its links', () => {
  for (const key of ['Enter', ' ', 'ArrowDown']) {
    assert.equal(
      getFeaturesDropdownKeyAction({ key, dropdownOpen: false, target: 'trigger' }),
      'open-and-focus-first-link',
      key,
    );
  }
});

test('Escape from the open navigation closes the dropdown and restores trigger focus', () => {
  assert.equal(
    getFeaturesDropdownKeyAction({ key: 'Escape', dropdownOpen: true, target: 'navigation' }),
    'close-and-restore-trigger',
  );
});

test('Tab from the focused open trigger moves into the first dropdown link', () => {
  assert.equal(
    getFeaturesDropdownKeyAction({ key: 'Tab', dropdownOpen: true, target: 'trigger' }),
    'focus-first-link',
  );
  assert.equal(
    getFeaturesDropdownKeyAction({ key: 'Tab', dropdownOpen: true, target: 'trigger', shiftKey: true }),
    'none',
  );
});

test('restoring trigger focus after Escape does not reopen the dropdown', () => {
  assert.equal(shouldOpenFeaturesDropdownOnFocus({ restoringFocus: true }), false);
  assert.equal(shouldOpenFeaturesDropdownOnFocus({ restoringFocus: false }), true);
});

test('unrelated keys and Escape while closed leave the dropdown unchanged', () => {
  const cases = [
    { key: 'Tab', dropdownOpen: false, target: 'trigger' },
    { key: 'Escape', dropdownOpen: false, target: 'navigation' },
    { key: 'Enter', dropdownOpen: false, target: 'navigation' },
  ];

  for (const input of cases) {
    assert.equal(getFeaturesDropdownKeyAction(input), 'none', JSON.stringify(input));
  }
});
