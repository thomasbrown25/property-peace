import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import PropTypes from 'prop-types';
import { CSVLink } from 'react-csv';
import {
  Alert, alpha, Box, Button, FormControl, MenuItem, Pagination, Select, Skeleton, Stack,
  Table, TableBody, TableCell, TableContainer, TableHead, TableRow, Typography, useMediaQuery, useTheme
} from '@mui/material';
import { ErrorOutline } from '@mui/icons-material';

import TransactionFilterToolbar from 'components/filters/TransactionFilterToolbar';
import ActivityRow from './ActivityRow';
import { buildActivityCsvRows, getActivityAccountOptions, selectActivityEntriesPage } from 'utils/finances';

const PAGE_SIZE = 12;
const SHARED_PERIOD_OPTIONS = [{ value: 'shared', label: 'Shared date range' }];
const keepSharedPeriod = () => undefined;
const TYPE_OPTIONS = [
  { value: 'all', label: 'All' },
  { value: 'income', label: 'Income' },
  { value: 'expense', label: 'Expense' }
];
const SORT_OPTIONS = [
  { value: 'newest', label: 'Newest first' },
  { value: 'oldest', label: 'Oldest first' },
  { value: 'amount-desc', label: 'Amount: high to low' },
  { value: 'amount-asc', label: 'Amount: low to high' },
  { value: 'balance-desc', label: 'Activity balance' }
];

export default function ActivityTab({ entries = [],
  partial = false,
  loadedCount = 0,
  sourceTotalCount = 0,
  loading,
  error,
  onRetry,
  account = 'all',
  onAccountChange, onSelectItem, registrationKey, registerExport }) {
  const theme = useTheme();
  const mobile = useMediaQuery(theme.breakpoints.down('md'));
  const csvLinkRef = useRef(null);
  const [search, setSearch] = useState('');
  const [type, setType] = useState('all');
  const [sort, setSort] = useState('newest');
  const [page, setPage] = useState(1);
  const accounts = useMemo(() => getActivityAccountOptions(entries), [entries]);
  const accountOptions = useMemo(() => [
    { value: 'all', label: 'All accounts' },
    ...accounts.map((value) => ({ value, label: value }))
  ], [accounts]);

  useEffect(() => {
    if (loading) return;
    const requested = String(account || 'all').trim();
    const matched = requested === 'all' ? undefined : accounts.find((value) => value.toLocaleLowerCase() === requested.toLocaleLowerCase());
    const normalizedAccount = matched || 'all';
    if (normalizedAccount !== account) onAccountChange(normalizedAccount);
    setPage(1);
  }, [account, accounts, loading, onAccountChange]);

  useEffect(() => {
    setPage(1);
  }, [account, search, sort, type]);

  const selection = useMemo(() => selectActivityEntriesPage(entries, {
    search, type, account, sort, page, pageSize: PAGE_SIZE
  }), [account, entries, page, search, sort, type]);
  const { totalCount, totalPages, visibleEntries } = selection;

  useEffect(() => {
    if (selection.page !== page) setPage(selection.page);
  }, [page, selection.page]);

  const hasClientFilters = Boolean(search.trim()) || type !== 'all' || account !== 'all';
  const csvRows = useMemo(() => buildActivityCsvRows(visibleEntries), [visibleEntries]);
  const exportVisibleRows = useCallback(() => csvLinkRef.current?.link?.click(), []);
  const exportState = useMemo(() => ({
    label: 'Export activity',
    onExport: exportVisibleRows,
    hasClientFilters,
    disabled: loading || Boolean(error) || (partial && hasClientFilters) || (hasClientFilters && visibleEntries.length === 0),
    disabledReason: loading
      ? 'Activity is still loading.'
      : error
        ? 'Activity records are unavailable.'
        : partial && hasClientFilters
            ? 'Filtered activity export is unavailable while this view is partial.'
            : hasClientFilters && visibleEntries.length === 0
          ? 'No visible filtered activity is available to export.'
          : ''
  }), [error, exportVisibleRows, hasClientFilters, loading, partial, visibleEntries.length]);

  useLayoutEffect(() => registerExport('activity', registrationKey, exportState), [exportState, registerExport, registrationKey]);

  const clearFilters = useCallback(() => {
    setSearch('');
    setType('all');
    onAccountChange('all');
  }, [onAccountChange]);
  const activeChips = [
    ...(type !== 'all' ? [{ key: 'type', label: `Type: ${TYPE_OPTIONS.find((option) => option.value === type)?.label}`, onDelete: () => setType('all') }] : []),
    ...(account !== 'all' ? [{ key: 'account', label: `Account: ${account}`, onDelete: () => onAccountChange('all') }] : [])
  ];
  const filterFields = [
    { key: 'type', label: 'Type', value: type, defaultValue: 'all', onChange: setType, options: TYPE_OPTIONS },
    { key: 'account', label: 'Account', value: account, defaultValue: 'all', onChange: onAccountChange, options: accountOptions }
  ];
  const accountControl = (
    <FormControl fullWidth size="small">
      <Select value={account} onChange={(event) => onAccountChange(event.target.value)} inputProps={{ 'aria-label': 'Account' }}>
        {accountOptions.map((option) => <MenuItem key={option.value} value={option.value}>{option.label}</MenuItem>)}
      </Select>
    </FormControl>
  );

  return (
    <Box>
      <CSVLink
        ref={csvLinkRef}
        data={csvRows}
        filename={`finances-activity-${new Date().toISOString().slice(0, 10)}.csv`}
        style={{ display: 'none' }}
        tabIndex={-1}
        aria-hidden="true"
      />

      <Box sx={{ p: { xs: 1.5, md: 2 }, borderBottom: `1px solid ${alpha(theme.palette.divider, 0.14)}` }}>
        <TransactionFilterToolbar
          search={search}
          onSearchChange={setSearch}
          searchLabel="Search posted activity"
          searchPlaceholder="Search description, source, account, property, or reference"
          propertyControl={accountControl}
          period="shared"
          onPeriodChange={keepSharedPeriod}
          periodOptions={SHARED_PERIOD_OPTIONS}
          sort={sort}
          onSortChange={setSort}
          sortOptions={SORT_OPTIONS}
          filters={filterFields}
          activeChips={activeChips}
          onClearAll={clearFilters}
          resultSummary={!loading && !error
            ? `${totalCount} posted ${totalCount === 1 ? 'entry' : 'entries'} match this view`
            : undefined}
        />
        <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 1.25 }}>
          Running total of the posted activity shown here — not a bank balance.
        </Typography>
      </Box>

      {partial && !loading && !error && (
        <Box sx={{ px: 2, pt: 2 }}>
          <Alert severity="warning">
            <Typography fontWeight={700}>
              Showing {loadedCount} of {sourceTotalCount} source records.
            </Typography>
            Running totals and filtered activity export are unavailable because this view is partial. Use the unfiltered Export activity
            action for the complete server export.
          </Alert>
        </Box>
      )}

      {loading ? (
        <Stack role="status" aria-live="polite" spacing={1.2} sx={{ p: 2 }} aria-label="Loading posted activity">
          {[1, 2, 3, 4].map((row) => <Skeleton key={row} variant="rounded" height={70} />)}
        </Stack>
      ) : error ? (
        <Box sx={{ p: 2 }}>
          <Alert
            severity="warning"
            icon={<ErrorOutline />}
            action={<Button color="inherit" onClick={onRetry}>Try again</Button>}
          >
            <Typography fontWeight={700}>Activity records could not be loaded</Typography>
            {error} This is not confirmation that the selected period has no posted activity.
          </Alert>
        </Box>
      ) : visibleEntries.length === 0 ? (
        <Box role="status" aria-live="polite" sx={{ px: 3, py: { xs: 5, md: 7 }, textAlign: 'center' }}>
          <Typography variant="h6">{hasClientFilters ? 'No posted activity matches this view' : 'No posted activity in this period'}</Typography>
          <Typography color="text.secondary" sx={{ mt: 0.6, fontSize: '0.84rem' }}>
            {hasClientFilters ? 'Clear or adjust the filters to see more activity.' : 'Completed payments and paid expenses will appear here as posted activity.'}
          </Typography>
          {hasClientFilters && <Button onClick={clearFilters} sx={{ mt: 1.5, textTransform: 'none' }}>Clear filters</Button>}
        </Box>
      ) : mobile ? (
        <Stack spacing={1} sx={{ p: 1.5 }}>
          {visibleEntries.map((entry) => <ActivityRow key={entry.sourceId} entry={entry} mobile onSelect={onSelectItem} />)}
        </Stack>
      ) : (
        <TableContainer>
          <Table size="small">
            <TableHead>
              <TableRow>
                <TableCell>Transaction</TableCell>
                <TableCell>Account / property</TableCell>
                <TableCell>Date</TableCell>
                <TableCell>Type</TableCell>
                <TableCell align="right">Amount</TableCell>
                <TableCell align="right">Activity balance</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {visibleEntries.map((entry) => <ActivityRow key={entry.sourceId} entry={entry} mobile={false} onSelect={onSelectItem} />)}
            </TableBody>
          </Table>
        </TableContainer>
      )}

      {!loading && !error && totalPages > 1 && (
        <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1.5} justifyContent="space-between" alignItems="center" sx={{ p: 2, borderTop: `1px solid ${alpha(theme.palette.divider, 0.14)}` }}>
          <Typography sx={{ fontSize: '0.78rem', color: 'text.secondary' }}>
            Showing {(selection.page - 1) * PAGE_SIZE + 1}–{Math.min(selection.page * PAGE_SIZE, totalCount)} of {totalCount}
          </Typography>
          <Pagination
            count={totalPages}
            page={selection.page}
            onChange={(_, value) => setPage(value)}
            size="small"
            color="primary"
            aria-label="Activity pages"
          />
        </Stack>
      )}
    </Box>
  );
}

ActivityTab.propTypes = {
  entries: PropTypes.arrayOf(PropTypes.object),
  partial: PropTypes.bool,
  loadedCount: PropTypes.number,
  sourceTotalCount: PropTypes.number,
  loading: PropTypes.bool.isRequired,
  error: PropTypes.string,
  onRetry: PropTypes.func.isRequired,
  account: PropTypes.string,
  onAccountChange: PropTypes.func.isRequired,
  onSelectItem: PropTypes.func.isRequired,
  registrationKey: PropTypes.string.isRequired,
  registerExport: PropTypes.func.isRequired
};