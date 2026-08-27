import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { getSupportTicketDisplayMessages } from './supportTicketMessages.js';

const ticket = {
  id: 7,
  userId: 42,
  userName: 'Taylor Landlord',
  message: 'Please add downloadable inspection summaries.',
  createdAt: '2026-07-27T14:00:00Z'
};

describe('getSupportTicketDisplayMessages', () => {
  it('prepends the original submission when the conversation payload omits it', () => {
    const supportReply = {
      id: 901,
      senderId: 2,
      senderName: 'Property Peace Support',
      content: 'Thanks, we have shared this with the product team.',
      createdAt: '2026-07-27T15:00:00Z',
      isFromSupport: true,
      isRead: true
    };

    const messages = getSupportTicketDisplayMessages({ ...ticket, messages: [supportReply] });

    assert.deepEqual(messages, [
      {
        id: 'ticket-original-7',
        senderId: 42,
        senderName: 'Taylor Landlord',
        content: 'Please add downloadable inspection summaries.',
        createdAt: '2026-07-27T14:00:00Z',
        isFromSupport: false,
        isRead: true
      },
      supportReply
    ]);
  });

  it('does not duplicate an original submission already present in the conversation', () => {
    const persistedOriginal = {
      id: 900,
      senderId: 42,
      senderName: 'Taylor Landlord',
      content: '  Please add downloadable inspection summaries.  ',
      createdAt: '2026-07-27T14:00:00Z',
      isFromSupport: false,
      isRead: true
    };

    assert.deepEqual(
      getSupportTicketDisplayMessages({ ...ticket, messages: [persistedOriginal] }),
      [persistedOriginal]
    );
  });

  it('does not invent a message when the ticket has no submitted text', () => {
    assert.deepEqual(getSupportTicketDisplayMessages({ ...ticket, message: '  ', messages: [] }), []);
  });
});
