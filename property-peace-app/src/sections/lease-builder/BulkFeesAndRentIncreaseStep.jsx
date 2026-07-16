import { useState, useEffect } from 'react';
import PropTypes from 'prop-types';

// material-ui
import {
  Box,
  Typography,
  Grid,
  TextField,
  Button,
  Stack,
  Card,
  CardContent,
  IconButton,
  Chip,
  Divider,
  Checkbox,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Paper,
  InputAdornment,
  Alert
} from '@mui/material';
import { LocalizationProvider } from '@mui/x-date-pickers';
import { AdapterDateFns } from '@mui/x-date-pickers/AdapterDateFns';
import { DatePicker } from '@mui/x-date-pickers/DatePicker';
import { PlusOutlined, DeleteOutlined, EditOutlined, CheckOutlined } from '@ant-design/icons';

// project imports
import FormInput from 'components/input/FormInput';
import FormNumberInput from 'components/input/FormNumberInput';
import FormSelect from 'components/input/FormSelect';
import { openSnackbar } from 'api/snackbar';
import { formatCurrency } from 'utils/formatters';

// Generic fee types
const GENERIC_FEES = [
  'Pet Fee',
  'Application Fee',
  'Processing Fee',
  'Admin Fee',
  'Move-in Fee',
  'Cleaning Fee',
  'Parking Fee',
  'Storage Fee',
  'Late Fee',
  'Utility Fee'
];

// ==============================|| BULK FEES AND RENT INCREASE STEP ||============================== //

export default function BulkFeesAndRentIncreaseStep({ selectedUnits, onUpdateSelectedUnits }) {
  // Get units with applied lease terms
  const unitsWithTerms = selectedUnits.filter(u => u.hasTermsApplied);
  
  // State for selected units (default none selected)
  const [selectedUnitIds, setSelectedUnitIds] = useState(() => {
    return new Set();
  });

  // State for managing fees per unit
  const [unitFees, setUnitFees] = useState(() => {
    const feesMap = {};
    unitsWithTerms.forEach(unit => {
      feesMap[unit.unitId] = unit.fees || [];
    });
    return feesMap;
  });

  // State for rent increases per unit
  const [unitRentIncreases, setUnitRentIncreases] = useState(() => {
    const increasesMap = {};
    unitsWithTerms.forEach(unit => {
      increasesMap[unit.unitId] = {
        rentIncreaseType: unit.leaseTerms?.rentIncreaseType || '',
        rentIncreaseValue: unit.leaseTerms?.rentIncreaseValue || null,
        rentIncreaseInterval: unit.leaseTerms?.rentIncreaseInterval || null
      };
    });
    return increasesMap;
  });

  // State for fee form
  const [feeForm, setFeeForm] = useState({
    name: '',
    amount: null,
    dueDate: null
  });
  const [showFeeForm, setShowFeeForm] = useState(false);
  const [editingFee, setEditingFee] = useState(null); // { unitId, feeId }
  const [feeFormForUnit, setFeeFormForUnit] = useState(null); // unitId for adding new fee

  // Get current date in local time
  const getCurrentDate = () => {
    const now = new Date();
    return new Date(now.getFullYear(), now.getMonth(), now.getDate());
  };

  // Handle unit selection toggle
  const handleUnitToggle = (unitId) => {
    const newSelected = new Set(selectedUnitIds);
    if (newSelected.has(unitId)) {
      newSelected.delete(unitId);
    } else {
      newSelected.add(unitId);
    }
    setSelectedUnitIds(newSelected);
  };

  // Handle select all
  const handleSelectAll = () => {
    if (selectedUnitIds.size === unitsWithTerms.length) {
      setSelectedUnitIds(new Set());
    } else {
      setSelectedUnitIds(new Set(unitsWithTerms.map(u => u.unitId)));
    }
  };

  // Handle adding generic fee - opens form
  const handleAddGenericFee = (feeName) => {
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

    setFeeForm({
      name: feeName,
      amount: null,
      dueDate: getCurrentDate()
    });
    setEditingFee(null);
    setFeeFormForUnit(null); // null means apply to all selected units
    setShowFeeForm(true);
  };

  // Handle starting custom fee form
  const handleStartCustomFee = (unitId = null) => {
    setFeeForm({
      name: '',
      amount: null,
      dueDate: getCurrentDate()
    });
    setEditingFee(null);
    setFeeFormForUnit(unitId);
    setShowFeeForm(true);
  };

  // Handle editing fee
  const handleEditFee = (unitId, fee) => {
    setFeeForm({
      name: fee.name,
      amount: fee.amount || null,
      dueDate: fee.dueDate || getCurrentDate()
    });
    setEditingFee({ unitId, feeId: fee.id });
    setFeeFormForUnit(unitId);
    setShowFeeForm(true);
  };

  // Handle saving fee
  const handleSaveFee = () => {
    if (!feeForm.name.trim()) {
      return;
    }

    const newFeesMap = { ...unitFees };

    if (editingFee) {
      // Update existing fee
      const existingFees = newFeesMap[editingFee.unitId] || [];
      newFeesMap[editingFee.unitId] = existingFees.map(f =>
        f.id === editingFee.feeId
          ? {
              ...f,
              name: feeForm.name.trim(),
              amount: feeForm.amount,
              dueDate: feeForm.dueDate || getCurrentDate()
            }
          : f
      );
    } else if (feeFormForUnit) {
      // Add to specific unit
      const existingFees = newFeesMap[feeFormForUnit] || [];
      const newFee = {
        id: Date.now() + Math.random(),
        name: feeForm.name.trim(),
        amount: feeForm.amount,
        dueDate: feeForm.dueDate || getCurrentDate()
      };
      newFeesMap[feeFormForUnit] = [...existingFees, newFee];
    } else if (selectedUnitIds.size > 0) {
      // Add to all selected units
      Array.from(selectedUnitIds).forEach(unitId => {
        const existingFees = newFeesMap[unitId] || [];
        const newFee = {
          id: Date.now() + Math.random(),
          name: feeForm.name.trim(),
          amount: feeForm.amount,
          dueDate: feeForm.dueDate || getCurrentDate()
        };
        newFeesMap[unitId] = [...existingFees, newFee];
      });
    } else {
      openSnackbar({
        open: true,
        message: 'Please select at least one unit',
        variant: 'alert',
        alert: { color: 'warning' },
        autoHideDuration: 3000
      });
      return;
    }

    setUnitFees(newFeesMap);
    setFeeForm({ name: '', amount: null, dueDate: null });
    setEditingFee(null);
    setFeeFormForUnit(null);
    setShowFeeForm(false);
  };

  // Handle canceling fee form
  const handleCancelFee = () => {
    setFeeForm({ name: '', amount: null, dueDate: null });
    setEditingFee(null);
    setFeeFormForUnit(null);
    setShowFeeForm(false);
  };

  // Handle removing fee
  const handleRemoveFee = (unitId, feeId) => {
    const newFeesMap = { ...unitFees };
    const existingFees = newFeesMap[unitId] || [];
    newFeesMap[unitId] = existingFees.filter(f => f.id !== feeId);
    setUnitFees(newFeesMap);
  };


  // Handle rent increase change
  const handleRentIncreaseChange = (unitId, field, value) => {
    const newIncreases = { ...unitRentIncreases };
    if (!newIncreases[unitId]) {
      newIncreases[unitId] = {
        rentIncreaseType: '',
        rentIncreaseValue: null,
        rentIncreaseInterval: null
      };
    }
    newIncreases[unitId] = {
      ...newIncreases[unitId],
      [field]: value
    };
    
    // Clear value and interval when type is cleared
    if (field === 'rentIncreaseType' && !value) {
      newIncreases[unitId].rentIncreaseValue = null;
      newIncreases[unitId].rentIncreaseInterval = null;
    }
    
    setUnitRentIncreases(newIncreases);
  };

  // Get used fee names for a unit
  const getUsedFeeNames = (unitId) => {
    const fees = unitFees[unitId] || [];
    return fees.map(f => f.name.toLowerCase());
  };

  // Apply changes to selectedUnits
  useEffect(() => {
    const updatedUnits = selectedUnits.map(unit => {
      if (!unit.hasTermsApplied) return unit;
      
      return {
        ...unit,
        fees: unitFees[unit.unitId] || [],
        leaseTerms: {
          ...unit.leaseTerms,
          rentIncreaseType: unitRentIncreases[unit.unitId]?.rentIncreaseType || '',
          rentIncreaseValue: unitRentIncreases[unit.unitId]?.rentIncreaseValue || null,
          rentIncreaseInterval: unitRentIncreases[unit.unitId]?.rentIncreaseInterval || null
        }
      };
    });
    onUpdateSelectedUnits(updatedUnits);
  }, [unitFees, unitRentIncreases]);

  if (unitsWithTerms.length === 0) {
    return (
      <Box>
        <Typography variant="h5" sx={{ mb: 3 }}>
          Fees & Rent Increases
        </Typography>
        <Alert severity="info">
          Please go back to the previous step and apply lease terms to at least one unit.
        </Alert>
      </Box>
    );
  }

  return (
    <Box>
      <Typography variant="h5" sx={{ mb: 1 }}>
        Fees & Rent Increases
      </Typography>
      <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
        Add fees and configure rent increases for selected units. Select units to apply fees to multiple units at once.
      </Typography>

      {/* Unit Selection */}
      <Box sx={{ mb: 4 }}>
        <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 2 }}>
          <Typography variant="subtitle1" fontWeight={600}>
            Select Units ({selectedUnitIds.size} of {unitsWithTerms.length} selected)
          </Typography>
          <Button
            size="small"
            onClick={handleSelectAll}
            variant="outlined"
          >
            {selectedUnitIds.size === unitsWithTerms.length ? 'Deselect All' : 'Select All'}
          </Button>
        </Stack>

        <TableContainer component={Paper} variant="outlined">
          <Table>
            <TableHead>
              <TableRow>
                <TableCell padding="checkbox">
                  <Checkbox
                    indeterminate={
                      selectedUnitIds.size > 0 && selectedUnitIds.size < unitsWithTerms.length
                    }
                    checked={
                      unitsWithTerms.length > 0 && selectedUnitIds.size === unitsWithTerms.length
                    }
                    onChange={handleSelectAll}
                  />
                </TableCell>
                <TableCell>Unit</TableCell>
                <TableCell>Property</TableCell>
                <TableCell align="right">Rent</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {unitsWithTerms.map((unit) => (
                <TableRow
                  key={unit.unitId}
                  hover
                  selected={selectedUnitIds.has(unit.unitId)}
                  onClick={() => handleUnitToggle(unit.unitId)}
                  sx={{ cursor: 'pointer' }}
                >
                  <TableCell padding="checkbox" onClick={(e) => e.stopPropagation()}>
                    <Checkbox
                      checked={selectedUnitIds.has(unit.unitId)}
                      onChange={() => handleUnitToggle(unit.unitId)}
                    />
                  </TableCell>
                  <TableCell>{unit.unitName}</TableCell>
                  <TableCell>{unit.propertyName}</TableCell>
                  <TableCell align="right">
                    {formatCurrency(unit.leaseTerms.monthlyRent)}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </TableContainer>
      </Box>

      <Divider sx={{ my: 4 }} />

      {/* Fees Section */}
      <Box sx={{ mb: 4 }}>
        <Typography variant="h6" sx={{ mb: 2 }}>
          Fees
        </Typography>
        <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
          Add fees to selected units. Fees will be applied to all currently selected units.
        </Typography>

        {/* Generic Fee Selection */}
        <Box sx={{ mb: 3 }}>
          <Typography variant="subtitle2" sx={{ mb: 1.5, fontWeight: 600 }}>
            Common Fees
          </Typography>
          <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap>
            {GENERIC_FEES.map((feeName) => {
              // Check if this fee is used in all selected units
              const isUsedInAllSelected = Array.from(selectedUnitIds).every(unitId => {
                const usedNames = getUsedFeeNames(unitId);
                return usedNames.includes(feeName.toLowerCase());
              });
              
              if (isUsedInAllSelected) return null;
              
              return (
                <Chip
                  key={feeName}
                  label={feeName}
                  onClick={() => handleAddGenericFee(feeName)}
                  clickable
                  disabled={selectedUnitIds.size === 0}
                  sx={{
                    cursor: selectedUnitIds.size > 0 ? 'pointer' : 'default',
                    '&:hover': {
                      bgcolor: selectedUnitIds.size > 0 ? 'primary.lighter' : 'default',
                      color: selectedUnitIds.size > 0 ? 'primary.main' : 'default'
                    }
                  }}
                />
              );
            })}
          </Stack>
        </Box>

        {/* Add/Edit Fee Form */}
        {showFeeForm && (
          <Card variant="outlined" sx={{ mb: 3 }}>
            <CardContent>
              <Typography variant="subtitle1" sx={{ mb: 2, fontWeight: 600 }}>
                {editingFee ? 'Edit Fee' : 'Add Fee'}
                {feeFormForUnit && !editingFee && (
                  <Typography variant="body2" color="text.secondary" component="span" sx={{ ml: 1 }}>
                    ({unitsWithTerms.find(u => u.unitId === feeFormForUnit)?.unitName})
                  </Typography>
                )}
                {!feeFormForUnit && !editingFee && (
                  <Typography variant="body2" color="text.secondary" component="span" sx={{ ml: 1 }}>
                    ({selectedUnitIds.size} selected unit(s))
                  </Typography>
                )}
              </Typography>
              <Grid container spacing={2} alignItems="center">
                <Grid size={{ xs: 12, md: 3 }}>
                  <Box>
                    <Typography variant="body2" sx={{ mb: 1, fontWeight: 500 }}>
                      Fee Name *
                    </Typography>
                    <TextField
                      label=""
                      value={feeForm.name}
                      onChange={(e) => setFeeForm({ ...feeForm, name: e.target.value })}
                      fullWidth
                      required
                      autoFocus
                      size="small"
                    />
                  </Box>
                </Grid>
                <Grid size={{ xs: 12, md: 4 }}>
                  <Box>
                    <Typography variant="body2" sx={{ mb: 1, fontWeight: 500 }}>
                      Amount
                    </Typography>
                    <FormInput
                      name="fee-amount-form"
                      label=""
                      value={feeForm.amount ?? ''}
                      valueType="currency"
                      setFieldValue={(name, value) => {
                        setFeeForm({ ...feeForm, amount: value });
                      }}
                      fullWidth
                      size="small"
                    />
                  </Box>
                </Grid>
                <Grid size={{ xs: 12, md: 5 }}>
                  <Box>
                    <Typography variant="body2" sx={{ mb: 1, fontWeight: 500 }}>
                      Due Date
                    </Typography>
                    <LocalizationProvider dateAdapter={AdapterDateFns}>
                      <DatePicker
                        value={feeForm.dueDate || getCurrentDate()}
                        onChange={(date) => {
                          setFeeForm({ ...feeForm, dueDate: date || getCurrentDate() });
                        }}
                        slotProps={{
                          textField: {
                            fullWidth: true,
                            size: 'small'
                          }
                        }}
                      />
                    </LocalizationProvider>
                  </Box>
                </Grid>
              </Grid>
              <Grid container spacing={2} sx={{ mt: 0.5 }}>
                <Grid size={{ xs: 0, md: 7 }} />
                <Grid size={{ xs: 12, md: 5 }}>
                  <Box sx={{ display: 'flex', justifyContent: 'flex-end' }}>
                    <Button
                      variant="outlined"
                      onClick={handleCancelFee}
                      sx={{ mr: 1 }}
                    >
                      Cancel
                    </Button>
                    <Button
                      variant="contained"
                      onClick={handleSaveFee}
                      disabled={!feeForm.name.trim()}
                      startIcon={<CheckOutlined />}
                    >
                      Save
                    </Button>
                  </Box>
                </Grid>
              </Grid>
            </CardContent>
          </Card>
        )}

        {/* Add Custom Fee Button */}
        {!showFeeForm && (
          <Box sx={{ mb: 3 }}>
            <Button
              variant="outlined"
              startIcon={<PlusOutlined />}
              onClick={() => handleStartCustomFee(null)}
              disabled={selectedUnitIds.size === 0}
            >
              Add Custom Fee to Selected Units
            </Button>
          </Box>
        )}

        {/* Fees per Unit */}
        {unitsWithTerms.map((unit) => {
          const fees = unitFees[unit.unitId] || [];
          if (fees.length === 0) return null;

          return (
            <Card key={unit.unitId} variant="outlined" sx={{ mb: 2 }}>
              <CardContent>
                <Typography variant="subtitle2" fontWeight={600} sx={{ mb: 2 }}>
                  {unit.unitName} - {unit.propertyName}
                </Typography>
                <Stack spacing={1}>
                  {fees.map((fee) => (
                    <Card key={fee.id} variant="outlined" sx={{ bgcolor: 'background.default' }}>
                      <CardContent sx={{ py: 1.5 }}>
                        <Stack direction="row" spacing={2} alignItems="center" justifyContent="space-between">
                          <Box sx={{ flex: 1 }}>
                            <Typography variant="subtitle2" fontWeight={600} sx={{ mb: 0.5 }}>
                              {fee.name}
                            </Typography>
                            <Stack direction="row" spacing={2}>
                              <Typography variant="body2" color="text.secondary">
                                Amount: {fee.amount ? formatCurrency(fee.amount) : 'Not set'}
                              </Typography>
                              <Typography variant="body2" color="text.secondary">
                                Due: {fee.dueDate ? new Date(fee.dueDate).toLocaleDateString() : 'Not set'}
                              </Typography>
                            </Stack>
                          </Box>
                          <Stack direction="row" spacing={0.5}>
                            <IconButton
                              onClick={() => handleEditFee(unit.unitId, fee)}
                              color="primary"
                              size="small"
                            >
                              <EditOutlined />
                            </IconButton>
                            <IconButton
                              onClick={() => handleRemoveFee(unit.unitId, fee.id)}
                              color="error"
                              size="small"
                            >
                              <DeleteOutlined />
                            </IconButton>
                          </Stack>
                        </Stack>
                      </CardContent>
                    </Card>
                  ))}
                </Stack>
              </CardContent>
            </Card>
          );
        })}
      </Box>

      <Divider sx={{ my: 4 }} />

      {/* Rent Increases Section */}
      <Box>
        <Typography variant="h6" sx={{ mb: 2 }}>
          Rent Increases
        </Typography>
        <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
          Configure automatic rent increases for each unit individually.
        </Typography>

        <Stack spacing={3}>
          {unitsWithTerms.map((unit) => {
            const rentIncrease = unitRentIncreases[unit.unitId] || {
              rentIncreaseType: '',
              rentIncreaseValue: null,
              rentIncreaseInterval: null
            };

            return (
              <Card key={unit.unitId} variant="outlined">
                <CardContent>
                  <Typography variant="subtitle2" fontWeight={600} sx={{ mb: 2 }}>
                    {unit.unitName} - {unit.propertyName}
                  </Typography>
                  <Typography variant="body2" sx={{ mb: 2, fontWeight: 500 }}>
                    Would you like to add an automatic rent increase?
                  </Typography>
                  
                  <Grid container spacing={2}>
                    <Grid size={{ xs: 12, md: 6 }}>
                      <FormSelect
                        name={`rentIncreaseType-${unit.unitId}`}
                        label="Increase Type"
                        value={rentIncrease.rentIncreaseType || ''}
                        valueType="string"
                        onChange={(e) => {
                          handleRentIncreaseChange(unit.unitId, 'rentIncreaseType', e.target.value);
                        }}
                        options={[
                          { value: '', label: 'None' },
                          { value: 'percentage', label: 'Percentage Increase' },
                          { value: 'amount', label: 'Fixed Dollar Amount' }
                        ]}
                        placeholder="Select increase type"
                        fullWidth
                      />
                    </Grid>

                    {/* Show value input only when type is selected */}
                    {rentIncrease.rentIncreaseType && (
                      <>
                        <Grid size={{ xs: 12, md: 6 }}>
                          {rentIncrease.rentIncreaseType === 'percentage' ? (
                            <FormNumberInput
                              name={`rentIncreaseValue-${unit.unitId}`}
                              label="Increase Percentage"
                              value={rentIncrease.rentIncreaseValue ?? ''}
                              onChange={(e) => {
                                const val = e.target.value;
                                const numVal = val === '' ? null : (isNaN(parseFloat(val)) ? null : parseFloat(val));
                                handleRentIncreaseChange(unit.unitId, 'rentIncreaseValue', numVal);
                              }}
                              InputProps={{
                                endAdornment: <InputAdornment position="end">%</InputAdornment>
                              }}
                              fullWidth
                              min={0}
                              max={100}
                              step={0.1}
                            />
                          ) : (
                            <FormInput
                              name={`rentIncreaseValue-${unit.unitId}`}
                              label="Increase Amount"
                              value={rentIncrease.rentIncreaseValue ?? ''}
                              valueType="currency"
                              setFieldValue={(name, value) => {
                                handleRentIncreaseChange(unit.unitId, 'rentIncreaseValue', value);
                              }}
                              fullWidth
                            />
                          )}
                        </Grid>

                        <Grid size={{ xs: 12, md: 6 }}>
                          <FormSelect
                            name={`rentIncreaseInterval-${unit.unitId}`}
                            label="Increase Frequency"
                            value={rentIncrease.rentIncreaseInterval || ''}
                            onChange={(e) => {
                              handleRentIncreaseChange(unit.unitId, 'rentIncreaseInterval', e.target.value ? Number(e.target.value) : null);
                            }}
                            options={[
                              { value: '', label: 'Select frequency' },
                              { value: 1, label: 'Monthly' },
                              { value: 2, label: 'Every 2 months' },
                              { value: 3, label: 'Quarterly (every 3 months)' },
                              { value: 4, label: 'Every 4 months' },
                              { value: 6, label: 'Semi-annually (every 6 months)' },
                              { value: 12, label: 'Annually (every 12 months)' }
                            ]}
                            placeholder="Select frequency"
                            fullWidth
                          />
                        </Grid>
                      </>
                    )}
                  </Grid>
                </CardContent>
              </Card>
            );
          })}
        </Stack>
      </Box>
    </Box>
  );
}

BulkFeesAndRentIncreaseStep.propTypes = {
  selectedUnits: PropTypes.array.isRequired,
  onUpdateSelectedUnits: PropTypes.func.isRequired
};
