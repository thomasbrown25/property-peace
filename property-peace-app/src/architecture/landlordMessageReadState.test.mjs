import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';

const source = fs.readFileSync(new URL('../pages/landlord/messages.jsx', import.meta.url), 'utf8');
const loadMessagesBlock = source.slice(source.indexOf('  const loadMessages = useCallback('), source.indexOf('  const handleSendMessage'));

test('clicking an already-loaded landlord conversation still marks it as read', () => {
  assert.doesNotMatch(loadMessagesBlock, /if \(currentConversationId === conversationId\)[\s\S]*?return;/);
  assert.match(
    loadMessagesBlock,
    /if \(!conversationAlreadyLoaded\) \{[\s\S]*dispatch\(getMessages\(conversationId\)\);[\s\S]*\}[\s\S]*dispatch\(markConversationAsRead\(conversationId\)\)/
  );
});
