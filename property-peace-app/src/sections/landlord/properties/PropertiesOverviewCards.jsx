import { Grid, Stack, Typography, Box, Card, CardContent, alpha, useTheme } from '@mui/material';
import { HomeOutlined, AlertOutlined, TeamOutlined, AppstoreOutlined } from '@ant-design/icons';
import { useMemo } from 'react';

const MetricCard = ({ icon: IconComponent, label, value, iconColor, onClick, isActive }) => {
  const theme = useTheme();
  const isDark = theme.palette.mode === 'dark';
  return (
    <Card
      variant="outlined"
      onClick={onClick}
      sx={{
        position: 'relative',
        overflow: 'hidden',
        bgcolor: isActive ? alpha(iconColor, isDark ? 0.14 : 0.08) : 'background.paper',
        boxShadow: isDark
          ? `0 16px 40px ${alpha(theme.palette.common.black, 0.24)}, 0 0 0 1px ${alpha(iconColor, isActive ? 0.28 : 0.16)}, 0 0 26px ${alpha(iconColor, isActive ? 0.18 : 0.1)}`
          : `0 4px 18px ${alpha(iconColor, 0.08)}`,
        border: `1px solid ${isDark ? alpha(iconColor, isActive ? 0.42 : 0.28) : alpha(iconColor, isActive ? 0.42 : 0.16)}`,
        cursor: 'pointer',
        transition: 'all 0.15s ease',
        '&::before': {
          content: '""',
          position: 'absolute',
          top: 0,
          left: 0,
          right: 0,
          height: 2,
          background: `linear-gradient(90deg, ${alpha(iconColor, 0.9)} 0%, ${alpha(iconColor, 0.34)} 44%, transparent 100%)`,
          pointerEvents: 'none'
        },
        '&:hover': {
          borderColor: alpha(iconColor, isDark ? 0.5 : 0.32),
          boxShadow: isDark
            ? `0 18px 46px ${alpha(theme.palette.common.black, 0.28)}, 0 0 0 1px ${alpha(iconColor, 0.26)}, 0 0 32px ${alpha(iconColor, 0.18)}`
            : `0 8px 24px ${alpha(iconColor, 0.12)}`
        }
      }}
    >
      <CardContent>
        <Stack direction="row" spacing={1} alignItems="center">
          <IconComponent style={{ fontSize: 24, color: isActive ? theme.palette.primary.main : iconColor }} />
          <Box>
            <Typography variant="body2" color="text.secondary" sx={{ fontFamily: "'Host Grotesk', sans-serif", fontWeight: 'bold' }}>
              {label}
            </Typography>
            <Typography variant="h5" sx={{ fontFamily: "'Host Grotesk', sans-serif", fontWeight: 'bold' }}>
              {value}
            </Typography>
          </Box>
        </Stack>
      </CardContent>
    </Card>
  );
};

export default function PropertiesOverviewCards({ properties = [], activeFilter, onFilterChange }) {
  const metrics = useMemo(() => {
    const total = properties.length;
    const occupied = properties.filter((p) => p.isOccupied).length;
    const vacant = total - occupied;
    const totalUnits = properties.reduce((sum, p) => sum + (p.units?.length || 0), 0);
    return { total, occupied, vacant, totalUnits };
  }, [properties]);

  const handleClick = (key) => {
    onFilterChange(activeFilter === key ? null : key);
  };

  return (
    <Grid container spacing={2} sx={{ mb: 3 }}>
      <Grid size={{ xs: 12, sm: 6, md: 3 }}>
        <MetricCard icon={HomeOutlined} label="Total Properties" value={metrics.total} iconColor="#1877F2"
          onClick={() => handleClick('all')} isActive={activeFilter === 'all'} />
      </Grid>
      <Grid size={{ xs: 12, sm: 6, md: 3 }}>
        <MetricCard icon={AlertOutlined} label="Vacant" value={metrics.vacant} iconColor="#ed6c02"
          onClick={() => handleClick('vacant')} isActive={activeFilter === 'vacant'} />
      </Grid>
      <Grid size={{ xs: 12, sm: 6, md: 3 }}>
        <MetricCard icon={TeamOutlined} label="Occupied" value={metrics.occupied} iconColor="#2e7d32"
          onClick={() => handleClick('occupied')} isActive={activeFilter === 'occupied'} />
      </Grid>
      <Grid size={{ xs: 12, sm: 6, md: 3 }}>
        <MetricCard icon={AppstoreOutlined} label="Total Units" value={metrics.totalUnits} iconColor="#0288d1"
          onClick={() => handleClick('units')} isActive={activeFilter === 'units'} />
      </Grid>
    </Grid>
  );
}
