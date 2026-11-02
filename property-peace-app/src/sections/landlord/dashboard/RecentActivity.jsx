import { Link as RouterLink, useNavigate } from 'react-router-dom';
import { useMemo } from 'react';

// material-ui
import { alpha, CardContent, Box, Divider } from '@mui/material';
import { Grid } from '@mui/material';
import { Typography } from '@mui/material';
import { Link } from '@mui/material';

// project imports
import MainCard from 'components/MainCard';
import Avatar from 'components/@extended/Avatar';
import useFetchActivities from 'hooks/useFetchActivities';
import { formatRelativeTime } from 'utils/formatters';
import CircularLoader from 'components/CircularLoader';
import AnimateItem from 'components/AnimateItem';

// assets
import DollarOutlined from '@ant-design/icons/DollarOutlined';
import ToolOutlined from '@ant-design/icons/ToolOutlined';
import CheckCircleOutlined from '@ant-design/icons/CheckCircleOutlined';
import FileTextOutlined from '@ant-design/icons/FileTextOutlined';
import MessageOutlined from '@ant-design/icons/MessageOutlined';
import BellOutlined from '@ant-design/icons/BellOutlined';
import HomeFilled from '@ant-design/icons/HomeFilled';
import UserOutlined from '@ant-design/icons/UserOutlined';
import DollarCircleOutlined from '@ant-design/icons/DollarCircleOutlined';
import FileOutlined from '@ant-design/icons/FileOutlined';
import FormOutlined from '@ant-design/icons/FormOutlined';
import SettingOutlined from '@ant-design/icons/SettingOutlined';

// ==============================|| DATA WIDGET - RECENT ACTIVITY CARD ||============================== //

// Icon mapping based on activity type
const getActivityIcon = (iconType) => {
  const iconMap = {
    DollarOutlined: DollarOutlined,
    ToolOutlined: ToolOutlined,
    CheckCircleOutlined: CheckCircleOutlined,
    FileTextOutlined: FileTextOutlined,
    MessageOutlined: MessageOutlined,
    BellOutlined: BellOutlined,
    HomeFilled: HomeFilled,
    UserOutlined: UserOutlined,
    DollarCircleOutlined: DollarCircleOutlined,
    FileOutlined: FileOutlined,
    FormOutlined: FormOutlined,
    SettingOutlined: SettingOutlined
  };
  return iconMap[iconType] || BellOutlined;
};

// Color mapping based on activity type
const getActivityColor = (colorName) => {
  const colorMap = {
    primary: 'primary',
    warning: 'warning',
    success: 'success',
    info: 'info',
    secondary: 'secondary',
    error: 'error',
    default: 'default'
  };
  return colorMap[colorName] || 'default';
};

export default function RecentActivity() {
  const navigate = useNavigate();
  const { activities, activitiesLoading } = useFetchActivities({ pageSize: 3 });

  const recentActivities = useMemo(() => {
    if (!activities || activities.length === 0) return [];
    return activities.slice(0, 3);
  }, [activities]);

  const handleActivityClick = (activity) => {
    // Navigate based on activity type
    switch (activity.activityType) {
      case 'Payment':
        navigate('/landlord/finances?tab=payments');
        break;
      case 'Maintenance':
        if (activity.relatedId) {
          navigate(`/landlord/maintenance/${activity.relatedId}`);
        }
        break;
      case 'Lease':
        if (activity.relatedId) {
          navigate(`/landlord/leases/${activity.relatedId}`);
        }
        break;
      case 'Property':
        if (activity.relatedId) {
          navigate(`/landlord/property/${activity.relatedId}`);
        }
        break;
      case 'Tenant':
        if (activity.relatedId) {
          navigate(`/landlord/tenants/${activity.relatedId}`);
        }
        break;
      case 'StaffMember':
        if (activity.relatedId) {
          navigate(`/landlord/staff-member/${activity.relatedId}`);
        } else {
          navigate('/landlord/staff-members');
        }
        break;
      case 'Message':
        if (activity.conversationId) {
          navigate(`/landlord/messages?conversationId=${activity.conversationId}`);
        } else {
          navigate('/landlord/messages');
        }
        break;
      default:
        // Navigate to activity page
        navigate('/landlord/activity');
    }
  };

  return (
    <MainCard
      title="Recent Activity"
      sx={{
        height: '100%'
      }}
      content={false}
      secondary={
        <Link 
          component={RouterLink} 
          to="/landlord/activity" 
          color="primary"
          sx={{
            fontSize: '0.875rem',
            fontWeight: 500,
            textDecoration: 'none',
            '&:hover': {
              textDecoration: 'underline'
            }
          }}
        >
          View all
        </Link>
      }
    >
      <CardContent
        sx={{
          maxHeight: '400px',
          overflowY: 'auto',
          px: 2,
          py: 1.5
        }}
      >
        {activitiesLoading ? (
          <Box display="flex" justifyContent="center" alignItems="center" sx={{ minHeight: '200px' }}>
            <CircularLoader />
          </Box>
        ) : recentActivities.length === 0 ? (
          <Typography variant="body2" color="text.secondary" align="center" sx={{ py: 4, fontSize: '0.875rem' }}>
            No recent activity
          </Typography>
        ) : (
          <Box
            sx={{
              position: 'relative',
              '&:after': {
                content: '""',
                position: 'absolute',
                top: 0,
                left: 11.5,
                width: '1px',
                height: '100%',
                bgcolor: (t) => alpha(t.palette.divider, 0.12),
                zIndex: 1
              }
            }}
          >
            {recentActivities.map((activity, index) => {
              const Icon = getActivityIcon(activity.iconType || 'BellOutlined');
              const color = getActivityColor(activity.color || 'default');
              const displayTime = formatRelativeTime(activity.createdAt);

              return (
                <AnimateItem key={`${activity.activityType}-${activity.id}`} delay={index * 50} direction="bottom">
                  <Box>
                    <Box
                      sx={{
                        position: 'relative',
                        mb: 1,
                        pl: 1.5,
                        display: 'flex',
                        alignItems: 'center',
                        '&:last-child': { mb: 0 }
                      }}
                    >
                    {/* Avatar positioned to center on the vertical line at 16px */}
                    {/* Line is at left: 16px (2 * 8px theme spacing) from outer Box */}
                    {/* Avatar is 32px wide, so its center should be at 16px to align with line */}
                    {/* Activity item has pl: 4 (32px = 4 * 8px), so Avatar at left: 0 is 32px from outer Box */}
                    {/* We need Avatar left edge at 0px from outer Box, so left: -4 (negative spacing) */}
                    <Box
                      sx={{
                        position: 'absolute',
                        left: -4, // Negative spacing to move back by pl: 4 amount
                        top: '50%',
                        transform: 'translateY(-50%)',
                        zIndex: 2
                      }}
                    >
                      <Avatar type="filled" color={color} size="sm">
                        <Icon />
                      </Avatar>
                    </Box>
                    
                    <Box
                      sx={{
                        cursor: 'pointer',
                        transition: 'all 0.2s ease',
                        pt: 1.5,
                        px: 2,
                        pb: index < recentActivities.length - 1 ? 1.5 : 1,
                        pl: 4,
                        mb: index < recentActivities.length - 1 ? -1 : 0,
                        flex: 1,
                        borderRadius: 1,
                        '&:hover': {
                          bgcolor: (t) => alpha(t.palette.primary.main, 0.06),
                          transform: 'translateX(4px)'
                        }
                      }}
                      onClick={() => handleActivityClick(activity)}
                    >
                      <Box>
                        <Typography variant="caption" color="secondary" display="block">
                          {displayTime}
                          {activity.performedByName && activity.performedByName !== 'System' && (
                            <>
                              {' • '}
                              {activity.performedByName}
                            </>
                          )}
                          {(!activity.performedByName || activity.performedByName === 'System') && ' • System'}
                        </Typography>
                        <Typography variant="body2" sx={{ fontWeight: 'medium', mt: 0.5 }}>
                          {activity.title || activity.message}
                        </Typography>
                      </Box>
                    </Box>
                  </Box>
                  {index < recentActivities.length - 1 && (
                    <Divider sx={{ mx: 2, borderColor: (t) => alpha(t.palette.divider, 0.08) }} />
                  )}
                  </Box>
                </AnimateItem>
              );
            })}
          </Box>
        )}
      </CardContent>
    </MainCard>
  );
}

