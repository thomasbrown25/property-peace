// Show one server-confirmed receipt, on the newest outgoing bubble only.
export function latestConfirmedSentMessageId(messages, userId) {
  if (userId == null) return null;
  for (let index = messages.length - 1; index >= 0; index -= 1) {
    const message = messages[index];
    if (message.senderId == null || String(message.senderId) !== String(userId)) continue;
    return message._optimistic || message.id == null ? null : message.id;
  }
  return null;
}
