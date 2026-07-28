import ThemeAdaptiveDrawer from 'components/drawers/shared/ThemeAdaptiveDrawer';
import PropTypes from 'prop-types';
import { useEffect, useState } from 'react';
import {
  Box,
  Button,
  Divider,
  Grid,
  IconButton,
  Stack,
  TextField,
  Typography,
  Tooltip,
  useTheme
} from '@mui/material';
import { alpha } from '@mui/system';
import { LocalizationProvider } from '@mui/x-date-pickers';
import { AdapterDateFns } from '@mui/x-date-pickers/AdapterDateFns';
import { merge } from 'lodash-es';
import * as Yup from 'yup';
import { useFormik, Form, FormikProvider } from 'formik';
import { useNavigate } from 'react-router-dom';
import { useDrawer } from 'contexts/DrawerContext';

// components
import Avatar from 'components/@extended/Avatar';
import CircularWithPath from 'components/@extended/progress/CircularWithPath';
import FormInput from 'components/input/FormInput';
import FormSelect from 'components/input/FormSelect';
import AddressFieldWithPlaces from 'components/input/AddressFieldWithPlaces';
import { openSnackbar } from 'api/snackbar';
import GooglePhotoConfirmationDialog from 'components/dialogs/GooglePhotoConfirmationDialog';
import { useGooglePlacePhotos } from 'hooks/useGooglePlacePhotos';

// assets
import CameraOutlined from '@ant-design/icons/CameraOutlined';
import CloseOutlined from '@ant-design/icons/CloseOutlined';
import CheckOutlined from '@ant-design/icons/CheckOutlined';

// hooks
import useAuth from 'hooks/useAuth';
import { useUpdateProperty } from 'hooks/useUpdateProperty';
import { useSelector, useDispatch } from 'react-redux';
import { selectProperty } from 'store/property/property.selector';
import { addOrUpdateUnit } from 'store/unit/unit.action';

// constants
const propertyTypes = [
  { id: 1, value: 'singleFamily', label: 'Single-Family' },
  { id: 2, value: 'multiUnit', label: 'Multi-Unit Home (Apartment Complex)' }
];

const getInitialValues = (property) => {
  // Normalize propertyType to camelCase format
  let propertyType = property?.propertyType || 'singleFamily';
  if (propertyType) {
    // Convert to lowercase for comparison
    const lowerType = propertyType.toLowerCase();
    // Map to expected camelCase values
    if (lowerType === 'singlefamily' || lowerType === 'single-family') {
      propertyType = 'singleFamily';
    } else if (lowerType === 'multiunit' || lowerType === 'multi-unit') {
      propertyType = 'multiUnit';
    }
    // If already in camelCase format, keep it as is
    // Otherwise, default to singleFamily
    if (propertyType !== 'singleFamily' && propertyType !== 'multiUnit') {
      propertyType = 'singleFamily';
    }
  }

  // For single family properties, get bedrooms, baths, squareFeet, and isOccupied from the unit
  const unit = property?.units?.[0];
  const isSingleFamily = propertyType === 'singleFamily';

  return merge(
    {
      name: '',
      propertyType: 'singleFamily',
      streetAddress: '',
      bedrooms: '',
      baths: '',
      squareFeet: 0,
      isOccupied: false,
      image: ''
    },
    {
      ...property,
      propertyType,
      // Override with unit values for single family properties
      ...(isSingleFamily && unit ? {
        bedrooms: unit.bedrooms || '',
        baths: unit.baths || '',
        squareFeet: unit.squareFeet || 0,
        isOccupied: unit.isOccupied || false
      } : {})
    }
  );
};

export default function PropertyEditDrawer({ onUpdateSuccess }) {
  const drawer = useDrawer();
  const navigate = useNavigate();
  const dispatch = useDispatch();
  const { user } = useAuth();
  const { updateProperty, updateLoading } = useUpdateProperty();
  const theme = useTheme();

  const selectedProperty = useSelector(selectProperty);
  const [selectedImage, setSelectedImage] = useState(null);
  const [googlePhotoDialogOpen, setGooglePhotoDialogOpen] = useState(false);
  const [googlePhotoUrl, setGooglePhotoUrl] = useState(null);
  const [pendingPlace, setPendingPlace] = useState(null);
  const [photoSource, setPhotoSource] = useState(null); // 'places' or 'streetview'
  const { fetchPhotosFromPlace, loading: fetchingPhoto } = useGooglePlacePhotos();

  const [avatar, setAvatar] = useState('/src/assets/images/placeholder-house.png');

  // Get the first image from images array if available, otherwise use image property or placeholder
  useEffect(() => {
    if (selectedProperty) {
      if (selectedProperty.images && selectedProperty.images.length > 0 && selectedProperty.images[0]?.blobUrl) {
        setAvatar(selectedProperty.images[0].blobUrl);
      } else if (selectedProperty.image) {
        setAvatar(selectedProperty.image);
      } else {
        setAvatar('/src/assets/images/placeholder-house.png');
      }
    }
  }, [selectedProperty]);

  const PropertySchema = Yup.object().shape({
    name: Yup.string().max(255).required('Property name is required'),
    streetAddress: Yup.string().max(255).required('Street address is required'),
    propertyType: Yup.string().required('Property type is required')
  });

  const formik = useFormik({
    initialValues: getInitialValues(selectedProperty),
    validationSchema: PropertySchema,
    enableReinitialize: true,
    onSubmit: async (values, { setSubmitting }) => {
      try {
        const payload = {
          ...values,
          id: selectedProperty.id,
          landlordId: user?.id
        };

        // Remove unit-specific fields from property payload
        const { bedrooms, baths, squareFeet, isOccupied, ...propertyPayload } = payload;

        const mainImage = selectedImage ? selectedImage : null;
        await updateProperty(propertyPayload, mainImage);

        // If single family property, also update the unit
        const isSingleFamily = values.propertyType === 'singleFamily';
        if (isSingleFamily && selectedProperty?.units?.[0]?.id) {
          const unit = selectedProperty.units[0];
          const unitPayload = {
            id: unit.id,
            name: unit.name || 'Unit 1',
            bedrooms: values.bedrooms || '',
            baths: values.baths || '',
            squareFeet: values.squareFeet ? Number(values.squareFeet) : 0,
            isOccupied: values.isOccupied || false,
            PropertyId: selectedProperty.id,
            type: unit.type || '',
            rentAmount: unit.rentAmount || 0,
            amenities: unit.amenities || [],
            includedUtility: unit.includedUtility || []
          };

          await dispatch(addOrUpdateUnit(unitPayload));
        }

        openSnackbar({
          open: true,
          message: `Property "${values.name}" updated successfully.`,
          variant: 'alert',
          alert: { color: 'success' }
        });

        drawer.closePropertyEditDrawer();
        
        // Trigger refresh callback if provided
        if (onUpdateSuccess) {
          onUpdateSuccess();
        }
      } catch (error) {
        console.error(error);
        openSnackbar({
          open: true,
          message: 'Failed to update property.',
          variant: 'alert',
          alert: { color: 'error' }
        });
      } finally {
        setSubmitting(false);
      }
    }
  });

  const { errors, touched, handleSubmit, isSubmitting, getFieldProps, setFieldValue, values } = formik;

  useEffect(() => {
    if (selectedImage) {
      setAvatar(URL.createObjectURL(selectedImage));
    } else if (selectedProperty) {
      // Reset to property image when no selected image
      if (selectedProperty.images && selectedProperty.images.length > 0 && selectedProperty.images[0]?.blobUrl) {
        setAvatar(selectedProperty.images[0].blobUrl);
      } else if (selectedProperty.image) {
        setAvatar(selectedProperty.image);
      } else {
        setAvatar('/src/assets/images/placeholder-house.png');
      }
    }
  }, [selectedImage, selectedProperty]);

  // Handler for when address is selected
  const handleAddressSelected = async (address, place) => {
    console.log('Address selected:', address, 'Place:', place);
    
    // Fetch photos from the place (or Street View as fallback)
    const photoResult = await fetchPhotosFromPlace(place, address);
    console.log('Photo result:', photoResult);
    
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

  return (
    <ThemeAdaptiveDrawer
      anchor="right"
      open={drawer.isOpenPropertyEdit}
      onClose={drawer.closePropertyEditDrawer}
      PaperProps={{
        sx: {
          width: { xs: '100%', sm: 520 },
          display: 'flex',
          flexDirection: 'column',
          bgcolor: 'background.paper'
        }
      }}
    >
      <FormikProvider value={formik}>
        <LocalizationProvider dateAdapter={AdapterDateFns}>
          <Form autoComplete="off" noValidate onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>

            {/* Header */}
            <Box sx={{ px: 3, py: 2, display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexShrink: 0 }}>
              <Typography variant="h5" fontWeight={600}>Edit Property</Typography>
              <IconButton size="small" onClick={drawer.closePropertyEditDrawer} edge="end">
                <CloseOutlined style={{ fontSize: 16 }} />
              </IconButton>
            </Box>
            <Divider />

            {/* Scrollable body */}
            <Box sx={{ flex: 1, overflowY: 'auto', px: 3, py: 3 }}>
              {updateLoading ? (
                <Stack direction="row" justifyContent="center" sx={{ py: 6 }}>
                  <CircularWithPath />
                </Stack>
              ) : (
                <Grid container spacing={3}>
                  {/* Photo upload */}
                  <Grid size={12}>
                    <Stack direction="row" justifyContent="center">
                      <Box
                        component="label"
                        htmlFor="property-image-upload"
                        sx={{
                          position: 'relative',
                          borderRadius: '50%',
                          overflow: 'hidden',
                          cursor: 'pointer',
                          '&:hover .MuiBox-root': { opacity: 1 }
                        }}
                      >
                        <Avatar alt="Property" src={avatar} sx={{ width: 120, height: 120, border: '1px dashed' }} />
                        <Box
                          sx={(t) => ({
                            position: 'absolute',
                            top: 0,
                            left: 0,
                            bgcolor: alpha(t.palette.secondary.dark, 0.75),
                            width: '100%',
                            height: '100%',
                            opacity: 0,
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            color: 'secondary.lighter'
                          })}
                        >
                          <Stack spacing={0.25} alignItems="center">
                            <CameraOutlined style={{ fontSize: '1.5rem' }} />
                            <Typography variant="caption">Change</Typography>
                          </Stack>
                        </Box>
                      </Box>
                      <TextField
                        id="property-image-upload"
                        type="file"
                        variant="outlined"
                        sx={{ display: 'none' }}
                        onChange={(e) => setSelectedImage(e.target.files?.[0])}
                      />
                    </Stack>
                  </Grid>

                  {/* Property name */}
                  <Grid size={12}>
                    <FormInput
                      id="property-name"
                      label="Property Name"
                      placeholder="Ex. Maplewood Estate"
                      {...getFieldProps('name')}
                      error={Boolean(touched.name && errors.name)}
                      helperText={touched.name && errors.name}
                    />
                  </Grid>

                  {/* Street address */}
                  <Grid size={12}>
                    <Stack spacing={1}>
                      <Typography variant="subtitle2">Street Address</Typography>
                      <AddressFieldWithPlaces
                        formik={formik}
                        name="streetAddress"
                        onSelected={handleAddressSelected}
                      />
                    </Stack>
                  </Grid>

                  {/* Property type */}
                  <Grid size={12}>
                    <FormSelect
                      name="propertyType"
                      label="Property Type"
                      options={propertyTypes}
                      value={values.propertyType}
                      setFieldValue={setFieldValue}
                      touched={touched.propertyType}
                      errorText={errors.propertyType}
                      placeholder="Select Property Type"
                      valueType="string"
                    />
                  </Grid>

                  {/* Single-family unit details */}
                  {values.propertyType === 'singleFamily' && (
                    <>
                      <Grid size={4}>
                        <FormInput label="Bedrooms" placeholder="Ex. 3" {...getFieldProps('bedrooms')} />
                      </Grid>
                      <Grid size={4}>
                        <FormInput label="Baths" placeholder="Ex. 2" {...getFieldProps('baths')} />
                      </Grid>
                      <Grid size={4}>
                        <FormInput
                          label="Square Feet"
                          placeholder="Ex. 1500"
                          type="number"
                          {...getFieldProps('squareFeet')}
                        />
                      </Grid>
                    </>
                  )}
                </Grid>
              )}
            </Box>

            {/* Footer */}
            <Divider />
            <Box sx={{ px: 3, py: 2, flexShrink: 0 }}>
              <Stack direction="row" spacing={2} justifyContent="flex-end">
                <Button
                  variant="text"
                  onClick={drawer.closePropertyEditDrawer}
                  startIcon={<CloseOutlined style={{ fontSize: 16, color: 'inherit' }} />}
                  sx={{
                    color: 'text.secondary',
                    textTransform: 'none',
                    '&:hover': { bgcolor: alpha(theme.palette.common.black, 0.04) }
                  }}
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  variant="contained"
                  disabled={isSubmitting || updateLoading}
                  startIcon={isSubmitting ? null : <CheckOutlined style={{ fontSize: 16 }} />}
                  sx={{ textTransform: 'none', borderRadius: 2 }}
                >
                  {isSubmitting ? 'Saving...' : 'Save Changes'}
                </Button>
              </Stack>
            </Box>

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
    </ThemeAdaptiveDrawer>
  );
}

PropertyEditDrawer.propTypes = {
  property: PropTypes.object,
  onUpdateSuccess: PropTypes.func
};
