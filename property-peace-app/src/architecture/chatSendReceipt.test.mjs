import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

for (const role of ['tenant', 'landlord']) {
  test(`${role} chat puts one green confirmed-send mark outside the latest outgoing bubble`, () => {
    const source = fs.readFileSync(new URL(`../pages/${role}/messages.jsx`, import.meta.url), 'utf8');
    assert.match(source, /latestConfirmedSentMessageId\(visibleMessages, userId\)/);
    assert.match(source, /String\(message\.id\) === String\(latestSentMessageId\)/);
    assert.match(source, /role="img" aria-label="Message sent"[^>]*color: 'success\.main'[^>]*>\s*<AppIcon name="checkCircle"/);
  });
}
