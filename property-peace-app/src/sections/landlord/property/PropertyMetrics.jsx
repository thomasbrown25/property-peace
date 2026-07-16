import { Grid, Stack, Typography, Box, CardContent, useTheme, alpha, useMediaQuery } from '@mui/material';
import { DollarOutlined, ToolOutlined, HomeOutlined } from '@ant-design/icons';
import { parseDecimalToCurrency } from 'utils/formatters';
import { useNavigate } from 'react-router-dom';
import MainCard from 'components/MainCard';
import { propertyAccentCardSx } from './propertyAccentSx';

const MetricCard = ({ icon, label, value, color, subtitle, onClick }) => {
  const theme = useTheme();
  const isXs = useMediaQuery(theme.breakpoints.down('sm'));
  const IconComponent = icon;

  return (
    <MainCard
      content={false}
      sx={propertyAccentCardSx(color, {
        bgcolor: 'background.paper',
        borderLeft: `4px solid ${color}`,
        borderRadius: 2,
        transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
        cursor: onClick ? 'pointer' : 'default',
        '&:hover': {
          transform: 'translateY(-4px)',
          boxShadow: `0 8px 24px ${alpha(theme.palette.common.black, 0.12)}`,
          borderLeftWidth: '6px',
          '& .metric-icon': {
            transform: 'scale(1.1)',
            color: color
          }
        }
      })}
    >
      <Box onClick={onClick} sx={{ width: '100%', height: '100%' }}>
        <CardContent 
          sx={{ 
            p: 1.5, 
            '&:last-child': { pb: 1.5 }
          }}
        >
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
      </Box>
    </MainCard>
  );
};

export default function PropertyMetrics({ property, rentRecords, maintenances }) {
  const theme = useTheme();
  const navigate = useNavigate();

  // Calculate metrics
  const rentDue = rentRecords?.[0]?.rentAmount ? parseDecimalToCurrency(rentRecords[0].rentAmount) : '$0';
  const openRequests = maintenances?.filter((req) => req.status?.toLowerCase() === 'open').length || 0;
  const totalUnits = property?.units?.length || 0;
  const occupiedUnits = property?.units?.filter((unit) => unit.isOccupied).length || 0;
  const occupancyRate = totalUnits > 0 ? Math.round((occupiedUnits / totalUnits) * 100) : 0;

  const handleRentDueClick = (e) => {
    e.preventDefault();
    e.stopPropagation();
    
    if (!property?.id) return;

    console.log('PropertyMetrics: Rent Due clicked', { propertyId: property.id, propertyType: property?.propertyType, totalUnits });

    // For single unit properties (single family homes), try to navigate to specific lease rent collection
    const isSingleUnit = property?.propertyType?.toLowerCase() === 'singlefamily' || totalUnits === 1;
    
    if (isSingleUnit) {
      // Check if there's a lease in the first unit
      const unit = property?.units?.[0];
      const leaseId = unit?.lease?.id || unit?.leaseId || rentRecords?.[0]?.leaseId;
      
      if (leaseId) {
        navigate(`/landlord/leases/${leaseId}`);
        return;
      }
    }

    navigate(`/landlord/leases`);
  };

  const handleOpenRequestsClick = (e) => {
    e.preventDefault();
    e.stopPropagation();
    
    if (!property?.id) return;

    console.log('PropertyMetrics: Open Requests clicked', { propertyId: property.id });
    // Navigate to maintenances page with property filter
    navigate(`/landlord/maintenances?propertyId=${property.id}`);
  };

  return (
    <Grid container spacing={3}>
      <Grid size={{ xs: 12, sm: 6, md: 4 }}>
        <MetricCard
          icon={DollarOutlined}
          label="Rent Due"
          value={rentDue}
          color={theme.palette.warning.main}
          subtitle="This month's rent"
          onClick={handleRentDueClick}
        />
      </Grid>
      <Grid size={{ xs: 12, sm: 6, md: 4 }}>
        <MetricCard
          icon={ToolOutlined}
          label="Open Requests"
          value={openRequests}
          color={theme.palette.info.main}
          subtitle={openRequests === 1 ? 'Maintenance request' : 'Maintenance requests'}
          onClick={handleOpenRequestsClick}
        />
      </Grid>
      <Grid size={{ xs: 12, sm: 6, md: 4 }}>
        <MetricCard
          icon={HomeOutlined}
          label="Occupancy"
          value={`${occupancyRate}%`}
          color={theme.palette.success.main}
          subtitle={`${occupiedUnits} of ${totalUnits} ${totalUnits === 1 ? 'unit' : 'units'}`}
        />
      </Grid>
    </Grid>
  );
}

