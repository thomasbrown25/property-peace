import { Grid, Stack, Typography, Box, Card, CardContent, useTheme, alpha, useMediaQuery } from '@mui/material';
import { HomeOutlined, DollarOutlined, ToolOutlined, CheckCircleOutlined } from '@ant-design/icons';
import MainCard from 'components/MainCard';

const MetricCard = ({ icon: IconComponent, label, value, color, subtitle }) => {
  const theme = useTheme();
  const isXs = useMediaQuery(theme.breakpoints.down('sm'));
  return (
    <MainCard
      sx={{
        bgcolor: 'background.paper',
        boxShadow: `0 2px 8px ${alpha(theme.palette.common.black, 0.08)}`,
        border: `1px solid ${alpha(theme.palette[color].main, 0.2)}`,
        borderLeft: `4px solid ${theme.palette[color].main}`,
        borderRadius: 2,
        transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
        '&:hover': {
          transform: 'translateY(-4px)',
          boxShadow: `0 8px 24px ${alpha(theme.palette.common.black, 0.12)}`,
          borderLeftWidth: '6px',
          '& .metric-icon': {
            transform: 'scale(1.1)',
            color: theme.palette[color].main
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
                  bgcolor: alpha(theme.palette[color].main, 0.1),
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  transition: 'all 0.3s ease',
                  flexShrink: 0
                }}
              >
                <IconComponent style={{ fontSize: 16, color: theme.palette[color].main }} />
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
                  fontFamily: "'Host Grotesk', sans-serif"
                }}
              >
                {label}
              </Typography>
              <Typography
                variant="h5"
                sx={{
                  fontWeight: 'bold',
                  color: theme.palette[color].main,
                  lineHeight: 1.2,
                  fontSize: '1.25rem',
                  ml: 'auto',
                  fontFamily: "'Host Grotesk', sans-serif"
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
                  bgcolor: alpha(theme.palette[color].main, 0.1),
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  transition: 'all 0.3s ease'
                }}
              >
                <IconComponent style={{ fontSize: 20, color: theme.palette[color].main }} />
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
                  fontFamily: "'Host Grotesk', sans-serif"
                }}
              >
                {label}
              </Typography>
              <Typography
                variant="h5"
                sx={{
                  fontWeight: 'bold',
                  color: theme.palette[color].main,
                  lineHeight: 1.2,
                  mb: 0.5,
                  fontSize: '1.25rem',
                  fontFamily: "'Host Grotesk', sans-serif"
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

export default function PropertiesMetrics({ properties }) {
  const totalProperties = properties?.length || 0;
  const activeProperties = properties?.filter((p) => p.isActive).length || 0;
  const occupiedProperties = properties?.filter((p) => p.isOccupied).length || 0;
  const totalUnits = properties?.reduce((sum, p) => sum + (p.units?.length || 0), 0) || 0;

  return (
    <Grid container spacing={3} sx={{ mt: 1 }}>
      <Grid size={{ xs: 12, sm: 6, md: 3 }}>
        <MetricCard
          icon={HomeOutlined}
          label="Total Properties"
          value={totalProperties}
          color="primary"
          subtitle="All properties in portfolio"
        />
      </Grid>
      <Grid size={{ xs: 12, sm: 6, md: 3 }}>
        <MetricCard
          icon={CheckCircleOutlined}
          label="Active Properties"
          value={activeProperties}
          color="success"
          subtitle="Currently active"
        />
      </Grid>
      <Grid size={{ xs: 12, sm: 6, md: 3 }}>
        <MetricCard
          icon={HomeOutlined}
          label="Occupied"
          value={occupiedProperties}
          color="info"
          subtitle="Properties with tenants"
        />
      </Grid>
      <Grid size={{ xs: 12, sm: 6, md: 3 }}>
        <MetricCard
          icon={HomeOutlined}
          label="Total Units"
          value={totalUnits}
          color="warning"
          subtitle="All units across properties"
        />
      </Grid>
    </Grid>
  );
}

