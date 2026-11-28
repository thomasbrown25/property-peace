import { sortWrenConversationsMostRecentFirst } from './wrenConversations.js';

const readField = (value, camelCaseKey, pascalCaseKey) => value?.[camelCaseKey] ?? value?.[pascalCaseKey];

export const getConversationId = (conversation) => readField(conversation, 'id', 'Id');

export const getConversationTitle = (conversation) => readField(conversation, 'title', 'Title') || 'Untitled conversation';

export function getGeneralConversations(conversations = []) {
  return sortWrenConversationsMostRecentFirst(
    conversations.filter((conversation) => {
      const propertyId = readField(conversation, 'propertyId', 'PropertyId');
      const archived = readField(conversation, 'isArchived', 'IsArchived');
      return !archived && propertyId == null;
    })
  );
}

export function getPropertyConversations(conversations = [], propertyId) {
  return sortWrenConversationsMostRecentFirst(
    conversations.filter((conversation) => {
      const conversationPropertyId = readField(conversation, 'propertyId', 'PropertyId');
      const archived = readField(conversation, 'isArchived', 'IsArchived');
      return !archived && conversationPropertyId != null && String(conversationPropertyId) === String(propertyId);
    })
  );
}
