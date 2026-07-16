import { useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Box,
  Typography,
  Stack,
  Paper,
  Chip,
  Button,
  alpha,
  Divider
} from '@mui/material';
import MainCard from 'components/MainCard';
import CircularLoader from 'components/CircularLoader';
import useFetchNotifications from 'hooks/useFetchNotifications';
import { formatDateAndTime } from 'utils/formatters';
import Avatar from 'components/@extended/Avatar';

// Icons
import FileTextOutlined from '@ant-design/icons/FileTextOutlined';
import EyeOutlined from '@ant-design/icons/EyeOutlined';

// ==============================|| TENANT - ANNOUNCEMENTS PAGE ||============================== //

export default function TenantAnnouncements() {
  const navigate = useNavigate();
  const { notifications, notificationsLoading, notificationsError } = useFetchNotifications();

  // Filter to show only lease-related notifications/announcements
  const announcements = useMemo(() => {
    if (!notifications || notifications.length === 0) return [];
    // Filter for lease type notifications (these are announcements when lease is sent)
    return notifications
      .filter((n) => n.type?.toLowerCase() === 'lease')
      .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
  }, [notifications]);

  const handleAnnouncementClick = (announcement) => {
    // Navigate to lease page if relatedId is a lease ID
    if (announcement.relatedId) {
      navigate('/tenant/lease');
    }
  };

  if (notificationsLoading) {
    return (
      <MainCard>
        <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '400px' }}>
          <CircularLoader />
        </Box>
      </MainCard>
    );
  }

  if (notificationsError) {
    return (
      <MainCard>
        <Box sx={{ p: 3 }}>
          <Typography variant="h6" color="error">
            Error loading announcements
          </Typography>
          <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
            {notificationsError}
          </Typography>
        </Box>
      </MainCard>
    );
  }

  return (
    <Box>
      {/* Header */}
      <Box sx={{ mb: 3 }}>
        <Typography variant="h4" fontWeight="bold">
          Announcements
        </Typography>
        <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
          View important announcements from your landlord
        </Typography>
      </Box>

      <Divider sx={{ mb: 3 }} />

      {/* Announcements List */}
      {announcements.length === 0 ? (
        <MainCard>
          <Box sx={{ textAlign: 'center', py: 8 }}>
            <FileTextOutlined style={{ fontSize: 64, color: '#ccc', marginBottom: 16 }} />
            <Typography variant="h6" color="text.secondary" sx={{ mb: 1 }}>
              No announcements
            </Typography>
            <Typography variant="body2" color="text.secondary">
              When your landlord sends important updates, they will appear here.
            </Typography>
          </Box>
        </MainCard>
      ) : (
        <Stack spacing={2}>
          {announcements.map((announcement, index) => {
            const Icon = FileTextOutlined;
            const color = 'info';

            return (
              <Paper
                key={announcement.id}
                elevation={0}
                sx={{
                  p: 3,
                  borderRadius: 2,
                  border: (t) => `1px solid ${alpha(t.palette.divider, 0.12)}`,
                  bgcolor: (t) => alpha(t.palette.background.paper, 0.6),
                  transition: 'all 0.2s ease',
                  '&:hover': {
                    boxShadow: (t) => `0 4px 16px ${alpha(t.palette.primary.main, 0.1)}`,
                    border: (t) => `1px solid ${alpha(t.palette.primary.main, 0.3)}`
                  }
                }}
              >
                <Stack direction="row" spacing={2} alignItems="flex-start">
                  <Avatar type="filled" color={color} size="md">
                    <Icon />
                  </Avatar>
                  <Stack sx={{ flex: 1 }} spacing={1}>
                    <Stack direction="row" spacing={1} alignItems="center" justifyContent="space-between">
                      <Typography variant="h6" fontWeight={600}>
                        {announcement.title}
                      </Typography>
                      {!announcement.isRead && (
                        <Chip
                          label="New"
                          size="small"
                          color="primary"
                          sx={{ height: 20, fontSize: '0.7rem' }}
                        />
                      )}
                    </Stack>
                    <Typography variant="body1" color="text.secondary">
                      {announcement.message}
                    </Typography>
                    <Stack direction="row" spacing={2} alignItems="center" sx={{ mt: 1 }}>
                      <Typography variant="caption" color="text.secondary">
                        {formatDateAndTime(announcement.createdAt)}
                      </Typography>
                      {announcement.performedByName && (
                        <>
                          <Typography variant="caption" color="text.secondary">•</Typography>
                          <Typography variant="caption" color="text.secondary">
                            From: {announcement.performedByName}
                          </Typography>
                        </>
                      )}
                    </Stack>
                    {announcement.relatedId && (
                      <Box sx={{ mt: 1 }}>
                        <Button
                          variant="outlined"
                          size="small"
                          startIcon={<EyeOutlined />}
                          onClick={() => handleAnnouncementClick(announcement)}
                          sx={{ textTransform: 'none' }}
                        >
                          View Related Lease
                        </Button>
                      </Box>
                    )}
                  </Stack>
                </Stack>
                {index < announcements.length - 1 && <Divider sx={{ mt: 2 }} />}
              </Paper>
            );
          })}
        </Stack>
      )}
    </Box>
  );
}
