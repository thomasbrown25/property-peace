import assert from 'node:assert/strict';
import test from 'node:test';

import { AIFollowUpAPI } from '../../../shared/api/aiFollowUp.js';

const attemptModule = await import('./percyChatRequestAttempt.js').catch(() => ({}));
const createPercyChatRequestAttempt = attemptModule.createPercyChatRequestAttempt;

function makeTracker() {
  let sequence = 0;
  return createPercyChatRequestAttempt(() => `request-${++sequence}`);
}

test('chat and streaming requests include the caller-owned clientRequestId', async () => {
  const calls = [];
  const api = new AIFollowUpAPI({
    post: async (url, body) => calls.push({ kind: 'post', url, body }),
    streamNdjson: async (url, body, options) => calls.push({ kind: 'stream', url, body, options })
  });

  await api.chat('Portfolio status', 41, 'request-chat-1');
  const streamOptions = { signal: 'signal' };
  await api.streamChat('Rent status', 42, 'request-stream-1', streamOptions);

  assert.deepEqual(calls, [
    {
      kind: 'post',
      url: '/api/ai-copilot/chat',
      body: { message: 'Portfolio status', conversationId: 41, clientRequestId: 'request-chat-1' }
    },
    {
      kind: 'stream',
      url: '/api/ai-copilot/chat/stream',
      body: { message: 'Rent status', conversationId: 42, clientRequestId: 'request-stream-1' },
      options: streamOptions
    }
  ]);
});

test('AI Center request attempt API is available to browser code', () => {
  assert.equal(typeof createPercyChatRequestAttempt, 'function');
});

test('identical in-flight and failed attempts retain one clientRequestId', () => {
  const tracker = makeTracker();
  const context = { message: 'Rent status', conversationId: 42, scopeKey: 'user-1:org-2' };

  const first = tracker.begin(context);
  const whileInFlight = tracker.begin(context);
  tracker.fail(first);
  const retry = tracker.begin(context);

  assert.equal(whileInFlight.clientRequestId, first.clientRequestId);
  assert.equal(retry.clientRequestId, first.clientRequestId);
});

test('success clears the completed request attempt', () => {
  const tracker = makeTracker();
  const context = { message: 'Rent status', conversationId: 42, scopeKey: 'user-1:org-2' };
  const first = tracker.begin(context);

  tracker.succeed(first);

  assert.notEqual(tracker.begin(context).clientRequestId, first.clientRequestId);
});

test('input or conversation scope changes clear a retained failed attempt', () => {
  const tracker = makeTracker();
  const context = { message: 'Rent status', conversationId: 42, scopeKey: 'user-1:org-2' };
  const first = tracker.begin(context);
  tracker.fail(first);

  tracker.inputChanged('Different question');
  const afterInputChange = tracker.begin(context);
  tracker.fail(afterInputChange);
  tracker.contextChanged({ conversationId: 99, scopeKey: context.scopeKey });
  const afterConversationChange = tracker.begin(context);
  tracker.fail(afterConversationChange);
  tracker.contextChanged({ conversationId: context.conversationId, scopeKey: 'user-1:org-3' });

  assert.notEqual(afterInputChange.clientRequestId, first.clientRequestId);
  assert.notEqual(afterConversationChange.clientRequestId, afterInputChange.clientRequestId);
  assert.notEqual(tracker.begin(context).clientRequestId, afterConversationChange.clientRequestId);
});
