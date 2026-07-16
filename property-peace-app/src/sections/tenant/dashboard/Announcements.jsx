import { Link as RouterLink, useNavigate } from 'react-router-dom';
import { useMemo } from 'react';

// material-ui
import { alpha, CardContent, Box, Typography, Link, Stack, Button, Chip } from '@mui/material';

// project imports
import MainCard from 'components/MainCard';
import Avatar from 'components/@extended/Avatar';
import useFetchNotifications from 'hooks/useFetchNotifications';
import { formatRelativeTime } from 'utils/formatters';
import CircularLoader from 'components/CircularLoader';

// assets
import FileTextOutlined from '@ant-design/icons/FileTextOutlined';
import BellOutlined from '@ant-design/icons/BellOutlined';
import EyeOutlined from '@ant-design/icons/EyeOutlined';

// ==============================|| TENANT - ANNOUNCEMENTS COMPONENT ||============================== //

export default function Announcements() {
  const navigate = useNavigate();
  const { notifications, notificationsLoading } = useFetchNotifications();

  // Filter to show only lease-related notifications/announcements
  const announcements = useMemo(() => {
    if (!notifications || notifications.length === 0) return [];
    // Filter for lease type notifications (these are announcements when lease is sent)
    return notifications
      .filter((n) => n.type?.toLowerCase() === 'lease')
      .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))
      .slice(0, 5); // Show latest 5
  }, [notifications]);

  const handleAnnouncementClick = (announcement) => {
    // Navigate to lease page if relatedId is a lease ID
    if (announcement.relatedId) {
      navigate('/tenant/lease');
    }
  };

  return (
    <MainCard
      title="Announcements"
      sx={{
        bgcolor: (t) => alpha(t.palette.background.paper, 0.6),
        boxShadow: (t) => `0 0 20px ${alpha(t.palette.primary.main, 0.15)}`,
        height: '100%'
      }}
      content={false}
      secondary={
        <Link component={RouterLink} to="/tenant/announcements" color="primary">
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
          <Box display="flex" justifyContent="center" alignItems="center" sx={{ minHeight: '150px' }}>
            <CircularLoader />
          </Box>
        ) : announcements.length === 0 ? (
          <Box
            sx={{
              py: 2.5,
              minHeight: 118,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              textAlign: 'center'
            }}
          >
            <Stack spacing={1} alignItems="center">
              <Box
                sx={{
                  width: 38,
                  height: 38,
                  borderRadius: '50%',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  color: 'primary.main',
                  bgcolor: (t) => alpha(t.palette.primary.main, t.palette.mode === 'dark' ? 0.16 : 0.08)
                }}
              >
                <BellOutlined />
              </Box>
              <Box>
                <Typography variant="subtitle2" fontWeight={700}>
                  No announcements right now
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  You’re all caught up.
                </Typography>
              </Box>
            </Stack>
          </Box>
        ) : (
          <Stack spacing={2}>
            {announcements.map((announcement) => {
              const Icon = FileTextOutlined;
              const color = 'info';

              return (
                <Box
                  key={announcement.id}
                  sx={{
                    p: 2,
                    borderRadius: 1,
                    border: (t) => `1px solid ${alpha(t.palette.divider, 0.12)}`,
                    cursor: 'pointer',
                    transition: 'all 0.2s ease',
                    '&:hover': {
                      bgcolor: (t) => alpha(t.palette.primary.main, 0.05),
                      border: (t) => `1px solid ${alpha(t.palette.primary.main, 0.3)}`
                    }
                  }}
                  onClick={() => handleAnnouncementClick(announcement)}
                >
                  <Stack direction="row" spacing={2} alignItems="flex-start">
                    <Avatar type="filled" color={color} size="sm" sx={{ mt: 0.5 }}>
                      <Icon />
                    </Avatar>
                    <Stack sx={{ flex: 1 }} spacing={0.5}>
                      <Typography variant="subtitle2" fontWeight={600}>
                        {announcement.title}
                      </Typography>
                      <Typography variant="body2" color="text.secondary">
                        {announcement.message}
                      </Typography>
                      <Stack direction="row" spacing={1} alignItems="center" sx={{ mt: 1 }}>
                        <Typography variant="caption" color="text.secondary">
                          {formatRelativeTime(announcement.createdAt)}
                        </Typography>
                        {!announcement.isRead && <Chip label="New" size="small" color="primary" sx={{ height: 16, fontSize: '0.65rem' }} />}
                      </Stack>
                    </Stack>
                    {announcement.relatedId && (
                      <Button
                        size="small"
                        startIcon={<EyeOutlined />}
                        onClick={(e) => {
                          e.stopPropagation();
                          navigate('/tenant/lease');
                        }}
                        sx={{ textTransform: 'none' }}
                      >
                        View
                      </Button>
                    )}
                  </Stack>
                </Box>
              );
            })}
          </Stack>
        )}
      </CardContent>
    </MainCard>
  );
}
