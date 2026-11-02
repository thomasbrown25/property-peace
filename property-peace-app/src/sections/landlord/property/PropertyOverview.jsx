import { Grid } from '@mui/material';
import PropertyStory from './PropertyStory';
import PropertyMonthlyRent from './PropertyMonthlyRent';
import PropertyUnitsAtAGlance from './PropertyUnitsAtAGlance';
import { rentalMode } from 'utils/rentalMode';

export default function PropertyOverview({ property, propertyId, rentRecords = [] }) {
  const units = property?.units || property?.Units || [];
  const isMultiUnit = units.length > 1;
  const longTermUnits = units.filter(unit => rentalMode(unit) !== 'shortTerm');
  const leaseProperty = { ...property, units: longTermUnits, Units: longTermUnits };

  return (
    <Grid container spacing={2.5}>
      {isMultiUnit && longTermUnits.length > 0 && (
        <Grid size={12}>
          <PropertyMonthlyRent property={leaseProperty} rentRecords={rentRecords} />
        </Grid>
      )}
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
