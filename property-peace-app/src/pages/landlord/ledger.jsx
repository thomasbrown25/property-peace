import { useEffect, useMemo, useState } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { useNavigate } from 'react-router-dom';
import { CSVLink } from 'react-csv';
import {
  alpha,
  Avatar,
  Box,
  Button,
  Chip,
  CircularProgress,
  Grid,
  InputAdornment,
  MenuItem,
  OutlinedInput,
  Pagination,
  Select,
  Stack,
  Typography,
  useMediaQuery,
  useTheme
} from '@mui/material';
import {
  AccountBookOutlined,
  ArrowDownOutlined,
  ArrowUpOutlined,
  CalendarOutlined,
  DollarOutlined,
  DownloadOutlined,
  FileTextOutlined,
  SearchOutlined,
  WalletOutlined
} from '@ant-design/icons';

import PageBreadcrumbs from 'components/breadcrumbs/PageBreadcrumbs';
import PropertySelect from 'components/PropertySelect';
import useFetchExpenses from 'hooks/useFetchExpenses';
import axiosServices from 'utils/axios';
import { formatCurrency } from 'utils/formatters';
import { selectProperty } from 'store/property/property.selector';
import { setProperty } from 'store/property/property.action';

const PAGE_SIZE = 12;
const NAVY = '#061e35';

const read = (object, camel, pascal) => object?.[camel] ?? object?.[pascal];

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

function parseLocalDate(value, endOfDay = false) {
  if (!value) return null;
  const [year, month, day] = value.split('-').map(Number);
  return new Date(year, month - 1, day, endOfDay ? 23 : 0, endOfDay ? 59 : 0, endOfDay ? 59 : 0, endOfDay ? 999 : 0);
}

function formatDate(value) {
  if (!value) return 'Not set';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return 'Not set';
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
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

function LedgerRow({ entry }) {
  const theme = useTheme();
  const isIncome = entry.amount >= 0;

  return (
    <Box
      sx={{
        px: { xs: 1.5, md: 2 },
        py: { xs: 1.55, md: 1.35 },
        display: { xs: 'block', md: 'grid' },
        gridTemplateColumns: 'minmax(250px, 1.55fr) minmax(170px, 1fr) minmax(130px, .75fr) minmax(110px, .65fr) minmax(120px, .7fr)',
        gap: { xs: 1.25, md: 2 },
        alignItems: 'center',
        borderBottom: `1px solid ${alpha(theme.palette.divider, 0.13)}`,
        '&:hover': { bgcolor: alpha(theme.palette.primary.main, theme.palette.mode === 'dark' ? 0.08 : 0.028) }
      }}
    >
      <Stack direction="row" spacing={1.25} alignItems="center" minWidth={0}>
        <Avatar sx={{ width: 40, height: 40, bgcolor: alpha(isIncome ? theme.palette.success.main : theme.palette.error.main, 0.1), color: isIncome ? 'success.main' : 'error.main' }}>
          {isIncome ? <ArrowUpOutlined /> : <ArrowDownOutlined />}
        </Avatar>
        <Box minWidth={0}>
          <Stack direction="row" spacing={0.7} alignItems="center">
            <Typography fontWeight={700} noWrap>{entry.description || 'Transaction'}</Typography>
            <Chip label={entry.transactionType} size="small" color={isIncome ? 'success' : 'error'} variant="outlined" sx={{ height: 20, fontSize: '0.64rem', flexShrink: 0 }} />
          </Stack>
          <Typography noWrap sx={{ mt: 0.25, fontSize: '0.73rem', color: 'text.secondary' }}>
            {[entry.reference, entry.propertyName, entry.unitName].filter(Boolean).join(' · ')}
          </Typography>
        </Box>
      </Stack>

      <Box>
        <Typography sx={{ fontSize: '0.82rem', fontWeight: 650 }}>{entry.accountName}</Typography>
        <Typography sx={{ mt: 0.25, fontSize: '0.71rem', color: 'text.secondary' }}>{entry.accountCode}</Typography>
      </Box>

      <Box>
        <Typography sx={{ fontSize: '0.8rem', fontWeight: 600 }}>{formatDate(entry.transactionDate)}</Typography>
        <Typography sx={{ mt: 0.25, fontSize: '0.7rem', color: 'text.secondary' }}>{isIncome ? 'Money in' : 'Money out'}</Typography>
      </Box>

      <Typography sx={{ fontSize: '0.92rem', fontWeight: 750, color: isIncome ? 'success.main' : 'error.main', textAlign: { md: 'right' } }}>
        {isIncome ? '+' : '−'}{formatCurrency(Math.abs(entry.amount))}
      </Typography>

      <Box sx={{ textAlign: { md: 'right' } }}>
        <Typography sx={{ fontSize: '0.88rem', fontWeight: 750 }}>{formatCurrency(entry.runningBalance)}</Typography>
        <Typography sx={{ mt: 0.2, fontSize: '0.68rem', color: 'text.secondary' }}>Running balance</Typography>
      </Box>
    </Box>
  );
}

export default function Ledger() {
  const dispatch = useDispatch();
  const navigate = useNavigate();
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('md'));
  const selectedProperty = useSelector(selectProperty);

  const [payments, setPayments] = useState([]);
  const [paymentsLoading, setPaymentsLoading] = useState(false);
  const [period, setPeriod] = useState('year');
  const [customDates, setCustomDates] = useState({ startDate: '', endDate: '' });
  const [search, setSearch] = useState('');
  const [type, setType] = useState('all');
  const [account, setAccount] = useState('all');
  const [sort, setSort] = useState('newest');
  const [page, setPage] = useState(1);

  const periodDates = period === 'custom' ? customDates : getPeriodDates(period);
  const propertyId = read(selectedProperty, 'id', 'Id') || null;
  const expenseFilters = useMemo(() => ({
    startDate: periodDates.startDate || null,
    endDate: periodDates.endDate || null,
    propertyId
  }), [periodDates.endDate, periodDates.startDate, propertyId]);
  const { expenses: allExpenses = [], loading: expensesLoading } = useFetchExpenses(expenseFilters);

  useEffect(() => {
    const fetchPayments = async () => {
      try {
        setPaymentsLoading(true);
        const params = new URLSearchParams();
        if (propertyId) params.append('propertyId', propertyId);
        const response = await axiosServices.get(`/api/payment/all?${params.toString()}`);
        const raw = response.data;
        const data = Array.isArray(raw) ? raw : raw?.data ?? raw?.Data ?? [];
        setPayments(Array.isArray(data) ? data : []);
      } catch {
        setPayments([]);
      } finally {
        setPaymentsLoading(false);
      }
    };
    fetchPayments();
  }, [propertyId]);

  useEffect(() => () => { dispatch(setProperty(null)); }, [dispatch]);

  const entries = useMemo(() => {
    const start = parseLocalDate(periodDates.startDate);
    const end = parseLocalDate(periodDates.endDate, true);
    const combined = [];

    payments.forEach((payment) => {
      const date = read(payment, 'paymentDate', 'PaymentDate');
      if (!date) return;
      const parsedDate = new Date(date);
      if ((start && parsedDate < start) || (end && parsedDate > end)) return;
      const amount = Number(read(payment, 'amount', 'Amount') || 0);
      const id = read(payment, 'id', 'Id');
      const propertyName = read(payment, 'propertyName', 'PropertyName') || '';
      const unitName = read(payment, 'unitName', 'UnitName') || '';
      const reference = read(payment, 'reference', 'Reference');
      const description = reference && typeof reference === 'string' && reference.includes(' payment')
        ? `${reference.split(' payment')[0].trim()}${unitName ? ` - ${unitName}` : ''}`
        : `Rent payment${propertyName ? ` - ${propertyName}` : ''}${unitName ? ` - ${unitName}` : ''}`;
      combined.push({
        id: `payment-${id}`,
        transactionDate: date,
        amount,
        description,
        reference: `Payment #${id}`,
        transactionType: 'Payment',
        accountCode: 'INCOME',
        accountName: 'Rent income',
        propertyName,
        unitName
      });
    });

    allExpenses.forEach((expense) => {
      if (!Boolean(read(expense, 'isPaid', 'IsPaid'))) return;
      const date = read(expense, 'paidDate', 'PaidDate') || read(expense, 'expenseDate', 'ExpenseDate') || read(expense, 'createdAt', 'CreatedAt');
      if (!date) return;
      const parsedDate = new Date(date);
      if ((start && parsedDate < start) || (end && parsedDate > end)) return;
      const id = read(expense, 'id', 'Id');
      combined.push({
        id: `expense-${id}`,
        transactionDate: date,
        amount: -Math.abs(Number(read(expense, 'amount', 'Amount') || 0)),
        description: read(expense, 'name', 'Name') || read(expense, 'description', 'Description') || 'Expense',
        reference: `Expense #${id}`,
        transactionType: 'Expense',
        accountCode: 'EXPENSE',
        accountName: read(expense, 'category', 'Category') || read(expense, 'categoryName', 'CategoryName') || 'Other',
        propertyName: read(expense, 'propertyName', 'PropertyName') || '',
        unitName: read(expense, 'unitName', 'UnitName') || ''
      });
    });

    combined.sort((a, b) => new Date(a.transactionDate) - new Date(b.transactionDate));
    let runningBalance = 0;
    return combined.map((entry) => {
      runningBalance += entry.amount;
      return { ...entry, runningBalance };
    });
  }, [allExpenses, payments, periodDates.endDate, periodDates.startDate]);

  const accountOptions = useMemo(() => [...new Set(entries.map((entry) => entry.accountName))].sort(), [entries]);

  const visibleEntries = useMemo(() => {
    const query = search.trim().toLowerCase();
    return entries
      .filter((entry) => type === 'all' || entry.transactionType.toLowerCase() === type)
      .filter((entry) => account === 'all' || entry.accountName === account)
      .filter((entry) => !query || [entry.description, entry.reference, entry.accountName, entry.propertyName, entry.unitName].filter(Boolean).join(' ').toLowerCase().includes(query))
      .sort((a, b) => {
        if (sort === 'oldest') return new Date(a.transactionDate) - new Date(b.transactionDate);
        if (sort === 'amount-high') return Math.abs(b.amount) - Math.abs(a.amount);
        if (sort === 'amount-low') return Math.abs(a.amount) - Math.abs(b.amount);
        return new Date(b.transactionDate) - new Date(a.transactionDate);
      });
  }, [account, entries, search, sort, type]);

  const metrics = useMemo(() => {
    const incomeEntries = entries.filter((entry) => entry.amount > 0);
    const expenseEntries = entries.filter((entry) => entry.amount < 0);
    const income = incomeEntries.reduce((sum, entry) => sum + entry.amount, 0);
    const expenses = Math.abs(expenseEntries.reduce((sum, entry) => sum + entry.amount, 0));
    return { income, expenses, net: income - expenses, count: entries.length, incomeCount: incomeEntries.length, expenseCount: expenseEntries.length };
  }, [entries]);

  const accountSummary = useMemo(() => {
    const totals = entries.reduce((result, entry) => {
      result[entry.accountName] = (result[entry.accountName] || 0) + Math.abs(entry.amount);
      return result;
    }, {});
    return Object.entries(totals).sort((a, b) => b[1] - a[1]).slice(0, 6);
  }, [entries]);

  const pageCount = Math.ceil(visibleEntries.length / PAGE_SIZE);
  const pageItems = visibleEntries.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);
  const loading = paymentsLoading || expensesLoading;
  const hasFilters = search || period !== 'year' || type !== 'all' || account !== 'all' || sort !== 'newest' || propertyId;

  useEffect(() => { setPage(1); }, [account, period, customDates.startDate, customDates.endDate, propertyId, search, sort, type]);

  const clearFilters = () => {
    setSearch('');
    setPeriod('year');
    setCustomDates({ startDate: '', endDate: '' });
    setType('all');
    setAccount('all');
    setSort('newest');
    dispatch(setProperty(null));
  };

  const csvData = visibleEntries.map((entry) => ({
    Date: formatDate(entry.transactionDate),
    Type: entry.transactionType,
    Account: entry.accountName,
    Description: entry.description,
    Reference: entry.reference,
    Property: entry.propertyName,
    Unit: entry.unitName,
    Amount: entry.amount,
    'Running Balance': entry.runningBalance
  }));

  return (
    <Box sx={{ pb: 3 }}>
      <Box sx={{ display: { xs: 'none', md: 'block' } }}>
        <PageBreadcrumbs items={[{ label: 'Dashboard', path: '/landlord/dashboard' }, { label: 'Ledger' }]} />
      </Box>

      <Box sx={{ mb: 2.5, p: { xs: 2, md: 2.75 }, borderRadius: 3, color: '#fff', background: `linear-gradient(120deg, ${NAVY} 0%, #0b3558 100%)`, boxShadow: `0 16px 38px ${alpha(NAVY, 0.18)}` }}>
        <Stack direction={{ xs: 'column', md: 'row' }} alignItems={{ md: 'center' }} justifyContent="space-between" spacing={2}>
          <Box>
            <Typography variant="h3" sx={{ color: '#fff', fontWeight: 750, letterSpacing: -0.4 }}>Ledger</Typography>
            <Typography sx={{ mt: 0.6, color: alpha('#fff', 0.72), fontSize: '0.88rem' }}>
              Follow every posted payment and paid expense, with account detail and a running portfolio balance.
            </Typography>
          </Box>
          <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap>
            <Button variant="outlined" onClick={() => navigate('/landlord/payments')} sx={{ color: '#fff', borderColor: alpha('#fff', 0.35), bgcolor: alpha('#fff', 0.06), textTransform: 'none', '&:hover': { borderColor: alpha('#fff', 0.65), bgcolor: alpha('#fff', 0.12) } }}>
              View payments
            </Button>
            <Button variant="outlined" onClick={() => navigate('/landlord/expenses')} sx={{ color: '#fff', borderColor: alpha('#fff', 0.35), bgcolor: alpha('#fff', 0.06), textTransform: 'none', '&:hover': { borderColor: alpha('#fff', 0.65), bgcolor: alpha('#fff', 0.12) } }}>
              Manage expenses
            </Button>
            <CSVLink data={csvData} filename={`ledger-${toDateInput(new Date())}.csv`} style={{ textDecoration: 'none' }}>
              <Button variant="contained" color="success" startIcon={<DownloadOutlined />} disabled={!visibleEntries.length} sx={{ textTransform: 'none', fontWeight: 700, boxShadow: 'none' }}>
                Export
              </Button>
            </CSVLink>
          </Stack>
        </Stack>
      </Box>

      <Grid container spacing={1.5} sx={{ mb: 2.5 }}>
        <Grid size={{ xs: 6, lg: 3 }}><MetricCard label="Money in" value={formatCurrency(metrics.income)} helper={`${metrics.incomeCount} posted payment${metrics.incomeCount === 1 ? '' : 's'}`} icon={<ArrowUpOutlined />} color={theme.palette.success.main} active={type === 'payment'} onClick={() => setType((value) => value === 'payment' ? 'all' : 'payment')} /></Grid>
        <Grid size={{ xs: 6, lg: 3 }}><MetricCard label="Money out" value={formatCurrency(metrics.expenses)} helper={`${metrics.expenseCount} paid expense${metrics.expenseCount === 1 ? '' : 's'}`} icon={<ArrowDownOutlined />} color={theme.palette.error.main} active={type === 'expense'} onClick={() => setType((value) => value === 'expense' ? 'all' : 'expense')} /></Grid>
        <Grid size={{ xs: 6, lg: 3 }}><MetricCard label="Net cash flow" value={formatCurrency(metrics.net)} helper="Income less paid expenses" icon={<DollarOutlined />} color={metrics.net >= 0 ? theme.palette.primary.main : theme.palette.warning.main} /></Grid>
        <Grid size={{ xs: 6, lg: 3 }}><MetricCard label="Posted entries" value={metrics.count} helper="In the selected period" icon={<FileTextOutlined />} color={theme.palette.info.main} active={type === 'all' && Boolean(metrics.count)} onClick={() => setType('all')} /></Grid>
      </Grid>

      <Grid container spacing={2}>
        <Grid size={{ xs: 12, xl: 9 }}>
          <Box sx={{ bgcolor: 'background.paper', border: `1px solid ${alpha(theme.palette.divider, 0.16)}`, borderRadius: 3, boxShadow: `0 8px 28px ${alpha(NAVY, 0.055)}`, overflow: 'hidden' }}>
            <Box sx={{ p: { xs: 1.5, md: 2 }, borderBottom: `1px solid ${alpha(theme.palette.divider, 0.14)}` }}>
              <Stack direction={{ xs: 'column', lg: 'row' }} spacing={1.1} alignItems={{ lg: 'center' }}>
                <OutlinedInput value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search description, reference, account, or property" size="small" startAdornment={<InputAdornment position="start"><SearchOutlined /></InputAdornment>} sx={{ flex: 1, minWidth: { lg: 270 }, borderRadius: 1.75 }} />
                <Stack direction="row" spacing={1} sx={{ overflowX: 'auto', pb: { xs: 0.25, lg: 0 } }}>
                  <Box sx={{ minWidth: 210, '& .MuiOutlinedInput-root': { height: 40, borderRadius: 1.75 }, '& .MuiInputLabel-root': { display: 'none' } }}><PropertySelect width="100%" disableAllOption={false} /></Box>
                  <Select size="small" value={period} onChange={(event) => setPeriod(event.target.value)} sx={{ minWidth: 125, borderRadius: 1.75 }}>
                    <MenuItem value="year">This year</MenuItem><MenuItem value="month">This month</MenuItem><MenuItem value="30">Last 30 days</MenuItem><MenuItem value="90">Last 90 days</MenuItem><MenuItem value="all">All time</MenuItem><MenuItem value="custom">Custom dates</MenuItem>
                  </Select>
                  <Select size="small" value={type} onChange={(event) => setType(event.target.value)} sx={{ minWidth: 125, borderRadius: 1.75 }}>
                    <MenuItem value="all">All entries</MenuItem><MenuItem value="payment">Payments</MenuItem><MenuItem value="expense">Expenses</MenuItem>
                  </Select>
                  <Select size="small" value={account} onChange={(event) => setAccount(event.target.value)} sx={{ minWidth: 145, borderRadius: 1.75 }}>
                    <MenuItem value="all">All accounts</MenuItem>{accountOptions.map((item) => <MenuItem key={item} value={item}>{item}</MenuItem>)}
                  </Select>
                  <Select size="small" value={sort} onChange={(event) => setSort(event.target.value)} sx={{ minWidth: 135, borderRadius: 1.75 }}>
                    <MenuItem value="newest">Newest first</MenuItem><MenuItem value="oldest">Oldest first</MenuItem><MenuItem value="amount-high">Amount: high</MenuItem><MenuItem value="amount-low">Amount: low</MenuItem>
                  </Select>
                </Stack>
              </Stack>
              {period === 'custom' && <Stack direction="row" spacing={1} sx={{ mt: 1.2 }}>
                <OutlinedInput type="date" size="small" value={customDates.startDate} onChange={(event) => setCustomDates((value) => ({ ...value, startDate: event.target.value }))} inputProps={{ 'aria-label': 'Start date' }} />
                <OutlinedInput type="date" size="small" value={customDates.endDate} onChange={(event) => setCustomDates((value) => ({ ...value, endDate: event.target.value }))} inputProps={{ 'aria-label': 'End date' }} />
              </Stack>}
              <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mt: 1 }}>
                <Typography sx={{ fontSize: '0.75rem', color: 'text.secondary' }}>{visibleEntries.length} of {entries.length} entries shown</Typography>
                {hasFilters && <Button size="small" onClick={clearFilters} sx={{ px: 0, textTransform: 'none' }}>Clear filters</Button>}
              </Stack>
            </Box>

            {loading ? <Box sx={{ minHeight: 300, display: 'grid', placeItems: 'center' }}><CircularProgress /></Box> : pageItems.length === 0 ? (
              <Box sx={{ px: 3, py: 7, textAlign: 'center' }}>
                <Avatar sx={{ width: 54, height: 54, mx: 'auto', bgcolor: alpha(theme.palette.primary.main, 0.1), color: 'primary.main' }}><AccountBookOutlined /></Avatar>
                <Typography variant="h6" sx={{ mt: 1.5 }}>{hasFilters ? 'No ledger entries match this view' : 'No posted ledger activity yet'}</Typography>
                <Typography color="text.secondary" sx={{ mt: 0.6, fontSize: '0.84rem' }}>{hasFilters ? 'Clear or adjust the filters to see more activity.' : 'Recorded payments and paid expenses will appear here automatically.'}</Typography>
                {hasFilters && <Button onClick={clearFilters} sx={{ mt: 1.5, textTransform: 'none' }}>Clear filters</Button>}
              </Box>
            ) : (
              <>
                {!isMobile && <Box sx={{ px: 2, py: 1, display: 'grid', gridTemplateColumns: 'minmax(250px, 1.55fr) minmax(170px, 1fr) minmax(130px, .75fr) minmax(110px, .65fr) minmax(120px, .7fr)', gap: 2, bgcolor: alpha(theme.palette.primary.main, 0.025), borderBottom: `1px solid ${alpha(theme.palette.divider, 0.12)}` }}>
                  {['Transaction', 'Account', 'Date', 'Amount', 'Balance'].map((label, index) => <Typography key={label} sx={{ fontSize: '0.68rem', fontWeight: 750, letterSpacing: 0.55, textTransform: 'uppercase', color: 'text.secondary', textAlign: index > 2 ? 'right' : 'left' }}>{label}</Typography>)}
                </Box>}
                {pageItems.map((entry) => <LedgerRow key={entry.id} entry={entry} />)}
              </>
            )}

            {pageCount > 1 && <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1.5} justifyContent="space-between" alignItems="center" sx={{ p: 2, borderTop: `1px solid ${alpha(theme.palette.divider, 0.14)}` }}>
              <Typography sx={{ fontSize: '0.78rem', color: 'text.secondary' }}>Showing {(page - 1) * PAGE_SIZE + 1}–{Math.min(page * PAGE_SIZE, visibleEntries.length)} of {visibleEntries.length}</Typography>
              <Pagination count={pageCount} page={page} onChange={(_, value) => setPage(value)} size="small" color="primary" />
            </Stack>}
          </Box>
        </Grid>

        <Grid size={{ xs: 12, xl: 3 }}>
          <Stack spacing={2}>
            <Box sx={{ p: 2, bgcolor: 'background.paper', border: `1px solid ${alpha(theme.palette.divider, 0.16)}`, borderRadius: 3, boxShadow: `0 8px 28px ${alpha(NAVY, 0.045)}` }}>
              <Stack direction="row" spacing={1} alignItems="center"><WalletOutlined /><Typography fontWeight={750}>Account activity</Typography></Stack>
              <Typography sx={{ mt: 0.5, fontSize: '0.75rem', color: 'text.secondary' }}>Largest accounts in the selected period</Typography>
              <Stack spacing={1.4} sx={{ mt: 2 }}>
                {accountSummary.length ? accountSummary.map(([name, amount], index) => {
                  const max = accountSummary[0][1] || 1;
                  return <Box key={name} component="button" type="button" onClick={() => setAccount(name)} sx={{ p: 0, border: 0, bgcolor: 'transparent', color: 'inherit', textAlign: 'left', font: 'inherit', cursor: 'pointer' }}>
                    <Stack direction="row" justifyContent="space-between" spacing={1}><Typography sx={{ fontSize: '0.78rem', fontWeight: 650 }} noWrap>{name}</Typography><Typography sx={{ fontSize: '0.78rem', fontWeight: 700 }}>{formatCurrency(amount)}</Typography></Stack>
                    <Box sx={{ mt: 0.65, height: 6, borderRadius: 8, bgcolor: alpha(theme.palette.divider, 0.14), overflow: 'hidden' }}><Box sx={{ width: `${Math.max((amount / max) * 100, 6)}%`, height: '100%', borderRadius: 8, bgcolor: index === 0 ? 'primary.main' : alpha(theme.palette.primary.main, 0.55) }} /></Box>
                  </Box>;
                }) : <Typography sx={{ fontSize: '0.8rem', color: 'text.secondary' }}>No account activity yet.</Typography>}
              </Stack>
            </Box>

            <Box sx={{ p: 2, bgcolor: alpha(theme.palette.info.main, theme.palette.mode === 'dark' ? 0.1 : 0.045), border: `1px solid ${alpha(theme.palette.info.main, 0.2)}`, borderRadius: 3 }}>
              <Stack direction="row" spacing={1} alignItems="center"><CalendarOutlined /><Typography fontWeight={750}>How this ledger works</Typography></Stack>
              <Typography sx={{ mt: 0.7, fontSize: '0.78rem', color: 'text.secondary', lineHeight: 1.55 }}>Only posted rent payments and expenses marked paid are included. Unpaid and scheduled expenses stay on the Expenses page until they affect cash flow.</Typography>
              <Button size="small" onClick={() => navigate('/landlord/expenses')} sx={{ mt: 1.2, px: 0, textTransform: 'none' }}>Review unpaid expenses</Button>
            </Box>
          </Stack>
        </Grid>
      </Grid>
    </Box>
  );
}
