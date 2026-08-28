import { CheckCircleOutlined, ReloadOutlined } from '@ant-design/icons';
import { Alert, Box, Button, Chip, Divider, Paper, Stack, Typography } from '@mui/material';

const approvedStates = new Set(['approved-onboarding', 'under-review', 'ready']);
const statusChips = {
  'not-requested': { label: 'Not requested', color: 'default' },
  pending: { label: 'Under review', color: 'warning' },
  rejected: { label: 'Not approved', color: 'error' },
  suspended: { label: 'Suspended', color: 'error' },
  'approved-onboarding': { label: 'Approved', color: 'success' },
  'under-review': { label: 'Setup under review', color: 'warning' },
  ready: { label: 'Ready', color: 'success' },
  unavailable: { label: 'Unavailable', color: 'default' }
};

export default function RentPaymentAccessPanel({ presentation, loading = false, requesting = false, error = '', onRequest, onRefresh, onConfigure, compact = false }) {
  const state = presentation?.status || 'unavailable';
  const isApproved = approvedStates.has(state);
  const statusChip = statusChips[state] || statusChips.unavailable;
  const primaryLabel = presentation?.actionLabel;
  const disabled = requesting || loading;
  const action = presentation?.canRequest ? onRequest : primaryLabel === 'Finish payment setup' ? onConfigure : onRefresh;

  return (
    <Paper variant="outlined" sx={{ p: compact ? 2 : 2.5, mb: 3, borderColor: state === 'ready' ? 'success.light' : 'divider' }}>
      <Stack spacing={1.5}>
        <Stack direction="row" spacing={1} alignItems="center" justifyContent="space-between">
          <Typography variant="overline" color="primary.main" sx={{ fontWeight: 700, letterSpacing: 0.8 }}>Online rent payments</Typography>
          <Chip
            icon={state === 'ready' ? <CheckCircleOutlined /> : undefined}
            label={statusChip.label}
            color={statusChip.color}
            size="small"
            variant={statusChip.color === 'default' ? 'outlined' : 'filled'}
            sx={{ fontWeight: 700 }}
          />
        </Stack>
        <Box aria-live="polite" aria-atomic="true">
          <Typography variant="h5">{presentation?.title || 'Online rent payments temporarily unavailable'}</Typography>
          <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>{presentation?.message}</Typography>
        </Box>
        {error && <Alert severity="error" action={<Button color="inherit" size="small" onClick={onRefresh} disabled={disabled}>Retry</Button>}>{error}</Alert>}
        {isApproved && (
          <>
            <Divider />
            <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1} aria-label="Online payment setup progress">
              {['Access approved', 'Payment setup', 'Ready to collect'].map((step, index) => <Typography key={step} variant="caption" color={index === 0 || state === 'ready' || (state !== 'approved-onboarding' && index === 1) ? 'text.primary' : 'text.secondary'} sx={{ fontWeight: index === 0 ? 700 : 500 }}>{step}{index < 2 ? '  →' : ''}</Typography>)}
            </Stack>
          </>
        )}
        {primaryLabel && action && (
          <Box>
            <Button variant="contained" onClick={action} disabled={disabled || (primaryLabel === 'Finish payment setup' && !onConfigure)} startIcon={primaryLabel === 'Refresh status' ? <ReloadOutlined /> : undefined} sx={{ '&:focus-visible': { outline: '3px solid', outlineColor: 'primary.light', outlineOffset: 2 } }}>
              {requesting ? 'Submitting…' : loading ? 'Loading…' : primaryLabel}
            </Button>
          </Box>
        )}
        <Typography variant="caption" color="text.secondary">Included with the Free plan. Organization approval and Stripe setup are required before tenants can pay online. Manual rent records remain available separately.</Typography>
      </Stack>
    </Paper>
  );
}
