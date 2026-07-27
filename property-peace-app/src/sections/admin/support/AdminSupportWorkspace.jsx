import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link as RouterLink } from 'react-router-dom';
import {
  Alert,
  Avatar,
  Box,
  Button,
  Chip,
  CircularProgress,
  Divider,
  IconButton,
  InputAdornment,
  Paper,
  Stack,
  Tab,
  Tabs,
  TextField,
  Tooltip,
  Typography,
  alpha,
  useMediaQuery,
  useTheme
} from '@mui/material';
import {
  ArrowLeftOutlined,
  BulbOutlined,
  CheckCircleOutlined,
  ClockCircleOutlined,
  CustomerServiceOutlined,
  MailOutlined,
  ReloadOutlined,
  SearchOutlined,
  StarFilled,
  StarOutlined
} from '@ant-design/icons';
import axiosServices from 'utils/axios';
import { openSnackbar } from 'api/snackbar';
import { formatRelativeTime } from 'utils/formatters';

const FILTERS = [
  { value: 'attention', label: 'Needs attention' },
  { value: 'all', label: 'All requests' },
  { value: 'support', label: 'Support' },
  { value: 'feedback', label: 'Feedback' },
  { value: 'priority', label: 'Priority' },
  { value: 'resolved', label: 'Resolved' }
];

const getRequestType = (type) => {
  if (type === 0 || type === '0') return 'support';
  if (type === 1 || type === '1') return 'feedback';
  const normalizedType = typeof type === 'string' ? type.toLowerCase() : '';
  return normalizedType === 'feedback' ? 'feedback' : 'support';
};

const getAgeInDays = (value) => {
  const createdAt = new Date(value).getTime();
  if (!Number.isFinite(createdAt)) return 0;
  return Math.max(0, Math.floor((Date.now() - createdAt) / 86400000));
};

const getInitials = (item) => {
  const source = item.userName || item.userEmail || 'Unknown';
  return source
    .split(/\s|@/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part.charAt(0).toUpperCase())
    .join('');
};

function SummaryCard({ label, value, helper, tone = 'primary' }) {
  return (
    <Paper
      variant="outlined"
      sx={(theme) => ({
        minWidth: 0,
        p: 2,
        borderRadius: 2,
        borderColor: alpha(theme.palette[tone].main, 0.2),
        bgcolor: alpha(theme.palette[tone].main, 0.045)
      })}
    >
      <Typography variant="h3" sx={{ fontWeight: 750, lineHeight: 1, color: `${tone}.main` }}>
        {value}
      </Typography>
      <Typography variant="subtitle2" sx={{ mt: 1 }}>
        {label}
      </Typography>
      <Typography variant="caption" color="text.secondary">
        {helper}
      </Typography>
    </Paper>
  );
}

function RequestRow({ item, selected, onSelect, onToggleFavorite }) {
  const requestType = getRequestType(item.type);
  const ageInDays = getAgeInDays(item.createdAt);
  const isStale = !item.isResolved && ageInDays >= 7;

  return (
    <Box
      component="button"
      type="button"
      onClick={() => onSelect(item)}
      sx={(theme) => ({
        width: '100%',
        border: 0,
        borderBottom: `1px solid ${theme.palette.divider}`,
        borderLeft: '3px solid',
        borderLeftColor: selected ? 'primary.main' : 'transparent',
        bgcolor: selected ? alpha(theme.palette.primary.main, 0.06) : 'transparent',
        color: 'inherit',
        p: 2,
        textAlign: 'left',
        cursor: 'pointer',
        '&:hover': { bgcolor: selected ? alpha(theme.palette.primary.main, 0.08) : 'action.hover' },
        '&:focus-visible': { outline: `2px solid ${theme.palette.primary.main}`, outlineOffset: -2 }
      })}
    >
      <Stack direction="row" spacing={1.5} alignItems="flex-start">
        <Avatar
          sx={(theme) => ({
            width: 40,
            height: 40,
            bgcolor: alpha(theme.palette[requestType === 'support' ? 'primary' : 'info'].main, 0.12),
            color: `${requestType === 'support' ? 'primary' : 'info'}.main`,
            fontSize: 14,
            fontWeight: 750
          })}
        >
          {getInitials(item)}
        </Avatar>
        <Box sx={{ minWidth: 0, flex: 1 }}>
          <Stack direction="row" spacing={1} alignItems="center">
            <Typography variant="subtitle2" noWrap sx={{ flex: 1, fontWeight: item.isResolved ? 600 : 750 }}>
              {item.subject || 'Untitled request'}
            </Typography>
            <Typography variant="caption" color="text.secondary" sx={{ flexShrink: 0 }}>
              {formatRelativeTime(item.createdAt)}
            </Typography>
          </Stack>
          <Typography variant="body2" color="text.secondary" noWrap sx={{ mt: 0.35 }}>
            {item.message || 'No request details provided.'}
          </Typography>
          <Stack direction="row" spacing={0.75} alignItems="center" sx={{ mt: 1 }}>
            <Chip
              size="small"
              label={requestType === 'support' ? 'Support' : 'Feedback'}
              color={requestType === 'support' ? 'primary' : 'info'}
              variant="outlined"
              sx={{ height: 22, borderRadius: 1 }}
            />
            <Chip
              size="small"
              label={item.isResolved ? 'Resolved' : isStale ? `${ageInDays}d open` : 'Open'}
              color={item.isResolved ? 'success' : isStale ? 'error' : 'warning'}
              sx={{ height: 22, borderRadius: 1 }}
            />
            <Typography variant="caption" color="text.secondary" noWrap sx={{ ml: 0.5, flex: 1 }}>
              {item.userName || item.userEmail || 'Unknown requester'}
            </Typography>
            <Tooltip title={item.isFavorite ? 'Remove priority flag' : 'Flag as priority'}>
              <IconButton
                size="small"
                aria-label={item.isFavorite ? 'Remove priority flag' : 'Flag as priority'}
                onClick={(event) => {
                  event.stopPropagation();
                  onToggleFavorite(item);
                }}
                sx={{ p: 0.5 }}
              >
                {item.isFavorite ? <StarFilled style={{ color: '#f5a623' }} /> : <StarOutlined />}
              </IconButton>
            </Tooltip>
          </Stack>
        </Box>
      </Stack>
    </Box>
  );
}

function RequestDetail({ item, onBack, onToggleFavorite, onToggleResolved, updating }) {
  const theme = useTheme();
  const requestType = getRequestType(item.type);
  const ageInDays = getAgeInDays(item.createdAt);
  const emailAddress = item.userEmail || '';

  return (
    <Stack sx={{ height: '100%', minHeight: 0 }}>
      <Box sx={{ p: { xs: 2, md: 2.5 }, borderBottom: 1, borderColor: 'divider' }}>
        <Stack direction="row" spacing={1.5} alignItems="flex-start">
          {onBack && (
            <IconButton onClick={onBack} aria-label="Back to support queue" sx={{ mt: -0.5 }}>
              <ArrowLeftOutlined />
            </IconButton>
          )}
          <Box sx={{ minWidth: 0, flex: 1 }}>
            <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1} justifyContent="space-between" alignItems={{ sm: 'center' }}>
              <Typography component="h2" variant="h5" sx={{ fontWeight: 750 }}>
                {item.subject || 'Untitled request'}
              </Typography>
              <Stack direction="row" spacing={0.75}>
                <Chip
                  size="small"
                  label={requestType === 'support' ? 'Support request' : 'Product feedback'}
                  color={requestType === 'support' ? 'primary' : 'info'}
                  variant="outlined"
                />
                <Chip size="small" label={item.isResolved ? 'Resolved' : 'Open'} color={item.isResolved ? 'success' : 'warning'} />
              </Stack>
            </Stack>
            <Typography variant="body2" color="text.secondary" sx={{ mt: 0.75 }}>
              Submitted by {item.userName || 'Unknown requester'} {emailAddress ? `· ${emailAddress}` : ''}
            </Typography>
          </Box>
        </Stack>
      </Box>

      <Box sx={{ flex: 1, overflow: 'auto', p: { xs: 2, md: 3 }, bgcolor: 'grey.50' }}>
        <Stack spacing={2.5}>
          <Paper variant="outlined" sx={{ p: { xs: 2, md: 3 }, borderRadius: 2, bgcolor: 'background.paper' }}>
            <Typography variant="overline" color="text.secondary" sx={{ fontWeight: 750, letterSpacing: 1 }}>
              Request details
            </Typography>
            <Typography variant="body1" sx={{ mt: 1, whiteSpace: 'pre-wrap', lineHeight: 1.75 }}>
              {item.message || 'No request details were provided.'}
            </Typography>
          </Paper>

          <Paper variant="outlined" sx={{ p: 2.5, borderRadius: 2, bgcolor: 'background.paper' }}>
            <Typography variant="subtitle2" sx={{ mb: 2 }}>
              Request context
            </Typography>
            <Stack direction={{ xs: 'column', sm: 'row' }} spacing={{ xs: 1.5, sm: 4 }}>
              <Box>
                <Typography variant="caption" color="text.secondary">Submitted</Typography>
                <Typography variant="body2" sx={{ mt: 0.25 }}>{formatRelativeTime(item.createdAt)}</Typography>
              </Box>
              <Box>
                <Typography variant="caption" color="text.secondary">Queue age</Typography>
                <Typography variant="body2" sx={{ mt: 0.25 }}>{item.isResolved ? 'Closed' : ageInDays === 0 ? 'New today' : `${ageInDays} day${ageInDays === 1 ? '' : 's'} open`}</Typography>
              </Box>
              <Box>
                <Typography variant="caption" color="text.secondary">Priority</Typography>
                <Typography variant="body2" sx={{ mt: 0.25 }}>{item.isFavorite ? 'Flagged for follow-up' : 'Normal'}</Typography>
              </Box>
            </Stack>
          </Paper>

          {!item.isResolved && ageInDays >= 7 && (
            <Alert severity="warning" icon={<ClockCircleOutlined />}>
              This request has been open for {ageInDays} days. Follow up with the requester or resolve it if the issue is complete.
            </Alert>
          )}
        </Stack>
      </Box>

      <Box sx={{ p: 2, borderTop: 1, borderColor: 'divider', bgcolor: 'background.paper' }}>
        <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1} justifyContent="space-between">
          <Button
            variant="text"
            startIcon={item.isFavorite ? <StarFilled /> : <StarOutlined />}
            color={item.isFavorite ? 'warning' : 'inherit'}
            onClick={() => onToggleFavorite(item)}
            disabled={updating}
          >
            {item.isFavorite ? 'Priority flagged' : 'Flag for follow-up'}
          </Button>
          <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1}>
            {item.userId && (
              <Button component={RouterLink} to={`/admin/users/${item.userId}`} variant="text">
                View account
              </Button>
            )}
            {emailAddress && (
              <Button
                component="a"
                href={`mailto:${emailAddress}?subject=${encodeURIComponent(`Re: ${item.subject || 'Your Property Peace request'}`)}`}
                variant="outlined"
                startIcon={<MailOutlined />}
              >
                Contact requester
              </Button>
            )}
            <Button
              variant={item.isResolved ? 'outlined' : 'contained'}
              color={item.isResolved ? 'inherit' : 'success'}
              startIcon={updating ? <CircularProgress size={16} color="inherit" /> : <CheckCircleOutlined />}
              onClick={() => onToggleResolved(item)}
              disabled={updating}
            >
              {item.isResolved ? 'Reopen request' : 'Mark resolved'}
            </Button>
          </Stack>
        </Stack>
      </Box>
    </Stack>
  );
}

export default function AdminSupportWorkspace({ onCountChange }) {
  const theme = useTheme();
  const isNarrow = useMediaQuery(theme.breakpoints.down('lg'));
  const [items, setItems] = useState([]);
  const [selectedItemId, setSelectedItemId] = useState(null);
  const [filter, setFilter] = useState('attention');
  const [searchQuery, setSearchQuery] = useState('');
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [updatingId, setUpdatingId] = useState(null);
  const [error, setError] = useState('');

  const loadRequests = useCallback(async (background = false) => {
    background ? setRefreshing(true) : setLoading(true);
    setError('');
    try {
      const pageSize = 100;
      const response = await axiosServices.get('/api/admin/support-and-feedback', { params: { page: 1, pageSize } });
      const firstPage = response.data?.data || response.data;
      if (!Array.isArray(firstPage)) throw new Error('Unexpected support response');

      const totalPages = response.data?.pagination?.totalPages || 1;
      const remainingResponses = totalPages > 1
        ? await Promise.all(
          Array.from({ length: totalPages - 1 }, (_item, index) =>
            axiosServices.get('/api/admin/support-and-feedback', { params: { page: index + 2, pageSize } })
          )
        )
        : [];
      const requestItems = remainingResponses.reduce(
        (allRequests, pageResponse) => allRequests.concat(pageResponse.data?.data || []),
        firstPage
      );

      setItems(requestItems);
      onCountChange?.(response.data?.pagination?.totalCount ?? requestItems.length);
    } catch (requestError) {
      setError(requestError.response?.data?.message || 'Support requests could not be loaded.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [onCountChange]);

  useEffect(() => {
    loadRequests();
  }, [loadRequests]);

  const counts = useMemo(() => ({
    open: items.filter((item) => !item.isResolved).length,
    stale: items.filter((item) => !item.isResolved && getAgeInDays(item.createdAt) >= 7).length,
    priority: items.filter((item) => !item.isResolved && item.isFavorite).length,
    feedback: items.filter((item) => getRequestType(item.type) === 'feedback').length,
    resolved: items.filter((item) => item.isResolved).length
  }), [items]);

  const filteredItems = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();
    return items
      .filter((item) => {
        const requestType = getRequestType(item.type);
        const matchesFilter =
          filter === 'all' ||
          (filter === 'attention' && !item.isResolved) ||
          (filter === 'support' && requestType === 'support') ||
          (filter === 'feedback' && requestType === 'feedback') ||
          (filter === 'priority' && item.isFavorite && !item.isResolved) ||
          (filter === 'resolved' && item.isResolved);
        if (!matchesFilter) return false;
        if (!query) return true;
        return [item.subject, item.message, item.userName, item.userEmail]
          .some((value) => value?.toLowerCase().includes(query));
      })
      .sort((a, b) => {
        if (a.isResolved !== b.isResolved) return a.isResolved ? 1 : -1;
        if (a.isFavorite !== b.isFavorite) return a.isFavorite ? -1 : 1;
        return new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
      });
  }, [filter, items, searchQuery]);

  const selectedItem = items.find((item) => item.id === selectedItemId) || null;

  const updateItem = async (item, action) => {
    setUpdatingId(item.id);
    try {
      const isFavoriteAction = action === 'favorite';
      const updatedValue = isFavoriteAction ? !item.isFavorite : !item.isResolved;
      if (isFavoriteAction) {
        await axiosServices.put(`/api/admin/support-and-feedback/${item.id}/favorite`, { IsFavorite: updatedValue });
      } else {
        await axiosServices.put(`/api/admin/support-and-feedback/${item.id}/resolve`, updatedValue);
      }
      setItems((currentItems) => currentItems.map((currentItem) => (
        currentItem.id === item.id
          ? { ...currentItem, [isFavoriteAction ? 'isFavorite' : 'isResolved']: updatedValue }
          : currentItem
      )));
      openSnackbar({
        open: true,
        message: isFavoriteAction
          ? updatedValue ? 'Request flagged for follow-up' : 'Priority flag removed'
          : updatedValue ? 'Request marked as resolved' : 'Request reopened',
        variant: 'alert',
        alert: { color: 'success' }
      });
    } catch (requestError) {
      openSnackbar({
        open: true,
        message: requestError.response?.data?.message || 'The request could not be updated.',
        variant: 'alert',
        alert: { color: 'error' }
      });
    } finally {
      setUpdatingId(null);
    }
  };

  if (loading) {
    return <Box sx={{ minHeight: 560, display: 'grid', placeItems: 'center' }}><CircularProgress /></Box>;
  }

  return (
    <Stack spacing={2.5}>
      <Paper
        elevation={0}
        sx={(currentTheme) => ({
          p: { xs: 2.5, md: 3 },
          borderRadius: 2,
          color: '#fff',
          background: 'linear-gradient(125deg, #061e35 0%, #0b3f50 100%)',
          position: 'relative',
          overflow: 'hidden',
          '&::after': {
            content: '""',
            position: 'absolute',
            width: 240,
            height: 240,
            borderRadius: '50%',
            right: -70,
            top: -130,
            bgcolor: alpha(currentTheme.palette.success.main, 0.18)
          }
        })}
      >
        <Stack direction={{ xs: 'column', md: 'row' }} spacing={2} justifyContent="space-between" alignItems={{ md: 'flex-end' }} sx={{ position: 'relative', zIndex: 1 }}>
          <Box>
            <Typography variant="overline" sx={{ color: '#7ee2aa', fontWeight: 750, letterSpacing: 1.2 }}>
              Customer operations
            </Typography>
            <Typography component="h1" variant="h3" sx={{ color: '#fff', fontWeight: 750, mt: 0.25 }}>
              Support desk
            </Typography>
            <Typography sx={{ color: 'rgba(255,255,255,0.72)', mt: 0.75, maxWidth: 620 }}>
              Triage support requests, capture product feedback, and keep follow-ups from falling through the cracks.
            </Typography>
          </Box>
          <Button
            color="inherit"
            variant="outlined"
            startIcon={refreshing ? <CircularProgress size={16} color="inherit" /> : <ReloadOutlined />}
            onClick={() => loadRequests(true)}
            disabled={refreshing}
            sx={{ borderColor: 'rgba(255,255,255,0.4)', alignSelf: { xs: 'flex-start', md: 'auto' } }}
          >
            Refresh queue
          </Button>
        </Stack>
      </Paper>

      {error && <Alert severity="error" action={<Button color="inherit" size="small" onClick={() => loadRequests()}>Retry</Button>}>{error}</Alert>}

      <Box sx={{ display: 'grid', gridTemplateColumns: { xs: 'repeat(2, minmax(0, 1fr))', lg: 'repeat(4, minmax(0, 1fr))' }, gap: 1.5 }}>
        <SummaryCard label="Open requests" value={counts.open} helper="Awaiting action" tone={counts.open ? 'warning' : 'success'} />
        <SummaryCard label="Aging requests" value={counts.stale} helper="Open 7+ days" tone={counts.stale ? 'error' : 'success'} />
        <SummaryCard label="Priority follow-ups" value={counts.priority} helper="Flagged and open" tone={counts.priority ? 'info' : 'success'} />
        <SummaryCard label="Product feedback" value={counts.feedback} helper={`${counts.resolved} total resolved`} tone="primary" />
      </Box>

      <Paper variant="outlined" sx={{ borderRadius: 2, overflow: 'hidden' }}>
        <Box sx={{ px: { xs: 1.5, md: 2 }, pt: 1.5, borderBottom: 1, borderColor: 'divider' }}>
          <Stack direction={{ xs: 'column', md: 'row' }} spacing={1.5} alignItems={{ md: 'center' }}>
            <Tabs
              value={filter}
              onChange={(_event, value) => {
                setFilter(value);
                if (isNarrow) setSelectedItemId(null);
              }}
              variant="scrollable"
              scrollButtons="auto"
              sx={{ flex: 1, minWidth: 0 }}
            >
              {FILTERS.map((item) => (
                <Tab key={item.value} value={item.value} label={item.label} sx={{ minHeight: 48 }} />
              ))}
            </Tabs>
            <TextField
              size="small"
              value={searchQuery}
              onChange={(event) => setSearchQuery(event.target.value)}
              placeholder="Search requests or people"
              sx={{ width: { xs: '100%', md: 280 }, pb: { xs: 1.5, md: 0 } }}
              InputProps={{ startAdornment: <InputAdornment position="start"><SearchOutlined /></InputAdornment> }}
            />
          </Stack>
        </Box>

        <Box sx={{ display: 'flex', minHeight: 600, height: { xs: 'calc(100vh - 250px)', lg: 650 } }}>
          {(!isNarrow || !selectedItem) && (
            <Box sx={{ width: { xs: '100%', lg: 430 }, flexShrink: 0, borderRight: { lg: 1 }, borderColor: 'divider', overflow: 'auto' }}>
              <Box sx={{ px: 2, py: 1.5, bgcolor: 'grey.50', borderBottom: 1, borderColor: 'divider' }}>
                <Stack direction="row" justifyContent="space-between" alignItems="center">
                  <Typography variant="subtitle2">{FILTERS.find((item) => item.value === filter)?.label}</Typography>
                  <Typography variant="caption" color="text.secondary">{filteredItems.length} request{filteredItems.length === 1 ? '' : 's'}</Typography>
                </Stack>
              </Box>
              {filteredItems.length ? filteredItems.map((item) => (
                <RequestRow
                  key={item.id}
                  item={item}
                  selected={selectedItem?.id === item.id}
                  onSelect={(request) => setSelectedItemId(request.id)}
                  onToggleFavorite={(request) => updateItem(request, 'favorite')}
                />
              )) : (
                <Stack alignItems="center" justifyContent="center" sx={{ minHeight: 360, px: 3, textAlign: 'center' }}>
                  {filter === 'feedback' ? <BulbOutlined style={{ fontSize: 34, color: theme.palette.text.disabled }} /> : <CustomerServiceOutlined style={{ fontSize: 34, color: theme.palette.text.disabled }} />}
                  <Typography variant="h6" sx={{ mt: 1.5 }}>Queue is clear</Typography>
                  <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
                    {searchQuery ? 'No requests match your search.' : 'There are no requests in this view.'}
                  </Typography>
                </Stack>
              )}
            </Box>
          )}

          {selectedItem ? (
            <Box sx={{ flex: 1, minWidth: 0 }}>
              <RequestDetail
                item={selectedItem}
                onBack={isNarrow ? () => setSelectedItemId(null) : null}
                onToggleFavorite={(request) => updateItem(request, 'favorite')}
                onToggleResolved={(request) => updateItem(request, 'resolved')}
                updating={updatingId === selectedItem.id}
              />
            </Box>
          ) : !isNarrow && (
            <Stack flex={1} alignItems="center" justifyContent="center" sx={{ p: 4, textAlign: 'center', bgcolor: 'grey.50' }}>
              <Box sx={(currentTheme) => ({ width: 64, height: 64, borderRadius: '50%', display: 'grid', placeItems: 'center', color: 'primary.main', bgcolor: alpha(currentTheme.palette.primary.main, 0.08) })}>
                <CustomerServiceOutlined style={{ fontSize: 28 }} />
              </Box>
              <Typography variant="h5" sx={{ mt: 2 }}>Select a request</Typography>
              <Typography variant="body2" color="text.secondary" sx={{ mt: 0.75, maxWidth: 360 }}>
                Review the full message, contact the requester, flag follow-up, or close the request from one place.
              </Typography>
            </Stack>
          )}
        </Box>
      </Paper>
    </Stack>
  );
}
