import { useState } from 'react';
import { Box, IconButton, ListItemIcon, Menu, MenuItem, Tooltip } from '@mui/material';
import AppIcon from 'components/AppIcon';
import ActionsDrawer from 'components/drawers/shared/ActionsDrawer';

export default function ChatRowActions({ id, name, onMarkUnread, onArchive, variant = 'drawer' }) {
  const [menuAnchor, setMenuAnchor] = useState(null);
  const menuOpen = Boolean(menuAnchor);
  const triggerId = `${id}-trigger`;
  const triggerLabel = `Actions for ${name}`;
  const closeMenu = () => setMenuAnchor(null);

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
      {variant === 'menu' ? (
        <>
          <Tooltip title={menuOpen ? '' : triggerLabel}>
            <IconButton
              id={triggerId}
              size="small"
              aria-label={triggerLabel}
              aria-haspopup="menu"
              aria-controls={menuOpen ? id : undefined}
              aria-expanded={menuOpen}
              onClick={(event) => setMenuAnchor(event.currentTarget)}
            >
              <AppIcon name="flash" variant="bold" size={18} />
            </IconButton>
          </Tooltip>
          <Menu
            anchorEl={menuAnchor}
            open={menuOpen}
            onClose={closeMenu}
            anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
            transformOrigin={{ vertical: 'top', horizontal: 'right' }}
            slotProps={{ list: { id, 'aria-labelledby': triggerId } }}
          >
            {actions.map(({ label, icon, onSelect }) => (
              <MenuItem
                key={label}
                onClick={() => {
                  closeMenu();
                  onSelect();
                }}
              >
                <ListItemIcon>
                  <AppIcon name={icon} size={16} />
                </ListItemIcon>
                {label}
              </MenuItem>
            ))}
          </Menu>
        </>
      ) : (
        <ActionsDrawer id={id} title="Conversation actions" triggerLabel={triggerLabel} actions={actions} iconOnly />
      )}
    </Box>
  );
}
