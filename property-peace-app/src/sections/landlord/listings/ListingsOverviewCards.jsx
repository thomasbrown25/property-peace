import { Grid, Typography, Box, alpha } from '@mui/material';
import { useMemo } from 'react';

function statusLabel(status) {
  if (typeof status === 'string') return status;
  const map = { 0: 'Draft', 1: 'Active', 2: 'Expired', 3: 'Unlisted' };
  return map[status] ?? 'Draft';
}

const MetricCard = ({ label, value, onClick, isActive }) => (
  <Box
    onClick={onClick}
    sx={{
      flex: '1 1 160px',
      position: 'relative',
      overflow: 'hidden',
      borderRadius: 2,
      border: (theme) => `1px solid ${isActive ? theme.palette.primary.main : alpha(theme.palette.divider, 0.12)}`,
      boxShadow: (theme) => `0 8px 24px ${alpha(theme.palette.common.black, 0.06)}`,
      p: 1.75,
      bgcolor: (theme) => (isActive && theme.palette.mode !== 'dark' ? 'primary.lighter' : 'background.paper'),
      cursor: 'pointer',
      transition: 'border-color 0.15s ease, background-color 0.15s ease, box-shadow 0.15s ease',
      '&::before': (theme) => ({
        content: '""',
        position: 'absolute',
        inset: '0 0 auto 0',
        height: 2,
        pointerEvents: 'none',
        background: `linear-gradient(90deg, ${theme.palette.primary.main} 0%, ${alpha(theme.palette.primary.main, 0.34)} 42%, transparent 100%)`,
        opacity: theme.palette.mode === 'dark' ? 0.9 : 0
      }),
      '&:hover': {
        borderColor: 'primary.main'
      }
    }}
  >
    <Typography
      variant="caption"
      color="text.secondary"
      fontWeight={800}
      sx={{ textTransform: 'uppercase', letterSpacing: 1.1, fontSize: '0.68rem', display: 'block', mb: 0.5 }}
    >
      {label}
    </Typography>
    <Typography variant="h4" fontWeight={800} sx={{ lineHeight: 1.05 }}>
      {value}
    </Typography>
  </Box>
);

export default function ListingsOverviewCards({ listings = [], activeFilter, onFilterChange }) {
  const metrics = useMemo(() => {
    const total = listings.length;
    const published = listings.filter((l) => {
      const s = String(statusLabel(l.status)).toLowerCase();
      return s === 'active' || s === 'published';
    }).length;
    const draft = listings.filter((l) => String(statusLabel(l.status)).toLowerCase() === 'draft').length;
    const unlisted = listings.filter((l) => String(statusLabel(l.status)).toLowerCase() === 'unlisted').length;
    return { totalListings: total, publishedListings: published, draftListings: draft, unlisted };
  }, [listings]);

  const handleClick = (key) => {
    onFilterChange(activeFilter === key ? null : key);
  };

  return (
    <Grid container spacing={2} sx={{ mb: 3 }}>
      <Grid size={{ xs: 12, sm: 6, md: 3 }} sx={{ display: 'flex' }}>
        <MetricCard label="TOTAL LISTINGS" value={metrics.totalListings}
          onClick={() => handleClick('all')} isActive={activeFilter === 'all'} />
      </Grid>
      <Grid size={{ xs: 12, sm: 6, md: 3 }} sx={{ display: 'flex' }}>
        <MetricCard label="PUBLISHED" value={metrics.publishedListings}
          onClick={() => handleClick('published')} isActive={activeFilter === 'published'} />
      </Grid>
      <Grid size={{ xs: 12, sm: 6, md: 3 }} sx={{ display: 'flex' }}>
        <MetricCard label="DRAFT" value={metrics.draftListings}
          onClick={() => handleClick('draft')} isActive={activeFilter === 'draft'} />
      </Grid>
      <Grid size={{ xs: 12, sm: 6, md: 3 }} sx={{ display: 'flex' }}>
        <MetricCard label="UNLISTED" value={metrics.unlisted}
          onClick={() => handleClick('unlisted')} isActive={activeFilter === 'unlisted'} />
      </Grid>
    </Grid>
  );
}
