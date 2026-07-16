import { useState, useEffect, useMemo } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import {
  Box,
  Typography,
  Button,
  TextField,
  FormControl,
  Select,
  MenuItem,
  CircularProgress,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Chip,
  alpha,
  useTheme,
  OutlinedInput,
  InputAdornment
} from '@mui/material';
import {
  DownloadOutlined,
  LeftOutlined,
  RightOutlined,
  SearchOutlined
} from '@ant-design/icons';
import MainCard from 'components/MainCard';
import { LandlordKpiCard } from 'components/landlord/PagePrimitives';
import AnimateIn from 'components/AnimateIn';
import PropertySelect from 'components/PropertySelect';
import { CSVLink } from 'react-csv';
import { formatCurrency } from 'utils/formatters';
import axiosServices from 'utils/axios';
import useFetchExpenses from 'hooks/useFetchExpenses';
import { selectProperty } from 'store/property/property.selector';
import { setProperty } from 'store/property/property.action';

const TRANSACTION_TYPES = {
  Expense: 'Expense',
  Payment: 'Payment',
  JournalEntry: 'Journal Entry'
};

const noLabelBg = {
  '& .MuiOutlinedInput-notchedOutline': { top: 0 },
  '& .MuiOutlinedInput-notchedOutline legend': { display: 'none' }
};

const formatDate = (dateString) => {
  if (!dateString) return '';
  return new Date(dateString).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' });
};

const parseLocalStart = (s) => {
  if (!s) return new Date(0);
  const [y, m, d] = s.split('-').map(Number);
  return new Date(y, m - 1, d, 0, 0, 0, 0);
};

const parseLocalEnd = (s) => {
  if (!s) return new Date(0);
  const [y, m, d] = s.split('-').map(Number);
  return new Date(y, m - 1, d, 23, 59, 59, 999);
};

export default function Ledger() {
  const theme = useTheme();
  const dispatch = useDispatch();
  const selectedProperty = useSelector(selectProperty);

  const [payments, setPayments] = useState([]);
  const [paymentsLoading, setPaymentsLoading] = useState(false);
  const [startDate, setStartDate] = useState(() => {
    const d = new Date();
    d.setFullYear(d.getFullYear() - 5);
    return d.toISOString().slice(0, 10);
  });
  const [endDate, setEndDate] = useState(new Date().toISOString().slice(0, 10));
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(0);
  const [itemsPerPage, setItemsPerPage] = useState(10);

  const expenseFilters = useMemo(() => ({
    startDate: startDate || null,
    endDate: endDate || null,
    propertyId: selectedProperty?.id || null
  }), [startDate, endDate, selectedProperty?.id]);

  const { expenses: allExpenses, loading: expensesLoading } = useFetchExpenses(expenseFilters);

  useEffect(() => {
    const fetch = async () => {
      try {
        setPaymentsLoading(true);
        const params = new URLSearchParams();
        if (selectedProperty?.id) params.append('propertyId', selectedProperty.id);
        const res = await axiosServices.get(`/api/payment/all?${params.toString()}`);
        const raw = res.data;
        const data = Array.isArray(raw) ? raw : raw?.data ?? raw?.Data ?? [];
        setPayments(Array.isArray(data) ? data : []);
      } catch {
        setPayments([]);
      } finally {
        setPaymentsLoading(false);
      }
    };
    fetch();
  }, [startDate, endDate, selectedProperty?.id]);

  // Clear property on unmount
  useEffect(() => () => { dispatch(setProperty(null)); }, [dispatch]);

  const loading = paymentsLoading || expensesLoading;

  const entries = useMemo(() => {
    const start = parseLocalStart(startDate);
    const end = parseLocalEnd(endDate);
    const combined = [];

    payments.forEach((p) => {
      const dateVal = p.paymentDate ?? p.PaymentDate;
      if (!dateVal) return;
      const d = new Date(dateVal);
      d.setHours(0, 0, 0, 0);
      if (d < start || d > end) return;
      const amount = parseFloat(p.amount ?? p.Amount) || 0;
      const id = p.id ?? p.Id;
      const propertyName = p.propertyName ?? p.PropertyName ?? '';
      const unitName = p.unitName ?? p.UnitName ?? '';
      const ref = p.reference ?? p.Reference;
      const desc = ref && typeof ref === 'string' && ref.includes(' payment')
        ? ref.split(' payment')[0].trim() + (unitName ? ` - ${unitName}` : '')
        : `Rent payment - ${propertyName}${unitName ? ` - ${unitName}` : ''}`;
      combined.push({
        id: `payment-${id}`,
        transactionDate: dateVal,
        amount,
        description: desc,
        reference: `Payment #${id}`,
        transactionType: 'Payment',
        accountCode: 'INCOME',
        accountName: 'Rent Income',
        createdAt: dateVal
      });
    });

    allExpenses?.forEach((e) => {
      if (!e.isPaid) return;
      const dateVal = e.paidDate || e.date || e.paymentDate || e.createdAt;
      if (!dateVal) return;
      const d = new Date(dateVal);
      d.setHours(0, 0, 0, 0);
      if (d < start || d > end) return;
      combined.push({
        id: `expense-${e.id}`,
        transactionDate: dateVal,
        amount: -(Math.abs(parseFloat(e.amount) || 0)),
        description: e.name || e.description || 'Expense',
        reference: `Expense #${e.id}`,
        transactionType: 'Expense',
        accountCode: 'EXPENSE',
        accountName: e.categoryName || e.category?.name || 'Expense',
        createdAt: dateVal
      });
    });

    combined.sort((a, b) => {
      const diff = new Date(a.transactionDate) - new Date(b.transactionDate);
      return diff !== 0 ? diff : new Date(a.createdAt || 0) - new Date(b.createdAt || 0);
    });

    return combined;
  }, [payments, allExpenses, startDate, endDate]);

  const entriesWithBalance = useMemo(() => {
    let running = 0;
    return entries.map((e) => { running += e.amount || 0; return { ...e, runningBalance: running }; });
  }, [entries]);

  const filteredEntries = useMemo(() => {
    if (!search.trim()) return entriesWithBalance;
    const q = search.toLowerCase();
    return entriesWithBalance.filter(
      (e) =>
        e.description?.toLowerCase().includes(q) ||
        e.reference?.toLowerCase().includes(q) ||
        e.accountName?.toLowerCase().includes(q)
    );
  }, [entriesWithBalance, search]);

  const metrics = useMemo(() => {
    const totalIncome = entriesWithBalance.filter((e) => e.amount > 0).reduce((s, e) => s + e.amount, 0);
    const totalExpenses = Math.abs(entriesWithBalance.filter((e) => e.amount < 0).reduce((s, e) => s + e.amount, 0));
    const netBalance = entriesWithBalance.reduce((s, e) => s + e.amount, 0);
    return { totalEntries: entriesWithBalance.length, totalIncome, totalExpenses, netBalance };
  }, [entriesWithBalance]);

  const totalPages = Math.ceil(filteredEntries.length / itemsPerPage);
  const paginated = useMemo(() => filteredEntries.slice(page * itemsPerPage, page * itemsPerPage + itemsPerPage), [filteredEntries, page, itemsPerPage]);

  useEffect(() => { setPage(0); }, [itemsPerPage, search, selectedProperty?.id]);

  const csvData = useMemo(() =>
    entriesWithBalance.map((e) => ({
      Date: formatDate(e.transactionDate),
      Account: `${e.accountCode} - ${e.accountName}`,
      Description: e.description || '',
      Reference: e.reference || '',
      Amount: e.amount || 0,
      'Running Balance': e.runningBalance || 0,
      Type: e.transactionType || ''
    })), [entriesWithBalance]);

  return (
    <Box sx={{ overflow: 'visible' }}>
      {/* Header */}
      <AnimateIn direction="bottom" delay={100} distance={120}>
        <Box sx={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', flexWrap: 'wrap', gap: 2, mb: 3 }}>
          <Box>
            <Typography variant="h4" fontWeight={700} sx={{ lineHeight: 1.2 }}>
              Ledger
            </Typography>
            <Typography variant="caption" color="text.secondary">
              View all financial transactions — income and expenses — with running balance
            </Typography>
          </Box>
          <CSVLink data={csvData} filename={`ledger-${new Date().toISOString().slice(0, 10)}.csv`} style={{ textDecoration: 'none' }}>
            <Button
              size="small"
              variant="outlined"
              startIcon={<DownloadOutlined style={{ fontSize: 13 }} />}
              disabled={entriesWithBalance.length === 0}
              sx={{ textTransform: 'none', borderRadius: 1.5 }}
            >
              Export CSV
            </Button>
          </CSVLink>
        </Box>
      </AnimateIn>

      {/* KPI cards */}
      <AnimateIn direction="bottom" delay={150} distance={120}>
        <Box sx={{ display: 'flex', gap: 2, mb: 3, flexWrap: 'wrap' }}>
          {[
            { label: 'TOTAL ENTRIES', value: metrics.totalEntries },
            { label: 'TOTAL INCOME', value: formatCurrency(metrics.totalIncome) },
            { label: 'TOTAL EXPENSES', value: formatCurrency(metrics.totalExpenses) },
            { label: 'NET BALANCE', value: formatCurrency(metrics.netBalance) }
          ].map((kpi) => (
            <LandlordKpiCard key={kpi.label} label={kpi.label} value={kpi.value} />
          ))}
        </Box>
      </AnimateIn>

      {/* Toolbar */}
      <AnimateIn direction="bottom" delay={200} distance={120}>
        <Box sx={{ display: 'flex', gap: 1.5, alignItems: 'center', mb: 2 }}>
          <OutlinedInput
            size="small"
            placeholder="Search ledger..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            startAdornment={<InputAdornment position="start"><SearchOutlined style={{ fontSize: 14, opacity: 0.5 }} /></InputAdornment>}
            sx={{ flex: 2, minWidth: 0, bgcolor: 'background.paper', height: 34, fontSize: '0.8rem' }}
          />
          <TextField
            size="small"
            type="date"
            label="Start Date"
            value={startDate}
            onChange={(e) => setStartDate(e.target.value)}
            InputLabelProps={{ shrink: true, style: { backgroundColor: 'transparent' } }}
            sx={{ flex: 1.5, minWidth: 0, ...noLabelBg }}
            inputProps={{ style: { height: 17, fontSize: '0.8rem' } }}
          />
          <TextField
            size="small"
            type="date"
            label="End Date"
            value={endDate}
            onChange={(e) => setEndDate(e.target.value)}
            InputLabelProps={{ shrink: true, style: { backgroundColor: 'transparent' } }}
            sx={{ flex: 1.5, minWidth: 0, ...noLabelBg }}
            inputProps={{ style: { height: 17, fontSize: '0.8rem' } }}
          />
          <Box sx={{ flex: 2, minWidth: 0, '& .MuiInputLabel-root': { backgroundColor: 'transparent !important' }, ...noLabelBg }}>
            <PropertySelect width="100%" disableAllOption={false} />
          </Box>
        </Box>
      </AnimateIn>

      {/* Table */}
      <AnimateIn direction="bottom" delay={250} distance={120}>
        <MainCard content={false} boxShadow border={false} shadow={theme.palette.mode === 'dark' ? `0 0 0 1px ${alpha(theme.palette.primary.main, 0.22)}, 0 8px 28px ${alpha(theme.palette.primary.main, 0.14)}` : `0 2px 12px ${alpha(theme.palette.primary.main, 0.08)}`} sx={{ bgcolor: 'background.paper', overflow: 'hidden', border: `1px solid ${alpha(theme.palette.divider, theme.palette.mode === 'dark' ? 0.18 : 0.1)}` }}>
          {loading ? (
            <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: 200 }}>
              <CircularProgress />
            </Box>
          ) : filteredEntries.length === 0 ? (
            <Box sx={{ p: 5, textAlign: 'center' }}>
              <Typography variant="h6" color="text.secondary" sx={{ mt: 2 }}>No ledger entries found</Typography>
              <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
                Adjust your filters or date range to see entries.
              </Typography>
            </Box>
          ) : (
            <TableContainer>
              <Table>
                <TableHead>
                  <TableRow>
                    <TableCell>Date</TableCell>
                    <TableCell>Account</TableCell>
                    <TableCell>Description</TableCell>
                    <TableCell>Reference</TableCell>
                    <TableCell align="right">Amount</TableCell>
                    <TableCell align="right">Running Balance</TableCell>
                    <TableCell>Type</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {paginated.map((entry) => (
                    <TableRow key={entry.id} hover>
                      <TableCell>{formatDate(entry.transactionDate)}</TableCell>
                      <TableCell>
                        <Typography variant="body2" color="text.secondary">
                          {entry.accountCode} - {entry.accountName}
                        </Typography>
                      </TableCell>
                      <TableCell>
                        <Typography variant="body2">{entry.description || '-'}</Typography>
                      </TableCell>
                      <TableCell>
                        <Typography variant="body2" color="text.secondary">{entry.reference || '-'}</Typography>
                      </TableCell>
                      <TableCell align="right">
                        <Typography variant="body2" fontWeight={500} sx={{ color: entry.amount >= 0 ? 'success.main' : 'error.main' }}>
                          {formatCurrency(entry.amount)}
                        </Typography>
                      </TableCell>
                      <TableCell align="right">
                        <Typography variant="body2" fontWeight={500}>{formatCurrency(entry.runningBalance)}</Typography>
                      </TableCell>
                      <TableCell>
                        <Chip
                          label={TRANSACTION_TYPES[entry.transactionType] || entry.transactionType}
                          size="small"
                          color={entry.transactionType === 'Payment' ? 'success' : entry.transactionType === 'Expense' ? 'error' : 'default'}
                        />
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </TableContainer>
          )}

        </MainCard>
        {filteredEntries.length > 0 && (
          <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mt: 2 }}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
              <Typography variant="body2" color="text.secondary">Items per page:</Typography>
              <FormControl size="small" sx={{ minWidth: 80 }}>
                <Select value={itemsPerPage} onChange={(e) => setItemsPerPage(Number(e.target.value))} sx={{ height: 32 }}>
                  <MenuItem value={10}>10</MenuItem>
                  <MenuItem value={20}>20</MenuItem>
                </Select>
              </FormControl>
            </Box>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
              <Typography variant="body2" color="text.secondary">Page {page + 1} of {totalPages}</Typography>
              <Box sx={{ display: 'flex', gap: 1 }}>
                <Button size="small" variant="outlined" startIcon={<LeftOutlined />} onClick={() => setPage((p) => Math.max(0, p - 1))} disabled={page === 0} sx={{ minWidth: 100 }}>Previous</Button>
                <Button size="small" variant="outlined" endIcon={<RightOutlined />} onClick={() => setPage((p) => Math.min(totalPages - 1, p + 1))} disabled={page >= totalPages - 1} sx={{ minWidth: 100 }}>Next</Button>
              </Box>
            </Box>
          </Box>
        )}
      </AnimateIn>
    </Box>
  );
}
