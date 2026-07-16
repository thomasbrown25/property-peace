import { Link as RouterLink, useNavigate } from 'react-router-dom';
import { useMemo } from 'react';

// material-ui
import { alpha, CardContent, Box } from '@mui/material';
import { Grid } from '@mui/material';
import { Typography } from '@mui/material';
import { Link } from '@mui/material';

// project imports
import MainCard from 'components/MainCard';
import Avatar from 'components/@extended/Avatar';
import useFetchNotifications from 'hooks/useFetchNotifications';
import useFetchRentCollection from 'hooks/useFetchRentCollection';
import { formatRelativeTime } from 'utils/formatters';
import axiosServices from 'utils/axios';
import useAuth from 'hooks/useAuth';
import CircularLoader from 'components/CircularLoader';

// assets
import DollarOutlined from '@ant-design/icons/DollarOutlined';
import ToolOutlined from '@ant-design/icons/ToolOutlined';
import CheckCircleOutlined from '@ant-design/icons/CheckCircleOutlined';
import FileTextOutlined from '@ant-design/icons/FileTextOutlined';
import MessageOutlined from '@ant-design/icons/MessageOutlined';
import BellOutlined from '@ant-design/icons/BellOutlined';

// ==============================|| DATA WIDGET - RECENT ACTIVITY CARD ||============================== //

// Icon mapping based on notification type
const getNotificationIcon = (type) => {
  const iconMap = {
    rent: DollarOutlined,
    maintenance: ToolOutlined,
    payment: CheckCircleOutlined,
    lease: FileTextOutlined,
    message: MessageOutlined,
    rentpaymentsetupreminder: DollarOutlined,
    default: BellOutlined
  };
  return iconMap[type?.toLowerCase()] || iconMap.default;
};

// Color mapping based on notification type
const getNotificationColor = (type) => {
  const colorMap = {
    rent: 'primary',
    maintenance: 'warning',
    payment: 'success',
    lease: 'info',
    message: 'secondary',
    rentpaymentsetupreminder: 'primary',
    default: 'default'
  };
  return colorMap[type?.toLowerCase()] || colorMap.default;
};

export default function NotificationList({ rentRecords = [] }) {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { notifications, notificationsLoading } = useFetchNotifications();

  // Get latest 5 notifications
  const recentNotifications = useMemo(() => {
    if (!notifications || notifications.length === 0) return [];
    return notifications.slice(0, 5);
  }, [notifications]);

  const handleNotificationClick = async (notification) => {
    // Mark as read when clicked
    if (!notification.isRead && user?.id) {
      try {
        await axiosServices.post(`/api/notifications/mark-read/${notification.id}`);
      } catch (error) {
        console.error('Error marking notification as read:', error);
      }
    }

    // Navigate to view all notifications
    navigate('/landlord/notifications');
  };

  return (
    <MainCard
      title="Notifications"
      sx={{
        bgcolor: (t) => alpha(t.palette.background.paper, 0.6),
        boxShadow: (t) => `0 0 20px ${alpha(t.palette.primary.main, 0.15)}`,
        height: '100%'
      }}
      content={false}
      secondary={
        <Link component={RouterLink} to="/landlord/notifications" color="primary">
          View all
        </Link>
      }
    >
      <CardContent
        sx={{
          maxHeight: '400px',
          overflowY: 'auto',
          px: 2.5,
          py: 2
        }}
      >
        {notificationsLoading ? (
          <Box display="flex" justifyContent="center" alignItems="center" sx={{ minHeight: '200px' }}>
            <CircularLoader />
          </Box>
        ) : recentNotifications.length === 0 ? (
          <Typography variant="body2" color="text.secondary" align="center" sx={{ py: 3 }}>
            No recent activity
          </Typography>
        ) : (
          <Grid
            container
            spacing={2.75}
            alignItems="center"
            sx={{
              position: 'relative',
              '&>*': { position: 'relative', zIndex: '5' },
              '&:after': {
                content: '""',
                position: 'absolute',
                top: -20,
                left: 16,
                width: '1px',
                height: '100%',
                bgcolor: 'divider',
                zIndex: '1'
              }
            }}
          >
            {recentNotifications.map((notification) => {
              const Icon = getNotificationIcon(notification.type);
              const color = getNotificationColor(notification.type);
              const displayTime = formatRelativeTime(notification.createdAt);

              return (
                <Grid size={12} key={notification.id}>
                  <Grid
                    container
                    spacing={2}
                    sx={{
                      cursor: 'pointer',
                      '&:hover': {
                        bgcolor: (t) => alpha(t.palette.action.hover, 0.3),
                        borderRadius: 1
                      }
                    }}
                    onClick={() => handleNotificationClick(notification)}
                  >
                    <Grid>
                      <Avatar type="filled" color={color} size="sm" sx={{ top: 10 }}>
                        <Icon />
                      </Avatar>
                    </Grid>
                    <Grid size="grow">
                      <Grid container spacing={0}>
                        <Grid size={12}>
                          <Typography variant="caption" color="secondary">
                            {displayTime}
                          </Typography>
                        </Grid>
                        <Grid size={12}>
                          <Typography variant="body2" sx={{ fontWeight: notification.isRead ? 'normal' : 'medium' }}>
                            {notification.title || notification.message}
                          </Typography>
                        </Grid>
                      </Grid>
                    </Grid>
                  </Grid>
                </Grid>
              );
            })}
          </Grid>
        )}
      </CardContent>
    </MainCard>
  );
}
