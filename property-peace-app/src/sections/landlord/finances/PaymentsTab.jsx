import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import PropTypes from 'prop-types';
import { CSVLink } from 'react-csv';
import { DollarOutlined, PlusOutlined } from '@ant-design/icons';
import {
  Alert,
  alpha,
  Avatar,
  Box,
  Button,
  CircularProgress,
  Dialog,
  DialogActions,
  DialogContent,
  DialogContentText,
  DialogTitle,
  Pagination,
  Stack,
  Typography,
  useTheme
} from '@mui/material';

import { openSnackbar } from 'api/snackbar';
import PaymentEditDrawer from 'components/drawers/PaymentEditDrawer';
import TransactionFilterToolbar from 'components/filters/TransactionFilterToolbar';
import { useDrawer } from 'contexts/DrawerContext';
import axiosServices from 'utils/axios';
import {
  buildPaymentCsvRows,
  getPaymentAmount,
  getPaymentId,
  readPayment,
  selectPaymentsPage
} from 'utils/paymentsTab';
import PaymentRow from './PaymentRow';

const PAGE_SIZE = 10;
const PAYMENT_SORT_OPTIONS = [
  { value: 'newest', label: 'Newest first' },
  { value: 'oldest', label: 'Oldest first' },
  { value: 'amount-high', label: 'Amount: high' },
  { value: 'amount-low', label: 'Amount: low' },
  { value: 'property', label: 'Property' }
];
const TYPE_OPTIONS = [
  { value: 'all', label: 'All types' },
  { value: 'rent', label: 'Rent' },
  { value: 'fee', label: 'Fees' },
  { value: 'deposit', label: 'Deposits' }
];
const STATUS_OPTIONS = [
  { value: 'all', label: 'All statuses' },
  { value: 'completed', label: 'Completed' },
  { value: 'processing', label: 'Processing' },
  { value: 'attention', label: 'Needs attention' },
  { value: 'failed', label: 'Failed' },
  { value: 'disputed', label: 'Disputed' },
  { value: 'canceled', label: 'Canceled' }
];
const SOURCE_OPTIONS = [
  { value: 'all', label: 'All sources' },
  { value: 'online', label: 'Online' },
  { value: 'manual', label: 'Manual' }
];
const SHARED_PERIOD_LABELS = {
  'this-month': 'This month',
  'last-month': 'Last month',
  ytd: 'This year',
  'last-year': 'Last year',
  custom: 'Custom dates'
};
const keepSharedPeriod = () => undefined;
const money = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 2 });

const errorMessage = (error) => {
  if (Array.isArray(error)) return error.join(' ');
  if (typeof error === 'string') return error;
  if (error?.message) return error.message;
  return error ? 'The payment request failed.' : '';
};

export default function PaymentsTab({
  propertyId,
  sharedPeriod,
  sharedFrom,
  sharedTo,
  onMutation,
  registrationKey,
  registerExport,
  payments = [],
  loading,
  error,
  onRetry
}) {
  const theme = useTheme();
  const drawer = useDrawer();
  const csvLinkRef = useRef(null);
  const scopeKey = `${propertyId ?? 'all'}:${sharedFrom || ''}:${sharedTo || ''}`;
  const previousScopeKeyRef = useRef(scopeKey);
  const [search, setSearch] = useState('');
  const [type, setType] = useState('all');
  const [status, setStatus] = useState('all');
  const [source, setSource] = useState('all');
  const [sort, setSort] = useState('newest');
  const [page, setPage] = useState(1);
  const [editPayment, setEditPayment] = useState(null);
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [deleting, setDeleting] = useState(false);

  const scopeChanged = previousScopeKeyRef.current !== scopeKey;
  const requestedPage = scopeChanged ? 1 : page;
  const selection = useMemo(() => selectPaymentsPage(payments, {
    propertyId,
    from: sharedFrom,
    to: sharedTo,
    search,
    type,
    status,
    source,
    sort,
    page: requestedPage,
    pageSize: PAGE_SIZE
  }), [payments, propertyId, requestedPage, search, sharedFrom, sharedTo, sort, source, status, type]);
  const { filteredPayments, totalCount, totalPages, visiblePayments } = selection;

  useEffect(() => {
    if (scopeChanged) {
      previousScopeKeyRef.current = scopeKey;
      if (page !== 1) setPage(1);
      return;
    }
    if (selection.page !== page) setPage(selection.page);
  }, [page, scopeChanged, scopeKey, selection.page]);

  const changeSearch = useCallback((value) => { setSearch(value); setPage(1); }, []);
  const changeType = useCallback((value) => { setType(value); setPage(1); }, []);
  const changeStatus = useCallback((value) => { setStatus(value); setPage(1); }, []);
  const changeSource = useCallback((value) => { setSource(value); setPage(1); }, []);
  const changeSort = useCallback((value) => { setSort(value); setPage(1); }, []);
  const hasClientFilters = Boolean(search.trim()) || type !== 'all' || status !== 'all' || source !== 'all' || sort !== 'newest';
  const csvRows = useMemo(() => buildPaymentCsvRows(filteredPayments), [filteredPayments]);
  const exportFilteredRows = useCallback(() => csvLinkRef.current?.link?.click(), []);
  const exportState = useMemo(() => ({
    label: 'Export payments',
    onExport: exportFilteredRows,
    disabled: loading || Boolean(error) || filteredPayments.length === 0,
    disabledReason: loading
      ? 'Payments are still loading.'
      : error
        ? 'Payment records are unavailable.'
        : filteredPayments.length === 0
          ? 'There are no payments to export.'
          : ''
  }), [error, exportFilteredRows, filteredPayments.length, loading]);
  useLayoutEffect(() => registerExport('payments', registrationKey, exportState), [exportState, registerExport, registrationKey]);

  const sharedPeriodOptions = useMemo(() => [{
    value: 'shared',
    label: `Shared: ${SHARED_PERIOD_LABELS[sharedPeriod] || 'Selected dates'}`
  }], [sharedPeriod]);
  const propertyScopeControl = (
    <Box
      aria-label="Property scope"
      sx={{ height: 40, px: 1.4, display: 'flex', alignItems: 'center', border: `1px solid ${theme.palette.divider}`, borderRadius: 1.75 }}
    >
      <Typography noWrap sx={{ fontSize: '0.82rem', color: 'text.secondary' }}>
        {propertyId ? `Selected property (${propertyId})` : 'All properties'}
      </Typography>
    </Box>
  );
  const filterFields = [
    { key: 'type', label: 'Payment type', value: type, defaultValue: 'all', onChange: changeType, options: TYPE_OPTIONS },
    { key: 'status', label: 'Payment status', value: status, defaultValue: 'all', onChange: changeStatus, options: STATUS_OPTIONS },
    { key: 'source', label: 'Payment source', value: source, defaultValue: 'all', onChange: changeSource, options: SOURCE_OPTIONS }
  ];
  const activeChips = [
    ...(type !== 'all' ? [{ key: 'type', label: TYPE_OPTIONS.find((option) => option.value === type)?.label || type, onDelete: () => changeType('all') }] : []),
    ...(status !== 'all' ? [{ key: 'status', label: STATUS_OPTIONS.find((option) => option.value === status)?.label || status, onDelete: () => changeStatus('all') }] : []),
    ...(source !== 'all' ? [{ key: 'source', label: SOURCE_OPTIONS.find((option) => option.value === source)?.label || source, onDelete: () => changeSource('all') }] : []),
    ...(sort !== 'newest' ? [{ key: 'sort', label: PAYMENT_SORT_OPTIONS.find((option) => option.value === sort)?.label || sort, onDelete: () => changeSort('newest') }] : [])
  ];
  const clearFilters = useCallback(() => {
    setSearch('');
    setType('all');
    setStatus('all');
    setSource('all');
    setSort('newest');
    setPage(1);
  }, []);

  const confirmDelete = async () => {
    const paymentId = getPaymentId(deleteTarget);
    if (!paymentId) return;
    try {
      setDeleting(true);
      await axiosServices.delete(`/api/payment/${paymentId}`);
      setDeleteTarget(null);
      onMutation();
      openSnackbar({ open: true, message: 'Payment deleted successfully.', variant: 'alert', alert: { color: 'success' } });
    } catch (deleteError) {
      openSnackbar({
        open: true,
        message: deleteError?.response?.data?.message || deleteError?.response?.data?.Message || deleteError?.response?.data || 'Failed to delete payment.',
        variant: 'alert',
        alert: { color: 'error' }
      });
    } finally {
      setDeleting(false);
    }
  };

  return (
    <Box>
      <CSVLink
        ref={csvLinkRef}
        data={csvRows}
        filename={`finances-payments-${new Date().toISOString().slice(0, 10)}.csv`}
        style={{ display: 'none' }}
        tabIndex={-1}
        aria-hidden="true"
      />

      <Box sx={{ p: { xs: 1.5, md: 2 }, borderBottom: `1px solid ${alpha(theme.palette.divider, 0.14)}` }}>
        <TransactionFilterToolbar
          search={search}
          onSearchChange={changeSearch}
          searchPlaceholder="Search tenant, reference, property, unit, or method"
          propertyControl={propertyScopeControl}
          period="shared"
          onPeriodChange={keepSharedPeriod}
          periodOptions={sharedPeriodOptions}
          sort={sort}
          onSortChange={changeSort}
          sortOptions={PAYMENT_SORT_OPTIONS}
          filters={filterFields}
          activeChips={activeChips}
          onClearAll={clearFilters}
          resultSummary={!loading && !error ? `${totalCount} ${totalCount === 1 ? 'payment' : 'payments'} match this view` : undefined}
        />
      </Box>

      {loading ? (
        <Box role="status" aria-live="polite" aria-label="Loading payment records" sx={{ minHeight: 280, display: 'grid', placeItems: 'center' }}>
          <CircularProgress />
        </Box>
      ) : error ? (
        <Box sx={{ p: 2 }}>
          <Alert severity="warning" action={<Button color="inherit" onClick={onRetry}>Try again</Button>}>
            <Typography fontWeight={700}>Payment records could not be loaded</Typography>
            {errorMessage(error)} This is not confirmation that there are no payments in the selected scope.
          </Alert>
        </Box>
      ) : visiblePayments.length === 0 ? (
        <Box role="status" aria-live="polite" sx={{ px: 3, py: 7, textAlign: 'center' }}>
          <Avatar sx={{ width: 52, height: 52, mx: 'auto', bgcolor: alpha(theme.palette.success.main, 0.1), color: 'success.main' }}><DollarOutlined /></Avatar>
          <Typography variant="h6" sx={{ mt: 1.5 }}>
            {selection.unfilteredCount > 0 ? 'No payments match this view' : 'No payments in this period'}
          </Typography>
          <Typography color="text.secondary" sx={{ mt: 0.6, fontSize: '0.84rem' }}>
            {selection.unfilteredCount > 0 ? 'Clear or adjust the filters to see more payment records.' : 'Record your first payment to start building a clean collection history.'}
          </Typography>
          {hasClientFilters && selection.unfilteredCount > 0 ? (
            <Button onClick={clearFilters} sx={{ mt: 1.5, textTransform: 'none' }}>Clear filters</Button>
          ) : (
            <Button variant="contained" color="success" startIcon={<PlusOutlined />} onClick={() => drawer.openPaymentAddDrawer()} sx={{ mt: 2, textTransform: 'none' }}>
              Record payment
            </Button>
          )}
        </Box>
      ) : (
        <>
          <Box sx={{ px: 2, py: 1, display: { xs: 'none', md: 'grid' }, gridTemplateColumns: 'minmax(240px, 1.45fr) minmax(190px, 1.05fr) minmax(150px, .82fr) minmax(105px, .58fr) 44px', gap: 2, bgcolor: alpha(theme.palette.success.main, 0.025), borderBottom: `1px solid ${alpha(theme.palette.divider, 0.12)}` }}>
            {['Payment', 'Property & type', 'Date & status', 'Amount', ''].map((label, index) => (
              <Typography key={`${label}-${index}`} sx={{ fontSize: '0.68rem', fontWeight: 750, letterSpacing: 0.55, textTransform: 'uppercase', color: 'text.secondary', textAlign: index === 3 ? 'right' : 'left' }}>{label}</Typography>
            ))}
          </Box>
          {visiblePayments.map((payment) => (
            <PaymentRow key={getPaymentId(payment)} payment={payment} onEdit={setEditPayment} onDelete={setDeleteTarget} />
          ))}
        </>
      )}

      {!loading && !error && totalPages > 1 && (
        <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1.5} justifyContent="space-between" alignItems="center" sx={{ p: 2, borderTop: `1px solid ${alpha(theme.palette.divider, 0.14)}` }}>
          <Typography sx={{ fontSize: '0.78rem', color: 'text.secondary' }}>
            Showing {(selection.page - 1) * PAGE_SIZE + 1}–{Math.min(selection.page * PAGE_SIZE, totalCount)} of {totalCount}
          </Typography>
          <Pagination count={totalPages} page={selection.page} onChange={(_, value) => setPage(value)} size="small" color="primary" aria-label="Payment pages" />
        </Stack>
      )}

      <PaymentEditDrawer
        payment={editPayment}
        open={Boolean(editPayment)}
        onClose={() => setEditPayment(null)}
        onUpdateSuccess={onMutation}
      />
      <Dialog open={Boolean(deleteTarget)} onClose={() => setDeleteTarget(null)} maxWidth="sm" fullWidth>
        <DialogTitle>Delete payment</DialogTitle>
        <DialogContent>
          <DialogContentText>
            Delete this payment record? This action cannot be undone and may affect the lease balance and accounting ledger.
            {deleteTarget && (
              <Box component="span" sx={{ display: 'block', mt: 2, fontWeight: 650, color: 'text.primary' }}>
                {money.format(getPaymentAmount(deleteTarget))} · {readPayment(deleteTarget, 'tenantName', 'TenantName') || 'Payment record'}
              </Box>
            )}
          </DialogContentText>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDeleteTarget(null)} disabled={deleting} sx={{ textTransform: 'none' }}>Cancel</Button>
          <Button onClick={confirmDelete} variant="contained" color="error" disabled={deleting} sx={{ textTransform: 'none' }}>
            {deleting ? 'Deleting…' : 'Delete payment'}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}

PaymentsTab.propTypes = {
  propertyId: PropTypes.oneOfType([PropTypes.number, PropTypes.string]),
  sharedPeriod: PropTypes.string.isRequired,
  sharedFrom: PropTypes.string.isRequired,
  sharedTo: PropTypes.string.isRequired,
  mutationVersion: PropTypes.number,
  onMutation: PropTypes.func.isRequired,
  registrationKey: PropTypes.string.isRequired,
  registerExport: PropTypes.func.isRequired,
  payments: PropTypes.arrayOf(PropTypes.object).isRequired,
  loading: PropTypes.bool.isRequired,
  error: PropTypes.oneOfType([PropTypes.string, PropTypes.array, PropTypes.object]),
  onRetry: PropTypes.func.isRequired
};
