import { Box } from '@mui/material';
import ActionsDrawer from 'components/drawers/shared/ActionsDrawer';

export default function ChatRowActions({ id, name, onMarkUnread, onArchive }) {
  const actions = [
    {
      label: 'Mark as unread',
      description: 'Flag this conversation to come back to later.',
      icon: 'messages',
      onSelect: onMarkUnread
    }
  ];
  if (onArchive) {
    actions.push({
      label: 'Archive',
      description: 'Move this conversation out of your inbox.',
      icon: 'document',
      onSelect: onArchive
    });
  }

  return (
    <Box
      className="chat-row-actions"
      sx={{
        mx: 0.75,
        flexShrink: 0,
        '& .MuiIconButton-root': { width: 30, height: 30 },
        '& .MuiIconButton-root:focus-visible': { outline: '2px solid', outlineColor: 'primary.main' }
      }}
    >
      <ActionsDrawer id={id} title="Conversation actions" triggerLabel={`Actions for ${name}`} actions={actions} iconOnly />
    </Box>
  );
}
