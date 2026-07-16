import { Box, Card, CardContent, Typography, LinearProgress, Chip, alpha } from '@mui/material';
import { useTheme } from '@mui/material/styles';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import WarningIcon from '@mui/icons-material/Warning';
import CancelIcon from '@mui/icons-material/Cancel';

export default function SubscriptionStatus({ status }) {
  if (!status) return null;

  const theme = useTheme();
  const { subscription, currentPropertyCount, canAddProperty, isTrialActive, trialDaysRemaining, currentTotalUnits, maxTotalUnits } = status;

  const getStatusColor = () => {
    if (!subscription) return 'default';
    switch (subscription.status) {
      case 'Active':
        return 'success';
      case 'Trial':
        return 'primary';
      case 'PaymentPending':
        return 'warning';
      case 'PastDue':
        return 'warning';
      case 'Cancelled':
        return 'error';
      case 'Paused':
        return 'warning';
      default:
        return 'default';
    }
  };

  const getStatusIcon = () => {
    if (!subscription) return null;
    switch (subscription.status) {
      case 'Active':
        return <CheckCircleIcon />;
      case 'Trial':
        return <WarningIcon />;
      case 'PaymentPending':
        return <WarningIcon />;
      case 'Cancelled':
        return <CancelIcon />;
      default:
        return null;
    }
  };

  const unitUsage = maxTotalUnits === null ? 0 : maxTotalUnits > 0 ? (currentTotalUnits / maxTotalUnits) * 100 : 0;
  const canAddUnit = maxTotalUnits === null || currentTotalUnits < maxTotalUnits;

  return (
    <Card sx={{ mt: 3 }}>
      <CardContent>
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
          <Typography variant="h6" fontWeight="bold">
            Subscription Status
          </Typography>
          {subscription && (
            <Chip 
              icon={getStatusIcon()} 
              label={subscription.status} 
              size="small"
              sx={{
                bgcolor: 'primary.main',
                color: '#ffffff',
                px: 1.5,
                py: 0.5,
                '& .MuiChip-label': {
                  color: '#ffffff',
                  px: 0.5
                },
                '& .MuiChip-icon': {
                  color: '#ffffff',
                  ml: 0.5
                }
              }}
            />
          )}
        </Box>

        {subscription ? (
          <>
            {subscription.status === 'Trial' ? (
              <Box sx={{ mb: 2 }}>
                <Typography variant="subtitle2" color="text.secondary" gutterBottom>
                  Free Trial
                </Typography>
                {isTrialActive && trialDaysRemaining !== null && (
                  <Typography variant="body2" color="text.secondary">
                    {trialDaysRemaining > 0 
                      ? `${trialDaysRemaining} day${trialDaysRemaining !== 1 ? 's' : ''} remaining`
                      : 'Trial has ended'}
                  </Typography>
                )}
                <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
                  Select a plan to continue after your trial ends
                </Typography>
              </Box>
            ) : subscription.status === 'PaymentPending' ? (
              <Box sx={{ mb: 2, p: 2, bgcolor: 'warning.lighter', borderRadius: 1 }}>
                <Typography variant="subtitle2" fontWeight="bold" color="warning.darker" gutterBottom>
                  Payment Pending
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  Your payment is being processed. Your subscription will be activated once payment is confirmed.
                </Typography>
              </Box>
            ) : (
              <>
                <Box sx={{ mb: 2 }}>
                  <Typography variant="subtitle2" color="text.secondary" gutterBottom>
                    Current Plan: {subscription.status === 'Cancelled' ? 'Cancelled' : subscription.plan?.name}
                  </Typography>
                  {subscription.status !== 'Cancelled' && (
                    <>
                      <Typography variant="body2" color="text.secondary">
                        Billing: {subscription.billingCycle}
                      </Typography>
                      {subscription.currentPeriodEnd && (
                        <Typography variant="body2" color="text.secondary">
                          Renews: {new Date(subscription.currentPeriodEnd).toLocaleDateString()}
                        </Typography>
                      )}
                      {(subscription.status === 'Paused' || subscription.pausedAtPeriodEnd) && (
                        <Typography variant="body2" color="text.secondary">
                          <Box component="span">Subscription Paused - will not be billed</Box>
                        </Typography>
                      )}
                    </>
                  )}
                </Box>

                {isTrialActive && trialDaysRemaining !== null && (
                  <Box sx={{ mb: 2, p: 2, bgcolor: 'info.lighter', borderRadius: 1 }}>
                    <Typography variant="body2" fontWeight="bold" color="info.darker">
                      Trial ends in {trialDaysRemaining} day{trialDaysRemaining !== 1 ? 's' : ''}
                    </Typography>
                  </Box>
                )}
              </>
            )}

            <Box sx={{ mt: 2 }}>
              <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 1 }}>
                <Typography variant="body2" fontWeight="medium">
                  Units: {currentTotalUnits || 0} / {maxTotalUnits === null ? '∞' : maxTotalUnits}
                </Typography>
                {!canAddUnit && (
                  <Chip 
                    label="Limit Reached" 
                    size="small"
                    sx={{
                      bgcolor: '#061e35',
                      color: '#ffffff',
                      '& .MuiChip-label': {
                        color: '#ffffff'
                      }
                    }}
                  />
                )}
              </Box>
              {maxTotalUnits !== null && (
                <LinearProgress
                  variant="determinate"
                  value={Math.min(unitUsage, 100)}
                  sx={{ 
                    height: 8, 
                    borderRadius: 1,
                    bgcolor: alpha(theme.palette.primary.main, 0.1),
                    '& .MuiLinearProgress-bar': {
                      bgcolor: 'primary.main'
                    }
                  }}
                />
              )}
            </Box>
          </>
        ) : (
          <Typography variant="body2" color="text.secondary">
            No active subscription
          </Typography>
        )}
      </CardContent>
    </Card>
  );
}
