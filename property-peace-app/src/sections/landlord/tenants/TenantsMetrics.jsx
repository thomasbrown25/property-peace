import { Grid, Typography, Box } from '@mui/material';
import { useMemo } from 'react';

const MetricCard = ({ label, value, onClick, isActive }) => (
  <Box
    onClick={onClick}
    sx={(theme) => {
      const isDark = theme.palette.mode === 'dark';

      return {
        flex: '1 1 160px',
        border: '1px solid',
        borderColor: isActive ? 'primary.main' : isDark ? 'rgba(148, 163, 184, 0.18)' : 'rgba(0,0,0,0.15)',
        borderRadius: 2,
        p: 2,
        bgcolor: isActive ? (isDark ? 'rgba(59, 130, 246, 0.12)' : 'primary.lighter') : 'background.paper',
        backgroundImage: isDark ? 'linear-gradient(180deg, rgba(30, 41, 59, 0.78) 0%, rgba(15, 23, 42, 0.9) 100%)' : 'none',
        boxShadow: isDark ? 'inset 0 1px 0 rgba(255,255,255,0.04)' : 'none',
        cursor: 'pointer',
        transition: 'border-color 0.15s ease, background-color 0.15s ease, box-shadow 0.15s ease, transform 0.15s ease',
        '&:hover': {
          borderColor: isDark ? 'rgba(96, 165, 250, 0.65)' : 'primary.main',
          transform: 'translateY(-1px)',
          boxShadow: isDark ? '0 18px 40px rgba(2, 8, 23, 0.34), inset 0 1px 0 rgba(255,255,255,0.07)' : 'none'
        }
      };
    }}
  >
    <Typography
      variant="caption"
      fontWeight={700}
      sx={{
        color: 'text.secondary',
        textTransform: 'uppercase',
        letterSpacing: 0.7,
        display: 'block',
        mb: 0.5
      }}
    >
      {label}
    </Typography>
    <Typography
      variant="h4"
      fontWeight={800}
      sx={{ color: 'text.primary' }}
    >
      {value}
    </Typography>
  </Box>
);

export default function TenantsMetrics({ tenants = [], tenantInvites = {}, activeFilter, onFilterChange }) {
  const metrics = useMemo(() => {
    const totalTenants = tenants.length;
    const withAccounts = tenants.filter((t) => t.userId || t.UserId).length;
    const withoutAccounts = totalTenants - withAccounts;
    const pendingInvites = tenants.filter((t) => !(t.userId || t.UserId) && tenantInvites[t.id]).length;
    return { totalTenants, withAccounts, withoutAccounts, pendingInvites };
  }, [tenants, tenantInvites]);

  const handleClick = (filter) => {
    onFilterChange(activeFilter === filter ? null : filter);
  };

  return (
    <Grid container spacing={2} sx={{ mb: 3 }}>
      <Grid size={{ xs: 12, sm: 6, md: 3 }} sx={{ display: 'flex' }}>
        <MetricCard label="TOTAL TENANTS" value={metrics.totalTenants} onClick={() => handleClick('all')} isActive={activeFilter === 'all'} />
      </Grid>
      <Grid size={{ xs: 12, sm: 6, md: 3 }} sx={{ display: 'flex' }}>
        <MetricCard label="WITH ACCOUNTS" value={metrics.withAccounts} onClick={() => handleClick('withAccounts')} isActive={activeFilter === 'withAccounts'} />
      </Grid>
      <Grid size={{ xs: 12, sm: 6, md: 3 }} sx={{ display: 'flex' }}>
        <MetricCard label="WITHOUT ACCOUNTS" value={metrics.withoutAccounts} onClick={() => handleClick('withoutAccounts')} isActive={activeFilter === 'withoutAccounts'} />
      </Grid>
      <Grid size={{ xs: 12, sm: 6, md: 3 }} sx={{ display: 'flex' }}>
        <MetricCard label="PENDING INVITES" value={metrics.pendingInvites} onClick={() => handleClick('pendingInvites')} isActive={activeFilter === 'pendingInvites'} />
      </Grid>
    </Grid>
  );
}
