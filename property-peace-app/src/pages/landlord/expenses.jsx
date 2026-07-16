import { useState, useMemo, useEffect, useRef } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { useDashboardLoading } from 'contexts/DashboardLoadingContext';
import { useSearchParams, useLocation } from 'react-router-dom';
import { CSVLink } from 'react-csv';
import {
  Box,
  Typography,
  Stack,
  Button,
  FormControl,
  Select,
  MenuItem,
  Chip,
  alpha,
  useTheme,
  useMediaQuery,
  TextField,
  InputLabel,
  Table,
  TableHead,
  TableBody,
  TableRow,
  TableCell,
  TableContainer,
  CircularProgress,
  InputAdornment,
  OutlinedInput,
  Tabs,
  Tab,
  IconButton,
  Tooltip,
  Card,
  CardContent
} from '@mui/material';
import ExpenseAddDrawer from 'components/expense/ExpenseAddDrawer';
import ExpenseEditDrawer from 'components/expense/ExpenseEditDrawer';
import {
  PlusOutlined,
  DownloadOutlined,
  SearchOutlined,
  EditOutlined,
  DeleteOutlined,
  PauseCircleOutlined,
  PlayCircleOutlined,
  CheckCircleOutlined,
  LeftOutlined,
  RightOutlined
} from '@ant-design/icons';
import MainCard from 'components/MainCard';
import { LandlordKpiCard } from 'components/landlord/PagePrimitives';
import AnimateIn from 'components/AnimateIn';
import PropertySelect from 'components/PropertySelect';
import { setProperty } from 'store/property/property.action';
import { setUnit } from 'store/unit/unit.action';
import { selectProperty } from 'store/property/property.selector';
import { selectRecurringExpenses } from 'store/recurring-expense/recurring-expense.selector';
import { selectFutureExpenses } from 'store/future-expense/future-expense.selector';
import { getFutureExpensesAction, deleteFutureExpenseAction } from 'store/future-expense/future-expense.action';
import useFetchProperties from 'hooks/useFetchProperties';
import useFetchExpenses from 'hooks/useFetchExpenses';
import useAuth from 'hooks/useAuth';
import { formatCurrency, formatDate } from 'utils/formatters';
import axiosServices from 'utils/axios';
import { 
  getRecurringExpensesAction, 
  pauseRecurringExpenseAction, 
  resumeRecurringExpenseAction,
  deleteRecurringExpenseAction
} from 'store/recurring-expense/recurring-expense.action';
import { addExpenseAction, updateExpenseAction, deleteExpenseAction } from 'store/expense/expense.action';
import { openSnackbar } from 'api/snackbar';
import ConfirmationDialog from 'components/dialogs/ConfirmationDialog';
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

export default function Expenses() {
  const dispatch = useDispatch();
  const [searchParams] = useSearchParams();
  const location = useLocation();
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('sm'));
  const { user } = useAuth();
  const { properties, propertiesRefetch, isLoading: propertiesLoading } = useFetchProperties();
  const selectedProperty = useSelector(selectProperty);
  const recurringExpenses = useSelector(selectRecurringExpenses);
  const futureExpenses = useSelector(selectFutureExpenses);
  const previousPathname = useRef(null);
  const hasClearedProperty = useRef(false);
  
  // Get propertyId and type from URL params (when coming from other pages)
  const propertyIdFromUrl = searchParams.get('propertyId');
  const typeFromUrl = searchParams.get('type'); // 'expenses' or 'income'
  
  // Filter states
  const [filters, setFilters] = useState({
    status: 'Active',
    category: null
  });
  const [activeTab, setActiveTab] = useState(0);
  const [search, setSearch] = useState('');
  const [recurringSearch, setRecurringSearch] = useState('');
  const [addExpenseDrawerOpen, setAddExpenseDrawerOpen] = useState(false);
  const [expenseModalOpen, setExpenseModalOpen] = useState(false);
  const [editingExpense, setEditingExpense] = useState(null);
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
  const [expenseToDelete, setExpenseToDelete] = useState(null);
  

  // Recurring expenses state
  const [recurringExpensesLoading, setRecurringExpensesLoading] = useState(false);
  
  // Future expenses state
  const [futureExpensesLoading, setFutureExpensesLoading] = useState(false);

  // Date filter state - default to last 5 years
  const [timespanFilter, setTimespanFilter] = useState(() => {
    const now = new Date();
    // Calculate start of 5 years ago
    const fiveYearsAgoStart = new Date(now.getFullYear() - 5, now.getMonth(), now.getDate());
    fiveYearsAgoStart.setHours(0, 0, 0, 0);
    return {
      timespan: 'custom',
      dateFrom: fiveYearsAgoStart,
      dateTo: now
    };
  });
  const [dateFrom, setDateFrom] = useState(() => {
    // Calculate start of 5 years ago
    const now = new Date();
    const fiveYearsAgoStart = new Date(now.getFullYear() - 5, now.getMonth(), now.getDate());
    return fiveYearsAgoStart.toISOString().split('T')[0];
  });
  const [dateTo, setDateTo] = useState(() => {
    return new Date().toISOString().split('T')[0];
  });
  const [page, setPage] = useState(0);
  const [itemsPerPage, setItemsPerPage] = useState(10);

  const formatDate = (date) => {
    if (!date) return '';
    const d = date instanceof Date ? date : new Date(date);
    return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  };

  const handleTimespanChange = (timespanData) => {
    setTimespanFilter(timespanData);
    if (timespanData.dateFrom) {
      setDateFrom(timespanData.dateFrom.toISOString().split('T')[0]);
    }
    if (timespanData.dateTo) {
      setDateTo(timespanData.dateTo.toISOString().split('T')[0]);
    }
  };

  // Clear property selection when navigating to this page, unless there's a propertyId in URL
  useEffect(() => {
    const isOnThisPage = location.pathname === '/landlord/expenses';
    const justNavigatedToPage = previousPathname.current !== null && previousPathname.current !== location.pathname && isOnThisPage;
    const isInitialMount = previousPathname.current === null && isOnThisPage;
    const justNavigatedAway = previousPathname.current === '/landlord/expenses' && !isOnThisPage;
    
    // Clear property when navigating to this page (initial mount or route change) and no propertyId in URL
    if ((isInitialMount || justNavigatedToPage) && !propertyIdFromUrl && !hasClearedProperty.current) {
      dispatch(setProperty(null));
      hasClearedProperty.current = true;
    }
    
    // Clear property when navigating away from this page
    if (justNavigatedAway && selectedProperty) {
      dispatch(setProperty(null));
    }
    
    // Reset the flag if we navigate away
    if (!isOnThisPage) {
      hasClearedProperty.current = false;
    }
    
    // Update previous pathname
    previousPathname.current = location.pathname;
  }, [location.pathname, propertyIdFromUrl, dispatch, selectedProperty]);

  // Set property from URL param if provided
  useEffect(() => {
    if (propertyIdFromUrl && properties) {
      const property = properties.find(p => p.id === Number(propertyIdFromUrl));
      if (property) {
        dispatch(setProperty(property));
      }
    }
  }, [propertyIdFromUrl, properties, dispatch]);


  // Fetch expenses with filters
  const expenseFilters = useMemo(() => ({
    propertyId: selectedProperty?.id || null,
    category: filters.category || null,
    startDate: dateFrom || null,
    endDate: dateTo || null
  }), [selectedProperty, filters.category, dateFrom, dateTo]);

  const { expenses: allExpenses, loading: expensesLoading, refetch: refetchExpenses } = useFetchExpenses(expenseFilters);
  const [payments, setPayments] = useState([]);
  const [paymentsLoading, setPaymentsLoading] = useState(false);
  
  // Get context to update expenses page loading state
  const { setExpensesLoading } = useDashboardLoading();

  // Fetch payments (for potential income display if needed)
  useEffect(() => {
    const fetchPayments = async () => {
      try {
        setPaymentsLoading(true);
        const params = new URLSearchParams();
        if (selectedProperty?.id) {
          params.append('propertyId', selectedProperty.id);
        }
        
        const response = await axiosServices.get(`/api/payment/all?${params.toString()}`);
        const paymentsData = response.data?.data || response.data || [];
        setPayments(Array.isArray(paymentsData) ? paymentsData : []);
      } catch (error) {
        console.error('Error fetching payments:', error);
        setPayments([]);
      } finally {
        setPaymentsLoading(false);
      }
    };

    fetchPayments();
  }, [selectedProperty?.id]);

  // Fetch recurring expenses
  const fetchRecurringExpenses = async () => {
    if (!user?.id && !user?.Id) return;
    
    try {
      setRecurringExpensesLoading(true);
      const landlordId = user.id || user.Id;
      await dispatch(getRecurringExpensesAction(landlordId, { 
        propertyId: selectedProperty?.id || null 
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
        propertyId: selectedProperty?.id || null 
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
  }, [dispatch, user?.id, user?.Id, selectedProperty?.id]);

  // Refresh recurring expenses when returning to the page (e.g., after creating one)
  const previousLocation = useRef(location.pathname);
  useEffect(() => {
    if (previousLocation.current !== location.pathname) {
      // Only refresh if we're on the expenses page and came from a different page
      if (location.pathname === '/landlord/expenses' || location.pathname.includes('/expenses')) {
        fetchRecurringExpenses();
      }
      previousLocation.current = location.pathname;
    }
  }, [location.pathname]);

  // Refresh when window regains focus (user might have created a recurring expense in another tab/window)
  useEffect(() => {
    const handleFocus = () => {
      if (location.pathname === '/landlord/expenses' || location.pathname.includes('/expenses')) {
        fetchRecurringExpenses();
      }
    };

    window.addEventListener('focus', handleFocus);
    return () => window.removeEventListener('focus', handleFocus);
  }, [location.pathname]);

  // Filter payments and expenses by date range
  const filteredPayments = useMemo(() => {
    let filtered = payments || [];

    if (dateFrom) {
      const startDate = new Date(dateFrom);
      filtered = filtered.filter((payment) => {
        const paymentDate = new Date(payment.paymentDate);
        return paymentDate >= startDate;
      });
    }

    if (dateTo) {
      const endDate = new Date(dateTo);
      endDate.setHours(23, 59, 59, 999);
      filtered = filtered.filter((payment) => {
        const paymentDate = new Date(payment.paymentDate);
        return paymentDate <= endDate;
      });
    }

    return filtered;
  }, [payments, dateFrom, dateTo]);

  const filteredExpenses = useMemo(() => {
    let filtered = allExpenses || [];

    console.log('=== EXPENSE FILTERING DEBUG ===');
    console.log('Total expenses:', allExpenses?.length || 0);
    console.log('dateFrom:', dateFrom);
    console.log('dateTo:', dateTo);

    // Note: We now show ALL expenses in the expenses table regardless of isRecurring flag
    // Recurring templates are shown in a separate "Recurring Expenses" section
    // The status filter only applies to the recurring templates section, not the expenses table
    // So we don't filter by status here - all expenses should be visible

    if (dateFrom || dateTo) {
      // Normalize dates to start of day for comparison
      const startDate = dateFrom ? new Date(dateFrom) : null;
      if (startDate) {
        startDate.setHours(0, 0, 0, 0);
      }

      const endDate = dateTo ? new Date(dateTo) : null;
      let endDateForComparison = null;
      if (endDate) {
        // Normalize endDate to start of day for comparison
        // We want to include expenses on the endDate, so we check if dateToCheck > endDate
        // To do this, we add 1 day to endDate and check if dateToCheck >= endDate+1
        // Parse the date string to get year, month, day to avoid timezone issues
        const endDateParts = dateTo.split('-');
        const endYear = parseInt(endDateParts[0], 10);
        const endMonth = parseInt(endDateParts[1], 10) - 1; // Month is 0-indexed
        const endDay = parseInt(endDateParts[2], 10);
        
        // Create endDateForComparison as the day after endDate in local timezone
        endDateForComparison = new Date(endYear, endMonth, endDay + 1);
        endDateForComparison.setHours(0, 0, 0, 0);
        
        console.log('  endDate calculation:');
        console.log('    endDate input:', dateTo);
        console.log('    endDate parts:', { year: endYear, month: endMonth + 1, day: endDay });
        console.log('    endDateForComparison (endDate + 1 day):', endDateForComparison.toISOString());
      }

      // For paid expenses, we want to show dates starting from tomorrow
      // Calculate tomorrow's date in local timezone
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const tomorrow = new Date(today);
      tomorrow.setDate(tomorrow.getDate() + 1);

      console.log('Date calculations:');
      console.log('  today:', today.toISOString());
      console.log('  tomorrow:', tomorrow.toISOString());
      console.log('  startDate:', startDate ? startDate.toISOString() : 'null');
      console.log('  endDate (original):', endDate ? endDate.toISOString() : 'null');
      console.log('  endDateForComparison:', endDateForComparison ? endDateForComparison.toISOString() : 'null');

      const filteredResults = [];
      const excludedResults = [];

      filtered = filtered.filter((expense) => {
        // For paid expenses, use paidDate if available, otherwise use expenseDate
        // For unpaid expenses, use expenseDate
        const dateToCheck = expense.isPaid && expense.paidDate 
          ? new Date(expense.paidDate) 
          : new Date(expense.expenseDate);
        
        // Normalize to start of day for comparison
        dateToCheck.setHours(0, 0, 0, 0);

        const expenseInfo = {
          id: expense.id,
          name: expense.name,
          isPaid: expense.isPaid,
          expenseDate: expense.expenseDate,
          paidDate: expense.paidDate,
          dateToCheck: dateToCheck.toISOString(),
          dateToCheckTime: dateToCheck.getTime(),
          endDateForComparisonTime: endDateForComparison ? endDateForComparison.getTime() : null,
          comparison: endDateForComparison ? `${dateToCheck.getTime()} >= ${endDateForComparison.getTime()} = ${dateToCheck >= endDateForComparison}` : 'N/A'
        };

        // For paid expenses, show them if they're within the date range
        // The "starting from tomorrow" rule applies to when we check for paid expenses,
        // but we still show all paid expenses that are within the selected date range
        if (expense.isPaid) {
          // Check if paid expense is within the date range
          if (startDate && dateToCheck < startDate) {
            excludedResults.push({
              ...expenseInfo,
              reason: `Paid expense date (${dateToCheck.toISOString()}) is before startDate (${startDate.toISOString()})`
            });
            return false;
          }
          if (endDateForComparison) {
            // endDateForComparison is endDate + 1 day, so we check if dateToCheck >= endDateForComparison
            // which means dateToCheck is after the end date
            if (dateToCheck >= endDateForComparison) {
              excludedResults.push({
                ...expenseInfo,
                reason: `Paid expense date (${dateToCheck.toISOString()}) is on or after endDate+1 (${endDateForComparison.toISOString()})`
              });
              return false;
            }
          }
          filteredResults.push({
            ...expenseInfo,
            reason: 'Paid expense passed all filters'
          });
          return true;
        } else {
          // For unpaid expenses, use the original logic - compare dates only
          if (startDate && dateToCheck < startDate) {
            excludedResults.push({
              ...expenseInfo,
              reason: `Unpaid expense date (${dateToCheck.toISOString()}) is before startDate (${startDate.toISOString()})`
            });
            return false;
          }
          if (endDateForComparison) {
            // endDateForComparison is endDate + 1 day, so we check if dateToCheck >= endDateForComparison
            // which means dateToCheck is after the end date
            if (dateToCheck >= endDateForComparison) {
              excludedResults.push({
                ...expenseInfo,
                reason: `Unpaid expense date (${dateToCheck.toISOString()}) is on or after endDate+1 (${endDateForComparison.toISOString()})`
              });
              return false;
            }
          }
          filteredResults.push({
            ...expenseInfo,
            reason: 'Unpaid expense passed all filters'
          });
          return true;
        }
      });

      console.log('Filtered expenses (included):', filteredResults.length);
      console.log('Filtered expenses details:', filteredResults);
      console.log('Excluded expenses:', excludedResults.length);
      console.log('Excluded expenses details:', excludedResults);
      console.log('Final filtered count:', filtered.length);
    } else {
      console.log('No date filters applied, showing all expenses');
    }

    console.log('=== END EXPENSE FILTERING DEBUG ===');

    return filtered;
  }, [allExpenses, dateFrom, dateTo]);

  // Combine payments and expenses into cash flow items
  const cashFlowItems = useMemo(() => {
    const items = [];

    // Add payments as income
    filteredPayments.forEach((payment) => {
      items.push({
        id: `payment-${payment.id}`,
        type: 'income',
        date: payment.paymentDate,
        name: payment.reference || 'Rent Payment',
        category: 'Rent Payment',
        propertyName: payment.propertyName,
        unitName: payment.unitName,
        amount: payment.amount,
        method: payment.method
      });
    });

    // Add expenses
    filteredExpenses.forEach((expense) => {
      items.push({
        id: `expense-${expense.id}`,
        type: 'expenses',
        date: expense.expenseDate,
        name: expense.name,
        category: expense.category,
        propertyName: expense.propertyName,
        unitName: expense.unitName,
        amount: expense.amount,
        vendor: expense.vendor,
        status: expense.status,
        isPaid: expense.isPaid || false,
        isRecurring: expense.isRecurring || false
      });
    });

    // Sort by date (most recent first)
    return items.sort((a, b) => new Date(b.date) - new Date(a.date));
  }, [filteredPayments, filteredExpenses]);

  // Filter by transaction type and search query - only show expenses
  const filteredCashFlow = useMemo(() => {
    let filtered = cashFlowItems;

    // Only show expenses (filter out income)
    filtered = filtered.filter((item) => item.type === 'expenses');

    // Filter by search query
    if (search.trim()) {
      const query = search.toLowerCase();
      filtered = filtered.filter(
        (item) =>
          item.name?.toLowerCase().includes(query) ||
          item.category?.toLowerCase().includes(query) ||
          item.propertyName?.toLowerCase().includes(query) ||
          item.unitName?.toLowerCase().includes(query) ||
          item.vendor?.toLowerCase().includes(query)
      );
    }

    return filtered;
  }, [cashFlowItems, search]);

  // Calculate totals
  const totals = useMemo(() => {
    const totalIncome = filteredPayments.reduce((sum, payment) => sum + (parseFloat(payment.amount) || 0), 0);
    const totalExpenses = filteredExpenses
      .filter(expense => expense.isPaid === true)
      .reduce((sum, expense) => sum + (parseFloat(expense.amount) || 0), 0);
    const netCashFlow = totalIncome - totalExpenses;

    return { totalIncome, totalExpenses, netCashFlow };
  }, [filteredPayments, filteredExpenses]);

  const filteredRecurringExpenses = useMemo(() => {
    let filtered = recurringExpenses || [];

    if (recurringSearch.trim()) {
      const query = recurringSearch.toLowerCase();
      filtered = filtered.filter((item) =>
        item.name?.toLowerCase().includes(query) ||
        item.category?.toLowerCase().includes(query) ||
        item.propertyName?.toLowerCase().includes(query) ||
        item.unitName?.toLowerCase().includes(query) ||
        item.vendor?.toLowerCase().includes(query)
      );
    }

    return filtered;
  }, [recurringExpenses, recurringSearch]);

  const recurringTotals = useMemo(() => {
    const active = filteredRecurringExpenses.filter((item) => !item.isPaused);
    const paused = filteredRecurringExpenses.filter((item) => item.isPaused);
    const monthlyTotal = active.reduce((sum, item) => sum + (parseFloat(item.amount) || 0), 0);
    const annualizedTotal = monthlyTotal * 12;

    return {
      activeCount: active.length,
      pausedCount: paused.length,
      monthlyTotal,
      annualizedTotal
    };
  }, [filteredRecurringExpenses]);

  const csvData = useMemo(() =>
    filteredCashFlow.map((item) => ({
      Date: item.date ? new Date(item.date).toLocaleDateString() : '',
      Name: item.name || '',
      Category: item.category || '',
      Property: item.propertyName || '',
      Unit: item.unitName || '',
      Status: item.isPaid ? 'Paid' : 'Unpaid',
      Amount: item.amount || 0
    })), [filteredCashFlow]);

  // Pagination calculations
  const totalPages = Math.ceil(filteredCashFlow.length / itemsPerPage);
  const paginatedCashFlow = useMemo(() => {
    const startIndex = page * itemsPerPage;
    const endIndex = startIndex + itemsPerPage;
    return filteredCashFlow.slice(startIndex, endIndex);
  }, [filteredCashFlow, page, itemsPerPage]);

  // Reset to first page when items per page changes
  useEffect(() => {
    setPage(0);
  }, [itemsPerPage]);

  const handlePageChange = (newPage) => {
    setPage(newPage);
  };

  const getOriginalExpenseFromCashFlowItem = (item) => {
    if (!item?.id || item.type !== 'expenses') return null;
    const expenseId = item.id.replace('expense-', '');
    return allExpenses.find(e => String(e.id) === expenseId) || null;
  };

  const handleEditCashFlowExpense = (item) => {
    const originalExpense = getOriginalExpenseFromCashFlowItem(item);

    if (originalExpense) {
      const property = properties?.find(p => p.id === originalExpense.propertyId);
      if (property) {
        dispatch(setProperty(property));
      }

      if (originalExpense.unitId && property) {
        const unit = property.units?.find(u => u.id === originalExpense.unitId);
        if (unit) {
          dispatch(setUnit(unit));
        }
      } else {
        dispatch(setUnit(null));
      }
    }

    setEditingExpense(originalExpense || item);
    setExpenseModalOpen(true);
  };

  const handleDeleteCashFlowExpense = (item) => {
    if (!item?.id) return;
    const expenseId = item.id.replace('expense-', '');
    setExpenseToDelete(Number(expenseId));
    setDeleteConfirmOpen(true);
  };

  const handleMarkCashFlowExpensePaid = async (item) => {
    try {
      const expenseId = item.id.replace('expense-', '');
      const originalExpense = getOriginalExpenseFromCashFlowItem(item);
      if (!originalExpense) {
        openSnackbar({
          open: true,
          message: 'Expense not found',
          variant: 'alert',
          alert: { color: 'error' }
        });
        return;
      }

      const now = new Date();
      const updatePayload = {
        id: originalExpense.id,
        propertyId: originalExpense.propertyId,
        unitId: originalExpense.unitId || null,
        name: originalExpense.name || '',
        category: originalExpense.category || '',
        amount: originalExpense.amount || 0,
        expenseDate: originalExpense.expenseDate,
        vendor: originalExpense.vendor || null,
        vendorId: originalExpense.vendorId || null,
        paymentMethod: originalExpense.paymentMethod || null,
        receiptUrl: originalExpense.receiptUrl || null,
        isRecurring: originalExpense.isRecurring || false,
        isTaxDeductible: originalExpense.isTaxDeductible || false,
        taxCategory: originalExpense.taxCategory || null,
        maintenanceRequestId: originalExpense.maintenanceRequestId || null,
        frequency: originalExpense.frequency || null,
        dayOfPeriod: originalExpense.dayOfPeriod || null,
        startDate: originalExpense.startDate || null,
        endDate: originalExpense.endDate || null,
        isPaused: originalExpense.isPaused || false,
        isPaid: true,
        paidDate: now.toISOString()
      };

      await dispatch(updateExpenseAction(Number(expenseId), updatePayload));
      openSnackbar({
        open: true,
        message: 'Expense marked as paid',
        variant: 'alert',
        alert: { color: 'success' }
      });
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

  // Comprehensive loading state - tracks when ALL expenses page components are loaded
  // This combines all individual component loading states
  const isExpensesPageLoading = useMemo(() => {
    return (
      propertiesLoading ||
      expensesLoading ||
      paymentsLoading ||
      recurringExpensesLoading ||
      futureExpensesLoading
    );
  }, [
    propertiesLoading,
    expensesLoading,
    paymentsLoading,
    recurringExpensesLoading,
    futureExpensesLoading
  ]);
  
  // Update the context whenever the expenses page loading state changes
  useEffect(() => {
    setExpensesLoading(isExpensesPageLoading);
  }, [isExpensesPageLoading, setExpensesLoading]);
  
  // Keep the existing loading variable for backward compatibility with existing code
  const loading = isExpensesPageLoading;

  return (
    <Box sx={{ overflow: 'visible' }}>
      {/* Page header */}
      <AnimateIn direction="bottom" delay={100} distance={120}>
        <Box sx={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', flexWrap: 'wrap', gap: 2, mb: 3 }}>
          <Box>
            <Typography variant="h4" fontWeight={700} sx={{ lineHeight: 1.2 }}>
              Expenses
            </Typography>
            <Typography variant="caption" color="text.secondary">
              Track, categorize, and manage your property expenses
            </Typography>
          </Box>
          <Stack direction="row" spacing={1}>
            <CSVLink data={csvData} filename={`expenses-${new Date().toISOString().slice(0, 10)}.csv`} style={{ textDecoration: 'none' }}>
              <Button
                size="small"
                variant="outlined"
                startIcon={<DownloadOutlined style={{ fontSize: 13 }} />}
                disabled={filteredCashFlow.length === 0}
                sx={{ textTransform: 'none', borderRadius: 1.5 }}
              >
                Export
              </Button>
            </CSVLink>
            <Button
              size="small"
              variant="contained"
              startIcon={<PlusOutlined style={{ fontSize: 11 }} />}
              onClick={() => setAddExpenseDrawerOpen(true)}
              sx={{
                textTransform: 'none',
                borderRadius: 1.5,
                boxShadow: `0 2px 8px ${alpha(theme.palette.primary.main, 0.3)}`,
                '&:hover': { boxShadow: `0 4px 12px ${alpha(theme.palette.primary.main, 0.4)}` }
              }}
            >
              Add Expense
            </Button>
          </Stack>
        </Box>
      </AnimateIn>

      <AnimateIn direction="bottom" delay={125} distance={120}>
        <Box sx={{ borderBottom: `1px solid ${alpha(theme.palette.divider, 0.16)}`, mb: 3 }}>
          <Tabs
            value={activeTab}
            onChange={(event, value) => setActiveTab(value)}
            variant="scrollable"
            scrollButtons="auto"
            sx={{
              minHeight: 42,
              '& .MuiTab-root': {
                minHeight: 42,
                px: 1.25,
                mr: 1.5,
                borderRadius: 1.5,
                textTransform: 'none',
                fontSize: '0.875rem',
                fontWeight: 700,
                color: 'text.secondary',
                transition: theme.transitions.create(['background-color', 'box-shadow', 'color'], {
                  duration: theme.transitions.duration.shorter
                }),
                '&:hover': {
                  color: theme.palette.mode === 'dark' ? 'primary.light' : 'primary.main',
                  backgroundColor: alpha(theme.palette.primary.main, theme.palette.mode === 'dark' ? 0.16 : 0.08),
                  boxShadow: theme.palette.mode === 'dark' ? `inset 0 0 0 1px ${alpha(theme.palette.primary.main, 0.24)}` : 'none'
                },
                '&.Mui-selected': {
                  color: theme.palette.mode === 'dark' ? 'primary.light' : 'primary.main',
                  backgroundColor: alpha(theme.palette.primary.main, theme.palette.mode === 'dark' ? 0.12 : 0.04)
                }
              },
              '& .MuiTabs-indicator': { height: 2, borderRadius: 2 }
            }}
          >
            <Tab label={`Expenses (${filteredCashFlow.length})`} />
            <Tab label={`Recurring expenses (${recurringExpenses.length})`} />
          </Tabs>
        </Box>
      </AnimateIn>

      {activeTab === 0 && (
        <>
      {/* KPI cards */}
      <AnimateIn direction="bottom" delay={150} distance={120}>
        <Box sx={{ display: 'flex', gap: 2, mb: 3, flexWrap: 'wrap' }}>
          {[
            { label: 'TOTAL INCOME', value: formatCurrency(totals.totalIncome) },
            { label: 'TOTAL EXPENSES (PAID)', value: formatCurrency(totals.totalExpenses) },
            { label: 'NET CASH FLOW', value: formatCurrency(totals.netCashFlow) },
            { label: 'RECURRING & FUTURE', value: recurringExpenses.length + futureExpenses.length }
          ].map((kpi) => (
            <LandlordKpiCard key={kpi.label} label={kpi.label} value={kpi.value} />
          ))}
        </Box>
      </AnimateIn>

      {/* Toolbar */}
      <AnimateIn direction="bottom" delay={200} distance={120}>
        <Box
          sx={{
            display: 'flex',
            gap: 1.5,
            alignItems: 'center',
            mb: 2
          }}
        >
          <OutlinedInput
            size="small"
            placeholder="Search expenses..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            startAdornment={
              <InputAdornment position="start">
                <SearchOutlined style={{ fontSize: 14, opacity: 0.5 }} />
              </InputAdornment>
            }
            sx={{ flex: 2, minWidth: 0, bgcolor: 'background.paper', height: 34, fontSize: '0.8rem' }}
          />
          <TextField
            size="small"
            type="date"
            label="Start Date"
            value={dateFrom || ''}
            onChange={(e) => {
              const newDateFrom = e.target.value;
              setDateFrom(newDateFrom);
              if (newDateFrom && dateTo) {
                handleTimespanChange({ timespan: 'custom', dateFrom: new Date(newDateFrom), dateTo: (() => { const d = new Date(dateTo); d.setHours(23,59,59,999); return d; })() });
              }
            }}
            InputLabelProps={{ shrink: true, style: { backgroundColor: 'transparent' } }}
            sx={{
              flex: 1.5, minWidth: 0,
              '& .MuiOutlinedInput-notchedOutline': { top: 0 },
              '& .MuiOutlinedInput-notchedOutline legend': { display: 'none' }
            }}
            inputProps={{ style: { height: 17, fontSize: '0.8rem' } }}
          />
          <TextField
            size="small"
            type="date"
            label="End Date"
            value={dateTo || ''}
            onChange={(e) => {
              const newDateTo = e.target.value;
              setDateTo(newDateTo);
              if (dateFrom && newDateTo) {
                handleTimespanChange({ timespan: 'custom', dateFrom: new Date(dateFrom), dateTo: (() => { const d = new Date(newDateTo); d.setHours(23,59,59,999); return d; })() });
              }
            }}
            InputLabelProps={{ shrink: true, style: { backgroundColor: 'transparent' } }}
            sx={{
              flex: 1.5, minWidth: 0,
              '& .MuiOutlinedInput-notchedOutline': { top: 0 },
              '& .MuiOutlinedInput-notchedOutline legend': { display: 'none' }
            }}
            inputProps={{ style: { height: 17, fontSize: '0.8rem' } }}
          />
          <Box sx={{
            flex: 2, minWidth: 0,
            '& .MuiInputLabel-root': { backgroundColor: 'transparent' },
            '& .MuiOutlinedInput-notchedOutline': { top: 0 },
            '& .MuiOutlinedInput-notchedOutline legend': { display: 'none' }
          }}>
            <PropertySelect width="100%" disableAllOption={false} />
          </Box>
        </Box>
      </AnimateIn>

      {/* Expenses Table */}
      <AnimateIn direction="bottom" delay={300} distance={120}>
        <MainCard
          content={false}
          boxShadow
          border={false}
          shadow={theme.palette.mode === 'dark' ? `0 0 0 1px ${alpha(theme.palette.primary.main, 0.22)}, 0 8px 28px ${alpha(theme.palette.primary.main, 0.14)}` : `0 2px 12px ${alpha(theme.palette.primary.main, 0.08)}`}
          sx={{ bgcolor: 'background.paper', overflow: 'hidden', border: `1px solid ${alpha(theme.palette.divider, theme.palette.mode === 'dark' ? 0.18 : 0.1)}` }}
        >
        {loading ? (
          <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: 200 }}>
            <CircularProgress />
          </Box>
        ) : filteredCashFlow.length === 0 ? (
          <Box sx={{ p: 5, textAlign: 'center' }}>
            <Typography variant="h6" color="text.primary" sx={{ mt: 2 }}>
              {search.trim() ? 'No matching transactions' : 'No transactions in this view'}
            </Typography>
            <Typography variant="body2" color="text.secondary" sx={{ mt: 1, maxWidth: 420, mx: 'auto' }}>
              {search.trim()
                ? 'Try a different expense name, property, unit, or category.'
                : selectedProperty
                  ? `No expenses were found for ${selectedProperty.name || 'the selected property'} in the selected date range.`
                  : 'Add an expense or choose a property/date range to start tracking cash flow.'}
            </Typography>
            {!search.trim() && (
              <Button variant="contained" startIcon={<PlusOutlined />} onClick={() => setAddExpenseDrawerOpen(true)} sx={{ mt: 2, textTransform: 'none' }}>
                Add Expense
              </Button>
            )}
          </Box>
        ) : isMobile ? (
          <Stack spacing={1.5} sx={{ p: 1.5 }}>
            {paginatedCashFlow.map((item) => (
              <Card key={item.id} variant="outlined" sx={{ borderRadius: 2, boxShadow: `0 6px 18px ${alpha(theme.palette.common.black, 0.05)}` }}>
                <CardContent sx={{ p: 1.75, '&:last-child': { pb: 1.75 } }}>
                  <Stack spacing={1.25}>
                    <Stack direction="row" justifyContent="space-between" spacing={1} alignItems="flex-start">
                      <Box sx={{ minWidth: 0 }}>
                        <Typography variant="caption" color="text.secondary">{formatDate(item.date)}</Typography>
                        <Typography variant="body2" fontWeight={700} noWrap>{item.name || '-'}</Typography>
                        <Typography variant="caption" color="text.secondary" noWrap sx={{ display: 'block' }}>
                          {[item.propertyName, item.unitName].filter(Boolean).join(' · ') || 'No property assigned'}
                        </Typography>
                      </Box>
                      <Typography variant="body1" fontWeight={800} color={item.type === 'income' ? 'success.main' : 'error.main'} sx={{ flexShrink: 0 }}>
                        {item.type === 'income' ? '+' : '-'}{formatCurrency(item.amount)}
                      </Typography>
                    </Stack>

                    <Stack direction="row" justifyContent="space-between" alignItems="center">
                      {item.type === 'expenses' ? (
                        <Chip label={item.isPaid ? 'Paid' : 'Unpaid'} size="small" color={item.isPaid ? 'success' : 'warning'} variant={item.isPaid ? 'filled' : 'outlined'} />
                      ) : (
                        <Chip label="Income" size="small" color="success" variant="outlined" />
                      )}
                      {item.type === 'expenses' && (
                        <Stack direction="row" spacing={0.5}>
                          {!item.isPaid && (
                            <Tooltip title="Mark as Paid">
                              <IconButton size="small" color="success" aria-label={`Mark ${item.name || 'expense'} as paid`} onClick={() => handleMarkCashFlowExpensePaid(item)}>
                                <CheckCircleOutlined style={{ fontSize: 16 }} />
                              </IconButton>
                            </Tooltip>
                          )}
                          <Tooltip title="Edit Expense">
                            <IconButton size="small" aria-label={`Edit ${item.name || 'expense'}`} onClick={() => handleEditCashFlowExpense(item)}>
                              <EditOutlined style={{ fontSize: 16 }} />
                            </IconButton>
                          </Tooltip>
                          <Tooltip title="Delete Expense">
                            <IconButton size="small" color="error" aria-label={`Delete ${item.name || 'expense'}`} onClick={() => handleDeleteCashFlowExpense(item)}>
                              <DeleteOutlined style={{ fontSize: 16 }} />
                            </IconButton>
                          </Tooltip>
                        </Stack>
                      )}
                    </Stack>
                  </Stack>
                </CardContent>
              </Card>
            ))}
          </Stack>
        ) : (
          <TableContainer>
            <Table>
              <TableHead>
                <TableRow>
                  <TableCell>Date</TableCell>
                  <TableCell>Name</TableCell>
                  <TableCell>Property</TableCell>
                  <TableCell>Unit</TableCell>
                  <TableCell>Paid Status</TableCell>
                  <TableCell align="right">Amount</TableCell>
                  <TableCell align="center">Actions</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {paginatedCashFlow.map((item) => (
                  <TableRow key={item.id} hover>
                    <TableCell>{formatDate(item.date)}</TableCell>
                    <TableCell>
                      <Typography variant="body2" fontWeight={500}>
                        {item.name || '-'}
                      </Typography>
                    </TableCell>
                    <TableCell>{item.propertyName || '-'}</TableCell>
                    <TableCell>{item.unitName || '-'}</TableCell>
                    <TableCell>
                      {item.type === 'expenses' ? (
                        <Chip
                          label={item.isPaid ? 'Paid' : 'Unpaid'}
                          size="small"
                          color={item.isPaid ? 'success' : 'warning'}
                          variant={item.isPaid ? 'filled' : 'outlined'}
                        />
                      ) : (
                        <Typography variant="body2" color="text.secondary">-</Typography>
                      )}
                    </TableCell>
                    <TableCell align="right">
                      <Typography 
                        variant="body2" 
                        fontWeight={500} 
                        color={item.type === 'income' ? 'success.main' : 'error.main'}
                      >
                        {item.type === 'income' ? '+' : '-'}{formatCurrency(item.amount)}
                      </Typography>
                    </TableCell>
                    <TableCell align="center">
                      {item.type === 'expenses' && (
                        <Stack direction="row" spacing={1} justifyContent="center" alignItems="center">
                          {!item.isPaid && (
                            <Tooltip title="Mark as Paid">
                              <IconButton
                                size="small"
                                color="success"
                                onClick={async () => {
                                  try {
                                    // Extract expense ID from item.id (format: "expense-{id}")
                                    const expenseId = item.id.replace('expense-', '');
                                    // Find the original expense from allExpenses
                                    const originalExpense = allExpenses.find(e => String(e.id) === expenseId);
                                    if (!originalExpense) {
                                      openSnackbar({
                                        open: true,
                                        message: 'Expense not found',
                                        variant: 'alert',
                                        alert: { color: 'error' }
                                      });
                                      return;
                                    }

                                    const now = new Date();
                                    // Build proper update payload with all required fields
                                    const updatePayload = {
                                      id: originalExpense.id,
                                      propertyId: originalExpense.propertyId,
                                      unitId: originalExpense.unitId || null,
                                      name: originalExpense.name || '',
                                      category: originalExpense.category || '',
                                      amount: originalExpense.amount || 0,
                                      expenseDate: originalExpense.expenseDate,
                                      vendor: originalExpense.vendor || null,
                                      vendorId: originalExpense.vendorId || null,
                                      paymentMethod: originalExpense.paymentMethod || null,
                                      receiptUrl: originalExpense.receiptUrl || null,
                                      isRecurring: originalExpense.isRecurring || false,
                                      isTaxDeductible: originalExpense.isTaxDeductible || false,
                                      taxCategory: originalExpense.taxCategory || null,
                                      maintenanceRequestId: originalExpense.maintenanceRequestId || null,
                                      frequency: originalExpense.frequency || null,
                                      dayOfPeriod: originalExpense.dayOfPeriod || null,
                                      startDate: originalExpense.startDate || null,
                                      endDate: originalExpense.endDate || null,
                                      isPaused: originalExpense.isPaused || false,
                                      isPaid: true,
                                      paidDate: now.toISOString()
                                    };

                                    console.log('Marking expense as paid:', { expenseId, updatePayload });
                                    await dispatch(updateExpenseAction(Number(expenseId), updatePayload));
                                    openSnackbar({
                                      open: true,
                                      message: 'Expense marked as paid',
                                      variant: 'alert',
                                      alert: { color: 'success' }
                                    });
                                    // No need to refetch - Redux reducer will update the state automatically
                                  } catch (error) {
                                    console.error('Error marking expense as paid:', error);
                                    openSnackbar({
                                      open: true,
                                      message: error?.response?.data?.message || 'Failed to mark expense as paid',
                                      variant: 'alert',
                                      alert: { color: 'error' }
                                    });
                                  }
                                }}
                              >
                                <CheckCircleOutlined style={{ fontSize: 16 }} />
                              </IconButton>
                            </Tooltip>
                          )}
                          <Tooltip title="Edit Expense">
                            <IconButton
                              size="small"
                              onClick={() => {
                                // Extract expense ID from item.id (format: "expense-{id}")
                                const expenseId = item.id.replace('expense-', '');
                                // Find the original expense from allExpenses
                                const originalExpense = allExpenses.find(e => String(e.id) === expenseId);
                                
                                if (originalExpense) {
                                  // Set property and unit in Redux so they're pre-selected in the modal
                                  const property = properties?.find(p => p.id === originalExpense.propertyId);
                                  if (property) {
                                    dispatch(setProperty(property));
                                  }
                                  
                                  if (originalExpense.unitId && property) {
                                    const unit = property.units?.find(u => u.id === originalExpense.unitId);
                                    if (unit) {
                                      dispatch(setUnit(unit));
                                    }
                                  } else {
                                    dispatch(setUnit(null));
                                  }
                                }
                                
                                setEditingExpense(originalExpense || item);
                                setExpenseModalOpen(true);
                              }}
                            >
                              <EditOutlined style={{ fontSize: 16 }} />
                            </IconButton>
                          </Tooltip>
                          <Tooltip title="Delete Expense">
                            <IconButton
                              size="small"
                              color="error"
                              onClick={() => {
                                // Extract expense ID from item.id (format: "expense-{id}")
                                const expenseId = item.id.replace('expense-', '');
                                setExpenseToDelete(Number(expenseId));
                                setDeleteConfirmOpen(true);
                              }}
                            >
                              <DeleteOutlined style={{ fontSize: 16 }} />
                            </IconButton>
                          </Tooltip>
                        </Stack>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TableContainer>
        )}

      </MainCard>
        {filteredCashFlow.length > 0 && (
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
                <Button size="small" variant="outlined" startIcon={<LeftOutlined />} onClick={() => handlePageChange(Math.max(0, page - 1))} disabled={page === 0} sx={{ minWidth: 100 }}>Previous</Button>
                <Button size="small" variant="outlined" endIcon={<RightOutlined />} onClick={() => handlePageChange(Math.min(totalPages - 1, page + 1))} disabled={page >= totalPages - 1} sx={{ minWidth: 100 }}>Next</Button>
              </Box>
            </Box>
          </Box>
        )}
      </AnimateIn>

        </>
      )}

      {activeTab === 1 && (
        <>
          <AnimateIn direction="bottom" delay={150} distance={120}>
            <Box sx={{ display: 'flex', gap: 2, mb: 3, flexWrap: 'wrap' }}>
              {[
                { label: 'ACTIVE RECURRING', value: recurringTotals.activeCount },
                { label: 'PAUSED', value: recurringTotals.pausedCount },
                { label: 'MONTHLY TOTAL', value: formatCurrency(recurringTotals.monthlyTotal) },
                { label: 'ANNUALIZED', value: formatCurrency(recurringTotals.annualizedTotal) }
              ].map((kpi) => (
                <LandlordKpiCard key={kpi.label} label={kpi.label} value={kpi.value} />
              ))}
            </Box>
          </AnimateIn>

          <AnimateIn direction="bottom" delay={200} distance={120}>
            <Box
              sx={{
                display: 'flex',
                gap: 1.5,
                alignItems: 'center',
                mb: 2,
                flexDirection: { xs: 'column', sm: 'row' }
              }}
            >
              <OutlinedInput
                size="small"
                placeholder="Search recurring expenses..."
                value={recurringSearch}
                onChange={(e) => setRecurringSearch(e.target.value)}
                startAdornment={
                  <InputAdornment position="start">
                    <SearchOutlined style={{ fontSize: 14, opacity: 0.5 }} />
                  </InputAdornment>
                }
                sx={{ flex: 2, width: '100%', minWidth: 0, bgcolor: 'background.paper', height: 34, fontSize: '0.8rem' }}
              />
              <Box sx={{
                flex: 2,
                width: '100%',
                minWidth: 0,
                '& .MuiInputLabel-root': { backgroundColor: 'transparent' },
                '& .MuiOutlinedInput-notchedOutline': { top: 0 },
                '& .MuiOutlinedInput-notchedOutline legend': { display: 'none' }
              }}>
                <PropertySelect width="100%" disableAllOption={false} />
              </Box>
            </Box>
          </AnimateIn>

          <AnimateIn direction="bottom" delay={300} distance={120}>
            <MainCard
              content={false}
              boxShadow
              border={false}
              shadow={theme.palette.mode === 'dark' ? `0 0 0 1px ${alpha(theme.palette.primary.main, 0.22)}, 0 8px 28px ${alpha(theme.palette.primary.main, 0.14)}` : `0 2px 12px ${alpha(theme.palette.primary.main, 0.08)}`}
              sx={{ bgcolor: 'background.paper', overflow: 'hidden', border: `1px solid ${alpha(theme.palette.divider, theme.palette.mode === 'dark' ? 0.18 : 0.1)}` }}
            >
              {recurringExpensesLoading ? (
                <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: 200 }}>
                  <CircularProgress />
                </Box>
              ) : filteredRecurringExpenses.length === 0 ? (
                <Box sx={{ p: 5, textAlign: 'center' }}>
                  <Typography variant="h6" color="text.secondary" sx={{ mt: 2 }}>
                    No recurring expenses found
                  </Typography>
                  <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
                    {selectedProperty
                      ? `No recurring expenses found for ${selectedProperty.name || 'selected property'}`
                      : 'Create recurring expenses to see them here.'}
                  </Typography>
                </Box>
              ) : isMobile ? (
                <Stack spacing={1.5} sx={{ p: 1.5 }}>
                  {filteredRecurringExpenses.map((recurring) => {
                    const frequency = recurring.frequency
                      ? recurring.frequency.charAt(0) + recurring.frequency.slice(1).toLowerCase()
                      : 'N/A';
                    const nextDueDate = recurring.nextOccurrenceDate
                      ? formatDate(recurring.nextOccurrenceDate)
                      : 'N/A';
                    const status = recurring.isPaused ? 'Paused' : 'Active';

                    return (
                      <Card key={`recurring-card-${recurring.id}`} variant="outlined" sx={{ borderRadius: 2, boxShadow: `0 6px 18px ${alpha(theme.palette.common.black, 0.05)}` }}>
                        <CardContent sx={{ p: 1.75, '&:last-child': { pb: 1.75 } }}>
                          <Stack spacing={1.25}>
                            <Stack direction="row" justifyContent="space-between" spacing={1} alignItems="flex-start">
                              <Box sx={{ minWidth: 0 }}>
                                <Typography variant="body2" fontWeight={700} noWrap>{recurring.name || '-'}</Typography>
                                <Typography variant="caption" color="text.secondary" noWrap sx={{ display: 'block' }}>
                                  {[recurring.propertyName, recurring.unitName].filter(Boolean).join(' · ') || 'No property assigned'}
                                </Typography>
                              </Box>
                              <Typography variant="body1" fontWeight={800} color="error.main" sx={{ flexShrink: 0 }}>{formatCurrency(recurring.amount)}</Typography>
                            </Stack>

                            <Stack direction="row" spacing={1} flexWrap="wrap">
                              <Chip label={status} size="small" color={recurring.isPaused ? 'warning' : 'success'} variant={recurring.isPaused ? 'outlined' : 'filled'} />
                              <Chip label={frequency} size="small" variant="outlined" />
                              <Chip label={`Next ${nextDueDate}`} size="small" variant="outlined" />
                            </Stack>

                            <Stack direction="row" spacing={0.5} justifyContent="flex-end">
                              <Tooltip title="Mark as Paid">
                                <IconButton size="small" color="success" aria-label={`Mark ${recurring.name || 'recurring expense'} as paid`} onClick={async () => {
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
                                    openSnackbar({ open: true, message: 'Expense marked as paid and added to expenses', variant: 'alert', alert: { color: 'success' } });
                                    setTimeout(() => { refetchExpenses(); }, 1000);
                                  } catch (error) {
                                    console.error('Error marking recurring expense as paid:', error);
                                    openSnackbar({ open: true, message: 'Failed to mark expense as paid', variant: 'alert', alert: { color: 'error' } });
                                  }
                                }}>
                                  <CheckCircleOutlined style={{ fontSize: 18 }} />
                                </IconButton>
                              </Tooltip>
                              <Tooltip title={recurring.isPaused ? 'Resume' : 'Pause'}>
                                <IconButton size="small" aria-label={`${recurring.isPaused ? 'Resume' : 'Pause'} ${recurring.name || 'recurring expense'}`} onClick={async () => {
                                  try {
                                    if (recurring.isPaused) {
                                      await dispatch(resumeRecurringExpenseAction(recurring.id));
                                      openSnackbar({ open: true, message: 'Recurring expense resumed', variant: 'alert', alert: { color: 'success' } });
                                    } else {
                                      await dispatch(pauseRecurringExpenseAction(recurring.id));
                                      openSnackbar({ open: true, message: 'Recurring expense paused', variant: 'alert', alert: { color: 'warning' } });
                                    }
                                    const landlordId = user.id || user.Id;
                                    await dispatch(getRecurringExpensesAction(landlordId, { propertyId: selectedProperty?.id || null }));
                                    setRecurringExpensesLoading(false);
                                  } catch (error) {
                                    console.error('Error toggling recurring expense:', error);
                                    openSnackbar({ open: true, message: 'Failed to update recurring expense', variant: 'alert', alert: { color: 'error' } });
                                  }
                                }}>
                                  {recurring.isPaused ? <PlayCircleOutlined style={{ fontSize: 18 }} /> : <PauseCircleOutlined style={{ fontSize: 18 }} />}
                                </IconButton>
                              </Tooltip>
                            </Stack>
                          </Stack>
                        </CardContent>
                      </Card>
                    );
                  })}
                </Stack>
              ) : (
                <TableContainer>
                  <Table>
                    <TableHead>
                      <TableRow>
                        <TableCell>Name</TableCell>
                        <TableCell>Category</TableCell>
                        <TableCell>Property</TableCell>
                        <TableCell>Amount</TableCell>
                        <TableCell>Frequency</TableCell>
                        <TableCell>Next Due Date</TableCell>
                        <TableCell>Status</TableCell>
                        <TableCell align="center">Actions</TableCell>
                      </TableRow>
                    </TableHead>
                    <TableBody>
                      {filteredRecurringExpenses.map((recurring) => {
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
                              {recurring.vendor && (
                                <Typography variant="caption" color="text.secondary">
                                  {recurring.vendor}
                                </Typography>
                              )}
                            </TableCell>
                            <TableCell>{recurring.category || '-'}</TableCell>
                            <TableCell>
                              <Typography variant="body2">{recurring.propertyName || '-'}</Typography>
                              {recurring.unitName && <Typography variant="caption" color="text.secondary">{recurring.unitName}</Typography>}
                            </TableCell>
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
                                          refetchExpenses();
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
                                          propertyId: selectedProperty?.id || null
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
                                <Tooltip title="Edit">
                                  <IconButton
                                    size="small"
                                    onClick={() => {
                                      openSnackbar({
                                        open: true,
                                        message: 'Edit functionality coming soon',
                                        variant: 'alert',
                                        alert: { color: 'info' }
                                      });
                                    }}
                                  >
                                    <EditOutlined style={{ fontSize: 18 }} />
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
                                            propertyId: selectedProperty?.id || null
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
                    </TableBody>
                  </Table>
                </TableContainer>
              )}
            </MainCard>
          </AnimateIn>
        </>
      )}

      <ExpenseEditDrawer
        open={expenseModalOpen}
        expense={editingExpense}
        onClose={() => {
          setExpenseModalOpen(false);
          setEditingExpense(null);
        }}
        onSuccess={() => {
          refetchExpenses();
          setEditingExpense(null);
        }}
      />

      {/* Delete Confirmation Dialog */}
      <ConfirmationDialog
        open={deleteConfirmOpen}
        onClose={() => {
          setDeleteConfirmOpen(false);
          setExpenseToDelete(null);
        }}
        onConfirm={async () => {
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
        }}
        title="Delete Expense"
        message="Are you sure you want to delete this expense? This action cannot be undone."
        confirmText="Delete"
        cancelText="Cancel"
        confirmColor="error"
      />

      <ExpenseAddDrawer
        open={addExpenseDrawerOpen}
        onClose={() => setAddExpenseDrawerOpen(false)}
      />
    </Box>
  );
}