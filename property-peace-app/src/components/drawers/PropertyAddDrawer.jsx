import PropTypes from 'prop-types';
import { useEffect, useState } from 'react';

// material-ui
import { alpha } from '@mui/system';
import {
  Box,
  Button,
  Checkbox,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Divider,
  FormControlLabel,
  FormLabel,
  Grid,
  InputLabel,
  Stack,
  Switch,
  TextField,
  Tooltip,
  Typography,
  useTheme
} from '@mui/material';

import { LocalizationProvider } from '@mui/x-date-pickers';
import { AdapterDateFns } from '@mui/x-date-pickers/AdapterDateFns';
import { useDrawer } from 'contexts/DrawerContext';

// hooks
import useAuth from 'hooks/useAuth';
import { useSubscriptionStatus } from 'hooks/useSubscription';

// third-party
import { merge } from 'lodash-es';
import * as Yup from 'yup';
import { useFormik, Form, FormikProvider } from 'formik';

// project imports
import AlertCustomerDelete from './AlertCustomerDelete';
import Avatar from 'components/@extended/Avatar';
import IconButton from 'components/@extended/IconButton';
import CircularWithPath from 'components/@extended/progress/CircularWithPath';

import { openSnackbar } from 'api/snackbar';

// assets
import CameraOutlined from '@ant-design/icons/CameraOutlined';
import DeleteFilled from '@ant-design/icons/DeleteFilled';
import CloseOutlined from '@ant-design/icons/CloseOutlined';
import PlusOutlined from '@ant-design/icons/PlusOutlined';
import FormInput from 'components/input/FormInput';
import FormSelect from 'components/input/FormSelect';
import AddressFieldWithPlaces from 'components/input/AddressFieldWithPlaces';
import useCreateProperty from 'hooks/useCreateProperty';
import { addUnit } from '../../api/unit';
import axiosServices from 'utils/axios';
import { getActiveOrganizationId } from 'utils/impersonationSession';
import AddSwitch from '../AddSwitch';
import { LeaseFields } from '../fields/LeaseFields';
import TenantFields from '../fields/TenantFields';
import UnitFields from '../fields/UnitFields';
import { addOrUpdateLease } from '../../store/lease/lease.action';
import { addOrUpdateTenant } from '../../store/tenant/tenant.action';
import { useDispatch } from 'react-redux';
import GooglePhotoConfirmationDialog from 'components/dialogs/GooglePhotoConfirmationDialog';
import { useGooglePlacePhotos } from 'hooks/useGooglePlacePhotos';

// constant
const getInitialValues = (property) => {
  const newProperty = {
    name: '',
    propertyType: 'singleFamily',
    streetAddress: '',
    images: [],
    unitName: '',
    leaseStartDate: '',
    leaseEndDate: '',
    tenants: [{ firstName: '', lastName: '', email: '', phone: '' }],
    units: [{ name: '', bedrooms: '', baths: '', squareFeet: '', isOccupied: false }],
    showUnit: false,
    showLease: false,
    showTenants: false,
    primaryTenantIndex: 0
  };

  return property ? merge({}, newProperty, property) : newProperty;
};

const propertyTypes = [
  { id: 1, value: 'singleFamily', label: 'Single-Family' },
  { id: 2, value: 'multiUnit', label: 'Multi-Unit Home' }
];

// ==============================|| CUSTOMER ADD / EDIT - FORM ||============================== //

export default function PropertyAddDrawer({ property, closeModal }) {
  const drawer = useDrawer();
  const dispatch = useDispatch();
  const { user } = useAuth();
  const { status: subscriptionStatus } = useSubscriptionStatus();
  const theme = useTheme();

  const { createProperty, createLoading } = useCreateProperty();
  const [loading, setLoading] = useState(true);
  const [selectedImage, setSelectedImage] = useState(undefined);
  const [googlePhotoDialogOpen, setGooglePhotoDialogOpen] = useState(false);
  const [googlePhotoUrl, setGooglePhotoUrl] = useState(null);
  const [pendingPlace, setPendingPlace] = useState(null);
  const [photoSource, setPhotoSource] = useState(null); // 'places' or 'streetview'
  const { fetchPhotosFromPlace, loading: fetchingPhoto } = useGooglePlacePhotos();

  const [avatar, setAvatar] = useState('/src/assets/images/placeholder-house.png');


  useEffect(() => {
    if (selectedImage) {
      setAvatar(URL.createObjectURL(selectedImage));
    }
  }, [selectedImage]);

  useEffect(() => {
    setLoading(false);
  }, []);

  // Handler for when address is selected
  const handleAddressSelected = async (address, place) => {
    // Auto-populate property name with street address (extracted by AddressFieldWithPlaces)
    // The streetAddress field will contain just the street address (no city/state/zip)
    const streetAddress = formik.values.streetAddress || address;
    if (streetAddress && !formik.values.name) {
      formik.setFieldValue('name', streetAddress);
    }
    
    // Fetch photos from the place (or Street View as fallback)
    const photoResult = await fetchPhotosFromPlace(place, address);
    
    if (photoResult && photoResult.url) {
      setPendingPlace(place);
      setGooglePhotoUrl(photoResult.url);
      setPhotoSource(photoResult.source);
      setGooglePhotoDialogOpen(true);
    } else {
      console.log('No photo available for this property');
    }
  };

  // Handler for confirming Google photo
  const handleConfirmGooglePhoto = async () => {
    if (googlePhotoUrl) {
      try {
        // Convert photo URL to File object
        const response = await fetch(googlePhotoUrl);
        const blob = await response.blob();
        const file = new File([blob], 'google-maps-photo.jpg', { type: blob.type });
        
        // Set it as the selected image (same as if user uploaded it)
        setSelectedImage(file);
        
        setGooglePhotoDialogOpen(false);
        setGooglePhotoUrl(null);
        setPendingPlace(null);
        setPhotoSource(null);
      } catch (error) {
        console.error('Error converting Google photo to file:', error);
        openSnackbar({
          open: true,
          message: 'Failed to load Google photo',
          variant: 'alert',
          alert: { color: 'error' }
        });
      }
    }
  };

  // Handler for canceling Google photo
  const handleCancelGooglePhoto = () => {
    setGooglePhotoDialogOpen(false);
    setGooglePhotoUrl(null);
    setPendingPlace(null);
    setPhotoSource(null);
  };

  const PropertySchema = Yup.object().shape({
    name: Yup.string().max(255).required('Property Name is required'),
    streetAddress: Yup.string().max(255).required('Street Address is required'),
    propertyType: Yup.string().required('Property Type is required')
  });

  const [openAlert, setOpenAlert] = useState(false);

  const handleAlertClose = () => {
    setOpenAlert(!openAlert);
    closeModal();
  };

  const formik = useFormik({
    initialValues: getInitialValues(property),
    validationSchema: PropertySchema,
    enableReinitialize: true,
    onSubmit: async (values, { setSubmitting, resetForm }) => {
      try {
        // Check if user has an active subscription
        if (!subscriptionStatus?.hasActiveSubscription) {
          openSnackbar({
            open: true,
            message: 'Please start a subscription plan to add properties.',
            variant: 'alert',
            alert: { color: 'warning' }
          });
          setSubmitting(false);
          return;
        }

        // STEP 1️⃣: Create the property
        // Use street address (without city/state/zip) as the property name
        const streetAddressOnly = (values.streetAddress || '').trim();
        const payload = {
          name: streetAddressOnly, // Property name should be just street address
          propertyType: values.propertyType,
          streetAddress: streetAddressOnly,
          primaryManagerId: values.primaryManagerId || null
        };

        const mainImage = selectedImage ? selectedImage : null;
        const created = await createProperty(payload, mainImage); // returns new property object

        // STEP 2️⃣: Create/Update units
        const createdUnits = [];
        
        if (values.propertyType === 'singleFamily') {
          // Backend already creates "Unit 1" for single-family properties
          // Fetch the property to get the existing unit, then update it with user's values
          try {
            const propertyResponse = await axiosServices.get(`/api/property/${created.id}`);
            const propertyWithUnits = propertyResponse.data?.data;
            const existingUnit = propertyWithUnits?.units?.[0];
            
            if (existingUnit) {
              // Update the existing unit with user's values
              const unit = await addUnit({
                id: existingUnit.id,
                name: existingUnit.name || 'Unit 1',
                PropertyId: created.id,
                bedrooms: values.bedrooms || '',
                baths: values.baths || '',
                isOccupied: values.isOccupied || false
              });
              createdUnits.push(unit);
            } else {
              // Fallback: if unit doesn't exist, create it
              const unit = await addUnit({
                name: 'Unit 1',
                PropertyId: created.id,
                bedrooms: values.bedrooms || '',
                baths: values.baths || '',
                isOccupied: values.isOccupied || false
              });
              createdUnits.push(unit);
            }
          } catch (error) {
            console.error('Error fetching property units:', error);
            // Fallback: try to create unit if fetch fails
            try {
              const unit = await addUnit({
                name: 'Unit 1',
                PropertyId: created.id,
                bedrooms: values.bedrooms || '',
                baths: values.baths || '',
                isOccupied: values.isOccupied || false
              });
              createdUnits.push(unit);
            } catch (createError) {
              console.error('Error creating unit:', createError);
              // Continue without unit - user can add it manually later
            }
          }
        } else if (values.showUnit && Array.isArray(values.units) && values.units.length > 0) {
          // Create all units for multi-unit properties
          for (const unit of values.units) {
            if (unit.name && unit.name.trim()) {
              const newUnit = await addUnit({
                name: unit.name.trim(),
                PropertyId: created.id,
                bedrooms: unit.bedrooms || '',
                baths: unit.baths || '',
                squareFeet: unit.squareFeet ? Number(unit.squareFeet) : 0,
                isOccupied: unit.isOccupied || false
              });
              createdUnits.push(newUnit);
            }
          }
        }

        // STEP 3️⃣: Add Lease if selected
        // Note: For multi-unit properties, lease will be associated with the first unit
        // User can add leases for other units later from the property/unit pages
        if (values.showLease && createdUnits.length > 0) {
          const currentOrganizationId = getActiveOrganizationId(user);
          
          const leasePayload = {
            PropertyId: created.id,
            UnitId: createdUnits[0]?.id || null,
            OrganizationId: currentOrganizationId ? parseInt(currentOrganizationId) : null,
            StartDate: new Date(values.leaseStartDate),
            EndDate: new Date(values.leaseEndDate),
            LeaseLength: Number(values.leaseLength || 12),
            RentAmount: Number(values.rentAmount || 0),
            RentFrequency: values.rentFrequency === 'monthly' ? 'Monthly' : values.rentFrequency === 'quarterly' ? 'Quarterly' : 'Yearly',
            RentDueDay: Number(values.rentDueDay || 1),
            MarkPastPaymentsAsPaid: values.markPastPaymentsAsPaid || false
          };

          // ✅ Call your existing redux thunk or API
          await dispatch(addOrUpdateLease(leasePayload));
        }

        // STEP 4️⃣: Add Tenants if selected
        // Note: For multi-unit properties, tenants will be associated with the first unit
        // User can add tenants for other units later from the property/unit pages
        if (values.showTenants && Array.isArray(values.tenants) && values.tenants.length > 0 && createdUnits.length > 0) {
          for (const tenant of values.tenants) {
            if (tenant.firstname && tenant.lastname) {
              const tenantPayload = {
                PropertyId: created.id,
                UnitId: createdUnits[0]?.id || null,
                Firstname: tenant.firstname,
                Lastname: tenant.lastname,
                Email: tenant.email || null,
                PhoneNumber: tenant.phoneNumber || null
              };

              await dispatch(addOrUpdateTenant(tenantPayload));
            }
          }
        }

        // STEP 5️⃣: Finish up
        openSnackbar({
          open: true,
          message: `Property "${created?.name ?? payload.name}" added successfully.`,
          variant: 'alert',
          alert: { color: 'success' }
        });

        resetForm();
        setSelectedImage(undefined);
        drawer.closePropertyAddDrawer?.();
      } catch (error) {
        console.error(error);
        openSnackbar({
          open: true,
          message: error?.response?.data?.message || 'Failed to add property, lease, or tenants.',
          variant: 'alert',
          alert: { color: 'error' }
        });
      } finally {
        setSubmitting(false);
      }
    }
  });

  const { errors, touched, handleSubmit, isSubmitting, getFieldProps, setFieldValue, values } = formik;

  if (loading)
    return (
      <Box sx={{ p: 5 }}>
        <Stack direction="row" sx={{ justifyContent: 'center' }}>
          <CircularWithPath />
        </Stack>
      </Box>
    );

  return (
    <Dialog open={drawer.isOpenPropertyAdd} onClose={drawer.closePropertyAddDrawer} maxWidth="md" fullWidth>
      {/* ✅ use Dialog instead of Modal */}
      <FormikProvider value={formik}>
        <LocalizationProvider dateAdapter={AdapterDateFns}>
          <Form autoComplete="off" noValidate onSubmit={handleSubmit}>
            <DialogTitle>{'Add New Property'}</DialogTitle>
            <Divider />
            <DialogContent sx={{ p: 2.5 }}>
              <Grid container spacing={3}>
                {/* ✅ FIXED Grid props */}
                <Grid size={{ xs: 12, md: 3 }}>
                  <Stack direction="row" sx={{ justifyContent: 'center', mt: 3 }}>
                    <FormLabel
                      htmlFor="change-avtar"
                      sx={{
                        position: 'relative',
                        borderRadius: '50%',
                        overflow: 'hidden',
                        '&:hover .MuiBox-root': { opacity: 1 },
                        cursor: 'pointer'
                      }}
                    >
                      <Avatar alt="Avatar 1" src={avatar} sx={{ width: 150, height: 150, border: '1px dashed' }} />
                      <Box
                        sx={(theme) => ({
                          position: 'absolute',
                          top: 0,
                          left: 0,
                          bgcolor: alpha(theme.palette.secondary.dark, 0.75),
                          width: '100%',
                          height: '100%',
                          opacity: 0,
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          color: 'secondary.lighter'
                        })}
                      >
                        <Stack sx={{ gap: 0.25, alignItems: 'center' }}>
                          <CameraOutlined style={{ fontSize: '1.5rem' }} />
                          <Typography>Upload</Typography>
                        </Stack>
                      </Box>
                    </FormLabel>
                    <TextField
                      type="file"
                      id="change-avtar"
                      placeholder="Outlined"
                      variant="outlined"
                      sx={{ display: 'none' }}
                      onChange={(e) => setSelectedImage(e.target.files?.[0])}
                    />
                  </Stack>
                </Grid>
                <Grid size={{ xs: 12, md: 8 }}>
                  <Grid container spacing={3}>
                    <Grid size={{ xs: 12 }}>
                      <FormInput
                        id="property-name"
                        className="property-name"
                        label="Property Name"
                        placeholder="Ex. East Main St. Property"
                        {...getFieldProps('name')}
                        error={Boolean(touched.name && errors.name)}
                        helperText={touched.name && errors.name}
                      />
                    </Grid>

                    <Grid size={{ xs: 12 }}>
                      <Stack sx={{ gap: 1 }}>
                        <InputLabel htmlFor="property-streetAddress">Street Address</InputLabel>
                        <AddressFieldWithPlaces 
                          formik={formik} 
                          name="streetAddress"
                          onSelected={handleAddressSelected}
                        />
                      </Stack>
                    </Grid>

                    <Grid size={12}>
                      <FormSelect
                        name="propertyType"
                        className="property-type"
                        label="Property Type"
                        options={(() => {
                          // Property limits removed - all property types are allowed based on unit limits only
                          return propertyTypes;
                        })()}
                        value={values.propertyType}
                        setFieldValue={setFieldValue}
                        touched={touched.propertyType}
                        errorText={errors.propertyType}
                        placeholder="Select Property Type"
                        valueType="string"
                        displayEmpty
                      />
                    </Grid>
                    {/* ADD UNIT */}
                    {values.propertyType === 'multiUnit' ? (
                      <>
                        <Grid size={12}>
                          <AddSwitch
                            title="Add Units?"
                            caption="You can add units for the property now or wait and add them later."
                            control={
                              <Switch
                                checked={values.showUnit}
                                onChange={(event) => setFieldValue('showUnit', event.target.checked)}
                                sx={{ mt: 0 }}
                              />
                            }
                          />
                        </Grid>
                        {values.showUnit && <UnitFields values={values} errors={errors} touched={touched} setFieldValue={setFieldValue} />}
                      </>
                    ) : (
                      <>
                        <Grid size={{ xs: 4 }}>
                          <FormInput
                            id="bedrooms"
                            label="Bedrooms"
                            placeholder="Ex. 4"
                            {...getFieldProps('bedrooms')}
                            error={Boolean(touched.bedrooms && errors.bedrooms)}
                            helperText={touched.bedrooms && errors.bedrooms}
                          />
                        </Grid>
                        <Grid size={{ xs: 4 }}>
                          <FormInput
                            id="baths"
                            label="Baths"
                            placeholder="Ex. 2.5"
                            {...getFieldProps('baths')}
                            error={Boolean(touched.baths && errors.baths)}
                            helperText={touched.baths && errors.baths}
                          />
                        </Grid>
                        <Grid size={{ xs: 4 }}>
                          <Box display={'flex'} justifyContent="end" mt={3}>
                            <FormControlLabel
                              control={
                                <Checkbox
                                  checked={values.isOccupied}
                                  onChange={(event) => setFieldValue('isOccupied', event.target.checked)}
                                />
                              }
                              label="Occupied?"
                            />
                          </Box>
                        </Grid>
                      </>
                    )}
                    {/* ADD LEASE */}
                    <Grid size={12}>
                      <AddSwitch
                        title="Add Lease?"
                        caption="You can add the lease for the property now or wait and add it later."
                        control={
                          <Switch
                            checked={values.showLease}
                            onChange={(event) => setFieldValue('showLease', event.target.checked)}
                            sx={{ mt: 0 }}
                          />
                        }
                      />
                    </Grid>
                    {values.showLease && <LeaseFields values={values} errors={errors} touched={touched} setFieldValue={setFieldValue} />}
                    {/* ADD TENANTS */}
                    <Grid size={12}>
                      <Stack direction="row" sx={{ alignItems: 'center', justifyContent: 'space-between' }}>
                        <Stack sx={{ gap: 0.5 }}>
                          <Typography variant="subtitle1">Add Tenants?</Typography>
                          <Typography variant="caption" color="text.secondary">
                            You can add the tenants for the property now or wait and add them later.
                          </Typography>
                        </Stack>
                        <FormControlLabel
                          control={
                            <Switch
                              checked={values.showTenants}
                              onChange={(event) => setFieldValue('showTenants', event.target.checked)}
                              sx={{ mt: 0 }}
                            />
                          }
                          label=""
                          labelPlacement="start"
                        />
                      </Stack>
                    </Grid>
                    {values.showTenants && <TenantFields values={values} errors={errors} touched={touched} setFieldValue={setFieldValue} />}
                  </Grid>
                </Grid>
              </Grid>
            </DialogContent>
            <Divider />
            <DialogActions sx={{ p: 2.5 }}>
              <Grid container justifyContent="space-between" alignItems="center" sx={{ width: 1 }}>
                <Grid>
                  {property && (
                    <Tooltip title="Delete Property" placement="top">
                      <IconButton onClick={() => setOpenAlert(true)} size="large" color="error">
                        <DeleteFilled />
                      </IconButton>
                    </Tooltip>
                  )}
                </Grid>
                <Grid>
                  <Stack direction="row" spacing={2} justifyContent="flex-end" width="100%">
                    <Button
                      variant="text"
                      onClick={drawer.closePropertyAddDrawer}
                      startIcon={<CloseOutlined style={{ fontSize: 16, color: 'inherit' }} />}
                      sx={{
                        color: 'text.secondary',
                        textTransform: 'none',
                        minWidth: 'auto',
                        px: 1,
                        '&:hover': {
                          bgcolor: alpha(theme.palette.common.black, 0.04)
                        }
                      }}
                    >
                      Cancel
                    </Button>
                    <Tooltip 
                      title={!subscriptionStatus?.canAddProperty ? (subscriptionStatus?.upgradeMessage || 'Subscription not active. Please activate your subscription.') : ''}
                      placement="top"
                    >
                      <span>
                        <Button 
                          type="submit" 
                          variant="text"
                          disabled={isSubmitting || !subscriptionStatus?.canAddProperty}
                          startIcon={<PlusOutlined style={{ fontSize: 16, color: 'inherit' }} />}
                          sx={{
                            color: 'primary.main',
                            textTransform: 'none',
                            minWidth: 'auto',
                            px: 1,
                            '&:hover': {
                              bgcolor: alpha(theme.palette.primary.main, 0.08)
                            },
                            '&:disabled': {
                              color: 'text.disabled'
                            }
                          }}
                        >
                          Add Property
                        </Button>
                      </span>
                    </Tooltip>
                  </Stack>
                </Grid>
              </Grid>
            </DialogActions>
          </Form>
        </LocalizationProvider>
      </FormikProvider>
      
      {/* Google Photo Confirmation Dialog */}
      <GooglePhotoConfirmationDialog
        open={googlePhotoDialogOpen}
        photoUrl={googlePhotoUrl}
        onConfirm={handleConfirmGooglePhoto}
        onCancel={handleCancelGooglePhoto}
        loading={fetchingPhoto}
      />
      
      {property && <AlertCustomerDelete id={property.id} title={property.name} open={openAlert} handleClose={handleAlertClose} />}
    </Dialog>
  );
}

PropertyAddDrawer.propTypes = { property: PropTypes.any, closeModal: PropTypes.func };
