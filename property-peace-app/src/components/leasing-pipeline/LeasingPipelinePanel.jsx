import { Alert, Box, Button, Card, CardContent, Skeleton, Stack, Typography, alpha, useTheme } from '@mui/material';
import { CheckOutlined, ClockCircleOutlined, RightOutlined } from '@ant-design/icons';
import { useNavigate } from 'react-router-dom';

import useLeasingPipeline from 'hooks/useLeasingPipeline';
import {
  getPipelineStages,
  getSafeBlockerMessage,
  getSafeESignatureDetails,
  getSafePrimaryAction,
  runLeasingPrimaryAction
} from 'utils/leasingPipeline';

export function PipelineSkeleton() {
  return (
    <Card variant="outlined" role="status" aria-live="polite" aria-busy="true" aria-label="Loading leasing progress">
      <CardContent sx={{ p: { xs: 2, md: 2.5 }, '&:last-child': { pb: { xs: 2, md: 2.5 } } }}>
        <Skeleton width={170} height={28} />
        <Stack direction="row" spacing={1} sx={{ mt: 1.5, overflow: 'hidden' }}>
          {Array.from({ length: 6 }, (_, index) => <Skeleton key={index} variant="rounded" width={112} height={54} sx={{ flexShrink: 0 }} />)}
        </Stack>
      </CardContent>
    </Card>
  );
}

const formatDetailDate = (value) => value
  ? new Intl.DateTimeFormat(undefined, { month: 'short', day: 'numeric', year: 'numeric' }).format(new Date(value))
  : null;

export default function LeasingPipelinePanel({ resourceType, resourceId, unitId, title = 'Leasing progress', onCreateListing, onCreateLease }) {
  const theme = useTheme();
  const navigate = useNavigate();
  const { pipeline, error, isLoading, retry, canLoad } = useLeasingPipeline(resourceType, resourceId, unitId);

  if (!canLoad) return null;
  if (isLoading) return <PipelineSkeleton />;
  if (error) {
    return (
      <Card variant="outlined">
        <CardContent sx={{ p: 2, '&:last-child': { pb: 2 } }}>
          <Alert
            severity="error"
            action={<Button color="inherit" size="small" onClick={retry} sx={{ '&:focus-visible': { outline: '2px solid currentColor' } }}>Retry</Button>}
          >
            <strong>Leasing progress unavailable.</strong> Nothing is shown until access can be verified.
          </Alert>
        </CardContent>
      </Card>
    );
  }
  const stages = getPipelineStages(pipeline);
  if (!stages) {
    return (
      <Card variant="outlined">
        <CardContent sx={{ p: 2, '&:last-child': { pb: 2 } }}>
          <Alert severity="error" action={<Button color="inherit" size="small" onClick={retry}>Retry</Button>}>
            <strong>Leasing progress unavailable.</strong> The lifecycle response could not be verified.
          </Alert>
        </CardContent>
      </Card>
    );
  }

  const blocker = getSafeBlockerMessage(pipeline.blocker);
  const action = getSafePrimaryAction(pipeline.primaryAction, pipeline.currentStage, pipeline.references);
  const eSignatureDetails = getSafeESignatureDetails(pipeline);
  const handleStageScrollKeys = (event) => {
    if (event.key !== 'ArrowLeft' && event.key !== 'ArrowRight') return;
    event.preventDefault();
    event.currentTarget.scrollBy({ left: event.key === 'ArrowLeft' ? -240 : 240, behavior: 'smooth' });
  };
  const handlePrimaryAction = () => {
    if (pipeline.primaryAction?.code === 'createListing' && typeof onCreateListing === 'function') {
      onCreateListing();
      return;
    }
    runLeasingPrimaryAction(pipeline.primaryAction?.code, { onCreateLease, navigate }, action.route);
  };

  return (
    <Card variant="outlined" sx={{ borderColor: alpha(theme.palette.primary.main, 0.18), borderRadius: 2, boxShadow: `0 5px 18px ${alpha(theme.palette.grey[900], 0.045)}` }}>
      <CardContent sx={{ p: { xs: 2, md: 2.5 }, '&:last-child': { pb: { xs: 2, md: 2.5 } } }}>
        <Stack direction={{ xs: 'column', sm: 'row' }} justifyContent="space-between" alignItems={{ xs: 'stretch', sm: 'center' }} gap={1.5}>
          <Box>
            <Typography component="h2" variant="h6" fontWeight={750}>{title}</Typography>
            <Typography variant="caption" color="text.secondary">Current lifecycle status for this resource</Typography>
          </Box>
          {action && (
            <Button
              variant="contained"
              size="small"
              endIcon={<RightOutlined />}
              onClick={handlePrimaryAction}
              sx={{ alignSelf: { xs: 'stretch', sm: 'center' }, '&:focus-visible': { outline: `3px solid ${alpha(theme.palette.primary.main, 0.35)}`, outlineOffset: 2 } }}
            >
              {action.label}
            </Button>
          )}
        </Stack>

        <Box
          role="region"
          aria-label="Leasing lifecycle stages"
          tabIndex={0}
          onKeyDown={handleStageScrollKeys}
          sx={{ mt: 1.75, mx: { xs: -0.5, sm: 0 }, px: { xs: 0.5, sm: 0 }, overflowX: 'auto', overscrollBehaviorInline: 'contain', scrollbarWidth: 'thin', '&:focus-visible': { outline: `3px solid ${alpha(theme.palette.primary.main, 0.35)}`, outlineOffset: 2 } }}
        >
          <Box component="ol" aria-label="Leasing lifecycle" sx={{ display: 'flex', gap: 0.75, minWidth: { xs: 1030, lg: '100%' }, p: 0, pb: 0.75, m: 0, listStyle: 'none' }}>
            {stages.map((item) => {
              const complete = item.state === 'complete';
              const current = item.state === 'current';
              const stageColor = current
                ? (theme.palette.mode === 'dark' ? theme.palette.primary.light : theme.palette.primary.dark)
                : complete
                  ? (theme.palette.mode === 'dark' ? theme.palette.success.light : theme.palette.success.dark)
                  : theme.palette.text.secondary;
              return (
                <Box
                  component="li"
                  key={item.stage}
                  aria-current={item.state === 'current' ? 'step' : undefined}
                  aria-label={`${item.label}: ${complete ? 'completed' : current ? 'current' : 'upcoming'}`}
                  sx={{
                    flex: '1 0 88px', minWidth: 0, px: 1, py: 1, borderRadius: 1,
                    border: '1px solid',
                    borderColor: current ? 'primary.main' : complete ? 'success.dark' : 'divider',
                    bgcolor: current ? alpha(theme.palette.primary.main, 0.1) : complete ? alpha(theme.palette.success.main, 0.08) : 'background.paper',
                    color: stageColor
                  }}
                >
                  <Stack direction="row" spacing={0.65} alignItems="center">
                    <Box aria-hidden="true" sx={{ fontSize: 13, lineHeight: 0 }}>{complete ? <CheckOutlined /> : current ? <ClockCircleOutlined /> : <span>○</span>}</Box>
                    <Typography sx={{ fontSize: '0.75rem', lineHeight: 1.2, fontWeight: current || complete ? 700 : 550, whiteSpace: 'normal' }}>{item.label}</Typography>
                  </Stack>
                  <Typography sx={{ mt: 0.45, fontSize: '0.75rem', lineHeight: 1.1, fontWeight: 650 }}>{complete ? 'Complete' : current ? 'Current' : 'Upcoming'}</Typography>
                </Box>
              );
            })}
          </Box>
        </Box>

        {eSignatureDetails && (
          <Box
            role="group"
            aria-label="Electronic signature details"
            sx={{
              mt: 1.25, p: 1.25, borderRadius: 1.25, border: '1px solid', borderColor: 'divider',
              bgcolor: alpha(theme.palette.primary.main, 0.035),
              display: 'grid', gridTemplateColumns: { xs: '1fr', sm: 'minmax(180px, 2fr) repeat(2, minmax(110px, 1fr))' },
              gap: { xs: 1, sm: 1.5 }
            }}
          >
            {eSignatureDetails.documentName && (
              <Box>
                <Typography variant="caption" color="text.secondary" fontWeight={700}>Document</Typography>
                <Typography variant="body2" fontWeight={700}>
                  {eSignatureDetails.documentName} ({eSignatureDetails.documentType})
                </Typography>
                <Typography variant="caption" color="text.secondary">
                  {eSignatureDetails.isSignedCopy ? 'Signed copy' : 'Generated'} {formatDetailDate(eSignatureDetails.documentGeneratedAt)}
                </Typography>
              </Box>
            )}
            {eSignatureDetails.providerLabel && (
              <Box>
                <Typography variant="caption" color="text.secondary" fontWeight={700}>Provider</Typography>
                <Typography variant="body2" fontWeight={700}>{eSignatureDetails.providerLabel}</Typography>
                {eSignatureDetails.sentAt && (
                  <Typography variant="caption" color="text.secondary">Sent {formatDetailDate(eSignatureDetails.sentAt)}</Typography>
                )}
              </Box>
            )}
            {eSignatureDetails.requiredSignerCount != null && (
              <Box>
                <Typography variant="caption" color="text.secondary" fontWeight={700}>Signatures</Typography>
                <Typography variant="body2" fontWeight={700}>
                  {eSignatureDetails.signedSignerCount} of {eSignatureDetails.requiredSignerCount} signed
                </Typography>
                {eSignatureDetails.completedAt ? (
                  <Typography variant="caption" color="text.secondary">Completed {formatDetailDate(eSignatureDetails.completedAt)}</Typography>
                ) : eSignatureDetails.expiresAt ? (
                  <Typography variant="caption" color="text.secondary">Expires {formatDetailDate(eSignatureDetails.expiresAt)}</Typography>
                ) : null}
              </Box>
            )}
          </Box>
        )}

        {blocker && <Alert severity="warning" sx={{ mt: 1.25, py: 0, '& .MuiAlert-message': { fontSize: '0.78rem' } }}><strong>Next step blocked:</strong> {blocker}</Alert>}
      </CardContent>
    </Card>
  );
}
