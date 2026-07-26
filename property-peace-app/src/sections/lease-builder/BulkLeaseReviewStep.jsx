import { useState } from 'react';
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
  Alert,
  CircularProgress,
  Chip,
  Button,
  Stack,
  Divider
} from '@mui/material';
import { CheckCircleOutlined } from '@ant-design/icons';

// project imports
import axiosServices from 'utils/axios';
import { openSnackbar } from 'api/snackbar';
import store from '../../store';
import { formatCurrency } from 'utils/formatters';
import { getActiveOrganizationId } from 'utils/impersonationSession';

// ==============================|| BULK LEASE REVIEW STEP ||============================== //

export default function BulkLeaseReviewStep({ selectedUnits, onComplete, onError, onLoading, onShowSuccessDialog }) {
  const [creating, setCreating] = useState(false);
  const [createdLeaseIds, setCreatedLeaseIds] = useState([]);

  // Get units with applied lease terms
  const unitsWithTerms = selectedUnits.filter(u => u.hasTermsApplied);

  // Group units by property
  const unitsByProperty = unitsWithTerms.reduce((acc, unit) => {
    const key = unit.propertyId;
    if (!acc[key]) {
      acc[key] = {
        propertyId: unit.propertyId,
        propertyName: unit.propertyName,
        units: []
      };
    }
    acc[key].units.push(unit);
    return acc;
  }, {});

  const propertyGroups = Object.values(unitsByProperty);

  const formatDate = (date) => {
    if (!date) return 'N/A';
    try {
      return new Date(date).toLocaleDateString();
    } catch {
      return 'N/A';
    }
  };

  const calculateLeaseLength = (startDate, endDate) => {
    if (!startDate || !endDate) return 0;
    try {
      const start = new Date(startDate);
      const end = new Date(endDate);
      const monthsDiff = (end.getFullYear() - start.getFullYear()) * 12 + (end.getMonth() - start.getMonth());
      return monthsDiff || 12;
    } catch {
      return 12;
    }
  };

  const handleCreateLeases = async () => {
    if (unitsWithTerms.length === 0) {
      onError('No units with lease terms to create');
      return;
    }

    setCreating(true);
    onLoading(true);
    onError(null);

    let successful = [];
    let successfulLeaseIds = [];

    try {
      // Get organization ID
      const state = store.getState();
      const currentOrganizationId = getActiveOrganizationId(state?.auth?.user) ||
                                    propertyGroups[0]?.propertyId;

      const leasePromises = unitsWithTerms.map(async (unit) => {
        const startDate = new Date(unit.leaseTerms.startDate);
        const endDate = new Date(unit.leaseTerms.endDate);
        const monthsDiff = calculateLeaseLength(startDate, endDate);

        const leaseData = {
          Id: 0, // New lease
          UnitId: unit.unitId,
          PropertyId: unit.propertyId,
          OrganizationId: currentOrganizationId ? parseInt(currentOrganizationId) : null,
          StartDate: startDate,
          EndDate: endDate,
          RentAmount: unit.leaseTerms.monthlyRent || 0,
          DepositAmount: unit.leaseTerms.securityDeposit || 0,
          RentDueDay: unit.leaseTerms.rentDueDay || 1,
          RentFrequency: 'Monthly',
          LeaseLength: monthsDiff || 12,
          CustomDateSelected: true,
          IsActive: true,
          MarkPastPaymentsAsPaid: unit.leaseTerms.markPastPaymentsAsPaid || false,
          // Rent Increase fields
          RentIncreaseType: unit.leaseTerms.rentIncreaseType || null,
          RentIncreaseValue: unit.leaseTerms.rentIncreaseValue || null,
          RentIncreaseInterval: unit.leaseTerms.rentIncreaseInterval || null,
          // Fees
          Fees: unit.fees && unit.fees.length > 0 ? unit.fees.map(fee => ({
            Id: 0, // New fee
            LeaseId: 0, // Will be set by backend
            Name: fee.name,
            Amount: fee.amount || 0,
            DueDate: fee.dueDate ? new Date(fee.dueDate) : new Date()
          })) : []
        };

        try {
          const leaseResponse = await axiosServices.post('/api/lease', leaseData);
          
          // Check response format - handle both { success, data } and direct data
          const responseData = leaseResponse.data?.data || leaseResponse.data;
          const isSuccess = leaseResponse.data?.success !== false && responseData;
          
          if (!isSuccess || !responseData) {
            const errorMsg = leaseResponse.data?.message || 
                           leaseResponse.data?.errors?.message || 
                           leaseResponse.data?.error ||
                           'Failed to create lease';
            console.error('Lease creation failed for unit:', unit.unitName, errorMsg, leaseResponse.data);
            throw new Error(errorMsg);
          }
          
          const leaseId = responseData.id || responseData.Id || responseData?.data?.id;
          if (!leaseId) {
            console.error('No lease ID in response for unit:', unit.unitName, leaseResponse.data);
            throw new Error('Lease created but no ID returned');
          }
          
          return {
            success: true,
            leaseId: leaseId,
            unitName: unit.unitName
          };
        } catch (err) {
          console.error('Error creating lease for unit:', unit.unitName, err);
          return {
            success: false,
            error: err.response?.data?.message || err.message || 'Failed to create lease',
            unitName: unit.unitName
          };
        }
      });

      const results = await Promise.all(leasePromises);
      successful = results.filter(r => r.success);
      const failed = results.filter(r => !r.success);

      console.log('Lease creation results:', { successful: successful.length, failed: failed.length, results });

      successfulLeaseIds = successful.map(r => r.leaseId).filter(id => id); // Filter out any undefined IDs

      if (successful.length > 0 && successfulLeaseIds.length > 0) {
        // Store lease IDs for potential use
        setCreatedLeaseIds(successfulLeaseIds);
        
        // Stop loading first
        setCreating(false);
        onLoading(false);
        
        // Notify parent to show success dialog (dialog rendered at parent level)
        if (onShowSuccessDialog) {
          setTimeout(() => {
            console.log('Opening success dialog for', successful.length, 'leases');
            onShowSuccessDialog(successful.length, successfulLeaseIds);
          }, 100);
        }
        // Don't call onComplete here - let the dialog handle it when closed
        return; // Exit early to skip finally block
      } else {
        const errorMsg = failed.length > 0 
          ? `Failed to create all leases: ${failed.map(f => `${f.unitName} - ${f.error}`).join(', ')}`
          : 'Failed to create leases';
        onError(errorMsg);
        openSnackbar({
          open: true,
          message: errorMsg,
          variant: 'alert',
          alert: { color: 'error' },
          autoHideDuration: 5000
        });
      }
    } catch (err) {
      const errorMsg = err.message || 'Error creating leases';
      onError(errorMsg);
      openSnackbar({
        open: true,
        message: errorMsg,
        variant: 'alert',
        alert: { color: 'error' },
        autoHideDuration: 5000
      });
    } finally {
      // Only reset loading if we didn't successfully create leases (success case returns early)
      if (successful.length === 0 || successfulLeaseIds.length === 0) {
        setCreating(false);
        onLoading(false);
      }
    }
  };

  if (unitsWithTerms.length === 0) {
    return (
      <Box>
        <Typography variant="h5" sx={{ mb: 3 }}>
          Review & Confirm
        </Typography>
        <Alert severity="warning">
          No units with lease terms found. Please go back to the previous step and apply lease terms to at least one unit.
        </Alert>
      </Box>
    );
  }

  return (
    <Box>
      <Typography variant="h5" sx={{ mb: 1 }}>
        Review & Confirm
      </Typography>
      <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
        Review the lease details for all units. Click "Create All Leases" to finalize.
      </Typography>

      {propertyGroups.map((group, groupIndex) => (
        <Box key={group.propertyId} sx={{ mb: 4 }}>
          <Typography variant="h6" sx={{ mb: 2 }}>
            {group.propertyName}
          </Typography>
          <TableContainer component={Paper} variant="outlined">
            <Table>
              <TableHead>
                <TableRow>
                  <TableCell>Unit</TableCell>
                  <TableCell align="right">Rent Amount</TableCell>
                  <TableCell>Start Date</TableCell>
                  <TableCell>End Date</TableCell>
                  <TableCell align="center">Rent Due Day</TableCell>
                  <TableCell>Tenants</TableCell>
                  <TableCell>Fees</TableCell>
                  <TableCell>Rent Increase</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {group.units.map((unit) => {
                  const tenantNames = unit.tenants && unit.tenants.length > 0
                    ? unit.tenants.map(t => `${t.firstname || t.Firstname || ''} ${t.lastname || t.Lastname || ''}`).join(', ')
                    : 'No tenants assigned';

                  const fees = unit.fees || [];
                  const rentIncrease = unit.leaseTerms?.rentIncreaseType
                    ? `${unit.leaseTerms.rentIncreaseType === 'percentage' ? `${unit.leaseTerms.rentIncreaseValue || 0}%` : formatCurrency(unit.leaseTerms.rentIncreaseValue || 0)} every ${unit.leaseTerms.rentIncreaseInterval === 1 ? 'month' : unit.leaseTerms.rentIncreaseInterval === 3 ? 'quarter' : unit.leaseTerms.rentIncreaseInterval === 6 ? '6 months' : unit.leaseTerms.rentIncreaseInterval === 12 ? 'year' : `${unit.leaseTerms.rentIncreaseInterval} months`}`
                    : 'None';

                  return (
                    <TableRow key={unit.unitId}>
                      <TableCell>{unit.unitName}</TableCell>
                      <TableCell align="right">
                        {formatCurrency(unit.leaseTerms.monthlyRent)}
                      </TableCell>
                      <TableCell>{formatDate(unit.leaseTerms.startDate)}</TableCell>
                      <TableCell>{formatDate(unit.leaseTerms.endDate)}</TableCell>
                      <TableCell align="center">{unit.leaseTerms.rentDueDay || 1}</TableCell>
                      <TableCell>
                        {unit.tenants && unit.tenants.length > 0 ? (
                          <Stack direction="row" spacing={0.5} flexWrap="wrap">
                            {unit.tenants.map((tenant, idx) => (
                              <Chip
                                key={tenant.id || idx}
                                label={`${tenant.firstname || tenant.Firstname || ''} ${tenant.lastname || tenant.Lastname || ''}`}
                                size="small"
                                variant="outlined"
                              />
                            ))}
                          </Stack>
                        ) : (
                          <Typography variant="body2" color="text.secondary">
                            {tenantNames}
                          </Typography>
                        )}
                      </TableCell>
                      <TableCell>
                        {fees.length > 0 ? (
                          <Stack spacing={0.5}>
                            {fees.map((fee, idx) => (
                              <Typography key={fee.id || idx} variant="body2">
                                {fee.name}: {formatCurrency(fee.amount || 0)}
                              </Typography>
                            ))}
                          </Stack>
                        ) : (
                          <Typography variant="body2" color="text.secondary">
                            No fees
                          </Typography>
                        )}
                      </TableCell>
                      <TableCell>
                        <Typography variant="body2">
                          {rentIncrease}
                        </Typography>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </TableContainer>
        </Box>
      ))}

      <Divider sx={{ my: 3 }} />

      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <Typography variant="body2" color="text.secondary">
          Total: {unitsWithTerms.length} unit(s) ready to create
        </Typography>
        <Button
          variant="contained"
          size="small"
          onClick={handleCreateLeases}
          disabled={creating || unitsWithTerms.length === 0}
          startIcon={creating ? <CircularProgress size={20} /> : <CheckCircleOutlined />}
        >
          {creating ? 'Creating Leases...' : 'Create All Leases'}
        </Button>
      </Box>
    </Box>
  );
}

BulkLeaseReviewStep.propTypes = {
  selectedUnits: PropTypes.array.isRequired,
  onComplete: PropTypes.func.isRequired,
  onError: PropTypes.func.isRequired,
  onLoading: PropTypes.func.isRequired,
  onShowSuccessDialog: PropTypes.func
};
