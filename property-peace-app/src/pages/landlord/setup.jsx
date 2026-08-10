import { useEffect } from 'react';
import PropTypes from 'prop-types';
import { CheckOutlined, ClockCircleOutlined, LockOutlined, RightOutlined } from '@ant-design/icons';
import { Alert, Box, Button, Card, CardContent, Chip, LinearProgress, Stack, Typography } from '@mui/material';
import { alpha } from '@mui/material/styles';
import { Link as RouterLink, useSearchParams } from 'react-router-dom';

import { useOrganization } from 'contexts/OrganizationContext';
import useLandlordSetupSteps from 'hooks/useLandlordSetupSteps';
import {
  activationModeStorage,
  explicitActivationMode,
  readActivationModePreference,
  writeActivationModePreference
} from 'utils/activationModePreference';

const PATHS = [
  { mode: 'vacant', title: 'Fill a vacancy', copy: 'Add the rental, market the vacancy, review applications, then set up the lease and tenant.' },
  { mode: 'occupied', title: 'Set up an occupied rental', copy: 'Add the rental and its existing lease and tenant. A new listing or application is not required.' },
  { mode: 'import', title: 'Import a spreadsheet', copy: 'Imports properties and basic unit details only. Leases, tenants, rent, and communications still need setup.' }
];

function stepDetail(step, mode) {
  if (step.key === 'listing-application' && step.status === 'notApplicable' && mode === 'occupied') {
    return 'Not needed — this rental already has a configured lease';
  }
  if (step.key === 'tenant-invite' && step.status === 'waiting') return 'Invite sent / waiting for tenant';
  if (step.key === 'rent-readiness') {
    if (step.evidence?.rentScheduleConfigured) {
      return 'The lease rent schedule is configured. Online payment readiness is optional and shown separately when you have billing access.';
    }
    if (step.evidence?.manualTrackingConfigured) {
      return 'Core manual rent tracking is configured. Online payment readiness is optional and shown separately when you have billing access.';
    }
    return 'Configure the lease rent schedule or core manual tracking. Online payments are not required for manual tracking.';
  }
  if (step.status === 'blocked' && step.ownerActionRequired) return 'Waiting for an Owner';
  return step.description;
}

function StatusIcon({ status }) {
  if (status === 'complete') return <CheckOutlined aria-hidden="true" />;
  if (status === 'waiting') return <ClockCircleOutlined aria-hidden="true" />;
  if (status === 'blocked') return <LockOutlined aria-hidden="true" />;
  return <RightOutlined aria-hidden="true" />;
}

export default function LandlordSetup() {
  const [searchParams, setSearchParams] = useSearchParams();
  const { currentOrganization } = useOrganization();
  const organizationId = currentOrganization?.id ?? currentOrganization?.Id ?? null;
  const explicitMode = explicitActivationMode(searchParams);
  const storage = activationModeStorage(typeof window === 'undefined' ? null : window);
  const mode = explicitMode ?? readActivationModePreference(storage, organizationId);
  const setup = useLandlordSetupSteps({ mode });
  const { viewModel: view, loading, error, refresh, organization, organizationRequired } = setup;
  useEffect(() => {
    if (explicitMode) {
      writeActivationModePreference(storage, organizationId, explicitMode);
    }
  }, [explicitMode, organizationId, storage]);
  const organizationName = organization?.name || organization?.Name;
  const currentKey = view.nextRequiredStep?.key;

  return (
    <Box sx={{ maxWidth: 1120, mx: 'auto', py: { xs: 2, md: 3 } }}>
      <Stack spacing={2.5}>
        <Box>
          <Typography component="h1" variant="h3" fontWeight={800}>Activate a rental workflow</Typography>
          <Typography color="text.secondary" sx={{ mt: 0.75, maxWidth: 760 }}>
            Complete one reliable property-to-tenant workflow for {organizationName || 'your organization'}. This activation progress does not claim that every rental in your portfolio is configured.
          </Typography>
          {organizationName && <Typography variant="body2" fontWeight={700} sx={{ mt: 1 }}>{organizationName}</Typography>}
        </Box>

        <Box component="section" aria-labelledby="setup-path-heading">
          <Typography id="setup-path-heading" component="h2" variant="h5" fontWeight={800} sx={{ mb: 1.25 }}>Choose your path</Typography>
          <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', md: 'repeat(3, 1fr)' }, gap: 1.5 }}>
            {PATHS.map((path) => {
              const selected = path.mode === mode;
              return (
                <Card key={path.mode} elevation={0} sx={{ border: '1px solid', borderColor: selected ? 'primary.main' : 'divider', borderRadius: 2, boxShadow: 'none' }}>
                  <CardContent sx={{ height: '100%', display: 'flex', flexDirection: 'column', p: 2, '&:last-child': { pb: 2 } }}>
                    <Typography component="h3" variant="h6" fontWeight={800}>{path.title}</Typography>
                    <Typography variant="body2" color="text.secondary" sx={{ mt: 0.75, mb: 2, flex: 1 }}>{path.copy}</Typography>
                    <Button
                      onClick={() => setSearchParams({ mode: path.mode })}
                      variant={selected ? 'contained' : 'outlined'}
                      aria-pressed={selected}
                      sx={{ minHeight: 44 }}
                    >
                      {selected ? 'Selected path' : `Choose ${path.title.toLowerCase()}`}
                    </Button>
                  </CardContent>
                </Card>
              );
            })}
          </Box>
        </Box>

        <Card component="section" aria-labelledby="core-setup-heading" elevation={0} sx={{ border: '1px solid', borderColor: 'divider', borderRadius: 2, boxShadow: 'none' }}>
          <CardContent sx={{ p: { xs: 2, md: 2.5 }, '&:last-child': { pb: { xs: 2, md: 2.5 } } }}>
            <Stack spacing={2}>
              <Box>
                <Typography id="core-setup-heading" component="h2" variant="h5" fontWeight={800}>Core setup</Typography>
                <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>{view.modeDescription}</Typography>
              </Box>

              <Box aria-live="polite">
                {loading && <Alert severity="info">Checking the current organization setup…</Alert>}
                {!loading && organizationRequired && (
                  <Alert severity="info" action={<Button component={RouterLink} to="/landlord/admin-members" color="inherit" sx={{ minHeight: 44 }}>Choose organization</Button>}>
                    Choose or create an organization before checking activation progress.
                  </Alert>
                )}
                {!loading && !organizationRequired && (error || !view.available) && (
                  <Alert severity="warning" action={<Button color="inherit" onClick={refresh} sx={{ minHeight: 44 }}>Retry</Button>}>
                    Setup status is unavailable. No steps are being assumed complete.
                  </Alert>
                )}
                {!loading && view.available && view.readOnly && (
                  <Alert severity="info">View-only organization orientation. You can review status, but setup actions are reserved for organization members with edit access.</Alert>
                )}
                {!loading && view.waitingForOwner && (
                  <Alert severity="info"><strong>Waiting for an Owner.</strong> This is not your personal task, and no action is required from you.</Alert>
                )}
              </Box>

              {!loading && view.available && !view.readOnly && (
                <Box>
                  <Stack direction="row" justifyContent="space-between" sx={{ mb: 0.75 }}>
                    <Typography id="setup-progress-label" variant="body2" fontWeight={700}>{view.progressLabel}</Typography>
                    <Typography variant="body2" fontWeight={800}>{view.progress.percentage}%</Typography>
                  </Stack>
                  <LinearProgress
                    role="progressbar"
                    aria-labelledby="setup-progress-label"
                    aria-valuemin={0}
                    aria-valuemax={100}
                    aria-valuenow={view.progress.percentage}
                    variant="determinate"
                    value={view.progress.percentage}
                    sx={{ height: 9, borderRadius: 1 }}
                  />
                </Box>
              )}

              {!loading && view.available && (
                <Stack component="ol" spacing={1.25} sx={{ listStyle: 'none', p: 0, m: 0 }}>
                {view.steps.map((step, index) => {
                  const isCurrent = step.key === currentKey;
                  const canAct = isCurrent && !view.readOnly && !view.waitingForOwner && Boolean(step.link);
                  return (
                    <Box
                      component="li"
                      key={step.key}
                      aria-current={isCurrent ? 'step' : undefined}
                      sx={(theme) => ({
                        display: 'flex', alignItems: { xs: 'flex-start', sm: 'center' }, flexDirection: { xs: 'column', sm: 'row' }, gap: 1.5,
                        p: { xs: 1.5, sm: 2 }, border: '1px solid', borderColor: isCurrent ? 'primary.main' : 'divider', borderRadius: 1.5,
                        bgcolor: isCurrent ? alpha(theme.palette.primary.main, 0.035) : 'background.paper'
                      })}
                    >
                      <Stack direction="row" spacing={1.5} sx={{ flex: 1, minWidth: 0 }}>
                        <Box sx={{ width: 30, height: 30, border: '1px solid', borderColor: 'divider', borderRadius: 1.25, display: 'grid', placeItems: 'center', flexShrink: 0 }}>
                          <StatusIcon status={step.status} />
                        </Box>
                        <Box>
                          <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1} alignItems={{ sm: 'center' }}>
                            <Typography fontWeight={800}>{index + 1}. {step.label}</Typography>
                            <Chip label={step.statusLabel} size="small" variant="outlined" />
                          </Stack>
                          <Typography variant="body2" color="text.secondary" sx={{ mt: 0.4 }}>{stepDetail(step, mode)}</Typography>
                        </Box>
                      </Stack>
                      {canAct && (
                        <Button component={RouterLink} to={step.link.route} variant="contained" sx={{ minHeight: 44, flexShrink: 0 }}>
                          {step.link.label}
                        </Button>
                      )}
                    </Box>
                  );
                })}
                </Stack>
              )}
            </Stack>
          </CardContent>
        </Card>

        <Card component="section" aria-labelledby="enhance-heading" elevation={0} sx={{ border: '1px solid', borderColor: 'divider', borderRadius: 2, boxShadow: 'none' }}>
          <CardContent>
            <Typography id="enhance-heading" component="h2" variant="h5" fontWeight={800}>Enhance your setup</Typography>
            {!loading && view.available && view.enhancements.length > 0 ? view.enhancements.map((item) => (
              <Typography key={item.key} variant="body2" color="text.secondary" sx={{ mt: 1 }}>
                {item.label}: {item.ready ? 'Ready' : 'Not ready'}{item.detail ? ` — ${item.detail}` : ''}
              </Typography>
            )) : (
              <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>Optional feature readiness will appear here only when it can be verified.</Typography>
            )}
          </CardContent>
        </Card>
      </Stack>
    </Box>
  );
}

StatusIcon.propTypes = {
  status: PropTypes.string
};
