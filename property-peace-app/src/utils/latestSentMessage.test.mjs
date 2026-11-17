import test from 'node:test';
import assert from 'node:assert/strict';
import { latestConfirmedSentMessageId } from './latestSentMessage.mjs';

test('only the latest confirmed outgoing message has a receipt', () => {
  const messages = [
    { id: 1, senderId: 10 },
    { id: 2, senderId: 20 },
    { id: 3, senderId: '10' },
    { id: 4, senderId: 20 }
  ];
  assert.equal(latestConfirmedSentMessageId(messages, 10), 3);
});

test('pending latest outgoing message suppresses an older confirmed receipt', () => {
  assert.equal(latestConfirmedSentMessageId([{ id: 1, senderId: 10 }, { id: 'temp-2', senderId: 10, _optimistic: true }], 10), null);
});

test('no receipt without a sender or confirmed outgoing message', () => {
  assert.equal(latestConfirmedSentMessageId([{ id: 1, senderId: 20 }], 10), null);
  assert.equal(latestConfirmedSentMessageId([{ id: 1, senderId: 10 }], null), null);
});
