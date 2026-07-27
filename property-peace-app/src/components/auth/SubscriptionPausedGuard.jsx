import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Box, Typography, Button, Alert, Card, CardContent, Stack } from '@mui/material';
import { PauseCircleOutlined } from '@ant-design/icons';
import { useSubscriptionStatus } from 'hooks/useSubscription';
import Loader from 'components/Loader';
import MainCard from 'components/MainCard';

/**
 * Component that blocks access when subscription is paused
 * Shows a message and redirects to subscription page
 */
export default function SubscriptionPausedGuard({ children }) {
  const { status, loading } = useSubscriptionStatus();
  const navigate = useNavigate();

  // Show loader while checking subscription status
  if (loading) {
    return <Loader />;
  }

  // Check if subscription is paused
  const subscription = status?.subscription;
  const isPaused = subscription?.status === 'Paused' || 
    (subscription?.pausedAtPeriodEnd && 
     subscription?.currentPeriodEnd && 
     new Date(subscription.currentPeriodEnd) <= new Date()) ||
    (!status?.hasActiveSubscription && subscription?.pausedAtPeriodEnd);

  // If paused, show blocked message
  if (isPaused) {
    return (
      <Box
        sx={{
          display: 'flex',
          justifyContent: 'center',
          alignItems: 'center',
          minHeight: '100vh',
          bgcolor: 'background.default',
          p: 3
        }}
      >
        <MainCard sx={{ maxWidth: 600, width: '100%' }}>
          <CardContent>
            <Stack spacing={3} alignItems="center" textAlign="center">
              <PauseCircleOutlined style={{ fontSize: 64, color: '#ff9800' }} />
              <Typography variant="h4" fontWeight="bold">
                Subscription Paused
              </Typography>
              <Alert severity="warning" sx={{ width: '100%' }}>
                <Typography variant="body1">
                  Your subscription is currently paused. All functionality has been disabled.
                </Typography>
                {subscription?.pausedAtPeriodEnd && subscription?.currentPeriodEnd && (
                  <Typography variant="body2" sx={{ mt: 1 }}>
                    Your subscription was paused on {new Date(subscription.currentPeriodEnd).toLocaleDateString()}.
                  </Typography>
                )}
              </Alert>
              <Typography variant="body2" color="text.secondary">
                To regain access to your properties, leases, and all features, please resume your subscription.
              </Typography>
              <Button
                variant="contained"
                size="large"
                onClick={() => navigate('/landlord/settings?tab=subscription')}
                sx={{ mt: 2 }}
              >
                Resume Subscription
              </Button>
            </Stack>
          </CardContent>
        </MainCard>
      </Box>
    );
  }

  // Not paused, render children normally
  return children;
}

