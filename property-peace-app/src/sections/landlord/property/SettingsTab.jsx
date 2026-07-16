import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Box,
  Stack,
  Typography,
  TextField,
  Button,
  Divider,
  InputAdornment,
  InputLabel,
  Tooltip,
  IconButton,
  alpha,
  useTheme
} from '@mui/material';
import Grid from '@mui/material/Grid';
import { InfoCircleOutlined, DeleteOutlined, CameraOutlined } from '@ant-design/icons';
import { useFormik } from 'formik';
import * as Yup from 'yup';
import { useDispatch } from 'react-redux';
import { addOrUpdateProperty } from 'store/property/property.action';
import { addOrUpdateUnit } from 'store/unit/unit.action';
import { openSnackbar } from 'api/snackbar';
import MainCard from 'components/MainCard';
import DeletePropertyModal from 'components/dialogs/DeletePropertyModal';
import FormSelect from 'components/input/FormSelect';

export default function SettingsTab({ property, propertyId, onRefresh }) {
  const theme = useTheme();
  const dispatch = useDispatch();
  const navigate = useNavigate();
  const [openDeleteModal, setOpenDeleteModal] = useState(false);
  const [saving, setSaving] = useState(false);
  const [selectedImage, setSelectedImage] = useState(null);
  const [imagePreview, setImagePreview] = useState(null);

  const isSingleFamily = property?.propertyType?.toLowerCase() === 'singlefamily' ||
                         property?.propertyType?.toLowerCase() === 'single-family';

  const unit = property?.units?.[0];

  useEffect(() => {
    if (property) {
      if (property.images && property.images.length > 0 && property.images[0]?.blobUrl) {
        setImagePreview(property.images[0].blobUrl);
      } else if (property.mainImageUrl) {
        setImagePreview(property.mainImageUrl);
      } else {
        setImagePreview(null);
      }
    }
  }, [property]);

  const validationSchema = Yup.object().shape({
    name: Yup.string().max(255).nullable(),
    streetAddress: Yup.string().max(255).required('Street address is required'),
    city: Yup.string().max(255).required('City is required'),
    state: Yup.string().max(2).required('State is required'),
    zipCode: Yup.string().max(10).required('Zip code is required'),
    yearBuilt: Yup.number().min(1800, 'Must be 1800 or later').max(new Date().getFullYear(), 'Cannot be in the future').nullable()
  });

  const formik = useFormik({
    enableReinitialize: true,
    initialValues: {
      name: property?.name || null,
      streetAddress: property?.streetAddress || '',
      city: property?.city || '',
      state: property?.state || '',
      zipCode: property?.zipCode || '',
      targetRent: property?.targetRent || 0,
      targetDeposit: property?.targetDeposit || 0,
      bedrooms: isSingleFamily ? (unit?.bedrooms || '') : '',
      baths: isSingleFamily ? (unit?.baths || '') : '',
      squareFeet: isSingleFamily ? (unit?.squareFeet || 0) : '',
      yearBuilt: property?.yearBuilt || property?.YearBuilt || ''
    },
    validationSchema,
    onSubmit: async (values) => {
      setSaving(true);
      try {
        const payload = {
          id: propertyId,
          landlordId: property?.landlordId ?? property?.LandlordId,
          name: values.name != null && String(values.name).trim() !== '' ? String(values.name).trim() : null,
          streetAddress: values.streetAddress,
          city: values.city,
          state: values.state,
          zipCode: values.zipCode,
          propertyType: property?.propertyType,
          targetRent: values.targetRent ? Number(values.targetRent) : 0,
          targetDeposit: values.targetDeposit ? Number(values.targetDeposit) : 0,
          yearBuilt: values.yearBuilt ? Number(values.yearBuilt) : 0
        };

        const imageFiles = selectedImage ? [selectedImage] : [];
        await dispatch(addOrUpdateProperty(payload, imageFiles));

        if (isSingleFamily && unit?.id) {
          const unitPayload = {
            id: unit.id,
            name: unit.name || 'Unit 1',
            bedrooms: values.bedrooms || '',
            baths: values.baths || '',
            squareFeet: values.squareFeet ? Number(values.squareFeet) : 0,
            isOccupied: unit.isOccupied || false,
            PropertyId: propertyId,
            type: unit.type || '',
            rentAmount: values.targetRent ? Number(values.targetRent) : 0,
            amenities: unit.amenities || [],
            includedUtility: unit.includedUtility || []
          };
          await dispatch(addOrUpdateUnit(unitPayload));
        }

        openSnackbar({
          open: true,
          message: 'Property settings saved successfully',
          variant: 'alert',
          alert: { color: 'success' }
        });

        if (onRefresh) onRefresh();
        if (propertyId) navigate(`/landlord/property/${propertyId}`);
      } catch (error) {
        openSnackbar({
          open: true,
          message: error?.response?.data?.message || 'Failed to save property settings',
          variant: 'alert',
          alert: { color: 'error' }
        });
      } finally {
        setSaving(false);
      }
    }
  });

  const handleImageChange = (event) => {
    const file = event.target.files?.[0];
    if (file) {
      setSelectedImage(file);
      const reader = new FileReader();
      reader.onloadend = () => setImagePreview(reader.result);
      reader.readAsDataURL(file);
    }
  };

  return (
    <>
      <Box sx={{ p: 3, maxWidth: 800, mx: 'auto' }}>
        <Stack spacing={3}>

          {/* Photo Card — compact horizontal */}
          <MainCard
            sx={{
              bgcolor: (t) => alpha(t.palette.background.paper, 0.6),
              boxShadow: (t) => `0 0 20px ${alpha(t.palette.primary.main, 0.1)}`
            }}
          >
            <Stack direction="row" spacing={2.5} alignItems="center">
              <Box
                component="label"
                htmlFor="property-photo-upload"
                sx={{
                  width: 120,
                  height: 88,
                  borderRadius: 1.5,
                  overflow: 'hidden',
                  cursor: 'pointer',
                  flexShrink: 0,
                  position: 'relative',
                  border: `2px dashed ${alpha(theme.palette.divider, 0.5)}`,
                  bgcolor: alpha(theme.palette.primary.main, 0.03),
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  transition: 'border-color 0.2s',
                  '&:hover': { borderColor: theme.palette.primary.main },
                  '&:hover .photo-overlay': { opacity: 1 }
                }}
              >
                <input
                  id="property-photo-upload"
                  type="file"
                  accept="image/*"
                  onChange={handleImageChange}
                  style={{ display: 'none' }}
                />
                {imagePreview ? (
                  <>
                    <Box
                      component="img"
                      src={imagePreview}
                      alt="Property"
                      sx={{ width: '100%', height: '100%', objectFit: 'cover' }}
                    />
                    <Box
                      className="photo-overlay"
                      sx={{
                        position: 'absolute',
                        inset: 0,
                        bgcolor: 'rgba(0,0,0,0.45)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        opacity: 0,
                        transition: 'opacity 0.2s'
                      }}
                    >
                      <CameraOutlined style={{ color: 'white', fontSize: 22 }} />
                    </Box>
                  </>
                ) : (
                  <Stack alignItems="center" spacing={0.5}>
                    <CameraOutlined style={{ fontSize: 24, color: theme.palette.text.secondary }} />
                    <Typography variant="caption" color="text.secondary" sx={{ fontSize: '0.65rem' }}>
                      Upload
                    </Typography>
                  </Stack>
                )}
              </Box>

              <Stack spacing={0.5}>
                <Typography variant="subtitle2" fontWeight={600}>
                  Property Photo
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  {imagePreview ? 'Hover the image and click to replace it' : 'Click to upload a photo for this property'}
                </Typography>
                <Typography variant="caption" color="text.disabled">
                  JPG, PNG or WEBP — recommended 1200 × 800 px or larger
                </Typography>
              </Stack>
            </Stack>
          </MainCard>

          {/* Settings Form */}
          <MainCard
            sx={{
              bgcolor: (t) => alpha(t.palette.background.paper, 0.6),
              boxShadow: (t) => `0 0 20px ${alpha(t.palette.primary.main, 0.1)}`
            }}
          >
            <form onSubmit={formik.handleSubmit}>
              <Stack spacing={3}>

                {/* Section: Basic Information */}
                <Stack spacing={2}>
                  <Typography variant="overline" color="text.secondary" fontWeight={700} sx={{ letterSpacing: '0.08em' }}>
                    Basic Information
                  </Typography>

                  <TextField
                    fullWidth
                    label="Property Name (Optional)"
                    name="name"
                    value={formik.values.name || ''}
                    onChange={formik.handleChange}
                    onBlur={formik.handleBlur}
                    error={formik.touched.name && Boolean(formik.errors.name)}
                    helperText={
                      (formik.touched.name && formik.errors.name) ||
                      'Leave blank to use street address as the property name'
                    }
                  />

                  <TextField
                    fullWidth
                    label="Street Address *"
                    name="streetAddress"
                    value={formik.values.streetAddress}
                    onChange={formik.handleChange}
                    onBlur={formik.handleBlur}
                    error={formik.touched.streetAddress && Boolean(formik.errors.streetAddress)}
                    helperText={formik.touched.streetAddress && formik.errors.streetAddress}
                    required
                  />

                  <Grid container spacing={2}>
                    <Grid size={{ xs: 12, sm: 4 }}>
                      <TextField
                        fullWidth
                        label="City *"
                        name="city"
                        value={formik.values.city}
                        onChange={formik.handleChange}
                        onBlur={formik.handleBlur}
                        error={formik.touched.city && Boolean(formik.errors.city)}
                        helperText={formik.touched.city && formik.errors.city}
                        required
                      />
                    </Grid>
                    <Grid size={{ xs: 12, sm: 4 }}>
                      <TextField
                        fullWidth
                        label="State *"
                        name="state"
                        value={formik.values.state}
                        onChange={formik.handleChange}
                        onBlur={formik.handleBlur}
                        error={formik.touched.state && Boolean(formik.errors.state)}
                        helperText={formik.touched.state && formik.errors.state}
                        required
                      />
                    </Grid>
                    <Grid size={{ xs: 12, sm: 4 }}>
                      <TextField
                        fullWidth
                        label="Zip Code *"
                        name="zipCode"
                        value={formik.values.zipCode}
                        onChange={formik.handleChange}
                        onBlur={formik.handleBlur}
                        error={formik.touched.zipCode && Boolean(formik.errors.zipCode)}
                        helperText={formik.touched.zipCode && formik.errors.zipCode}
                        required
                      />
                    </Grid>
                  </Grid>
                </Stack>

                {/* Section: Property Details (single-family only) */}
                {isSingleFamily && (
                  <>
                    <Divider />
                    <Stack spacing={2}>
                      <Typography variant="overline" color="text.secondary" fontWeight={700} sx={{ letterSpacing: '0.08em' }}>
                        Property Details
                      </Typography>

                      <Grid container spacing={2}>
                        <Grid size={{ xs: 12, sm: 4 }}>
                          <FormSelect
                            name="bedrooms"
                            label="Bedrooms"
                            options={Array.from({ length: 6 }, (_, i) => ({ id: i, value: i.toString(), label: i.toString() }))}
                            value={formik.values.bedrooms || ''}
                            setFieldValue={(name, value) => formik.setFieldValue(name, value)}
                            placeholder="Select"
                            valueType="string"
                            fullWidth
                          />
                        </Grid>
                        <Grid size={{ xs: 12, sm: 4 }}>
                          <FormSelect
                            name="baths"
                            label="Baths"
                            options={['0.5', '1', '1.5', '2', '2.5', '3', '3.5', '4', '4.5', '5'].map(val => ({ id: val, value: val, label: val }))}
                            value={formik.values.baths || ''}
                            setFieldValue={(name, value) => formik.setFieldValue(name, value)}
                            placeholder="Select"
                            valueType="string"
                            fullWidth
                          />
                        </Grid>
                        <Grid size={{ xs: 12, sm: 4 }}>
                          <Stack sx={{ gap: 1 }}>
                            <InputLabel>Square Feet</InputLabel>
                            <TextField
                              fullWidth
                              name="squareFeet"
                              type="number"
                              size="small"
                              value={formik.values.squareFeet || ''}
                              onChange={formik.handleChange}
                              onBlur={formik.handleBlur}
                              slotProps={{
                                input: { endAdornment: <InputAdornment position="end">sq ft</InputAdornment> },
                                htmlInput: { min: 0 }
                              }}
                            />
                          </Stack>
                        </Grid>
                        <Grid size={{ xs: 12, sm: 4 }}>
                          <Stack sx={{ gap: 1 }}>
                            <InputLabel>Year Built</InputLabel>
                            <TextField
                              fullWidth
                              name="yearBuilt"
                              type="number"
                              size="small"
                              placeholder="e.g. 2005"
                              value={formik.values.yearBuilt || ''}
                              onChange={formik.handleChange}
                              onBlur={formik.handleBlur}
                              error={formik.touched.yearBuilt && Boolean(formik.errors.yearBuilt)}
                              helperText={formik.touched.yearBuilt && formik.errors.yearBuilt}
                              slotProps={{ htmlInput: { min: 1800, max: new Date().getFullYear() } }}
                            />
                          </Stack>
                        </Grid>
                      </Grid>

                      <Grid container spacing={2}>
                        <Grid size={{ xs: 12, sm: 6 }}>
                          <TextField
                            fullWidth
                            label="Target Rent (Optional)"
                            name="targetRent"
                            type="number"
                            value={formik.values.targetRent}
                            onChange={formik.handleChange}
                            onBlur={formik.handleBlur}
                            slotProps={{
                              input: { startAdornment: <InputAdornment position="start">$</InputAdornment> },
                              inputLabel: {
                                endAdornment: (
                                  <Tooltip title="The expected monthly rent amount for this property">
                                    <IconButton size="small" sx={{ ml: 0.5 }}>
                                      <InfoCircleOutlined style={{ fontSize: 16 }} />
                                    </IconButton>
                                  </Tooltip>
                                )
                              }
                            }}
                          />
                        </Grid>
                        <Grid size={{ xs: 12, sm: 6 }}>
                          <TextField
                            fullWidth
                            label="Target Deposit (Optional)"
                            name="targetDeposit"
                            type="number"
                            value={formik.values.targetDeposit}
                            onChange={formik.handleChange}
                            onBlur={formik.handleBlur}
                            slotProps={{
                              input: { startAdornment: <InputAdornment position="start">$</InputAdornment> },
                              inputLabel: {
                                endAdornment: (
                                  <Tooltip title="The expected security deposit amount for this property">
                                    <IconButton size="small" sx={{ ml: 0.5 }}>
                                      <InfoCircleOutlined style={{ fontSize: 16 }} />
                                    </IconButton>
                                  </Tooltip>
                                )
                              }
                            }}
                          />
                        </Grid>
                      </Grid>
                    </Stack>
                  </>
                )}

                {/* Save */}
                <Box sx={{ display: 'flex', justifyContent: 'flex-end' }}>
                  <Button
                    type="submit"
                    variant="contained"
                    disabled={saving}
                    sx={{ minWidth: 160, textTransform: 'none', fontWeight: 600, fontSize: '0.9rem' }}
                  >
                    {saving ? 'Saving…' : 'Save Changes'}
                  </Button>
                </Box>
              </Stack>
            </form>
          </MainCard>

          {/* Danger Zone */}
          <Box
            sx={{
              border: `1px solid ${alpha(theme.palette.error.main, 0.3)}`,
              borderRadius: 2,
              p: 2.5,
              bgcolor: alpha(theme.palette.error.main, 0.02)
            }}
          >
            <Stack direction={{ xs: 'column', sm: 'row' }} alignItems={{ sm: 'center' }} justifyContent="space-between" spacing={2}>
              <Stack spacing={0.5}>
                <Typography variant="subtitle2" fontWeight={700} color="error.main">
                  Delete Property
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  This action is permanent. You may lose access to data associated with this rental.
                </Typography>
              </Stack>
              <Button
                variant="outlined"
                color="error"
                startIcon={<DeleteOutlined />}
                onClick={() => setOpenDeleteModal(true)}
                sx={{
                  flexShrink: 0,
                  textTransform: 'none',
                  fontWeight: 600,
                  borderColor: alpha(theme.palette.error.main, 0.5),
                  '&:hover': {
                    borderColor: 'error.main',
                    bgcolor: alpha(theme.palette.error.main, 0.06)
                  }
                }}
              >
                Delete Property
              </Button>
            </Stack>
          </Box>

        </Stack>
      </Box>

      <DeletePropertyModal
        open={openDeleteModal}
        onClose={() => setOpenDeleteModal(false)}
        propertyId={propertyId}
        propertyName={property?.name?.trim() || property?.streetAddress?.trim() || 'Property'}
      />
    </>
  );
}
