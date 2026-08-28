import { useEffect, useMemo, useState } from 'react';
import PropTypes from 'prop-types';
import {
  Alert,
  alpha,
  Box,
  Button,
  Chip,
  CircularProgress,
  InputAdornment,
  MenuItem,
  OutlinedInput,
  Pagination,
  Paper,
  Select,
  Stack,
  Typography,
  useTheme
} from '@mui/material';
import { DollarOutlined, LinkOutlined, SearchOutlined } from '@ant-design/icons';

import { useOrganization } from 'contexts/OrganizationContext';
import axiosServices from 'utils/axios';
import { formatPaymentDate } from 'utils/paymentsTab';
import { filterOnlineTransactions, getOnlinePaymentStatusPresentation, summarizeOnlineTransactions } from 'utils/onlinePaymentTransactions';

const PAGE_SIZE = 10;
const money = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 2 });
const STATUS_OPTIONS = [
  ['all', 'All statuses'],
  ['completed', 'Completed'],
  ['processing', 'Processing'],
  ['partially-refunded', 'Partially refunded'],
  ['refunded', 'Refunded'],
  ['attention', 'Needs attention']
];

const readPayments = (response) => {
  const data = Array.isArray(response?.data) ? response.data : (response?.data?.data ?? response?.data?.Data ?? response?.data);
  return Array.isArray(data) ? data : [];
};

function SummaryCard({ label, value, detail, tone = 'primary' }) {
  return (
    <Paper
      elevation={0}
      sx={{ p: 2, border: '1px solid', borderColor: 'divider', borderRadius: 2.5, minWidth: 0, bgcolor: 'background.paper' }}
    >
      <Typography sx={{ fontSize: '0.72rem', fontWeight: 750, color: 'text.secondary', textTransform: 'uppercase', letterSpacing: 0.5 }}>
        {label}
      </Typography>
      <Typography sx={{ mt: 0.55, fontSize: '1.35rem', lineHeight: 1.15, fontWeight: 800, color: `${tone}.main` }}>{value}</Typography>
      <Typography sx={{ mt: 0.45, fontSize: '0.74rem', color: 'text.secondary' }}>{detail}</Typography>
    </Paper>
  );
}

SummaryCard.propTypes = {
  label: PropTypes.string.isRequired,
  value: PropTypes.oneOfType([PropTypes.string, PropTypes.number]).isRequired,
  detail: PropTypes.string.isRequired,
  tone: PropTypes.string
};

export default function OnlinePaymentTransactions() {
  const theme = useTheme();
  const { currentOrganization, loading: organizationLoading } = useOrganization();
  const organizationId = currentOrganization?.id ?? currentOrganization?.Id ?? null;
  const [payments, setPayments] = useState([]);
  const [loadedOrganizationId, setLoadedOrganizationId] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [retryVersion, setRetryVersion] = useState(0);
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState('all');
  const [propertyId, setPropertyId] = useState('all');
  const [page, setPage] = useState(1);
  const [openingDashboard, setOpeningDashboard] = useState(false);
  const [dashboardError, setDashboardError] = useState('');

  useEffect(() => {
    setPayments([]);
    setLoadedOrganizationId(null);
    setPage(1);
    setError('');

    if (organizationLoading) {
      setLoading(true);
      return undefined;
    }
    if (!organizationId) {
      setLoading(false);
      return undefined;
    }

    const controller = new AbortController();
    setLoading(true);

    axiosServices
      .get('/api/stripe/payment-transactions', { signal: controller.signal })
      .then((response) => {
        if (!controller.signal.aborted) {
          setPayments(readPayments(response));
          setLoadedOrganizationId(organizationId);
        }
      })
      .catch((requestError) => {
        if (controller.signal.aborted) return;
        setLoadedOrganizationId(organizationId);
        setError(
          requestError?.response?.data?.message ||
            requestError?.response?.data?.Message ||
            requestError?.message ||
            'Online transactions could not be loaded.'
        );
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false);
      });

    return () => controller.abort();
  }, [organizationId, organizationLoading, retryVersion]);

  const scopedPayments = loadedOrganizationId === organizationId ? payments : [];
  const effectiveLoading = organizationLoading || (Boolean(organizationId) && loadedOrganizationId !== organizationId) || loading;
  const summary = useMemo(() => summarizeOnlineTransactions(scopedPayments), [scopedPayments]);
  const filteredRows = useMemo(
    () => filterOnlineTransactions(scopedPayments, { search, status, propertyId }),
    [scopedPayments, search, status, propertyId]
  );
  const properties = useMemo(() => {
    const unique = new Map();
    scopedPayments.forEach((payment) => {
      const id = payment?.propertyId ?? payment?.PropertyId;
      const name = payment?.propertyName ?? payment?.PropertyName;
      if (id != null && !unique.has(String(id))) unique.set(String(id), name || `Property ${id}`);
    });
    return [...unique.entries()].sort((a, b) => a[1].localeCompare(b[1]));
  }, [scopedPayments]);
  const totalPages = Math.max(1, Math.ceil(filteredRows.length / PAGE_SIZE));
  const currentPage = Math.min(page, totalPages);
  const visibleRows = filteredRows.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE);

  const changeSearch = (event) => {
    setSearch(event.target.value);
    setPage(1);
  };
  const changeStatus = (event) => {
    setStatus(event.target.value);
    setPage(1);
  };
  const changeProperty = (event) => {
    setPropertyId(event.target.value);
    setPage(1);
  };

  const openStripeDashboard = async () => {
    setDashboardError('');
    setOpeningDashboard(true);
    try {
      const response = await axiosServices.post('/api/stripe/login-link');
      const dashboardUrl = response?.data?.dashboardUrl ?? response?.data?.DashboardUrl;
      if (!dashboardUrl) throw new Error('Stripe did not return a dashboard link.');
      window.open(dashboardUrl, '_blank', 'noopener,noreferrer');
    } catch (requestError) {
      setDashboardError(
        requestError?.response?.data?.message ||
          requestError?.response?.data?.Message ||
          requestError?.message ||
          'Stripe Dashboard could not be opened.'
      );
    } finally {
      setOpeningDashboard(false);
    }
  };

  return (
    <Box>
      <Stack direction={{ xs: 'column', md: 'row' }} justifyContent="space-between" spacing={2} sx={{ mb: 2.5 }}>
        <Box>
          <Typography variant="h5" sx={{ fontWeight: 800 }}>
            Payment Transactions
          </Typography>
          <Typography sx={{ mt: 0.55, color: 'text.secondary', fontSize: '0.88rem' }}>
            Stripe payment activity recorded by Property Peace. Manually recorded payments remain in your lease and accounting history.
          </Typography>
        </Box>
        <Button variant="outlined" startIcon={<LinkOutlined />} onClick={openStripeDashboard} disabled={openingDashboard} sx={{ flexShrink: 0 }}>
          {openingDashboard ? 'Opening Stripe…' : 'View Stripe Dashboard'}
        </Button>
      </Stack>

      {dashboardError && <Alert severity="error" sx={{ mb: 2 }}>{dashboardError}</Alert>}

      <Stack direction={{ xs: 'column', lg: 'row' }} spacing={1.1} sx={{ mb: 2.5, width: '100%' }}>
        <OutlinedInput
          value={search}
          onChange={changeSearch}
          placeholder="Search payments, properties, renters, methods, or Stripe IDs"
          size="small"
          startAdornment={<InputAdornment position="start"><SearchOutlined style={{ fontSize: 14, opacity: 0.55 }} /></InputAdornment>}
          inputProps={{ 'aria-label': 'Search Stripe payment transactions' }}
          sx={{ width: '100%', height: 36, flex: { lg: '0 1 390px' }, minWidth: { lg: 260 }, borderRadius: 1.75, bgcolor: 'background.paper', fontSize: '0.8rem' }}
        />
        <Stack direction="row" spacing={1} sx={{ minWidth: 0, overflowX: 'auto', pb: { xs: 0.25, lg: 0 } }}>
          <Select value={status} onChange={changeStatus} size="small" sx={{ minWidth: 155, height: 36, borderRadius: 1.75, bgcolor: 'background.paper' }} inputProps={{ 'aria-label': 'Filter by payment status' }}>
            {STATUS_OPTIONS.map(([value, label]) => (
              <MenuItem key={value} value={value}>{label}</MenuItem>
            ))}
          </Select>
          <Select value={propertyId} onChange={changeProperty} size="small" sx={{ minWidth: 175, maxWidth: 240, height: 36, borderRadius: 1.75, bgcolor: 'background.paper' }} inputProps={{ 'aria-label': 'Filter by property' }}>
            <MenuItem value="all">All properties</MenuItem>
            {properties.map(([id, name]) => <MenuItem key={id} value={id}>{name}</MenuItem>)}
          </Select>
        </Stack>
      </Stack>

      <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr 1fr', lg: 'repeat(4, minmax(0, 1fr))' }, gap: 1.5, mb: 2.5 }}>
        <SummaryCard
          label="Completed volume"
          value={money.format(summary.completedAmount)}
          detail="Confirmed online payments"
          tone="success"
        />
        <SummaryCard label="Transactions" value={summary.totalCount} detail={`${summary.refundedCount} refunded or partially refunded`} />
        <SummaryCard label="Processing" value={summary.processingCount} detail="Awaiting provider confirmation" tone="warning" />
        <SummaryCard
          label="Needs attention"
          value={summary.attentionCount}
          detail="Failed, canceled, or disputed"
          tone={summary.attentionCount ? 'error' : 'success'}
        />
      </Box>

      <Paper elevation={0} sx={{ border: '1px solid', borderColor: 'divider', borderRadius: 2.5, overflow: 'hidden' }}>
        {effectiveLoading ? (
          <Box role="status" aria-label="Loading online transactions" sx={{ minHeight: 280, display: 'grid', placeItems: 'center' }}>
            <CircularProgress />
          </Box>
        ) : error ? (
          <Box sx={{ p: 2 }}>
            <Alert
              severity="warning"
              action={
                <Button color="inherit" onClick={() => setRetryVersion((version) => version + 1)}>
                  Try again
                </Button>
              }
            >
              <Typography fontWeight={700}>Online transactions could not be loaded</Typography>
              {error} This is not confirmation that there are no online payments.
            </Alert>
          </Box>
        ) : visibleRows.length === 0 ? (
          <Box role="status" sx={{ px: 3, py: 7, textAlign: 'center' }}>
            <Box
              sx={{
                width: 52,
                height: 52,
                mx: 'auto',
                display: 'grid',
                placeItems: 'center',
                borderRadius: '50%',
                bgcolor: alpha(theme.palette.success.main, 0.1),
                color: 'success.main',
                fontSize: 22
              }}
            >
              <DollarOutlined />
            </Box>
            <Typography variant="h6" sx={{ mt: 1.5 }}>
              {summary.totalCount ? 'No transactions match this view' : 'No online transactions yet'}
            </Typography>
            <Typography sx={{ mt: 0.6, color: 'text.secondary', fontSize: '0.84rem' }}>
              {summary.totalCount
                ? 'Adjust the search or status filter to see more activity.'
                : 'Renter payments will appear here when online payment activity begins.'}
            </Typography>
          </Box>
        ) : (
          <>
            <Box
              sx={{
                px: 2,
                py: 1.15,
                display: { xs: 'none', xl: 'grid' },
                gridTemplateColumns: '105px 105px minmax(120px, 1fr) minmax(140px, 1.15fr) minmax(120px, .9fr) minmax(130px, .9fr) 95px 100px',
                gap: 2,
                bgcolor: alpha(theme.palette.primary.main, 0.035),
                borderBottom: '1px solid',
                borderColor: 'divider'
              }}
            >
              {['Payment date', 'Processed', 'Renter', 'Property', 'Method', 'Stripe ID', 'Status', 'Amount'].map((label) => (
                <Typography
                  key={label}
                  sx={{
                    fontSize: '0.68rem',
                    fontWeight: 760,
                    color: 'text.secondary',
                    letterSpacing: 0.5,
                    textTransform: 'uppercase',
                    textAlign: label === 'Amount' ? 'right' : 'left'
                  }}
                >
                  {label}
                </Typography>
              ))}
            </Box>
            {visibleRows.map((row) => {
              const statusView = getOnlinePaymentStatusPresentation(row.status);
              return (
                <Box
                  key={row.id ?? row.providerReference}
                  sx={{
                    px: 2,
                    py: 1.55,
                    display: 'grid',
                    gridTemplateColumns: {
                      xs: '1fr auto',
                      xl: '105px 105px minmax(120px, 1fr) minmax(140px, 1.15fr) minmax(120px, .9fr) minmax(130px, .9fr) 95px 100px'
                    },
                    gap: { xs: 1, xl: 2 },
                    alignItems: 'center',
                    borderBottom: '1px solid',
                    borderColor: alpha(theme.palette.divider, 0.7),
                    '&:hover': { bgcolor: alpha(theme.palette.primary.main, 0.025) }
                  }}
                >
                  <Box sx={{ gridColumn: { xs: '1', xl: 'auto' } }}>
                    <Typography sx={{ fontSize: '0.8rem', fontWeight: 650 }}>{formatPaymentDate(row.paidAt)}</Typography>
                  </Box>
                  <Typography sx={{ display: { xs: 'none', xl: 'block' }, fontSize: '0.78rem', color: row.processedAt ? 'text.primary' : 'text.secondary' }}>
                    {row.processedAt ? formatPaymentDate(row.processedAt) : 'Pending'}
                  </Typography>
                  <Box minWidth={0}>
                    <Typography noWrap sx={{ fontSize: '0.86rem', fontWeight: 750 }}>
                      {row.tenant}
                    </Typography>
                    <Typography sx={{ display: { xl: 'none' }, mt: 0.2, fontSize: '0.72rem', color: 'text.secondary' }}>
                      {row.location}
                    </Typography>
                    <Typography sx={{ display: { xl: 'none' }, mt: 0.25, fontSize: '0.7rem', color: 'text.secondary' }}>
                      Processed: {row.processedAt ? formatPaymentDate(row.processedAt) : 'Pending'}
                    </Typography>
                    <Typography title={row.providerReference} noWrap sx={{ display: { xl: 'none' }, mt: 0.2, maxWidth: 220, fontFamily: 'monospace', fontSize: '0.68rem', color: 'text.secondary' }}>
                      {row.providerReference}
                    </Typography>
                  </Box>
                  <Box minWidth={0} sx={{ display: { xs: 'none', xl: 'block' } }}>
                    <Typography noWrap sx={{ fontSize: '0.82rem', fontWeight: 650 }}>
                      {row.location}
                    </Typography>
                    <Typography sx={{ mt: 0.2, fontSize: '0.72rem', color: 'text.secondary' }}>Lease #{row.leaseId}</Typography>
                  </Box>
                  <Typography sx={{ gridColumn: { xs: '1', xl: 'auto' }, fontSize: '0.78rem', color: 'text.secondary' }}>
                    {row.method}
                  </Typography>
                  <Typography
                    title={row.providerReference}
                    noWrap
                    sx={{ display: { xs: 'none', xl: 'block' }, fontFamily: 'monospace', fontSize: '0.72rem', color: 'text.secondary' }}
                  >
                    {row.providerReference}
                  </Typography>
                  <Chip
                    label={statusView.label}
                    color={statusView.color}
                    variant={row.status === 'completed' ? 'filled' : 'outlined'}
                    size="small"
                    sx={{
                      gridColumn: { xs: '2', xl: 'auto' },
                      gridRow: { xs: '1', xl: 'auto' },
                      justifySelf: 'start',
                      height: 23,
                      fontSize: '0.67rem'
                    }}
                  />
                  <Typography
                    sx={{
                      gridColumn: { xs: '2', xl: 'auto' },
                      gridRow: { xs: '2 / span 2', xl: 'auto' },
                      alignSelf: 'center',
                      fontSize: '0.9rem',
                      fontWeight: 800,
                      textAlign: 'right',
                      color: row.status === 'completed' ? 'success.dark' : 'text.primary'
                    }}
                  >
                    {money.format(row.amount)}
                  </Typography>
                </Box>
              );
            })}
          </>
        )}

        {!effectiveLoading && !error && filteredRows.length > PAGE_SIZE && (
          <Stack
            direction={{ xs: 'column', sm: 'row' }}
            spacing={1.5}
            justifyContent="space-between"
            alignItems="center"
            sx={{ p: 2, borderTop: '1px solid', borderColor: 'divider' }}
          >
            <Typography sx={{ fontSize: '0.78rem', color: 'text.secondary' }}>
              Showing {(currentPage - 1) * PAGE_SIZE + 1}–{Math.min(currentPage * PAGE_SIZE, filteredRows.length)} of {filteredRows.length}
            </Typography>
            <Pagination
              count={totalPages}
              page={currentPage}
              onChange={(_event, value) => setPage(value)}
              size="small"
              color="primary"
              aria-label="Online transaction pages"
            />
          </Stack>
        )}
      </Paper>
    </Box>
  );
}
