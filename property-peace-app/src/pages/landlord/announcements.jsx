import { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useSelector } from 'react-redux';
import { alpha, useTheme } from '@mui/material';

// material-ui
import {
  Box,
  Typography,
  Button,
  Stack,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  CircularProgress,
  Alert,
  Chip,
  IconButton,
  Tooltip,
  Fade,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogContentText,
  DialogActions,
  FormControl,
  Select,
  MenuItem,
  Grid
} from '@mui/material';
import {
  PlusOutlined,
  EyeOutlined,
  EditOutlined,
  ClockCircleOutlined,
  NotificationOutlined,
  DeleteOutlined,
  CloseOutlined,
  LeftOutlined,
  RightOutlined,
  SendOutlined,
  CheckCircleOutlined,
  ScheduleOutlined,
  HourglassOutlined
} from '@ant-design/icons';
import MainCard from 'components/MainCard';
import AnimateIn from 'components/AnimateIn';
import PageBreadcrumbs from 'components/breadcrumbs/PageBreadcrumbs';
import { announcementAPI } from 'api';
import { format } from 'date-fns';
import { formatDateAndTime } from 'utils/formatters';
import AnnouncementFilters from 'sections/announcements/AnnouncementFilters';
import { selectProperty } from 'store/property/property.selector';

// ==============================|| ANNOUNCEMENTS PAGE ||============================== //

export default function AnnouncementsPage() {
  const navigate = useNavigate();
  const theme = useTheme();
  const selectedProperty = useSelector(selectProperty);
  const [announcements, setAnnouncements] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [announcementToDelete, setAnnouncementToDelete] = useState(null);
  const [deleting, setDeleting] = useState(false);
  const [page, setPage] = useState(0);
  const [itemsPerPage, setItemsPerPage] = useState(10);
  const [fadeIn, setFadeIn] = useState(false);

  useEffect(() => {
    setFadeIn(true);
  }, []);

  const getDefaultTimespan = () => {
    const now = new Date();
    const lastMonth = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
    return { timespan: 'month', dateFrom: lastMonth, dateTo: now };
  };

  const [filters, setFilters] = useState({
    dateFrom: getDefaultTimespan().dateFrom,
    dateTo: getDefaultTimespan().dateTo,
    timespan: getDefaultTimespan(),
    organizationId: null,
    propertyId: null
  });

  useEffect(() => {
    const fetchAnnouncements = async () => {
      setLoading(true);
      setError(null);
      try {
        const result = await announcementAPI.getAnnouncements({
          fromDate: filters.dateFrom ? format(filters.dateFrom, 'yyyy-MM-dd') : undefined,
          toDate: filters.dateTo ? format(filters.dateTo, 'yyyy-MM-dd') : undefined,
          organizationId: filters.organizationId ? Number(filters.organizationId) : undefined,
          propertyId: filters.propertyId ? Number(filters.propertyId) : undefined
        });
        if (result.success && result.data) {
          setAnnouncements(Array.isArray(result.data) ? result.data : []);
        } else {
          setAnnouncements([]);
        }
      } catch (err) {
        setError(err.message || 'Failed to load announcements');
      } finally {
        setLoading(false);
      }
    };
    fetchAnnouncements();
  }, [filters]);

  const filteredAnnouncements = useMemo(() => announcements, [announcements]);

  // Stats derived from data
  const stats = useMemo(() => {
    const total = filteredAnnouncements.length;
    const sent = filteredAnnouncements.filter(a => a.isCompleted || a.IsCompleted).length;
    const scheduled = filteredAnnouncements.filter(a => {
      const scheduledAt = a.scheduledAt || a.ScheduledAt;
      const isCompleted = a.isCompleted || a.IsCompleted;
      return scheduledAt && !isCompleted;
    }).length;
    const pending = total - sent - scheduled;
    return { total, sent, scheduled, pending };
  }, [filteredAnnouncements]);

  const totalPages = Math.ceil(filteredAnnouncements.length / itemsPerPage);
  const paginatedAnnouncements = useMemo(() => {
    const start = page * itemsPerPage;
    return filteredAnnouncements.slice(start, start + itemsPerPage);
  }, [filteredAnnouncements, page, itemsPerPage]);

  useEffect(() => { setPage(0); }, [itemsPerPage]);

  const handleNewAnnouncement = () => navigate('/landlord/announcements/selection');

  const handleDeleteClick = (announcement) => {
    setAnnouncementToDelete(announcement);
    setDeleteDialogOpen(true);
  };

  const handleDeleteConfirm = async () => {
    if (!announcementToDelete) return;
    setDeleting(true);
    try {
      const announcementId = announcementToDelete.id || announcementToDelete.Id;
      const result = await announcementAPI.deleteAnnouncement(announcementId);
      if (result.success) {
        setAnnouncements(prev => prev.filter(a => (a.id || a.Id) !== announcementId));
        setDeleteDialogOpen(false);
        setAnnouncementToDelete(null);
      } else {
        setError(result.message || 'Failed to delete announcement');
      }
    } catch (err) {
      setError(err.message || 'Failed to delete announcement');
    } finally {
      setDeleting(false);
    }
  };

  const handleDeleteCancel = () => {
    setDeleteDialogOpen(false);
    setAnnouncementToDelete(null);
  };

  const getAnnouncementStatus = (a) => {
    const isCompleted = a.isCompleted || a.IsCompleted;
    const scheduledAt = a.scheduledAt || a.ScheduledAt;
    if (isCompleted) return 'sent';
    if (scheduledAt) return 'scheduled';
    return 'pending';
  };

  const statusConfig = {
    sent: { label: 'Sent', color: theme.palette.success.main, bg: alpha(theme.palette.success.main, 0.1) },
    scheduled: { label: 'Scheduled', color: '#0ea5e9', bg: alpha('#0ea5e9', 0.1) },
    pending: { label: 'Pending', color: theme.palette.warning.main, bg: alpha(theme.palette.warning.main, 0.1) }
  };

  const statItems = [
    { label: 'Total', value: stats.total, icon: <NotificationOutlined />, color: theme.palette.primary.main },
    { label: 'Sent', value: stats.sent, icon: <CheckCircleOutlined />, color: theme.palette.success.main },
    { label: 'Scheduled', value: stats.scheduled, icon: <ScheduleOutlined />, color: '#0ea5e9' },
    { label: 'Pending', value: stats.pending, icon: <HourglassOutlined />, color: theme.palette.warning.main }
  ];

  return (
    <Fade in={fadeIn} timeout={600}>
      <Box sx={{ overflow: 'visible' }}>
        {/* Breadcrumbs */}
        <PageBreadcrumbs
          items={[
            { label: 'Dashboard', path: '/landlord/dashboard' },
            { label: 'Announcements' }
          ]}
        />

        {/* Header — unchanged */}
        <AnimateIn direction="bottom" delay={100} distance={120}>
          <Box sx={{ mb: 2 }}>
            <Typography variant="h3" fontWeight={700}>Announcements</Typography>
            <Typography variant="body1" color="text.secondary">Manage and track your announcements</Typography>
          </Box>
        </AnimateIn>

        {/* Stats Row */}
        <AnimateIn direction="bottom" delay={150} distance={120}>
          <Grid container spacing={2} sx={{ mb: 3 }}>
            {statItems.map((stat) => (
              <Grid key={stat.label} size={{ xs: 6, sm: 3 }}>
                <Box
                  sx={{
                    position: 'relative',
                    overflow: 'hidden',
                    bgcolor: 'background.paper',
                    borderRadius: 2,
                    p: 2,
                    display: 'flex',
                    alignItems: 'center',
                    gap: 1.5,
                    border: `1px solid ${alpha(theme.palette.divider, 0.12)}`,
                    boxShadow: `0 8px 24px ${alpha(theme.palette.common.black, 0.06)}`,
                    '&::before': {
                      content: '""',
                      position: 'absolute',
                      inset: '0 0 auto 0',
                      height: 2,
                      pointerEvents: 'none',
                      background: `linear-gradient(90deg, ${stat.color} 0%, ${alpha(stat.color, 0.34)} 42%, transparent 100%)`,
                      opacity: theme.palette.mode === 'dark' ? 0.9 : 0
                    }
                  }}
                >
                  <Box
                    sx={{
                      width: 38, height: 38, borderRadius: 1.5,
                      bgcolor: alpha(stat.color, 0.1),
                      display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
                      '& .anticon': { fontSize: 18, color: stat.color }
                    }}
                  >
                    {stat.icon}
                  </Box>
                  <Box>
                    <Typography variant="caption" color="text.secondary" fontWeight={800} sx={{ textTransform: 'uppercase', letterSpacing: 1.1, fontSize: '0.68rem', display: 'block', mb: 0.5 }}>{stat.label}</Typography>
                    <Typography variant="h4" fontWeight={800} sx={{ lineHeight: 1.05 }}>
                      {loading ? '—' : stat.value}
                    </Typography>
                  </Box>
                </Box>
              </Grid>
            ))}
          </Grid>
        </AnimateIn>

        {/* Filters */}
        <AnimateIn direction="bottom" delay={220} distance={120}>
          <Box sx={{ mb: 2.5 }}>
            <AnnouncementFilters
              filters={filters}
              onFiltersChange={setFilters}
              onNewAnnouncement={handleNewAnnouncement}
            />
          </Box>
        </AnimateIn>

        {/* Main Card — announcement list */}
        <AnimateIn direction="bottom" delay={250} distance={120}>
          <MainCard
            content={false}
            boxShadow
            border={false}
            shadow={theme.palette.mode === 'dark' ? `0 0 0 1px ${alpha(theme.palette.primary.main, 0.22)}, 0 8px 28px ${alpha(theme.palette.primary.main, 0.14)}` : `0 2px 12px ${alpha(theme.palette.primary.main, 0.08)}`}
            sx={{ bgcolor: 'background.paper', border: `1px solid ${alpha(theme.palette.divider, theme.palette.mode === 'dark' ? 0.18 : 0.1)}`, borderRadius: 2, overflow: 'hidden' }}
          >
            {/* Content */}
            {loading ? (
              <Box display="flex" justifyContent="center" alignItems="center" p={6}>
                <CircularProgress size={32} />
              </Box>
            ) : error ? (
              <Alert severity="error" sx={{ m: 3 }}>{error}</Alert>
            ) : filteredAnnouncements.length === 0 ? (
              <Box sx={{ py: 8, textAlign: 'center' }}>
                <Box
                  sx={{
                    width: 72, height: 72, borderRadius: '50%', mx: 'auto', mb: 2.5,
                    bgcolor: alpha(theme.palette.primary.main, 0.06),
                    display: 'flex', alignItems: 'center', justifyContent: 'center'
                  }}
                >
                  <NotificationOutlined style={{ fontSize: 32, color: alpha(theme.palette.primary.main, 0.5) }} />
                </Box>
                <Typography variant="h5" fontWeight={600} sx={{ mb: 0.75 }}>No announcements yet</Typography>
                <Typography variant="body2" color="text.secondary" sx={{ mb: 3, maxWidth: 320, mx: 'auto' }}>
                  Send updates, reminders, or notices to your tenants in seconds.
                </Typography>
                <Button variant="contained" startIcon={<PlusOutlined />} onClick={handleNewAnnouncement}>
                  Create Your First Announcement
                </Button>
              </Box>
            ) : (
              <>
                <TableContainer>
                  <Table>
                    <TableHead>
                      <TableRow sx={{ '& .MuiTableCell-head': { fontWeight: 600, fontSize: '0.75rem', textTransform: 'uppercase', letterSpacing: '0.04em', color: 'text.secondary', py: 1.5 } }}>
                        <TableCell>Title</TableCell>
                        <TableCell>Created</TableCell>
                        <TableCell>Scheduled</TableCell>
                        <TableCell align="center">Recipients</TableCell>
                        <TableCell>Delivery</TableCell>
                        <TableCell>Status</TableCell>
                        <TableCell align="right">Actions</TableCell>
                      </TableRow>
                    </TableHead>
                    <TableBody>
                      {paginatedAnnouncements.map((announcement) => {
                        const status = getAnnouncementStatus(announcement);
                        const cfg = statusConfig[status];
                        const scheduledAt = announcement.scheduledAt || announcement.ScheduledAt;
                        const isCompleted = announcement.isCompleted || announcement.IsCompleted;
                        const isScheduled = scheduledAt && !isCompleted;
                        const sentCount = announcement.sentCount || announcement.SentCount || 0;
                        const failedCount = announcement.failedCount || announcement.FailedCount || 0;

                        return (
                          <TableRow
                            key={announcement.id}
                            hover
                            sx={{
                              cursor: 'pointer',
                              '&:hover': { bgcolor: alpha(theme.palette.primary.main, 0.02) },
                              '& td': { borderBottom: `1px solid ${alpha(theme.palette.divider, 0.06)}`, py: 1.75 }
                            }}
                            onClick={() => {
                              const id = announcement.id || announcement.Id;
                              navigate(`/landlord/announcements/details?id=${id}`);
                            }}
                          >
                            {/* Title */}
                            <TableCell>
                              <Stack direction="row" alignItems="center" spacing={1.5}>
                                <Box
                                  sx={{
                                    width: 3, height: 32, borderRadius: 4, flexShrink: 0,
                                    bgcolor: cfg.color
                                  }}
                                />
                                <Typography variant="body2" fontWeight={600} sx={{ maxWidth: 260, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                  {announcement.title || announcement.Title || 'Announcement'}
                                </Typography>
                              </Stack>
                            </TableCell>

                            {/* Created */}
                            <TableCell>
                              <Typography variant="body2" color="text.secondary" sx={{ fontSize: '0.8125rem' }}>
                                {announcement.createdAt ? formatDateAndTime(announcement.createdAt) : '—'}
                              </Typography>
                            </TableCell>

                            {/* Scheduled */}
                            <TableCell>
                              {scheduledAt ? (
                                <Stack direction="row" spacing={0.75} alignItems="center">
                                  <ClockCircleOutlined style={{ fontSize: 13, color: '#0ea5e9' }} />
                                  <Typography variant="body2" sx={{ fontSize: '0.8125rem', color: '#0ea5e9' }}>
                                    {formatDateAndTime(scheduledAt)}
                                  </Typography>
                                </Stack>
                              ) : isCompleted ? (
                                <Typography variant="body2" color="text.secondary" sx={{ fontSize: '0.8125rem' }}>Sent immediately</Typography>
                              ) : (
                                <Typography variant="body2" color="text.secondary">—</Typography>
                              )}
                            </TableCell>

                            {/* Recipients */}
                            <TableCell align="center">
                              <Typography variant="body2" fontWeight={500}>
                                {sentCount}
                                {failedCount > 0 && (
                                  <Typography component="span" variant="caption" color="error.main" sx={{ ml: 0.5 }}>
                                    ({failedCount} failed)
                                  </Typography>
                                )}
                              </Typography>
                            </TableCell>

                            {/* Delivery */}
                            <TableCell>
                              <Stack direction="row" spacing={0.5}>
                                {(announcement.sendAsNotification || announcement.SendAsNotification) && (
                                  <Chip label="In-App" size="small" sx={{ fontSize: '0.7rem', height: 22, bgcolor: alpha(theme.palette.primary.main, 0.08), color: theme.palette.primary.main, border: 'none', fontWeight: 600 }} />
                                )}
                                {(announcement.sendAsEmail || announcement.SendAsEmail) && (
                                  <Chip label="Email" size="small" sx={{ fontSize: '0.7rem', height: 22, bgcolor: alpha(theme.palette.secondary.main, 0.08), color: 'text.secondary', border: 'none', fontWeight: 600 }} />
                                )}
                              </Stack>
                            </TableCell>

                            {/* Status */}
                            <TableCell>
                              <Chip
                                label={cfg.label}
                                size="small"
                                sx={{
                                  bgcolor: cfg.bg,
                                  color: cfg.color,
                                  fontWeight: 600,
                                  fontSize: '0.7rem',
                                  height: 24,
                                  border: 'none'
                                }}
                              />
                            </TableCell>

                            {/* Actions */}
                            <TableCell align="right" onClick={(e) => e.stopPropagation()}>
                              <Stack direction="row" spacing={0.5} justifyContent="flex-end">
                                {isScheduled && (
                                  <Tooltip title="Edit">
                                    <IconButton size="small" sx={{ color: 'text.secondary', '&:hover': { color: theme.palette.primary.main } }}
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        navigate(`/landlord/announcements/edit?id=${announcement.id || announcement.Id}`);
                                      }}
                                    >
                                      <EditOutlined style={{ fontSize: 15 }} />
                                    </IconButton>
                                  </Tooltip>
                                )}
                                <Tooltip title="View Details">
                                  <IconButton size="small" sx={{ color: 'text.secondary', '&:hover': { color: theme.palette.primary.main } }}
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      navigate(`/landlord/announcements/details?id=${announcement.id || announcement.Id}`);
                                    }}
                                  >
                                    <EyeOutlined style={{ fontSize: 15 }} />
                                  </IconButton>
                                </Tooltip>
                                <Tooltip title={isScheduled ? 'Cancel Announcement' : 'Delete'}>
                                  <IconButton size="small" sx={{ color: 'text.secondary', '&:hover': { color: theme.palette.error.main } }}
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      handleDeleteClick(announcement);
                                    }}
                                  >
                                    {isScheduled
                                      ? <CloseOutlined style={{ fontSize: 15 }} />
                                      : <DeleteOutlined style={{ fontSize: 15 }} />}
                                  </IconButton>
                                </Tooltip>
                              </Stack>
                            </TableCell>
                          </TableRow>
                        );
                      })}
                    </TableBody>
                  </Table>
                </TableContainer>

              </>
            )}
          </MainCard>
                {filteredAnnouncements.length > 0 && (
                  <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mt: 2 }}>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                      <Typography variant="body2" color="text.secondary">Items per page:</Typography>
                      <FormControl size="small" sx={{ minWidth: 80 }}>
                        <Select value={itemsPerPage} onChange={(e) => setItemsPerPage(Number(e.target.value))} sx={{ height: 32 }}>
                          <MenuItem value={10}>10</MenuItem>
                          <MenuItem value={20}>20</MenuItem>
                        </Select>
                      </FormControl>
                    </Box>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                      <Typography variant="body2" color="text.secondary">Page {page + 1} of {totalPages}</Typography>
                      <Box sx={{ display: 'flex', gap: 1 }}>
                        <Button size="small" variant="outlined" startIcon={<LeftOutlined />} onClick={() => setPage(Math.max(0, page - 1))} disabled={page === 0} sx={{ minWidth: 100 }}>Previous</Button>
                        <Button size="small" variant="outlined" endIcon={<RightOutlined />} onClick={() => setPage(Math.min(totalPages - 1, page + 1))} disabled={page >= totalPages - 1} sx={{ minWidth: 100 }}>Next</Button>
                      </Box>
                    </Box>
                  </Box>
                )}
        </AnimateIn>

        {/* Delete Confirmation Dialog */}
        <Dialog open={deleteDialogOpen} onClose={handleDeleteCancel} PaperProps={{ sx: { borderRadius: 2, minWidth: 380 } }}>
          <DialogTitle sx={{ pb: 1, fontWeight: 700 }}>
            {announcementToDelete && (() => {
              const isScheduled = (announcementToDelete.scheduledAt || announcementToDelete.ScheduledAt) &&
                !(announcementToDelete.isCompleted || announcementToDelete.IsCompleted);
              return isScheduled ? 'Cancel Scheduled Announcement?' : 'Delete Announcement?';
            })()}
          </DialogTitle>
          <DialogContent>
            <DialogContentText sx={{ fontSize: '0.875rem' }}>
              {announcementToDelete && (() => {
                const isScheduled = (announcementToDelete.scheduledAt || announcementToDelete.ScheduledAt) &&
                  !(announcementToDelete.isCompleted || announcementToDelete.IsCompleted);
                const title = announcementToDelete.title || announcementToDelete.Title || 'this announcement';
                return isScheduled
                  ? `Are you sure you want to cancel "${title}"? This action cannot be undone and the announcement will not be sent.`
                  : `Are you sure you want to delete "${title}"? This action cannot be undone.`;
              })()}
            </DialogContentText>
          </DialogContent>
          <DialogActions sx={{ px: 3, pb: 2.5 }}>
            <Button onClick={handleDeleteCancel} disabled={deleting} variant="outlined">Cancel</Button>
            <Button onClick={handleDeleteConfirm} color="error" variant="contained" disabled={deleting}>
              {deleting ? 'Processing...' : (announcementToDelete && (() => {
                const isScheduled = (announcementToDelete.scheduledAt || announcementToDelete.ScheduledAt) &&
                  !(announcementToDelete.isCompleted || announcementToDelete.IsCompleted);
                return isScheduled ? 'Cancel Announcement' : 'Delete';
              })())}
            </Button>
          </DialogActions>
        </Dialog>
      </Box>
    </Fade>
  );
}
