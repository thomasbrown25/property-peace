import { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useSubscription } from 'hooks/useSubscription';
import {
  Grid,
  Box,
  Typography,
  Button,
  Stack,
  TextField,
  Card,
  CardContent,
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
  FormControl,
  InputLabel,
  Select,
  OutlinedInput,
  InputAdornment
} from '@mui/material';
import { DownloadOutlined, FileExcelOutlined, FilePdfOutlined, EditOutlined, CalculatorOutlined, TagsOutlined, ArrowRightOutlined, SearchOutlined } from '@ant-design/icons';
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
  const [taxError, setTaxError] = useState(null);
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

    setTaxLoading(true);
    setTaxError(null);

    try {
      const [
        yearReportRes,
        categorySummaryRes,
        deductibleExpensesRes,
        form1099Res,
        readinessRes
      ] = await Promise.all([
        expenseAPI.getTaxYearReport(landlordId, taxYear),
        expenseAPI.getTaxCategorySummary(landlordId, taxYear),
        expenseAPI.getTaxDeductibleExpenses(landlordId, { year: taxYear }),
        expenseAPI.getForm1099Data(landlordId, taxYear),
        expenseAPI.getTaxReadiness(landlordId, taxYear)
      ]);

      if (yearReportRes?.data) {
        setTaxYearReport(yearReportRes.data);
      }

      if (categorySummaryRes?.data) {
        setTaxCategorySummary(categorySummaryRes.data);
      }

      if (deductibleExpensesRes?.data) {
        setDeductibleExpenses(deductibleExpensesRes.data);
      }

      if (form1099Res?.data) {
        setForm1099Data(form1099Res.data);
      }

      if (readinessRes?.data) {
        setTaxReadiness(readinessRes.data);
      }

      if (yearReportRes?.success === false || categorySummaryRes?.success === false) {
        const errorMsg = yearReportRes?.message || categorySummaryRes?.message || 'Failed to load tax reports';
        setTaxError(errorMsg);
      }
    } catch (err) {
      console.error('Error fetching tax reports:', err);
      setTaxError(err.response?.data?.message || err.message || 'Failed to load tax reports. Please check your connection and try again.');
    } finally {
      setTaxLoading(false);
    }
  };

  // Tax & Accounting handlers
  const handleTaxExport = async (format) => {
    setTaxExportMenuAnchor(null);
    try {
      await expenseAPI.exportToAccountingSoftware(landlordId, format, { year: taxYear });
      openSnackbar({
        open: true,
        message: `Successfully exported to ${format.toUpperCase()}`,
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
    }
  };

  const handleDownloadScheduleE = async (perProperty = false) => {
    setTaxLoading(true);
    try {
      await downloadScheduleEPdf(landlordId, taxYear, perProperty);
      openSnackbar({
        open: true,
        message: `${perProperty ? 'Per-property Schedule E' : 'Schedule E PDF'} downloaded successfully`,
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
      setTaxLoading(false);
    }
  };

  const handleEditExpense = async (expense) => {
    try {
      setTaxLoading(true);
      const expenseId = expense.expenseId || expense.id || expense.Id;
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
      setTaxLoading(false);
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

  const estimatedSavings = useMemo(() => {
    if (!taxYearReport) return 0;
    return (taxYearReport.totalExpenses || 0) * 0.22;
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

  return (
    <Box>
      <PageBreadcrumbs
        items={[
          { label: 'Dashboard', path: '/landlord/dashboard' },
          { label: 'Reports & Analytics', path: '/landlord/reports' },
          { label: 'Tax & Accounting' }
        ]}
      />

      {/* Header + controls */}
      <Box sx={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', flexWrap: 'wrap', gap: 2, mb: 3 }}>
        <Box>
          <Typography variant="h4" fontWeight={700} sx={{ lineHeight: 1.2 }}>
            Tax & Accounting
          </Typography>
          <Typography variant="caption" color="text.secondary">
            Tax-deductible expenses, Schedule E reports, and 1099 preparation
          </Typography>
        </Box>
        <Stack direction="row" spacing={1} alignItems="center" flexWrap="wrap">
          <TextField
            size="small"
            type="number"
            label="Tax Year"
            value={taxYear}
            onChange={(e) => setTaxYear(parseInt(e.target.value) || new Date().getFullYear())}
            InputLabelProps={{ shrink: true, style: { backgroundColor: 'transparent' } }}
            sx={{ width: 110, ...noLabelBg }}
            inputProps={{ style: { height: 17, fontSize: '0.8rem' } }}
          />
          <Button
            size="small"
            variant="contained"
            startIcon={<FilePdfOutlined />}
            onClick={() => handleDownloadScheduleE(false)}
            disabled={taxLoading}
            sx={{ textTransform: 'none', borderRadius: 1.5 }}
          >
            Generate Schedule E
          </Button>
          <Button
            size="small"
            variant="outlined"
            startIcon={<DownloadOutlined />}
            onClick={(e) => setTaxExportMenuAnchor(e.currentTarget)}
            disabled={taxLoading}
            sx={{ textTransform: 'none', borderRadius: 1.5 }}
          >
            Export
          </Button>
          <Menu anchorEl={taxExportMenuAnchor} open={Boolean(taxExportMenuAnchor)} onClose={() => setTaxExportMenuAnchor(null)}>
            <MenuItem onClick={() => handleTaxExport('csv')}><FileExcelOutlined style={{ marginRight: 8 }} />Export CSV</MenuItem>
            <MenuItem onClick={() => handleTaxExport('quickbooks')}><FileExcelOutlined style={{ marginRight: 8 }} />Export QuickBooks</MenuItem>
            <MenuItem onClick={() => handleTaxExport('xero')}><FileExcelOutlined style={{ marginRight: 8 }} />Export Xero</MenuItem>
            <MenuItem onClick={() => handleTaxExport('accountant')}><FileExcelOutlined style={{ marginRight: 8 }} />Accountant package</MenuItem>
            <MenuItem onClick={() => handleDownloadScheduleE(true)}><FilePdfOutlined style={{ marginRight: 8 }} />Per-property Schedule E</MenuItem>
          </Menu>
        </Stack>
      </Box>

      {taxError && <Alert severity="error" sx={{ mb: 3 }}>{taxError}</Alert>}

      {taxLoading && (
        <Box sx={{ display: 'flex', justifyContent: 'center', p: 4 }}>
          <CircularProgress />
        </Box>
      )}

      {!taxLoading && !taxError && !taxYearReport && (
        <Box sx={{ p: 5, textAlign: 'center' }}>
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

      {taxYearReport && !taxLoading && taxCategoryChartData.length === 0 && (
        <Alert severity="info" sx={{ mb: 3 }} action={<Button size="small" color="inherit" onClick={() => navigate('/landlord/expenses')}>Go to Expenses</Button>}>
          <strong>Tip:</strong> You have income on record for {taxYear}, but no deductible expenses assigned yet. Assign IRS tax categories to unlock deduction charts and Schedule E data.
        </Alert>
      )}

      {/* KPI summary cards */}
      {taxYearReport && !taxLoading && (
        <Box sx={{ display: 'flex', gap: 2, mb: 3, flexWrap: 'wrap' }}>
          {[
            { label: `Total Income (${taxYear})`, value: `$${taxYearReport.totalIncome?.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 }) || '0.00'}`, border: theme.palette.success.main, bg: alpha(theme.palette.success.main, 0.08), color: 'success.main' },
            { label: 'Total Deductible Expenses', value: `$${taxYearReport.totalExpenses?.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 }) || '0.00'}`, border: theme.palette.error.main, bg: alpha(theme.palette.error.main, 0.08), color: 'error.main' },
            { label: 'Net Income (Schedule E)', value: `$${taxYearReport.netIncome?.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 }) || '0.00'}`, border: theme.palette.info.main, bg: alpha(theme.palette.info.main, 0.08), color: 'info.main' },
            { label: 'Est. Tax Savings (22%)', value: `$${estimatedSavings.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`, border: theme.palette.primary.main, bg: alpha(theme.palette.primary.main, 0.08), color: 'primary.main' }
          ].map((kpi) => (
            <Box key={kpi.label} sx={{ flex: '1 1 180px', border: `1px dashed rgba(0,0,0,0.15)`, borderRadius: 2, p: 2, bgcolor: 'background.paper' }}>
              <Typography variant="caption" color="text.secondary" fontWeight={600} sx={{ textTransform: 'uppercase', letterSpacing: 0.6, display: 'block', mb: 0.5 }}>
                {kpi.label}
              </Typography>
              <Typography variant="h4" fontWeight={700} color={kpi.color}>{kpi.value}</Typography>
            </Box>
          ))}
        </Box>
      )}

      {/* Tax readiness */}
      {taxReadiness && !taxLoading && (
        <Grid container spacing={3} sx={{ mb: 3 }}>
          <Grid size={{ xs: 12, lg: 6 }}>
            <MainCard
              title="Tax readiness review"
              subtitle="Deterministic checks before you send numbers to your accountant"
              sx={{ bgcolor: 'background.paper', boxShadow: 'none', borderColor: 'divider' }}
            >
              <Stack spacing={1.25}>
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
      {taxReadiness && !taxLoading && (
        <Grid container spacing={3} sx={{ mb: 3 }}>
          {(taxReadiness.expenseReviewQueue || []).length > 0 && (
            <Grid size={{ xs: 12, lg: 6 }}>
              <MainCard content={false} title="Expense cleanup queue" subtitle="Uncategorized, missing receipt, loan split, and capital-improvement review items" sx={{ bgcolor: 'background.paper', boxShadow: 'none', overflow: 'hidden' }}>
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
                          sx={{ cursor: 'pointer', '&:hover .cleanup-edit-hint': { opacity: 1, transform: 'translateX(0)' } }}
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
              <MainCard content={false} title="Deposit classification" subtitle="Held/refunded/applied deposits should not be blindly counted as income" sx={{ bgcolor: 'background.paper', boxShadow: 'none', overflow: 'hidden' }}>
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
      {taxReadiness?.propertyPackages?.length > 0 && !taxLoading && (
        <MainCard content={false} title="Per-property tax package" subtitle="Accountant-friendly income and deduction rollups by property" sx={{ mb: 3, bgcolor: 'background.paper', boxShadow: 'none', overflow: 'hidden' }}>
          <TableContainer>
            <Table size="small">
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
      {taxYearReport && !taxLoading && (
        <Grid container spacing={3} sx={{ mb: 3 }}>
          <Grid size={{ xs: 12, md: taxCategoryChartData.length > 0 ? 6 : 12 }}>
            <MainCard title="Income vs. Expenses Overview" sx={{ bgcolor: (t) => alpha(t.palette.background.paper, 0.6), boxShadow: (t) => `0 0 20px ${alpha(t.palette.primary.main, 0.15)}` }}>
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
              <MainCard title="Deductions by Category" sx={{ bgcolor: (t) => alpha(t.palette.background.paper, 0.6), boxShadow: (t) => `0 0 20px ${alpha(t.palette.primary.main, 0.15)}` }}>
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
      {deductibleExpenses.length > 0 && !taxLoading && (
        <>
          <Typography variant="h6" fontWeight={600} sx={{ mb: 2 }}>Tax Deductible Expenses</Typography>

          {/* Toolbar */}
          <Box sx={{ display: 'flex', gap: 1.5, alignItems: 'center', mb: 2 }}>
            <OutlinedInput
              size="small"
              placeholder="Search expenses..."
              value={expenseSearch}
              onChange={(e) => setExpenseSearch(e.target.value)}
              startAdornment={<InputAdornment position="start"><SearchOutlined style={{ fontSize: 14, opacity: 0.5 }} /></InputAdornment>}
              sx={{ flex: 2, minWidth: 0, bgcolor: 'background.paper', height: 34, fontSize: '0.8rem' }}
            />
            <TextField
              size="small"
              type="date"
              label="Start Date"
              value={expenseStartDate}
              onChange={(e) => setExpenseStartDate(e.target.value)}
              InputLabelProps={{ shrink: true, style: { backgroundColor: 'transparent' } }}
              sx={{ flex: 1.5, minWidth: 0, ...noLabelBg }}
              inputProps={{ style: { height: 17, fontSize: '0.8rem' } }}
            />
            <TextField
              size="small"
              type="date"
              label="End Date"
              value={expenseEndDate}
              onChange={(e) => setExpenseEndDate(e.target.value)}
              InputLabelProps={{ shrink: true, style: { backgroundColor: 'transparent' } }}
              sx={{ flex: 1.5, minWidth: 0, ...noLabelBg }}
              inputProps={{ style: { height: 17, fontSize: '0.8rem' } }}
            />
            <Box sx={{ flex: 2, minWidth: 0, '& .MuiInputLabel-root': { backgroundColor: 'transparent !important' }, ...noLabelBg }}>
              <PropertySelect
                width="100%"
                onPropertyChange={(p) => setLocalFilterProperty(p)}
                localSelectedProperty={localFilterProperty}
                disableAllOption={false}
              />
            </Box>
          </Box>

          <MainCard sx={{ mb: 3, bgcolor: (t) => alpha(t.palette.background.paper, 0.6), boxShadow: (t) => `0 0 20px ${alpha(t.palette.primary.main, 0.15)}` }}>
            {filteredDeductibleExpenses.length === 0 ? (
              <Box sx={{ p: 4, textAlign: 'center' }}>
                <Typography variant="body2" color="text.secondary">No expenses match your filters.</Typography>
              </Box>
            ) : (
              <TableContainer>
                <Table>
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
                          <IconButton size="small" onClick={() => handleEditExpense(expense)} color="primary" title="Edit tax category">
                            <EditOutlined />
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
      {form1099Data.length > 0 && !taxLoading && (
        <MainCard
          title="1099-MISC Preparation"
          subtitle={`Vendors requiring 1099 forms for ${taxYear} (vendors with $600+ in contract labor/services)`}
          sx={{ bgcolor: (t) => alpha(t.palette.background.paper, 0.6), boxShadow: (t) => `0 0 20px ${alpha(t.palette.primary.main, 0.15)}` }}
        >
          <TableContainer>
            <Table>
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
