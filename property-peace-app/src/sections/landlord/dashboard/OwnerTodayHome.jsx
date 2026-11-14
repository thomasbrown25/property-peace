import { useEffect, useState } from 'react';
import { alpha, Box, Button, CircularProgress, LinearProgress, Stack, Typography, useTheme } from '@mui/material';
import useAuth from 'hooks/useAuth';
import { getRecentPropertyStorageKey, PROPERTY_VISITED_EVENT, readPropertyVisitDates, sortPropertiesByLastVisit } from 'utils/recentlyViewedProperties';
import { Link as RouterLink } from 'react-router-dom';
import { format } from 'date-fns';
import { ArrowRightOutlined } from '@ant-design/icons';
import placeholderImage from 'assets/images/placeholder-house.png';
import { getTableStyles } from 'themes/tableStyles';
import PropertyOperations from 'sections/landlord/properties/PropertyOperations';
import OwnerHomeSidebar from './OwnerHomeSidebar';
import { dashboardEntranceDelay, dashboardSlideDownSx } from './dashboardEntrance.mjs';
import { getOwnerNextStep, getOwnerProperties, getPropertyMonthRent, getPropertyOverdueRent } from 'utils/ownerHome';

const money = (value) => new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 2 }).format(value);
const columns = 'minmax(190px, 1.3fr) minmax(140px, 1fr) minmax(110px, .8fr) minmax(150px, 1fr)';

export default function OwnerTodayHome({ reminders = [], properties = [], propertiesLoading = false, propertiesError = false, rentRecords = [], rentLoading = false, rentError = false, rentReady = false }) {
  const theme = useTheme();
  const { user } = useAuth();
  const firstName = [user?.firstName, user?.firstname, user?.FirstName, user?.Firstname]
    .find((name) => typeof name === 'string' && name.trim())?.trim();
  const visitScope = getRecentPropertyStorageKey(user);
  const [visitState, setVisitState] = useState(() => ({ scope: visitScope, dates: readPropertyVisitDates(user) }));
  const visitDates = visitState.scope === visitScope ? visitState.dates : readPropertyVisitDates(user);

  useEffect(() => {
    const refreshVisits = () => setVisitState({ scope: visitScope, dates: readPropertyVisitDates(user) });
    refreshVisits();
    window.addEventListener(PROPERTY_VISITED_EVENT, refreshVisits);
    window.addEventListener('storage', refreshVisits);
    return () => {
      window.removeEventListener(PROPERTY_VISITED_EVENT, refreshVisits);
      window.removeEventListener('storage', refreshVisits);
    };
  }, [user, visitScope]);

  const tableStyles = getTableStyles(theme);
  const next = getOwnerNextStep({ reminders, properties, propertiesLoading, propertiesError });
  const places = sortPropertiesByLastVisit(getOwnerProperties(properties), visitDates);

  return (
    <Box sx={{ maxWidth: 1120, mx: 'auto', pb: 2 }}>
      <Box sx={{ pt: { xs: 1, md: 1.5 } }}>
        <Typography variant="overline" sx={{ color: 'text.secondary', letterSpacing: '0.12em', fontWeight: 700 }}>
          {format(new Date(), 'EEEE, MMMM d')}
        </Typography>
        <Typography component="h1" sx={{ mt: 0.5, fontFamily: 'Poppins, Public Sans, sans-serif', fontSize: { xs: '1.5rem', md: '1.8rem' }, fontWeight: 700, lineHeight: 1.2, color: 'text.primary', overflowWrap: 'anywhere' }}>
          {firstName ? `Welcome back, ${firstName}!` : 'Welcome back!'}
        </Typography>
      </Box>
      <Box sx={{ display: 'grid', gridTemplateColumns: { xs: 'minmax(0, 1fr)', lg: '280px minmax(0, 1fr)' }, gap: { xs: 0, lg: 6 }, alignItems: 'start' }}>
        <Box sx={{ pt: { xs: 3, md: 4 }, pb: { xs: 1, lg: 0 }, minWidth: 0 }}>
          <OwnerHomeSidebar />
        </Box>
        <Box sx={{ minWidth: 0 }}>
      <Box component="section" aria-labelledby="owner-next-heading" sx={{ py: { xs: 3, md: 4 }, borderBottom: '1px solid', borderColor: 'divider' }}>
        <Typography id="owner-next-heading" component="h2" variant="h5" sx={{ mb: 1.5, fontWeight: 700 }}>Tasks</Typography>
        {next ? (
          <Box sx={{ ...dashboardSlideDownSx, display: 'flex', alignItems: { xs: 'flex-start', sm: 'center' }, justifyContent: 'space-between', flexDirection: { xs: 'column', sm: 'row' }, gap: 2, p: { xs: 2, sm: 2.5 }, bgcolor: 'background.paper', border: '1px solid', borderColor: 'divider', borderRadius: 2 }}>
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
          <Box style={tableStyles.container} sx={{ overflow: 'hidden' }}>
            <Box style={{ ...tableStyles.header, borderBottom: tableStyles.headerCell.borderBottom }} sx={{ display: { xs: 'none', xl: 'grid' }, gridTemplateColumns: columns, gap: 2, px: 2, py: 1.15 }}>
              {['Property', 'Rent paid', 'Rent status', 'Operations'].map((label) => (
                <Typography key={label} style={{ ...tableStyles.headerCell, padding: 0, borderBottom: 0 }}>{label}</Typography>
              ))}
            </Box>
            {places.slice(0, 4).map((property, index) => {
              const rent = getPropertyMonthRent(property.id, rentRecords, rentError || !rentReady);
              const overdue = getPropertyOverdueRent(property.id, rentRecords, rentError || !rentReady);
              return (
                <Box key={property.id} style={{ '--dashboard-deal-delay': dashboardEntranceDelay(index) }} sx={{ ...dashboardSlideDownSx, display: 'grid', gridTemplateColumns: { xs: 'minmax(0, 1fr)', xl: columns }, alignItems: 'center', gap: { xs: 1.5, xl: 2 }, px: 2, py: 1.5, borderTop: index ? '1px solid' : 0, borderColor: 'divider' }}>
                  <Stack component={RouterLink} to={property.href} direction="row" spacing={1.4} alignItems="center" sx={{ minWidth: 0, color: 'inherit', textDecoration: 'none', '&:hover .owner-property-name': { textDecoration: 'underline' }, '&:focus-visible': { outline: `2px solid ${theme.palette.primary.main}`, outlineOffset: 2 } }}>
                    <Box component="img" src={property.imageUrl || placeholderImage} alt="" sx={{ width: 58, height: 58, borderRadius: 1.8, objectFit: 'cover', bgcolor: alpha(theme.palette.primary.main, 0.08), flexShrink: 0 }} />
                    <Box sx={{ minWidth: 0 }}>
                      <Typography className="owner-property-name" sx={{ fontWeight: 700, color: 'text.primary', overflowWrap: 'anywhere', lineHeight: 1.3 }}>{property.name}</Typography>
                      <Typography sx={{ mt: 0.3, fontSize: '0.77rem', color: 'text.secondary', overflowWrap: 'anywhere' }}>{property.address || 'Address not added'}</Typography>
                    </Box>
                  </Stack>
                  <Box>
                    <Typography sx={{ display: { xs: 'block', xl: 'none' }, mb: 0.5, fontSize: '0.66rem', fontWeight: 750, textTransform: 'uppercase', color: 'text.secondary' }}>Rent paid</Typography>
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
                    <Typography sx={{ display: { xs: 'block', xl: 'none' }, mb: 0.5, fontSize: '0.66rem', fontWeight: 750, textTransform: 'uppercase', color: 'text.secondary' }}>Rent status</Typography>
                    <Typography sx={{ fontSize: '0.8rem', fontWeight: overdue > 0 ? 650 : 400, color: overdue > 0 ? 'error.main' : 'text.secondary' }}>
                      {overdue === null ? (rentError ? 'Rent data unavailable' : 'Loading rent…') : overdue > 0 ? `${money(overdue)} overdue` : property.activeLeaseCount === 0 ? 'No lease' : 'Up to date'}
                    </Typography>
                  </Box>
                  <Box>
                    <Typography sx={{ display: { xs: 'block', xl: 'none' }, mb: 0.5, fontSize: '0.66rem', fontWeight: 750, textTransform: 'uppercase', color: 'text.secondary' }}>Operations</Typography>
                    <PropertyOperations property={property.original} showOverdue={false} />
                  </Box>
                </Box>
              );
            })}
          </Box>
        ) : <Typography color="text.secondary">No properties yet. Add one to start organizing your portfolio.</Typography>}
      </Box>
        </Box>
      </Box>
    </Box>
  );
}
