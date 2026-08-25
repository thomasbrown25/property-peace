import { useEffect, useState, useMemo } from 'react';
import { useDashboardLoading } from 'contexts/DashboardLoadingContext';
import { useOrganization } from 'contexts/OrganizationContext';
import { activationModeStorage, readActivationModePreference } from 'utils/activationModePreference';

// material-ui
import { Divider, Grid, Link, Stack, Fade, Menu, MenuItem, Tooltip, IconButton, Collapse } from '@mui/material';
import { Box, Typography } from '@mui/material';
import { Grow } from '@mui/material';
import OrphanedSubscriptionModal from 'components/subscription/OrphanedSubscriptionModal';
import AnimateIn from 'components/AnimateIn';

// sections
import PropertySelect from 'components/PropertySelect';
import QuickActions from 'sections/landlord/dashboard/QuickActions';
import EnhancedQuickActions from 'sections/landlord/dashboard/EnhancedQuickActions';
import PaymentsCard from 'sections/landlord/dashboard/PaymentsCard';
import OnTheHorizon from 'sections/landlord/dashboard/OnTheHorizon';
import DashboardHeader from 'sections/landlord/dashboard/DashboardHeader';
import TodaysPriorities from 'sections/landlord/dashboard/TodaysPriorities';
import UrgentMessages from 'sections/landlord/dashboard/UrgentMessages';
import PropertyProfitability from 'sections/landlord/dashboard/PropertyProfitability';
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
import useFetchDashboardSummary from 'hooks/useFetchDashboard';
import useFetchAllTenants from 'hooks/useFetchAllTenants';
import useFetchAllPayments from 'hooks/useFetchAllPayments';
import { selectAllPayments } from 'store/payment/payment.selector';
import RentRevenueChart from '../../components/charts/RentRevenueChart';
import { getRentCollection } from 'store/rent-collection/rent-collection.action';
import useFetchExpenses from 'hooks/useFetchExpenses';
import useFetchNotifications from 'hooks/useFetchNotifications';
import useLandlordSetupSteps from 'hooks/useLandlordSetupSteps';
import { useNavigate } from 'react-router-dom';
import { expenseAPI } from 'api';
import { useSubscription, useSubscriptionPlans, useSubscriptionStatus } from 'hooks/useSubscription';
import { subscriptionAPI } from 'api';
import { openSnackbar } from 'api/snackbar';
import axiosServices from 'utils/axios';
import { alpha, useTheme, Button, useMediaQuery } from '@mui/material';
import { isOpenMaintenanceRequest } from 'utils/maintenanceStatus';
import { normalizeRentBalance } from 'utils/rentBalance';
import { WarningOutlined, DollarCircleOutlined, RocketOutlined, ThunderboltOutlined, SettingOutlined, HomeOutlined, WalletOutlined, UnorderedListOutlined, ToolOutlined, FileTextOutlined, BarChartOutlined, MessageOutlined, DollarOutlined, DownOutlined } from '@ant-design/icons';

// ==============================|| LANDLORD - DASHBOARD ||============================== //

export default function Dashboard() {
  const { user } = useAuth();
  const { currentOrganization } = useOrganization();
  const drawer = useDrawer();
  const dispatch = useDispatch();
  const navigate = useNavigate();


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
  const { notificationsLoading } = useFetchNotifications();
  const { isLoading: tenantsLoading } = useFetchAllTenants();
  const tenants = useSelector(selectTenants);
  useFetchAllPayments();
  const allPayments = useSelector(selectAllPayments);
  const { subscription, loading: subLoading } = useSubscription();
  const { plans } = useSubscriptionPlans();
  const { status: subscriptionStatus } = useSubscriptionStatus();
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('sm'));
  const { registerGenerateSummary } = useTriggerSummary();

  // Compute dashboard summary sentence for the header
  const dashboardSummaryData = useSelector(selectDashboardSummary);
  const allMaintenanceRequests = dashboardSummaryData?.maintenanceRequests?.maintenanceRequests || [];
  const headerSummaryText = useMemo(() => {
    let attentionCount = 0;
    // Count the canonical grace-aware rent obligations rather than the persisted unit status.
    attentionCount += (rentRecords || []).filter((record) => normalizeRentBalance(record).rentDueIsOverdue).length;
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
  }, [properties, allMaintenanceRequests, rentRecords]);

  const dashboardStats = useMemo(() => {
    const propertyCount = properties?.length || 0;
    const units = (properties || []).flatMap((property) => property.units || property.Units || []);
    const occupiedUnits = units.filter((unit) => {
      const status = (unit.status || unit.Status || '').toLowerCase();
      return status === 'occupied' || status === 'overdue';
    }).length;
    const openMaintenance = allMaintenanceRequests.filter(isOpenMaintenanceRequest).length;
    const expected = Number(summary?.expectedThisMonth || 0);
    const collected = Number(summary?.collectedThisMonth || 0);
    const collectionRate = expected > 0 ? `${Math.min(100, Math.round((collected / expected) * 100))}%` : '—';

    return [
      { label: propertyCount === 1 ? 'Property' : 'Properties', value: propertyCount },
      { label: 'Occupied units', value: units.length ? `${occupiedUnits}/${units.length}` : '—' },
      { label: 'Open maintenance', value: openMaintenance },
      { label: 'Rent collected', value: collectionRate }
    ];
  }, [properties, allMaintenanceRequests, summary]);

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

  const setupOrganizationId = currentOrganization?.id ?? currentOrganization?.Id ?? null;
  const setupMode = readActivationModePreference(activationModeStorage(typeof window === 'undefined' ? null : window), setupOrganizationId);
  const setupState = useLandlordSetupSteps({ mode: setupMode });
  
  // Add tenant dialog state
  const [addTenantDialogOpen, setAddTenantDialogOpen] = useState(false);
  
  // Orphaned subscription modal state
  const [orphanedModalOpen, setOrphanedModalOpen] = useState(false);
  const [checkoutLoading, setCheckoutLoading] = useState(false);
  
  // Fade-in animation state
  const [fadeIn, setFadeIn] = useState(false);
  
  // Create New menu state
  const [createMenuAnchor, setCreateMenuAnchor] = useState(null);
  const [quickActionsOpen, setQuickActionsOpen] = useState(false);
  const [addExpenseDrawerOpen, setAddExpenseDrawerOpen] = useState(false);
  
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


  // Check if subscription is orphaned and show modal (but not during trial)
  useEffect(() => {
    if (!subLoading && subscription && subscription.isOrphaned && subscription.status !== 'Trial') {
      setOrphanedModalOpen(true);
    }
  }, [subscription, subLoading]);


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
      
      const successUrl = `${window.location.origin}/landlord/settings?tab=subscription&success=true`;
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

  const quickActions = [
    {
      icon: <DollarCircleOutlined style={{ fontSize: 18 }} />,
      label: 'Record Payment',
      sub: 'Log rent paid',
      color: theme.palette.success.main,
      onClick: () => drawer.openPaymentAddDrawer()
    },
    {
      icon: <WalletOutlined style={{ fontSize: 18 }} />,
      label: 'Add Expense',
      sub: 'Track a cost',
      color: theme.palette.primary.main,
      onClick: () => setAddExpenseDrawerOpen(true)
    },
    {
      icon: <ToolOutlined style={{ fontSize: 18 }} />,
      label: 'Maintenance',
      sub: 'Create ticket',
      color: theme.palette.warning.main,
      onClick: () => drawer.openMaintenanceAddDrawer()
    },
    {
      icon: <MessageOutlined style={{ fontSize: 18 }} />,
      label: 'Rent Collection',
      sub: 'Review balances',
      color: theme.palette.info.main,
      onClick: () => navigate('/landlord/rent-collection')
    }
  ];

  const handleQuickActionClick = (action) => {
    setQuickActionsOpen(false);
    action.onClick();
  };

  const showSetupCard = setupState.loading
    || Boolean(setupState.error)
    || !setupState.viewModel.available
    || setupState.viewModel.progress.completed < setupState.viewModel.progress.total;

  return (
    <>
      <Fade in={fadeIn} timeout={600}>
        <Box
          sx={(t) =>
            t.palette.mode === 'light'
              ? {
                  '& .MuiCard-root': {
                    borderColor: alpha('#061e35', 0.09),
                    boxShadow: `0 12px 34px ${alpha('#061e35', 0.065)}`
                  },
                  '& .MuiCard-root:hover': {
                    boxShadow: `0 16px 40px ${alpha('#061e35', 0.09)}`
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
                summaryText={headerSummaryText}
                stats={dashboardStats}
                onCreateNew={handleCreateMenuOpen}
              />
            </Box>
          </AnimateIn>
        </Grid>

        {showSetupCard && (
          <Grid size={12}>
            <FinishSetup setup={setupState} />
          </Grid>
        )}

        {/* Main dashboard columns */}
        <Grid size={12}>
          <Grid container spacing={2.5} alignItems="stretch">
            <Grid size={{ xs: 12, md: 4 }} sx={{ display: 'flex', flexDirection: 'column' }}>
              <Stack spacing={2.5} sx={{ width: '100%' }}>
                {isMobile ? (
                  <Box>
                    <Button
                      id="mobile-dashboard-quick-actions-button"
                      fullWidth
                      variant="outlined"
                      startIcon={<ThunderboltOutlined />}
                      endIcon={<DownOutlined />}
                      onClick={() => setQuickActionsOpen((open) => !open)}
                      aria-controls={quickActionsOpen ? 'mobile-dashboard-quick-actions-menu' : undefined}
                      aria-haspopup="true"
                      aria-expanded={quickActionsOpen}
                      sx={{
                        minHeight: 52,
                        justifyContent: 'flex-start',
                        px: 2,
                        borderRadius: 1.75,
                        borderColor: alpha('#061e35', 0.14),
                        bgcolor: '#ffffff',
                        color: '#061e35',
                        fontWeight: 800,
                        textTransform: 'none',
                        boxShadow: `0 10px 26px ${alpha('#061e35', 0.09)}`,
                        transition: 'border-color 180ms ease, box-shadow 180ms ease, background-color 180ms ease',
                        '& .MuiButton-endIcon': {
                          ml: 'auto',
                          transform: quickActionsOpen ? 'rotate(180deg)' : 'rotate(0deg)',
                          transition: 'transform 280ms cubic-bezier(0.4, 0, 0.2, 1)'
                        },
                        '&:hover': {
                          borderColor: alpha('#061e35', 0.24),
                          bgcolor: '#ffffff',
                          boxShadow: `0 12px 30px ${alpha('#061e35', 0.12)}`
                        }
                      }}
                    >
                      Quick actions
                    </Button>

                    <Collapse
                      in={quickActionsOpen}
                      timeout={320}
                      easing={{ enter: 'cubic-bezier(0.22, 1, 0.36, 1)', exit: 'cubic-bezier(0.4, 0, 0.2, 1)' }}
                      unmountOnExit
                    >
                      <Box
                        id="mobile-dashboard-quick-actions-menu"
                        role="menu"
                        aria-labelledby="mobile-dashboard-quick-actions-button"
                        sx={{
                          mt: 1,
                          p: 0.75,
                          borderRadius: 2,
                          bgcolor: '#f8fafc',
                          border: `1px solid ${alpha('#061e35', 0.1)}`,
                          boxShadow: `0 14px 34px ${alpha('#061e35', 0.1)}`
                        }}
                      >
                        <Stack spacing={0.75}>
                          {quickActions.map((action) => (
                            <Box
                              key={action.label}
                              component="button"
                              type="button"
                              role="menuitem"
                              onClick={() => handleQuickActionClick(action)}
                              sx={{
                                width: '100%',
                                minHeight: 54,
                                px: 1.25,
                                py: 0.85,
                                display: 'flex',
                                alignItems: 'center',
                                borderRadius: 1.5,
                                border: `1px solid ${alpha('#061e35', 0.1)}`,
                                bgcolor: '#ffffff',
                                color: '#061e35',
                                textAlign: 'left',
                                cursor: 'pointer',
                                boxShadow: `0 4px 12px ${alpha('#061e35', 0.045)}`,
                                transition: 'transform 160ms ease, border-color 160ms ease, box-shadow 160ms ease',
                                '&:active': { transform: 'scale(0.985)' },
                                '&:focus-visible': {
                                  outline: `2px solid ${alpha('#061e35', 0.42)}`,
                                  outlineOffset: 2
                                }
                              }}
                            >
                              <Box
                                sx={{
                                  width: 34,
                                  height: 34,
                                  mr: 1.25,
                                  flexShrink: 0,
                                  display: 'flex',
                                  alignItems: 'center',
                                  justifyContent: 'center',
                                  borderRadius: 1.15,
                                  color: action.color,
                                  bgcolor: alpha(action.color, 0.12)
                                }}
                              >
                                {action.icon}
                              </Box>
                              <Box sx={{ minWidth: 0 }}>
                                <Typography variant="body2" fontWeight={800} sx={{ color: '#061e35', lineHeight: 1.2 }}>
                                  {action.label}
                                </Typography>
                                <Typography variant="caption" sx={{ color: alpha('#061e35', 0.68) }}>
                                  {action.sub}
                                </Typography>
                              </Box>
                            </Box>
                          ))}
                        </Stack>
                      </Box>
                    </Collapse>
                  </Box>
                ) : (
                <Box
                  sx={{
                    display: 'flex',
                    flexDirection: 'column',
                    p: 2,
                    borderRadius: 2.5,
                    border: `1px solid ${alpha('#061e35', 0.09)}`,
                    bgcolor: 'background.paper',
                    boxShadow: `0 12px 34px ${alpha('#061e35', 0.06)}`
                  }}
                >
                    <Typography variant="h5" fontWeight={750} sx={{ mb: 1.5, color: '#061e35' }}>
                      Quick actions
                    </Typography>
                    <Stack spacing={1}>
                      {quickActions.map((action) => (
                        <Box
                          key={action.label}
                          component="button"
                          type="button"
                          onClick={action.onClick}
                          sx={() => ({
                            width: '100%',
                            minHeight: 52,
                            px: 1.25,
                            py: 1,
                            border: `1px solid ${alpha('#94a3b8', 0.45)}`,
                            borderRadius: 1.75,
                            textAlign: 'left',
                            cursor: 'pointer',
                            color: '#061e35',
                            bgcolor: '#ffffff',
                            backgroundImage: 'none',
                            transition: 'transform 160ms ease, box-shadow 160ms ease, border-color 160ms ease, background 160ms ease',
                            '&:hover': {
                              transform: 'translateX(3px)',
                              borderColor: alpha(theme.palette.success.main, 0.55),
                              boxShadow: `0 8px 18px ${alpha('#061e35', 0.09)}`,
                              bgcolor: alpha(theme.palette.success.main, 0.045)
                            },
                            '&:focus-visible': {
                              outline: `2px solid ${alpha('#061e35', 0.45)}`,
                              outlineOffset: 2
                            }
                          })}
                        >
                          <Stack direction="row" spacing={1.15} alignItems="center">
                            <Box
                              sx={() => ({
                                width: 30,
                                height: 30,
                                borderRadius: 1.25,
                                flexShrink: 0,
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                color: '#061e35',
                                bgcolor: alpha('#061e35', 0.08)
                              })}
                            >
                              {action.icon}
                            </Box>
                            <Box sx={{ minWidth: 0 }}>
                              <Typography variant="body2" fontWeight={800} noWrap sx={{ lineHeight: 1.15, color: '#061e35' }}>
                                {action.label}
                              </Typography>
                              <Typography variant="caption" noWrap sx={{ display: 'block', mt: 0.2, color: alpha('#061e35', 0.78) }}>
                                {action.sub}
                              </Typography>
                            </Box>
                          </Stack>
                        </Box>
                      ))}
                    </Stack>
                </Box>
                )}
                {!isMobile && <PaymentsCard />}
              </Stack>
            </Grid>

            <Grid size={{ xs: 12, md: 8 }} sx={{ display: 'flex', flexDirection: 'column' }}>
              <Stack spacing={2.5} sx={{ width: '100%', height: '100%' }}>
                <AnimateIn direction="bottom" delay={250} distance={120} style={{ display: 'flex', flexDirection: 'column' }}>
                  <MoneySummary summary={summary} lifetimeSummary={lifetimeSummary} totalExpenses={totalExpenses} allPayments={allPayments} />
                </AnimateIn>
                <AnimateIn direction="bottom" delay={350} distance={120} style={{ display: 'flex', flexDirection: 'column' }}>
                  <TodaysPriorities properties={properties} summary={summary} allPayments={allPayments} />
                </AnimateIn>
                <AnimateIn direction="bottom" delay={425} distance={120} style={{ display: 'flex', flexDirection: 'column' }}>
                  <OnTheHorizon />
                </AnimateIn>
              </Stack>
            </Grid>

            {isMobile && (
              <Grid size={12}>
                <AnimateIn direction="bottom" delay={500} distance={120}>
                  <PaymentsCard />
                </AnimateIn>
              </Grid>
            )}
          </Grid>
        </Grid>
          </Grid>
        </Box>
      </Fade>

      {/* Create New dropdown */}
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
            background: '#061e35',
            border: `1px solid ${alpha('#ffffff', 0.12)}`,
            boxShadow: `0 18px 45px ${alpha('#061e35', 0.32)}`,
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
        <MenuItem onClick={() => { handleCreateMenuClose(); navigate('/landlord/finances?tab=expenses'); }} sx={{ py: 1.25, px: 2 }}>
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
        <MenuItem onClick={() => { handleCreateMenuClose(); navigate('/landlord/accounting/tax-center'); }} sx={{ py: 1.25, px: 2 }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <BarChartOutlined style={{ fontSize: 16, color: '#fff' }} />
            Open Tax Center
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
        onSuccess={() => {
          // Refresh data after tenant is added
          propertiesRefetch();
          refetchDashboardSummary();
        }}
      />
      
      {/* Orphaned Subscription Modal */}
      <OrphanedSubscriptionModal
        open={orphanedModalOpen}
        onClose={() => setOrphanedModalOpen(false)}
        onFix={handleFixOrphanedSubscription}
        subscription={subscription}
        loading={checkoutLoading}
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
              Legacy trial ended
            </Typography>
            <Typography variant="body1" color="text.secondary" sx={{ mb: 3 }}>
              Choose the permanent Free plan or Premium to continue using Property Peace.
            </Typography>
            <Button
              variant="contained"
              color="primary"
              size="large"
              onClick={() => navigate('/landlord/settings?tab=subscription')}
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
