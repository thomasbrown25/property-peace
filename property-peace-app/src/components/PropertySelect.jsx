import { useMemo } from 'react';
import { Box } from '@mui/system';
import { Typography } from '@mui/material';
import Autocomplete from 'components/@extended/AutoComplete';
import { useDispatch, useSelector } from 'react-redux';
import { setLease } from 'store/lease/lease.action';
import { setProperty } from 'store/property/property.action';
import { selectProperty } from 'store/property/property.selector';
import useFetchProperties from 'hooks/useFetchProperties';

const ALL_OPTION = { label: 'All Properties', id: 'all' };

const isAddress = (str) => {
  if (!str) return false;
  return str.includes(',') || /\d{5}/.test(str);
};

const getPropertyDisplayLabel = (property, fallback = 'Unnamed Property') => {
  if (!property) return fallback;

  const propName = property.name?.trim();
  if (propName && !isAddress(propName)) {
    return propName;
  }

  const fullAddress = property.streetAddress || property.name || fallback;
  const streetAddress = fullAddress.includes(',') ? fullAddress.split(',')[0].trim() : fullAddress.trim();
  return streetAddress || fallback;
};

const PropertySelect = ({
  width,
  disableAllOption = false,
  onPropertyChange,
  localSelectedProperty = null,
  label = 'Select Property',
  disabledPropertyIds,
  disabledPropertyReason = 'Unavailable'
}) => {
  const dispatch = useDispatch();
  const reduxSelectedProperty = useSelector(selectProperty);

  // Use local property if provided, otherwise use Redux
  const selectedProperty = localSelectedProperty !== null ? localSelectedProperty : reduxSelectedProperty;

  const { properties } = useFetchProperties();

  const selectedOption = useMemo(() => {
    if (selectedProperty && selectedProperty.id) {
      return {
        label: getPropertyDisplayLabel(selectedProperty),
        id: selectedProperty.id,
        property: selectedProperty
      };
    }
    return disableAllOption ? null : ALL_OPTION;
  }, [selectedProperty, disableAllOption]);

  const options = useMemo(() => {
    const base = [
      ...(disableAllOption ? [] : [ALL_OPTION]),
      ...(properties?.map((p) => ({
        label: getPropertyDisplayLabel(p),
        id: p.id,
        property: p
      })) ?? [])
    ];

    // only push if it's valid (both label and id defined)
    if (
      selectedOption &&
      selectedOption.id !== undefined &&
      selectedOption.label !== undefined &&
      !base.some((o) => String(o.id) === String(selectedOption.id))
    ) {
      base.push(selectedOption);
    }

    return base;
  }, [properties, selectedOption, disableAllOption]);

  const isPropertyDisabled = (option) => Boolean(option?.id && disabledPropertyIds?.has?.(String(option.id)));

  const onSelect = (value) => {
    if (isPropertyDisabled(value)) {
      return;
    }

    if (!value || value.id === 'all') {
      // If callback provided, use it instead of Redux
      if (onPropertyChange) {
        onPropertyChange(null);
      } else {
        dispatch(setProperty(null));
        dispatch(setLease({})); // clear any lease tied to a property
      }
      return;
    }
    const property = properties?.find((p) => String(p.id) === String(value.id));

    // If callback provided, use it instead of Redux
    if (onPropertyChange) {
      onPropertyChange(property || null);
    } else {
      dispatch(setProperty(property || null));
      if (property?.units?.length === 1) {
        dispatch(setLease(property.units[0]?.lease || {}));
      } else {
        dispatch(setLease({}));
      }
    }
  };

  return (
    <Box
      width="100%"
      display="flex"
      flexDirection="column"
      justifyContent="space-between"
      alignItems="start"
      gap={2}
      sx={{ position: 'relative' }}
    >
      <Autocomplete
        options={options}
        width={width}
        label={label}
        value={selectedOption}
        onChange={(_, value) => onSelect(value ?? ALL_OPTION)}
        isOptionEqualToValue={(opt, val) => String(opt.id) === String(val.id)}
        getOptionDisabled={isPropertyDisabled}
        getOptionLabel={(option) => {
          if (!option) {
            return '';
          }

          if (option.id === 'all' || option.label === 'All Properties') {
            return 'All Properties';
          }

          if (option.property) {
            return getPropertyDisplayLabel(option.property);
          }

          if (option.id && properties) {
            const prop = properties.find((p) => String(p.id) === String(option.id));
            if (prop) {
              return getPropertyDisplayLabel(prop);
            }
          }

          return option.label || 'Unnamed Property';
        }}
        renderOption={(props, option) => {
          if (option.id === 'all' || option.label === 'All Properties') {
            return (
              <li {...props} key={option?.id}>
                All Properties
              </li>
            );
          }

          const displayLabel = option.property
            ? getPropertyDisplayLabel(option.property)
            : option.label || 'Unnamed Property';
          const disabled = isPropertyDisabled(option);

          return (
            <li {...props} key={option?.id}>
              <Box>
                <Typography variant="body2" color={disabled ? 'text.disabled' : 'text.primary'}>
                  {displayLabel}
                </Typography>
                {disabled && (
                  <Typography variant="caption" color="text.disabled">
                    {disabledPropertyReason}
                  </Typography>
                )}
              </Box>
            </li>
          );
        }}
        disablePortal={false}
      />
    </Box>
  );
};

export default PropertySelect;
