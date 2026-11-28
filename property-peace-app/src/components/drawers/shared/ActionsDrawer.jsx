import { Fragment, useRef, useState } from 'react';
import { Box, Button, CircularProgress, Divider, IconButton, List, ListItem, ListItemButton, Stack, Tooltip, Typography } from '@mui/material';
import AppIcon from 'components/AppIcon';
import ThemeAdaptiveDrawer from './ThemeAdaptiveDrawer';

const actionButtonSx = {
  textTransform: 'none',
  whiteSpace: 'nowrap'
};

export default function ActionsDrawer({ id, title, triggerLabel, actions, iconOnly = false, defaultOpen = false }) {
  const [actionsOpen, setActionsOpen] = useState(defaultOpen);
  const pendingAction = useRef(null);
  const titleId = `${id}-title`;
  const openActions = () => {
    if (!pendingAction.current) setActionsOpen(true);
  };
  const closeActions = () => setActionsOpen(false);
  const selectAction = (action) => {
    if (pendingAction.current) return;
    pendingAction.current = action;
    closeActions();
  };
  const runSelectedAction = () => {
    // Let the drawer finish closing before the next drawer or dialog takes focus.
    const action = pendingAction.current;
    pendingAction.current = null;
    action?.();
  };

  return (
    <>
      {iconOnly ? (
        <Tooltip title={triggerLabel || title}>
          <IconButton
            size="small"
            onClick={openActions}
            aria-label={triggerLabel || title}
            aria-haspopup="dialog"
            aria-controls={actionsOpen ? id : undefined}
            aria-expanded={actionsOpen}
          >
            <AppIcon name="flash" variant="bold" size={18} />
          </IconButton>
        </Tooltip>
      ) : <Button
        variant="contained"
        startIcon={<AppIcon name="flash" variant="bold" />}
        onClick={openActions}
        aria-label={triggerLabel}
        aria-haspopup="dialog"
        aria-controls={actionsOpen ? id : undefined}
        aria-expanded={actionsOpen}
        sx={actionButtonSx}
      >
        Actions
      </Button>}
      <ThemeAdaptiveDrawer
        anchor="right"
        open={actionsOpen}
        onClose={closeActions}
        slotProps={{
          paper: {
            id,
            role: 'dialog',
            'aria-modal': true,
            'aria-labelledby': titleId,
            sx: { width: '100%', maxWidth: 420 }
          },
          transition: { onExited: runSelectedAction }
        }}
      >
        <Stack direction="row" alignItems="center" justifyContent="space-between" sx={{ px: 3, py: 2, flexShrink: 0 }}>
          <Typography id={titleId} component="h2" variant="h5" fontWeight={700}>
            {title}
          </Typography>
          <IconButton aria-label={`Close ${title.toLowerCase()}`} onClick={closeActions}>
            <AppIcon name="close" size={16} />
          </IconButton>
        </Stack>
        <Divider />
        <List sx={{ flex: 1, overflowY: 'auto', p: 1.5 }}>
          {actions.map(({ label, description, icon, disabled, destructive, selected, current, working, onSelect, href, plainIcon }) => (
            <Fragment key={label}>
              {destructive && <Divider component="li" sx={{ my: 1 }} />}
              <ListItem disablePadding>
                <ListItemButton
                  component={href ? 'a' : 'button'}
                  type={href ? undefined : 'button'}
                  href={href}
                  target={href ? '_blank' : undefined}
                  rel={href ? 'noopener noreferrer' : undefined}
                  disabled={disabled}
                  selected={selected}
                  aria-current={current ? 'step' : undefined}
                  onClick={href ? closeActions : () => selectAction(onSelect)}
                  sx={{ width: '100%', textAlign: 'start', gap: 1.5, px: 1.5, py: 1.25, borderRadius: 1 }}
                >
                  <Box
                    component="span"
                    sx={{
                      display: 'grid', placeItems: 'center', width: 36, height: 36, flexShrink: 0,
                      borderRadius: 1, bgcolor: plainIcon ? 'transparent' : 'action.selected', color: destructive ? 'error.main' : plainIcon ? 'primary.main' : 'inherit', fontSize: 18
                    }}
                  >
                    {working ? <CircularProgress size={16} color="inherit" /> : <AppIcon name={icon} />}
                  </Box>
                  <Stack component="span" spacing={0.25}>
                    <Typography component="span" variant="body1" fontWeight={600} color={destructive ? 'error.main' : 'inherit'}>
                      {label}
                    </Typography>
                    <Typography component="span" variant="body2" color="text.secondary">
                      {description}
                    </Typography>
                  </Stack>
                </ListItemButton>
              </ListItem>
            </Fragment>
          ))}
        </List>
      </ThemeAdaptiveDrawer>
    </>
  );
}
