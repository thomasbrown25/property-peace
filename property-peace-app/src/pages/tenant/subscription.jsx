import { useState, useEffect } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { Box, Typography, Tabs, Tab, Container, Button, Stack, CircularProgress } from '@mui/material';
import { LinkOutlined } from '@ant-design/icons';
import MainCard from 'components/MainCard';
import { useSubscription, useSubscriptionStatus, useSubscriptionPlans } from 'hooks/useSubscription';
import PricingTable from 'components/subscription/PricingTable';
import SubscriptionStatus from 'components/subscription/SubscriptionStatus';
import TrialBanner from 'components/subscription/TrialBanner';
import CurrentPlan from '../landlord/subscription/current-plan';
import Billing from '../landlord/subscription/billing';
import { subscriptionAPI } from 'api';
import { openSnackbar } from 'api/snackbar';
import ConfirmationDialog from 'components/dialogs/ConfirmationDialog';
import OrphanedSubscriptionModal from 'components/subscription/OrphanedSubscriptionModal';

function TabPanel({ children, value, index }) {
  return (
    <div role="tabpanel" hidden={value !== index} id={`subscription-tabpanel-${index}`} aria-labelledby={`subscription-tab-${index}`}>
      {value === index && <Box sx={{ py: 1.5 }}>{children}</Box>}
    </div>
  );
}

const TENANT_BASE = '/tenant/subscription';

export default function TenantSubscription() {
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
  const [tab, setTab] = useState(() => {
    const tabParam = searchParams.get('tab');
    if (tabParam !== null) {
      const t = parseInt(tabParam, 10);
      if (!isNaN(t) && t >= 0 && t <= 2) return t;
    }
    return 0;
  });

  const { subscription, loading: subLoading, refetch: refetchSubscription } = useSubscription();
  const { status, loading: statusLoading, refetch: refetchStatus } = useSubscriptionStatus();
  const { plans, loading: plansLoading } = useSubscriptionPlans();

  useEffect(() => {
    const tabParam = searchParams.get('tab');
    if (tabParam !== null) {
      const tabIndex = parseInt(tabParam, 10);
      if (!isNaN(tabIndex) && tabIndex >= 0 && tabIndex <= 2) setTab(tabIndex);
    } else if (!subLoading && subscription) {
      const hasActive = subscription.status === 'Active' || subscription.status === 'Trial' || subscription.status === 'PaymentPending';
      if (hasActive) setTab(1);
    }
  }, [searchParams, subLoading, subscription]);

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
      const planName = subscription?.plan?.name || 'your plan';
      navigate(`/tenant/subscription-success?plan=${encodeURIComponent(planName)}`);
    } else if (canceled === 'true') {
      openSnackbar({ open: true, message: 'Checkout was canceled', variant: 'alert', alert: { color: 'info' } });
      setSearchParams({});
    }
  }, [searchParams, setSearchParams, refetchSubscription, refetchStatus, subscription, navigate]);

  const handleTabChange = (event, newValue) => setTab(newValue);

  const handlePlanSelected = async (plan, billingCycle) => {
    if (subscription && subscription.isOrphaned && subscription.status !== 'Trial') {
      openSnackbar({
        open: true,
        message: 'Please fix your subscription payment issue before changing plans',
        variant: 'alert',
        alert: { color: 'warning' }
      });
      setOrphanedModalOpen(true);
      return;
    }
    if (subscription && subscription.status === 'Trial') {
      await handleCreateCheckoutSession(plan, billingCycle);
      return;
    }
    if (subscription && subscription.status === 'PaymentPending') {
      openSnackbar({
        open: true,
        message: 'Your payment is being processed. Please wait for payment confirmation before making changes.',
        variant: 'alert',
        alert: { color: 'warning' }
      });
      return;
    }
    const isFreePlan = subscription?.plan?.name?.toLowerCase() === 'free';
    if (!subscription || subscription.status !== 'Active' || isFreePlan) {
      await handleCreateCheckoutSession(plan, billingCycle);
      return;
    }
    if (subscription && subscription.status === 'Active') {
      const currentPlanPrice = subscription.billingCycle === 'Annual'
        ? (subscription.plan?.annualPrice ?? subscription.plan?.monthlyPrice * 12)
        : (subscription.plan?.monthlyPrice ?? 0);
      const newPlanPrice = billingCycle === 'Annual'
        ? (plan.annualPrice ?? plan.monthlyPrice * 12)
        : (plan.monthlyPrice ?? 0);
      const isUpgrade = newPlanPrice > currentPlanPrice;
      const action = isUpgrade ? 'upgrade' : 'downgrade';
      const planChanged = subscription.plan?.id !== plan.id;
      const billingCycleChanged = subscription.billingCycle !== billingCycle;
      if (!planChanged && !billingCycleChanged) {
        openSnackbar({
          open: true,
          message: 'You are already subscribed to this plan with the same billing cycle',
          variant: 'alert',
          alert: { color: 'info' }
        });
        return;
      }
      const prorationNote = isUpgrade
        ? ' You will be charged immediately for the prorated amount covering the remainder of your current billing period.'
        : ' You will receive a prorated credit for the unused portion of your current plan.';
      const message = planChanged && billingCycleChanged
        ? `Are you sure you want to ${action} from ${subscription.plan?.name} (${subscription.billingCycle}) to ${plan.name} (${billingCycle})?${prorationNote}`
        : planChanged
          ? `Are you sure you want to ${action} from ${subscription.plan?.name} to ${plan.name}?${prorationNote}`
          : `Are you sure you want to change your billing cycle from ${subscription.billingCycle} to ${billingCycle}?${prorationNote}`;
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
        setTab(1);
      } else {
        openSnackbar({
          open: true,
          message: response.message || `Failed to ${pendingAction} subscription`,
          variant: 'alert',
          alert: { color: 'error' }
        });
      }
    } catch (error) {
      console.error('Error processing plan change:', error);
      openSnackbar({ open: true, message: 'Failed to process plan change', variant: 'alert', alert: { color: 'error' } });
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
      const successUrl = `${window.location.origin}${TENANT_BASE}?success=true`;
      const cancelUrl = `${window.location.origin}${TENANT_BASE}?canceled=true`;
      const response = await subscriptionAPI.createCheckoutSession(plan.id, billingCycle, successUrl, cancelUrl);
      if (response.success && response.data) {
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
      openSnackbar({ open: true, message: 'Failed to start checkout process', variant: 'alert', alert: { color: 'error' } });
      setCheckoutLoading(false);
    }
  };

  const handleFixOrphanedSubscription = async () => {
    if (!subscription || !subscription.plan) {
      setOrphanedModalOpen(false);
      return;
    }
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
      const returnUrl = `${window.location.origin}${TENANT_BASE}`;
      const response = await subscriptionAPI.createCustomerPortalSession(returnUrl);
      if (response.success && response.data) {
        window.location.href = response.data;
      } else {
        openSnackbar({
          open: true,
          message: response.message || 'Failed to create customer portal session',
          variant: 'alert',
          alert: { color: 'error' }
        });
      }
    } catch (error) {
      console.error('Error creating customer portal session:', error);
      openSnackbar({ open: true, message: 'Failed to open subscription management', variant: 'alert', alert: { color: 'error' } });
    } finally {
      setPortalLoading(false);
    }
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

  return (
    <Container maxWidth="xl">
      <Box sx={{ mb: 2 }}>
        <Stack direction={{ xs: 'column', md: 'row' }} justifyContent="space-between" alignItems={{ xs: 'stretch', md: 'center' }} spacing={{ xs: 2, md: 0 }}>
          <Box sx={{ width: { xs: '100%', md: 'auto' } }}>
            <Typography variant="h4" fontWeight="bold" sx={{ mb: 1 }}>
              Subscription
            </Typography>
            <Typography variant="body2" color="text.secondary" sx={{ mb: { xs: 2, md: 0 } }}>
              Manage your plan. Upgrade to Premium for LeaseShield.
            </Typography>
            <Box sx={{ display: { xs: 'flex', md: 'none' }, justifyContent: 'flex-end', alignItems: 'center', mt: 2 }}>
              {subscription && (
                <Button
                  variant="contained"
                  onClick={handleManageSubscription}
                  disabled={portalLoading}
                  startIcon={<LinkOutlined />}
                  sx={{ bgcolor: 'primary.main', color: '#ffffff', '&:hover': { bgcolor: 'primary.dark' }, '&:disabled': { bgcolor: 'rgba(0, 0, 0, 0.12)', color: 'rgba(0, 0, 0, 0.26)' } }}
                >
                  {portalLoading ? 'Loading...' : 'Manage Subscription'}
                </Button>
              )}
            </Box>
          </Box>
          <Stack direction="row" spacing={2} alignItems="center" sx={{ display: { xs: 'none', md: 'flex' } }}>
            {subscription && (
              <Button
                variant="contained"
                onClick={handleManageSubscription}
                disabled={portalLoading}
                startIcon={<LinkOutlined />}
                sx={{ bgcolor: 'primary.main', color: '#ffffff', '&:hover': { bgcolor: 'primary.dark' }, '&:disabled': { bgcolor: 'rgba(0, 0, 0, 0.12)', color: 'rgba(0, 0, 0, 0.26)' } }}
              >
                {portalLoading ? 'Loading...' : 'Manage Subscription'}
              </Button>
            )}
          </Stack>
        </Stack>
      </Box>

      <SubscriptionStatus status={status} />

      <MainCard sx={{ mt: 2 }}>
        <Box sx={{ borderBottom: 1, borderColor: 'divider' }}>
          <Tabs value={tab} onChange={handleTabChange} aria-label="subscription tabs" sx={{ '& .MuiTabs-indicator': { bgcolor: '#061e35' } }}>
            <Tab label="Plans" id="subscription-tab-0" aria-controls="subscription-tabpanel-0" sx={{ color: 'text.primary', fontFamily: "'Poppins', sans-serif", '&.Mui-selected': { color: '#061e35' }, '&:hover': { color: '#061e35' } }} />
            <Tab label="Current Plan" id="subscription-tab-1" aria-controls="subscription-tabpanel-1" sx={{ color: 'text.primary', fontFamily: "'Poppins', sans-serif", '&.Mui-selected': { color: '#061e35' }, '&:hover': { color: '#061e35' } }} />
            <Tab label="Billing" id="subscription-tab-2" aria-controls="subscription-tabpanel-2" sx={{ color: 'text.primary', fontFamily: "'Poppins', sans-serif", '&.Mui-selected': { color: '#061e35' }, '&:hover': { color: '#061e35' } }} />
          </Tabs>
        </Box>
        <TabPanel value={tab} index={0}>
          {plansLoading ? <Typography>Loading plans...</Typography> : (
            <PricingTable
              plans={plans}
              currentPlanId={subscription?.status === 'Trial' || subscription?.status === 'PaymentPending' || subscription?.status === 'Cancelled' ? null : subscription?.plan?.id}
              currentBillingCycle={subscription?.status === 'Trial' || subscription?.status === 'PaymentPending' || subscription?.status === 'Cancelled' ? null : subscription?.billingCycle}
              onSelectPlan={handlePlanSelected}
              loading={checkoutLoading}
              isTenant={true}
            />
          )}
        </TabPanel>
        <TabPanel value={tab} index={1}>
          <CurrentPlan subscription={subscription} loading={subLoading} onUpdate={refetchSubscription} />
        </TabPanel>
        <TabPanel value={tab} index={2}>
          <Billing subscription={subscription} loading={subLoading} onUpdate={refetchSubscription} />
        </TabPanel>
      </MainCard>

      <OrphanedSubscriptionModal open={orphanedModalOpen} onClose={() => setOrphanedModalOpen(false)} onFix={handleFixOrphanedSubscription} subscription={subscription} loading={checkoutLoading} />
      <ConfirmationDialog
        open={confirmDialogOpen}
        onClose={() => { setConfirmDialogOpen(false); setPendingPlan(null); setPendingBillingCycle(null); setPendingAction(null); setConfirmMessage(''); }}
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
