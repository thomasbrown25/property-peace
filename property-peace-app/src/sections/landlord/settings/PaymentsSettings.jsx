import { useState, useEffect, useRef } from 'react';
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
import { ConnectAccountOnboarding, ConnectComponentsProvider } from '@stripe/react-connect-js';
import useAuth from 'hooks/useAuth';
import axiosServices from 'utils/axios';
import { openSnackbar } from 'api/snackbar';
import { bankAccountAPI } from 'api';
import useFetchProperties from 'hooks/useFetchProperties';
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

export default function PaymentsSettings() {
  const theme = useTheme();
  const { user } = useAuth();
  const { properties } = useFetchProperties();
  const [loading, setLoading] = useState(false);
  const [checkingStatus, setCheckingStatus] = useState(true);
  const [accountStatus, setAccountStatus] = useState(null);
  const [connecting, setConnecting] = useState(false);
  const [showOnboarding, setShowOnboarding] = useState(false);
  const [stripeConnectInstance, setStripeConnectInstance] = useState(null);
  const [fetchingSession, setFetchingSession] = useState(false);
  const [showLinkAccount, setShowLinkAccount] = useState(false);
  const [linkAccountId, setLinkAccountId] = useState('');
  const [linkingAccount, setLinkingAccount] = useState(false);
  const [bankAccounts, setBankAccounts] = useState([]);
  const [loadingBankAccounts, setLoadingBankAccounts] = useState(false);
  const prevShowOnboardingRef = useRef(false);
  const isDemo = user?.isDemo === true || user?.IsDemo === true;

  useEffect(() => {
    if (isDemo) {
      setCheckingStatus(false);
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
      setTimeout(() => {
        checkAccountStatus();
        fetchBankAccounts();
      }, 1000);
    }
  }, [user, isDemo]);

  const fetchBankAccounts = async () => {
    try {
      setLoadingBankAccounts(true);
      const response = await bankAccountAPI.getBankAccounts();
      if (response.success && response.data) {
        setBankAccounts(response.data || []);
      }
    } catch (error) {
      console.error('Error fetching bank accounts:', error);
    } finally {
      setLoadingBankAccounts(false);
    }
  };

  // Get properties connected to each bank account
  const getPropertiesForAccount = (accountId) => {
    if (!properties || !accountId) return [];
    return properties.filter(p => p.operatingAccountId === accountId);
  };

  // Refresh account status when onboarding modal closes
  useEffect(() => {
    // Check if modal transitioned from open to closed
    if (prevShowOnboardingRef.current && !showOnboarding && stripeConnectInstance) {
      // Modal was just closed, refresh status to check if account was connected
      const timeoutId = setTimeout(() => {
        checkAccountStatus();
      }, 1500);
      
      return () => clearTimeout(timeoutId);
    }
    
    // Update ref for next render
    prevShowOnboardingRef.current = showOnboarding;
  }, [showOnboarding, stripeConnectInstance]);

  const fetchPublishableKey = async () => {
    try {
      const response = await axiosServices.get('/api/stripe/publishable-key');
      console.log('Publishable key API response:', response.data);
      const publishableKey = response.data?.publishableKey;
      if (publishableKey) {
        console.log('Successfully retrieved publishable key:', publishableKey.substring(0, 20) + '...');
        // For Connect, we use the publishable key directly
        // The Connect instance will be created when we have the client secret
      } else {
        console.warn('Publishable key not found in response:', response.data);
      }
    } catch (error) {
      console.error('Error fetching Stripe publishable key:', error);
      console.error('Error details:', error?.response?.data || error?.message);
    }
  };

  const checkAccountStatus = async () => {
    if (!user?.id && !user?.Id) return;

    try {
      setCheckingStatus(true);
      const response = await axiosServices.get('/api/stripe/account-status');
      if (response.data && response.data.success && response.data.data) {
        // Handle camelCase response from API
        const data = response.data.data;
        setAccountStatus({
          AccountId: data.accountId,
          Status: data.status,
          IsEnabled: data.isEnabled || false,
          ChargesEnabled: data.chargesEnabled || false,
          PayoutsEnabled: data.payoutsEnabled || false,
          DetailsSubmitted: data.detailsSubmitted || false
        });
      } else {
        setAccountStatus({
          AccountId: null,
          Status: null,
          IsEnabled: false,
          ChargesEnabled: false,
          PayoutsEnabled: false,
          DetailsSubmitted: false
        });
      }
    } catch (error) {
      console.error('Error checking Stripe account status:', error);
      setAccountStatus({
        AccountId: null,
        Status: null,
        IsEnabled: false,
        ChargesEnabled: false,
        PayoutsEnabled: false,
        DetailsSubmitted: false
      });
    } finally {
      setCheckingStatus(false);
    }
  };

  const handleConnectAccount = async () => {
    try {
      setConnecting(true);
      const returnUrl = `${window.location.origin}/landlord/settings?tab=payments&stripe=connected`;
      const response = await axiosServices.post('/api/stripe/connect-account', {
        returnUrl,
        refreshUrl: returnUrl
      });

      if (response.data && response.data.success && response.data.data) {
        // Account created, now open embedded onboarding
        await openEmbeddedOnboarding();
      } else {
        throw new Error(response.data?.message || 'Failed to create Stripe account');
      }
    } catch (error) {
      console.error('Error connecting Stripe account:', error);
      openSnackbar({
        open: true,
        message: error?.response?.data?.message || error?.message || 'Failed to connect Stripe account',
        variant: 'alert',
        alert: { color: 'error' }
      });
    } finally {
      setConnecting(false);
    }
  };

  const openEmbeddedOnboarding = async () => {
    if (!accountStatus?.AccountId && !user?.id && !user?.Id) {
      openSnackbar({
        open: true,
        message: 'Please create an account first',
        variant: 'alert',
        alert: { color: 'warning' }
      });
      return;
    }

    try {
      setFetchingSession(true);

      // If account doesn't exist yet, create it first
      if (!accountStatus?.AccountId) {
        const returnUrl = `${window.location.origin}/landlord/settings?tab=payments`;
        const createResponse = await axiosServices.post('/api/stripe/connect-account', {
          returnUrl,
          refreshUrl: returnUrl
        });

        if (!createResponse.data?.success) {
          throw new Error('Failed to create Stripe account');
        }

        // Get the account ID from the create response
        const newAccountId = createResponse.data?.data?.accountId;
        if (newAccountId) {
          // Update local state immediately
          setAccountStatus(prev => ({
            ...prev,
            AccountId: newAccountId,
            Status: 'pending',
            DetailsSubmitted: false
          }));
        } else {
          // Fallback: refresh account status
          await checkAccountStatus();
          await new Promise(resolve => setTimeout(resolve, 500));
        }
      }

      // Get current account ID (use state or fetch fresh)
      let accountId = accountStatus?.AccountId;
      if (!accountId) {
        // Fetch fresh account status
        const statusResponse = await axiosServices.get('/api/stripe/account-status');
        if (statusResponse.data?.success && statusResponse.data?.data) {
          accountId = statusResponse.data.data.accountId;
        }
      }
      
      if (!accountId) {
        throw new Error('Stripe account ID not found. Please try again.');
      }
      
      console.log('Using account ID for session:', accountId);

      // Get publishable key first
      const keyResponse = await axiosServices.get('/api/stripe/publishable-key');
      console.log('Publishable key response in openEmbeddedOnboarding:', keyResponse.data);
      const publishableKey = keyResponse.data?.publishableKey;
      if (!publishableKey) {
        console.error('Publishable key missing from response:', keyResponse.data);
        throw new Error('Failed to get publishable key');
      }
      console.log('Using publishable key:', publishableKey.substring(0, 20) + '...');

      // Initialize Stripe Connect instance
      const connectInstance = loadConnectAndInitialize({
        publishableKey: publishableKey,
        fetchClientSecret: async () => {
          try {
            // Get account session for embedded onboarding
            const sessionResponse = await axiosServices.post('/api/stripe/account-session');
            console.log('Account session response:', sessionResponse.data);
            
            if (sessionResponse.data && sessionResponse.data.success && sessionResponse.data.data) {
              const clientSecret = sessionResponse.data.data.clientSecret;
              console.log('Client secret retrieved:', clientSecret ? clientSecret.substring(0, 20) + '...' : 'undefined');
              
              if (!clientSecret || typeof clientSecret !== 'string') {
                console.error('Client secret is not a valid string:', clientSecret);
                throw new Error('Invalid client secret returned from API');
              }
              
              return clientSecret;
            }
            
            console.error('Account session response missing data:', sessionResponse.data);
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

      setStripeConnectInstance(connectInstance);
      setShowOnboarding(true);
    } catch (error) {
      console.error('Error opening embedded onboarding:', error);
      openSnackbar({
        open: true,
        message: error?.response?.data?.message || error?.message || 'Failed to open onboarding',
        variant: 'alert',
        alert: { color: 'error' }
      });
    } finally {
      setFetchingSession(false);
    }
  };

  const handleOnboardingComplete = async () => {
    setShowOnboarding(false);

    // Wait a moment for Stripe to process the update, then refresh account status
    setTimeout(async () => {
      await checkAccountStatus();
      
      openSnackbar({
        open: true,
        message: 'Onboarding completed successfully!',
        variant: 'alert',
        alert: { color: 'success' }
      });
    }, 1500);
  };

  const handleOnboardingExit = async () => {
    setShowOnboarding(false);
    
    // Refresh account status in case onboarding was completed before exit
    // Wait a moment for Stripe to process any updates
    setTimeout(async () => {
      await checkAccountStatus();
    }, 1500);
  };

  const handleLinkExistingAccount = async () => {
    if (!linkAccountId.trim()) {
      openSnackbar({
        open: true,
        message: 'Please enter a Stripe account ID',
        variant: 'alert',
        alert: { color: 'error' }
      });
      return;
    }

    try {
      setLinkingAccount(true);
      const response = await axiosServices.post('/api/stripe/link-account', {
        accountId: linkAccountId.trim()
      });

      if (response.data && response.data.success) {
        openSnackbar({
          open: true,
          message: 'Account linked successfully!',
          variant: 'alert',
          alert: { color: 'success' }
        });
        setShowLinkAccount(false);
        setLinkAccountId('');
        await checkAccountStatus();
      } else {
        openSnackbar({
          open: true,
          message: response.data?.message || 'Failed to link account',
          variant: 'alert',
          alert: { color: 'error' }
        });
      }
    } catch (error) {
      console.error('Error linking account:', error);
      openSnackbar({
        open: true,
        message: error?.response?.data?.message || 'Error linking account. Please try again.',
        variant: 'alert',
        alert: { color: 'error' }
      });
    } finally {
      setLinkingAccount(false);
    }
  };

  const getStatusChip = () => {
    if (!accountStatus) return null;

    if (accountStatus.IsEnabled && accountStatus.ChargesEnabled && accountStatus.PayoutsEnabled) {
      return <Chip icon={<CheckCircleOutlined />} label="Connected" color="success" size="small" sx={{ fontWeight: 600 }} />;
    } else if (accountStatus.AccountId && !accountStatus.DetailsSubmitted) {
      return <Chip icon={<ExclamationCircleOutlined />} label="Pending Setup" color="warning" size="small" sx={{ fontWeight: 600 }} />;
    } else {
      return <Chip icon={<ExclamationCircleOutlined />} label="Not Connected" color="default" size="small" sx={{ fontWeight: 600 }} />;
    }
  };

  if (isDemo) {
    return <DemoStripePaymentsPreview />;
  }

  if (checkingStatus) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: 200 }}>
        <CircularProgress />
      </Box>
    );
  }

  const isConnected = accountStatus?.IsEnabled && accountStatus?.ChargesEnabled && accountStatus?.PayoutsEnabled;
  const needsOnboarding = accountStatus?.AccountId && !accountStatus?.DetailsSubmitted;
  const hasNoAccount = !accountStatus?.AccountId || accountStatus?.AccountId === '' || accountStatus?.AccountId === null;

  return (
    <Box>
      <Stack spacing={3}>
        <Paper variant="outlined" sx={{ p: 3, bgcolor: (t) => alpha(t.palette.background.paper, 0.6) }}>
          <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 2 }}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
              <CreditCardOutlined style={{ fontSize: 20, color: '#1890ff' }} />
              <Typography variant="h6" fontWeight="bold">
                Stripe Payment Processing
              </Typography>
            </Box>
            {accountStatus?.AccountId && (
              <Button
                variant="outlined"
                startIcon={<LinkOutlined />}
                onClick={async () => {
                  try {
                    // If account is fully set up, use login link for dashboard access
                    // Otherwise, use account link for onboarding/updates
                    if (accountStatus?.DetailsSubmitted) {
                      // Use login link for dashboard access
                      const response = await axiosServices.post('/api/stripe/login-link');
                      
                      if (response.data && response.data.dashboardUrl) {
                        window.open(response.data.dashboardUrl, '_blank', 'noopener,noreferrer');
                      } else {
                        throw new Error('Failed to get dashboard link');
                      }
                    } else {
                      // Use account link for onboarding/updates
                      const returnUrl = `${window.location.origin}/landlord/settings?tab=payments`;
                      const response = await axiosServices.post('/api/stripe/account-link', {
                        returnUrl,
                        refreshUrl: returnUrl,
                        type: 'account_onboarding'
                      });
                      
                      if (response.data && response.data.onboardingUrl) {
                        window.open(response.data.onboardingUrl, '_blank', 'noopener,noreferrer');
                      } else {
                        throw new Error('Failed to get onboarding link');
                      }
                    }
                  } catch (error) {
                    console.error('Error opening Stripe dashboard:', error);
                    openSnackbar({
                      open: true,
                      message: error?.response?.data?.message || 'Failed to open Stripe dashboard',
                      variant: 'alert',
                      alert: { color: 'error' }
                    });
                  }
                }}
              >
                {accountStatus?.DetailsSubmitted ? 'View Stripe Dashboard' : 'Complete Account Setup'}
              </Button>
            )}
          </Box>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
            Connect your bank account to receive payments from tenants. Your account information is securely processed by Stripe.
          </Typography>

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
                  Your Stripe account is connected and ready to receive payments. You can now accept online payments from tenants.
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
                Your Stripe account has been created but needs additional information to be completed. Please complete the onboarding
                process.
              </Alert>
            )}

            {!accountStatus?.AccountId && (
              <Alert severity="info" sx={{ mb: 2 }}>
                Connect your bank account to start accepting online payments from tenants. The setup process takes just a few minutes.
                <br />
                <Typography variant="body2" sx={{ mt: 1 }}>
                  If you already have a Stripe account, you can link it using the button below.
                </Typography>
              </Alert>
            )}
          </Box>

        </Paper>

        {/* Bank Accounts Section */}
        <Paper variant="outlined" sx={{ p: 3, bgcolor: (t) => alpha(t.palette.background.paper, 0.6) }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 2 }}>
            <BankOutlined style={{ fontSize: 20, color: '#1890ff' }} />
            <Typography variant="h6" fontWeight="bold">
              Connected Bank Accounts
            </Typography>
          </Box>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
            View all bank accounts and the properties connected to each account.
          </Typography>
          <Button
            variant="text"
            startIcon={<PlusOutlined style={{ fontSize: 16, color: theme.palette.primary.main }} />}
            onClick={hasNoAccount ? handleConnectAccount : openEmbeddedOnboarding}
            disabled={connecting || loading || fetchingSession}
            sx={{
              color: 'primary.main',
              textTransform: 'none',
              minWidth: 'auto',
              px: 1,
              mb: 3,
              '&:hover': {
                bgcolor: alpha(theme.palette.primary.main, 0.08)
              }
            }}
          >
            {connecting ? 'Connecting...' : fetchingSession ? 'Loading...' : hasNoAccount ? 'Add Account' : needsOnboarding ? 'Complete Setup' : 'Add Account'}
          </Button>

          {loadingBankAccounts ? (
            <Box sx={{ display: 'flex', justifyContent: 'center', py: 4 }}>
              <CircularProgress />
            </Box>
          ) : bankAccounts.length === 0 ? (
            <Alert severity="info">
              No bank accounts found. Add a bank account to get started.
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
    </Box>
  );
}
