import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const styles = fs.readFileSync(new URL('../themes/chatStyles.js', import.meta.url), 'utf8');

for (const role of ['tenant', 'landlord']) {
  test(`${role} chat puts one green confirmed-send mark outside the latest outgoing bubble`, () => {
    const source = fs.readFileSync(new URL(`../pages/${role}/messages.jsx`, import.meta.url), 'utf8');
    assert.match(source, /latestConfirmedSentMessageId\(visibleMessages, userId\)/);
    assert.match(source, /String\(message\.id\) === String\(latestSentMessageId\)/);
    assert.match(source, /role="img" aria-label="Message sent"[^>]*color: 'success\.main'[^>]*>\s*<AppIcon name="checkCircle"/);
  });

  test(`${role} chat keeps send status in the right gutter without shifting the bubble`, () => {
    const source = fs.readFileSync(new URL(`../pages/${role}/messages.jsx`, import.meta.url), 'utf8');
    assert.match(source, /overflowX: 'hidden',\s*pl: \{ xs: 1, sm: 2\.5 \},\s*pr: 2\.5/);
    assert.match(source, /<Stack direction="row" alignItems="flex-end" sx=\{\{ position: 'relative', maxWidth: '100%' \}\}>\s*<Paper/);
    assert.match(source, /aria-label="Message sent"[^>]*\.\.\.chatMessageStatusSx/);
    assert.match(source, /<CircularProgress size=\{12\} sx=\{\{ \.\.\.chatMessageStatusSx/);
    assert.match(styles, /chatMessageStatusSx = \{\s*position: 'absolute',\s*left: 'calc\(100% \+ 3px\)'/);
  });
}
