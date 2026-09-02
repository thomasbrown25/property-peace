import assert from 'node:assert/strict';
import test from 'node:test';

import { sortPercyConversationsMostRecentFirst } from './percyConversations.js';

test('sorts Percy conversations by latest activity with the most recent first', () => {
  const conversations = [
    { id: 1, updatedAt: '2026-08-30T12:00:00Z' },
    { id: 2, updatedAt: '2026-09-02T09:30:00Z' },
    { id: 3, updatedAt: '2026-09-01T18:00:00Z' }
  ];

  assert.deepEqual(sortPercyConversationsMostRecentFirst(conversations).map(({ id }) => id), [2, 3, 1]);
});

test('supports API casing and falls back to creation time when updated time is absent or invalid', () => {
  const conversations = [
    { Id: 10, UpdatedAt: 'not-a-date', CreatedAt: '2026-09-01T10:00:00Z' },
    { Id: 11, CreatedAt: '2026-09-02T10:00:00Z' },
    { Id: 12, UpdatedAt: '2026-09-03T10:00:00Z', CreatedAt: '2026-08-01T10:00:00Z' }
  ];

  assert.deepEqual(sortPercyConversationsMostRecentFirst(conversations).map(({ Id }) => Id), [12, 11, 10]);
});

test('uses the newest id as a deterministic tie-breaker and does not mutate the source list', () => {
  const conversations = [
    { id: 20, updatedAt: '2026-09-02T09:30:00Z' },
    { id: 22, updatedAt: '2026-09-02T09:30:00Z' },
    { id: 21, updatedAt: '2026-09-02T09:30:00Z' }
  ];
  const originalOrder = conversations.map(({ id }) => id);

  assert.deepEqual(sortPercyConversationsMostRecentFirst(conversations).map(({ id }) => id), [22, 21, 20]);
  assert.deepEqual(conversations.map(({ id }) => id), originalOrder);
});
