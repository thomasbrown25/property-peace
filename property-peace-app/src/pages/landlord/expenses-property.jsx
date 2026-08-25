import { useMemo, useState, useEffect } from 'react';
import {
  Box,
  Typography,
  Stack,
  Button,
  IconButton,
  Table,
  TableHead,
  TableBody,
  TableRow,
  TableCell,
  TableContainer,
  Chip,
  TextField,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  MenuItem,
  Select,
  InputLabel,
  FormControl,
  InputAdornment,
  alpha,
  Menu,
  CircularProgress,
  useTheme
} from '@mui/material';
import MoreVertIcon from '@mui/icons-material/MoreVert';
import {
  PlusOutlined,
  EditOutlined,
  DeleteOutlined,
  SearchOutlined,
  FileTextOutlined,
  CalendarOutlined,
  PauseCircleOutlined,
  PlayCircleOutlined,
  ArrowLeftOutlined
} from '@ant-design/icons';
import MainCard from 'components/MainCard';
import useFetchProperties from 'hooks/useFetchProperties';
import useFetchExpenses from 'hooks/useFetchExpenses';
import useAuth from 'hooks/useAuth';
import axiosServices from 'utils/axios';
import { formatCurrency, formatDate, getTodayLocalDate } from 'utils/formatters';
import { addExpenseAction, updateExpenseAction, deleteExpenseAction, uploadExpenseReceiptsAction, deleteExpenseReceiptAction } from 'store/expense/expense.action';
import { addRecurringExpenseAction } from 'store/recurring-expense/recurring-expense.action';
import { openSnackbar } from 'api/snackbar';
import ExpenseReceiptUpload from 'components/expense/ExpenseReceiptUpload';
import ExpenseReceiptView from 'components/expense/ExpenseReceiptView';
import { useDispatch, useSelector } from 'react-redux';
import { setProperty } from 'store/property/property.action';
import ConfirmationDialog from 'components/dialogs/ConfirmationDialog';
import { NumericFormat } from 'react-number-format';
import PageBreadcrumbs from 'components/breadcrumbs/PageBreadcrumbs';
import { useNavigate, useParams } from 'react-router-dom';

// Expense categories
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

const PAYMENT_METHODS = ['Cash', 'Check', 'Credit Card', 'Debit Card', 'ACH', 'Wire Transfer', 'Other'];

export default function ExpensesProperty() {
  const dispatch = useDispatch();
  const navigate = useNavigate();
  const { propertyId } = useParams();
  const expensesSearch = new URLSearchParams({ tab: 'expenses' });
  if (propertyId) {
    expensesSearch.set('propertyId', propertyId);
  }
  const expensesPath = `/landlord/finances?${expensesSearch.toString()}`;

  const { user } = useAuth();
  const theme = useTheme();

  // Fetch properties to get property name
  const { properties, isLoading: propertiesLoading } = useFetchProperties();

  // Fetch expenses filtered by property
  const { expenses: allExpenses, loading: expensesLoading, refetch: refetchExpenses } = useFetchExpenses({ propertyId: propertyId ? Number(propertyId) : null });

  // Initial loading state
  const [initialLoading, setInitialLoading] = useState(true);

  // Expenses state
  const [searchQuery, setSearchQuery] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('all');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [openDialog, setOpenDialog] = useState(false);
  const [editingExpense, setEditingExpense] = useState(null);
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
  const [expenseToDelete, setExpenseToDelete] = useState(null);
  const [expenseForm, setExpenseForm] = useState({
    propertyId: propertyId || '',
    unitId: '',
    category: 'Repairs',
    amount: '',
    expenseDate: new Date().toISOString().slice(0, 10),
    name: '',
    vendor: '',
    vendorId: null,
    paymentMethod: '',
    receiptUrl: '',
    isRecurring: false,
    isTaxDeductible: false,
    taxCategory: null,
    maintenanceRequestId: null,
    frequency: null,
    dayOfPeriod: 1,
    startDate: null,
    endDate: null,
    isPaused: false
  });
  const [expenseReceipts, setExpenseReceipts] = useState([]);
  const [deletedReceiptIds, setDeletedReceiptIds] = useState([]);
  const [menuAnchor, setMenuAnchor] = useState(null);
  const [menuExpense, setMenuExpense] = useState(null);

  useEffect(() => {
    if (!propertiesLoading && properties) {
      setInitialLoading(false);
    }
  }, [propertiesLoading, properties]);

  // Get property name
  const property = useMemo(() => {
    if (!properties || !propertyId) return null;
    return properties.find(p => p.id === Number(propertyId));
  }, [properties, propertyId]);

  // Filter expenses client-side
  const fetchedExpenses = useMemo(() => {
    if (!allExpenses || allExpenses.length === 0) return [];

    return allExpenses.filter(expense => {
      // Category filter
      if (categoryFilter !== 'all' && expense.category !== categoryFilter) {
        return false;
      }

      // Date filters
      if (dateFrom) {
        const expenseDate = new Date(expense.expenseDate);
        const startDate = new Date(dateFrom);
        if (expenseDate < startDate) return false;
      }

      if (dateTo) {
        const expenseDate = new Date(expense.expenseDate);
        const endDate = new Date(dateTo);
        endDate.setHours(23, 59, 59, 999);
        if (expenseDate > endDate) return false;
      }

      return true;
    });
  }, [allExpenses, categoryFilter, dateFrom, dateTo]);

  // Filter expenses by search query
  const filteredExpenses = useMemo(() => {
    let filtered = fetchedExpenses || [];

    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter(
        (expense) =>
          expense.category?.toLowerCase().includes(query) ||
          expense.vendor?.toLowerCase().includes(query) ||
          expense.name?.toLowerCase().includes(query) ||
          expense.propertyName?.toLowerCase().includes(query) ||
          expense.unitName?.toLowerCase().includes(query)
      );
    }

    return filtered;
  }, [fetchedExpenses, searchQuery]);

  // Get selected property for unit selection
  const selectedPropertyForExpense = useMemo(() => {
    if (!expenseForm.propertyId) return null;
    return properties?.find((p) => Number(p.id) === Number(expenseForm.propertyId));
  }, [expenseForm.propertyId, properties]);

  // Unit options from selected property
  const unitOptionsForExpense = useMemo(() => {
    if (!selectedPropertyForExpense?.units || selectedPropertyForExpense.units.length === 0) return [];
    return selectedPropertyForExpense.units.map((u) => ({
      label: u.name || `Unit ${u.id}`,
      id: u.id
    }));
  }, [selectedPropertyForExpense]);

  // Expense handlers
  const handleOpenDialog = (expense = null) => {
    if (expense) {
      setEditingExpense(expense);
      setExpenseForm({
        propertyId: expense.propertyId?.toString() || propertyId || '',
        unitId: expense.unitId?.toString() || '',
        category: expense.category || 'Repairs',
        amount: expense.amount || '',
        expenseDate: expense.expenseDate ? expense.expenseDate.slice(0, 10) : getTodayLocalDate(),
        name: expense.name || '',
        vendor: expense.vendor || '',
        vendorId: expense.vendorId || null,
        paymentMethod: expense.paymentMethod || '',
        receiptUrl: expense.receiptUrl || '',
        isRecurring: expense.isRecurring || false,
        isTaxDeductible: expense.isTaxDeductible || false,
        taxCategory: expense.taxCategory || null,
        maintenanceRequestId: expense.maintenanceRequestId || null,
        frequency: expense.frequency || null,
        dayOfPeriod: expense.dayOfPeriod || 1,
        startDate: expense.startDate ? expense.startDate.slice(0, 10) : null,
        endDate: expense.endDate ? expense.endDate.slice(0, 10) : null,
        isPaused: expense.isPaused || false
      });
      // Set existing receipts for display
      if (expense.receipts && expense.receipts.length > 0) {
        setExpenseReceipts(expense.receipts.map(r => ({ ...r, isExisting: true, file: null })));
      } else {
        setExpenseReceipts([]);
      }
      setDeletedReceiptIds([]);
    } else {
      setEditingExpense(null);
      setExpenseForm({
        propertyId: propertyId || '',
        unitId: '',
        category: 'Repairs',
        amount: '',
        expenseDate: getTodayLocalDate(),
        name: '',
        vendor: '',
        vendorId: null,
        paymentMethod: '',
        receiptUrl: '',
        isRecurring: false,
        isTaxDeductible: false,
        taxCategory: null,
        maintenanceRequestId: null,
        frequency: null,
        dayOfPeriod: 1,
        startDate: null,
        endDate: null,
        isPaused: false
      });
      setExpenseReceipts([]);
      setDeletedReceiptIds([]);
    }
    setOpenDialog(true);
  };

  const handleCloseDialog = () => {
    setOpenDialog(false);
    setEditingExpense(null);
  };

  const handleSubmit = async () => {
    // Validation
    if (!expenseForm.isRecurring) {
      if (!expenseForm.propertyId || !expenseForm.amount || !expenseForm.category || !expenseForm.expenseDate || !expenseForm.name) {
        openSnackbar({
          open: true,
          message: 'Please fill in all required fields',
          variant: 'alert',
          alert: { color: 'warning' }
        });
        return;
      }
    } else {
      if (!expenseForm.propertyId || !expenseForm.amount || !expenseForm.category || !expenseForm.name || !expenseForm.startDate || !expenseForm.frequency) {
        openSnackbar({
          open: true,
          message: 'Please fill in all required fields for recurring expense',
          variant: 'alert',
          alert: { color: 'warning' }
        });
        return;
      }
    }

    try {
      const payload = {
        landlordId: user.id,
        propertyId: Number(expenseForm.propertyId),
        unitId: expenseForm.unitId ? Number(expenseForm.unitId) : null,
        name: expenseForm.name,
        category: expenseForm.category,
        amount: typeof expenseForm.amount === 'number' ? expenseForm.amount : parseFloat(expenseForm.amount) || 0,
        expenseDate: expenseForm.isRecurring ? expenseForm.startDate : expenseForm.expenseDate,
        vendor: expenseForm.vendor || null,
        vendorId: null,
        paymentMethod: expenseForm.isRecurring ? null : (expenseForm.paymentMethod || null),
        receiptUrl: expenseForm.receiptUrl || null,
        isRecurring: expenseForm.isRecurring,
        isTaxDeductible: expenseForm.isTaxDeductible,
        taxCategory: expenseForm.taxCategory || null,
        maintenanceRequestId: expenseForm.maintenanceRequestId || null,
        frequency: expenseForm.isRecurring ? expenseForm.frequency : null,
        dayOfPeriod: expenseForm.isRecurring ? expenseForm.dayOfPeriod : null,
        startDate: expenseForm.isRecurring ? expenseForm.startDate : null,
        endDate: expenseForm.isRecurring ? (expenseForm.endDate || null) : null,
        isPaused: expenseForm.isRecurring ? (editingExpense?.isPaused || false) : false
      };

      let expenseId;
      if (editingExpense) {
        const updatePayload = { ...payload, id: editingExpense.id };
        await dispatch(updateExpenseAction(editingExpense.id, updatePayload));
        expenseId = editingExpense.id;

        for (const receiptId of deletedReceiptIds) {
          try {
            await dispatch(deleteExpenseReceiptAction(receiptId));
          } catch (error) {
            console.error(`Error deleting receipt ${receiptId}:`, error);
          }
        }

        openSnackbar({
          open: true,
          message: 'Expense updated successfully',
          variant: 'alert',
          alert: { color: 'success' }
        });
      } else {
        const result = await dispatch(addExpenseAction(payload));
        expenseId = result?.id || result?.data?.id;
        
        // If this is a recurring expense, also create a RecurringExpense template
        if (expenseForm.isRecurring && expenseId) {
          try {
            const recurringExpensePayload = {
              landlordId: user.id,
              propertyId: Number(expenseForm.propertyId),
              unitId: expenseForm.unitId ? Number(expenseForm.unitId) : null,
              name: expenseForm.name,
              category: expenseForm.category,
              amount: typeof expenseForm.amount === 'number' ? expenseForm.amount : parseFloat(expenseForm.amount) || 0,
              frequency: expenseForm.frequency,
              dayOfPeriod: expenseForm.dayOfPeriod || 1,
              startDate: expenseForm.startDate || expenseForm.expenseDate,
              endDate: expenseForm.endDate || null,
              notes: null,
              vendor: expenseForm.vendor || null,
              paymentMethod: null,
              isTaxDeductible: expenseForm.isTaxDeductible || false,
              maintenanceRequestId: expenseForm.maintenanceRequestId || null
            };
            
            await dispatch(addRecurringExpenseAction(recurringExpensePayload));
          } catch (recurringError) {
            console.error('Error creating recurring expense template:', recurringError);
            // Don't fail the whole operation, but log the error
            openSnackbar({
              open: true,
              message: 'Expense created but failed to create recurring template',
              variant: 'alert',
              alert: { color: 'warning' }
            });
          }
        }
        
        openSnackbar({
          open: true,
          message: 'Expense added successfully',
          variant: 'alert',
          alert: { color: 'success' }
        });
      }

      // Upload new receipts
      if (expenseId && expenseReceipts.length > 0) {
        const filesToUpload = expenseReceipts
          .filter(receipt => !receipt.isExisting && receipt.file)
          .map(receipt => receipt.file instanceof File ? receipt.file : receipt.file)
          .filter(file => file instanceof File);

        if (filesToUpload.length > 0) {
          try {
            await dispatch(uploadExpenseReceiptsAction(expenseId, filesToUpload));
          } catch (error) {
            console.error('Error uploading receipts:', error);
            openSnackbar({
              open: true,
              message: 'Expense saved but some receipts failed to upload',
              variant: 'alert',
              alert: { color: 'warning' }
            });
          }
        }
      }

      handleCloseDialog();
      refetchExpenses();
    } catch (error) {
      console.error('Error saving expense:', error);
      openSnackbar({
        open: true,
        message: error?.response?.data?.message || 'Failed to save expense',
        variant: 'alert',
        alert: { color: 'error' }
      });
    }
  };

  const handleDelete = (expenseId) => {
    setExpenseToDelete(expenseId);
    setDeleteConfirmOpen(true);
  };

  const confirmDelete = async () => {
    if (!expenseToDelete) return;
    try {
      await dispatch(deleteExpenseAction(expenseToDelete));
      openSnackbar({
        open: true,
        message: 'Expense deleted successfully',
        variant: 'alert',
        alert: { color: 'success' }
      });
      setDeleteConfirmOpen(false);
      setExpenseToDelete(null);
      refetchExpenses();
    } catch (error) {
      console.error('Error deleting expense:', error);
      openSnackbar({
        open: true,
        message: error?.response?.data?.message || 'Failed to delete expense',
        variant: 'alert',
        alert: { color: 'error' }
      });
    }
  };

  const handleMenuOpen = (event, expense) => {
    event.stopPropagation();
    setMenuAnchor(event.currentTarget);
    setMenuExpense(expense);
  };

  const handleMenuClose = () => {
    setMenuAnchor(null);
    setMenuExpense(null);
  };

  const handlePauseResume = async () => {
    if (!menuExpense) return;

    try {
      const updatePayload = {
        ...menuExpense,
        isPaused: !menuExpense.isPaused
      };
      await dispatch(updateExpenseAction(menuExpense.id, updatePayload));
      openSnackbar({
        open: true,
        message: menuExpense.isPaused ? 'Expense resumed successfully' : 'Expense paused successfully',
        variant: 'alert',
        alert: { color: 'success' }
      });
      handleMenuClose();
      refetchExpenses();
    } catch (error) {
      console.error('Error pausing/resuming expense:', error);
      openSnackbar({
        open: true,
        message: error?.response?.data?.message || 'Failed to update expense',
        variant: 'alert',
        alert: { color: 'error' }
      });
    }
  };

  if (initialLoading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '400px' }}>
        <CircularProgress />
      </Box>
    );
  }

  return (
    <Box>
      <PageBreadcrumbs
        items={[
          { label: 'Dashboard', to: '/landlord/dashboard' },
          { label: 'Expenses', to: expensesPath },
          { label: property?.name || 'Property Expenses' }
        ]}
      />

      {/* Header */}
      <Box sx={{ 
        mb: 3, 
        display: 'flex', 
        flexDirection: { xs: 'column', sm: 'row' }, 
        justifyContent: 'space-between', 
        alignItems: { xs: 'flex-start', sm: 'center' }, 
        gap: 2,
        '@media (max-width: 912px)': {
          flexDirection: 'column',
          alignItems: 'flex-start'
        }
      }}>
        <Stack direction="row" spacing={2} alignItems="center">
          <Button
            startIcon={<ArrowLeftOutlined />}
            onClick={() => navigate('/landlord/accounting?tab=1')}
            sx={{
              color: 'text.secondary',
              textTransform: 'none',
              minWidth: 'auto',
              '&:hover': {
                bgcolor: alpha(theme.palette.primary.main, 0.08)
              }
            }}
          >
            Back
          </Button>
          <Box>
            <Typography variant="h4" fontWeight="bold" sx={{ 
              fontSize: { xs: '1.5rem', sm: '2rem' },
              '@media (max-width: 912px)': {
                fontSize: '1.5rem'
              }
            }}>
              {property?.name || 'Property Expenses'}
            </Typography>
            <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
              Expenses for this property
            </Typography>
          </Box>
        </Stack>
        <Button 
          variant="text" 
          size="small"
          startIcon={<PlusOutlined style={{ fontSize: 16 }} />} 
          onClick={() => handleOpenDialog()} 
          sx={{ 
            color: 'primary.main',
            textTransform: 'none',
            width: { xs: '100%', sm: 'auto' },
            '&:hover': {
              bgcolor: alpha(theme.palette.primary.main, 0.08)
            },
            '@media (max-width: 912px)': {
              width: '100%'
            }
          }}
        >
          Add Expense
        </Button>
      </Box>

      {/* Filters */}
      <MainCard
        sx={{
          mb: 3,
          bgcolor: (t) => alpha(t.palette.background.paper, 0.6),
          boxShadow: (t) => `0 0 20px ${alpha(t.palette.primary.main, 0.15)}`
        }}
      >
        <Stack 
          direction={{ xs: 'column', sm: 'row' }} 
          spacing={2} 
          sx={{ 
            p: 2,
            '@media (max-width: 912px)': {
              flexDirection: 'column'
            }
          }}
        >
          <TextField
            size="small"
            placeholder="Search expenses..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            InputProps={{
              startAdornment: (
                <InputAdornment position="start">
                  <SearchOutlined style={{ fontSize: 18 }} />
                </InputAdornment>
              )
            }}
            sx={{ flex: 1, minWidth: 200 }}
          />
          <FormControl size="small" sx={{ minWidth: 180 }}>
            <InputLabel>Category</InputLabel>
            <Select value={categoryFilter} onChange={(e) => setCategoryFilter(e.target.value)} label="Category">
              <MenuItem value="all">All Categories</MenuItem>
              {EXPENSE_CATEGORIES.map((cat) => (
                <MenuItem key={cat} value={cat}>
                  {cat}
                </MenuItem>
              ))}
            </Select>
          </FormControl>
          <TextField
            size="small"
            type="date"
            label="From Date"
            value={dateFrom}
            onChange={(e) => setDateFrom(e.target.value)}
            InputLabelProps={{ shrink: true }}
            sx={{ minWidth: 160 }}
          />
          <TextField
            size="small"
            type="date"
            label="To Date"
            value={dateTo}
            onChange={(e) => setDateTo(e.target.value)}
            InputLabelProps={{ shrink: true }}
            sx={{ minWidth: 160 }}
          />
        </Stack>
      </MainCard>

      {/* Expenses Table */}
      <MainCard
        sx={{
          bgcolor: (t) => alpha(t.palette.background.paper, 0.6),
          boxShadow: (t) => `0 0 20px ${alpha(t.palette.primary.main, 0.15)}`
        }}
      >
        {expensesLoading ? (
          <Box sx={{ p: 5, textAlign: 'center' }}>
            <CircularProgress />
          </Box>
        ) : filteredExpenses.length === 0 ? (
          <Box sx={{ p: 5, textAlign: 'center' }}>
            <FileTextOutlined style={{ fontSize: 64, color: 'rgba(0,0,0,0.12)' }} />
            <Typography variant="h6" color="text.secondary" sx={{ mt: 2 }}>
              {fetchedExpenses.length === 0 ? 'No expenses found' : 'No expenses match your filters'}
            </Typography>
            <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
              {fetchedExpenses.length === 0
                ? "Start tracking your property expenses by clicking 'Add Expense'"
                : 'Try adjusting your filters to see more expenses.'}
            </Typography>
          </Box>
        ) : (
          <TableContainer sx={{ overflowX: 'auto' }}>
            <Table sx={{ minWidth: 600 }}>
              <TableHead>
                <TableRow>
                  <TableCell>Date</TableCell>
                  <TableCell>Name</TableCell>
                  <TableCell>Unit</TableCell>
                  <TableCell>Amount</TableCell>
                  <TableCell>Frequency</TableCell>
                  <TableCell>Next Occurrence</TableCell>
                  <TableCell>Receipts</TableCell>
                  <TableCell>Status</TableCell>
                  <TableCell align="right">Actions</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {filteredExpenses.map((expense) => {
                  const isRecurring = expense.isRecurring;
                  const frequency = expense.frequency ? expense.frequency.charAt(0) + expense.frequency.slice(1).toLowerCase() : 'One Time';
                  const nextOccurrence = expense.nextOccurrenceDate 
                    ? new Date(expense.nextOccurrenceDate)
                    : null;
                  const daysUntil = nextOccurrence 
                    ? Math.ceil((nextOccurrence - new Date()) / (1000 * 60 * 60 * 24))
                    : null;
                  const status = isRecurring 
                    ? (expense.isPaused ? 'Paused' : 'Active')
                    : 'N/A';

                  return (
                    <TableRow key={expense.id} hover>
                      <TableCell>{formatDate(expense.expenseDate)}</TableCell>
                      <TableCell>
                        <Typography variant="body2" fontWeight={500}>
                          {expense.name || '-'}
                        </Typography>
                      </TableCell>
                      <TableCell>
                        {expense.unitName ? (
                          <Typography variant="body2">{expense.unitName}</Typography>
                        ) : (
                          <Typography variant="body2" color="text.secondary">N/A</Typography>
                        )}
                      </TableCell>
                      <TableCell>
                        <Typography variant="body2" fontWeight={500} color="error.main">
                          {formatCurrency(expense.amount)}
                        </Typography>
                      </TableCell>
                      <TableCell>
                        <Chip 
                          label={frequency} 
                          size="small" 
                          variant="outlined"
                          sx={{ textTransform: 'capitalize' }}
                        />
                      </TableCell>
                      <TableCell>
                        {isRecurring && nextOccurrence ? (
                          <Stack>
                            <Typography variant="body2">
                              {formatDate(expense.nextOccurrenceDate)}
                            </Typography>
                            <Typography variant="caption" color="text.secondary">
                              {daysUntil !== null && daysUntil >= 0 ? `In ${daysUntil} day${daysUntil !== 1 ? 's' : ''}` : 'Overdue'}
                            </Typography>
                          </Stack>
                        ) : (
                          <Typography variant="body2" color="text.secondary">N/A</Typography>
                        )}
                      </TableCell>
                      <TableCell>
                        {expense.receipts && expense.receipts.length > 0 ? (
                          <ExpenseReceiptView receipts={[expense.receipts[0]]} />
                        ) : (
                          <Typography variant="body2" color="text.secondary">-</Typography>
                        )}
                      </TableCell>
                      <TableCell>
                        <Chip 
                          label={status} 
                          size="small" 
                          color={
                            isRecurring && expense.isPaused 
                              ? 'warning' 
                              : isRecurring && !expense.isPaused 
                                ? 'success' 
                                : 'default'
                          }
                          variant={isRecurring && !expense.isPaused ? 'filled' : 'outlined'}
                        />
                      </TableCell>
                      <TableCell align="right">
                        <IconButton
                          size="small"
                          onClick={(e) => handleMenuOpen(e, expense)}
                        >
                          <MoreVertIcon />
                        </IconButton>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </TableContainer>
        )}
      </MainCard>

      {/* Add/Edit Expense Dialog */}
      <Dialog open={openDialog} onClose={handleCloseDialog} maxWidth="md" fullWidth>
        <DialogTitle>{editingExpense ? 'Edit Expense' : 'Add Expense'}</DialogTitle>
        <DialogContent>
          <Stack spacing={3} sx={{ mt: 1 }}>
            <FormControl fullWidth>
              <InputLabel>Category *</InputLabel>
              <Select
                value={expenseForm.category}
                onChange={(e) => setExpenseForm({ ...expenseForm, category: e.target.value })}
                label="Category *"
              >
                {EXPENSE_CATEGORIES.map((cat) => (
                  <MenuItem key={cat} value={cat}>
                    {cat}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>

            <TextField
              fullWidth
              label="Name *"
              value={expenseForm.name}
              onChange={(e) => setExpenseForm({ ...expenseForm, name: e.target.value })}
            />

            {selectedPropertyForExpense && unitOptionsForExpense.length > 0 && (
              <FormControl fullWidth>
                <InputLabel>Unit (Optional)</InputLabel>
                <Select
                  value={expenseForm.unitId}
                  onChange={(e) => setExpenseForm({ ...expenseForm, unitId: e.target.value })}
                  label="Unit (Optional)"
                >
                  <MenuItem value="">None</MenuItem>
                  {unitOptionsForExpense.map((unit) => (
                    <MenuItem key={unit.id} value={unit.id.toString()}>
                      {unit.label}
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>
            )}

            <NumericFormat
              customInput={TextField}
              fullWidth
              label="Amount *"
              value={expenseForm.amount}
              onValueChange={(values) => {
                setExpenseForm({ ...expenseForm, amount: values.floatValue || '' });
              }}
              thousandSeparator
              prefix="$"
              decimalScale={2}
              fixedDecimalScale
            />

            {!expenseForm.isRecurring && (
              <TextField
                fullWidth
                type="date"
                label="Expense Date *"
                value={expenseForm.expenseDate}
                onChange={(e) => setExpenseForm({ ...expenseForm, expenseDate: e.target.value })}
                InputLabelProps={{ shrink: true }}
              />
            )}

            <FormControl fullWidth>
              <InputLabel>Vendor (Optional)</InputLabel>
              <Select
                value={expenseForm.vendor || ''}
                onChange={(e) => setExpenseForm({ ...expenseForm, vendor: e.target.value })}
                label="Vendor (Optional)"
              >
                <MenuItem value="">None</MenuItem>
                {/* Add vendor options here if needed */}
              </Select>
            </FormControl>

            {!expenseForm.isRecurring && (
              <FormControl fullWidth>
                <InputLabel>Payment Method (Optional)</InputLabel>
                <Select
                  value={expenseForm.paymentMethod}
                  onChange={(e) => setExpenseForm({ ...expenseForm, paymentMethod: e.target.value })}
                  label="Payment Method (Optional)"
                >
                  <MenuItem value="">None</MenuItem>
                  {PAYMENT_METHODS.map((method) => (
                    <MenuItem key={method} value={method}>
                      {method}
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>
            )}

            <ExpenseReceiptUpload
              receipts={expenseReceipts}
              onReceiptsChange={setExpenseReceipts}
              onDeletedReceiptIdsChange={setDeletedReceiptIds}
            />

            <FormControl fullWidth>
              <InputLabel>Tax Category (Optional)</InputLabel>
              <Select
                value={expenseForm.taxCategory || ''}
                onChange={(e) => setExpenseForm({ ...expenseForm, taxCategory: e.target.value || null })}
                label="Tax Category (Optional)"
              >
                {IRS_TAX_CATEGORIES.map((taxCat) => (
                  <MenuItem key={taxCat.value || 'none'} value={taxCat.value || ''}>
                    {taxCat.label}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={handleCloseDialog}>Cancel</Button>
          <Button onClick={handleSubmit} variant="contained">
            {editingExpense ? 'Update' : 'Add'}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Action Menu */}
      <Menu
        anchorEl={menuAnchor}
        open={Boolean(menuAnchor)}
        onClose={handleMenuClose}
      >
        <MenuItem onClick={() => {
          handleMenuClose();
          if (menuExpense) handleOpenDialog(menuExpense);
        }}>
          <EditOutlined style={{ marginRight: 8 }} />
          Edit
        </MenuItem>
        {menuExpense?.isRecurring && (
          <MenuItem onClick={handlePauseResume}>
            {menuExpense.isPaused ? (
              <>
                <PlayCircleOutlined style={{ marginRight: 8 }} />
                Resume
              </>
            ) : (
              <>
                <PauseCircleOutlined style={{ marginRight: 8 }} />
                Pause
              </>
            )}
          </MenuItem>
        )}
        <MenuItem onClick={() => {
          handleMenuClose();
          if (menuExpense) handleDelete(menuExpense.id);
        }}>
          <DeleteOutlined style={{ marginRight: 8 }} />
          Delete
        </MenuItem>
      </Menu>

      {/* Delete Confirmation Dialog */}
      <ConfirmationDialog
        open={deleteConfirmOpen}
        onClose={() => setDeleteConfirmOpen(false)}
        onConfirm={confirmDelete}
        title="Delete Expense"
        message="Are you sure you want to delete this expense? This action cannot be undone."
      />
    </Box>
  );
}