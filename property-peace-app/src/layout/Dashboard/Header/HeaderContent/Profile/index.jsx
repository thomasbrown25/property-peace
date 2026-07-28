import { useRef, useState } from 'react';
import { useNavigate } from 'react-router';

// material-ui
import { ButtonBase } from '@mui/material';
import { ClickAwayListener } from '@mui/material';
import { Paper } from '@mui/material';
import { Popper } from '@mui/material';
import { Stack } from '@mui/material';
import { Typography } from '@mui/material';
import { Box } from '@mui/material';
import { List } from '@mui/material';
import { ListItemButton } from '@mui/material';
import { ListItemIcon } from '@mui/material';
import { ListItemText } from '@mui/material';
import { Divider } from '@mui/material';
import { CheckOutlined, MailOutlined, QuestionCircleOutlined, SettingOutlined, UserOutlined } from '@ant-design/icons';
import { CircularProgress } from '@mui/material';

// project imports
import Avatar from 'components/@extended/Avatar';
import MainCard from 'components/MainCard';
import Transitions from 'components/@extended/Transitions';

import useAuth from 'hooks/useAuth';
import useIsAdmin from 'hooks/useIsAdmin';
import { useOrganization } from 'contexts/OrganizationContext';

// assets
import LogoutOutlined from '@ant-design/icons/LogoutOutlined';
import avatar1 from 'assets/images/users/avatar-1.png';

// ==============================|| HEADER CONTENT - PROFILE ||============================== //

export default function Profile() {
  const navigate = useNavigate();

  const { logout, user } = useAuth();
  
  // Safely get organization context - handle case where it might not be available yet
  let organizationContext;
  try {
    organizationContext = useOrganization();
  } catch (error) {
    // If organization context is not available, return null or a fallback
    // This can happen during initial load or if provider hasn't initialized yet
    console.warn('Organization context not available:', error.message);
    organizationContext = {
      currentOrganization: null,
      organizations: [],
      switchOrganization: async () => ({ success: false }),
      loading: true
    };
  }
  
  const { currentOrganization, organizations, switchOrganization, loading: orgLoading } = organizationContext;
  const [switchingOrg, setSwitchingOrg] = useState(null);

  const handleLogout = async () => {
    try {
      await logout();
      navigate(`/login`, {
        state: {
          from: ''
        }
      });
    } catch (err) {
      console.error(err);
    }
  };

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

  // Get roles from user
  const userRoles = Array.isArray(user?.Roles) 
    ? user?.Roles 
    : Array.isArray(user?.roles) 
    ? user?.roles 
    : [];

  // Normalize roles to lowercase for case-insensitive comparison
  const normalizedRoles = userRoles.map(r => String(r).toLowerCase().trim());
  const hasTenantRole = normalizedRoles.includes('tenant');
  const hasLandlordRole = normalizedRoles.includes('landlord');
  const isAdmin = useIsAdmin();

  // Determine base path based on role (priority: Admin > Tenant > Landlord)
  const basePath = isAdmin ? '/admin' : hasTenantRole ? '/tenant' : '/landlord';
  const supportPath = isAdmin ? '/admin/messages?tab=support' : hasLandlordRole && !hasTenantRole ? '/landlord/support/ticket' : '/contact-us';

  const handleNavigate = (path) => {
    navigate(path);
    setOpen(false);
  };

  const handleSwitchOrganization = async (organizationId) => {
    if (organizationId === currentOrganization?.id) {
      setOpen(false);
      return;
    }

    setSwitchingOrg(organizationId);
    try {
      await switchOrganization(organizationId);
      setOpen(false);
    } catch (error) {
      console.error('Error switching organization:', error);
    } finally {
      setSwitchingOrg(null);
    }
  };

  const displayName = `${user?.firstname || user?.FirstName || ''} ${user?.lastname || user?.LastName || ''}`.trim();
  const profileImageUrl = user?.ProfileImageUrl || user?.profileImageUrl;
  // Use profile image if available, otherwise use default avatar
  const avatarSrc = profileImageUrl || avatar1;
  // Get initials for fallback (only used if image fails to load)
  const initials = displayName 
    ? displayName.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2)
    : (user?.email || user?.Email || 'U')[0].toUpperCase();

  const handleProfileClick = () => {
    navigate(`${basePath}/settings?tab=profile`);
    setOpen(false);
  };

  return (
    <Box sx={{ flexShrink: 0, ml: 0.75 }}>
      <ButtonBase
        sx={(theme) => ({
          p: 0.25,
          color: 'text.primary',
          bgcolor: open ? 'action.selected' : 'transparent',
          borderRadius: 1,
          transition: theme.transitions.create(['background-color', 'box-shadow'], {
            duration: theme.transitions.duration.shorter
          }),
          '&:hover': {
            bgcolor: 'action.hover',
            boxShadow: 'none'
          },
          '&:focus-visible': { outline: '2px solid', outlineColor: 'primary.main', outlineOffset: 2 },
          ...theme.applyStyles('dark', {
            bgcolor: open ? 'action.selected' : 'transparent',
            '&:hover': { bgcolor: 'action.hover' }
          })
        })}
        aria-label="open profile"
        ref={anchorRef}
        aria-controls={open ? 'profile-grow' : undefined}
        aria-haspopup="true"
        onClick={handleToggle}
      >
        <Stack direction="row" sx={{ gap: 1.25, alignItems: 'center', p: 0.5 }}>
          {profileImageUrl ? (
            <Avatar 
              alt={displayName || 'profile user'} 
              src={profileImageUrl} 
              size="sm"
            >
              {initials}
            </Avatar>
          ) : (
            <Avatar 
              alt={displayName || 'profile user'} 
              src={avatar1} 
              size="sm"
            >
              {initials}
            </Avatar>
          )}
          <Typography variant="subtitle1" sx={{ textTransform: 'capitalize' }}>
            {displayName || user?.name || user?.email || user?.Email}
          </Typography>
        </Stack>
      </ButtonBase>
      <Popper
        placement="bottom-end"
        open={open}
        anchorEl={anchorRef.current}
        role={undefined}
        transition
        disablePortal
        popperOptions={{
          modifiers: [
            {
              name: 'offset',
              options: {
                offset: [0, 9]
              }
            }
          ]
        }}
      >
        {({ TransitionProps }) => (
          <Transitions type="grow" position="top-right" in={open} {...TransitionProps}>
            <Paper sx={(theme) => ({ boxShadow: theme.customShadows.z1, width: 320, minWidth: 280, maxWidth: { xs: 280, md: 320 } })}>
              <ClickAwayListener onClickAway={handleClose}>
                <MainCard elevation={0} border={false} content={false}>
                  {/* User Info Section */}
                  <Box 
                    sx={{ 
                      p: 2.5, 
                      pb: 2,
                      cursor: 'pointer',
                      '&:hover': { bgcolor: 'action.hover' }
                    }}
                    onClick={handleProfileClick}
                  >
                    <Stack direction="row" spacing={1.5} alignItems="center">
                      {profileImageUrl ? (
                        <Avatar 
                          alt={displayName || 'profile user'} 
                          src={profileImageUrl} 
                          size="md"
                        >
                          {initials}
                        </Avatar>
                      ) : (
                        <Avatar 
                          alt={displayName || 'profile user'} 
                          src={avatar1} 
                          size="md"
                        >
                          {initials}
                        </Avatar>
                      )}
                      <Box sx={{ flex: 1, minWidth: 0 }}>
                        <Typography variant="subtitle1" sx={{ textTransform: 'capitalize', fontWeight: 600, mb: 0.25 }}>
                          {displayName}
                        </Typography>
                        <Stack direction="row" spacing={0.75} alignItems="center" sx={{ mt: 0.5 }}>
                          <MailOutlined style={{ fontSize: 14, color: 'inherit', opacity: 0.7 }} />
                          <Typography variant="body2" color="text.secondary" sx={{ fontSize: '0.8125rem', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                            {user?.email || user?.Email || 'No email'}
                          </Typography>
                        </Stack>
                      </Box>
                    </Stack>
                  </Box>
                  <Divider />
                  
                  {/* Organizations Section */}
                  {organizations && organizations.length > 0 && (
                    <>
                      <Box sx={{ px: 2, py: 1.5 }}>
                        <Typography variant="caption" color="text.secondary" sx={{ fontSize: '0.75rem', fontWeight: 600, textTransform: 'uppercase' }}>
                          Organizations
                        </Typography>
                      </Box>
                      <List component="nav" sx={{ p: 0, '& .MuiListItemIcon-root': { minWidth: 32 } }}>
                        {organizations.map((org) => {
                          const isCurrent = org.id === currentOrganization?.id;
                          const isSwitching = switchingOrg === org.id;
                          return (
                            <ListItemButton
                              key={org.id}
                              onClick={() => handleSwitchOrganization(org.id)}
                              disabled={isSwitching || orgLoading}
                              sx={{
                                py: 1.25,
                                px: 2.5,
                                '&:hover': { bgcolor: 'action.hover' },
                                ...(isCurrent && {
                                  bgcolor: 'action.selected',
                                  '&:hover': { bgcolor: 'action.selected' }
                                })
                              }}
                            >
                              <Box sx={{ display: 'flex', alignItems: 'center', width: '100%' }}>
                                <Box
                                  sx={{
                                    width: 32,
                                    height: 32,
                                    borderRadius: '50%',
                                    bgcolor: 'primary.lighter',
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    mr: 1.5,
                                    flexShrink: 0
                                  }}
                                >
                                  <Typography variant="caption" sx={{ fontWeight: 600, color: 'primary.main' }}>
                                    {org.name?.charAt(0)?.toUpperCase() || 'O'}
                                  </Typography>
                                </Box>
                                <Box sx={{ flex: 1, minWidth: 0 }}>
                                  <Typography variant="body2" sx={{ fontWeight: isCurrent ? 600 : 400 }}>
                                    {org.name}
                                  </Typography>
                                  {org.description && (
                                    <Typography variant="caption" color="text.secondary" sx={{ fontSize: '0.75rem', display: 'block', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                      {org.description}
                                    </Typography>
                                  )}
                                </Box>
                                {isSwitching ? (
                                  <CircularProgress size={16} sx={{ ml: 1 }} />
                                ) : isCurrent ? (
                                  <CheckOutlined style={{ fontSize: 16, color: 'inherit', opacity: 0.7, marginLeft: 8 }} />
                                ) : null}
                              </Box>
                            </ListItemButton>
                          );
                        })}
                      </List>
                      <Divider sx={{ my: 1 }} />
                    </>
                  )}

                  {/* Account actions */}
                  <List component="nav" sx={{ p: 0, '& .MuiListItemIcon-root': { minWidth: 32 } }}>
                    <ListItemButton onClick={() => handleNavigate(`${basePath}/settings?tab=profile`)}>
                      <ListItemIcon><UserOutlined /></ListItemIcon>
                      <ListItemText primary="Profile" />
                    </ListItemButton>
                    <ListItemButton onClick={() => handleNavigate(`${basePath}/settings`)}>
                      <ListItemIcon><SettingOutlined /></ListItemIcon>
                      <ListItemText primary="Settings" />
                    </ListItemButton>
                    <ListItemButton onClick={() => handleNavigate(supportPath)}>
                      <ListItemIcon><QuestionCircleOutlined /></ListItemIcon>
                      <ListItemText primary="Support" />
                    </ListItemButton>
                    <Divider />
                    <ListItemButton onClick={handleLogout}>
                      <ListItemIcon>
                        <LogoutOutlined />
                      </ListItemIcon>
                      <ListItemText primary="Sign out" />
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
