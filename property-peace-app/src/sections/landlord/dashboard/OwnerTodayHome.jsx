import { alpha, Box, Button, CircularProgress, LinearProgress, Stack, Typography, useTheme } from '@mui/material';
import { Link as RouterLink } from 'react-router-dom';
import { format } from 'date-fns';
import { ArrowRightOutlined } from '@ant-design/icons';
import placeholderImage from 'assets/images/placeholder-house.png';
import PropertyOperations from 'sections/landlord/properties/PropertyOperations';
import { getOwnerNextStep, getOwnerProperties, getPropertyMonthRent } from 'utils/ownerHome';

const money = (value) => new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 2 }).format(value);
const columns = 'minmax(260px, 1.45fr) minmax(170px, .9fr) minmax(190px, 1fr)';

export default function OwnerTodayHome({ reminders = [], properties = [], propertiesLoading = false, propertiesError = false, rentRecords = [], rentLoading = false, rentError = false, rentReady = false }) {
  const theme = useTheme();
  const next = getOwnerNextStep({ reminders, properties, propertiesLoading, propertiesError });
  const places = getOwnerProperties(properties);

  return (
    <Box sx={{ maxWidth: 1120, mx: 'auto', pb: 2 }}>
      <Box sx={{ py: { xs: 2, md: 3 }, borderBottom: '1px solid', borderColor: 'divider' }}>
        <Typography variant="overline" sx={{ color: 'text.secondary', letterSpacing: '0.12em', fontWeight: 700 }}>
          {format(new Date(), 'EEEE, MMMM d')}
        </Typography>
        <Typography component="h1" sx={{ mt: 0.5, fontFamily: 'Poppins, Public Sans, sans-serif', fontSize: { xs: '2rem', md: '2.7rem' }, fontWeight: 700, lineHeight: 1.15, color: 'text.primary' }}>
          Today
        </Typography>
      </Box>

      <Box component="section" aria-labelledby="owner-next-heading" sx={{ py: { xs: 3, md: 4 }, borderBottom: '1px solid', borderColor: 'divider' }}>
        <Typography id="owner-next-heading" component="h2" variant="h5" sx={{ mb: 1.5, fontWeight: 700 }}>Tasks</Typography>
        {next ? (
          <Box sx={{ display: 'flex', alignItems: { xs: 'flex-start', sm: 'center' }, justifyContent: 'space-between', flexDirection: { xs: 'column', sm: 'row' }, gap: 2, p: { xs: 2, sm: 2.5 }, bgcolor: 'background.paper', border: '1px solid', borderColor: 'divider', borderRadius: 2 }}>
            <Box sx={{ minWidth: 0 }}>
              <Typography variant="caption" color="text.secondary" sx={{ fontWeight: 700 }}>{next.label}</Typography>
              <Typography variant="h5" sx={{ mt: 0.5, overflowWrap: 'anywhere', color: 'text.primary' }}>{next.title}</Typography>
            </Box>
            <Button component={RouterLink} to={next.href} variant="contained" endIcon={<ArrowRightOutlined />} sx={{ flexShrink: 0, textTransform: 'none' }}>Open</Button>
          </Box>
        ) : (
          <Typography color="text.secondary" sx={{ py: 2 }}>
            {propertiesLoading ? 'Loading your properties…' : propertiesError ? 'Properties could not be loaded. Try again later.' : 'Nothing scheduled for today. Review your tasks or properties whenever you’re ready.'}
          </Typography>
        )}
      </Box>

      <Box component="section" aria-labelledby="owner-properties-heading" sx={{ py: { xs: 3, md: 4 }, borderBottom: '1px solid', borderColor: 'divider' }}>
        <Stack direction="row" alignItems="center" justifyContent="space-between" gap={2} sx={{ mb: 1.5 }}>
          <Typography id="owner-properties-heading" component="h2" variant="h5" sx={{ fontWeight: 700 }}>Your properties</Typography>
          <Button component={RouterLink} to="/landlord/properties" size="small" sx={{ textTransform: 'none' }}>View all</Button>
        </Stack>
        {propertiesLoading && !places.length ? <CircularProgress aria-label="Loading properties" size={24} /> : propertiesError && !places.length ? (
          <Typography color="text.secondary">Properties could not be loaded. Try again later.</Typography>
        ) : places.length ? (
          <Box sx={{ bgcolor: 'background.paper', border: '1px solid', borderColor: 'divider', borderRadius: 2, overflow: 'hidden' }}>
            <Box sx={{ display: { xs: 'none', md: 'grid' }, gridTemplateColumns: columns, gap: 2, px: 2, py: 1.15, bgcolor: alpha(theme.palette.primary.main, 0.025) }}>
              {['Property', 'Rent paid', 'Operations'].map((label) => (
                <Typography key={label} sx={{ fontSize: '0.66rem', fontWeight: 750, letterSpacing: 0.65, textTransform: 'uppercase', color: 'text.secondary' }}>{label}</Typography>
              ))}
            </Box>
            {places.slice(0, 4).map((property, index) => {
              const rent = getPropertyMonthRent(property.id, rentRecords, rentError || !rentReady);
              return (
                <Box key={property.id} sx={{ display: 'grid', gridTemplateColumns: { xs: 'minmax(0, 1fr)', md: columns }, alignItems: 'center', gap: { xs: 1.5, md: 2 }, px: 2, py: 1.5, borderTop: index ? '1px solid' : { xs: 0, md: '1px solid' }, borderColor: 'divider' }}>
                  <Stack component={RouterLink} to={property.href} direction="row" spacing={1.4} alignItems="center" sx={{ minWidth: 0, color: 'inherit', textDecoration: 'none', '&:hover .owner-property-name': { textDecoration: 'underline' }, '&:focus-visible': { outline: `2px solid ${theme.palette.primary.main}`, outlineOffset: 2 } }}>
                    <Box component="img" src={property.imageUrl || placeholderImage} alt="" sx={{ width: 58, height: 58, borderRadius: 1.8, objectFit: 'cover', bgcolor: alpha(theme.palette.primary.main, 0.08), flexShrink: 0 }} />
                    <Box sx={{ minWidth: 0 }}>
                      <Typography className="owner-property-name" sx={{ fontWeight: 700, color: 'text.primary', overflowWrap: 'anywhere', lineHeight: 1.3 }}>{property.name}</Typography>
                      <Typography sx={{ mt: 0.3, fontSize: '0.77rem', color: 'text.secondary', overflowWrap: 'anywhere' }}>{property.address || 'Address not added'}</Typography>
                    </Box>
                  </Stack>
                  <Box>
                    <Typography sx={{ display: { xs: 'block', md: 'none' }, mb: 0.5, fontSize: '0.66rem', fontWeight: 750, textTransform: 'uppercase', color: 'text.secondary' }}>Rent paid</Typography>
                    {property.activeLeaseCount === 0 ? <Typography sx={{ fontSize: '0.8rem', color: 'text.secondary' }}>No lease</Typography> : rentLoading && !rentReady ? <Typography sx={{ fontSize: '0.75rem', color: 'text.secondary' }}>Loading rent…</Typography> : rent ? (
                      <>
                        <Stack direction="row" justifyContent="space-between" alignItems="center" spacing={1}>
                          <Typography sx={{ fontSize: '0.8rem', fontWeight: 650 }}>{money(rent.paid)} of {money(rent.expected)}</Typography>
                          <Typography sx={{ fontSize: '0.72rem', color: 'text.secondary' }}>{Math.round(rent.percent)}%</Typography>
                        </Stack>
                        <LinearProgress variant="determinate" value={rent.percent} aria-label={`${property.name} rent paid this month`} sx={{ mt: 0.65, height: 5, borderRadius: 8, bgcolor: rent.paid === 0 ? theme.palette.grey[theme.palette.mode === 'dark' ? 700 : 300] : alpha(theme.palette.divider, 0.3), '& .MuiLinearProgress-bar': { borderRadius: 8, bgcolor: theme.palette.success.main } }} />
                        {rent.expected === 0 && <Typography sx={{ mt: 0.55, fontSize: '0.7rem', color: 'text.secondary' }}>No rent scheduled this month</Typography>}
                      </>
                    ) : <Typography sx={{ fontSize: '0.75rem', color: 'text.secondary' }}>{rentError ? 'Rent data unavailable' : rentReady ? 'No rent scheduled this month' : 'Loading rent…'}</Typography>}
                  </Box>
                  <Box>
                    <Typography sx={{ display: { xs: 'block', md: 'none' }, mb: 0.5, fontSize: '0.66rem', fontWeight: 750, textTransform: 'uppercase', color: 'text.secondary' }}>Operations</Typography>
                    <PropertyOperations property={property.original} />
                  </Box>
                </Box>
              );
            })}
          </Box>
        ) : <Typography color="text.secondary">No properties yet. Add one to start organizing your portfolio.</Typography>}
      </Box>
    </Box>
  );
}
