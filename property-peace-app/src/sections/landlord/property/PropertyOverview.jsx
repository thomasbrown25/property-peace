import { Grid, useMediaQuery, useTheme } from '@mui/material';
import PropertyStory from './PropertyStory';
import PropertyCurrentTenant from './PropertyCurrentTenant';
import PropertyActiveLease from './PropertyActiveLease';
import PropertyQuickActionsPanel from './PropertyQuickActionsPanel';
import PropertyMonthlyRent from './PropertyMonthlyRent';
import PropertyUnitsAtAGlance from './PropertyUnitsAtAGlance';
import { rentalMode } from 'utils/rentalMode';

export default function PropertyOverview({ property, propertyId, rentRecords = [] }) {
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('sm'));
  const units = property?.units || property?.Units || [];
  const isMultiUnit = units.length > 1;
  const longTermUnits = units.filter(unit => rentalMode(unit) !== 'shortTerm');
  const leaseProperty = { ...property, units: longTermUnits, Units: longTermUnits };

  return (
    <Grid container spacing={2.5}>
      {longTermUnits.length > 0 && (
        <Grid size={{ xs: 12, md: 4 }} sx={{ '& > .MuiCard-root': { height: '100%' } }}>
          {isMultiUnit ? (
            <PropertyMonthlyRent property={leaseProperty} rentRecords={rentRecords} />
          ) : (
            <PropertyCurrentTenant property={leaseProperty} rentRecords={rentRecords} />
          )}
        </Grid>
      )}
      {longTermUnits.length > 0 && (
        <Grid size={{ xs: 12, md: 4 }} sx={{ '& > .MuiCard-root': { height: '100%' } }}>
          <PropertyActiveLease property={leaseProperty} />
        </Grid>
      )}
      <Grid size={{ xs: 12, md: 4 }}>
        <PropertyQuickActionsPanel property={property} propertyId={propertyId} mobile={isMobile} />
      </Grid>
      {isMultiUnit && (
        <Grid size={12}>
          <PropertyUnitsAtAGlance property={property} propertyId={propertyId} />
        </Grid>
      )}
      <Grid size={12}>
        <PropertyStory property={property} propertyId={propertyId} />
      </Grid>
    </Grid>
  );
}
