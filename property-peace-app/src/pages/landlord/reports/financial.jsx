import { useState, useEffect, useMemo, useRef } from 'react';
import { useSearchParams } from 'react-router-dom';
import {
  Grid,
  Box,
  Typography,
  Button,
  Stack,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  TextField,
  alpha,
  Menu,
  CircularProgress,
  Alert,
  Table,
  TableHead,
  TableBody,
  TableRow,
  TableCell,
  TableContainer,
  Chip
} from '@mui/material';
import { DownloadOutlined, FileExcelOutlined, FilePdfOutlined, BarChartOutlined } from '@ant-design/icons';

const noLabelBg = {
  '& .MuiOutlinedInput-notchedOutline': { top: 0 },
  '& .MuiOutlinedInput-notchedOutline legend': { display: 'none' }
};
import MainCard from 'components/MainCard';
import PropertySelect from 'components/PropertySelect';
import VendorSelect from 'components/VendorSelect';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend, PieChart, Pie, Cell, ComposedChart, Line, Area } from 'recharts';
import { useTheme } from '@mui/material/styles';
import { CSVLink } from 'react-csv';
import useAuth from 'hooks/useAuth';
import { useSelector } from 'react-redux';
import { selectProperty } from 'store/property/property.selector';
import PageBreadcrumbs from 'components/breadcrumbs/PageBreadcrumbs';
import { expenseAPI } from 'api';
import axiosServices from 'utils/axios';

const EXPENSE_CATEGORIES = [
  'Repairs',
  'Maintenance',
  'Utilities',
  'Insurance',
  'Property Taxes',
  'Property Management',
  'Marketing',
  'Legal',
  'Other'
];

const COLORS = ['#1890ff', '#52c41a', '#faad14', '#f5222d', '#722ed1', '#eb2f96', '#13c2c2', '#fa8c16', '#2f54eb'];

const formatDateDisplay = (dateStr) => {
  if (!dateStr) return '';
  return new Date(dateStr + 'T00:00:00').toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
};

export default function FinancialReports() {
  const { user } = useAuth();

  const selectedProperty = useSelector(selectProperty);
  const theme = useTheme();


  const [searchParams] = useSearchParams();

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [warning, setWarning] = useState(null);
  const [activityStatusKnown, setActivityStatusKnown] = useState(false);
  const requestSequence = useRef(0);
  const [startDate, setStartDate] = useState(() => {
    const date = new Date();
    date.setMonth(date.getMonth() - 6);
    return date.toISOString().slice(0, 10);
  });
  const [endDate, setEndDate] = useState(new Date().toISOString().slice(0, 10));
  const [category, setCategory] = useState('all');
  const [vendorId, setVendorId] = useState(null);
  const [year1, setYear1] = useState(new Date().getFullYear() - 1);
  const [year2, setYear2] = useState(new Date().getFullYear());

  const [expenseReport, setExpenseReport] = useState([]);
  const [summary, setSummary] = useState(null);
  const [byCategory, setByCategory] = useState([]);
  const [profitability, setProfitability] = useState([]);
  const [yoyComparison, setYoyComparison] = useState([]);
  const [yoyIncome, setYoyIncome] = useState([]);
  const [expenseTrends, setExpenseTrends] = useState([]);
  const [rentSummary, setRentSummary] = useState(null);
  const [exportMenuAnchor, setExportMenuAnchor] = useState(null);

  const landlordId = user?.id || user?.Id;

  const filters = useMemo(() => ({
    propertyId: selectedProperty?.id || null,
    startDate: startDate || null,
    endDate: endDate || null,
    category: category !== 'all' ? category : null,
    vendorId: vendorId || null
  }), [selectedProperty, startDate, endDate, category, vendorId]);

  useEffect(() => {
    if (landlordId) {
      fetchData();
    }
  }, [landlordId, filters, year1, year2]);

  const fetchData = async () => {
    if (!landlordId) return;

    const requestId = ++requestSequence.current;
    setLoading(true);
    setError(null);
    setWarning(null);
    setActivityStatusKnown(false);

    try {
      const results = await Promise.allSettled([
        expenseAPI.getExpenseReport(filters),
        expenseAPI.getExpenseReportSummary(filters),
        expenseAPI.getExpenseReportByCategory(filters),
        expenseAPI.getPropertyProfitability({ propertyId: filters.propertyId, startDate: filters.startDate, endDate: filters.endDate }),
        expenseAPI.getYearOverYearComparison({ propertyId: filters.propertyId, year1, year2 }),
        expenseAPI.getIncomeByYear({ propertyId: filters.propertyId, year1, year2 }),
        expenseAPI.getExpenseTrends({ propertyId: filters.propertyId, startDate: filters.startDate, endDate: filters.endDate, groupBy: 'month' }),
        axiosServices.get('/api/rent-collection', { params: { ...(filters.propertyId ? { propertyId: filters.propertyId } : {}) } })
      ]);

      if (requestId !== requestSequence.current) return;

      const labels = ['expense detail', 'expense summary', 'category breakdown', 'property profitability', 'year comparison', 'income comparison', 'expense trends', 'rent collection'];
      const failedLabels = results.flatMap((result, index) => result.status === 'rejected' ? [labels[index]] : []);
      setActivityStatusKnown(results.slice(0, 3).every((result) => result.status === 'fulfilled'));
      if (failedLabels.length === results.length) throw results[0].reason;
      if (failedLabels.length) setWarning(`Some report sections could not be refreshed: ${failedLabels.join(', ')}. Available sections are shown.`);

      const value = (index) => results[index].status === 'fulfilled' ? results[index].value : null;
      const [reportRes, summaryRes, categoryRes, profitabilityRes, yoyRes, incomeRes, trendsRes, rentRes] = results.map((_, index) => value(index));

      setExpenseReport(reportRes?.data?.data ?? (Array.isArray(reportRes?.data) ? reportRes.data : []));
      setSummary(summaryRes?.data?.data ?? (summaryRes?.data !== undefined && !Array.isArray(summaryRes.data) ? summaryRes.data : null));
      setByCategory(categoryRes?.data?.data ?? (Array.isArray(categoryRes?.data) ? categoryRes.data : []));
      setProfitability(profitabilityRes?.data?.data ?? (Array.isArray(profitabilityRes?.data) ? profitabilityRes.data : []));
      setYoyComparison(yoyRes?.data?.data ?? (Array.isArray(yoyRes?.data) ? yoyRes.data : []));
      setYoyIncome(incomeRes?.data?.data ?? (Array.isArray(incomeRes?.data) ? incomeRes.data : []));
      setExpenseTrends(trendsRes?.data?.data ?? (Array.isArray(trendsRes?.data) ? trendsRes.data : []));
      setRentSummary(rentRes?.data?.data ?? (rentRes?.data && !Array.isArray(rentRes.data) ? rentRes.data : null));

      if (reportRes?.success === false || summaryRes?.success === false) {
        setError(reportRes?.message || summaryRes?.message || 'Failed to load reports');
      }
    } catch (err) {
      if (requestId !== requestSequence.current) return;
      console.error('Error fetching reports:', err);
      setError(err?.response?.data?.message || err?.message || 'Failed to load reports. Please check your connection and try again.');
    } finally {
      if (requestId === requestSequence.current) setLoading(false);
    }
  };

  const csvData = useMemo(() => {
    return expenseReport.map(expense => ({
      Date: expense.expenseDate,
      Property: expense.propertyName || 'N/A',
      Unit: expense.unitName || 'N/A',
      Category: expense.category,
      Description: expense.name,
      Amount: expense.amount,
      Vendor: expense.vendorName || expense.vendor || 'N/A',
      'Payment Method': expense.paymentMethod || 'N/A',
      'Tax Deductible': expense.isTaxDeductible ? 'Yes' : 'No',
      Recurring: expense.isRecurring ? 'Yes' : 'No'
    }));
  }, [expenseReport]);

  const csvHeaders = [
    { label: 'Date', key: 'Date' },
    { label: 'Property', key: 'Property' },
    { label: 'Unit', key: 'Unit' },
    { label: 'Category', key: 'Category' },
    { label: 'Description', key: 'Description' },
    { label: 'Amount', key: 'Amount' },
    { label: 'Vendor', key: 'Vendor' },
    { label: 'Payment Method', key: 'Payment Method' },
    { label: 'Tax Deductible', key: 'Tax Deductible' },
    { label: 'Recurring', key: 'Recurring' }
  ];

  const profitabilityTotals = useMemo(() => {
    const validRows = profitability.filter(p => p.propertyName);
    return {
      totalRent: validRows.reduce((sum, p) => sum + (p.totalRent || 0), 0),
      netIncome: validRows.reduce((sum, p) => sum + (p.netIncome || 0), 0)
    };
  }, [profitability]);

  const collectionRate = useMemo(() => {
    if (!rentSummary || !rentSummary.expectedThisMonth) return null;
    return (rentSummary.collectedThisMonth / rentSummary.expectedThisMonth) * 100;
  }, [rentSummary]);

  // Monthly net income trend: merge expense trends with income from yoyIncome
  const netIncomeTrendData = useMemo(() => {
    if (!expenseTrends || expenseTrends.length === 0) return [];

    const year2IncomeData = yoyIncome?.find(y => y.year === year2);
    const year1IncomeData = yoyIncome?.find(y => y.year === year1);

    return expenseTrends.map(trend => {
      const d = new Date(trend.period);
      const monthName = d.toLocaleString('default', { month: 'short' });
      const yr = d.getFullYear();
      const incomeSource = yr === year2 ? year2IncomeData : yr === year1 ? year1IncomeData : null;
      const income = incomeSource?.monthlyBreakdown?.[monthName] || 0;
      const expenses = trend.totalAmount || 0;
      return {
        label: trend.periodLabel || `${monthName} ${yr}`,
        income,
        expenses,
        net: income - expenses
      };
    });
  }, [expenseTrends, yoyIncome, year1, year2]);

  const categoryChartData = useMemo(() => {
    return byCategory.map(cat => ({
      name: cat.category,
      value: cat.totalAmount,
      percentage: cat.percentage
    }));
  }, [byCategory]);

  const vendorChartData = useMemo(() => {
    if (!summary?.byVendor || summary.byVendor.length === 0) return [];
    return summary.byVendor.map(vendor => ({
      name: vendor.vendorName || 'Unknown Vendor',
      value: vendor.totalAmount,
      percentage: vendor.percentage
    }));
  }, [summary?.byVendor]);

  const yoyChartData = useMemo(() => {
    if (!yoyComparison || yoyComparison.length !== 2) return [];

    const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    const year1ExpenseData = yoyComparison.find(y => y.year === year1);
    const year2ExpenseData = yoyComparison.find(y => y.year === year2);
    const year1IncomeData = yoyIncome?.find(y => y.year === year1);
    const year2IncomeData = yoyIncome?.find(y => y.year === year2);

    return months.map(month => ({
      month,
      [`${year1} Expenses`]: year1ExpenseData?.monthlyBreakdown?.[month] || 0,
      [`${year1} Income`]: year1IncomeData?.monthlyBreakdown?.[month] || 0,
      [`${year2} Expenses`]: year2ExpenseData?.monthlyBreakdown?.[month] || 0,
      [`${year2} Income`]: year2IncomeData?.monthlyBreakdown?.[month] || 0
    }));
  }, [yoyComparison, yoyIncome, year1, year2]);

  const hasChartData = yoyChartData.length > 0 || categoryChartData.length > 0 || vendorChartData.length > 0 || profitability.length > 0 || netIncomeTrendData.length > 0;

  return (
    <Box>
      <PageBreadcrumbs
        items={[
          { label: 'Dashboard', path: '/landlord/dashboard' },
          { label: 'Reports & Analytics', path: '/landlord/reports' },
          { label: 'Financial Reports' }
        ]}
      />

      {/* Header */}
      <Box sx={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', flexWrap: 'wrap', gap: 2, mb: 3 }}>
        <Box>
          <Typography variant="h4" fontWeight={700} sx={{ lineHeight: 1.2 }}>Financial Reports</Typography>
          <Typography variant="caption" color="text.secondary">
            Expense reports, profitability analysis, and year-over-year comparisons
          </Typography>
        </Box>
        <Stack direction="row" spacing={1} alignItems="center">
          <Button
            size="small"
            variant="outlined"
            startIcon={<DownloadOutlined />}
            onClick={(e) => setExportMenuAnchor(e.currentTarget)}
            aria-haspopup="menu"
            aria-expanded={Boolean(exportMenuAnchor)}
            aria-controls={exportMenuAnchor ? 'financial-export-menu' : undefined}
            sx={{ textTransform: 'none', borderRadius: 1.5 }}
          >
            Export
          </Button>
          <Menu id="financial-export-menu" anchorEl={exportMenuAnchor} open={Boolean(exportMenuAnchor)} onClose={() => setExportMenuAnchor(null)}>
            <MenuItem onClick={() => setExportMenuAnchor(null)}>
              <CSVLink data={csvData} headers={csvHeaders} filename={`expense-report-${startDate}-to-${endDate}.csv`} style={{ textDecoration: 'none', color: 'inherit', display: 'flex', alignItems: 'center' }}>
                <FileExcelOutlined style={{ marginRight: 8 }} />Export CSV
              </CSVLink>
            </MenuItem>
            <MenuItem disabled><FileExcelOutlined style={{ marginRight: 8 }} />Export Excel (coming soon)</MenuItem>
            <MenuItem disabled><FilePdfOutlined style={{ marginRight: 8 }} />Export PDF (coming soon)</MenuItem>
          </Menu>
        </Stack>
      </Box>

      {/* Toolbar */}
      <Box sx={{ display: 'flex', gap: 1.5, alignItems: 'center', mb: 2, flexWrap: 'wrap' }}>
        <TextField
          size="small"
          type="date"
          label="Start Date"
          value={startDate}
          onChange={(e) => setStartDate(e.target.value)}
          InputLabelProps={{ shrink: true, style: { backgroundColor: 'transparent' } }}
          sx={{ flex: 1, minWidth: 140, ...noLabelBg }}
          inputProps={{ style: { height: 17, fontSize: '0.8rem' } }}
        />
        <TextField
          size="small"
          type="date"
          label="End Date"
          value={endDate}
          onChange={(e) => setEndDate(e.target.value)}
          InputLabelProps={{ shrink: true, style: { backgroundColor: 'transparent' } }}
          sx={{ flex: 1, minWidth: 140, ...noLabelBg }}
          inputProps={{ style: { height: 17, fontSize: '0.8rem' } }}
        />
        <FormControl size="small" sx={{ flex: 1, minWidth: 150, ...noLabelBg }}>
          <Select inputProps={{ 'aria-label': 'Expense category' }} displayEmpty value={category} onChange={(e) => setCategory(e.target.value)} sx={{ height: 34, fontSize: '0.8rem' }}>
            <MenuItem value="all">All Categories</MenuItem>
            {EXPENSE_CATEGORIES.map((cat) => (
              <MenuItem key={cat} value={cat}>{cat}</MenuItem>
            ))}
          </Select>
        </FormControl>
        <Box sx={{ flex: 1.5, minWidth: 160, '& .MuiInputLabel-root': { backgroundColor: 'transparent !important' }, ...noLabelBg }}>
          <PropertySelect disableAllOption={false} width="100%" />
        </Box>
        <Box sx={{ flex: 1.5, minWidth: 160, ...noLabelBg }}>
          <VendorSelect width="100%" value={vendorId} onChange={(id) => setVendorId(id)} label="Filter by Vendor" />
        </Box>
      </Box>

      {loading && (
        <Box role="status" aria-live="polite" sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 1.5, p: 4 }}>
          <CircularProgress size={24} />
          <Typography color="text.secondary">Loading financial reports…</Typography>
        </Box>
      )}
      {error && (
        <Alert severity="error" sx={{ mb: 3 }} action={<Button color="inherit" onClick={fetchData}>Try again</Button>}>
          <Typography fontWeight={700}>Unable to load financial reports</Typography>
          <Typography variant="body2">{error}</Typography>
        </Alert>
      )}
      {warning && !error && <Alert severity="warning" sx={{ mb: 3 }}>{warning}</Alert>}

      {/* KPI cards */}
      {!loading && !error && (profitability.length > 0 || summary) && (
        <Box sx={{ display: 'flex', gap: 2, mb: 3, flexWrap: 'wrap' }}>
          {profitability.length > 0 && <>
            <Box key="rent" sx={{ flex: '1 1 160px', border: '1px dashed rgba(0,0,0,0.15)', borderRadius: 2, p: 2, bgcolor: 'background.paper' }}>
              <Typography variant="caption" color="text.secondary" fontWeight={600} sx={{ textTransform: 'uppercase', letterSpacing: 0.6, display: 'block', mb: 0.5 }}>Total Rent Income</Typography>
              <Typography variant="h4" fontWeight={700} color="success.main">${profitabilityTotals.totalRent.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</Typography>
              <Typography variant="caption" color="text.secondary">selected period</Typography>
            </Box>
            <Box key="net" sx={{ flex: '1 1 160px', border: '1px dashed rgba(0,0,0,0.15)', borderRadius: 2, p: 2, bgcolor: 'background.paper' }}>
              <Typography variant="caption" color="text.secondary" fontWeight={600} sx={{ textTransform: 'uppercase', letterSpacing: 0.6, display: 'block', mb: 0.5 }}>Net Income</Typography>
              <Typography variant="h4" fontWeight={700} color={profitabilityTotals.netIncome >= 0 ? 'success.main' : 'error.main'}>${profitabilityTotals.netIncome.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</Typography>
              <Typography variant="caption" color="text.secondary">rent minus expenses</Typography>
            </Box>
            <Box key="collection" sx={{ flex: '1 1 160px', border: '1px dashed rgba(0,0,0,0.15)', borderRadius: 2, p: 2, bgcolor: 'background.paper' }}>
              <Typography variant="caption" color="text.secondary" fontWeight={600} sx={{ textTransform: 'uppercase', letterSpacing: 0.6, display: 'block', mb: 0.5 }}>Collection Rate</Typography>
              <Typography variant="h4" fontWeight={700} color={collectionRate !== null && collectionRate >= 90 ? 'success.main' : collectionRate !== null && collectionRate >= 70 ? 'warning.main' : 'error.main'}>{collectionRate !== null ? `${collectionRate.toFixed(1)}%` : '—'}</Typography>
              <Typography variant="caption" color="text.secondary">{rentSummary ? `$${(rentSummary.collectedThisMonth || 0).toLocaleString(undefined, { minimumFractionDigits: 2 })} of $${(rentSummary.expectedThisMonth || 0).toLocaleString(undefined, { minimumFractionDigits: 2 })}` : 'this month'}</Typography>
            </Box>
            <Box key="outstanding" sx={{ flex: '1 1 160px', border: '1px dashed rgba(0,0,0,0.15)', borderRadius: 2, p: 2, bgcolor: 'background.paper' }}>
              <Typography variant="caption" color="text.secondary" fontWeight={600} sx={{ textTransform: 'uppercase', letterSpacing: 0.6, display: 'block', mb: 0.5 }}>Outstanding Balance</Typography>
              <Typography variant="h4" fontWeight={700} color={(rentSummary?.outstanding || 0) > 0 ? 'error.main' : 'success.main'}>${(rentSummary?.outstanding || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</Typography>
              <Typography variant="caption" color="text.secondary">${(rentSummary?.overdue || 0).toLocaleString(undefined, { minimumFractionDigits: 2 })} overdue</Typography>
            </Box>
          </>}
          {summary && <>
            <Box key="total-exp" sx={{ flex: '1 1 160px', border: '1px dashed rgba(0,0,0,0.15)', borderRadius: 2, p: 2, bgcolor: 'background.paper' }}>
              <Typography variant="caption" color="text.secondary" fontWeight={600} sx={{ textTransform: 'uppercase', letterSpacing: 0.6, display: 'block', mb: 0.5 }}>Total Expenses</Typography>
              <Typography variant="h4" fontWeight={700} color="error.main">${summary.totalAmount.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</Typography>
            </Box>
            <Box key="tx-count" sx={{ flex: '1 1 160px', border: '1px dashed rgba(0,0,0,0.15)', borderRadius: 2, p: 2, bgcolor: 'background.paper' }}>
              <Typography variant="caption" color="text.secondary" fontWeight={600} sx={{ textTransform: 'uppercase', letterSpacing: 0.6, display: 'block', mb: 0.5 }}>Total Transactions</Typography>
              <Typography variant="h4" fontWeight={700} color="primary.main">{summary.totalCount}</Typography>
            </Box>
            <Box key="avg" sx={{ flex: '1 1 160px', border: '1px dashed rgba(0,0,0,0.15)', borderRadius: 2, p: 2, bgcolor: 'background.paper' }}>
              <Typography variant="caption" color="text.secondary" fontWeight={600} sx={{ textTransform: 'uppercase', letterSpacing: 0.6, display: 'block', mb: 0.5 }}>Avg. Transaction</Typography>
              <Typography variant="h4" fontWeight={700} color="info.main">${summary.averageAmount.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</Typography>
            </Box>
            <Box key="max" sx={{ flex: '1 1 160px', border: '1px dashed rgba(0,0,0,0.15)', borderRadius: 2, p: 2, bgcolor: 'background.paper' }}>
              <Typography variant="caption" color="text.secondary" fontWeight={600} sx={{ textTransform: 'uppercase', letterSpacing: 0.6, display: 'block', mb: 0.5 }}>Highest Expense</Typography>
              <Typography variant="h4" fontWeight={700} color="warning.main">${summary.maxAmount?.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 }) || '0.00'}</Typography>
            </Box>
          </>}
        </Box>
      )}

      {!loading && !error && activityStatusKnown && (!summary || (expenseReport.length === 0 && byCategory.length === 0)) && (
        <Alert severity="info" sx={{ mb: 3 }}>
          {startDate && endDate
            ? `No financial activity found for ${formatDateDisplay(startDate)} – ${formatDateDisplay(endDate)}. No totals or charts are shown because the report returned no records. Try adjusting your filters or date range.`
            : 'No financial activity found for the selected filters. No totals or charts are shown because the report returned no records.'}
        </Alert>
      )}

      {/* Charts */}
      {!loading && !error && hasChartData && (
        <Grid container spacing={2.5}>

          {/* Net Income Trend */}
          {netIncomeTrendData.length > 0 && (
            <Grid size={{ xs: 12 }}>
              <MainCard
                title="Income vs. Expenses Trend"
                sx={{
                  bgcolor: (t) => alpha(t.palette.background.paper, 0.6),
                  boxShadow: (t) => `0 0 20px ${alpha(t.palette.primary.main, 0.15)}`
                }}
              >
                <Box sx={{ pt: 2, height: 340 }}>
                  <ResponsiveContainer width="100%" height="100%">
                    <ComposedChart data={netIncomeTrendData} barCategoryGap="20%">
                      <CartesianGrid strokeDasharray="3 3" stroke={alpha(theme.palette.text.primary, 0.08)} />
                      <XAxis dataKey="label" tick={{ fill: theme.palette.text.secondary, fontSize: 12 }} />
                      <YAxis tick={{ fill: theme.palette.text.secondary, fontSize: 12 }} tickFormatter={(v) => `$${(v / 1000).toFixed(0)}k`} />
                      <Tooltip
                        contentStyle={{ backgroundColor: theme.palette.background.paper, border: `1px solid ${theme.palette.divider}`, borderRadius: 8 }}
                        formatter={(value, name) => [`$${value.toLocaleString(undefined, { minimumFractionDigits: 2 })}`, name]}
                      />
                      <Legend />
                      <Bar dataKey="income" name="Income" fill={theme.palette.success.main} radius={[3, 3, 0, 0]} opacity={0.85} />
                      <Bar dataKey="expenses" name="Expenses" fill={theme.palette.error.main} radius={[3, 3, 0, 0]} opacity={0.85} />
                      <Line dataKey="net" name="Net Income" type="monotone" stroke={theme.palette.primary.main} strokeWidth={2.5} dot={{ r: 4 }} />
                    </ComposedChart>
                  </ResponsiveContainer>
                </Box>
              </MainCard>
            </Grid>
          )}

          {/* Year-over-Year Comparison */}
          {yoyChartData.length > 0 && (
            <Grid size={{ xs: 12 }}>
              <MainCard
                title="Year-over-Year Comparison"
                sx={{
                  bgcolor: (t) => alpha(t.palette.background.paper, 0.6),
                  boxShadow: (t) => `0 0 20px ${alpha(t.palette.primary.main, 0.15)}`
                }}
                secondary={
                  <Stack direction="row" spacing={1.5} alignItems="center">
                    <TextField
                      size="small"
                      type="number"
                      label="Year 1"
                      value={year1}
                      onChange={(e) => setYear1(parseInt(e.target.value))}
                      sx={{ width: 100 }}
                    />
                    <Typography variant="body2" color="text.secondary">vs</Typography>
                    <TextField
                      size="small"
                      type="number"
                      label="Year 2"
                      value={year2}
                      onChange={(e) => setYear2(parseInt(e.target.value))}
                      sx={{ width: 100 }}
                    />
                  </Stack>
                }
              >
                <Box sx={{ pt: 2, height: 360 }}>
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={yoyChartData} barCategoryGap="20%">
                      <CartesianGrid strokeDasharray="3 3" stroke={alpha(theme.palette.text.primary, 0.08)} />
                      <XAxis dataKey="month" tick={{ fill: theme.palette.text.secondary, fontSize: 12 }} />
                      <YAxis tick={{ fill: theme.palette.text.secondary, fontSize: 12 }} tickFormatter={(v) => `$${(v / 1000).toFixed(0)}k`} />
                      <Tooltip
                        contentStyle={{
                          backgroundColor: theme.palette.background.paper,
                          border: `1px solid ${theme.palette.divider}`,
                          borderRadius: 8
                        }}
                        formatter={(value) => `$${value.toLocaleString(undefined, { minimumFractionDigits: 2 })}`}
                      />
                      <Legend />
                      <Bar dataKey={`${year1} Expenses`} fill="#f5222d" radius={[3, 3, 0, 0]} />
                      <Bar dataKey={`${year1} Income`} fill="#52c41a" radius={[3, 3, 0, 0]} />
                      <Bar dataKey={`${year2} Expenses`} fill={alpha('#f5222d', 0.45)} radius={[3, 3, 0, 0]} />
                      <Bar dataKey={`${year2} Income`} fill={alpha('#52c41a', 0.45)} radius={[3, 3, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </Box>
              </MainCard>
            </Grid>
          )}

          {/* Category Breakdown */}
          {categoryChartData.length > 0 && (
            <Grid size={{ xs: 12, md: vendorChartData.length > 0 ? 6 : 12 }}>
              <MainCard
                title="Expenses by Category"
                sx={{
                  bgcolor: (t) => alpha(t.palette.background.paper, 0.6),
                  boxShadow: (t) => `0 0 20px ${alpha(t.palette.primary.main, 0.15)}`
                }}
              >
                <Box sx={{ pt: 2, display: 'flex', gap: 3, flexDirection: { xs: 'column', lg: 'row' }, alignItems: 'center' }}>
                  <Box sx={{ height: 260, minWidth: 220, flex: '0 0 260px' }}>
                    <ResponsiveContainer width="100%" height="100%">
                      <PieChart>
                        <Pie
                          data={categoryChartData}
                          cx="50%"
                          cy="50%"
                          innerRadius={55}
                          outerRadius={100}
                          dataKey="value"
                        >
                          {categoryChartData.map((entry, index) => (
                            <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                          ))}
                        </Pie>
                        <Tooltip
                          contentStyle={{
                            backgroundColor: theme.palette.background.paper,
                            border: `1px solid ${theme.palette.divider}`,
                            borderRadius: 8
                          }}
                          formatter={(value) => `$${value.toLocaleString(undefined, { minimumFractionDigits: 2 })}`}
                        />
                      </PieChart>
                    </ResponsiveContainer>
                  </Box>
                  <Stack spacing={0.75} sx={{ flex: 1, width: '100%' }}>
                    {categoryChartData.map((entry, index) => (
                      <Stack
                        key={index}
                        direction="row"
                        alignItems="center"
                        justifyContent="space-between"
                        sx={{ px: 1.5, py: 0.75, borderRadius: 1, '&:hover': { bgcolor: (t) => alpha(t.palette.primary.main, 0.06) } }}
                      >
                        <Stack direction="row" alignItems="center" spacing={1}>
                          <Box sx={{ width: 10, height: 10, borderRadius: '50%', bgcolor: COLORS[index % COLORS.length], flexShrink: 0 }} />
                          <Typography variant="body2" fontWeight={500}>{entry.name}</Typography>
                        </Stack>
                        <Stack direction="row" spacing={2} alignItems="center">
                          <Typography variant="caption" color="text.secondary">{entry.percentage.toFixed(1)}%</Typography>
                          <Typography variant="body2" fontWeight={600}>${entry.value.toLocaleString(undefined, { minimumFractionDigits: 2 })}</Typography>
                        </Stack>
                      </Stack>
                    ))}
                  </Stack>
                </Box>
              </MainCard>
            </Grid>
          )}

          {/* Vendor Breakdown */}
          {vendorChartData.length > 0 && (
            <Grid size={{ xs: 12, md: categoryChartData.length > 0 ? 6 : 12 }}>
              <MainCard
                title="Expenses by Vendor"
                sx={{
                  bgcolor: (t) => alpha(t.palette.background.paper, 0.6),
                  boxShadow: (t) => `0 0 20px ${alpha(t.palette.primary.main, 0.15)}`
                }}
              >
                <Box sx={{ pt: 2, display: 'flex', gap: 3, flexDirection: { xs: 'column', lg: 'row' }, alignItems: 'center' }}>
                  <Box sx={{ height: 260, minWidth: 220, flex: '0 0 260px' }}>
                    <ResponsiveContainer width="100%" height="100%">
                      <PieChart>
                        <Pie
                          data={vendorChartData}
                          cx="50%"
                          cy="50%"
                          innerRadius={55}
                          outerRadius={100}
                          dataKey="value"
                        >
                          {vendorChartData.map((entry, index) => (
                            <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                          ))}
                        </Pie>
                        <Tooltip
                          contentStyle={{
                            backgroundColor: theme.palette.background.paper,
                            border: `1px solid ${theme.palette.divider}`,
                            borderRadius: 8
                          }}
                          formatter={(value) => `$${value.toLocaleString(undefined, { minimumFractionDigits: 2 })}`}
                        />
                      </PieChart>
                    </ResponsiveContainer>
                  </Box>
                  <Stack spacing={0.75} sx={{ flex: 1, width: '100%' }}>
                    {vendorChartData.map((entry, index) => (
                      <Stack
                        key={index}
                        direction="row"
                        alignItems="center"
                        justifyContent="space-between"
                        sx={{ px: 1.5, py: 0.75, borderRadius: 1, '&:hover': { bgcolor: (t) => alpha(t.palette.primary.main, 0.06) } }}
                      >
                        <Stack direction="row" alignItems="center" spacing={1}>
                          <Box sx={{ width: 10, height: 10, borderRadius: '50%', bgcolor: COLORS[index % COLORS.length], flexShrink: 0 }} />
                          <Typography variant="body2" fontWeight={500}>{entry.name}</Typography>
                        </Stack>
                        <Stack direction="row" spacing={2} alignItems="center">
                          <Typography variant="caption" color="text.secondary">{entry.percentage.toFixed(1)}%</Typography>
                          <Typography variant="body2" fontWeight={600}>${entry.value.toLocaleString(undefined, { minimumFractionDigits: 2 })}</Typography>
                        </Stack>
                      </Stack>
                    ))}
                  </Stack>
                </Box>
              </MainCard>
            </Grid>
          )}

          {/* Property Profitability Table */}
          {profitability.length > 0 && (
            <Grid size={{ xs: 12 }}>
              <MainCard
                title="Property Profitability"
                sx={{
                  bgcolor: (t) => alpha(t.palette.background.paper, 0.6),
                  boxShadow: (t) => `0 0 20px ${alpha(t.palette.primary.main, 0.15)}`
                }}
              >
                <TableContainer>
                  <Table>
                    <TableHead>
                      <TableRow>
                        <TableCell><Typography variant="subtitle2">Property</Typography></TableCell>
                        <TableCell align="right"><Typography variant="subtitle2">Total Rent</Typography></TableCell>
                        <TableCell align="right"><Typography variant="subtitle2">Total Expenses</Typography></TableCell>
                        <TableCell align="right"><Typography variant="subtitle2">Net Income</Typography></TableCell>
                        <TableCell align="right"><Typography variant="subtitle2">Profit Margin</Typography></TableCell>
                      </TableRow>
                    </TableHead>
                    <TableBody>
                      {profitability.filter(p => p.propertyName).map((prop) => (
                        <TableRow key={prop.propertyId} hover>
                          <TableCell>
                            <Typography variant="body2" fontWeight={600}>{prop.propertyName || '—'}</Typography>
                          </TableCell>
                          <TableCell align="right">
                            <Typography variant="body2">
                              ${prop.totalRent.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                            </Typography>
                          </TableCell>
                          <TableCell align="right">
                            <Typography variant="body2">
                              ${prop.totalExpenses.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                            </Typography>
                          </TableCell>
                          <TableCell align="right">
                            <Typography
                              variant="body2"
                              fontWeight={700}
                              color={prop.netIncome >= 0 ? 'success.main' : 'error.main'}
                            >
                              ${prop.netIncome.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                            </Typography>
                          </TableCell>
                          <TableCell align="right">
                            <Chip
                              label={`${prop.profitMargin.toFixed(1)}%`}
                              size="small"
                              sx={{
                                bgcolor: (t) => alpha(prop.profitMargin >= 0 ? t.palette.success.main : t.palette.error.main, 0.12),
                                color: prop.profitMargin >= 0 ? 'success.dark' : 'error.dark',
                                fontWeight: 600,
                                fontSize: '0.75rem'
                              }}
                            />
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </TableContainer>
              </MainCard>
            </Grid>
          )}
        </Grid>
      )}
    </Box>
  );
}
