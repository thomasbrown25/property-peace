const BUBBLE_BACKGROUND = '#E7F3FB';
const BUBBLE_TEXT = '#000000';
const BUBBLE_BORDER = '#B8D8EC';

export function getConversationBubbleSx({ isOwn = false, isConsecutive = false } = {}) {
  return {
    bgcolor: BUBBLE_BACKGROUND,
    color: BUBBLE_TEXT,
    border: `1px solid ${BUBBLE_BORDER}`,
    borderRadius: '16px',
    borderTopLeftRadius: isConsecutive ? '8px' : isOwn ? '16px' : '4px',
    borderTopRightRadius: isConsecutive ? '8px' : isOwn ? '4px' : '16px',
    '& .MuiTypography-root': {
      color: BUBBLE_TEXT
    }
  };
}

export function canManageGroupConversation(conversation) {
  return Boolean(conversation && (conversation.isGroupChat ?? conversation.IsGroupChat));
}
