import { Grid, Stack } from '@mui/material';
import PropertyStory from './PropertyStory';
import PropertyCurrentTenant from './PropertyCurrentTenant';
import PropertyActiveLease from './PropertyActiveLease';
import PropertyQuickActionsPanel from './PropertyQuickActionsPanel';
import PropertyMarketRent from './PropertyMarketRent';
import PropertyMonthlyRent from './PropertyMonthlyRent';
import PropertyUnitsAtAGlance from './PropertyUnitsAtAGlance';

export default function PropertyOverview({ property, propertyId }) {
  const units = property?.units || property?.Units || [];
  const isMultiUnit = units.length > 1;

  return (
    <Grid container spacing={2.5}>
      {/* Left column: units at a glance (multi-unit) + activity timeline */}
      <Grid size={{ xs: 12, md: 8 }}>
        <Stack spacing={2.5}>
          {isMultiUnit && (
            <PropertyUnitsAtAGlance property={property} propertyId={propertyId} />
          )}
          <PropertyStory property={property} propertyId={propertyId} />
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
          <PropertyActiveLease property={property} />
          <PropertyQuickActionsPanel property={property} propertyId={propertyId} />
          <PropertyMarketRent property={property} />
        </Stack>
      </Grid>
    </Grid>
  );
}
