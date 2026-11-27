import assert from 'node:assert/strict';
import { after, before, describe, it } from 'node:test';

import { canManageGroupConversation, getConversationBubbleSx, parseMessageDate, sortConversationMessages } from './conversationPresentation.js';

describe('chat message timestamps in New York', () => {
  const originalTimeZone = process.env.TZ;
  before(() => {
    process.env.TZ = 'America/New_York';
  });
  after(() => {
    if (originalTimeZone === undefined) delete process.env.TZ;
    else process.env.TZ = originalTimeZone;
  });

  it('keeps a new tenant reply below the earlier landlord message before and after confirmation', () => {
    const landlord = { id: 1, createdAt: '2026-11-27T17:31:00.1234567' };
    const pending = { id: 'temp-2', createdAt: '2026-11-27T18:00:00.000Z' };
    const confirmed = { id: 2, createdAt: '2026-11-27T18:00:01' };

    assert.deepEqual(sortConversationMessages([landlord, pending]), [landlord, pending]);
    assert.deepEqual(sortConversationMessages([confirmed, landlord]), [landlord, confirmed]);
  });

  it('puts equivalent UTC and offset timestamps on the same local day around midnight UTC', () => {
    const serverDate = parseMessageDate('2026-11-28T01:00:00');
    const offsetDate = parseMessageDate('2026-11-27T20:00:00-05:00');

    assert.equal(serverDate.getTime(), offsetDate.getTime());
    assert.equal(serverDate.getDate(), 27);
  });
});

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

  it('uses distinct theme-backed sent and received colors in chat without changing support tickets', () => {
    const theme = {
      palette: {
        primary: { 100: '#DDF0E3' },
        background: { paper: '#FFFFFF' },
        surface: { accentBorder: '#ABD3BD' },
        divider: '#DBE3DA'
      }
    };
    const sent = getConversationBubbleSx({ isOwn: true, brandedChat: true });
    const received = getConversationBubbleSx({ isOwn: false, brandedChat: true });
    assert.equal(sent.bgcolor(theme), '#DDF0E3');
    assert.equal(received.bgcolor(theme), '#FFFFFF');
    assert.equal(sent.border(theme), '1px solid #ABD3BD');
    assert.equal(received.border(theme), '1px solid #DBE3DA');
    assert.equal(sent['& .MuiTypography-root'].color, 'text.primary');
    assert.equal(received['& .MuiTypography-root'].color, 'text.primary');
    assert.equal(getConversationBubbleSx({ isOwn: true }).bgcolor, '#E7F3FB');
  });

  it('keeps contrast in dark chat using the dark palette', () => {
    const theme = {
      palette: {
        primary: { 100: '#21483D' },
        background: { paper: '#1A302D' },
        surface: { accentBorder: '#5B947B' },
        divider: '#3B5950'
      }
    };
    assert.equal(getConversationBubbleSx({ isOwn: true, brandedChat: true }).bgcolor(theme), '#21483D');
    assert.equal(getConversationBubbleSx({ isOwn: false, brandedChat: true }).bgcolor(theme), '#1A302D');
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
