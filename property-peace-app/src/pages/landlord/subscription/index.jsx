import { useState, useEffect } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import {
  Box,
  Typography,
  Container,
  Button,
  Stack,
  CircularProgress,
  Alert,
  Menu,
  MenuItem,
  ListItemText,
  Divider,
  Card,
  CardContent
} from '@mui/material';
import { useTheme } from '@mui/material/styles';
import { LinkOutlined, TeamOutlined, DownOutlined, CheckOutlined, CreditCardOutlined, QuestionCircleOutlined, WarningOutlined } from '@ant-design/icons';
import MainCard from 'components/MainCard';
import PageBreadcrumbs from 'components/breadcrumbs/PageBreadcrumbs';
import { useSubscription, useSubscriptionStatus, useSubscriptionPlans } from 'hooks/useSubscription';
import { useOrganization } from 'contexts/OrganizationContext';
import PlanComparisonTable from 'components/subscription/PlanComparisonTable';
import TrialBanner from 'components/subscription/TrialBanner';
import CurrentPlan from './current-plan';
import Billing from './billing';
import { subscriptionAPI } from 'api';
import { openSnackbar } from 'api/snackbar';
import ConfirmationDialog from 'components/dialogs/ConfirmationDialog';
import OrphanedSubscriptionModal from 'components/subscription/OrphanedSubscriptionModal';

export default function Subscription() {
  const theme = useTheme();
  const [searchParams, setSearchParams] = useSearchParams();
  const navigate = useNavigate();
  const [portalLoading, setPortalLoading] = useState(false);
  const [checkoutLoading, setCheckoutLoading] = useState(false);
  const [confirmDialogOpen, setConfirmDialogOpen] = useState(false);
  const [pendingPlan, setPendingPlan] = useState(null);
  const [pendingBillingCycle, setPendingBillingCycle] = useState(null);
  const [pendingAction, setPendingAction] = useState(null);
  const [confirmMessage, setConfirmMessage] = useState('');
  const [orphanedModalOpen, setOrphanedModalOpen] = useState(false);
  const [orgMenuAnchor, setOrgMenuAnchor] = useState(null);
  const [switchingOrg, setSwitchingOrg] = useState(false);

  const { subscription, loading: subLoading, refetch: refetchSubscription } = useSubscription();
  const { status, loading: statusLoading, refetch: refetchStatus } = useSubscriptionStatus();
  const { plans, loading: plansLoading } = useSubscriptionPlans();
  const { currentOrganization, organizations, loading: orgLoading, switchOrganization, refreshOrganizations } = useOrganization();

  useEffect(() => {
    if (!subLoading && subscription && subscription.isOrphaned && subscription.status !== 'Trial') {
      setOrphanedModalOpen(true);
    }
  }, [subscription, subLoading]);

  useEffect(() => {
    const success = searchParams.get('success');
    const canceled = searchParams.get('canceled');

    if (success === 'true') {
      refetchSubscription();
      refetchStatus();
      refreshOrganizations();
      const planName = subscription?.plan?.name || 'your plan';
      navigate(`/landlord/subscription-success?plan=${encodeURIComponent(planName)}`);
    } else if (canceled === 'true') {
      openSnackbar({ open: true, message: 'Checkout was canceled', variant: 'alert', alert: { color: 'info' } });
      setSearchParams({});
    }
  }, [searchParams, setSearchParams, refetchSubscription, refetchStatus, refreshOrganizations, subscription, navigate]);

  if (orgLoading) {
    return (
      <Container maxWidth="xl">
        <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '400px' }}>
          <CircularProgress />
        </Box>
      </Container>
    );
  }

  if (!currentOrganization) {
    return (
      <MainCard>
        <Stack spacing={3}>
          <Box>
            <Typography variant="h3" sx={{ mb: 0.5 }}>Subscription</Typography>
            <Typography variant="body2" color="text.secondary">Create an organization to manage subscriptions</Typography>
          </Box>
          <Alert severity="info">
            You need to be part of an organization to manage subscriptions. Create a new organization to get started.
          </Alert>
          <Button variant="contained" onClick={() => navigate('/landlord/admin-members')} size="small">
            Go to Team Management
          </Button>
        </Stack>
      </MainCard>
    );
  }

  const handlePlanSelected = async (plan, billingCycle) => {
    if (subscription && subscription.isOrphaned && subscription.status !== 'Trial') {
      openSnackbar({ open: true, message: 'Please fix your subscription payment issue before changing plans', variant: 'alert', alert: { color: 'warning' } });
      setOrphanedModalOpen(true);
      return;
    }
    if (subscription && subscription.status === 'Trial') {
      await handleCreateCheckoutSession(plan, billingCycle);
      return;
    }
    if (subscription && subscription.status === 'PaymentPending') {
      openSnackbar({ open: true, message: 'Your payment is being processed. Please wait before making changes.', variant: 'alert', alert: { color: 'warning' } });
      return;
    }
    const isFreePlan = subscription?.plan?.name?.toLowerCase() === 'free';
    const canReactivate = isFreePlan && subscription?.cancelAtPeriodEnd;

    if (!subscription || subscription.status !== 'Active' || (isFreePlan && !canReactivate)) {
      await handleCreateCheckoutSession(plan, billingCycle);
      return;
    }
    if (subscription && subscription.status === 'Active') {
      const currentPlanPrice = subscription.billingCycle === 'Annual'
        ? (subscription.plan?.annualPrice || subscription.plan?.monthlyPrice * 12)
        : (subscription.plan?.monthlyPrice || 0);
      const newPlanPrice = billingCycle === 'Annual'
        ? (plan.annualPrice || plan.monthlyPrice * 12)
        : (plan.monthlyPrice || 0);
      const isUpgrade = newPlanPrice > currentPlanPrice;
      const action = isUpgrade ? 'upgrade' : 'downgrade';
      const planChanged = subscription.plan?.id !== plan.id;
      const billingCycleChanged = subscription.billingCycle !== billingCycle;
      if (!planChanged && !billingCycleChanged) {
        openSnackbar({ open: true, message: 'You are already subscribed to this plan with the same billing cycle', variant: 'alert', alert: { color: 'info' } });
        return;
      }
      let message;
      if (canReactivate) {
        const periodEnd = subscription.currentPeriodEnd
          ? new Date(subscription.currentPeriodEnd).toLocaleDateString()
          : 'the end of your current period';
        message = `Reactivate Premium? No additional charge — your existing billing period continues until ${periodEnd}.`;
      } else {
        const prorationNote = isUpgrade
          ? ' You will be charged immediately for the prorated amount covering the remainder of your current billing period.'
          : ' You will receive a prorated credit for the unused portion of your current plan.';
        message = planChanged && billingCycleChanged
          ? `Are you sure you want to ${action} from ${subscription.plan?.name} (${subscription.billingCycle}) to ${plan.name} (${billingCycle})?${prorationNote}`
          : planChanged
          ? `Are you sure you want to ${action} from ${subscription.plan?.name} to ${plan.name}?${prorationNote}`
          : `Are you sure you want to change your billing cycle from ${subscription.billingCycle} to ${billingCycle}?${prorationNote}`;
      }
      setPendingPlan(plan);
      setPendingBillingCycle(billingCycle);
      setPendingAction(action);
      setConfirmMessage(message);
      setConfirmDialogOpen(true);
    } else {
      await handleCreateCheckoutSession(plan, billingCycle);
    }
  };

  const handleConfirmPlanChange = async () => {
    if (!pendingPlan || !pendingBillingCycle || !pendingAction) return;
    try {
      setCheckoutLoading(true);
      setConfirmDialogOpen(false);
      const response = pendingAction === 'upgrade'
        ? await subscriptionAPI.upgradeSubscription(pendingPlan.id, true, pendingBillingCycle)
        : await subscriptionAPI.downgradeSubscription(pendingPlan.id, true, pendingBillingCycle);
      if (response.success) {
        openSnackbar({ open: true, message: `Subscription ${pendingAction}d successfully!`, variant: 'alert', alert: { color: 'success' } });
        refetchSubscription();
        refetchStatus();
      } else {
        openSnackbar({ open: true, message: response.message || `Failed to ${pendingAction} subscription`, variant: 'alert', alert: { color: 'error' } });
      }
    } catch (error) {
      console.error('Error processing plan change:', error);
      openSnackbar({ open: true, message: error?.message || `Failed to ${pendingAction} subscription`, variant: 'alert', alert: { color: 'error' } });
    } finally {
      setCheckoutLoading(false);
      setPendingPlan(null);
      setPendingBillingCycle(null);
      setPendingAction(null);
      setConfirmMessage('');
    }
  };

  const handleCreateCheckoutSession = async (plan, billingCycle) => {
    try {
      setCheckoutLoading(true);
      const successUrl = `${window.location.origin}/landlord/subscription?success=true`;
      const cancelUrl = `${window.location.origin}/landlord/subscription?canceled=true`;
      const response = await subscriptionAPI.createCheckoutSession(plan.id, billingCycle, successUrl, cancelUrl);
      if (response.success && response.data) {
        window.location.href = response.data;
      } else {
        openSnackbar({ open: true, message: response.message || 'Failed to create checkout session', variant: 'alert', alert: { color: 'error' } });
        setCheckoutLoading(false);
      }
    } catch (error) {
      console.error('Error creating checkout session:', error);
      openSnackbar({ open: true, message: 'Failed to start checkout process', variant: 'alert', alert: { color: 'error' } });
      setCheckoutLoading(false);
    }
  };

  const handleFixOrphanedSubscription = async () => {
    if (!subscription || !subscription.plan) { setOrphanedModalOpen(false); return; }
    const currentPlan = plans?.find((p) => p.id === subscription.plan.id);
    const currentBillingCycle = subscription.billingCycle || 'Monthly';
    if (!currentPlan) {
      openSnackbar({ open: true, message: 'Could not find current subscription plan', variant: 'alert', alert: { color: 'error' } });
      setOrphanedModalOpen(false);
      return;
    }
    setOrphanedModalOpen(false);
    await handleCreateCheckoutSession(currentPlan, currentBillingCycle);
  };

  const handleManageSubscription = async () => {
    try {
      setPortalLoading(true);
      const returnUrl = `${window.location.origin}/landlord/subscription`;
      const response = await subscriptionAPI.createCustomerPortalSession(returnUrl);
      if (response.success && response.data) {
        window.location.href = response.data;
      } else {
        openSnackbar({ open: true, message: response.message || 'Failed to create customer portal session', variant: 'alert', alert: { color: 'error' } });
      }
    } catch (error) {
      console.error('Error creating customer portal session:', error);
      openSnackbar({ open: true, message: 'Failed to open subscription management', variant: 'alert', alert: { color: 'error' } });
    } finally {
      setPortalLoading(false);
    }
  };

  const handleSwitchOrg = async (orgId) => {
    if (orgId === currentOrganization?.id) { setOrgMenuAnchor(null); return; }
    setSwitchingOrg(true);
    setOrgMenuAnchor(null);
    await switchOrganization(orgId);
    setSwitchingOrg(false);
  };

  const isLoading = subLoading || statusLoading || plansLoading;

  if (isLoading) {
    return (
      <Container maxWidth="xl">
        <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '400px' }}>
          <CircularProgress />
        </Box>
      </Container>
    );
  }

  const atUnitLimit = status?.maxTotalUnits != null && status?.currentTotalUnits >= status?.maxTotalUnits;
  const currentPlanId = subscription?.status === 'Trial' || subscription?.status === 'PaymentPending' || subscription?.status === 'Cancelled'
    ? null
    : subscription?.plan?.id;
  const currentBillingCycle = subscription?.status === 'Trial' || subscription?.status === 'PaymentPending' || subscription?.status === 'Cancelled'
    ? null
    : subscription?.billingCycle;

  return (
    <Container maxWidth="xl">
      {/* Header */}
      <Box sx={{ mb: 3 }}>
        <PageBreadcrumbs
          items={[
            { label: 'Dashboard', path: '/landlord/dashboard' },
            { label: 'Subscription' }
          ]}
        />
        <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mt: 1 }}>
          <Box>
            <Typography variant="h3" fontWeight={700}>Subscription</Typography>
            <Typography variant="body2" color="text.secondary">
              Choose the plan that fits your portfolio.
            </Typography>
          </Box>

          <Stack direction="row" spacing={1.5} alignItems="center">
            {subscription && (
              <Button
                variant="outlined"
                onClick={handleManageSubscription}
                disabled={portalLoading}
                startIcon={<LinkOutlined />}
                sx={{ textTransform: 'none', px: 2.5 }}
              >
                {portalLoading ? 'Loading...' : 'Manage Billing'}
              </Button>
            )}
            <Button
              variant="outlined"
              onClick={(e) => setOrgMenuAnchor(e.currentTarget)}
              disabled={switchingOrg}
              endIcon={switchingOrg ? <CircularProgress size={14} /> : <DownOutlined style={{ fontSize: 11 }} />}
              startIcon={<TeamOutlined />}
              sx={{ textTransform: 'none', px: 2.5 }}
            >
              {currentOrganization?.name || 'Select Org'}
            </Button>
            <Menu
              anchorEl={orgMenuAnchor}
              open={Boolean(orgMenuAnchor)}
              onClose={() => setOrgMenuAnchor(null)}
              anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
              transformOrigin={{ vertical: 'top', horizontal: 'right' }}
            >
              {(organizations || []).length === 0 ? (
                <MenuItem disabled><ListItemText primary="No organizations" /></MenuItem>
              ) : (
                (organizations || []).map((org) => (
                  <MenuItem key={org.id} onClick={() => handleSwitchOrg(org.id)} selected={org.id === currentOrganization?.id}>
                    <ListItemText primary={org.name} />
                    {org.id === currentOrganization?.id && (
                      <CheckOutlined style={{ fontSize: 14, marginLeft: 8, opacity: 0.6 }} />
                    )}
                  </MenuItem>
                ))
              )}
              <Divider />
              <MenuItem onClick={() => { setOrgMenuAnchor(null); navigate('/landlord/admin-members'); }}>
                <ListItemText primary="Manage Organizations" primaryTypographyProps={{ variant: 'body2', color: 'primary' }} />
              </MenuItem>
            </Menu>
          </Stack>
        </Stack>
      </Box>

      {/* Two-column layout */}
      <Box sx={{ display: 'flex', gap: 3, alignItems: 'flex-start', flexDirection: { xs: 'column', md: 'row' } }}>

        {/* Left: Plans comparison table */}
        <Box sx={{ flex: 1, minWidth: 0 }} id="plans-section">
          <MainCard>
            {/* Unit limit alert — inside the plans card */}
            {atUnitLimit && (
              <Alert
                severity="error"
                icon={<WarningOutlined />}
                sx={{ mb: 3, alignItems: 'center' }}
                action={
                  <Button
                    variant="contained"
                    color="error"
                    size="small"
                    sx={{ textTransform: 'none', fontWeight: 600, whiteSpace: 'nowrap', borderRadius: 1.5, px: 3 }}
                    onClick={() => document.getElementById('plans-section')?.scrollIntoView({ behavior: 'smooth' })}
                  >
                    Upgrade now →
                  </Button>
                }
              >
                <Typography variant="body2" fontWeight={600}>
                  You&apos;ve hit your unit limit ({status.currentTotalUnits} / {status.maxTotalUnits})
                </Typography>
                <Typography variant="caption" display="block">
                  You won&apos;t be able to add new units until you upgrade.
                </Typography>
              </Alert>
            )}

            {plansLoading ? (
              <Box sx={{ py: 4, textAlign: 'center' }}><CircularProgress /></Box>
            ) : (
              <PlanComparisonTable
                plans={plans}
                currentPlanId={currentPlanId}
                currentBillingCycle={currentBillingCycle}
                onSelectPlan={handlePlanSelected}
                loading={checkoutLoading}
              />
            )}
          </MainCard>
        </Box>

        {/* Right: Sidebar */}
        <Box sx={{ width: { xs: '100%', md: '380px' }, flexShrink: 0 }}>
          <Stack spacing={2}>
            {/* Current Plan card */}
            <MainCard>
              <CurrentPlan
                subscription={subscription}
                loading={subLoading}
                onUpdate={refetchSubscription}
              />
            </MainCard>

            {/* Payment Method card */}
            <Card variant="outlined" sx={{ borderRadius: 2 }}>
              <CardContent sx={{ p: 2.5, '&:last-child': { pb: 2.5 } }}>
                <Typography variant="overline" color="text.secondary" fontWeight={600} sx={{ letterSpacing: 1 }}>
                  Payment Method
                </Typography>
                <Box sx={{ mt: 1.5 }}>
                  {subscription ? (
                    <Button
                      variant="outlined"
                      size="small"
                      startIcon={<CreditCardOutlined />}
                      onClick={handleManageSubscription}
                      disabled={portalLoading}
                      sx={{ textTransform: 'none', borderRadius: 1.5 }}
                    >
                      {portalLoading ? 'Loading...' : 'Manage payment method'}
                    </Button>
                  ) : (
                    <Typography variant="body2" color="text.secondary">
                      No payment method on file.
                    </Typography>
                  )}
                </Box>
              </CardContent>
            </Card>

            {/* Have questions? card */}
            <Card variant="outlined" sx={{ borderRadius: 2 }}>
              <CardContent sx={{ p: 2.5, '&:last-child': { pb: 2.5 } }}>
                <Stack direction="row" spacing={1.5} alignItems="flex-start">
                  <QuestionCircleOutlined style={{ fontSize: 20, marginTop: 2, color: theme.palette.text.secondary }} />
                  <Box>
                    <Typography variant="body1" fontWeight={600}>Have questions?</Typography>
                    <Typography variant="body2" color="text.secondary" sx={{ mb: 1.5 }}>
                      Talk to our team about which plan fits your portfolio.
                    </Typography>
                    <Button
                      variant="outlined"
                      size="small"
                      onClick={() => navigate('/landlord/support/ticket')}
                      sx={{ textTransform: 'none', borderRadius: 1.5 }}
                    >
                      Contact support →
                    </Button>
                  </Box>
                </Stack>
              </CardContent>
            </Card>
          </Stack>
        </Box>
      </Box>

      {/* Billing History */}
      <MainCard sx={{ mt: 3, mb: 3 }}>
        <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 2 }}>
          <Box>
            <Typography variant="overline" color="text.secondary" fontWeight={600} sx={{ letterSpacing: 1 }}>
              Billing History
            </Typography>
            <Typography variant="h6" fontWeight={600}>Invoices</Typography>
          </Box>
          <Button
            size="small"
            variant="text"
            onClick={() => navigate('/landlord/subscription/billing-history')}
            sx={{ textTransform: 'none' }}
          >
            View all →
          </Button>
        </Stack>
        <Billing
          subscription={subscription}
          loading={subLoading}
          onUpdate={refetchSubscription}
          preview
        />
      </MainCard>

      <OrphanedSubscriptionModal
        open={orphanedModalOpen}
        onClose={() => setOrphanedModalOpen(false)}
        onFix={handleFixOrphanedSubscription}
        subscription={subscription}
        loading={checkoutLoading}
      />

      <ConfirmationDialog
        open={confirmDialogOpen}
        onClose={() => {
          setConfirmDialogOpen(false);
          setPendingPlan(null);
          setPendingBillingCycle(null);
          setPendingAction(null);
          setConfirmMessage('');
        }}
        onConfirm={handleConfirmPlanChange}
        title={pendingAction === 'upgrade' ? 'Confirm Subscription Upgrade' : 'Confirm Subscription Change'}
        message={confirmMessage}
        confirmText={pendingAction === 'upgrade' ? 'Upgrade' : pendingAction === 'downgrade' ? 'Downgrade' : 'Confirm'}
        cancelText="Cancel"
        confirmColor={pendingAction === 'upgrade' ? 'success' : 'primary'}
      />
    </Container>
  );
}
