import { useState, useEffect, useLayoutEffect, useRef, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
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
  Grid,
  useTheme
} from '@mui/material';
import { CreditCardOutlined, CheckCircleOutlined, CloseOutlined, BankOutlined, ReloadOutlined, ExportOutlined } from '@ant-design/icons';
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
import ShortStayConnect from 'pages/landlord/short-stay-connect.jsx';
import { validateConnectOnboardingContext } from 'utils/connectOnboarding';
import { ONLINE_PAYMENT_SETUP_PATH } from 'utils/onlinePaymentTabs';
import { getStripeBankAccountStatus } from 'utils/stripeBankAccountStatus';
import { getTrustedStripeAuthorizationUrl } from './stripeExistingAccountUrl.mjs';
import OnlinePaymentsIntroDialog from './OnlinePaymentsIntroDialog';
import { useOrganization } from 'contexts/OrganizationContext';
import {
  canCreateInitialStripeAccount,
  canManageStripeAccount,
  createStripeOrganizationRequestLifecycle,
  getInitialStripeOnboardingUrl,
  makeStripeOrganizationScopeKey,
  readStripeAccountStatus
} from 'utils/stripeOrganizationRequestLifecycle';

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

export function PaymentsSettingsContent({ rentPaymentAccess, introScope, showStripeSetup = false, initialSetupMode = 'new', onOpenStripeSetup, onCloseStripeSetup }) {
  const theme = useTheme();
  const navigate = useNavigate();
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
  const [checkingStatus, setCheckingStatus] = useState(true);
  const [accountStatus, setAccountStatus] = useState(null);
  const [accountStatusScopeKey, setAccountStatusScopeKey] = useState(null);
  const [connecting, setConnecting] = useState(false);
  const [preparation, setPreparation] = useState({ status: 'idle' });
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
  const [bankAccountsError, setBankAccountsError] = useState(false);
  const prevShowOnboardingRef = useRef(false);
  const connectSubmissionRef = useRef(false);
  const existingAccountReturnHandled = useRef(false);
  const requestLifecycleRef = useRef(null);
  const connectCallbackGuardRef = useRef(null);
  const embeddedOnboardingRequestRef = useRef(null);
  const bankManagementCallbackGuardRef = useRef(null);
  const isDemo = user?.isDemo === true || user?.IsDemo === true;
  const canManageAccount = canManageStripeAccount(accountStatus);
  const canCreateInitialAccount = canCreateInitialStripeAccount({
    statusLoadedSuccessfully: Boolean(stripeScopeKey) && accountStatusScopeKey === stripeScopeKey,
    status: accountStatus,
    rentCanInvoke,
    organizationId: currentOrganization?.id ?? currentOrganization?.Id
  });

  if (!requestLifecycleRef.current) {
    requestLifecycleRef.current = createStripeOrganizationRequestLifecycle(() => {
      setAccountStatus(null);
      setAccountStatusScopeKey(null);
      setBankAccounts([]);
      setBankAccountsError(false);
      setPreparation({ status: 'idle' });
      setShowOnboarding(false);
      setStripeConnectInstance(null);
      setCheckingStatus(false);
      setConnecting(false);
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
      setShowOnboarding(false);
      setStripeConnectInstance(null);
      return;
    }

    checkAccountStatus();
    fetchPublishableKey();
    fetchBankAccounts();
    
    // Check if we're returning from Stripe connection.
    const urlParams = new URLSearchParams(window.location.search);
    const stripeReturn = urlParams.get('stripe');
    if (stripeReturn === 'connected' || stripeReturn === 'refresh') {
      urlParams.delete('stripe');
      navigate({ search: urlParams.toString() }, { replace: true });
    }

    const existingStripeReturn = window.__propertyPeaceExistingStripeReturn || (stripeReturn === 'existing-return'
      ? { code: urlParams.get('code'), state: urlParams.get('state'), error: urlParams.get('error') }
      : null);
    if (existingStripeReturn) {
      delete window.__propertyPeaceExistingStripeReturn;
      const { code, state, error } = existingStripeReturn;
      if (stripeReturn === 'existing-return') {
        ['stripe', 'code', 'state', 'error'].forEach((name) => urlParams.delete(name));
        navigate({ search: urlParams.toString() }, { replace: true });
      }

      if (!existingAccountReturnHandled.current) {
        existingAccountReturnHandled.current = true;
        requestLifecycleRef.current.run({
          scopeKey: stripeScopeKey,
          channel: 'existing-account-complete',
          request: ({ signal }) => axiosServices.post('/api/stripe/existing-account/complete', { code, state, error }, { signal }),
          onSuccess: (response) => {
            if (response.data?.connected === true) {
              checkAccountStatus();
              fetchBankAccounts();
              openSnackbar({ open: true, message: 'Stripe connection confirmed. Refreshing account status…', variant: 'alert', alert: { color: 'success' } });
              return;
            }
            if (response.data?.cancelled === true) {
              openSnackbar({ open: true, message: 'Connecting your existing Stripe account was cancelled.', variant: 'alert', alert: { color: 'info' } });
              return;
            }
            openSnackbar({ open: true, message: 'Stripe did not confirm a connected account. Please try again.', variant: 'alert', alert: { color: 'warning' } });
          },
          onError: (completionError) => openSnackbar({
            open: true,
            message: completionError?.response?.status === 503
              ? 'Connecting an existing Stripe account is not available yet. Please contact support or set up a new Stripe account.'
              : completionError?.response?.data?.message || 'Unable to complete the Stripe account connection. Please try again.',
            variant: 'alert',
            alert: { color: 'error' }
          })
        });
      }
    }

    if (stripeReturn === 'connected') {
      // Refresh account status after a short delay to ensure Stripe has processed
      const returnRefreshGuard = requestLifecycleRef.current.capture(stripeScopeKey);
      const returnRefreshTimeout = setTimeout(() => {
        if (!returnRefreshGuard.isCurrent()) return;
        checkAccountStatus();
        fetchBankAccounts();
      }, 1000);

      return () => clearTimeout(returnRefreshTimeout);
    }
  }, [user, stripeScopeKey, isDemo, rentCanInvoke, rentReadinessLoading, rentReadinessError, navigate]);

  const fetchBankAccounts = async () => {
    if (!stripeScopeKey || !requestLifecycleRef.current.isCurrent(stripeScopeKey)) return;
    setLoadingBankAccounts(true);
    setBankAccountsError(false);
    return requestLifecycleRef.current.run({
      scopeKey: stripeScopeKey,
      channel: 'bank-accounts',
      request: () => bankAccountAPI.getBankAccounts(currentOrganization?.id ?? currentOrganization?.Id),
      onSuccess: (response) => {
        if (!response.success || !Array.isArray(response.data)) {
          setBankAccountsError(true);
          return;
        }
        setBankAccounts(response.data);
      },
      onError: (error) => {
        console.error('Error fetching bank accounts:', error);
        setBankAccountsError(true);
      },
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
        const data = readStripeAccountStatus(response.data);
        setAccountStatus({
          AccountId: data?.accountId || null,
          Status: data?.status || null,
          IsEnabled: data?.isEnabled === true,
          ChargesEnabled: data?.chargesEnabled === true,
          PayoutsEnabled: data?.payoutsEnabled === true,
          CardPaymentsCapabilityStatus: data?.cardPaymentsCapabilityStatus || null,
          IsVerificationPending: data?.isVerificationPending === true,
          HasPastDueRequirements: data?.hasPastDueRequirements === true,
          PastDueRequirementLabels: data?.pastDueRequirementLabels,
          DetailsSubmitted: data?.detailsSubmitted === true,
          IsAccountReadyForRentTransfers: data?.isAccountReadyForRentTransfers === true,
          AccountReadinessReason: data?.accountReadinessReason || null,
          CanManageAccount: data?.canManageAccount === true
        });
        setAccountStatusScopeKey(data ? stripeScopeKey : null);
      },
      onError: (error) => {
        console.error('Error checking Stripe account status:', error);
        setAccountStatus({ AccountId: null, CanManageAccount: false });
        setAccountStatusScopeKey(null);
      },
      onFinally: () => setCheckingStatus(false)
    });
  };

  const refreshStripeStatus = () => {
    checkAccountStatus();
    fetchBankAccounts();
  };

  const loadConnectPreparation = useCallback(async () => {
    if (!canCreateInitialAccount || !stripeScopeKey) return;
    setPreparation({ status: 'loading' });
    return requestLifecycleRef.current.run({
      scopeKey: stripeScopeKey,
      channel: 'connect-preparation',
      request: ({ signal }) => axiosServices.get('/api/stripe/connect-preparation', { signal }),
      onSuccess: (response) => setPreparation({ status: 'ready', data: response.data || null }),
      onError: (error) => setPreparation({
        status: 'error',
        error: error?.response?.data?.message || 'Your saved payout setup could not be loaded.'
      })
    });
  }, [canCreateInitialAccount, stripeScopeKey]);

  useEffect(() => {
    if (showStripeSetup && !isDemo && !rentReadinessLoading && !rentReadinessError && canCreateInitialAccount && preparation.status === 'idle') {
      loadConnectPreparation();
    }
  }, [showStripeSetup, isDemo, rentReadinessLoading, rentReadinessError, canCreateInitialAccount, preparation.status, loadConnectPreparation]);

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
        const createResponse = await axiosServices.post(
          '/api/stripe/connect-account',
          {

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
        return onboardingUrl;
      },
      onSuccess: (onboardingUrl) => {
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

  const handlePreparedExistingAccount = async (context) => {
    if (!canCreateInitialAccount || !stripeScopeKey || connectSubmissionRef.current) return;
    const validationErrors = validateConnectOnboardingContext(
      context,
      properties.map((property) => property?.id ?? property?.Id).filter((propertyId) => propertyId != null)
    );
    if (Object.keys(validationErrors).length > 0) {
      openSnackbar({ open: true, message: 'Confirm your property authority before continuing to Stripe.', variant: 'alert', alert: { color: 'warning' } });
      return;
    }

    connectSubmissionRef.current = true;
    setConnecting(true);
    return requestLifecycleRef.current.run({
      scopeKey: stripeScopeKey,
      channel: 'existing-account-authorize',
      request: async ({ signal }) => {
        const { ein: _ein, ...preparationContext } = context;
        const preparationResponse = await axiosServices.post('/api/stripe/connect-preparation', preparationContext, { signal });
        const savedPreparation = preparationResponse.data;
        if (!savedPreparation?.id || !Array.isArray(savedPreparation.propertyIds) || !savedPreparation.updatedAt) {
          throw new Error('Property Peace could not confirm the saved payout setup.');
        }
        const authorizationResponse = await axiosServices.post('/api/stripe/existing-account/authorize', {}, { signal });
        const authorizationUrl = getTrustedStripeAuthorizationUrl(authorizationResponse.data?.authorizationUrl);
        if (!authorizationUrl) throw new Error('Stripe did not return a valid account connection link.');
        return authorizationUrl;
      },
      onSuccess: (authorizationUrl) => window.location.assign(authorizationUrl),
      onError: (error) => openSnackbar({
        open: true,
        message: error?.response?.status === 503
          ? 'Connecting an existing Stripe account is not available yet. Please contact support or set up a new Stripe account.'
          : error?.response?.data?.message || error?.message || 'Unable to connect the existing Stripe account.',
        variant: 'alert',
        alert: { color: 'error' }
      }),
      onFinally: () => {
        connectSubmissionRef.current = false;
        setConnecting(false);
      }
    });
  };

  // Full-dashboard Standard accounts use Stripe-hosted onboarding, not embedded sessions.
  const openStripeHostedOnboarding = useCallback(async () => {
    if (!canManageAccount || !stripeScopeKey || !accountStatus?.AccountId) return;
    setFetchingSession(true);
    return requestLifecycleRef.current.run({
      scopeKey: stripeScopeKey,
      channel: 'hosted-onboarding',
      request: ({ signal }) => axiosServices.post('/api/stripe/account-link', { type: 'account_onboarding' }, { signal }),
      onSuccess: (response) => {
        const url = response.data?.onboardingUrl;
        if (!url) throw new Error('Stripe did not return an onboarding link.');
        window.location.assign(url);
      },
      onError: (error) => openSnackbar({ open: true, message: error?.response?.data?.message || error.message || 'Unable to open Stripe onboarding.', variant: 'alert', alert: { color: 'error' } }),
      onFinally: () => setFetchingSession(false)
    });
  }, [canManageAccount, stripeScopeKey, accountStatus?.AccountId]);

  const openStripeDashboard = () => {
    if (!canManageAccount || !stripeScopeKey || !accountStatus?.AccountId) return;
    window.open('https://dashboard.stripe.com/', '_blank', 'noopener,noreferrer');
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
            colorPrimary: theme.palette.primary.main,
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
              borderColor: theme.palette.primary.main,
              boxShadow: `0 0 0 2px ${alpha(theme.palette.primary.main, 0.2)}`
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
              colorPrimary: theme.palette.primary.main,
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
        message: 'Stripe received your information. Any remaining Stripe verification requirements will appear here.',
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
        onRefresh={rentPaymentAccess.refresh}
      />
    );
  }

  const statusLoaded = Boolean(stripeScopeKey) && accountStatusScopeKey === stripeScopeKey;

  if (checkingStatus && !statusLoaded) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: 200 }}>
        <CircularProgress aria-label="Loading Stripe status" />
      </Box>
    );
  }

  if (!statusLoaded) {
    return (
      <Alert severity="error" action={<Button color="inherit" onClick={refreshStripeStatus}>Retry</Button>}>
        Unable to check your Stripe account status.
      </Alert>
    );
  }

  const openStripeSetup = onOpenStripeSetup ?? (() => navigate(ONLINE_PAYMENT_SETUP_PATH));
  const openExistingStripeSetup = () => {
    if (onOpenStripeSetup) {
      onOpenStripeSetup('existing');
      return;
    }
    navigate(`${ONLINE_PAYMENT_SETUP_PATH}&setupMode=existing`);
  };

  if (showStripeSetup && canCreateInitialAccount) {
    if (preparation.status === 'error') {
      return (
        <Alert severity="error" action={<Button color="inherit" onClick={loadConnectPreparation}>Retry</Button>}>
          {preparation.error}
        </Alert>
      );
    }
    if (preparation.status !== 'ready') {
      return <Alert severity="info">Loading your saved payout setup…</Alert>;
    }
    return (
      <ConnectOnboardingWizard
        embedded
        onClose={onCloseStripeSetup}
        onContinue={handlePreparedConnectAccount}
        properties={properties}
        propertiesLoading={propertiesLoading}
        propertiesError={propertiesError}
        onRetryProperties={propertiesRefetch}
        user={user}
        initialDraft={preparation.data}
        initialSetupMode={initialSetupMode}
        onConnectExisting={handlePreparedExistingAccount}
        loading={connecting}
      />
    );
  }

  const renderedBankManagementGuard = bankManagementCallbackGuardRef.current;
  const organizationName = currentOrganization?.name ?? currentOrganization?.Name ?? 'Your organization';
  const entityName = bankAccounts.find((account) => account.accountName)?.accountName || organizationName;
  const stripeStatus = getStripeBankAccountStatus(accountStatus);
  const hasStripeAccount = Boolean(accountStatus.AccountId);
  const showBankAccounts = hasStripeAccount || bankAccounts.length > 0 || bankAccountsError;
  const canOpenStripeAction = hasStripeAccount ? canManageAccount : canCreateInitialAccount;
  const needsHostedOnboarding = stripeStatus.setupRequired || accountStatus.HasPastDueRequirements;
  const stripeAction = !hasStripeAccount ? openStripeSetup : needsHostedOnboarding ? openStripeHostedOnboarding : openStripeDashboard;
  const stripeActionLabel = !hasStripeAccount ? 'Set up Stripe' : stripeStatus.actionLabel ?? (needsHostedOnboarding ? 'Continue Stripe setup' : 'Manage in Stripe');
  const bankManagementTitle = bankManagementMode === 'entity'
    ? 'Edit payment entity'
    : bankManagementMode === 'remove'
      ? 'Remove a Stripe bank account'
      : bankManagementMode === 'add'
        ? 'Add a Stripe bank account'
        : 'Manage Stripe bank accounts';

  return (
    <Box>
      {introScope && canCreateInitialAccount && <OnlinePaymentsIntroDialog key={introScope} scopeKey={introScope} />}
      <Stack spacing={2}>
        <Typography component="h2" variant="h5" fontWeight={700}>
          Stripe account
        </Typography>

        <Paper variant="outlined">
          <Stack
            direction={{ xs: 'column', md: 'row' }}
            spacing={2}
            alignItems={{ xs: 'flex-start', md: 'center' }}
            justifyContent="space-between"
            sx={{ p: { xs: 2, sm: 2.5 } }}
          >
            <Stack direction="row" spacing={1.5} alignItems="flex-start">
              <Box
                sx={{
                  width: 40,
                  height: 40,
                  flexShrink: 0,
                  display: 'grid',
                  placeItems: 'center',
                  borderRadius: 1.5,
                  bgcolor: (t) => alpha(t.palette.primary.main, 0.1),
                  color: 'primary.main'
                }}
              >
                <CreditCardOutlined aria-hidden="true" style={{ fontSize: 20 }} />
              </Box>
              <Box aria-live="polite">
                <Stack direction="row" spacing={1} alignItems="center" useFlexGap flexWrap="wrap">
                  <Typography component="h3" variant="h6" fontWeight={700} sx={{ overflowWrap: 'anywhere' }}>
                    {entityName}
                  </Typography>
                  <Chip label={stripeStatus.label} color={stripeStatus.color} size="small" variant="outlined" />
                </Stack>
                <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
                  {stripeStatus.message}
                </Typography>
                {stripeStatus.requirements?.length > 0 && (
                  <Box component="ul" sx={{ m: 0, mt: 0.75, pl: 2.5, color: 'text.secondary' }}>
                    {stripeStatus.requirements.map((requirement) => (
                      <Typography key={requirement} component="li" variant="body2">{requirement}</Typography>
                    ))}
                  </Box>
                )}
              </Box>
            </Stack>
            <Stack direction="row" spacing={1} useFlexGap flexWrap="wrap" sx={{ flexShrink: 0, maxWidth: '100%' }}>
              {showBankAccounts && (
                <Button onClick={refreshStripeStatus} disabled={checkingStatus || loadingBankAccounts} startIcon={<ReloadOutlined aria-hidden="true" />}>
                  {checkingStatus || loadingBankAccounts ? 'Refreshing…' : 'Refresh status'}
                </Button>
              )}
              {canOpenStripeAction && (
                <Button
                  variant="contained"
                  endIcon={hasStripeAccount ? <ExportOutlined aria-hidden="true" /> : undefined}
                  onClick={stripeAction}
                  disabled={connecting || fetchingSession}
                >
                  {fetchingSession ? 'Opening Stripe…' : stripeActionLabel}
                </Button>
              )}
              {!hasStripeAccount && canCreateInitialAccount && (
                <Button variant="outlined" onClick={openExistingStripeSetup} disabled={connecting || fetchingSession}>
                  Connect existing Stripe account
                </Button>
              )}
            </Stack>
          </Stack>

          {showBankAccounts && (
            <>
              <Divider />
              <Box sx={{ px: { xs: 2, sm: 2.5 }, py: 2 }}>
                <Typography component="h3" variant="subtitle1" fontWeight={700}>
                  Connected bank accounts
                </Typography>
                {loadingBankAccounts ? (
                  <CircularProgress size={20} aria-label="Loading bank accounts" sx={{ mt: 1 }} />
                ) : bankAccountsError ? (
                  <Alert severity="error" sx={{ mt: 1 }}>Unable to load bank accounts. Refresh status to try again.</Alert>
                ) : bankAccounts.length === 0 ? (
                  <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
                    No payout bank accounts are listed yet.
                  </Typography>
                ) : (
                  <Stack component="ul" divider={<Divider component="li" />} sx={{ listStyle: 'none', m: 0, p: 0 }}>
                    {bankAccounts.map((account) => (
                      <Stack key={account.id} component="li" direction="row" spacing={1.25} alignItems="center" sx={{ py: 1.25 }}>
                        <Box sx={{ color: 'primary.main', display: 'flex' }}>
                          <BankOutlined aria-hidden="true" />
                        </Box>
                        <Typography variant="body2" fontWeight={600} sx={{ overflowWrap: 'anywhere' }}>
                          {account.bankName || account.accountName || 'Unnamed bank account'}
                          {account.last4 && (
                            <Typography component="span" variant="body2" color="text.secondary" sx={{ ml: 1, whiteSpace: 'nowrap' }}>
                              •••• {account.last4}
                            </Typography>
                          )}
                        </Typography>
                      </Stack>
                    ))}
                  </Stack>
                )}
              </Box>
            </>
          )}
        </Paper>
      </Stack>

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
                    borderColor: `${theme.palette.primary.main} !important`,
                    boxShadow: `0 0 0 2px ${alpha(theme.palette.primary.main, 0.2)} !important`,
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
                  backgroundColor: `${theme.palette.brand.forest} !important`,
                  color: '#fff !important',
                  borderRadius: '4px !important',
                  fontWeight: 600,
                  textTransform: 'none',
                  '&:hover': {
                    backgroundColor: `${theme.palette.primary.dark} !important`
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
  return <Stack spacing={3}>
    <ShortStayConnect />
    <PaymentsSettingsContent rentPaymentAccess={rentPaymentAccess} />
  </Stack>;
}
