import { useRef, useState, useCallback, useEffect } from 'react';
import PropTypes from 'prop-types';
import { Box, TextField, Popper, Paper, List, ListItemButton, Typography, CircularProgress, InputLabel } from '@mui/material';
import usePlacesSuggestions from 'hooks/usePlacesSuggestions';

function parseAddressComponents(addressComponents) {
  if (!addressComponents) return { streetAddress: '', city: '', state: '', zipCode: '' };
  const components = Array.isArray(addressComponents) ? addressComponents : Array.from(addressComponents || []);
  if (components.length === 0) return { streetAddress: '', city: '', state: '', zipCode: '' };

  let streetNumber = '';
  let route = '';
  let city = '';
  let state = '';
  let zipCode = '';

  for (const component of components) {
    if (!component) continue;
    let types = [];
    if (Array.isArray(component.types)) types = component.types;
    else if (component.types && typeof component.types[Symbol.iterator] === 'function') types = Array.from(component.types);
    const longText = component.longText || component.long_name || '';
    const shortText = component.shortText || component.short_name || '';

    if (types.includes('street_number')) { if (!streetNumber) streetNumber = longText || shortText; }
    else if (types.includes('route')) { if (!route) route = longText || shortText; }
    else if (types.includes('locality') || types.includes('sublocality') || types.includes('sublocality_level_1')) { if (!city) city = longText || shortText; }
    else if (types.includes('administrative_area_level_1')) { if (!state) state = shortText || longText; }
    else if (types.includes('postal_code')) { if (!zipCode) zipCode = longText || shortText; }
  }

  const streetAddress = [streetNumber, route].filter(Boolean).join(' ').trim();
  return { streetAddress, city, state, zipCode };
}

export default function AddressAutocomplete({
  value = '',
  onChange,
  onAddressSelected,
  label = 'Street address',
  fullWidth = true,
  size = 'small',
  placeholder = 'Start typing an address...'
}) {
  const anchorRef = useRef(null);
  const [open, setOpen] = useState(false);

  const hookOpts = useCallback(
    () => ({
      region: 'us',
      language: 'en',
      includedPrimaryTypes: ['street_address', 'premise', 'subpremise'],
      debounceMs: 300
    }),
    []
  );

  const { value: internalValue, setValue, suggestions, loading, clear, toPlaceDetails, resetSession } = usePlacesSuggestions(hookOpts());

  useEffect(() => {
    if (typeof value === 'string' && value !== internalValue) setValue(value);
  }, [value]);

  const handleChange = (e) => {
    const next = e.target.value;
    setValue(next);
    onChange?.(next);
    setOpen(true);
  };

  const handleBlur = () => {
    setTimeout(() => setOpen(false), 150);
  };

  const handleSelect = async (s) => {
    if (!s?.placePrediction) return;
    const labelText = s?.placePrediction?.text?.toString?.() || '';
    try {
      const place = await toPlaceDetails(s, ['displayName', 'formattedAddress', 'location', 'addressComponents']);
      if (!place) {
        onChange?.(labelText);
        setValue(labelText);
        setOpen(false);
        clear();
        resetSession();
        return;
      }
      const addressComponents = place.addressComponents ?? place.address_components;
      if (addressComponents) {
        const parsed = parseAddressComponents(addressComponents);
        const street = parsed.streetAddress || labelText;
        onChange?.(street);
        setValue(street);
        onAddressSelected?.({ streetAddress: street, city: parsed.city, state: parsed.state, zipCode: parsed.zipCode });
      } else {
        onChange?.(labelText);
        setValue(labelText);
      }
    } catch (err) {
      console.error('AddressAutocomplete place details error:', err);
      onChange?.(labelText);
      setValue(labelText);
    }
    setOpen(false);
    clear();
    resetSession();
  };

  const displayValue = value !== undefined && value !== null ? value : internalValue;

  return (
    <Box sx={{ width: fullWidth ? '100%' : 'auto' }}>
      {label && (
        <InputLabel sx={{ mb: 0.5, display: 'block', fontWeight: 500 }}>{label}</InputLabel>
      )}
      <TextField
        fullWidth={fullWidth}
        size={size}
        inputRef={anchorRef}
        value={displayValue}
        onChange={handleChange}
        onBlur={handleBlur}
        placeholder={placeholder}
        autoComplete="off"
        InputProps={{ endAdornment: loading ? <CircularProgress size={18} /> : null }}
        onFocus={() => setOpen(true)}
      />
      <Popper open={open && (suggestions.length > 0 || loading)} anchorEl={anchorRef.current} placement="bottom-start" disablePortal={false} sx={{ zIndex: 1300, maxWidth: 600, width: '100%' }}>
        <Paper elevation={4} sx={{ maxHeight: 320, borderRadius: 1 }}>
          <List dense>
            {suggestions.map((s, idx) => {
              const labelText = s?.placePrediction?.text?.toString?.() || '';
              return (
                <ListItemButton
                  key={idx}
                  onMouseDown={(e) => { e.preventDefault(); handleSelect(s); }}
                >
                  <Typography variant="body2">{labelText}</Typography>
                </ListItemButton>
              );
            })}
          </List>
        </Paper>
      </Popper>
    </Box>
  );
}

AddressAutocomplete.propTypes = {
  value: PropTypes.string,
  onChange: PropTypes.func.isRequired,
  onAddressSelected: PropTypes.func,
  label: PropTypes.string,
  fullWidth: PropTypes.bool,
  size: PropTypes.string,
  placeholder: PropTypes.string
};
