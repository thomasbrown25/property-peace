import { useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import axiosServices from 'utils/axios';
import { openSnackbar } from 'api/snackbar';

// material-ui
import { useMediaQuery } from '@mui/material';
import { Avatar } from '@mui/material';
import { Badge } from '@mui/material';
import { ClickAwayListener } from '@mui/material';
import { List } from '@mui/material';
import { ListItem } from '@mui/material';
import { ListItemButton } from '@mui/material';
import { ListItemAvatar } from '@mui/material';
import { ListItemText } from '@mui/material';
import { Paper } from '@mui/material';
import { Popper } from '@mui/material';
import { Tooltip } from '@mui/material';
import { Typography } from '@mui/material';
import { Box } from '@mui/material';
import { Button } from '@mui/material';

// project imports
import MainCard from 'components/MainCard';
import IconButton from 'components/@extended/IconButton';
import Transitions from 'components/@extended/Transitions';
import useFetchNotifications, { useFetchUnreadCount } from 'hooks/useFetchNotifications';
import useFetchRentCollection from 'hooks/useFetchRentCollection';
import { formatRelativeTime } from 'utils/formatters';
import useIsAdmin from 'hooks/useIsAdmin';
import useAuth from 'hooks/useAuth';

// assets
import BellOutlined from '@ant-design/icons/BellOutlined';
import GiftOutlined from '@ant-design/icons/GiftOutlined';
import MessageOutlined from '@ant-design/icons/MessageOutlined';
import SettingOutlined from '@ant-design/icons/SettingOutlined';

// sx styles
const avatarSX = {
  width: 36,
  height: 36,
  fontSize: '1rem'
};

const actionSX = {
  mt: '6px',
  ml: 1,
  top: 'auto',
  right: 'auto',
  alignSelf: 'flex-start',

  transform: 'none'
};

// ==============================|| HEADER CONTENT - NOTIFICATION ||============================== //

export default function Notification() {
  const downMD = useMediaQuery((theme) => theme.breakpoints.down('md'));
  const navigate = useNavigate();
  const auth = useAuth();
  const isAdmin = useIsAdmin();
  const { unreadCount: unreadCountFromAPI } = useFetchUnreadCount();
  const { notifications, unreadCount: unreadCountFromList, refetch } = useFetchNotifications();
  
  // Fetch rent records to look up propertyId by leaseId
  const { rentRecords } = useFetchRentCollection(null, true);
  
  // Get user roles to determine base path
  const userRoles = Array.isArray(auth?.user?.Roles) 
    ? auth.user.Roles 
    : Array.isArray(auth?.user?.roles) 
    ? auth.user.roles 
    : [];
  
  // Normalize roles to lowercase for case-insensitive comparison
  const normalizedRoles = userRoles.map(r => String(r).toLowerCase().trim());
  const hasTenantRole = normalizedRoles.includes('tenant');
  
  // Determine base path based on user role (priority: Admin > Tenant > Landlord)
  const basePath = isAdmin ? '/admin' : hasTenantRole ? '/tenant' : '/landlord';

  const anchorRef = useRef(null);
  const [open, setOpen] = useState(false);
  const handleToggle = () => {
    setOpen((current) => !current);
  };

  const handleMarkAllRead = async () => {
    if (unreadCount === 0) return;
    try {
      await axiosServices.post('/api/notifications/mark-all-read');
      await refetch();
    } catch (error) {
      openSnackbar({ open: true, message: 'Unable to mark notifications as read.', variant: 'alert', alert: { color: 'error' } });
    }
  };

  const handleClose = (event) => {
    if (anchorRef.current && anchorRef.current.contains(event.target)) {
      return;
    }
    setOpen(false);
  };

  const handleViewAll = () => {
    setOpen(false);
    navigate(`${basePath}/notifications`);
  };

  const handleNotificationClick = async (notification) => {
    setOpen(false);
    
    // Mark as read when clicked
    if (!notification.isRead) {
      try {
        await axiosServices.post(`/api/notifications/mark-read/${notification.id}`);
        await refetch(); // Refresh notifications
      } catch (error) {
        console.error('Error marking notification as read:', error);
      }
    }

    // Navigate based on notification type and user role
    if (hasTenantRole) {
      // Tenant-specific routes
      switch (notification.type) {
        case 'rent':
        case 'payment':
          navigate('/tenant/payments');
          break;
        case 'maintenance':
          if (notification.relatedId) {
            navigate(`/tenant/maintenance/${notification.relatedId}`);
          } else {
            navigate('/tenant/maintenance');
          }
          break;
        case 'lease':
          navigate('/tenant/lease');
          break;
        case 'message':
          navigate('/tenant/messages');
          break;
        case 'application':
          navigate('/tenant/applications');
          break;
        case 'tenantInvite':
          navigate('/tenant/invite-accept');
          break;
        default:
          navigate('/tenant/notifications');
          break;
      }
    } else {
      // Landlord/Admin routes
      switch (notification.type) {
        case 'rent':
        case 'payment': {
          // For rent and payment types, we need propertyId
          // Check if propertyId is directly available, otherwise look it up from rent records
          let propertyId = notification.propertyId || notification.metadata?.propertyId;
          
          // If propertyId not found, relatedId might be a leaseId - look it up in rent records
          if (!propertyId && notification.relatedId && rentRecords.length > 0) {
            // Find rent record by leaseId (relatedId might be leaseId)
            const rentRecord = rentRecords.find(
              (record) => record.leaseId === notification.relatedId || record.id === notification.relatedId
            );
            
            // Get propertyId from the rent record
            if (rentRecord?.propertyId) {
              propertyId = rentRecord.propertyId;
            } else if (notification.relatedId) {
              // Fallback: assume relatedId is propertyId if not found in rent records
              propertyId = notification.relatedId;
            }
          } else if (!propertyId) {
            // Last fallback: use relatedId as propertyId
            propertyId = notification.relatedId;
          }
          
          // Rent overdue and Payment Received notifications should go to leases page
          navigate(`${basePath}/leases`);
          break;
        }
        case 'maintenance':
          if (notification.relatedId) {
            navigate(`${basePath}/maintenance/${notification.relatedId}`);
          }
          break;
        case 'lease':
          if (notification.relatedId) {
            navigate(`${basePath}/leases/${notification.relatedId}`);
          }
          break;
        case 'rentPaymentSetupReminder':
          if (notification.relatedId) {
            navigate(`${basePath}/property/${notification.relatedId}`);
          }
          break;
        case 'support':
          if (isAdmin) {
            navigate(`/admin/messages?tab=support${notification.relatedId ? `&ticket=${notification.relatedId}` : ''}`);
          } else {
            navigate(`/landlord/support/ticket${notification.relatedId ? `?ticket=${notification.relatedId}` : ''}`);
          }
          break;
        default:
          // For unknown types, go to notifications page
          navigate(`${basePath}/notifications`);
          break;
      }
    }
  };

  // Calculate unread count from notifications array (most reliable)
  const calculatedUnreadCount = notifications?.filter((n) => !n.isRead)?.length || 0;
  
  // Prioritize calculated count from notifications array, fallback to API values
  // This ensures accuracy even if API count endpoint has issues
  const unreadCount = calculatedUnreadCount > 0 
    ? calculatedUnreadCount 
    : (unreadCountFromList || unreadCountFromAPI || 0);

  // Show only recent notifications (last 5) in the dropdown
  const recentNotifications = notifications?.slice(0, 5) || [];

  return (
    <Box sx={{ flexShrink: 0, ml: 0.75 }}>
      <IconButton
        color="secondary"
        variant="light"
        sx={(theme) => ({
          color: 'text.primary',
          bgcolor: open ? 'action.selected' : 'transparent',
          transition: theme.transitions.create(['background-color', 'box-shadow'], {
            duration: theme.transitions.duration.shorter
          }),
          '&:hover': {
            bgcolor: 'action.hover',
            boxShadow: 'none'
          },
          ...theme.applyStyles('dark', { bgcolor: open ? 'action.selected' : 'transparent' })
        })}
        aria-label="open notifications"
        ref={anchorRef}
        aria-controls={open ? 'profile-grow' : undefined}
        aria-haspopup="true"
        onClick={handleToggle}
      >
        <Badge badgeContent={unreadCount > 0 ? unreadCount : null} color="primary" max={99}>
          <BellOutlined />
        </Badge>
      </IconButton>
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
            <Paper sx={(theme) => ({ boxShadow: theme.customShadows.z1, width: '100%', minWidth: 285, maxWidth: { xs: 285, md: 420 } })}>
              <ClickAwayListener onClickAway={handleClose}>
                <MainCard
                  title="Notifications"
                  secondary={
                    unreadCount > 0 ? (
                      <Button size="small" color="primary" onClick={handleMarkAllRead} sx={{ textTransform: 'none' }}>
                        Mark all as read
                      </Button>
                    ) : null
                  }
                  elevation={0}
                  border={false}
                  content={false}
                >
                  <List
                    component="nav"
                    sx={{
                      p: 0,
                      '& .MuiListItemButton-root': {
                        py: 0.5,
                        px: 2,
                        '&.Mui-selected': { bgcolor: 'grey.50', color: 'text.primary' },
                        '&:hover': { bgcolor: 'transparent' },
                        '& .MuiAvatar-root': avatarSX,
                        '& .MuiListItemSecondaryAction-root': { ...actionSX, position: 'relative' }
                      }
                    }}
                  >
                    {recentNotifications.length === 0 ? (
                      <ListItem>
                        <ListItemText
                          primary={
                            <Typography variant="body2" color="text.secondary" sx={{ textAlign: 'center', py: 2 }}>
                              No notifications
                            </Typography>
                          }
                        />
                      </ListItem>
                    ) : (
                      recentNotifications.map((notification, index) => (
                        <ListItem
                          key={notification.id}
                          component={ListItemButton}
                          divider={index < recentNotifications.length - 1}
                          selected={!notification.isRead}
                          secondaryAction={
                            <Typography variant="caption" noWrap>
                              {formatRelativeTime(notification.createdAt)}
                            </Typography>
                          }
                          onClick={() => handleNotificationClick(notification)}
                        >
                          <ListItemAvatar>
                            <Avatar
                              sx={{
                                color: notification.isRead ? 'text.secondary' : 'primary.main',
                                bgcolor: notification.isRead ? 'grey.200' : 'primary.lighter'
                              }}
                            >
                              <BellOutlined />
                            </Avatar>
                          </ListItemAvatar>
                          <ListItemText
                            primary={
                              <Typography variant="h6" sx={{ fontWeight: notification.isRead ? 'normal' : 'bold' }}>
                                {notification.title}
                              </Typography>
                            }
                            secondary={
                              <Typography variant="body2" color="text.secondary" sx={{ overflow: 'hidden', textOverflow: 'ellipsis' }}>
                                {notification.message}
                              </Typography>
                            }
                          />
                        </ListItem>
                      ))
                    )}
                    <ListItemButton sx={{ textAlign: 'center', py: `${12}px !important` }} onClick={handleViewAll}>
                      <ListItemText
                        primary={
                          <Typography variant="h6" color="primary">
                            View All
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
