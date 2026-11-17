const BUBBLE_BACKGROUND = '#E7F3FB';
const BUBBLE_TEXT = '#000000';
const BUBBLE_BORDER = '#B8D8EC';

export function getConversationBubbleSx({ isOwn = false, isConsecutive = false, brandedChat = false } = {}) {
  return {
    bgcolor: brandedChat
      ? (theme) => isOwn
        ? theme.palette.primary[100]
        : theme.palette.background.paper
      : BUBBLE_BACKGROUND,
    color: brandedChat ? 'text.primary' : BUBBLE_TEXT,
    border: brandedChat
      ? (theme) => `1px solid ${isOwn ? theme.palette.surface.accentBorder : theme.palette.divider}`
      : `1px solid ${BUBBLE_BORDER}`,
    borderRadius: '16px',
    borderTopLeftRadius: isConsecutive ? '8px' : isOwn ? '16px' : '4px',
    borderTopRightRadius: isConsecutive ? '8px' : isOwn ? '4px' : '16px',
    '& .MuiTypography-root': {
      color: brandedChat ? 'text.primary' : BUBBLE_TEXT
    }
  };
}

export function canManageGroupConversation(conversation) {
  return Boolean(conversation && (conversation.isGroupChat ?? conversation.IsGroupChat));
}
