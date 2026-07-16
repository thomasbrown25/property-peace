import { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
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
  Card,
  CardContent,
  alpha,
  Menu,
  CircularProgress,
  Alert,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Paper,
  Chip,
  Divider,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  IconButton,
  Checkbox,
  FormControlLabel
} from '@mui/material';
import { DownloadOutlined, FileExcelOutlined, FilePdfOutlined, EditOutlined, TagsOutlined, ArrowRightOutlined } from '@ant-design/icons';
import MainCard from 'components/MainCard';
import { useTheme } from '@mui/material/styles';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend, PieChart, Pie, Cell } from 'recharts';
import useAuth from 'hooks/useAuth';
import { openSnackbar } from 'api/snackbar';
import PageBreadcrumbs from 'components/breadcrumbs/PageBreadcrumbs';
import {
  getTaxYearReport,
  getTaxCategorySummary,
  getTaxDeductibleExpenses,
  getForm1099Data,
  exportToAccountingSoftware,
  downloadScheduleEPdf,
  getExpenseById,
  updateExpense
} from 'api/expense';

const COLORS = ['#1890ff', '#52c41a', '#faad14', '#f5222d', '#722ed1', '#eb2f96', '#13c2c2', '#fa8c16', '#2f54eb'];

// IRS Tax Categories (Schedule E) - matching backend enum
const IRS_TAX_CATEGORIES = [
  { value: null, label: 'None' },
  { value: 1, label: 'Repairs' },
  { value: 2, label: 'Maintenance' },
  { value: 3, label: 'Cleaning' },
  { value: 4, label: 'Landscaping' },
  { value: 5, label: 'Utilities' },
  { value: 6, label: 'Water' },
  { value: 7, label: 'Sewer' },
  { value: 8, label: 'Garbage' },
  { value: 9, label: 'Internet' },
  { value: 10, label: 'Phone' },
  { value: 11, label: 'Insurance' },
  { value: 12, label: 'Liability Insurance' },
  { value: 13, label: 'Property Insurance' },
  { value: 14, label: 'Property Taxes' },
  { value: 15, label: 'Local Taxes' },
  { value: 16, label: 'State Taxes' },
  { value: 17, label: 'Property Management' },
  { value: 18, label: 'Legal Fees' },
  { value: 19, label: 'Accounting Fees' },
  { value: 20, label: 'Professional Services' },
  { value: 21, label: 'Advertising' },
  { value: 22, label: 'Marketing' },
  { value: 23, label: 'Travel' },
  { value: 24, label: 'Transportation' },
  { value: 25, label: 'Vehicle Expenses' },
  { value: 26, label: 'Depreciation' },
  { value: 27, label: 'Improvements' },
  { value: 28, label: 'Other' },
  { value: 29, label: 'Supplies' },
  { value: 30, label: 'Office Expenses' },
  { value: 31, label: 'Bank Fees' },
  { value: 32, label: 'Interest' },
  { value: 33, label: 'Mortgage Interest' },
  { value: 34, label: 'Contract Labor' },
  { value: 35, label: 'Services' }
];

export default function TaxReports() {
  const { user } = useAuth();
  const theme = useTheme();
  const navigate = useNavigate();

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [year, setYear] = useState(new Date().getFullYear());
  const [startDate, setStartDate] = useState(() => {
    const date = new Date();
    date.setMonth(date.getMonth() - 6);
    return date.toISOString().slice(0, 10);
  });
  const [endDate, setEndDate] = useState(() => new Date().toISOString().slice(0, 10));

  // Data states
  const [taxYearReport, setTaxYearReport] = useState(null);
  const [categorySummary, setCategorySummary] = useState([]);
  const [deductibleExpenses, setDeductibleExpenses] = useState([]);
  const [form1099Data, setForm1099Data] = useState([]);

  const [exportMenuAnchor, setExportMenuAnchor] = useState(null);
  const [scheduleEMenuAnchor, setScheduleEMenuAnchor] = useState(null);

  // Edit expense dialog state
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [editingExpense, setEditingExpense] = useState(null);
  const [editForm, setEditForm] = useState({
    isTaxDeductible: false,
    taxCategory: null
  });
  const [saving, setSaving] = useState(false);

  const landlordId = user?.id;

  const fetchData = async () => {
    if (!landlordId) return;

    setLoading(true);
    setError(null);

    try {
      const [
        yearReportRes,
        categorySummaryRes,
        deductibleExpensesRes,
        form1099Res
      ] = await Promise.all([
        getTaxYearReport(landlordId, year),
        getTaxCategorySummary(landlordId, year),
        getTaxDeductibleExpenses(landlordId, { year }),
        getForm1099Data(landlordId, year)
      ]);

      console.log('Tax report responses:', { yearReportRes, categorySummaryRes, deductibleExpensesRes, form1099Res });

      if (yearReportRes?.data) {
        setTaxYearReport(yearReportRes.data);
      }

      if (categorySummaryRes?.data) {
        setCategorySummary(categorySummaryRes.data);
      }

      if (deductibleExpensesRes?.data) {
        setDeductibleExpenses(deductibleExpensesRes.data);
      }

      if (form1099Res?.data) {
        setForm1099Data(form1099Res.data);
      }

      if (yearReportRes?.success === false || categorySummaryRes?.success === false) {
        const errorMsg = yearReportRes?.message || categorySummaryRes?.message || 'Failed to load tax reports';
        setError(errorMsg);
      }
    } catch (err) {
      console.error('Error fetching tax reports:', err);
      setError(err.response?.data?.message || err.message || 'Failed to load tax reports. Please check your connection and try again.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, [landlordId, year]);

  const handleExport = async (format) => {
    setExportMenuAnchor(null);
    try {
      await exportToAccountingSoftware(landlordId, format, { year });
      openSnackbar({
        open: true,
        message: `Successfully exported to ${format.toUpperCase()}`,
        variant: 'alert',
        alert: { color: 'success' }
      });
    } catch (err) {
      console.error('Export error:', err);
      setError(err.message || 'Failed to export');
    }
  };

  const handleDownloadScheduleE = async (perProperty = false) => {
    setScheduleEMenuAnchor(null);
    setExportMenuAnchor(null);
    setLoading(true);
    try {
      await downloadScheduleEPdf(landlordId, year, perProperty);
      openSnackbar({
        open: true,
        message: `Schedule E PDF downloaded successfully`,
        variant: 'alert',
        alert: { color: 'success' }
      });
    } catch (err) {
      console.error('Schedule E PDF download error:', err);
      openSnackbar({
        open: true,
        message: err.response?.data?.message || err.message || 'Failed to download Schedule E PDF',
        variant: 'alert',
        alert: { color: 'error' }
      });
    } finally {
      setLoading(false);
    }
  };

  const handleEditExpense = async (expense) => {
    try {
      setLoading(true);
      // Fetch full expense details
      const response = await getExpenseById(expense.expenseId);
      if (response?.data) {
        const fullExpense = response.data;
        setEditingExpense(fullExpense);
        setEditForm({
          isTaxDeductible: fullExpense.isTaxDeductible || false,
          taxCategory: fullExpense.taxCategory || null
        });
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
      setLoading(false);
    }
  };

  const handleSaveExpenseEdit = async () => {
    if (!editingExpense) return;

    setSaving(true);
    try {
      // Prepare update payload - include all required fields
      const updatePayload = {
        id: editingExpense.id,
        propertyId: editingExpense.propertyId,
        unitId: editingExpense.unitId || null,
        name: editingExpense.name || editingExpense.description || '', // Use name field (required)
        category: editingExpense.category,
        amount: editingExpense.amount,
        expenseDate: editingExpense.expenseDate,
        vendor: editingExpense.vendor || null,
        paymentMethod: editingExpense.paymentMethod || null,
        isRecurring: editingExpense.isRecurring || false,
        isTaxDeductible: editForm.isTaxDeductible,
        taxCategory: editForm.taxCategory || null,
        maintenanceRequestId: editingExpense.maintenanceRequestId || null
      };

      // Include recurring fields if it's a recurring expense
      if (editingExpense.isRecurring) {
        updatePayload.frequency = editingExpense.frequency;
        updatePayload.dayOfPeriod = editingExpense.dayOfPeriod;
        updatePayload.startDate = editingExpense.startDate;
        updatePayload.endDate = editingExpense.endDate || null;
        updatePayload.isPaused = editingExpense.isPaused || false;
      }

      const response = await updateExpense(editingExpense.id, updatePayload);
      
      if (response?.success !== false) {
        openSnackbar({
          open: true,
          message: 'Expense updated successfully',
          variant: 'alert',
          alert: { color: 'success' }
        });
        setEditDialogOpen(false);
        setEditingExpense(null);
        // Refresh data
        await fetchData();
      } else {
        throw new Error(response?.message || 'Failed to update expense');
      }
    } catch (err) {
      console.error('Error updating expense:', err);
      openSnackbar({
        open: true,
        message: err.response?.data?.message || err.message || 'Failed to update expense',
        variant: 'alert',
        alert: { color: 'error' }
      });
    } finally {
      setSaving(false);
    }
  };

  const handleCloseEditDialog = () => {
    setEditDialogOpen(false);
    setEditingExpense(null);
    setEditForm({
      isTaxDeductible: false,
      taxCategory: null
    });
  };

  // Prepare chart data
  const categoryChartData = useMemo(() => {
    return categorySummary.map(cat => ({
      name: cat.categoryName,
      value: cat.totalAmount,
      count: cat.expenseCount
    }));
  }, [categorySummary]);

  const incomeExpensesData = useMemo(() => {
    if (!taxYearReport) return [];
    return [
      { name: 'Total Income', amount: taxYearReport.totalIncome },
      { name: 'Deductible Expenses', amount: taxYearReport.totalExpenses },
      { name: 'Net Income', amount: Math.max(0, taxYearReport.netIncome) }
    ];
  }, [taxYearReport]);

  const estimatedSavings = useMemo(() => {
    if (!taxYearReport) return 0;
    return taxYearReport.totalExpenses * 0.22;
  }, [taxYearReport]);

  return (
    <Box>
      {/* Breadcrumbs */}
      <PageBreadcrumbs
        items={[
          { label: 'Dashboard', path: '/landlord/dashboard' },
          { label: 'Tax Reports' }
        ]}
      />
      
      <Grid container spacing={2.5}>
        {/* Header */}
        <Grid size={{ xs: 12 }}>
          <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 2 }}>
            <Typography variant="h3">Tax & Accounting Reports</Typography>
            <Stack direction="row" spacing={1}>
              <Button
                variant="outlined"
                startIcon={<DownloadOutlined />}
                onClick={(e) => setExportMenuAnchor(e.currentTarget)}
              >
                Export
              </Button>
              <Menu
                anchorEl={exportMenuAnchor}
                open={Boolean(exportMenuAnchor)}
                onClose={() => setExportMenuAnchor(null)}
              >
                <MenuItem onClick={() => handleExport('csv')}>
                  <FileExcelOutlined style={{ marginRight: 8 }} />
                  Export CSV
                </MenuItem>
                <MenuItem onClick={() => handleExport('quickbooks')}>
                  <FileExcelOutlined style={{ marginRight: 8 }} />
                  Export QuickBooks
                </MenuItem>
                <MenuItem onClick={() => handleExport('xero')}>
                  <FileExcelOutlined style={{ marginRight: 8 }} />
                  Export Xero
                </MenuItem>
                <MenuItem 
                  onClick={(e) => {
                    setScheduleEMenuAnchor(e.currentTarget);
                  }}
                >
                  <FilePdfOutlined style={{ marginRight: 8 }} />
                  Schedule E PDF
                </MenuItem>
              </Menu>
              <Menu
                anchorEl={scheduleEMenuAnchor}
                open={Boolean(scheduleEMenuAnchor)}
                onClose={() => setScheduleEMenuAnchor(null)}
              >
                <MenuItem onClick={() => handleDownloadScheduleE(false)}>
                  <FilePdfOutlined style={{ marginRight: 8 }} />
                  Combined Properties
                </MenuItem>
                <MenuItem onClick={() => handleDownloadScheduleE(true)}>
                  <FilePdfOutlined style={{ marginRight: 8 }} />
                  Per Property
                </MenuItem>
              </Menu>
            </Stack>
          </Stack>
        </Grid>

        {/* Filters */}
        <Grid size={{ xs: 12 }}>
          <MainCard
            sx={{
              bgcolor: (t) => alpha(t.palette.background.paper, 0.6),
              boxShadow: (t) => t.palette.mode === 'dark'
                ? `0 0 0 1px ${alpha(t.palette.primary.main, 0.22)}, 0 8px 28px ${alpha(t.palette.primary.main, 0.14)}`
                : `0 2px 12px ${alpha(t.palette.primary.main, 0.08)}`
            }}
          >
            <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2} sx={{ p: 2 }}>
              <TextField
                size="small"
                type="number"
                label="Tax Year"
                value={year}
                onChange={(e) => setYear(parseInt(e.target.value) || new Date().getFullYear())}
                InputLabelProps={{ shrink: true }}
                sx={{ minWidth: 150 }}
              />
            </Stack>
          </MainCard>
        </Grid>

        {error && (
          <Grid size={{ xs: 12 }}>
            <Alert severity="error">{error}</Alert>
          </Grid>
        )}

        {loading && (
          <Grid size={{ xs: 12 }}>
            <Box sx={{ display: 'flex', justifyContent: 'center', p: 4 }}>
              <CircularProgress />
            </Box>
          </Grid>
        )}

        {!loading && !error && !taxYearReport && (
          <Grid size={{ xs: 12 }}>
            <MainCard
              sx={{
                bgcolor: (t) => alpha(t.palette.background.paper, 0.6),
                boxShadow: (t) => t.palette.mode === 'dark'
                ? `0 0 0 1px ${alpha(t.palette.primary.main, 0.22)}, 0 8px 28px ${alpha(t.palette.primary.main, 0.14)}`
                : `0 2px 12px ${alpha(t.palette.primary.main, 0.08)}`
              }}
            >
              <Box sx={{ p: 5, textAlign: 'center' }}>
                <Box
                  sx={{
                    width: 64,
                    height: 64,
                    borderRadius: '50%',
                    bgcolor: (t) => alpha(t.palette.primary.main, 0.1),
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    mx: 'auto',
                    mb: 2
                  }}
                >
                  <TagsOutlined style={{ fontSize: 28, color: theme.palette.primary.main }} />
                </Box>
                <Typography variant="h5" gutterBottom>
                  No Tax Data for {year}
                </Typography>
                <Typography variant="body2" color="text.secondary" sx={{ maxWidth: 480, mx: 'auto', mb: 3 }}>
                  To see your tax report, go to your Expenses page and mark expenses as tax-deductible by assigning an IRS Schedule E category. Once categorized, they'll appear here automatically.
                </Typography>
                <Button
                  variant="contained"
                  endIcon={<ArrowRightOutlined />}
                  onClick={() => navigate('/landlord/expenses')}
                >
                  Go to Expenses
                </Button>
              </Box>
            </MainCard>
          </Grid>
        )}

        {/* Tip: prompt to categorize expenses */}
        {taxYearReport && !loading && categoryChartData.length === 0 && (
          <Grid size={{ xs: 12 }}>
            <Alert
              severity="info"
              action={
                <Button size="small" color="inherit" onClick={() => navigate('/landlord/expenses')}>
                  Go to Expenses
                </Button>
              }
            >
              <strong>Tip:</strong> You have income on record for {year}, but no deductible expenses assigned yet. Assign IRS tax categories to your expenses to unlock deduction charts and Schedule E data.
            </Alert>
          </Grid>
        )}

        {/* Tax Year Summary Cards */}
        {taxYearReport && !loading && (
          <>
            <Grid size={{ xs: 12, sm: 6, md: 3 }}>
              <Card
                sx={{
                  bgcolor: (t) => alpha(t.palette.success.main, 0.1),
                  border: `1px solid ${alpha(theme.palette.success.main, 0.2)}`
                }}
              >
                <CardContent>
                  <Typography variant="h4" color="success.main">
                    ${taxYearReport.totalIncome.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </Typography>
                  <Typography variant="body2" color="text.secondary">
                    Total Income ({year})
                  </Typography>
                </CardContent>
              </Card>
            </Grid>
            <Grid size={{ xs: 12, sm: 6, md: 3 }}>
              <Card
                sx={{
                  bgcolor: (t) => alpha(t.palette.error.main, 0.1),
                  border: `1px solid ${alpha(theme.palette.error.main, 0.2)}`
                }}
              >
                <CardContent>
                  <Typography variant="h4" color="error.main">
                    ${taxYearReport.totalExpenses.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </Typography>
                  <Typography variant="body2" color="text.secondary">
                    Total Deductible Expenses
                  </Typography>
                </CardContent>
              </Card>
            </Grid>
            <Grid size={{ xs: 12, sm: 6, md: 3 }}>
              <Card
                sx={{
                  bgcolor: (t) => alpha(t.palette.info.main, 0.1),
                  border: `1px solid ${alpha(theme.palette.info.main, 0.2)}`
                }}
              >
                <CardContent>
                  <Typography variant="h4" color="info.main">
                    ${taxYearReport.netIncome.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </Typography>
                  <Typography variant="body2" color="text.secondary">
                    Net Income (Schedule E)
                  </Typography>
                </CardContent>
              </Card>
            </Grid>
            <Grid size={{ xs: 12, sm: 6, md: 3 }}>
              <Card
                sx={{
                  bgcolor: (t) => alpha(t.palette.primary.main, 0.1),
                  border: `1px solid ${alpha(theme.palette.primary.main, 0.2)}`
                }}
              >
                <CardContent>
                  <Typography variant="h4" color="primary.main">
                    ${estimatedSavings.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </Typography>
                  <Typography variant="body2" color="text.secondary">
                    Est. Tax Savings (22% bracket)
                  </Typography>
                </CardContent>
              </Card>
            </Grid>
          </>
        )}

        {/* Income vs. Expenses Overview */}
        {taxYearReport && !loading && (
          <Grid size={{ xs: 12, md: categoryChartData.length > 0 ? 6 : 12 }}>
            <MainCard
              title="Income vs. Expenses Overview"
              sx={{
                bgcolor: (t) => alpha(t.palette.background.paper, 0.6),
                boxShadow: (t) => t.palette.mode === 'dark'
                ? `0 0 0 1px ${alpha(t.palette.primary.main, 0.22)}, 0 8px 28px ${alpha(t.palette.primary.main, 0.14)}`
                : `0 2px 12px ${alpha(t.palette.primary.main, 0.08)}`
              }}
            >
              <Box sx={{ pt: 2, height: 350 }}>
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={incomeExpensesData} barSize={60}>
                    <CartesianGrid strokeDasharray="3 3" stroke={alpha(theme.palette.text.primary, 0.1)} />
                    <XAxis dataKey="name" tick={{ fill: theme.palette.text.secondary, fontSize: 13 }} />
                    <YAxis tick={{ fill: theme.palette.text.secondary, fontSize: 12 }} tickFormatter={(v) => `$${(v / 1000).toFixed(0)}k`} />
                    <Tooltip
                      contentStyle={{
                        backgroundColor: theme.palette.background.paper,
                        border: `1px solid ${theme.palette.divider}`,
                        borderRadius: 8
                      }}
                      formatter={(value) => [`$${value.toLocaleString(undefined, { minimumFractionDigits: 2 })}`, 'Amount']}
                    />
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
        )}

        {/* Tax Category Breakdown (Pie) */}
        {categoryChartData.length > 0 && !loading && (
          <Grid size={{ xs: 12, md: 6 }}>
            <MainCard
              title="Deductions by Category"
              sx={{
                bgcolor: (t) => alpha(t.palette.background.paper, 0.6),
                boxShadow: (t) => t.palette.mode === 'dark'
                ? `0 0 0 1px ${alpha(t.palette.primary.main, 0.22)}, 0 8px 28px ${alpha(t.palette.primary.main, 0.14)}`
                : `0 2px 12px ${alpha(t.palette.primary.main, 0.08)}`
              }}
            >
              <Box sx={{ pt: 2, height: 350 }}>
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={categoryChartData}
                      cx="50%"
                      cy="50%"
                      labelLine={false}
                      label={({ name, percent }) => `${name} (${(percent * 100).toFixed(0)}%)`}
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
                    <Legend />
                  </PieChart>
                </ResponsiveContainer>
              </Box>
            </MainCard>
          </Grid>
        )}

        {/* Tax Deductible Expenses Table */}
        {deductibleExpenses.length > 0 && !loading && (
          <Grid size={{ xs: 12 }}>
            <MainCard
              title="Tax Deductible Expenses"
              sx={{
                bgcolor: (t) => alpha(t.palette.background.paper, 0.6),
                boxShadow: (t) => t.palette.mode === 'dark'
                ? `0 0 0 1px ${alpha(t.palette.primary.main, 0.22)}, 0 8px 28px ${alpha(t.palette.primary.main, 0.14)}`
                : `0 2px 12px ${alpha(t.palette.primary.main, 0.08)}`
              }}
            >
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
                      <TableCell>Status</TableCell>
                      <TableCell align="center">Actions</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {deductibleExpenses.map((expense) => (
                      <TableRow key={expense.expenseId} hover>
                        <TableCell>{new Date(expense.expenseDate).toLocaleDateString()}</TableCell>
                        <TableCell>{expense.propertyName}{expense.unitName ? ` - ${expense.unitName}` : ''}</TableCell>
                        <TableCell>{expense.description}</TableCell>
                        <TableCell>
                          <Chip
                            label={expense.taxCategoryName || 'Uncategorized'}
                            size="small"
                            color={expense.taxCategory ? 'primary' : 'default'}
                          />
                        </TableCell>
                        <TableCell>{expense.vendor || 'N/A'}</TableCell>
                        <TableCell align="right">
                          ${expense.amount.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                        </TableCell>
                        <TableCell>
                          <Chip
                            label={expense.isFullyDeductible ? 'Fully Deductible' : 'Partial'}
                            size="small"
                            color={expense.isFullyDeductible ? 'success' : 'warning'}
                          />
                        </TableCell>
                        <TableCell align="center">
                          <IconButton
                            size="small"
                            onClick={() => handleEditExpense(expense)}
                            color="primary"
                            title="Edit tax category"
                          >
                            <EditOutlined />
                          </IconButton>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </TableContainer>
            </MainCard>
          </Grid>
        )}

        {/* 1099 Preparation Section */}
        {form1099Data.length > 0 && !loading && (
          <Grid size={{ xs: 12 }}>
            <MainCard
              title="1099-MISC Preparation"
              subtitle={`Vendors requiring 1099 forms for ${year} (vendors with $600+ in contract labor/services)`}
              sx={{
                bgcolor: (t) => alpha(t.palette.background.paper, 0.6),
                boxShadow: (t) => t.palette.mode === 'dark'
                ? `0 0 0 1px ${alpha(t.palette.primary.main, 0.22)}, 0 8px 28px ${alpha(t.palette.primary.main, 0.14)}`
                : `0 2px 12px ${alpha(t.palette.primary.main, 0.08)}`
              }}
            >
              <TableContainer>
                <Table>
                  <TableHead>
                    <TableRow>
                      <TableCell>Vendor Name</TableCell>
                      <TableCell>Tax ID (EIN/SSN)</TableCell>
                      <TableCell>Address</TableCell>
                      <TableCell align="right">Total Amount</TableCell>
                      <TableCell>Expense Count</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {form1099Data.map((form, index) => (
                      <TableRow key={index}>
                        <TableCell>
                          <Typography fontWeight="bold">{form.vendorName}</Typography>
                        </TableCell>
                        <TableCell>
                          {form.vendorTaxId || (
                            <Typography variant="caption" color="text.secondary">
                              Not provided
                            </Typography>
                          )}
                        </TableCell>
                        <TableCell>
                          {form.vendorAddress || (
                            <Typography variant="caption" color="text.secondary">
                              Not provided
                            </Typography>
                          )}
                        </TableCell>
                        <TableCell align="right">
                          <Typography fontWeight="bold">
                            ${form.totalAmount.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                          </Typography>
                        </TableCell>
                        <TableCell>{form.expenseCount}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </TableContainer>
              <Box sx={{ mt: 2, p: 2, bgcolor: alpha(theme.palette.warning.main, 0.1), borderRadius: 1 }}>
                <Typography variant="body2" color="text.secondary">
                  <strong>Note:</strong> This is a summary of vendors that may require 1099-MISC forms. Please verify all vendor information (Tax ID, Address) before filing. Consult with a tax professional for proper 1099 filing procedures.
                </Typography>
              </Box>
            </MainCard>
          </Grid>
        )}

        {/* Edit Expense Tax Category Dialog */}
        <Dialog open={editDialogOpen} onClose={handleCloseEditDialog} maxWidth="sm" fullWidth>
          <DialogTitle>
            Edit Tax Deductible Status
            {editingExpense && (
              <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5, fontWeight: 'normal' }}>
                {editingExpense.name || editingExpense.description || 'Expense'}
              </Typography>
            )}
          </DialogTitle>
          <DialogContent>
            <Stack spacing={2} sx={{ mt: 1 }}>
              <FormControlLabel
                control={
                  <Checkbox
                    checked={editForm.isTaxDeductible}
                    onChange={(e) => {
                      const newValue = e.target.checked;
                      setEditForm({
                        ...editForm,
                        isTaxDeductible: newValue,
                        // Clear tax category if unchecking tax deductible
                        taxCategory: newValue ? editForm.taxCategory : null
                      });
                    }}
                  />
                }
                label="Tax Deductible"
              />

              {editForm.isTaxDeductible && (
                <FormControl fullWidth>
                  <InputLabel>IRS Tax Category (Schedule E)</InputLabel>
                  <Select
                    value={editForm.taxCategory ?? ''}
                    onChange={(e) => setEditForm({ ...editForm, taxCategory: e.target.value === '' ? null : e.target.value })}
                    label="IRS Tax Category (Schedule E)"
                  >
                    {IRS_TAX_CATEGORIES.map((cat) => (
                      <MenuItem key={cat.value ?? 'none'} value={cat.value ?? ''}>
                        {cat.label}
                      </MenuItem>
                    ))}
                  </Select>
                  <Typography variant="caption" color="text.secondary" sx={{ mt: 0.5 }}>
                    Select the appropriate IRS Schedule E category for this expense
                  </Typography>
                </FormControl>
              )}

              {editingExpense && (
                <Box sx={{ mt: 2, p: 2, bgcolor: alpha(theme.palette.info.main, 0.1), borderRadius: 1 }}>
                  <Typography variant="body2" color="text.secondary">
                    <strong>Property:</strong> {editingExpense.propertyName}
                    {editingExpense.unitName && ` - ${editingExpense.unitName}`}
                  </Typography>
                  <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
                    <strong>Amount:</strong> ${editingExpense.amount?.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </Typography>
                  <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
                    <strong>Date:</strong> {editingExpense.expenseDate ? new Date(editingExpense.expenseDate).toLocaleDateString() : 'N/A'}
                  </Typography>
                </Box>
              )}
            </Stack>
          </DialogContent>
          <DialogActions sx={{ p: 2 }}>
            <Button onClick={handleCloseEditDialog} variant="outlined">
              Cancel
            </Button>
            <Button
              onClick={handleSaveExpenseEdit}
              variant="contained"
              disabled={saving}
              startIcon={saving ? <CircularProgress size={16} /> : null}
            >
              Save Changes
            </Button>
          </DialogActions>
        </Dialog>
      </Grid>
    </Box>
  );
}

