import { useState, useEffect, useLayoutEffect, useRef } from 'react';
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
import { CreditCardOutlined, CheckCircleOutlined, ExclamationCircleOutlined, LinkOutlined, CloseOutlined, BankOutlined, HomeOutlined, PlusOutlined } from '@ant-design/icons';
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

export function PaymentsSettingsContent({ rentPaymentAccess }) {
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
      request: () => bankAccountAPI.getBankAccounts(),
      onSuccess: (response) => setBankAccounts(response.success && response.data ? response.data : []),
      onError: (error) => console.error('Error fetching bank accounts:', error),
      onFinally: () => setLoadingBankAccounts(false)
    });
  };

  // Get properties connected to each bank account
  const getPropertiesForAccount = (accountId) => {
    if (!properties || !accountId) return [];
    return properties.filter(p => p.operatingAccountId === accountId);
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
        const preparationResponse = await axiosServices.post('/api/stripe/connect-preparation', context, { signal });
        const savedPreparation = preparationResponse.data;
        if (!savedPreparation?.id || !Array.isArray(savedPreparation.propertyIds) || !savedPreparation.updatedAt) {
          throw new Error('Property Peace could not confirm the saved payout setup.');
        }
        const returnUrl = `${window.location.origin}/landlord/settings?tab=payments&stripe=connected`;
        const createResponse = await axiosServices.post(
          '/api/stripe/connect-account',
          { returnUrl, refreshUrl: returnUrl },
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

  const openBankAccountManagement = async () => {
    if (!canManageAccount || !stripeScopeKey || !accountStatus?.AccountId) return;

    setOpeningBankManagement(true);
    setBankManagementError('');
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
    bankManagementCallbackGuardRef.current = null;
    setBankManagementOpen(false);
    setBankManagementInstance(null);
    setBankManagementError('');
    fetchBankAccounts();
    checkAccountStatus();
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

  const getStatusChip = () => {
    if (!accountStatus) return null;

    if (accountStatus.IsAccountReadyForRentTransfers) {
      return <Chip icon={<CheckCircleOutlined />} label="Account Transfer Eligible" color="success" size="small" sx={{ fontWeight: 600 }} />;
    } else if (accountStatus.InternalReviewStatus === 'Suspended') {
      return <Chip icon={<ExclamationCircleOutlined />} label="Payouts Suspended" color="error" size="small" sx={{ fontWeight: 600 }} />;
    } else if (accountStatus.AccountId && !accountStatus.DetailsSubmitted) {
      return <Chip icon={<ExclamationCircleOutlined />} label="Pending Setup" color="warning" size="small" sx={{ fontWeight: 600 }} />;
    } else if (accountStatus.AccountId) {
      return <Chip icon={<ExclamationCircleOutlined />} label="Under Review" color="warning" size="small" sx={{ fontWeight: 600 }} />;
    } else {
      return <Chip icon={<ExclamationCircleOutlined />} label="Not Connected" color="default" size="small" sx={{ fontWeight: 600 }} />;
    }
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

  const isConnected = accountStatus?.IsAccountReadyForRentTransfers === true;
  const needsOnboarding = accountStatus?.AccountId && !accountStatus?.DetailsSubmitted;
  const isAwaitingReview = accountStatus?.AccountId && accountStatus?.DetailsSubmitted && !accountStatus?.IsAccountReadyForRentTransfers;
  const hasNoAccount = !accountStatus?.AccountId || accountStatus?.AccountId === '' || accountStatus?.AccountId === null;
  const renderedBankManagementGuard = bankManagementCallbackGuardRef.current;

  return (
    <Box>
      <Stack spacing={3}>
        <RentPaymentAccessPanel
          {...rentPaymentAccess}
          onRequest={rentPaymentAccess.requestAccess}
          onRefresh={rentPaymentAccess.refresh}
          onConfigure={hasNoAccount
            ? (canCreateInitialAccount ? openConnectPreparation : undefined)
            : (canManageAccount ? openEmbeddedOnboarding : undefined)}
        />
        <Paper variant="outlined" sx={{ p: 3, bgcolor: (t) => alpha(t.palette.background.paper, 0.6) }}>
          <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 2 }}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
              <CreditCardOutlined style={{ fontSize: 20, color: '#1890ff' }} />
              <Typography variant="h6" fontWeight="bold">
                Online rent payment account
              </Typography>
            </Box>
            {accountStatus?.AccountId && canManageAccount && (
              <Button
                variant="outlined"
                size="small"
                startIcon={<LinkOutlined />}
                onClick={() => {
                  if (!canManageAccount || !stripeScopeKey || !accountStatus?.AccountId) return;
                  requestLifecycleRef.current.run({
                    scopeKey: stripeScopeKey,
                    channel: 'existing-account-link',
                    request: async ({ signal }) => {
                      if (accountStatus.DetailsSubmitted) {
                        const response = await axiosServices.post('/api/stripe/login-link', null, { signal });
                        if (!response.data?.dashboardUrl) throw new Error('Failed to get dashboard link');
                        return response.data.dashboardUrl;
                      }
                      const returnUrl = `${window.location.origin}/landlord/settings?tab=payments`;
                      const response = await axiosServices.post('/api/stripe/account-link', {
                        returnUrl,
                        refreshUrl: returnUrl,
                        type: 'account_onboarding'
                      }, { signal });
                      if (!response.data?.onboardingUrl) throw new Error('Failed to get onboarding link');
                      return response.data.onboardingUrl;
                    },
                    onSuccess: (url) => window.open(url, '_blank', 'noopener,noreferrer'),
                    onError: (error) => {
                      console.error('Error opening Stripe dashboard:', error);
                      openSnackbar({
                        open: true,
                        message: error?.response?.data?.message || 'Failed to open Stripe dashboard',
                        variant: 'alert',
                        alert: { color: 'error' }
                      });
                    }
                  });
                }}
              >
                {accountStatus?.DetailsSubmitted ? 'View Stripe Dashboard' : 'Complete Account Setup'}
              </Button>
            )}
          </Box>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
            Complete Stripe's secure setup to accept tenant payments and route approved rent payouts to your bank account.
          </Typography>
          {!hasNoAccount && !canManageAccount && (
            <Alert severity="info" sx={{ mb: 2 }}>
              Stripe onboarding, dashboard access, and account changes are restricted to this organization’s connected-account owner.
            </Alert>
          )}

          <Divider sx={{ my: 3 }} />

          {/* Status Section */}
          <Box sx={{ mb: 3 }}>
            <Stack direction="row" spacing={2} alignItems="center" sx={{ mb: 2 }}>
              <Typography variant="subtitle1" fontWeight="medium">
                Account Status:
              </Typography>
              {getStatusChip()}
            </Stack>

            {isConnected && (
              <>
                <Alert severity="success" sx={{ mb: 2 }}>
                  Your Stripe account currently passes account-level rent-transfer controls. Each payment remains subject to payment-specific holds, amount limits, and rolling-volume checks before transfer.
                </Alert>
                {accountStatus?.AccountId && (
                  <Box sx={{ mb: 2 }}>
                    <Typography variant="subtitle2" color="text.secondary" sx={{ mb: 1 }}>
                      Stripe Account ID
                    </Typography>
                    <Typography variant="body2" sx={{ fontFamily: 'monospace', color: 'text.secondary', wordBreak: 'break-all' }}>
                      {accountStatus.AccountId}
                    </Typography>
                  </Box>
                )}
              </>
            )}

            {needsOnboarding && (
              <Alert severity="warning" sx={{ mb: 2 }}>
                Your Stripe account has been created but needs additional information. Complete Stripe’s secure hosted onboarding; Property Peace does not store your identity documents or full bank details.
              </Alert>
            )}

            {isAwaitingReview && (
              <Alert severity={accountStatus?.InternalReviewStatus === 'Suspended' ? 'error' : 'info'} sx={{ mb: 2 }}>
                {accountStatus?.AccountReadinessReason || 'Current account-level transfer requirements have not been met.'}
              </Alert>
            )}

            {!accountStatus?.AccountId && (
              <Alert severity="info" sx={{ mb: 2 }}>
                Connect your bank account to start accepting online payments from tenants. The setup process takes just a few minutes.
                <br />

              </Alert>
            )}
          </Box>

        </Paper>

        {/* Bank Accounts Section */}
        <Paper variant="outlined" sx={{ p: 3, bgcolor: (t) => alpha(t.palette.background.paper, 0.6) }}>
          <Stack
            direction={{ xs: 'column', sm: 'row' }}
            spacing={1.5}
            alignItems={{ xs: 'stretch', sm: 'center' }}
            justifyContent="space-between"
            sx={{ mb: 2 }}
          >
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
              <BankOutlined style={{ fontSize: 20, color: '#1890ff' }} />
              <Typography variant="h6" fontWeight="bold">
                Stripe bank accounts
              </Typography>
            </Box>
            <Button
              variant="contained"
              startIcon={openingBankManagement ? <CircularProgress size={16} color="inherit" /> : <PlusOutlined />}
              onClick={hasNoAccount ? openConnectPreparation : needsOnboarding ? openEmbeddedOnboarding : openBankAccountManagement}
              disabled={
                (hasNoAccount ? !canCreateInitialAccount : !canManageAccount) ||
                connecting ||
                loading ||
                fetchingSession ||
                openingBankManagement
              }
              sx={{ whiteSpace: 'nowrap' }}
            >
              {connecting
                ? 'Connecting…'
                : fetchingSession || openingBankManagement
                  ? 'Opening Stripe…'
                  : hasNoAccount
                    ? 'Add Stripe account'
                    : needsOnboarding
                      ? 'Complete Stripe setup'
                      : 'Add bank account with Stripe'}
            </Button>
          </Stack>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
            View the payout destinations already connected to this organization. Add or update bank details securely in Stripe; Property Peace never receives full account or routing numbers.
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
              {bankAccounts.map((account) => {
                const connectedProperties = getPropertiesForAccount(account.id);
                return (
                  <Grid item xs={12} sm={6} key={account.id}>
                    <Card variant="outlined" sx={{ height: '100%' }}>
                      <CardContent>
                        <Stack spacing={2}>
                          <Box>
                            <Stack direction="row" spacing={1} alignItems="center" sx={{ mb: 1 }}>
                              <BankOutlined style={{ fontSize: 18, color: '#1890ff' }} />
                              <Typography variant="subtitle1" fontWeight="600">
                                {account.accountName || 'Unnamed Account'}
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
                          
                          <Divider />
                          
                          <Box>
                            <Typography variant="subtitle2" color="text.secondary" sx={{ mb: 1 }}>
                              Connected Properties ({connectedProperties.length})
                            </Typography>
                            {connectedProperties.length === 0 ? (
                              <Typography variant="body2" color="text.secondary" sx={{ fontStyle: 'italic' }}>
                                No properties connected to this account
                              </Typography>
                            ) : (
                              <Stack spacing={1}>
                                {connectedProperties.map((property) => (
                                  <Stack key={property.id} direction="row" spacing={1} alignItems="center">
                                    <HomeOutlined style={{ fontSize: 14, color: '#1890ff' }} />
                                    <Typography variant="body2">
                                      {property.name}
                                      {property.streetAddress && ` - ${property.streetAddress}`}
                                    </Typography>
                                  </Stack>
                                ))}
                              </Stack>
                            )}
                          </Box>
                          {canManageAccount && (
                            <Button
                              variant="outlined"
                              size="small"
                              startIcon={<BankOutlined />}
                              onClick={openBankAccountManagement}
                              disabled={openingBankManagement}
                              sx={{ alignSelf: 'flex-start' }}
                            >
                              Edit in Stripe
                            </Button>
                          )}
                        </Stack>
                      </CardContent>
                    </Card>
                  </Grid>
                );
              })}
            </Grid>
          )}
        </Paper>

        {/* Information Section */}
        <Paper variant="outlined" sx={{ p: 3, bgcolor: (t) => alpha(t.palette.background.paper, 0.6) }}>
          <Typography variant="subtitle1" fontWeight="bold" sx={{ mb: 2 }}>
            About Stripe Connect
          </Typography>
          <Stack spacing={1.5}>
            <Typography variant="body2" color="text.secondary">
              • Secure payment processing powered by Stripe
            </Typography>
            <Typography variant="body2" color="text.secondary">
              • Funds are transferred directly to your connected bank account
            </Typography>
            <Typography variant="body2" color="text.secondary">
              • Stripe handles all PCI compliance and security requirements
            </Typography>
            <Typography variant="body2" color="text.secondary">
              • Standard processing fees apply (typically 2.9% + $0.30 per transaction)
            </Typography>
          </Stack>
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
          Manage Stripe bank accounts
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
            Add or update bank accounts directly with Stripe. Property Peace only displays safe account details such as bank name and last four digits.
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
