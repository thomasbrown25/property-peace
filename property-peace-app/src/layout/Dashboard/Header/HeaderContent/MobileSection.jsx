import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';

// material-ui
import { ClickAwayListener } from '@mui/material';
import { List } from '@mui/material';
import { ListItemButton } from '@mui/material';
import { ListItemIcon } from '@mui/material';
import { ListItemText } from '@mui/material';
import { Paper } from '@mui/material';
import { Popper } from '@mui/material';
import { Box } from '@mui/material';
import { Divider } from '@mui/material';
import { ButtonBase } from '@mui/material';
import { Stack } from '@mui/material';
import { Typography } from '@mui/material';
import { CircularProgress } from '@mui/material';

// project imports
import Avatar from 'components/@extended/Avatar';
import MainCard from 'components/MainCard';
import Transitions from 'components/@extended/Transitions';
import useAuth from 'hooks/useAuth';
import useIsAdmin from 'hooks/useIsAdmin';
import { useOrganization } from 'contexts/OrganizationContext';

// assets
import BellOutlined from '@ant-design/icons/BellOutlined';
import MailOutlined from '@ant-design/icons/MailOutlined';
import SettingOutlined from '@ant-design/icons/SettingOutlined';
import QuestionCircleOutlined from '@ant-design/icons/QuestionCircleOutlined';
import CommentOutlined from '@ant-design/icons/CommentOutlined';
import LogoutOutlined from '@ant-design/icons/LogoutOutlined';
import CheckOutlined from '@ant-design/icons/CheckOutlined';
import avatar1 from 'assets/images/users/avatar-1.png';

// ==============================|| HEADER CONTENT - MOBILE ||============================== //

export default function MobileSection() {
  const navigate = useNavigate();
  const { user, logout } = useAuth();
  const isAdmin = useIsAdmin();
  
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
  
  // Determine base path based on role (priority: Admin > Tenant > Landlord)
  const basePath = isAdmin ? '/admin' : hasTenantRole ? '/tenant' : '/landlord';

  const [open, setOpen] = useState(false);
  const anchorRef = useRef(null);

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

  const handleLogout = async () => {
    try {
      await logout();
      setOpen(false);
      navigate(`/login`, {
        state: {
          from: ''
        }
      });
    } catch (err) {
      console.error(err);
    }
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

  const handleProfileClick = () => {
    navigate(`${basePath}/settings?tab=profile`);
    setOpen(false);
  };

  const displayName = `${user?.firstname || user?.FirstName || ''} ${user?.lastname || user?.LastName || ''}`.trim();
  const profileImageUrl = user?.ProfileImageUrl || user?.profileImageUrl;
  const avatarSrc = profileImageUrl || avatar1;
  const initials = displayName 
    ? displayName.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2)
    : (user?.email || user?.Email || 'U')[0].toUpperCase();

  const prevOpen = useRef(open);
  useEffect(() => {
    if (prevOpen.current === true && open === false) {
      anchorRef.current.focus();
    }
    prevOpen.current = open;
  }, [open]);

  return (
    <>
      <Box sx={{ flexShrink: 0, ml: 0.75, display: 'flex', alignItems: 'center', gap: 1 }}>
        <ButtonBase
          sx={(theme) => ({
            p: 0.25,
            bgcolor: open ? 'grey.100' : 'transparent',
            borderRadius: 1,
            '&:hover': { bgcolor: 'secondary.lighter' },
            '&:focus-visible': { outline: `2px solid ${theme.palette.secondary.dark}`, outlineOffset: 2 },
            ...theme.applyStyles('dark', { bgcolor: open ? 'background.default' : 'transparent', '&:hover': { bgcolor: 'secondary.light' } })
          })}
          aria-label="open menu"
          ref={anchorRef}
          aria-controls={open ? 'menu-list-grow' : undefined}
          aria-haspopup="true"
          onClick={handleToggle}
        >
          <Avatar 
            alt={displayName || 'profile user'} 
            src={avatarSrc} 
            size="sm"
          >
            {initials}
          </Avatar>
        </ButtonBase>
      </Box>
      <Popper
        placement="bottom-end"
        open={open}
        anchorEl={anchorRef.current}
        role={undefined}
        transition
        disablePortal
        sx={{ zIndex: 1300, width: '100%', maxWidth: 320 }}
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
                      <Avatar 
                        alt={displayName || 'profile user'} 
                        src={avatarSrc} 
                        size="md"
                      >
                        {initials}
                      </Avatar>
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

                  {/* Menu Items Section */}
                  <List
                    component="nav"
                    sx={{
                      p: 0,
                      '& .MuiListItemButton-root': {
                        px: 2,
                        py: 1.5
                      },
                      '& .MuiListItemIcon-root': {
                        minWidth: 32
                      }
                    }}
                  >
                    <ListItemButton onClick={() => handleMenuItemClick(`${basePath}/notifications`)}>
                      <ListItemIcon>
                        <BellOutlined style={{ fontSize: 20 }} />
                      </ListItemIcon>
                      <ListItemText primary="Notifications" />
                    </ListItemButton>
                    
                    <ListItemButton onClick={() => handleMenuItemClick(`${basePath}/messages`)}>
                      <ListItemIcon>
                        <MailOutlined style={{ fontSize: 20 }} />
                      </ListItemIcon>
                      <ListItemText primary="Messages" />
                    </ListItemButton>
                    
                    <Divider />
                    
                    <ListItemButton onClick={() => handleMenuItemClick(`${basePath}/settings`)}>
                      <ListItemIcon>
                        <SettingOutlined style={{ fontSize: 20 }} />
                      </ListItemIcon>
                      <ListItemText primary="Settings" />
                    </ListItemButton>
                    
                    <ListItemButton onClick={() => handleMenuItemClick('/contact-us')}>
                      <ListItemIcon>
                        <QuestionCircleOutlined style={{ fontSize: 20 }} />
                      </ListItemIcon>
                      <ListItemText primary="Support" />
                    </ListItemButton>
                    
                    <ListItemButton onClick={() => handleMenuItemClick(`${basePath}/settings?tab=feedback`)}>
                      <ListItemIcon>
                        <CommentOutlined style={{ fontSize: 20 }} />
                      </ListItemIcon>
                      <ListItemText primary="Feedback" />
                    </ListItemButton>
                  </List>

                  {/* Sign Out Section */}
                  <Divider />
                  <List component="nav" sx={{ p: 0, '& .MuiListItemIcon-root': { minWidth: 32 } }}>
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
    </>
  );
}
