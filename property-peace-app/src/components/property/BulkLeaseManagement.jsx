import { useState, useMemo, useEffect, useRef } from 'react';
import {
  Box,
  Button,
  Checkbox,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  FormControlLabel,
  Grid,
  IconButton,
  Paper,
  Stack,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Toolbar,
  Typography,
  Chip,
  Menu,
  MenuItem,
  Tooltip,
  TextField,
  InputAdornment
} from '@mui/material';
import {
  PlusOutlined,
  CopyOutlined,
  DeleteOutlined,
  EditOutlined,
  FileTextOutlined,
  MoreOutlined,
  CheckCircleOutlined,
  SearchOutlined
} from '@ant-design/icons';
import { useFormik, FormikProvider, Form } from 'formik';
import * as Yup from 'yup';
import { useDispatch } from 'react-redux';
import { useNavigate } from 'react-router-dom';
import { openSnackbar } from 'api/snackbar';
import { addOrUpdateLease, updateLease, deleteLease, setLease, endLease } from 'store/lease/lease.action';
import { useDrawer } from 'contexts/DrawerContext';
import FormInput from 'components/input/FormInput';
import FormSelect from 'components/input/FormSelect';
import { leaseLengthOptions, rentDueDayOptions, rentFrequencyOptions } from 'utils/models';
import { LeaseFields, buildInitialValues } from 'components/fields/LeaseFields';
import { formatDate, formatCurrency } from 'utils/formatters';
import ConfirmationDialog from 'components/dialogs/ConfirmationDialog';
import LeaseCreatedSuccessDialog from 'components/dialogs/LeaseCreatedSuccessDialog';
import axiosServices from 'utils/axios';

// ---------- date helpers ----------
const pad = (n) => String(n).padStart(2, '0');
const toInputDate = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;

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

const LeaseSchema = Yup.object().shape({
  leaseStartDate: Yup.string().required('Lease start date is required'),
  leaseEndDate: Yup.string().required('Lease end date is required'),
  rentFrequency: Yup.string().oneOf(['monthly', 'quarterly', 'yearly']).required('Rent frequency is required'),
  rentDueDay: Yup.number().min(1).max(31).required('Rent due day is required'),
  leaseLength: Yup.number().min(0).required('Lease length is required'),
  rentAmount: Yup.number().typeError('Enter a valid amount').min(0, 'Must be ≥ 0').required('Rent amount is required')
});

export default function BulkLeaseManagement({ property, onRefresh }) {
  const dispatch = useDispatch();
  const navigate = useNavigate();
  const drawer = useDrawer();
  const units = property?.units || [];

  // Track when lease edit drawer closes to refresh property data
  const wasDrawerOpen = useRef(false);
  useEffect(() => {
    if (drawer.isOpenLeaseEdit) {
      wasDrawerOpen.current = true;
    } else if (wasDrawerOpen.current && onRefresh) {
      // Drawer just closed - refresh property data to get updated lease info
      wasDrawerOpen.current = false;
      const timer = setTimeout(() => {
        onRefresh();
      }, 300);
      return () => clearTimeout(timer);
    }
  }, [drawer.isOpenLeaseEdit, onRefresh]);

  // State
  const [selectedUnits, setSelectedUnits] = useState(new Set());
  const [templateDialogOpen, setTemplateDialogOpen] = useState(false);
  const [bulkCreateDialogOpen, setBulkCreateDialogOpen] = useState(false);
  const [copyDialogOpen, setCopyDialogOpen] = useState(false);
  const [sourceUnitId, setSourceUnitId] = useState(null);
  const [anchorEl, setAnchorEl] = useState(null);
  const [targetUnitId, setTargetUnitId] = useState(null);
  const [createLeaseDialogOpen, setCreateLeaseDialogOpen] = useState(false);
  const [savedTemplate, setSavedTemplate] = useState(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [endLeaseConfirmOpen, setEndLeaseConfirmOpen] = useState(false);
  const [deleteLeaseConfirmOpen, setDeleteLeaseConfirmOpen] = useState(false);
  const [leaseToEnd, setLeaseToEnd] = useState(null);
  const [leaseToDelete, setLeaseToDelete] = useState(null);
  const [successDialogOpen, setSuccessDialogOpen] = useState(false);
  const [createdLeaseCount, setCreatedLeaseCount] = useState(0);

  // Template formik
  const templateFormik = useFormik({
    initialValues: savedTemplate || buildInitialValues(property),
    validationSchema: LeaseSchema,
    enableReinitialize: true,
    onSubmit: async (values) => {
      // Save template for later use
      setSavedTemplate(values);
      setTemplateDialogOpen(false);
      openSnackbar({
        open: true,
        message:
          'Template saved. You can now use it to create bulk leases by clicking "Bulk Create" and it will auto-populate with the template values.',
        variant: 'alert',
        alert: { color: 'success' }
      });
    }
  });

  // Bulk create formik
  const bulkFormik = useFormik({
    initialValues: savedTemplate || buildInitialValues(property),
    validationSchema: LeaseSchema,
    enableReinitialize: true,
    onSubmit: async (values, { setSubmitting }) => {
      try {
        if (selectedUnits.size === 0) {
          openSnackbar({
            open: true,
            message: 'Please select at least one unit.',
            variant: 'alert',
            alert: { color: 'warning' }
          });
          setSubmitting(false);
          return;
        }

        const leasePayload = {
          PropertyId: property.id,
          StartDate: new Date(values.leaseStartDate),
          EndDate: new Date(values.leaseEndDate),
          LeaseLength: Number(values.leaseLength || 12),
          RentAmount: Number(values.rentAmount || 0),
          RentFrequency: values.rentFrequency === 'monthly' ? 'Monthly' : values.rentFrequency === 'quarterly' ? 'Quarterly' : 'Yearly',
          RentDueDay: Number(values.rentDueDay || 1),
          MarkPastPaymentsAsPaid: values.markPastPaymentsAsPaid || false,
          ...(property?.organizationId != null && { organizationId: Number(property.organizationId) })
        };

        // Create leases for all selected units
        const promises = Array.from(selectedUnits).map(async (unitId) => {
          const unit = units.find((u) => u.id === unitId);
          if (!unit || unit.lease) return null; // Skip units with existing leases

          try {
            // Make API call directly to create lease
            const response = await axiosServices.post('/api/lease', {
              ...leasePayload,
              UnitId: unitId
            });
            
            // Dispatch action to update Redux store
            await dispatch(
              addOrUpdateLease({
                ...leasePayload,
                UnitId: unitId
              })
            );
            
            return response.data?.success && response.data?.data ? response.data.data : null;
          } catch (error) {
            console.error(`Error creating lease for unit ${unitId}:`, error);
            return null;
          }
        });

        const results = await Promise.all(promises);
        const successCount = results.filter((r) => r !== null).length;

        // Only show success dialog if at least one lease was created
        if (successCount > 0) {
          setCreatedLeaseCount(successCount);
          setSuccessDialogOpen(true);
        } else {
          openSnackbar({
            open: true,
            message: 'No leases were created. Please check that selected units do not already have leases.',
            variant: 'alert',
            alert: { color: 'warning' }
          });
        }

        setBulkCreateDialogOpen(false);
        setSelectedUnits(new Set());
        bulkFormik.resetForm();
        if (onRefresh) onRefresh();
      } catch (error) {
        console.error(error);
        openSnackbar({
          open: true,
          message: error?.response?.data?.message || 'Failed to create leases.',
          variant: 'alert',
          alert: { color: 'error' }
        });
      } finally {
        setSubmitting(false);
      }
    }
  });

  // Copy lease formik
  const copyFormik = useFormik({
    initialValues: buildInitialValues(property),
    validationSchema: LeaseSchema,
    onSubmit: async (values, { setSubmitting }) => {
      try {
        if (selectedUnits.size === 0) {
          openSnackbar({
            open: true,
            message: 'Please select at least one unit to copy to.',
            variant: 'alert',
            alert: { color: 'warning' }
          });
          setSubmitting(false);
          return;
        }

        const leasePayload = {
          PropertyId: property.id,
          StartDate: new Date(values.leaseStartDate),
          EndDate: new Date(values.leaseEndDate),
          LeaseLength: Number(values.leaseLength || 12),
          RentAmount: Number(values.rentAmount || 0),
          RentFrequency: values.rentFrequency === 'monthly' ? 'Monthly' : values.rentFrequency === 'quarterly' ? 'Quarterly' : 'Yearly',
          RentDueDay: Number(values.rentDueDay || 1),
          MarkPastPaymentsAsPaid: values.markPastPaymentsAsPaid || false,
          ...(property?.organizationId != null && { organizationId: Number(property.organizationId) })
        };

        // Create leases for all selected units (excluding source)
        const promises = Array.from(selectedUnits)
          .filter((unitId) => unitId !== sourceUnitId)
          .map(async (unitId) => {
            const unit = units.find((u) => u.id === unitId);
            if (!unit || unit.lease) return null; // Skip units with existing leases

            return await dispatch(
              addOrUpdateLease({
                ...leasePayload,
                UnitId: unitId
              })
            );
          });

        const results = await Promise.all(promises);
        const successCount = results.filter((r) => r !== null).length;

        openSnackbar({
          open: true,
          message: `Successfully copied lease to ${successCount} unit(s).`,
          variant: 'alert',
          alert: { color: 'success' }
        });

        setCopyDialogOpen(false);
        setSelectedUnits(new Set());
        setSourceUnitId(null);
        copyFormik.resetForm();
        if (onRefresh) onRefresh();
      } catch (error) {
        console.error(error);
        openSnackbar({
          open: true,
          message: error?.response?.data?.message || 'Failed to copy lease.',
          variant: 'alert',
          alert: { color: 'error' }
        });
      } finally {
        setSubmitting(false);
      }
    }
  });

  // Create single lease formik
  const createLeaseFormik = useFormik({
    initialValues: buildInitialValues(property),
    validationSchema: LeaseSchema,
    onSubmit: async (values, { setSubmitting }) => {
      try {
        if (!targetUnitId) {
          openSnackbar({
            open: true,
            message: 'No unit selected.',
            variant: 'alert',
            alert: { color: 'warning' }
          });
          setSubmitting(false);
          return;
        }

        const unit = units.find((u) => u.id === targetUnitId);
        if (unit?.lease) {
          openSnackbar({
            open: true,
            message: 'This unit already has a lease.',
            variant: 'alert',
            alert: { color: 'warning' }
          });
          setSubmitting(false);
          return;
        }

        const leasePayload = {
          PropertyId: property.id,
          UnitId: targetUnitId,
          StartDate: new Date(values.leaseStartDate),
          EndDate: new Date(values.leaseEndDate),
          LeaseLength: Number(values.leaseLength || 12),
          RentAmount: Number(values.rentAmount || 0),
          RentFrequency: values.rentFrequency === 'monthly' ? 'Monthly' : values.rentFrequency === 'quarterly' ? 'Quarterly' : 'Yearly',
          RentDueDay: Number(values.rentDueDay || 1),
          MarkPastPaymentsAsPaid: values.markPastPaymentsAsPaid || false,
          ...(property?.organizationId != null && { organizationId: Number(property.organizationId) })
        };

        await dispatch(addOrUpdateLease(leasePayload));

        openSnackbar({
          open: true,
          message: 'Lease created successfully.',
          variant: 'alert',
          alert: { color: 'success' }
        });

        setCreateLeaseDialogOpen(false);
        setTargetUnitId(null);
        createLeaseFormik.resetForm();
        if (onRefresh) onRefresh();
      } catch (error) {
        console.error(error);
        openSnackbar({
          open: true,
          message: error?.response?.data?.message || 'Failed to create lease.',
          variant: 'alert',
          alert: { color: 'error' }
        });
      } finally {
        setSubmitting(false);
      }
    }
  });

  // Handlers
  const handleSelectUnit = (unitId) => {
    const newSelected = new Set(selectedUnits);
    if (newSelected.has(unitId)) {
      newSelected.delete(unitId);
    } else {
      newSelected.add(unitId);
    }
    setSelectedUnits(newSelected);
  };

  const handleSelectAll = () => {
    const unitsWithoutLeases = filteredUnits.filter((u) => !u.lease).map((u) => u.id);
    if (unitsWithoutLeases.length === selectedUnits.size && unitsWithoutLeases.every((id) => selectedUnits.has(id))) {
      setSelectedUnits(new Set());
    } else {
      setSelectedUnits(new Set(unitsWithoutLeases));
    }
  };

  const handleCopyLease = (sourceId) => {
    const sourceUnit = units.find((u) => u.id === sourceId);
    if (!sourceUnit?.lease) {
      openSnackbar({
        open: true,
        message: 'This unit does not have a lease to copy.',
        variant: 'alert',
        alert: { color: 'warning' }
      });
      return;
    }

    const lease = sourceUnit.lease;
    setSourceUnitId(sourceId);

    // Populate form with source lease data
    copyFormik.setValues({
      ...buildInitialValues(property),
      leaseStartDate: toInputDate(new Date(lease.startDate)),
      leaseEndDate: toInputDate(new Date(lease.endDate)),
      rentFrequency: lease.rentFrequency?.toLowerCase() || 'monthly',
      rentDueDay: lease.rentDueDay || 1,
      leaseLength: lease.leaseLength || 12,
      rentAmount: lease.rentAmount || 0
    });

    // Select all units without leases (excluding source)
    const unitsWithoutLeases = units.filter((u) => !u.lease && u.id !== sourceId).map((u) => u.id);
    setSelectedUnits(new Set(unitsWithoutLeases));
    setCopyDialogOpen(true);
  };

  const handleOpenMenu = (event, unitId) => {
    setAnchorEl(event.currentTarget);
    setTargetUnitId(unitId);
  };

  const handleCloseMenu = () => {
    setAnchorEl(null);
    setTargetUnitId(null);
  };

  const handleCreateLease = () => {
    const unit = units.find((u) => u.id === targetUnitId);
    if (unit?.lease) {
      openSnackbar({
        open: true,
        message: 'This unit already has a lease.',
        variant: 'alert',
        alert: { color: 'warning' }
      });
      handleCloseMenu();
      return;
    }

    createLeaseFormik.setValues({
      ...buildInitialValues(property),
      unitId: targetUnitId
    });
    setCreateLeaseDialogOpen(true);
    handleCloseMenu();
  };

  // Handle end lease
  const handleEndLeaseClick = () => {
    const unit = units.find((u) => u.id === targetUnitId);
    if (unit?.lease) {
      setLeaseToEnd(unit.lease);
      setEndLeaseConfirmOpen(true);
    }
    handleCloseMenu();
  };

  const handleConfirmEndLease = async () => {
    if (!leaseToEnd?.id) return;

    try {
      await dispatch(endLease(leaseToEnd.id));

      openSnackbar({
        open: true,
        message: 'Lease ended and archived successfully.',
        variant: 'alert',
        alert: { color: 'success' }
      });

      setEndLeaseConfirmOpen(false);
      setLeaseToEnd(null);

      // Refresh property data to get updated lease status
      if (onRefresh) {
        await onRefresh();
      }
    } catch (error) {
      console.error('Error ending lease:', error);
      openSnackbar({
        open: true,
        message: error?.response?.data?.message || 'Failed to end lease',
        variant: 'alert',
        alert: { color: 'error' }
      });
    }
  };

  // Handle edit lease
  const handleEditLeaseClick = () => {
    const unit = units.find((u) => u.id === targetUnitId);
    if (unit?.lease) {
      // Navigate to lease settings page
      navigate(`/landlord/leases/${unit.lease.id}/settings`);
    }
    handleCloseMenu();
  };

  // Handle delete lease
  const handleDeleteLeaseClick = () => {
    const unit = units.find((u) => u.id === targetUnitId);
    if (unit?.lease) {
      setLeaseToDelete(unit.lease);
      setDeleteLeaseConfirmOpen(true);
    }
    handleCloseMenu();
  };

  const handleConfirmDeleteLease = async () => {
    if (!leaseToDelete?.id) return;

    try {
      await dispatch(deleteLease(leaseToDelete.id));

      openSnackbar({
        open: true,
        message: 'Lease deleted successfully. All associated payments and deposits have been removed.',
        variant: 'alert',
        alert: { color: 'success' }
      });

      setDeleteLeaseConfirmOpen(false);
      setLeaseToDelete(null);

      // Refresh property data to remove deleted lease
      if (onRefresh) {
        await onRefresh();
      }
    } catch (error) {
      console.error('Error deleting lease:', error);
      openSnackbar({
        open: true,
        message: error?.response?.data?.message || 'Failed to delete lease',
        variant: 'alert',
        alert: { color: 'error' }
      });
    }
  };

  // Filter units based on search query
  const filteredUnits = useMemo(() => {
    if (!searchQuery.trim()) return units;

    const query = searchQuery.toLowerCase();
    return units.filter(
      (unit) =>
        unit.name?.toLowerCase().includes(query) ||
        unit.bedrooms?.toString().includes(query) ||
        unit.baths?.toString().includes(query) ||
        unit.squareFeet?.toString().includes(query) ||
        (unit.lease && unit.lease.rentAmount?.toString().includes(query))
    );
  }, [units, searchQuery]);

  const unitsWithoutLeases = useMemo(
    () => filteredUnits.filter((u) => !u.lease || (u.lease && u.lease.isActive === false)),
    [filteredUnits]
  );
  const allSelected = unitsWithoutLeases.length > 0 && unitsWithoutLeases.every((u) => selectedUnits.has(u.id));

  return (
    <Box>
      {/* Toolbar */}
      <Toolbar sx={{ px: 0, justifyContent: 'space-between', flexWrap: 'wrap', gap: 2 }}>
        <Stack direction="row" spacing={1} alignItems="center">
          <Typography variant="subtitle1">{selectedUnits.size > 0 && `${selectedUnits.size} unit(s) selected`}</Typography>
        </Stack>
      </Toolbar>

      {/* Search Bar */}
      <Stack direction="row" spacing={2} sx={{ mb: 2 }} flexWrap="wrap">
        <TextField
          placeholder="Search units..."
          size="small"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          InputProps={{
            startAdornment: (
              <InputAdornment position="start">
                <SearchOutlined style={{ fontSize: 18 }} />
              </InputAdornment>
            )
          }}
          sx={{ flexGrow: 1, minWidth: 200 }}
        />
      </Stack>

      {/* Units Table */}
      <TableContainer component={Paper} variant="outlined">
        <Table>
          <TableHead>
            <TableRow>
              <TableCell padding="checkbox" width={50}>
                <Checkbox checked={allSelected} indeterminate={selectedUnits.size > 0 && !allSelected} onChange={handleSelectAll} />
              </TableCell>
              <TableCell>Unit Name</TableCell>
              <TableCell>Status</TableCell>
              <TableCell>Lease</TableCell>
              <TableCell>Rent Amount</TableCell>
              <TableCell>Lease Period</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {filteredUnits.length === 0 ? (
              <TableRow>
                <TableCell colSpan={7} align="center" sx={{ py: 4 }}>
                  <Typography color="text.secondary">
                    {searchQuery.trim() ? 'No units match your search.' : 'No units found for this property.'}
                  </Typography>
                </TableCell>
              </TableRow>
            ) : (
              filteredUnits.map((unit) => {
                const hasLease = !!unit.lease;
                // Check isActive (camelCase) or IsActive (PascalCase) - backend may return either
                // Default to true if not explicitly set to false
                const leaseIsActive = unit.lease?.isActive ?? unit.lease?.IsActive ?? true;
                const isActiveLease = hasLease && leaseIsActive === true;
                const isSelected = selectedUnits.has(unit.id);
                const canSelect = !isActiveLease;

                return (
                  <TableRow key={unit.id} hover selected={isSelected}>
                    <TableCell padding="checkbox">
                      <Checkbox checked={isSelected} disabled={!canSelect} onChange={() => handleSelectUnit(unit.id)} />
                    </TableCell>
                    <TableCell>
                      <Typography variant="body2" fontWeight={500}>
                        {unit.name || `Unit ${unit.id}`}
                      </Typography>
                    </TableCell>
                    <TableCell>
                      <Chip
                        size="small"
                        label={isActiveLease ? 'Leased' : hasLease ? 'Lease Ended' : 'Available'}
                        color={isActiveLease ? 'success' : hasLease ? 'warning' : 'default'}
                        variant="outlined"
                      />
                    </TableCell>
                    <TableCell>
                      {hasLease ? (
                        <Button
                          variant="outlined"
                          size="small"
                          onClick={(e) => {
                            e.stopPropagation();
                            navigate(`/landlord/property/${property.id}?tab=leases`);
                          }}
                          sx={{ textTransform: 'none' }}
                        >
                          View Lease
                        </Button>
                      ) : (
                        <Button
                          variant="outlined"
                          size="small"
                          color="primary"
                          onClick={(e) => {
                            e.stopPropagation();
                            navigate('/landlord/leases/selection');
                          }}
                          sx={{ textTransform: 'none' }}
                        >
                          Add Lease
                        </Button>
                      )}
                    </TableCell>
                    <TableCell>
                      {hasLease ? (
                        <Typography variant="body2" fontWeight={500}>
                          {formatCurrency(unit.lease.rentAmount)}
                        </Typography>
                      ) : (
                        <Typography variant="body2" color="text.secondary">
                          -
                        </Typography>
                      )}
                    </TableCell>
                    <TableCell>
                      {hasLease ? (
                        <Typography variant="body2">
                          {formatDate(unit.lease.startDate)} - {formatDate(unit.lease.endDate)}
                        </Typography>
                      ) : (
                        <Typography variant="body2" color="text.secondary">
                          -
                        </Typography>
                      )}
                    </TableCell>
                  </TableRow>
                );
              })
            )}
          </TableBody>
        </Table>
      </TableContainer>

      {/* Context Menu */}
      <Menu anchorEl={anchorEl} open={Boolean(anchorEl)} onClose={handleCloseMenu}>
        <MenuItem
          onClick={handleCreateLease}
          disabled={units.find((u) => u.id === targetUnitId)?.lease && units.find((u) => u.id === targetUnitId)?.lease?.isActive !== false}
        >
          <PlusOutlined style={{ marginRight: 8 }} />
          Create Lease
        </MenuItem>
        {units.find((u) => u.id === targetUnitId)?.lease && units.find((u) => u.id === targetUnitId)?.lease?.isActive !== false && (
          <>
            <MenuItem onClick={handleEditLeaseClick}>
              <EditOutlined style={{ marginRight: 8 }} />
              Edit Lease
            </MenuItem>
            <MenuItem
              onClick={() => {
                handleCopyLease(targetUnitId);
                handleCloseMenu();
              }}
            >
              <CopyOutlined style={{ marginRight: 8 }} />
              Copy Lease
            </MenuItem>
            <MenuItem onClick={handleEndLeaseClick}>
              <CheckCircleOutlined style={{ marginRight: 8, color: '#ff9800' }} />
              End Lease
            </MenuItem>
            <MenuItem onClick={handleDeleteLeaseClick}>
              <DeleteOutlined style={{ marginRight: 8, color: '#d32f2f' }} />
              Delete Lease
            </MenuItem>
          </>
        )}
      </Menu>

      {/* Template Dialog */}
      <Dialog open={templateDialogOpen} onClose={() => setTemplateDialogOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle>Create Lease Template</DialogTitle>
        <FormikProvider value={templateFormik}>
          <Form>
            <DialogContent>
              <Box sx={{ pt: 2 }}>
                <LeaseFields
                  values={templateFormik.values}
                  errors={templateFormik.errors}
                  touched={templateFormik.touched}
                  setFieldValue={templateFormik.setFieldValue}
                />
              </Box>
            </DialogContent>
            <DialogActions>
              <Button onClick={() => setTemplateDialogOpen(false)} variant="outlined" color="inherit">
                Cancel
              </Button>
              <Button type="submit" variant="contained" disabled={templateFormik.isSubmitting}>
                Save Template
              </Button>
            </DialogActions>
          </Form>
        </FormikProvider>
      </Dialog>

      {/* Bulk Create Dialog */}
      <Dialog open={bulkCreateDialogOpen} onClose={() => setBulkCreateDialogOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle>
          Bulk Create Leases
          {savedTemplate && (
            <Typography variant="caption" color="success.main" sx={{ display: 'block', mt: 0.5 }}>
              Template values loaded
            </Typography>
          )}
        </DialogTitle>
        <FormikProvider value={bulkFormik}>
          <Form>
            <DialogContent>
              <Box sx={{ pt: 2 }}>
                <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                  Creating leases for {selectedUnits.size} selected unit(s).
                  {savedTemplate && (
                    <Typography component="span" variant="body2" color="success.main" sx={{ ml: 1 }}>
                      Template values are pre-filled.
                    </Typography>
                  )}
                </Typography>
                {savedTemplate && (
                  <Button
                    size="small"
                    variant="outlined"
                    onClick={() => {
                      bulkFormik.setValues(buildInitialValues(property));
                    }}
                    sx={{ mb: 2 }}
                  >
                    Clear Template
                  </Button>
                )}
                <LeaseFields
                  values={bulkFormik.values}
                  errors={bulkFormik.errors}
                  touched={bulkFormik.touched}
                  setFieldValue={bulkFormik.setFieldValue}
                />
              </Box>
            </DialogContent>
            <DialogActions>
              <Button onClick={() => setBulkCreateDialogOpen(false)} variant="outlined" color="inherit">
                Cancel
              </Button>
              <Button type="submit" variant="contained" disabled={bulkFormik.isSubmitting}>
                {bulkFormik.isSubmitting ? 'Creating...' : 'Create Leases'}
              </Button>
            </DialogActions>
          </Form>
        </FormikProvider>
      </Dialog>

      {/* Copy Lease Dialog */}
      <Dialog open={copyDialogOpen} onClose={() => setCopyDialogOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle>Copy Lease</DialogTitle>
        <FormikProvider value={copyFormik}>
          <Form>
            <DialogContent>
              <Box sx={{ pt: 2 }}>
                <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                  Copying lease details to {selectedUnits.size} selected unit(s). You can modify any fields before creating.
                </Typography>
                <LeaseFields
                  values={copyFormik.values}
                  errors={copyFormik.errors}
                  touched={copyFormik.touched}
                  setFieldValue={copyFormik.setFieldValue}
                />
              </Box>
            </DialogContent>
            <DialogActions>
              <Button onClick={() => setCopyDialogOpen(false)} variant="outlined" color="inherit">
                Cancel
              </Button>
              <Button type="submit" variant="contained" disabled={copyFormik.isSubmitting}>
                {copyFormik.isSubmitting ? 'Copying...' : 'Copy to Selected Units'}
              </Button>
            </DialogActions>
          </Form>
        </FormikProvider>
      </Dialog>

      {/* Create Single Lease Dialog */}
      <Dialog open={createLeaseDialogOpen} onClose={() => setCreateLeaseDialogOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle>Create Lease for {units.find((u) => u.id === targetUnitId)?.name || 'Unit'}</DialogTitle>
        <FormikProvider value={createLeaseFormik}>
          <Form>
            <DialogContent>
              <Box sx={{ pt: 2 }}>
                <LeaseFields
                  values={createLeaseFormik.values}
                  errors={createLeaseFormik.errors}
                  touched={createLeaseFormik.touched}
                  setFieldValue={createLeaseFormik.setFieldValue}
                />
              </Box>
            </DialogContent>
            <DialogActions>
              <Button onClick={() => setCreateLeaseDialogOpen(false)} variant="outlined" color="inherit">
                Cancel
              </Button>
              <Button type="submit" variant="contained" disabled={createLeaseFormik.isSubmitting}>
                {createLeaseFormik.isSubmitting ? 'Creating...' : 'Create Lease'}
              </Button>
            </DialogActions>
          </Form>
        </FormikProvider>
      </Dialog>

      {/* End Lease Confirmation Dialog */}
      <ConfirmationDialog
        open={endLeaseConfirmOpen}
        onClose={() => {
          setEndLeaseConfirmOpen(false);
          setLeaseToEnd(null);
        }}
        onConfirm={handleConfirmEndLease}
        title="End Lease"
        message={
          leaseToEnd
            ? `Are you sure you want to end this lease? This will mark the lease as inactive. The lease data will be preserved but it will no longer be active.`
            : 'Are you sure you want to end this lease?'
        }
        confirmText="End Lease"
        cancelText="Cancel"
        confirmColor="warning"
      />

      {/* Delete Lease Confirmation Dialog */}
      <ConfirmationDialog
        open={deleteLeaseConfirmOpen}
        onClose={() => {
          setDeleteLeaseConfirmOpen(false);
          setLeaseToDelete(null);
        }}
        onConfirm={handleConfirmDeleteLease}
        title="Delete Lease"
        message={
          leaseToDelete
            ? `Are you sure you want to permanently delete this lease? This will delete the lease and all associated payments and deposits. This action cannot be undone.`
            : 'Are you sure you want to delete this lease?'
        }
        confirmText="Delete"
        cancelText="Cancel"
        confirmColor="error"
      />

      {/* Success Dialog for Bulk Lease Creation */}
      <LeaseCreatedSuccessDialog
        open={successDialogOpen}
        onClose={() => {
          setSuccessDialogOpen(false);
          setCreatedLeaseCount(0);
        }}
        lease={null}
        leaseCount={createdLeaseCount}
        propertyName={property?.name}
        isBulk={true}
      />
    </Box>
  );
}
