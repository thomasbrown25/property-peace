import { useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';

// material-ui
import { useMediaQuery } from '@mui/material';
import { ClickAwayListener } from '@mui/material';
import { List } from '@mui/material';
import { ListItemButton } from '@mui/material';
import { ListItemIcon } from '@mui/material';
import { ListItemText } from '@mui/material';
import { Paper } from '@mui/material';
import { Popper } from '@mui/material';
import { Tooltip } from '@mui/material';
import { Typography } from '@mui/material';
import { Box } from '@mui/material';

// project imports
import MainCard from 'components/MainCard';
import IconButton from 'components/@extended/IconButton';
import Transitions from 'components/@extended/Transitions';

// assets
import QuestionCircleOutlined from '@ant-design/icons/QuestionCircleOutlined';
import FileTextOutlined from '@ant-design/icons/FileTextOutlined';
import useAuth from 'hooks/useAuth';

// ==============================|| HEADER CONTENT - SUPPORT ||============================== //

export default function Support() {
  const downMD = useMediaQuery((theme) => theme.breakpoints.down('md'));
  const navigate = useNavigate();
  const auth = useAuth();

  // Get roles to determine if user is landlord
  const userRoles = Array.isArray(auth?.user?.Roles) 
    ? auth.user.Roles 
    : Array.isArray(auth?.user?.roles) 
    ? auth.user.roles 
    : [];
  
  const normalizedRoles = userRoles.map(r => String(r).toLowerCase().trim());
  const hasLandlordRole = normalizedRoles.includes('landlord');
  const hasTenantRole = normalizedRoles.includes('tenant');
  const hasAdminRole = normalizedRoles.includes('admin');

  const anchorRef = useRef(null);
  const [open, setOpen] = useState(false);
  
  const handleToggle = () => {
    setOpen((prevOpen) => !prevOpen);
  };

  const handleClose = (event) => {
    if (anchorRef.current && anchorRef.current.contains(event.target)) {
      return;
    }
    setOpen(false);
  };

  const handleMenuItemClick = (path) => {
    setOpen(false);
    navigate(path);
  };

  // Only show support dropdown for landlords (not tenants or admins)
  if (hasTenantRole || hasAdminRole || !hasLandlordRole) {
    return null;
  }

  return (
    <Box sx={{ flexShrink: 0, ml: 0.75 }}>
      <Tooltip title="Resource Center">
        <IconButton
          color="secondary"
          variant="light"
          sx={(theme) => ({
            color: 'text.primary',
            bgcolor: open ? 'action.selected' : 'transparent',
            transition: theme.transitions.create(['background-color', 'box-shadow', 'transform'], {
              duration: theme.transitions.duration.shorter
            }),
            '&:hover': {
              bgcolor: 'action.hover',
              boxShadow: 'none',
              transform: 'translateY(-1px)'
            },
            ...theme.applyStyles('dark', { bgcolor: open ? 'action.selected' : 'transparent' })
          })}
          aria-label="open support"
          ref={anchorRef}
          aria-controls={open ? 'support-grow' : undefined}
          aria-haspopup="true"
          onClick={handleToggle}
        >
          <QuestionCircleOutlined />
        </IconButton>
      </Tooltip>
      <Popper
        placement={downMD ? 'bottom' : 'bottom-end'}
        open={open}
        anchorEl={anchorRef.current}
        role={undefined}
        transition
        disablePortal
        popperOptions={{ modifiers: [{ name: 'offset', options: { offset: [downMD ? -5 : 0, 9] } }] }}
      >
        {({ TransitionProps }) => (
          <Transitions type="grow" position={downMD ? 'top' : 'top-right'} in={open} {...TransitionProps}>
            <Paper sx={(theme) => ({ boxShadow: theme.customShadows.z1, width: '100%', minWidth: 320, maxWidth: 400 })}>
              <ClickAwayListener onClickAway={handleClose}>
                <MainCard
                  title="Resource Center"
                  elevation={0}
                  border={false}
                  content={false}
                  sx={{ p: 0 }}
                >
                  <List
                    component="nav"
                    sx={{
                      p: 0,
                      '& .MuiListItemButton-root': {
                        py: 1.5,
                        px: 2,
                        '&:hover': { bgcolor: 'action.hover' }
                      }
                    }}
                  >
                    <ListItemButton onClick={() => handleMenuItemClick('/landlord/support/ticket')}>
                      <ListItemIcon sx={{ minWidth: 40 }}>
                        <FileTextOutlined style={{ fontSize: 20, color: '#1890ff' }} />
                      </ListItemIcon>
                      <ListItemText 
                        primary={
                          <Typography variant="body1" fontWeight={500}>
                            Support
                          </Typography>
                        }
                        secondary={
                          <Typography variant="caption" color="text.secondary">
                            Ask a question, report an issue, or share feedback with our team.
                          </Typography>
                        }
                      />
                    </ListItemButton>

                  </List>
                </MainCard>
              </ClickAwayListener>
            </Paper>
          </Transitions>
        )}
      </Popper>
    </Box>
  );
}
