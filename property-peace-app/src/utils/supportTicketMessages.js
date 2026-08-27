export function getSupportTicketDisplayMessages(ticket) {
  const messages = Array.isArray(ticket?.messages) ? ticket.messages : [];
  const originalContent = ticket?.message?.trim();

  if (!originalContent) return messages;

  const includesOriginal = messages.some(
    (message) => !message.isFromSupport && message.content?.trim() === originalContent
  );
  if (includesOriginal) return messages;

  return [
    {
      id: `ticket-original-${ticket.id}`,
      senderId: ticket.userId,
      senderName: ticket.userName || 'You',
      content: originalContent,
      createdAt: ticket.createdAt,
      isFromSupport: false,
      isRead: true
    },
    ...messages
  ];
}
