import { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import PropTypes from 'prop-types';

// material-ui
import {
  Box,
  Button,
  Typography,
  Stack,
  Alert,
  CircularProgress,
  alpha,
  useTheme,
  Dialog,
  DialogContent,
  DialogActions
} from '@mui/material';
import { LinkOutlined } from '@ant-design/icons';

// project imports
import PropertyUnitSelector from './PropertyUnitSelector';
import axiosServices from 'utils/axios';
import { openSnackbar } from 'api/snackbar';
import { tenantInviteAPI, checklistAPI } from 'api';
import store from '../../store';
import { useSelector, useDispatch } from 'react-redux';
import { selectProperties } from 'store/property/property.selector';
import { selectUnits } from 'store/unit/unit.selector';
import { getUnits } from 'store/unit/unit.action';
import useFetchProperties from 'hooks/useFetchProperties';
import LeaseCreatedSuccessDialog from 'components/dialogs/LeaseCreatedSuccessDialog';
import { getActiveOrganizationId } from 'utils/impersonationSession';

// ==============================|| LEASE BUILDER WIZARD ||============================== //

export default function LeaseBuilderWizard({ leaseId, onComplete, initialPropertyId, initialUnitId }) {
  const navigate = useNavigate();
  const dispatch = useDispatch();
  const theme = useTheme();
  const { id } = useParams();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  
  // Wizard state
  const [selectedProperty, setSelectedProperty] = useState(null);
  const [selectedUnit, setSelectedUnit] = useState(null);
  const [leaseNickname, setLeaseNickname] = useState('');
  const [selectedTenants, setSelectedTenants] = useState([]);
  const [startDate, setStartDate] = useState(null);
  const [endDate, setEndDate] = useState(null);
  const [leaseTerms, setLeaseTerms] = useState({
    startDate: null,
    endDate: null,
    monthlyRent: null,
    securityDeposit: null,
    rentDueDay: 1,
    markPastPaymentsAsPaid: false
  });
  const [fees, setFees] = useState([]);
  
  // Completion dialog state
  const [creatingLease, setCreatingLease] = useState(false);
  const [successDialogOpen, setSuccessDialogOpen] = useState(false);
  const [createdLease, setCreatedLease] = useState(null);

  // Inspection linking dialog state
  const [linkInspectionOpen, setLinkInspectionOpen] = useState(false);
  const [pendingInspections, setPendingInspections] = useState([]);
  const [linkingInspections, setLinkingInspections] = useState(false);

  // Get properties and units for auto-selection
  const { propertiesRefetch } = useFetchProperties();
  const properties = useSelector(selectProperties);
  const units = useSelector(selectUnits);

  // Auto-select property and unit when initial IDs are provided
  useEffect(() => {
    if (initialPropertyId && properties && properties.length > 0 && !selectedProperty) {
      const property = properties.find(p => p.id === initialPropertyId);
      if (property) {
        setSelectedProperty(property);
        // Load units for the selected property
        if (property.id) {
          dispatch(getUnits(property.id));
        }
      }
    }
  }, [initialPropertyId, properties, selectedProperty, dispatch]);

  // Auto-select unit when property is selected and initialUnitId is provided
  useEffect(() => {
    if (initialUnitId && selectedProperty && !selectedUnit) {
      // Wait a bit for units to load, then try to find the unit
      const findAndSelectUnit = () => {
        // Check units from Redux store
        const allUnits = Array.isArray(units) ? units : [];
        const unit = allUnits.find(u => u.id === initialUnitId && (u.propertyId === selectedProperty.id || !u.propertyId));
        
        if (unit) {
          setSelectedUnit(unit);
          return;
        }
        
        // Check if unit is in the property's nested units
        const nestedUnit = selectedProperty.units?.find(u => u.id === initialUnitId);
        if (nestedUnit) {
          setSelectedUnit(nestedUnit);
        }
      };

      // Try immediately
      findAndSelectUnit();
      
      // Also try after a short delay in case units are still loading
      const timeout = setTimeout(findAndSelectUnit, 500);
      return () => clearTimeout(timeout);
    }
  }, [initialUnitId, selectedProperty, selectedUnit, units]);

  // Update leaseTerms when startDate or endDate changes
  useEffect(() => {
    setLeaseTerms(prev => ({
      ...prev,
      startDate: startDate,
      endDate: endDate
    }));
  }, [startDate, endDate]);

  const handleCreateLease = async () => {
    setCreatingLease(true);
    setError(null);

    try {
      // Validate required fields
      if (!selectedUnit?.id || !selectedProperty?.id) {
        throw new Error('Property and Unit are required');
      }
      if (!leaseNickname || leaseNickname.trim().length === 0) {
        throw new Error('Lease nickname is required');
      }
      
      // Dates are optional, but if one is provided, validate both
      if ((startDate && !endDate) || (!startDate && endDate)) {
        throw new Error('Both start and end dates must be provided together, or leave both empty');
      }
      
      // If dates are provided, validate end date is after start date
      if (startDate && endDate) {
        const start = new Date(startDate);
        const end = new Date(endDate);
        if (end <= start) {
          throw new Error('End date must be after start date');
        }
      }

      // Calculate lease length in months (default to 12 if dates not provided)
      let monthsDiff = 12;
      if (leaseTerms.startDate && leaseTerms.endDate) {
        const start = new Date(leaseTerms.startDate);
        const end = new Date(leaseTerms.endDate);
        monthsDiff = (end.getFullYear() - start.getFullYear()) * 12 + (end.getMonth() - start.getMonth());
      }
      
      const state = store.getState();
      const currentOrganizationId = getActiveOrganizationId(state?.auth?.user) || selectedProperty?.organizationId;
      
      const leaseData = {
        Id: 0, // New lease
        UnitId: selectedUnit.id,
        PropertyId: selectedProperty.id,
        OrganizationId: currentOrganizationId ? parseInt(currentOrganizationId) : null,
        StartDate: leaseTerms.startDate ? new Date(leaseTerms.startDate) : null,
        EndDate: leaseTerms.endDate ? new Date(leaseTerms.endDate) : null,
        RentAmount: leaseTerms.monthlyRent || 0,
        DepositAmount: leaseTerms.securityDeposit || 0,
        RentDueDay: leaseTerms.rentDueDay || 1,
        RentFrequency: 'Monthly',
        LeaseLength: monthsDiff || 12,
        CustomDateSelected: !!(leaseTerms.startDate && leaseTerms.endDate),
        IsActive: true,
        MarkPastPaymentsAsPaid: leaseTerms.markPastPaymentsAsPaid || false,
        LeaseNickname: leaseNickname || '', // Lease nickname for identification
        SignatureStatus: 0, // NotSent - Create as draft lease
        // Rent Increase fields
        RentIncreaseType: leaseTerms.rentIncreaseType || null,
        RentIncreaseValue: leaseTerms.rentIncreaseValue || null,
        RentIncreaseInterval: leaseTerms.rentIncreaseInterval || null,
        // Fees
        Fees: fees && fees.length > 0 ? fees.map(fee => ({
          Id: 0, // New fee
          LeaseId: 0, // Will be set by backend
          Name: fee.name,
          Amount: fee.amount || 0,
          DueDate: fee.dueDate ? new Date(fee.dueDate) : new Date()
        })) : []
      };

      const leaseResponse = await axiosServices.post('/api/lease', leaseData);
      if (!leaseResponse.data.success || !leaseResponse.data.data) {
        const errorMsg = leaseResponse.data.message || leaseResponse.data.errors?.message || 'Failed to create lease';
        throw new Error(errorMsg);
      }

      const createdLeaseData = leaseResponse.data.data;
      const createdLeaseId = createdLeaseData.id;
      
      // Link selected tenants to the lease
      if (selectedTenants && selectedTenants.length > 0) {
        try {
          await Promise.all(
            selectedTenants.map(async (tenant) => {
              try {
                const tenantId = tenant.id || tenant.Id;
                if (!tenantId) return;
                
                // Update tenant to link to this lease
                const tenantPayload = {
                  Id: tenantId,
                  LeaseId: createdLeaseId,
                  UnitId: selectedUnit.id,
                  PropertyId: selectedProperty.id,
                  Firstname: tenant.firstname || tenant.Firstname || '',
                  Lastname: tenant.lastname || tenant.Lastname || '',
                  Email: tenant.email || tenant.Email || null,
                  PhoneNumber: tenant.phoneNumber || tenant.PhoneNumber || null,
                  UserId: tenant.userId || tenant.UserId || null
                };
                
                await axiosServices.put(`/api/tenant/${tenantId}`, tenantPayload);
                
                // If tenant was created during this workflow and has email but no account,
                // ensure invite was sent (it should have been sent when tenant was created)
                // If for some reason it wasn't sent, send it now
                const hasAccount = !!(tenant.userId || tenant.UserId);
                const hasEmail = !!(tenant.email || tenant.Email);
                if (!hasAccount && hasEmail) {
                  try {
                    // Check if invite already exists
                    const inviteCheck = await tenantInviteAPI.getInvitesByTenantId(tenantId);
                    const hasValidInvite = inviteCheck.success && inviteCheck.data && 
                      inviteCheck.data.some(inv => !inv.isUsed && new Date(inv.expiresAt) > new Date());
                    
                    // If no valid invite exists, send one now
                    if (!hasValidInvite) {
                      await tenantInviteAPI.createTenantInvite({
                        tenantId: tenantId,
                        email: tenant.email || tenant.Email
                      });
                    }
                  } catch (inviteError) {
                    console.error(`Error sending invite for tenant ${tenantId}:`, inviteError);
                    // Don't fail lease creation if invite fails
                  }
                }
              } catch (error) {
                console.error(`Error linking tenant ${tenant.id} to lease:`, error);
                // Don't fail lease creation if tenant linking fails
              }
            })
          );
        } catch (error) {
          console.error('Error linking tenants to lease:', error);
          // Don't fail lease creation if tenant linking fails
        }
      }
      
      // Store created lease data for success dialog
      setCreatedLease(createdLeaseData);

      // Check if existing unlinked inspections exist for this unit
      if (selectedUnit?.id) {
        try {
          const inspRes = await checklistAPI.getChecklistsByUnit(selectedUnit.id);
          if (inspRes?.success && inspRes.data?.length > 0) {
            const unlinked = inspRes.data.filter((c) => !c.leaseId);
            if (unlinked.length > 0) {
              setPendingInspections(unlinked);
              setLinkInspectionOpen(true);
              return; // success dialog shown after link dialog resolves
            }
          }
        } catch {
          // Don't block lease creation if inspection check fails
        }
      }

      // Show success dialog
      setSuccessDialogOpen(true);
    } catch (err) {
      setError(err.message || 'Error creating lease');
      openSnackbar({
        open: true,
        message: err.message || 'Failed to create lease',
        variant: 'alert',
        alert: { color: 'error' }
      });
    } finally {
      setCreatingLease(false);
    }
  };


  const canCreateLease = () => {
    return selectedProperty !== null && 
           selectedUnit !== null && 
           leaseNickname && 
           leaseNickname.trim().length > 0;
  };

  return (
    <>
      <Box  >
        <Typography variant="h3" sx={{ mb: 0.5 }}>
          Add basic info for lease
        </Typography>
        <Typography variant="body1" color="text.secondary">
          Keep your properties and tenants organized in one place.
        </Typography>
      </Box>

      {error && (
        <Alert severity="error" sx={{ mb: 3 }} onClose={() => setError(null)}>
          {error}
        </Alert>
      )}

      <Box sx={{
        position: 'relative',
        flex: 1,
        display: 'flex',
        flexDirection: 'column',
        minHeight: '500px'
      }}>
        <Box sx={{
          flex: 1,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          py: 6,
          px: 3,
          position: 'relative',
          overflow: 'hidden',
          minHeight: '400px'
        }}>
          <Box sx={{ width: '100%', maxWidth: '800px', position: 'relative' }}>
            {loading ? (
              <Box display="flex" justifyContent="center" alignItems="center" minHeight="400px">
                <CircularProgress />
              </Box>
            ) : (
              <Box>
                <PropertyUnitSelector
                  selectedProperty={selectedProperty}
                  selectedUnit={selectedUnit}
                  onSelectProperty={setSelectedProperty}
                  onSelectUnit={setSelectedUnit}
                  leaseNickname={leaseNickname}
                  onLeaseNicknameChange={setLeaseNickname}
                  startDate={startDate}
                  onStartDateChange={setStartDate}
                  endDate={endDate}
                  onEndDateChange={setEndDate}
                />
              </Box>
            )}
          </Box>
        </Box>

        {/* Create Lease Button */}
        <Box sx={{
          display: 'flex',
          justifyContent: 'center',
          alignItems: 'center',
          mt: 2,
          pt: 2,
          pb: 2,
          px: 3
        }}>
          <Button
            variant="contained"
            onClick={handleCreateLease}
            disabled={!canCreateLease() || loading || creatingLease}
            sx={{ textTransform: 'none', px: 4, py: 1 }}
          >
            {creatingLease ? (
              <>
                <CircularProgress size={16} sx={{ mr: 1 }} />
                Creating...
              </>
            ) : (
              'Create Lease'
            )}
          </Button>
        </Box>
      </Box>

      {/* Creating Lease Loading Modal */}
      <Dialog
        open={creatingLease}
        maxWidth="xs"
        fullWidth
        disableEscapeKeyDown
        PaperProps={{
          sx: {
            borderRadius: 2,
            p: 3
          }
        }}
      >
        <DialogContent sx={{ textAlign: 'center', py: 4 }}>
          <CircularProgress sx={{ mb: 2 }} />
          <Typography variant="h6" sx={{ mb: 1 }}>
            Creating your lease...
          </Typography>
          <Typography variant="body2" color="text.secondary">
            Please wait while we create your lease.
          </Typography>
        </DialogContent>
      </Dialog>

      {/* Lease Created Success Dialog */}
      <LeaseCreatedSuccessDialog
        open={successDialogOpen}
        onClose={() => {
          setSuccessDialogOpen(false);
          setCreatedLease(null);
          // Navigate to lease page or call onComplete
          if (createdLease?.id) {
            if (onComplete) {
              onComplete(createdLease.id);
            } else {
              navigate(`/landlord/leases/${createdLease.id}`);
            }
          }
        }}
        lease={createdLease}
        propertyName={selectedProperty?.name}
        propertyId={selectedProperty?.id}
        unitId={selectedUnit?.id}
      />

      {/* Link Existing Inspections to Lease Dialog */}
      <Dialog
        open={linkInspectionOpen}
        maxWidth="xs"
        fullWidth
        PaperProps={{ sx: { borderRadius: 2 } }}
      >
        <DialogContent sx={{ p: 3, textAlign: 'center' }}>
          <Box
            sx={{
              width: 60,
              height: 60,
              borderRadius: '50%',
              bgcolor: (t) => `${t.palette.primary.main}18`,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              mx: 'auto',
              mb: 2
            }}
          >
            <LinkOutlined style={{ fontSize: 28, color: theme.palette.primary.main }} />
          </Box>
          <Typography variant="h6" fontWeight={700} gutterBottom>
            Link Existing {pendingInspections.length === 1 ? 'Inspection' : 'Inspections'}?
          </Typography>
          <Typography variant="body2" color="text.secondary">
            We found {pendingInspections.length} existing{' '}
            {pendingInspections.length === 1 ? 'inspection' : 'inspections'} for{' '}
            <strong>{selectedProperty?.name}{selectedUnit?.name ? ` – ${selectedUnit.name}` : ''}</strong>.
            Would you like to link {pendingInspections.length === 1 ? 'it' : 'them'} to this lease?
          </Typography>
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 3, justifyContent: 'center', gap: 1.5 }}>
          <Button
            variant="outlined"
            disabled={linkingInspections}
            onClick={() => {
              setLinkInspectionOpen(false);
              setPendingInspections([]);
              setSuccessDialogOpen(true);
            }}
            sx={{ minWidth: 100 }}
          >
            Skip
          </Button>
          <Button
            variant="contained"
            disabled={linkingInspections}
            startIcon={linkingInspections ? <CircularProgress size={14} /> : <LinkOutlined />}
            onClick={async () => {
              if (!createdLease?.id) return;
              setLinkingInspections(true);
              try {
                await Promise.all(
                  pendingInspections.map((insp) =>
                    checklistAPI.updateChecklist(insp.id, { Id: insp.id, LeaseId: createdLease.id })
                  )
                );
                openSnackbar({
                  open: true,
                  message: `${pendingInspections.length === 1 ? 'Inspection' : 'Inspections'} linked to lease`,
                  variant: 'alert',
                  alert: { color: 'success' }
                });
              } catch {
                // Don't block if linking fails
              } finally {
                setLinkingInspections(false);
                setLinkInspectionOpen(false);
                setPendingInspections([]);
                setSuccessDialogOpen(true);
              }
            }}
            sx={{ minWidth: 100 }}
          >
            {linkingInspections ? 'Linking...' : 'Link to Lease'}
          </Button>
        </DialogActions>
      </Dialog>
    </>
  );
}

LeaseBuilderWizard.propTypes = {
  leaseId: PropTypes.number,
  onComplete: PropTypes.func,
  initialPropertyId: PropTypes.number,
  initialUnitId: PropTypes.number
};
