import { useState, useEffect, useMemo, useRef, useCallback } from 'react';

// material-ui
import {
  Box,
  Typography,
  Paper,
  Stack,
  Avatar,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Button,
  Chip,
  CircularProgress,
  Alert,
  FormControl,
  MenuItem,
  Select,
  alpha
} from '@mui/material';
import { useTheme } from '@mui/material/styles';
import {
  DollarOutlined,
  CheckCircleOutlined,
  CalendarOutlined,
  HomeOutlined,
  ClockCircleOutlined,
  CloseCircleOutlined,
  WarningOutlined
} from '@ant-design/icons';

// hooks
import useAuth from 'hooks/useAuth';
import axiosServices from 'utils/axios';
import { formatCurrency, formatDate } from 'utils/formatters';
import { calculateNextPaymentDate } from 'utils/helper-methods';
import moment from 'moment';
import { useModal } from 'contexts/ModalContext';
import PaymentModal from 'components/drawers/PaymentModal';

// ==============================|| TENANT - PAYMENTS ||============================== //

const BALANCE_CREDITING_STATUSES = new Set(['completed', 'paid']);

function getPaymentStatus(payment) {
  return (payment?.status || payment?.Status || 'Completed').toString();
}

function isBalanceCreditingPayment(payment) {
  return BALANCE_CREDITING_STATUSES.has(getPaymentStatus(payment).toLowerCase());
}

function canRetryPayment(payment) {
  const status = getPaymentStatus(payment).toLowerCase();
  return payment?.canRetry || payment?.CanRetry || ['failed', 'canceled', 'cancelled', 'disputed'].includes(status);
}

function getPaymentStatusMeta(payment) {
  const status = getPaymentStatus(payment).toLowerCase();
  switch (status) {
    case 'completed':
    case 'paid':
      return { label: 'Paid', color: 'success', icon: <CheckCircleOutlined /> };
    case 'processing':
      return { label: 'Processing', color: 'info', icon: <ClockCircleOutlined /> };
    case 'failed':
      return { label: 'Failed', color: 'error', icon: <CloseCircleOutlined /> };
    case 'canceled':
    case 'cancelled':
      return { label: 'Canceled', color: 'default', icon: <CloseCircleOutlined /> };
    case 'disputed':
      return { label: 'Disputed', color: 'error', icon: <WarningOutlined /> };
    default:
      return { label: getPaymentStatus(payment), color: 'default', icon: null };
  }
}

function calculateOverdueAmount(lease, payments, today) {
  if (!lease || !lease.startDate) return 0;
  const leaseStart = moment(lease.startDate);
  const leaseEnd = lease.endDate ? moment(lease.endDate) : null;
  const effectiveEnd = leaseEnd && leaseEnd.isBefore(today) ? leaseEnd : today;
  const rentDueDay = lease.rentDueDay || 1;
  let firstDueDate = moment(lease.startDate);
  if (leaseStart.date() !== rentDueDay) {
    firstDueDate = moment(lease.startDate).date(rentDueDay);
    if (firstDueDate.isBefore(leaseStart)) firstDueDate = firstDueDate.add(1, 'month');
  }
  if (today.isBefore(firstDueDate, 'day')) return 0;
  const includeCurrentMonth = today.date() > rentDueDay;
  let monthsElapsed =
    (effectiveEnd.year() - firstDueDate.year()) * 12 + (effectiveEnd.month() - firstDueDate.month()) + (includeCurrentMonth ? 1 : 0);
  if (monthsElapsed < 0) monthsElapsed = 0;
  const expectedSoFar = monthsElapsed * (lease.rentAmount || 0);
  const leasePayments = payments
    .filter((p) => isBalanceCreditingPayment(p) && (p.leaseId === lease.id || p.LeaseId === lease.id))
    .reduce((sum, p) => sum + (p.amount || p.Amount || 0), 0);
  return Math.round(Math.max(expectedSoFar - leasePayments, 0) * 100) / 100;
}

function getLeaseUnitName(lease) {
  return lease?.unit?.name || lease?.unitName || lease?.UnitName || '';
}

function shouldShowLeaseUnitName(lease) {
  const unitName = getLeaseUnitName(lease);
  const normalizedPropertyType = String(lease?.propertyType || lease?.PropertyType || lease?.unit?.property?.propertyType || '')
    .toLowerCase()
    .replace(/[^a-z0-9]/g, '');
  const normalizedUnitName = String(unitName).toLowerCase().replace(/[^a-z0-9]/g, '');

  return Boolean(unitName) && normalizedPropertyType !== 'singlefamily' && normalizedUnitName !== 'unit1';
}

function LeaseListItem({ lease, selected, onClick }) {
  const theme = useTheme();
  const unitName = getLeaseUnitName(lease);
  const showUnitName = shouldShowLeaseUnitName(lease);

  return (
    <Box
      onClick={onClick}
      sx={{
        p: 1.5,
        cursor: 'pointer',
        borderRadius: 1.5,
        border: `1.5px solid ${selected ? theme.palette.primary.main : 'transparent'}`,
        bgcolor: selected ? alpha(theme.palette.primary.main, 0.06) : 'transparent',
        transition: 'all 0.15s',
        '&:hover': {
          bgcolor: selected ? alpha(theme.palette.primary.main, 0.08) : alpha(theme.palette.action.hover, 0.5),
          border: `1.5px solid ${selected ? theme.palette.primary.main : alpha(theme.palette.divider, 0.4)}`
        }
      }}
    >
      <Stack direction="row" spacing={1.5} alignItems="center">
        <Avatar
          src={lease.propertyImageUrl || undefined}
          sx={{
            width: 42,
            height: 42,
            borderRadius: 1.5,
            bgcolor: alpha(theme.palette.primary.main, 0.1),
            color: 'primary.main',
            flexShrink: 0,
            fontSize: 18
          }}
        >
          {!lease.propertyImageUrl && <HomeOutlined />}
        </Avatar>
        <Box sx={{ minWidth: 0, flex: 1 }}>
          <Stack direction="row" alignItems="center" justifyContent="space-between" spacing={0.5}>
            <Typography variant="body2" fontWeight={600} noWrap sx={{ flex: 1 }}>
              {lease.propertyName || 'Property'}
            </Typography>
            <Box
              sx={{ width: 8, height: 8, borderRadius: '50%', bgcolor: lease.isActive ? 'success.main' : 'text.disabled', flexShrink: 0 }}
            />
          </Stack>
          {showUnitName && (
            <Typography variant="caption" color="text.secondary" noWrap sx={{ display: 'block' }}>
              {unitName}
            </Typography>
          )}
        </Box>
      </Stack>
    </Box>
  );
}

function getLeaseLabel(lease) {
  const propertyName = lease?.unit?.property?.name || lease?.propertyName || 'Property';
  const unitName = getLeaseUnitName(lease);
  return shouldShowLeaseUnitName(lease) ? `${propertyName} · ${unitName}` : propertyName;
}

function StatCard({ icon, label, value, accent, highlight }) {
  const theme = useTheme();
  return (
    <Paper
      variant="outlined"
      sx={{
        p: 2,
        flex: 1,
        borderRadius: 2,
        border: highlight ? `1px solid ${alpha(highlight, 0.3)}` : `1px solid ${alpha(theme.palette.divider, 0.08)}`,
        bgcolor: highlight ? alpha(highlight, 0.05) : alpha(theme.palette.background.paper, 0.7)
      }}
    >
      <Stack spacing={0.5}>
        <Stack direction="row" spacing={1} alignItems="center">
          <Box sx={{ color: accent || 'primary.main', lineHeight: 0 }}>{icon}</Box>
          <Typography variant="caption" color="text.secondary" fontWeight={500} sx={{ textTransform: 'uppercase', letterSpacing: 0.5 }}>
            {label}
          </Typography>
        </Stack>
        <Typography variant="h6" fontWeight={700} color={highlight || 'text.primary'} sx={{ pl: 0.25 }}>
          {value || '—'}
        </Typography>
      </Stack>
    </Paper>
  );
}

export default function TenantPayments() {
  const theme = useTheme();
  const { user } = useAuth();
  const modal = useModal();

  const [leases, setLeases] = useState([]);
  const [selectedLeaseId, setSelectedLeaseId] = useState(null);
  const [payments, setPayments] = useState([]);
  const [rentCollection, setRentCollection] = useState(null);
  const [loading, setLoading] = useState(true);
  const [loadingPayments, setLoadingPayments] = useState(false);
  const [error, setError] = useState(null);
  const wasModalOpen = useRef(false);

  const selectedLease = useMemo(() => leases.find((l) => l.id === selectedLeaseId) || null, [leases, selectedLeaseId]);

  // Fetch all leases on mount
  useEffect(() => {
    const fetchLeases = async () => {
      try {
        setLoading(true);
        const res = await axiosServices.get('/api/lease/tenant/my-leases');
        if (res.data?.success && res.data?.data) {
          const all = res.data.data;
          setLeases(all);
          const active = all.find((l) => l.isActive) || all[0];
          if (active) setSelectedLeaseId(active.id);
        }
      } catch (err) {
        const status = err?.response?.status || err?.status;
        if (status !== 404) setError(err?.response?.data?.message || err?.message || 'Failed to load leases');
      } finally {
        setLoading(false);
      }
    };
    if (user?.Id || user?.id) fetchLeases();
  }, [user]);

  // Fetch payments + rent collection when selected lease changes
  const fetchPaymentData = useCallback(
    async (leaseId) => {
      if (!leaseId) return;
      setLoadingPayments(true);
      try {
        const [paymentsRes] = await Promise.allSettled([axiosServices.get(`/api/payment/${leaseId}`)]);
        if (paymentsRes.status === 'fulfilled') {
          const data = paymentsRes.value.data?.data || paymentsRes.value.data || [];
          setPayments(Array.isArray(data) ? data : []);
        }

        // Rent collection (tenant-scoped)
        try {
          const rcRes = await axiosServices.get('/api/rent-collection/tenant/my-rent', { params: { leaseId } });
          if (rcRes.data?.success) setRentCollection(rcRes.data.data);
        } catch {
          // fallback
          try {
            const lease = leases.find((l) => l.id === leaseId);
            const landlordId = lease?.landlordId;
            if (landlordId) {
              const rcRes = await axiosServices.get('/api/rent-collection', { params: { landlordId, leaseId, lifetime: false } });
              if (rcRes.data?.success) setRentCollection(rcRes.data.data);
            }
          } catch {
            setRentCollection(null);
          }
        }
      } catch {
        setPayments([]);
      } finally {
        setLoadingPayments(false);
      }
    },
    [leases]
  );

  useEffect(() => {
    if (selectedLeaseId) fetchPaymentData(selectedLeaseId);
  }, [selectedLeaseId, fetchPaymentData]);

  // Refetch after payment modal closes
  useEffect(() => {
    if (wasModalOpen.current && !modal.openPayment && selectedLeaseId) {
      const timer = setTimeout(() => fetchPaymentData(selectedLeaseId), 300);
      wasModalOpen.current = false;
      return () => clearTimeout(timer);
    }
    if (modal.openPayment) wasModalOpen.current = true;
  }, [modal.openPayment, selectedLeaseId, fetchPaymentData]);

  // Summary stats
  const summary = useMemo(() => {
    if (!selectedLease)
      return { totalPaid: 0, amountDue: 0, overdueAmount: 0, isOverdue: false, nextPaymentDate: null, lastPaymentDate: null };

    const today = moment();
    const balanceCreditingPayments = payments.filter(isBalanceCreditingPayment);
    const totalPaid = balanceCreditingPayments.reduce((sum, p) => sum + (p.amount || 0), 0);
    const pendingPayments = payments.filter((p) => getPaymentStatus(p).toLowerCase() === 'processing');
    const retryablePayments = payments.filter(canRetryPayment);
    const sorted = [...payments].sort((a, b) => new Date(b.paymentDate) - new Date(a.paymentDate));
    const lastPaymentDate = sorted[0]?.paymentDate || null;

    const rentRecords = rentCollection?.rentRecords || rentCollection?.RentRecords || [];
    const leaseRecord = rentRecords.find((r) => r.leaseId === selectedLease.id || r.LeaseId === selectedLease.id);

    const overdueAmount = leaseRecord
      ? leaseRecord.overdueAmount || leaseRecord.OverdueAmount || 0
      : calculateOverdueAmount(selectedLease, payments, today);

    const rentAmount = leaseRecord?.rentAmount || leaseRecord?.RentAmount || selectedLease.rentAmount || 0;
    const amountDueNow = leaseRecord?.amountDueNow ?? leaseRecord?.AmountDueNow;
    const amountDue = amountDueNow != null ? amountDueNow : rentAmount + overdueAmount;

    const rentDueDay = selectedLease.rentDueDay || 1;
    const leaseStartDate = moment(selectedLease.startDate);
    const baseNext = calculateNextPaymentDate(selectedLease.startDate, rentDueDay, selectedLease.endDate);
    let nextDue = baseNext ? moment(baseNext) : null;

    if (nextDue) {
      const hasPaid = balanceCreditingPayments.some((p) => {
        const pd = moment(p.paymentDate);
        if (nextDue.isSame(leaseStartDate, 'day')) return pd.isSameOrAfter(leaseStartDate, 'day');
        return pd.isSame(nextDue, 'year') && pd.isSame(nextDue, 'month') && pd.isSameOrBefore(nextDue, 'day');
      });
      if (nextDue.isBefore(today, 'day') && hasPaid) {
        nextDue = nextDue.isSame(leaseStartDate, 'day')
          ? moment().add(1, 'month').date(rentDueDay)
          : nextDue.add(1, 'month').date(rentDueDay);
        if (selectedLease.endDate && nextDue.isAfter(moment(selectedLease.endDate), 'day')) {
          nextDue = moment(selectedLease.endDate);
        }
      }
    }

    return {
      totalPaid,
      amountDue,
      overdueAmount,
      isOverdue: overdueAmount > 0,
      nextPaymentDate: nextDue?.toDate() || null,
      lastPaymentDate,
      pendingPayments,
      retryablePayments
    };
  }, [payments, selectedLease, rentCollection]);

  const sortedPayments = useMemo(() => [...payments].sort((a, b) => new Date(b.paymentDate) - new Date(a.paymentDate)), [payments]);

  const propertyDisplay = selectedLease?.unit?.property?.name || selectedLease?.propertyName || 'Property';
  const unitDisplay = getLeaseUnitName(selectedLease);
  const showSelectedUnitName = shouldShowLeaseUnitName(selectedLease);

  const openPaymentForSelectedLease = () => {
    if (!selectedLease) return;

    const rentRecords = rentCollection?.rentRecords || rentCollection?.RentRecords || [];
    const leaseRecord = rentRecords.find((r) => r.leaseId === selectedLease.id || r.LeaseId === selectedLease.id);
    const rentForModal = leaseRecord
      ? { ...leaseRecord, propertyName: propertyDisplay, unitName: unitDisplay }
      : {
          id: selectedLease.id,
          leaseId: selectedLease.id,
          rentAmount: selectedLease.rentAmount || 0,
          overdueAmount: summary.overdueAmount || 0,
          amountDueNow: summary.amountDue || 0,
          propertyName: propertyDisplay,
          unitName: unitDisplay,
          propertyType: selectedLease.unit?.property?.propertyType || selectedLease.propertyType
        };

    modal.openPaymentModal(rentForModal);
  };

  const panelSx = {
    borderRadius: 2,
    border: `1px solid ${alpha(theme.palette.divider, 0.1)}`,
    bgcolor: alpha(theme.palette.background.paper, 0.6),
    boxShadow: (t) => `0 0 20px ${alpha(t.palette.primary.main, 0.15)}`
  };

  // ── States ─────────────────────────────────────────────────────────────────

  if (loading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '400px' }}>
        <CircularProgress />
      </Box>
    );
  }

  if (error) {
    return (
      <Box>
        <Typography variant="h4" fontWeight="bold" sx={{ mb: 2 }}>
          Payments
        </Typography>
        <Alert severity="error">{error}</Alert>
      </Box>
    );
  }

  if (!leases.length) {
    return (
      <Box>
        <Typography variant="h4" fontWeight="bold" sx={{ mb: 2 }}>
          Payments
        </Typography>
        <Alert severity="info">
          <Typography variant="body1" sx={{ mb: 1, fontWeight: 600 }}>
            Lease Not Set Up
          </Typography>
          <Typography variant="body2">
            Your landlord has not set up the lease yet. Payment information will appear here once your landlord creates and assigns a lease
            to your account.
          </Typography>
        </Alert>
      </Box>
    );
  }

  // ── Main layout ─────────────────────────────────────────────────────────────

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', height: '100%', px: { xs: 0, sm: 0 } }}>
      {/* Page header */}
      <Box sx={{ mb: { xs: 2, sm: 2.5 } }}>
        <Typography variant="h4" fontWeight="bold" sx={{ fontSize: { xs: '1.65rem', sm: '2.125rem' } }}>
          Payments
        </Typography>
        <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
          View your payment history and make payments.
        </Typography>
      </Box>

      {/* Mobile lease selector */}
      <Paper
        variant="outlined"
        sx={{
          display: { xs: 'block', md: 'none' },
          mb: 2,
          p: 1.5,
          borderRadius: 2,
          border: `1px solid ${alpha(theme.palette.divider, 0.1)}`,
          bgcolor: alpha(theme.palette.background.paper, 0.72),
          boxShadow: (t) => `0 10px 28px ${alpha(t.palette.primary.main, 0.1)}`
        }}
      >
        <Stack spacing={1}>
          <Stack direction="row" alignItems="center" justifyContent="space-between" spacing={1}>
            <Typography variant="caption" color="text.secondary" fontWeight={700} sx={{ textTransform: 'uppercase', letterSpacing: 0.6 }}>
              Select lease
            </Typography>
            <Chip size="small" label={`${leases.length} ${leases.length === 1 ? 'Lease' : 'Leases'}`} sx={{ height: 22, fontSize: '0.7rem', fontWeight: 600 }} />
          </Stack>
          <FormControl fullWidth size="small">
            <Select
              value={selectedLeaseId || ''}
              onChange={(event) => setSelectedLeaseId(Number(event.target.value))}
              displayEmpty
              sx={{ borderRadius: 1.5, bgcolor: alpha(theme.palette.background.default, 0.42), '& .MuiSelect-select': { py: 1.1, fontWeight: 650 } }}
            >
              {leases.map((lease) => (
                <MenuItem key={lease.id} value={lease.id}>
                  <Stack direction="row" spacing={1} alignItems="center" sx={{ minWidth: 0 }}>
                    <Box sx={{ width: 8, height: 8, borderRadius: '50%', bgcolor: lease.isActive ? 'success.main' : 'text.disabled', flexShrink: 0 }} />
                    <Typography variant="body2" noWrap>{getLeaseLabel(lease)}</Typography>
                  </Stack>
                </MenuItem>
              ))}
            </Select>
          </FormControl>
        </Stack>
      </Paper>

      <Box sx={{ display: 'flex', gap: { xs: 0, md: 2.5 }, flex: 1, minHeight: 0, alignItems: 'flex-start' }}>
        {/* ── Left: Lease selector ──────────────────────────────────────────── */}
        <Paper
          variant="outlined"
          sx={{ display: { xs: 'none', md: 'block' }, width: 260, flexShrink: 0, overflow: 'hidden', position: 'sticky', top: 0, ...panelSx }}
        >
          <Box sx={{ px: 2, py: 1.5, borderBottom: `1px solid ${alpha(theme.palette.divider, 0.08)}` }}>
            <Typography variant="caption" color="text.secondary" fontWeight={600} sx={{ textTransform: 'uppercase', letterSpacing: 0.6 }}>
              {leases.length} {leases.length === 1 ? 'Lease' : 'Leases'}
            </Typography>
          </Box>
          <Stack spacing={0.5} sx={{ p: 1 }}>
            {leases.map((lease) => (
              <LeaseListItem
                key={lease.id}
                lease={lease}
                selected={lease.id === selectedLeaseId}
                onClick={() => setSelectedLeaseId(lease.id)}
              />
            ))}
          </Stack>
        </Paper>

        {/* ── Right: Payment detail ──────────────────────────────────────────── */}
        <Box sx={{ flex: 1, minWidth: 0, width: '100%' }}>
          {!selectedLease ? (
            <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: 300 }}>
              <Typography variant="body2" color="text.secondary">
                Select a lease to view payments
              </Typography>
            </Box>
          ) : (
            <Stack spacing={{ xs: 2, sm: 2.5 }}>
              {/* Property + Stats */}
              <Paper variant="outlined" sx={{ overflow: 'hidden', ...panelSx }}>
                {/* Panel header — matches maintenance page style */}
                <Stack
                  direction={{ xs: 'column', sm: 'row' }}
                  alignItems={{ xs: 'stretch', sm: 'center' }}
                  justifyContent="space-between"
                  spacing={{ xs: 1.5, sm: 2 }}
                  sx={{ px: { xs: 1.75, sm: 2.5 }, py: { xs: 1.75, sm: 2 }, borderBottom: `1px solid ${alpha(theme.palette.divider, 0.08)}` }}
                >
                  <Box sx={{ minWidth: 0 }}>
                    <Stack direction={{ xs: 'column', sm: 'row' }} spacing={{ xs: 0.75, sm: 1 }} alignItems={{ xs: 'flex-start', sm: 'center' }}>
                      <Typography variant="subtitle1" fontWeight={700} sx={{ lineHeight: 1.2 }}>
                        {propertyDisplay}
                      </Typography>
                      {showSelectedUnitName && (
                        <Typography variant="body2" color="text.secondary">
                          · {unitDisplay}
                        </Typography>
                      )}
                      <Chip
                        size="small"
                        label={selectedLease.isActive ? 'Active' : 'Inactive'}
                        color={selectedLease.isActive ? 'success' : 'default'}
                        sx={{ height: 20, fontSize: '0.7rem', fontWeight: 600 }}
                      />
                    </Stack>
                  </Box>
                  <Button
                    variant="contained"
                    color="success"
                    size="small"
                    startIcon={<DollarOutlined />}
                    onClick={openPaymentForSelectedLease}
                    sx={{ textTransform: 'none', fontWeight: 600, whiteSpace: 'nowrap', width: { xs: '100%', sm: 'auto' } }}
                  >
                    Make Payment{summary.amountDue > 0 && ` · ${formatCurrency(summary.amountDue)}`}
                  </Button>
                </Stack>

                {/* Stat cards */}
                <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1.5} sx={{ p: { xs: 1.5, sm: 2 } }}>
                  <StatCard
                    icon={<DollarOutlined style={{ fontSize: 15 }} />}
                    label="Amount Due"
                    value={formatCurrency(summary.amountDue)}
                    accent={summary.isOverdue ? theme.palette.error.main : theme.palette.success.main}
                    highlight={summary.isOverdue ? theme.palette.error.main : null}
                  />
                  <StatCard
                    icon={<CalendarOutlined style={{ fontSize: 15 }} />}
                    label="Next Payment"
                    value={summary.nextPaymentDate ? formatDate(summary.nextPaymentDate) : 'N/A'}
                  />
                  <StatCard
                    icon={<DollarOutlined style={{ fontSize: 15 }} />}
                    label="Total Paid"
                    value={formatCurrency(summary.totalPaid)}
                    accent={theme.palette.success.main}
                  />
                  <StatCard
                    icon={<CalendarOutlined style={{ fontSize: 15 }} />}
                    label="Last Payment"
                    value={summary.lastPaymentDate ? formatDate(summary.lastPaymentDate) : 'None'}
                  />
                </Stack>

                {summary.retryablePayments?.length > 0 && (
                  <Alert
                    severity="warning"
                    action={
                      <Button color="inherit" size="small" onClick={openPaymentForSelectedLease}>
                        Try another payment method
                      </Button>
                    }
                    sx={{ mx: 2, mb: 2 }}
                  >
                    A previous payment failed, was canceled, or was disputed. That amount has been added back to your balance.
                  </Alert>
                )}
              </Paper>

              {/* Payment history */}
              <Paper variant="outlined" sx={{ overflow: 'hidden', ...panelSx }}>
                <Box sx={{ px: 2.5, py: 2, borderBottom: `1px solid ${alpha(theme.palette.divider, 0.08)}` }}>
                  <Typography variant="subtitle1" fontWeight={700}>
                    Payment History
                  </Typography>
                  <Typography variant="caption" color="text.secondary">
                    {sortedPayments.length} {sortedPayments.length === 1 ? 'payment' : 'payments'} recorded
                  </Typography>
                </Box>

                {loadingPayments ? (
                  <Box sx={{ display: 'flex', justifyContent: 'center', py: 6 }}>
                    <CircularProgress size={28} />
                  </Box>
                ) : (
                  <TableContainer sx={{ display: { xs: 'none', md: 'block' } }}>
                    <Table size="small" sx={{ tableLayout: 'fixed' }}>
                      <TableHead>
                        <TableRow sx={{ bgcolor: alpha(theme.palette.primary.main, 0.04) }}>
                          <TableCell sx={{ width: '20%', fontWeight: 600, fontSize: '0.75rem' }}>Date</TableCell>
                          <TableCell sx={{ width: '15%', fontWeight: 600, fontSize: '0.75rem' }}>Amount</TableCell>
                          <TableCell sx={{ width: '15%', fontWeight: 600, fontSize: '0.75rem' }}>Status</TableCell>
                          <TableCell sx={{ width: '20%', fontWeight: 600, fontSize: '0.75rem' }}>Method</TableCell>
                          <TableCell sx={{ width: '18%', fontWeight: 600, fontSize: '0.75rem' }}>Reference</TableCell>
                          <TableCell sx={{ width: '12%', fontWeight: 600, fontSize: '0.75rem' }}>Action</TableCell>
                        </TableRow>
                      </TableHead>
                      <TableBody>
                        {sortedPayments.length === 0 ? (
                          <TableRow>
                            <TableCell colSpan={6} align="center" sx={{ py: 6, borderBottom: 0 }}>
                              <DollarOutlined style={{ fontSize: 40, color: theme.palette.text.disabled, marginBottom: 8 }} />
                              <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
                                No payments recorded yet
                              </Typography>
                            </TableCell>
                          </TableRow>
                        ) : (
                          sortedPayments.map((payment, index) => {
                            const statusMeta = getPaymentStatusMeta(payment);
                            const showRetry = canRetryPayment(payment);

                            return (
                              <TableRow
                                key={payment.id || index}
                                sx={{
                                  '&:last-child td': { borderBottom: 0 },
                                  '&:hover': { bgcolor: alpha(theme.palette.primary.main, 0.03) }
                                }}
                              >
                                <TableCell sx={{ py: 1.5 }}>
                                  <Typography variant="body2" fontWeight={600}>
                                    {moment(payment.paymentDate).format('MMM D, YYYY')}
                                  </Typography>
                                  <Typography variant="caption" color="text.secondary">
                                    {moment(payment.paymentDate).format('h:mm A')}
                                  </Typography>
                                </TableCell>
                                <TableCell sx={{ py: 1.5 }}>
                                  <Typography variant="body2" fontWeight={700} color="text.primary">
                                    {formatCurrency(payment.amount || 0)}
                                  </Typography>
                                </TableCell>
                                <TableCell sx={{ py: 1.5 }}>
                                  <Chip
                                    size="small"
                                    label={statusMeta.label}
                                    color={statusMeta.color}
                                    icon={statusMeta.icon}
                                    sx={{ fontSize: '0.7rem', height: 22, fontWeight: 600 }}
                                  />
                                </TableCell>
                                <TableCell sx={{ py: 1.5 }}>
                                  <Typography variant="body2" color="text.secondary">
                                    {payment.method || payment.paymentMethod || '—'}
                                  </Typography>
                                </TableCell>
                                <TableCell sx={{ py: 1.5 }}>
                                  <Typography variant="body2" color="text.secondary" sx={{ fontFamily: 'monospace', fontSize: '0.75rem' }}>
                                    {payment.reference || payment.referenceNumber || '—'}
                                  </Typography>
                                </TableCell>
                                <TableCell sx={{ py: 1.5 }}>
                                  {showRetry ? (
                                    <Button
                                      size="small"
                                      variant="outlined"
                                      color="warning"
                                      onClick={openPaymentForSelectedLease}
                                      sx={{ textTransform: 'none' }}
                                    >
                                      Retry
                                    </Button>
                                  ) : (
                                    <Typography variant="caption" color="text.disabled">
                                      —
                                    </Typography>
                                  )}
                                </TableCell>
                              </TableRow>
                            );
                          })
                        )}
                      </TableBody>
                    </Table>
                  </TableContainer>
                )}

                {!loadingPayments && (
                  <Stack spacing={1.25} sx={{ display: { xs: 'flex', md: 'none' }, p: { xs: 1.5, sm: 2 }, pt: 1.5 }}>
                    {sortedPayments.length === 0 ? (
                      <Box sx={{ textAlign: 'center', py: 4 }}>
                        <DollarOutlined style={{ fontSize: 36, color: theme.palette.text.disabled, marginBottom: 8 }} />
                        <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
                          No payments recorded yet
                        </Typography>
                      </Box>
                    ) : (
                      sortedPayments.map((payment, index) => {
                        const statusMeta = getPaymentStatusMeta(payment);
                        const showRetry = canRetryPayment(payment);

                        return (
                          <Paper
                            key={payment.id || index}
                            variant="outlined"
                            sx={{
                              p: 1.5,
                              borderRadius: 2,
                              borderColor: alpha(theme.palette.divider, 0.12),
                              bgcolor: alpha(theme.palette.background.default, 0.28)
                            }}
                          >
                            <Stack spacing={1.25}>
                              <Stack direction="row" alignItems="flex-start" justifyContent="space-between" spacing={1.5}>
                                <Box sx={{ minWidth: 0 }}>
                                  <Typography variant="body2" fontWeight={700}>
                                    {moment(payment.paymentDate).format('MMM D, YYYY')}
                                  </Typography>
                                  <Typography variant="caption" color="text.secondary">
                                    {moment(payment.paymentDate).format('h:mm A')}
                                  </Typography>
                                </Box>
                                <Typography variant="subtitle1" fontWeight={800} color="text.primary" sx={{ flexShrink: 0 }}>
                                  {formatCurrency(payment.amount || 0)}
                                </Typography>
                              </Stack>

                              <Stack direction="row" alignItems="center" justifyContent="space-between" spacing={1.5}>
                                <Typography variant="caption" color="text.secondary" fontWeight={600} sx={{ textTransform: 'uppercase', letterSpacing: 0.4 }}>
                                  Status
                                </Typography>
                                <Chip
                                  size="small"
                                  label={statusMeta.label}
                                  color={statusMeta.color}
                                  icon={statusMeta.icon}
                                  sx={{ fontSize: '0.7rem', height: 22, fontWeight: 600 }}
                                />
                              </Stack>

                              <Stack spacing={0.75}>
                                <Stack direction="row" justifyContent="space-between" spacing={2}>
                                  <Typography variant="caption" color="text.secondary">
                                    Method
                                  </Typography>
                                  <Typography variant="body2" color="text.primary" textAlign="right" sx={{ minWidth: 0, overflowWrap: 'anywhere' }}>
                                    {payment.method || payment.paymentMethod || '—'}
                                  </Typography>
                                </Stack>
                                <Stack direction="row" justifyContent="space-between" spacing={2}>
                                  <Typography variant="caption" color="text.secondary">
                                    Reference
                                  </Typography>
                                  <Typography
                                    variant="body2"
                                    color="text.primary"
                                    textAlign="right"
                                    sx={{ fontFamily: 'monospace', fontSize: '0.75rem', minWidth: 0, overflowWrap: 'anywhere' }}
                                  >
                                    {payment.reference || payment.referenceNumber || '—'}
                                  </Typography>
                                </Stack>
                              </Stack>

                              {showRetry && (
                                <Button fullWidth size="small" variant="outlined" color="warning" onClick={openPaymentForSelectedLease} sx={{ textTransform: 'none' }}>
                                  Retry payment
                                </Button>
                              )}
                            </Stack>
                          </Paper>
                        );
                      })
                    )}
                  </Stack>
                )}
              </Paper>
            </Stack>
          )}
        </Box>
      </Box>

      {/* Payment Modal */}
      <PaymentModal
        open={modal.openPayment}
        rent={modal.selectedRent}
        onClose={modal.closePaymentModal}
        defaultAmount={selectedLease?.rentAmount}
      />
    </Box>
  );
}
