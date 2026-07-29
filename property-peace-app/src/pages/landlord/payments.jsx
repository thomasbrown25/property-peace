import { useCallback, useEffect, useMemo, useState } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { CSVLink } from 'react-csv';
import { darkHeaderOutlinedActionSx } from 'styles/darkHeaderActions.mjs';
import {
  Alert,
  alpha,
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
  Grid,
  IconButton,
  Menu,
  MenuItem,
  Pagination,
  Stack,
  Tooltip,
  Typography,
  useTheme
} from '@mui/material';
import {
  CalendarOutlined,
  CheckCircleOutlined,
  ClockCircleOutlined,
  DeleteOutlined,
  DollarOutlined,
  DownloadOutlined,
  EditOutlined,
  MoreOutlined,
  PlusOutlined,
  ReloadOutlined
} from '@ant-design/icons';

import PageBreadcrumbs from 'components/breadcrumbs/PageBreadcrumbs';
import TransactionFilterToolbar from 'components/filters/TransactionFilterToolbar';
import PropertySelect from 'components/PropertySelect';
import PaymentEditDrawer from 'components/drawers/PaymentEditDrawer';
import { useDrawer } from 'contexts/DrawerContext';
import { openSnackbar } from 'api/snackbar';
import axiosServices from 'utils/axios';
import { selectProperty } from 'store/property/property.selector';
import { setProperty } from 'store/property/property.action';

const PAGE_SIZE = 10;
const NAVY = '#061e35';
const PERIOD_OPTIONS = [
  { value: 'year', label: 'This year' },
  { value: 'month', label: 'This month' },
  { value: '30', label: 'Last 30 days' },
  { value: '90', label: 'Last 90 days' },
  { value: 'all', label: 'All time' },
  { value: 'custom', label: 'Custom dates' }
];
const PAYMENT_SORT_OPTIONS = [
  { value: 'newest', label: 'Newest first' },
  { value: 'oldest', label: 'Oldest first' },
  { value: 'amount-high', label: 'Amount: high' },
  { value: 'amount-low', label: 'Amount: low' },
  { value: 'property', label: 'Property' }
];

const read = (object, camel, pascal) => object?.[camel] ?? object?.[pascal];
const getId = (payment) => read(payment, 'id', 'Id');
const getAmount = (payment) => Number(read(payment, 'amount', 'Amount') || 0);

function formatMoney(value) {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 2 }).format(value || 0);
}

function formatDate(value) {
  if (!value) return 'Date not set';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return 'Date not set';
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

function toDateInput(date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function getPeriodDates(period) {
  const now = new Date();
  if (period === 'all') return { startDate: null, endDate: null };
  if (period === 'year') return { startDate: `${now.getFullYear()}-01-01`, endDate: toDateInput(now) };
  if (period === 'month') return { startDate: `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-01`, endDate: toDateInput(now) };
  const start = new Date(now);
  start.setDate(start.getDate() - (period === '30' ? 29 : 89));
  return { startDate: toDateInput(start), endDate: toDateInput(now) };
}

function normalizeStatus(payment) {
  const status = String(read(payment, 'status', 'Status') || 'Completed').trim().toLowerCase();
  if (['completed', 'succeeded', 'paid'].includes(status)) return 'completed';
  if (['failed'].includes(status)) return 'failed';
  if (['canceled', 'cancelled'].includes(status)) return 'canceled';
  if (status === 'disputed') return 'disputed';
  return 'processing';
}

function getPaymentType(payment) {
  if (read(payment, 'feeId', 'FeeId')) return 'fee';
  if (read(payment, 'depositId', 'DepositId')) return 'deposit';
  return 'rent';
}

function isOnlinePayment(payment) {
  const reference = String(read(payment, 'reference', 'Reference') || '');
  return Boolean(
    read(payment, 'stripePaymentIntentId', 'StripePaymentIntentId') ||
    read(payment, 'stripePaymentMethodId', 'StripePaymentMethodId') ||
    read(payment, 'stripeChargeId', 'StripeChargeId') ||
    /- Amount:\s*\$/i.test(reference)
  );
}

function getReference(payment) {
  const reference = String(read(payment, 'reference', 'Reference') || '').replace(/\s*-\s*Amount:\s*\$[\d,.]+/i, '').trim();
  if (reference) return reference;
  const type = getPaymentType(payment);
  if (type === 'fee') return read(payment, 'feeName', 'FeeName') || 'Lease fee';
  if (type === 'deposit') return 'Security deposit';
  return 'Rent payment';
}

function getPaymentTitle(payment) {
  const tenantName = read(payment, 'tenantName', 'TenantName');
  if (tenantName) return tenantName;
  const type = getPaymentType(payment);
  if (type === 'fee') return read(payment, 'feeName', 'FeeName') || 'Fee payment';
  if (type === 'deposit') return 'Deposit payment';
  return 'Rent payment';
}

function getLocation(payment) {
  const propertyName = read(payment, 'propertyName', 'PropertyName') || 'No property';
  const unitName = read(payment, 'unitName', 'UnitName');
  const singleUnit = Boolean(read(payment, 'isSingleUnitProperty', 'IsSingleUnitProperty'));
  return !unitName || singleUnit ? propertyName : `${propertyName} · ${unitName}`;
}

function getMethod(payment) {
  const method = read(payment, 'method', 'Method');
  if (method) return method;
  return isOnlinePayment(payment) ? 'Online payment' : 'Manual entry';
}

function statusPresentation(status) {
  if (status === 'completed') return { label: 'Completed', color: 'success' };
  if (status === 'failed') return { label: 'Failed', color: 'error' };
  if (status === 'canceled') return { label: 'Canceled', color: 'default' };
  if (status === 'disputed') return { label: 'Disputed', color: 'error' };
  return { label: 'Processing', color: 'warning' };
}

function matchesDate(payment, dates) {
  const rawDate = read(payment, 'paymentDate', 'PaymentDate');
  if (!rawDate) return false;
  const value = new Date(rawDate);
  if (Number.isNaN(value.getTime())) return false;
  const start = dates.startDate ? new Date(`${dates.startDate}T00:00:00`) : null;
  const end = dates.endDate ? new Date(`${dates.endDate}T23:59:59`) : null;
  return (!start || value >= start) && (!end || value <= end);
}

function MetricCard({ label, value, helper, icon, color, active, onClick }) {
  const theme = useTheme();
  return (
    <Box
      component="button"
      type="button"
      onClick={onClick}
      sx={{
        width: '100%',
        minHeight: 112,
        p: 2,
        borderRadius: 2.5,
        border: `1px solid ${active ? alpha(color, 0.52) : alpha(theme.palette.divider, 0.16)}`,
        bgcolor: active ? alpha(color, theme.palette.mode === 'dark' ? 0.14 : 0.055) : 'background.paper',
        boxShadow: active ? `0 8px 24px ${alpha(color, 0.12)}` : `0 4px 18px ${alpha(NAVY, 0.05)}`,
        color: 'text.primary',
        textAlign: 'left',
        cursor: 'pointer',
        font: 'inherit',
        transition: 'transform 150ms ease, border-color 150ms ease, box-shadow 150ms ease',
        '&:hover': { transform: 'translateY(-2px)', borderColor: alpha(color, 0.42), boxShadow: `0 10px 28px ${alpha(color, 0.12)}` },
        '&:focus-visible': { outline: `3px solid ${alpha(color, 0.28)}`, outlineOffset: 2 }
      }}
    >
      <Stack direction="row" justifyContent="space-between" alignItems="flex-start" spacing={1.5}>
        <Box minWidth={0}>
          <Typography sx={{ fontSize: '0.72rem', fontWeight: 700, letterSpacing: 0.65, textTransform: 'uppercase', color: 'text.secondary' }}>
            {label}
          </Typography>
          <Typography sx={{ mt: 0.55, fontSize: '1.45rem', lineHeight: 1.15, fontWeight: 750 }} noWrap>{value}</Typography>
          <Typography sx={{ mt: 0.55, fontSize: '0.75rem', color: 'text.secondary' }}>{helper}</Typography>
        </Box>
        <Avatar sx={{ width: 38, height: 38, bgcolor: alpha(color, 0.12), color }}>{icon}</Avatar>
      </Stack>
    </Box>
  );
}

function PaymentRow({ payment, onActions }) {
  const theme = useTheme();
  const status = normalizeStatus(payment);
  const statusView = statusPresentation(status);
  const type = getPaymentType(payment);
  const online = isOnlinePayment(payment);
  const amount = getAmount(payment);
  const reference = getReference(payment);

  return (
    <Box
      sx={{
        px: { xs: 1.5, md: 2 },
        py: { xs: 1.55, md: 1.35 },
        display: { xs: 'block', md: 'grid' },
        gridTemplateColumns: 'minmax(240px, 1.45fr) minmax(190px, 1.05fr) minmax(150px, .82fr) minmax(105px, .58fr) 44px',
        gap: { xs: 1.2, md: 2 },
        alignItems: 'center',
        borderBottom: `1px solid ${alpha(theme.palette.divider, 0.13)}`,
        '&:hover': { bgcolor: alpha(theme.palette.success.main, theme.palette.mode === 'dark' ? 0.07 : 0.025) }
      }}
    >
      <Stack direction="row" spacing={1.25} alignItems="center" minWidth={0}>
        <Avatar sx={{ width: 38, height: 38, bgcolor: alpha(theme.palette.success.main, 0.11), color: 'success.main' }}>
          <DollarOutlined />
        </Avatar>
        <Box minWidth={0}>
          <Typography fontWeight={700} noWrap>{getPaymentTitle(payment)}</Typography>
          <Typography noWrap sx={{ mt: 0.25, fontSize: '0.75rem', color: 'text.secondary' }}>{reference}</Typography>
        </Box>
      </Stack>

      <Box minWidth={0}>
        <Typography sx={{ fontSize: '0.82rem', fontWeight: 650 }} noWrap>{getLocation(payment)}</Typography>
        <Typography sx={{ mt: 0.25, fontSize: '0.72rem', color: 'text.secondary', textTransform: 'capitalize' }}>
          {type === 'rent' ? 'Rent' : type === 'fee' ? 'Lease fee' : 'Deposit'}
        </Typography>
      </Box>

      <Box>
        <Typography sx={{ fontSize: '0.8rem', fontWeight: 600 }}>{formatDate(read(payment, 'paymentDate', 'PaymentDate'))}</Typography>
        <Stack direction="row" spacing={0.6} sx={{ mt: 0.45 }} flexWrap="wrap" useFlexGap>
          <Chip label={statusView.label} size="small" color={statusView.color} variant={status === 'completed' ? 'filled' : 'outlined'} sx={{ height: 20, fontSize: '0.65rem' }} />
          <Chip label={online ? 'Online' : getMethod(payment)} size="small" variant="outlined" sx={{ height: 20, maxWidth: 110, fontSize: '0.65rem' }} />
        </Stack>
      </Box>

      <Typography sx={{ fontSize: '0.94rem', fontWeight: 760, color: status === 'completed' ? 'success.dark' : 'text.primary', textAlign: { md: 'right' } }}>
        {formatMoney(amount)}
      </Typography>

      <Box sx={{ display: 'flex', justifyContent: { xs: 'flex-end', md: 'center' } }}>
        <Tooltip title="Payment actions">
          <IconButton size="small" aria-label={`Actions for ${reference}`} onClick={(event) => onActions(event, payment)}><MoreOutlined /></IconButton>
        </Tooltip>
      </Box>
    </Box>
  );
}

export default function Payments() {
  const theme = useTheme();
  const dispatch = useDispatch();
  const drawer = useDrawer();
  const selectedProperty = useSelector(selectProperty);

  const [payments, setPayments] = useState([]);
  const [loading, setLoading] = useState(false);
  const [paymentError, setPaymentError] = useState(null);
  const [wasPaymentDrawerOpen, setWasPaymentDrawerOpen] = useState(false);
  const [search, setSearch] = useState('');
  const [period, setPeriod] = useState('year');
  const [customDates, setCustomDates] = useState({ startDate: '', endDate: '' });
  const [type, setType] = useState('all');
  const [status, setStatus] = useState('all');
  const [source, setSource] = useState('all');
  const [sort, setSort] = useState('newest');
  const [page, setPage] = useState(1);
  const [actionsAnchor, setActionsAnchor] = useState(null);
  const [selectedPayment, setSelectedPayment] = useState(null);
  const [editDrawerOpen, setEditDrawerOpen] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const propertyId = selectedProperty?.id || selectedProperty?.Id || null;

  const fetchPayments = useCallback(async () => {
    try {
      setLoading(true);
      setPaymentError(null);
      const params = new URLSearchParams();
      if (propertyId) params.append('propertyId', propertyId);
      const suffix = params.toString();
      const response = await axiosServices.get(`/api/payment/all${suffix ? `?${suffix}` : ''}`);
      const raw = response.data;
      const data = Array.isArray(raw) ? raw : raw?.data ?? raw?.Data ?? [];
      setPayments(Array.isArray(data) ? data : []);
    } catch (error) {
      setPayments([]);
      setPaymentError(error?.response?.data?.message || error?.response?.data?.Message || error?.message || 'Failed to load payments.');
    } finally {
      setLoading(false);
    }
  }, [propertyId]);

  useEffect(() => {
    fetchPayments();
  }, [fetchPayments]);

  useEffect(() => {
    if (drawer.isOpenPaymentAdd) {
      setWasPaymentDrawerOpen(true);
      return;
    }
    if (wasPaymentDrawerOpen) {
      setWasPaymentDrawerOpen(false);
      fetchPayments();
    }
  }, [drawer.isOpenPaymentAdd, fetchPayments, wasPaymentDrawerOpen]);

  useEffect(() => () => {
    dispatch(setProperty(null));
  }, [dispatch]);

  useEffect(() => {
    setPage(1);
  }, [customDates.endDate, customDates.startDate, period, propertyId, search, sort, source, status, type]);

  const periodDates = period === 'custom' ? customDates : getPeriodDates(period);

  const dateScopedPayments = useMemo(
    () => payments.filter((payment) => matchesDate(payment, periodDates)),
    [payments, periodDates.endDate, periodDates.startDate]
  );

  const visiblePayments = useMemo(() => {
    const query = search.trim().toLowerCase();
    return [...dateScopedPayments]
      .filter((payment) => {
        if (!query) return true;
        return [
          getPaymentTitle(payment),
          getReference(payment),
          getLocation(payment),
          getMethod(payment),
          read(payment, 'feeName', 'FeeName'),
          normalizeStatus(payment),
          getPaymentType(payment)
        ].filter(Boolean).join(' ').toLowerCase().includes(query);
      })
      .filter((payment) => type === 'all' || getPaymentType(payment) === type)
      .filter((payment) => {
        const normalized = normalizeStatus(payment);
        if (status === 'all') return true;
        if (status === 'attention') return ['failed', 'canceled', 'disputed'].includes(normalized);
        return normalized === status;
      })
      .filter((payment) => source === 'all' || (source === 'online' ? isOnlinePayment(payment) : !isOnlinePayment(payment)))
      .sort((a, b) => {
        if (sort === 'amount-high') return getAmount(b) - getAmount(a);
        if (sort === 'amount-low') return getAmount(a) - getAmount(b);
        if (sort === 'property') return getLocation(a).localeCompare(getLocation(b));
        const aDate = new Date(read(a, 'paymentDate', 'PaymentDate') || 0).getTime();
        const bDate = new Date(read(b, 'paymentDate', 'PaymentDate') || 0).getTime();
        return sort === 'oldest' ? aDate - bDate : bDate - aDate;
      });
  }, [dateScopedPayments, search, sort, source, status, type]);

  const metrics = useMemo(() => {
    const completed = dateScopedPayments.filter((payment) => normalizeStatus(payment) === 'completed');
    const now = new Date();
    const thisMonth = completed.filter((payment) => {
      const date = new Date(read(payment, 'paymentDate', 'PaymentDate'));
      return date.getMonth() === now.getMonth() && date.getFullYear() === now.getFullYear();
    });
    const online = completed.filter(isOnlinePayment);
    const attention = dateScopedPayments.filter((payment) => ['failed', 'canceled', 'disputed'].includes(normalizeStatus(payment)));
    return {
      received: completed.reduce((sum, payment) => sum + getAmount(payment), 0),
      count: completed.length,
      thisMonth: thisMonth.reduce((sum, payment) => sum + getAmount(payment), 0),
      thisMonthCount: thisMonth.length,
      online: online.reduce((sum, payment) => sum + getAmount(payment), 0),
      onlineCount: online.length,
      attentionCount: attention.length,
      attentionAmount: attention.reduce((sum, payment) => sum + getAmount(payment), 0)
    };
  }, [dateScopedPayments]);

  const paymentMix = useMemo(() => ['rent', 'fee', 'deposit'].map((paymentType) => {
    const items = dateScopedPayments.filter((payment) => getPaymentType(payment) === paymentType && normalizeStatus(payment) === 'completed');
    return {
      type: paymentType,
      label: paymentType === 'rent' ? 'Rent' : paymentType === 'fee' ? 'Fees' : 'Deposits',
      count: items.length,
      amount: items.reduce((sum, payment) => sum + getAmount(payment), 0)
    };
  }), [dateScopedPayments]);

  const completedTotal = metrics.received || 1;
  const pageCount = Math.ceil(visiblePayments.length / PAGE_SIZE);
  const pageItems = visiblePayments.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);
  const hasFilters = Boolean(search || period !== 'year' || type !== 'all' || status !== 'all' || source !== 'all' || sort !== 'newest' || propertyId);
  const paymentFilterFields = [
    {
      key: 'type', label: 'Payment type', value: type, defaultValue: 'all', onChange: setType,
      options: [{ value: 'all', label: 'All types' }, { value: 'rent', label: 'Rent' }, { value: 'fee', label: 'Fees' }, { value: 'deposit', label: 'Deposits' }]
    },
    {
      key: 'status', label: 'Payment status', value: status, defaultValue: 'all', onChange: setStatus,
      options: [{ value: 'all', label: 'All statuses' }, { value: 'completed', label: 'Completed' }, { value: 'processing', label: 'Processing' }, { value: 'attention', label: 'Needs attention' }, { value: 'failed', label: 'Failed' }, { value: 'disputed', label: 'Disputed' }, { value: 'canceled', label: 'Canceled' }]
    },
    {
      key: 'source', label: 'Payment source', value: source, defaultValue: 'all', onChange: setSource,
      options: [{ value: 'all', label: 'All sources' }, { value: 'online', label: 'Online' }, { value: 'manual', label: 'Manual' }]
    }
  ];
  const paymentActiveChips = [
    ...(propertyId ? [{ key: 'property', label: read(selectedProperty, 'name', 'Name') || read(selectedProperty, 'address', 'Address') || 'Selected property', onDelete: () => dispatch(setProperty(null)) }] : []),
    ...(period !== 'year' ? [{ key: 'period', label: PERIOD_OPTIONS.find((item) => item.value === period)?.label || 'Date', onDelete: () => { setPeriod('year'); setCustomDates({ startDate: '', endDate: '' }); } }] : []),
    ...paymentFilterFields.filter((filter) => filter.value !== filter.defaultValue).map((filter) => ({ key: filter.key, label: filter.options.find((item) => item.value === filter.value)?.label || filter.value, onDelete: () => filter.onChange(filter.defaultValue) })),
    ...(sort !== 'newest' ? [{ key: 'sort', label: PAYMENT_SORT_OPTIONS.find((item) => item.value === sort)?.label || sort, onDelete: () => setSort('newest') }] : [])
  ];

  const csvData = visiblePayments.map((payment) => ({
    Date: formatDate(read(payment, 'paymentDate', 'PaymentDate')),
    Tenant: read(payment, 'tenantName', 'TenantName') || '',
    Reference: getReference(payment),
    Type: getPaymentType(payment),
    Property: read(payment, 'propertyName', 'PropertyName') || '',
    Unit: read(payment, 'isSingleUnitProperty', 'IsSingleUnitProperty') ? '' : read(payment, 'unitName', 'UnitName') || '',
    Method: getMethod(payment),
    Source: isOnlinePayment(payment) ? 'Online' : 'Manual',
    Status: statusPresentation(normalizeStatus(payment)).label,
    Amount: getAmount(payment)
  }));

  const clearFilters = () => {
    setSearch('');
    setPeriod('year');
    setCustomDates({ startDate: '', endDate: '' });
    setType('all');
    setStatus('all');
    setSource('all');
    setSort('newest');
    dispatch(setProperty(null));
  };

  const handleActionsClick = (event, payment) => {
    setActionsAnchor(event.currentTarget);
    setSelectedPayment(payment);
  };

  const closeActionsMenu = () => setActionsAnchor(null);

  const handleEditPayment = () => {
    closeActionsMenu();
    setEditDrawerOpen(true);
  };

  const handleDeletePayment = () => {
    closeActionsMenu();
    setDeleteDialogOpen(true);
  };

  const handleDeleteCancel = () => {
    setDeleteDialogOpen(false);
    setSelectedPayment(null);
  };

  const handleDeleteConfirm = async () => {
    const paymentId = getId(selectedPayment);
    if (!paymentId) return;
    try {
      setDeleting(true);
      await axiosServices.delete(`/api/payment/${paymentId}`);
      openSnackbar({ open: true, message: 'Payment deleted successfully.', variant: 'alert', alert: { color: 'success' } });
      handleDeleteCancel();
      fetchPayments();
    } catch (error) {
      openSnackbar({
        open: true,
        message: error?.response?.data?.message || error?.response?.data?.Message || error?.response?.data || 'Failed to delete payment.',
        variant: 'alert',
        alert: { color: 'error' }
      });
    } finally {
      setDeleting(false);
    }
  };

  return (
    <Box sx={{ pb: 3 }}>
      <Box sx={{ display: { xs: 'none', md: 'block' } }}>
        <PageBreadcrumbs items={[{ label: 'Dashboard', path: '/landlord/dashboard' }, { label: 'Payments' }]} />
      </Box>

      <Box sx={{ mb: 2.5, p: { xs: 2, md: 2.75 }, borderRadius: 3, color: '#fff', background: `linear-gradient(120deg, ${NAVY} 0%, #0b3558 100%)`, boxShadow: `0 16px 38px ${alpha(NAVY, 0.18)}` }}>
        <Stack direction={{ xs: 'column', md: 'row' }} alignItems={{ md: 'center' }} justifyContent="space-between" spacing={2}>
          <Box>
            <Typography variant="h3" sx={{ color: '#fff', fontWeight: 750, letterSpacing: -0.4 }}>Payments</Typography>
            <Typography sx={{ mt: 0.6, color: alpha('#fff', 0.72), fontSize: '0.88rem' }}>
              Monitor rent collections, payment channels, and records that need attention across your portfolio.
            </Typography>
          </Box>
          <Stack direction="row" spacing={1}>
            <CSVLink data={csvData} filename={`payments-${toDateInput(new Date())}.csv`} style={{ textDecoration: 'none' }}>
              <Button variant="outlined" startIcon={<DownloadOutlined />} disabled={!visiblePayments.length} sx={darkHeaderOutlinedActionSx}>
                Export
              </Button>
            </CSVLink>
            <Button variant="contained" color="success" startIcon={<PlusOutlined />} onClick={() => drawer.openPaymentAddDrawer()} sx={{ textTransform: 'none', fontWeight: 700, boxShadow: 'none' }}>
              Record payment
            </Button>
          </Stack>
        </Stack>
      </Box>

      <Grid container spacing={1.5} sx={{ mb: 2.5 }}>
        <Grid size={{ xs: 6, lg: 3 }}>
          <MetricCard label="Total received" value={formatMoney(metrics.received)} helper={`${metrics.count} completed payment${metrics.count === 1 ? '' : 's'}`} icon={<DollarOutlined />} color={theme.palette.success.main} active={status === 'completed'} onClick={() => setStatus((value) => value === 'completed' ? 'all' : 'completed')} />
        </Grid>
        <Grid size={{ xs: 6, lg: 3 }}>
          <MetricCard label="This month" value={formatMoney(metrics.thisMonth)} helper={`${metrics.thisMonthCount} completed payment${metrics.thisMonthCount === 1 ? '' : 's'}`} icon={<CalendarOutlined />} color={theme.palette.primary.main} active={period === 'month'} onClick={() => setPeriod((value) => value === 'month' ? 'year' : 'month')} />
        </Grid>
        <Grid size={{ xs: 6, lg: 3 }}>
          <MetricCard label="Online collections" value={formatMoney(metrics.online)} helper={`${metrics.onlineCount} online payment${metrics.onlineCount === 1 ? '' : 's'}`} icon={<CheckCircleOutlined />} color={theme.palette.primary.main} active={source === 'online'} onClick={() => setSource((value) => value === 'online' ? 'all' : 'online')} />
        </Grid>
        <Grid size={{ xs: 6, lg: 3 }}>
          <MetricCard label="Needs attention" value={metrics.attentionCount} helper={metrics.attentionCount ? `${formatMoney(metrics.attentionAmount)} affected` : 'No failed or disputed records'} icon={<ClockCircleOutlined />} color={theme.palette.warning.main} active={status === 'attention'} onClick={() => setStatus((value) => value === 'attention' ? 'all' : 'attention')} />
        </Grid>
      </Grid>

      <Grid container spacing={2}>
        <Grid size={{ xs: 12, xl: 9 }}>
          <Box sx={{ bgcolor: 'background.paper', border: `1px solid ${alpha(theme.palette.divider, 0.16)}`, borderRadius: 3, boxShadow: `0 8px 28px ${alpha(NAVY, 0.055)}`, overflow: 'hidden' }}>
            <Box sx={{ p: { xs: 1.5, md: 2 }, borderBottom: `1px solid ${alpha(theme.palette.divider, 0.14)}` }}>
              <TransactionFilterToolbar
                search={search}
                onSearchChange={setSearch}
                searchPlaceholder="Search tenant, reference, property, unit, or method"
                propertyControl={<PropertySelect width="100%" disableAllOption={false} label="" />}
                period={period}
                onPeriodChange={setPeriod}
                periodOptions={PERIOD_OPTIONS}
                sort={sort}
                onSortChange={setSort}
                sortOptions={PAYMENT_SORT_OPTIONS}
                filters={paymentFilterFields}
                activeChips={paymentActiveChips}
                onClearAll={clearFilters}
                customDates={customDates}
                onCustomDatesChange={setCustomDates}
              />
            </Box>

            {loading ? <Box sx={{ minHeight: 300, display: 'grid', placeItems: 'center' }}><CircularProgress /></Box> : paymentError ? (
              <Box sx={{ p: { xs: 2, sm: 3 } }}>
                <Alert severity="error" action={<Button color="inherit" size="small" startIcon={<ReloadOutlined />} onClick={fetchPayments} sx={{ textTransform: 'none' }}>Retry</Button>}>
                  {paymentError}
                </Alert>
              </Box>
            ) : pageItems.length === 0 ? (
              <Box sx={{ px: 3, py: 7, textAlign: 'center' }}>
                <Avatar sx={{ width: 52, height: 52, mx: 'auto', bgcolor: alpha(theme.palette.success.main, 0.1), color: 'success.main' }}><DollarOutlined /></Avatar>
                <Typography variant="h6" sx={{ mt: 1.5 }}>{hasFilters ? 'No payments match this view' : 'No payments recorded yet'}</Typography>
                <Typography color="text.secondary" sx={{ mt: 0.6, fontSize: '0.84rem' }}>{hasFilters ? 'Clear or adjust the filters to see more payment records.' : 'Record your first payment to start building a clean collection history.'}</Typography>
                {hasFilters ? <Button onClick={clearFilters} sx={{ mt: 1.5, textTransform: 'none' }}>Clear filters</Button> : <Button variant="contained" color="success" startIcon={<PlusOutlined />} onClick={() => drawer.openPaymentAddDrawer()} sx={{ mt: 2, textTransform: 'none' }}>Record payment</Button>}
              </Box>
            ) : (
              <>
                <Box sx={{ px: 2, py: 1, display: { xs: 'none', md: 'grid' }, gridTemplateColumns: 'minmax(240px, 1.45fr) minmax(190px, 1.05fr) minmax(150px, .82fr) minmax(105px, .58fr) 44px', gap: 2, bgcolor: alpha(theme.palette.success.main, 0.025), borderBottom: `1px solid ${alpha(theme.palette.divider, 0.12)}` }}>
                  {['Payment', 'Property & type', 'Date & status', 'Amount', ''].map((label, index) => <Typography key={`${label}-${index}`} sx={{ fontSize: '0.68rem', fontWeight: 750, letterSpacing: 0.55, textTransform: 'uppercase', color: 'text.secondary', textAlign: index === 3 ? 'right' : 'left' }}>{label}</Typography>)}
                </Box>
                {pageItems.map((payment) => <PaymentRow key={getId(payment)} payment={payment} onActions={handleActionsClick} />)}
              </>
            )}

            {pageCount > 1 && <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1.5} justifyContent="space-between" alignItems="center" sx={{ p: 2, borderTop: `1px solid ${alpha(theme.palette.divider, 0.14)}` }}>
              <Typography sx={{ fontSize: '0.78rem', color: 'text.secondary' }}>Showing {(page - 1) * PAGE_SIZE + 1}–{Math.min(page * PAGE_SIZE, visiblePayments.length)} of {visiblePayments.length}</Typography>
              <Pagination count={pageCount} page={page} onChange={(_, value) => setPage(value)} size="small" color="primary" />
            </Stack>}
          </Box>
        </Grid>

        <Grid size={{ xs: 12, xl: 3 }}>
          <Stack spacing={2}>
            <Box sx={{ p: 2, bgcolor: 'background.paper', border: `1px solid ${alpha(theme.palette.divider, 0.16)}`, borderRadius: 3, boxShadow: `0 8px 28px ${alpha(NAVY, 0.045)}` }}>
              <Typography fontWeight={750}>Payment mix</Typography>
              <Typography sx={{ mt: 0.35, fontSize: '0.75rem', color: 'text.secondary' }}>Completed collections in this view</Typography>
              <Stack spacing={1.5} sx={{ mt: 2 }}>
                {paymentMix.map((item, index) => (
                  <Box key={item.type} component="button" type="button" onClick={() => setType((value) => value === item.type ? 'all' : item.type)} sx={{ p: 0, border: 0, bgcolor: 'transparent', color: 'inherit', textAlign: 'left', font: 'inherit', cursor: 'pointer' }}>
                    <Stack direction="row" justifyContent="space-between" spacing={1}>
                      <Box><Typography sx={{ fontSize: '0.8rem', fontWeight: 650 }}>{item.label}</Typography><Typography sx={{ mt: 0.15, fontSize: '0.68rem', color: 'text.secondary' }}>{item.count} payment{item.count === 1 ? '' : 's'}</Typography></Box>
                      <Typography sx={{ fontSize: '0.8rem', fontWeight: 700 }}>{formatMoney(item.amount)}</Typography>
                    </Stack>
                    <Box sx={{ mt: 0.65, height: 6, borderRadius: 8, bgcolor: alpha(theme.palette.divider, 0.14), overflow: 'hidden' }}>
                      <Box sx={{ width: `${Math.max((item.amount / completedTotal) * 100, item.amount ? 5 : 0)}%`, height: '100%', borderRadius: 8, bgcolor: index === 0 ? 'success.main' : alpha(theme.palette.success.main, 0.55) }} />
                    </Box>
                  </Box>
                ))}
              </Stack>
            </Box>

            <Box sx={{ p: 2, bgcolor: alpha(theme.palette.success.main, theme.palette.mode === 'dark' ? 0.1 : 0.045), border: `1px solid ${alpha(theme.palette.success.main, 0.2)}`, borderRadius: 3 }}>
              <Typography fontWeight={750}>Keep collections current</Typography>
              <Typography sx={{ mt: 0.6, fontSize: '0.78rem', color: 'text.secondary', lineHeight: 1.55 }}>Record offline payments promptly and review failed or disputed online payments so tenant balances and reports stay accurate.</Typography>
              <Button size="small" startIcon={<PlusOutlined />} onClick={() => drawer.openPaymentAddDrawer()} sx={{ mt: 1.2, px: 0, textTransform: 'none' }}>Record payment</Button>
            </Box>
          </Stack>
        </Grid>
      </Grid>

      <Menu anchorEl={actionsAnchor} open={Boolean(actionsAnchor)} onClose={closeActionsMenu} PaperProps={{ sx: { mt: 0.5, minWidth: 180, borderRadius: 1.5 } }}>
        <MenuItem onClick={handleEditPayment} sx={{ gap: 1, fontSize: '0.85rem' }}><EditOutlined />Edit payment</MenuItem>
        <MenuItem onClick={handleDeletePayment} sx={{ gap: 1, fontSize: '0.85rem', color: 'error.main' }}><DeleteOutlined />Delete payment</MenuItem>
      </Menu>

      <PaymentEditDrawer payment={selectedPayment} open={editDrawerOpen} onClose={() => { setEditDrawerOpen(false); setSelectedPayment(null); }} onUpdateSuccess={fetchPayments} />

      <Dialog open={deleteDialogOpen} onClose={handleDeleteCancel} maxWidth="sm" fullWidth>
        <DialogTitle>Delete payment</DialogTitle>
        <DialogContent>
          <DialogContentText>
            Delete this payment record? This action cannot be undone and may affect the lease balance and accounting ledger.
            {selectedPayment && <Box component="span" sx={{ display: 'block', mt: 2, fontWeight: 650, color: 'text.primary' }}>{formatMoney(getAmount(selectedPayment))} · {formatDate(read(selectedPayment, 'paymentDate', 'PaymentDate'))}</Box>}
          </DialogContentText>
        </DialogContent>
        <DialogActions>
          <Button onClick={handleDeleteCancel} disabled={deleting} sx={{ textTransform: 'none' }}>Cancel</Button>
          <Button onClick={handleDeleteConfirm} variant="contained" color="error" disabled={deleting} sx={{ textTransform: 'none' }}>{deleting ? 'Deleting…' : 'Delete payment'}</Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}
