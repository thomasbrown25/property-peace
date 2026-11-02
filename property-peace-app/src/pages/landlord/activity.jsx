import { useState, useMemo, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Box,
  Typography,
  Button,
  Stack,
  Avatar,
  Divider,
  Paper,
  alpha,
  FormControl,
  Select,
  MenuItem,
  InputLabel,
  TextField,
  Chip,
  Pagination,
  ToggleButtonGroup,
  ToggleButton,
  Collapse,
  useTheme
} from '@mui/material';
import MainCard from 'components/MainCard';
import CircularLoader from 'components/CircularLoader';
import PageBreadcrumbs from 'components/breadcrumbs/PageBreadcrumbs';
import useFetchActivities from 'hooks/useFetchActivities';
import PropertySelect from 'components/PropertySelect';
import { useDispatch, useSelector } from 'react-redux';
import { selectProperty } from 'store/property/property.selector';
import { setProperty } from 'store/property/property.action';
import { formatDateAndTime } from 'utils/formatters';

// Icons
import DollarOutlined from '@ant-design/icons/DollarOutlined';
import BellOutlined from '@ant-design/icons/BellOutlined';
import MessageOutlined from '@ant-design/icons/MessageOutlined';
import ToolOutlined from '@ant-design/icons/ToolOutlined';
import CheckCircleOutlined from '@ant-design/icons/CheckCircleOutlined';
import FileTextOutlined from '@ant-design/icons/FileTextOutlined';
import HomeFilled from '@ant-design/icons/HomeFilled';
import UserOutlined from '@ant-design/icons/UserOutlined';
import DollarCircleOutlined from '@ant-design/icons/DollarCircleOutlined';
import FileOutlined from '@ant-design/icons/FileOutlined';
import FormOutlined from '@ant-design/icons/FormOutlined';
import SettingOutlined from '@ant-design/icons/SettingOutlined';
import HistoryOutlined from '@ant-design/icons/HistoryOutlined';
import CloseOutlined from '@ant-design/icons/CloseOutlined';

// ==============================|| RECENT ACTIVITY PAGE ||============================== //

const getActivityIcon = (iconType) => {
  const iconMap = {
    DollarOutlined,
    ToolOutlined,
    CheckCircleOutlined,
    FileTextOutlined,
    MessageOutlined,
    BellOutlined,
    HomeFilled,
    UserOutlined,
    DollarCircleOutlined,
    FileOutlined,
    FormOutlined,
    SettingOutlined
  };
  return iconMap[iconType] || BellOutlined;
};

const getActivityColor = (colorName) => {
  const valid = ['primary', 'warning', 'success', 'info', 'secondary', 'error'];
  return valid.includes(colorName) ? colorName : 'default';
};

const ACTIVITY_TYPES = [
  { value: 'Payment', label: 'Payment' },
  { value: 'Maintenance', label: 'Maintenance' },
  { value: 'Lease', label: 'Lease' },
  { value: 'Property', label: 'Property' },
  { value: 'Tenant', label: 'Tenant' },
  { value: 'Expense', label: 'Expense' },
  { value: 'File', label: 'File' },
  { value: 'Message', label: 'Message' },
  { value: 'Application', label: 'Application' },
  { value: 'System', label: 'System' },
  { value: 'Notification', label: 'Notification' }
];

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
  const d = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  if (d >= today) return 'Today';
  if (d >= yesterday) return 'Yesterday';
  if (d >= weekAgo) return 'This Week';
  return 'Older';
};

const DATE_GROUP_ORDER = ['Today', 'Yesterday', 'This Week', 'Older'];

const getInitials = (name) => {
  if (!name || name === 'System') return null;
  return name.split(' ').map((n) => n[0]).slice(0, 2).join('').toUpperCase();
};

export default function Activity() {
  const navigate = useNavigate();
  const dispatch = useDispatch();
  const theme = useTheme();

  const [filterType, setFilterType] = useState('all');
  const [timespan, setTimespan] = useState('all');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [page, setPage] = useState(1);
  const pageSize = 50;

  const selectedProperty = useSelector(selectProperty);

  useEffect(() => {
    dispatch(setProperty(null));
  }, [dispatch]);

  // Derive date range from timespan preset
  const resolvedDates = useMemo(() => {
    const now = new Date();
    if (timespan === 'today') {
      return { start: new Date(now.getFullYear(), now.getMonth(), now.getDate()).toISOString().split('T')[0], end: null };
    }
    if (timespan === 'week') {
      const d = new Date(now);
      d.setDate(d.getDate() - 7);
      return { start: d.toISOString().split('T')[0], end: null };
    }
    if (timespan === 'month') {
      return { start: new Date(now.getFullYear(), now.getMonth(), 1).toISOString().split('T')[0], end: null };
    }
    if (timespan === 'custom') {
      return { start: dateFrom || undefined, end: dateTo || undefined };
    }
    return { start: undefined, end: undefined };
  }, [timespan, dateFrom, dateTo]);

  const filters = useMemo(() => ({
    startDate: resolvedDates.start,
    endDate: resolvedDates.end,
    activityTypes: filterType !== 'all' ? [filterType] : undefined,
    propertyId: selectedProperty?.id || undefined,
    page,
    pageSize
  }), [resolvedDates, filterType, selectedProperty, page, pageSize]);

  const { activities, totalCount, activitiesLoading, activitiesError } = useFetchActivities(filters);

  const groupedActivities = useMemo(() => {
    const groups = {};
    (activities || []).forEach((a) => {
      const g = getDateGroup(a.createdAt);
      if (!groups[g]) groups[g] = [];
      groups[g].push(a);
    });
    return DATE_GROUP_ORDER.filter((g) => groups[g]).map((g) => ({ label: g, items: groups[g] }));
  }, [activities]);

  const totalPages = Math.ceil(totalCount / pageSize);
  const hasActiveFilters = filterType !== 'all' || timespan !== 'all';

  const handleActivityClick = (activity) => {
    switch (activity.activityType) {
      case 'Payment':
        navigate('/landlord/finances?tab=payments');
        break;
      case 'Maintenance':
        if (activity.relatedId) navigate(`/landlord/maintenance/${activity.relatedId}`);
        break;
      case 'Lease':
        if (activity.relatedId) navigate(`/landlord/leases/${activity.relatedId}`);
        break;
      case 'Property':
        if (activity.relatedId) navigate(`/landlord/property/${activity.relatedId}`);
        break;
      case 'Tenant':
        if (activity.relatedId) navigate(`/landlord/tenants/${activity.relatedId}`);
        break;
      case 'Message':
        navigate(activity.conversationId ? `/landlord/messages?conversationId=${activity.conversationId}` : '/landlord/messages');
        break;
      default:
        break;
    }
  };

  if (activitiesLoading && (!activities || activities.length === 0)) {
    return (
      <Box sx={{ p: 5 }}>
        <Stack direction="row" justifyContent="center"><CircularLoader /></Stack>
      </Box>
    );
  }

  if (activitiesError && (!activities || activities.length === 0)) {
    return (
      <Box>
        <ActivityHeader theme={theme} />
        <MainCard>
          <Box sx={{ p: 3, textAlign: 'center' }}>
            <Typography variant="h6" color="error">Error loading activities</Typography>
            <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
              {activitiesError.message || 'Please try again later'}
            </Typography>
          </Box>
        </MainCard>
      </Box>
    );
  }

  return (
    <Box>
      <ActivityHeader theme={theme} />

      {/* Filter bar */}
      <Paper
        variant="outlined"
        sx={{ mb: 2.5, p: 1.5, bgcolor: alpha(theme.palette.background.paper, 0.7) }}
      >
        <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1.5} alignItems="center" flexWrap="wrap">
          <Box sx={{ flex: 1.4, minWidth: 0 }}>
            <PropertySelect disableAllOption={false} />
          </Box>

          <FormControl size="small" sx={{ minWidth: 160 }}>
            <InputLabel>Type</InputLabel>
            <Select value={filterType} onChange={(e) => { setFilterType(e.target.value); setPage(1); }} label="Type">
              <MenuItem value="all">All Types</MenuItem>
              {ACTIVITY_TYPES.map((t) => (
                <MenuItem key={t.value} value={t.value}>{t.label}</MenuItem>
              ))}
            </Select>
          </FormControl>

          <ToggleButtonGroup
            value={timespan}
            exclusive
            onChange={(_, v) => { if (v) { setTimespan(v); setPage(1); } }}
            size="small"
            sx={{ '& .MuiToggleButton-root': { textTransform: 'none', px: 1.5, py: 0.6, fontSize: 13 } }}
          >
            <ToggleButton value="all">All</ToggleButton>
            <ToggleButton value="today">Today</ToggleButton>
            <ToggleButton value="week">7 days</ToggleButton>
            <ToggleButton value="month">30 days</ToggleButton>
            <ToggleButton value="custom">Custom</ToggleButton>
          </ToggleButtonGroup>

          {hasActiveFilters && (
            <Button
              size="small"
              variant="text"
              startIcon={<CloseOutlined style={{ fontSize: 12 }} />}
              onClick={() => { setFilterType('all'); setTimespan('all'); setDateFrom(''); setDateTo(''); setPage(1); }}
              sx={{ textTransform: 'none', color: 'text.secondary', whiteSpace: 'nowrap' }}
            >
              Clear
            </Button>
          )}
        </Stack>

        {/* Custom date range */}
        <Collapse in={timespan === 'custom'}>
          <Stack direction="row" spacing={1.5} sx={{ mt: 1.5 }}>
            <TextField
              size="small"
              type="date"
              label="From"
              value={dateFrom}
              onChange={(e) => { setDateFrom(e.target.value); setPage(1); }}
              InputLabelProps={{ shrink: true }}
              sx={{ minWidth: 148 }}
            />
            <TextField
              size="small"
              type="date"
              label="To"
              value={dateTo}
              onChange={(e) => { setDateTo(e.target.value); setPage(1); }}
              InputLabelProps={{ shrink: true }}
              sx={{ minWidth: 148 }}
            />
          </Stack>
        </Collapse>
      </Paper>

      {/* Activity list */}
      <MainCard sx={{ bgcolor: alpha(theme.palette.background.paper, 0.6) }} contentSX={{ p: 0 }}>
        {(!activities || activities.length === 0) ? (
          <Box sx={{ py: 8, textAlign: 'center' }}>
            <HistoryOutlined style={{ fontSize: 52, color: alpha(theme.palette.text.primary, 0.12) }} />
            <Typography variant="h6" color="text.secondary" sx={{ mt: 2 }}>No activity found</Typography>
            <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
              Try adjusting your filters to see more results.
            </Typography>
          </Box>
        ) : (
          <>
            {/* Total count */}
            {totalCount > 0 && (
              <Box sx={{ px: 2.5, pt: 2, pb: 1 }}>
                <Typography variant="caption" color="text.secondary">
                  {totalCount.toLocaleString()} {totalCount === 1 ? 'event' : 'events'}
                  {hasActiveFilters ? ' matching filters' : ' total'}
                </Typography>
              </Box>
            )}

            {groupedActivities.map((group, gIdx) => (
              <Box key={group.label}>
                {/* Date group label */}
                <Box sx={{ px: 2.5, pt: gIdx === 0 ? 0.5 : 2, pb: 0.75 }}>
                  <Typography
                    variant="caption"
                    fontWeight={700}
                    color="text.secondary"
                    sx={{ textTransform: 'uppercase', letterSpacing: 0.6, fontSize: 11 }}
                  >
                    {group.label}
                  </Typography>
                </Box>

                {group.items.map((activity, idx) => {
                  const Icon = getActivityIcon(activity.iconType || 'BellOutlined');
                  const color = getActivityColor(activity.color || 'default');
                  const isSystem = !activity.performedByName || activity.performedByName === 'System';
                  const initials = getInitials(activity.performedByName);
                  const isClickable = ['Payment', 'Maintenance', 'Lease', 'Property', 'Tenant', 'Message'].includes(activity.activityType);

                  return (
                    <Box key={`${activity.activityType}-${activity.id}-${idx}`}>
                      <Box
                        onClick={isClickable ? () => handleActivityClick(activity) : undefined}
                        sx={{
                          display: 'flex',
                          alignItems: 'flex-start',
                          px: 2.5,
                          py: 1.5,
                          cursor: isClickable ? 'pointer' : 'default',
                          transition: 'background-color 0.15s',
                          '&:hover': isClickable ? {
                            bgcolor: alpha(theme.palette.primary.main, 0.04)
                          } : {}
                        }}
                      >
                        {/* Icon */}
                        <Avatar
                          sx={{
                            width: 38,
                            height: 38,
                            mr: 2,
                            flexShrink: 0,
                            bgcolor: color !== 'default' ? `${color}.lighter` : alpha(theme.palette.text.primary, 0.08),
                            color: color !== 'default' ? `${color}.main` : 'text.secondary'
                          }}
                        >
                          <Icon style={{ fontSize: 17 }} />
                        </Avatar>

                        {/* Content */}
                        <Box sx={{ flex: 1, minWidth: 0 }}>
                          <Stack direction="row" alignItems="center" spacing={1} flexWrap="wrap" sx={{ mb: 0.25 }}>
                            <Typography variant="body2" fontWeight={600}>
                              {activity.title}
                            </Typography>
                            {activity.activityType && (
                              <Chip
                                label={activity.activityType}
                                size="small"
                                sx={{
                                  height: 18,
                                  fontSize: 10,
                                  fontWeight: 600,
                                  bgcolor: color !== 'default'
                                    ? alpha(theme.palette[color]?.main || theme.palette.primary.main, 0.1)
                                    : alpha(theme.palette.text.primary, 0.07),
                                  color: color !== 'default' ? `${color}.main` : 'text.secondary',
                                  border: 'none'
                                }}
                              />
                            )}
                          </Stack>
                          <Typography
                            variant="body2"
                            color="text.secondary"
                            sx={{
                              display: '-webkit-box',
                              WebkitLineClamp: 2,
                              WebkitBoxOrient: 'vertical',
                              overflow: 'hidden',
                              lineHeight: 1.5
                            }}
                          >
                            {activity.message}
                          </Typography>
                          <Stack direction="row" alignItems="center" spacing={1} sx={{ mt: 0.5 }}>
                            <Typography variant="caption" color="text.disabled">
                              {relativeTime(activity.createdAt)}
                            </Typography>
                            {!isSystem && activity.performedByName && (
                              <>
                                <Typography variant="caption" color="text.disabled">·</Typography>
                                <Stack direction="row" alignItems="center" spacing={0.5}>
                                  <Avatar sx={{ width: 16, height: 16, fontSize: 9, bgcolor: 'primary.lighter', color: 'primary.main' }}>
                                    {initials}
                                  </Avatar>
                                  <Typography variant="caption" color="text.secondary">
                                    {activity.performedByName}
                                  </Typography>
                                </Stack>
                              </>
                            )}
                          </Stack>
                        </Box>
                      </Box>
                      {idx < group.items.length - 1 && <Divider sx={{ mx: 2.5 }} />}
                    </Box>
                  );
                })}

                {gIdx < groupedActivities.length - 1 && <Divider sx={{ mt: 1 }} />}
              </Box>
            ))}

            {totalPages > 1 && (
              <Box sx={{ display: 'flex', justifyContent: 'center', py: 3 }}>
                <Pagination
                  count={totalPages}
                  page={page}
                  onChange={(_, v) => { setPage(v); window.scrollTo({ top: 0, behavior: 'smooth' }); }}
                  color="primary"
                  size="large"
                />
              </Box>
            )}
          </>
        )}
      </MainCard>
    </Box>
  );
}

function ActivityHeader({ theme }) {
  return (
    <Box sx={{ mb: 3 }}>
      <PageBreadcrumbs
        items={[
          { label: 'Dashboard', path: '/landlord/dashboard' },
          { label: 'Recent Activity' }
        ]}
      />
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
          <HistoryOutlined style={{ fontSize: 28, color: theme.palette.primary.main }} />
        </Box>
        <Box>
          <Typography variant="h3" fontWeight={700}>Recent Activity</Typography>
          <Typography variant="body1" color="text.secondary">
            View all events and actions across your properties.
          </Typography>
        </Box>
      </Stack>
    </Box>
  );
}
