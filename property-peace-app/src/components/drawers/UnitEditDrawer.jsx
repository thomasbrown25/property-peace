import { useEffect, useState, useMemo } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import PropTypes from 'prop-types';

// material-ui
import {
  Box,
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Divider,
  Grid,
  Stack,
  TextField,
  Typography,
  Tooltip,
  Switch,
  FormControlLabel,
  Chip,
  Tabs,
  Tab,
  Alert,
  List,
  ListItem,
  ListItemText,
  IconButton
} from '@mui/material';
import { alpha } from '@mui/system';
import { PlusOutlined, UserOutlined, EditOutlined, DeleteOutlined } from '@ant-design/icons';

// form + validation
import { useFormik, Form, FormikProvider } from 'formik';
import * as Yup from 'yup';

// project imports
import { useDrawer } from 'contexts/DrawerContext';
import { addOrUpdateUnit } from 'store/unit/unit.action';
import { openSnackbar } from 'api/snackbar';
import FormInput from 'components/input/FormInput';
import CircularWithPath from 'components/@extended/progress/CircularWithPath';
import Autocomplete from 'components/@extended/AutoComplete';
import AddTenantDialog from 'components/dialogs/AddTenantDialog';
import LeaseEditDrawer from 'components/drawers/LeaseEditDrawer';
import useFetchTenants from 'hooks/useFetchTenants';
import axiosServices from 'utils/axios';
import { selectProperty } from 'store/property/property.selector';
import { setProperty } from 'store/property/property.action';
import { setLease } from 'store/lease/lease.action';

// Validation schema
const UnitSchema = Yup.object().shape({
  name: Yup.string().required('Unit name is required'),
  bedrooms: Yup.string(),
  baths: Yup.string(),
  squareFeet: Yup.number().nullable()
});

function TabPanel({ children, value, index, ...other }) {
  return (
    <div role="tabpanel" hidden={value !== index} {...other}>
      {value === index && <Box sx={{ pt: 3 }}>{children}</Box>}
    </div>
  );
}

TabPanel.propTypes = {
  children: PropTypes.node,
  index: PropTypes.number.isRequired,
  value: PropTypes.number.isRequired
};

const UnitEditDrawer = ({ propertyId, onUpdateSuccess }) => {
  const drawer = useDrawer();
  const dispatch = useDispatch();
  const selectedProperty = useSelector(selectProperty);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [activeTab, setActiveTab] = useState(0);
  const [addTenantDialogOpen, setAddTenantDialogOpen] = useState(false);
  const [linkTenantDialogOpen, setLinkTenantDialogOpen] = useState(false);
  const [selectedTenantToLink, setSelectedTenantToLink] = useState(null);
  const [linkingTenant, setLinkingTenant] = useState(false);
  
  // Get unit from drawer context
  const unit = drawer.selectedUnit;
  const lease = unit?.lease || null;
  const currentTenants = lease?.tenants || [];
  
  // Fetch tenants for linking
  const { tenants: allTenants = [], refetch: refetchTenants } = useFetchTenants();

  // Filter out tenants already linked to this lease
  const availableTenants = useMemo(() => {
    if (!allTenants || allTenants.length === 0) return [];
    const linkedTenantIds = new Set(currentTenants.map(t => t.id || t.Id).filter(Boolean));
    return allTenants.filter(tenant => {
      const tenantId = tenant.id || tenant.Id;
      return !linkedTenantIds.has(tenantId);
    });
  }, [allTenants, currentTenants]);

  // Tenant options for autocomplete
  const tenantOptions = useMemo(() => {
    return availableTenants.map(tenant => {
      const firstname = tenant.firstname || tenant.firstName || '';
      const lastname = tenant.lastname || tenant.lastName || '';
      const email = tenant.email || tenant.Email || '';
      const label = `${firstname} ${lastname}`.trim() || 'Unnamed Tenant';
      return {
        id: tenant.id || tenant.Id,
        label,
        email,
        tenant
      };
    });
  }, [availableTenants]);

  const formik = useFormik({
    enableReinitialize: true,
    initialValues: {
      name: unit?.name || '',
      bedrooms: unit?.bedrooms || '',
      baths: unit?.baths || '',
      squareFeet: unit?.squareFeet || 0,
      isOccupied: unit?.isOccupied || false
    },
    validationSchema: UnitSchema,
    onSubmit: async (values, { setSubmitting }) => {
      if (!unit?.id) {
        openSnackbar({
          open: true,
          message: 'Unit ID is required',
          variant: 'alert',
          alert: { color: 'error' }
        });
        return;
      }

      setIsSubmitting(true);
      try {
        const payload = {
          id: unit.id,
          name: values.name.trim(),
          bedrooms: values.bedrooms || '',
          baths: values.baths || '',
          squareFeet: values.squareFeet ? Number(values.squareFeet) : 0,
          isOccupied: values.isOccupied,
          PropertyId: propertyId,
          type: unit?.type || '',
          rentAmount: unit?.rentAmount || 0,
          amenities: unit?.amenities || [],
          includedUtility: unit?.includedUtility || []
        };

        await dispatch(addOrUpdateUnit(payload));

        openSnackbar({
          open: true,
          message: 'Unit updated successfully',
          variant: 'alert',
          alert: { color: 'success' }
        });

        drawer.closeUnitEditDrawer();
        if (onUpdateSuccess) {
          onUpdateSuccess();
        }
      } catch (error) {
        console.error('Error updating unit:', error);
        openSnackbar({
          open: true,
          message: error?.response?.data?.message || 'Failed to update unit',
          variant: 'alert',
          alert: { color: 'error' }
        });
      } finally {
        setIsSubmitting(false);
        setSubmitting(false);
      }
    }
  });

  const { errors, touched, handleSubmit, getFieldProps, setFieldValue, values } = formik;

  // Handle adding new tenant
  const handleAddTenantSuccess = async (tenant) => {
    if (tenant && unit?.id) {
      try {
        // Link tenant to unit and lease if exists
        const tenantId = tenant.id || tenant.Id;
        const tenantPayload = {
          Id: tenantId,
          PropertyId: propertyId,
          UnitId: unit.id,
          LeaseId: lease?.id || null,
          Firstname: tenant.firstname || tenant.firstName || '',
          Lastname: tenant.lastname || tenant.lastName || '',
          Email: tenant.email || tenant.Email || null,
          PhoneNumber: tenant.phoneNumber || tenant.PhoneNumber || null
        };

        await axiosServices.put(`/api/tenant/${tenantId}`, tenantPayload);
        
        openSnackbar({
          open: true,
          message: 'Tenant added and linked to unit successfully',
          variant: 'alert',
          alert: { color: 'success' }
        });

        setAddTenantDialogOpen(false);
        refetchTenants();
        if (onUpdateSuccess) {
          onUpdateSuccess();
        }
      } catch (error) {
        console.error('Error linking tenant:', error);
        openSnackbar({
          open: true,
          message: error?.response?.data?.message || 'Failed to link tenant to unit',
          variant: 'alert',
          alert: { color: 'error' }
        });
      }
    }
  };

  // Handle linking existing tenant
  const handleLinkTenant = async () => {
    if (!selectedTenantToLink || !unit?.id) {
      openSnackbar({
        open: true,
        message: 'Please select a tenant to link',
        variant: 'alert',
        alert: { color: 'error' }
      });
      return;
    }

    setLinkingTenant(true);
    try {
      const tenantId = selectedTenantToLink.id;
      const tenantPayload = {
        Id: tenantId,
        PropertyId: propertyId,
        UnitId: unit.id,
        LeaseId: lease?.id || null,
        Firstname: selectedTenantToLink.tenant?.firstname || selectedTenantToLink.tenant?.firstName || '',
        Lastname: selectedTenantToLink.tenant?.lastname || selectedTenantToLink.tenant?.lastName || '',
        Email: selectedTenantToLink.tenant?.email || selectedTenantToLink.tenant?.Email || null,
        PhoneNumber: selectedTenantToLink.tenant?.phoneNumber || selectedTenantToLink.tenant?.PhoneNumber || null,
        UserId: selectedTenantToLink.tenant?.userId ?? selectedTenantToLink.tenant?.UserId ?? selectedTenantToLink.userId ?? selectedTenantToLink.UserId ?? null
      };

      await axiosServices.put(`/api/tenant/${tenantId}`, tenantPayload);
      
      openSnackbar({
        open: true,
        message: 'Tenant linked to unit successfully',
        variant: 'alert',
        alert: { color: 'success' }
      });

      setSelectedTenantToLink(null);
      setLinkTenantDialogOpen(false);
      refetchTenants();
      if (onUpdateSuccess) {
        onUpdateSuccess();
      }
    } catch (error) {
      console.error('Error linking tenant:', error);
      openSnackbar({
        open: true,
        message: error?.response?.data?.message || 'Failed to link tenant',
        variant: 'alert',
        alert: { color: 'error' }
      });
    } finally {
      setLinkingTenant(false);
    }
  };

  // Handle opening lease edit drawer
  const handleEditLease = () => {
    if (lease) {
      dispatch(setLease(lease));
      if (selectedProperty) {
        dispatch(setProperty(selectedProperty));
      }
      drawer.openLeaseEditDrawer();
    } else {
      openSnackbar({
        open: true,
        message: 'No lease found for this unit',
        variant: 'alert',
        alert: { color: 'warning' }
      });
    }
  };

  if (isSubmitting) {
    return (
      <Dialog open={drawer.isOpenUnitEdit} onClose={drawer.closeUnitEditDrawer} maxWidth="md" fullWidth>
        <Box sx={{ p: 5 }}>
          <Stack direction="row" justifyContent="center">
            <CircularWithPath />
          </Stack>
        </Box>
      </Dialog>
    );
  }

  return (
    <>
      <Dialog open={drawer.isOpenUnitEdit} onClose={drawer.closeUnitEditDrawer} maxWidth="md" fullWidth>
        <FormikProvider value={formik}>
          <Form autoComplete="off" noValidate onSubmit={handleSubmit}>
            <DialogTitle>Edit Unit</DialogTitle>
            <Divider />
            
            <Tabs value={activeTab} onChange={(e, newValue) => setActiveTab(newValue)} sx={{ borderBottom: 1, borderColor: 'divider', px: 2.5 }}>
              <Tab label="Unit Details" />
              <Tab label="Tenant Management" />
              <Tab label="Lease Management" />
            </Tabs>

            <DialogContent sx={{ p: 2.5, minHeight: 400 }}>
              {/* Unit Details Tab */}
              <TabPanel value={activeTab} index={0}>
                <Grid container spacing={3}>
                  <Grid size={12}>
                    <FormInput
                      id="unit-name"
                      label="Unit Name"
                      placeholder="Ex. Unit 1"
                      {...getFieldProps('name')}
                      error={Boolean(touched.name && errors.name)}
                      helperText={touched.name && errors.name}
                    />
                  </Grid>

                  <Grid size={6}>
                    <FormInput
                      label="Bedrooms"
                      placeholder="Ex. 2"
                      {...getFieldProps('bedrooms')}
                      error={Boolean(touched.bedrooms && errors.bedrooms)}
                      helperText={touched.bedrooms && errors.bedrooms}
                    />
                  </Grid>

                  <Grid size={6}>
                    <FormInput
                      label="Baths"
                      placeholder="Ex. 1.5"
                      {...getFieldProps('baths')}
                      error={Boolean(touched.baths && errors.baths)}
                      helperText={touched.baths && errors.baths}
                    />
                  </Grid>

                  <Grid size={12}>
                    <FormInput
                      label="Square Feet"
                      type="number"
                      placeholder="Ex. 1200"
                      {...getFieldProps('squareFeet')}
                      error={Boolean(touched.squareFeet && errors.squareFeet)}
                      helperText={touched.squareFeet && errors.squareFeet}
                    />
                  </Grid>

                </Grid>
              </TabPanel>

              {/* Tenant Management Tab */}
              <TabPanel value={activeTab} index={1}>
                <Stack spacing={3}>
                  <Box>
                    <Stack direction="row" spacing={2} alignItems="center" sx={{ mb: 2 }}>
                      <Typography variant="subtitle1" fontWeight={600}>
                        Current Tenants
                      </Typography>
                      <Button
                        size="small"
                        variant="outlined"
                        startIcon={<PlusOutlined />}
                        onClick={() => setAddTenantDialogOpen(true)}
                      >
                        Add New Tenant
                      </Button>
                      {tenantOptions.length > 0 && (
                        <Button
                          size="small"
                          variant="outlined"
                          startIcon={<UserOutlined />}
                          onClick={() => setLinkTenantDialogOpen(true)}
                        >
                          Link Existing Tenant
                        </Button>
                      )}
                    </Stack>

                    {currentTenants.length > 0 ? (
                      <List>
                        {currentTenants.map((tenant, index) => {
                          const firstname = tenant.firstname || tenant.firstName || '';
                          const lastname = tenant.lastname || tenant.lastName || '';
                          const fullName = `${firstname} ${lastname}`.trim() || 'Unnamed Tenant';
                          const email = tenant.email || tenant.Email || '';
                          return (
                            <ListItem
                              key={tenant.id || tenant.Id || index}
                              sx={{
                                border: `1px solid ${alpha('#000', 0.1)}`,
                                borderRadius: 1,
                                mb: 1
                              }}
                            >
                              <ListItemText
                                primary={fullName}
                                secondary={email || 'No email'}
                              />
                            </ListItem>
                          );
                        })}
                      </List>
                    ) : (
                      <Alert severity="info">
                        No tenants are currently linked to this unit's lease.
                      </Alert>
                    )}
                  </Box>

                  {/* Link Tenant Dialog */}
                  {linkTenantDialogOpen && (
                    <Box sx={{ border: `1px solid ${alpha('#000', 0.1)}`, borderRadius: 1, p: 2 }}>
                      <Typography variant="subtitle2" sx={{ mb: 2 }}>
                        Link Existing Tenant
                      </Typography>
                      <Stack spacing={2}>
                        <Autocomplete
                          options={tenantOptions}
                          width="100%"
                          label="Select Tenant"
                          value={selectedTenantToLink}
                          onChange={(_, value) => setSelectedTenantToLink(value)}
                          getOptionLabel={(option) => {
                            if (!option) return '';
                            const email = option.email ? ` (${option.email})` : '';
                            return `${option.label}${email}`;
                          }}
                        />
                        <Stack direction="row" spacing={2} justifyContent="flex-end">
                          <Button
                            size="small"
                            variant="outlined"
                            onClick={() => {
                              setLinkTenantDialogOpen(false);
                              setSelectedTenantToLink(null);
                            }}
                          >
                            Cancel
                          </Button>
                          <Button
                            size="small"
                            variant="contained"
                            onClick={handleLinkTenant}
                            disabled={!selectedTenantToLink || linkingTenant}
                          >
                            {linkingTenant ? 'Linking...' : 'Link Tenant'}
                          </Button>
                        </Stack>
                      </Stack>
                    </Box>
                  )}
                </Stack>
              </TabPanel>

              {/* Lease Management Tab */}
              <TabPanel value={activeTab} index={2}>
                <Stack spacing={3}>
                  {lease ? (
                    <>
                      <Box>
                        <Stack direction="row" spacing={2} alignItems="center" justifyContent="space-between" sx={{ mb: 2 }}>
                          <Typography variant="subtitle1" fontWeight={600}>
                            Lease Information
                          </Typography>
                          <Button
                            size="small"
                            variant="contained"
                            startIcon={<EditOutlined />}
                            onClick={handleEditLease}
                          >
                            Edit Lease
                          </Button>
                        </Stack>

                        <Grid container spacing={2}>
                          <Grid size={6}>
                            <Typography variant="body2" color="text.secondary">
                              Rent Amount
                            </Typography>
                            <Typography variant="body1" fontWeight={600}>
                              ${lease.rentAmount?.toLocaleString() || '0'}
                            </Typography>
                          </Grid>
                          <Grid size={6}>
                            <Typography variant="body2" color="text.secondary">
                              Rent Frequency
                            </Typography>
                            <Typography variant="body1" fontWeight={600}>
                              {lease.rentFrequency || 'Monthly'}
                            </Typography>
                          </Grid>
                          <Grid size={6}>
                            <Typography variant="body2" color="text.secondary">
                              Start Date
                            </Typography>
                            <Typography variant="body1" fontWeight={600}>
                              {lease.startDate ? new Date(lease.startDate).toLocaleDateString() : 'N/A'}
                            </Typography>
                          </Grid>
                          <Grid size={6}>
                            <Typography variant="body2" color="text.secondary">
                              End Date
                            </Typography>
                            <Typography variant="body1" fontWeight={600}>
                              {lease.endDate ? new Date(lease.endDate).toLocaleDateString() : 'N/A'}
                            </Typography>
                          </Grid>
                          <Grid size={12}>
                            <Typography variant="body2" color="text.secondary">
                              Status
                            </Typography>
                            <Chip
                              label={lease.isActive ? 'Active' : 'Inactive'}
                              color={lease.isActive ? 'success' : 'default'}
                              size="small"
                            />
                          </Grid>
                        </Grid>
                      </Box>
                    </>
                  ) : (
                    <Alert severity="info">
                      No lease found for this unit. Create a lease to manage tenant information.
                    </Alert>
                  )}
                </Stack>
              </TabPanel>
            </DialogContent>

            <Divider />
            <DialogActions sx={{ p: 2.5 }}>
              <Stack direction="row" spacing={2} width="100%" justifyContent="flex-end">
                <Button variant="outlined" color="inherit" onClick={drawer.closeUnitEditDrawer} disabled={isSubmitting}>
                  Cancel
                </Button>
                <Button type="submit" variant="contained" disabled={isSubmitting}>
                  Save Changes
                </Button>
              </Stack>
            </DialogActions>
          </Form>
        </FormikProvider>
      </Dialog>

      {/* Add Tenant Dialog */}
      <AddTenantDialog
        open={addTenantDialogOpen}
        onClose={() => setAddTenantDialogOpen(false)}
        onSuccess={handleAddTenantSuccess}
      />

      {/* Lease Edit Drawer */}
      <LeaseEditDrawer onUpdateSuccess={onUpdateSuccess} />
    </>
  );
};

UnitEditDrawer.propTypes = {
  propertyId: PropTypes.number.isRequired,
  onUpdateSuccess: PropTypes.func
};

export default UnitEditDrawer;
