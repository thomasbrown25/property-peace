import { Grid, Stack, Typography, Box, Card, CardContent, alpha } from '@mui/material';
import { HomeOutlined, CheckCircleOutlined, CloseCircleOutlined, ClockCircleOutlined } from '@ant-design/icons';
import { useMemo } from 'react';
import { calculateOccupancyPercentage } from 'utils/helper-methods';

const MetricCard = ({ icon: IconComponent, label, value, iconColor }) => {
  return (
    <Card
      variant="outlined"
      sx={{
        bgcolor: (t) => alpha(t.palette.background.paper, 0.6),
        boxShadow: (t) => `0 0 20px ${alpha(t.palette.primary.main, 0.15)}`
      }}
    >
      <CardContent>
        <Stack direction="row" spacing={1} alignItems="center">
          <IconComponent style={{ fontSize: 24, color: iconColor }} />
          <Box>
            <Typography variant="body2" color="text.secondary" sx={{ fontFamily: "'Poppins', sans-serif", fontWeight: 'bold' }}>
              {label}
            </Typography>
            <Typography variant="h5" sx={{ fontFamily: "'Poppins', sans-serif", fontWeight: 'bold' }}>
              {value}
            </Typography>
          </Box>
        </Stack>
      </CardContent>
    </Card>
  );
};

export default function UnitsOverviewCards({ properties = [] }) {
  const metrics = useMemo(() => {
    // Get all units from all properties
    const allUnits = properties.flatMap((p) => p.units || []);
    const totalUnits = allUnits.length;
    
    // Count units by status
    const occupiedUnits = allUnits.filter((u) => u.isOccupied || u.tenantId).length;
    const vacantUnits = allUnits.filter((u) => !u.isOccupied && !u.tenantId).length;
    
    // Calculate average occupancy
    const propertiesWithUnits = properties.filter((p) => p.units && p.units.length > 0);
    const totalOccupancy = propertiesWithUnits.reduce((sum, p) => {
      return sum + calculateOccupancyPercentage(p.units || []);
    }, 0);
    const avgOccupancy = propertiesWithUnits.length > 0 
      ? Math.round(totalOccupancy / propertiesWithUnits.length) 
      : 0;

    return {
      totalUnits,
      occupiedUnits,
      vacantUnits,
      avgOccupancy
    };
  }, [properties]);

  return (
    <Grid container spacing={2} sx={{ mb: 3 }}>
      <Grid size={{ xs: 12, sm: 6, md: 3 }}>
        <MetricCard
          icon={HomeOutlined}
          label="Total Units"
          value={metrics.totalUnits}
          iconColor="#1877F2"
        />
      </Grid>
      <Grid size={{ xs: 12, sm: 6, md: 3 }}>
        <MetricCard
          icon={CheckCircleOutlined}
          label="Occupied"
          value={metrics.occupiedUnits}
          iconColor="#2e7d32"
        />
      </Grid>
      <Grid size={{ xs: 12, sm: 6, md: 3 }}>
        <MetricCard
          icon={CloseCircleOutlined}
          label="Vacant"
          value={metrics.vacantUnits}
          iconColor="#ed6c02"
        />
      </Grid>
      <Grid size={{ xs: 12, sm: 6, md: 3 }}>
        <MetricCard
          icon={ClockCircleOutlined}
          label="Avg Occupancy"
          value={`${metrics.avgOccupancy}%`}
          iconColor="#0288d1"
        />
      </Grid>
    </Grid>
  );
}
