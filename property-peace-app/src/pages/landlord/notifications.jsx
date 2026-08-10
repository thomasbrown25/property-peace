import { useState, useMemo, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Box,
  Typography,
  Button,
  Stack,
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
  TextField,
  useTheme
} from '@mui/material';
import MainCard from 'components/MainCard';
import CircularWithPath from 'components/@extended/progress/CircularWithPath';
import PageBreadcrumbs from 'components/breadcrumbs/PageBreadcrumbs';
import useFetchNotifications from 'hooks/useFetchNotifications';
import useFetchRentCollection from 'hooks/useFetchRentCollection';
import useFetchMaintenances from 'hooks/useFetchMaintenances';
import PropertySelect from 'components/PropertySelect';
import { useDispatch, useSelector } from 'react-redux';
import { selectProperty } from 'store/property/property.selector';
import { setProperty } from 'store/property/property.action';
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
import CheckOutlined from '@ant-design/icons/CheckOutlined';

// ==============================|| NOTIFICATIONS PAGE ||============================== //

const getNotificationIcon = (type) => {
  const iconMap = {
    rent: DollarOutlined,
    maintenance: ToolOutlined,
    payment: CheckCircleOutlined,
    lease: FileTextOutlined,
    message: MessageOutlined,
    rentPaymentSetupReminder: DollarOutlined,
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
    rentPaymentSetupReminder: 'primary',
    default: 'default'
  };
  return colorMap[type] || colorMap.default;
};

const parseUtcDate = (dateStr) => {
  if (!dateStr) return null;
  let s = String(dateStr).trim();
  if (/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d+)?$/.test(s)) s += 'Z';
  return new Date(s);
};

const relativeTime = (dateStr) => {
  if (!dateStr) return '';
  const date = parseUtcDate(dateStr);
  const now = new Date();
  const diffMs = now - date;
  const diffMin = Math.floor(diffMs / 60000);
  const diffHr = Math.floor(diffMs / 3600000);
  const diffDays = Math.floor(diffMs / 86400000);

  if (diffMin < 1) return 'Just now';
  if (diffMin < 60) return `${diffMin}m ago`;
  if (diffHr < 24) return `${diffHr}h ago`;
  if (diffDays === 1) return `Yesterday at ${date.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })}`;
  if (diffDays < 7) return `${date.toLocaleDateString('en-US', { weekday: 'short' })} at ${date.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })}`;
  return formatDateAndTime(dateStr);
};

const getDateGroup = (dateStr) => {
  if (!dateStr) return 'Older';
  const date = parseUtcDate(dateStr);
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const yesterday = new Date(today);
  yesterday.setDate(yesterday.getDate() - 1);
  const weekAgo = new Date(today);
  weekAgo.setDate(weekAgo.getDate() - 7);
  const notifDay = new Date(date.getFullYear(), date.getMonth(), date.getDate());

  if (notifDay >= today) return 'Today';
  if (notifDay >= yesterday) return 'Yesterday';
  if (notifDay >= weekAgo) return 'This Week';
  return 'Older';
};

const DATE_GROUP_ORDER = ['Today', 'Yesterday', 'This Week', 'Older'];

export default function Notifications() {
  const navigate = useNavigate();
  const dispatch = useDispatch();
  const theme = useTheme();
  const { user } = useAuth();
  const { notifications, notificationsLoading, notificationsError, refetch } = useFetchNotifications();
  const [markingAsRead, setMarkingAsRead] = useState(null);
  const [markingAllAsRead, setMarkingAllAsRead] = useState(false);

  // Primary filter: read status tab
  const [filterReadStatus, setFilterReadStatus] = useState('all');
  // Secondary filters
  const [filterType, setFilterType] = useState('all');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');

  const { rentRecords } = useFetchRentCollection(null, true);
  const { maintenances, historyMaintenances } = useFetchMaintenances();
  const allMaintenances = useMemo(() => [...(maintenances || []), ...(historyMaintenances || [])], [maintenances, historyMaintenances]);

  const selectedProperty = useSelector(selectProperty);

  useEffect(() => {
    dispatch(setProperty(null));
  }, [dispatch]);

  const handleMarkAsRead = async (notificationId) => {
    try {
      setMarkingAsRead(notificationId);
      await axiosServices.post(`/api/notifications/mark-read/${notificationId}`);
      await refetch();
    } catch (error) {
      openSnackbar({ open: true, message: 'Failed to mark notification as read', variant: 'alert', alert: { color: 'error' } });
    } finally {
      setMarkingAsRead(null);
    }
  };

  const handleMarkAllAsRead = async () => {
    if (!user?.id) return;
    try {
      setMarkingAllAsRead(true);
      await axiosServices.post(`/api/notifications/mark-all-read`);
      await refetch();
      openSnackbar({ open: true, message: 'All notifications marked as read', variant: 'alert', alert: { color: 'success' } });
    } catch (error) {
      openSnackbar({ open: true, message: 'Failed to mark all notifications as read', variant: 'alert', alert: { color: 'error' } });
    } finally {
      setMarkingAllAsRead(false);
    }
  };

  const handleNotificationClick = async (notification) => {
    if (!notification.isRead) await handleMarkAsRead(notification.id);

    switch (notification.type) {
      case 'rent':
      case 'payment': {
        if (notification.title === 'Deposit Received' && notification.relatedId) {
          navigate(`/landlord/leases/${notification.relatedId}`);
          break;
        }
        let propertyId = notification.propertyId || notification.metadata?.propertyId;
        if (!propertyId && notification.relatedId && rentRecords?.length > 0) {
          const rentRecord = rentRecords.find((r) => r.leaseId === notification.relatedId || r.id === notification.relatedId);
          propertyId = rentRecord?.propertyId || notification.relatedId;
        } else if (!propertyId) {
          propertyId = notification.relatedId;
        }
        if (propertyId) navigate(`/landlord/rent-collection?propertyId=${propertyId}`);
        break;
      }
      case 'maintenance':
        if (notification.relatedId) navigate(`/landlord/maintenance/${notification.relatedId}`);
        break;
      case 'lease':
        if (notification.relatedId) navigate(`/landlord/leases/${notification.relatedId}`);
        break;
      case 'rentPaymentSetupReminder':
        if (notification.relatedId) navigate(`/landlord/property/${notification.relatedId}`);
        break;
      default:
        break;
    }
  };

  const getNotificationPropertyId = useMemo(() => {
    return (notification) => {
      if (notification.type === 'rent' || notification.type === 'payment') {
        let propertyId = notification.propertyId || notification.metadata?.propertyId;
        if (!propertyId && notification.relatedId && rentRecords?.length > 0) {
          const rentRecord = rentRecords.find((r) => r.leaseId === notification.relatedId || r.id === notification.relatedId);
          propertyId = rentRecord?.propertyId || notification.relatedId;
        } else if (!propertyId) {
          propertyId = notification.relatedId;
        }
        return propertyId;
      }
      if (notification.type === 'maintenance' && notification.relatedId) {
        const m = allMaintenances.find((m) => m.id === notification.relatedId);
        return m?.propertyId || null;
      }
      if (notification.type === 'rentPaymentSetupReminder' && notification.relatedId) return notification.relatedId;
      return null;
    };
  }, [rentRecords, allMaintenances]);

  const filteredNotifications = useMemo(() => {
    if (!notifications?.length) return [];
    let filtered = notifications;

    if (filterReadStatus === 'unread') filtered = filtered.filter((n) => !n.isRead);
    else if (filterReadStatus === 'read') filtered = filtered.filter((n) => n.isRead);

    if (filterType !== 'all') filtered = filtered.filter((n) => n.type?.toLowerCase() === filterType.toLowerCase());

    if (selectedProperty?.id) {
      filtered = filtered.filter((n) => {
        const pid = getNotificationPropertyId(n);
        return pid && String(pid) === String(selectedProperty.id);
      });
    }

    if (dateFrom || dateTo) {
      filtered = filtered.filter((n) => {
        if (!n.createdAt) return false;
        const d = new Date(n.createdAt);
        d.setHours(0, 0, 0, 0);
        if (dateFrom) {
          const from = new Date(dateFrom);
          from.setHours(0, 0, 0, 0);
          if (d < from) return false;
        }
        if (dateTo) {
          const to = new Date(dateTo);
          to.setHours(23, 59, 59, 999);
          if (d > to) return false;
        }
        return true;
      });
    }

    return filtered;
  }, [notifications, filterType, filterReadStatus, selectedProperty, dateFrom, dateTo, getNotificationPropertyId]);

  const groupedNotifications = useMemo(() => {
    const groups = {};
    filteredNotifications.forEach((n) => {
      const g = getDateGroup(n.createdAt);
      if (!groups[g]) groups[g] = [];
      groups[g].push(n);
    });
    return DATE_GROUP_ORDER.filter((g) => groups[g]).map((g) => ({ label: g, items: groups[g] }));
  }, [filteredNotifications]);

  const totalUnread = useMemo(() => notifications?.filter((n) => !n.isRead).length || 0, [notifications]);
  const totalRead = useMemo(() => notifications?.filter((n) => n.isRead).length || 0, [notifications]);

  if (notificationsLoading) {
    return (
      <Box sx={{ p: 5 }}>
        <Stack direction="row" justifyContent="center">
          <CircularWithPath />
        </Stack>
      </Box>
    );
  }

  if (notificationsError) {
    return (
      <Box>
        <NotificationsHeader navigate={navigate} theme={theme} />
        <MainCard>
          <Box sx={{ p: 3, textAlign: 'center' }}>
            <Typography variant="h6" color="error">Error loading notifications</Typography>
            <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
              {notificationsError.message || 'Please try again later'}
            </Typography>
          </Box>
        </MainCard>
      </Box>
    );
  }

  return (
    <Box>
      <NotificationsHeader navigate={navigate} theme={theme} />

      {/* Primary tabs + actions row */}
      <Stack direction="row" alignItems="center" justifyContent="space-between" sx={{ mb: 2 }}>
        <Tabs
          value={filterReadStatus}
          onChange={(_, v) => setFilterReadStatus(v)}
          sx={{ '& .MuiTab-root': { minHeight: 44, py: 1, textTransform: 'none', fontWeight: 500 } }}
        >
          <Tab
            label={
              <Stack direction="row" spacing={1} alignItems="center">
                <span>All</span>
                {notifications?.length > 0 && (
                  <Chip label={notifications.length} size="small" sx={{ height: 18, fontSize: 11, fontWeight: 600 }} />
                )}
              </Stack>
            }
            value="all"
          />
          <Tab
            label={
              <Stack direction="row" spacing={1} alignItems="center">
                <span>Unread</span>
                {totalUnread > 0 && (
                  <Chip label={totalUnread} size="small" color="primary" sx={{ height: 18, fontSize: 11, fontWeight: 600 }} />
                )}
              </Stack>
            }
            value="unread"
          />
          <Tab
            label={
              <Stack direction="row" spacing={1} alignItems="center">
                <span>Read</span>
                {totalRead > 0 && (
                  <Chip label={totalRead} size="small" sx={{ height: 18, fontSize: 11, fontWeight: 600, bgcolor: 'action.selected' }} />
                )}
              </Stack>
            }
            value="read"
          />
        </Tabs>

        <Stack direction="row" spacing={1}>
          {totalUnread > 0 && (
            <Button
              variant="outlined"
              size="small"
              startIcon={markingAllAsRead ? <CircularProgress size={12} /> : <CheckOutlined />}
              disabled={markingAllAsRead}
              onClick={handleMarkAllAsRead}
              sx={{ textTransform: 'none', fontWeight: 500 }}
            >
              Mark all read
            </Button>
          )}
          <Button
            variant="outlined"
            size="small"
            startIcon={<SettingOutlined />}
            onClick={() => navigate('/landlord/settings?tab=notifications')}
            sx={{ textTransform: 'none', fontWeight: 500 }}
          >
            Settings
          </Button>
        </Stack>
      </Stack>

      {/* Secondary filters */}
      <Paper
        variant="outlined"
        sx={{ mb: 2.5, p: 1.5, bgcolor: alpha(theme.palette.background.paper, 0.7) }}
      >
        <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1.5} alignItems="center">
          <Box sx={{ flex: 1.2, minWidth: 0 }}>
            <PropertySelect disableAllOption={false} />
          </Box>
          <FormControl size="small" sx={{ minWidth: 160 }}>
            <InputLabel>Type</InputLabel>
            <Select value={filterType} onChange={(e) => setFilterType(e.target.value)} label="Type">
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
            label="From"
            value={dateFrom}
            onChange={(e) => setDateFrom(e.target.value)}
            InputLabelProps={{ shrink: true }}
            sx={{ minWidth: 148 }}
          />
          <TextField
            size="small"
            type="date"
            label="To"
            value={dateTo}
            onChange={(e) => setDateTo(e.target.value)}
            InputLabelProps={{ shrink: true }}
            sx={{ minWidth: 148 }}
          />
          {(filterType !== 'all' || dateFrom || dateTo) && (
            <Button
              size="small"
              variant="text"
              sx={{ textTransform: 'none', color: 'text.secondary', whiteSpace: 'nowrap' }}
              onClick={() => { setFilterType('all'); setDateFrom(''); setDateTo(''); }}
            >
              Clear filters
            </Button>
          )}
        </Stack>
      </Paper>

      {/* Notification list */}
      <MainCard sx={{ bgcolor: alpha(theme.palette.background.paper, 0.6) }} contentSX={{ p: 0 }}>
        {filteredNotifications.length === 0 ? (
          <Box sx={{ py: 8, textAlign: 'center' }}>
            <BellOutlined style={{ fontSize: 52, color: alpha(theme.palette.text.primary, 0.12) }} />
            <Typography variant="h6" color="text.secondary" sx={{ mt: 2 }}>
              {!notifications?.length ? 'No notifications yet' : 'No notifications match your filters'}
            </Typography>
            <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
              {!notifications?.length
                ? "You're all caught up — we'll notify you when something happens."
                : 'Try adjusting your filters to see more.'}
            </Typography>
          </Box>
        ) : (
          groupedNotifications.map((group, gIdx) => (
            <Box key={group.label}>
              {/* Date group header */}
              <Box sx={{ px: 2.5, pt: gIdx === 0 ? 2 : 2.5, pb: 0.75 }}>
                <Typography
                  variant="caption"
                  fontWeight={700}
                  color="text.secondary"
                  sx={{ textTransform: 'uppercase', letterSpacing: 0.6, fontSize: 11 }}
                >
                  {group.label}
                </Typography>
              </Box>

              {group.items.map((notification, idx) => {
                const Icon = getNotificationIcon(notification.type);
                const color = getNotificationColor(notification.type);
                const isUnread = !notification.isRead;
                const isMarking = markingAsRead === notification.id;

                return (
                  <Box key={notification.id}>
                    <Box
                      onClick={() => handleNotificationClick(notification)}
                      sx={{
                        display: 'flex',
                        alignItems: 'flex-start',
                        px: 2.5,
                        py: 1.5,
                        cursor: 'pointer',
                        position: 'relative',
                        borderLeft: isUnread ? `3px solid ${theme.palette.primary.main}` : '3px solid transparent',
                        bgcolor: isUnread ? alpha(theme.palette.primary.main, 0.04) : 'transparent',
                        transition: 'background-color 0.15s',
                        '&:hover': {
                          bgcolor: alpha(theme.palette.primary.main, isUnread ? 0.08 : 0.04)
                        }
                      }}
                    >
                      {/* Icon avatar */}
                      <Box sx={{ position: 'relative', mr: 2, flexShrink: 0 }}>
                        <Avatar
                          sx={{
                            width: 40,
                            height: 40,
                            bgcolor: `${color}.lighter`,
                            color: `${color}.main`,
                            opacity: isUnread ? 1 : 0.7
                          }}
                        >
                          <Icon style={{ fontSize: 18 }} />
                        </Avatar>
                        {isUnread && (
                          <Box
                            sx={{
                              position: 'absolute',
                              top: -2,
                              right: -2,
                              width: 10,
                              height: 10,
                              borderRadius: '50%',
                              bgcolor: 'primary.main',
                              border: `2px solid ${theme.palette.background.paper}`
                            }}
                          />
                        )}
                      </Box>

                      {/* Content */}
                      <Box sx={{ flex: 1, minWidth: 0 }}>
                        <Stack direction="row" alignItems="center" spacing={1} sx={{ mb: 0.25 }}>
                          <Typography
                            variant="body2"
                            fontWeight={isUnread ? 600 : 500}
                            color={isUnread ? 'text.primary' : 'text.secondary'}
                            noWrap
                          >
                            {notification.title}
                          </Typography>
                        </Stack>
                        <Typography
                          variant="body2"
                          color="text.secondary"
                          sx={{
                            display: '-webkit-box',
                            WebkitLineClamp: 2,
                            WebkitBoxOrient: 'vertical',
                            overflow: 'hidden',
                            lineHeight: 1.5,
                            opacity: isUnread ? 1 : 0.75
                          }}
                        >
                          {notification.message}
                        </Typography>
                        <Typography variant="caption" color="text.disabled" sx={{ mt: 0.5, display: 'block' }}>
                          {relativeTime(notification.createdAt)}
                        </Typography>
                      </Box>

                      {/* Mark as read action */}
                      {isUnread && (
                        <Box sx={{ ml: 1, flexShrink: 0 }}>
                          {isMarking ? (
                            <CircularProgress size={16} />
                          ) : (
                            <Tooltip title="Mark as read">
                              <IconButton
                                size="small"
                                onClick={(e) => { e.stopPropagation(); handleMarkAsRead(notification.id); }}
                                sx={{ color: 'text.disabled', '&:hover': { color: 'primary.main' } }}
                              >
                                <CheckOutlined style={{ fontSize: 14 }} />
                              </IconButton>
                            </Tooltip>
                          )}
                        </Box>
                      )}
                    </Box>
                    {idx < group.items.length - 1 && <Divider sx={{ mx: 2.5 }} />}
                  </Box>
                );
              })}

              {gIdx < groupedNotifications.length - 1 && <Divider sx={{ mt: 1 }} />}
            </Box>
          ))
        )}
      </MainCard>
    </Box>
  );
}

function NotificationsHeader({ navigate, theme }) {
  return (
    <Box sx={{ mb: 3 }}>
      <PageBreadcrumbs
        items={[
          { label: 'Dashboard', path: '/landlord/dashboard' },
          { label: 'Notifications' }
        ]}
      />
      <Stack direction="row" alignItems="center" justifyContent="space-between">
        <Stack direction="row" alignItems="center" spacing={2}>
          <Box
            sx={{
              width: 56,
              height: 56,
              borderRadius: 2,
              bgcolor: alpha(theme.palette.primary.main, 0.1),
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              flexShrink: 0
            }}
          >
            <BellOutlined style={{ fontSize: 28, color: theme.palette.primary.main }} />
          </Box>
          <Box>
            <Typography variant="h3" fontWeight={700}>Notifications</Typography>
            <Typography variant="body1" color="text.secondary">
              View and manage your alerts across all properties.
            </Typography>
          </Box>
        </Stack>
      </Stack>
    </Box>
  );
}
