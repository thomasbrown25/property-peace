// AddressFieldWithPlaces.jsx
import { useEffect, useMemo, useRef, useState } from 'react';
import PropTypes from 'prop-types';
import { TextField, Popper, Paper, List, ListItemButton, Typography, CircularProgress } from '@mui/material';
import usePlacesSuggestions from 'hooks/usePlacesSuggestions';

export default function AddressFieldWithPlaces({
  formik,
  name = 'streetAddress',
  label = '',
  placesOptions,
  onSelected,
  disablePortal = false,
  inputRef: externalInputRef
}) {
  const { values, setFieldValue, handleBlur, touched, errors } = formik;

  // ✅ MEMOIZE options so the hook doesn't think config changed every render
  const hookOpts = useMemo(
    () => ({
      region: 'us',
      language: 'en',
      includedPrimaryTypes: ['street_address', 'premise', 'subpremise'],
      debounceMs: 300, // a touch higher helps reduce chatter
      ...(placesOptions || {})
    }),
    [placesOptions]
  );

  const { value, setValue, suggestions, loading, clear, toPlaceDetails, resetSession } = usePlacesSuggestions(hookOpts);

  const anchorRef = useRef(null);
  const [open, setOpen] = useState(false);

  // keep hook value synced with formik on mount/external updates
  useEffect(() => {
    const v = values?.[name];
    if (typeof v === 'string' && v && v !== value) setValue(v);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [values?.[name]]);

  const err = touched?.[name] && errors?.[name];

  const handleChange = (e) => {
    const next = e.target.value;
    setValue(next);
    setOpen(true);
  };

  // Close *after* click can fire
  const handleBlurSafe = (e) => {
    handleBlur(e);
    setFieldValue(name, value);
    setTimeout(() => setOpen(false), 120);
  };

  // Helper function to extract address components
  const parseAddressComponents = (addressComponents) => {
    if (!addressComponents) return { streetAddress: '', city: '', state: '', zipCode: '' };

    // Handle both array and array-like objects
    const components = Array.isArray(addressComponents) 
      ? addressComponents 
      : Array.from(addressComponents || []);

    if (components.length === 0) return { streetAddress: '', city: '', state: '', zipCode: '' };

    let streetNumber = '';
    let route = '';
    let city = '';
    let state = '';
    let zipCode = '';

    for (const component of components) {
      if (!component) continue;

      // Get types - handle both array and array-like
      let types = [];
      if (Array.isArray(component.types)) {
        types = component.types;
      } else if (component.types && typeof component.types[Symbol.iterator] === 'function') {
        types = Array.from(component.types);
      }

      // Handle both new API (longText/shortText) and legacy API (long_name/short_name)
      const longText = component.longText || component.long_name || '';
      const shortText = component.shortText || component.short_name || '';

      // Check for street_number
      if (types.includes('street_number')) {
        if (!streetNumber) {
          streetNumber = longText || shortText;
        }
      }
      // Check for route (street name)
      else if (types.includes('route')) {
        if (!route) {
          route = longText || shortText;
        }
      }
      // Check for locality (city)
      else if (types.includes('locality') || types.includes('sublocality') || types.includes('sublocality_level_1')) {
        if (!city) {
          city = longText || shortText;
        }
      }
      // Check for administrative_area_level_1 (state)
      else if (types.includes('administrative_area_level_1')) {
        if (!state) {
          state = shortText || longText; // Prefer short code for state (e.g., "CA" instead of "California")
        }
      }
      // Check for postal_code (zip code)
      else if (types.includes('postal_code')) {
        if (!zipCode) {
          zipCode = longText || shortText;
        }
      }
    }

    // Build street address from street number and route
    const streetAddress = [streetNumber, route].filter(Boolean).join(' ').trim();

    return { streetAddress, city, state, zipCode };
  };

  const handleSelect = async (s) => {
    // Validate suggestion object
    if (!s || !s.placePrediction) {
      console.error('Invalid suggestion object:', s);
      return;
    }

    // If legacy (no Place object), we still use the label text
    const labelText = s?.placePrediction?.text?.toString?.() || '';

    let formatted = labelText;
    let place = null;
    try {
      // Check if toPlace method exists before calling
      const toPlaceMethod = s?.placePrediction?.toPlace;
      if (!toPlaceMethod || typeof toPlaceMethod !== 'function') {
        setValue(formatted);
        setFieldValue(name, formatted);
        setOpen(false);
        clear();
        resetSession();
        onSelected?.(formatted, null);
        return;
      }

      place = await toPlaceDetails(s, ['displayName', 'formattedAddress', 'location', 'addressComponents', 'photos']);
      
      // If place is null, just use the label text and exit early
      if (!place) {
        setValue(formatted);
        setFieldValue(name, formatted);
        setOpen(false);
        clear();
        resetSession();
        onSelected?.(formatted, null);
        return;
      }

      if (place?.formattedAddress) formatted = place.formattedAddress;

      // Optional lat/lng
      const loc = place?.location;
      const lat = typeof loc?.lat === 'function' ? loc.lat() : loc?.lat;
      const lng = typeof loc?.lng === 'function' ? loc.lng() : loc?.lng;
      if (typeof lat === 'number' && typeof lng === 'number') {
        setFieldValue('latitude', lat);
        setFieldValue('longitude', lng);
      }

      // Parse address components and auto-fill city, state, zipCode
      // Try multiple ways to access addressComponents (new API vs legacy)
      let addressComponents = null;
      if (place) {
        // New Places API (addressComponents as property)
        if (place.addressComponents) {
          addressComponents = place.addressComponents;
        }
        // Legacy API (address_components as property)
        else if (place.address_components) {
          addressComponents = place.address_components;
        }
        // Try as getter/method
        else if (typeof place.getAddressComponents === 'function') {
          try {
            addressComponents = place.getAddressComponents();
          } catch (e) {
            // getAddressComponents not available
          }
        }
        // Try accessing as array-like object
        else if (place.addressComponents && typeof place.addressComponents[Symbol.iterator] === 'function') {
          addressComponents = place.addressComponents;
        }

      }

      if (addressComponents) {
        const { streetAddress: extractedStreetAddress, city, state, zipCode } = parseAddressComponents(addressComponents);
        
        // Set the street address (just street number + route, no city/state/zip)
        if (extractedStreetAddress) {
          setFieldValue(name, extractedStreetAddress);
          setValue(extractedStreetAddress);
        } else {
          // Fallback: if we can't extract street address, try to remove city/state/zip from formatted address
          // This is a fallback for cases where address components aren't available
          if (formatted) {
            // Try to remove city, state, and zip from the formatted address
            let cleanedAddress = formatted;
            if (city) {
              cleanedAddress = cleanedAddress.replace(new RegExp(`,\\s*${city.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}`, 'gi'), '');
            }
            if (state) {
              cleanedAddress = cleanedAddress.replace(new RegExp(`,\\s*${state.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}`, 'gi'), '');
            }
            if (zipCode) {
              cleanedAddress = cleanedAddress.replace(new RegExp(`\\s*${zipCode.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}`, 'gi'), '');
            }
            cleanedAddress = cleanedAddress.replace(/,\s*,/g, ',').replace(/^,\s*|,\s*$/g, '').trim();
            if (cleanedAddress) {
              setFieldValue(name, cleanedAddress);
              setValue(cleanedAddress);
            }
          }
        }
        
        if (city) {
          setFieldValue('city', city);
        }
        if (state) {
          setFieldValue('state', state);
        }
        if (zipCode) {
          setFieldValue('zipCode', zipCode);
        }
      }
    } catch (error) {
      console.error('Error parsing address components:', error);
      // Don't fail silently - log the error for debugging
    }

    setValue(formatted);
    setFieldValue(name, formatted);

    // Close dropdown immediately before calling onSelected (which may show a dialog)
    setOpen(false);
    clear();
    resetSession();

    // Pass the place object to onSelected callback so parent can fetch photos
    // This will be called after dropdown is closed
    onSelected?.(formatted, place);
  };

  return (
    <>
      <TextField
        fullWidth
        size="small"
        className="property-streetAddress"
        inputRef={(node) => {
          anchorRef.current = node;
          // Expose to external ref if provided
          if (externalInputRef) {
            if (typeof externalInputRef === 'function') {
              externalInputRef(node);
            } else if (externalInputRef) {
              externalInputRef.current = node;
            }
          }
        }}
        label={label}
        name={name}
        value={value}
        onChange={handleChange}
        onBlur={handleBlurSafe}
        error={Boolean(err)}
        helperText={err}
        placeholder="Enter Street Address"
        autoComplete="off"
        InputProps={{
          endAdornment: loading ? <CircularProgress size={18} /> : null
        }}
        onFocus={() => setOpen(true)}
      />

      <Popper
        open={open && (suggestions.length > 0 || loading)} // keep mounted while loading
        anchorEl={anchorRef.current}
        placement="bottom-start"
        disablePortal={disablePortal}
        sx={{ zIndex: 1300, maxWidth: '600px', width: { xs: '80vw', sm: '90vw', md: '60vw', lg: '50vw' } }}
      >
        <Paper
          elevation={4}
          sx={{
            maxHeight: 320,
            borderRadius: 1
          }}
        >
          <List dense>
            {suggestions.map((s, idx) => {
              const labelText = s?.placePrediction?.text?.toString?.() || '';
              return (
                <ListItemButton
                  key={idx}
                  // Use mousedown so selection happens before blur
                  onMouseDown={(e) => {
                    e.preventDefault(); // keep focus
                    handleSelect(s);
                  }}
                >
                  <Typography variant="body2">{labelText}</Typography>
                </ListItemButton>
              );
            })}
          </List>
        </Paper>
      </Popper>
    </>
  );
}

AddressFieldWithPlaces.propTypes = {
  formik: PropTypes.object.isRequired,
  name: PropTypes.string,
  label: PropTypes.string,
  placesOptions: PropTypes.object,
  onSelected: PropTypes.func,
  disablePortal: PropTypes.bool,
  inputRef: PropTypes.oneOfType([PropTypes.func, PropTypes.shape({ current: PropTypes.instanceOf(Element) })])
};
