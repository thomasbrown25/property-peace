import { Grid, Stack, Typography, Box, Card, CardContent, alpha, useTheme } from '@mui/material';
import { DollarOutlined, AlertOutlined, ClockCircleOutlined, HomeOutlined } from '@ant-design/icons';
import { formatCurrency } from 'utils/formatters';

const MetricCard = ({ icon: IconComponent, label, value, iconColor, onClick, isActive }) => {
  const theme = useTheme();
  return (
    <Card
      variant="outlined"
      onClick={onClick}
      sx={{
        bgcolor: (t) => isActive ? alpha(t.palette.primary.main, 0.07) : alpha(t.palette.background.paper, 0.6),
        boxShadow: (t) => `0 0 20px ${alpha(t.palette.primary.main, 0.15)}`,
        border: (t) => isActive ? `2px solid ${t.palette.primary.main}` : undefined,
        cursor: 'pointer',
        transition: 'all 0.15s ease',
        '&:hover': {
          boxShadow: (t) => `0 0 24px ${alpha(t.palette.primary.main, 0.25)}`
        }
      }}
    >
      <CardContent>
        <Stack direction="row" spacing={1} alignItems="center">
          <IconComponent style={{ fontSize: 24, color: isActive ? theme.palette.primary.main : iconColor }} />
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

export default function LeasesMetrics({ leases, rentSummary, activeMetricFilter, onMetricFilterChange }) {
  const availableUnits = leases?.filter((l) => !l.hasLease).length || 0;

  const handleClick = (key) => {
    onMetricFilterChange(activeMetricFilter === key ? null : key);
  };

  return (
    <Grid container spacing={2} sx={{ mb: 3 }}>
      <Grid size={{ xs: 12, sm: 6, md: 3 }}>
        <MetricCard
          icon={DollarOutlined}
          label="Total Monthly Rent"
          value={formatCurrency(rentSummary?.totalMonthlyRent || 0)}
          iconColor="#1877F2"
          onClick={() => handleClick('all')}
          isActive={activeMetricFilter === 'all'}
        />
      </Grid>
      <Grid size={{ xs: 12, sm: 6, md: 3 }}>
        <MetricCard
          icon={AlertOutlined}
          label="Overdue"
          value={formatCurrency(rentSummary?.overdue || 0)}
          iconColor="#d32f2f"
          onClick={() => handleClick('overdue')}
          isActive={activeMetricFilter === 'overdue'}
        />
      </Grid>
      <Grid size={{ xs: 12, sm: 6, md: 3 }}>
        <MetricCard
          icon={ClockCircleOutlined}
          label="Outstanding"
          value={formatCurrency(rentSummary?.outstanding || 0)}
          iconColor="#ed6c02"
          onClick={() => handleClick('outstanding')}
          isActive={activeMetricFilter === 'outstanding'}
        />
      </Grid>
      <Grid size={{ xs: 12, sm: 6, md: 3 }}>
        <MetricCard
          icon={HomeOutlined}
          label="Available Units"
          value={availableUnits}
          iconColor="#2e7d32"
          onClick={() => handleClick('available')}
          isActive={activeMetricFilter === 'available'}
        />
      </Grid>
    </Grid>
  );
}
