import { useState } from 'react';
import useSWR from 'swr';
import { Link as RouterLink } from 'react-router-dom';
import { Box, Button, ButtonBase, Collapse, Link, Stack, Typography } from '@mui/material';
import { DownOutlined, HistoryOutlined } from '@ant-design/icons';
import { useOrganization } from 'contexts/OrganizationContext';
import useAuth from 'hooks/useAuth';
import axiosServices from 'utils/axios';
import { formatRelativeTime } from 'utils/formatters';
import { getActivityDestination, getActivityKey } from 'utils/activityNavigation.mjs';
import { formatAccountMoney, loadDashboardAccounts, loadDashboardActivity } from './dashboardAccounts.mjs';

const surfaceSx = {
  p: 2.5,
  borderRadius: 3,
  bgcolor: 'background.paper',
  boxShadow: (theme) => `0 8px 28px ${theme.palette.mode === 'dark' ? '#00000026' : '#061e350d'}`
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
  const [accountsOpen, setAccountsOpen] = useState(true);
  const { currentOrganization, loading: organizationLoading } = useOrganization();
  const { user } = useAuth();
  const organizationId = currentOrganization?.id ?? currentOrganization?.Id;
  const userId = user?.id ?? user?.Id;
  const ready = !organizationLoading && organizationId && userId;
  const accounts = useSWR(ready ? ['owner-home-accounts', organizationId, userId] : null,
    ([, id]) => loadDashboardAccounts(axiosServices, id), { revalidateOnFocus: true });
  const activity = useSWR(ready ? ['owner-home-activity', organizationId, userId] : null,
    ([, id]) => loadDashboardActivity(axiosServices, id), { refreshInterval: 30000 });

  return (
    <Stack component="aside" aria-label="Stripe accounts and recent activity" spacing={3.5} sx={{ minWidth: 0 }}>
      <Box component="section" aria-labelledby="owner-accounts-heading">
        <ButtonBase
          onClick={() => setAccountsOpen((open) => !open)}
          aria-expanded={accountsOpen}
          aria-controls="owner-accounts-content"
          sx={{ width: '100%', justifyContent: 'space-between', textAlign: 'left', py: 1, mb: 1.5, borderRadius: 1,
            '&:focus-visible': { outline: '2px solid', outlineColor: 'primary.main', outlineOffset: 3 } }}
        >
          <Typography id="owner-accounts-heading" component="h2" variant="h5" fontWeight={700}>Stripe accounts</Typography>
          <DownOutlined aria-hidden="true" style={{ transform: accountsOpen ? 'rotate(180deg)' : 'none', transition: 'transform 180ms ease' }} />
        </ButtonBase>
        <Collapse in={accountsOpen} id="owner-accounts-content">
          <LoadState loading={organizationLoading || accounts.isLoading} error={accounts.error} onRetry={() => accounts.mutate()}>
            <Stack spacing={1.5}>
              {(accounts.data || []).map((account) => (
                <Box key={account.id} sx={surfaceSx}>
                  <Typography variant="body2" sx={{ fontWeight: 700, mb: 0.5 }}>Stripe account</Typography>
                  <Stack direction="row" useFlexGap flexWrap="wrap" gap={0.75} alignItems="baseline" sx={{ mb: 0.75 }}>
                    <Typography variant="body2" color="text.secondary" sx={{ overflowWrap: 'anywhere' }}>
                      Payout bank: {account.displayName || account.accountName || account.bankName || 'Connected bank'}
                    </Typography>
                    {account.last4 && <Typography variant="body2" color="text.secondary">•••• {account.last4}</Typography>}
                  </Stack>
                  {account.balances.length ? account.balances.map((balance) => (
                    <Box key={balance.currency} sx={{ '& + &': { mt: 1.5 } }}>
                      <Stack direction="row" spacing={0.75} alignItems="baseline" useFlexGap flexWrap="wrap">
                        <Typography sx={{ fontSize: '1.65rem', lineHeight: 1.3, fontWeight: 700, overflowWrap: 'anywhere' }}>
                          {formatAccountMoney(balance.available, balance.currency)}
                        </Typography>
                        <Typography variant="body2" color="text.secondary">Available</Typography>
                      </Stack>
                      <Typography variant="body2" sx={{ mt: 0.5 }}>
                        {formatAccountMoney(balance.pending, balance.currency)} <Box component="span" sx={{ color: 'text.secondary' }}>Pending</Box>
                      </Typography>
                    </Box>
                  )) : (
                    <Typography variant="body2" color="text.secondary">{account.balanceError ? 'Balance unavailable' : 'No balance reported'}</Typography>
                  )}
                  <Typography variant="caption" color="text.secondary" display="block" sx={{ mt: 1 }}>Stripe funds · not your bank balance</Typography>
                  {account.balanceError && <Button size="small" onClick={() => accounts.mutate()} sx={{ mt: 0.5 }}>Retry balance</Button>}
                </Box>
              ))}
              {ready && accounts.data?.length === 0 && <Box sx={surfaceSx}>
                <Typography variant="h6" component="h3" sx={{ fontWeight: 700, mb: 0.75 }}>Set up online payments</Typography>
                <Typography variant="body2" color="text.secondary">
                  Connect your Stripe account or finish setup to receive rent payments online.
                </Typography>
                <Button component={RouterLink} to="/landlord/online-payments" variant="contained" fullWidth sx={{ mt: 2 }}>
                  Set up payments
                </Button>
              </Box>}
            </Stack>
          </LoadState>
        </Collapse>
      </Box>
      <Box component="section" aria-labelledby="owner-recent-activity-heading">
        <Stack direction="row" justifyContent="space-between" alignItems="center" spacing={1} sx={{ mb: 1.5 }}>
          <Typography id="owner-recent-activity-heading" component="h2" variant="h5" fontWeight={700}>Recent activity</Typography>
          <Link component={RouterLink} to="/landlord/activity" underline="hover" sx={{ whiteSpace: 'nowrap', fontSize: '0.8rem', fontWeight: 600 }}>View all</Link>
        </Stack>
        <LoadState loading={organizationLoading || activity.isLoading} error={activity.error} onRetry={() => activity.mutate()}>
          <Box component="ul" sx={{ ...surfaceSx, m: 0, listStyle: 'none', px: 2, py: 0.5 }}>
            {(activity.data || []).map((item, index) => (
              <Box component="li" key={getActivityKey(item, index)} sx={{ display: 'flex', gap: 1.25, py: 1.75, borderTop: index ? '1px solid' : 0, borderColor: 'divider' }}>
                <Box aria-hidden="true" sx={{ color: 'text.secondary', pt: 0.25, flexShrink: 0 }}><HistoryOutlined /></Box>
                <Box sx={{ minWidth: 0 }}>
                  <Link component={RouterLink} to={getActivityDestination(item) || '/landlord/activity'} variant="body2" underline="hover" sx={{ fontWeight: 600, overflowWrap: 'anywhere' }}>{item.title || item.message}</Link>
                  <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 0.5, overflowWrap: 'anywhere' }}>
                    {item.createdAt ? formatRelativeTime(item.createdAt) : ''}
                    {item.performedByName && ` · ${item.performedByName}`}
                  </Typography>
                </Box>
              </Box>
            ))}
            {!activity.data?.length && <Box component="li" sx={{ py: 2 }}><Typography variant="body2" color="text.secondary">No recent activity.</Typography></Box>}
          </Box>
        </LoadState>
      </Box>
    </Stack>
  );
}
