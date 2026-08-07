import { useEffect, useMemo, useState } from 'react';
import { Alert, Box, FormControl, InputLabel, MenuItem, Select, Stack, Typography } from '@mui/material';

import LeasingPipelinePanel from './LeasingPipelinePanel';

const unitIdOf = (unit) => unit?.id ?? unit?.Id;
const positiveUnitIdOf = (unit) => {
  const value = unitIdOf(unit);
  if (typeof value === 'number') return Number.isSafeInteger(value) && value > 0 ? value : null;
  if (typeof value !== 'string' || !/^[1-9]\d*$/.test(value)) return null;
  const numeric = Number(value);
  return Number.isSafeInteger(numeric) && numeric > 0 ? numeric : null;
};
const unitLabelOf = (unit, index) => unit?.name ?? unit?.Name ?? `Unit ${index + 1}`;

export default function PropertyLeasingPipeline({ propertyId, units: loadedUnits, onCreateListing }) {
  const units = useMemo(
    () => (Array.isArray(loadedUnits) ? loadedUnits : []).filter((unit) => positiveUnitIdOf(unit) !== null),
    [loadedUnits]
  );
  const [selectedUnitId, setSelectedUnitId] = useState('');
  const unitIdentity = units.map(unitIdOf).join(',');

  useEffect(() => {
    setSelectedUnitId(units.length === 1 ? String(unitIdOf(units[0])) : '');
  }, [propertyId, unitIdentity, units.length]);

  if (units.length === 0) {
    return (
      <Alert severity="info" variant="outlined">
        <Typography fontWeight={700}>Leasing progress needs a unit</Typography>
        <Typography variant="body2">No loaded units are available for this property.</Typography>
      </Alert>
    );
  }

  return (
    <Stack spacing={1.25}>
      {units.length > 1 && (
        <Box sx={{ display: 'flex', alignItems: { xs: 'stretch', sm: 'center' }, flexDirection: { xs: 'column', sm: 'row' }, gap: 1.25 }}>
          <FormControl size="small" sx={{ width: { xs: '100%', sm: 260 } }}>
            <InputLabel id="leasing-pipeline-unit-label">Unit</InputLabel>
            <Select
              labelId="leasing-pipeline-unit-label"
              id="leasing-pipeline-unit"
              value={selectedUnitId}
              label="Unit"
              onChange={(event) => setSelectedUnitId(event.target.value)}
              sx={{ '&.Mui-focused .MuiOutlinedInput-notchedOutline': { borderWidth: 2 } }}
            >
              <MenuItem value=""><em>Select a unit</em></MenuItem>
              {units.map((unit, index) => <MenuItem key={unitIdOf(unit)} value={String(unitIdOf(unit))}>{unitLabelOf(unit, index)}</MenuItem>)}
            </Select>
          </FormControl>
          {!selectedUnitId && <Typography variant="body2" color="text.secondary">Select a unit to view its leasing progress.</Typography>}
        </Box>
      )}
      <LeasingPipelinePanel
        resourceType={selectedUnitId ? 'property' : null}
        resourceId={propertyId}
        unitId={selectedUnitId || null}
        onCreateListing={onCreateListing}
      />
    </Stack>
  );
}
