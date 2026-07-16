import { useState, useEffect } from 'react';
import { Box, Stack, Typography, alpha, useTheme, Button } from '@mui/material';
import { DollarOutlined, SettingOutlined, BankOutlined, CheckCircleOutlined } from '@ant-design/icons';
import { useNavigate } from 'react-router-dom';
import PageBreadcrumbs from 'components/breadcrumbs/PageBreadcrumbs';
import useAuth from 'hooks/useAuth';
import axiosServices from 'utils/axios';

export default function RentCollectionHeader() {
  const theme = useTheme();
  const navigate = useNavigate();
  const { user } = useAuth();
  const [accountStatus, setAccountStatus] = useState(null);
  const [checkingStatus, setCheckingStatus] = useState(false);

  useEffect(() => {
    checkAccountStatus();
  }, [user]);

  const checkAccountStatus = async () => {
    if (!user?.id && !user?.Id) return;

    try {
      setCheckingStatus(true);
      const response = await axiosServices.get('/api/stripe/account-status');
      if (response.data && response.data.success && response.data.data) {
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

  const handleSettingsClick = () => {
    navigate('/landlord/settings?tab=payments');
  };

  const handleConnectBankAccount = () => {
    navigate('/landlord/settings?tab=payments');
  };

  // Check if bank account is connected
  const isBankConnected = accountStatus?.AccountId && 
                          (accountStatus?.ChargesEnabled || accountStatus?.PayoutsEnabled);

  return (
    <Box sx={{ mb: 4 }}>
      {/* Breadcrumbs */}
      <PageBreadcrumbs
        items={[
          { label: 'Dashboard', path: '/landlord/dashboard' },
          { label: 'Rent Collection' }
        ]}
      />

      {/* Header Row */}
      <Stack direction="row" alignItems="center" spacing={2} mb={1}>
        <Box
          sx={{
            width: 56,
            height: 56,
            borderRadius: 2,
            bgcolor: alpha(theme.palette.primary.main, 0.1),
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            flexShrink: 0
          }}
        >
          <DollarOutlined style={{ fontSize: 28, color: theme.palette.primary.main }} />
        </Box>
        <Box sx={{ flex: 1 }}>
          <Typography variant="h3" fontWeight={700}>
            Rent Collection
          </Typography>
          <Typography variant="body1" color="text.secondary">
            Manage rent payments and track collection status
          </Typography>
        </Box>
        <Stack direction="row" spacing={1.5} sx={{ flexShrink: 0 }}>
          <Button
            variant={isBankConnected ? "contained" : "contained"}
            color={isBankConnected ? "success" : "primary"}
            startIcon={isBankConnected ? <CheckCircleOutlined /> : <BankOutlined />}
            onClick={handleConnectBankAccount}
            disabled={checkingStatus}
            sx={{
              boxShadow: isBankConnected 
                ? `0 4px 12px ${alpha(theme.palette.success.main, 0.3)}`
                : `0 4px 12px ${alpha(theme.palette.primary.main, 0.3)}`,
              '&:hover': {
                boxShadow: isBankConnected
                  ? `0 6px 16px ${alpha(theme.palette.success.main, 0.4)}`
                  : `0 6px 16px ${alpha(theme.palette.primary.main, 0.4)}`,
                transform: 'translateY(-2px)'
              },
              transition: 'all 0.3s ease',
              bgcolor: isBankConnected ? theme.palette.success.main : undefined
            }}
          >
            {checkingStatus ? 'Checking...' : isBankConnected ? 'Bank Connected' : 'Connect Bank Account'}
          </Button>
          <Button
            variant="outlined"
            startIcon={<SettingOutlined />}
            onClick={handleSettingsClick}
          >
            Settings
          </Button>
        </Stack>
      </Stack>
    </Box>
  );
}

