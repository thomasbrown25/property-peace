import PropTypes from 'prop-types';
import { Link as RouterLink } from 'react-router-dom';
import { alpha, Box, Button, CircularProgress, Paper, Skeleton, Stack, Typography } from '@mui/material';
import { HomeOutlined, LockOutlined, ReloadOutlined, SettingOutlined } from '@ant-design/icons';

import useEntitlement from 'hooks/useEntitlement';
import { ADVANCED_REPORTING_FEATURE } from 'utils/entitlements';

const copy = {
  upgrade: {
    title: 'Unlock a clearer view of your portfolio',
    message: 'Advanced Reporting brings financial, occupancy, leasing, and operating insights together in one workspace.'
  },
  setup: {
    title: 'Finish setting up your organization',
    message: 'Advanced Reporting needs an active organization before it can securely load portfolio insights.'
  },
  unauthorized: {
    title: 'You do not have access to this report',
    message: 'Ask an organization owner or administrator to review your reporting access.'
  },
  unavailable: {
    title: 'Reporting access cannot be confirmed',
    message: 'We kept this report closed to protect your organization’s data. Try again; if it continues, contact support.'
  }
};

export default function EntitlementGate({ children, feature = ADVANCED_REPORTING_FEATURE, showUpgrade = true }) {
  const { presentation, refresh } = useEntitlement(feature);

  if (presentation.kind === 'allowed') return children;

  if (presentation.kind === 'loading') {
    return (
      <Paper aria-live="polite" aria-busy="true" sx={{ p: { xs: 2.5, sm: 4 }, borderRadius: 3 }}>
        <Stack direction="row" spacing={2} alignItems="center">
          <CircularProgress size={26} aria-label="Checking reporting access" />
          <Box sx={{ flex: 1 }}>
            <Skeleton width="42%" height={28} />
            <Skeleton width="76%" />
          </Box>
        </Stack>
      </Paper>
    );
  }

  const state = copy[presentation.kind] || copy.unavailable;
  const upgrade = presentation.kind === 'upgrade';
  const setup = presentation.kind === 'setup';
  const unauthorized = presentation.kind === 'unauthorized';
  const unavailable = presentation.kind === 'unavailable';

  return (
    <Paper
      aria-live="polite"
      sx={{
        position: 'relative',
        overflow: 'hidden',
        p: { xs: 2.5, sm: 4 },
        borderRadius: 3,
        border: (theme) => `1px solid ${alpha(theme.palette.success.main, 0.22)}`,
        background: (theme) => `linear-gradient(135deg, ${theme.palette.background.paper}, ${alpha(theme.palette.success.light, 0.08)})`
      }}
    >
      <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2.5} alignItems={{ xs: 'stretch', sm: 'center' }}>
        <Box
          sx={{
            width: 52,
            height: 52,
            borderRadius: 2,
            display: 'grid',
            placeItems: 'center',
            bgcolor: 'primary.main',
            color: 'primary.contrastText',
            fontSize: 23
          }}
        >
          {setup ? <HomeOutlined aria-hidden="true" /> : <LockOutlined aria-hidden="true" />}
        </Box>
        <Box sx={{ flex: 1 }}>
          <Typography component="h1" variant="h4" fontWeight={750}>
            {state.title}
          </Typography>
          <Typography color="text.secondary" sx={{ mt: 0.75, maxWidth: 680, lineHeight: 1.65 }}>
            {state.message}
            {unauthorized ? ' No billing changes are needed.' : ''}
          </Typography>
        </Box>
        <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1} sx={{ flexShrink: 0 }}>
          {upgrade && showUpgrade && (
            <Button
              component={RouterLink}
              to="/landlord/settings?tab=subscription"
              variant="contained"
              startIcon={<LockOutlined />}
              sx={{ minHeight: 44 }}
            >
              View subscription
            </Button>
          )}
          {setup && (
            <Button
              component={RouterLink}
              to="/landlord/admin-members"
              variant="contained"
              startIcon={<SettingOutlined />}
              sx={{ minHeight: 44 }}
            >
              Choose organization
            </Button>
          )}
          {unavailable && (
            <Button type="button" variant="outlined" startIcon={<ReloadOutlined />} onClick={refresh} sx={{ minHeight: 44 }}>
              Try again
            </Button>
          )}
        </Stack>
      </Stack>
    </Paper>
  );
}

EntitlementGate.propTypes = {
  children: PropTypes.node.isRequired,
  feature: PropTypes.string,
  showUpgrade: PropTypes.bool
};
