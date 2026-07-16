import { useState, useEffect, useMemo } from 'react';
import PropTypes from 'prop-types';

// material-ui
import {
  Box,
  Typography,
  Grid,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Paper,
  Checkbox,
  Button,
  Stack,
  Autocomplete,
  TextField,
  Chip,
  CircularProgress,
  Alert
} from '@mui/material';
import axiosServices from 'utils/axios';

// ==============================|| RECIPIENT SELECTOR ||============================== //

export default function RecipientSelector({
  selectedOrganizations,
  selectedProperties,
  selectedUnits,
  onPropertiesChange,
  onUnitsChange,
  showEmptyWhenNoOrgs = false
}) {
  const [properties, setProperties] = useState([]);
  const [units, setUnits] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [selectedPropertyFilter, setSelectedPropertyFilter] = useState(null);
  const [selectedUnitFilter, setSelectedUnitFilter] = useState(null);

  // Fetch properties for selected organizations
  useEffect(() => {
    const fetchPropertiesAndUnits = async () => {
      if (selectedOrganizations.size === 0) {
        setProperties([]);
        setUnits([]);
        return;
      }

      setLoading(true);
      setError(null);

      try {
        // Fetch properties for all selected organizations
        // We need to set organization ID in header for each request
        const propertyPromises = Array.from(selectedOrganizations).map(async (orgId) => {
          try {
            // Create a custom axios instance with organization header for this specific request
            const response = await axiosServices.get(`/api/property/list`, {
              headers: {
                'X-Organization-Id': orgId.toString()
              }
            });
            if (response.data?.success && response.data?.data) {
              const props = Array.isArray(response.data.data) ? response.data.data : [];
              // Only return properties that belong to this organization
              return props
                .filter(p => !p.organizationId || p.organizationId === orgId)
                .map(p => ({ ...p, organizationId: orgId }));
            }
            return [];
          } catch (err) {
            console.error(`Error fetching properties for org ${orgId}:`, err);
            return [];
          }
        });

        const propertyResults = await Promise.all(propertyPromises);
        const allProperties = propertyResults.flat();
        // Remove duplicates in case same property appears in multiple orgs (shouldn't happen, but just in case)
        const uniqueProperties = Array.from(
          new Map(allProperties.map(p => [p.id, p])).values()
        );
        setProperties(uniqueProperties);

        // Fetch units for all properties
        // Group properties by organization to set correct header
        const unitPromises = allProperties.map(async (property) => {
          try {
            const response = await axiosServices.get(`/api/unit/${property.id}`, {
              headers: {
                'X-Organization-Id': property.organizationId.toString()
              }
            });
            if (response.data?.success && response.data?.data) {
              const unitList = Array.isArray(response.data.data) ? response.data.data : [];
              return unitList.map(u => ({
                ...u,
                propertyId: property.id,
                propertyName: property.name,
                organizationId: property.organizationId
              }));
            }
            return [];
          } catch (err) {
            console.error(`Error fetching units for property ${property.id}:`, err);
            return [];
          }
        });

        const unitResults = await Promise.all(unitPromises);
        const allUnits = unitResults.flat();
        setUnits(allUnits);
      } catch (err) {
        setError(err.message || 'Failed to load properties and units');
        console.error('Error fetching properties/units:', err);
      } finally {
        setLoading(false);
      }
    };

    fetchPropertiesAndUnits();
  }, [selectedOrganizations]);

  // Filter properties by selected property
  const filteredProperties = useMemo(() => {
    if (!selectedPropertyFilter) return properties;
    return properties.filter(p => p.id === selectedPropertyFilter.id);
  }, [properties, selectedPropertyFilter]);

  // Filter units by selected unit and property
  const filteredUnits = useMemo(() => {
    let filtered = units;
    
    // Filter by selected property if a property is selected
    if (selectedPropertyFilter) {
      filtered = filtered.filter(u => u.propertyId === selectedPropertyFilter.id);
    }
    
    // Filter by selected unit if a unit is selected
    if (selectedUnitFilter) {
      filtered = filtered.filter(u => u.id === selectedUnitFilter.id);
    }
    
    return filtered;
  }, [units, selectedPropertyFilter, selectedUnitFilter]);

  const handlePropertyToggle = (propertyId) => {
    const newSelected = new Set(selectedProperties);
    const newSelectedUnits = new Set(selectedUnits);
    const unitsForProperty = units.filter(u => u.propertyId === propertyId);
    
    if (newSelected.has(propertyId)) {
      // Unselecting property - also deselect all units for this property
      newSelected.delete(propertyId);
      unitsForProperty.forEach(u => newSelectedUnits.delete(u.id));
    } else {
      // Selecting property - auto-select all units for this property
      newSelected.add(propertyId);
      unitsForProperty.forEach(u => newSelectedUnits.add(u.id));
    }
    onPropertiesChange(newSelected);
    onUnitsChange(newSelectedUnits);
  };

  const handleUnitToggle = (unitId) => {
    const newSelected = new Set(selectedUnits);
    const unit = units.find(u => u.id === unitId);
    
    if (newSelected.has(unitId)) {
      // Unselecting unit
      newSelected.delete(unitId);
      
      // If all units for this property are now unselected, unselect the property
      if (unit) {
        const unitsForProperty = units.filter(u => u.propertyId === unit.propertyId);
        const hasAnySelectedUnits = unitsForProperty.some(u => newSelected.has(u.id));
        if (!hasAnySelectedUnits && selectedProperties.has(unit.propertyId)) {
          const newSelectedProperties = new Set(selectedProperties);
          newSelectedProperties.delete(unit.propertyId);
          onPropertiesChange(newSelectedProperties);
        }
      }
    } else {
      // Selecting unit
      newSelected.add(unitId);
      
      // If unit's property is not selected, select it
      if (unit && !selectedProperties.has(unit.propertyId)) {
        const newSelectedProperties = new Set(selectedProperties);
        newSelectedProperties.add(unit.propertyId);
        onPropertiesChange(newSelectedProperties);
      }
    }
    onUnitsChange(newSelected);
  };

  const handleSelectAllProperties = () => {
    if (filteredProperties.length > 0 && filteredProperties.every(p => selectedProperties.has(p.id))) {
      // Deselect all filtered properties
      const newSelected = new Set(selectedProperties);
      filteredProperties.forEach(p => newSelected.delete(p.id));
      onPropertiesChange(newSelected);
      // Also deselect units from deselected properties
      const unitsToDeselect = units.filter(u => filteredProperties.some(p => p.id === u.propertyId));
      const newSelectedUnits = new Set(selectedUnits);
      unitsToDeselect.forEach(u => newSelectedUnits.delete(u.id));
      onUnitsChange(newSelectedUnits);
    } else {
      // Select all filtered properties
      const newSelected = new Set(selectedProperties);
      filteredProperties.forEach(p => newSelected.add(p.id));
      onPropertiesChange(newSelected);
    }
  };

  const handleSelectAllUnits = () => {
    if (filteredUnits.length > 0 && filteredUnits.every(u => selectedUnits.has(u.id))) {
      // Deselect all filtered units
      const newSelected = new Set(selectedUnits);
      filteredUnits.forEach(u => newSelected.delete(u.id));
      onUnitsChange(newSelected);
    } else {
      // Select all filtered units
      const newSelected = new Set(selectedUnits);
      filteredUnits.forEach(u => newSelected.add(u.id));
      onUnitsChange(newSelected);
    }
  };

  const handleSelectAllFromAllOrgs = () => {
    const allPropertyIds = new Set(properties.map(p => p.id));
    const allUnitIds = new Set(units.map(u => u.id));

    if (selectedProperties.size === properties.length && selectedUnits.size === units.length) {
      // Deselect all
      onPropertiesChange(new Set());
      onUnitsChange(new Set());
    } else {
      // Select all properties and their units
      onPropertiesChange(allPropertyIds);
      onUnitsChange(allUnitIds);
    }
  };

  if (selectedOrganizations.size === 0 && !showEmptyWhenNoOrgs) {
    return (
      <Box>
        <Alert severity="info">
          Please select at least one organization to view properties and units.
        </Alert>
      </Box>
    );
  }

  return (
    <Box>
      <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 2 }}>
        <Typography variant="h6">
          Select Recipients
        </Typography>
        {selectedOrganizations.size > 0 && (
          <Button
            variant="outlined"
            size="small"
            onClick={handleSelectAllFromAllOrgs}
            disabled={properties.length === 0 || loading}
          >
            {selectedProperties.size === properties.length && selectedUnits.size === units.length
              ? 'Deselect All'
              : 'Select All Properties & Units from All Organizations'}
          </Button>
        )}
      </Stack>

      {selectedOrganizations.size === 0 && showEmptyWhenNoOrgs ? (
        <Alert severity="info" sx={{ mt: 2 }}>
          Select organizations above to view and select properties and units.
        </Alert>
      ) : loading ? (
        <Box display="flex" justifyContent="center" alignItems="center" p={4}>
          <Stack spacing={2} alignItems="center">
            <CircularProgress />
            <Typography variant="body2" color="text.secondary">
              Loading properties and units...
            </Typography>
          </Stack>
        </Box>
      ) : error ? (
        <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>
      ) : (
        <Stack spacing={3}>
          {/* Properties Section */}
          <Box>
            <Box sx={{ mb: 2 }}>
              <Autocomplete
                options={properties}
                value={selectedPropertyFilter}
                onChange={(event, newValue) => {
                  setSelectedPropertyFilter(newValue);
                  // Clear unit filter when property changes
                  setSelectedUnitFilter(null);
                }}
                getOptionLabel={(option) => {
                  if (!option) return '';
                  const address = option.streetAddress?.trim();
                  return address ? `${option.name} - ${address}` : option.name || '';
                }}
                isOptionEqualToValue={(option, value) => option.id === value.id}
                renderInput={(params) => (
                  <TextField
                    {...params}
                    label="Search or Select Property"
                    placeholder="Type to search properties..."
                    size="small"
                  />
                )}
                renderOption={(props, option) => {
                  const address = option.streetAddress?.trim();
                  const label = address ? `${option.name} - ${address}` : option.name || '';
                  return (
                    <li {...props} key={option.id}>
                      {label}
                    </li>
                  );
                }}
              />
            </Box>
            <Box sx={{ mb: 1, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <Typography variant="subtitle2">
                Properties ({filteredProperties.length})
              </Typography>
              <Button
                size="small"
                variant="outlined"
                onClick={handleSelectAllProperties}
                disabled={filteredProperties.length === 0}
              >
                {filteredProperties.length > 0 && filteredProperties.every(p => selectedProperties.has(p.id))
                  ? 'Deselect All'
                  : 'Select All'}
              </Button>
            </Box>
            <TableContainer component={Paper} variant="outlined" sx={{ maxHeight: 400, overflow: 'auto' }}>
              <Table size="small" stickyHeader>
                <TableHead>
                  <TableRow>
                    <TableCell padding="checkbox" width={50}>
                      <Checkbox
                        checked={filteredProperties.length > 0 && filteredProperties.every(p => selectedProperties.has(p.id))}
                        indeterminate={selectedProperties.size > 0 && !filteredProperties.every(p => selectedProperties.has(p.id))}
                        onChange={handleSelectAllProperties}
                      />
                    </TableCell>
                    <TableCell>Property Name</TableCell>
                    <TableCell>Address</TableCell>
                    <TableCell align="center">Units</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {filteredProperties.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={4} align="center" sx={{ py: 3 }}>
                        <Typography variant="body2" color="text.secondary">
                          {selectedPropertyFilter ? 'No properties match your selection' : 'No properties found'}
                        </Typography>
                      </TableCell>
                    </TableRow>
                  ) : (
                    filteredProperties.map((property) => {
                      const isSelected = selectedProperties.has(property.id);
                      const unitCount = units.filter(u => u.propertyId === property.id).length;
                      return (
                        <TableRow
                          key={property.id}
                          hover
                          selected={isSelected}
                          onClick={() => handlePropertyToggle(property.id)}
                          sx={{ cursor: 'pointer' }}
                        >
                          <TableCell padding="checkbox" onClick={(e) => e.stopPropagation()}>
                            <Checkbox
                              checked={isSelected}
                              onChange={() => handlePropertyToggle(property.id)}
                            />
                          </TableCell>
                          <TableCell>{property.name}</TableCell>
                          <TableCell>{property.streetAddress || 'N/A'}</TableCell>
                          <TableCell align="center">{unitCount}</TableCell>
                        </TableRow>
                      );
                    })
                  )}
                </TableBody>
              </Table>
            </TableContainer>
          </Box>

          {/* Units Section */}
          <Box>
            <Box sx={{ mb: 2 }}>
              <Autocomplete
                options={units}
                value={selectedUnitFilter}
                onChange={(event, newValue) => {
                  setSelectedUnitFilter(newValue);
                }}
                getOptionLabel={(option) => {
                  if (!option) return '';
                  const unitName = option.name || `Unit ${option.id}`;
                  const propertyName = option.propertyName || 'N/A';
                  return `${unitName} - ${propertyName}`;
                }}
                isOptionEqualToValue={(option, value) => option.id === value.id}
                renderInput={(params) => (
                  <TextField
                    {...params}
                    label="Search or Select Unit"
                    placeholder="Type to search units..."
                    size="small"
                  />
                )}
                renderOption={(props, option) => {
                  const unitName = option.name || `Unit ${option.id}`;
                  const propertyName = option.propertyName || 'N/A';
                  return (
                    <li {...props} key={option.id}>
                      {unitName} - {propertyName}
                    </li>
                  );
                }}
              />
            </Box>
            <Box sx={{ mb: 1, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <Typography variant="subtitle2">
                Units ({filteredUnits.length})
              </Typography>
              <Button
                size="small"
                variant="outlined"
                onClick={handleSelectAllUnits}
                disabled={filteredUnits.length === 0}
              >
                {filteredUnits.length > 0 && filteredUnits.every(u => selectedUnits.has(u.id))
                  ? 'Deselect All'
                  : 'Select All'}
              </Button>
            </Box>
            <TableContainer component={Paper} variant="outlined" sx={{ maxHeight: 400, overflow: 'auto' }}>
              <Table size="small" stickyHeader>
                <TableHead>
                  <TableRow>
                    <TableCell padding="checkbox" width={50}>
                      <Checkbox
                        checked={filteredUnits.length > 0 && filteredUnits.every(u => selectedUnits.has(u.id))}
                        indeterminate={selectedUnits.size > 0 && !filteredUnits.every(u => selectedUnits.has(u.id))}
                        onChange={handleSelectAllUnits}
                      />
                    </TableCell>
                    <TableCell>Unit Name</TableCell>
                    <TableCell>Property</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {filteredUnits.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={3} align="center" sx={{ py: 3 }}>
                        <Typography variant="body2" color="text.secondary">
                          {selectedUnitFilter || selectedPropertyFilter ? 'No units match your selection' : 'No units found'}
                        </Typography>
                      </TableCell>
                    </TableRow>
                  ) : (
                    filteredUnits.map((unit) => {
                      const isSelected = selectedUnits.has(unit.id);
                      return (
                        <TableRow
                          key={unit.id}
                          hover
                          selected={isSelected}
                          onClick={() => handleUnitToggle(unit.id)}
                          sx={{ cursor: 'pointer' }}
                        >
                          <TableCell padding="checkbox" onClick={(e) => e.stopPropagation()}>
                            <Checkbox
                              checked={isSelected}
                              onChange={() => handleUnitToggle(unit.id)}
                            />
                          </TableCell>
                          <TableCell>{unit.name || `Unit ${unit.id}`}</TableCell>
                          <TableCell>{unit.propertyName || 'N/A'}</TableCell>
                        </TableRow>
                      );
                    })
                  )}
                </TableBody>
              </Table>
            </TableContainer>
          </Box>
        </Stack>
      )}

      <Box sx={{ mt: 2 }}>
        <Typography variant="body2" color="text.secondary">
          Selected: {selectedProperties.size} property(ies), {selectedUnits.size} unit(s)
        </Typography>
      </Box>
    </Box>
  );
}

RecipientSelector.propTypes = {
  selectedOrganizations: PropTypes.instanceOf(Set).isRequired,
  selectedProperties: PropTypes.instanceOf(Set).isRequired,
  selectedUnits: PropTypes.instanceOf(Set).isRequired,
  onPropertiesChange: PropTypes.func.isRequired,
  onUnitsChange: PropTypes.func.isRequired,
  showEmptyWhenNoOrgs: PropTypes.bool
};
