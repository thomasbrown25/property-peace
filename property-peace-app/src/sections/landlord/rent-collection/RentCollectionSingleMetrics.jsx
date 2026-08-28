import { Grid, Stack, Typography, Box, useTheme, alpha } from '@mui/material';
import { DollarOutlined, AlertOutlined, CheckCircleOutlined, ClockCircleOutlined } from '@ant-design/icons';
import MainCard from 'components/MainCard';
import { formatCurrency } from 'utils/formatters';
import { normalizeRentBalance } from 'utils/rentBalance';

const MetricCard = ({ icon, label, value, color, subtitle }) => {
  const theme = useTheme();
  const IconComponent = icon;

  return (
    <MainCard
      sx={{
        bgcolor: (t) => alpha(t.palette.background.paper, 0.8),
        boxShadow: (t) => `0 4px 20px ${alpha(color, 0.2)}`,
        border: `1px solid ${alpha(color, 0.1)}`,
        transition: 'all 0.3s ease',
        position: 'relative',
        overflow: 'hidden',
        '&:hover': {
          transform: 'translateY(-4px)',
          boxShadow: (t) => `0 8px 30px ${alpha(color, 0.3)}`,
          '&::before': {
            opacity: 1
          }
        },
        '&::before': {
          content: '""',
          position: 'absolute',
          top: 0,
          left: 0,
          right: 0,
          height: '4px',
          background: `linear-gradient(90deg, ${color}, ${alpha(color, 0.5)})`,
          opacity: 0.5,
          transition: 'opacity 0.3s ease'
        }
      }}
    >
      <Box sx={{ p: 3 }}>
        <Stack spacing={2}>
          <Stack direction="row" justifyContent="space-between" alignItems="flex-start">
            <Box
              sx={{
                width: 56,
                height: 56,
                borderRadius: 2,
                bgcolor: alpha(color, 0.1),
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center'
              }}
            >
              <IconComponent style={{ fontSize: 28, color: color }} />
            </Box>
          </Stack>
          <Box>
            <Typography variant="body2" color="text.secondary" sx={{ mb: 0.5, fontWeight: 'bold', fontFamily: "'Host Grotesk', sans-serif" }}>
              {label}
            </Typography>
            <Typography variant="h4" sx={{ fontWeight: 'bold', color: color, mb: 0.5, fontFamily: "'Host Grotesk', sans-serif" }}>
              {value}
            </Typography>
            {subtitle && (
              <Typography variant="caption" color="text.secondary">
                {subtitle}
              </Typography>
            )}
          </Box>
        </Stack>
      </Box>
    </MainCard>
  );
};

export default function RentCollectionSingleMetrics({ rent, collectedLifetime, outstanding }) {
  const theme = useTheme();
  const { overdueAmount } = normalizeRentBalance(rent);

  return (
    <Grid container spacing={3}>
      <Grid size={{ xs: 12, sm: 6, md: 3 }}>
        <MetricCard
          icon={DollarOutlined}
          label="Monthly Rent"
          value={formatCurrency(rent?.rentAmount || 0)}
          color={theme.palette.primary.main}
          subtitle="Rent amount"
        />
      </Grid>
      <Grid size={{ xs: 12, sm: 6, md: 3 }}>
        <MetricCard
          icon={AlertOutlined}
          label="Overdue"
          value={formatCurrency(overdueAmount)}
          color={theme.palette.error.main}
          subtitle="Requires attention"
        />
      </Grid>
      <Grid size={{ xs: 12, sm: 6, md: 3 }}>
        <MetricCard
          icon={CheckCircleOutlined}
          label="Collected (Lifetime)"
          value={formatCurrency(collectedLifetime || 0)}
          color={theme.palette.success.main}
          subtitle="All-time total"
        />
      </Grid>
      <Grid size={{ xs: 12, sm: 6, md: 3 }}>
        <MetricCard
          icon={ClockCircleOutlined}
          label="Outstanding"
          value={formatCurrency(outstanding || 0)}
          color={theme.palette.warning.main}
          subtitle="Total to collect"
        />
      </Grid>
    </Grid>
  );
}

