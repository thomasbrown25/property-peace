import assert from 'node:assert/strict';
import test from 'node:test';

import { hasMoreSidebarContent, SIDEBAR_SCROLL_BOTTOM_THRESHOLD } from './sidebarScrollState.js';

test('sidebar fade stays hidden when navigation does not overflow', () => {
  assert.equal(hasMoreSidebarContent({ scrollHeight: 600, clientHeight: 600, scrollTop: 0 }), false);
  assert.equal(hasMoreSidebarContent(null), false);
});

test('sidebar fade remains visible while navigation content exists below', () => {
  assert.equal(hasMoreSidebarContent({ scrollHeight: 900, clientHeight: 600, scrollTop: 0 }), true);
  assert.equal(hasMoreSidebarContent({ scrollHeight: 900, clientHeight: 600, scrollTop: 180 }), true);
});

test('sidebar fade disappears at the bottom threshold', () => {
  assert.equal(hasMoreSidebarContent({ scrollHeight: 900, clientHeight: 600, scrollTop: 300 }), false);
  assert.equal(
    hasMoreSidebarContent({
      scrollHeight: 900,
      clientHeight: 600,
      scrollTop: 300 - SIDEBAR_SCROLL_BOTTOM_THRESHOLD
    }),
    false
  );
});
