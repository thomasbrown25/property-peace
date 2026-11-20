import { isDetachedSingleUnitType } from 'utils/propertyType';
import { useState, useEffect, useMemo, useRef, useCallback } from 'react';

// material-ui
import {
  Box,
  Typography,
  Paper,
  Stack,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Button,
  Chip,
  CircularProgress,
  InputAdornment,
  TextField,
  Alert
} from '@mui/material';
import { DollarOutlined, CalendarOutlined, SearchOutlined } from '@ant-design/icons';

// hooks
import useAuth from 'hooks/useAuth';
import axiosServices from 'utils/axios';
import { formatCurrency, formatDate } from 'utils/formatters';
import { calculateNextPaymentDate } from 'utils/helper-methods';
import moment from 'moment';
import { useModal } from 'contexts/ModalContext';
import PaymentModal from 'components/drawers/PaymentModal';
import useRentPaymentActionReadiness from 'hooks/useRentPaymentActionReadiness';
import { classifyPaymentStatus, isBalanceCreditingPayment } from 'utils/paymentSafety';
import { normalizeRentBalance } from 'utils/rentBalance';
import LeaseChargeList from 'components/payments/LeaseChargeList';
import { readChargesResponse } from 'utils/leaseCharges';
import { feeCheckoutSelection } from 'utils/feeCheckout';
import TenantLeaseFilter from 'components/filters/TenantLeaseFilter';
import PortalListPagination from 'components/table/PortalListPagination';
import { paginateRows } from 'components/table/paginateRows.mjs';
import { filterControlSx } from 'themes/filterControlStyles';
import { getStatusPillSx } from 'themes/statusPillStyles';
import { getPortalListTableSx } from 'themes/tableStyles';
import { filterPaymentHistory, getPaymentStatusMeta } from './paymentHistory.mjs';

// ==============================|| TENANT - PAYMENTS ||============================== //

function getPaymentStatus(payment) {
  return classifyPaymentStatus(payment).status;
}

function canRetryPayment(payment) {
  return classifyPaymentStatus(payment).retryable;
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

  return Boolean(unitName) && !isDetachedSingleUnitType(normalizedPropertyType) && normalizedUnitName !== 'unit1';
}

function StatCard({ icon, label, value, overdue }) {
  return (
    <Paper
      variant="outlined"
      sx={{
        p: 2,
        flex: 1,
        borderRadius: 2,
        borderColor: 'divider',
        bgcolor: 'background.paper'
      }}
    >
      <Stack spacing={0.5}>
        <Stack direction="row" spacing={1} alignItems="center">
          <Box sx={{ color: overdue ? 'error.main' : 'primary.main', lineHeight: 0 }}>{icon}</Box>
          <Typography variant="caption" color="text.secondary" fontWeight={500} sx={{ textTransform: 'uppercase', letterSpacing: 0.5 }}>
            {label}
          </Typography>
        </Stack>
        <Typography variant="h6" fontWeight={700} color={overdue ? 'error.main' : 'text.primary'} sx={{ pl: 0.25 }}>
          {value || '—'}
        </Typography>
      </Stack>
    </Paper>
  );
}

export default function TenantPayments() {
  const { user } = useAuth();
  const modal = useModal();
  const { canInvoke } = useRentPaymentActionReadiness('Pay');

  const [leases, setLeases] = useState([]);
  const [selectedLeaseId, setSelectedLeaseId] = useState(null);
  const [payments, setPayments] = useState([]);
  const [historyFilters, setHistoryFilters] = useState({ search: '', fromDate: '', toDate: '' });
  const [historyPage, setHistoryPage] = useState(0);
  const [historyPageSize, setHistoryPageSize] = useState(10);
  const [charges, setCharges] = useState([]);
  const [chargeResultLeaseId, setChargeResultLeaseId] = useState(null);
  const [chargesLoading, setChargesLoading] = useState(false);
  const [chargesError, setChargesError] = useState('');
  const [chargeRefresh, setChargeRefresh] = useState(0);
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
        const [paymentsRes] = await Promise.allSettled([axiosServices.get(`/api/payment/${leaseId}/tenant-history`)]);
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
    setHistoryPage(0);
    if (selectedLeaseId) fetchPaymentData(selectedLeaseId);
  }, [selectedLeaseId, fetchPaymentData]);

  useEffect(() => {
    if (!selectedLeaseId) return undefined;
    let active = true;
    const leaseId = selectedLeaseId;
    setCharges([]);
    setChargeResultLeaseId(null);
    setChargesError('');
    setChargesLoading(true);
    axiosServices.get(`/api/payment/${leaseId}/tenant-charges`)
      .then((response) => { if (active) { setCharges(readChargesResponse(response.data)); setChargeResultLeaseId(leaseId); } })
      .catch((err) => { if (active) setChargesError(err?.response?.data?.message || 'Charge information is unavailable.'); })
      .finally(() => { if (active) setChargesLoading(false); });
    return () => { active = false; };
  }, [selectedLeaseId, chargeRefresh]);

  // Refetch after payment modal closes
  useEffect(() => {
    if (wasModalOpen.current && !modal.openPayment && selectedLeaseId) {
      const timer = setTimeout(() => {
        fetchPaymentData(selectedLeaseId);
        setChargeRefresh((count) => count + 1);
      }, 300);
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

    // Collection records use the canonical balance; only the no-record path keeps
    // the local schedule fallback for older/property-only responses.
    const normalizedBalance = leaseRecord ? normalizeRentBalance(leaseRecord) : null;
    const overdueAmount = normalizedBalance?.overdueAmount ?? calculateOverdueAmount(selectedLease, payments, today);
    const amountDue = normalizedBalance?.rentDue ?? ((selectedLease.rentAmount || 0) + overdueAmount);

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
  const filteredPayments = useMemo(() => filterPaymentHistory(sortedPayments, historyFilters), [sortedPayments, historyFilters]);
  const { page: visibleHistoryPage, pageCount, rows: visiblePayments, start, end } = paginateRows(filteredPayments, historyPage, historyPageSize);
  const emptyHistoryMessage = sortedPayments.length ? 'No payments match your filters.' : 'No payments recorded yet';
  const invalidDateRange = Boolean(historyFilters.fromDate && historyFilters.toDate && historyFilters.fromDate > historyFilters.toDate);

  const handleHistoryFilterChange = (event) => {
    const { name, value } = event.target;
    setHistoryFilters((filters) => ({ ...filters, [name]: value }));
    setHistoryPage(0);
  };

  const handleHistoryPageSizeChange = (size) => {
    setHistoryPageSize(size);
    setHistoryPage(0);
  };

  const propertyDisplay = selectedLease?.unit?.property?.name || selectedLease?.propertyName || 'Property';
  const unitDisplay = getLeaseUnitName(selectedLease);
  const showSelectedUnitName = shouldShowLeaseUnitName(selectedLease);

  const openPaymentForSelectedLease = () => {
    if (!canInvoke) return;
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
          rentDue: summary.amountDue || 0,
          amountDueNow: summary.amountDue || 0,
          propertyName: propertyDisplay,
          unitName: unitDisplay,
          propertyType: selectedLease.unit?.property?.propertyType || selectedLease.propertyType
        };

    modal.openPaymentModal(rentForModal);
  };

  const openPaymentForFee = (charge) => {
    if (!canInvoke || !selectedLease || chargesLoading || chargesError || chargeResultLeaseId !== selectedLease.id) return;
    const current = charges.find((row) => row.chargeId === charge.chargeId);
    const selection = feeCheckoutSelection(current);
    if (!selection) return; // Invalid fee selectors must never fall back to rent.
    modal.openPaymentModal({
      leaseId: selectedLease.id,
      isFee: true,
      chargeId: selection.chargeId,
      feeName: selection.title,
      remainingCents: selection.remainingCents,
      rentAmount: selection.remainingCents / 100,
      propertyName: propertyDisplay,
      unitName: unitDisplay,
      propertyType: selectedLease.unit?.property?.propertyType || selectedLease.propertyType
    });
  };

  const panelSx = { borderRadius: 3, borderColor: 'divider', bgcolor: 'background.paper', overflow: 'hidden' };

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

      <Box sx={{ display: 'flex', justifyContent: { xs: 'stretch', sm: 'flex-end' }, mb: 2 }}>
        <TenantLeaseFilter leases={leases} selectedLeaseId={selectedLeaseId} onChange={setSelectedLeaseId} />
      </Box>

      <Box sx={{ display: 'flex', flex: 1, minHeight: 0, alignItems: 'flex-start' }}>
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
              <Paper variant="outlined" sx={panelSx}>
                {/* Panel header — matches maintenance page style */}
                <Stack
                  direction={{ xs: 'column', sm: 'row' }}
                  alignItems={{ xs: 'stretch', sm: 'center' }}
                  justifyContent="space-between"
                  spacing={{ xs: 1.5, sm: 2 }}
                  sx={{ px: { xs: 1.75, sm: 2.5 }, py: { xs: 1.75, sm: 2 }, borderBottom: 1, borderColor: 'divider' }}
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
                        sx={(theme) => getStatusPillSx(theme, selectedLease.isActive ? 'success' : 'default')}
                      />
                    </Stack>
                  </Box>
                  <Button
                    variant="contained"
                    color="primary"
                    size="small"
                    startIcon={<DollarOutlined />}
                    onClick={openPaymentForSelectedLease}
                    disabled={!canInvoke}
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
                    overdue={summary.isOverdue}
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
                      <Button color="inherit" size="small" onClick={openPaymentForSelectedLease} disabled={!canInvoke}>
                        Try another payment method
                      </Button>
                    }
                    sx={{ mx: 2, mb: 2 }}
                  >
                    A previous payment failed, was canceled, or was disputed. That amount has been added back to your balance.
                  </Alert>
                )}
              </Paper>

              <LeaseChargeList
                charges={chargeResultLeaseId === selectedLeaseId ? charges : []}
                rentBalance={loadingPayments ? null : summary.amountDue}
                loading={chargesLoading || (chargeResultLeaseId !== selectedLeaseId && !chargesError)}
                error={chargeResultLeaseId === selectedLeaseId || !chargesLoading ? chargesError : ''}
                onRetry={() => setChargeRefresh((count) => count + 1)}
                onPayFee={openPaymentForFee}
                canPayFee={canInvoke && !chargesLoading && !chargesError}
              />

              {/* Payment history */}
              <Paper variant="outlined" sx={panelSx}>
                <Box sx={{ px: 2.5, py: 2, borderBottom: 1, borderColor: 'divider' }}>
                  <Typography variant="subtitle1" fontWeight={700}>
                    Payment History
                  </Typography>
                  <Typography variant="caption" color="text.secondary">
                    {sortedPayments.length} {sortedPayments.length === 1 ? 'payment' : 'payments'} recorded
                  </Typography>
                  <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1.1} sx={{ mt: 2 }}>
                    <TextField
                      name="search"
                      type="search"
                      size="small"
                      placeholder="Search payments"
                      value={historyFilters.search}
                      onChange={handleHistoryFilterChange}
                      slotProps={{
                        htmlInput: { 'aria-label': 'Search payments' },
                        input: {
                          sx: filterControlSx,
                          startAdornment: <InputAdornment position="start"><SearchOutlined /></InputAdornment>
                        }
                      }}
                      sx={{ flex: 1, minWidth: 0 }}
                    />
                    <TextField
                      name="fromDate"
                      type="date"
                      size="small"
                      label="From date"
                      value={historyFilters.fromDate}
                      onChange={handleHistoryFilterChange}
                      slotProps={{
                        inputLabel: { shrink: true },
                        input: { sx: filterControlSx },
                        htmlInput: { max: historyFilters.toDate || undefined }
                      }}
                      sx={{ width: { xs: '100%', sm: 180 }, flexShrink: 0 }}
                    />
                    <TextField
                      name="toDate"
                      type="date"
                      size="small"
                      label="To date"
                      value={historyFilters.toDate}
                      onChange={handleHistoryFilterChange}
                      error={invalidDateRange}
                      helperText={invalidDateRange ? 'Choose an end date on or after the start date.' : undefined}
                      slotProps={{
                        inputLabel: { shrink: true },
                        input: { sx: filterControlSx },
                        htmlInput: { min: historyFilters.fromDate || undefined }
                      }}
                      sx={{ width: { xs: '100%', sm: 180 }, flexShrink: 0 }}
                    />
                  </Stack>
                </Box>

                {loadingPayments ? (
                  <Box sx={{ display: 'flex', justifyContent: 'center', py: 6 }}>
                    <CircularProgress size={28} />
                  </Box>
                ) : (
                  <TableContainer sx={{ display: { xs: 'none', md: 'block' }, border: 0, borderRadius: 0 }}>
                    <Table size="small" sx={(theme) => ({ ...getPortalListTableSx(theme), tableLayout: 'fixed' })}>
                      <TableHead>
                        <TableRow>
                          <TableCell sx={{ width: '20%' }}>Date</TableCell>
                          <TableCell sx={{ width: '15%' }}>Amount</TableCell>
                          <TableCell sx={{ width: '15%' }}>Status</TableCell>
                          <TableCell sx={{ width: '20%' }}>Method</TableCell>
                          <TableCell sx={{ width: '18%' }}>Reference</TableCell>
                          <TableCell sx={{ width: '12%' }}>Action</TableCell>
                        </TableRow>
                      </TableHead>
                      <TableBody>
                        {visiblePayments.length === 0 ? (
                          <TableRow>
                            <TableCell colSpan={6} align="center" sx={{ py: 6, borderBottom: 0 }}>
                              <Box component={DollarOutlined} sx={{ fontSize: 40, color: 'text.disabled', mb: 1 }} />
                              <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
                                {emptyHistoryMessage}
                              </Typography>
                            </TableCell>
                          </TableRow>
                        ) : (
                          visiblePayments.map((payment, index) => {
                            const statusMeta = getPaymentStatusMeta(payment);
                            const showRetry = canRetryPayment(payment);

                            return (
                              <TableRow key={payment.id || index} hover>
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
                                    sx={(theme) => getStatusPillSx(theme, statusMeta.tone)}
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
                                      disabled={!canInvoke}
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
                    {visiblePayments.length === 0 ? (
                      <Box sx={{ textAlign: 'center', py: 4 }}>
                        <Box component={DollarOutlined} sx={{ fontSize: 36, color: 'text.disabled', mb: 1 }} />
                        <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
                          {emptyHistoryMessage}
                        </Typography>
                      </Box>
                    ) : (
                      visiblePayments.map((payment, index) => {
                        const statusMeta = getPaymentStatusMeta(payment);
                        const showRetry = canRetryPayment(payment);

                        return (
                          <Paper
                            key={payment.id || index}
                            variant="outlined"
                            sx={{
                              p: 1.5,
                              borderRadius: 2,
                              borderColor: 'divider',
                              bgcolor: 'background.paper'
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
                                  sx={(theme) => getStatusPillSx(theme, statusMeta.tone)}
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
                                <Button fullWidth size="small" variant="outlined" color="warning" onClick={openPaymentForSelectedLease} disabled={!canInvoke} sx={{ textTransform: 'none' }}>
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
                {!loadingPayments && filteredPayments.length > 0 && (
                  <PortalListPagination
                    page={visibleHistoryPage}
                    pageCount={pageCount}
                    pageSize={historyPageSize}
                    start={start}
                    end={end}
                    total={filteredPayments.length}
                    onPageChange={setHistoryPage}
                    onPageSizeChange={handleHistoryPageSizeChange}
                    itemLabel="payments"
                  />
                )}
              </Paper>
            </Stack>
          )}
        </Box>
      </Box>

      {/* Payment Modal */}
      {canInvoke && (
        <PaymentModal
          open={modal.openPayment}
          rent={modal.selectedRent}
          onClose={modal.closePaymentModal}
          onSuccess={() => { fetchPaymentData(selectedLeaseId); setChargeRefresh((count) => count + 1); }}
          defaultAmount={selectedLease?.rentAmount}
        />
      )}
    </Box>
  );
}
