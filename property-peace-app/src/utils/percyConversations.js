const readConversationField = (conversation, camelCaseKey, pascalCaseKey) =>
  conversation?.[camelCaseKey] ?? conversation?.[pascalCaseKey];

const timestampOrNull = (value) => {
  const timestamp = Date.parse(value);
  return Number.isFinite(timestamp) ? timestamp : null;
};

const latestActivityTimestamp = (conversation) =>
  timestampOrNull(readConversationField(conversation, 'updatedAt', 'UpdatedAt'))
  ?? timestampOrNull(readConversationField(conversation, 'createdAt', 'CreatedAt'))
  ?? 0;

const numericConversationId = (conversation) => {
  const id = Number(readConversationField(conversation, 'id', 'Id'));
  return Number.isFinite(id) ? id : 0;
};

export function sortPercyConversationsMostRecentFirst(conversations = []) {
  return [...conversations].sort((left, right) => {
    const activityDifference = latestActivityTimestamp(right) - latestActivityTimestamp(left);
    if (activityDifference !== 0) return activityDifference;

    return numericConversationId(right) - numericConversationId(left);
  });
}
