import { useCallback, useEffect, useState } from 'react';
import {
  Alert,
  Box,
  Button,
  Chip,
  CircularProgress,
  Dialog,
  DialogContent,
  DialogTitle,
  Divider,
  IconButton,
  Paper,
  Stack,
  Typography,
  alpha
} from '@mui/material';
import { BankOutlined, CloseOutlined, LockOutlined } from '@ant-design/icons';
import { loadConnectAndInitialize } from '@stripe/connect-js';
import { ConnectAccountManagement, ConnectComponentsProvider } from '@stripe/react-connect-js';

import axiosServices from 'utils/axios';

const field = (value, camel, pascal) => value?.[camel] ?? value?.[pascal];

const formatAccountType = (value) => {
  if (!value) return 'Bank account';
  return `${value.charAt(0).toUpperCase()}${value.slice(1)} account`;
};

export default function PayoutAssignments() {
  const [status, setStatus] = useState(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');
  const [opening, setOpening] = useState(false);
  const [connectInstance, setConnectInstance] = useState(null);
  const [managementOpen, setManagementOpen] = useState(false);
  const [componentError, setComponentError] = useState('');

  const loadPayoutAccount = useCallback(async () => {
    try {
      setLoading(true);
      setLoadError('');
      const response = await axiosServices.get('/api/stripe/account-status');
      setStatus(response.data?.data ?? response.data ?? null);
    } catch (error) {
      console.error('Unable to load Stripe payout account:', error);
      setLoadError('We could not load your payout account from Stripe. Please try again.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadPayoutAccount();
  }, [loadPayoutAccount]);

  const openAccountManagement = async () => {
    try {
      setOpening(true);
      setComponentError('');
      const keyResponse = await axiosServices.get('/api/stripe/publishable-key');
      const publishableKey = keyResponse.data?.publishableKey;
      if (!publishableKey) throw new Error('Stripe is not configured for account management.');

      const instance = loadConnectAndInitialize({
        publishableKey,
        fetchClientSecret: async () => {
          const sessionResponse = await axiosServices.post('/api/stripe/account-management-session');
          const clientSecret = sessionResponse.data?.data?.clientSecret;
          if (!clientSecret) throw new Error('Stripe did not return a valid account-management session.');
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

      setConnectInstance(instance);
      setManagementOpen(true);
    } catch (error) {
      console.error('Unable to open Stripe account management:', error);
      setComponentError(error?.response?.data?.message || error?.message || 'Stripe account management is temporarily unavailable.');
    } finally {
      setOpening(false);
    }
  };

  const closeAccountManagement = () => {
    setManagementOpen(false);
    setConnectInstance(null);
    loadPayoutAccount();
  };

  const payoutBank = field(status, 'payoutBank', 'PayoutBank');
  const bankName = field(payoutBank, 'bankName', 'BankName') || 'Stripe payout bank';
  const last4 = field(payoutBank, 'last4', 'Last4');
  const accountType = field(payoutBank, 'accountType', 'AccountType');
  const currency = field(payoutBank, 'currency', 'Currency');
  const hasStripeAccount = Boolean(field(status, 'accountId', 'AccountId'));
  const canManageAccount = Boolean(field(status, 'canManageAccount', 'CanManageAccount'));

  if (loading) {
    return (
      <Box sx={{ minHeight: 220, display: 'grid', placeItems: 'center' }}>
        <CircularProgress size={34} />
      </Box>
    );
  }

  if (loadError) {
    return (
      <Alert
        severity="error"
        action={
          <Button color="inherit" size="small" onClick={loadPayoutAccount}>
            Retry
          </Button>
        }
      >
        {loadError}
      </Alert>
    );
  }

  return (
    <>
      <Paper variant="outlined" sx={{ overflow: 'hidden', borderColor: (theme) => alpha(theme.palette.divider, 0.72) }}>
        <Box sx={{ px: { xs: 2, sm: 3 }, py: 2.5 }}>
          <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2} justifyContent="space-between" alignItems={{ sm: 'center' }}>
            <Box>
              <Typography variant="h6" fontWeight={750}>Payout account</Typography>
              <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5, maxWidth: 680 }}>
                Stripe sends eligible rent payouts to this connected bank account.
              </Typography>
            </Box>
            {payoutBank && <Chip size="small" color="success" variant="outlined" label="Connected through Stripe" />}
          </Stack>
        </Box>
        <Divider />

        <Box sx={{ p: { xs: 2, sm: 3 } }}>
          {!hasStripeAccount ? (
            <Alert severity="info">Finish connecting Stripe before managing a payout bank account.</Alert>
          ) : (
            <Stack spacing={2.5}>
              <Box
                sx={{
                  p: 2.25,
                  border: '1px solid',
                  borderColor: 'divider',
                  borderRadius: 2,
                  bgcolor: (theme) => alpha(theme.palette.primary.main, 0.025)
                }}
              >
                <Stack direction="row" spacing={1.75} alignItems="center">
                  <Box
                    sx={{
                      width: 44,
                      height: 44,
                      borderRadius: 1.5,
                      display: 'grid',
                      placeItems: 'center',
                      color: 'primary.main',
                      bgcolor: (theme) => alpha(theme.palette.primary.main, 0.09),
                      flexShrink: 0
                    }}
                  >
                    <BankOutlined style={{ fontSize: 21 }} />
                  </Box>
                  <Box minWidth={0} flex={1}>
                    <Typography fontWeight={750}>{payoutBank ? bankName : 'No payout bank shown'}</Typography>
                    <Typography variant="body2" color="text.secondary" sx={{ mt: 0.25 }}>
                      {payoutBank
                        ? [formatAccountType(accountType), currency?.toUpperCase(), last4 ? `ending in ${last4}` : null].filter(Boolean).join(' · ')
                        : 'Add or confirm your payout bank securely in Stripe.'}
                    </Typography>
                  </Box>
                </Stack>
              </Box>

              <Alert severity="info" icon={false} sx={{ alignItems: 'flex-start' }}>
                Property Peace currently uses one Stripe connected-account payout destination. Lease-specific payout accounts and separate income or deposit routing are not supported.
              </Alert>

              {componentError && <Alert severity="error">{componentError}</Alert>}

              <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1.5} alignItems={{ sm: 'center' }}>
                {canManageAccount ? (
                  <Button
                    variant="contained"
                    startIcon={opening ? <CircularProgress size={16} color="inherit" /> : <LockOutlined />}
                    onClick={openAccountManagement}
                    disabled={opening}
                  >
                    Manage bank account securely with Stripe
                  </Button>
                ) : (
                  <Alert severity="info" sx={{ flex: 1 }}>
                    This organization’s approved payout account can only be changed by its connected-account owner.
                  </Alert>
                )}
                <Typography variant="caption" color="text.secondary">
                  Property Peace never sees or stores your full bank credentials.
                </Typography>
              </Stack>
            </Stack>
          )}
        </Box>
      </Paper>

      <Dialog open={managementOpen} onClose={closeAccountManagement} fullWidth maxWidth="md">
        <DialogTitle sx={{ pr: 6 }}>
          Manage payout account
          <IconButton aria-label="Close Stripe account management" onClick={closeAccountManagement} sx={{ position: 'absolute', right: 12, top: 12 }}>
            <CloseOutlined />
          </IconButton>
        </DialogTitle>
        <DialogContent dividers sx={{ minHeight: 420, p: { xs: 1.5, sm: 2.5 } }}>
          {componentError && (
            <Alert
              severity="error"
              sx={{ mb: 2 }}
              action={
                <Button color="inherit" size="small" onClick={closeAccountManagement}>
                  Close
                </Button>
              }
            >
              {componentError}
            </Alert>
          )}
          {connectInstance && (
            <ConnectComponentsProvider connectInstance={connectInstance}>
              <ConnectAccountManagement
                onLoaderStart={() => setComponentError('')}
                onLoadError={() => setComponentError('Stripe account management could not load. Close this window and try again.')}
              />
            </ConnectComponentsProvider>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}
