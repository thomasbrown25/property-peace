import { useState, useEffect, useRef } from 'react';
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
  InputAdornment,
  TablePagination,
  Tooltip,
  FormControlLabel
} from '@mui/material';
import { LocalizationProvider } from '@mui/x-date-pickers';
import { AdapterDateFns } from '@mui/x-date-pickers/AdapterDateFns';
import { DatePicker } from '@mui/x-date-pickers/DatePicker';
import { formatCurrency } from 'utils/formatters';
import { NumericFormat } from 'react-number-format';

// project imports
import { useDispatch, useSelector } from 'react-redux';
import { getUnits } from 'store/unit/unit.action';
import { selectUnits } from 'store/unit/unit.selector';
import { openSnackbar } from 'api/snackbar';
import useFetchProperties from 'hooks/useFetchProperties';
import FormNumberInput from 'components/input/FormNumberInput';

// Date helper functions
function firstOfNextMonth(date = new Date()) {
  const y = date.getFullYear();
  const m = date.getMonth();
  return new Date(y, m + 1, 1);
}

function addMonths(date, months) {
  const d = new Date(date.getTime());
  const day = d.getDate();
  d.setMonth(d.getMonth() + Number(months));
  if (d.getDate() !== day) d.setDate(0);
  return d;
}

// ==============================|| BULK LEASE TERMS STEP ||============================== //

export default function BulkLeaseTermsStep({ selectedUnits, onUpdateSelectedUnits }) {
  const dispatch = useDispatch();
  const { properties, isLoading } = useFetchProperties();
  const unitsFromStore = useSelector(selectUnits);
  const allUnits = Array.isArray(unitsFromStore) ? unitsFromStore : [];

  const [selectedProperty, setSelectedProperty] = useState(null);
  const [selectedUnitIds, setSelectedUnitIds] = useState(new Set());
  const [loadingUnits, setLoadingUnits] = useState(false);
  const [error, setError] = useState(null);
  const [page, setPage] = useState(0);
  const [rowsPerPage, setRowsPerPage] = useState(10);
  const [unitSearchValue, setUnitSearchValue] = useState('');
  const [selectedUnitForSearch, setSelectedUnitForSearch] = useState(null);

  // Lease terms state
  const defaultsSetRef = useRef(false);
  const getDefaultDates = () => {
    const start = firstOfNextMonth();
    const defaultLeaseLen = 12;
    const end = addMonths(start, defaultLeaseLen);
    return { startDate: start, endDate: end };
  };

  const [leaseTerms, setLeaseTerms] = useState(() => {
    const defaults = getDefaultDates();
    return {
      startDate: defaults.startDate,
      endDate: defaults.endDate,
      monthlyRent: null,
      securityDeposit: null,
      rentDueDay: 1,
      markPastPaymentsAsPaid: false
    };
  });

  // Set defaults on mount
  useEffect(() => {
    if (!defaultsSetRef.current) {
      const defaults = getDefaultDates();
      setLeaseTerms(prev => ({
        ...prev,
        startDate: defaults.startDate,
        endDate: defaults.endDate
      }));
      defaultsSetRef.current = true;
    }
  }, []);

  // Load units when property is selected
  useEffect(() => {
    if (selectedProperty?.id) {
      loadUnits(selectedProperty.id);
    }
  }, [selectedProperty?.id]);

  const loadUnits = async (propertyId) => {
    try {
      setLoadingUnits(true);
      setError(null);
      await dispatch(getUnits(propertyId));
    } catch (err) {
      const errorMessage = err.message || 'Failed to load units';
      setError(errorMessage);
      openSnackbar({
        open: true,
        message: errorMessage,
        variant: 'alert',
        alert: { color: 'error' }
      });
    } finally {
      setLoadingUnits(false);
    }
  };

  // Get units for selected property
  const getPropertyUnits = () => {
    if (!selectedProperty?.id) return [];
    
    const nestedUnits = selectedProperty.units || [];
    const flatUnits = allUnits.filter((u) => 
      u.propertyId === selectedProperty.id || !u.propertyId
    );
    
    const combined = [...nestedUnits, ...flatUnits];
    return combined.filter((u, index, self) => 
      index === self.findIndex((t) => t.id === u.id)
    );
  };

  const propertyUnits = getPropertyUnits();
  
  // Filter units based on search
  const filteredUnits = unitSearchValue
    ? propertyUnits.filter(unit => {
        const unitName = (unit.name || `Unit ${unit.id}`).toLowerCase();
        return unitName.includes(unitSearchValue.toLowerCase());
      })
    : propertyUnits;
  
  // Pagination
  const handleChangePage = (event, newPage) => {
    setPage(newPage);
  };

  const handleChangeRowsPerPage = (event) => {
    setRowsPerPage(parseInt(event.target.value, 10));
    setPage(0);
  };

  // Get paginated units
  const paginatedUnits = filteredUnits.length > 10 
    ? filteredUnits.slice(page * rowsPerPage, page * rowsPerPage + rowsPerPage)
    : filteredUnits;

  // Reset page when search changes
  useEffect(() => {
    setPage(0);
  }, [unitSearchValue]);

  // Check if unit is already in selectedUnits
  const isUnitInSelected = (unitId) => {
    return selectedUnits.some(u => u.unitId === unitId);
  };

  // Check if unit has an existing ACTIVE lease (not from selectedUnits)
  // Treat inactive/ended leases (isActive = 0/false) as if there's no lease
  const unitHasExistingLease = (unit) => {
    const lease = unit.lease || unit.Lease;
    if (!lease || typeof lease !== 'object' || !(lease.id || lease.Id)) {
      return false;
    }
    // Only consider it an existing lease if it's active
    // Handle both camelCase and PascalCase, and both boolean and numeric values
    const isActive = lease.isActive === true || 
                     lease.IsActive === true || 
                     lease.isActive === 1 || 
                     lease.IsActive === 1;
    return isActive;
  };

  // Get lease info for a unit (from selectedUnits or existing ACTIVE lease)
  const getUnitLeaseInfo = (unit) => {
    const selectedUnit = selectedUnits.find(u => u.unitId === unit.id);
    if (selectedUnit && selectedUnit.hasTermsApplied) {
      return {
        rentAmount: selectedUnit.leaseTerms.monthlyRent,
        startDate: selectedUnit.leaseTerms.startDate,
        endDate: selectedUnit.leaseTerms.endDate,
        rentDueDay: selectedUnit.leaseTerms.rentDueDay,
        hasTerms: true
      };
    }
    
    // Check if unit has existing ACTIVE lease (ignore inactive/ended leases)
    const lease = unit.lease || unit.Lease;
    if (lease) {
      // Only return lease info if the lease is active
      const isActive = lease.isActive === true || 
                       lease.IsActive === true || 
                       lease.isActive === 1 || 
                       lease.IsActive === 1;
      
      if (isActive) {
        return {
          rentAmount: lease.rentAmount || lease.RentAmount,
          startDate: lease.startDate || lease.StartDate,
          endDate: lease.endDate || lease.EndDate,
          rentDueDay: lease.rentDueDay || lease.RentDueDay,
          hasTerms: false
        };
      }
    }
    
    return null;
  };

  const handlePropertyChange = (event, newValue) => {
    setSelectedProperty(newValue);
    setSelectedUnitIds(new Set());
  };

  const handleUnitToggle = (unitId, unit) => {
    // Don't allow toggling if unit has existing lease
    if (unitHasExistingLease(unit)) {
      return;
    }
    const newSelected = new Set(selectedUnitIds);
    if (newSelected.has(unitId)) {
      newSelected.delete(unitId);
    } else {
      newSelected.add(unitId);
    }
    setSelectedUnitIds(newSelected);
  };

  const handleSelectAll = () => {
    // Only consider units without existing leases
    const selectableUnits = filteredUnits.filter(u => !unitHasExistingLease(u));
    const selectableUnitIds = new Set(selectableUnits.map(u => u.id));
    const allSelectableSelected = selectableUnits.length > 0 && selectableUnits.every(u => selectedUnitIds.has(u.id));
    
    if (allSelectableSelected) {
      // Deselect all selectable units
      const newSelected = new Set(selectedUnitIds);
      selectableUnitIds.forEach(id => newSelected.delete(id));
      setSelectedUnitIds(newSelected);
    } else {
      // Select all selectable units
      const newSelected = new Set(selectedUnitIds);
      selectableUnitIds.forEach(id => newSelected.add(id));
      setSelectedUnitIds(newSelected);
    }
  };

  const handleApplyTerms = () => {
    // Validate lease terms
    if (!leaseTerms.startDate || !leaseTerms.endDate || !leaseTerms.monthlyRent) {
      openSnackbar({
        open: true,
        message: 'Please fill in all required lease terms (Start Date, End Date, and Monthly Rent)',
        variant: 'alert',
        alert: { color: 'warning' },
        autoHideDuration: 3000
      });
      return;
    }

    if (selectedUnitIds.size === 0) {
      openSnackbar({
        open: true,
        message: 'Please select at least one unit',
        variant: 'alert',
        alert: { color: 'warning' },
        autoHideDuration: 3000
      });
      return;
    }

    // Apply terms to selected units
    const updatedUnits = [...selectedUnits];
    
    Array.from(selectedUnitIds).forEach(unitId => {
      const unit = propertyUnits.find(u => u.id === unitId);
      if (!unit) return;

      const existingIndex = updatedUnits.findIndex(u => u.unitId === unitId);
      const unitData = {
        unitId: unit.id,
        propertyId: selectedProperty.id,
        propertyName: selectedProperty.name,
        unitName: unit.name || `Unit ${unit.id}`,
        leaseTerms: {
          startDate: leaseTerms.startDate,
          endDate: leaseTerms.endDate,
          monthlyRent: leaseTerms.monthlyRent,
          securityDeposit: leaseTerms.securityDeposit || null,
          rentDueDay: leaseTerms.rentDueDay || 1,
          markPastPaymentsAsPaid: leaseTerms.markPastPaymentsAsPaid || false
        },
        tenants: [],
        hasTermsApplied: true
      };

      if (existingIndex >= 0) {
        // Update existing
        updatedUnits[existingIndex] = { ...updatedUnits[existingIndex], ...unitData };
      } else {
        // Add new
        updatedUnits.push(unitData);
      }
    });

    onUpdateSelectedUnits(updatedUnits);

    // Show success snackbar
    openSnackbar({
      open: true,
      message: `Successfully applied lease terms to ${selectedUnitIds.size} unit(s)`,
      variant: 'alert',
      alert: { color: 'success' },
      autoHideDuration: 3000
    });

    // Clear selection
    setSelectedUnitIds(new Set());
  };

  const handleLeaseTermsChange = (field, value) => {
    setLeaseTerms(prev => ({ ...prev, [field]: value }));
  };

  const handleStartDateChange = (date) => {
    if (!date || isNaN(new Date(date).getTime())) {
      handleLeaseTermsChange('startDate', null);
      return;
    }
    handleLeaseTermsChange('startDate', date);
    if (date && !leaseTerms.endDate) {
      const endDate = new Date(date);
      if (!isNaN(endDate.getTime())) {
        endDate.setFullYear(endDate.getFullYear() + 1);
        handleLeaseTermsChange('endDate', endDate);
      }
    }
  };

  const formatDate = (date) => {
    if (!date) return 'N/A';
    try {
      return new Date(date).toLocaleDateString();
    } catch {
      return 'N/A';
    }
  };

  return (
    <Box>
      <Typography variant="h5" sx={{ mb: 3 }}>
        Define Lease Terms for Multiple Units
      </Typography>
      <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
        Select a property, choose units, define lease terms, and apply them to selected units.
      </Typography>

      {error && (
        <Alert severity="error" sx={{ mb: 3 }} onClose={() => setError(null)}>
          {error}
        </Alert>
      )}

      <Grid container spacing={3}>
        {/* Property Selector */}
        <Grid size={{ xs: 12 }}>
          <Autocomplete
            options={Array.isArray(properties) ? properties : []}
            value={selectedProperty || null}
            onChange={handlePropertyChange}
            getOptionLabel={(option) => `${option.name} - ${option.streetAddress || ''}`}
            isOptionEqualToValue={(option, value) => option.id === value.id}
            loading={isLoading}
            renderInput={(params) => (
              <TextField
                {...params}
                label="Select Property *"
                required
              />
            )}
          />
        </Grid>

        {/* Lease Terms Form */}
        <Grid size={{ xs: 12 }}>
          <Typography variant="h6" sx={{ mb: 2, mt: 2 }}>
            Lease Terms
          </Typography>
        </Grid>

        <Grid size={{ xs: 12, md: 6 }}>
          <LocalizationProvider dateAdapter={AdapterDateFns}>
            <DatePicker
              label="Lease Start Date *"
              value={leaseTerms.startDate}
              onChange={handleStartDateChange}
              slotProps={{
                textField: {
                  fullWidth: true,
                  required: true
                }
              }}
            />
          </LocalizationProvider>
        </Grid>

        <Grid size={{ xs: 12, md: 6 }}>
          <LocalizationProvider dateAdapter={AdapterDateFns}>
            <DatePicker
              label="Lease End Date *"
              value={leaseTerms.endDate}
              onChange={(date) => handleLeaseTermsChange('endDate', date)}
              minDate={leaseTerms.startDate || undefined}
              slotProps={{
                textField: {
                  fullWidth: true,
                  required: true
                }
              }}
            />
          </LocalizationProvider>
        </Grid>

        <Grid size={{ xs: 12, md: 6 }}>
          <NumericFormat
            customInput={TextField}
            label="Monthly Rent *"
            value={leaseTerms.monthlyRent ?? ''}
            onValueChange={(values) => {
              handleLeaseTermsChange('monthlyRent', values.floatValue || null);
            }}
            thousandSeparator
            prefix="$"
            decimalScale={2}
            fixedDecimalScale
            allowNegative={false}
            fullWidth
            required
          />
        </Grid>

        <Grid size={{ xs: 12, md: 6 }}>
          <NumericFormat
            customInput={TextField}
            label="Security Deposit"
            value={leaseTerms.securityDeposit ?? ''}
            onValueChange={(values) => {
              handleLeaseTermsChange('securityDeposit', values.floatValue || null);
            }}
            thousandSeparator
            prefix="$"
            decimalScale={2}
            fixedDecimalScale
            allowNegative={false}
            fullWidth
          />
        </Grid>

        <Grid size={{ xs: 12, md: 6 }}>
          <FormNumberInput
            label="Rent Due Day"
            value={leaseTerms.rentDueDay ?? 1}
            onChange={(e) => {
              const val = e.target.value;
              const intVal = val === '' ? 1 : (isNaN(parseInt(val)) ? 1 : Math.max(1, Math.min(31, parseInt(val))));
              handleLeaseTermsChange('rentDueDay', intVal);
            }}
            inputProps={{ min: 1, max: 31 }}
            fullWidth
            helperText="Day of the month when rent is due (1-31)"
          />
        </Grid>

        {/* Mark Past Payments as Paid - only show if start date is in the past */}
        {leaseTerms.startDate && new Date(leaseTerms.startDate) < new Date() && (
          <Grid size={{ xs: 12 }}>
            <FormControlLabel
              control={
                <Checkbox
                  checked={leaseTerms.markPastPaymentsAsPaid || false}
                  onChange={(e) => handleLeaseTermsChange('markPastPaymentsAsPaid', e.target.checked)}
                />
              }
              label={
                <>
                  <Typography variant="body2" fontWeight={500}>
                    Mark all past payments as paid
                  </Typography>
                  <Typography variant="caption" color="text.secondary" display="block" sx={{ ml: 4.5 }}>
                    Automatically create payment records for all rent periods from the lease start date to today
                  </Typography>
                </>
              }
            />
          </Grid>
        )}

        {/* Units Table */}
        {selectedProperty && (
          <Grid size={{ xs: 12 }}>
            <Box sx={{ mt: 3 }}>
              <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 2 }}>
                <Typography variant="h6">
                  Units for {selectedProperty.name}
                </Typography>
                {filteredUnits.length > 0 && (
                  <Button
                    size="small"
                    onClick={handleSelectAll}
                    variant="outlined"
                  >
                    {selectedUnitIds.size === filteredUnits.length && filteredUnits.every(u => selectedUnitIds.has(u.id)) ? 'Deselect All' : 'Select All'}
                  </Button>
                )}
              </Stack>

              {loadingUnits ? (
                <Box display="flex" justifyContent="center" p={3}>
                  <CircularProgress />
                </Box>
              ) : propertyUnits.length === 0 ? (
                <Alert severity="info">No units found for this property.</Alert>
              ) : (
                <>
                  <Box sx={{ mb: 2 }}>
                    <Autocomplete
                      size="small"
                      options={propertyUnits}
                      value={selectedUnitForSearch}
                      onChange={(event, newValue) => {
                        setSelectedUnitForSearch(newValue);
                        if (newValue) {
                          setUnitSearchValue(newValue.name || `Unit ${newValue.id}`);
                          // Scroll to the unit in the table if paginated
                          const unitIndex = filteredUnits.findIndex(u => u.id === newValue.id);
                          if (unitIndex >= 0) {
                            const targetPage = Math.floor(unitIndex / rowsPerPage);
                            setPage(targetPage);
                          }
                        } else {
                          setUnitSearchValue('');
                        }
                      }}
                      inputValue={unitSearchValue}
                      onInputChange={(event, newInputValue) => {
                        setUnitSearchValue(newInputValue);
                        if (!newInputValue) {
                          setSelectedUnitForSearch(null);
                        }
                      }}
                      getOptionLabel={(option) => option.name || `Unit ${option.id}`}
                      isOptionEqualToValue={(option, value) => option.id === value.id}
                      renderInput={(params) => (
                        <TextField
                          {...params}
                          placeholder="Search for a unit..."
                          label="Search Unit"
                        />
                      )}
                      sx={{ maxWidth: 400 }}
                    />
                  </Box>

                  <TableContainer component={Paper} variant="outlined">
                    <Table>
                      <TableHead>
                        <TableRow>
                          <TableCell padding="checkbox">
                            <Checkbox
                              indeterminate={
                                filteredUnits.filter(u => !unitHasExistingLease(u)).length > 0 &&
                                selectedUnitIds.size > 0 &&
                                selectedUnitIds.size < filteredUnits.filter(u => !unitHasExistingLease(u)).length
                              }
                              checked={
                                filteredUnits.filter(u => !unitHasExistingLease(u)).length > 0 &&
                                filteredUnits.filter(u => !unitHasExistingLease(u)).every(u => selectedUnitIds.has(u.id))
                              }
                              onChange={handleSelectAll}
                            />
                          </TableCell>
                          <TableCell>Unit Name</TableCell>
                          <TableCell align="center">Bed</TableCell>
                          <TableCell align="center">Bath</TableCell>
                          <TableCell align="right">Sqft</TableCell>
                          <TableCell align="right">Rent Amount</TableCell>
                          <TableCell>Start Date</TableCell>
                          <TableCell>End Date</TableCell>
                          <TableCell align="center">Rent Due Day</TableCell>
                        </TableRow>
                      </TableHead>
                      <TableBody>
                        {paginatedUnits.map((unit) => {
                          const isSelected = selectedUnitIds.has(unit.id);
                          const isInSelected = isUnitInSelected(unit.id);
                          const leaseInfo = getUnitLeaseInfo(unit);
                          const hasAppliedTerms = selectedUnits.find(u => u.unitId === unit.id)?.hasTermsApplied || false;
                          const hasExistingLease = unitHasExistingLease(unit);

                          const tableRow = (
                            <TableRow
                              key={unit.id}
                              hover={!hasExistingLease}
                              selected={isSelected && !hasExistingLease}
                              onClick={() => !hasExistingLease && handleUnitToggle(unit.id, unit)}
                              sx={{
                                cursor: hasExistingLease ? 'not-allowed' : 'pointer',
                                ...(hasExistingLease && {
                                  bgcolor: 'success.lighter',
                                  opacity: 0.8,
                                  '&:hover': {
                                    bgcolor: 'success.light'
                                  }
                                }),
                                ...(hasAppliedTerms && !hasExistingLease && {
                                  bgcolor: 'success.lighter',
                                  '&:hover': {
                                    bgcolor: 'success.light'
                                  }
                                })
                              }}
                            >
                              <TableCell padding="checkbox" onClick={(e) => e.stopPropagation()}>
                                <Checkbox
                                  checked={isSelected}
                                  disabled={hasExistingLease}
                                  onChange={() => handleUnitToggle(unit.id, unit)}
                                />
                              </TableCell>
                              <TableCell>{unit.name || `Unit ${unit.id}`}</TableCell>
                              <TableCell align="center">{unit.bedrooms ?? unit.Bedrooms ?? 'N/A'}</TableCell>
                              <TableCell align="center">{unit.baths ?? unit.Baths ?? 'N/A'}</TableCell>
                              <TableCell align="right">
                                {unit.squareFeet || unit.SquareFeet ? `${unit.squareFeet || unit.SquareFeet}` : 'N/A'}
                              </TableCell>
                              <TableCell align="right">
                                {leaseInfo ? formatCurrency(leaseInfo.rentAmount) : 'N/A'}
                              </TableCell>
                              <TableCell>{leaseInfo ? formatDate(leaseInfo.startDate) : 'N/A'}</TableCell>
                              <TableCell>{leaseInfo ? formatDate(leaseInfo.endDate) : 'N/A'}</TableCell>
                              <TableCell align="center">
                                {leaseInfo ? leaseInfo.rentDueDay || 'N/A' : 'N/A'}
                              </TableCell>
                            </TableRow>
                          );

                          if (hasExistingLease) {
                            return (
                              <Tooltip key={unit.id} title="This unit already has a lease" arrow>
                                {tableRow}
                              </Tooltip>
                            );
                          }

                          return tableRow;
                        })}
                      </TableBody>
                    </Table>
                  </TableContainer>

                  {filteredUnits.length > 10 && (
                    <TablePagination
                      component="div"
                      count={filteredUnits.length}
                      page={page}
                      onPageChange={handleChangePage}
                      rowsPerPage={rowsPerPage}
                      onRowsPerPageChange={handleChangeRowsPerPage}
                      rowsPerPageOptions={[10, 25, 50]}
                    />
                  )}

                  <Box sx={{ mt: 2, display: 'flex', justifyContent: 'flex-end' }}>
                    <Button
                      variant="contained"
                      onClick={handleApplyTerms}
                      disabled={
                        selectedUnitIds.size === 0 || 
                        !leaseTerms.monthlyRent || 
                        !leaseTerms.rentDueDay ||
                        leaseTerms.rentDueDay < 1 ||
                        leaseTerms.rentDueDay > 31
                      }
                      size="small"
                    >
                      Apply Lease Terms to Selected Units ({selectedUnitIds.size})
                    </Button>
                  </Box>
                </>
              )}
            </Box>
          </Grid>
        )}

        {/* Summary of Applied Units */}
        {selectedUnits.length > 0 && (
          <Grid size={{ xs: 12 }}>
            <Alert severity="success" sx={{ mt: 2 }}>
              <Typography variant="subtitle2" sx={{ mb: 0.5 }}>
                {selectedUnits.filter(u => u.hasTermsApplied).length} unit(s) have lease terms applied
              </Typography>
              <Typography variant="body2">
                You can select a different property to add more units, or proceed to the next step.
              </Typography>
            </Alert>
          </Grid>
        )}
      </Grid>
    </Box>
  );
}

BulkLeaseTermsStep.propTypes = {
  selectedUnits: PropTypes.array.isRequired,
  onUpdateSelectedUnits: PropTypes.func.isRequired
};
