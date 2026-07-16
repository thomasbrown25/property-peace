import { useState, useEffect, useMemo } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useDispatch, useSelector } from 'react-redux';
import {
  Box,
  Button,
  Grid,
  Stack,
  Typography,
  useTheme,
  alpha,
  Tooltip,
  CircularProgress
} from '@mui/material';
import { useFormik, FormikProvider, Form } from 'formik';
import * as Yup from 'yup';
import { openSnackbar } from 'api/snackbar';
import { bulkCreateUnits, addOrUpdateUnit } from 'store/unit/unit.action';
import FormInput from 'components/input/FormInput';
import FormSelect from 'components/input/FormSelect';
import { PlusOutlined, DeleteOutlined, CopyOutlined, ArrowLeftOutlined, EditOutlined, ImportOutlined } from '@ant-design/icons';
import MainCard from 'components/MainCard';
import PageBreadcrumbs from 'components/breadcrumbs/PageBreadcrumbs';
import useFetchProperty from 'hooks/useFetchProperty';
import { selectProperty } from 'store/property/property.selector';
import AnimateIn from 'components/AnimateIn';

// Validation schema
const UnitSchema = Yup.object().shape({
  units: Yup.array().of(
    Yup.object().shape({
      name: Yup.string().required('Unit name is required'),
      bedrooms: Yup.string().required('Bedrooms is required'),
      baths: Yup.string().required('Baths is required'),
      hasRoomRentals: Yup.boolean()
    })
  )
});

export default function PropertyAddUnits() {
  const { propertyId } = useParams();
  const navigate = useNavigate();
  const dispatch = useDispatch();
  const theme = useTheme();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [editingUnitId, setEditingUnitId] = useState(null);
  const [editUnitForm, setEditUnitForm] = useState(null);

  // Fetch property data
  const { property: fetchedProperty, loading: propertyLoading, refetch: refetchProperty } = useFetchProperty(propertyId);
  const selectedProperty = useSelector(selectProperty);
  const property = fetchedProperty || selectedProperty;

  // Generate beds and baths options (same as property add workflow)
  const bedsOptions = useMemo(() => 
    Array.from({ length: 6 }, (_, i) => ({ id: i, value: i.toString(), label: i.toString() })), 
    []
  );
  const bathsOptions = useMemo(() => 
    ['0.5', '1', '1.5', '2', '2.5', '3', '3.5', '4', '4.5', '5'].map(val => ({ id: val, value: val, label: val })), 
    []
  );

  // Get existing units from property, sorted by name (1, 2, 10... then A-Z)
  const existingUnits = useMemo(() => {
    const units = property?.units || [];
    return [...units].sort((a, b) => {
      const nameA = (a.name || '').trim();
      const nameB = (b.name || '').trim();
      return nameA.localeCompare(nameB, undefined, { numeric: true });
    });
  }, [property?.units]);

  // Get next unit number based on existing units
  const getNextUnitNumber = () => {
    if (existingUnits.length === 0) return 1;
    
    // Detect the highest unit number from existing units
    // Pattern: "Unit {number}" or just "{number}" (case-insensitive)
    const unitNumberPattern = /^unit\s*(\d+)$/i;
    const numberPattern = /^(\d+)$/;
    
    const unitNumbers = existingUnits
      .map(u => {
        if (!u.name) return null;
        const trimmed = u.name.trim();
        const match = trimmed.match(unitNumberPattern) || trimmed.match(numberPattern);
        return match ? parseInt(match[1], 10) : null;
      })
      .filter(num => num !== null);
    
    if (unitNumbers.length > 0) {
      return Math.max(...unitNumbers) + 1;
    }
    return existingUnits.length + 1;
  };

  // Format full address
  const fullAddress = useMemo(() => {
    if (!property) return '';
    const { streetAddress, city, state, zipCode } = property;
    if (!streetAddress) return 'No address set';
    
    // Clean street address (remove zip if included)
    let streetOnly = streetAddress;
    if (streetAddress.includes(',')) {
      const parts = streetAddress.split(',');
      streetOnly = parts[0].trim();
    } else {
      const zipCodePattern = /\s+\d{5}(-\d{4})?$/;
      if (zipCodePattern.test(streetAddress)) {
        streetOnly = streetAddress.replace(zipCodePattern, '').trim();
      }
    }
    
    const parts = [streetOnly];
    if (city) parts.push(city);
    if (state) {
      if (zipCode) {
        parts.push(`${state} ${zipCode}`);
      } else {
        parts.push(state);
      }
    } else if (zipCode) {
      parts.push(zipCode);
    }
    return parts.join(', ');
  }, [property]);

  const formik = useFormik({
    initialValues: {
      units: [{ name: '', bedrooms: '', baths: '', hasRoomRentals: false }]
    },
    validationSchema: UnitSchema,
    enableReinitialize: true,
    validate: (values) => {
      if (!values.units || values.units.length === 0) {
        return { units: 'At least one unit is required' };
      }
      const unitErrors = values.units.map((unit, index) => {
        const errors = {};
        if (!unit.name || !unit.name.trim()) {
          errors.name = 'Unit name is required';
        }
        if (!unit.bedrooms) {
          errors.bedrooms = 'Bedrooms is required';
        }
        if (!unit.baths) {
          errors.baths = 'Baths is required';
        }
        return Object.keys(errors).length > 0 ? errors : null;
      }).filter(Boolean);
      if (unitErrors.length > 0) {
        return { units: unitErrors };
      }
      return {};
    },
    onSubmit: async (values, { setSubmitting, resetForm }) => {
      if (!propertyId) {
        openSnackbar({
          open: true,
          message: 'Property ID is required',
          variant: 'alert',
          alert: { color: 'error' }
        });
        setSubmitting(false);
        return;
      }

      setIsSubmitting(true);
      setSubmitting(true);
      
      try {
        // Filter out empty units and format for API
        const unitsPayload = values.units
          .filter(unit => unit.name && unit.name.trim())
          .map(unit => ({
            id: 0, // New unit, no ID
            name: unit.name.trim(),
            bedrooms: unit.bedrooms || '',
            baths: unit.baths || '',
            squareFeet: 0,
            isOccupied: false,
            PropertyId: parseInt(propertyId),
            type: '',
            rentAmount: 0,
            amenities: [],
            includedUtility: [],
            hasRoomRentals: unit.hasRoomRentals || false
          }));

        if (unitsPayload.length === 0) {
          openSnackbar({
            open: true,
            message: 'At least one unit with a name is required',
            variant: 'alert',
            alert: { color: 'error' }
          });
          setIsSubmitting(false);
          setSubmitting(false);
          return;
        }

        // Call bulk create endpoint
        const result = await dispatch(bulkCreateUnits(parseInt(propertyId), unitsPayload));

        if (result?.success) {
          openSnackbar({
            open: true,
            message: `Successfully created ${result.data.length} unit(s)`,
            variant: 'alert',
            alert: { color: 'success' }
          });

          resetForm();
          // Navigate back to property page
          navigate(`/landlord/property/${propertyId}`);
        } else {
          openSnackbar({
            open: true,
            message: 'Failed to create units',
            variant: 'alert',
            alert: { color: 'error' }
          });
        }
      } catch (error) {
        console.error('Error creating units:', error);
        openSnackbar({
          open: true,
          message: error?.response?.data?.message || 'Failed to create units',
          variant: 'alert',
          alert: { color: 'error' }
        });
      } finally {
        setIsSubmitting(false);
        setSubmitting(false);
      }
    }
  });

  useEffect(() => {
    if (property && existingUnits && formik.values.units.length === 0) {
      // Initialize with one new unit, pre-populated with next unit number
      const nextUnitNumber = getNextUnitNumber();
      formik.setFieldValue('units', [{ name: nextUnitNumber.toString(), bedrooms: '', baths: '', hasRoomRentals: false }]);
    }
  }, [property?.id]);

  if (propertyLoading || !property) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '400px' }}>
        <CircularProgress />
      </Box>
    );
  }

  return (
    <FormikProvider value={formik}>
      <Form onSubmit={formik.handleSubmit}>
        <PageBreadcrumbs
          items={[
            { label: 'Dashboard', path: '/landlord/dashboard' },
            { label: 'Properties', path: '/landlord/properties' },
            { label: property.name || property.streetAddress || 'Property', path: `/landlord/property/${propertyId}` },
            { label: 'Add Units' }
          ]}
        />

        {/* Header with Property Name and Address */}
        <AnimateIn direction="bottom" delay={100} distance={120}>
          <MainCard sx={{ my: 3 }}>
            <Box sx={{ mb: 2 }}>
              <Typography variant="h4" fontWeight={600} sx={{ mb: 1 }}>
                Add Units
              </Typography>
              <Typography variant="h6" color="text.secondary" sx={{ mb: 0.5 }}>
                {property.name || property.streetAddress || 'Untitled Property'}
              </Typography>
              {property.name && (
                <Typography variant="body2" color="text.secondary">
                  {fullAddress}
                </Typography>
              )}
            </Box>
          </MainCard>
        </AnimateIn>

         {/* New Units to Add Section */}
         <AnimateIn direction="bottom" delay={200 + (existingUnits.length * 50)} distance={120}>
            <MainCard>
              <Box>
                <Typography variant="h6" fontWeight={600} sx={{ mb: 3 }}>
                  Add New Units
                </Typography>
                <Stack spacing={3}>
                  {(formik.values.units || []).map((unit, index) => {
                    // Calculate the unit number for this new unit
                    const unitNumber = existingUnits.length + index + 1;
                    
                    return (
                      <MainCard key={index}>
                        <Stack spacing={2}>
                        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 1 }}>
                          <Typography variant="h6" fontWeight={600}>
                            Unit {unitNumber}
                          </Typography>
                          <Box sx={{ display: 'flex', gap: 1 }}>
                            <Button
                              size="small"
                              startIcon={<CopyOutlined />}
                              onClick={() => {
                                const newUnits = [...(formik.values.units || [])];
                                // Calculate next unit number for duplicated unit
                                const baseNextNumber = getNextUnitNumber();
                                const nextUnitNumber = baseNextNumber + newUnits.length;
                                newUnits.push({
                                  name: nextUnitNumber.toString(),
                                  bedrooms: unit.bedrooms || '',
                                  baths: unit.baths || '',
                                  hasRoomRentals: unit.hasRoomRentals || false
                                });
                                formik.setFieldValue('units', newUnits);
                              }}
                              sx={{ textTransform: 'none', color: 'primary.main' }}
                            >
                              Duplicate Unit
                            </Button>
                            {(formik.values.units || []).length >= 2 && (
                              <Button
                                size="small"
                                startIcon={<DeleteOutlined />}
                                onClick={() => {
                                  const newUnits = [...(formik.values.units || [])];
                                  newUnits.splice(index, 1);
                                  formik.setFieldValue('units', newUnits);
                                }}
                                sx={{ textTransform: 'none', color: 'error.main' }}
                              >
                                Remove
                              </Button>
                            )}
                          </Box>
                        </Box>

                        <Grid container spacing={2}>
                          <Grid size={{ xs: 12, sm: 4 }}>
                            <FormInput
                              label="Unit #"
                              placeholder="Ex. Unit 1, Apartment A"
                              value={unit.name || ''}
                              onChange={(e) => {
                                const newUnits = [...(formik.values.units || [])];
                                newUnits[index] = { ...newUnits[index], name: e.target.value };
                                formik.setFieldValue('units', newUnits);
                              }}
                              error={formik.touched.units?.[index]?.name && Boolean(formik.errors.units?.[index]?.name)}
                              helperText={formik.touched.units?.[index]?.name && formik.errors.units?.[index]?.name}
                              fullWidth
                            />
                          </Grid>
                          <Grid size={{ xs: 12, sm: 4 }}>
                            <FormSelect
                              name={`units[${index}].bedrooms`}
                              label="Beds *"
                              options={bedsOptions}
                              value={unit.bedrooms || ''}
                              setFieldValue={(name, value) => {
                                const newUnits = [...(formik.values.units || [])];
                                newUnits[index] = { ...newUnits[index], bedrooms: value };
                                formik.setFieldValue('units', newUnits);
                              }}
                              placeholder="Select"
                              valueType="string"
                              fullWidth
                            />
                          </Grid>
                          <Grid size={{ xs: 12, sm: 4 }}>
                            <FormSelect
                              name={`units[${index}].baths`}
                              label="Baths *"
                              options={bathsOptions}
                              value={unit.baths || ''}
                              setFieldValue={(name, value) => {
                                const newUnits = [...(formik.values.units || [])];
                                newUnits[index] = { ...newUnits[index], baths: value };
                                formik.setFieldValue('units', newUnits);
                              }}
                              placeholder="Select"
                              valueType="string"
                              fullWidth
                            />
                          </Grid>
                        </Grid>

                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                          <input
                            type="checkbox"
                            checked={unit.hasRoomRentals || false}
                            onChange={(e) => {
                              const newUnits = [...(formik.values.units || [])];
                              newUnits[index] = { ...newUnits[index], hasRoomRentals: e.target.checked };
                              formik.setFieldValue('units', newUnits);
                            }}
                            style={{ width: 18, height: 18, cursor: 'pointer' }}
                          />
                          <Typography variant="body2">
                            This unit will have room rentals.{' '}
                            <Tooltip
                              title="Room rentals are when you're renting out rooms separately within the property, each with their own lease."
                              arrow
                              placement="top"
                              componentsProps={{
                                tooltip: {
                                  sx: {
                                    bgcolor: 'primary.main',
                                    color: 'white',
                                    fontSize: '0.875rem',
                                    maxWidth: 300,
                                    '& .MuiTooltip-arrow': {
                                      color: 'primary.main'
                                    }
                                  }
                                }
                              }}
                            >
                              <Typography
                                component="span"
                                sx={{
                                  color: 'primary.main',
                                  textDecoration: 'underline',
                                  cursor: 'pointer'
                                }}
                              >
                                Learn more
                              </Typography>
                            </Tooltip>
                          </Typography>
                        </Box>
                      </Stack>
                      </MainCard>
                    );
                  })} 
                </Stack>
              </Box>
              <Box mt={2} sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <Button
                  onClick={() => navigate(`/landlord/property/${propertyId}`)}
                  disabled={isSubmitting}
                  startIcon={<ArrowLeftOutlined />}
                  size="small"
                  sx={{ textTransform: 'none', px: 3 }}
                >
                  Cancel
                </Button>
                <Box sx={{ display: 'flex', gap: 2, flexWrap: 'wrap' }}>
                <Button
                    variant="outlined"
                    startIcon={<PlusOutlined />}
                    onClick={() => {
                      const currentUnits = formik.values.units || [];
                      // Calculate next unit number based on existing units and new units being added
                      const baseNextNumber = getNextUnitNumber();
                      const nextUnitNumber = baseNextNumber + currentUnits.length;
                      const newUnits = [...currentUnits, { name: nextUnitNumber.toString(), bedrooms: '', baths: '', hasRoomRentals: false }];
                      formik.setFieldValue('units', newUnits);
                    }}
                    sx={{ textTransform: 'none', px: 3, alignSelf: 'flex-start' }}
                  >
                    Add Another Unit
                  </Button>
                <Button
                    variant="outlined"
                    color="primary"
                    startIcon={<ImportOutlined />}
                    onClick={() => navigate(`/landlord/property/${propertyId}/add-units/import`)}
                    sx={{ textTransform: 'none', px: 3, alignSelf: 'flex-start' }}
                  >
                    Import
                  </Button>
                <Button
                  type="submit"
                  variant="contained"
                  size="small"
                  disabled={isSubmitting}
                  sx={{ textTransform: 'none', px: 6}}
                  >
                  Save
                </Button>
                  </Box>
              </Box>
            </MainCard>
          </AnimateIn> 

        <Stack spacing={3} sx={{ mt: 3 }}>
          {/* Existing Units Display */}
          {existingUnits.length > 0 && (
            <Box>
              <Typography variant="h6" fontWeight={600} sx={{ mb: 2 }}>
                Existing Units ({existingUnits.length})
              </Typography>
              <Stack spacing={2}>
                {existingUnits.map((unit, index) => {
                  const isEditing = editingUnitId === unit.id;
                  const formData = isEditing ? (editUnitForm || { name: unit.name, bedrooms: unit.bedrooms, baths: unit.baths, hasRoomRentals: unit.hasRoomRentals || false }) : null;

                  return (
                    <AnimateIn key={unit.id || index} direction="bottom" delay={150 + (index * 50)} distance={80}>
                      <MainCard>
                        {isEditing ? (
                          <Stack spacing={2}>
                            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                              <Typography variant="h6" fontWeight={600}>Edit Unit</Typography>
                              <Box sx={{ display: 'flex', gap: 1 }}>
                                <Button
                                  size="small"
                                  variant="outlined"
                                  onClick={() => {
                                    setEditingUnitId(null);
                                    setEditUnitForm(null);
                                  }}
                                  sx={{ textTransform: 'none' }}
                                >
                                  Cancel
                                </Button>
                                <Button
                                  size="small"
                                  variant="contained"
                                  disabled={!formData?.name?.trim() || !formData?.bedrooms || !formData?.baths}
                                  onClick={async () => {
                                    if (!formData?.name?.trim() || !formData?.bedrooms || !formData?.baths) return;
                                    setIsSubmitting(true);
                                    try {
                                      const result = await dispatch(addOrUpdateUnit({
                                        id: unit.id,
                                        name: formData.name.trim(),
                                        bedrooms: formData.bedrooms,
                                        baths: formData.baths,
                                        squareFeet: unit.squareFeet || 0,
                                        PropertyId: parseInt(propertyId),
                                        type: unit.type || '',
                                        rentAmount: unit.rentAmount || 0,
                                        amenities: unit.amenities || [],
                                        includedUtility: unit.includedUtility || []
                                      }));
                                      if (result) {
                                        openSnackbar({
                                          open: true,
                                          message: 'Unit updated successfully',
                                          variant: 'alert',
                                          alert: { color: 'success' }
                                        });
                                        setEditingUnitId(null);
                                        setEditUnitForm(null);
                                        refetchProperty();
                                      }
                                    } catch (err) {
                                      openSnackbar({
                                        open: true,
                                        message: err?.response?.data?.message || 'Failed to update unit',
                                        variant: 'alert',
                                        alert: { color: 'error' }
                                      });
                                    } finally {
                                      setIsSubmitting(false);
                                    }
                                  }}
                                  sx={{ textTransform: 'none' }}
                                >
                                  Save
                                </Button>
                              </Box>
                            </Box>
                            <Grid container spacing={2}>
                              <Grid size={{ xs: 12, sm: 4 }}>
                                <FormInput
                                  label="Unit #"
                                  placeholder="Ex. Unit 1, Apartment A"
                                  value={formData?.name || ''}
                                  onChange={(e) => setEditUnitForm((p) => ({ ...p, name: e.target.value }))}
                                  fullWidth
                                />
                              </Grid>
                              <Grid size={{ xs: 12, sm: 4 }}>
                                <FormSelect
                                  name="editBedrooms"
                                  label="Beds *"
                                  options={bedsOptions}
                                  value={formData?.bedrooms || ''}
                                  setFieldValue={(_, value) => setEditUnitForm((p) => ({ ...p, bedrooms: value }))}
                                  placeholder="Select"
                                  valueType="string"
                                  fullWidth
                                />
                              </Grid>
                              <Grid size={{ xs: 12, sm: 4 }}>
                                <FormSelect
                                  name="editBaths"
                                  label="Baths *"
                                  options={bathsOptions}
                                  value={formData?.baths || ''}
                                  setFieldValue={(_, value) => setEditUnitForm((p) => ({ ...p, baths: value }))}
                                  placeholder="Select"
                                  valueType="string"
                                  fullWidth
                                />
                              </Grid>
                            </Grid>
                          </Stack>
                        ) : (
                          <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 2 }}>
                            <Grid container spacing={2} sx={{ flex: 1 }}>
                              <Grid size={{ xs: 12, sm: 4 }}>
                                <Typography variant="subtitle2" color="text.secondary">Unit #</Typography>
                                <Typography variant="body1" fontWeight={500}>{unit.name || `Unit ${index + 1}`}</Typography>
                              </Grid>
                              <Grid size={{ xs: 12, sm: 4 }}>
                                <Typography variant="subtitle2" color="text.secondary">Beds</Typography>
                                <Typography variant="body1">{unit.bedrooms || '-'}</Typography>
                              </Grid>
                              <Grid size={{ xs: 12, sm: 4 }}>
                                <Typography variant="subtitle2" color="text.secondary">Baths</Typography>
                                <Typography variant="body1">{unit.baths || '-'}</Typography>
                              </Grid>
                            </Grid>
                            <Button
                              size="small"
                              startIcon={<EditOutlined />}
                              onClick={() => {
                                setEditingUnitId(unit.id);
                                setEditUnitForm({
                                  name: unit.name || '',
                                  bedrooms: String(unit.bedrooms ?? ''),
                                  baths: String(unit.baths ?? ''),
                                  hasRoomRentals: unit.hasRoomRentals || false
                                });
                              }}
                              sx={{ textTransform: 'none', flexShrink: 0 }}
                            >
                              Edit
                            </Button>
                          </Box>
                        )}
                      </MainCard>
                    </AnimateIn>
                  );
                })}
              </Stack>
            </Box>
          )}

         
        </Stack>
      </Form>
    </FormikProvider>
  );
}
