import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { alpha, useTheme } from '@mui/material';
import {
  Alert,
  Avatar,
  Box,
  Button,
  Chip,
  CircularProgress,
  Dialog,
  DialogActions,
  DialogContent,
  DialogContentText,
  DialogTitle,
  Divider,
  Grid,
  IconButton,
  InputAdornment,
  Menu,
  MenuItem,
  OutlinedInput,
  Pagination,
  Select,
  Stack,
  Tooltip,
  Typography
} from '@mui/material';
import {
  CheckCircleOutlined,
  ClockCircleOutlined,
  CloseOutlined,
  DeleteOutlined,
  DownOutlined,
  EditOutlined,
  EyeOutlined,
  MailOutlined,
  MoreOutlined,
  NotificationOutlined,
  PlusOutlined,
  SearchOutlined,
  SendOutlined,
  WarningOutlined
} from '@ant-design/icons';
import { format } from 'date-fns';

import ManagementPageHeader from 'components/headers/ManagementPageHeader';
import { managementPageHeaderActionSx } from 'components/headers/managementPageHeaderStyles';
import { announcementAPI } from 'api';
import AnnouncementFilters from 'sections/announcements/AnnouncementFilters';
import { formatDateAndTime } from 'utils/formatters';

const PAGE_SIZE = 10;
const read = (object, camel, pascal) => object?.[camel] ?? object?.[pascal];
const getId = (announcement) => read(announcement, 'id', 'Id');

function parseIds(value) {
  if (!value) return [];
  if (Array.isArray(value)) return value;
  try {
    const parsed = JSON.parse(value);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function getStatus(announcement) {
  if (read(announcement, 'isCompleted', 'IsCompleted')) return 'sent';
  if (read(announcement, 'scheduledAt', 'ScheduledAt')) return 'scheduled';
  return 'pending';
}

function getDeliveryLabel(announcement) {
  const email = read(announcement, 'sendAsEmail', 'SendAsEmail');
  const notification = read(announcement, 'sendAsNotification', 'SendAsNotification');
  if (email && notification) return 'Email + in-app';
  if (email) return 'Email';
  if (notification) return 'In-app';
  return 'No channel';
}

function getAudienceLabel(announcement) {
  const units = parseIds(read(announcement, 'unitIds', 'UnitIds'));
  const properties = parseIds(read(announcement, 'propertyIds', 'PropertyIds'));
  const organizations = parseIds(read(announcement, 'organizationIds', 'OrganizationIds'));

  if (units.length) return `${units.length} selected unit${units.length === 1 ? '' : 's'}`;
  if (properties.length) return `${properties.length} selected propert${properties.length === 1 ? 'y' : 'ies'}`;
  if (organizations.length) return `${organizations.length} organization${organizations.length === 1 ? '' : 's'}`;
  return 'All eligible tenants';
}

function getEventDate(announcement) {
  return (
    read(announcement, 'completedAt', 'CompletedAt') ||
    read(announcement, 'scheduledAt', 'ScheduledAt') ||
    read(announcement, 'createdAt', 'CreatedAt')
  );
}

function SummaryCard({ label, value, helper, icon, color, active, onClick }) {
  const theme = useTheme();

  return (
    <Box
      component="button"
      type="button"
      onClick={onClick}
      sx={{
        width: '100%',
        minHeight: 108,
        p: 2,
        borderRadius: 2.5,
        border: `1px solid ${active ? alpha(color, 0.55) : alpha(theme.palette.divider, 0.16)}`,
        bgcolor: active ? alpha(color, theme.palette.mode === 'dark' ? 0.13 : 0.055) : 'background.paper',
        boxShadow: active ? `0 8px 24px ${alpha(color, 0.12)}` : `0 4px 18px ${alpha('#061e35', 0.05)}`,
        color: 'text.primary',
        textAlign: 'left',
        cursor: 'pointer',
        font: 'inherit',
        transition: 'transform 150ms ease, border-color 150ms ease, box-shadow 150ms ease',
        '&:hover': { transform: 'translateY(-2px)', borderColor: alpha(color, 0.45), boxShadow: `0 10px 28px ${alpha(color, 0.12)}` },
        '&:focus-visible': { outline: `3px solid ${alpha(color, 0.28)}`, outlineOffset: 2 }
      }}
    >
      <Stack direction="row" justifyContent="space-between" alignItems="flex-start" spacing={1.5}>
        <Box>
          <Typography
            sx={{ fontSize: '0.7rem', fontWeight: 750, letterSpacing: 0.65, textTransform: 'uppercase', color: 'text.secondary' }}
          >
            {label}
          </Typography>
          <Typography sx={{ mt: 0.5, fontSize: '1.45rem', lineHeight: 1.15, fontWeight: 750 }}>{value}</Typography>
          <Typography sx={{ mt: 0.55, fontSize: '0.75rem', color: 'text.secondary' }}>{helper}</Typography>
        </Box>
        <Avatar sx={{ width: 38, height: 38, bgcolor: alpha(color, 0.12), color }}>{icon}</Avatar>
      </Stack>
    </Box>
  );
}

function AnnouncementRow({ announcement, onOpen, onEdit, onDelete }) {
  const theme = useTheme();
  const [anchorEl, setAnchorEl] = useState(null);
  const status = getStatus(announcement);
  const isScheduled = status === 'scheduled';
  const sentCount = Number(read(announcement, 'sentCount', 'SentCount') || 0);
  const failedCount = Number(read(announcement, 'failedCount', 'FailedCount') || 0);
  const title = read(announcement, 'title', 'Title') || 'Untitled announcement';
  const message =
    read(announcement, 'formattedMessage', 'FormattedMessage') || read(announcement, 'message', 'Message') || 'No message preview';
  const sendEmail = read(announcement, 'sendAsEmail', 'SendAsEmail');
  const sendNotification = read(announcement, 'sendAsNotification', 'SendAsNotification');
  const eventDate = getEventDate(announcement);
  const statusConfig = {
    sent: {
      label: failedCount > 0 ? 'Sent with issues' : 'Sent',
      color: failedCount > 0 ? theme.palette.warning.main : theme.palette.success.main
    },
    scheduled: { label: 'Scheduled', color: '#0ea5e9' },
    pending: { label: 'Pending', color: theme.palette.warning.main }
  }[status];

  const handleKeyDown = (event) => {
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      onOpen(announcement);
    }
  };

  return (
    <Box
      role="link"
      tabIndex={0}
      onClick={() => onOpen(announcement)}
      onKeyDown={handleKeyDown}
      sx={{
        px: { xs: 1.5, md: 2 },
        py: { xs: 1.6, md: 1.45 },
        display: { xs: 'block', md: 'grid' },
        gridTemplateColumns: 'minmax(260px, 2fr) minmax(155px, 1fr) minmax(160px, 1fr) minmax(120px, .8fr) 44px',
        gap: { xs: 1.5, md: 2 },
        alignItems: 'center',
        cursor: 'pointer',
        borderBottom: `1px solid ${alpha(theme.palette.divider, 0.13)}`,
        transition: 'background-color 140ms ease',
        '&:hover': { bgcolor: alpha(theme.palette.primary.main, theme.palette.mode === 'dark' ? 0.08 : 0.028) },
        '&:focus-visible': { outline: `2px solid ${alpha(theme.palette.primary.main, 0.45)}`, outlineOffset: -2 }
      }}
    >
      <Stack direction="row" spacing={1.25} alignItems="flex-start" minWidth={0}>
        <Avatar
          sx={{
            width: 42,
            height: 42,
            mt: 0.1,
            flexShrink: 0,
            bgcolor: alpha(statusConfig.color, 0.11),
            color: statusConfig.color
          }}
        >
          {status === 'scheduled' ? <ClockCircleOutlined /> : <SendOutlined />}
        </Avatar>
        <Box minWidth={0}>
          <Stack direction="row" alignItems="center" spacing={0.8} minWidth={0}>
            <Typography fontWeight={700} noWrap>
              {title}
            </Typography>
            <Chip
              size="small"
              label={statusConfig.label}
              sx={{
                height: 21,
                flexShrink: 0,
                fontSize: '0.66rem',
                fontWeight: 700,
                bgcolor: alpha(statusConfig.color, 0.1),
                color: statusConfig.color
              }}
            />
          </Stack>
          <Typography noWrap sx={{ mt: 0.35, fontSize: '0.76rem', color: 'text.secondary', maxWidth: 520 }}>
            {message.replace(/\s+/g, ' ').trim()}
          </Typography>
          <Typography sx={{ display: { xs: 'block', md: 'none' }, mt: 0.65, fontSize: '0.72rem', color: 'text.secondary' }}>
            {getAudienceLabel(announcement)} · {getDeliveryLabel(announcement)}
          </Typography>
        </Box>
      </Stack>

      <Box sx={{ display: { xs: 'none', md: 'block' } }}>
        <Typography sx={{ fontSize: '0.8rem', fontWeight: 650 }}>{getAudienceLabel(announcement)}</Typography>
        <Typography sx={{ mt: 0.35, fontSize: '0.71rem', color: 'text.secondary' }}>
          {read(announcement, 'organizationName', 'OrganizationName') || 'Current organization'}
        </Typography>
      </Box>

      <Box sx={{ display: { xs: 'none', md: 'block' } }}>
        <Typography sx={{ fontSize: '0.8rem', fontWeight: 650 }}>
          {status === 'scheduled' ? 'Sends' : status === 'sent' ? 'Sent' : 'Created'}
        </Typography>
        <Typography sx={{ mt: 0.35, fontSize: '0.72rem', color: status === 'scheduled' ? '#0ea5e9' : 'text.secondary' }}>
          {eventDate ? formatDateAndTime(eventDate) : 'Date unavailable'}
        </Typography>
        <Stack direction="row" spacing={0.8} sx={{ mt: 0.7 }}>
          {sendNotification && (
            <Tooltip title="In-app notification">
              <NotificationOutlined style={{ color: theme.palette.text.secondary, fontSize: 14 }} />
            </Tooltip>
          )}
          {sendEmail && (
            <Tooltip title="Email">
              <MailOutlined style={{ color: theme.palette.text.secondary, fontSize: 14 }} />
            </Tooltip>
          )}
        </Stack>
      </Box>

      <Box>
        <Typography sx={{ fontSize: '0.78rem', fontWeight: 700 }}>
          {status === 'sent' ? `${sentCount} delivered` : status === 'scheduled' ? 'Awaiting send' : 'Not sent'}
        </Typography>
        <Typography sx={{ mt: 0.35, fontSize: '0.71rem', color: failedCount > 0 ? 'error.main' : 'text.secondary' }}>
          {failedCount > 0 ? `${failedCount} failed` : status === 'sent' ? 'No delivery failures' : getDeliveryLabel(announcement)}
        </Typography>
      </Box>

      <Box sx={{ display: 'flex', justifyContent: { xs: 'flex-end', md: 'center' } }}>
        <Tooltip title="Announcement actions">
          <IconButton
            aria-label={`Actions for ${title}`}
            size="small"
            onClick={(event) => {
              event.stopPropagation();
              setAnchorEl(event.currentTarget);
            }}
          >
            <MoreOutlined />
          </IconButton>
        </Tooltip>
        <Menu anchorEl={anchorEl} open={Boolean(anchorEl)} onClose={() => setAnchorEl(null)}>
          <MenuItem
            onClick={(event) => {
              event.stopPropagation();
              setAnchorEl(null);
              onOpen(announcement);
            }}
          >
            <EyeOutlined style={{ marginRight: 10 }} /> View details
          </MenuItem>
          {isScheduled && (
            <MenuItem
              onClick={(event) => {
                event.stopPropagation();
                setAnchorEl(null);
                onEdit(announcement);
              }}
            >
              <EditOutlined style={{ marginRight: 10 }} /> Edit schedule
            </MenuItem>
          )}
          <MenuItem
            sx={{ color: 'error.main' }}
            onClick={(event) => {
              event.stopPropagation();
              setAnchorEl(null);
              onDelete(announcement);
            }}
          >
            {isScheduled ? <CloseOutlined style={{ marginRight: 10 }} /> : <DeleteOutlined style={{ marginRight: 10 }} />}
            {isScheduled ? 'Cancel announcement' : 'Delete'}
          </MenuItem>
        </Menu>
      </Box>
    </Box>
  );
}

export default function AnnouncementsPage() {
  const navigate = useNavigate();
  const theme = useTheme();
  const [announcements, setAnnouncements] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [announcementToDelete, setAnnouncementToDelete] = useState(null);
  const [deleting, setDeleting] = useState(false);
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState('all');
  const [delivery, setDelivery] = useState('all');
  const [sort, setSort] = useState('newest');
  const [page, setPage] = useState(1);

  const getDefaultTimespan = () => {
    const now = new Date();
    const lastMonth = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
    return { timespan: 'month', dateFrom: lastMonth, dateTo: now };
  };

  const defaultTimespan = useMemo(() => getDefaultTimespan(), []);
  const [filters, setFilters] = useState({
    dateFrom: defaultTimespan.dateFrom,
    dateTo: defaultTimespan.dateTo,
    timespan: defaultTimespan,
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
          if (!result.success) setError(result.message || 'Failed to load announcements');
        }
      } catch (err) {
        setError(err.message || 'Failed to load announcements');
      } finally {
        setLoading(false);
      }
    };

    fetchAnnouncements();
  }, [filters]);

  useEffect(() => {
    setPage(1);
  }, [search, status, delivery, sort, filters]);

  const metrics = useMemo(() => {
    const sent = announcements.filter((announcement) => getStatus(announcement) === 'sent');
    const scheduled = announcements.filter((announcement) => getStatus(announcement) === 'scheduled');
    const attention = announcements.filter(
      (announcement) => getStatus(announcement) === 'pending' || Number(read(announcement, 'failedCount', 'FailedCount') || 0) > 0
    );
    const delivered = sent.reduce((total, announcement) => total + Number(read(announcement, 'sentCount', 'SentCount') || 0), 0);
    return { total: announcements.length, sent: sent.length, scheduled: scheduled.length, attention: attention.length, delivered };
  }, [announcements]);

  const filteredAnnouncements = useMemo(() => {
    const query = search.trim().toLowerCase();
    const list = announcements.filter((announcement) => {
      const announcementStatus = getStatus(announcement);
      const searchable = [
        read(announcement, 'title', 'Title'),
        read(announcement, 'message', 'Message'),
        read(announcement, 'formattedMessage', 'FormattedMessage'),
        read(announcement, 'createdByName', 'CreatedByName'),
        read(announcement, 'organizationName', 'OrganizationName')
      ]
        .filter(Boolean)
        .join(' ')
        .toLowerCase();

      if (query && !searchable.includes(query)) return false;
      if (status === 'attention' && announcementStatus !== 'pending' && Number(read(announcement, 'failedCount', 'FailedCount') || 0) === 0)
        return false;
      if (!['all', 'attention'].includes(status) && announcementStatus !== status) return false;
      if (delivery === 'email' && !read(announcement, 'sendAsEmail', 'SendAsEmail')) return false;
      if (delivery === 'notification' && !read(announcement, 'sendAsNotification', 'SendAsNotification')) return false;
      if (
        delivery === 'both' &&
        !(read(announcement, 'sendAsEmail', 'SendAsEmail') && read(announcement, 'sendAsNotification', 'SendAsNotification'))
      )
        return false;
      return true;
    });

    return list.sort((a, b) => {
      if (sort === 'oldest') return new Date(read(a, 'createdAt', 'CreatedAt') || 0) - new Date(read(b, 'createdAt', 'CreatedAt') || 0);
      if (sort === 'recipients') return Number(read(b, 'sentCount', 'SentCount') || 0) - Number(read(a, 'sentCount', 'SentCount') || 0);
      if (sort === 'scheduled') {
        const aDate = read(a, 'scheduledAt', 'ScheduledAt');
        const bDate = read(b, 'scheduledAt', 'ScheduledAt');
        return (
          (aDate ? new Date(aDate).getTime() : Number.MAX_SAFE_INTEGER) - (bDate ? new Date(bDate).getTime() : Number.MAX_SAFE_INTEGER)
        );
      }
      return new Date(read(b, 'createdAt', 'CreatedAt') || 0) - new Date(read(a, 'createdAt', 'CreatedAt') || 0);
    });
  }, [announcements, delivery, search, sort, status]);

  const pageCount = Math.ceil(filteredAnnouncements.length / PAGE_SIZE);
  const paginatedAnnouncements = filteredAnnouncements.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);
  const hasViewFilters = search || status !== 'all' || delivery !== 'all' || sort !== 'newest';

  const clearViewFilters = () => {
    setSearch('');
    setStatus('all');
    setDelivery('all');
    setSort('newest');
  };

  const openAnnouncement = (announcement) => navigate(`/landlord/announcements/details?id=${getId(announcement)}`);
  const editAnnouncement = (announcement) => navigate(`/landlord/announcements/edit?id=${getId(announcement)}`);

  const handleDeleteClick = (announcement) => {
    setAnnouncementToDelete(announcement);
    setDeleteDialogOpen(true);
  };

  const handleDeleteConfirm = async () => {
    if (!announcementToDelete) return;
    setDeleting(true);
    try {
      const announcementId = getId(announcementToDelete);
      const result = await announcementAPI.deleteAnnouncement(announcementId);
      if (result.success) {
        setAnnouncements((previous) => previous.filter((announcement) => getId(announcement) !== announcementId));
        setPage(1);
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

  const isDeleteTargetScheduled = announcementToDelete && getStatus(announcementToDelete) === 'scheduled';

  return (
    <Box sx={{ pb: 3 }}>
      <ManagementPageHeader
        title="Announcements"
        description="Plan tenant communications, monitor delivery, and keep every important update in one place."
        actions={
          <Button
            variant="contained"
            color="success"
            startIcon={<PlusOutlined />}
            onClick={() => navigate('/landlord/announcements/selection')}
            sx={managementPageHeaderActionSx}
          >
            New announcement
          </Button>
        }
      />

      <Grid container spacing={1.5} sx={{ mb: 2.5 }}>
        <Grid size={{ xs: 6, lg: 3 }}>
          <SummaryCard
            label="Sent"
            value={metrics.sent}
            helper={`${metrics.delivered} total deliveries`}
            icon={<CheckCircleOutlined />}
            color={theme.palette.success.main}
            active={status === 'sent'}
            onClick={() => setStatus((value) => (value === 'sent' ? 'all' : 'sent'))}
          />
        </Grid>
        <Grid size={{ xs: 6, lg: 3 }}>
          <SummaryCard
            label="Scheduled"
            value={metrics.scheduled}
            helper="Queued to send later"
            icon={<ClockCircleOutlined />}
            color="#0ea5e9"
            active={status === 'scheduled'}
            onClick={() => setStatus((value) => (value === 'scheduled' ? 'all' : 'scheduled'))}
          />
        </Grid>
        <Grid size={{ xs: 6, lg: 3 }}>
          <SummaryCard
            label="Needs attention"
            value={metrics.attention}
            helper="Pending or delivery issues"
            icon={<WarningOutlined />}
            color={theme.palette.warning.main}
            active={status === 'attention'}
            onClick={() => setStatus((value) => (value === 'attention' ? 'all' : 'attention'))}
          />
        </Grid>
        <Grid size={{ xs: 6, lg: 3 }}>
          <SummaryCard
            label="In this view"
            value={metrics.total}
            helper="Within the selected scope"
            icon={<NotificationOutlined />}
            color={theme.palette.primary.main}
            active={status === 'all' && !search && delivery === 'all'}
            onClick={clearViewFilters}
          />
        </Grid>
      </Grid>

      <Box
        sx={{
          bgcolor: 'background.paper',
          border: `1px solid ${alpha(theme.palette.divider, 0.16)}`,
          borderRadius: 3,
          boxShadow: `0 8px 28px ${alpha('#061e35', 0.055)}`,
          overflow: 'hidden'
        }}
      >
        <Box sx={{ p: { xs: 1.5, md: 2 } }}>
          <Stack direction={{ xs: 'column', md: 'row' }} spacing={1.1} alignItems={{ md: 'center' }}>
            <OutlinedInput
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Search title, message, sender, or organization"
              size="small"
              startAdornment={
                <InputAdornment position="start">
                  <SearchOutlined />
                </InputAdornment>
              }
              sx={{ flex: 1, minWidth: { md: 280 }, borderRadius: 1.75 }}
            />
            <Stack direction="row" spacing={1} sx={{ overflowX: 'auto', pb: { xs: 0.25, md: 0 } }}>
              <Select
                size="small"
                value={status}
                onChange={(event) => setStatus(event.target.value)}
                IconComponent={DownOutlined}
                sx={{ minWidth: 134, borderRadius: 1.75 }}
              >
                <MenuItem value="all">All statuses</MenuItem>
                <MenuItem value="sent">Sent</MenuItem>
                <MenuItem value="scheduled">Scheduled</MenuItem>
                <MenuItem value="pending">Pending</MenuItem>
                <MenuItem value="attention">Needs attention</MenuItem>
              </Select>
              <Select
                size="small"
                value={delivery}
                onChange={(event) => setDelivery(event.target.value)}
                IconComponent={DownOutlined}
                sx={{ minWidth: 144, borderRadius: 1.75 }}
              >
                <MenuItem value="all">All channels</MenuItem>
                <MenuItem value="both">Email + in-app</MenuItem>
                <MenuItem value="email">Includes email</MenuItem>
                <MenuItem value="notification">Includes in-app</MenuItem>
              </Select>
              <Select
                size="small"
                value={sort}
                onChange={(event) => setSort(event.target.value)}
                IconComponent={DownOutlined}
                sx={{ minWidth: 160, borderRadius: 1.75 }}
              >
                <MenuItem value="newest">Sort: Newest</MenuItem>
                <MenuItem value="oldest">Sort: Oldest</MenuItem>
                <MenuItem value="scheduled">Sort: Send date</MenuItem>
                <MenuItem value="recipients">Sort: Recipients</MenuItem>
              </Select>
            </Stack>
          </Stack>

          <Divider sx={{ my: 1.5 }} />
          <AnnouncementFilters filters={filters} onFiltersChange={setFilters} />

          <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mt: 1.5 }}>
            <Typography sx={{ fontSize: '0.76rem', color: 'text.secondary' }}>
              {filteredAnnouncements.length} of {announcements.length} announcements
            </Typography>
            {hasViewFilters && (
              <Button size="small" onClick={clearViewFilters} sx={{ textTransform: 'none' }}>
                Reset view
              </Button>
            )}
          </Stack>
        </Box>

        <Divider />

        <Box
          sx={{
            display: { xs: 'none', md: 'grid' },
            gridTemplateColumns: 'minmax(260px, 2fr) minmax(155px, 1fr) minmax(160px, 1fr) minmax(120px, .8fr) 44px',
            gap: 2,
            px: 2,
            py: 1.15,
            bgcolor: alpha(theme.palette.primary.main, 0.025)
          }}
        >
          {['Announcement', 'Audience', 'Timing & channels', 'Delivery', ''].map((label) => (
            <Typography
              key={label || 'actions'}
              sx={{ fontSize: '0.66rem', fontWeight: 750, letterSpacing: 0.65, textTransform: 'uppercase', color: 'text.secondary' }}
            >
              {label}
            </Typography>
          ))}
        </Box>

        {loading ? (
          <Stack alignItems="center" spacing={1} sx={{ py: 7 }}>
            <CircularProgress size={26} />
            <Typography sx={{ fontSize: '0.82rem', color: 'text.secondary' }}>Loading communications…</Typography>
          </Stack>
        ) : error ? (
          <Alert severity="error" sx={{ m: 2 }}>
            {error}
          </Alert>
        ) : announcements.length === 0 ? (
          <Stack alignItems="center" spacing={1.4} sx={{ py: 7, px: 2, textAlign: 'center' }}>
            <Avatar sx={{ width: 58, height: 58, bgcolor: alpha(theme.palette.primary.main, 0.08), color: theme.palette.primary.main }}>
              <NotificationOutlined style={{ fontSize: 25 }} />
            </Avatar>
            <Typography variant="h5" fontWeight={700}>
              No announcements in this scope
            </Typography>
            <Typography sx={{ maxWidth: 420, color: 'text.secondary', fontSize: '0.84rem' }}>
              Create an update for your tenants or expand the date and property filters to find older communications.
            </Typography>
            <Button
              variant="contained"
              color="success"
              startIcon={<PlusOutlined />}
              onClick={() => navigate('/landlord/announcements/selection')}
              sx={{ textTransform: 'none' }}
            >
              Create announcement
            </Button>
          </Stack>
        ) : filteredAnnouncements.length === 0 ? (
          <Stack alignItems="center" spacing={1.5} sx={{ py: 7, px: 2, textAlign: 'center' }}>
            <Typography variant="h6" fontWeight={700}>
              No announcements match this view
            </Typography>
            <Typography sx={{ color: 'text.secondary', fontSize: '0.85rem' }}>
              Try a different search, status, or delivery channel.
            </Typography>
            <Button variant="outlined" onClick={clearViewFilters} sx={{ textTransform: 'none' }}>
              Reset view
            </Button>
          </Stack>
        ) : (
          paginatedAnnouncements.map((announcement) => (
            <AnnouncementRow
              key={getId(announcement)}
              announcement={announcement}
              onOpen={openAnnouncement}
              onEdit={editAnnouncement}
              onDelete={handleDeleteClick}
            />
          ))
        )}

        {pageCount > 1 && (
          <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1.5} alignItems="center" justifyContent="space-between" sx={{ p: 2 }}>
            <Typography sx={{ fontSize: '0.76rem', color: 'text.secondary' }}>
              Showing {(page - 1) * PAGE_SIZE + 1}–{Math.min(page * PAGE_SIZE, filteredAnnouncements.length)} of{' '}
              {filteredAnnouncements.length}
            </Typography>
            <Pagination count={pageCount} page={page} onChange={(_, value) => setPage(value)} color="primary" shape="rounded" />
          </Stack>
        )}
      </Box>

      <Dialog
        open={deleteDialogOpen}
        onClose={() => !deleting && setDeleteDialogOpen(false)}
        PaperProps={{ sx: { borderRadius: 2.5, maxWidth: 460 } }}
      >
        <DialogTitle sx={{ pb: 1, fontWeight: 700 }}>
          {isDeleteTargetScheduled ? 'Cancel scheduled announcement?' : 'Delete announcement?'}
        </DialogTitle>
        <DialogContent>
          <DialogContentText sx={{ fontSize: '0.875rem' }}>
            {isDeleteTargetScheduled
              ? `Cancel “${read(announcementToDelete, 'title', 'Title') || 'this announcement'}”? It will not be sent and this action cannot be undone.`
              : `Delete “${read(announcementToDelete, 'title', 'Title') || 'this announcement'}”? This action cannot be undone.`}
          </DialogContentText>
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2.5 }}>
          <Button
            variant="outlined"
            disabled={deleting}
            onClick={() => {
              setDeleteDialogOpen(false);
              setAnnouncementToDelete(null);
            }}
          >
            Keep announcement
          </Button>
          <Button color="error" variant="contained" disabled={deleting} onClick={handleDeleteConfirm}>
            {deleting ? 'Processing…' : isDeleteTargetScheduled ? 'Cancel announcement' : 'Delete'}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}
