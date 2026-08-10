import PropTypes from 'prop-types';
import { ArrowRightOutlined, HomeOutlined, ReloadOutlined } from '@ant-design/icons';
import { Box, Button, Card, CardContent, LinearProgress, Stack, Typography } from '@mui/material';
import { alpha } from '@mui/material/styles';
import { Link as RouterLink } from 'react-router-dom';

export default function FinishSetup({ setup }) {
  const { loading, error, refresh, viewModel, organization, organizationRequired } = setup;

  if (!loading && viewModel.available && viewModel.progress.completed === viewModel.progress.total) return null;

  const organizationName = organization?.name || organization?.Name || null;
  const next = viewModel.nextRequiredStep;
  const setupUrl = `/landlord/setup?mode=${viewModel.mode}`;

  return (
    <Card
      component="section"
      aria-labelledby="activation-card-title"
      elevation={0}
      sx={{ border: '1px solid', borderColor: 'divider', borderRadius: 2, boxShadow: 'none' }}
    >
      <CardContent sx={{ p: { xs: 2, sm: 2.5 }, '&:last-child': { pb: { xs: 2, sm: 2.5 } } }}>
        <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2} justifyContent="space-between" alignItems={{ sm: 'center' }}>
          <Box sx={{ flex: 1, minWidth: 0 }}>
            <Stack direction="row" spacing={1.25} alignItems="center" sx={{ mb: 0.75 }}>
              <Box sx={(theme) => ({ width: 36, height: 36, borderRadius: 1.5, display: 'grid', placeItems: 'center', color: 'primary.main', bgcolor: alpha(theme.palette.primary.main, 0.09) })}>
                <HomeOutlined />
              </Box>
              <Box>
                <Typography id="activation-card-title" component="h2" variant="h5" fontWeight={800}>Activate a rental workflow</Typography>
                {organizationName && <Typography variant="caption" color="text.secondary">{organizationName}</Typography>}
              </Box>
            </Stack>

            <Box aria-live="polite">
              {loading ? (
                <Typography variant="body2" color="text.secondary">Checking organization setup…</Typography>
              ) : organizationRequired ? (
                <Typography variant="body2" color="text.secondary">Choose or create an organization before checking activation progress.</Typography>
              ) : error || !viewModel.available ? (
                <Typography variant="body2" color="text.secondary">We couldn’t verify setup progress. Nothing has been marked complete.</Typography>
              ) : viewModel.readOnly ? (
                <Typography variant="body2" color="text.secondary">Organization setup status is available for orientation. You have view-only access.</Typography>
              ) : viewModel.waitingForOwner ? (
                <Typography variant="body2" color="text.secondary"><strong>Waiting for an Owner.</strong> An organization Owner must complete the next step.</Typography>
              ) : (
                <Typography variant="body2" color="text.secondary">
                  <strong>{next?.label || 'Continue setup'}</strong>{next?.description ? ` — ${next.description}` : ''}
                </Typography>
              )}
            </Box>

            {!loading && viewModel.available && !viewModel.readOnly && (
              <Box sx={{ mt: 1.5, maxWidth: 520 }}>
                <Stack direction="row" justifyContent="space-between" sx={{ mb: 0.5 }}>
                  <Typography variant="caption" color="text.secondary">{viewModel.progressLabel}</Typography>
                  <Typography variant="caption" fontWeight={700}>{viewModel.progress.percentage}%</Typography>
                </Stack>
                <LinearProgress
                  variant="determinate"
                  value={viewModel.progress.percentage}
                  aria-label={viewModel.progressLabel}
                  sx={{ height: 7, borderRadius: 1 }}
                />
              </Box>
            )}
          </Box>

          {!loading && organizationRequired && (
            <Button component={RouterLink} to="/landlord/admin-members" variant="outlined" sx={{ minHeight: 44, flexShrink: 0 }}>Choose organization</Button>
          )}
          {!loading && !organizationRequired && (error || !viewModel.available) && (
            <Button variant="outlined" onClick={refresh} startIcon={<ReloadOutlined />} sx={{ minHeight: 44, flexShrink: 0 }}>Retry</Button>
          )}
          {!loading && viewModel.available && !viewModel.readOnly && !viewModel.waitingForOwner && next?.link && (
            <Button component={RouterLink} to={setupUrl} variant="contained" endIcon={<ArrowRightOutlined />} sx={{ minHeight: 44, flexShrink: 0 }}>
              Continue setup
            </Button>
          )}
          {!loading && viewModel.available && (viewModel.readOnly || viewModel.waitingForOwner) && (
            <Button component={RouterLink} to={setupUrl} variant="outlined" endIcon={<ArrowRightOutlined />} sx={{ minHeight: 44, flexShrink: 0 }}>
              Review setup
            </Button>
          )}
        </Stack>
      </CardContent>
    </Card>
  );
}

FinishSetup.propTypes = {
  setup: PropTypes.shape({
    loading: PropTypes.bool.isRequired,
    error: PropTypes.any,
    refresh: PropTypes.func.isRequired,
    viewModel: PropTypes.object.isRequired,
    organization: PropTypes.object
  }).isRequired
};
