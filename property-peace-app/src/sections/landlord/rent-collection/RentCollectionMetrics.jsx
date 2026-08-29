import { Grid, Stack, Typography, Box, CardContent, useTheme, alpha, useMediaQuery } from '@mui/material';
import { DollarOutlined, AlertOutlined, CheckCircleOutlined, ClockCircleOutlined } from '@ant-design/icons';
import MainCard from 'components/MainCard';
import { formatCurrency } from 'utils/formatters';

const MetricCard = ({ icon, label, value, color, subtitle }) => {
  const theme = useTheme();
  const isXs = useMediaQuery(theme.breakpoints.down('sm'));
  const IconComponent = icon;

  return (
    <MainCard
      sx={{
        bgcolor: 'background.paper',
        boxShadow: `0 2px 8px ${alpha(theme.palette.common.black, 0.08)}`,
        border: `1px solid ${alpha(color, 0.2)}`,
        borderLeft: `4px solid ${color}`,
        borderRadius: 2,
        transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
        '&:hover': {
          transform: 'translateY(-4px)',
          boxShadow: `0 8px 24px ${alpha(theme.palette.common.black, 0.12)}`,
          borderLeftWidth: '6px',
          '& .metric-icon': {
            transform: 'scale(1.1)',
            color: color
          }
        }
      }}
    >
      <CardContent sx={{ p: 1.5, '&:last-child': { pb: 1.5 } }}>
        {isXs ? (
          // Mobile layout: icon -> title -> value on one line, subtitle below
          <Stack spacing={0.75}>
            <Stack direction="row" alignItems="center" spacing={1} flexWrap="wrap">
              <Box
                className="metric-icon"
                sx={{
                  width: 28,
                  height: 28,
                  borderRadius: 1.5,
                  bgcolor: alpha(color, 0.1),
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  transition: 'all 0.3s ease',
                  flexShrink: 0
                }}
              >
                <IconComponent style={{ fontSize: 16, color: color }} />
              </Box>
              <Typography
                variant="subtitle2"
                color="text.secondary"
                sx={{
                  fontSize: '0.7rem',
                  fontWeight: 'bold',
                  textTransform: 'uppercase',
                  letterSpacing: '0.5px',
                  flexShrink: 0,
                  fontFamily: "'Poppins', sans-serif"
                }}
              >
                {label}
              </Typography>
              <Typography
                variant="h5"
                sx={{
                  fontWeight: 'bold',
                  color: color,
                  lineHeight: 1.2,
                  fontSize: '1.25rem',
                  ml: 'auto',
                  fontFamily: "'Poppins', sans-serif"
                }}
              >
                {value}
              </Typography>
            </Stack>
            {subtitle && (
              <Typography
                variant="body2"
                sx={{
                  color: 'text.secondary',
                  fontSize: '0.7rem',
                  fontWeight: 400,
                  pl: 0.5
                }}
              >
                {subtitle}
              </Typography>
            )}
          </Stack>
        ) : (
          // Desktop layout: vertical stack
          <Stack spacing={1}>
            <Stack direction="row" justifyContent="space-between" alignItems="flex-start">
              <Box
                className="metric-icon"
                sx={{
                  width: 36,
                  height: 36,
                  borderRadius: 2,
                  bgcolor: alpha(color, 0.1),
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  transition: 'all 0.3s ease'
                }}
              >
                <IconComponent style={{ fontSize: 20, color: color }} />
              </Box>
            </Stack>
            <Box>
              <Typography
                variant="subtitle2"
                color="text.secondary"
                sx={{
                  fontSize: '0.7rem',
                  fontWeight: 'bold',
                  textTransform: 'uppercase',
                  letterSpacing: '0.5px',
                  mb: 0.25,
                  fontFamily: "'Poppins', sans-serif"
                }}
              >
                {label}
              </Typography>
              <Typography
                variant="h5"
                sx={{
                  fontWeight: 'bold',
                  color: color,
                  lineHeight: 1.2,
                  mb: 0.5,
                  fontSize: '1.25rem',
                  fontFamily: "'Poppins', sans-serif"
                }}
              >
                {value}
              </Typography>
              {subtitle && (
                <Box
                  sx={{
                    pt: 0.75,
                    borderTop: `1px solid ${alpha(theme.palette.divider, 0.1)}`
                  }}
                >
                  <Typography
                    variant="body2"
                    sx={{
                      color: 'text.secondary',
                      fontSize: '0.7rem',
                      fontWeight: 400
                    }}
                  >
                    {subtitle}
                  </Typography>
                </Box>
              )}
            </Box>
          </Stack>
        )}
      </CardContent>
    </MainCard>
  );
};

export default function RentCollectionMetrics({ summary }) {
  const theme = useTheme();

  return (
    <Grid container spacing={3} sx={{ mt: 1 }}>
      <Grid size={{ xs: 12, sm: 6, md: 3 }}>
        <MetricCard
          icon={DollarOutlined}
          label="Total Monthly Rent"
          value={formatCurrency(summary?.totalMonthlyRent || 0)}
          color={theme.palette.primary.main}
          subtitle="Expected this month"
        />
      </Grid>
      <Grid size={{ xs: 12, sm: 6, md: 3 }}>
        <MetricCard
          icon={AlertOutlined}
          label="Overdue"
          value={formatCurrency(summary?.overdue || 0)}
          color={theme.palette.error.main}
          subtitle="Requires attention"
        />
      </Grid>
      <Grid size={{ xs: 12, sm: 6, md: 3 }}>
        <MetricCard
          icon={CheckCircleOutlined}
          label="Tenant Payments Collected"
          value={formatCurrency(summary?.collectedLifetime || 0)}
          color={theme.palette.success.main}
          subtitle="Recorded tenant payments (lifetime)"
        />
      </Grid>
      <Grid size={{ xs: 12, sm: 6, md: 3 }}>
        <MetricCard
          icon={ClockCircleOutlined}
          label="Outstanding"
          value={formatCurrency(summary?.outstanding || 0)}
          color={theme.palette.warning.main}
          subtitle="Total to collect"
        />
      </Grid>
    </Grid>
  );
}

