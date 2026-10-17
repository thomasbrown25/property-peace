import { Box, Button, Divider, Grid, Stack, Typography, useTheme } from '@mui/material';
import { ArrowRightOutlined } from '@ant-design/icons';
import { useNavigate } from 'react-router-dom';
import MainCard from 'components/MainCard';
import { formatCurrency, getPropertyTypeLabel } from 'utils/formatters';
import { getUnitStatusPresentation } from 'utils/unitPresentation';
import { propertyAccentCardSx } from './propertyAccentSx';

const field = (object, lower, upper) => object?.[lower] ?? object?.[upper];

function Detail({ label, value }) {
  return (
    <Stack direction="row" justifyContent="space-between" alignItems="baseline" spacing={2} sx={{ py: 1.25 }}>
      <Typography variant="body2" color="text.secondary">{label}</Typography>
      <Typography variant="body2" fontWeight={600} sx={{ textAlign: 'right' }}>{value}</Typography>
    </Stack>
  );
}

export default function PropertyOverview({ property, propertyId }) {
  const theme = useTheme();
  const navigate = useNavigate();
  const units = field(property, 'units', 'Units') || [];
  const occupied = units.filter((unit) => {
    const status = String(field(unit, 'status', 'Status') || '').toLowerCase();
    return status === 'occupied' || status === 'overdue' || (!status && Boolean(field(unit, 'isOccupied', 'IsOccupied')));
  }).length;
  const vacant = units.filter((unit) => String(field(unit, 'status', 'Status') || '').toLowerCase() === 'vacant').length;
  const monthlyRent = units.reduce((total, unit) => {
    const lease = field(unit, 'lease', 'Lease');
    const status = String(field(unit, 'status', 'Status') || '').toLowerCase();
    if (!lease || !['occupied', 'overdue'].includes(status) || field(lease, 'isDrafted', 'IsDrafted') || field(lease, 'isActive', 'IsActive') === false) return total;
    return total + (Number(field(lease, 'rentAmount', 'RentAmount')) || 0);
  }, 0);
  const firstUnit = units[0];
  const singleUnit = units.length === 1;
  const specs = [
    [field(firstUnit, 'bedrooms', 'Bedrooms'), 'beds'],
    [field(firstUnit, 'baths', 'Baths'), 'baths'],
    [field(firstUnit, 'squareFeet', 'SquareFeet'), 'sq ft']
  ].filter(([value]) => value !== null && value !== undefined && value !== '').map(([value, label]) => `${Number(value).toLocaleString()} ${label}`).join(' · ');
  const type = getPropertyTypeLabel(field(property, 'propertyType', 'PropertyType')) || 'Property';
  const year = field(property, 'yearBuilt', 'YearBuilt');
  const cardSx = propertyAccentCardSx(theme.palette.primary.main);

  return (
    <Grid container spacing={2.5} alignItems="flex-start">
      <Grid size={{ xs: 12, md: units.length > 1 ? 7 : 8 }}>
        <MainCard title="At a glance" sx={cardSx}>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 2.5 }}>
            A quick look at this property. Open a tab for the full details.
          </Typography>
          <Grid container spacing={0} sx={{ mb: 2.5 }}>
            {[
              { label: 'Occupancy', value: units.length ? `${occupied} of ${units.length}` : '—', note: units.length ? 'units occupied' : 'No units added' },
              { label: 'Vacant', value: units.length ? String(vacant) : '—', note: vacant === 1 ? 'unit available' : 'units available' },
              { label: 'Lease rent', value: monthlyRent ? formatCurrency(monthlyRent) : '—', note: 'per month' }
            ].map((stat, index) => (
              <Grid key={stat.label} size={{ xs: 12, sm: 4 }} sx={{ px: { xs: 0, sm: 2 }, py: { xs: 1.25, sm: 0.5 }, borderLeft: { sm: index ? `1px solid ${theme.palette.divider}` : 'none' }, borderTop: { xs: index ? `1px solid ${theme.palette.divider}` : 'none', sm: 'none' } }}>
                <Typography variant="caption" color="text.secondary" fontWeight={700} sx={{ textTransform: 'uppercase', letterSpacing: 0.7 }}>{stat.label}</Typography>
                <Typography variant="h4" fontWeight={700} sx={{ mt: 0.5, color: stat.label === 'Vacant' && vacant > 0 ? 'warning.dark' : 'text.primary' }}>{stat.value}</Typography>
                <Typography variant="caption" color="text.secondary">{stat.note}</Typography>
              </Grid>
            ))}
          </Grid>
          <Divider />
          <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1} sx={{ pt: 2 }}>
            <Button variant="outlined" size="small" endIcon={<ArrowRightOutlined />} onClick={() => navigate(`/landlord/property/${propertyId}?tab=leases`)} sx={{ textTransform: 'none' }}>View leases</Button>
            <Button variant="text" size="small" endIcon={<ArrowRightOutlined />} onClick={() => navigate(`/landlord/property/${propertyId}?tab=payments`)} sx={{ textTransform: 'none' }}>View payments</Button>
          </Stack>
        </MainCard>
      </Grid>

      <Grid size={{ xs: 12, md: units.length > 1 ? 5 : 4 }}>
        <MainCard title={units.length > 1 ? 'Units' : 'Property details'} sx={propertyAccentCardSx(theme.palette.success.main)}>
          {units.length > 1 ? (
            <>
              <Box sx={{ maxHeight: 290, overflowY: 'auto' }}>
                {units.map((unit, index) => {
                  const status = String(field(unit, 'status', 'Status') || '').toLowerCase();
                  const presentation = getUnitStatusPresentation(status);
                  const statusColor = { success: 'success.main', error: 'error.main', warning: 'warning.dark', info: 'info.main', neutral: 'text.secondary' }[presentation.tone];
                  const unitId = field(unit, 'id', 'Id');
                  return (
                    <Box key={unitId ?? index}>
                      {index > 0 && <Divider />}
                      <Stack direction="row" justifyContent="space-between" alignItems="center" spacing={1.5} sx={{ py: 1.5 }}>
                        <Box sx={{ minWidth: 0 }}>
                          <Typography variant="body2" fontWeight={600} noWrap>{field(unit, 'name', 'Name') || `Unit ${index + 1}`}</Typography>
                          <Typography variant="caption" sx={{ color: statusColor }}>{presentation.label}</Typography>
                        </Box>
                        {unitId && <Button size="small" onClick={() => navigate(`/landlord/unit/${unitId}`)} aria-label={`View ${field(unit, 'name', 'Name') || `Unit ${index + 1}`}`} sx={{ minWidth: 0, textTransform: 'none' }}>View</Button>}
                      </Stack>
                    </Box>
                  );
                })}
              </Box>
            </>
          ) : (
            <Box>
              <Detail label="Type" value={type} />
              <Divider />
              <Detail label="Layout" value={singleUnit && specs ? specs : 'Not added yet'} />
              <Divider />
              <Detail label="Year built" value={year || 'Not added yet'} />
            </Box>
          )}
        </MainCard>
      </Grid>
    </Grid>
  );
}
