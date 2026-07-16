import { useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Box,
  Typography,
  Button,
  Stack,
  List,
  ListItemButton,
  ListItemText,
  ListItemAvatar,
  Avatar,
  Divider,
  Chip,
  CircularProgress,
  IconButton,
  Tooltip,
  Paper,
  alpha,
  FormControl,
  Select,
  MenuItem,
  InputLabel,
  Tabs,
  Tab,
  TextField
} from '@mui/material';
import MainCard from 'components/MainCard';
import CircularWithPath from 'components/@extended/progress/CircularWithPath';
import useFetchNotifications from 'hooks/useFetchNotifications';
import { formatDateAndTime } from 'utils/formatters';
import axiosServices from 'utils/axios';
import { openSnackbar } from 'api/snackbar';
import useAuth from 'hooks/useAuth';

// Icons
import SettingOutlined from '@ant-design/icons/SettingOutlined';
import BellOutlined from '@ant-design/icons/BellOutlined';
import MessageOutlined from '@ant-design/icons/MessageOutlined';
import DollarOutlined from '@ant-design/icons/DollarOutlined';
import ToolOutlined from '@ant-design/icons/ToolOutlined';
import CheckCircleOutlined from '@ant-design/icons/CheckCircleOutlined';
import FileTextOutlined from '@ant-design/icons/FileTextOutlined';
import GiftOutlined from '@ant-design/icons/GiftOutlined';

// ==============================|| TENANT - NOTIFICATIONS PAGE ||============================== //

const getNotificationIcon = (type) => {
  const iconMap = {
    rent: DollarOutlined,
    maintenance: ToolOutlined,
    payment: CheckCircleOutlined,
    lease: FileTextOutlined,
    message: MessageOutlined,
    tenantInvite: GiftOutlined,
    default: BellOutlined
  };
  return iconMap[type] || iconMap.default;
};

const getNotificationColor = (type) => {
  const colorMap = {
    rent: 'primary',
    maintenance: 'warning',
    payment: 'success',
    lease: 'info',
    message: 'secondary',
    tenantInvite: 'info',
    default: 'default'
  };
  return colorMap[type] || colorMap.default;
};

export default function TenantNotifications() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { notifications, notificationsLoading, notificationsError, refetch } = useFetchNotifications();
  const [markingAsRead, setMarkingAsRead] = useState(null);
  
  // Filter states
  const [filterType, setFilterType] = useState('all');
  const [filterReadStatus, setFilterReadStatus] = useState('all');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');

  const handleMarkAsRead = async (notificationId) => {
    try {
      setMarkingAsRead(notificationId);
      await axiosServices.post(`/api/notifications/mark-read/${notificationId}`);
      await refetch(); // Refresh notifications
      openSnackbar({
        open: true,
        message: 'Notification marked as read',
        variant: 'alert',
        alert: { color: 'success' }
      });
    } catch (error) {
      console.error('Error marking notification as read:', error);
      openSnackbar({
        open: true,
        message: 'Failed to mark notification as read',
        variant: 'alert',
        alert: { color: 'error' }
      });
    } finally {
      setMarkingAsRead(null);
    }
  };

  const handleMarkAllAsRead = async () => {
    if (!user?.id) return;
    try {
      await axiosServices.post(`/api/notifications/mark-all-read`);
      await refetch(); // Refresh notifications
      openSnackbar({
        open: true,
        message: 'All notifications marked as read',
        variant: 'alert',
        alert: { color: 'success' }
      });
    } catch (error) {
      console.error('Error marking all notifications as read:', error);
      openSnackbar({
        open: true,
        message: 'Failed to mark all notifications as read',
        variant: 'alert',
        alert: { color: 'error' }
      });
    }
  };

  const handleNotificationClick = async (notification) => {
    // Mark as read when clicked
    if (!notification.isRead) {
      await handleMarkAsRead(notification.id);
    }

    // Navigate based on notification type - using tenant routes
    switch (notification.type) {
      case 'rent':
      case 'payment': {
        // Check if this is a deposit received notification
        // Deposit notifications should route to the lease page
        if (notification.title === 'Deposit Received') {
          navigate('/tenant/lease');
          break;
        }
        
        // Navigate to tenant payments page for other payment notifications
        navigate('/tenant/payments');
        break;
      }
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
        break;
    }
  };

  if (notificationsLoading) {
    return (
      <Box sx={{ p: 5 }}>
        <Stack direction="row" sx={{ justifyContent: 'center' }}>
          <CircularWithPath />
        </Stack>
      </Box>
    );
  }

  if (notificationsError) {
    return (
      <Box>
        <Box sx={{ mb: 3 }}>
          <Typography variant="h4" fontWeight="bold">
            Notifications
          </Typography>
          <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
            View and manage your notifications
          </Typography>
        </Box>
        <MainCard>
          <Box sx={{ p: 3, textAlign: 'center' }}>
            <Typography variant="h6" color="error">
              Error loading notifications
            </Typography>
            <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
              {notificationsError.message || 'Please try again later'}
            </Typography>
          </Box>
        </MainCard>
      </Box>
    );
  }

  // Filter notifications
  const filteredNotifications = useMemo(() => {
    let filtered = notifications || [];

    // Filter by type
    if (filterType !== 'all') {
      filtered = filtered.filter((n) => n.type?.toLowerCase() === filterType.toLowerCase());
    }

    // Filter by read status
    if (filterReadStatus === 'unread') {
      filtered = filtered.filter((n) => !n.isRead);
    } else if (filterReadStatus === 'read') {
      filtered = filtered.filter((n) => n.isRead);
    }

    // Filter by date range
    if (dateFrom || dateTo) {
      filtered = filtered.filter((notification) => {
        if (!notification.createdAt) return false;
        
        const notificationDate = new Date(notification.createdAt);
        notificationDate.setHours(0, 0, 0, 0); // Reset time to start of day
        
        if (dateFrom) {
          const fromDate = new Date(dateFrom);
          fromDate.setHours(0, 0, 0, 0);
          if (notificationDate < fromDate) return false;
        }
        
        if (dateTo) {
          const toDate = new Date(dateTo);
          toDate.setHours(23, 59, 59, 999); // Set to end of day
          if (notificationDate > toDate) return false;
        }
        
        return true;
      });
    }

    return filtered;
  }, [notifications, filterType, filterReadStatus, dateFrom, dateTo]);

  const unreadNotifications = filteredNotifications.filter((n) => !n.isRead);
  const readNotifications = filteredNotifications.filter((n) => n.isRead);

  return (
    <Box>
      <Box sx={{ mb: 3, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <Box>
          <Typography variant="h4" fontWeight="bold">
            Notifications
          </Typography>
          <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
            View and manage your notifications
          </Typography>
        </Box>
        <Stack direction="row" spacing={2}>
          {unreadNotifications.length > 0 && (
            <Button variant="outlined" color="primary" onClick={handleMarkAllAsRead}>
              Mark All as Read
            </Button>
          )}
          <Button
            variant="outlined"
            startIcon={<SettingOutlined />}
            onClick={() => navigate('/tenant/settings?tab=notifications')}
          >
            Settings
          </Button>
        </Stack>
      </Box>

      {/* Filters */}
      <MainCard
        sx={{
          mb: 3,
          bgcolor: (t) => alpha(t.palette.background.paper, 0.6),
          boxShadow: (t) => `0 0 20px ${alpha(t.palette.primary.main, 0.15)}`,
          position: 'relative',
          zIndex: 1,
          overflow: 'visible' // Ensure dropdowns aren't clipped
        }}
      >
        <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2} sx={{ p: 2, position: 'relative', zIndex: 1, overflow: 'visible' }}>
          <FormControl size="small" sx={{ minWidth: 180 }}>
            <InputLabel>Type</InputLabel>
            <Select
              value={filterType}
              onChange={(e) => setFilterType(e.target.value)}
              label="Type"
            >
              <MenuItem value="all">All Types</MenuItem>
              <MenuItem value="rent">Rent</MenuItem>
              <MenuItem value="maintenance">Maintenance</MenuItem>
              <MenuItem value="payment">Payment</MenuItem>
              <MenuItem value="lease">Lease</MenuItem>
              <MenuItem value="message">Message</MenuItem>
            </Select>
          </FormControl>

          <TextField
            size="small"
            type="date"
            label="From Date"
            value={dateFrom}
            onChange={(e) => setDateFrom(e.target.value)}
            InputLabelProps={{
              shrink: true,
            }}
            sx={{ minWidth: 160 }}
          />

          <TextField
            size="small"
            type="date"
            label="To Date"
            value={dateTo}
            onChange={(e) => setDateTo(e.target.value)}
            InputLabelProps={{
              shrink: true,
            }}
            sx={{ minWidth: 160 }}
          />

          <Tabs
            value={filterReadStatus}
            onChange={(e, newValue) => setFilterReadStatus(newValue)}
            sx={{ minHeight: 'auto' }}
          >
            <Tab label="All" value="all" sx={{ minHeight: 40, py: 1 }} />
            <Tab label="Unread" value="unread" sx={{ minHeight: 40, py: 1 }} />
            <Tab label="Read" value="read" sx={{ minHeight: 40, py: 1 }} />
          </Tabs>
        </Stack>
      </MainCard>

      <MainCard
        sx={{
          bgcolor: (t) => alpha(t.palette.background.paper, 0.6),
          boxShadow: (t) => `0 0 20px ${alpha(t.palette.primary.main, 0.15)}`
        }}
      >
        {filteredNotifications.length === 0 ? (
          <Box sx={{ p: 5, textAlign: 'center' }}>
            <BellOutlined style={{ fontSize: 64, color: 'rgba(0,0,0,0.12)' }} />
            <Typography variant="h6" color="text.secondary" sx={{ mt: 2 }}>
              {notifications.length === 0 ? 'No notifications' : 'No notifications match your filters'}
            </Typography>
            <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
              {notifications.length === 0 
                ? "You're all caught up! We'll notify you when there's something new."
                : 'Try adjusting your filters to see more notifications.'}
            </Typography>
          </Box>
        ) : (
          <>
            {unreadNotifications.length > 0 && (
              <Box sx={{ mb: 2 }}>
                <Typography variant="subtitle1" fontWeight="bold" sx={{ mb: 1, px: 2, pt: 2 }}>
                  Unread ({unreadNotifications.length})
                </Typography>
                <List component="nav" sx={{ p: 0 }}>
                  {unreadNotifications.map((notification, index) => {
                    const Icon = getNotificationIcon(notification.type);
                    const color = getNotificationColor(notification.type);
                    const isMarking = markingAsRead === notification.id;

                    return (
                      <Box key={notification.id}>
                        <Paper
                          sx={{
                            mx: 2,
                            mb: 1,
                            bgcolor: (t) => alpha(t.palette.primary.main, 0.08),
                            borderLeft: 4,
                            borderColor: 'primary.main',
                            cursor: 'pointer',
                            '&:hover': {
                              bgcolor: (t) => alpha(t.palette.primary.main, 0.08)
                            }
                          }}
                        >
                          <ListItemButton
                            onClick={() => handleNotificationClick(notification)}
                            disabled={isMarking}
                            sx={{ 
                              py: 1.5,
                              '&:hover': {
                                bgcolor: 'transparent'
                              }
                            }}
                          >
                            <ListItemAvatar>
                              <Avatar sx={{ bgcolor: `${color}.lighter`, color: `${color}.main` }}>
                                <Icon />
                              </Avatar>
                            </ListItemAvatar>
                            <ListItemText
                              primary={
                                <Stack direction="row" spacing={1} alignItems="center">
                                  <Typography variant="subtitle1">{notification.title}</Typography>
                                  <Chip label="New" size="small" color="primary" />
                                </Stack>
                              }
                              secondary={
                                <>
                                  <Typography variant="body2" color="text.secondary" component="span" sx={{ display: 'block', mt: 0.5 }}>
                                    {notification.message}
                                  </Typography>
                                  <Typography variant="caption" color="text.secondary" component="span" sx={{ display: 'block', mt: 0.5 }}>
                                    {formatDateAndTime(notification.createdAt)}
                                  </Typography>
                                </>
                              }
                            />
                            {isMarking ? (
                              <CircularProgress size={20} />
                            ) : (
                              <Tooltip title="Mark as read">
                                <IconButton
                                  size="small"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    handleMarkAsRead(notification.id);
                                  }}
                                >
                                  <CheckCircleOutlined />
                                </IconButton>
                              </Tooltip>
                            )}
                          </ListItemButton>
                        </Paper>
                        {index < unreadNotifications.length - 1 && <Divider sx={{ mx: 2 }} />}
                      </Box>
                    );
                  })}
                </List>
              </Box>
            )}

            {readNotifications.length > 0 && (
              <Box sx={{ mt: 3 }}>
                <Typography variant="subtitle1" fontWeight="bold" sx={{ mb: 1, px: 2 }}>
                  Read ({readNotifications.length})
                </Typography>
                <List component="nav" sx={{ p: 0 }}>
                  {readNotifications.map((notification, index) => {
                    const Icon = getNotificationIcon(notification.type);
                    const color = getNotificationColor(notification.type);

                    return (
                      <Box key={notification.id}>
                        <ListItemButton
                          onClick={() => handleNotificationClick(notification)}
                          sx={{
                            mx: 2,
                            mb: 0.5,
                            py: 1.5,
                            borderRadius: 1,
                            cursor: 'pointer',
                            '&:hover': {
                              bgcolor: 'transparent'
                            }
                          }}
                        >
                          <ListItemAvatar
                            sx={{
                              transition: 'transform 0.2s ease-in-out'
                            }}
                          >
                            <Avatar sx={{ bgcolor: `${color}.lighter`, color: `${color}.main` }}>
                              <Icon />
                            </Avatar>
                          </ListItemAvatar>
                          <ListItemText
                            primary={<Typography variant="subtitle1">{notification.title}</Typography>}
                            secondary={
                              <>
                                <Typography variant="body2" color="text.secondary" component="span" sx={{ display: 'block', mt: 0.5 }}>
                                  {notification.message}
                                </Typography>
                                <Typography variant="caption" color="text.secondary" component="span" sx={{ display: 'block', mt: 0.5 }}>
                                  {formatDateAndTime(notification.createdAt)}
                                </Typography>
                              </>
                            }
                          />
                        </ListItemButton>
                        {index < readNotifications.length - 1 && <Divider sx={{ mx: 2 }} />}
                      </Box>
                    );
                  })}
                </List>
              </Box>
            )}
          </>
        )}
      </MainCard>
    </Box>
  );
}

