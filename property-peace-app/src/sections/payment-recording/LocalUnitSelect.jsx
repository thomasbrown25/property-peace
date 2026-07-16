import { useMemo } from 'react';
import { Box } from '@mui/system';
import Autocomplete from 'components/@extended/AutoComplete';
import PropTypes from 'prop-types';

const LocalUnitSelect = ({ localSelectedProperty, localSelectedUnit, onUnitChange }) => {
  // Units depend on selected property
  const unitOptions = useMemo(() => {
    if (!localSelectedProperty?.units) return [];
    return localSelectedProperty.units.map((u) => ({
      label: u.name ?? `Unit ${u.id}`,
      id: u.id,
      unit: u,
      lease: u.lease || null
    }));
  }, [localSelectedProperty]);

  const selectedOption = useMemo(() => {
    if (localSelectedUnit && localSelectedUnit.id) {
      return unitOptions.find((opt) => String(opt.id) === String(localSelectedUnit.id)) || null;
    }
    return null;
  }, [localSelectedUnit, unitOptions]);

  const onSelect = (value) => {
    if (!value) {
      if (onUnitChange) {
        onUnitChange(null);
      }
      return;
    }
    // Find the unit from property
    const unit = localSelectedProperty?.units?.find((u) => String(u.id) === String(value.id));
    if (unit && onUnitChange) {
      onUnitChange(unit);
    }
  };

  return (
    <Box width="100%" display="flex" flexDirection="column" justifyContent="space-between" alignItems="start" gap={2}>
      <Autocomplete
        options={unitOptions}
        width="100%"
        label="Select Unit"
        value={selectedOption}
        onChange={(_, value) => onSelect(value)}
        isOptionEqualToValue={(opt, val) => opt?.id === val?.id}
        getOptionLabel={(option) => option?.label ?? ''}
        disabled={!localSelectedProperty} // disabled if no property selected
      />
    </Box>
  );
};

LocalUnitSelect.propTypes = {
  localSelectedProperty: PropTypes.object,
  localSelectedUnit: PropTypes.object,
  onUnitChange: PropTypes.func.isRequired
};

export default LocalUnitSelect;
