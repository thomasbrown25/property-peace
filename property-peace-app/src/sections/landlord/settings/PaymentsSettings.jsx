import { useState, useEffect, useLayoutEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import {
  Box,
  Typography,
  Stack,
  Paper,
  Button,
  Alert,
  CircularProgress,
  Chip,
  alpha,
  Divider,
  Dialog,
  DialogTitle,
  DialogContent,
  IconButton,
  TextField,
  Collapse,
  useTheme
} from '@mui/material';
import { CreditCardOutlined, CheckCircleOutlined, CloseOutlined, BankOutlined, PlusOutlined, EditOutlined, DeleteOutlined } from '@ant-design/icons';
import { loadConnectAndInitialize } from '@stripe/connect-js';
import { ConnectAccountManagement, ConnectAccountOnboarding, ConnectComponentsProvider } from '@stripe/react-connect-js';
import useAuth from 'hooks/useAuth';
import axiosServices from 'utils/axios';
import { openSnackbar } from 'api/snackbar';
import { bankAccountAPI } from 'api';
import useFetchProperties from 'hooks/useFetchProperties';
import useRentPaymentAccess from 'hooks/useRentPaymentAccess';
import RentPaymentAccessPanel from 'components/rent-payments/RentPaymentAccessPanel';
import ConnectOnboardingWizard from 'sections/landlord/payments/ConnectOnboardingWizard';
import { validateConnectOnboardingContext } from 'utils/connectOnboarding';
import { useOrganization } from 'contexts/OrganizationContext';
import {
  canCreateInitialStripeAccount,
  canManageStripeAccount,
  createStripeOrganizationRequestLifecycle,
  getInitialStripeOnboardingUrl,
  makeStripeOrganizationScopeKey
} from 'utils/stripeOrganizationRequestLifecycle';
import { Grid, Card, CardContent } from '@mui/material';

function DemoStripePaymentsPreview() {
  const paymentBenefits = [
    'Tenants can pay rent online from their portal',
    'Payments can be routed to your connected bank account',
    'Stripe handles secure card and bank-account processing',
    'Payment history can stay organized alongside each lease'
  ];

  return (
    <Box>
      <Stack spacing={3}>
        <Paper
          variant="outlined"
          sx={{
            p: { xs: 2.5, md: 3 },
            overflow: 'hidden',
            position: 'relative',
            bgcolor: 'background.paper',
            borderColor: (t) => alpha(t.palette.primary.main, 0.18)
          }}
        >
          <Box
            sx={{
              position: 'absolute',
              inset: 0,
              background: (t) => `radial-gradient(circle at top right, ${alpha(t.palette.primary.main, 0.12)}, transparent 34%)`,
              pointerEvents: 'none'
            }}
          />
          <Stack spacing={2.5} sx={{ position: 'relative' }}>
            <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2} alignItems={{ xs: 'flex-start', sm: 'center' }} justifyContent="space-between">
              <Stack direction="row" spacing={1.5} alignItems="center">
                <Box
                  sx={{
                    width: 44,
                    height: 44,
                    borderRadius: 2,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    bgcolor: (t) => alpha(t.palette.primary.main, 0.1),
                    color: 'primary.main'
                  }}
                >
                  <CreditCardOutlined style={{ fontSize: 22 }} />
                </Box>
                <Box>
                  <Typography variant="h5" fontWeight={700}>
                    Online tenant payments with Stripe
                  </Typography>
                  <Typography variant="body2" color="text.secondary">
                    A guided setup for collecting rent online once you move out of demo mode.
                  </Typography>
                </Box>
              </Stack>
              <Chip label="Demo mode" color="warning" variant="outlined" sx={{ fontWeight: 700 }} />
            </Stack>

            <Alert severity="info" sx={{ alignItems: 'flex-start' }}>
              Stripe payment setup is not available in demo mode. In a live account, this tab lets landlords connect Stripe so tenants can make online rent payments from the tenant portal.
            </Alert>

            <Grid container spacing={2}>
              {paymentBenefits.map((benefit) => (
                <Grid item xs={12} sm={6} key={benefit}>
                  <Stack
                    direction="row"
                    spacing={1.25}
                    alignItems="flex-start"
                    sx={{
                      p: 1.5,
                      border: '1px dashed',
                      borderColor: 'divider',
                      borderRadius: 1.5,
                      bgcolor: (t) => alpha(t.palette.background.default, 0.45),
                      height: '100%'
                    }}
                  >
                    <CheckCircleOutlined style={{ color: '#2e7d32', marginTop: 2 }} />
                    <Typography variant="body2" color="text.secondary">
                      {benefit}
                    </Typography>
                  </Stack>
                </Grid>
              ))}
            </Grid>

            <Divider />

            <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2} alignItems={{ xs: 'stretch', sm: 'center' }} justifyContent="space-between">
              <Box>
                <Typography variant="subtitle1" fontWeight={700}>
                  Ready in a real account
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  Create or sign into a live Property Peace account to connect Stripe, complete onboarding, and accept tenant payments.
                </Typography>
              </Box>
              <Button variant="contained" disabled startIcon={<BankOutlined />} sx={{ whiteSpace: 'nowrap' }}>
                Connect Stripe in live mode
              </Button>
            </Stack>
          </Stack>
        </Paper>

        <Paper variant="outlined" sx={{ p: { xs: 2.5, md: 3 }, bgcolor: 'background.paper' }}>
          <Typography variant="subtitle1" fontWeight={700} sx={{ mb: 1 }}>
            What landlords can do after setup
          </Typography>
          <Typography variant="body2" color="text.secondary">
            Once Stripe is connected in a live account, tenants can pay rent online, landlords can track payment status, and bank-account connections can be managed without leaving Property Peace.
          </Typography>
        </Paper>
      </Stack>
    </Box>
  );
}

export function PaymentsSettingsContent({ rentPaymentAccess, headerActionElement = null }) {
  const theme = useTheme();
  const { user } = useAuth();
  const { currentOrganization } = useOrganization();
  const stripeScopeKey = makeStripeOrganizationScopeKey(currentOrganization?.id ?? currentOrganization?.Id);
  const { properties, propertiesRefetch, isLoading: propertiesLoading, propertiesError } = useFetchProperties();
  const {
    presentation: rentPresentation,
    loading: rentReadinessLoading,
    error: rentReadinessError
  } = rentPaymentAccess;
  const rentCanInvoke = rentPresentation?.canConfigure === true;
  const [loading, setLoading] = useState(false);
  const [checkingStatus, setCheckingStatus] = useState(true);
  const [accountStatus, setAccountStatus] = useState(null);
  const [accountStatusLoadedSuccessfully, setAccountStatusLoadedSuccessfully] = useState(false);
  const [connecting, setConnecting] = useState(false);
  const [showPreparation, setShowPreparation] = useState(false);
  const [connectPreparation, setConnectPreparation] = useState(null);
  const [preparationLoading, setPreparationLoading] = useState(false);
  const [showOnboarding, setShowOnboarding] = useState(false);
  const [stripeConnectInstance, setStripeConnectInstance] = useState(null);
  const [fetchingSession, setFetchingSession] = useState(false);
  const [bankManagementOpen, setBankManagementOpen] = useState(false);
  const [bankManagementInstance, setBankManagementInstance] = useState(null);
  const [openingBankManagement, setOpeningBankManagement] = useState(false);
  const [bankManagementError, setBankManagementError] = useState('');
  const [bankManagementMode, setBankManagementMode] = useState('manage');
  const [bankAccounts, setBankAccounts] = useState([]);
  const [loadingBankAccounts, setLoadingBankAccounts] = useState(false);
  const prevShowOnboardingRef = useRef(false);
  const connectSubmissionRef = useRef(false);
  const requestLifecycleRef = useRef(null);
  const connectCallbackGuardRef = useRef(null);
  const embeddedOnboardingRequestRef = useRef(null);
  const bankManagementCallbackGuardRef = useRef(null);
  const isDemo = user?.isDemo === true || user?.IsDemo === true;
  const canManageAccount = canManageStripeAccount(accountStatus);
  const canCreateInitialAccount = canCreateInitialStripeAccount({
    statusLoadedSuccessfully: accountStatusLoadedSuccessfully,
    status: accountStatus,
    rentCanInvoke,
    organizationId: currentOrganization?.id ?? currentOrganization?.Id
  });

  if (!requestLifecycleRef.current) {
    requestLifecycleRef.current = createStripeOrganizationRequestLifecycle(() => {
      setAccountStatus(null);
      setAccountStatusLoadedSuccessfully(false);
      setBankAccounts([]);
      setConnectPreparation(null);
      setShowPreparation(false);
      setShowOnboarding(false);
      setStripeConnectInstance(null);
      setLoading(false);
      setCheckingStatus(false);
      setConnecting(false);
      setPreparationLoading(false);
      setFetchingSession(false);
      setBankManagementOpen(false);
      setBankManagementInstance(null);
      setOpeningBankManagement(false);
      setBankManagementError('');
      setBankManagementMode('manage');
      setLoadingBankAccounts(false);
      connectSubmissionRef.current = false;
      connectCallbackGuardRef.current = null;
      embeddedOnboardingRequestRef.current = null;
      bankManagementCallbackGuardRef.current = null;
      prevShowOnboardingRef.current = false;
    });
  }

  useLayoutEffect(() => {
    requestLifecycleRef.current.setScope(stripeScopeKey);
  }, [stripeScopeKey]);

  useEffect(() => () => requestLifecycleRef.current?.dispose(), []);

  useEffect(() => {
    if (!stripeScopeKey || isDemo || rentReadinessLoading || rentReadinessError || !rentCanInvoke) {
      setCheckingStatus(false);
      setShowPreparation(false);
      setShowOnboarding(false);
      setStripeConnectInstance(null);
      return;
    }

    checkAccountStatus();
    fetchPublishableKey();
    fetchBankAccounts();
    
    // Check if we're returning from Stripe connection
    const urlParams = new URLSearchParams(window.location.search);
    if (urlParams.get('stripe') === 'connected') {
      // Remove the parameter from URL
      urlParams.delete('stripe');
      const newUrl = window.location.pathname + (urlParams.toString() ? `?${urlParams.toString()}` : '');
      window.history.replaceState({}, '', newUrl);
      
      // Refresh account status after a short delay to ensure Stripe has processed
      const returnRefreshGuard = requestLifecycleRef.current.capture(stripeScopeKey);
      const returnRefreshTimeout = setTimeout(() => {
        if (!returnRefreshGuard.isCurrent()) return;
        checkAccountStatus();
        fetchBankAccounts();
      }, 1000);

      return () => clearTimeout(returnRefreshTimeout);
    }
  }, [user, stripeScopeKey, isDemo, rentCanInvoke, rentReadinessLoading, rentReadinessError]);

  const fetchBankAccounts = async () => {
    if (!stripeScopeKey || !requestLifecycleRef.current.isCurrent(stripeScopeKey)) return;
    setLoadingBankAccounts(true);
    return requestLifecycleRef.current.run({
      scopeKey: stripeScopeKey,
      channel: 'bank-accounts',
      request: () => bankAccountAPI.getBankAccounts(currentOrganization?.id ?? currentOrganization?.Id),
      onSuccess: (response) => setBankAccounts(response.success && response.data ? response.data : []),
      onError: (error) => console.error('Error fetching bank accounts:', error),
      onFinally: () => setLoadingBankAccounts(false)
    });
  };


  // Refresh account status when onboarding modal closes
  useEffect(() => {
    if (!rentCanInvoke) {
      prevShowOnboardingRef.current = false;
      return;
    }

    // Check if modal transitioned from open to closed
    if (prevShowOnboardingRef.current && !showOnboarding && stripeConnectInstance) {
      // Modal was just closed, refresh status to check if account was connected
      const closeRefreshGuard = requestLifecycleRef.current.capture(stripeScopeKey);
      const timeoutId = setTimeout(() => {
        if (!closeRefreshGuard.isCurrent()) return;
        checkAccountStatus();
      }, 1500);
      
      return () => clearTimeout(timeoutId);
    }
    
    // Update ref for next render
    prevShowOnboardingRef.current = showOnboarding;
  }, [showOnboarding, stripeConnectInstance, rentCanInvoke, stripeScopeKey]);

  const fetchPublishableKey = async () => {
    try {
      const response = await axiosServices.get('/api/stripe/publishable-key');
      const publishableKey = response.data?.publishableKey;
      if (publishableKey) {
        // For Connect, we use the publishable key directly
        // The Connect instance will be created when we have the client secret
      } else {
        console.warn('Stripe publishable key was not returned.');
      }
    } catch (error) {
      console.error('Error fetching Stripe publishable key:', error);
      console.error('Error details:', error?.response?.data || error?.message);
    }
  };

  const checkAccountStatus = async () => {
    if ((!user?.id && !user?.Id) || !stripeScopeKey || !requestLifecycleRef.current.isCurrent(stripeScopeKey)) return;
    setCheckingStatus(true);
    return requestLifecycleRef.current.run({
      scopeKey: stripeScopeKey,
      channel: 'account-status',
      request: ({ signal }) => axiosServices.get('/api/stripe/account-status', { signal }),
      onSuccess: (response) => {
        const data = response.data?.success ? response.data.data : null;
        setAccountStatus({
          AccountId: data?.accountId || null,
          Status: data?.status || null,
          IsEnabled: data?.isEnabled === true,
          ChargesEnabled: data?.chargesEnabled === true,
          PayoutsEnabled: data?.payoutsEnabled === true,
          DetailsSubmitted: data?.detailsSubmitted === true,
          InternalReviewStatus: data?.internalReviewStatus || 'Onboarding',
          IsInternallyPayoutApproved: data?.isInternallyPayoutApproved === true,
          IsAccountReadyForRentTransfers: data?.isAccountReadyForRentTransfers === true,
          AccountReadinessReason: data?.accountReadinessReason || null,
          CanManageAccount: data?.canManageAccount === true
        });
        setAccountStatusLoadedSuccessfully(true);
      },
      onError: (error) => {
        console.error('Error checking Stripe account status:', error);
        setAccountStatus({ AccountId: null, CanManageAccount: false });
        setAccountStatusLoadedSuccessfully(false);
      },
      onFinally: () => setCheckingStatus(false)
    });
  };

  const openConnectPreparation = async () => {
    if (!canCreateInitialAccount || !stripeScopeKey) return;
    setShowPreparation(true);
    setPreparationLoading(true);
    return requestLifecycleRef.current.run({
      scopeKey: stripeScopeKey,
      channel: 'connect-preparation',
      request: ({ signal }) => axiosServices.get('/api/stripe/connect-preparation', { signal }),
      onSuccess: (response) => setConnectPreparation(response.data || null),
      onError: (error) => {
        setShowPreparation(false);
        openSnackbar({
          open: true,
          message: error?.response?.data?.message || 'Your saved payout setup could not be loaded. Please try again.',
          variant: 'alert',
          alert: { color: 'error' }
        });
      },
      onFinally: () => setPreparationLoading(false)
    });
  };

  const handlePreparedConnectAccount = async (context) => {
    if (!canCreateInitialAccount || !stripeScopeKey || connectSubmissionRef.current) return;
    const validationErrors = validateConnectOnboardingContext(
      context,
      properties.map((property) => property?.id ?? property?.Id).filter((propertyId) => propertyId != null)
    );
    if (Object.keys(validationErrors).length > 0) {
      openSnackbar({
        open: true,
        message: 'Confirm your property authority before continuing to Stripe.',
        variant: 'alert',
        alert: { color: 'warning' }
      });
      return;
    }

    connectSubmissionRef.current = true;
    setConnecting(true);
    return requestLifecycleRef.current.run({
      scopeKey: stripeScopeKey,
      channel: 'initial-account-creation',
      request: async ({ signal }) => {
        const { ein, ...preparationContext } = context;
        const preparationResponse = await axiosServices.post('/api/stripe/connect-preparation', preparationContext, { signal });
        const savedPreparation = preparationResponse.data;
        if (!savedPreparation?.id || !Array.isArray(savedPreparation.propertyIds) || !savedPreparation.updatedAt) {
          throw new Error('Property Peace could not confirm the saved payout setup.');
        }
        const returnUrl = `${window.location.origin}/landlord/settings?tab=payments&stripe=connected`;
        const createResponse = await axiosServices.post(
          '/api/stripe/connect-account',
          {
            returnUrl,
            refreshUrl: returnUrl,
            operatingType: preparationContext.operatingType,
            legalBusinessName: preparationContext.operatingType === 'business' ? preparationContext.displayName : null,
            ein
          },
          { signal }
        );
        const onboardingUrl = getInitialStripeOnboardingUrl(createResponse.data);
        if (!onboardingUrl) {
          throw new Error(createResponse.data?.message || 'Stripe account creation did not return an onboarding URL.');
        }
        return { savedPreparation, onboardingUrl };
      },
      onSuccess: ({ savedPreparation, onboardingUrl }) => {
        setConnectPreparation(savedPreparation);
        setShowPreparation(false);
        window.location.assign(onboardingUrl);
      },
      onError: (error) => {
        console.error('Error connecting Stripe account:', error);
        openSnackbar({
          open: true,
          message: error?.response?.data?.message || error?.message || 'Failed to connect Stripe account',
          variant: 'alert',
          alert: { color: 'error' }
        });
      },
      onFinally: () => {
        connectSubmissionRef.current = false;
        setConnecting(false);
      }
    });
  };

  const openEmbeddedOnboarding = async () => {
    if (!canManageAccount || !stripeScopeKey || !accountStatus?.AccountId) return;
    const callbackGuard = requestLifecycleRef.current.capture(stripeScopeKey);
    const requestToken = Symbol('embedded-onboarding');
    embeddedOnboardingRequestRef.current = requestToken;

    try {
      setFetchingSession(true);

      const accountId = accountStatus.AccountId;
      
      // Get publishable key first
      const keyResponse = await axiosServices.get('/api/stripe/publishable-key');
      if (!callbackGuard.isCurrent() || embeddedOnboardingRequestRef.current !== requestToken) return;
      const publishableKey = keyResponse.data?.publishableKey;
      if (!publishableKey) {
        console.error('Stripe publishable key is missing.');
        throw new Error('Failed to get publishable key');
      }
      // Initialize Stripe Connect instance
      const connectInstance = loadConnectAndInitialize({
        publishableKey: publishableKey,
        fetchClientSecret: async () => {
          try {
            if (!callbackGuard.isCurrent()) {
              throw new DOMException('Organization changed', 'AbortError');
            }
            // Get account session for embedded onboarding
            const sessionResponse = await axiosServices.post('/api/stripe/account-session');
            if (!callbackGuard.isCurrent()) {
              throw new DOMException('Organization changed', 'AbortError');
            }
            
            if (sessionResponse.data && sessionResponse.data.success && sessionResponse.data.data) {
              const clientSecret = sessionResponse.data.data.clientSecret;
              
              if (!clientSecret || typeof clientSecret !== 'string') {
                console.error('Stripe account-session client secret is invalid.');
                throw new Error('Invalid client secret returned from API');
              }
              
              return clientSecret;
            }
            
            console.error('Stripe account-session response is missing data.');
            throw new Error('Failed to create account session - invalid response');
          } catch (error) {
            console.error('Error in fetchClientSecret:', error);
            throw error;
          }
        },
        appearance: {
          overlays: 'dialog',
          variables: {
            colorPrimary: '#061e35',
            colorBackground: 'transparent',
            colorText: 'inherit',
            colorDanger: '#f44336',
            fontFamily: "'Public Sans', sans-serif",
            borderRadius: '4px',
            spacingUnit: '4px'
          },
          rules: {
            '.Input': {
              backgroundColor: 'transparent',
              borderColor: 'rgba(255, 255, 255, 0.23)',
              color: 'inherit',
              fontSize: '0.875rem',
              padding: '8px 12px'
            },
            '.Input:focus': {
              borderColor: '#061e35',
              boxShadow: '0 0 0 2px rgba(6, 30, 53, 0.2)'
            },
            '.Label': {
              color: 'inherit',
              fontSize: '0.875rem',
              fontWeight: 500,
              marginBottom: '8px'
            },
            '.Select': {
              backgroundColor: 'transparent',
              borderColor: 'rgba(255, 255, 255, 0.23)',
              color: 'inherit'
            }
          }
        }
      });

      if (!callbackGuard.isCurrent() || embeddedOnboardingRequestRef.current !== requestToken) return;
      connectCallbackGuardRef.current = callbackGuard;
      setStripeConnectInstance(connectInstance);
      setShowOnboarding(true);
    } catch (error) {
      if (!callbackGuard.isCurrent() || embeddedOnboardingRequestRef.current !== requestToken) return;
      console.error('Error opening embedded onboarding:', error);
      openSnackbar({
        open: true,
        message: error?.response?.data?.message || error?.message || 'Failed to open onboarding',
        variant: 'alert',
        alert: { color: 'error' }
      });
    } finally {
      if (callbackGuard.isCurrent() && embeddedOnboardingRequestRef.current === requestToken) {
        embeddedOnboardingRequestRef.current = null;
        setFetchingSession(false);
      }
    }
  };

  const openBankAccountManagement = async (mode = 'manage') => {
    if (!canManageAccount || !stripeScopeKey || !accountStatus?.AccountId) return;

    setOpeningBankManagement(true);
    setBankManagementError('');
    setBankManagementMode(mode);
    return requestLifecycleRef.current.run({
      scopeKey: stripeScopeKey,
      channel: 'bank-account-management-bootstrap',
      request: ({ signal }) => axiosServices.get('/api/stripe/publishable-key', { signal }),
      onSuccess: (keyResponse) => {
        const publishableKey = keyResponse.data?.publishableKey;
        if (!publishableKey) throw new Error('Stripe is not configured for bank-account management.');

        const callbackGuard = requestLifecycleRef.current.capture(stripeScopeKey);
        bankManagementCallbackGuardRef.current = callbackGuard;
        const connectInstance = loadConnectAndInitialize({
          publishableKey,
          fetchClientSecret: async () => {
            if (!callbackGuard.isCurrent() || bankManagementCallbackGuardRef.current !== callbackGuard) {
              throw new DOMException('Organization changed', 'AbortError');
            }
            const sessionResponse = await axiosServices.post('/api/stripe/account-management-session');
            if (!callbackGuard.isCurrent() || bankManagementCallbackGuardRef.current !== callbackGuard) {
              throw new DOMException('Organization changed', 'AbortError');
            }
            const clientSecret = sessionResponse.data?.data?.clientSecret;
            if (!clientSecret) throw new Error('Stripe did not return a valid bank-account management session.');
            return clientSecret;
          },
          appearance: {
            overlays: 'dialog',
            variables: {
              colorPrimary: '#061e35',
              fontFamily: "'Public Sans', sans-serif",
              borderRadius: '8px',
              spacingUnit: '4px'
            }
          }
        });

        setBankManagementInstance(connectInstance);
        setBankManagementOpen(true);
      },
      onError: (error) => {
        console.error('Unable to open Stripe bank-account management:', error);
        setBankManagementError('Stripe bank-account management is temporarily unavailable. Please try again.');
      },
      onFinally: () => setOpeningBankManagement(false)
    });
  };

  const closeBankAccountManagement = () => {
    const refreshGuard = requestLifecycleRef.current.capture(stripeScopeKey);
    bankManagementCallbackGuardRef.current = null;
    setBankManagementOpen(false);
    setBankManagementInstance(null);
    setBankManagementError('');
    setBankManagementMode('manage');

    // Stripe/webhook synchronization can lag behind the embedded component closing.
    // Refresh immediately, then retry for a short bounded window.
    [0, 1500, 4000].forEach((delay) => {
      setTimeout(() => {
        if (!refreshGuard.isCurrent()) return;
        fetchBankAccounts();
        checkAccountStatus();
      }, delay);
    });
  };

  const handleOnboardingComplete = async () => {
    if (!connectCallbackGuardRef.current?.isCurrent() || !canManageAccount || !stripeScopeKey) return;
    const callbackGuard = connectCallbackGuardRef.current;
    setShowOnboarding(false);

    // Wait a moment for Stripe to process the update, then refresh account status
    setTimeout(async () => {
      if (!callbackGuard.isCurrent()) return;
      await checkAccountStatus();
      if (!callbackGuard.isCurrent()) return;
      
      openSnackbar({
        open: true,
        message: 'Stripe received your information. We will show any remaining verification or Property Peace review steps here.',
        variant: 'alert',
        alert: { color: 'info' }
      });
    }, 1500);
  };

  const handleOnboardingExit = async () => {
    if (!connectCallbackGuardRef.current?.isCurrent() || !canManageAccount) return;
    const callbackGuard = connectCallbackGuardRef.current;
    setShowOnboarding(false);
    setTimeout(async () => {
      if (!callbackGuard.isCurrent()) return;
      await checkAccountStatus();
    }, 1500);
  };


  if (isDemo) {
    return <DemoStripePaymentsPreview />;
  }

  if (!rentCanInvoke) {
    return (
      <RentPaymentAccessPanel
        {...rentPaymentAccess}
        onRequest={rentPaymentAccess.requestAccess}
        onRefresh={rentPaymentAccess.refresh}
      />
    );
  }

  if (checkingStatus) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: 200 }}>
        <CircularProgress />
      </Box>
    );
  }

  const needsOnboarding = accountStatus?.AccountId && !accountStatus?.DetailsSubmitted;
  const hasNoAccount = !accountStatus?.AccountId || accountStatus?.AccountId === '' || accountStatus?.AccountId === null;
  const renderedBankManagementGuard = bankManagementCallbackGuardRef.current;
  const organizationName = currentOrganization?.name ?? currentOrganization?.Name ?? 'Your organization';
  const entityName = bankAccounts.find((account) => account.accountName)?.accountName || organizationName;
  const entityStatus = accountStatus?.IsEnabled === true
    ? { label: 'Enabled', color: 'success', variant: 'filled' }
    : accountStatus?.InternalReviewStatus === 'Suspended'
      ? { label: 'Suspended', color: 'error', variant: 'filled' }
      : needsOnboarding
        ? { label: 'Setup required', color: 'warning', variant: 'outlined' }
        : accountStatus?.DetailsSubmitted === true
          ? { label: 'Under review', color: 'info', variant: 'outlined' }
          : { label: 'Not connected', color: 'default', variant: 'outlined' };
  const bankManagementTitle = bankManagementMode === 'entity'
    ? 'Edit payment entity'
    : bankManagementMode === 'remove'
      ? 'Remove a Stripe bank account'
      : bankManagementMode === 'add'
        ? 'Add a Stripe bank account'
        : 'Manage Stripe bank accounts';
  const addAccountButton = (
    <Button
      variant="contained"
      startIcon={openingBankManagement ? <CircularProgress size={16} color="inherit" /> : <PlusOutlined />}
      onClick={hasNoAccount
        ? openConnectPreparation
        : needsOnboarding
          ? openEmbeddedOnboarding
          : () => openBankAccountManagement('add')}
      disabled={
        (hasNoAccount ? !canCreateInitialAccount : !canManageAccount) ||
        connecting ||
        loading ||
        fetchingSession ||
        openingBankManagement
      }
      sx={{ whiteSpace: 'nowrap', width: { xs: '100%', sm: 'auto' } }}
    >
      {connecting
        ? 'Connecting…'
        : fetchingSession || openingBankManagement
          ? 'Opening Stripe…'
          : hasNoAccount
            ? 'Add Stripe account'
            : needsOnboarding
              ? 'Complete Stripe setup'
              : 'Add bank account'}
    </Button>
  );

  return (
    <Box>
      {headerActionElement && createPortal(addAccountButton, headerActionElement)}
      <Stack spacing={3}>
        <Stack
          direction={{ xs: 'column', sm: 'row' }}
          spacing={1.5}
          alignItems={{ xs: 'stretch', sm: 'center' }}
          justifyContent="space-between"
        >
          <Box>
            <Typography variant="h5" fontWeight={700}>
              Bank accounts
            </Typography>
            <Typography variant="body2" color="text.secondary">
              Manage the payment entity and payout accounts connected to this organization.
            </Typography>
          </Box>
          {!headerActionElement && addAccountButton}
        </Stack>

        <RentPaymentAccessPanel
          {...rentPaymentAccess}
          onRequest={rentPaymentAccess.requestAccess}
          onRefresh={rentPaymentAccess.refresh}
          onConfigure={hasNoAccount
            ? (canCreateInitialAccount ? openConnectPreparation : undefined)
            : (canManageAccount ? openEmbeddedOnboarding : undefined)}
        />

        {/* Payment entity */}
        <Paper variant="outlined" sx={{ overflow: 'hidden', bgcolor: 'background.paper' }}>
          <Stack
            direction={{ xs: 'column', sm: 'row' }}
            spacing={2}
            alignItems={{ xs: 'stretch', sm: 'center' }}
            justifyContent="space-between"
            sx={{ p: { xs: 2.5, md: 3 }, borderBottom: '1px solid', borderColor: 'divider' }}
          >
            <Stack direction="row" spacing={1.5} alignItems="center">
              <Box
                sx={{
                  width: 42,
                  height: 42,
                  display: 'grid',
                  placeItems: 'center',
                  borderRadius: 2,
                  bgcolor: (t) => alpha(t.palette.primary.main, 0.1),
                  color: 'primary.main'
                }}
              >
                <CreditCardOutlined style={{ fontSize: 21 }} />
              </Box>
              <Box>
                <Typography variant="overline" color="text.secondary" sx={{ lineHeight: 1.2 }}>
                  Payment entity
                </Typography>
                <Stack direction="row" spacing={1} alignItems="center" useFlexGap flexWrap="wrap">
                  <Typography variant="h6" fontWeight={700}>
                    {entityName}
                  </Typography>
                  <Chip
                    size="small"
                    label={entityStatus.label}
                    color={entityStatus.color}
                    variant={entityStatus.variant}
                    sx={{ fontWeight: 700 }}
                  />
                </Stack>
              </Box>
            </Stack>
            {canManageAccount && (
              <Button
                variant="outlined"
                startIcon={<EditOutlined />}
                onClick={needsOnboarding ? openEmbeddedOnboarding : () => openBankAccountManagement('entity')}
                disabled={fetchingSession || openingBankManagement}
              >
                Edit entity
              </Button>
            )}
          </Stack>

          {needsOnboarding && (
            <Alert severity="warning" sx={{ m: { xs: 2.5, md: 3 }, mb: 0 }}>
              Additional business information is required before Stripe can finish setting up payouts.
            </Alert>
          )}

          <Box
            sx={{
              p: { xs: 2.5, md: 3 },
              display: 'grid',
              gridTemplateColumns: { xs: '1fr', sm: 'minmax(150px, 0.35fr) minmax(0, 1fr)' },
              rowGap: 1.5,
              columnGap: 3
            }}
          >
            <Typography variant="subtitle2">Account type</Typography>
            <Typography variant="body2" color="text.secondary">Business</Typography>
            <Typography variant="subtitle2">Name</Typography>
            <Typography variant="body2" color="text.secondary">{entityName}</Typography>
            <Typography variant="subtitle2">Doing business as</Typography>
            <Typography variant="body2" color="text.secondary">{entityName}</Typography>
          </Box>
        </Paper>

        {/* Bank Accounts Section */}
        <Paper variant="outlined" sx={{ p: 3, bgcolor: (t) => alpha(t.palette.background.paper, 0.6) }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
            <BankOutlined style={{ fontSize: 20, color: '#1890ff' }} />
            <Typography variant="h6" fontWeight="bold">
              Connected bank accounts
            </Typography>
          </Box>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
            Payout destinations connected beneath this payment entity. Bank details are added, edited, and removed securely in Stripe.
          </Typography>
          {bankManagementError && <Alert severity="error" sx={{ mb: 2 }}>{bankManagementError}</Alert>}

          {loadingBankAccounts ? (
            <Box sx={{ display: 'flex', justifyContent: 'center', py: 4 }}>
              <CircularProgress />
            </Box>
          ) : bankAccounts.length === 0 ? (
            <Alert severity="info">
              No payout account found. Complete Stripe setup to add the bank account that will receive rent payouts.
            </Alert>
          ) : (
            <Grid container spacing={2}>
              {bankAccounts.map((account) => (
                <Grid item xs={12} sm={6} key={account.id}>
                  <Card variant="outlined" sx={{ height: '100%' }}>
                    <CardContent>
                      <Stack spacing={2}>
                        <Box>
                          <Stack direction="row" spacing={1} alignItems="center" sx={{ mb: 1 }}>
                            <BankOutlined style={{ fontSize: 18, color: '#1890ff' }} />
                            <Typography variant="subtitle1" fontWeight="600">
                              {account.bankName || account.accountName || 'Unnamed Account'}
                              {account.last4 && (
                                <Typography component="span" variant="subtitle1" fontWeight="600" sx={{ ml: 1, color: 'text.secondary' }}>
                                  •••• {account.last4}
                                </Typography>
                              )}
                            </Typography>
                          </Stack>
                          {account.stripeAccountId && (
                            <Typography variant="body2" color="text.secondary" sx={{ fontFamily: 'monospace', fontSize: '0.75rem' }}>
                              {account.stripeAccountId}
                            </Typography>
                          )}
                        </Box>

                        {canManageAccount && (
                          <Stack direction="row" spacing={1} useFlexGap flexWrap="wrap">
                            <Button
                              variant="outlined"
                              size="small"
                              startIcon={<EditOutlined />}
                              onClick={() => openBankAccountManagement('edit')}
                              disabled={openingBankManagement}
                            >
                              Edit
                            </Button>
                            <Button
                              variant="outlined"
                              color="error"
                              size="small"
                              startIcon={<DeleteOutlined />}
                              onClick={() => openBankAccountManagement('remove')}
                              disabled={openingBankManagement}
                            >
                              Remove
                            </Button>
                          </Stack>
                        )}
                      </Stack>
                    </CardContent>
                  </Card>
                </Grid>
              ))}
            </Grid>
          )}
        </Paper>

      </Stack>

      <ConnectOnboardingWizard
        open={showPreparation}
        onClose={() => setShowPreparation(false)}
        onContinue={handlePreparedConnectAccount}
        properties={properties}
        propertiesLoading={propertiesLoading}
        propertiesError={propertiesError}
        onRetryProperties={propertiesRefetch}
        user={user}
        initialDraft={connectPreparation}
        preparationLoading={preparationLoading}
        loading={connecting}
      />

      {/* Embedded Onboarding Dialog */}
      <Dialog
        open={showOnboarding}
        onClose={handleOnboardingExit}
        maxWidth="md"
        fullWidth
        PaperProps={{
          sx: {
            borderRadius: 2,
            boxShadow: (theme) => `0 8px 32px ${alpha(theme.palette.common.black, 0.12)}`,
            minHeight: '600px',
            maxHeight: '90vh',
            display: 'flex',
            flexDirection: 'column'
          }
        }}
      >
        <DialogTitle
          sx={{
            fontWeight: 700,
            fontSize: '1.5rem',
            pb: 2,
            pt: 3,
            px: 3,
            borderBottom: (theme) => `1px solid ${alpha(theme.palette.divider, 0.1)}`,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: 1.5
          }}
        >
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
            <Box
              sx={{
                p: 1,
                borderRadius: 1.5,
                bgcolor: (theme) => alpha(theme.palette.primary.main, 0.1),
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center'
              }}
            >
              <CreditCardOutlined style={{ fontSize: 24, color: '#1890ff' }} />
            </Box>
            <Typography variant="h6" component="span" sx={{ fontWeight: 700 }}>
              Complete Your Stripe Account Setup
            </Typography>
          </Box>
          <IconButton
            onClick={handleOnboardingExit}
            size="small"
            sx={{
              color: 'text.secondary',
              '&:hover': {
                backgroundColor: (theme) => alpha(theme.palette.error.main, 0.1),
                color: 'error.main'
              }
            }}
          >
            <CloseOutlined />
          </IconButton>
        </DialogTitle>
        <DialogContent
          sx={{
            p: 3,
            flex: 1,
            display: 'flex',
            flexDirection: 'column',
            overflow: 'auto',
            maxHeight: 'calc(90vh - 120px)'
          }}
        >
          {stripeConnectInstance ? (
            <Box
              sx={{
                width: '100%',
                minHeight: '500px',
                display: 'flex',
                flexDirection: 'column',
                // Style Stripe Connect components to match app theme
                '& [class*="Connect"]': {
                  fontFamily: "'Public Sans', sans-serif"
                },
                '& input, & select, & textarea': {
                  backgroundColor: 'transparent !important',
                  borderColor: 'rgba(255, 255, 255, 0.23) !important',
                  color: 'inherit !important',
                  fontSize: '0.875rem !important',
                  borderRadius: '4px !important',
                  '&:focus': {
                    borderColor: '#061e35 !important',
                    boxShadow: '0 0 0 2px rgba(6, 30, 53, 0.2) !important',
                    outline: 'none !important'
                  }
                },
                '& label': {
                  color: 'inherit !important',
                  fontSize: '0.875rem !important',
                  fontWeight: 500,
                  marginBottom: '8px !important'
                },
                '& button[type="submit"]': {
                  backgroundColor: '#061e35 !important',
                  color: '#fff !important',
                  borderRadius: '4px !important',
                  fontWeight: 600,
                  textTransform: 'none',
                  '&:hover': {
                    backgroundColor: '#042238 !important'
                  }
                }
              }}
            >
              <ConnectComponentsProvider connectInstance={stripeConnectInstance}>
                <ConnectAccountOnboarding
                  onComplete={handleOnboardingComplete}
                  onExit={handleOnboardingExit}
                />
              </ConnectComponentsProvider>
            </Box>
          ) : (
            <Box
              sx={{
                display: 'flex',
                flexDirection: 'column',
                justifyContent: 'center',
                alignItems: 'center',
                minHeight: '500px',
                gap: 2
              }}
            >
              <CircularProgress size={48} />
              <Typography variant="body2" color="text.secondary">
                Loading onboarding form...
              </Typography>
            </Box>
          )}
        </DialogContent>
      </Dialog>

      <Dialog open={bankManagementOpen} onClose={closeBankAccountManagement} fullWidth maxWidth="md">
        <DialogTitle sx={{ pr: 6 }}>
          {bankManagementTitle}
          <IconButton
            aria-label="Close Stripe bank account management"
            onClick={closeBankAccountManagement}
            sx={{ position: 'absolute', right: 12, top: 12 }}
          >
            <CloseOutlined />
          </IconButton>
        </DialogTitle>
        <DialogContent dividers sx={{ minHeight: 420, p: { xs: 1.5, sm: 2.5 } }}>
          <Alert severity="info" icon={false} sx={{ mb: 2 }}>
            {bankManagementMode === 'entity'
              ? 'Update the business and identity information Stripe uses for this payment entity.'
              : bankManagementMode === 'remove'
                ? 'Choose the bank account to remove in Stripe. Stripe may require another payout account before the current default can be removed.'
                : 'Add or update bank accounts directly with Stripe. Property Peace only displays safe account details such as bank name and last four digits.'}
          </Alert>
          {bankManagementError && <Alert severity="error" sx={{ mb: 2 }}>{bankManagementError}</Alert>}
          {bankManagementInstance && (
            <ConnectComponentsProvider connectInstance={bankManagementInstance}>
              <ConnectAccountManagement
                onLoaderStart={() => {
                  if (
                    renderedBankManagementGuard &&
                    bankManagementCallbackGuardRef.current === renderedBankManagementGuard &&
                    renderedBankManagementGuard.isCurrent()
                  ) setBankManagementError('');
                }}
                onLoadError={() => {
                  if (
                    renderedBankManagementGuard &&
                    bankManagementCallbackGuardRef.current === renderedBankManagementGuard &&
                    renderedBankManagementGuard.isCurrent()
                  ) {
                    setBankManagementError('Stripe bank-account management could not load. Close this window and try again.');
                  }
                }}
              />
            </ConnectComponentsProvider>
          )}
        </DialogContent>
      </Dialog>
    </Box>
  );
}

export default function PaymentsSettings() {
  const rentPaymentAccess = useRentPaymentAccess();
  return <PaymentsSettingsContent rentPaymentAccess={rentPaymentAccess} />;
}
