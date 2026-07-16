import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useDispatch } from 'react-redux';
import {
  Box,
  Typography,
  TextField,
  Button,
  Stack,
  CircularProgress,
  Slide,
  alpha,
  useTheme,
  Alert,
  Card,
  CardContent,
  CardActionArea,
  Grid,
  Radio,
  RadioGroup,
  FormControlLabel,
  FormControl,
  FormLabel,
  Divider,
  Avatar,
  Paper,
  Stepper,
  Step,
  StepLabel,
  StepConnector,
  stepConnectorClasses,
  styled
} from '@mui/material';
import { useFormik, FormikProvider } from 'formik';
import * as Yup from 'yup';
import { CheckCircleOutlined, ArrowLeftOutlined, HomeOutlined, PlusOutlined, DeleteFilled, InfoCircleOutlined, BankOutlined, ApartmentOutlined, ShopOutlined, KeyOutlined, CopyOutlined, DeleteOutlined } from '@ant-design/icons';
import Tooltip from '@mui/material/Tooltip';
import IconButton from '@mui/material/IconButton';
import MainCard from 'components/MainCard';
import PageBreadcrumbs from 'components/breadcrumbs/PageBreadcrumbs';
import AddressFieldWithPlaces from 'components/input/AddressFieldWithPlaces';
import FormInput from 'components/input/FormInput';
import FormSelect from 'components/input/FormSelect';
import StripeConnectOnboardingDialog from 'components/dialogs/StripeConnectOnboardingDialog';
import useCreateProperty from 'hooks/useCreateProperty';
import { useGooglePlacePhotos } from 'hooks/useGooglePlacePhotos';
import placeholderImage from 'assets/images/placeholder-house.png';
import { useSubscriptionStatus } from 'hooks/useSubscription';
import { bankAccountAPI } from 'api';
import { openSnackbar } from 'api/snackbar';
import useAuth from 'hooks/useAuth';
import { useDrawer } from 'contexts/DrawerContext';
import { setProperty } from 'store/property/property.action';
import { bulkCreateUnits, addOrUpdateUnit } from 'store/unit/unit.action';
import axiosServices from 'utils/axios';

const STEPS = {
  PROPERTY_TYPE_SELECTION: 1,
  ADDRESS: 2,
  IMAGE: 3,
  ADD_UNITS: 4,
  NAME: 5,
  PROPERTY_TYPE: 6,
  ADD_UNITS_NOW: 7,
  UNIT_CREATION: 8,
  SINGLE_UNIT_DETAILS: 9,
  BANK_ACCOUNT: 10,
  REVIEW: 11,
  PROCESSING: 12,
  SUCCESS: 13
};

const getInitialValues = () => ({
  streetAddress: '',
  city: '',
  state: '',
  zipCode: '',
  propertyName: '',
  propertyType: '',
  hasRoomRentals: null,
  image: null,
  useGoogleImage: false,
  imageIsPlaceholder: false,
  googleImageUrl: null,
  bankAccountId: null,
  addUnitsNow: null,
  creationMode: 'bulk',
  bulkCreateRows: [{ count: 1, bedrooms: '', baths: '', squareFeet: '' }],
  customUnits: [{ name: '', bedrooms: '', baths: '', squareFeet: '' }],
  singleUnitDetails: { bedrooms: '', baths: '', squareFeet: '', yearBuilt: '' },
  units: [{ name: '', bedrooms: '', baths: '', hasRoomRentals: false }],
  otherBuildingType: '',
  otherBuildingTypeSpecify: ''
});

const PropertySchema = Yup.object().shape({
  streetAddress: Yup.string().required('Street address is required'),
  city: Yup.string().required('City is required'),
  state: Yup.string().required('State is required'),
  zipCode: Yup.string().required('Zip code is required'),
  propertyType: Yup.string().required('Property type is required')
});

export default function PropertyAddWorkflow({ onClose } = {}) {
  const navigate = useNavigate();
  const dispatch = useDispatch();
  const drawer = useDrawer();
  const theme = useTheme();
  const { user } = useAuth();
  const { status: subscriptionStatus } = useSubscriptionStatus();
  const { createProperty, createLoading } = useCreateProperty();
  const { fetchPhotosFromPlace, loading: fetchingPhoto } = useGooglePlacePhotos();

  const [currentStep, setCurrentStep] = useState(STEPS.PROPERTY_TYPE_SELECTION);
  const [slideDirection, setSlideDirection] = useState('left');
  const [error, setError] = useState(null);
  const [processing, setProcessing] = useState(false);
  const [createdProperty, setCreatedProperty] = useState(null);

  // Google image state
  const [googlePhotoUrl, setGooglePhotoUrl] = useState(null);
  const [pendingPlace, setPendingPlace] = useState(null);
  const [photoSource, setPhotoSource] = useState(null);
  const [propertyRecordPrefill, setPropertyRecordPrefill] = useState(null);
  const [loadingPropertyRecordPrefill, setLoadingPropertyRecordPrefill] = useState(false);
  const addressInputRef = useRef(null);

  // Bank accounts state
  const [bankAccounts, setBankAccounts] = useState([]);
  const [loadingBankAccounts, setLoadingBankAccounts] = useState(false);
  const [showStripeOnboarding, setShowStripeOnboarding] = useState(false);
  const unitsInitializedRef = useRef(false);

  // Custom StepConnector for property workflow
  const CustomStepConnector = styled(StepConnector)(({ theme }) => ({
    [`&.${stepConnectorClasses.active}`]: {
      [`& .${stepConnectorClasses.line}`]: {
        borderColor: theme.palette.primary.main
      }
    },
    [`&.${stepConnectorClasses.completed}`]: {
      [`& .${stepConnectorClasses.line}`]: {
        borderColor: theme.palette.primary.main
      }
    },
    [`&.${stepConnectorClasses.disabled}`]: {
      [`& .${stepConnectorClasses.line}`]: {
        borderColor: theme.palette.grey[300]
      }
    },
    [`& .${stepConnectorClasses.line}`]: {
      borderColor: theme.palette.grey[300],
      borderTopWidth: 2,
      borderRadius: 1
    }
  }));

  // Map current step to stepper step (exclude PROCESSING and SUCCESS)
  const getStepperStep = () => {
    const needsUnitsStep = ['smallMultiFamily', 'apartmentBuilding', 'other'].includes(values.propertyType);
    const isSingleUnitType = ['singleFamily', 'townhouse', 'condominium'].includes(values.propertyType);
    if (currentStep === STEPS.PROPERTY_TYPE_SELECTION) return 0;
    if (currentStep === STEPS.ADDRESS) return 1;
    if (currentStep === STEPS.IMAGE) return 2;
    if (currentStep === STEPS.SINGLE_UNIT_DETAILS) return 3;
    if (currentStep === STEPS.ADD_UNITS) return 3;
    return 0;
  };

  // Get property steps based on property type
  const getPropertySteps = () => {
    const needsUnitsStep = ['smallMultiFamily', 'apartmentBuilding', 'other'].includes(values.propertyType);
    const isSingleUnitType = ['singleFamily', 'townhouse', 'condominium'].includes(values.propertyType);
    if (needsUnitsStep) {
      return ['Property Type', 'Address', 'Image', 'Add Units'];
    }
    if (isSingleUnitType) {
      return ['Property Type', 'Address', 'Image', 'Property Details'];
    }
    return ['Property Type', 'Address', 'Image'];
  };

  const formik = useFormik({
    initialValues: getInitialValues(),
    validationSchema: PropertySchema,
    enableReinitialize: true,
    onSubmit: async (values) => {
      // This will be called from review step
      await handleCreateProperty(values);
    }
  });

  const { values, setFieldValue, errors, touched, handleSubmit } = formik;

  // Initialize customUnits when switching to custom mode
  useEffect(() => {
    if (values.creationMode === 'custom' && (!values.customUnits || values.customUnits.length === 0)) {
      setFieldValue('customUnits', [{ name: '', bedrooms: '', baths: '', squareFeet: '' }]);
    }
  }, [values.creationMode, setFieldValue]);

  // Clear public-record prefill state when the lookup inputs change.
  useEffect(() => {
    setPropertyRecordPrefill(null);
  }, [values.propertyType, values.streetAddress, values.city, values.state, values.zipCode]);

  // Pre-populate unit numbers when entering ADD_UNITS step
  useEffect(() => {
    if (currentStep === STEPS.ADD_UNITS) {
      // Reset initialization flag when entering the step
      unitsInitializedRef.current = false;
    }
  }, [currentStep]);

  // Pre-populate unit numbers when units array changes on ADD_UNITS step
  useEffect(() => {
    if (currentStep === STEPS.ADD_UNITS && values.units && values.units.length > 0) {
      // Only update units that have empty names - preserve user-entered names
      const updatedUnits = values.units.map((unit, index) => {
        // If name is empty or just whitespace, pre-populate with unit number
        if (!unit.name || unit.name.trim() === '') {
          return {
            ...unit,
            name: (100 + index + 1).toString()
          };
        }
        return unit;
      });
      
      // Only update if there were changes and we haven't just initialized
      const hasChanges = updatedUnits.some((unit, index) => unit.name !== values.units[index].name);
      if (hasChanges && !unitsInitializedRef.current) {
        setFieldValue('units', updatedUnits);
        unitsInitializedRef.current = true;
      }
    }
  }, [currentStep, values.units?.length, setFieldValue]); // Track length to detect additions

  // Fetch bank accounts
  useEffect(() => {
    const fetchBankAccounts = async () => {
      try {
        setLoadingBankAccounts(true);
        const response = await bankAccountAPI.getBankAccounts();
        if (response.success && response.data) {
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
  }, [showStripeOnboarding]);

  // Handler for when address is selected
  const handleAddressSelected = async (address, place) => {
    if (place) {
      // Store place for potential re-fetching
      setPendingPlace(place);
      // Fetch Google image but don't show dialog - will show in step 2
      const photoResult = await fetchPhotosFromPlace(place, address);
      if (photoResult && photoResult.url) {
        setGooglePhotoUrl(photoResult.url);
        setPhotoSource(photoResult.source);
        // Store in formik so it persists between steps
        setFieldValue('googleImageUrl', photoResult.url);
      }
    }
  };


  // Handler for Stripe onboarding complete
  const handleStripeOnboardingComplete = async () => {
    try {
      await axiosServices.post('/api/stripe/sync-bank-account');
      await new Promise(resolve => setTimeout(resolve, 1000));
      const response = await bankAccountAPI.getBankAccounts();
      if (response.success && response.data) {
        const mappedAccounts = response.data.map(acc => ({
          id: acc.id,
          value: acc.id,
          label: acc.displayName || (acc.last4 ? `Bank Account (****${acc.last4})` : 'Bank Account'),
          stripeAccountId: acc.stripeAccountId,
          displayName: acc.displayName,
          last4: acc.last4,
          bankName: acc.bankName
        }));
        setBankAccounts(mappedAccounts);
        if (mappedAccounts.length > 0) {
          setFieldValue('bankAccountId', mappedAccounts[0].id);
        }
      }
    } catch (error) {
      console.error('Error refreshing bank accounts after onboarding:', error);
    }
  };

  const transitionToStep = (newStep, direction) => {
    setSlideDirection(direction);
    setCurrentStep(newStep);
  };

  const prefillSingleUnitDetailsFromRentcast = async () => {
    const isSingleUnitPropertyType = ['singleFamily', 'townhouse', 'condominium'].includes(values.propertyType);
    const addressIsComplete = values.streetAddress && values.city && values.state && values.zipCode;

    if (!isSingleUnitPropertyType || !addressIsComplete || loadingPropertyRecordPrefill) return;

    try {
      setLoadingPropertyRecordPrefill(true);
      const response = await axiosServices.get('/api/property-records/prefill', {
        params: {
          streetAddress: values.streetAddress,
          city: values.city,
          state: values.state,
          zipCode: values.zipCode,
          propertyType: values.propertyType
        }
      });

      const details = response?.data?.data;
      if (!details) return;

      const currentDetails = values.singleUnitDetails || {};
      const nextDetails = {
        ...currentDetails,
        bedrooms: currentDetails.bedrooms || (details.bedrooms != null ? String(details.bedrooms) : ''),
        baths: currentDetails.baths || (details.bathrooms != null ? String(details.bathrooms) : ''),
        squareFeet: currentDetails.squareFeet || details.squareFootage || '',
        yearBuilt: currentDetails.yearBuilt || details.yearBuilt || ''
      };

      setFieldValue('singleUnitDetails', nextDetails);
      setPropertyRecordPrefill(details);
    } catch {
      setPropertyRecordPrefill(null);
    } finally {
      setLoadingPropertyRecordPrefill(false);
    }
  };

  const handlePropertyTypeSelect = async (propertyType) => {
    setError(null);
    await setFieldValue('propertyType', propertyType);
    transitionToStep(STEPS.ADDRESS, 'left');
  };

  const handleNext = async () => {
    setError(null);

    if (currentStep === STEPS.PROPERTY_TYPE_SELECTION) {
      if (!values.propertyType) {
        setError('Please select a property type');
        return;
      }
      transitionToStep(STEPS.ADDRESS, 'left');
    } else if (currentStep === STEPS.ADDRESS) {
      if (!values.streetAddress || !values.city || !values.state || !values.zipCode) {
        setError('Please fill in all address fields');
        return;
      }
      transitionToStep(STEPS.IMAGE, 'left');
      } else if (currentStep === STEPS.IMAGE) {
      // Image is optional, check if we need to add units or property details (single-unit)
      const needsUnitsStep = ['smallMultiFamily', 'apartmentBuilding', 'other'].includes(values.propertyType);
      const isSingleUnitType = ['singleFamily', 'townhouse', 'condominium'].includes(values.propertyType);
      if (needsUnitsStep) {
        // Initialize units array if empty, pre-populate unit number
        if (!values.units || values.units.length === 0) {
          setFieldValue('units', [{ name: '101', bedrooms: '', baths: '', hasRoomRentals: false }]);
        } else {
          const updatedUnits = values.units.map((unit, index) => ({
            ...unit,
            name: unit.name || (100 + index + 1).toString()
          }));
          setFieldValue('units', updatedUnits);
        }
        transitionToStep(STEPS.ADD_UNITS, 'left');
      } else if (isSingleUnitType) {
        // Single-unit: pre-fill public-record details when available, then go to Property Details.
        await prefillSingleUnitDetailsFromRentcast();
        transitionToStep(STEPS.SINGLE_UNIT_DETAILS, 'left');
      } else {
        // Other property types, proceed directly to create property
        transitionToStep(STEPS.PROCESSING, 'left');
        handleCreateProperty();
      }
    } else if (currentStep === STEPS.SINGLE_UNIT_DETAILS) {
      // Validate beds and baths for single-unit
      const d = values.singleUnitDetails || {};
      if (!d.bedrooms || d.bedrooms === '') {
        setError('Please select number of bedrooms.');
        return;
      }
      if (!d.baths || d.baths === '') {
        setError('Please select number of bathrooms.');
        return;
      }
      transitionToStep(STEPS.PROCESSING, 'left');
      handleCreateProperty();
    } else if (currentStep === STEPS.ADD_UNITS) {
      // Validate units before proceeding
      const validUnits = (values.units || []).filter(u => u.name && u.name.trim());
      if (validUnits.length === 0) {
        setError('Please add at least one unit');
        return;
      }
      // Validate required fields for each unit
      for (let i = 0; i < validUnits.length; i++) {
        const unit = validUnits[i];
        if (!unit.bedrooms || !unit.baths) {
          setError(`Unit "${unit.name || `Unit ${i + 1}`}" is missing required fields (Beds and Baths)`);
          return;
        }
      }
      // Proceed to create property with units
      transitionToStep(STEPS.PROCESSING, 'left');
      handleCreateProperty();
    }
  };

  const getPreviousStep = () => {
    if (currentStep === STEPS.ADDRESS) return STEPS.PROPERTY_TYPE_SELECTION;
    if (currentStep === STEPS.IMAGE) return STEPS.ADDRESS;
    if (currentStep === STEPS.ADD_UNITS || currentStep === STEPS.SINGLE_UNIT_DETAILS) return STEPS.IMAGE;
    return null;
  };

  const handleBack = () => {
    const previousStep = getPreviousStep();
    if (previousStep) {
      transitionToStep(previousStep, 'right');
    }
  };

  const handleCreateProperty = async () => {
    setError(null);
    setProcessing(true);

    try {
      // Check subscription status
      if (subscriptionStatus && !subscriptionStatus.canAddProperty) {
        openSnackbar({
          open: true,
          message: subscriptionStatus.upgradeMessage || 'Your subscription is not active. Please activate your subscription to add properties.',
          variant: 'alert',
          alert: { color: 'warning' }
        });
        setProcessing(false);
        // Go back to the appropriate step based on property type
        const needsUnitsStep = ['smallMultiFamily', 'apartmentBuilding', 'other'].includes(values.propertyType);
        const isSingleUnitType = ['singleFamily', 'townhouse', 'condominium'].includes(values.propertyType);
        if (needsUnitsStep) {
          transitionToStep(STEPS.ADD_UNITS, 'right');
        } else if (isSingleUnitType) {
          transitionToStep(STEPS.SINGLE_UNIT_DETAILS, 'right');
        } else {
          transitionToStep(STEPS.IMAGE, 'right');
        }
        return;
      }

      // Get units to create based on property type
      let unitsToCreate = [];
      if (isSingleFamilyType) {
        // Single-unit: use Property Details step values (beds, baths, sqft)
        const d = values.singleUnitDetails || {};
        unitsToCreate = [{
          name: 'Unit 1',
          bedrooms: d.bedrooms || '',
          baths: d.baths || '',
          squareFeet: typeof d.squareFeet === 'number' ? d.squareFeet : (parseFloat(d.squareFeet) || 0),
          isOccupied: false
        }];
      } else if (['smallMultiFamily', 'apartmentBuilding', 'other'].includes(values.propertyType)) {
        // Get units from the ADD_UNITS step
        unitsToCreate = (values.units || [])
          .filter(u => u.name && u.name.trim())
          .map(unit => ({
            name: unit.name.trim(),
            bedrooms: unit.bedrooms || '',
            baths: unit.baths || '',
            squareFeet: 0,
            isOccupied: false,
            hasRoomRentals: unit.hasRoomRentals || false
          }));
      }
      // Other multi-unit properties will have units added later by the user

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
        setProcessing(false);
        // Go back to the appropriate step based on property type
        const needsUnitsStep = ['smallMultiFamily', 'apartmentBuilding', 'other'].includes(values.propertyType);
        const isSingleUnitType = ['singleFamily', 'townhouse', 'condominium'].includes(values.propertyType);
        if (needsUnitsStep) {
          transitionToStep(STEPS.ADD_UNITS, 'right');
        } else if (isSingleUnitType) {
          transitionToStep(STEPS.SINGLE_UNIT_DETAILS, 'right');
        } else {
          transitionToStep(STEPS.IMAGE, 'right');
        }
        return;
      }

      // Map property type to backend values for unit creation logic
      // singleFamily, townhouse, condominium -> singleFamily
      // smallMultiFamily, apartmentBuilding, other -> multiUnit
      const backendPropertyType = ['singleFamily', 'townhouse', 'condominium'].includes(values.propertyType)
        ? 'singleFamily'
        : ['smallMultiFamily', 'apartmentBuilding', 'other'].includes(values.propertyType)
        ? 'multiUnit'
        : values.propertyType; // fallback to original value

      const payload = {
        name: values.propertyName?.trim() || null,
        propertyType: backendPropertyType, // Use mapped backend enum value (singleFamily or multiUnit)
        streetAddress: (values.streetAddress || '').trim(),
        city: (values.city || '').trim(),
        state: (values.state || '').trim(),
        zipCode: (values.zipCode || '').trim(),
        primaryManagerId: user?.Id || user?.id, // Auto-select current user
        operatingAccountId: values.bankAccountId || null,
        unitCount: null,
        yearBuilt: values.singleUnitDetails?.yearBuilt ? parseInt(values.singleUnitDetails.yearBuilt) : null,
        ...(values.propertyType === 'other' && values.otherBuildingType ? {
          otherBuildingType: values.otherBuildingType === 'other' && values.otherBuildingTypeSpecify
            ? values.otherBuildingTypeSpecify.trim()
            : values.otherBuildingType
        } : {})
      };

      const mainImage = values.image ? values.image : null;
      const created = await createProperty(payload, mainImage, { suppressSuccessSnackbar: true });
      setCreatedProperty(created);

      // Create units - use single unit endpoint for single-family, bulk for multi-unit
      if (unitsToCreate.length > 0 && created?.id) {
        try {
          if (isSingleFamilyType && unitsToCreate.length === 1) {
            // Use single unit endpoint for single-family properties
            const singleUnit = unitsToCreate[0];
            const unitPayload = {
              id: 0,
              name: singleUnit.name,
              bedrooms: singleUnit.bedrooms || '',
              baths: singleUnit.baths || '',
              squareFeet: singleUnit.squareFeet || 0,
              isOccupied: singleUnit.isOccupied || false,
              PropertyId: created.id,
              type: '',
              rentAmount: 0,
              amenities: [],
              includedUtility: []
            };
            await dispatch(addOrUpdateUnit(unitPayload));
          } else if (unitsToCreate.length > 0) {
            // Use bulk create for multi-unit properties (smallMultiFamily, apartmentBuilding, etc.)
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
            await dispatch(bulkCreateUnits(created.id, unitsPayload));
          }
        } catch (unitError) {
          console.error('Error creating units:', unitError);
          openSnackbar({
            open: true,
            message: `Property "${created?.name || created?.streetAddress || 'Property'}" added successfully, but there was an error creating units. You can add them manually from the property page.`,
            variant: 'alert',
            alert: { color: 'warning' }
          });
        }
      }

      setTimeout(() => {
        setProcessing(false);
        transitionToStep(STEPS.SUCCESS, 'left');
      }, 1000);
    } catch (error) {
      console.error(error);
      const errorMessage = error?.response?.data?.message || 'Failed to add property.';
      setError(errorMessage);
      setProcessing(false);
      // Go back to the appropriate step based on property type
      const needsUnitsStep = ['smallMultiFamily', 'apartmentBuilding', 'other'].includes(values.propertyType);
      const isSingleUnitType = ['singleFamily', 'townhouse', 'condominium'].includes(values.propertyType);
      if (needsUnitsStep) {
        transitionToStep(STEPS.ADD_UNITS, 'right');
      } else if (isSingleUnitType) {
        transitionToStep(STEPS.SINGLE_UNIT_DETAILS, 'right');
      } else {
        transitionToStep(STEPS.IMAGE, 'right');
      }
      openSnackbar({
        open: true,
        message: errorMessage,
        variant: 'alert',
        alert: { color: 'error' }
      });
    }
  };

  const handleSuccessAction = (action) => {
    if (action === 'addAnother') {
      formik.resetForm();
      setCreatedProperty(null);
      setError(null);
      transitionToStep(STEPS.PROPERTY_TYPE_SELECTION, 'right');
    } else if (action === 'viewProperties') {
      if (onClose) onClose();
      if (createdProperty?.id) {
        navigate(`/landlord/property/${createdProperty.id}`);
      } else {
        navigate('/landlord/properties');
      }
    } else if (action === 'createLease') {
      if (createdProperty) dispatch(setProperty(createdProperty));
      if (onClose) onClose();
      setTimeout(() => drawer.openLeaseAddDrawer(), 300);
    }
  };

  // Property type options with icons
  const propertyTypeOptions = [
    { value: 'singleFamily', label: 'Single-Family House', subtitle: 'Standalone residence', icon: HomeOutlined },
    { value: 'townhouse', label: 'Townhouse', subtitle: 'Individual unit', icon: HomeOutlined },
    { value: 'condominium', label: 'Condominium', subtitle: 'Individual unit', icon: ApartmentOutlined },
    { value: 'smallMultiFamily', label: 'Small Multi-Family', subtitle: '2-4 units at the property', icon: HomeOutlined },
    { value: 'apartmentBuilding', label: 'Apartment Building', subtitle: '5+ units at the property', icon: ApartmentOutlined },
    { value: 'other', label: 'Other Types', subtitle: 'Mixed-use, RV park, etc.', icon: KeyOutlined }
  ];

  // Helper functions to check property type
  const isMultiUnitType = ['smallMultiFamily', 'apartmentBuilding', 'other', 'multiUnit'].includes(values.propertyType);
  const isSingleFamilyType = ['singleFamily', 'townhouse', 'condominium'].includes(values.propertyType);

  // Calculate total units to be created
  const totalUnitsToCreate = isMultiUnitType && values.addUnitsNow
    ? (values.creationMode === 'bulk'
      ? (values.bulkCreateRows || []).reduce((sum, row) => sum + (parseInt(row.count) || 0), 0)
      : (values.customUnits || []).filter(u => u.name && u.name.trim()).length)
    : isSingleFamilyType ? 1 : 0;

  const renderStep = () => {
    switch (currentStep) {
      case STEPS.PROPERTY_TYPE_SELECTION:
        return (
          <Box sx={{ textAlign: 'center' }}>
            <Typography variant="h4" fontWeight={600} gutterBottom sx={{ mb: 4 }}>
              Which best describes your property?
            </Typography>
            <Grid container spacing={2} sx={{ mt: 2, maxWidth: 1000, mx: 'auto' }}>
              {propertyTypeOptions.map((option) => {
                const IconComponent = option.icon;
                const isSelected = values.propertyType === option.value;
                return (
                  <Grid size={{ xs: 12, sm: 6, md: 4 }} key={option.value}>
                    <Card
                      variant="outlined"
                      onClick={() => handlePropertyTypeSelect(option.value)}
                      sx={{
                        cursor: 'pointer',
                        border: isSelected ? 2 : 1,
                        borderColor: isSelected ? 'primary.main' : 'divider',
                        bgcolor: isSelected ? alpha(theme.palette.primary.main, 0.08) : 'background.paper',
                        transition: 'all 0.2s',
                        height: '100%',
                        position: 'relative',
                        '&:hover': {
                          borderColor: isSelected ? 'primary.main' : 'primary.light',
                          boxShadow: 2
                        }
                      }}
                    >
                      {isSelected && (
                        <Box sx={{ position: 'absolute', top: 8, right: 8, zIndex: 1 }}>
                          <CheckCircleOutlined style={{ fontSize: 20, color: theme.palette.primary.main }} />
                        </Box>
                      )}
                      <CardActionArea sx={{ p: 2, height: '100%' }}>
                        <Stack spacing={2} alignItems="center" sx={{ textAlign: 'center' }}>
                          <IconComponent style={{ fontSize: 48, color: isSelected ? theme.palette.primary.main : theme.palette.text.secondary }} />
                          <Box>
                            <Typography variant="h6" fontWeight={600} sx={{ mb: 0.5 }}>
                              {option.label}
                            </Typography>
                            <Typography variant="body2" color="text.secondary">
                              {option.subtitle}
                            </Typography>
                          </Box>
                        </Stack>
                      </CardActionArea>
                    </Card>
                  </Grid>
                );
              })}
            </Grid>
            
            {/* Other Building Type Dropdown - shown when "Other Types" is selected */}
            {values.propertyType === 'other' && (
              <Box sx={{ mt: 4, maxWidth: 600, mx: 'auto' }}>
                <Grid container spacing={2} alignItems="flex-start">
                  <Grid size={{ xs: 12, sm: values.otherBuildingType === 'other' ? 6 : 12 }}>
                    <FormSelect
                      name="otherBuildingType"
                      label="Other Building Type"
                      options={[
                        { id: '', value: '', label: 'Select One' },
                        { id: 'commercial', value: 'commercial', label: 'Commercial' },
                        { id: 'garage', value: 'garage', label: 'Garage' },
                        { id: 'manufactured', value: 'manufactured', label: 'Manufactured' },
                        { id: 'mixedUse', value: 'mixedUse', label: 'Mixed-Use' },
                        { id: 'mobileHomeRV', value: 'mobileHomeRV', label: 'Mobile Home / RV Park' },
                        { id: 'office', value: 'office', label: 'Office' },
                        { id: 'parking', value: 'parking', label: 'Parking' },
                        { id: 'storage', value: 'storage', label: 'Storage' },
                        { id: 'other', value: 'other', label: 'Other (specify)' }
                      ]}
                      value={values.otherBuildingType || ''}
                      setFieldValue={(name, value) => {
                        setFieldValue(name, value);
                        // Clear the specify field if not "other"
                        if (value !== 'other') {
                          setFieldValue('otherBuildingTypeSpecify', '');
                        }
                        setError(null);
                      }}
                      placeholder="Select One"
                      valueType="string"
                      fullWidth
                    />
                  </Grid>
                  {values.otherBuildingType === 'other' && (
                    <Grid size={{ xs: 12, sm: 6 }}>
                      <FormInput
                        label="Specify Building Type"
                        placeholder="Enter building type"
                        value={values.otherBuildingTypeSpecify || ''}
                        onChange={(e) => {
                          setFieldValue('otherBuildingTypeSpecify', e.target.value);
                          setError(null);
                        }}
                        fullWidth
                      />
                    </Grid>
                  )}
                </Grid>
              </Box>
            )}

            {error && (
              <Alert severity="error" sx={{ mt: 3, maxWidth: 1000, mx: 'auto' }}>
                {error}
              </Alert>
            )}
          </Box>
        );

      case STEPS.ADDRESS:
        return (
          <Box sx={{ textAlign: 'center' }}>
            <Typography variant="h4" fontWeight={600} gutterBottom sx={{ mb: 4 }}>
              What's the street address for your property?
            </Typography>
            <Stack spacing={2} sx={{ mt: 3, maxWidth: 600, mx: 'auto' }}>
              <Stack spacing={0.75} sx={{ textAlign: 'left' }}>
                <Typography variant="caption" fontWeight={600} color="text.secondary">
                  Property Nickname
                </Typography>
                <FormInput
                  label=""
                  placeholder="e.g. Maple Street Cottage"
                  value={values.propertyName || ''}
                  onChange={(e) => setFieldValue('propertyName', e.target.value)}
                  fullWidth
                />
              </Stack>
              <Stack spacing={0.75} sx={{ textAlign: 'left' }}>
                <Typography variant="caption" fontWeight={600} color="text.secondary">
                  Street Address *
                </Typography>
                <AddressFieldWithPlaces
                  formik={formik}
                  name="streetAddress"
                  onSelected={handleAddressSelected}
                  inputRef={addressInputRef}
                />
              </Stack>
              <Grid container spacing={2}>
                <Grid size={{ xs: 12, sm: 4 }}>
                  <Stack spacing={0.75}>
                    <Typography variant="caption" fontWeight={600} color="text.secondary">
                      City *
                    </Typography>
                    <FormInput
                      label=""
                      placeholder="City"
                      {...formik.getFieldProps('city')}
                      error={Boolean(touched.city && errors.city)}
                      helperText={touched.city && errors.city}
                    />
                  </Stack>
                </Grid>
                <Grid size={{ xs: 12, sm: 4 }}>
                  <Stack spacing={0.75}>
                    <Typography variant="caption" fontWeight={600} color="text.secondary">
                      State *
                    </Typography>
                    <FormInput
                      label=""
                      placeholder="State"
                      {...formik.getFieldProps('state')}
                      error={Boolean(touched.state && errors.state)}
                      helperText={touched.state && errors.state}
                    />
                  </Stack>
                </Grid>
                <Grid size={{ xs: 12, sm: 4 }}>
                  <Stack spacing={0.75}>
                    <Typography variant="caption" fontWeight={600} color="text.secondary">
                      Zip Code *
                    </Typography>
                    <FormInput
                      label=""
                      placeholder="Zip Code"
                      {...formik.getFieldProps('zipCode')}
                      error={Boolean(touched.zipCode && errors.zipCode)}
                      helperText={touched.zipCode && errors.zipCode}
                    />
                  </Stack>
                </Grid>
              </Grid>
              {error && (
                <Alert severity="error" sx={{ mt: 2 }}>
                  {error}
                </Alert>
              )}
            </Stack>
          </Box>
        );

      case STEPS.IMAGE:
        return (
          <Box sx={{ textAlign: 'center' }}>
            <Typography variant="h4" fontWeight={600} gutterBottom sx={{ mb: 4 }}>
              Do you want to upload the Google image for your home or use your own?
            </Typography>
            {(googlePhotoUrl || values.googleImageUrl) && (
              <Box sx={{ mb: 3, maxWidth: 600, mx: 'auto' }}>
                <Box
                  component="img"
                  src={googlePhotoUrl || values.googleImageUrl}
                  alt="Google property image"
                  sx={{
                    width: '100%',
                    maxHeight: 300,
                    objectFit: 'contain',
                    borderRadius: 2,
                    border: `1px solid ${alpha(theme.palette.divider, 0.2)}`
                  }}
                />
              </Box>
            )}
            <Stack direction="row" spacing={2} justifyContent="center" alignItems="center" sx={{ mt: 4 }}>
              {(googlePhotoUrl || values.googleImageUrl) ? (
                <Button
                  variant={values.useGoogleImage ? 'contained' : 'outlined'}
                  onClick={async () => {
                    const photoUrl = googlePhotoUrl || values.googleImageUrl;
                    try {
                      const response = await fetch(photoUrl);
                      const blob = await response.blob();
                      const file = new File([blob], 'google-maps-photo.jpg', { type: blob.type });
                      setFieldValue('image', file);
                      setFieldValue('useGoogleImage', true);
                      setFieldValue('imageIsPlaceholder', false);
                      setFieldValue('googleImageUrl', photoUrl);
                      handleNext();
                    } catch (error) {
                      console.error('Error converting Google photo to file:', error);
                      setError('Failed to load Google photo. Please upload your own image.');
                    }
                  }}
                  sx={{ textTransform: 'none', px: 4 }}
                >
                  Use Google Image
                </Button>
              ) : (
                <Typography variant="body2" color="text.secondary" sx={{ fontStyle: 'italic' }}>
                  Google image unavailable for this address.
                </Typography>
              )}
              <Button
                variant={!values.useGoogleImage && values.image ? 'contained' : 'outlined'}
                component="label"
                sx={{ textTransform: 'none', px: 4 }}
              >
                Upload My Own
                <input
                  type="file"
                  hidden
                  accept="image/*"
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (file) {
                      setFieldValue('image', file);
                      setFieldValue('useGoogleImage', false);
                      setFieldValue('imageIsPlaceholder', false);
                    }
                  }}
                />
              </Button>
            </Stack>
            <Box sx={{ display: 'flex', justifyContent: 'center', mt: 2 }}>
              <Button
                variant="text"
                onClick={async () => {
                  setError(null);
                  try {
                    const response = await fetch(placeholderImage);
                    const blob = await response.blob();
                    const file = new File([blob], 'placeholder-house.png', { type: blob.type });
                    setFieldValue('image', file);
                    setFieldValue('useGoogleImage', false);
                    setFieldValue('imageIsPlaceholder', true);
                    handleNext();
                  } catch (err) {
                    console.error('Error loading placeholder image:', err);
                    setError('Could not use placeholder. Please upload an image.');
                  }
                }}
                sx={{ textTransform: 'none', px: 3 }}
              >
                Skip
              </Button>
            </Box>
            {values.image && !values.useGoogleImage && !values.imageIsPlaceholder && (
              <Box sx={{ mt: 3 }}>
                <Avatar
                  src={URL.createObjectURL(values.image)}
                  alt="Property image"
                  sx={{ width: 150, height: 150, mx: 'auto', border: `2px solid ${alpha(theme.palette.primary.main, 0.2)}` }}
                />
              </Box>
            )}
            {error && (
              <Alert severity="error" sx={{ mt: 3 }}>
                {error}
              </Alert>
            )}
          </Box>
        );

      case STEPS.SINGLE_UNIT_DETAILS: {
        const d = values.singleUnitDetails || { bedrooms: '', baths: '', squareFeet: '', yearBuilt: '' };
        const baseBedsOptions = Array.from({ length: 6 }, (_, i) => ({ id: i, value: i.toString(), label: i.toString() }));
        const bedsOptions = d.bedrooms && !baseBedsOptions.some((option) => option.value === String(d.bedrooms))
          ? [...baseBedsOptions, { id: d.bedrooms, value: String(d.bedrooms), label: String(d.bedrooms) }]
          : baseBedsOptions;
        const baseBathsOptions = ['0.5', '1', '1.5', '2', '2.5', '3', '3.5', '4', '4.5', '5'].map(val => ({ id: val, value: val, label: val }));
        const bathsOptions = d.baths && !baseBathsOptions.some((option) => option.value === String(d.baths))
          ? [...baseBathsOptions, { id: d.baths, value: String(d.baths), label: String(d.baths) }]
          : baseBathsOptions;
        return (
          <Box sx={{ maxWidth: 520, mx: 'auto' }}>
            <Typography variant="h4" fontWeight={600} gutterBottom sx={{ mb: 1, textAlign: 'center' }}>
              Property details
            </Typography>
            <Typography variant="body2" color="text.secondary" sx={{ mb: 3, textAlign: 'center' }}>
              Enter the number of bedrooms, bathrooms, and square footage for this property.
            </Typography>
            {loadingPropertyRecordPrefill && (
              <Alert severity="info" icon={<CircularProgress size={16} />} sx={{ mb: 2 }}>
                Looking up public property details from Rentcast...
              </Alert>
            )}
            {propertyRecordPrefill && !loadingPropertyRecordPrefill && (() => {
              const filled = [
                propertyRecordPrefill.bedrooms != null && 'beds',
                propertyRecordPrefill.bathrooms != null && 'baths',
                propertyRecordPrefill.squareFootage && 'square footage',
                propertyRecordPrefill.yearBuilt && 'year built'
              ].filter(Boolean);
              if (!filled.length) return null;
              const list = filled.length === 1
                ? filled[0]
                : filled.length === 2
                  ? `${filled[0]} and ${filled[1]}`
                  : `${filled.slice(0, -1).join(', ')}, and ${filled[filled.length - 1]}`;
              return (
                <Alert severity="success" sx={{ mb: 2 }}>
                  We pre-filled {list} from public property records. Please review and edit anything that looks off.
                </Alert>
              );
            })()}
            <Stack spacing={2}>
              <Grid container spacing={2}>
                <Grid size={{ xs: 12, sm: 4 }}>
                  <FormSelect
                    name="singleUnitDetails.bedrooms"
                    label="Beds *"
                    options={bedsOptions}
                    value={d.bedrooms || ''}
                    setFieldValue={(name, value) => {
                      setFieldValue('singleUnitDetails', { ...values.singleUnitDetails, bedrooms: value });
                      setError(null);
                    }}
                    placeholder="Select"
                    valueType="string"
                    fullWidth
                  />
                </Grid>
                <Grid size={{ xs: 12, sm: 4 }}>
                  <FormSelect
                    name="singleUnitDetails.baths"
                    label="Baths *"
                    options={bathsOptions}
                    value={d.baths || ''}
                    setFieldValue={(name, value) => {
                      setFieldValue('singleUnitDetails', { ...values.singleUnitDetails, baths: value });
                      setError(null);
                    }}
                    placeholder="Select"
                    valueType="string"
                    fullWidth
                  />
                </Grid>
                <Grid size={{ xs: 12, sm: 4 }}>
                  <FormInput
                    label="Square feet"
                    placeholder="e.g. 1200"
                    type="number"
                    inputProps={{ min: 0, step: 1 }}
                    value={d.squareFeet === '' || d.squareFeet == null ? '' : String(d.squareFeet)}
                    onChange={(e) => {
                      const v = e.target.value;
                      const num = v === '' ? '' : (parseFloat(v) || 0);
                      setFieldValue('singleUnitDetails', { ...values.singleUnitDetails, squareFeet: num });
                      setError(null);
                    }}
                    fullWidth
                  />
                </Grid>
                <Grid size={{ xs: 12, sm: 4 }}>
                  <FormInput
                    label="Year built"
                    placeholder="e.g. 1998"
                    type="number"
                    inputProps={{ min: 1800, max: new Date().getFullYear(), step: 1 }}
                    value={d.yearBuilt === '' || d.yearBuilt == null ? '' : String(d.yearBuilt)}
                    onChange={(e) => {
                      const v = e.target.value;
                      const num = v === '' ? '' : (parseInt(v) || '');
                      setFieldValue('singleUnitDetails', { ...values.singleUnitDetails, yearBuilt: num });
                      setError(null);
                    }}
                    fullWidth
                  />
                </Grid>
              </Grid>
            </Stack>
            {error && (
              <Alert severity="error" sx={{ mt: 2 }}>
                {error}
              </Alert>
            )}
          </Box>
        );
      }

      case STEPS.ADD_UNITS:
        // Generate beds and baths options
        const bedsOptions = Array.from({ length: 6 }, (_, i) => ({ id: i, value: i.toString(), label: i.toString() }));
        const bathsOptions = ['0.5', '1', '1.5', '2', '2.5', '3', '3.5', '4', '4.5', '5'].map(val => ({ id: val, value: val, label: val }));

        return (
          <Box sx={{ maxWidth: 900, mx: 'auto' }}>
            <Typography variant="h4" fontWeight={600} gutterBottom sx={{ mb: 4, textAlign: 'center' }}>
              Add Units
            </Typography>
            
            <Stack spacing={3}>
              <Grid container spacing={2}>
                <Grid size={{ xs: 12, sm: 4 }}>
                  <FormInput
                    label="Year Built"
                    placeholder="e.g. 1998"
                    type="number"
                    inputProps={{ min: 1800, max: new Date().getFullYear(), step: 1 }}
                    value={values.singleUnitDetails?.yearBuilt === '' || values.singleUnitDetails?.yearBuilt == null ? '' : String(values.singleUnitDetails.yearBuilt)}
                    onChange={(e) => {
                      const v = e.target.value;
                      const num = v === '' ? '' : (parseInt(v) || '');
                      setFieldValue('singleUnitDetails', { ...values.singleUnitDetails, yearBuilt: num });
                    }}
                    fullWidth
                  />
                </Grid>
              </Grid>
              {(values.units || []).map((unit, index) => (
                <Paper
                  key={index}
                  variant="outlined"
                  sx={{
                    p: 3,
                    borderRadius: 2,
                    bgcolor: alpha(theme.palette.background.paper, 0.6)
                  }}
                >
                  <Stack spacing={2}>
                    <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 1 }}>
                      <Typography variant="h6" fontWeight={600}>
                        Unit {index + 1}
                      </Typography>
                      <Box sx={{ display: 'flex', gap: 1 }}>
                        <Button
                          size="small"
                          startIcon={<CopyOutlined />}
                          onClick={() => {
                            const newUnits = [...(values.units || [])];
                            const nextUnitNumber = (100 + newUnits.length + 1).toString();
                            newUnits.push({
                              name: nextUnitNumber,
                              bedrooms: unit.bedrooms || '',
                              baths: unit.baths || '',
                              hasRoomRentals: false
                            });
                            setFieldValue('units', newUnits);
                          }}
                          sx={{ textTransform: 'none', color: 'primary.main' }}
                        >
                          Duplicate Unit
                        </Button>
                        {(values.units || []).length >= 2 && (
                          <Button
                            size="small"
                            startIcon={<DeleteOutlined />}
                            onClick={() => {
                              const newUnits = [...(values.units || [])];
                              newUnits.splice(index, 1);
                              setFieldValue('units', newUnits);
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
                            const newUnits = [...(values.units || [])];
                            newUnits[index] = { ...newUnits[index], name: e.target.value };
                            setFieldValue('units', newUnits);
                          }}
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
                            const newUnits = [...(values.units || [])];
                            newUnits[index] = { ...newUnits[index], bedrooms: value };
                            setFieldValue('units', newUnits);
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
                            const newUnits = [...(values.units || [])];
                            newUnits[index] = { ...newUnits[index], baths: value };
                            setFieldValue('units', newUnits);
                          }}
                          placeholder="Select"
                          valueType="string"
                          fullWidth
                        />
                      </Grid>
                    </Grid>

                  </Stack>
                </Paper>
              ))}

              <Button
                variant="outlined"
                startIcon={<PlusOutlined />}
                onClick={() => {
                  const currentUnits = values.units || [];
                  const nextUnitNumber = (100 + currentUnits.length + 1).toString();
                  const newUnits = [...currentUnits, { name: nextUnitNumber, bedrooms: '', baths: '', hasRoomRentals: false }];
                  setFieldValue('units', newUnits);
                }}
                sx={{ textTransform: 'none', px: 3, alignSelf: 'flex-start' }}
              >
                Add Another Unit
              </Button>
            </Stack>

            {error && (
              <Alert severity="error" sx={{ mt: 3 }}>
                {error}
              </Alert>
            )}

            {/* Save and Back Buttons */}
            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mt: 4, pt: 3, borderTop: `1px solid ${alpha(theme.palette.divider, 0.5)}` }}>
              <Button
                onClick={handleBack}
                disabled={processing}
                startIcon={<ArrowLeftOutlined />}
                size="small"
                sx={{ textTransform: 'none', px: 3 }}
              >
                Back
              </Button>
              <Button
                variant="contained"
                size="small"
                onClick={handleNext}
                disabled={processing}
                sx={{ textTransform: 'none', px: 6, py: 1 }}
              >
                Save
              </Button>
            </Box>
          </Box>
        );

      case STEPS.PROCESSING:
        return (
          <Box sx={{ textAlign: 'center', py: 4 }}>
            <CircularProgress size={60} sx={{ mb: 3 }} />
            <Typography variant="h5" fontWeight={600} gutterBottom>
              Creating your property...
            </Typography>
            <Typography variant="body2" color="text.secondary">
              Please wait while we create your property.
            </Typography>
          </Box>
        );

      case STEPS.SUCCESS:
        return (
          <Box sx={{ textAlign: 'center', py: 4, maxWidth: 640, mx: 'auto' }}>
            <CheckCircleOutlined style={{ fontSize: 64, color: theme.palette.success.main, marginBottom: 16 }} />
            <Typography variant="h5" fontWeight={600} gutterBottom>
              Property created successfully!
            </Typography>
            {createdProperty && (
              <Typography variant="body1" color="text.secondary" sx={{ mb: 4 }}>
                {createdProperty.name || createdProperty.streetAddress || 'Property'}
              </Typography>
            )}
            <Typography variant="h6" fontWeight={600} sx={{ mb: 2 }}>
              What would you like to do next?
            </Typography>
            <Stack spacing={1.5}>
              <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', sm: 'repeat(2, minmax(0, 1fr))' }, gap: 1.5 }}>
                <Button
                  variant="contained"
                  onClick={() => handleSuccessAction('createLease')}
                  sx={{ minWidth: 0, textTransform: 'none', py: 1.25 }}
                >
                  Create lease for property
                </Button>
                <Button
                  variant="outlined"
                  onClick={() => handleSuccessAction('viewProperties')}
                  sx={{ minWidth: 0, textTransform: 'none', py: 1.25 }}
                >
                  View property
                </Button>
              </Box>
              <Button
                variant="text"
                fullWidth
                onClick={() => handleSuccessAction('addAnother')}
                sx={{ textTransform: 'none', py: 1.25 }}
              >
                Add another property
              </Button>
            </Stack>
          </Box>
        );

      default:
        return null;
    }
  };

  return (
    <FormikProvider value={formik}>
      <Box>
        {!onClose && (
          <PageBreadcrumbs
            items={[
              { label: 'Dashboard', path: '/landlord/dashboard' },
              { label: 'Add Property' }
            ]}
          />
        )}

        <MainCard
          border={!onClose}
          boxShadow={!onClose}
          sx={{
            mt: onClose ? 0 : 3,
            minHeight: '600px',
            display: 'flex',
            flexDirection: 'column',
            boxShadow: onClose ? 'none' : undefined,
            border: onClose ? 'none' : undefined,
            '&:hover': {
              boxShadow: onClose ? 'none' : undefined
            }
          }}
        >
          {/* Step Indicators */}
          {currentStep < STEPS.PROCESSING && currentStep !== STEPS.SUCCESS && (
            <Box sx={{ position: 'relative', mb: 4, mt: 2, width: '100%', px: 3, pt: 2, display: { xs: 'none', sm: 'none', md: 'block' } }}>
              <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', width: '100%' }}>
                <Box sx={{ maxWidth: 900, width: '100%' }}>
                  <Stepper 
                    activeStep={getStepperStep()} 
                    alternativeLabel
                    connector={<CustomStepConnector />}
                  >
                    {getPropertySteps().map((label, index) => (
                      <Step key={label} completed={index < getStepperStep()}>
                        <StepLabel>{label}</StepLabel>
                      </Step>
                    ))}
                  </Stepper>
                </Box>
              </Box>
            </Box>
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
                <Slide
                  direction={slideDirection}
                  in={true}
                  timeout={600}
                  mountOnEnter
                  unmountOnExit
                  key={currentStep}
                >
                  <Box>
                    {renderStep()}
                  </Box>
                </Slide>
              </Box>
            </Box>

            {/* Navigation Buttons */}
            {currentStep < STEPS.PROCESSING && currentStep !== STEPS.SUCCESS && currentStep !== STEPS.ADD_UNITS && currentStep !== STEPS.PROPERTY_TYPE_SELECTION && (
              <Box sx={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                mt: 'auto',
                pt: 4,
                pb: 2,
                px: 3,
                borderTop: `1px solid ${alpha(theme.palette.divider, 0.5)}`
              }}>
                <Button
                  onClick={handleBack}
                  disabled={currentStep === STEPS.PROPERTY_TYPE_SELECTION || processing}
                  startIcon={<ArrowLeftOutlined />}
                  sx={{ textTransform: 'none', px: 3 }}
                >
                  Back
                </Button>
                <Button
                  size="small"
                  variant="contained"
                  onClick={handleNext}
                  disabled={processing || (currentStep === STEPS.PROPERTY_TYPE_SELECTION && !values.propertyType)}
                  sx={{ textTransform: 'none', px: 4, py: 1 }}
                >
                  {currentStep === STEPS.SINGLE_UNIT_DETAILS ? 'Create Property' : currentStep === STEPS.IMAGE ? 'Continue' : 'Next'}
                </Button>
              </Box>
            )}
          </Box>
        </MainCard>
      </Box>

      {/* Stripe Connect Onboarding Dialog */}
      <StripeConnectOnboardingDialog
        open={showStripeOnboarding}
        onClose={() => setShowStripeOnboarding(false)}
        onComplete={handleStripeOnboardingComplete}
      />
    </FormikProvider>
  );
}
