import useSWR from 'swr';
import { Link as RouterLink } from 'react-router-dom';
import { alpha, Box, Button, Link, Stack, Typography } from '@mui/material';
import AppIcon from 'components/AppIcon';
import { useOrganization } from 'contexts/OrganizationContext';
import useAuth from 'hooks/useAuth';
import axiosServices from 'utils/axios';
import { formatRelativeTime } from 'utils/formatters';
import useCurrentTime from 'hooks/useCurrentTime';
import { getActivityDestination, getActivityKey } from 'utils/activityNavigation.mjs';
import { loadDashboardActivity } from './dashboardActivity.mjs';

const surfaceSx = {
  p: 2.5,
  borderRadius: 3,
  bgcolor: 'background.paper',
  boxShadow: (theme) => `0 8px 28px ${alpha(theme.palette.mode === 'dark' ? theme.palette.common.black : theme.palette.brand.forest, theme.palette.mode === 'dark' ? 0.15 : 0.05)}`
};

function LoadState({ loading, error, onRetry, children }) {
  if (loading) return <Typography role="status" color="text.secondary" variant="body2">Loading…</Typography>;
  if (error) return (
    <Box role="status">
      <Typography color="text.secondary" variant="body2">Unable to load right now.</Typography>
      <Button size="small" onClick={onRetry}>Retry</Button>
    </Box>
  );
  return children;
}

export default function OwnerHomeSidebar() {
  const now = useCurrentTime();
  const { currentOrganization, loading: organizationLoading } = useOrganization();
  const { user } = useAuth();
  const organizationId = currentOrganization?.id ?? currentOrganization?.Id;
  const userId = user?.id ?? user?.Id;
  const ready = !organizationLoading && organizationId && userId;
  const activity = useSWR(ready ? ['owner-home-activity', organizationId, userId] : null,
    ([, id]) => loadDashboardActivity(axiosServices, id), { refreshInterval: 30000 });

  return (
    <Box component="aside" aria-labelledby="owner-recent-activity-heading" sx={{ minWidth: 0 }}>
      <Stack direction="row" justifyContent="space-between" alignItems="center" spacing={1} sx={{ mb: 1.5 }}>
        <Typography id="owner-recent-activity-heading" component="h2" variant="h5" fontWeight={700}>Recent activity</Typography>
        <Link component={RouterLink} to="/landlord/activity" underline="hover" sx={{ whiteSpace: 'nowrap', fontSize: '0.8rem', fontWeight: 600 }}>View all</Link>
      </Stack>
      <LoadState loading={organizationLoading || activity.isLoading} error={activity.error} onRetry={() => activity.mutate()}>
        <Box component="ul" sx={{ ...surfaceSx, m: 0, listStyle: 'none', px: 2, py: 0.5 }}>
          {(activity.data || []).map((item, index) => (
            <Box component="li" key={getActivityKey(item, index)} sx={{ display: 'flex', gap: 1.25, py: 1.75, borderTop: index ? '1px solid' : 0, borderColor: 'divider' }}>
              <Box aria-hidden="true" sx={{ color: 'text.secondary', pt: 0.25, flexShrink: 0 }}><AppIcon name="activity" /></Box>
              <Box sx={{ minWidth: 0 }}>
                <Link component={RouterLink} to={getActivityDestination(item) || '/landlord/activity'} variant="body2" underline="hover" sx={{ fontWeight: 600, overflowWrap: 'anywhere' }}>{item.title || item.message}</Link>
                <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 0.5, overflowWrap: 'anywhere' }}>
                  {item.createdAt ? formatRelativeTime(item.createdAt, now) : ''}
                  {item.performedByName && ` · ${item.performedByName}`}
                </Typography>
              </Box>
            </Box>
          ))}
          {!activity.data?.length && <Box component="li" sx={{ py: 2 }}><Typography variant="body2" color="text.secondary">No recent activity.</Typography></Box>}
        </Box>
      </LoadState>
    </Box>
  );
}
