import { Box, Button, CircularProgress, Stack, Typography } from '@mui/material';
import { Link as RouterLink } from 'react-router-dom';
import { format } from 'date-fns';
import { ArrowRightOutlined } from '@ant-design/icons';
import { getOwnerNextStep, getOwnerProperties } from 'utils/ownerHome';

export default function OwnerTodayHome({ reminders = [], properties = [], propertiesLoading = false, propertiesError = false }) {
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
          <Stack divider={<Box sx={{ borderTop: '1px solid', borderColor: 'divider' }} />}>
            {places.slice(0, 4).map((property) => (
              <Stack key={property.id} direction="row" alignItems="center" justifyContent="space-between" gap={1} sx={{ py: 1.5, minWidth: 0 }}>
                <Button component={RouterLink} to={property.href} endIcon={<ArrowRightOutlined />} sx={{ minWidth: 0, justifyContent: 'flex-start', textTransform: 'none', fontWeight: 700, textAlign: 'left', overflowWrap: 'anywhere' }}>{property.name}</Button>
                {property.shortStayHref && <Button component={RouterLink} to={property.shortStayHref} size="small" sx={{ flexShrink: 0, textTransform: 'none' }}>Short-stay setup</Button>}
              </Stack>
            ))}
          </Stack>
        ) : <Typography color="text.secondary">No properties yet. Add one to start organizing your portfolio.</Typography>}
      </Box>
    </Box>
  );
}
