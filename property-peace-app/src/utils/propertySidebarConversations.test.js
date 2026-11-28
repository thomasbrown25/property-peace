import test from 'node:test';
import assert from 'node:assert/strict';
import { getConversationId, getConversationTitle, getPropertyConversations } from './propertySidebarConversations.js';

test('returns active property conversations in most-recent order', () => {
  const conversations = [
    { id: 1, propertyId: 8, title: 'Older', updatedAt: '2026-01-02T10:00:00Z' },
    { id: 2, propertyId: 9, title: 'Other property', updatedAt: '2026-01-04T10:00:00Z' },
    { id: 3, propertyId: 8, title: 'Archived', isArchived: true, updatedAt: '2026-01-05T10:00:00Z' },
    { id: 5, title: 'General chat', updatedAt: '2026-01-06T10:00:00Z' },
    { Id: 4, PropertyId: 8, Title: 'Newest', UpdatedAt: '2026-01-03T10:00:00Z' }
  ];

  assert.deepEqual(getPropertyConversations(conversations, '8').map(getConversationId), [4, 1]);
});

test('provides a stable conversation title fallback', () => {
  assert.equal(getConversationTitle({ Title: 'Wren chat' }), 'Wren chat');
  assert.equal(getConversationTitle({}), 'Untitled conversation');
});
