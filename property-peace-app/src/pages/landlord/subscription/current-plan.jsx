import {
  Box,
  Typography,
  Chip,
  Alert,
  Stack,
  IconButton,
  Menu,
  MenuItem,
  LinearProgress,
  Divider,
  alpha
} from '@mui/material';
import { MoreOutlined } from '@ant-design/icons';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import WarningIcon from '@mui/icons-material/Warning';
import CancelIcon from '@mui/icons-material/Cancel';
import { useSubscriptionActions } from 'hooks/useSubscriptionActions';
import { useState } from 'react';
import { useSubscriptionStatus } from 'hooks/useSubscription';
import { useTheme } from '@mui/material/styles';
import { openSnackbar } from 'api/snackbar';
import { canManagePaidBilling, getPlanPricePresentation } from 'utils/subscriptionPresentation';

export default function CurrentPlan({ subscription, loading, onUpdate }) {
  const { cancel, resume, pause, resumePaused, loading: actionLoading } = useSubscriptionActions();
  const { status } = useSubscriptionStatus();
  const theme = useTheme();
  const [error, setError] = useState(null);
  const [menuAnchor, setMenuAnchor] = useState(null);

  if (loading) {
    return <Typography color="text.secondary" variant="body2">Loading...</Typography>;
  }

  const handleCancel = async () => {
    setMenuAnchor(null);
    try {
      setError(null);
      await cancel(true);
      if (onUpdate) onUpdate();
    } catch (err) {
      setError(err.message || 'Failed to cancel subscription');
    }
  };

  const handleResume = async () => {
    try {
      setError(null);
      await resume();
      if (onUpdate) onUpdate();
    } catch (err) {
      setError(err.message || 'Failed to resume subscription');
    }
  };

  const handlePause = async () => {
    setMenuAnchor(null);
    try {
      setError(null);
      await pause(true);
      openSnackbar({
        open: true,
        message: 'Subscription will be paused at the end of the current billing period.',
        variant: 'alert',
        alert: { color: 'info' }
      });
      if (onUpdate) onUpdate();
    } catch (err) {
      setError(err.message || 'Failed to pause subscription');
    }
  };

  const handleResumePaused = async () => {
    try {
      setError(null);
      await resumePaused();
      openSnackbar({
        open: true,
        message: 'Subscription has been resumed successfully.',
        variant: 'alert',
        alert: { color: 'success' }
      });
      if (onUpdate) onUpdate();
    } catch (err) {
      setError(err.message || 'Failed to resume paused subscription');
    }
  };

  const isTrial = subscription?.status === 'Trial';
  const isFreePlan = subscription?.plan?.name?.toLowerCase() === 'free';
  const isCancelled = subscription?.status === 'Cancelled';
  const isPaused = subscription?.status === 'Paused';
  const isPaymentPending = subscription?.status === 'PaymentPending';
  const showMenu = canManagePaidBilling(subscription) && !isCancelled;

  const getStatusConfig = () => {
    if (!subscription) return { color: 'default', icon: null, label: 'No Plan' };
    switch (subscription.status) {
      case 'Active': return { color: 'success', icon: <CheckCircleIcon sx={{ fontSize: 12 }} />, label: 'Active' };
      case 'Trial': return { color: 'info', icon: <WarningIcon sx={{ fontSize: 12 }} />, label: 'Trial' };
      case 'PaymentPending': return { color: 'warning', icon: <WarningIcon sx={{ fontSize: 12 }} />, label: 'Payment Pending' };
      case 'Cancelled': return { color: 'error', icon: <CancelIcon sx={{ fontSize: 12 }} />, label: 'Cancelled' };
      case 'Paused': return { color: 'warning', icon: <WarningIcon sx={{ fontSize: 12 }} />, label: 'Paused' };
      default: return { color: 'default', icon: null, label: subscription.status };
    }
  };

  const statusConfig = getStatusConfig();
  const planName = !subscription ? 'No Plan' : isTrial ? 'Legacy trial' : isFreePlan ? 'Free' : subscription.plan?.name || 'Unknown';
  const pricePresentation = getPlanPricePresentation(subscription?.plan, subscription?.billingCycle);
  const sinceDate = subscription?.createdAt
    ? new Date(subscription.createdAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
    : null;

  // Unit usage
  const { currentTotalUnits, maxTotalUnits } = status || {};
  const unitPct = maxTotalUnits > 0 ? Math.min((currentTotalUnits / maxTotalUnits) * 100, 100) : 0;
  const atUnitLimit = maxTotalUnits != null && currentTotalUnits >= maxTotalUnits;

  const barColor = atUnitLimit ? theme.palette.error.main : unitPct > 75 ? theme.palette.warning.main : theme.palette.primary.main;

  return (
    <Box>
      {/* Current Plan header */}
      <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 1.5 }}>
        <Typography variant="overline" color="text.secondary" fontWeight={600} sx={{ letterSpacing: 1 }}>
          Current Plan
        </Typography>
        {showMenu && (
          <>
            <IconButton size="small" onClick={(e) => setMenuAnchor(e.currentTarget)}>
              <MoreOutlined />
            </IconButton>
            <Menu
              anchorEl={menuAnchor}
              open={Boolean(menuAnchor)}
              onClose={() => setMenuAnchor(null)}
              anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
              transformOrigin={{ vertical: 'top', horizontal: 'right' }}
            >
              {isPaused || subscription.pausedAtPeriodEnd ? (
                <MenuItem onClick={handleResumePaused} disabled={actionLoading}>Un-pause Subscription</MenuItem>
              ) : subscription.cancelAtPeriodEnd ? (
                <MenuItem onClick={handleResume} disabled={actionLoading}>Resume Subscription</MenuItem>
              ) : (
                [
                  <MenuItem key="pause" onClick={handlePause} disabled={actionLoading}>Pause Subscription</MenuItem>,
                  <MenuItem key="cancel" onClick={handleCancel} disabled={actionLoading} sx={{ color: 'error.main' }}>
                    Cancel Subscription
                  </MenuItem>
                ]
              )}
            </Menu>
          </>
        )}
      </Stack>

      {/* Plan name + badge */}
      <Stack direction="row" alignItems="center" spacing={1} sx={{ mb: 0.5 }}>
        <Typography variant="h5" fontWeight={700}>{planName}</Typography>
        <Chip
          icon={statusConfig.icon}
          label={statusConfig.label}
          color={statusConfig.color}
          size="small"
          sx={{ fontWeight: 600, fontSize: 11 }}
        />
      </Stack>

      {/* Price + since date */}
      <Typography variant="body2" color="text.secondary">
        ${pricePresentation.amount.toFixed(2)}{pricePresentation.cadence}
        {pricePresentation.supportingText ? ` · ${pricePresentation.supportingText}` : ''}
        {sinceDate ? ` · since ${sinceDate}` : ''}
      </Typography>

      {/* Alerts for special states */}
      {isPaymentPending && (
        <Alert severity="warning" sx={{ mt: 1.5, py: 0.5 }}>
          Payment is being processed.
        </Alert>
      )}
      {subscription?.cancelAtPeriodEnd && (
        <Alert severity="info" sx={{ mt: 1.5, py: 0.5 }}>
          {isFreePlan
            ? `Premium access until ${subscription.currentPeriodEnd ? new Date(subscription.currentPeriodEnd).toLocaleDateString() : 'end of period'}.`
            : `Cancels ${subscription.currentPeriodEnd ? new Date(subscription.currentPeriodEnd).toLocaleDateString() : 'end of period'}.`
          }
        </Alert>
      )}
      {subscription?.pausedAtPeriodEnd && !subscription.cancelAtPeriodEnd && (
        <Alert severity="info" sx={{ mt: 1.5, py: 0.5 }}>
          Pauses {subscription.currentPeriodEnd ? new Date(subscription.currentPeriodEnd).toLocaleDateString() : '—'}.
        </Alert>
      )}
      {isPaused && (
        <Alert severity="warning" sx={{ mt: 1.5, py: 0.5 }}>
          Subscription is paused. Resume to regain access.
        </Alert>
      )}
      {isCancelled && (
        <Alert severity="info" sx={{ mt: 1.5, py: 0.5 }}>
          Subscription cancelled. Select a plan to reactivate.
        </Alert>
      )}
      {error && (
        <Alert severity="error" sx={{ mt: 1.5, py: 0.5 }}>{error}</Alert>
      )}

      {/* Usage section */}
      {status && (
        <>
          <Divider sx={{ my: 2 }} />
          <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 1.5 }}>
            <Typography variant="overline" color="text.secondary" fontWeight={600} sx={{ letterSpacing: 1 }}>
              Usage
            </Typography>
            <Typography variant="caption" color="text.secondary">this period</Typography>
          </Stack>

          <Box>
            <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 0.5 }}>
              <Stack direction="row" alignItems="center" spacing={0.75}>
                <Typography variant="body2" fontWeight={500}>Units</Typography>
              </Stack>
              <Stack direction="row" alignItems="center" spacing={0.75}>
                <Typography
                  variant="body2"
                  fontWeight={600}
                  color={atUnitLimit ? 'error.main' : 'text.primary'}
                >
                  {currentTotalUnits ?? 0} / {maxTotalUnits == null ? '∞' : maxTotalUnits}
                </Typography>
                {atUnitLimit && (
                  <Typography variant="caption" color="error.main" fontWeight={600}>
                    limit reached
                  </Typography>
                )}
              </Stack>
            </Stack>
            {maxTotalUnits != null && (
              <LinearProgress
                variant="determinate"
                value={unitPct}
                sx={{
                  height: 6,
                  borderRadius: 1,
                  bgcolor: alpha(barColor, 0.12),
                  '& .MuiLinearProgress-bar': { bgcolor: barColor, borderRadius: 1 }
                }}
              />
            )}
          </Box>
        </>
      )}
    </Box>
  );
}
