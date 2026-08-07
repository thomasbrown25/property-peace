import { Alert, Box, Button, Card, CardContent, Skeleton, Stack, Typography, alpha, useTheme } from '@mui/material';
import { CheckOutlined, ClockCircleOutlined, RightOutlined } from '@ant-design/icons';
import { useNavigate } from 'react-router-dom';

import useLeasingPipeline from 'hooks/useLeasingPipeline';
import { getPipelineStages, getSafeBlockerMessage, getSafePrimaryAction } from 'utils/leasingPipeline';

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

export default function LeasingPipelinePanel({ resourceType, resourceId, unitId, title = 'Leasing progress', onCreateListing }) {
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
    navigate(action.route);
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
                    color: current ? 'primary.dark' : complete ? 'success.dark' : 'text.secondary'
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

        {blocker && <Alert severity="warning" sx={{ mt: 1.25, py: 0, '& .MuiAlert-message': { fontSize: '0.78rem' } }}><strong>Next step blocked:</strong> {blocker}</Alert>}
      </CardContent>
    </Card>
  );
}
