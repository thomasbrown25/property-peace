import { useMemo } from 'react';
import { Box } from '@mui/system';
import Autocomplete from 'components/@extended/AutoComplete';
import { useDispatch, useSelector } from 'react-redux';
import { setLease } from 'store/lease/lease.action';
import { setUnit } from 'store/unit/unit.action';
import { selectProperty } from 'store/property/property.selector';
import { selectUnit } from 'store/unit/unit.selector';

const UnitSelect = ({ width }) => {
  const dispatch = useDispatch();
  const selectedProperty = useSelector(selectProperty);
  const selectedUnit = useSelector(selectUnit);

  // Units depend on selected property
  const unitOptions = useMemo(() => {
    if (!selectedProperty?.units) return [];
    return selectedProperty.units.map((u) => ({
      label: u.name ?? `Unit ${u.id}`,
      id: u.id,
      unit: u,
      lease: u.lease || null
    }));
  }, [selectedProperty]);

  const selectedOption = useMemo(() => {
    if (selectedUnit && selectedUnit.id) {
      return unitOptions.find((opt) => String(opt.id) === String(selectedUnit.id)) || null;
    }
    return null;
  }, [selectedUnit, unitOptions]);

  const onSelect = (value) => {
    if (!value) {
      dispatch(setUnit(null));
      dispatch(setLease({})); // clear selected lease
      return;
    }
    // Store the unit in Redux
    const unit = selectedProperty?.units?.find((u) => String(u.id) === String(value.id));
    if (unit) {
      dispatch(setUnit(unit));
    }
    // store the lease (if unit has one)
    dispatch(setLease(value.lease || {}));
  };

  return (
    <Box width={width || '100%'} display="flex" flexDirection="column" justifyContent="space-between" alignItems="start" gap={2}>
      <Autocomplete
        options={unitOptions}
        width={width}
        label="Select Unit"
        value={selectedOption}
        onChange={(_, value) => onSelect(value)}
        isOptionEqualToValue={(opt, val) => String(opt.id) === String(val.id)}
        getOptionLabel={(option) => option?.label ?? ''}
        disabled={!selectedProperty} // disabled if no property selected
      />
    </Box>
  );
};

export default UnitSelect;
