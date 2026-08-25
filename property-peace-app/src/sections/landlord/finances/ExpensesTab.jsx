import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import PropTypes from 'prop-types';
import { useDispatch } from 'react-redux';
import { CSVLink } from 'react-csv';
import { DollarOutlined } from '@ant-design/icons';
import { Alert, alpha, Avatar, Box, Button, CircularProgress, Pagination, Stack, Typography, useMediaQuery, useTheme } from '@mui/material';

import { openSnackbar } from 'api/snackbar';
import ConfirmationDialog from 'components/dialogs/ConfirmationDialog';
import ExpenseEditDrawer from 'components/expense/ExpenseEditDrawer';
import TransactionFilterToolbar from 'components/filters/TransactionFilterToolbar';
import useFetchExpenses from 'hooks/useFetchExpenses';
import { deleteExpenseAction, updateExpenseAction } from 'store/expense/expense.action';
import {
  buildExpenseCsvRows,
  buildExpenseHookFilters,
  getExpenseAmount,
  getExpenseId,
  readExpense,
  selectExpensesPage
} from 'utils/expensesTab';
import ExpenseRow from './ExpenseRow';

const PAGE_SIZE = 10;
const EXPENSE_CATEGORIES = [
  'Repairs', 'Maintenance', 'Utilities', 'HOA', 'Insurance', 'Taxes', 'Landscaping', 'Cleaning',
  'Advertising', 'Legal', 'Accounting', 'Property Management', 'Capital Improvements', 'Supplies', 'Other'
];
const EXPENSE_SORT_OPTIONS = [
  { value: 'newest', label: 'Newest first' },
  { value: 'oldest', label: 'Oldest first' },
  { value: 'amount-high', label: 'Amount: high' },
  { value: 'amount-low', label: 'Amount: low' },
  { value: 'category', label: 'Category' }
];
const STATUS_OPTIONS = [
  { value: 'all', label: 'All records' },
  { value: 'paid', label: 'Paid' },
  { value: 'unpaid', label: 'Unpaid' },
  { value: 'tax', label: 'Tax deductible' },
  { value: 'missing-receipt', label: 'Missing receipt' }
];
const SHARED_PERIOD_LABELS = {
  'this-month': 'This month',
  'last-month': 'Last month',
  ytd: 'This year',
  'last-year': 'Last year',
  custom: 'Custom dates'
};
const keepSharedPeriod = () => undefined;

export default function ExpensesTab({
  propertyId,
  sharedPeriod,
  sharedFrom,
  sharedTo,
  mutationVersion,
  onMutation,
  onAvailabilityChange,
  registrationKey,
  registerExport
}) {
  const dispatch = useDispatch();
  const theme = useTheme();
  const mobile = useMediaQuery(theme.breakpoints.down('md'));
  const csvLinkRef = useRef(null);
  const observedLoadingKeyRef = useRef(null);
  const [readyRequestKey, setReadyRequestKey] = useState(null);
  const [search, setSearch] = useState('');
  const [category, setCategory] = useState('all');
  const [status, setStatus] = useState('all');
  const [sort, setSort] = useState('newest');
  const [page, setPage] = useState(1);
  const [editExpense, setEditExpense] = useState(null);
  const [deleteTarget, setDeleteTarget] = useState(null);

  const expenseFilters = useMemo(() => buildExpenseHookFilters({
    propertyId,
    sharedFrom,
    sharedTo,
    mutationVersion
  }), [mutationVersion, propertyId, sharedFrom, sharedTo]);
  const requestKey = `${propertyId ?? 'all'}:${sharedFrom || ''}:${sharedTo || ''}:${mutationVersion ?? 0}`;
  const { expenses = [], loading, error, refetch } = useFetchExpenses(expenseFilters);
  const selection = useMemo(() => selectExpensesPage(expenses, {
    propertyId,
    from: sharedFrom,
    to: sharedTo,
    search,
    category,
    status,
    sort,
    page,
    pageSize: PAGE_SIZE
  }), [category, expenses, page, propertyId, search, sharedFrom, sharedTo, sort, status]);
  const { totalCount, totalPages, visibleExpenses } = selection;
  const requestReady = readyRequestKey === requestKey;

  useEffect(() => {
    observedLoadingKeyRef.current = null;
    setReadyRequestKey(null);
    onAvailabilityChange(false);
  }, [onAvailabilityChange, requestKey]);

  useEffect(() => {
    if (loading) {
      observedLoadingKeyRef.current = requestKey;
      setReadyRequestKey(null);
      onAvailabilityChange(false);
      return;
    }
    if (error) {
      setReadyRequestKey(null);
      onAvailabilityChange(false);
      return;
    }
    if (observedLoadingKeyRef.current === requestKey) {
      setReadyRequestKey(requestKey);
      onAvailabilityChange(true);
    }
  }, [error, loading, onAvailabilityChange, requestKey]);

  useEffect(() => {
    setPage(1);
  }, [category, propertyId, search, sharedFrom, sharedTo, sort, status]);

  useEffect(() => {
    if (selection.page !== page) setPage(selection.page);
  }, [page, selection.page]);

  const hasClientFilters = Boolean(search.trim()) || category !== 'all' || status !== 'all' || sort !== 'newest';
  const csvRows = useMemo(() => buildExpenseCsvRows(visibleExpenses), [visibleExpenses]);
  const exportVisibleRows = useCallback(() => csvLinkRef.current?.link?.click(), []);
  const exportState = useMemo(() => ({
    label: 'Export expenses',
    onExport: exportVisibleRows,
    disabled: !requestReady || loading || Boolean(error) || visibleExpenses.length === 0,
    disabledReason: !requestReady || loading
      ? 'Expenses are still loading.'
      : error
        ? 'Expense records are unavailable.'
        : visibleExpenses.length === 0
          ? 'There are no visible expenses to export.'
          : ''
  }), [error, exportVisibleRows, loading, requestReady, visibleExpenses.length]);

  useLayoutEffect(() => registerExport('expenses', registrationKey, exportState), [exportState, registerExport, registrationKey]);

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
    {
      key: 'category',
      label: 'Category',
      value: category,
      defaultValue: 'all',
      onChange: setCategory,
      options: [{ value: 'all', label: 'All categories' }, ...EXPENSE_CATEGORIES.map((item) => ({ value: item, label: item }))]
    },
    {
      key: 'status',
      label: 'Record status',
      value: status,
      defaultValue: 'all',
      onChange: setStatus,
      options: STATUS_OPTIONS
    }
  ];
  const activeChips = [
    ...(category !== 'all' ? [{ key: 'category', label: category, onDelete: () => setCategory('all') }] : []),
    ...(status !== 'all' ? [{ key: 'status', label: STATUS_OPTIONS.find((option) => option.value === status)?.label || status, onDelete: () => setStatus('all') }] : []),
    ...(sort !== 'newest' ? [{ key: 'sort', label: EXPENSE_SORT_OPTIONS.find((option) => option.value === sort)?.label || sort, onDelete: () => setSort('newest') }] : [])
  ];
  const clearFilters = useCallback(() => {
    setSearch('');
    setCategory('all');
    setStatus('all');
    setSort('newest');
  }, []);

  const markExpensePaid = async (expense) => {
    try {
      const id = getExpenseId(expense);
      await dispatch(updateExpenseAction(id, {
        ...expense,
        id,
        propertyId: readExpense(expense, 'propertyId', 'PropertyId'),
        unitId: readExpense(expense, 'unitId', 'UnitId') || null,
        name: readExpense(expense, 'name', 'Name') || '',
        category: readExpense(expense, 'category', 'Category') || 'Other',
        amount: getExpenseAmount(expense),
        expenseDate: readExpense(expense, 'expenseDate', 'ExpenseDate'),
        isPaid: true,
        paidDate: new Date().toISOString()
      }));
      onMutation();
      openSnackbar({ open: true, message: 'Expense marked as paid', variant: 'alert', alert: { color: 'success' } });
    } catch (markError) {
      openSnackbar({ open: true, message: markError?.response?.data?.message || 'Failed to mark expense as paid', variant: 'alert', alert: { color: 'error' } });
    }
  };

  const confirmDelete = async () => {
    if (!deleteTarget) return;
    try {
      await dispatch(deleteExpenseAction(getExpenseId(deleteTarget)));
      setDeleteTarget(null);
      onMutation();
      openSnackbar({ open: true, message: 'Expense deleted', variant: 'alert', alert: { color: 'success' } });
    } catch (deleteError) {
      openSnackbar({ open: true, message: deleteError?.response?.data?.message || 'Failed to delete expense', variant: 'alert', alert: { color: 'error' } });
    }
  };

  const handleEditSuccess = useCallback(() => {
    setEditExpense(null);
    onMutation();
  }, [onMutation]);
  const errorText = Array.isArray(error) ? error.join(' ') : typeof error === 'string' ? error : error ? 'The expense request failed.' : '';
  const initialLoading = !requestReady && !error;

  return (
    <Box>
      <CSVLink
        ref={csvLinkRef}
        data={csvRows}
        filename={`finances-expenses-${new Date().toISOString().slice(0, 10)}.csv`}
        style={{ display: 'none' }}
        tabIndex={-1}
        aria-hidden="true"
      />

      <Box sx={{ p: { xs: 1.5, md: 2 }, borderBottom: `1px solid ${alpha(theme.palette.divider, 0.14)}` }}>
        <TransactionFilterToolbar
          search={search}
          onSearchChange={setSearch}
          searchPlaceholder="Search name, vendor, category, or property"
          propertyControl={propertyScopeControl}
          period="shared"
          onPeriodChange={keepSharedPeriod}
          periodOptions={sharedPeriodOptions}
          sort={sort}
          onSortChange={setSort}
          sortOptions={EXPENSE_SORT_OPTIONS}
          filters={filterFields}
          activeChips={activeChips}
          onClearAll={clearFilters}
          resultSummary={requestReady && !loading && !error
            ? `${totalCount} ${totalCount === 1 ? 'expense' : 'expenses'} match this view`
            : undefined}
        />
      </Box>

      {loading || initialLoading ? (
        <Box role="status" aria-live="polite" aria-label="Loading expense records" sx={{ minHeight: 280, display: 'grid', placeItems: 'center' }}>
          <CircularProgress />
        </Box>
      ) : error ? (
        <Box sx={{ p: 2 }}>
          <Alert
            severity="warning"
            action={<Button color="inherit" onClick={refetch}>Try again</Button>}
          >
            <Typography fontWeight={700}>Expense records could not be loaded</Typography>
            {errorText} This is not confirmation that there are no expenses in the selected scope.
          </Alert>
        </Box>
      ) : visibleExpenses.length === 0 ? (
        <Box role="status" aria-live="polite" sx={{ px: 3, py: 7, textAlign: 'center' }}>
          <Avatar sx={{ width: 52, height: 52, mx: 'auto', bgcolor: alpha(theme.palette.primary.main, 0.1), color: 'primary.main' }}><DollarOutlined /></Avatar>
          <Typography variant="h6" sx={{ mt: 1.5 }}>{hasClientFilters ? 'No expenses match this view' : 'No expenses in this period'}</Typography>
          <Typography color="text.secondary" sx={{ mt: 0.6, fontSize: '0.84rem' }}>
            {hasClientFilters ? 'Clear or adjust the filters to see more records.' : 'Use the Add menu above to record the first expense in this scope.'}
          </Typography>
          {hasClientFilters && <Button onClick={clearFilters} sx={{ mt: 1.5, textTransform: 'none' }}>Clear filters</Button>}
        </Box>
      ) : (
        <>
          {!mobile && (
            <Box sx={{ px: 2, py: 1, display: 'grid', gridTemplateColumns: 'minmax(230px, 1.55fr) minmax(180px, 1.05fr) minmax(130px, .8fr) minmax(100px, .62fr) 44px', gap: 2, bgcolor: alpha(theme.palette.primary.main, 0.025), borderBottom: `1px solid ${alpha(theme.palette.divider, 0.12)}` }}>
              {['Expense', 'Property', 'Date & status', 'Amount', ''].map((label, index) => <Typography key={`${label}-${index}`} sx={{ fontSize: '0.68rem', fontWeight: 750, letterSpacing: 0.55, textTransform: 'uppercase', color: 'text.secondary', textAlign: index === 3 ? 'right' : 'left' }}>{label}</Typography>)}
            </Box>
          )}
          {visibleExpenses.map((expense) => (
            <ExpenseRow
              key={getExpenseId(expense)}
              expense={expense}
              onEdit={setEditExpense}
              onMarkPaid={markExpensePaid}
              onDelete={setDeleteTarget}
            />
          ))}
        </>
      )}

      {!loading && !error && totalPages > 1 && (
        <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1.5} justifyContent="space-between" alignItems="center" sx={{ p: 2, borderTop: `1px solid ${alpha(theme.palette.divider, 0.14)}` }}>
          <Typography sx={{ fontSize: '0.78rem', color: 'text.secondary' }}>
            Showing {(selection.page - 1) * PAGE_SIZE + 1}–{Math.min(selection.page * PAGE_SIZE, totalCount)} of {totalCount}
          </Typography>
          <Pagination count={totalPages} page={selection.page} onChange={(_, value) => setPage(value)} size="small" color="primary" aria-label="Expense pages" />
        </Stack>
      )}

      <ExpenseEditDrawer open={Boolean(editExpense)} expense={editExpense} onClose={() => setEditExpense(null)} onSuccess={handleEditSuccess} />
      <ConfirmationDialog
        open={Boolean(deleteTarget)}
        onClose={() => setDeleteTarget(null)}
        onConfirm={confirmDelete}
        title="Delete expense"
        message="Delete this expense? This action cannot be undone."
        confirmText="Delete"
        cancelText="Cancel"
        confirmColor="error"
      />
    </Box>
  );
}

ExpensesTab.propTypes = {
  propertyId: PropTypes.number,
  sharedPeriod: PropTypes.string.isRequired,
  sharedFrom: PropTypes.string.isRequired,
  sharedTo: PropTypes.string.isRequired,
  mutationVersion: PropTypes.number,
  onMutation: PropTypes.func.isRequired,
  onAvailabilityChange: PropTypes.func.isRequired,
  registrationKey: PropTypes.string.isRequired,
  registerExport: PropTypes.func.isRequired
};
