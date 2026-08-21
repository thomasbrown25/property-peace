import test from 'node:test';
import assert from 'node:assert/strict';

import { getFocusedAuthShellPresentation } from './authShellPresentation.js';

test('focused auth pages use the login logo on a plain canvas', () => {
  assert.deepEqual(getFocusedAuthShellPresentation('light'), {
    logoVariant: 'lightHeader',
    showDecorativeBackground: false,
    contentMaxWidth: 560
  });
});

test('focused auth pages retain the dark-mode logo without restoring decoration', () => {
  assert.deepEqual(getFocusedAuthShellPresentation('dark'), {
    logoVariant: 'dark',
    showDecorativeBackground: false,
    contentMaxWidth: 560
  });
});
