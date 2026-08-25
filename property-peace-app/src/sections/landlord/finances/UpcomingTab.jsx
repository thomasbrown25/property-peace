import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import PropTypes from 'prop-types';
import { useDispatch, useSelector } from 'react-redux';
import { CSVLink } from 'react-csv';
import { CalendarOutlined } from '@ant-design/icons';
import { Alert, alpha, Avatar, Box, Button, CircularProgress, Stack, Typography, useTheme } from '@mui/material';

import { openSnackbar } from 'api/snackbar';
import ConfirmationDialog from 'components/dialogs/ConfirmationDialog';
import TransactionFilterToolbar from 'components/filters/TransactionFilterToolbar';
import { useOrganization } from 'contexts/OrganizationContext';
import useAuth from 'hooks/useAuth';
import { addExpenseAction } from 'store/expense/expense.action';
import {
  deleteFutureExpenseAction,
  getFutureExpensesAction,
  hydrateFutureExpenseCleanupAction,
  markFutureExpenseCleanupPendingAction
} from 'store/future-expense/future-expense.action';
import {
  selectFutureExpenseCleanupById,
  selectFutureExpenseCleanupHydratedIdentity,
  selectFutureExpenseListError,
  selectFutureExpenseListLoading,
  selectFutureExpenseListSettledRequestKey,
  selectFutureExpenses
} from 'store/future-expense/future-expense.selector';
import {
  getFutureExpenseCleanupStorage,
  readFutureExpenseCleanupMarkers,
  removeFutureExpenseCleanupMarker,
  upsertFutureExpenseCleanupMarker,
  writeFutureExpenseCleanupMarkers
} from 'store/future-expense/future-expense.cleanup-storage';
import {
  deleteRecurringExpenseAction,
  getRecurringExpensesAction,
  pauseRecurringExpenseAction,
  resumeRecurringExpenseAction
} from 'store/recurring-expense/recurring-expense.action';
import {
  selectRecurringExpenseListError,
  selectRecurringExpenseListLoading,
  selectRecurringExpenseListSettledRequestKey,
  selectRecurringExpenses
} from 'store/recurring-expense/recurring-expense.selector';
import { buildUpcomingEntries } from 'utils/finances';
import { selectUpcomingEntries } from 'utils/upcomingTab';
import UpcomingRow from './UpcomingRow';

const TYPE_OPTIONS = [
  { value: 'all', label: 'All' },
  { value: 'Recurring', label: 'Recurring' },
  { value: 'One-time', label: 'One-time' }
];
const SCHEDULED_PERIOD_OPTIONS = [{ value: 'shared', label: 'Scheduled dates' }];
const keepScheduledPeriod = () => undefined;
const readScheduled = (item, camel, pascal) => item?.[camel] ?? item?.[pascal];
const scheduledId = (item) => readScheduled(item, 'id', 'Id');
const PARTIAL_CLEANUP_MESSAGE = 'Expense recorded, but the scheduled item could not be removed';

const toDateInput = (date) => {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

const csvDate = (value) => (Number.isFinite(Date.parse(value || '')) ? value : 'Date not set');

function buildUpcomingCsvRows(entries) {
  return entries.map((entry) => ({
    Date: csvDate(entry.actionDate),
    Type: entry.type,
    Name: entry.name,
    Category: entry.category,
    Property: entry.propertyName,
    Unit: entry.unitName,
    Frequency: entry.type === 'Recurring' ? entry.frequency || 'Active' : '',
    Status: entry.cleanupPending
      ? 'Expense recorded · cleanup needed'
      : entry.type === 'Recurring' && entry.isPaused
        ? 'Paused'
        : 'Scheduled',
    Amount: Number(entry.amount) || 0
  }));
}

const errorText = (error) => {
  if (Array.isArray(error)) return error.join(' ');
  if (typeof error === 'string') return error;
  return error ? 'A scheduled expense request failed.' : '';
};

export default function UpcomingTab({ propertyId, mutationVersion, onMutation, registrationKey, registerExport }) {
  const dispatch = useDispatch();
  const theme = useTheme();
  const { user } = useAuth();
  const { currentOrganization } = useOrganization();
  const landlordId = user?.id || user?.Id;
  const organizationId = currentOrganization?.id ?? currentOrganization?.Id ?? null;
  const recurringExpenseCollection = useSelector(selectRecurringExpenses);
  const recurringLoading = useSelector(selectRecurringExpenseListLoading);
  const recurringError = useSelector(selectRecurringExpenseListError);
  const recurringListSettledRequestKey = useSelector(selectRecurringExpenseListSettledRequestKey);
  const futureExpenseCollection = useSelector(selectFutureExpenses);
  const futureLoading = useSelector(selectFutureExpenseListLoading);
  const futureError = useSelector(selectFutureExpenseListError);
  const futureListSettledRequestKey = useSelector(selectFutureExpenseListSettledRequestKey);
  const futureExpenseCleanupById = useSelector(selectFutureExpenseCleanupById);
  const cleanupHydratedIdentity = useSelector(selectFutureExpenseCleanupHydratedIdentity);
  const cleanupStorage = useMemo(() => getFutureExpenseCleanupStorage(), []);
  const csvLinkRef = useRef(null);
  const [search, setSearch] = useState('');
  const [typeFilter, setTypeFilter] = useState('all');
  const [retryVersion, setRetryVersion] = useState(0);
  const [requestPending, setRequestPending] = useState(true);
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [mutatingKey, setMutatingKey] = useState('');
  const requestScopeKey = useMemo(
    () => `upcoming:${landlordId ?? 'pending'}:${organizationId ?? 'pending'}:${propertyId ?? 'all'}:${mutationVersion}:${retryVersion}`,
    [landlordId, mutationVersion, organizationId, propertyId, retryVersion]
  );
  const recurringExpenses = recurringListSettledRequestKey === requestScopeKey ? recurringExpenseCollection : [];
  const futureExpenses = futureListSettledRequestKey === requestScopeKey ? futureExpenseCollection : [];
  const cleanupHydrated = Boolean(landlordId && organizationId) &&
    String(cleanupHydratedIdentity?.landlordId) === String(landlordId) &&
    String(cleanupHydratedIdentity?.organizationId) === String(organizationId);
  const scopesSettled = recurringListSettledRequestKey === requestScopeKey && futureListSettledRequestKey === requestScopeKey;

  useEffect(() => {
    if (!landlordId || !organizationId) return;
    dispatch(hydrateFutureExpenseCleanupAction(landlordId,
        organizationId,
        readFutureExpenseCleanupMarkers(cleanupStorage, landlordId, organizationId)));
  }, [cleanupStorage, dispatch, landlordId, organizationId]);

  useEffect(() => {
    if (!cleanupHydrated) return;
    writeFutureExpenseCleanupMarkers(cleanupStorage, landlordId, organizationId, futureExpenseCleanupById);
  }, [cleanupHydrated, cleanupStorage, futureExpenseCleanupById, landlordId, organizationId]);

  useEffect(() => {
    if (!landlordId || !organizationId) {
      setRequestPending(false);
      return undefined;
    }
    if (!cleanupHydrated) {
      setRequestPending(true);
      return undefined;
    }

    let current = true;
    setRequestPending(true);
    Promise.all([
      dispatch(getRecurringExpensesAction(landlordId, { propertyId, organizationId }, requestScopeKey)),
      dispatch(getFutureExpensesAction(landlordId, { propertyId, organizationId }, requestScopeKey))
    ]).finally(() => {
      if (current) setRequestPending(false);
    });

    return () => {
      current = false;
    };
  }, [cleanupHydrated, dispatch, landlordId, organizationId, requestScopeKey]);

  const combinedEntries = useMemo(
    () =>
      buildUpcomingEntries(recurringExpenses, futureExpenses).map((entry) => {
        if (entry.type !== 'One-time') return entry;
        const cleanupPending = futureExpenseCleanupById[String(scheduledId(entry.source))];
        return cleanupPending ? { ...entry, cleanupPending } : entry;
      }),
    [futureExpenseCleanupById, futureExpenses, recurringExpenses]
  );
  const filteredEntries = useMemo(
    () => selectUpcomingEntries(combinedEntries, { propertyId, search, type: typeFilter }),
    [combinedEntries, propertyId, search, typeFilter]
  );
  const loading = requestPending || recurringLoading || futureLoading || (Boolean(landlordId && organizationId) && (!cleanupHydrated || !scopesSettled));
  const loadError = recurringError || futureError;
  const hasCleanupPending = combinedEntries.some((entry) => Boolean(entry.cleanupPending));
  const hasClientFilters = Boolean(search.trim()) || typeFilter !== 'all';
  const hasFilters = hasClientFilters || Boolean(propertyId);
  const csvRows = useMemo(() => buildUpcomingCsvRows(filteredEntries), [filteredEntries]);
  const exportFilteredRows = useCallback(() => csvLinkRef.current?.link?.click(), []);
  const exportState = useMemo(
    () => ({
      label: 'Export upcoming',
      onExport: exportFilteredRows,
      disabled: loading || Boolean(loadError) || filteredEntries.length === 0,
      disabledReason: loading
        ? 'Upcoming expenses are still loading.'
        : loadError
          ? 'Upcoming expense records are unavailable.'
          : filteredEntries.length === 0
            ? 'There are no upcoming expenses to export.'
            : ''
    }),
    [exportFilteredRows, filteredEntries.length, loadError, loading]
  );
  useLayoutEffect(() => registerExport('upcoming', registrationKey, exportState), [exportState, registerExport, registrationKey]);

  const changeType = useCallback((value) => setTypeFilter(value), []);
  const clearFilters = useCallback(() => {
    setSearch('');
    setTypeFilter('all');
  }, []);
  const retry = useCallback(() => setRetryVersion((version) => version + 1), []);
  const notifyFinanceMutation = useCallback(() => {
    onMutation();
  }, [onMutation]);
  const notifyMutationSuccess = useCallback(
    (message) => {
      notifyFinanceMutation();
      openSnackbar({ open: true, message, variant: 'alert', alert: { color: 'success' } });
    },
    [notifyFinanceMutation]
  );

  const reconcileFutureExpense = async (entry, marker, successMessage) => {
    const futureExpenseId = scheduledId(entry.source);
    try {
      await dispatch(deleteFutureExpenseAction(futureExpenseId));
      removeFutureExpenseCleanupMarker(cleanupStorage, landlordId, organizationId, futureExpenseId);
      if (successMessage) {
        openSnackbar({ open: true, message: successMessage, variant: 'alert', alert: { color: 'success' } });
      }
      return true;
    } catch {
      const failedMarker = { ...marker, cleanupError: PARTIAL_CLEANUP_MESSAGE };
      upsertFutureExpenseCleanupMarker(cleanupStorage, failedMarker);
      dispatch(markFutureExpenseCleanupPendingAction(futureExpenseId, failedMarker));
      openSnackbar({
        open: true,
        message: `${PARTIAL_CLEANUP_MESSAGE}. Retry scheduled cleanup from this row.`,
        variant: 'alert',
        alert: { color: 'error' }
      });
      return false;
    }
  };

  const recordAsPaid = async (entry) => {
    setMutatingKey(entry.key);
    const cleanupPending = entry.cleanupPending;
    if (cleanupPending) {
      try {
        await reconcileFutureExpense(entry, cleanupPending, 'Scheduled item removed');
      } finally {
        setMutatingKey('');
      }
      return;
    }

    try {
      const source = entry.source;
      const now = new Date();
      await dispatch(
        addExpenseAction({
          landlordId: landlordId,
          propertyId: readScheduled(source, 'propertyId', 'PropertyId'),
          unitId: readScheduled(source, 'unitId', 'UnitId') || null,
          name: readScheduled(source, 'name', 'Name') || '',
          category: readScheduled(source, 'category', 'Category') || 'Other',
          amount: Number(entry.amount) || 0,
          expenseDate: toDateInput(now),
          vendor: readScheduled(source, 'vendor', 'Vendor') || null,
          paymentMethod: readScheduled(source, 'paymentMethod', 'PaymentMethod') || null,
          isRecurring: entry.type === 'Recurring',
          isTaxDeductible: Boolean(readScheduled(source, 'isTaxDeductible', 'IsTaxDeductible')),
          maintenanceRequestId: readScheduled(source, 'maintenanceRequestId', 'MaintenanceRequestId') || null,
          isPaid: true,
          paidDate: now.toISOString()
        })
      );
      if (entry.type === 'One-time') {
        const futureExpenseId = scheduledId(source);
        const cleanupMarker = {
          futureExpenseId: futureExpenseId,
          propertyId: readScheduled(source, 'propertyId', 'PropertyId'),
          landlordId: landlordId,
          organizationId: organizationId,
          cleanupError: null
        };
        upsertFutureExpenseCleanupMarker(cleanupStorage, cleanupMarker);
        dispatch(markFutureExpenseCleanupPendingAction(futureExpenseId, cleanupMarker));
        notifyFinanceMutation();
        const reconciled = await reconcileFutureExpense(entry, cleanupMarker);
        if (reconciled) {
          openSnackbar({
            open: true,
            message: 'Planned expense recorded as paid',
            variant: 'alert',
            alert: { color: 'success' }
          });
        }
      } else {
        notifyMutationSuccess('Recurring expense recorded as paid');
      }
    } catch (recordError) {
      openSnackbar({
        open: true,
        message: recordError?.response?.data?.message || 'Failed to record expense',
        variant: 'alert',
        alert: { color: 'error' }
      });
    } finally {
      setMutatingKey('');
    }
  };

  const toggleRecurring = async (entry) => {
    setMutatingKey(entry.key);
    try {
      const id = scheduledId(entry.source);
      if (entry.isPaused) await dispatch(resumeRecurringExpenseAction(id));
      else await dispatch(pauseRecurringExpenseAction(id));
      notifyMutationSuccess(entry.isPaused ? 'Schedule resumed' : 'Schedule paused');
    } catch {
      openSnackbar({ open: true, message: 'Failed to update schedule', variant: 'alert', alert: { color: 'error' } });
    } finally {
      setMutatingKey('');
    }
  };

  const confirmDelete = async () => {
    if (!deleteTarget) return;
    setMutatingKey(deleteTarget.key);
    try {
      if (deleteTarget.type === 'Recurring') {
        await dispatch(deleteRecurringExpenseAction(scheduledId(deleteTarget.source)));
        setDeleteTarget(null);
        notifyMutationSuccess('Expense deleted');
      } else if (deleteTarget.cleanupPending) {
        const reconciled = await reconcileFutureExpense(deleteTarget, deleteTarget.cleanupPending, 'Scheduled item removed');
        if (reconciled) setDeleteTarget(null);
      } else {
        await dispatch(deleteFutureExpenseAction(scheduledId(deleteTarget.source)));
        setDeleteTarget(null);
        notifyMutationSuccess('Expense deleted');
      }
    } catch (deleteError) {
      openSnackbar({
        open: true,
        message: deleteError?.response?.data?.message || 'Failed to delete expense',
        variant: 'alert',
        alert: { color: 'error' }
      });
    } finally {
      setMutatingKey('');
    }
  };

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
      key: 'type',
      label: 'Schedule type',
      value: typeFilter,
      defaultValue: 'all',
      onChange: changeType,
      options: TYPE_OPTIONS
    }
  ];
  const activeChips = typeFilter === 'all' ? [] : [{ key: 'type', label: typeFilter, onDelete: () => changeType('all') }];

  return (
    <Box>
      <CSVLink
        ref={csvLinkRef}
        data={csvRows}
        filename={`finances-upcoming-${new Date().toISOString().slice(0, 10)}.csv`}
        style={{ display: 'none' }}
        tabIndex={-1}
        aria-hidden="true"
      />

      <Box sx={{ p: { xs: 1.5, md: 2 }, borderBottom: `1px solid ${alpha(theme.palette.divider, 0.14)}` }}>
        <TransactionFilterToolbar
          search={search}
          onSearchChange={setSearch}
          searchPlaceholder="Search name, vendor, category, or property"
          searchLabel="Search upcoming expenses"
          propertyControl={propertyScopeControl}
          period="shared"
          onPeriodChange={keepScheduledPeriod}
          periodOptions={SCHEDULED_PERIOD_OPTIONS}
          filters={filterFields}
          activeChips={activeChips}
          onClearAll={clearFilters}
          resultSummary={
            !loading && !loadError
              ? `${filteredEntries.length} upcoming ${filteredEntries.length === 1 ? 'expense' : 'expenses'} match this view`
              : undefined
          }
        />
      </Box>

      {hasCleanupPending && (
        <Box sx={{ p: 2, pb: 0 }}>
          <Alert severity="warning">
            <Typography fontWeight={700}>{PARTIAL_CLEANUP_MESSAGE}</Typography>
            The paid expense is saved. Retry scheduled cleanup from the affected row; retry will not create another expense.
          </Alert>
        </Box>
      )}

      {loadError && (
        <Box sx={{ p: 2, pb: filteredEntries.length ? 0 : 2 }}>
          <Alert
            severity="warning"
            action={
              <Button color="inherit" onClick={retry}>
                Try again
              </Button>
            }
          >
            <Typography fontWeight={700}>Upcoming expenses could not be loaded</Typography>
            {[errorText(recurringError), errorText(futureError)].filter(Boolean).join(' ')} This view may be incomplete; retry before
            treating it as an empty schedule.
          </Alert>
        </Box>
      )}

      {loading ? (
        <Box
          role="status"
          aria-live="polite"
          aria-label="Loading upcoming expenses"
          sx={{ minHeight: 280, display: 'grid', placeItems: 'center' }}
        >
          <CircularProgress />
        </Box>
      ) : !loadError && filteredEntries.length === 0 ? (
        <Box role="status" aria-live="polite" sx={{ px: 3, py: 7, textAlign: 'center' }}>
          <Avatar sx={{ width: 52, height: 52, mx: 'auto', bgcolor: alpha(theme.palette.primary.main, 0.1), color: 'primary.main' }}>
            <CalendarOutlined />
          </Avatar>
          <Typography variant="h6" sx={{ mt: 1.5 }}>
            {hasFilters ? 'No upcoming expenses match these filters' : 'No upcoming expenses are scheduled'}
          </Typography>
          <Typography color="text.secondary" sx={{ mt: 0.6, fontSize: '0.84rem' }}>
            {hasFilters
              ? 'Adjust the Upcoming filters or shared property scope to see more schedules.'
              : 'Recurring and one-time expenses will appear here when they are scheduled.'}
          </Typography>
          {hasClientFilters && (
            <Button onClick={clearFilters} sx={{ mt: 1.5, textTransform: 'none' }}>
              Clear Upcoming filters
            </Button>
          )}
        </Box>
      ) : filteredEntries.length > 0 ? (
        <>
          <Box
            sx={{
              px: 2,
              py: 1,
              display: { xs: 'none', md: 'grid' },
              gridTemplateColumns: 'minmax(230px, 1.45fr) minmax(180px, 1fr) minmax(145px, .8fr) minmax(105px, .58fr) minmax(130px, .7fr)',
              gap: 2,
              bgcolor: alpha(theme.palette.primary.main, 0.025),
              borderBottom: `1px solid ${alpha(theme.palette.divider, 0.12)}`
            }}
          >
            {['Schedule', 'Property', 'Timing', 'Amount', 'Actions'].map((label, index) => (
              <Typography
                key={label}
                sx={{
                  fontSize: '0.68rem',
                  fontWeight: 750,
                  letterSpacing: 0.55,
                  textTransform: 'uppercase',
                  color: 'text.secondary',
                  textAlign: index === 3 ? 'right' : 'left'
                }}
              >
                {label}
              </Typography>
            ))}
          </Box>
          {filteredEntries.map((entry) => (
            <UpcomingRow
              key={entry.key}
              entry={entry}
              onRecord={recordAsPaid}
              onToggle={toggleRecurring}
              onDelete={setDeleteTarget}
              busy={mutatingKey === entry.key}
            />
          ))}
        </>
      ) : null}

      <ConfirmationDialog
        open={Boolean(deleteTarget)}
        onClose={() => setDeleteTarget(null)}
        onConfirm={confirmDelete}
        title={deleteTarget?.type === 'Recurring' ? 'Delete recurring schedule' : 'Delete planned expense'}
        message={
          deleteTarget?.type === 'Recurring'
            ? 'Delete this recurring schedule? Existing expense records will not be removed.'
            : deleteTarget?.cleanupPending
              ? 'Remove the remaining scheduled item? The paid expense record will remain.'
              : 'Delete this expense? This action cannot be undone.'
        }
        confirmText="Delete"
        cancelText="Cancel"
        confirmColor="error"
      />
    </Box>
  );
}

UpcomingTab.propTypes = {
  propertyId: PropTypes.number,
  mutationVersion: PropTypes.number.isRequired,
  onMutation: PropTypes.func.isRequired,
  registrationKey: PropTypes.string.isRequired,
  registerExport: PropTypes.func.isRequired
};
