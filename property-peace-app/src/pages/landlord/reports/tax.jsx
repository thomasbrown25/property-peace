import { useState, useEffect, useMemo, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useSubscription } from 'hooks/useSubscription';
import {
  Grid,
  Box,
  Typography,
  Button,
  Stack,
  TextField,
  alpha,
  Menu,
  MenuItem,
  CircularProgress,
  Alert,
  Chip,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  IconButton,
  OutlinedInput,
  InputAdornment
} from '@mui/material';
import {
  DownloadOutlined,
  FileExcelOutlined,
  FilePdfOutlined,
  EditOutlined,
  CalculatorOutlined,
  TagsOutlined,
  ArrowRightOutlined,
  SearchOutlined,
  ReloadOutlined,
  CheckCircleOutlined,
  WarningOutlined
} from '@ant-design/icons';
import PropertySelect from 'components/PropertySelect';
import MainCard from 'components/MainCard';
import ExpenseEditDrawer from 'components/expense/ExpenseEditDrawer';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, Legend } from 'recharts';
import { useTheme } from '@mui/material/styles';
import useAuth from 'hooks/useAuth';
import PageBreadcrumbs from 'components/breadcrumbs/PageBreadcrumbs';
import { expenseAPI } from 'api';
import { openSnackbar } from 'api/snackbar';
import { downloadScheduleEPdf } from 'api/expense';

const COLORS = ['#1890ff', '#52c41a', '#faad14', '#f5222d', '#722ed1', '#eb2f96', '#13c2c2', '#fa8c16', '#2f54eb'];
const NAVY = '#061e35';
const GREEN = '#22c55e';

const currency = (value) => `$${(value || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

export default function TaxReports() {
  const { user } = useAuth();
  const theme = useTheme();
  const navigate = useNavigate();
  const { subscription, loading: subscriptionLoading } = useSubscription();
  const planName = (subscription?.plan?.name || subscription?.subscriptionPlan?.name || '').toLowerCase();
  const hasPremiumAccess = planName === 'premium' || planName.includes('lifetime');

  useEffect(() => {
    if (!subscriptionLoading && !hasPremiumAccess) {
      navigate('/landlord/reports');
    }
  }, [hasPremiumAccess, subscriptionLoading, navigate]);
  const landlordId = user?.id || user?.Id;

  // Tax & Accounting state
  const [taxLoading, setTaxLoading] = useState(false);
  const [actionLoading, setActionLoading] = useState(null);
  const [taxError, setTaxError] = useState(null);
  const [taxWarning, setTaxWarning] = useState(null);
  const [taxYearStatusKnown, setTaxYearStatusKnown] = useState(false);
  const taxRequestSequence = useRef(0);
  const [taxYear, setTaxYear] = useState(new Date().getFullYear());
  const [taxYearReport, setTaxYearReport] = useState(null);
  const [taxCategorySummary, setTaxCategorySummary] = useState([]);
  const [deductibleExpenses, setDeductibleExpenses] = useState([]);
  const [form1099Data, setForm1099Data] = useState([]);
  const [taxReadiness, setTaxReadiness] = useState(null);
  const [taxExportMenuAnchor, setTaxExportMenuAnchor] = useState(null);
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [editingExpense, setEditingExpense] = useState(null);

  // Deductible expenses table filters (client-side)
  const [expenseSearch, setExpenseSearch] = useState('');
  const [expenseStartDate, setExpenseStartDate] = useState('');
  const [expenseEndDate, setExpenseEndDate] = useState('');
  const [localFilterProperty, setLocalFilterProperty] = useState(null);

  const noLabelBg = {
    '& .MuiOutlinedInput-notchedOutline': { top: 0 },
    '& .MuiOutlinedInput-notchedOutline legend': { display: 'none' }
  };

  // Tax & Accounting data fetching
  useEffect(() => {
    if (landlordId) {
      fetchTaxData();
    }
  }, [landlordId, taxYear]);

  const fetchTaxData = async () => {
    if (!landlordId) return;

    const requestId = ++taxRequestSequence.current;
    setTaxLoading(true);
    setTaxError(null);
    setTaxWarning(null);
    setTaxYearStatusKnown(false);

    try {
      const results = await Promise.allSettled([
        expenseAPI.getTaxYearReport(landlordId, taxYear),
        expenseAPI.getTaxCategorySummary(landlordId, taxYear),
        expenseAPI.getTaxDeductibleExpenses(landlordId, { year: taxYear }),
        expenseAPI.getForm1099Data(landlordId, taxYear),
        expenseAPI.getTaxReadiness(landlordId, taxYear)
      ]);

      if (requestId !== taxRequestSequence.current) return;

      const labels = ['year summary', 'category summary', 'deductible expenses', '1099 preparation', 'preparation checklist'];
      const failedLabels = results.flatMap((result, index) => result.status === 'rejected' ? [labels[index]] : []);
      setTaxYearStatusKnown(results[0].status === 'fulfilled');
      if (failedLabels.length === results.length) throw results[0].reason;
      if (failedLabels.length) setTaxWarning(`Some tax workspace sections could not be refreshed: ${failedLabels.join(', ')}. Available records are shown.`);

      const value = (index) => results[index].status === 'fulfilled' ? results[index].value : null;
      const [yearReportRes, categorySummaryRes, deductibleExpensesRes, form1099Res, readinessRes] = results.map((_, index) => value(index));

      setTaxYearReport(yearReportRes?.data || null);
      setTaxCategorySummary(categorySummaryRes?.data || []);
      setDeductibleExpenses(deductibleExpensesRes?.data || []);
      setForm1099Data(form1099Res?.data || []);
      setTaxReadiness(readinessRes?.data || null);

      if (yearReportRes?.success === false || categorySummaryRes?.success === false) {
        setTaxError(yearReportRes?.message || categorySummaryRes?.message || 'Failed to load tax reports');
      }
    } catch (err) {
      if (requestId !== taxRequestSequence.current) return;
      console.error('Error fetching tax reports:', err);
      setTaxError(err?.response?.data?.message || err?.message || 'Failed to load tax reports. Please check your connection and try again.');
    } finally {
      if (requestId === taxRequestSequence.current) setTaxLoading(false);
    }
  };

  // Export, PDF, and edit actions have their own loading state so the report remains visible.
  const handleTaxExport = async (format) => {
    setTaxExportMenuAnchor(null);
    setActionLoading(`export-${format}`);
    try {
      await expenseAPI.exportToAccountingSoftware(landlordId, format, { year: taxYear });
      openSnackbar({
        open: true,
        message: 'Download prepared. Review the file with your accountant before importing or filing.',
        variant: 'alert',
        alert: { color: 'success' }
      });
    } catch (err) {
      console.error('Export error:', err);
      openSnackbar({
        open: true,
        message: err.message || 'Failed to export',
        variant: 'alert',
        alert: { color: 'error' }
      });
    } finally {
      setActionLoading(null);
    }
  };

  const handleDownloadScheduleE = async () => {
    setTaxExportMenuAnchor(null);
    setActionLoading('schedule-e');
    try {
      await downloadScheduleEPdf(landlordId, taxYear, false);
      openSnackbar({
        open: true,
        message: 'Schedule E preparation PDF downloaded for accountant review',
        variant: 'alert',
        alert: { color: 'success' }
      });
    } catch (err) {
      console.error('Schedule E PDF download error:', err);
      openSnackbar({
        open: true,
        message: err.response?.data?.message || err.response?.data?.Message || err.response?.data?.errors?.details || err.response?.data?.errors?.message || err.message || 'Failed to download Schedule E PDF',
        variant: 'alert',
        alert: { color: 'error' }
      });
    } finally {
      setActionLoading(null);
    }
  };

  const handleEditExpense = async (expense) => {
    const expenseId = expense.expenseId || expense.id || expense.Id;
    setActionLoading(`edit-${expenseId}`);
    try {
      const response = await expenseAPI.getExpenseById(expenseId);
      const fullExpense = response?.data || response;
      if (fullExpense?.id || fullExpense?.Id) {
        setEditingExpense(fullExpense);
        setEditDialogOpen(true);
      } else {
        openSnackbar({
          open: true,
          message: 'Failed to load expense details',
          variant: 'alert',
          alert: { color: 'error' }
        });
      }
    } catch (err) {
      console.error('Error loading expense:', err);
      openSnackbar({
        open: true,
        message: err.response?.data?.message || 'Failed to load expense details',
        variant: 'alert',
        alert: { color: 'error' }
      });
    } finally {
      setActionLoading(null);
    }
  };

  const handleCloseEditDialog = () => {
    setEditDialogOpen(false);
    setEditingExpense(null);
  };

  // Tax chart data
  const taxCategoryChartData = useMemo(() => {
    return taxCategorySummary.map(cat => ({
      name: cat.categoryName,
      value: cat.totalAmount,
      count: cat.expenseCount
    }));
  }, [taxCategorySummary]);

  const incomeExpensesData = useMemo(() => {
    if (!taxYearReport) return [];
    return [
      { name: 'Total Income', amount: taxYearReport.totalIncome || 0 },
      { name: 'Deductible Expenses', amount: taxYearReport.totalExpenses || 0 },
      { name: 'Net Income', amount: Math.max(0, taxYearReport.netIncome || 0) }
    ];
  }, [taxYearReport]);

  const filteredDeductibleExpenses = useMemo(() => {
    let list = deductibleExpenses;
    if (expenseSearch.trim()) {
      const q = expenseSearch.toLowerCase();
      list = list.filter((e) =>
        e.description?.toLowerCase().includes(q) ||
        e.propertyName?.toLowerCase().includes(q) ||
        e.vendor?.toLowerCase().includes(q) ||
        e.taxCategoryName?.toLowerCase().includes(q)
      );
    }
    if (expenseStartDate) {
      const start = new Date(expenseStartDate + 'T00:00:00');
      list = list.filter((e) => e.expenseDate && new Date(e.expenseDate) >= start);
    }
    if (expenseEndDate) {
      const end = new Date(expenseEndDate + 'T23:59:59');
      list = list.filter((e) => e.expenseDate && new Date(e.expenseDate) <= end);
    }
    if (localFilterProperty?.id) {
      list = list.filter((e) => e.propertyId === localFilterProperty.id || e.propertyName === localFilterProperty.name);
    }
    return list;
  }, [deductibleExpenses, expenseSearch, expenseStartDate, expenseEndDate, localFilterProperty]);

  const hasExpenseFilters = Boolean(expenseSearch || expenseStartDate || expenseEndDate || localFilterProperty);
  const clearExpenseFilters = () => {
    setExpenseSearch('');
    setExpenseStartDate('');
    setExpenseEndDate('');
    setLocalFilterProperty(null);
  };

  const readinessItems = taxReadiness?.items || [];
  const readinessReviewCount = readinessItems.reduce((total, item) => total + (item.count || 0), 0);
  const readinessStatus = readinessItems.length > 0 && readinessItems.every((item) => item.status === 'ready') ? 'Ready' : 'Review needed';
  const cardSx = {
    bgcolor: 'background.paper',
    boxShadow: `0 6px 24px ${alpha(NAVY, 0.055)}`,
    border: `1px solid ${alpha(NAVY, 0.08)}`,
    borderRadius: 2.5
  };

  return (
    <Box>
      <PageBreadcrumbs
        items={[
          { label: 'Dashboard', path: '/landlord/dashboard' },
          { label: 'Reports & Analytics', path: '/landlord/reports' },
          { label: 'Tax & Accounting' }
        ]}
      />

      {/* Operational hero */}
      <Box
        sx={{
          position: 'relative',
          overflow: 'hidden',
          bgcolor: NAVY,
          color: '#fff',
          borderRadius: 3,
          px: { xs: 2.25, md: 3 },
          py: { xs: 2.5, md: 3 },
          mb: 3,
          boxShadow: `0 16px 40px ${alpha(NAVY, 0.18)}`,
          '&::after': { content: '\"\"', position: 'absolute', width: 240, height: 240, borderRadius: '50%', bgcolor: alpha(GREEN, 0.13), top: -150, right: -65 }
        }}
      >
        <Stack direction={{ xs: 'column', lg: 'row' }} justifyContent="space-between" alignItems={{ xs: 'stretch', lg: 'center' }} spacing={2.5} sx={{ position: 'relative', zIndex: 1 }}>
          <Box sx={{ maxWidth: 670 }}>
            <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap sx={{ mb: 1 }}>
              <Chip size="small" icon={<CalculatorOutlined />} label={`${taxYear} tax workspace`} sx={{ bgcolor: alpha('#fff', 0.12), color: '#fff', '& .MuiChip-icon': { color: GREEN } }} />
              {taxReadiness && (
                <Chip
                  size="small"
                  icon={readinessStatus === 'Ready' ? <CheckCircleOutlined /> : <WarningOutlined />}
                  label={readinessReviewCount ? `${readinessReviewCount} items to review` : readinessStatus}
                  sx={{ bgcolor: alpha('#fff', 0.08), color: '#fff', '& .MuiChip-icon': { color: readinessStatus === 'Ready' ? GREEN : '#fbbf24' } }}
                />
              )}
            </Stack>
            <Typography variant="h2" sx={{ color: '#fff', fontWeight: 780, letterSpacing: -0.6 }}>Tax & Accounting</Typography>
            <Typography sx={{ mt: 0.75, color: alpha('#fff', 0.7), lineHeight: 1.6 }}>
              Review Schedule E figures, work through preparation checks, and download files for accountant review.
            </Typography>
          </Box>

          <Stack spacing={1.25} sx={{ minWidth: { lg: 350 } }}>
            <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1}>
              <TextField
                size="small"
                type="number"
                label="Tax year"
                value={taxYear}
                onChange={(event) => setTaxYear(parseInt(event.target.value) || new Date().getFullYear())}
                InputLabelProps={{ shrink: true }}
                sx={{ width: { xs: '100%', sm: 120 }, bgcolor: '#fff', borderRadius: 1, ...noLabelBg }}
              />
              <Button
                variant="contained"
                startIcon={actionLoading === 'schedule-e' ? <CircularProgress size={15} color="inherit" /> : <FilePdfOutlined />}
                onClick={handleDownloadScheduleE}
                disabled={Boolean(actionLoading) || taxLoading || !taxYearReport}
                sx={{ flex: 1, bgcolor: GREEN, color: NAVY, fontWeight: 750, '&:hover': { bgcolor: '#16a34a', color: '#fff' } }}
              >
                Schedule E preparation PDF
              </Button>
            </Stack>
            <Stack direction="row" spacing={1}>
              <Button
                fullWidth
                variant="outlined"
                startIcon={actionLoading && actionLoading !== 'schedule-e' ? <CircularProgress size={15} color="inherit" /> : <DownloadOutlined />}
                onClick={(event) => setTaxExportMenuAnchor(event.currentTarget)}
                aria-haspopup="menu"
                aria-expanded={Boolean(taxExportMenuAnchor)}
                aria-controls={taxExportMenuAnchor ? 'tax-export-menu' : undefined}
                disabled={Boolean(actionLoading) || taxLoading || !taxYearReport}
                sx={{ color: '#fff', borderColor: alpha('#fff', 0.34), '&:hover': { borderColor: '#fff', bgcolor: alpha('#fff', 0.06) } }}
              >
                {actionLoading && actionLoading !== 'schedule-e' ? 'Preparing…' : 'Export & packages'}
              </Button>
              <IconButton onClick={() => fetchTaxData()} disabled={taxLoading} aria-label="Refresh tax data" sx={{ color: '#fff', border: `1px solid ${alpha('#fff', 0.34)}`, borderRadius: 1.5 }}>
                {taxLoading ? <CircularProgress size={18} color="inherit" /> : <ReloadOutlined />}
              </IconButton>
            </Stack>
          </Stack>
        </Stack>
      </Box>

      <Menu id="tax-export-menu" anchorEl={taxExportMenuAnchor} open={Boolean(taxExportMenuAnchor)} onClose={() => setTaxExportMenuAnchor(null)}>
        <MenuItem onClick={() => handleTaxExport('csv')}><FileExcelOutlined style={{ marginRight: 8 }} />Accounting CSV for review</MenuItem>
        <MenuItem onClick={() => handleTaxExport('quickbooks')}><FileExcelOutlined style={{ marginRight: 8 }} />QuickBooks experimental template</MenuItem>
        <MenuItem onClick={() => handleTaxExport('xero')}><FileExcelOutlined style={{ marginRight: 8 }} />Xero experimental template</MenuItem>
        <MenuItem onClick={() => handleTaxExport('accountant')}><FileExcelOutlined style={{ marginRight: 8 }} />Accountant-review package</MenuItem>
      </Menu>

      {taxError && (
        <Alert
          severity="error"
          sx={{ mb: 3, borderRadius: 2 }}
          action={<Button color="inherit" size="small" startIcon={<ReloadOutlined />} onClick={() => fetchTaxData()}>Retry</Button>}
        >
          <Typography fontWeight={700}>We couldn't load the {taxYear} tax workspace.</Typography>
          <Typography variant="body2">{taxError}</Typography>
        </Alert>
      )}
      {taxWarning && <Alert severity="warning" sx={{ mb: 3 }}>{taxWarning}</Alert>}

      {taxLoading && !taxYearReport && (
        <Box role="status" aria-live="polite" sx={{ ...cardSx, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 1.5, p: 5, mb: 3 }}>
          <CircularProgress size={24} />
          <Typography color="text.secondary">Loading {taxYear} tax records…</Typography>
        </Box>
      )}

      {!taxLoading && !taxError && taxYearStatusKnown && !taxYearReport && (
        <Box sx={{ ...cardSx, p: { xs: 3, md: 5 }, mb: 3, textAlign: 'center' }}>
          <Box sx={{ width: 64, height: 64, borderRadius: '50%', bgcolor: (t) => alpha(t.palette.primary.main, 0.1), display: 'flex', alignItems: 'center', justifyContent: 'center', mx: 'auto', mb: 2 }}>
            <TagsOutlined style={{ fontSize: 28, color: theme.palette.primary.main }} />
          </Box>
          <Typography variant="h5" gutterBottom>No Tax Data for {taxYear}</Typography>
          <Typography variant="body2" color="text.secondary" sx={{ maxWidth: 480, mx: 'auto', mb: 3 }}>
            To see your tax report, go to your Expenses page and mark expenses as tax-deductible by assigning an IRS Schedule E category.
          </Typography>
          <Button variant="contained" endIcon={<ArrowRightOutlined />} onClick={() => navigate('/landlord/expenses')}>
            Go to Expenses
          </Button>
        </Box>
      )}

      {taxYearReport && taxCategoryChartData.length === 0 && (
        <Alert severity="info" sx={{ mb: 3 }} action={<Button size="small" color="inherit" onClick={() => navigate('/landlord/expenses')}>Go to Expenses</Button>}>
          <strong>Tip:</strong> You have income on record for {taxYear}, but no deductible expenses assigned yet. Assign IRS tax categories to unlock deduction charts and Schedule E data.
        </Alert>
      )}

      {/* KPI summary cards */}
      {taxYearReport && (
        <Grid container spacing={2} sx={{ mb: 3 }}>
          {[
            { label: `Total income · ${taxYear}`, value: currency(taxYearReport.totalIncome), color: '#16a34a' },
            { label: 'Deductible expenses', value: currency(taxYearReport.totalExpenses), color: '#dc2626' },
            { label: 'Net income · Schedule E', value: currency(taxYearReport.netIncome), color: '#2563eb' }
          ].map((kpi) => (
            <Grid key={kpi.label} size={{ xs: 12, sm: 6, lg: 4 }}>
              <Box sx={{ ...cardSx, height: '100%', p: 2.25, borderTop: `3px solid ${kpi.color}` }}>
                <Typography sx={{ color: 'text.secondary', fontSize: '0.7rem', fontWeight: 750, textTransform: 'uppercase', letterSpacing: 0.65 }}>
                  {kpi.label}
                </Typography>
                <Typography variant="h3" sx={{ mt: 0.75, fontWeight: 780, color: NAVY }}>{kpi.value}</Typography>
              </Box>
            </Grid>
          ))}
        </Grid>
      )}

      {/* Tax readiness */}
      {taxReadiness && (
        <Grid container spacing={3} sx={{ mb: 3 }}>
          <Grid size={{ xs: 12 }}>
            <MainCard
              title="Tax preparation checklist"
              subtitle="Record checks to work through before you send numbers to your accountant; not tax advice or a filing guarantee"
              sx={cardSx}
            >
              <Stack spacing={1.25}>
                {readinessItems.length === 0 && (
                  <Typography variant="body2" color="text.secondary">No readiness checks were returned for this tax year.</Typography>
                )}
                {(taxReadiness.items || []).map((item) => {
                  const color = item.status === 'ready' ? 'success' : item.status === 'warning' ? 'warning' : 'error';
                  return (
                    <Box
                      key={item.key}
                      sx={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        gap: 2,
                        border: '1px solid',
                        borderColor: 'divider',
                        borderRadius: 1.5,
                        p: 1.5,
                        bgcolor: (t) => alpha(t.palette[color].main, 0.04)
                      }}
                    >
                      <Box>
                        <Typography variant="body2" fontWeight={700}>{item.label}</Typography>
                        <Typography variant="caption" color="text.secondary">{item.description}</Typography>
                      </Box>
                      <Chip size="small" color={color} label={item.count ? `${item.count} to review` : 'Ready'} />
                    </Box>
                  );
                })}
              </Stack>
            </MainCard>
          </Grid>
        </Grid>
      )}

      {/* Review queues */}
      {taxReadiness && (
        <Grid container spacing={3} sx={{ mb: 3 }}>
          {(taxReadiness.expenseReviewQueue || []).length > 0 && (
            <Grid size={{ xs: 12, lg: 6 }}>
              <MainCard content={false} title="Expense cleanup queue" subtitle="Uncategorized, missing receipt, loan split, and capital-improvement review items" sx={{ ...cardSx, overflow: 'hidden' }}>
                <TableContainer sx={{ maxHeight: 360 }}>
                  <Table size="small" stickyHeader>
                    <TableHead>
                      <TableRow>
                        <TableCell>Expense</TableCell>
                        <TableCell>Issue</TableCell>
                        <TableCell align="right">Deductible</TableCell>
                      </TableRow>
                    </TableHead>
                    <TableBody>
                      {taxReadiness.expenseReviewQueue.slice(0, 8).map((expense) => (
                        <TableRow
                          key={expense.expenseId}
                          hover
                          onClick={() => handleEditExpense(expense)}
                          onKeyDown={(event) => {
                            if (event.key === 'Enter' || event.key === ' ') {
                              event.preventDefault();
                              handleEditExpense(expense);
                            }
                          }}
                          role="button"
                          tabIndex={0}
                          aria-label={`Edit ${expense.description || 'expense'} in cleanup queue`}
                          sx={{ cursor: 'pointer', '&:focus-visible': { outline: '3px solid', outlineColor: 'primary.main', outlineOffset: -3 }, '&:hover .cleanup-edit-hint': { opacity: 1, transform: 'translateX(0)' } }}
                        >
                          <TableCell>
                            <Stack direction="row" spacing={1} alignItems="center" justifyContent="space-between">
                              <Box sx={{ minWidth: 0 }}>
                                <Typography variant="body2" fontWeight={600}>{expense.description}</Typography>
                                <Typography variant="caption" color="text.secondary">{expense.propertyName}{expense.unitName ? ` · ${expense.unitName}` : ''}</Typography>
                              </Box>
                              <Stack className="cleanup-edit-hint" direction="row" spacing={0.5} alignItems="center" sx={{ color: 'primary.main', opacity: 0.72, transform: 'translateX(-2px)', transition: 'all 0.16s ease', flexShrink: 0 }}>
                                <EditOutlined style={{ fontSize: 14 }} />
                                <Typography variant="caption" fontWeight={700}>Edit</Typography>
                              </Stack>
                            </Stack>
                          </TableCell>
                          <TableCell>
                            <Stack direction="row" spacing={0.5} flexWrap="wrap" useFlexGap>
                              {(expense.issues || []).map((issue) => <Chip key={issue} size="small" label={issue} color={issue.includes('receipt') ? 'warning' : 'error'} variant="outlined" />)}
                            </Stack>
                          </TableCell>
                          <TableCell align="right">${(expense.deductibleAmount || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </TableContainer>
              </MainCard>
            </Grid>
          )}

          {(taxReadiness.depositReviewQueue || []).length > 0 && (
            <Grid size={{ xs: 12, lg: 6 }}>
              <MainCard content={false} title="Deposit classification" subtitle="Held/refunded/applied deposits should not be blindly counted as income" sx={{ ...cardSx, overflow: 'hidden' }}>
                <TableContainer sx={{ maxHeight: 360 }}>
                  <Table size="small" stickyHeader>
                    <TableHead>
                      <TableRow>
                        <TableCell>Tenant / Property</TableCell>
                        <TableCell>Date</TableCell>
                        <TableCell align="right">Amount</TableCell>
                      </TableRow>
                    </TableHead>
                    <TableBody>
                      {taxReadiness.depositReviewQueue.slice(0, 8).map((deposit) => (
                        <TableRow key={`${deposit.paymentId}-${deposit.depositId || 'deposit'}`} hover>
                          <TableCell>
                            <Typography variant="body2" fontWeight={600}>{deposit.tenantName || 'Tenant'}</Typography>
                            <Typography variant="caption" color="text.secondary">{deposit.propertyName}{deposit.unitName ? ` · ${deposit.unitName}` : ''}</Typography>
                          </TableCell>
                          <TableCell>{deposit.paymentDate ? new Date(deposit.paymentDate).toLocaleDateString() : '—'}</TableCell>
                          <TableCell align="right">${(deposit.amount || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</TableCell>
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

      {/* Per-property package */}
      {taxReadiness?.propertyPackages?.length > 0 && (
        <MainCard content={false} title="Per-property tax package" subtitle="Accountant-friendly income and deduction rollups by property" sx={{ ...cardSx, mb: 3, overflow: 'hidden' }}>
          <TableContainer>
            <Table size="small" sx={{ minWidth: 680 }}>
              <TableHead>
                <TableRow>
                  <TableCell>Property</TableCell>
                  <TableCell align="right">Income</TableCell>
                  <TableCell align="right">Deductions</TableCell>
                  <TableCell align="right">Net</TableCell>
                  <TableCell align="right">Review</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {taxReadiness.propertyPackages.map((property) => (
                  <TableRow key={property.propertyId} hover>
                    <TableCell>
                      <Typography variant="body2" fontWeight={600}>{property.propertyName}</Typography>
                      <Typography variant="caption" color="text.secondary">{property.expenseCount || 0} expenses · {property.missingReceiptCount || 0} missing receipts</Typography>
                    </TableCell>
                    <TableCell align="right">${(property.income || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</TableCell>
                    <TableCell align="right">${(property.deductibleExpenses || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</TableCell>
                    <TableCell align="right">${(property.netIncome || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</TableCell>
                    <TableCell align="right"><Chip size="small" color={property.reviewItemCount ? 'warning' : 'success'} label={property.reviewItemCount ? `${property.reviewItemCount} items` : 'Ready'} /></TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TableContainer>
        </MainCard>
      )}

      {/* Charts */}
      {taxYearReport && (
        <Grid container spacing={3} sx={{ mb: 3 }}>
          <Grid size={{ xs: 12, md: taxCategoryChartData.length > 0 ? 6 : 12 }}>
            <MainCard title="Income vs. Expenses Overview" sx={cardSx}>
              <Box sx={{ pt: 2, height: 350 }}>
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={incomeExpensesData} barSize={60}>
                    <CartesianGrid strokeDasharray="3 3" stroke={alpha(theme.palette.text.primary, 0.1)} />
                    <XAxis dataKey="name" tick={{ fill: theme.palette.text.secondary, fontSize: 13 }} />
                    <YAxis tick={{ fill: theme.palette.text.secondary, fontSize: 12 }} tickFormatter={(v) => `$${(v / 1000).toFixed(0)}k`} />
                    <Tooltip contentStyle={{ backgroundColor: theme.palette.background.paper, border: `1px solid ${theme.palette.divider}`, borderRadius: 8 }} formatter={(value) => [`$${value.toLocaleString(undefined, { minimumFractionDigits: 2 })}`, 'Amount']} />
                    <Bar dataKey="amount" radius={[6, 6, 0, 0]}>
                      {incomeExpensesData.map((entry, index) => {
                        const colors = [theme.palette.success.main, theme.palette.error.main, theme.palette.info.main];
                        return <Cell key={`cell-${index}`} fill={colors[index]} />;
                      })}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </Box>
            </MainCard>
          </Grid>
          {taxCategoryChartData.length > 0 && (
            <Grid size={{ xs: 12, md: 6 }}>
              <MainCard title="Deductions by Category" sx={cardSx}>
                <Box sx={{ pt: 2, height: 350 }}>
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie data={taxCategoryChartData} cx="50%" cy="50%" labelLine={false} label={({ name, percent }) => `${name} (${(percent * 100).toFixed(0)}%)`} outerRadius={100} dataKey="value">
                        {taxCategoryChartData.map((entry, index) => (
                          <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                        ))}
                      </Pie>
                      <Tooltip contentStyle={{ backgroundColor: theme.palette.background.paper, border: `1px solid ${theme.palette.divider}`, borderRadius: 8 }} formatter={(value) => `$${value.toLocaleString(undefined, { minimumFractionDigits: 2 })}`} />
                      <Legend />
                    </PieChart>
                  </ResponsiveContainer>
                </Box>
              </MainCard>
            </Grid>
          )}
        </Grid>
      )}

      {/* Tax Deductible Expenses */}
      {deductibleExpenses.length > 0 && (
        <>
          <Stack direction={{ xs: 'column', sm: 'row' }} justifyContent="space-between" alignItems={{ xs: 'stretch', sm: 'flex-end' }} spacing={1} sx={{ mb: 1.5 }}>
            <Box>
              <Typography variant="h4" fontWeight={750}>Tax-deductible expenses</Typography>
              <Typography variant="body2" color="text.secondary" sx={{ mt: 0.35 }}>
                Showing {filteredDeductibleExpenses.length} of {deductibleExpenses.length} expenses
              </Typography>
            </Box>
            {hasExpenseFilters && <Button size="small" onClick={() => clearExpenseFilters()}>Clear filters</Button>}
          </Stack>

          {/* Toolbar */}
          <Box sx={{ ...cardSx, display: 'grid', gridTemplateColumns: { xs: '1fr', sm: 'repeat(2, 1fr)', lg: 'minmax(220px, 2fr) repeat(2, minmax(150px, 1fr)) minmax(220px, 2fr)' }, gap: 1.25, alignItems: 'center', mb: 2, p: 1.5 }}>
            <OutlinedInput
              size="small"
              placeholder="Search description, vendor, category…"
              inputProps={{ 'aria-label': 'Search tax-deductible expenses' }}
              value={expenseSearch}
              onChange={(event) => setExpenseSearch(event.target.value)}
              startAdornment={<InputAdornment position="start"><SearchOutlined style={{ fontSize: 14, opacity: 0.5 }} /></InputAdornment>}
              sx={{ minWidth: 0, bgcolor: 'background.paper', height: 38, fontSize: '0.8rem' }}
            />
            <TextField
              size="small"
              type="date"
              label="Start date"
              value={expenseStartDate}
              onChange={(event) => setExpenseStartDate(event.target.value)}
              InputLabelProps={{ shrink: true }}
              sx={{ minWidth: 0, ...noLabelBg }}
            />
            <TextField
              size="small"
              type="date"
              label="End date"
              value={expenseEndDate}
              onChange={(event) => setExpenseEndDate(event.target.value)}
              InputLabelProps={{ shrink: true }}
              sx={{ minWidth: 0, ...noLabelBg }}
            />
            <Box sx={{ minWidth: 0, '& .MuiInputLabel-root': { backgroundColor: 'transparent !important' }, ...noLabelBg }}>
              <PropertySelect
                width="100%"
                onPropertyChange={(property) => setLocalFilterProperty(property)}
                localSelectedProperty={localFilterProperty}
                disableAllOption={false}
              />
            </Box>
          </Box>

          <MainCard content={false} sx={{ ...cardSx, mb: 3, overflow: 'hidden' }}>
            {filteredDeductibleExpenses.length === 0 ? (
              <Box sx={{ p: 4, textAlign: 'center' }}>
                <Typography variant="body2" color="text.secondary">No expenses match your filters.</Typography>
                <Button size="small" sx={{ mt: 1 }} onClick={() => clearExpenseFilters()}>Clear filters</Button>
              </Box>
            ) : (
              <TableContainer>
                <Table size="small" sx={{ minWidth: 1100 }}>
                  <TableHead>
                    <TableRow>
                      <TableCell>Date</TableCell>
                      <TableCell>Property</TableCell>
                      <TableCell>Description</TableCell>
                      <TableCell>Tax Category</TableCell>
                      <TableCell>Vendor</TableCell>
                      <TableCell align="right">Amount</TableCell>
                      <TableCell align="right">Deductible</TableCell>
                      <TableCell>Status</TableCell>
                      <TableCell align="center">Actions</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {filteredDeductibleExpenses.map((expense) => (
                      <TableRow key={expense.expenseId} hover>
                        <TableCell>{new Date(expense.expenseDate).toLocaleDateString()}</TableCell>
                        <TableCell>{expense.propertyName}{expense.unitName ? ` - ${expense.unitName}` : ''}</TableCell>
                        <TableCell>{expense.description}</TableCell>
                        <TableCell>
                          <Chip label={expense.taxCategoryName || 'Uncategorized'} size="small" color={expense.taxCategory ? 'primary' : 'default'} />
                        </TableCell>
                        <TableCell>{expense.vendor || 'N/A'}</TableCell>
                        <TableCell align="right">
                          ${expense.amount?.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 }) || '0.00'}
                        </TableCell>
                        <TableCell align="right">
                          ${(expense.deductibleAmount ?? expense.amount ?? 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                        </TableCell>
                        <TableCell>
                          <Stack direction="row" spacing={0.5} flexWrap="wrap" useFlexGap>
                            <Chip label={expense.isFullyDeductible ? 'Fully Deductible' : 'Review'} size="small" color={expense.isFullyDeductible ? 'success' : 'warning'} />
                            {!expense.hasReceipt && <Chip label="Missing receipt" size="small" color="warning" variant="outlined" />}
                            {expense.needsReview && <Chip label="Needs review" size="small" color="error" variant="outlined" />}
                          </Stack>
                        </TableCell>
                        <TableCell align="center">
                          <IconButton size="small" onClick={() => handleEditExpense(expense)} disabled={Boolean(actionLoading)} color="primary" aria-label={`Edit tax category for ${expense.description || 'expense'}`}>
                            {actionLoading === `edit-${expense.expenseId || expense.id || expense.Id}` ? <CircularProgress size={16} /> : <EditOutlined />}
                          </IconButton>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </TableContainer>
            )}
          </MainCard>
        </>
      )}

      {/* 1099 Preparation */}
      {form1099Data.length > 0 && (
        <MainCard
          title="1099-MISC Preparation"
          subtitle={`Vendors requiring 1099 forms for ${taxYear} (vendors with $600+ in contract labor/services)`}
          sx={cardSx}
        >
          <TableContainer>
            <Table size="small" sx={{ minWidth: 850 }}>
              <TableHead>
                <TableRow>
                  <TableCell>Vendor Name</TableCell>
                  <TableCell>Tax ID (EIN/SSN)</TableCell>
                  <TableCell>Address</TableCell>
                  <TableCell>Readiness</TableCell>
                  <TableCell align="right">Total Amount</TableCell>
                  <TableCell>Expense Count</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {form1099Data.map((form, index) => (
                  <TableRow key={index}>
                    <TableCell><Typography fontWeight="bold">{form.vendorName}</Typography></TableCell>
                    <TableCell>{form.vendorTaxId || <Typography variant="caption" color="text.secondary">Not provided</Typography>}</TableCell>
                    <TableCell>{form.vendorAddress || <Typography variant="caption" color="text.secondary">Not provided</Typography>}</TableCell>
                    <TableCell><Chip size="small" color={form.needsW9Info ? 'warning' : 'success'} label={form.needsW9Info ? 'Needs W-9 info' : 'Ready'} /></TableCell>
                    <TableCell align="right"><Typography fontWeight="bold">${form.totalAmount?.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 }) || '0.00'}</Typography></TableCell>
                    <TableCell>{form.expenseCount}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TableContainer>
          <Box sx={{ mt: 2, p: 2, bgcolor: alpha(theme.palette.warning.main, 0.1), borderRadius: 1 }}>
            <Typography variant="body2" color="text.secondary">
              <strong>Note:</strong> Verify all vendor information (Tax ID, Address) before filing. Consult a tax professional for proper 1099 filing procedures.
            </Typography>
          </Box>
        </MainCard>
      )}

      <ExpenseEditDrawer
        open={editDialogOpen}
        expense={editingExpense}
        title="Edit tax-ready expense"
        onClose={handleCloseEditDialog}
        onSuccess={async () => {
          await fetchTaxData();
          setEditingExpense(null);
        }}
      />
    </Box>
  );
}
