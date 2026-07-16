import { useState, useEffect } from 'react';
import PropTypes from 'prop-types';

// material-ui
import {
  Box,
  Typography,
  Grid,
  Autocomplete,
  TextField,
  CircularProgress,
  Alert,
  Tooltip
} from '@mui/material';
import { LocalizationProvider } from '@mui/x-date-pickers';
import { AdapterDateFns } from '@mui/x-date-pickers/AdapterDateFns';
import { DatePicker } from '@mui/x-date-pickers/DatePicker';

// project imports
import { useDispatch, useSelector } from 'react-redux';
import { getProperties } from 'store/property/property.action';
import { getUnits } from 'store/unit/unit.action';
import { selectProperties } from 'store/property/property.selector';
import { selectUnits } from 'store/unit/unit.selector';
import { openSnackbar } from 'api/snackbar';
import useFetchProperties from 'hooks/useFetchProperties';

// ==============================|| PROPERTY UNIT SELECTOR ||============================== //

export default function PropertyUnitSelector({ 
  selectedProperty, 
  selectedUnit, 
  onSelectProperty, 
  onSelectUnit,
  canSelectProperty,
  canSelectUnit,
  getPropertyTooltip,
  getUnitTooltip,
  leaseNickname,
  onLeaseNicknameChange,
  startDate,
  onStartDateChange,
  endDate,
  onEndDateChange
}) {
  const dispatch = useDispatch();
  const { properties, isLoading } = useFetchProperties();
  const unitsFromStore = useSelector(selectUnits);
  // Filter units by selected property if units have propertyId field
  const allUnits = Array.isArray(unitsFromStore) ? unitsFromStore : [];
  
  // Helper function to check if a unit has an active lease
  const unitHasLease = (unit) => {
    if (!unit) return false;
    const lease = unit.lease || unit.Lease;
    if (!lease || typeof lease !== 'object' || !lease.id) return false;
    
    // Check if lease is active (only active leases prevent unit selection)
    // Handle both camelCase and PascalCase
    const isLeaseActive = lease.isActive === true || 
                          lease.IsActive === true ||
                          lease.isActive === 1 ||
                          lease.IsActive === 1;
    
    return isLeaseActive;
  };

  // Check if unit can be selected
  // For lease creation: units without active leases can be selected
  // For lease agreement creation: units with leases can be selected (if custom function provided)
  const unitCanBeSelected = (unit) => {
    // If custom function provided (from parent), use it (e.g., for lease agreement creation)
    if (canSelectUnit) {
      return canSelectUnit(unit);
    }
    // Default for lease creation: unit must NOT have an active lease
    // Units with inactive/archived leases are available for new leases
    return !unitHasLease(unit);
  };

  // Check if property can be selected
  const propertyCanBeSelected = (property) => {
    if (!property) return false;
    const units = property.units || [];
    if (units.length === 0) {
      return false; // No units
    }
    // Check if at least one unit can be selected (without a lease for lease creation)
    const hasSelectableUnit = units.some(u => unitCanBeSelected(u));
    if (!hasSelectableUnit) {
      return false; // No selectable units
    }
    // If custom function provided, use it
    if (canSelectProperty) {
      return canSelectProperty(property);
    }
    return hasSelectableUnit;
  };
  
  // Get all properties (will show disabled if all units have leases)
  const propertiesList = Array.isArray(properties) ? properties : [];
  
  // Get all units for selected property (show all, but disable ones that can't create agreement)
  const units = selectedProperty?.id 
    ? (() => {
        // Get units from property's nested structure
        const nestedUnits = selectedProperty.units || [];
        
        // Get units from flat list
        const flatUnits = allUnits.filter((u) => 
          u.propertyId === selectedProperty.id || !u.propertyId
        );
        
        // Combine and deduplicate by id
        const combined = [...nestedUnits, ...flatUnits];
        const unique = combined.filter((u, index, self) => 
          index === self.findIndex((t) => t.id === u.id)
        );
        
        // If we have a selected unit that's not in the list, add it
        if (selectedUnit && !unique.some(u => u.id === selectedUnit.id)) {
          unique.push(selectedUnit);
        }
        
        return unique;
      })()
    : [];
  const [loadingUnits, setLoadingUnits] = useState(false);
  const [error, setError] = useState(null);

  // Check if property is single-family
  const isSingleFamily = selectedProperty?.propertyType === 'singleFamily' || 
                         selectedProperty?.propertyType === 'SingleFamily' ||
                         selectedProperty?.PropertyType === 'SingleFamily';

  useEffect(() => {
    if (selectedProperty?.id) {
      loadUnits(selectedProperty.id);
      // Clear unit selection when property changes (will be re-selected if single-family)
      if (!isSingleFamily) {
        // Only clear if the selected unit doesn't belong to this property
        if (selectedUnit) {
          const unitBelongsToProperty = selectedProperty.units?.some(u => u.id === selectedUnit.id) ||
                                       allUnits.some(u => u.id === selectedUnit.id && (u.propertyId === selectedProperty.id || !u.propertyId));
          if (!unitBelongsToProperty) {
            onSelectUnit(null);
          }
        }
      }
    } else {
      onSelectUnit(null);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedProperty?.id, isSingleFamily]);

  // Auto-select first unit for single-family properties when units are available
  useEffect(() => {
    if (isSingleFamily && selectedProperty?.id && units.length > 0 && !selectedUnit) {
      const firstUnit = units[0];
      if (unitCanBeSelected(firstUnit)) {
        onSelectUnit(firstUnit);
      }
    }
  }, [isSingleFamily, selectedProperty?.id, units, selectedUnit, onSelectUnit]);

  const loadUnits = async (propertyId) => {
    try {
      setLoadingUnits(true);
      setError(null);
      await dispatch(getUnits(propertyId));
    } catch (err) {
      const errorMessage = err.message || 'Failed to load units';
      setError(errorMessage);
      openSnackbar('error', errorMessage);
    } finally {
      setLoadingUnits(false);
    }
  };

  if (isLoading) {
    return (
      <Box display="flex" justifyContent="center" alignItems="center" minHeight="300px">
        <CircularProgress />
      </Box>
    );
  }

  if (error) {
    return <Alert severity="error">{error}</Alert>;
  }

  return (
    <LocalizationProvider dateAdapter={AdapterDateFns}>
      <Box>
        <Grid container spacing={3}>
          {/* Lease Details Section */}
          <Grid size={{ xs: 12 }}>
            <Typography variant="h6" sx={{ mb: 1.5, mt: 1, fontWeight: 600 }}>
              Lease Details
            </Typography>
          </Grid>

          {/* Lease Nickname - First Field */}
          <Grid size={{ xs: 12 }}>
            <TextField
              fullWidth
              label="Lease nickname *"
              name="leaseNickname"
              value={leaseNickname || ''}
              onChange={(e) => onLeaseNicknameChange?.(e.target.value)}
              required
              helperText="Use a descriptive name that includes the property address and tenant names for easy identification (e.g., '123 Main St - Smith Family')."
            />
          </Grid>

          <Grid size={{ xs: 12, sm: 6 }}>
            <Autocomplete
              options={propertiesList}
              value={selectedProperty || null}
              onChange={(event, newValue) => {
                onSelectProperty(newValue);
              }}
              getOptionLabel={(option) => {
                return `${option.name} - ${option.streetAddress || ''}`;
              }}
              isOptionEqualToValue={(option, value) => option.id === value.id}
              getOptionDisabled={(option) => !propertyCanBeSelected(option)}
              loading={isLoading}
              renderInput={(params) => (
                <TextField
                  {...params}
                  label="Property *"
                  required
                />
              )}
              renderOption={(props, option) => {
                const canSelect = propertyCanBeSelected(option);
                const tooltipText = getPropertyTooltip ? getPropertyTooltip(option) : '';
                return (
                  <Tooltip title={tooltipText || ''} arrow>
                    <li {...props} key={option.id} style={{ opacity: canSelect ? 1 : 0.5 }}>
                      {option.name} - {option.streetAddress || ''}
                    </li>
                  </Tooltip>
                );
              }}
            />
          </Grid>

          <Grid size={{ xs: 12, sm: 6 }}>
            <Autocomplete
              options={units}
              value={(() => {
                if (!selectedUnit) return null;
                // Find the unit in the options array by ID to ensure reference matching
                const matchingUnit = units.find(u => u.id === selectedUnit.id);
                return matchingUnit || null;
              })()}
              onChange={(event, newValue) => {
                // Don't allow changing unit for single-family properties
                if (!isSingleFamily) {
                  onSelectUnit(newValue);
                }
              }}
              getOptionLabel={(option) => {
                if (!option) return '';
                const hasActiveLease = unitHasLease(option);
                const baseLabel = `${option.name || `Unit ${option.id}`} - ${option.bedrooms || 0} bed, ${option.baths || 0} bath`;
                return hasActiveLease ? `${baseLabel} (has lease)` : baseLabel;
              }}
              isOptionEqualToValue={(option, value) => {
                if (!option || !value) return false;
                return option.id === value.id;
              }}
              getOptionDisabled={(option) => !unitCanBeSelected(option)}
              loading={loadingUnits}
              disabled={!selectedProperty || loadingUnits || isSingleFamily}
              renderInput={(params) => (
                <TextField
                  {...params}
                  label="Unit *"
                  required
                  helperText={isSingleFamily ? 'Single-family properties have Unit 1' : ''}
                  InputProps={{
                    ...params.InputProps,
                    endAdornment: (
                      <>
                        {loadingUnits ? <CircularProgress color="inherit" size={20} /> : null}
                        {params.InputProps.endAdornment}
                      </>
                    ),
                  }}
                />
              )}
              renderOption={(props, option) => {
                const canSelect = unitCanBeSelected(option);
                const hasActiveLease = unitHasLease(option);
                const tooltipText = getUnitTooltip ? getUnitTooltip(option) : (hasActiveLease ? 'This unit already has an active lease' : '');
                const baseLabel = `${option.name || `Unit ${option.id}`} - ${option.bedrooms || 0} bed, ${option.baths || 0} bath`;
                const label = hasActiveLease ? `${baseLabel} (has lease)` : baseLabel;
                return (
                  <Tooltip title={tooltipText || ''} arrow>
                    <li {...props} key={option.id} style={{ opacity: canSelect ? 1 : 0.5 }}>
                      {label}
                    </li>
                  </Tooltip>
                );
              }}
              noOptionsText={!selectedProperty ? 'Please select a property first' : units.length === 0 ? 'No units available' : 'No units found'}
            />
          </Grid>

          {/* Optional Start and End Date Fields */}
          <Grid size={{ xs: 12, sm: 6 }}>
            <DatePicker
              label="Lease Start Date (optional)"
              value={startDate}
              onChange={(date) => onStartDateChange?.(date)}
              slotProps={{
                textField: {
                  fullWidth: true
                }
              }}
            />
          </Grid>

          <Grid size={{ xs: 12, sm: 6 }}>
            <DatePicker
              label="Lease End Date (optional)"
              value={endDate}
              onChange={(date) => onEndDateChange?.(date)}
              minDate={startDate || undefined}
              slotProps={{
                textField: {
                  fullWidth: true
                }
              }}
            />
          </Grid>
        </Grid>
      </Box>
    </LocalizationProvider>
  );
}

PropertyUnitSelector.propTypes = {
  selectedProperty: PropTypes.object,
  selectedUnit: PropTypes.object,
  onSelectProperty: PropTypes.func.isRequired,
  onSelectUnit: PropTypes.func.isRequired,
  canSelectProperty: PropTypes.func,
  canSelectUnit: PropTypes.func,
  getPropertyTooltip: PropTypes.func,
  getUnitTooltip: PropTypes.func,
  leaseNickname: PropTypes.string,
  onLeaseNicknameChange: PropTypes.func,
  startDate: PropTypes.instanceOf(Date),
  onStartDateChange: PropTypes.func,
  endDate: PropTypes.instanceOf(Date),
  onEndDateChange: PropTypes.func
};
