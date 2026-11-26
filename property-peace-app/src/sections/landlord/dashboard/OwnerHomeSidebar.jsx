import useSWR from 'swr';
import { Link as RouterLink } from 'react-router-dom';
import { Box, Button, Link, Stack, Typography } from '@mui/material';
import AppIcon from 'components/AppIcon';
import { useOrganization } from 'contexts/OrganizationContext';
import useAuth from 'hooks/useAuth';
import axiosServices from 'utils/axios';
import { formatRelativeTime } from 'utils/formatters';
import useCurrentTime from 'hooks/useCurrentTime';
import { getActivityDestination, getActivityKey } from 'utils/activityNavigation.mjs';
import { loadDashboardActivity } from './dashboardActivity.mjs';
import { dashboardEntranceDelay, dashboardRowHoverSx, dashboardRowLinkSx, dashboardSlideDownSx } from './dashboardEntrance.mjs';

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
        <Box component="ul" sx={{ m: 0, p: 0, listStyle: 'none' }}>
          {(activity.data || []).map((item, index) => (
            <Box
              component="li" key={getActivityKey(item, index)}
              style={{ '--dashboard-deal-delay': dashboardEntranceDelay(index) }}
              sx={{
                ...dashboardSlideDownSx,
                bgcolor: 'background.paper',
                border: '1px solid',
                borderBottomWidth: 0,
                borderColor: 'divider',
                '&:first-child': { borderTopLeftRadius: 2, borderTopRightRadius: 2 },
                '&:last-child': { borderBottomWidth: 1, borderBottomLeftRadius: 2, borderBottomRightRadius: 2 }
              }}
            >
              <Link
                component={RouterLink}
                to={getActivityDestination(item) || '/landlord/activity'}
                underline="none"
                sx={{ ...dashboardRowLinkSx, ...dashboardRowHoverSx, display: 'flex', alignItems: 'center', gap: 1.25, py: 1, px: 1.5, borderRadius: 'inherit' }}
              >
                <Box aria-hidden="true" sx={{ display: 'flex', flexShrink: 0, color: 'primary.main' }}>
                  <AppIcon name="activity" />
                </Box>
                <Typography variant="body2" sx={{ flex: 1, minWidth: 0, fontWeight: 600, overflowWrap: 'anywhere' }}>
                  {item.title || item.message}
                </Typography>
                {item.createdAt && (
                  <Typography variant="caption" color="text.secondary" sx={{ flexShrink: 0, textAlign: 'right' }}>
                    {formatRelativeTime(item.createdAt, now)}
                  </Typography>
                )}
              </Link>
            </Box>
          ))}
          {!activity.data?.length && <Box component="li" sx={{ py: 2 }}><Typography variant="body2" color="text.secondary">No recent activity.</Typography></Box>}
        </Box>
      </LoadState>
    </Box>
  );
}
