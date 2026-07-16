import { useState, useEffect } from 'react';
import {
  Box,
  Typography,
  Tabs,
  Tab,
  Container,
  Button,
  Stack,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Paper,
  TextField,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Chip,
  IconButton,
  Tooltip,
  Alert,
  CircularProgress
} from '@mui/material';
import { EditOutlined, SaveOutlined, CloseOutlined, CheckCircleOutlined } from '@ant-design/icons';
import MainCard from 'components/MainCard';
import ConfirmationDialog from 'components/dialogs/ConfirmationDialog';
import { adminSubscriptionAPI } from 'api/admin/subscription';
import SyncOutlined from '@ant-design/icons/SyncOutlined';
import ThunderboltOutlined from '@ant-design/icons/ThunderboltOutlined';
import { openSnackbar } from 'api/snackbar';
import { Select, MenuItem, FormControl, InputLabel, FormControlLabel, Switch } from '@mui/material';

function TabPanel({ children, value, index }) {
  return (
    <div
      role="tabpanel"
      hidden={value !== index}
      id={`admin-subscription-tabpanel-${index}`}
      aria-labelledby={`admin-subscription-tab-${index}`}
    >
      {value === index && <Box sx={{ py: 3 }}>{children}</Box>}
    </div>
  );
}

export default function AdminSubscriptions() {
  const [tab, setTab] = useState(0);
  const [plans, setPlans] = useState([]);
  const [userSubscriptions, setUserSubscriptions] = useState([]);
  const [loading, setLoading] = useState(false);
  const [editingPlan, setEditingPlan] = useState(null);
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [formData, setFormData] = useState({});
  const [editingSubscription, setEditingSubscription] = useState(null);
  const [editSubscriptionDialogOpen, setEditSubscriptionDialogOpen] = useState(false);
  const [subscriptionFormData, setSubscriptionFormData] = useState({});
  const [syncConfirmOpen, setSyncConfirmOpen] = useState(false);
  const [provisioningStripe, setProvisioningStripe] = useState(false);
  const [syncingStripe, setSyncingStripe] = useState(false);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      setLoading(true);
      const [plansResponse, subscriptionsResponse] = await Promise.all([
        adminSubscriptionAPI.getPlans(),
        adminSubscriptionAPI.getAllUserSubscriptions()
      ]);

      if (plansResponse.success) {
        setPlans(plansResponse.data || []);
      }

      if (subscriptionsResponse.success) {
        setUserSubscriptions(subscriptionsResponse.data || []);
      }
    } catch (error) {
      console.error('Error loading data:', error);
      openSnackbar({
        open: true,
        message: 'Failed to load subscription data',
        variant: 'alert',
        alert: { color: 'error' }
      });
    } finally {
      setLoading(false);
    }
  };

  const handleTabChange = (event, newValue) => {
    setTab(newValue);
  };

  const handleEditPlan = (plan) => {
    setEditingPlan(plan);
    setFormData({
      id: plan.id,
      name: plan.name,
      description: plan.description,
      maxProperties: null, // Property limits removed - always null
      maxTotalUnits: plan.maxTotalUnits,
      monthlyPrice: plan.monthlyPrice,
      annualPrice: plan.annualPrice,
      features: plan.features,
      isActive: plan.isActive,
      isTrial: plan.isTrial,
      trialDays: plan.trialDays ?? null,
      stripeProductId: plan.stripeProductId || '',
      stripePriceIdMonthly: plan.stripePriceIdMonthly || '',
      stripePriceIdAnnual: plan.stripePriceIdAnnual || ''
    });
    setEditDialogOpen(true);
  };

  const handleSavePlan = async () => {
    try {
      setLoading(true);
      const response = await adminSubscriptionAPI.savePlan(formData);

      if (response.success) {
        openSnackbar({
          open: true,
          message: 'Plan updated successfully',
          variant: 'alert',
          alert: { color: 'success' }
        });
        setEditDialogOpen(false);
        setEditingPlan(null);
        loadData();
      } else {
        openSnackbar({
          open: true,
          message: response.message || 'Failed to update plan',
          variant: 'alert',
          alert: { color: 'error' }
        });
      }
    } catch (error) {
      console.error('Error saving plan:', error);
      openSnackbar({
        open: true,
        message: 'Failed to save plan',
        variant: 'alert',
        alert: { color: 'error' }
      });
    } finally {
      setLoading(false);
    }
  };

  const handleCloseDialog = () => {
    setEditDialogOpen(false);
    setEditingPlan(null);
    setFormData({});
  };

  const handleSyncAndCleanup = async () => {
    try {
      setLoading(true);
      const response = await adminSubscriptionAPI.syncSubscriptionsAndCleanup();

      if (response.overallSuccess) {
        const syncMsg = `Sync: ${response.syncResult?.successfullySynced || 0} synced, ${response.syncResult?.failed || 0} failed`;
        const cleanupMsg = `Cleanup: ${response.cleanupResult?.pricesDeleted || 0} prices deleted, ${response.cleanupResult?.pricesKept || 0} kept`;

        openSnackbar({
          open: true,
          message: `${syncMsg}. ${cleanupMsg}`,
          variant: 'alert',
          alert: { color: 'success' }
        });
        loadData();
      } else {
        const errors = [...(response.syncResult?.errors || []), ...(response.cleanupResult?.errors || [])];

        openSnackbar({
          open: true,
          message: `Sync and cleanup completed with errors. Check console for details.`,
          variant: 'alert',
          alert: { color: 'warning' }
        });

        if (errors.length > 0) {
          console.error('Sync and cleanup errors:', errors);
        }
        loadData();
      }
    } catch (error) {
      console.error('Error syncing and cleaning up:', error);
      openSnackbar({
        open: true,
        message: 'Failed to sync subscriptions and cleanup prices',
        variant: 'alert',
        alert: { color: 'error' }
      });
    } finally {
      setLoading(false);
    }
  };

  const handleEditSubscription = (subscription) => {
    setEditingSubscription(subscription);
    setSubscriptionFormData({
      subscriptionId: subscription.id,
      userId: subscription.organizationOwner?.id,
      currentPlanId: subscription.plan?.id,
      newPlanId: subscription.plan?.id,
      prorate: true,
      isUpgrade: true
    });
    setEditSubscriptionDialogOpen(true);
  };

  const handleSaveSubscription = async () => {
    try {
      setLoading(true);

      if (subscriptionFormData.newPlanId === subscriptionFormData.currentPlanId) {
        openSnackbar({
          open: true,
          message: 'Please select a different plan',
          variant: 'alert',
          alert: { color: 'warning' }
        });
        return;
      }

      const response = await adminSubscriptionAPI.updateSubscriptionPlan(
        subscriptionFormData.subscriptionId,
        subscriptionFormData.userId,
        subscriptionFormData.newPlanId,
        subscriptionFormData.prorate,
        subscriptionFormData.isUpgrade
      );

      if (response.success) {
        openSnackbar({
          open: true,
          message: 'Subscription updated successfully',
          variant: 'alert',
          alert: { color: 'success' }
        });
        setEditSubscriptionDialogOpen(false);
        setEditingSubscription(null);
        setSubscriptionFormData({});
        loadData();
      } else {
        openSnackbar({
          open: true,
          message: response.message || 'Failed to update subscription',
          variant: 'alert',
          alert: { color: 'error' }
        });
      }
    } catch (error) {
      console.error('Error saving subscription:', error);
      openSnackbar({
        open: true,
        message: 'Failed to save subscription',
        variant: 'alert',
        alert: { color: 'error' }
      });
    } finally {
      setLoading(false);
    }
  };

  const handleAssignLifetimePlan = async () => {
    try {
      setLoading(true);
      const userId = editingSubscription?.organizationOwner?.id;
      const email = editingSubscription?.organizationOwner?.email;

      const response = await adminSubscriptionAPI.assignLifetimePlan({ userId, email });

      if (response.success) {
        openSnackbar({
          open: true,
          message: 'Lifetime Plan assigned successfully',
          variant: 'alert',
          alert: { color: 'success' }
        });
        setEditSubscriptionDialogOpen(false);
        setEditingSubscription(null);
        setSubscriptionFormData({});
        loadData();
      } else {
        openSnackbar({
          open: true,
          message: response.message || 'Failed to assign Lifetime Plan',
          variant: 'alert',
          alert: { color: 'error' }
        });
      }
    } catch (error) {
      console.error('Error assigning Lifetime Plan:', error);
      openSnackbar({
        open: true,
        message: 'Failed to assign Lifetime Plan',
        variant: 'alert',
        alert: { color: 'error' }
      });
    } finally {
      setLoading(false);
    }
  };

  const handleCloseSubscriptionDialog = () => {
    setEditSubscriptionDialogOpen(false);
    setEditingSubscription(null);
    setSubscriptionFormData({});
  };

  const handleProvisionStripe = async () => {
    try {
      setProvisioningStripe(true);
      const response = await adminSubscriptionAPI.provisionStripeProducts();
      if (response.success) {
        const updated = response.data?.plansUpdated ?? 0;
        const errors = response.data?.errors ?? [];
        openSnackbar({
          open: true,
          message: updated > 0
            ? `Provisioned ${updated} plan(s) in Stripe successfully.`
            : 'All paid plans already have Stripe products — nothing to provision.',
          variant: 'alert',
          alert: { color: errors.length > 0 ? 'warning' : 'success' }
        });
        loadData();
      } else {
        openSnackbar({
          open: true,
          message: response.message || 'Failed to provision Stripe products',
          variant: 'alert',
          alert: { color: 'error' }
        });
      }
    } catch (error) {
      console.error('Error provisioning Stripe products:', error);
      openSnackbar({
        open: true,
        message: 'Failed to provision Stripe products',
        variant: 'alert',
        alert: { color: 'error' }
      });
    } finally {
      setProvisioningStripe(false);
    }
  };

  const handleSyncFromStripe = async () => {
    try {
      setSyncingStripe(true);
      const response = await adminSubscriptionAPI.syncStripePlans();
      if (response.success) {
        const updated = response.data?.plansUpdated ?? 0;
        const warnings = response.data?.warnings ?? [];
        openSnackbar({
          open: true,
          message: `Synced ${updated} plan(s) from Stripe.${warnings.length > 0 ? ` ${warnings.length} warning(s).` : ''}`,
          variant: 'alert',
          alert: { color: warnings.length > 0 ? 'warning' : 'success' }
        });
        if (warnings.length > 0) console.warn('Stripe sync warnings:', warnings);
        loadData();
      } else {
        openSnackbar({
          open: true,
          message: response.message || 'Failed to sync from Stripe',
          variant: 'alert',
          alert: { color: 'error' }
        });
      }
    } catch (error) {
      console.error('Error syncing from Stripe:', error);
      openSnackbar({
        open: true,
        message: 'Failed to sync from Stripe',
        variant: 'alert',
        alert: { color: 'error' }
      });
    } finally {
      setSyncingStripe(false);
    }
  };

  const formatDate = (dateString) => {
    if (!dateString) return 'N/A';
    return new Date(dateString).toLocaleDateString();
  };

  const getStatusColor = (status) => {
    switch (status?.toLowerCase()) {
      case 'active':
        return 'success';
      case 'trial':
        return 'info';
      case 'pastdue':
        return 'warning';
      case 'cancelled':
        return 'error';
      default:
        return 'default';
    }
  };

  return (
    <Container maxWidth="xl">
      <Box sx={{ mb: 3 }}>
        <Typography variant="h4" fontWeight="bold">
          Subscriptions Management
        </Typography>
        <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
          Manage subscription plans and view user subscriptions
        </Typography>
      </Box>

      <MainCard>
        <Box sx={{ borderBottom: 1, borderColor: 'divider' }}>
          <Tabs value={tab} onChange={handleTabChange} aria-label="admin subscription tabs">
            <Tab label="Plans" id="admin-subscription-tab-0" aria-controls="admin-subscription-tabpanel-0" />
            <Tab label="User Subscriptions" id="admin-subscription-tab-1" aria-controls="admin-subscription-tabpanel-1" />
          </Tabs>
        </Box>

        <TabPanel value={tab} index={0}>
          {loading && plans.length === 0 ? (
            <Box sx={{ display: 'flex', justifyContent: 'center', p: 4 }}>
              <CircularProgress />
            </Box>
          ) : (
            <>
              <Alert severity="info" sx={{ mb: 3 }}>
                Stripe Product IDs and Price IDs must be set on each paid plan before users can subscribe. Use <strong>Provision Stripe Products</strong> to auto-create missing products, then <strong>Sync from Stripe</strong> to pull IDs into the database.
              </Alert>
              <Stack direction="row" spacing={1.5} justifyContent="flex-end" sx={{ mb: 3 }}>
                <Tooltip title="Create Stripe products + prices for any paid plans that don't have them yet. Safe to run multiple times.">
                  <span>
                    <Button
                      variant="contained"
                      color="primary"
                      onClick={handleProvisionStripe}
                      disabled={provisioningStripe || loading}
                      startIcon={provisioningStripe ? <CircularProgress size={16} color="inherit" /> : <ThunderboltOutlined />}
                    >
                      Provision Stripe Products
                    </Button>
                  </span>
                </Tooltip>
                <Tooltip title="Pull Stripe Product IDs and Price IDs into the database by matching product names.">
                  <span>
                    <Button
                      variant="outlined"
                      color="primary"
                      onClick={handleSyncFromStripe}
                      disabled={syncingStripe || loading}
                      startIcon={syncingStripe ? <CircularProgress size={16} color="inherit" /> : <SyncOutlined />}
                    >
                      Sync from Stripe
                    </Button>
                  </span>
                </Tooltip>
                <Button
                  variant="outlined"
                  onClick={() => setSyncConfirmOpen(true)}
                  disabled={loading}
                >
                  Sync Subscriptions & Cleanup
                </Button>
              </Stack>
              <TableContainer component={Paper} variant="outlined">
                <Table>
                  <TableHead>
                    <TableRow>
                      <TableCell>
                        <strong>Plan Name</strong>
                      </TableCell>
                      <TableCell>
                        <strong>Monthly Price</strong>
                      </TableCell>
                      <TableCell>
                        <strong>Annual Price</strong>
                      </TableCell>
                      <TableCell>
                        <strong>Max Units</strong>
                      </TableCell>
                      <TableCell>
                        <strong>Status</strong>
                      </TableCell>
                      <TableCell align="right">
                        <strong>Actions</strong>
                      </TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {plans.map((plan) => (
                      <TableRow key={plan.id} hover>
                        <TableCell>
                          <Typography variant="subtitle2" fontWeight="bold">
                            {plan.name}
                          </Typography>
                          <Typography variant="caption" color="text.secondary">
                            {plan.description}
                          </Typography>
                        </TableCell>
                        <TableCell>${plan.monthlyPrice.toFixed(2)}</TableCell>
                        <TableCell>${plan.annualPrice.toFixed(2)}</TableCell>
                        <TableCell>
                          {plan.maxTotalUnits === null || plan.maxTotalUnits === undefined ? 'Unlimited' : plan.maxTotalUnits}
                        </TableCell>
                        <TableCell>
                          <Chip label={plan.isActive ? 'Active' : 'Inactive'} color={plan.isActive ? 'success' : 'default'} size="small" />
                          {plan.isTrial && <Chip label="Trial" color="primary" size="small" sx={{ ml: 1 }} />}
                        </TableCell>
                        <TableCell align="right">
                          <Tooltip title="Edit Plan">
                            <IconButton size="small" onClick={() => handleEditPlan(plan)} color="primary">
                              <EditOutlined />
                            </IconButton>
                          </Tooltip>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </TableContainer>
            </>
          )}
        </TabPanel>

        <TabPanel value={tab} index={1}>
          {loading && userSubscriptions.length === 0 ? (
            <Box sx={{ display: 'flex', justifyContent: 'center', p: 4 }}>
              <CircularProgress />
            </Box>
          ) : (
            <TableContainer component={Paper} variant="outlined">
              <Table>
                <TableHead>
                  <TableRow>
                    <TableCell>
                      <strong>User</strong>
                    </TableCell>
                    <TableCell>
                      <strong>Plan</strong>
                    </TableCell>
                    <TableCell>
                      <strong>Status</strong>
                    </TableCell>
                    <TableCell>
                      <strong>Billing Cycle</strong>
                    </TableCell>
                    <TableCell>
                      <strong>Price</strong>
                    </TableCell>
                    <TableCell>
                      <strong>Current Period</strong>
                    </TableCell>
                    <TableCell>
                      <strong>Trial End</strong>
                    </TableCell>
                    <TableCell align="right">
                      <strong>Actions</strong>
                    </TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {userSubscriptions.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={7} align="center">
                        <Typography variant="body2" color="text.secondary" sx={{ py: 3 }}>
                          No subscriptions found
                        </Typography>
                      </TableCell>
                    </TableRow>
                  ) : (
                    userSubscriptions.map((subscription) => {
                      const price =
                        subscription.billingCycle === 'Annual' ? subscription.plan?.annualPrice : subscription.plan?.monthlyPrice;
                      const priceDisplay =
                        price !== undefined && price !== null
                          ? `$${price.toFixed(2)}/${subscription.billingCycle === 'Annual' ? 'year' : 'month'}`
                          : 'N/A';

                      return (
                        <TableRow key={subscription.id} hover>
                          <TableCell>
                            <Typography variant="subtitle2">
                              {subscription.organizationOwner
                                ? `${subscription.organizationOwner.firstName || ''} ${subscription.organizationOwner.lastName || ''}`.trim() ||
                                  subscription.organizationOwner.email ||
                                  `Owner #${subscription.organizationOwner.id}`
                                : subscription.organizationName || `Organization #${subscription.organizationId}`}
                            </Typography>
                            {subscription.organizationOwner?.email && subscription.organizationOwner.firstName && subscription.organizationOwner.lastName && (
                              <Typography variant="caption" color="text.secondary" display="block">
                                {subscription.organizationOwner.email}
                              </Typography>
                            )}
                            {subscription.organizationName && (
                              <Typography variant="caption" color="text.secondary" display="block">
                                {subscription.organizationName}
                              </Typography>
                            )}
                          </TableCell>
                          <TableCell>
                            <Typography variant="body2" fontWeight="medium">
                              {subscription.plan?.name || 'N/A'}
                            </Typography>
                          </TableCell>
                          <TableCell>
                            <Chip label={subscription.status || 'N/A'} color={getStatusColor(subscription.status)} size="small" />
                          </TableCell>
                          <TableCell>{subscription.billingCycle || 'N/A'}</TableCell>
                          <TableCell>
                            <Typography variant="body2" fontWeight="medium">
                              {priceDisplay}
                            </Typography>
                          </TableCell>
                          <TableCell>
                            {subscription.currentPeriodStart && subscription.currentPeriodEnd
                              ? `${formatDate(subscription.currentPeriodStart)} - ${formatDate(subscription.currentPeriodEnd)}`
                              : 'N/A'}
                          </TableCell>
                          <TableCell>{formatDate(subscription.trialEnd)}</TableCell>
                          <TableCell align="right">
                            <Tooltip title="Edit Subscription">
                              <IconButton size="small" onClick={() => handleEditSubscription(subscription)} color="primary">
                                <EditOutlined />
                              </IconButton>
                            </Tooltip>
                          </TableCell>
                        </TableRow>
                      );
                    })
                  )}
                </TableBody>
              </Table>
            </TableContainer>
          )}
        </TabPanel>
      </MainCard>

      {/* Edit Plan Dialog */}
      <Dialog open={editDialogOpen} onClose={handleCloseDialog} maxWidth="md" fullWidth>
        <DialogTitle>
          <Stack direction="row" alignItems="center" spacing={1}>
            <EditOutlined />
            <Typography variant="h6">Edit Subscription Plan</Typography>
          </Stack>
        </DialogTitle>
        <DialogContent>
          <Box sx={{ pt: 2 }}>
            <Stack spacing={3}>
              <TextField
                label="Plan Name"
                value={formData.name || ''}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                fullWidth
                required
              />
              <TextField
                label="Description"
                value={formData.description || ''}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                fullWidth
                multiline
                rows={2}
              />

              <Box sx={{ borderTop: 1, borderColor: 'divider', pt: 2 }}>
                <Typography variant="h6" sx={{ mb: 2 }}>
                  Stripe Integration
                </Typography>
                <Alert severity="info" sx={{ mb: 2 }}>
                  Get these IDs from your Stripe Dashboard → Products. Product IDs start with <code>prod_</code> and Price IDs start with{' '}
                  <code>price_</code>.
                </Alert>

                <TextField
                  label="Stripe Product ID"
                  value={formData.stripeProductId || ''}
                  onChange={(e) => setFormData({ ...formData, stripeProductId: e.target.value })}
                  fullWidth
                  placeholder="prod_xxxxxxxxxxxxx"
                  sx={{ mb: 2 }}
                  helperText="The Stripe Product ID for this plan"
                />

                <TextField
                  label="Stripe Monthly Price ID"
                  value={formData.stripePriceIdMonthly || ''}
                  onChange={(e) => setFormData({ ...formData, stripePriceIdMonthly: e.target.value })}
                  fullWidth
                  placeholder="price_xxxxxxxxxxxxx"
                  sx={{ mb: 2 }}
                  helperText="The Stripe Price ID for monthly billing"
                />

                <TextField
                  label="Stripe Annual Price ID"
                  value={formData.stripePriceIdAnnual || ''}
                  onChange={(e) => setFormData({ ...formData, stripePriceIdAnnual: e.target.value })}
                  fullWidth
                  placeholder="price_xxxxxxxxxxxxx"
                  helperText="The Stripe Price ID for annual billing"
                />
              </Box>

              <Box sx={{ borderTop: 1, borderColor: 'divider', pt: 2 }}>
                <Typography variant="h6" sx={{ mb: 2 }}>
                  Pricing (Changes will create new Stripe prices)
                </Typography>
                <Alert severity="warning" sx={{ mb: 2 }}>
                  Changing prices will create new Stripe Price IDs. Existing subscriptions will continue using the old prices unless
                  manually updated.
                </Alert>
                <Stack direction="row" spacing={2}>
                  <TextField
                    label="Monthly Price ($)"
                    type="number"
                    value={formData.monthlyPrice || ''}
                    onChange={(e) => setFormData({ ...formData, monthlyPrice: parseFloat(e.target.value) || 0 })}
                    fullWidth
                    inputProps={{ step: 0.01, min: 0 }}
                  />
                  <TextField
                    label="Annual Price ($)"
                    type="number"
                    value={formData.annualPrice || ''}
                    onChange={(e) => setFormData({ ...formData, annualPrice: parseFloat(e.target.value) || 0 })}
                    fullWidth
                    inputProps={{ step: 0.01, min: 0 }}
                  />
                </Stack>
                <Stack direction="row" spacing={2} sx={{ mt: 2 }}>
                  <TextField
                    label="Max Units"
                    type="number"
                    value={formData.maxTotalUnits ?? ''}
                    onChange={(e) => setFormData({ ...formData, maxTotalUnits: e.target.value ? parseInt(e.target.value) : null })}
                    fullWidth
                    required
                    helperText="Total units across all properties. Leave empty for unlimited. Property limits have been removed - all limits are now based on units only."
                  />
                </Stack>
                <TextField
                  label="Trial Days"
                  type="number"
                  value={formData.trialDays ?? ''}
                  onChange={(e) => setFormData({ ...formData, trialDays: e.target.value ? parseInt(e.target.value) : null })}
                  fullWidth
                  sx={{ mt: 2 }}
                  helperText="Number of free trial days (0 or empty = no trial). Users who haven't used a trial before will get this trial period."
                  inputProps={{ min: 0 }}
                />
              </Box>
            </Stack>
          </Box>
        </DialogContent>
        <DialogActions>
          <Button onClick={handleCloseDialog} startIcon={<CloseOutlined />}>
            Cancel
          </Button>
          <Button
            onClick={handleSavePlan}
            variant="contained"
            startIcon={loading ? <CircularProgress size={16} /> : <SaveOutlined />}
            disabled={loading}
          >
            Save Changes
          </Button>
        </DialogActions>
      </Dialog>

      {/* Edit Subscription Dialog */}
      <Dialog open={editSubscriptionDialogOpen} onClose={handleCloseSubscriptionDialog} maxWidth="sm" fullWidth>
        <DialogTitle>
          <Stack direction="row" alignItems="center" spacing={1}>
            <EditOutlined />
            <Typography variant="h6">Edit Subscription</Typography>
          </Stack>
        </DialogTitle>
        <DialogContent>
          <Box sx={{ pt: 2 }}>
            <Stack spacing={3}>
              <Alert severity="info">
                Changing a subscription plan will update it in Stripe. The change will be prorated based on your selection.
              </Alert>

              <TextField
                label="User"
                value={
                  editingSubscription?.organizationOwner
                    ? `${editingSubscription.organizationOwner.firstName || ''} ${editingSubscription.organizationOwner.lastName || ''}`.trim() ||
                      editingSubscription.organizationOwner.email ||
                      `Owner #${editingSubscription.organizationOwner.id}`
                    : editingSubscription?.organizationName || 'N/A'
                }
                fullWidth
                disabled
                helperText={editingSubscription?.organizationOwner?.email || editingSubscription?.organizationName}
              />

              <TextField label="Current Plan" value={editingSubscription?.plan?.name || 'N/A'} fullWidth disabled />

              <FormControl fullWidth>
                <InputLabel>New Plan</InputLabel>
                <Select
                  value={subscriptionFormData.newPlanId || ''}
                  onChange={(e) => {
                    const selectedPlan = plans.find((p) => p.id === e.target.value);
                    setSubscriptionFormData({
                      ...subscriptionFormData,
                      newPlanId: e.target.value,
                      isUpgrade: selectedPlan ? selectedPlan.monthlyPrice > (editingSubscription?.plan?.monthlyPrice || 0) : true
                    });
                  }}
                  label="New Plan"
                >
                  {plans
                    .filter((p) => !p.isTrial)
                    .map((plan) => (
                      <MenuItem key={plan.id} value={plan.id}>
                        {plan.name} - ${plan.monthlyPrice.toFixed(2)}/month
                      </MenuItem>
                    ))}
                </Select>
              </FormControl>

              <FormControlLabel
                control={
                  <Switch
                    checked={subscriptionFormData.prorate}
                    onChange={(e) => setSubscriptionFormData({ ...subscriptionFormData, prorate: e.target.checked })}
                  />
                }
                label="Prorate charges (adjust billing based on time remaining)"
              />

              {subscriptionFormData.newPlanId && subscriptionFormData.newPlanId !== subscriptionFormData.currentPlanId && (
                <Alert severity={subscriptionFormData.isUpgrade ? 'success' : 'info'}>
                  This will {subscriptionFormData.isUpgrade ? 'upgrade' : 'downgrade'} the subscription.
                  {subscriptionFormData.prorate && ' Charges will be prorated.'}
                </Alert>
              )}
            </Stack>
          </Box>
        </DialogContent>
        <DialogActions>
          <Button onClick={handleAssignLifetimePlan} color="success" disabled={loading} startIcon={<CheckCircleOutlined />}>
            Assign Lifetime Plan
          </Button>
          <Box sx={{ flex: 1 }} />
          <Button onClick={handleCloseSubscriptionDialog} startIcon={<CloseOutlined />}>
            Cancel
          </Button>
          <Button
            onClick={handleSaveSubscription}
            variant="contained"
            startIcon={loading ? <CircularProgress size={16} /> : <SaveOutlined />}
            disabled={loading || subscriptionFormData.newPlanId === subscriptionFormData.currentPlanId}
          >
            Update Subscription
          </Button>
        </DialogActions>
      </Dialog>

      {/* Sync and Cleanup Confirmation Dialog */}
      <ConfirmationDialog
        open={syncConfirmOpen}
        onClose={() => setSyncConfirmOpen(false)}
        onConfirm={handleSyncAndCleanup}
        title="Sync Subscriptions & Cleanup Prices"
        message="This will sync all subscriptions from the database to Stripe and delete unused prices. This action may take a few moments. Continue?"
        confirmText="Sync & Cleanup"
        cancelText="Cancel"
        confirmColor="primary"
      />
    </Container>
  );
}
