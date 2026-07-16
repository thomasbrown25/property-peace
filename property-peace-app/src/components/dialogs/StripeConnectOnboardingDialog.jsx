import { useState, useEffect, useRef } from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  IconButton,
  Box,
  Typography,
  CircularProgress,
  alpha
} from '@mui/material';
import { CreditCardOutlined, CloseOutlined } from '@ant-design/icons';
import { loadConnectAndInitialize } from '@stripe/connect-js';
import { ConnectAccountOnboarding, ConnectComponentsProvider } from '@stripe/react-connect-js';
import axiosServices from 'utils/axios';
import { openSnackbar } from 'api/snackbar';
import useAuth from 'hooks/useAuth';

export default function StripeConnectOnboardingDialog({ open, onClose, onComplete }) {
  const { user } = useAuth();
  const [stripeConnectInstance, setStripeConnectInstance] = useState(null);
  const [fetchingSession, setFetchingSession] = useState(false);
  const [accountStatus, setAccountStatus] = useState(null);

  useEffect(() => {
    // Filter out non-critical Stripe API errors from console
    const originalError = console.error;
    const errorFilter = (...args) => {
      const errorMessage = args.join(' ');
      // Suppress Stripe Connect persons API 400 errors (non-critical during onboarding)
      if (errorMessage.includes('persons') && errorMessage.includes('400')) {
        // These are non-critical errors from Stripe SDK trying to fetch person data
        return;
      }
      originalError.apply(console, args);
    };
    console.error = errorFilter;

    if (open) {
      const initialize = async () => {
        await checkAccountStatus();
        fetchPublishableKey();
        // Small delay to ensure account status is set before opening onboarding
        setTimeout(() => {
          openEmbeddedOnboarding();
        }, 300);
      };
      initialize();
    } else {
      // Reset when dialog closes
      setStripeConnectInstance(null);
      setAccountStatus(null);
    }

    // Restore original console.error on cleanup
    return () => {
      console.error = originalError;
    };
  }, [open]);

  const checkAccountStatus = async () => {
    if (!user?.id && !user?.Id) {
      const status = {
        AccountId: null,
        Status: null,
        IsEnabled: false,
        ChargesEnabled: false,
        PayoutsEnabled: false,
        DetailsSubmitted: false
      };
      setAccountStatus(status);
      return status;
    }

    try {
      const response = await axiosServices.get('/api/stripe/account-status');
      if (response.data && response.data.success && response.data.data) {
        const data = response.data.data;
        const status = {
          AccountId: data.accountId,
          Status: data.status,
          IsEnabled: data.isEnabled || false,
          ChargesEnabled: data.chargesEnabled || false,
          PayoutsEnabled: data.payoutsEnabled || false,
          DetailsSubmitted: data.detailsSubmitted || false
        };
        setAccountStatus(status);
        return status;
      } else {
        const status = {
          AccountId: null,
          Status: null,
          IsEnabled: false,
          ChargesEnabled: false,
          PayoutsEnabled: false,
          DetailsSubmitted: false
        };
        setAccountStatus(status);
        return status;
      }
    } catch (error) {
      console.error('Error checking Stripe account status:', error);
      const status = {
        AccountId: null,
        Status: null,
        IsEnabled: false,
        ChargesEnabled: false,
        PayoutsEnabled: false,
        DetailsSubmitted: false
      };
      setAccountStatus(status);
      return status;
    }
  };

  const fetchPublishableKey = async () => {
    try {
      const response = await axiosServices.get('/api/stripe/publishable-key');
      const publishableKey = response.data?.publishableKey;
      if (!publishableKey) {
        console.warn('Publishable key not found in response:', response.data);
      }
    } catch (error) {
      console.error('Error fetching Stripe publishable key:', error);
    }
  };

  const openEmbeddedOnboarding = async () => {
    if (!user?.id && !user?.Id) {
      openSnackbar({
        open: true,
        message: 'Please log in to continue',
        variant: 'alert',
        alert: { color: 'warning' }
      });
      return;
    }

    try {
      setFetchingSession(true);

      // Check account status first
      let currentAccountStatus = accountStatus;
      if (!currentAccountStatus) {
        currentAccountStatus = await checkAccountStatus();
      }

      // If account doesn't exist yet, create it first
      if (!currentAccountStatus?.AccountId) {
        const returnUrl = window.location.href;
        const createResponse = await axiosServices.post('/api/stripe/connect-account', {
          returnUrl,
          refreshUrl: returnUrl
        });

        if (!createResponse.data?.success) {
          throw new Error('Failed to create Stripe account');
        }

        const newAccountId = createResponse.data?.data?.accountId;
        if (newAccountId) {
          currentAccountStatus = {
            AccountId: newAccountId,
            Status: 'pending',
            DetailsSubmitted: false,
            IsEnabled: false,
            ChargesEnabled: false,
            PayoutsEnabled: false
          };
          setAccountStatus(currentAccountStatus);
        } else {
          currentAccountStatus = await checkAccountStatus();
          await new Promise(resolve => setTimeout(resolve, 500));
        }
      }

      // Get current account ID
      let accountId = currentAccountStatus?.AccountId;
      if (!accountId) {
        const statusResponse = await axiosServices.get('/api/stripe/account-status');
        if (statusResponse.data?.success && statusResponse.data?.data) {
          accountId = statusResponse.data.data.accountId;
        }
      }

      if (!accountId) {
        throw new Error('Stripe account ID not found. Please try again.');
      }

      // Get publishable key
      const keyResponse = await axiosServices.get('/api/stripe/publishable-key');
      const publishableKey = keyResponse.data?.publishableKey;
      if (!publishableKey) {
        throw new Error('Failed to get publishable key');
      }

      // Initialize Stripe Connect instance
      const connectInstance = loadConnectAndInitialize({
        publishableKey: publishableKey,
        fetchClientSecret: async () => {
          try {
            const sessionResponse = await axiosServices.post('/api/stripe/account-session');
            if (sessionResponse.data && sessionResponse.data.success && sessionResponse.data.data) {
              const clientSecret = sessionResponse.data.data.clientSecret;
              if (!clientSecret || typeof clientSecret !== 'string') {
                throw new Error('Invalid client secret returned from API');
              }
              return clientSecret;
            }
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
    // Refresh account status
    await checkAccountStatus();
    
    // Wait a moment for Stripe to process the update, then sync bank account
    setTimeout(async () => {
      await checkAccountStatus();
      
      // Sync/create bank account record
      try {
        const syncResponse = await axiosServices.post('/api/stripe/sync-bank-account');
        console.log('Bank account sync response:', syncResponse.data);
        if (!syncResponse.data?.success && !syncResponse.data?.data) {
          console.warn('Bank account sync may have failed:', syncResponse.data);
        }
      } catch (error) {
        console.error('Error syncing bank account:', error);
        console.error('Error details:', error?.response?.data || error?.message);
        // Show error to user so they know something went wrong
        openSnackbar({
          open: true,
          message: 'Bank account was connected but may not appear in the list. Please refresh the page.',
          variant: 'alert',
          alert: { color: 'warning' }
        });
      }
      
      openSnackbar({
        open: true,
        message: 'Bank account setup completed successfully!',
        variant: 'alert',
        alert: { color: 'success' }
      });

      // Call onComplete callback if provided
      if (onComplete) {
        onComplete();
      }

      onClose();
    }, 1500);
  };

  const handleOnboardingExit = async () => {
    // Refresh account status in case onboarding was completed before exit
    setTimeout(async () => {
      await checkAccountStatus();
      
      // Call onComplete callback if provided (even on exit, in case they completed it)
      if (onComplete) {
        onComplete();
      }
    }, 1500);
    
    onClose();
  };

  return (
    <Dialog
      open={open}
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
            Complete Your Bank Account Setup
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
          <Box sx={{ display: 'flex', flexDirection: 'column', width: '100%', gap: 1.5 }}>
            <Typography variant="body2" color="text.secondary" sx={{ mb: 0.5 }}>
              If the &quot;Your website&quot; field shows an error, use a reachable URL such as your app login page or business site (e.g. https://app.propertypeace.io).
            </Typography>
          <Box
            sx={{
              width: '100%',
              minHeight: '500px',
              display: 'flex',
              flexDirection: 'column',
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
  );
}

