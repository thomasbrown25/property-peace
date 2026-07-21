import { useEffect, useState, useMemo } from 'react';
import { useDashboardLoading } from 'contexts/DashboardLoadingContext';

// material-ui
import { Divider, Grid, Link, Stack, Fade, Menu, MenuItem, Tooltip, IconButton, Collapse } from '@mui/material';
import { Box, Typography } from '@mui/material';
import { Grow } from '@mui/material';
import OnboardingWizard from 'components/onboarding/OnboardingWizard';
import OrphanedSubscriptionModal from 'components/subscription/OrphanedSubscriptionModal';
import AnimateIn from 'components/AnimateIn';

// sections
import PropertySelect from 'components/PropertySelect';
import QuickActions from 'sections/landlord/dashboard/QuickActions';
import EnhancedQuickActions from 'sections/landlord/dashboard/EnhancedQuickActions';
import PaymentsCard from 'sections/landlord/dashboard/PaymentsCard';
import AtAGlance from 'sections/landlord/dashboard/AtAGlance';
import OnTheHorizon from 'sections/landlord/dashboard/OnTheHorizon';
import DashboardHeader from 'sections/landlord/dashboard/DashboardHeader';
import TodaysPriorities from 'sections/landlord/dashboard/TodaysPriorities';
import UrgentMessages from 'sections/landlord/dashboard/UrgentMessages';
import PropertyProfitability from 'sections/landlord/dashboard/PropertyProfitability';
import AICopilot from 'sections/landlord/dashboard/AICopilot';
import PortfolioHealthSummary from 'sections/landlord/dashboard/PortfolioHealthSummary';
import MoneySummary from 'sections/landlord/dashboard/MoneySummary';
import FinishSetup from 'sections/landlord/dashboard/FinishSetup';

// drawers
import LandlordMaintenanceDrawer from 'components/drawers/LandlordMaintenanceDrawer';
import LeaseAddDrawer from 'components/drawers/LeaseAddDrawer';
import TenantAddDrawer from 'components/drawers/TenantAddDrawer';
import AddTenantDialog from 'components/dialogs/AddTenantDialog';

// hooks
import useAuth from 'hooks/useAuth';
import { useDrawer } from 'contexts/DrawerContext';
import { useTriggerSummary } from 'contexts/TriggerSummaryContext';
import useFetchProperties from 'hooks/useFetchProperties';
import { useDispatch, useSelector } from 'react-redux';
import { setProperty } from 'store/property/property.action';
import { selectProperty } from 'store/property/property.selector';
import { selectTenants } from 'store/tenant/tenant.selector';
import { selectTotalExpenses } from 'store/expense/expense.selector';
import { selectDashboardLoading, selectDashboardSummary } from 'store/dashboard/dashboard.selector';
import LeaseViewDrawer from 'components/drawers/LeaseViewDrawer';
import ExpenseAddDrawer from 'components/expense/ExpenseAddDrawer';
import SendRentReminderDrawer from 'components/drawers/SendRentReminderDrawer';
import useFetchDashboardSummary from 'hooks/useFetchDashboard';
import useFetchAllTenants from 'hooks/useFetchAllTenants';
import useFetchAllPayments from 'hooks/useFetchAllPayments';
import { selectAllPayments } from 'store/payment/payment.selector';
import RentRevenueChart from '../../components/charts/RentRevenueChart';
import { getRentCollection } from 'store/rent-collection/rent-collection.action';
import useFetchExpenses from 'hooks/useFetchExpenses';
import useFetchNotifications from 'hooks/useFetchNotifications';
import useLandlordSetupSteps from 'hooks/useLandlordSetupSteps';
import ReloadOutlined from '@ant-design/icons/ReloadOutlined';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { expenseAPI } from 'api';
import { useSubscription, useSubscriptionPlans, useSubscriptionStatus } from 'hooks/useSubscription';
import { subscriptionAPI } from 'api';
import { openSnackbar } from 'api/snackbar';
import axiosServices from 'utils/axios';
import { alpha, useTheme, Button, Paper, useMediaQuery } from '@mui/material';
import { isOpenMaintenanceRequest } from 'utils/maintenanceStatus';
import { WarningOutlined, DollarCircleOutlined, RocketOutlined, ThunderboltOutlined, SettingOutlined, HomeOutlined, WalletOutlined, UnorderedListOutlined, ToolOutlined, FileTextOutlined, BarChartOutlined, MessageOutlined, DollarOutlined } from '@ant-design/icons';

// ==============================|| LANDLORD - DASHBOARD ||============================== //

export default function Dashboard() {
  const { user, updateUser } = useAuth();
  const drawer = useDrawer();
  const dispatch = useDispatch();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();

  // Get rent collection data from Redux store
  const rentCollectionState = useSelector((state) => state.rentCollection);
  const { summary, rentRecords, lifetimeSummary, lifetimeRentRecords, loading: rentLoading } = rentCollectionState;

  // State for property profitability data
  const [profitabilityData, setProfitabilityData] = useState([]);
  const [profitabilityLoading, setProfitabilityLoading] = useState(false);

  // hooks
  const { properties, propertiesRefetch, isLoading: propertiesLoading } = useFetchProperties();
  const { refetchDashboardSummary } = useFetchDashboardSummary();
  const selectedProperty = useSelector(selectProperty);
  const totalExpenses = useSelector(selectTotalExpenses);
  const expenseFilters = useMemo(() => {
    const now = new Date();
    return {
      startDate: new Date(now.getFullYear(), now.getMonth(), 1).toISOString(),
      endDate: new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59).toISOString(),
      propertyId: selectedProperty?.id || null
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedProperty?.id]);
  const { refetch: refetchExpenses, loading: expensesLoading } = useFetchExpenses(expenseFilters);
  const { refetch: refetchNotifications, notificationsLoading } = useFetchNotifications();
  const { isLoading: tenantsLoading } = useFetchAllTenants();
  const tenants = useSelector(selectTenants);
  useFetchAllPayments();
  const allPayments = useSelector(selectAllPayments);
  const { subscription, loading: subLoading } = useSubscription();
  const { plans } = useSubscriptionPlans();
  const { status: subscriptionStatus } = useSubscriptionStatus();
  const theme = useTheme();
  const { registerGenerateSummary } = useTriggerSummary();

  // Compute dashboard summary sentence for the header
  const dashboardSummaryData = useSelector(selectDashboardSummary);
  const allMaintenanceRequests = dashboardSummaryData?.maintenanceRequests?.maintenanceRequests || [];
  const headerSummaryText = useMemo(() => {
    let attentionCount = 0;
    // Count overdue units (backend-computed status)
    if (properties?.length) {
      properties.forEach((p) => {
        (p.units || p.Units || []).forEach((u) => {
          const unitStatus = (u.status || u.Status || '').toLowerCase();
          if (unitStatus === 'overdue') attentionCount++;
        });
      });
    }
    // Count high/medium maintenance
    attentionCount += allMaintenanceRequests.filter(
      (r) => ['high', 'medium'].includes((r.priority || '').toLowerCase()) && isOpenMaintenanceRequest(r)
    ).length;
    // Count expiring leases ≤60 days (only occupied units — overdue handled separately)
    if (properties?.length) {
      properties.forEach((p) => {
        (p.units || p.Units || []).forEach((u) => {
          const unitStatus = (u.status || u.Status || '').toLowerCase();
          if (unitStatus !== 'occupied') return;
          const lease = u.lease || u.Lease;
          const endDate = lease?.endDate || lease?.EndDate;
          if (!endDate) return;
          const days = Math.floor((new Date(endDate) - new Date()) / 86400000);
          if (days >= 0 && days <= 60) attentionCount++;
        });
      });
    }
    if (attentionCount === 0) return null;
    return `${attentionCount} thing${attentionCount !== 1 ? 's' : ''} need your attention today`;
  }, [properties, allMaintenanceRequests]);

  // Get dashboard loading state from Redux
  const dashboardLoading = useSelector(selectDashboardLoading);

  // Derive last payment date per lease from the shared Redux payment store
  const lastPaymentDates = useMemo(() => {
    if (!properties?.length || !allPayments?.length) return {};
    const datesMap = {};
    properties.forEach((p) => {
      p.units?.forEach((u) => {
        const unitLease = u.lease || u.Lease;
        if (unitLease && (unitLease.isActive || unitLease.IsActive)) {
          const leaseId = unitLease.id || unitLease.Id;
          if (!leaseId) return;
          const leasePayments = allPayments.filter((pay) => (pay.leaseId || pay.LeaseId) === leaseId);
          if (leasePayments.length > 0) {
            const paymentDate = leasePayments[0].paymentDate || leasePayments[0].PaymentDate;
            if (paymentDate) datesMap[leaseId] = paymentDate;
          }
        }
      });
    });
    return datesMap;
  }, [properties, allPayments]);
  
  // Get context to update dashboard loading state
  const { setDashboardLoading } = useDashboardLoading();
  
  // Comprehensive loading state - tracks when ALL dashboard components are loaded
  // This combines all individual component loading states
  const isDashboardLoading = useMemo(() => {
    return (
      propertiesLoading ||
      dashboardLoading ||
      rentLoading ||
      subLoading ||
      profitabilityLoading ||
      tenantsLoading ||
      expensesLoading ||
      notificationsLoading
    );
  }, [
    propertiesLoading,
    dashboardLoading,
    rentLoading,
    subLoading,
    profitabilityLoading,
    tenantsLoading,
    expensesLoading,
    notificationsLoading
  ]);
  
  // Update the context whenever the dashboard loading state changes
  useEffect(() => {
    setDashboardLoading(isDashboardLoading);
  }, [isDashboardLoading, setDashboardLoading]);
  
  // Check if trial is expired (trialDaysRemaining <= 0 or trial has ended)
  const isTrialExpired = subscriptionStatus?.isTrialActive && 
    (subscriptionStatus?.trialDaysRemaining === null || subscriptionStatus?.trialDaysRemaining <= 0);

  // Get user ID (handle both Id and id for compatibility)
  const userId = user?.Id || user?.id;

  // Onboarding wizard state
  const [showOnboardingWizard, setShowOnboardingWizard] = useState(false);
  const [setupTasksOpen, setSetupTasksOpen] = useState(false);
  const setupState = useLandlordSetupSteps(() => setSetupTasksOpen(false));
  
  // Add tenant dialog state
  const [addTenantDialogOpen, setAddTenantDialogOpen] = useState(false);
  
  // Orphaned subscription modal state
  const [orphanedModalOpen, setOrphanedModalOpen] = useState(false);
  const [checkoutLoading, setCheckoutLoading] = useState(false);
  
  // Fade-in animation state
  const [fadeIn, setFadeIn] = useState(false);
  
  // Create New menu state
  const [createMenuAnchor, setCreateMenuAnchor] = useState(null);
  const [addExpenseDrawerOpen, setAddExpenseDrawerOpen] = useState(false);
  const [rentReminderOpen, setRentReminderOpen] = useState(false);
  
  // Register with TriggerSummaryContext so bottom nav Plus menu can trigger Generate Summary
  useEffect(() => {
    return registerGenerateSummary(() => navigate('/landlord/portfolio-summary'));
  }, [registerGenerateSummary, navigate]);

  // Reset property selection to "All" on mount
  useEffect(() => {
    dispatch(setProperty(null));
  }, [dispatch]);

  // Trigger fade-in animation on mount - start immediately so components can render
  useEffect(() => {
    // Set fadeIn immediately so components render, even if they start with opacity 0
    setFadeIn(true);
  }, []);

  // Check if user has seen onboarding wizard on first login
  useEffect(() => {
    if (user?.Id || user?.id) {
      // Check HasSeenTutorial from user object (handle both case variations)
      const hasSeenTutorial = user?.HasSeenTutorial || user?.hasSeenTutorial || false;
      
      if (!hasSeenTutorial) {
        // Small delay to ensure dashboard is loaded
        const timer = setTimeout(() => {
          setShowOnboardingWizard(true);
        }, 1000);
        return () => clearTimeout(timer);
      }
    }
  }, [user, userId]);


  // Check if subscription is orphaned and show modal (but not during trial)
  useEffect(() => {
    if (!subLoading && subscription && subscription.isOrphaned && subscription.status !== 'Trial') {
      setOrphanedModalOpen(true);
    }
  }, [subscription, subLoading]);

  // Handle lease completion - reopen wizard if tutorial not seen
  useEffect(() => {
    const leaseCompleted = searchParams.get('leaseCompleted');
    if (leaseCompleted === 'true') {
      const hasSeenTutorial = user?.HasSeenTutorial || user?.hasSeenTutorial || false;
      if (!hasSeenTutorial) {
        // Remove query parameter
        setSearchParams({});
        // Refresh properties to get updated lease data
        propertiesRefetch();
        // Small delay to ensure data is loaded, then reopen wizard
        setTimeout(() => {
          setShowOnboardingWizard(true);
        }, 500);
      } else {
        // Remove query parameter
        setSearchParams({});
      }
    }
  }, [searchParams, setSearchParams, user, propertiesRefetch]);

  const handleOnboardingWizardClose = () => {
    setShowOnboardingWizard(false);
  };

  // Function to fetch profitability data
  const fetchProfitabilityData = async (startDate, endDate) => {
    setProfitabilityLoading(true);
    try {
      // OrganizationId is sent via X-Organization-Id header
      const response = await expenseAPI.getPropertyProfitability({
        propertyId: null,
        startDate,
        endDate
      });
      // Handle ServiceResponse structure - data might be in response.data.data or response.data
      if (response?.data?.data !== undefined) {
        setProfitabilityData(response.data.data || []);
      } else if (response?.data !== undefined && Array.isArray(response.data)) {
        setProfitabilityData(response.data);
      } else {
        setProfitabilityData([]);
      }
    } catch (error) {
      console.error('Error fetching property profitability:', error);
      setProfitabilityData([]);
    } finally {
      setProfitabilityLoading(false);
    }
  };


  // Fetch rent collection data (both current and lifetime) once on mount and when user changes
  useEffect(() => {
    if (!userId) return;

    // Fetch current month data (lifetime=false) - OrganizationId sent via header
    dispatch(getRentCollection(null, false));
    // Fetch lifetime data (lifetime=true)
    dispatch(getRentCollection(null, true));

    // Fetch property profitability data (lifetime) - OrganizationId sent via header
    fetchProfitabilityData(null, null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userId, dispatch]);

  const [refreshing, setRefreshing] = useState(false);

  const handleRefresh = async () => {
    setRefreshing(true);
    try {
      await Promise.all([
        propertiesRefetch(),
        refetchDashboardSummary(),
        dispatch(getRentCollection(null, false)),
        dispatch(getRentCollection(null, true)),
        refetchExpenses(),
        refetchNotifications(),
        fetchProfitabilityData(null, null)
      ]);
    } catch (error) {
      console.error('Error refreshing dashboard:', error);
    } finally {
      setRefreshing(false);
    }
  };

  const handleAddLease = () => {
    navigate('/landlord/leases');
  };

  const handleAddProperty = () => {
    drawer.openPropertyAddWorkflowDrawer();
  };

  const handleAddExpense = () => {
    navigate('/landlord/property-portfolio');
  };


  const handleCreateCheckoutSession = async (plan, billingCycle) => {
    try {
      setCheckoutLoading(true);
      
      const successUrl = `${window.location.origin}/landlord/subscription?success=true`;
      const cancelUrl = `${window.location.origin}/landlord/dashboard?canceled=true`;

      const response = await subscriptionAPI.createCheckoutSession(
        plan.id,
        billingCycle,
        successUrl,
        cancelUrl
      );

      if (response.success && response.data) {
        // Redirect to Stripe Checkout
        window.location.href = response.data;
      } else {
        openSnackbar({
          open: true,
          message: response.message || 'Failed to create checkout session',
          variant: 'alert',
          alert: { color: 'error' }
        });
        setCheckoutLoading(false);
      }
    } catch (error) {
      console.error('Error creating checkout session:', error);
      openSnackbar({
        open: true,
        message: 'Failed to start checkout process',
        variant: 'alert',
        alert: { color: 'error' }
      });
      setCheckoutLoading(false);
    }
  };

  const handleFixOrphanedSubscription = async () => {
    if (!subscription || !subscription.plan) {
      setOrphanedModalOpen(false);
      return;
    }

    // Get the current plan and billing cycle from the subscription
    const currentPlan = plans?.find(p => p.id === subscription.plan.id);
    const currentBillingCycle = subscription.billingCycle || 'Monthly';

    if (!currentPlan) {
      openSnackbar({
        open: true,
        message: 'Could not find current subscription plan',
        variant: 'alert',
        alert: { color: 'error' }
      });
      setOrphanedModalOpen(false);
      return;
    }

    // Close modal before redirect (if successful, redirect will happen; if error, modal already closed)
    setOrphanedModalOpen(false);
    
    // Trigger the checkout flow for the current plan (same as selecting it)
    await handleCreateCheckoutSession(currentPlan, currentBillingCycle);
  };

  const handleCreateMenuOpen = (event) => {
    setCreateMenuAnchor(event.currentTarget);
  };

  const handleCreateMenuClose = () => {
    setCreateMenuAnchor(null);
  };

  const handleCreateMenuItemClick = (action) => {
    handleCreateMenuClose();
    
    switch (action) {
      case 'property':
        drawer.openPropertyAddWorkflowDrawer();
        break;
      case 'lease':
        navigate('/landlord/leases/selection');
        break;
      case 'lease-agreement':
        navigate('/landlord/lease-builder');
        break;
      case 'payment':
        drawer.openPaymentAddDrawer();
        break;
      case 'expense':
        setAddExpenseDrawerOpen(true);
        break;
      case 'maintenance':
        navigate('/landlord/maintenances/add');
        break;
      default:
        break;
    }
  };


  return (
    <>
      <Fade in={fadeIn} timeout={600}>
        <Box
          sx={(t) =>
            t.palette.mode === 'light'
              ? {
                  '& .MuiCard-root': {
                    boxShadow: 'none'
                  },
                  '& .MuiCard-root:hover': {
                    boxShadow: 'none'
                  }
                }
              : undefined
          }
        >
          <Grid 
            container 
            spacing={2.5} 
            sx={isTrialExpired ? { filter: 'blur(4px)', pointerEvents: 'none', userSelect: 'none' } : {}}
          >
        {/* Header Section */}
        <Grid size={12}>
          <AnimateIn direction="bottom" delay={100} distance={120}>
            <Box sx={{ mt: { xs: 2, sm: 2, md: 0 } }}>
              <DashboardHeader
                userName={user?.firstname || user?.Firstname}
                subscription={subscription}
                subscriptionLoading={subLoading}
                summaryText={headerSummaryText}
                onCreateNew={null}
              />
            </Box>
          </AnimateIn>
        </Grid>

        {/* Row: Quick action cards */}
        <Grid size={12}>
          <AnimateIn direction="bottom" delay={200} distance={120}>
            <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', sm: 'repeat(2,1fr)', md: 'repeat(4,1fr)' }, gap: 1.5 }}>
              {[
                {
                  icon: <DollarCircleOutlined style={{ fontSize: 22 }} />,
                  label: 'Record Payment',
                  sub: 'Log a rent payment',
                  color: theme.palette.primary.main,
                  onClick: () => drawer.openPaymentAddDrawer()
                },
                {
                  icon: <WalletOutlined style={{ fontSize: 22 }} />,
                  label: 'Add Expense',
                  sub: 'Log a property expense',
                  color: theme.palette.primary.main,
                  onClick: () => setAddExpenseDrawerOpen(true)
                },
                {
                  icon: <ToolOutlined style={{ fontSize: 22 }} />,
                  label: 'Create Maintenance',
                  sub: 'Submit a new ticket',
                  color: theme.palette.primary.main,
                  onClick: () => drawer.openMaintenanceAddDrawer()
                },
                {
                  icon: <MessageOutlined style={{ fontSize: 22 }} />,
                  label: 'Send Rent Reminder',
                  sub: 'Remind tenants to pay',
                  color: theme.palette.primary.main,
                  onClick: () => setRentReminderOpen(true)
                },
              ].map((action) => (
                <Tooltip key={action.label} title={action.sub} arrow placement="top">
                  <Box
                    onClick={action.onClick}
                    sx={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: 1.5,
                      p: 2,
                      borderRadius: 2.25,
                      bgcolor: 'background.paper',
                      backgroundImage: (t) => t.palette.mode === 'dark'
                        ? `linear-gradient(180deg, ${alpha('#ffffff', 0.045)} 0%, ${alpha('#ffffff', 0.006)} 100%)`
                        : 'none',
                      border: (t) => `1px solid ${t.palette.mode === 'dark' ? alpha('#cbd5e1', 0.2) : alpha(t.palette.common.black, 0.08)}`,
                      cursor: 'pointer',
                      transition: 'all 0.18s ease',
                      '&:hover': {
                        transform: 'translateY(-2px)',
                        boxShadow: `0 10px 26px ${alpha(action.color, theme.palette.mode === 'dark' ? 0.2 : 0.18)}`,
                        borderColor: alpha(action.color, theme.palette.mode === 'dark' ? 0.48 : 0.3),
                        bgcolor: (t) => t.palette.mode === 'dark' ? alpha(action.color, 0.08) : 'background.paper'
                      }
                    }}
                  >
                    <Box sx={{
                      width: 40, height: 40, borderRadius: 1.5, flexShrink: 0,
                      bgcolor: alpha(action.color, theme.palette.mode === 'dark' ? 0.16 : 0.1),
                      border: `1px solid ${alpha(action.color, theme.palette.mode === 'dark' ? 0.22 : 0.08)}`,
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      color: action.color
                    }}>
                      {action.icon}
                    </Box>
                    <Typography variant="body2" fontWeight={700} noWrap sx={{ minWidth: 0, lineHeight: 1.3, fontSize: '0.95rem' }}>
                      {action.label}
                    </Typography>
                  </Box>
                </Tooltip>
              ))}
            </Box>
          </AnimateIn>
        </Grid>

        {/* Row: Money Summary + Recent Money Activity */}
        <Grid size={{ xs: 12, md: 7 }} sx={{ display: 'flex', flexDirection: 'column' }}>
          <AnimateIn direction="bottom" delay={250} distance={120} style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
            <MoneySummary summary={summary} lifetimeSummary={lifetimeSummary} totalExpenses={totalExpenses} allPayments={allPayments} />
          </AnimateIn>
        </Grid>
        <Grid size={{ xs: 12, md: 5 }} sx={{ display: 'flex', flexDirection: 'column' }}>
          <AnimateIn direction="bottom" delay={250} distance={120} style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
            <PaymentsCard />
          </AnimateIn>
        </Grid>

        {/* Row: Needs Your Attention + On the Horizon */}
        <Grid size={{ xs: 12, md: 7 }} sx={{ display: 'flex', flexDirection: 'column' }}>
          <AnimateIn direction="bottom" delay={350} distance={120} style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
            <TodaysPriorities properties={properties} summary={summary} allPayments={allPayments} />
          </AnimateIn>
        </Grid>
        <Grid size={{ xs: 12, md: 5 }} sx={{ display: 'flex', flexDirection: 'column' }}>
          <AnimateIn direction="bottom" delay={350} distance={120} style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
            <OnTheHorizon />
          </AnimateIn>
        </Grid>

        {/* Row: At a Glance + Portfolio Snapshot */}
        <Grid size={{ xs: 12, md: 7 }} sx={{ display: 'flex', flexDirection: 'column' }}>
          <AnimateIn direction="bottom" delay={450} distance={120} style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
            <AtAGlance properties={properties} onAddProperty={drawer.openPropertyAddWorkflowDrawer} />
          </AnimateIn>
        </Grid>
        <Grid size={{ xs: 12, md: 5 }} sx={{ display: 'flex', flexDirection: 'column' }}>
          <AnimateIn direction="bottom" delay={450} distance={120} style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
            <PortfolioHealthSummary
              properties={properties}
              summary={summary}
              totalExpenses={totalExpenses}
            />
          </AnimateIn>
        </Grid>
          </Grid>
        </Box>
      </Fade>

      {/* Quick Actions dropdown */}
      <Menu
        anchorEl={createMenuAnchor}
        open={Boolean(createMenuAnchor)}
        onClose={handleCreateMenuClose}
        slots={{ transition: Grow }}
        slotProps={{ transition: { style: { transformOrigin: 'left top' }, timeout: 180 } }}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'left' }}
        transformOrigin={{ vertical: 'top', horizontal: 'left' }}
        PaperProps={{
          sx: {
            mt: 1,
            minWidth: 220,
            borderRadius: 2,
            background: (t) => `linear-gradient(145deg, ${t.palette.primary.dark} 0%, ${t.palette.primary.main} 100%)`,
            boxShadow: (t) => `0 8px 24px ${alpha(t.palette.primary.main, 0.35)}`,
            py: 0.5,
            '& .MuiMenuItem-root': { color: '#fff', '&:hover': { bgcolor: 'rgba(255,255,255,0.12)' } },
            '& .MuiDivider-root': { borderColor: 'rgba(255,255,255,0.2)' }
          }
        }}
      >
        <MenuItem onClick={() => handleCreateMenuItemClick('property')} sx={{ py: 1.25, px: 2 }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <HomeOutlined style={{ fontSize: 16, color: '#fff' }} />
            Add Property
          </Box>
        </MenuItem>
        <MenuItem onClick={() => handleCreateMenuItemClick('expense')} sx={{ py: 1.25, px: 2 }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <WalletOutlined style={{ fontSize: 16, color: '#fff' }} />
            Add an Expense
          </Box>
        </MenuItem>
        <MenuItem onClick={() => { handleCreateMenuClose(); navigate('/landlord/expenses'); }} sx={{ py: 1.25, px: 2 }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <UnorderedListOutlined style={{ fontSize: 16, color: '#fff' }} />
            View Expenses
          </Box>
        </MenuItem>
        <MenuItem onClick={() => handleCreateMenuItemClick('payment')} sx={{ py: 1.25, px: 2 }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <DollarCircleOutlined style={{ fontSize: 16, color: '#fff' }} />
            Add Payment
          </Box>
        </MenuItem>
        <MenuItem onClick={() => handleCreateMenuItemClick('maintenance')} sx={{ py: 1.25, px: 2 }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <ToolOutlined style={{ fontSize: 16, color: '#fff' }} />
            Create Maintenance Request
          </Box>
        </MenuItem>
        <MenuItem onClick={() => { handleCreateMenuClose(); navigate('/landlord/leases?view=renewals'); }} sx={{ py: 1.25, px: 2 }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <FileTextOutlined style={{ fontSize: 16, color: '#fff' }} />
            Renew a Lease
          </Box>
        </MenuItem>
        <Divider sx={{ my: 0.5 }} />
        <MenuItem onClick={() => { handleCreateMenuClose(); navigate('/landlord/messages'); }} sx={{ py: 1.25, px: 2 }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <MessageOutlined style={{ fontSize: 16, color: '#fff' }} />
            Send a Message
          </Box>
        </MenuItem>
        <MenuItem onClick={() => { handleCreateMenuClose(); navigate('/landlord/rent-collection'); }} sx={{ py: 1.25, px: 2 }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <DollarOutlined style={{ fontSize: 16, color: '#fff' }} />
            View Rent Collection
          </Box>
        </MenuItem>
        <MenuItem onClick={() => { handleCreateMenuClose(); navigate('/landlord/reports'); }} sx={{ py: 1.25, px: 2 }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <BarChartOutlined style={{ fontSize: 16, color: '#fff' }} />
            Generate Report
          </Box>
        </MenuItem>
      </Menu>

      <LandlordMaintenanceDrawer
        onAddSuccess={async () => {
          await refetchDashboardSummary();
          await propertiesRefetch();
        }}
      />
      <LeaseAddDrawer />
      <LeaseViewDrawer />
      <TenantAddDrawer />
      <AddTenantDialog 
        open={addTenantDialogOpen}
        onClose={() => setAddTenantDialogOpen(false)}
        onSuccess={(tenant, shouldReopenWizard) => {
          // Refresh data after tenant is added
          propertiesRefetch();
          refetchDashboardSummary();
          
          // Reopen wizard if user hasn't seen tutorial
          if (shouldReopenWizard) {
            const hasSeenTutorial = user?.HasSeenTutorial || user?.hasSeenTutorial || false;
            if (!hasSeenTutorial) {
              // Small delay to ensure tenant is saved and UI updates
              setTimeout(() => {
                setShowOnboardingWizard(true);
              }, 500);
            }
          }
        }}
      />
      <OnboardingWizard 
        open={showOnboardingWizard}
        onClose={handleOnboardingWizardClose}
        onStartSetupTasks={() => setSetupTasksOpen(true)}
      />
      <FinishSetup
        open={setupTasksOpen}
        onOpen={() => setSetupTasksOpen(true)}
        onClose={() => setSetupTasksOpen(false)}
        steps={setupState.steps}
        showButton={false}
      />
      
      {/* Orphaned Subscription Modal */}
      <OrphanedSubscriptionModal
        open={orphanedModalOpen}
        onClose={() => setOrphanedModalOpen(false)}
        onFix={handleFixOrphanedSubscription}
        subscription={subscription}
        loading={checkoutLoading}
      />
      
      
      {/* Send Rent Reminder Drawer */}
      <SendRentReminderDrawer
        open={rentReminderOpen}
        onClose={() => setRentReminderOpen(false)}
        rentRecords={rentRecords}
      />

      {/* Add Expense Drawer */}
      <ExpenseAddDrawer
        open={addExpenseDrawerOpen}
        onClose={() => setAddExpenseDrawerOpen(false)}
        onSuccess={() => {
          refetchExpenses();
        }}
      />

      {/* Trial Expired Overlay */}
      {isTrialExpired && (
        <Box
          sx={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'flex-start',
            bgcolor: alpha(theme.palette.background.paper, 0.85),
            backdropFilter: 'blur(8px)',
            zIndex: 1300,
            p: 4,
            pt: 8
          }}
        >
          <Box
            sx={{
              textAlign: 'center',
              maxWidth: 500,
              p: 4,
              borderRadius: 2,
              bgcolor: theme.palette.background.paper,
              boxShadow: `0 8px 32px ${alpha(theme.palette.common.black, 0.15)}`,
              border: `1px solid ${alpha(theme.palette.divider, 0.1)}`
            }}
          >
            <WarningOutlined style={{ fontSize: 64, color: theme.palette.error.main, marginBottom: 16 }} />
            <Typography variant="h4" fontWeight={700} gutterBottom>
              Trial Expired
            </Typography>
            <Typography variant="body1" color="text.secondary" sx={{ mb: 3 }}>
              Your free trial has ended. Please select a subscription plan to continue using Property Peace.
            </Typography>
            <Button
              variant="contained"
              color="primary"
              size="large"
              onClick={() => navigate('/landlord/subscription')}
              sx={{
                textTransform: 'none',
                fontWeight: 600,
                px: 4,
                py: 1.5,
                borderRadius: 1.5,
                boxShadow: `0 4px 12px ${alpha(theme.palette.primary.main, 0.3)}`,
                '&:hover': {
                  boxShadow: `0 6px 16px ${alpha(theme.palette.primary.main, 0.4)}`
                }
              }}
            >
              Select a Plan
            </Button>
          </Box>
        </Box>
      )}
    </>
  );
}
