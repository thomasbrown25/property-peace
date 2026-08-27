import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { canManageGroupConversation, getConversationBubbleSx } from './conversationPresentation.js';

describe('getConversationBubbleSx', () => {
  it('gives sent and received messages the same readable light-blue and black palette', () => {
    const sent = getConversationBubbleSx({ isOwn: true });
    const received = getConversationBubbleSx({ isOwn: false });

    for (const style of [sent, received]) {
      assert.equal(style.bgcolor, '#E7F3FB');
      assert.equal(style.color, '#000000');
      assert.equal(style.border, '1px solid #B8D8EC');
      assert.equal(style['& .MuiTypography-root'].color, '#000000');
    }
  });

  it('preserves sender direction through the leading top corner', () => {
    const sent = getConversationBubbleSx({ isOwn: true });
    const received = getConversationBubbleSx({ isOwn: false });
    const consecutive = getConversationBubbleSx({ isOwn: true, isConsecutive: true });

    assert.equal(sent.borderTopLeftRadius, '16px');
    assert.equal(sent.borderTopRightRadius, '4px');
    assert.equal(received.borderTopLeftRadius, '4px');
    assert.equal(received.borderTopRightRadius, '16px');
    assert.equal(consecutive.borderTopLeftRadius, '8px');
    assert.equal(consecutive.borderTopRightRadius, '8px');
  });
});

describe('canManageGroupConversation', () => {
  it('allows managing existing group conversations without offering new group creation', () => {
    assert.equal(canManageGroupConversation({ isGroupChat: true }), true);
    assert.equal(canManageGroupConversation({ IsGroupChat: true }), true);
    assert.equal(canManageGroupConversation({ isGroupChat: false }), false);
    assert.equal(canManageGroupConversation(null), false);
  });
});
