import { Grid, Stack, useMediaQuery, useTheme } from '@mui/material';
import PropertyStory from './PropertyStory';
import PropertyCurrentTenant from './PropertyCurrentTenant';
import PropertyActiveLease from './PropertyActiveLease';
import PropertyQuickActionsPanel from './PropertyQuickActionsPanel';
import PropertyMarketRent from './PropertyMarketRent';
import PropertyMonthlyRent from './PropertyMonthlyRent';
import PropertyUnitsAtAGlance from './PropertyUnitsAtAGlance';
import PropertyLeasingPipeline from 'components/leasing-pipeline/PropertyLeasingPipeline';
import { rentalMode } from 'utils/rentalMode';

export default function PropertyOverview({ property, propertyId, rentRecords = [], onCreateListing }) {
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('sm'));
  const units = property?.units || property?.Units || [];
  const isMultiUnit = units.length > 1;
  const longTermUnits = units.filter(unit => rentalMode(unit) !== 'shortTerm');
  const leaseProperty = { ...property, units: longTermUnits, Units: longTermUnits };

  return (
    <Grid container spacing={2.5}>
      {isMobile && (
        <Grid size={12}>
          <PropertyQuickActionsPanel property={property} propertyId={propertyId} mobile />
        </Grid>
      )}

      {/* Left column: units at a glance (multi-unit) + activity timeline */}
      <Grid size={{ xs: 12, md: 8 }} sx={{ display: isMobile && !isMultiUnit ? 'none' : 'block' }}>
        <Stack spacing={2.5}>
          {isMultiUnit && (
            <PropertyUnitsAtAGlance property={property} propertyId={propertyId} />
          )}
          {!isMobile && <PropertyStory property={property} propertyId={propertyId} />}
        </Stack>
      </Grid>

      {/* Right column: rent summary + lease + quick actions + market rent */}
      <Grid size={{ xs: 12, md: 4 }}>
        <Stack spacing={2.5}>
          {longTermUnits.length > 0 && (isMultiUnit ? (
            <PropertyMonthlyRent property={leaseProperty} rentRecords={rentRecords} />
          ) : (
            <PropertyCurrentTenant property={leaseProperty} rentRecords={rentRecords} />
          ))}
          {isMobile && longTermUnits.length > 0 && (
            <PropertyLeasingPipeline propertyId={propertyId} units={longTermUnits} onCreateListing={onCreateListing} />
          )}
          {longTermUnits.length > 0 && <PropertyActiveLease property={leaseProperty} />}
          {!isMobile && <PropertyQuickActionsPanel property={property} propertyId={propertyId} />}
          {longTermUnits.length > 0 && <PropertyMarketRent property={leaseProperty} />}
          {isMobile && <PropertyStory property={property} propertyId={propertyId} />}
        </Stack>
      </Grid>
    </Grid>
  );
}
