import { useEffect, useMemo, useState } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { useLocation, useSearchParams } from 'react-router-dom';
import { CSVLink } from 'react-csv';
import { darkHeaderOutlinedActionSx } from 'styles/darkHeaderActions.mjs';
import {
  alpha,
  Avatar,
  Box,
  Button,
  Chip,
  CircularProgress,
  Grid,
  IconButton,
  Menu,
  MenuItem,
  Pagination,
  Stack,
  Tab,
  Tabs,
  Tooltip,
  Typography,
  useMediaQuery,
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
  FileDoneOutlined,
  MoreOutlined,
  PauseCircleOutlined,
  PlayCircleOutlined,
  PlusOutlined,
  ReloadOutlined,
  TagsOutlined
} from '@ant-design/icons';

import PageBreadcrumbs from 'components/breadcrumbs/PageBreadcrumbs';
import ExpenseAddDrawer from 'components/expense/ExpenseAddDrawer';
import ExpenseEditDrawer from 'components/expense/ExpenseEditDrawer';
import ConfirmationDialog from 'components/dialogs/ConfirmationDialog';
import TransactionFilterToolbar from 'components/filters/TransactionFilterToolbar';
import PropertySelect from 'components/PropertySelect';
import { useDashboardLoading } from 'contexts/DashboardLoadingContext';
import useAuth from 'hooks/useAuth';
import useFetchExpenses from 'hooks/useFetchExpenses';
import useFetchProperties from 'hooks/useFetchProperties';
import { openSnackbar } from 'api/snackbar';
import { setProperty } from 'store/property/property.action';
import { setUnit } from 'store/unit/unit.action';
import { selectProperty } from 'store/property/property.selector';
import { addExpenseAction, deleteExpenseAction, updateExpenseAction } from 'store/expense/expense.action';
import {
  deleteRecurringExpenseAction,
  getRecurringExpensesAction,
  pauseRecurringExpenseAction,
  resumeRecurringExpenseAction
} from 'store/recurring-expense/recurring-expense.action';
import { selectRecurringExpenses } from 'store/recurring-expense/recurring-expense.selector';
import { deleteFutureExpenseAction, getFutureExpensesAction } from 'store/future-expense/future-expense.action';
import { selectFutureExpenses } from 'store/future-expense/future-expense.selector';

const PAGE_SIZE = 10;
const NAVY = '#061e35';
const EXPENSE_CATEGORIES = [
  'Repairs',
  'Maintenance',
  'Utilities',
  'HOA',
  'Insurance',
  'Taxes',
  'Landscaping',
  'Cleaning',
  'Advertising',
  'Legal',
  'Accounting',
  'Property Management',
  'Capital Improvements',
  'Supplies',
  'Other'
];
const PERIOD_OPTIONS = [
  { value: 'year', label: 'This year' },
  { value: '30', label: 'Last 30 days' },
  { value: '90', label: 'Last 90 days' },
  { value: 'all', label: 'All time' },
  { value: 'custom', label: 'Custom dates' }
];
const EXPENSE_SORT_OPTIONS = [
  { value: 'newest', label: 'Newest first' },
  { value: 'oldest', label: 'Oldest first' },
  { value: 'amount-high', label: 'Amount: high' },
  { value: 'amount-low', label: 'Amount: low' },
  { value: 'category', label: 'Category' }
];

const read = (object, camel, pascal) => object?.[camel] ?? object?.[pascal];
const getId = (object) => read(object, 'id', 'Id');
const getAmount = (object) => Number(read(object, 'amount', 'Amount') || 0);
const isPaid = (expense) => Boolean(read(expense, 'isPaid', 'IsPaid'));
const hasReceipts = (expense) => {
  const receipts = read(expense, 'receipts', 'Receipts');
  return (Array.isArray(receipts) && receipts.length > 0) || Boolean(read(expense, 'receiptUrl', 'ReceiptUrl'));
};
const isTaxDeductible = (expense) => Boolean(read(expense, 'isTaxDeductible', 'IsTaxDeductible'));

function formatMoney(value) {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 2 }).format(value || 0);
}

function formatDate(value) {
  if (!value) return 'Not set';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return 'Not set';
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
  const start = new Date(now);
  start.setDate(start.getDate() - (period === '30' ? 29 : 89));
  return { startDate: toDateInput(start), endDate: toDateInput(now) };
}

function getSearchText(item) {
  return [
    read(item, 'name', 'Name'),
    read(item, 'category', 'Category'),
    read(item, 'propertyName', 'PropertyName'),
    read(item, 'unitName', 'UnitName'),
    read(item, 'vendor', 'Vendor')
  ].filter(Boolean).join(' ').toLowerCase();
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

function ExpenseRow({ expense, onEdit, onMarkPaid, onDelete }) {
  const theme = useTheme();
  const [anchorEl, setAnchorEl] = useState(null);
  const name = read(expense, 'name', 'Name') || 'Untitled expense';
  const category = read(expense, 'category', 'Category') || 'Uncategorized';
  const propertyName = read(expense, 'propertyName', 'PropertyName') || 'No property';
  const unitName = read(expense, 'unitName', 'UnitName');
  const vendor = read(expense, 'vendor', 'Vendor');
  const date = read(expense, 'paidDate', 'PaidDate') || read(expense, 'expenseDate', 'ExpenseDate');
  const paid = isPaid(expense);

  return (
    <Box
      sx={{
        px: { xs: 1.5, md: 2 },
        py: { xs: 1.55, md: 1.35 },
        display: { xs: 'block', md: 'grid' },
        gridTemplateColumns: 'minmax(230px, 1.55fr) minmax(180px, 1.05fr) minmax(130px, .8fr) minmax(100px, .62fr) 44px',
        gap: { xs: 1.25, md: 2 },
        alignItems: 'center',
        borderBottom: `1px solid ${alpha(theme.palette.divider, 0.13)}`,
        '&:hover': { bgcolor: alpha(theme.palette.primary.main, theme.palette.mode === 'dark' ? 0.08 : 0.028) }
      }}
    >
      <Stack direction="row" spacing={1.25} alignItems="center" minWidth={0}>
        <Avatar sx={{ width: 38, height: 38, bgcolor: alpha(theme.palette.error.main, 0.1), color: 'error.main' }}>
          <TagsOutlined />
        </Avatar>
        <Box minWidth={0}>
          <Typography fontWeight={700} noWrap>{name}</Typography>
          <Typography noWrap sx={{ mt: 0.25, fontSize: '0.75rem', color: 'text.secondary' }}>
            {[category, vendor].filter(Boolean).join(' · ')}
          </Typography>
        </Box>
      </Stack>

      <Box>
        <Typography sx={{ fontSize: '0.82rem', fontWeight: 650 }}>{propertyName}</Typography>
        {unitName && <Typography sx={{ mt: 0.25, fontSize: '0.72rem', color: 'text.secondary' }}>{unitName}</Typography>}
      </Box>

      <Box>
        <Typography sx={{ fontSize: '0.8rem', fontWeight: 600 }}>{formatDate(date)}</Typography>
        <Stack direction="row" spacing={0.6} sx={{ mt: 0.45 }}>
          <Chip label={paid ? 'Paid' : 'Unpaid'} size="small" color={paid ? 'success' : 'warning'} variant={paid ? 'filled' : 'outlined'} sx={{ height: 20, fontSize: '0.65rem' }} />
          {hasReceipts(expense) && <Chip label="Receipt" size="small" variant="outlined" sx={{ height: 20, fontSize: '0.65rem' }} />}
        </Stack>
      </Box>

      <Typography sx={{ fontSize: '0.92rem', fontWeight: 750, color: paid ? 'text.primary' : 'warning.dark', textAlign: { md: 'right' } }}>
        {formatMoney(getAmount(expense))}
      </Typography>

      <Box sx={{ display: 'flex', justifyContent: { xs: 'flex-end', md: 'center' } }}>
        <Tooltip title="Expense actions">
          <IconButton size="small" aria-label={`Actions for ${name}`} onClick={(event) => setAnchorEl(event.currentTarget)}><MoreOutlined /></IconButton>
        </Tooltip>
        <Menu anchorEl={anchorEl} open={Boolean(anchorEl)} onClose={() => setAnchorEl(null)}>
          {!paid && <MenuItem onClick={() => { setAnchorEl(null); onMarkPaid(expense); }}><CheckCircleOutlined style={{ marginRight: 10 }} />Mark as paid</MenuItem>}
          <MenuItem onClick={() => { setAnchorEl(null); onEdit(expense); }}><EditOutlined style={{ marginRight: 10 }} />Edit expense</MenuItem>
          <MenuItem sx={{ color: 'error.main' }} onClick={() => { setAnchorEl(null); onDelete(expense); }}><DeleteOutlined style={{ marginRight: 10 }} />Delete expense</MenuItem>
        </Menu>
      </Box>
    </Box>
  );
}

function PlanRow({ item, type, onRecord, onToggle, onDelete }) {
  const theme = useTheme();
  const recurring = type === 'recurring';
  const paused = Boolean(read(item, 'isPaused', 'IsPaused'));
  const name = read(item, 'name', 'Name') || 'Untitled expense';
  const propertyName = read(item, 'propertyName', 'PropertyName') || 'No property';
  const unitName = read(item, 'unitName', 'UnitName');
  const dueDate = recurring ? read(item, 'nextOccurrenceDate', 'NextOccurrenceDate') : read(item, 'dueDate', 'DueDate');
  const frequency = read(item, 'frequency', 'Frequency');

  return (
    <Box
      sx={{
        px: { xs: 1.5, md: 2 }, py: 1.45,
        display: { xs: 'block', md: 'grid' },
        gridTemplateColumns: 'minmax(230px, 1.5fr) minmax(180px, 1fr) minmax(150px, .8fr) minmax(100px, .6fr) minmax(130px, .75fr)',
        gap: { xs: 1.2, md: 2 }, alignItems: 'center',
        borderBottom: `1px solid ${alpha(theme.palette.divider, 0.13)}`,
        '&:hover': { bgcolor: alpha(theme.palette.primary.main, theme.palette.mode === 'dark' ? 0.08 : 0.028) }
      }}
    >
      <Stack direction="row" spacing={1.2} alignItems="center" minWidth={0}>
        <Avatar sx={{ width: 38, height: 38, bgcolor: alpha(theme.palette.primary.main, 0.1), color: 'primary.main' }}>
          {recurring ? <ReloadOutlined /> : <ClockCircleOutlined />}
        </Avatar>
        <Box minWidth={0}>
          <Typography fontWeight={700} noWrap>{name}</Typography>
          <Typography sx={{ mt: 0.25, fontSize: '0.73rem', color: 'text.secondary' }} noWrap>
            {read(item, 'category', 'Category') || 'Uncategorized'}
          </Typography>
        </Box>
      </Stack>
      <Box>
        <Typography sx={{ fontSize: '0.82rem', fontWeight: 650 }}>{propertyName}</Typography>
        {unitName && <Typography sx={{ mt: 0.25, fontSize: '0.72rem', color: 'text.secondary' }}>{unitName}</Typography>}
      </Box>
      <Box>
        <Typography sx={{ fontSize: '0.78rem', color: 'text.secondary' }}>{recurring ? 'Next due' : 'Due date'}</Typography>
        <Typography sx={{ mt: 0.2, fontSize: '0.82rem', fontWeight: 650 }}>{formatDate(dueDate)}</Typography>
      </Box>
      <Box>
        <Typography sx={{ fontSize: '0.92rem', fontWeight: 750 }}>{formatMoney(getAmount(item))}</Typography>
        {recurring && <Chip label={paused ? 'Paused' : frequency || 'Active'} size="small" color={paused ? 'warning' : 'success'} variant="outlined" sx={{ mt: 0.45, height: 20, fontSize: '0.65rem' }} />}
      </Box>
      <Stack direction="row" spacing={0.5} justifyContent={{ xs: 'flex-end', md: 'flex-start' }}>
        <Tooltip title="Record as paid"><IconButton size="small" color="success" onClick={() => onRecord(item)}><CheckCircleOutlined /></IconButton></Tooltip>
        {recurring && <Tooltip title={paused ? 'Resume schedule' : 'Pause schedule'}><IconButton size="small" onClick={() => onToggle(item)}>{paused ? <PlayCircleOutlined /> : <PauseCircleOutlined />}</IconButton></Tooltip>}
        <Tooltip title={recurring ? 'Delete schedule' : 'Delete planned expense'}><IconButton size="small" color="error" onClick={() => onDelete(item)}><DeleteOutlined /></IconButton></Tooltip>
      </Stack>
    </Box>
  );
}

export default function Expenses() {
  const dispatch = useDispatch();
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('md'));
  const location = useLocation();
  const [searchParams] = useSearchParams();
  const { user } = useAuth();
  const { properties, isLoading: propertiesLoading } = useFetchProperties();
  const selectedProperty = useSelector(selectProperty);
  const recurringExpenses = useSelector(selectRecurringExpenses) || [];
  const futureExpenses = useSelector(selectFutureExpenses) || [];
  const { setExpensesLoading } = useDashboardLoading();

  const [activeTab, setActiveTab] = useState(0);
  const [search, setSearch] = useState('');
  const [period, setPeriod] = useState('year');
  const [customDates, setCustomDates] = useState({ startDate: '', endDate: '' });
  const [category, setCategory] = useState('all');
  const [status, setStatus] = useState('all');
  const [sort, setSort] = useState('newest');
  const [page, setPage] = useState(1);
  const [addOpen, setAddOpen] = useState(false);
  const [editExpense, setEditExpense] = useState(null);
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [recurringLoading, setRecurringLoading] = useState(false);
  const [futureLoading, setFutureLoading] = useState(false);

  const periodDates = period === 'custom' ? customDates : getPeriodDates(period);
  const expenseFilters = useMemo(() => ({
    propertyId: selectedProperty?.id || selectedProperty?.Id || null,
    startDate: periodDates.startDate || null,
    endDate: periodDates.endDate || null
  }), [selectedProperty, periodDates.startDate, periodDates.endDate]);
  const { expenses: allExpenses = [], loading: expensesLoading, refetch: refetchExpenses } = useFetchExpenses(expenseFilters);

  const landlordId = user?.id || user?.Id;
  const propertyId = selectedProperty?.id || selectedProperty?.Id || null;

  const refreshPlans = async () => {
    if (!landlordId) return;
    setRecurringLoading(true);
    setFutureLoading(true);
    try {
      await Promise.all([
        dispatch(getRecurringExpensesAction(landlordId, { propertyId })),
        dispatch(getFutureExpensesAction(landlordId, { propertyId }))
      ]);
    } finally {
      setRecurringLoading(false);
      setFutureLoading(false);
    }
  };

  useEffect(() => {
    const id = Number(searchParams.get('propertyId'));
    if (id && properties?.length) {
      const property = properties.find((item) => Number(getId(item)) === id);
      if (property) dispatch(setProperty(property));
    } else if (location.pathname === '/landlord/expenses') {
      dispatch(setProperty(null));
    }
  }, [dispatch, location.pathname, properties, searchParams]);

  useEffect(() => {
    refreshPlans();
  }, [landlordId, propertyId]);

  useEffect(() => {
    setPage(1);
  }, [activeTab, search, period, customDates.startDate, customDates.endDate, category, status, sort, propertyId]);

  const pageLoading = propertiesLoading || expensesLoading || recurringLoading || futureLoading;
  useEffect(() => {
    setExpensesLoading(pageLoading);
  }, [pageLoading, setExpensesLoading]);

  const visibleExpenses = useMemo(() => {
    const query = search.trim().toLowerCase();
    return [...allExpenses]
      .filter((expense) => !query || getSearchText(expense).includes(query))
      .filter((expense) => category === 'all' || read(expense, 'category', 'Category') === category)
      .filter((expense) => status === 'all' || (status === 'paid' && isPaid(expense)) || (status === 'unpaid' && !isPaid(expense)) || (status === 'tax' && isTaxDeductible(expense)) || (status === 'missing-receipt' && !hasReceipts(expense)))
      .sort((a, b) => {
        if (sort === 'amount-high') return getAmount(b) - getAmount(a);
        if (sort === 'amount-low') return getAmount(a) - getAmount(b);
        if (sort === 'category') return String(read(a, 'category', 'Category') || '').localeCompare(String(read(b, 'category', 'Category') || ''));
        const aDate = new Date(read(a, 'expenseDate', 'ExpenseDate') || 0).getTime();
        const bDate = new Date(read(b, 'expenseDate', 'ExpenseDate') || 0).getTime();
        return sort === 'oldest' ? aDate - bDate : bDate - aDate;
      });
  }, [allExpenses, category, search, sort, status]);

  const filteredRecurring = useMemo(() => {
    const query = search.trim().toLowerCase();
    return recurringExpenses.filter((item) => (!query || getSearchText(item).includes(query)) && (category === 'all' || read(item, 'category', 'Category') === category));
  }, [category, recurringExpenses, search]);

  const filteredFuture = useMemo(() => {
    const query = search.trim().toLowerCase();
    return [...futureExpenses]
      .filter((item) => (!query || getSearchText(item).includes(query)) && (category === 'all' || read(item, 'category', 'Category') === category))
      .sort((a, b) => new Date(read(a, 'dueDate', 'DueDate') || 0) - new Date(read(b, 'dueDate', 'DueDate') || 0));
  }, [category, futureExpenses, search]);

  const metrics = useMemo(() => {
    const paid = allExpenses.filter(isPaid);
    const unpaid = allExpenses.filter((expense) => !isPaid(expense));
    const deductible = allExpenses.filter(isTaxDeductible);
    const receiptCount = allExpenses.filter(hasReceipts).length;
    return {
      paid: paid.reduce((sum, expense) => sum + getAmount(expense), 0),
      unpaid: unpaid.reduce((sum, expense) => sum + getAmount(expense), 0),
      unpaidCount: unpaid.length,
      deductible: deductible.reduce((sum, expense) => sum + getAmount(expense), 0),
      receiptCoverage: allExpenses.length ? Math.round((receiptCount / allExpenses.length) * 100) : 0
    };
  }, [allExpenses]);

  const categorySummary = useMemo(() => {
    const totals = allExpenses.reduce((result, expense) => {
      const key = read(expense, 'category', 'Category') || 'Other';
      result[key] = (result[key] || 0) + getAmount(expense);
      return result;
    }, {});
    return Object.entries(totals).sort((a, b) => b[1] - a[1]).slice(0, 5);
  }, [allExpenses]);

  const csvData = visibleExpenses.map((expense) => ({
    Date: formatDate(read(expense, 'expenseDate', 'ExpenseDate')),
    Name: read(expense, 'name', 'Name') || '',
    Category: read(expense, 'category', 'Category') || '',
    Property: read(expense, 'propertyName', 'PropertyName') || '',
    Unit: read(expense, 'unitName', 'UnitName') || '',
    Vendor: read(expense, 'vendor', 'Vendor') || '',
    Status: isPaid(expense) ? 'Paid' : 'Unpaid',
    TaxDeductible: isTaxDeductible(expense) ? 'Yes' : 'No',
    Amount: getAmount(expense)
  }));

  const activeList = activeTab === 0 ? visibleExpenses : activeTab === 1 ? filteredRecurring : filteredFuture;
  const pageCount = Math.ceil(activeList.length / PAGE_SIZE);
  const pageItems = activeList.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);
  const hasFilters = search || period !== 'year' || category !== 'all' || status !== 'all' || sort !== 'newest' || propertyId;
  const expenseFilterFields = [
    {
      key: 'category',
      label: 'Category',
      value: category,
      defaultValue: 'all',
      onChange: setCategory,
      options: [{ value: 'all', label: 'All categories' }, ...EXPENSE_CATEGORIES.map((item) => ({ value: item, label: item }))]
    },
    ...(activeTab === 0 ? [{
      key: 'status',
      label: 'Record status',
      value: status,
      defaultValue: 'all',
      onChange: setStatus,
      options: [
        { value: 'all', label: 'All records' },
        { value: 'paid', label: 'Paid' },
        { value: 'unpaid', label: 'Unpaid' },
        { value: 'tax', label: 'Tax deductible' },
        { value: 'missing-receipt', label: 'Missing receipt' }
      ]
    }] : [])
  ];
  const expenseActiveChips = [
    ...(propertyId ? [{ key: 'property', label: read(selectedProperty, 'name', 'Name') || read(selectedProperty, 'address', 'Address') || 'Selected property', onDelete: () => dispatch(setProperty(null)) }] : []),
    ...(period !== 'year' ? [{ key: 'period', label: PERIOD_OPTIONS.find((item) => item.value === period)?.label || 'Date', onDelete: () => { setPeriod('year'); setCustomDates({ startDate: '', endDate: '' }); } }] : []),
    ...(category !== 'all' ? [{ key: 'category', label: category, onDelete: () => setCategory('all') }] : []),
    ...(activeTab === 0 && status !== 'all' ? [{ key: 'status', label: expenseFilterFields[1]?.options.find((item) => item.value === status)?.label || status, onDelete: () => setStatus('all') }] : []),
    ...(activeTab === 0 && sort !== 'newest' ? [{ key: 'sort', label: EXPENSE_SORT_OPTIONS.find((item) => item.value === sort)?.label || sort, onDelete: () => setSort('newest') }] : [])
  ];

  const clearFilters = () => {
    setSearch('');
    setPeriod('year');
    setCustomDates({ startDate: '', endDate: '' });
    setCategory('all');
    setStatus('all');
    setSort('newest');
    dispatch(setProperty(null));
  };

  const prepareExpenseSelection = (expense) => {
    const expensePropertyId = Number(read(expense, 'propertyId', 'PropertyId'));
    const property = properties?.find((item) => Number(getId(item)) === expensePropertyId);
    dispatch(setProperty(property || null));
    const unitId = Number(read(expense, 'unitId', 'UnitId'));
    const units = read(property, 'units', 'Units') || [];
    dispatch(setUnit(unitId ? units.find((unit) => Number(getId(unit)) === unitId) || null : null));
  };

  const markExpensePaid = async (expense) => {
    try {
      const id = getId(expense);
      const payload = {
        ...expense,
        id,
        propertyId: read(expense, 'propertyId', 'PropertyId'),
        unitId: read(expense, 'unitId', 'UnitId') || null,
        name: read(expense, 'name', 'Name') || '',
        category: read(expense, 'category', 'Category') || 'Other',
        amount: getAmount(expense),
        expenseDate: read(expense, 'expenseDate', 'ExpenseDate'),
        isPaid: true,
        paidDate: new Date().toISOString()
      };
      await dispatch(updateExpenseAction(id, payload));
      refetchExpenses();
      openSnackbar({ open: true, message: 'Expense marked as paid', variant: 'alert', alert: { color: 'success' } });
    } catch (error) {
      openSnackbar({ open: true, message: error?.response?.data?.message || 'Failed to mark expense as paid', variant: 'alert', alert: { color: 'error' } });
    }
  };

  const recordPlanPaid = async (item, type) => {
    try {
      const now = new Date();
      const date = toDateInput(now);
      await dispatch(addExpenseAction({
        landlordId,
        propertyId: read(item, 'propertyId', 'PropertyId'),
        unitId: read(item, 'unitId', 'UnitId') || null,
        name: read(item, 'name', 'Name') || '',
        category: read(item, 'category', 'Category') || 'Other',
        amount: getAmount(item),
        expenseDate: date,
        vendor: read(item, 'vendor', 'Vendor') || null,
        paymentMethod: read(item, 'paymentMethod', 'PaymentMethod') || null,
        isRecurring: type === 'recurring',
        isTaxDeductible: isTaxDeductible(item),
        maintenanceRequestId: read(item, 'maintenanceRequestId', 'MaintenanceRequestId') || null,
        isPaid: true,
        paidDate: now.toISOString()
      }));
      if (type === 'future') await dispatch(deleteFutureExpenseAction(getId(item)));
      refetchExpenses();
      await refreshPlans();
      openSnackbar({ open: true, message: type === 'future' ? 'Planned expense recorded as paid' : 'Recurring expense recorded as paid', variant: 'alert', alert: { color: 'success' } });
    } catch (error) {
      openSnackbar({ open: true, message: error?.response?.data?.message || 'Failed to record expense', variant: 'alert', alert: { color: 'error' } });
    }
  };

  const toggleRecurring = async (item) => {
    try {
      if (read(item, 'isPaused', 'IsPaused')) await dispatch(resumeRecurringExpenseAction(getId(item)));
      else await dispatch(pauseRecurringExpenseAction(getId(item)));
      await refreshPlans();
      openSnackbar({ open: true, message: read(item, 'isPaused', 'IsPaused') ? 'Schedule resumed' : 'Schedule paused', variant: 'alert', alert: { color: 'success' } });
    } catch (error) {
      openSnackbar({ open: true, message: 'Failed to update schedule', variant: 'alert', alert: { color: 'error' } });
    }
  };

  const confirmDelete = async () => {
    if (!deleteTarget) return;
    try {
      if (deleteTarget.type === 'expense') await dispatch(deleteExpenseAction(getId(deleteTarget.item)));
      if (deleteTarget.type === 'recurring') await dispatch(deleteRecurringExpenseAction(getId(deleteTarget.item)));
      if (deleteTarget.type === 'future') await dispatch(deleteFutureExpenseAction(getId(deleteTarget.item)));
      setDeleteTarget(null);
      refetchExpenses();
      await refreshPlans();
      openSnackbar({ open: true, message: 'Expense deleted', variant: 'alert', alert: { color: 'success' } });
    } catch (error) {
      openSnackbar({ open: true, message: error?.response?.data?.message || 'Failed to delete expense', variant: 'alert', alert: { color: 'error' } });
    }
  };

  return (
    <Box sx={{ pb: 3 }}>
      <Box sx={{ display: { xs: 'none', md: 'block' } }}>
        <PageBreadcrumbs items={[{ label: 'Dashboard', path: '/landlord/dashboard' }, { label: 'Expenses' }]} />
      </Box>

      <Box sx={{ mb: 2.5, p: { xs: 2, md: 2.75 }, borderRadius: 3, color: '#fff', background: `linear-gradient(120deg, ${NAVY} 0%, #0b3558 100%)`, boxShadow: `0 16px 38px ${alpha(NAVY, 0.18)}` }}>
        <Stack direction={{ xs: 'column', md: 'row' }} alignItems={{ md: 'center' }} justifyContent="space-between" spacing={2}>
          <Box>
            <Typography variant="h3" sx={{ color: '#fff', fontWeight: 750, letterSpacing: -0.4 }}>Expenses</Typography>
            <Typography sx={{ mt: 0.6, color: alpha('#fff', 0.72), fontSize: '0.88rem' }}>
              Track spending, clear unpaid items, and keep tax-ready records across your portfolio.
            </Typography>
          </Box>
          <Stack direction="row" spacing={1}>
            <CSVLink data={csvData} filename={`expenses-${toDateInput(new Date())}.csv`} style={{ textDecoration: 'none' }}>
              <Button variant="outlined" startIcon={<DownloadOutlined />} disabled={!visibleExpenses.length} sx={darkHeaderOutlinedActionSx}>
                Export
              </Button>
            </CSVLink>
            <Button variant="contained" color="success" startIcon={<PlusOutlined />} onClick={() => setAddOpen(true)} sx={{ textTransform: 'none', fontWeight: 700, boxShadow: 'none' }}>
              Add expense
            </Button>
          </Stack>
        </Stack>
      </Box>

      <Grid container spacing={1.5} sx={{ mb: 2.5 }}>
        <Grid size={{ xs: 6, lg: 3 }}><MetricCard label="Paid spending" value={formatMoney(metrics.paid)} helper="In the selected period" icon={<DollarOutlined />} color={theme.palette.primary.main} active={status === 'paid'} onClick={() => { setActiveTab(0); setStatus((value) => value === 'paid' ? 'all' : 'paid'); }} /></Grid>
        <Grid size={{ xs: 6, lg: 3 }}><MetricCard label="Still unpaid" value={formatMoney(metrics.unpaid)} helper={`${metrics.unpaidCount} item${metrics.unpaidCount === 1 ? '' : 's'} to clear`} icon={<ClockCircleOutlined />} color={theme.palette.warning.main} active={status === 'unpaid'} onClick={() => { setActiveTab(0); setStatus((value) => value === 'unpaid' ? 'all' : 'unpaid'); }} /></Grid>
        <Grid size={{ xs: 6, lg: 3 }}><MetricCard label="Tax deductible" value={formatMoney(metrics.deductible)} helper="Marked for tax reporting" icon={<FileDoneOutlined />} color={theme.palette.success.main} active={status === 'tax'} onClick={() => { setActiveTab(0); setStatus((value) => value === 'tax' ? 'all' : 'tax'); }} /></Grid>
        <Grid size={{ xs: 6, lg: 3 }}><MetricCard label="Receipt coverage" value={`${metrics.receiptCoverage}%`} helper="Click to find missing receipts" icon={<FileDoneOutlined />} color={theme.palette.error.main} active={status === 'missing-receipt'} onClick={() => { setActiveTab(0); setStatus((value) => value === 'missing-receipt' ? 'all' : 'missing-receipt'); }} /></Grid>
      </Grid>

      <Grid container spacing={2}>
        <Grid size={{ xs: 12, xl: 9 }}>
          <Box sx={{ bgcolor: 'background.paper', border: `1px solid ${alpha(theme.palette.divider, 0.16)}`, borderRadius: 3, boxShadow: `0 8px 28px ${alpha(NAVY, 0.055)}`, overflow: 'hidden' }}>
            <Box sx={{ px: { xs: 1.5, md: 2 }, borderBottom: `1px solid ${alpha(theme.palette.divider, 0.14)}` }}>
              <Tabs value={activeTab} onChange={(_, value) => setActiveTab(value)} variant="scrollable" scrollButtons="auto" sx={{ minHeight: 48, '& .MuiTab-root': { minHeight: 48, textTransform: 'none', fontWeight: 700 } }}>
                <Tab label={`Transactions (${visibleExpenses.length})`} />
                <Tab label={`Recurring (${filteredRecurring.length})`} />
                <Tab label={`Upcoming (${filteredFuture.length})`} />
              </Tabs>
            </Box>

            <Box sx={{ p: { xs: 1.5, md: 2 }, borderBottom: `1px solid ${alpha(theme.palette.divider, 0.14)}` }}>
              <TransactionFilterToolbar
                search={search}
                onSearchChange={setSearch}
                searchPlaceholder="Search name, vendor, category, or property"
                propertyControl={<PropertySelect width="100%" disableAllOption={false} label="" />}
                period={period}
                onPeriodChange={setPeriod}
                periodOptions={PERIOD_OPTIONS}
                sort={sort}
                onSortChange={setSort}
                sortOptions={activeTab === 0 ? EXPENSE_SORT_OPTIONS : []}
                filters={expenseFilterFields}
                activeChips={expenseActiveChips}
                onClearAll={clearFilters}
                customDates={customDates}
                onCustomDatesChange={setCustomDates}
              />
            </Box>

            {pageLoading ? <Box sx={{ minHeight: 280, display: 'grid', placeItems: 'center' }}><CircularProgress /></Box> : pageItems.length === 0 ? (
              <Box sx={{ px: 3, py: 7, textAlign: 'center' }}>
                <Avatar sx={{ width: 52, height: 52, mx: 'auto', bgcolor: alpha(theme.palette.primary.main, 0.1), color: 'primary.main' }}>{activeTab === 0 ? <DollarOutlined /> : activeTab === 1 ? <ReloadOutlined /> : <CalendarOutlined />}</Avatar>
                <Typography variant="h6" sx={{ mt: 1.5 }}>{hasFilters ? 'No expenses match this view' : activeTab === 0 ? 'No expenses yet' : activeTab === 1 ? 'No recurring expenses' : 'No upcoming expenses'}</Typography>
                <Typography color="text.secondary" sx={{ mt: 0.6, fontSize: '0.84rem' }}>{hasFilters ? 'Clear or adjust the filters to see more records.' : 'Add an expense to start building a clean financial record.'}</Typography>
                {hasFilters ? <Button onClick={clearFilters} sx={{ mt: 1.5, textTransform: 'none' }}>Clear filters</Button> : <Button variant="contained" startIcon={<PlusOutlined />} onClick={() => setAddOpen(true)} sx={{ mt: 2, textTransform: 'none' }}>Add expense</Button>}
              </Box>
            ) : (
              <>
                {!isMobile && <Box sx={{ px: 2, py: 1, display: 'grid', gridTemplateColumns: activeTab === 0 ? 'minmax(230px, 1.55fr) minmax(180px, 1.05fr) minmax(130px, .8fr) minmax(100px, .62fr) 44px' : 'minmax(230px, 1.5fr) minmax(180px, 1fr) minmax(150px, .8fr) minmax(100px, .6fr) minmax(130px, .75fr)', gap: 2, bgcolor: alpha(theme.palette.primary.main, 0.025), borderBottom: `1px solid ${alpha(theme.palette.divider, 0.12)}` }}>
                  {(activeTab === 0 ? ['Expense', 'Property', 'Date & status', 'Amount', ''] : ['Schedule', 'Property', 'Timing', 'Amount', 'Actions']).map((label, index) => <Typography key={`${label}-${index}`} sx={{ fontSize: '0.68rem', fontWeight: 750, letterSpacing: 0.55, textTransform: 'uppercase', color: 'text.secondary', textAlign: activeTab === 0 && index === 3 ? 'right' : 'left' }}>{label}</Typography>)}
                </Box>}
                {activeTab === 0 && pageItems.map((expense) => <ExpenseRow key={getId(expense)} expense={expense} onEdit={(item) => { prepareExpenseSelection(item); setEditExpense(item); }} onMarkPaid={markExpensePaid} onDelete={(item) => setDeleteTarget({ type: 'expense', item })} />)}
                {activeTab === 1 && pageItems.map((item) => <PlanRow key={getId(item)} item={item} type="recurring" onRecord={(value) => recordPlanPaid(value, 'recurring')} onToggle={toggleRecurring} onDelete={(value) => setDeleteTarget({ type: 'recurring', item: value })} />)}
                {activeTab === 2 && pageItems.map((item) => <PlanRow key={getId(item)} item={item} type="future" onRecord={(value) => recordPlanPaid(value, 'future')} onDelete={(value) => setDeleteTarget({ type: 'future', item: value })} />)}
              </>
            )}

            {pageCount > 1 && <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1.5} justifyContent="space-between" alignItems="center" sx={{ p: 2, borderTop: `1px solid ${alpha(theme.palette.divider, 0.14)}` }}>
              <Typography sx={{ fontSize: '0.78rem', color: 'text.secondary' }}>Showing {(page - 1) * PAGE_SIZE + 1}–{Math.min(page * PAGE_SIZE, activeList.length)} of {activeList.length}</Typography>
              <Pagination count={pageCount} page={page} onChange={(_, value) => setPage(value)} size="small" color="primary" />
            </Stack>}
          </Box>
        </Grid>

        <Grid size={{ xs: 12, xl: 3 }}>
          <Stack spacing={2}>
            <Box sx={{ p: 2, bgcolor: 'background.paper', border: `1px solid ${alpha(theme.palette.divider, 0.16)}`, borderRadius: 3, boxShadow: `0 8px 28px ${alpha(NAVY, 0.045)}` }}>
              <Typography fontWeight={750}>Spend by category</Typography>
              <Typography sx={{ mt: 0.35, fontSize: '0.75rem', color: 'text.secondary' }}>Top categories in the selected period</Typography>
              <Stack spacing={1.4} sx={{ mt: 2 }}>
                {categorySummary.length ? categorySummary.map(([name, amount], index) => {
                  const max = categorySummary[0][1] || 1;
                  return <Box key={name} component="button" type="button" onClick={() => { setActiveTab(0); setCategory(name); }} sx={{ p: 0, border: 0, bgcolor: 'transparent', color: 'inherit', textAlign: 'left', font: 'inherit', cursor: 'pointer' }}>
                    <Stack direction="row" justifyContent="space-between" spacing={1}><Typography sx={{ fontSize: '0.78rem', fontWeight: 650 }} noWrap>{name}</Typography><Typography sx={{ fontSize: '0.78rem', fontWeight: 700 }}>{formatMoney(amount)}</Typography></Stack>
                    <Box sx={{ mt: 0.65, height: 6, borderRadius: 8, bgcolor: alpha(theme.palette.divider, 0.14), overflow: 'hidden' }}><Box sx={{ width: `${Math.max((amount / max) * 100, 6)}%`, height: '100%', borderRadius: 8, bgcolor: index === 0 ? 'primary.main' : alpha(theme.palette.primary.main, 0.55) }} /></Box>
                  </Box>;
                }) : <Typography sx={{ fontSize: '0.8rem', color: 'text.secondary' }}>No category data yet.</Typography>}
              </Stack>
            </Box>

            <Box sx={{ p: 2, bgcolor: alpha(theme.palette.success.main, theme.palette.mode === 'dark' ? 0.1 : 0.045), border: `1px solid ${alpha(theme.palette.success.main, 0.2)}`, borderRadius: 3 }}>
              <Typography fontWeight={750}>Keep records tax-ready</Typography>
              <Typography sx={{ mt: 0.6, fontSize: '0.78rem', color: 'text.secondary', lineHeight: 1.55 }}>Attach receipts while the details are fresh, and mark deductible expenses so reports need less cleanup later.</Typography>
              <Button size="small" startIcon={<PlusOutlined />} onClick={() => setAddOpen(true)} sx={{ mt: 1.2, px: 0, textTransform: 'none' }}>Add with receipt</Button>
            </Box>
          </Stack>
        </Grid>
      </Grid>

      <ExpenseAddDrawer open={addOpen} onClose={() => setAddOpen(false)} onSuccess={() => { refetchExpenses(); refreshPlans(); }} />
      <ExpenseEditDrawer open={Boolean(editExpense)} expense={editExpense} onClose={() => setEditExpense(null)} onSuccess={() => { setEditExpense(null); refetchExpenses(); refreshPlans(); }} />
      <ConfirmationDialog open={Boolean(deleteTarget)} onClose={() => setDeleteTarget(null)} onConfirm={confirmDelete} title={deleteTarget?.type === 'recurring' ? 'Delete recurring schedule' : deleteTarget?.type === 'future' ? 'Delete planned expense' : 'Delete expense'} message={deleteTarget?.type === 'recurring' ? 'Delete this recurring schedule? Existing expense records will not be removed.' : 'Delete this expense? This action cannot be undone.'} confirmText="Delete" cancelText="Cancel" confirmColor="error" />
    </Box>
  );
}
