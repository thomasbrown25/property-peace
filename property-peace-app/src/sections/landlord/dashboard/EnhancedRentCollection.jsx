import { useState, useEffect, useRef } from 'react';
import { alpha, Box, Stack, Typography, useTheme } from '@mui/material';
import MainCard from 'components/MainCard';
import CircularLoader from 'components/CircularLoader';
import { formatCurrency } from 'utils/formatters';
import { useNavigate } from 'react-router-dom';
import { useDispatch, useSelector } from 'react-redux';
import { getRentCollection } from 'store/rent-collection/rent-collection.action';
import { getTotalExpensesAction } from 'store/expense/expense.action';
import { selectTotalExpenses } from 'store/expense/expense.selector';
import PropertySelect from 'components/PropertySelect';
import useAuth from 'hooks/useAuth';


export default function EnhancedRentCollection({ summary, loading, expenses: initialExpenses = 0 }) {
  const { remainingThisMonth = 0, expectedThisMonth = 0, collectedThisMonth = 0, overdue = 0 } = summary || {};

  const theme = useTheme();
  const navigate = useNavigate();
  const dispatch = useDispatch();
  const { user } = useAuth();
  const totalExpenses = useSelector(selectTotalExpenses);
  
  // Get current month name for title
  const currentMonth = new Date().toLocaleString('default', { month: 'long' });
  const rentCollectionTitle = `${currentMonth}'s Rent Collection`;
  
  // Local state for property selection (only affects rent collection)
  const [localSelectedProperty, setLocalSelectedProperty] = useState(null);
  const isInitialMount = useRef(true);
  const [useLocalExpenses, setUseLocalExpenses] = useState(false);

  // Calculate current month start/end dates for expenses
  const getCurrentMonthDates = () => {
    const now = new Date();
    const startDate = new Date(now.getFullYear(), now.getMonth(), 1);
    const endDate = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59);
    return {
      startDate: startDate.toISOString(),
      endDate: endDate.toISOString()
    };
  };

  // Reset to use initial expenses when they change (global property changed)
  useEffect(() => {
    if (isInitialMount.current) {
      return;
    }
    // When initialExpenses changes (from dashboard), reset to use them
    setUseLocalExpenses(false);
  }, [initialExpenses]);

  // Fetch rent collection data when property selection changes (skip initial mount)
  useEffect(() => {
    // Skip the initial mount - dashboard already fetches data on mount
    if (isInitialMount.current) {
      isInitialMount.current = false;
      return;
    }
    
    const propertyId = localSelectedProperty?.id || null;
    dispatch(getRentCollection(propertyId, false));
    dispatch(getRentCollection(propertyId, true));
    
    // Also fetch expenses for the selected property
    if (user?.id || user?.Id) {
      const userId = user.id || user.Id;
      const { startDate, endDate } = getCurrentMonthDates();
      const filters = {
        propertyId: propertyId,
        startDate,
        endDate
      };
      dispatch(getTotalExpensesAction(userId, filters));
      setUseLocalExpenses(true);
    }
  }, [localSelectedProperty, dispatch, user]);

  // Use the same values as OverviewCards - directly from summary
  // remainingThisMonth already excludes overdue leases (calculated in backend)
  const remaining = remainingThisMonth;
  const collected = collectedThisMonth;
  const overdueAmount = overdue;
  // Use local expenses if property was changed locally, otherwise use initial expenses from dashboard
  const expensesAmount = useLocalExpenses ? (totalExpenses || 0) : (initialExpenses || 0);

  // Calculate percentages for each category (for overview cards)
  const total = collected + expensesAmount + overdueAmount + remaining;
  const collectedPercentDisplay = total > 0 ? ((collected / total) * 100).toFixed(1) : '0.0';
  const expensesPercent = total > 0 ? ((expensesAmount / total) * 100).toFixed(1) : '0.0';
  const overduePercent = total > 0 ? ((overdueAmount / total) * 100).toFixed(1) : '0.0';
  const remainingPercent = total > 0 ? ((remaining / total) * 100).toFixed(1) : '0.0';

  // Overview Card Component — compact stacked row
  const OverviewCard = ({ title, value, percent, color, onClick }) => (
    <Box
      onClick={onClick}
      sx={{
        px: 1.5,
        py: 1.25,
        borderRadius: 2,
        border: `1px solid ${alpha(color, 0.2)}`,
        bgcolor: alpha(color, 0.05),
        cursor: onClick ? 'pointer' : 'default',
        transition: 'all 0.18s ease',
        '&:hover': onClick ? {
          bgcolor: alpha(color, 0.1),
          transform: 'translateX(3px)'
        } : {}
      }}
    >
      <Stack direction="row" justifyContent="space-between" alignItems="center">
        <Box sx={{ minWidth: 0 }}>
          <Typography
            variant="caption"
            color="text.secondary"
            fontWeight={600}
            sx={{ textTransform: 'uppercase', letterSpacing: 0.6, fontSize: '0.65rem', display: 'block' }}
          >
            {title}
          </Typography>
          <Typography variant="h6" fontWeight={700} sx={{ color: 'text.primary', lineHeight: 1.3, my: 0.25 }}>
            {formatCurrency(value)}
          </Typography>
        </Box>
        <Typography variant="body2" sx={{ color, fontWeight: 700, fontSize: '0.8rem', flexShrink: 0, ml: 1 }}>
          {percent}%
        </Typography>
      </Stack>
    </Box>
  );

  // Handle property selection change (local state, doesn't affect Redux global property)
  const handlePropertyChange = (property) => {
    setLocalSelectedProperty(property);
  };

  return (
    <MainCard
      title={rentCollectionTitle}
      className="rent-collection-chart"
      sx={{
        transition: 'all 0.2s ease',
      }}
      secondary={
        <Box sx={{ minWidth: 200, display: { xs: 'none', sm: 'none', md: 'block' } }}>
          <PropertySelect 
            width="100%"
            onPropertyChange={handlePropertyChange}
            localSelectedProperty={localSelectedProperty}
          />
        </Box>
      }
    >
      {loading ? (
        <Box sx={{ height: 300, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <CircularLoader />
        </Box>
      ) : (
        <Stack spacing={1.5}>
          <OverviewCard
            title="Collected"
            value={collected}
            percent={collectedPercentDisplay}
            color={theme.palette.success.main}
            onClick={() => navigate('/landlord/payments')}
          />
          <OverviewCard
            title="Overdue"
            value={overdueAmount}
            percent={overduePercent}
            color={theme.palette.error.main}
            onClick={() => navigate('/landlord/leases?view=overdue')}
          />
          <OverviewCard
            title="Expenses"
            value={expensesAmount}
            percent={expensesPercent}
            color={theme.palette.warning.main}
            onClick={() => navigate('/landlord/expenses')}
          />
          <OverviewCard
            title="Remaining"
            value={remaining}
            percent={remainingPercent}
            color={theme.palette.primary.main}
          />
        </Stack>
      )}
    </MainCard>
  );
}
