import { Grid, Stack, useMediaQuery, useTheme } from '@mui/material';
import PropertyStory from './PropertyStory';
import PropertyCurrentTenant from './PropertyCurrentTenant';
import PropertyActiveLease from './PropertyActiveLease';
import PropertyQuickActionsPanel from './PropertyQuickActionsPanel';
import PropertyMarketRent from './PropertyMarketRent';
import PropertyMonthlyRent from './PropertyMonthlyRent';
import PropertyUnitsAtAGlance from './PropertyUnitsAtAGlance';
import PropertyLeasingPipeline from 'components/leasing-pipeline/PropertyLeasingPipeline';

export default function PropertyOverview({ property, propertyId, onCreateListing }) {
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('sm'));
  const units = property?.units || property?.Units || [];
  const isMultiUnit = units.length > 1;

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
          {isMultiUnit ? (
            <PropertyMonthlyRent property={property} />
          ) : (
            <PropertyCurrentTenant property={property} />
          )}
          {isMobile && (
            <PropertyLeasingPipeline propertyId={propertyId} units={units} onCreateListing={onCreateListing} />
          )}
          <PropertyActiveLease property={property} />
          {!isMobile && <PropertyQuickActionsPanel property={property} propertyId={propertyId} />}
          <PropertyMarketRent property={property} />
          {isMobile && <PropertyStory property={property} propertyId={propertyId} />}
        </Stack>
      </Grid>
    </Grid>
  );
}
