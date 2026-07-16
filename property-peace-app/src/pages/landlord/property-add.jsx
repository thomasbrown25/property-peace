import { useEffect, useState, useRef } from 'react';
import { useNavigate } from 'react-router-dom';

// material-ui
import { alpha } from '@mui/system';
import {
  Box,
  Button,
  Card,
  CardActionArea,
  CardContent,
  Divider,
  FormLabel,
  InputLabel,
  Stack,
  Grid,
  TextField,
  Typography,
  Tooltip,
  useTheme,
  Alert,
  Radio,
  RadioGroup,
  FormControlLabel,
  FormControl
} from '@mui/material'; 

import { LocalizationProvider } from '@mui/x-date-pickers';
import { AdapterDateFns } from '@mui/x-date-pickers/AdapterDateFns';

// hooks
import useAuth from 'hooks/useAuth';
import { useSubscriptionStatus } from 'hooks/useSubscription';
import { useOrganization } from 'contexts/OrganizationContext';
import { organizationMemberAPI } from 'api';

// third-party
import { merge } from 'lodash-es';
import * as Yup from 'yup';
import { useFormik, Form, FormikProvider } from 'formik';
import { useDispatch } from 'react-redux';

// project imports
import MainCard from 'components/MainCard';
import Avatar from 'components/@extended/Avatar';
import CircularWithPath from 'components/@extended/progress/CircularWithPath';

import { openSnackbar } from 'api/snackbar';

// assets
import CameraOutlined from '@ant-design/icons/CameraOutlined';
import CloseOutlined from '@ant-design/icons/CloseOutlined';
import PlusOutlined from '@ant-design/icons/PlusOutlined';
import CheckCircleOutlined from '@ant-design/icons/CheckCircleOutlined';
import DeleteFilled from '@ant-design/icons/DeleteFilled';
import FormInput from 'components/input/FormInput';
import FormSelect from 'components/input/FormSelect';
import AddressFieldWithPlaces from 'components/input/AddressFieldWithPlaces';
import useCreateProperty from 'hooks/useCreateProperty';
import GooglePhotoConfirmationDialog from 'components/dialogs/GooglePhotoConfirmationDialog';
import StripeConnectOnboardingDialog from 'components/dialogs/StripeConnectOnboardingDialog';
import { useGooglePlacePhotos } from 'hooks/useGooglePlacePhotos';
import axiosServices from 'utils/axios';
import { bankAccountAPI } from 'api';
import { bulkCreateUnits } from 'store/unit/unit.action';

// constant
const getInitialValues = (property) => {
  const newProperty = {
    name: '',
    propertyType: '',
    streetAddress: '',
    city: '',
    state: '',
    zipCode: '',
    images: [],
    operatingAccountId: '',
    primaryManagerId: '',
    unitCount: '',
    bulkCreateRows: [{ count: 1, bedrooms: '', baths: '', squareFeet: '' }],
    creationMode: 'bulk' // 'bulk' or 'custom'
  };

  return property ? merge({}, newProperty, property) : newProperty;
};

const propertyTypes = [
  { id: 1, value: 'singleFamily', label: 'Single-Family' },
  { id: 2, value: 'multiUnit', label: 'Multi-family' }
];

// Filter property types based on subscription plan
const getAvailablePropertyTypes = (subscriptionStatus) => {
  if (!subscriptionStatus?.subscription?.plan) {
    return propertyTypes; // No subscription - allow all for trial
  }
  
  // Property limits removed - all property types are allowed based on unit limits only
  return propertyTypes;
};

// ==============================|| PROPERTY ADD PAGE ||============================== //

export default function PropertyAdd() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { currentOrganization } = useOrganization();
  const dispatch = useDispatch();

  const { createProperty, createLoading } = useCreateProperty();
  const { status: subscriptionStatus } = useSubscriptionStatus();
  const theme = useTheme();
  const [loading, setLoading] = useState(false);
  const [selectedImage, setSelectedImage] = useState(undefined);
  const [googlePhotoDialogOpen, setGooglePhotoDialogOpen] = useState(false);
  const [googlePhotoUrl, setGooglePhotoUrl] = useState(null);
  const [pendingPlace, setPendingPlace] = useState(null);
  const [photoSource, setPhotoSource] = useState(null); // 'places' or 'streetview'
  const { fetchPhotosFromPlace, loading: fetchingPhoto } = useGooglePlacePhotos();

  const [avatar, setAvatar] = useState('/src/assets/images/placeholder-house.png');
  const [organizationMembers, setOrganizationMembers] = useState([]);
  const [bankAccounts, setBankAccounts] = useState([]);
  const [loadingMembers, setLoadingMembers] = useState(false);
  const [showStripeOnboarding, setShowStripeOnboarding] = useState(false);
  const [loadingBankAccounts, setLoadingBankAccounts] = useState(false);
  const addressInputRef = useRef(null);


  useEffect(() => {
    if (selectedImage) {
      setAvatar(URL.createObjectURL(selectedImage));
    }
  }, [selectedImage]);

  useEffect(() => {
    setLoading(false);
  }, []);

  // Fetch organization members
  useEffect(() => {
    const fetchMembers = async () => {
      if (!currentOrganization?.id) return;
      
      try {
        setLoadingMembers(true);
        const response = await organizationMemberAPI.getMembers(currentOrganization.id);
        if (response.success && response.data) {
          setOrganizationMembers(response.data);
        }
      } catch (error) {
        console.error('Error fetching organization members:', error);
      } finally {
        setLoadingMembers(false);
      }
    };

    fetchMembers();
  }, [currentOrganization?.id]);

  // Fetch bank accounts
  useEffect(() => {
    const fetchBankAccounts = async () => {
      try {
        setLoadingBankAccounts(true);
        const response = await bankAccountAPI.getBankAccounts();
        if (response.success && response.data) {
          // Map bank accounts to the format expected by the FormSelect
          setBankAccounts(response.data.map(acc => ({
            id: acc.id,
            value: acc.id,
            label: acc.displayName || (acc.last4 ? `Bank Account (****${acc.last4})` : 'Bank Account'),
            stripeAccountId: acc.stripeAccountId,
            displayName: acc.displayName,
            last4: acc.last4,
            bankName: acc.bankName
          })));
        } else {
          setBankAccounts([]);
        }
      } catch (error) {
        console.error('Error fetching bank accounts:', error);
        setBankAccounts([]);
      } finally {
        setLoadingBankAccounts(false);
      }
    };

    fetchBankAccounts();
  }, [showStripeOnboarding]); // Refetch when onboarding dialog closes

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
        
        // Blur the address input field to ensure dropdown stays closed after dialog closes
        setTimeout(() => {
          if (addressInputRef.current) {
            addressInputRef.current.blur();
          }
        }, 100);
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
    
    // Blur the address input field to ensure dropdown stays closed after dialog closes
    setTimeout(() => {
      if (addressInputRef.current) {
        addressInputRef.current.blur();
      }
    }, 100);
  };

  const PropertySchema = Yup.object().shape({
    name: Yup.string().max(255).required('Property Name is required'),
    streetAddress: Yup.string().max(255).required('Street Address is required'),
    propertyType: Yup.string().required('Property Type is required'),
    city: Yup.string().required('City is required'),
    state: Yup.string().required('State is required'),
    zipCode: Yup.string().required('Zip Code is required')
  });

  const formik = useFormik({
    initialValues: getInitialValues(null),
    validationSchema: PropertySchema,
    enableReinitialize: true,
    onSubmit: async (values, { setSubmitting, resetForm }) => {
      try {
        // Check subscription status
        if (subscriptionStatus && !subscriptionStatus.canAddProperty) {
          openSnackbar({
            open: true,
            message: subscriptionStatus.upgradeMessage || 'Your subscription is not active. Please activate your subscription to add properties.',
            variant: 'alert',
            alert: { color: 'warning' }
          });
          setSubmitting(false);
          return;
        }

        // Generate units from bulk create rows if multi-unit
        let unitsToCreate = [];
        if (values.propertyType === 'multiUnit' && values.bulkCreateRows && values.bulkCreateRows.length > 0) {
          let startNumber = 1;
          values.bulkCreateRows.forEach((row) => {
            const count = parseInt(row.count) || 0;
            for (let i = 0; i < count; i++) {
              const unitNumber = startNumber++;
              unitsToCreate.push({
                name: `Unit ${unitNumber}`,
                bedrooms: row.bedrooms || '',
                baths: row.baths || '',
                squareFeet: row.squareFeet ? Number(row.squareFeet) : 0,
                isOccupied: false
              });
            }
          });
        } else if (values.propertyType === 'singleFamily') {
          // Single-family creates 1 unit
          unitsToCreate = [{
            name: 'Unit 1',
            bedrooms: '',
            baths: '',
            squareFeet: 0,
            isOccupied: false
          }];
        }

        const unitCountToAdd = unitsToCreate.length;
        const currentTotalUnits = subscriptionStatus?.currentTotalUnits || 0;
        const maxTotalUnits = subscriptionStatus?.maxTotalUnits;
        const remainingUnitSlots = subscriptionStatus?.remainingUnitSlots;

        // Check if adding these units would exceed the limit
        if (maxTotalUnits !== null && remainingUnitSlots !== null && remainingUnitSlots < unitCountToAdd) {
          openSnackbar({
            open: true,
            message: `You cannot add ${unitCountToAdd} unit(s). You have ${remainingUnitSlots} unit slot(s) remaining. Please upgrade your subscription to add more units.`,
            variant: 'alert',
            alert: { color: 'warning' }
          });
          setSubmitting(false);
          return;
        }

        // Create the property
        // Use street address (without city/state/zip) as the property name
        const streetAddressOnly = (values.streetAddress || '').trim();
        const payload = {
          name: streetAddressOnly, // Property name should be just street address
          propertyType: values.propertyType,
          streetAddress: streetAddressOnly,
          city: (values.city || '').trim(),
          state: (values.state || '').trim(),
          zipCode: (values.zipCode || '').trim(),
          primaryManagerId: values.primaryManagerId || null,
          operatingAccountId: values.operatingAccountId || null,
          unitCount: null // Don't send unitCount, we'll create units separately
        };

        const mainImage = selectedImage ? selectedImage : null;
        const created = await createProperty(payload, mainImage);

        // Create units using bulk create API if we have units to create
        if (unitsToCreate.length > 0 && created?.id) {
          const unitsPayload = unitsToCreate.map(unit => ({
            id: 0,
            name: unit.name,
            bedrooms: unit.bedrooms || '',
            baths: unit.baths || '',
            squareFeet: unit.squareFeet || 0,
            isOccupied: unit.isOccupied || false,
            PropertyId: created.id,
            type: '',
            rentAmount: 0,
            amenities: [],
            includedUtility: []
          }));

          try {
            await dispatch(bulkCreateUnits(created.id, unitsPayload));
          } catch (unitError) {
            console.error('Error creating units:', unitError);
            // Property was created but units failed - still show success but warn about units
            openSnackbar({
              open: true,
              message: `Property "${created?.name ?? payload.name}" added successfully, but there was an error creating units. You can add them manually from the property page.`,
              variant: 'alert',
              alert: { color: 'warning' }
            });
            resetForm();
            setSelectedImage(undefined);
            navigate(`/landlord/property/${created.id}`);
            return;
          }
        }

        openSnackbar({
          open: true,
          message: `Property "${created?.name ?? payload.name}" added successfully. You can add leases and tenants from the property page.`,
          variant: 'alert',
          alert: { color: 'success' }
        });

        resetForm();
        setSelectedImage(undefined);

        // Check if user hasn't completed onboarding - if so, go back to dashboard to show wizard
        const hasSeenTutorial = user?.HasSeenTutorial || user?.hasSeenTutorial || false;
        if (!hasSeenTutorial) {
          // Navigate to dashboard so wizard can reopen
          navigate('/landlord/dashboard');
        } else {
          // Navigate to property page
          navigate(`/landlord/property/${created.id}`);
        }
      } catch (error) {
        console.error(error);
        const errorMessage = error?.response?.data?.message || 'Failed to add property.';
        const isSubscriptionError = errorMessage.includes('Unit Limit') || 
                                    errorMessage.includes('subscription') ||
                                    errorMessage.includes('Subscription Required') ||
                                    error?.response?.status === 403;

        openSnackbar({
          open: true,
          message: errorMessage,
          variant: 'alert',
          alert: { color: isSubscriptionError ? 'warning' : 'error' }
        });
      } finally {
        setSubmitting(false);
      }
    }
  });

  const { errors, touched, handleSubmit, isSubmitting, getFieldProps, setFieldValue, values } = formik;

  // Initialize bulk create rows when property type changes to multiUnit
  useEffect(() => {
    if (values.propertyType === 'multiUnit' && (!values.bulkCreateRows || values.bulkCreateRows.length === 0)) {
      setFieldValue('bulkCreateRows', [{ count: 1, bedrooms: '', baths: '', squareFeet: '' }]);
      setFieldValue('creationMode', 'bulk');
    }
  }, [values.propertyType, setFieldValue]);

  // Handler for when Stripe onboarding completes
  const handleStripeOnboardingComplete = async () => {
    console.log('handleStripeOnboardingComplete called - starting sync process');
    
    // First, call the sync endpoint to ensure bank account is created in database
    try {
      console.log('Calling sync-bank-account endpoint...');
      const syncResponse = await axiosServices.post('/api/stripe/sync-bank-account');
      console.log('Sync endpoint response:', syncResponse.data);
      
      if (!syncResponse.data?.success && !syncResponse.data?.data) {
        console.warn('Bank account sync may have failed:', syncResponse.data);
      } else {
        console.log('Bank account sync successful:', syncResponse.data);
      }
    } catch (error) {
      console.error('Error calling sync-bank-account endpoint:', error);
      console.error('Error details:', error?.response?.data || error?.message);
    }
    
    // Wait a moment for the sync to complete, then refresh bank accounts list
    await new Promise(resolve => setTimeout(resolve, 1000));
    
    try {
      console.log('Refreshing bank accounts after onboarding...');
      const response = await bankAccountAPI.getBankAccounts();
      console.log('Bank accounts response:', response);
      
      if (response.success && response.data) {
        // Map bank accounts to the format expected by the FormSelect
        const mappedAccounts = response.data.map(acc => ({
          id: acc.id,
          value: acc.id,
          label: acc.displayName || (acc.last4 ? `Bank Account (****${acc.last4})` : 'Bank Account'),
          stripeAccountId: acc.stripeAccountId,
          displayName: acc.displayName,
          last4: acc.last4,
          bankName: acc.bankName
        }));
        
        console.log('Mapped bank accounts:', mappedAccounts);
        setBankAccounts(mappedAccounts);
        
        // Auto-select the most recently created account (should be the one just connected)
        if (mappedAccounts.length > 0) {
          const newestAccount = mappedAccounts[0]; // Accounts are ordered by CreatedAt desc
          console.log('Auto-selecting bank account:', newestAccount);
          setFieldValue('operatingAccountId', newestAccount.id);
        } else {
          console.warn('No bank accounts found after onboarding. The sync may have failed.');
        }
      } else {
        console.warn('Bank accounts response was not successful:', response);
      }
    } catch (error) {
      console.error('Error refreshing bank accounts after onboarding:', error);
      console.error('Error details:', error?.response?.data || error?.message);
    }
  };

  const handleCancel = () => {
    navigate('/landlord/properties');
  };


  if (loading || createLoading) {
    return (
      <Box sx={{ p: 5 }}>
        <Stack direction="row" sx={{ justifyContent: 'center' }}>
          <CircularWithPath />
        </Stack>
      </Box>
    );
  }

  return (
    <MainCard>
      <FormikProvider value={formik}>
        <LocalizationProvider dateAdapter={AdapterDateFns}>
          <Form autoComplete="off" noValidate onSubmit={handleSubmit}>
            <Stack spacing={3}>
              {/* General Information Section */}
              <Box sx={{ mb: 3 }}>
                <Typography variant="h5" sx={{ mb: 3, fontWeight: 'bold', fontStyle: 'italic' }}>
                  GENERAL INFORMATION
                </Typography>

                <Grid container spacing={3}>
                  {/* Property Name */}
                  <Grid size={{ xs: 12 }}>
                    <FormInput
                      id="property-name"
                      className="property-name"
                      label="Property Name *"
                      placeholder="Ex. East Main St. Property"
                      {...getFieldProps('name')}
                      error={Boolean(touched.name && errors.name)}
                      helperText={touched.name && errors.name}
                    />
                  </Grid>

                  {/* Street Address */}
                  <Grid size={{ xs: 12 }}>
                    <Typography variant="body1" sx={{ fontWeight: 'bold', mb: 2 }}>
                      What is the street address?
                    </Typography>
                    <Stack sx={{ gap: 1 }}>
                      <InputLabel htmlFor="property-streetAddress">Street Address *</InputLabel>
                      <AddressFieldWithPlaces 
                        formik={formik} 
                        name="streetAddress"
                        onSelected={handleAddressSelected}
                        inputRef={addressInputRef}
                      />
                    </Stack>
                  </Grid>

{/* City, State, Zip Code */}
<Grid size={{ xs: 12, sm: 4 }}>
                    <FormInput
                      label="City *"
                      placeholder="City"
                      {...getFieldProps('city')}
                      errorText={touched.city && errors.city}
                      touched={touched.city}
                    />
                  </Grid>

                  <Grid size={{ xs: 12, sm: 4 }}>
                    <FormInput
                      label="State *"
                      placeholder="State"
                      {...getFieldProps('state')}
                      errorText={touched.state && errors.state}
                      touched={touched.state}
                    />
                  </Grid>

                  <Grid size={{ xs: 12, sm: 4 }}>
                    <FormInput
                      label="Zip Code *"
                      placeholder="Zip Code"
                      {...getFieldProps('zipCode')}
                      errorText={touched.zipCode && errors.zipCode}
                      touched={touched.zipCode}
                    />
                  </Grid>

                  {/* Property Image Upload */}
                  <Grid size={{ xs: 12 }}>
                    <Typography variant="body1" sx={{ fontWeight: 'bold', mb: 2 }}>
                      Upload Property Image
                    </Typography>
                    <Stack direction="row" sx={{ justifyContent: 'flex-start', mt: 1 }}>
                      <FormLabel
                        htmlFor="change-avatar"
                        sx={{
                          position: 'relative',
                          borderRadius: '50%',
                          overflow: 'hidden',
                          '&:hover .MuiBox-root': { opacity: 1 },
                          cursor: 'pointer'
                        }}
                      >
                        <Avatar alt="Property Image" src={avatar} sx={{ width: 150, height: 150, border: '1px dashed' }} />
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
                        id="change-avatar"
                        variant="outlined"
                        sx={{ display: 'none' }}
                        onChange={(e) => setSelectedImage(e.target.files?.[0])}
                      />
                    </Stack>
                  </Grid>
                  
                  {/* Property Type - Card Selection */}
                  <Grid size={{ xs: 12 }}>
                    <Typography variant="body1" sx={{ fontWeight: 'bold', mb: 2 }}>
                      PROPERTY TYPE
                    </Typography>
                    <Grid container spacing={2}>
                      {/* Single Unit Type Card */}
                      <Grid size={{ xs: 12, md: 6 }}>
                        <Card
                          variant="outlined"
                          onClick={() => setFieldValue('propertyType', 'singleFamily')}
                          sx={{
                            cursor: 'pointer',
                            border: values.propertyType === 'singleFamily' ? 2 : 1,
                            borderColor: values.propertyType === 'singleFamily' ? 'success.main' : 'divider',
                            transition: 'all 0.2s',
                            '&:hover': {
                              borderColor: values.propertyType === 'singleFamily' ? 'success.main' : 'text.secondary'
                            }
                          }}
                        >
                          <CardActionArea>
                            <CardContent>
                              <Stack direction="row" spacing={2} alignItems="flex-start">
                                {values.propertyType === 'singleFamily' ? (
                                  <CheckCircleOutlined style={{ fontSize: 24, color: theme.palette.success.main, marginTop: 2 }} />
                                ) : (
                                  <Box
                                    sx={{
                                      width: 24,
                                      height: 24,
                                      borderRadius: '50%',
                                      border: '2px solid',
                                      borderColor: 'text.secondary',
                                      mt: 0.25
                                    }}
                                  />
                                )}
                                <Box sx={{ flex: 1 }}>
                                  <Typography variant="h6" sx={{ mb: 1, fontWeight: 600 }}>
                                    Single Unit type
                                  </Typography>
                                  <Typography variant="body2" color="text.secondary">
                                    Single family rentals (often abbreviated as SFR) are rentals in which there is only one rental associated to a specific address. This type of rental is usually used for a house, single mobile home, or a single condo. This type of property does not allow to add any units/rooms.
                                  </Typography>
                                </Box>
                              </Stack>
                            </CardContent>
                          </CardActionArea>
                        </Card>
                      </Grid>

                      {/* Multi Unit Type Card */}
                      <Grid size={{ xs: 12, md: 6 }}>
                        <Card
                          variant="outlined"
                          onClick={() => setFieldValue('propertyType', 'multiUnit')}
                          sx={{
                            cursor: 'pointer',
                            border: values.propertyType === 'multiUnit' ? 2 : 1,
                            borderColor: values.propertyType === 'multiUnit' ? 'success.main' : 'divider',
                            transition: 'all 0.2s',
                            '&:hover': {
                              borderColor: values.propertyType === 'multiUnit' ? 'success.main' : 'text.secondary'
                            }
                          }}
                        >
                          <CardActionArea>
                            <CardContent>
                              <Stack direction="row" spacing={2} alignItems="flex-start">
                                {values.propertyType === 'multiUnit' ? (
                                  <CheckCircleOutlined style={{ fontSize: 24, color: theme.palette.success.main, marginTop: 2 }} />
                                ) : (
                                  <Box
                                    sx={{
                                      width: 24,
                                      height: 24,
                                      borderRadius: '50%',
                                      border: '2px solid',
                                      borderColor: 'text.secondary',
                                      mt: 0.25
                                    }}
                                  />
                                )}
                                <Box sx={{ flex: 1 }}>
                                  <Typography variant="h6" sx={{ mb: 1, fontWeight: 600 }}>
                                    Multi Unit type
                                  </Typography>
                                  <Typography variant="body2" color="text.secondary">
                                    Multi-unit property are for rentals in which there are multiple rental units per a single address. This type of property is typically used for renting out rooms of a house, apartment units, office units, condos, garages, storage units, mobile home park and etc.
                                  </Typography>
                                </Box>
                              </Stack>
                            </CardContent>
                          </CardActionArea>
                        </Card>
                      </Grid>
                    </Grid>
                    {touched.propertyType && errors.propertyType && (
                      <Typography variant="caption" color="error" sx={{ mt: 1, display: 'block' }}>
                        {errors.propertyType}
                      </Typography>
                    )}
                  </Grid>

                  {/* Total Unit Limit - Always show */}
                  <Grid size={{ xs: 12 }}>
                    {(() => {
                      const maxTotalUnits = subscriptionStatus?.subscription?.plan?.maxTotalUnits;
                      const currentTotalUnits = subscriptionStatus?.currentTotalUnits || 0;
                      const remainingTotalUnits = maxTotalUnits ? maxTotalUnits - currentTotalUnits : null;
                      
                      return (
                        maxTotalUnits && (
                          <Alert severity={remainingTotalUnits && remainingTotalUnits > 0 ? 'info' : 'warning'} sx={{ mb: 2 }}>
                            <Typography variant="body2">
                              <strong>Total Unit Limit:</strong> {currentTotalUnits} / {maxTotalUnits} units used across all properties
                              {remainingTotalUnits !== null && (
                                <> ({remainingTotalUnits > 0 ? `${remainingTotalUnits} remaining` : 'Limit reached'})</>
                              )}
                            </Typography>
                            {remainingTotalUnits !== null && remainingTotalUnits <= 0 && (
                              <Typography variant="caption" sx={{ mt: 0.5, display: 'block' }}>
                                <Typography
                                  component="span"
                                  onClick={() => navigate('/landlord/subscription')}
                                  sx={{
                                    color: 'primary.main',
                                    cursor: 'pointer',
                                    textDecoration: 'underline',
                                    '&:hover': {
                                      color: 'primary.dark'
                                    }
                                  }}
                                >
                                  Upgrade your subscription
                                </Typography>
                                {' '}to add more units.
                              </Typography>
                            )}
                          </Alert>
                        )
                      );
                    })()}
                  </Grid>

                  {/* Bulk Create Units - Only show for multi-family */}
                  {values.propertyType === 'multiUnit' && (
                    <Grid size={{ xs: 12 }}>
                      <Typography variant="body1" sx={{ fontWeight: 'bold', mb: 2 }}>
                        Create Units
                      </Typography>
                      
                      <FormControl sx={{ mb: 2 }}>
                              <FormLabel>Creation Mode</FormLabel>
                              <RadioGroup
                                value={values.creationMode || 'bulk'}
                                onChange={(e) => setFieldValue('creationMode', e.target.value)}
                                row
                              >
                                <FormControlLabel value="bulk" control={<Radio />} label="Bulk Create" />
                                <FormControlLabel value="custom" control={<Radio />} label="Custom Units" />
                              </RadioGroup>
                            </FormControl>

                            <Divider sx={{ my: 2 }} />

                      {values.creationMode === 'bulk' ? (
                        <Stack spacing={2}>
                          <Typography variant="body2" color="text.secondary">
                            Define multiple unit configurations. Each row will create the specified number of units with the same bedrooms, baths, and square feet.
                          </Typography>
                          
                          {(values.bulkCreateRows || []).map((row, index) => (
                            <Box key={index} sx={{ p: 2, border: '1px solid', borderColor: 'divider', borderRadius: 1 }}>
                              <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 2 }}>
                                <Typography variant="subtitle2">Row {index + 1}</Typography>
                                {(values.bulkCreateRows || []).length > 1 && (
                                  <Button
                                    size="small"
                                    color="error"
                                    onClick={() => {
                                      const newRows = (values.bulkCreateRows || []).filter((_, i) => i !== index);
                                      setFieldValue('bulkCreateRows', newRows);
                                    }}
                                    startIcon={<DeleteFilled />}
                                  >
                                    Remove
                                  </Button>
                                )}
                              </Stack>
                              <Grid container spacing={2}>
                                <Grid size={{ xs: 12, sm: 3 }}>
                                  <TextField
                                    label="Number of Units"
                                    type="number"
                                    value={row.count || 1}
                                    onChange={(e) => {
                                      const newRows = [...(values.bulkCreateRows || [])];
                                      newRows[index] = { ...newRows[index], count: Math.max(1, parseInt(e.target.value) || 1) };
                                      setFieldValue('bulkCreateRows', newRows);
                                    }}
                                    inputProps={{ min: 1 }}
                                    fullWidth
                                  />
                                </Grid>
                                <Grid size={{ xs: 12, sm: 3 }}>
                                  <TextField
                                    label="Bedrooms"
                                    value={row.bedrooms || ''}
                                    onChange={(e) => {
                                      const newRows = [...(values.bulkCreateRows || [])];
                                      newRows[index] = { ...newRows[index], bedrooms: e.target.value };
                                      setFieldValue('bulkCreateRows', newRows);
                                    }}
                                    placeholder="Ex. 2"
                                    fullWidth
                                  />
                                </Grid>
                                <Grid size={{ xs: 12, sm: 3 }}>
                                  <TextField
                                    label="Baths"
                                    value={row.baths || ''}
                                    onChange={(e) => {
                                      const newRows = [...(values.bulkCreateRows || [])];
                                      newRows[index] = { ...newRows[index], baths: e.target.value };
                                      setFieldValue('bulkCreateRows', newRows);
                                    }}
                                    placeholder="Ex. 1.5"
                                    fullWidth
                                  />
                                </Grid>
                                <Grid size={{ xs: 12, sm: 3 }}>
                                  <TextField
                                    label="Square Feet"
                                    type="number"
                                    value={row.squareFeet || ''}
                                    onChange={(e) => {
                                      const newRows = [...(values.bulkCreateRows || [])];
                                      newRows[index] = { ...newRows[index], squareFeet: e.target.value };
                                      setFieldValue('bulkCreateRows', newRows);
                                    }}
                                    placeholder="Ex. 1200"
                                    fullWidth
                                  />
                                </Grid>
                              </Grid>
                            </Box>
                          ))}
                          
                          <Button
                            startIcon={<PlusOutlined />}
                            size="small"
                            variant="outlined"
                            onClick={() => {
                              const currentRows = values.bulkCreateRows || [{ count: 1, bedrooms: '', baths: '', squareFeet: '' }];
                              setFieldValue('bulkCreateRows', [...currentRows, { count: 1, bedrooms: '', baths: '', squareFeet: '' }]);
                            }}
                          >
                            Add Another Row
                          </Button>

                          {(() => {
                            const totalUnitsToCreate = (values.bulkCreateRows || []).reduce((sum, row) => sum + (parseInt(row.count) || 0), 0);
                            return totalUnitsToCreate > 0 ? (
                              <Box sx={{ mt: 2, p: 2, bgcolor: 'background.default', borderRadius: 1 }}>
                                <Typography variant="body2" color="text.secondary">
                                  Preview: {totalUnitsToCreate} unit(s) will be created with names "Unit 1", "Unit 2", etc.
                                </Typography>
                              </Box>
                            ) : null;
                          })()}
                        </Stack>
                      ) : (
                        <Typography variant="body2" color="text.secondary">
                          Custom units mode - units can be added after property creation from the property page.
                        </Typography>
                      )}
                    </Grid>
                  )}

                  
                </Grid>
              </Box>

              <Divider sx={{ my: 3 }} />

              {/* Account Information Section */}
              <Box>
                <Typography variant="h5" sx={{ mb: 3, fontWeight: 'bold', fontStyle: 'italic' }}>
                  ACCOUNT INFORMATION
                </Typography>
                <Typography variant="body1" sx={{ fontWeight: 'bold', mb: 1 }}>
                  What is this property's primary bank account? 
                </Typography>
                <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                  Select the bank account where rent payments for this property will be deposited.
                </Typography>
                <Grid container spacing={3}>
                  <Grid size={{ xs: 12, sm: 8, md: 6 }}>
                    <FormSelect
                      name="operatingAccountId"
                      label="Operating Account"
                      options={[
                        ...bankAccounts.map(acc => ({ id: acc.id, value: acc.id, label: acc.label || acc.displayName || 'Bank Account' })),
                        { id: 'add-new', value: 'add-new', label: 'Add new bank account' }
                      ]}
                      value={values.operatingAccountId || ''}
                      setFieldValue={(name, value) => {
                        if (value === 'add-new') {
                          setShowStripeOnboarding(true);
                        } else {
                          setFieldValue(name, value);
                        }
                      }}
                      placeholder="Select or add new (optional)"
                      valueType="string"
                    />
                  </Grid>

                  <Grid size={{ xs: 12 }}>
                    <Typography variant="body1" sx={{ fontWeight: 'bold', mb: 2, mt: 2 }}>
                      Who will be the primary manager of this property?
                    </Typography>
                    <Box sx={{ width: { xs: '100%', sm: '66.67%', md: '50%' } }}>
                      <FormSelect
                        name="primaryManagerId"
                        label="Primary Manager *"
                        options={organizationMembers
                          .filter(m => m.userId && m.isActive)
                          .map(member => {
                            const isCurrentUser = member.userId === (user?.Id || user?.id);
                            const name = member.userName || member.userEmail || 'Unknown';
                            return {
                              id: member.userId,
                              value: member.userId,
                              label: isCurrentUser ? `${name} (me)` : name
                            };
                          })}
                        value={values.primaryManagerId || ''}
                        setFieldValue={setFieldValue}
                        placeholder="Select manager"
                        valueType="number"
                        disabled={loadingMembers}
                      />
                    </Box>
                  </Grid>
                </Grid>
              </Box>

              {/* Action Buttons */}
              <Stack direction="row" spacing={2} justifyContent="flex-end" sx={{ pt: 2 }}>
                <Button
                  variant="text"
                  onClick={handleCancel}
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
                      variant="contained"
                      disabled={isSubmitting || !subscriptionStatus?.canAddProperty}
                      startIcon={<PlusOutlined style={{ fontSize: 16 }} />}
                      sx={{
                        textTransform: 'none',
                        minWidth: 'auto',
                        px: 2
                      }}
                    >
                      {isSubmitting ? 'Creating...' : 'Create Property'}
                    </Button>
                  </span>
                </Tooltip>
              </Stack>
            </Stack>
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

      {/* Stripe Connect Onboarding Dialog */}
      <StripeConnectOnboardingDialog
        open={showStripeOnboarding}
        onClose={() => setShowStripeOnboarding(false)}
        onComplete={handleStripeOnboardingComplete}
      />
    </MainCard>
  );
}
