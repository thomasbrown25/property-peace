import { useState, useMemo, useEffect } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import {
  Box,
  Typography,
  Stack,
  Button,
  Chip,
  alpha,
  useTheme,
  TextField,
  InputAdornment,
  Table,
  TableHead,
  TableBody,
  TableRow,
  TableCell,
  TableContainer,
  CircularProgress,
  IconButton,
  Tooltip,
  FormControl,
  Select,
  MenuItem,
  Accordion,
  AccordionSummary,
  AccordionDetails
} from '@mui/material';
import ExpenseIncomeModal from 'components/modals/ExpenseIncomeModal';
import { 
  PlusOutlined, 
  SearchOutlined,
  EditOutlined,
  DeleteOutlined,
  FallOutlined,
  CheckCircleOutlined,
  LeftOutlined,
  RightOutlined,
  PauseCircleOutlined,
  PlayCircleOutlined
} from '@ant-design/icons';
import MainCard from 'components/MainCard';
import AnimateIn from 'components/AnimateIn';
import { setProperty } from 'store/property/property.action';
import { setUnit } from 'store/unit/unit.action';
import { selectProperty } from 'store/property/property.selector';
import { selectRecurringExpenses } from 'store/recurring-expense/recurring-expense.selector';
import { selectFutureExpenses } from 'store/future-expense/future-expense.selector';
import useFetchProperties from 'hooks/useFetchProperties';
import useFetchExpenses from 'hooks/useFetchExpenses';
import useAuth from 'hooks/useAuth';
import { formatCurrency, formatDate } from 'utils/formatters';
import { updateExpenseAction, deleteExpenseAction, addExpenseAction } from 'store/expense/expense.action';
import { 
  getRecurringExpensesAction, 
  pauseRecurringExpenseAction, 
  resumeRecurringExpenseAction,
  deleteRecurringExpenseAction
} from 'store/recurring-expense/recurring-expense.action';
import { getFutureExpensesAction, deleteFutureExpenseAction } from 'store/future-expense/future-expense.action';
import { openSnackbar } from 'api/snackbar';
import ConfirmationDialog from 'components/dialogs/ConfirmationDialog';

export default function ExpensesTab({ propertyId, property }) {
  const dispatch = useDispatch();
  const theme = useTheme();
  const { user } = useAuth();
  const { properties } = useFetchProperties();
  const selectedProperty = useSelector(selectProperty);
  const recurringExpenses = useSelector(selectRecurringExpenses);
  const futureExpenses = useSelector(selectFutureExpenses);
  
  const [search, setSearch] = useState('');
  const [expenseModalOpen, setExpenseModalOpen] = useState(false);
  const [editingExpense, setEditingExpense] = useState(null);
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
  const [expenseToDelete, setExpenseToDelete] = useState(null);
  const [page, setPage] = useState(0);
  const [itemsPerPage, setItemsPerPage] = useState(10);
  const [recurringExpensesLoading, setRecurringExpensesLoading] = useState(false);
  const [recurringExpensesExpanded, setRecurringExpensesExpanded] = useState(false);
  const [futureExpensesLoading, setFutureExpensesLoading] = useState(false);

  // Fetch expenses filtered by property
  const expenseFilters = useMemo(() => ({
    propertyId: propertyId || null,
    category: null,
    startDate: null,
    endDate: null
  }), [propertyId]);

  const { expenses: allExpenses, loading, refetch } = useFetchExpenses(expenseFilters);

  // Fetch recurring expenses
  const fetchRecurringExpenses = async () => {
    if (!user?.id && !user?.Id) return;
    
    try {
      setRecurringExpensesLoading(true);
      const landlordId = user.id || user.Id;
      await dispatch(getRecurringExpensesAction(landlordId, { 
        propertyId: propertyId || null 
      }));
    } catch (error) {
      console.error('Error fetching recurring expenses:', error);
      openSnackbar({
        open: true,
        message: 'Failed to load recurring expenses',
        variant: 'alert',
        alert: { color: 'error' }
      });
    } finally {
      setRecurringExpensesLoading(false);
    }
  };

  // Fetch future expenses
  const fetchFutureExpenses = async () => {
    if (!user?.id && !user?.Id) return;
    
    try {
      setFutureExpensesLoading(true);
      const landlordId = user.id || user.Id;
      await dispatch(getFutureExpensesAction(landlordId, { 
        propertyId: propertyId || null 
      }));
    } catch (error) {
      console.error('Error fetching future expenses:', error);
      openSnackbar({
        open: true,
        message: 'Failed to load future expenses',
        variant: 'alert',
        alert: { color: 'error' }
      });
    } finally {
      setFutureExpensesLoading(false);
    }
  };

  useEffect(() => {
    fetchRecurringExpenses();
    fetchFutureExpenses();
  }, [dispatch, user?.id, user?.Id, propertyId]);

  // Filter expenses by search term
  const filteredExpenses = useMemo(() => {
    if (!allExpenses || allExpenses.length === 0) return [];
    
    let filtered = allExpenses;
    
    if (search) {
      const searchLower = search.toLowerCase();
      filtered = filtered.filter(expense => 
        expense.name?.toLowerCase().includes(searchLower) ||
        expense.category?.toLowerCase().includes(searchLower) ||
        expense.vendor?.toLowerCase().includes(searchLower)
      );
    }
    
    return filtered.sort((a, b) => {
      const dateA = new Date(a.expenseDate || 0);
      const dateB = new Date(b.expenseDate || 0);
      return dateB - dateA;
    });
  }, [allExpenses, search]);

  // Pagination calculations
  const totalPages = Math.ceil(filteredExpenses.length / itemsPerPage);
  const paginatedExpenses = useMemo(() => {
    const startIndex = page * itemsPerPage;
    const endIndex = startIndex + itemsPerPage;
    return filteredExpenses.slice(startIndex, endIndex);
  }, [filteredExpenses, page, itemsPerPage]);

  // Reset to first page when items per page changes
  useEffect(() => {
    setPage(0);
  }, [itemsPerPage]);

  const handlePageChange = (newPage) => {
    setPage(newPage);
  };

  const handleAddExpense = () => {
    if (property) {
      dispatch(setProperty(property));
    }
    setEditingExpense(null);
    setExpenseModalOpen(true);
  };

  const handleEditExpense = (expense) => {
    const property = properties?.find(p => p.id === expense.propertyId);
    if (property) {
      dispatch(setProperty(property));
    }
    
    if (expense.unitId && property) {
      const unit = property.units?.find(u => u.id === expense.unitId);
      if (unit) {
        dispatch(setUnit(unit));
      }
    } else {
      dispatch(setUnit(null));
    }
    
    setEditingExpense(expense);
    setExpenseModalOpen(true);
  };

  const handleMarkAsPaid = async (expense) => {
    try {
      const now = new Date();
      const updatePayload = {
        id: expense.id,
        propertyId: expense.propertyId,
        unitId: expense.unitId || null,
        name: expense.name || '',
        category: expense.category || '',
        amount: expense.amount || 0,
        expenseDate: expense.expenseDate,
        vendor: expense.vendor || null,
        vendorId: expense.vendorId || null,
        paymentMethod: expense.paymentMethod || null,
        receiptUrl: expense.receiptUrl || null,
        isRecurring: expense.isRecurring || false,
        isTaxDeductible: expense.isTaxDeductible || false,
        taxCategory: expense.taxCategory || null,
        maintenanceRequestId: expense.maintenanceRequestId || null,
        frequency: expense.frequency || null,
        dayOfPeriod: expense.dayOfPeriod || null,
        startDate: expense.startDate || null,
        endDate: expense.endDate || null,
        isPaused: expense.isPaused || false,
        isPaid: true,
        paidDate: now.toISOString()
      };

      await dispatch(updateExpenseAction(Number(expense.id), updatePayload));
      openSnackbar({
        open: true,
        message: 'Expense marked as paid',
        variant: 'alert',
        alert: { color: 'success' }
      });
      refetch();
    } catch (error) {
      console.error('Error marking expense as paid:', error);
      openSnackbar({
        open: true,
        message: error?.response?.data?.message || 'Failed to mark expense as paid',
        variant: 'alert',
        alert: { color: 'error' }
      });
    }
  };

  const handleDelete = (expense) => {
    setExpenseToDelete(expense.id);
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
      refetch();
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

  const totalExpenses = useMemo(() => {
    return filteredExpenses.reduce((sum, expense) => sum + (parseFloat(expense.amount) || 0), 0);
  }, [filteredExpenses]);

  if (loading) {
    return (
      <MainCard
        sx={{
          p: 6,
          textAlign: 'center',
          bgcolor: (t) => alpha(t.palette.background.paper, 0.6)
        }}
      >
        <CircularProgress />
      </MainCard>
    );
  }

  return (
    <Box>
      {/* Header with Add Button */}
      <AnimateIn direction="bottom" delay={100} distance={120}>
        <MainCard
          sx={{
            mb: 3,
            bgcolor: (t) => alpha(t.palette.background.paper, 0.8),
            boxShadow: (t) => `0 4px 20px ${alpha(t.palette.primary.main, 0.15)}`
          }}
        >
          <Stack direction="row" justifyContent="space-between" alignItems="center" flexWrap="wrap" gap={2}>
            <Box>
              <Typography variant="h5" fontWeight={700} sx={{ mb: 0.5 }}>
                Expenses
              </Typography>
            </Box>
            <Button
              variant="contained"
              startIcon={<PlusOutlined />}
              onClick={handleAddExpense}
              sx={{
                textTransform: 'none',
                fontWeight: 600,
                px: 3
              }}
            >
              Add Expense
            </Button>
          </Stack>
        </MainCard>
      </AnimateIn>

      {/* Summary Card - Only show when there are expenses */}
      {allExpenses && allExpenses.length > 0 && (
        <AnimateIn direction="bottom" delay={200} distance={120}>
          <MainCard
            sx={{
              mb: 3,
              bgcolor: (t) => alpha(t.palette.background.paper, 0.6),
              boxShadow: (t) => `0 0 20px ${alpha(t.palette.primary.main, 0.15)}`
            }}
          >
            <Stack direction="row" spacing={3} alignItems="center" flexWrap="wrap">
              <Box>
                <Typography variant="body2" color="text.secondary" gutterBottom>
                  Total Expenses
                </Typography>
                <Stack direction="row" spacing={1} alignItems="center">
                  <FallOutlined style={{ fontSize: 20, color: theme.palette.error.main }} />
                  <Typography variant="h4" fontWeight={700} color="error.main">
                    {formatCurrency(totalExpenses)}
                  </Typography>
                </Stack>
              </Box>
              <Box>
                <Typography variant="body2" color="text.secondary" gutterBottom>
                  Total Records
                </Typography>
                <Typography variant="h5" fontWeight={600}>
                  {filteredExpenses.length}
                </Typography>
              </Box>
            </Stack>
          </MainCard>
        </AnimateIn>
      )}

      {/* Expenses Table */}
      <AnimateIn direction="bottom" delay={300} distance={120}>
        <MainCard
          sx={{
            bgcolor: (t) => alpha(t.palette.background.paper, 0.6),
            boxShadow: (t) => `0 0 20px ${alpha(t.palette.primary.main, 0.15)}`
          }}
        >
          <Box sx={{ mb: 2 }}>
            <TextField
              size="small"
              placeholder="Search expenses..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              InputProps={{
                startAdornment: (
                  <InputAdornment position="start">
                    <SearchOutlined style={{ fontSize: 18 }} />
                  </InputAdornment>
                )
              }}
              sx={{ width: 300 }}
            />
          </Box>

          {filteredExpenses.length === 0 ? (
            <Box sx={{ p: 5, textAlign: 'center' }}>
              {allExpenses && allExpenses.length === 0 ? (
                // Empty state when there are no expenses at all
                <>
                  <Typography variant="body1" color="text.secondary" sx={{ mb: 2 }}>
                    No expenses recorded yet.
                  </Typography>
                  <Button
                    variant="outlined"
                    onClick={handleAddExpense}
                    sx={{ textTransform: 'none' }}
                  >
                    Add Expense
                  </Button>
                </>
              ) : (
                // Empty state when search/filter returns no results
                <>
                  <FallOutlined style={{ fontSize: 64, color: theme.palette.text.secondary, opacity: 0.3, marginBottom: 2 }} />
                  <Typography variant="h6" color="text.secondary" sx={{ mt: 2 }}>
                    No expenses found
                  </Typography>
                  <Typography variant="body2" color="text.secondary" sx={{ mt: 1, mb: 3 }}>
                    Try adjusting your search terms
                  </Typography>
                </>
              )}
            </Box>
          ) : (
            <>
              <TableContainer>
                <Table>
                  <TableHead>
                    <TableRow>
                      <TableCell>Date</TableCell>
                      <TableCell>Name</TableCell>
                      <TableCell>Category</TableCell>
                      <TableCell>Unit</TableCell>
                      <TableCell>Status</TableCell>
                      <TableCell align="right">Amount</TableCell>
                      <TableCell align="center">Actions</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {paginatedExpenses.map((expense) => (
                    <TableRow 
                      key={expense.id} 
                      hover
                      sx={{
                        '&:hover': {
                          bgcolor: alpha(theme.palette.primary.main, 0.04)
                        }
                      }}
                    >
                      <TableCell>
                        <Typography variant="body2" fontWeight={500}>
                          {formatDate(expense.expenseDate)}
                        </Typography>
                      </TableCell>
                      <TableCell>
                        <Typography variant="body2" fontWeight={500}>
                          {expense.name || '-'}
                        </Typography>
                        {expense.vendor && (
                          <Typography variant="caption" color="text.secondary">
                            {expense.vendor}
                          </Typography>
                        )}
                      </TableCell>
                      <TableCell>
                        <Chip
                          label={expense.category || 'Other'}
                          size="small"
                          variant="outlined"
                          sx={{ fontWeight: 500 }}
                        />
                      </TableCell>
                      <TableCell>
                        <Typography variant="body2" color="text.secondary">
                          {expense.unitName || 'N/A'}
                        </Typography>
                      </TableCell>
                      <TableCell>
                        <Chip
                          label={expense.isPaid ? 'Paid' : 'Unpaid'}
                          size="small"
                          color={expense.isPaid ? 'success' : 'warning'}
                          variant={expense.isPaid ? 'filled' : 'outlined'}
                        />
                      </TableCell>
                      <TableCell align="right">
                        <Typography 
                          variant="body2" 
                          fontWeight={600} 
                          color="error.main"
                        >
                          -{formatCurrency(expense.amount || 0)}
                        </Typography>
                      </TableCell>
                      <TableCell align="center">
                        <Stack direction="row" spacing={1} justifyContent="center">
                          {!expense.isPaid && (
                            <Tooltip title="Mark as Paid">
                              <IconButton
                                size="small"
                                color="success"
                                onClick={() => handleMarkAsPaid(expense)}
                              >
                                <CheckCircleOutlined style={{ fontSize: 16 }} />
                              </IconButton>
                            </Tooltip>
                          )}
                          <Tooltip title="Edit Expense">
                            <IconButton
                              size="small"
                              onClick={() => handleEditExpense(expense)}
                            >
                              <EditOutlined style={{ fontSize: 16 }} />
                            </IconButton>
                          </Tooltip>
                          <Tooltip title="Delete Expense">
                            <IconButton
                              size="small"
                              color="error"
                              onClick={() => handleDelete(expense)}
                            >
                              <DeleteOutlined style={{ fontSize: 16 }} />
                            </IconButton>
                          </Tooltip>
                        </Stack>
                      </TableCell>
                    </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </TableContainer>

              {/* Pagination */}
              {filteredExpenses.length > 0 && (
                <Box
                  sx={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    mt: 3,
                    pt: 2,
                    borderTop: `1px solid ${alpha(theme.palette.divider, 0.1)}`
                  }}
                >
                  {/* Items per page dropdown */}
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                    <Typography variant="body2" color="text.secondary">
                      Items per page:
                    </Typography>
                    <FormControl size="small" sx={{ minWidth: 80 }}>
                      <Select
                        value={itemsPerPage}
                        onChange={(e) => setItemsPerPage(Number(e.target.value))}
                        sx={{ height: 32 }}
                      >
                        <MenuItem value={10}>10</MenuItem>
                        <MenuItem value={20}>20</MenuItem>
                        <MenuItem value={50}>50</MenuItem>
                      </Select>
                    </FormControl>
                  </Box>

                  {/* Page navigation */}
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                    <Typography variant="body2" color="text.secondary">
                      Page {page + 1} of {totalPages}
                    </Typography>
                    <Box sx={{ display: 'flex', gap: 1 }}>
                      <Button
                        size="small"
                        variant="outlined"
                        startIcon={<LeftOutlined />}
                        onClick={() => handlePageChange(Math.max(0, page - 1))}
                        disabled={page === 0}
                        sx={{ minWidth: 100 }}
                      >
                        Previous
                      </Button>
                      <Button
                        size="small"
                        variant="outlined"
                        endIcon={<RightOutlined />}
                        onClick={() => handlePageChange(Math.min(totalPages - 1, page + 1))}
                        disabled={page >= totalPages - 1}
                        sx={{ minWidth: 100 }}
                      >
                        Next
                      </Button>
                    </Box>
                  </Box>
                </Box>
              )}
            </>
          )}
        </MainCard>
      </AnimateIn>

      {/* Future & Recurring Expenses Section */}
      <AnimateIn direction="bottom" delay={400} distance={120}>
        <MainCard
          sx={{
            mt: 3,
            bgcolor: (t) => alpha(t.palette.background.paper, 0.6),
            boxShadow: (t) => `0 0 20px ${alpha(t.palette.primary.main, 0.15)}`
          }}
        >
          <Accordion 
            expanded={recurringExpensesExpanded} 
            onChange={(e, expanded) => setRecurringExpensesExpanded(expanded)}
            sx={{
              boxShadow: 'none',
              '&:before': { display: 'none' },
              border: `1px solid ${alpha(theme.palette.divider, 0.1)}`,
              borderRadius: 2
            }}
          >
            <AccordionSummary
              sx={{
                borderRadius: recurringExpensesExpanded ? '8px 8px 0 0' : '8px',
                '&:hover': {
                  bgcolor: alpha(theme.palette.primary.main, 0.04)
                }
              }}
            >
              <Stack direction="row" spacing={2} alignItems="center" sx={{ width: '100%' }}>
                <Typography variant="h6" sx={{ fontFamily: "'Poppins', sans-serif", fontWeight: 600 }}>
                  Future & Recurring Expenses
                </Typography>
                <Chip 
                  label={recurringExpenses.length + futureExpenses.length} 
                  size="small" 
                  color="primary"
                  sx={{ fontWeight: 600 }}
                />
              </Stack>
            </AccordionSummary>
            <AccordionDetails sx={{ pt: 3 }}>
              {(recurringExpensesLoading || futureExpensesLoading) ? (
                <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: 200 }}>
                  <CircularProgress />
                </Box>
              ) : (recurringExpenses.length === 0 && futureExpenses.length === 0) ? (
                <Box sx={{ p: 5, textAlign: 'center' }}>
                  <Typography variant="h6" color="text.secondary" sx={{ mt: 2 }}>
                    No future or recurring expenses found
                  </Typography>
                  <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
                    Create recurring expenses or expenses with future dates to see them here.
                  </Typography>
                </Box>
              ) : (
                <TableContainer>
                  <Table>
                    <TableHead>
                      <TableRow>
                        <TableCell>Name</TableCell>
                        <TableCell>Category</TableCell>
                        <TableCell>Amount</TableCell>
                        <TableCell>Frequency</TableCell>
                        <TableCell>Next Due Date</TableCell>
                        <TableCell>Status</TableCell>
                        <TableCell align="center">Actions</TableCell>
                      </TableRow>
                    </TableHead>
                    <TableBody>
                      {/* Recurring Expenses */}
                      {recurringExpenses.map((recurring) => {
                        const frequency = recurring.frequency 
                          ? recurring.frequency.charAt(0) + recurring.frequency.slice(1).toLowerCase()
                          : 'N/A';
                        const nextDueDate = recurring.nextOccurrenceDate 
                          ? formatDate(recurring.nextOccurrenceDate)
                          : 'N/A';
                        const status = recurring.isPaused ? 'Paused' : 'Active';

                        return (
                          <TableRow key={`recurring-${recurring.id}`} hover>
                            <TableCell>
                              <Typography variant="body2" fontWeight={500}>
                                {recurring.name || '-'}
                              </Typography>
                            </TableCell>
                            <TableCell>{recurring.category || '-'}</TableCell>
                            <TableCell>
                              <Typography variant="body2" fontWeight={500} color="error.main">
                                {formatCurrency(recurring.amount)}
                              </Typography>
                            </TableCell>
                            <TableCell>{frequency}</TableCell>
                            <TableCell>{nextDueDate}</TableCell>
                            <TableCell>
                              <Chip
                                label={status}
                                size="small"
                                color={recurring.isPaused ? 'warning' : 'success'}
                                variant={recurring.isPaused ? 'outlined' : 'filled'}
                              />
                            </TableCell>
                            <TableCell align="center">
                              <Stack direction="row" spacing={1} justifyContent="center">
                                <Tooltip title="Mark as Paid">
                                  <IconButton
                                    size="small"
                                    color="success"
                                    onClick={async () => {
                                      try {
                                        const now = new Date();
                                        const todayDateString = now.toISOString().split('T')[0];
                                        const expensePayload = {
                                          landlordId: user.id || user.Id,
                                          propertyId: recurring.propertyId,
                                          unitId: recurring.unitId || null,
                                          name: recurring.name,
                                          category: recurring.category,
                                          amount: recurring.amount,
                                          expenseDate: todayDateString,
                                          vendor: recurring.vendor || null,
                                          vendorId: null,
                                          paymentMethod: recurring.paymentMethod || null,
                                          receiptUrl: null,
                                          isRecurring: true,
                                          isTaxDeductible: recurring.isTaxDeductible || false,
                                          taxCategory: null,
                                          maintenanceRequestId: recurring.maintenanceRequestId || null,
                                          frequency: recurring.frequency,
                                          dayOfPeriod: recurring.dayOfPeriod,
                                          startDate: recurring.startDate,
                                          endDate: recurring.endDate || null,
                                          isPaused: false,
                                          dueDate: todayDateString,
                                          billDate: todayDateString,
                                          isPaid: true,
                                          paidDate: now.toISOString()
                                        };
                                        
                                        await dispatch(addExpenseAction(expensePayload));
                                        openSnackbar({
                                          open: true,
                                          message: 'Expense marked as paid and added to expenses',
                                          variant: 'alert',
                                          alert: { color: 'success' }
                                        });
                                        setTimeout(() => {
                                          refetch();
                                        }, 1000);
                                      } catch (error) {
                                        console.error('Error marking recurring expense as paid:', error);
                                        openSnackbar({
                                          open: true,
                                          message: 'Failed to mark expense as paid',
                                          variant: 'alert',
                                          alert: { color: 'error' }
                                        });
                                      }
                                    }}
                                  >
                                    <CheckCircleOutlined style={{ fontSize: 18 }} />
                                  </IconButton>
                                </Tooltip>
                                <Tooltip title={recurring.isPaused ? 'Resume' : 'Pause'}>
                                  <IconButton
                                    size="small"
                                    onClick={async () => {
                                      try {
                                        if (recurring.isPaused) {
                                          await dispatch(resumeRecurringExpenseAction(recurring.id));
                                          openSnackbar({
                                            open: true,
                                            message: 'Recurring expense resumed',
                                            variant: 'alert',
                                            alert: { color: 'success' }
                                          });
                                        } else {
                                          await dispatch(pauseRecurringExpenseAction(recurring.id));
                                          openSnackbar({
                                            open: true,
                                            message: 'Recurring expense paused',
                                            variant: 'alert',
                                            alert: { color: 'warning' }
                                          });
                                        }
                                        const landlordId = user.id || user.Id;
                                        await dispatch(getRecurringExpensesAction(landlordId, { 
                                          propertyId: propertyId || null 
                                        }));
                                        setRecurringExpensesLoading(false);
                                      } catch (error) {
                                        console.error('Error toggling recurring expense:', error);
                                        openSnackbar({
                                          open: true,
                                          message: 'Failed to update recurring expense',
                                          variant: 'alert',
                                          alert: { color: 'error' }
                                        });
                                      }
                                    }}
                                  >
                                    {recurring.isPaused ? (
                                      <PlayCircleOutlined style={{ fontSize: 18 }} />
                                    ) : (
                                      <PauseCircleOutlined style={{ fontSize: 18 }} />
                                    )}
                                  </IconButton>
                                </Tooltip>
                                <Tooltip title="Delete">
                                  <IconButton
                                    size="small"
                                    color="error"
                                    onClick={async () => {
                                      if (window.confirm('Are you sure you want to delete this recurring expense? This will not delete existing expense instances.')) {
                                        try {
                                          await dispatch(deleteRecurringExpenseAction(recurring.id));
                                          openSnackbar({
                                            open: true,
                                            message: 'Recurring expense deleted',
                                            variant: 'alert',
                                            alert: { color: 'success' }
                                          });
                                          const landlordId = user.id || user.Id;
                                          await dispatch(getRecurringExpensesAction(landlordId, { 
                                            propertyId: propertyId || null 
                                          }));
                                          setRecurringExpensesLoading(false);
                                        } catch (error) {
                                          console.error('Error deleting recurring expense:', error);
                                          openSnackbar({
                                            open: true,
                                            message: 'Failed to delete recurring expense',
                                            variant: 'alert',
                                            alert: { color: 'error' }
                                          });
                                        }
                                      }
                                    }}
                                  >
                                    <DeleteOutlined style={{ fontSize: 18 }} />
                                  </IconButton>
                                </Tooltip>
                              </Stack>
                            </TableCell>
                          </TableRow>
                        );
                      })}
                      {/* Future Expenses */}
                      {futureExpenses.map((future) => (
                        <TableRow key={`future-${future.id}`} hover>
                          <TableCell>
                            <Typography variant="body2" fontWeight={500}>
                              {future.name || '-'}
                            </Typography>
                          </TableCell>
                          <TableCell>{future.category || '-'}</TableCell>
                          <TableCell>
                            <Typography variant="body2" fontWeight={500} color="error.main">
                              {formatCurrency(future.amount)}
                            </Typography>
                          </TableCell>
                          <TableCell>
                            <Chip label="One-time" size="small" variant="outlined" />
                          </TableCell>
                          <TableCell>{formatDate(future.dueDate)}</TableCell>
                          <TableCell>
                            <Chip
                              label="Upcoming"
                              size="small"
                              color="info"
                              variant="filled"
                            />
                          </TableCell>
                          <TableCell align="center">
                            <Stack direction="row" spacing={1} justifyContent="center">
                              <Tooltip title="Mark as Paid">
                                <IconButton
                                  size="small"
                                  color="success"
                                  onClick={async () => {
                                    try {
                                      const now = new Date();
                                      const expensePayload = {
                                        landlordId: user.id || user.Id,
                                        propertyId: future.propertyId,
                                        unitId: future.unitId || null,
                                        name: future.name,
                                        category: future.category,
                                        amount: future.amount,
                                        expenseDate: future.dueDate,
                                        vendor: future.vendor || null,
                                        vendorId: future.vendorId || null,
                                        paymentMethod: future.paymentMethod || null,
                                        receiptUrl: null,
                                        isRecurring: false,
                                        isTaxDeductible: future.isTaxDeductible || false,
                                        taxCategory: null,
                                        maintenanceRequestId: future.maintenanceRequestId || null,
                                        frequency: null,
                                        dayOfPeriod: null,
                                        startDate: null,
                                        endDate: null,
                                        isPaused: false,
                                        dueDate: future.dueDate,
                                        billDate: future.dueDate,
                                        isPaid: true,
                                        paidDate: now.toISOString()
                                      };

                                      await dispatch(addExpenseAction(expensePayload));
                                      await dispatch(deleteFutureExpenseAction(future.id));
                                      openSnackbar({
                                        open: true,
                                        message: 'Expense marked as paid and added to expenses',
                                        variant: 'alert',
                                        alert: { color: 'success' }
                                      });
                                      setTimeout(() => {
                                        refetch();
                                        fetchFutureExpenses();
                                      }, 500);
                                    } catch (error) {
                                      console.error('Error marking future expense as paid:', error);
                                      openSnackbar({
                                        open: true,
                                        message: 'Failed to mark expense as paid',
                                        variant: 'alert',
                                        alert: { color: 'error' }
                                      });
                                    }
                                  }}
                                >
                                  <CheckCircleOutlined style={{ fontSize: 18 }} />
                                </IconButton>
                              </Tooltip>
                            </Stack>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </TableContainer>
              )}
            </AccordionDetails>
          </Accordion>
        </MainCard>
      </AnimateIn>

      {/* Expense Modal */}
      <ExpenseIncomeModal
        open={expenseModalOpen}
        onClose={() => {
          setExpenseModalOpen(false);
          setEditingExpense(null);
        }}
        type="expense"
        onSuccess={() => {
          refetch();
          setExpenseModalOpen(false);
          setEditingExpense(null);
        }}
        initialPropertyId={propertyId}
        editingExpense={editingExpense}
      />

      {/* Delete Confirmation Dialog */}
      <ConfirmationDialog
        open={deleteConfirmOpen}
        onClose={() => {
          setDeleteConfirmOpen(false);
          setExpenseToDelete(null);
        }}
        onConfirm={confirmDelete}
        title="Delete Expense"
        message="Are you sure you want to delete this expense? This action cannot be undone."
        confirmText="Delete"
        cancelText="Cancel"
        confirmColor="error"
      />
    </Box>
  );
}
