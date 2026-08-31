import { CheckCircleOutlined, ReloadOutlined } from '@ant-design/icons';
import { Alert, Box, Button, Chip, Paper, Stack, Typography } from '@mui/material';

const approvalBadgeStates = new Set(['approved-unavailable', 'approved-onboarding', 'ready']);
const statusChips = {
  'not-requested': { label: 'Not requested', color: 'default' },
  pending: { label: 'Under review', color: 'warning' },
  rejected: { label: 'Not approved', color: 'error' },
  suspended: { label: 'Suspended', color: 'error' },
  'approved-unavailable': { label: 'Approved', color: 'success' },
  'approved-onboarding': { label: 'Approved', color: 'success' },
  'under-review': { label: 'Setup under review', color: 'warning' },
  ready: { label: 'Ready', color: 'success' },
  unavailable: { label: 'Unavailable', color: 'default' }
};

export default function RentPaymentAccessPanel({ presentation, loading = false, requesting = false, error = '', onRequest, onRefresh, onConfigure, compact = false }) {
  const state = presentation?.status || 'unavailable';
  const statusChip = statusChips[state] || statusChips.unavailable;
  const primaryLabel = presentation?.actionLabel;
  const disabled = requesting || loading;
  const isConfigureAction = presentation?.canConfigure === true;
  const action = presentation?.canRequest ? onRequest : isConfigureAction ? onConfigure : onRefresh;

  return (
    <Paper variant="outlined" sx={{ p: compact ? 2 : 2.5, mb: 3, borderColor: state === 'ready' ? 'success.light' : 'divider' }}>
      <Stack spacing={1.5}>
        <Typography variant="overline" color="primary.main" sx={{ fontWeight: 700, letterSpacing: 0.8 }}>Connected Account Status</Typography>
        <Box aria-live="polite" aria-atomic="true">
          <Stack direction="row" spacing={1} alignItems="center" flexWrap="wrap" useFlexGap>
            {state !== 'under-review' && <Typography variant="h5">{presentation?.title || 'Online rent payments temporarily unavailable'}</Typography>}
            <Chip
              icon={approvalBadgeStates.has(state) ? <CheckCircleOutlined /> : undefined}
              label={statusChip.label}
              color={statusChip.color}
              size="small"
              variant={statusChip.color === 'default' ? 'outlined' : 'filled'}
              sx={{ fontWeight: 700 }}
            />
          </Stack>
          {state !== 'under-review' && presentation?.message && <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>{presentation.message}</Typography>}
        </Box>
        {error && <Alert severity="error" action={<Button color="inherit" size="small" onClick={onRefresh} disabled={disabled}>Retry</Button>}>{error}</Alert>}
        {primaryLabel && action && (
          <Box sx={{ display: 'flex', justifyContent: primaryLabel === 'Refresh status' ? 'flex-end' : 'flex-start' }}>
            <Button variant="contained" onClick={action} disabled={disabled || (isConfigureAction && !onConfigure)} startIcon={primaryLabel === 'Refresh status' ? <ReloadOutlined /> : undefined} sx={{ '&:focus-visible': { outline: '3px solid', outlineColor: 'primary.light', outlineOffset: 2 } }}>
              {requesting ? 'Submitting…' : loading ? 'Loading…' : primaryLabel}
            </Button>
          </Box>
        )}
      </Stack>
    </Paper>
  );
}
