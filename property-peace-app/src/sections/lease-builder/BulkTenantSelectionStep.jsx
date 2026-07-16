import { useState, useEffect } from 'react';
import PropTypes from 'prop-types';

// material-ui
import {
  Box,
  Typography,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Paper,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Chip,
  Checkbox,
  ListItemText,
  Alert,
  CircularProgress
} from '@mui/material';

// project imports
import { useSelector } from 'react-redux';
import { selectTenants } from 'store/tenant/tenant.selector';
import useFetchAllTenants from 'hooks/useFetchAllTenants';

// ==============================|| BULK TENANT SELECTION STEP ||============================== //

export default function BulkTenantSelectionStep({ selectedUnits, onUpdateSelectedUnits }) {
  const { isLoading } = useFetchAllTenants();
  const allTenants = useSelector(selectTenants) || [];
  const [availableTenants, setAvailableTenants] = useState([]);

  // Filter tenants to show only those who are not currently on an active lease
  useEffect(() => {
    if (allTenants && allTenants.length > 0) {
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      
      const filtered = allTenants.filter(tenant => {
        const leaseId = tenant.leaseId || tenant.LeaseId;
        const leaseStartDate = tenant.leaseStartDate || tenant.LeaseStartDate;
        const leaseEndDate = tenant.leaseEndDate || tenant.LeaseEndDate;
        
        // If tenant has no lease, include them
        if (!leaseId) {
          return true;
        }
        
        // If no lease dates, exclude
        if (!leaseStartDate || !leaseEndDate) {
          return false;
        }
        
        const startDate = new Date(leaseStartDate);
        const endDate = new Date(leaseEndDate);
        startDate.setHours(0, 0, 0, 0);
        endDate.setHours(0, 0, 0, 0);
        
        // Include only if lease has ended
        return endDate < today;
      });
      
      setAvailableTenants(filtered);
    } else {
      setAvailableTenants([]);
    }
  }, [allTenants]);

  // Get units with applied lease terms
  const unitsWithTerms = selectedUnits.filter(u => u.hasTermsApplied);

  const handleTenantChange = (unitId, tenantIds) => {
    const updatedUnits = selectedUnits.map(unit => {
      if (unit.unitId === unitId) {
        const selectedTenants = availableTenants.filter(t => tenantIds.includes(t.id));
        return {
          ...unit,
          tenants: selectedTenants
        };
      }
      return unit;
    });
    onUpdateSelectedUnits(updatedUnits);
  };

  const getSelectedTenantIds = (unitId) => {
    const unit = selectedUnits.find(u => u.unitId === unitId);
    return unit?.tenants ? unit.tenants.map(t => t.id) : [];
  };

  // Get tenant IDs that are already selected in other units (excluding the specified unitId)
  const getTenantIdsSelectedInOtherUnits = (excludeUnitId) => {
    const selectedTenantIds = new Set();
    selectedUnits.forEach(unit => {
      if (unit.unitId !== excludeUnitId && unit.tenants && unit.tenants.length > 0) {
        unit.tenants.forEach(tenant => {
          selectedTenantIds.add(tenant.id);
        });
      }
    });
    return selectedTenantIds;
  };

  // Check if a tenant is already selected in another unit
  const isTenantSelectedInOtherUnit = (tenantId, currentUnitId) => {
    const selectedInOtherUnits = getTenantIdsSelectedInOtherUnits(currentUnitId);
    return selectedInOtherUnits.has(tenantId);
  };

  if (isLoading) {
    return (
      <Box display="flex" justifyContent="center" alignItems="center" minHeight="400px">
        <CircularProgress />
      </Box>
    );
  }

  if (unitsWithTerms.length === 0) {
    return (
      <Box>
        <Typography variant="h5" sx={{ mb: 3 }}>
          Select Tenants (Optional)
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
        Select Tenants (Optional)
      </Typography>
      <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
        Assign tenants to units. You can skip this step and assign tenants later.
      </Typography>

      {availableTenants.length === 0 ? (
        <Alert severity="warning" sx={{ mb: 3 }}>
          No tenants available. You can create tenants later and assign them to leases.
        </Alert>
      ) : (
        <TableContainer component={Paper} variant="outlined">
          <Table>
            <TableHead>
              <TableRow>
                <TableCell>Unit</TableCell>
                <TableCell>Property</TableCell>
                <TableCell>Tenants</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {unitsWithTerms.map((unit) => {
                const selectedTenantIds = getSelectedTenantIds(unit.unitId);

                return (
                  <TableRow key={unit.unitId}>
                    <TableCell>{unit.unitName}</TableCell>
                    <TableCell>{unit.propertyName}</TableCell>
                    <TableCell>
                      <FormControl fullWidth size="small">
                        <InputLabel>Select Tenants</InputLabel>
                        <Select
                          multiple
                          value={selectedTenantIds}
                          label="Select Tenants"
                          onChange={(e) => handleTenantChange(unit.unitId, e.target.value)}
                          renderValue={(selected) => (
                            <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5 }}>
                              {selected.map((id) => {
                                const tenant = availableTenants.find(t => t.id === id);
                                return tenant ? (
                                  <Chip
                                    key={id}
                                    label={`${tenant.firstname || tenant.Firstname || ''} ${tenant.lastname || tenant.Lastname || ''}`}
                                    size="small"
                                  />
                                ) : null;
                              })}
                            </Box>
                          )}
                        >
                          {availableTenants.map((tenant) => {
                            const isSelected = selectedTenantIds.includes(tenant.id);
                            const isSelectedInOtherUnit = isTenantSelectedInOtherUnit(tenant.id, unit.unitId);
                            const isDisabled = isSelectedInOtherUnit && !isSelected;

                            return (
                              <MenuItem 
                                key={tenant.id} 
                                value={tenant.id}
                                disabled={isDisabled}
                              >
                                <Checkbox checked={isSelected} />
                                <ListItemText
                                  primary={`${tenant.firstname || tenant.Firstname || ''} ${tenant.lastname || tenant.Lastname || ''}`}
                                  secondary={isDisabled ? `${tenant.email || tenant.phoneNumber} (Already assigned to another unit)` : (tenant.email || tenant.phoneNumber)}
                                />
                              </MenuItem>
                            );
                          })}
                        </Select>
                      </FormControl>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </TableContainer>
      )}

      <Alert severity="info" sx={{ mt: 3 }}>
        <Typography variant="body2">
          You can proceed without selecting tenants. Tenants can be assigned to leases later.
        </Typography>
      </Alert>
    </Box>
  );
}

BulkTenantSelectionStep.propTypes = {
  selectedUnits: PropTypes.array.isRequired,
  onUpdateSelectedUnits: PropTypes.func.isRequired
};
