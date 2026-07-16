import { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Box,
  Typography,
  Stack,
  Button,
  Grid,
  Stepper,
  Step,
  StepLabel,
  StepConnector,
  stepConnectorClasses,
  alpha,
  useTheme,
  styled,
  TextField,
  CircularProgress,
  MenuItem,
  Chip,
  Divider,
  InputAdornment,
  Tooltip
} from '@mui/material';
import {
  ArrowLeftOutlined,
  CheckCircleOutlined,
  RiseOutlined,
  RobotOutlined,
  ClockCircleOutlined
} from '@ant-design/icons';
import { NumericFormat } from 'react-number-format';
import MainCard from 'components/MainCard';
import PageBreadcrumbs from 'components/breadcrumbs/PageBreadcrumbs';
import PropertySelect from 'components/PropertySelect';
import UnitSelect from 'components/UnitSelect';
import { useSelector, useDispatch } from 'react-redux';
import { selectProperty } from 'store/property/property.selector';
import { setProperty } from 'store/property/property.action';
import { selectUnit } from 'store/unit/unit.selector';
import { setUnit } from 'store/unit/unit.action';
import { selectCurrentUser } from 'store/user/user.selector';
import { createListing, updateListing, publishListing, getListings } from 'store/listing/listing.action';
import { openSnackbar } from 'api/snackbar';
import { selectListings } from 'store/listing/listing.selector';
import useFetchProperties from 'hooks/useFetchProperties';
import ListingAmenitiesStep from 'components/listings/ListingAmenitiesStep';
import listingAIApi from 'api/listingAI';
import listingApi from 'api/listing';
import { getRentEstimate } from 'api/rentEstimate';
import { formatPhoneInput } from 'utils/formatters';

// ── Step constants ────────────────────────────────────────────────────────────
const STEP_PROPERTY            = 0;
const STEP_AMENITIES           = 1;
const STEP_MEDIA_MARKETING     = 2;
const STEP_LEASE               = 3;
const STEP_APP                 = 4;  // Application, Screening & Pet Policy (combined)
const STEP_CONTACT_SYNDICATION = 5;
const STEP_REVIEW              = 6;

const steps = [
  'Property & Details',
  'Amenities',
  'Media & Marketing',
  'Lease Details',
  'Application & Screening',
  'Contact & Syndication',
  'Review & Submit'
];

const CustomStepConnector = styled(StepConnector)(({ theme }) => ({
  [`&.${stepConnectorClasses.active}`]: {
    [`& .${stepConnectorClasses.line}`]: { borderColor: theme.palette.primary.main }
  },
  [`&.${stepConnectorClasses.completed}`]: {
    [`& .${stepConnectorClasses.line}`]: { borderColor: theme.palette.primary.main }
  },
  [`& .${stepConnectorClasses.line}`]: { borderTopWidth: 2, borderRadius: 1 }
}));

const leaseDurationOptions = [
  'Monthly', '2 Months', '3 Months', '4 Months', '5 Months', '6 Months',
  '7 Months', '8 Months', '9 Months', '10 Months', '11 Months', '12 Months',
  '13 Months', '14 Months', '15 Months', '16 Months', '17 Months', '18 Months',
  '19 Months', '20 Months', '21 Months', '22 Months', '23 Months', '24 Months',
  'Contact for details'
];

const DRAFT_STEP_KEY = (id) => `listing_step_${id}`;

// ── Helpers ───────────────────────────────────────────────────────────────────
const getValue = (source, ...keys) => {
  for (const key of keys) {
    if (source?.[key] !== undefined && source?.[key] !== null) return source[key];
  }
  return undefined;
};

const getListingStatusKey = (listingOrStatus) => {
  const raw = typeof listingOrStatus === 'object'
    ? getValue(listingOrStatus, 'status', 'Status')
    : listingOrStatus;
  if (raw === 0) return 'draft';
  if (raw === 1) return 'active';
  return String(raw ?? '').trim().toLowerCase();
};

const isDraftListing = (listing) => getListingStatusKey(listing) === 'draft';
const isBlockedListing = (listing) => ['active', 'published', 'inprogress', 'in_progress', 'in progress', 'pending'].includes(getListingStatusKey(listing));
const getListingPropertyId = (listing) => getValue(listing, 'propertyId', 'PropertyId');
const getListingUnitId = (listing) => getValue(listing, 'unitId', 'UnitId');

const getIdArray = (items) => (items || [])
  .map((item) => getValue(item, 'id', 'Id'))
  .filter(Boolean);

function buildFormDataFromDraft(draft) {
  const applicationFee = getValue(draft, 'applicationFee', 'ApplicationFee');
  const incomeVerificationCost = getValue(draft, 'incomeVerificationCost', 'IncomeVerificationCost');
  const dateAvailable = getValue(draft, 'dateAvailable', 'DateAvailable');

  return {
    propertyId: getValue(draft, 'propertyId', 'PropertyId') || null,
    unitId: getValue(draft, 'unitId', 'UnitId') || null,
    squareFeet: getValue(draft, 'squareFeet', 'SquareFeet') || '',
    monthlyRent: getValue(draft, 'monthlyRent', 'MonthlyRent') || '',
    securityDeposit: getValue(draft, 'securityDeposit', 'SecurityDeposit') || '',
    yearBuilt: getValue(draft, 'yearBuilt', 'YearBuilt') || '',
    dateAvailable: dateAvailable ? String(dateAvailable).split('T')[0] : '',
    minLeaseDuration: getValue(draft, 'minLeaseDuration', 'MinLeaseDuration') || '',
    maxLeaseDuration: getValue(draft, 'maxLeaseDuration', 'MaxLeaseDuration') || '',
    petsAllowed: getValue(draft, 'petsAllowed', 'PetsAllowed') || false,
    marketingDescription: getValue(draft, 'marketingDescription', 'MarketingDescription') || '',
    videoTourUrl: getValue(draft, 'videoTourUrl', 'VideoTourUrl') || '',
    acceptOnlineApplications: getValue(draft, 'acceptOnlineApplications', 'AcceptOnlineApplications') ?? true,
    applicationFeeRequired: getValue(draft, 'applicationFeeRequired', 'ApplicationFeeRequired') || false,
    applicationFee: applicationFee != null ? String(applicationFee) : '0.00',
    requireScreening: getValue(draft, 'requireScreening', 'RequireScreening') ?? true,
    screeningType: getValue(draft, 'screeningType', 'ScreeningType') || 'Essential',
    requireIncomeVerification: getValue(draft, 'requireIncomeVerification', 'RequireIncomeVerification') || false,
    incomeVerificationCost: incomeVerificationCost != null ? String(incomeVerificationCost) : '12.00',
    listingContactId: getValue(draft, 'listingContactId', 'ListingContactId') || null,
    listingContactName: getValue(draft, 'listingContactName', 'ListingContactName') || '',
    listingContactPhone: getValue(draft, 'listingContactPhone', 'ListingContactPhone') || '',
    listingContactEmail: getValue(draft, 'listingContactEmail', 'ListingContactEmail') || '',
    syndicateToListingWebsite: getValue(draft, 'syndicateToListingWebsite', 'SyndicateToListingWebsite') ?? true,
    syndicateToFreeSites: getValue(draft, 'syndicateToFreeSites', 'SyndicateToFreeSites') || false,
    syndicateToPremiumSites: getValue(draft, 'syndicateToPremiumSites', 'SyndicateToPremiumSites') || false,
    basicAmenityIds: getIdArray(getValue(draft, 'basicAmenities', 'BasicAmenities')),
    defaultAmenityIds: getIdArray(getValue(draft, 'propertyAmenities', 'PropertyAmenities')),
    customAmenityIds: [],
    defaultFeatureIds: getIdArray(getValue(draft, 'propertyFeatures', 'PropertyFeatures')),
    customFeatureIds: []
  };
}

const EMPTY_FORM = {
  propertyId: null, unitId: null, squareFeet: '', monthlyRent: '', securityDeposit: '',
  yearBuilt: '', dateAvailable: '', minLeaseDuration: '', maxLeaseDuration: '',
  petsAllowed: false, marketingDescription: '', videoTourUrl: '',
  acceptOnlineApplications: true, applicationFeeRequired: false, applicationFee: '0.00',
  requireScreening: true, screeningType: 'Essential', requireIncomeVerification: false,
  incomeVerificationCost: '12.00', listingContactId: null, listingContactName: '',
  listingContactPhone: '', listingContactEmail: '', syndicateToListingWebsite: true,
  syndicateToFreeSites: false, syndicateToPremiumSites: false,
  basicAmenityIds: [], defaultAmenityIds: [], customAmenityIds: [],
  defaultFeatureIds: [], customFeatureIds: []
};

// ─────────────────────────────────────────────────────────────────────────────

export default function ListingAddWorkflow({ onClose, draftListing = null } = {}) {
  const theme = useTheme();
  const navigate = useNavigate();
  const dispatch = useDispatch();
  useFetchProperties();
  const selectedProperty = useSelector(selectProperty);
  const selectedUnit = useSelector(selectUnit);
  const currentUser = useSelector(selectCurrentUser);
  const listings = useSelector(selectListings);

  useEffect(() => {
    dispatch(getListings());
  }, [dispatch]);

  const draftListingByPropertyId = useMemo(() => {
    const map = new Map();
    (listings || [])
      .filter(isDraftListing)
      .forEach((listing) => {
        const propertyId = getListingPropertyId(listing);
        if (propertyId) map.set(String(propertyId), listing);
      });
    return map;
  }, [listings]);

  const unavailablePropertyIds = useMemo(() => new Set(
    (listings || [])
      .filter((listing) => String(getValue(listing, 'id', 'Id')) !== String(draftListing?.id))
      .filter(isBlockedListing)
      .map(getListingPropertyId)
      .filter(Boolean)
      .map(String)
  ), [listings, draftListing?.id]);

  const [activeStep, setActiveStep] = useState(0);
  const [isSavingStep, setIsSavingStep] = useState(false);
  const [isComplete, setIsComplete] = useState(false);
  const [draftListingId, setDraftListingId] = useState(draftListing?.id || null);

  const [formData, setFormData] = useState(EMPTY_FORM);

  // Media
  const [coverPhoto, setCoverPhoto] = useState(null);
  const [galleryPhotos, setGalleryPhotos] = useState([]);
  const [existingImages, setExistingImages] = useState([]);

  const [coverPhotoPreviewUrl, setCoverPhotoPreviewUrl] = useState(null);
  const [galleryPhotoPreviewUrls, setGalleryPhotoPreviewUrls] = useState([]);

  useEffect(() => {
    if (!coverPhoto) {
      setCoverPhotoPreviewUrl(null);
      return undefined;
    }

    const previewUrl = URL.createObjectURL(coverPhoto);
    setCoverPhotoPreviewUrl(previewUrl);

    return () => URL.revokeObjectURL(previewUrl);
  }, [coverPhoto]);

  useEffect(() => {
    if (galleryPhotos.length === 0) {
      setGalleryPhotoPreviewUrls([]);
      return undefined;
    }

    const previews = galleryPhotos.map((photo) => ({ file: photo, url: URL.createObjectURL(photo) }));
    setGalleryPhotoPreviewUrls(previews);

    return () => previews.forEach((preview) => URL.revokeObjectURL(preview.url));
  }, [galleryPhotos]);

  // Marketing description AI
  const [isGeneratingDescription, setIsGeneratingDescription] = useState(false);

  // Compact rent estimate for lease details step
  const [rentEstimate, setRentEstimate] = useState(null);
  const [rentEstimateLoading, setRentEstimateLoading] = useState(false);

  // ── Initialise from draft ────────────────────────────────────────────────
  useEffect(() => {
    if (draftListing) {
      setDraftListingId(draftListing.id);
      setFormData(buildFormDataFromDraft(draftListing));
      setExistingImages(draftListing.images || []);
      const saved = localStorage.getItem(DRAFT_STEP_KEY(draftListing.id));
      setActiveStep(saved ? Math.min(parseInt(saved), steps.length - 1) : 1);
    }
  }, [draftListing]);

  // ── Pre-fill contact from currentUser (new listings only, not drafts) ────
  useEffect(() => {
    if (!draftListing && !draftListingId && currentUser) {
      const first = currentUser.Firstname ?? currentUser.firstname ?? '';
      const last  = currentUser.Lastname  ?? currentUser.lastname  ?? '';
      const name  = [first, last].filter(Boolean).join(' ') || (currentUser.Name ?? currentUser.name ?? '');
      const email = currentUser.Email ?? currentUser.email ?? '';
      const phone = currentUser.PhoneNumber ?? currentUser.phoneNumber ?? '';
      setFormData(prev => ({
        ...prev,
        listingContactName:  name.trim()  || prev.listingContactName,
        listingContactEmail: email.trim() || prev.listingContactEmail,
        listingContactPhone: phone.trim() || prev.listingContactPhone
      }));
    }
  }, [currentUser, draftListing, draftListingId]);

  // ── Load a saved draft when its property is selected from Create Listing ───
  const loadDraftForProperty = async (property, draft) => {
    dispatch(setProperty(property));

    const draftId = getValue(draft, 'id', 'Id');
    let hydratedDraft = draft;

    if (draftId) {
      try {
        const response = await listingApi.getListingById(draftId);
        hydratedDraft = response?.data?.data ?? response?.data ?? response ?? draft;
      } catch {
        hydratedDraft = draft;
      }
    }

    const unitId = getListingUnitId(hydratedDraft);
    const draftUnit = unitId
      ? property?.units?.find((unit) => String(unit.id) === String(unitId))
      : null;

    dispatch(setUnit(draftUnit || null));
    setDraftListingId(draftId || null);
    setFormData(buildFormDataFromDraft(hydratedDraft));
    setExistingImages(getValue(hydratedDraft, 'images', 'Images') || []);
    setCoverPhoto(null);
    setGalleryPhotos([]);
    setRentEstimate(null);

    const saved = draftId ? localStorage.getItem(DRAFT_STEP_KEY(draftId)) : null;
    setActiveStep(saved ? Math.min(parseInt(saved), steps.length - 1) : STEP_PROPERTY);

    openSnackbar({ open: true, message: 'Draft listing loaded', variant: 'alert', alert: { color: 'info' } });
  };

  const handlePropertyChange = async (property) => {
    if (!property) {
      dispatch(setProperty(null));
      dispatch(setUnit(null));
      setDraftListingId(null);
      setFormData(EMPTY_FORM);
      setExistingImages([]);
      setCoverPhoto(null);
      setGalleryPhotos([]);
      return;
    }

    const draft = draftListingByPropertyId.get(String(property.id));
    if (draft) {
      await loadDraftForProperty(property, draft);
      return;
    }

    dispatch(setProperty(property));
    dispatch(setUnit(null));
    setDraftListingId(null);
    setFormData(prev => ({
      ...EMPTY_FORM,
      listingContactName: prev.listingContactName,
      listingContactEmail: prev.listingContactEmail,
      listingContactPhone: prev.listingContactPhone,
      propertyId: property.id,
      squareFeet: property?.units?.[0]?.squareFeet || property?.squareFeet || '',
      yearBuilt: property?.yearBuilt || ''
    }));
    setExistingImages([]);
    setCoverPhoto(null);
    setGalleryPhotos([]);
    setRentEstimate(null);
  };

  // ── Pre-populate sqft / yearBuilt when property selected on step 0 ────────
  useEffect(() => {
    if (selectedProperty && activeStep === STEP_PROPERTY && !draftListingId) {
      const sqft = selectedUnit?.squareFeet || selectedProperty?.units?.[0]?.squareFeet || '';
      const year = selectedProperty.yearBuilt || '';
      setFormData(prev => ({
        ...prev,
        squareFeet: sqft || prev.squareFeet,
        yearBuilt: year || prev.yearBuilt
      }));
    }
  }, [selectedProperty, selectedUnit]);

  // ── Navigation ────────────────────────────────────────────────────────────
  const handleBack = () => {
    if (activeStep > 0) {
      setActiveStep(activeStep - 1);
    } else if (onClose) {
      onClose();
    } else {
      navigate('/landlord/listings');
    }
  };

  // ── Validation ────────────────────────────────────────────────────────────
  const validateStep = (step) => {
    switch (step) {
      case STEP_PROPERTY:
        if (!selectedProperty?.id && !formData.propertyId) {
          openSnackbar({ open: true, message: 'Please select a property', variant: 'alert', alert: { color: 'warning' } });
          return false;
        }
        if (selectedProperty?.id && unavailablePropertyIds.has(String(selectedProperty.id))) {
          openSnackbar({ open: true, message: 'That property already has an active, in-progress, or pending listing', variant: 'alert', alert: { color: 'warning' } });
          return false;
        }
        return true;
      case STEP_MEDIA_MARKETING:
        if (!coverPhoto && existingImages.length === 0) {
          openSnackbar({ open: true, message: 'Please upload a cover photo', variant: 'alert', alert: { color: 'warning' } });
          return false;
        }
        if (!formData.marketingDescription.trim()) {
          openSnackbar({ open: true, message: 'Please enter a marketing description', variant: 'alert', alert: { color: 'warning' } });
          return false;
        }
        return true;
      case STEP_LEASE:
        if (!formData.monthlyRent) {
          openSnackbar({ open: true, message: 'Please enter monthly rent', variant: 'alert', alert: { color: 'warning' } });
          return false;
        }
        return true;
      default:
        return true;
    }
  };

  // ── Build per-step update payload ─────────────────────────────────────────
  const buildStepPayload = (step) => {
    switch (step) {
      case STEP_AMENITIES:
        return {
          basicAmenityIds: formData.basicAmenityIds,
          defaultAmenityIds: formData.defaultAmenityIds,
          customAmenityIds: formData.customAmenityIds,
          defaultFeatureIds: formData.defaultFeatureIds,
          customFeatureIds: formData.customFeatureIds
        };
      case STEP_MEDIA_MARKETING:
        return { marketingDescription: formData.marketingDescription, videoTourUrl: formData.videoTourUrl || null };
      case STEP_LEASE:
        return {
          monthlyRent: parseFloat(formData.monthlyRent),
          securityDeposit: formData.securityDeposit ? parseFloat(formData.securityDeposit) : null,
          dateAvailable: formData.dateAvailable || null,
          minLeaseDuration: formData.minLeaseDuration || null,
          maxLeaseDuration: formData.maxLeaseDuration || null
        };
      case STEP_APP:
        return {
          petsAllowed: formData.petsAllowed,
          acceptOnlineApplications: formData.acceptOnlineApplications,
          applicationFeeRequired: formData.applicationFeeRequired,
          applicationFee: formData.applicationFeeRequired ? parseFloat(formData.applicationFee) : 0,
          requireScreening: formData.requireScreening,
          screeningType: formData.screeningType,
          requireIncomeVerification: formData.requireIncomeVerification,
          incomeVerificationCost: formData.requireIncomeVerification ? parseFloat(formData.incomeVerificationCost) : 0
        };
      case STEP_CONTACT_SYNDICATION:
        return {
          listingContactName: formData.listingContactName || null,
          listingContactPhone: formData.listingContactPhone || null,
          listingContactEmail: formData.listingContactEmail || null,
          syndicateToListingWebsite: formData.syndicateToListingWebsite,
          syndicateToFreeSites: formData.syndicateToFreeSites,
          syndicateToPremiumSites: formData.syndicateToPremiumSites
        };
      default:
        return {};
    }
  };

  // ── Next / Save ───────────────────────────────────────────────────────────
  const handleNext = async () => {
    if (!validateStep(activeStep)) return;

    setIsSavingStep(true);
    try {
      let currentDraftId = draftListingId;

      if (activeStep === STEP_PROPERTY) {
        if (!currentDraftId) {
          // Create draft listing
          const payload = {
            propertyId: selectedProperty.id,
            unitId: selectedUnit?.id || null,
            squareFeet: formData.squareFeet ? parseInt(formData.squareFeet) : null,
            yearBuilt: formData.yearBuilt ? parseInt(formData.yearBuilt) : null
          };
          const result = await dispatch(createListing(payload, []));
          if (!result?.success) throw new Error(result?.message || 'Failed to save');
          currentDraftId = result.data.id;
          setDraftListingId(currentDraftId);
        } else {
          // Update property details portion (sqft, yearBuilt can change)
          await dispatch(updateListing(currentDraftId, {
            squareFeet: formData.squareFeet ? parseInt(formData.squareFeet) : null,
            yearBuilt: formData.yearBuilt ? parseInt(formData.yearBuilt) : null
          }));
        }
      } else if (activeStep === STEP_MEDIA_MARKETING) {
        // Upload new images if any and save marketing details in the same step
        if (currentDraftId && (coverPhoto || galleryPhotos.length > 0)) {
          const files = [];
          if (coverPhoto) files.push(coverPhoto);
          files.push(...galleryPhotos);
          await listingApi.uploadListingImages(currentDraftId, files);
        }
        if (currentDraftId) {
          await dispatch(updateListing(currentDraftId, buildStepPayload(activeStep)));
        }
      } else if (currentDraftId) {
        const payload = buildStepPayload(activeStep);
        if (Object.keys(payload).length > 0) {
          await dispatch(updateListing(currentDraftId, payload));
        }
      }

      // Save step progress
      if (currentDraftId) {
        localStorage.setItem(DRAFT_STEP_KEY(currentDraftId), String(activeStep + 1));
      }

      setActiveStep(prev => prev + 1);
    } catch (error) {
      openSnackbar({
        open: true,
        message: error?.response?.data?.message || error?.message || 'Failed to save',
        variant: 'alert',
        alert: { color: 'error' }
      });
    } finally {
      setIsSavingStep(false);
    }
  };

  // ── Submit (publish) ──────────────────────────────────────────────────────
  const handleSubmit = async () => {
    if (!draftListingId) return;
    setIsSavingStep(true);
    try {
      const result = await dispatch(publishListing(draftListingId));
      if (result?.success) {
        localStorage.removeItem(DRAFT_STEP_KEY(draftListingId));
        setIsComplete(true);
        openSnackbar({ open: true, message: 'Listing published successfully', variant: 'alert', alert: { color: 'success' } });
      } else {
        throw new Error(result?.message || 'Failed to publish listing');
      }
    } catch (error) {
      openSnackbar({
        open: true,
        message: error?.response?.data?.message || error?.message || 'Failed to publish listing',
        variant: 'alert',
        alert: { color: 'error' }
      });
    } finally {
      setIsSavingStep(false);
    }
  };

  // ── AI description generation ─────────────────────────────────────────────
  const handleGenerateDescription = async (event) => {
    event?.preventDefault?.();
    event?.stopPropagation?.();
    setIsGeneratingDescription(true);
    try {
      const response = await listingAIApi.generateMarketingDescription({
        propertyName: selectedProperty?.name || '',
        propertyAddress: selectedProperty
          ? `${selectedProperty.streetAddress}, ${selectedProperty.city}, ${selectedProperty.state}`
          : '',
        unitName: selectedUnit?.name || null,
        squareFeet: formData.squareFeet ? parseInt(formData.squareFeet) : null,
        yearBuilt: formData.yearBuilt ? parseInt(formData.yearBuilt) : null,
        bedrooms: selectedUnit?.bedrooms || null,
        baths: selectedUnit?.baths || null,
        monthlyRent: parseFloat(formData.monthlyRent) || 0,
        basicAmenities: [],
        propertyAmenities: [],
        propertyFeatures: []
      });
      if (response.success) {
        setFormData(prev => ({ ...prev, marketingDescription: response.data }));
        openSnackbar({ open: true, message: 'Description generated', variant: 'alert', alert: { color: 'success' } });
      } else {
        const errorDetails = response?.errors?.details || response?.Errors?.Details;
        const errorText = response?.errors?.message || response?.Errors?.Message;
        openSnackbar({
          open: true,
          message: errorDetails || errorText || response?.message || response?.Message || 'Failed to generate description',
          variant: 'alert',
          alert: { color: 'error' }
        });
      }
    } catch (error) {
      const errorDetails = error?.errors?.details || error?.Errors?.Details;
      const errorText = error?.errors?.message || error?.Errors?.Message;
      const errorMessage =
        errorDetails ||
        errorText ||
        error?.message ||
        error?.Message ||
        'Failed to generate description';
      openSnackbar({ open: true, message: errorMessage, variant: 'alert', alert: { color: 'error' } });
    } finally {
      setIsGeneratingDescription(false);
    }
  };

  // ── Compact rent estimate ─────────────────────────────────────────────────
  const handleGetRentEstimate = async () => {
    const propId = formData.propertyId || selectedProperty?.id;
    const unitId = formData.unitId || selectedUnit?.id || null;
    if (!propId) return;
    setRentEstimateLoading(true);
    try {
      const data = await getRentEstimate(propId, unitId);
      setRentEstimate(data);
    } catch {
      openSnackbar({ open: true, message: 'Could not fetch rent estimate', variant: 'alert', alert: { color: 'warning' } });
    } finally {
      setRentEstimateLoading(false);
    }
  };

  // ── Reset ─────────────────────────────────────────────────────────────────
  const handleReset = () => {
    setIsComplete(false);
    setDraftListingId(null);
    setActiveStep(0);
    setFormData(EMPTY_FORM);
    setCoverPhoto(null);
    setGalleryPhotos([]);
    setExistingImages([]);
    setRentEstimate(null);
  };

  // ── Shared nav buttons ────────────────────────────────────────────────────
  const NavButtons = ({ nextLabel = 'Next' }) => (
    <Box sx={{ display: 'flex', justifyContent: 'space-between', mt: 4 }}>
      <Button onClick={handleBack} sx={{ textTransform: 'none' }} disabled={isSavingStep}>
        Back
      </Button>
      <Button
        variant="contained"
        onClick={handleNext}
        disabled={isSavingStep}
        startIcon={isSavingStep ? <CircularProgress size={16} /> : null}
        sx={{ textTransform: 'none', minWidth: 120 }}
      >
        {isSavingStep ? 'Saving…' : nextLabel}
      </Button>
    </Box>
  );

  // ─────────────────────────────────────────────────────────────────────────
  return (
    <Box>
      {!onClose && (
        <PageBreadcrumbs links={[{ title: 'Listings', to: '/landlord/listings' }, { title: 'Create Listing' }]} />
      )}

      {/* Back + Stepper */}
      <Box sx={{ position: 'relative', mb: 4, mt: 2, width: '100%' }}>
        <Button
          startIcon={<ArrowLeftOutlined />}
          onClick={handleBack}
          disabled={isSavingStep}
          sx={{
            color: 'text.secondary', textTransform: 'none', minWidth: 'auto',
            position: 'absolute', left: 0, top: '50%', transform: 'translateY(-50%)',
            '&:hover': { bgcolor: alpha(theme.palette.primary.main, 0.08) }
          }}
        >
          BACK
        </Button>
        <Box sx={{ display: { xs: 'none', md: 'flex' }, justifyContent: 'center', width: '100%' }}>
          <Box sx={{ maxWidth: 900, width: '100%' }}>
            <Stepper activeStep={activeStep} alternativeLabel connector={<CustomStepConnector />}>
              {steps.map((label, index) => (
                <Step key={label} completed={index < activeStep}>
                  <StepLabel>{label}</StepLabel>
                </Step>
              ))}
            </Stepper>
          </Box>
        </Box>
      </Box>

      {/* Step Content */}
      <MainCard
        sx={{
          maxWidth: onClose ? '100%' : 900,
          mx: 'auto',
          bgcolor: onClose ? 'background.paper' : (t) => alpha(t.palette.background.paper, 0.6),
          boxShadow: onClose ? 'none' : (t) => `0 0 20px ${alpha(t.palette.primary.main, 0.15)}`,
          border: onClose ? 'none' : undefined
        }}
      >
        {/* ── Step 0: Property & Details (combined) ── */}
        {activeStep === STEP_PROPERTY && (
          <Box sx={{ p: 4 }}>
            <Typography variant="h4" fontWeight={700} sx={{ mb: 1, textAlign: 'center' }}>
              Property & Details
            </Typography>
            <Typography variant="body2" color="text.secondary" sx={{ mb: 4, textAlign: 'center' }}>
              Choose the property and confirm its key details for this listing.
            </Typography>

            <Stack spacing={3} sx={{ maxWidth: 600, mx: 'auto' }}>
              {/* Property select */}
              <Box>
                <Typography variant="subtitle2" fontWeight={600} sx={{ mb: 1 }}>Property *</Typography>
                <PropertySelect
                  width="100%"
                  disableAllOption
                  onPropertyChange={handlePropertyChange}
                  disabledPropertyIds={unavailablePropertyIds}
                  disabledPropertyReason="Active, in-progress, or pending listing already exists"
                />
              </Box>

              {/* Unit select (multi-unit only) */}
              {selectedProperty && (
                selectedProperty.propertyType?.toLowerCase() === 'multiunit' ||
                selectedProperty.propertyType?.toLowerCase() === 'multifamily'
              ) && (
                <Box>
                  <Typography variant="subtitle2" fontWeight={600} sx={{ mb: 1 }}>Unit</Typography>
                  <UnitSelect width="100%" />
                </Box>
              )}

              {/* Property details */}
              {selectedProperty && (
                <>
                  <Divider />
                  <Typography variant="overline" color="text.secondary" fontWeight={700} sx={{ letterSpacing: '0.08em' }}>
                    Property Details
                  </Typography>
                  <Grid container spacing={2}>
                    <Grid size={{ xs: 12, sm: 6 }}>
                      <TextField
                        fullWidth
                        label="Square Feet"
                        type="number"
                        value={formData.squareFeet}
                        onChange={(e) => setFormData(prev => ({ ...prev, squareFeet: e.target.value }))}
                        slotProps={{ input: { endAdornment: <InputAdornment position="end">sq ft</InputAdornment> } }}
                      />
                    </Grid>
                    <Grid size={{ xs: 12, sm: 6 }}>
                      <TextField
                        fullWidth
                        label="Year Built"
                        type="number"
                        value={formData.yearBuilt}
                        onChange={(e) => setFormData(prev => ({ ...prev, yearBuilt: e.target.value }))}
                      />
                    </Grid>
                  </Grid>
                </>
              )}
            </Stack>

            <Box sx={{ display: 'flex', justifyContent: 'flex-end', mt: 4 }}>
              <Button
                variant="contained"
                onClick={handleNext}
                disabled={isSavingStep}
                startIcon={isSavingStep ? <CircularProgress size={16} /> : null}
                sx={{ textTransform: 'none', minWidth: 120 }}
              >
                {isSavingStep ? 'Saving…' : 'Next'}
              </Button>
            </Box>
          </Box>
        )}

        {/* ── Step 1: Amenities ── */}
        {activeStep === STEP_AMENITIES && (
          <>
            <ListingAmenitiesStep formData={formData} setFormData={setFormData} />
            <Box sx={{ display: 'flex', justifyContent: 'space-between', mt: 4, px: 4, pb: 4 }}>
              <Button onClick={handleBack} sx={{ textTransform: 'none' }} disabled={isSavingStep}>Back</Button>
              <Button
                variant="contained"
                onClick={handleNext}
                disabled={isSavingStep}
                startIcon={isSavingStep ? <CircularProgress size={16} /> : null}
                sx={{ textTransform: 'none', minWidth: 120 }}
              >
                {isSavingStep ? 'Saving…' : 'Next'}
              </Button>
            </Box>
          </>
        )}

        {/* ── Step 2: Media & Marketing ── */}
        {activeStep === STEP_MEDIA_MARKETING && (
          <Box sx={{ p: 4 }}>
            <Typography variant="h4" fontWeight={700} sx={{ mb: 1, textAlign: 'center' }}>Media & Marketing</Typography>
            <Typography variant="body2" color="text.secondary" sx={{ mb: 4, textAlign: 'center' }}>
              Add photos, a video tour, and the description tenants will see.
            </Typography>

            <Stack spacing={3} sx={{ maxWidth: 600, mx: 'auto' }}>
              {/* Existing images from draft */}
              {existingImages.length > 0 && (
                <Box>
                  <Typography variant="subtitle2" fontWeight={600} sx={{ mb: 1 }}>
                    Existing Photos ({existingImages.length})
                  </Typography>
                  <Stack direction="row" flexWrap="wrap" gap={1}>
                    {existingImages.slice(0, 5).map((img, i) => (
                      <Box
                        key={img.id ?? i}
                        component="img"
                        src={img.blobUrl ?? img.BlobUrl}
                        alt={`photo ${i + 1}`}
                        sx={{ width: 80, height: 60, objectFit: 'cover', borderRadius: 1 }}
                      />
                    ))}
                    {existingImages.length > 5 && (
                      <Box sx={{ width: 80, height: 60, borderRadius: 1, bgcolor: 'action.hover', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                        <Typography variant="caption">+{existingImages.length - 5}</Typography>
                      </Box>
                    )}
                  </Stack>
                </Box>
              )}

              {/* Cover photo upload */}
              <Box>
                <Typography variant="subtitle2" fontWeight={600} sx={{ mb: 1 }}>
                  {existingImages.length > 0 ? 'Add Cover Photo' : 'Cover Photo *'}
                </Typography>
                <Box
                  sx={{
                    border: '2px dashed', borderColor: 'divider', borderRadius: 2, p: 4,
                    textAlign: 'center', cursor: 'pointer', '&:hover': { borderColor: 'primary.main' }
                  }}
                  onClick={() => document.getElementById('cover-photo-input')?.click()}
                >
                  <input
                    id="cover-photo-input" type="file" accept="image/*" style={{ display: 'none' }}
                    onChange={(e) => { if (e.target.files[0]) setCoverPhoto(e.target.files[0]); }}
                  />
                  {coverPhoto && coverPhotoPreviewUrl ? (
                    <Stack spacing={1.5} alignItems="center">
                      <Box
                        component="img"
                        src={coverPhotoPreviewUrl}
                        alt="Selected cover photo preview"
                        sx={{
                          width: '100%',
                          maxWidth: 360,
                          height: 200,
                          objectFit: 'cover',
                          borderRadius: 1.5,
                          border: '1px solid',
                          borderColor: 'divider'
                        }}
                      />
                      <Typography fontWeight={600}>{coverPhoto.name}</Typography>
                      <Typography variant="caption" color="text.secondary">Click to replace cover photo</Typography>
                    </Stack>
                  ) : (
                    <Typography color="text.secondary">Click to upload cover photo</Typography>
                  )}
                </Box>
              </Box>

              {/* Gallery upload */}
              <Box>
                <Typography variant="subtitle2" fontWeight={600} sx={{ mb: 1 }}>Photo Gallery</Typography>
                <Box
                  sx={{
                    border: '2px dashed', borderColor: 'divider', borderRadius: 2, p: 4,
                    textAlign: 'center', cursor: 'pointer', '&:hover': { borderColor: 'primary.main' }
                  }}
                  onClick={() => document.getElementById('gallery-input')?.click()}
                >
                  <input
                    id="gallery-input" type="file" accept="image/*" multiple style={{ display: 'none' }}
                    onChange={(e) => { if (e.target.files) setGalleryPhotos(Array.from(e.target.files)); }}
                  />
                  <Typography color="text.secondary">
                    {galleryPhotos.length > 0 ? 'Click to replace selected photos' : 'Click to upload photos'}
                  </Typography>
                  {galleryPhotoPreviewUrls.length > 0 && (
                    <>
                      <Typography sx={{ mt: 1 }}>{galleryPhotoPreviewUrls.length} photo(s) selected</Typography>
                      <Grid container spacing={1.25} sx={{ mt: 2 }}>
                        {galleryPhotoPreviewUrls.map((preview, index) => (
                          <Grid key={`${preview.file.name}-${preview.file.lastModified}-${index}`} size={{ xs: 6, sm: 4 }}>
                            <Box
                              component="img"
                              src={preview.url}
                              alt={`Selected gallery photo ${index + 1}`}
                              sx={{
                                width: '100%',
                                height: 96,
                                objectFit: 'cover',
                                borderRadius: 1,
                                border: '1px solid',
                                borderColor: 'divider'
                              }}
                            />
                          </Grid>
                        ))}
                      </Grid>
                    </>
                  )}
                </Box>
              </Box>

              <TextField
                fullWidth label="Video Tour URL (Optional)"
                placeholder="https://www.youtube.com/..."
                value={formData.videoTourUrl}
                onChange={(e) => setFormData(prev => ({ ...prev, videoTourUrl: e.target.value }))}
              />

              <Divider />

              <TextField
                fullWidth multiline rows={8}
                label="Marketing Description *"
                placeholder="Add the marketing description here."
                value={formData.marketingDescription}
                onChange={(e) => setFormData(prev => ({ ...prev, marketingDescription: e.target.value }))}
                helperText={`${formData.marketingDescription.length} / 4000 characters`}
                slotProps={{ htmlInput: { maxLength: 4000 } }}
                sx={{ '& .MuiOutlinedInput-root': {  } }}
              />
              <Button
                type="button"
                variant="outlined"
                onClick={handleGenerateDescription}
                disabled={isGeneratingDescription}
                startIcon={isGeneratingDescription ? <CircularProgress size={16} /> : <RobotOutlined />}
                sx={{ textTransform: 'none', alignSelf: 'flex-start' }}
              >
                {isGeneratingDescription ? 'Generating…' : 'Get help with writing!'}
              </Button>
            </Stack>

            <NavButtons />
          </Box>
        )}

        {/* ── Step 3: Lease Details ── */}
        {activeStep === STEP_LEASE && (
          <Box sx={{ p: 4 }}>
            <Typography variant="h4" fontWeight={700} sx={{ mb: 1, textAlign: 'center' }}>
              Lease Details
            </Typography>
            <Typography variant="body2" color="text.secondary" sx={{ mb: 4, textAlign: 'center' }}>
              Set the lease terms and pricing for this listing.
            </Typography>

            <Grid container spacing={3} sx={{ maxWidth: 600, mx: 'auto' }}>
              {/* Monthly rent */}
              <Grid size={12}>
                <NumericFormat
                  customInput={TextField}
                  fullWidth
                  label="Monthly Rent *"
                  value={formData.monthlyRent}
                  onValueChange={(values) => setFormData(prev => ({ ...prev, monthlyRent: values.floatValue || '' }))}
                  thousandSeparator prefix="$" decimalScale={2} fixedDecimalScale allowNegative={false}
                />
              </Grid>

              {/* Compact rent estimate */}
              <Grid size={12}>
                <Box
                  sx={{
                    p: 2, borderRadius: 1.5,
                    border: `1px solid ${alpha(theme.palette.primary.main, 0.18)}`,
                    bgcolor: alpha(theme.palette.primary.main, 0.02)
                  }}
                >
                  <Stack direction="row" alignItems="center" justifyContent="space-between" sx={{ mb: rentEstimate ? 1.5 : 0 }}>
                    <Stack direction="row" spacing={1} alignItems="center">
                      <RiseOutlined style={{ color: theme.palette.primary.main, fontSize: 14 }} />
                      <Typography variant="body2" fontWeight={600} color="primary.main">
                        Rent Estimate
                      </Typography>
                    </Stack>
                    {!rentEstimate && (
                      <Button
                        size="small" variant="outlined"
                        onClick={handleGetRentEstimate}
                        disabled={rentEstimateLoading || !draftListingId}
                        startIcon={rentEstimateLoading ? <CircularProgress size={12} /> : null}
                        sx={{ textTransform: 'none', fontSize: '0.75rem', py: 0.5 }}
                      >
                        {rentEstimateLoading ? 'Fetching…' : 'Get Estimate'}
                      </Button>
                    )}
                  </Stack>

                  {rentEstimate && (
                    <Stack direction="row" spacing={2} alignItems="flex-end" flexWrap="wrap">
                      <Box>
                        <Typography variant="h5" fontWeight={700} color="primary.main" sx={{ lineHeight: 1.2 }}>
                          ${rentEstimate.rentEstimate?.toLocaleString()}/mo
                        </Typography>
                        <Typography variant="caption" color="text.secondary">
                          Range: ${rentEstimate.rentRangeLow?.toLocaleString()} – ${rentEstimate.rentRangeHigh?.toLocaleString()}
                        </Typography>
                      </Box>
                      <Button
                        size="small" variant="text"
                        onClick={() => setFormData(prev => ({ ...prev, monthlyRent: rentEstimate.rentEstimate }))}
                        sx={{ textTransform: 'none', fontSize: '0.75rem', mb: 0.25 }}
                      >
                        Use this amount
                      </Button>
                    </Stack>
                  )}
                </Box>
              </Grid>

              {/* Security deposit */}
              <Grid size={12}>
                <NumericFormat
                  customInput={TextField}
                  fullWidth label="Security Deposit"
                  value={formData.securityDeposit}
                  onValueChange={(values) => setFormData(prev => ({ ...prev, securityDeposit: values.floatValue || '' }))}
                  thousandSeparator prefix="$" decimalScale={2} fixedDecimalScale allowNegative={false}
                />
              </Grid>

              {/* Date available */}
              <Grid size={12}>
                <TextField
                  fullWidth label="Date Available" type="date"
                  value={formData.dateAvailable}
                  onChange={(e) => setFormData(prev => ({ ...prev, dateAvailable: e.target.value }))}
                  slotProps={{ inputLabel: { shrink: true } }}
                />
              </Grid>

              {/* Lease duration */}
              <Grid size={{ xs: 12, md: 6 }}>
                <TextField
                  fullWidth select label="Min Lease Duration"
                  value={formData.minLeaseDuration}
                  onChange={(e) => setFormData(prev => ({ ...prev, minLeaseDuration: e.target.value }))}
                >
                  {leaseDurationOptions.map((o) => <MenuItem key={o} value={o}>{o}</MenuItem>)}
                </TextField>
              </Grid>
              <Grid size={{ xs: 12, md: 6 }}>
                <TextField
                  fullWidth select label="Max Lease Duration"
                  value={formData.maxLeaseDuration}
                  onChange={(e) => {
                    const max = e.target.value;
                    if (max && formData.minLeaseDuration) {
                      const minIdx = leaseDurationOptions.indexOf(formData.minLeaseDuration);
                      const maxIdx = leaseDurationOptions.indexOf(max);
                      if (maxIdx <= minIdx && max !== 'Contact for details') {
                        openSnackbar({ open: true, message: 'Max duration must be greater than min', variant: 'alert', alert: { color: 'warning' } });
                        return;
                      }
                    }
                    setFormData(prev => ({ ...prev, maxLeaseDuration: max }));
                  }}
                >
                  {leaseDurationOptions.map((o) => <MenuItem key={o} value={o}>{o}</MenuItem>)}
                </TextField>
              </Grid>
            </Grid>

            <NavButtons />
          </Box>
        )}

        {/* ── Step 4: Application, Screening & Pet Policy (combined) ── */}
        {activeStep === STEP_APP && (
          <Box sx={{ p: 4 }}>
            <Typography variant="h4" fontWeight={700} sx={{ mb: 1, textAlign: 'center' }}>
              Application & Screening
            </Typography>
            <Typography variant="body2" color="text.secondary" sx={{ mb: 4, textAlign: 'center' }}>
              Configure how applicants apply, screening requirements, and pet policy.
            </Typography>

            <Stack spacing={3} sx={{ maxWidth: 600, mx: 'auto' }}>
              {/* Pet Policy */}
              <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <Typography variant="subtitle2" fontWeight={600}>Pets allowed</Typography>
                <Button
                  variant={formData.petsAllowed ? 'contained' : 'outlined'}
                  onClick={() => setFormData(prev => ({ ...prev, petsAllowed: !prev.petsAllowed }))}
                  sx={{ textTransform: 'none' }}
                >
                  {formData.petsAllowed ? 'Yes' : 'No'}
                </Button>
              </Box>

              <Divider />

              {/* Online applications */}
              <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <Box>
                  <Typography variant="subtitle2" fontWeight={600}>Accept online applications</Typography>
                  {!formData.acceptOnlineApplications && (
                    <Typography variant="caption" color="text.secondary">
                      Applicants will be directed to contact you directly
                    </Typography>
                  )}
                </Box>
                <Button
                  variant={formData.acceptOnlineApplications ? 'contained' : 'outlined'}
                  onClick={() => setFormData(prev => ({ ...prev, acceptOnlineApplications: !prev.acceptOnlineApplications }))}
                  sx={{ textTransform: 'none', flexShrink: 0 }}
                >
                  {formData.acceptOnlineApplications ? 'Enabled' : 'Disabled'}
                </Button>
              </Box>

              {/* Application fee */}
              {formData.acceptOnlineApplications && (
                <>
                  <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <Typography variant="subtitle2" fontWeight={600}>Require application fee</Typography>
                    <Button
                      variant={formData.applicationFeeRequired ? 'contained' : 'outlined'}
                      onClick={() => setFormData(prev => ({ ...prev, applicationFeeRequired: !prev.applicationFeeRequired }))}
                      sx={{ textTransform: 'none' }}
                    >
                      {formData.applicationFeeRequired ? 'Required' : 'Not Required'}
                    </Button>
                  </Box>
                  {formData.applicationFeeRequired && (
                    <TextField
                      fullWidth label="Application Fee *" type="number"
                      value={formData.applicationFee}
                      onChange={(e) => setFormData(prev => ({ ...prev, applicationFee: e.target.value }))}
                      slotProps={{ input: { startAdornment: <InputAdornment position="start">$</InputAdornment> } }}
                    />
                  )}
                </>
              )}

              <Divider />

              {/* Screening */}
              <Typography variant="overline" color="text.secondary" fontWeight={700} sx={{ letterSpacing: '0.08em' }}>
                Background Screening
              </Typography>

              <Box sx={{ display: 'flex', gap: 2, flexWrap: 'wrap' }}>
                <Button
                  variant={formData.screeningType === 'Essential' ? 'contained' : 'outlined'}
                  onClick={() => setFormData(prev => ({ ...prev, screeningType: 'Essential' }))}
                  sx={{ textTransform: 'none' }}
                >
                  Essential coverage ($40.00)
                </Button>
                <Button
                  variant={formData.screeningType === 'Premium' ? 'contained' : 'outlined'}
                  onClick={() => setFormData(prev => ({ ...prev, screeningType: 'Premium' }))}
                  sx={{ textTransform: 'none' }}
                >
                  Premium coverage (+$5.00)
                </Button>
              </Box>

              <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <Typography variant="subtitle2" fontWeight={600}>
                  Require income &amp; employment verification
                </Typography>
                <Button
                  variant={formData.requireIncomeVerification ? 'contained' : 'outlined'}
                  onClick={() => setFormData(prev => ({ ...prev, requireIncomeVerification: !prev.requireIncomeVerification }))}
                  sx={{ textTransform: 'none' }}
                >
                  {formData.requireIncomeVerification ? 'Required ($12.00)' : 'Not Required'}
                </Button>
              </Box>
            </Stack>

            <NavButtons />
          </Box>
        )}

        {/* ── Step 5: Contact & Syndication ── */}
        {activeStep === STEP_CONTACT_SYNDICATION && (
          <Box sx={{ p: 4 }}>
            <Typography variant="h4" fontWeight={700} sx={{ mb: 1, textAlign: 'center' }}>
              Contact & Syndication
            </Typography>
            <Typography variant="body2" color="text.secondary" sx={{ mb: 4, textAlign: 'center' }}>
              Set the contact information shown on this listing and where it should appear.
            </Typography>

            <Stack spacing={3} sx={{ maxWidth: 600, mx: 'auto' }}>
              <TextField
                fullWidth label="Contact Name"
                value={formData.listingContactName}
                onChange={(e) => setFormData(prev => ({ ...prev, listingContactName: e.target.value }))}
              />
              <TextField
                fullWidth label="Contact Phone"
                value={formData.listingContactPhone}
                onChange={(e) => {
                  const formatted = formatPhoneInput(e.target.value);
                  setFormData(prev => ({ ...prev, listingContactPhone: formatted }));
                }}
                placeholder="(555) 555-5555"
                slotProps={{ htmlInput: { maxLength: 17 } }}
              />
              <TextField
                fullWidth label="Contact Email" type="email"
                value={formData.listingContactEmail}
                onChange={(e) => setFormData(prev => ({ ...prev, listingContactEmail: e.target.value }))}
              />

              <Divider />

              <Typography variant="overline" color="text.secondary" fontWeight={700} sx={{ letterSpacing: '0.08em' }}>
                Syndication
              </Typography>
              {/* Listing Website — always on */}
              <Box sx={{ p: 2, border: '1px solid', borderColor: 'divider', borderRadius: 1 }}>
                <Stack direction="row" justifyContent="space-between" alignItems="center">
                  <Box>
                    <Typography variant="subtitle1" fontWeight={600}>Listing Website</Typography>
                    <Typography variant="body2" color="text.secondary">Your custom listing website</Typography>
                  </Box>
                  <Chip label="Always On" color="success" size="small" />
                </Stack>
              </Box>

              {/* Free syndication — coming soon */}
              <Tooltip title="Coming soon" placement="top">
                <Box sx={{ p: 2, border: '1px solid', borderColor: 'divider', borderRadius: 1, opacity: 0.5, cursor: 'not-allowed' }}>
                  <Stack direction="row" justifyContent="space-between" alignItems="center">
                    <Box>
                      <Stack direction="row" spacing={1} alignItems="center">
                        <Typography variant="subtitle1" fontWeight={600}>Free Syndication</Typography>
                        <Chip label="Coming Soon" size="small" icon={<ClockCircleOutlined style={{ fontSize: 11 }} />} sx={{ height: 20, fontSize: '0.65rem' }} />
                      </Stack>
                      <Typography variant="body2" color="text.secondary">TenantCloud, Rentler, Realtor.com, Apartments.com</Typography>
                    </Box>
                    <Button variant="outlined" disabled sx={{ textTransform: 'none', pointerEvents: 'none' }}>
                      Disabled
                    </Button>
                  </Stack>
                </Box>
              </Tooltip>

              {/* Premium syndication — coming soon */}
              <Tooltip title="Coming soon" placement="top">
                <Box sx={{ p: 2, border: '1px solid', borderColor: 'divider', borderRadius: 1, opacity: 0.5, cursor: 'not-allowed' }}>
                  <Stack direction="row" justifyContent="space-between" alignItems="center">
                    <Box>
                      <Stack direction="row" spacing={1} alignItems="center">
                        <Typography variant="subtitle1" fontWeight={600}>Premium Syndication</Typography>
                        <Chip label="Coming Soon" size="small" icon={<ClockCircleOutlined style={{ fontSize: 11 }} />} sx={{ height: 20, fontSize: '0.65rem' }} />
                      </Stack>
                      <Typography variant="body2" color="text.secondary">Zillow, Rent.com, Redfin, Apartment Guide, Zumper, Trulia, HotPads</Typography>
                      <Typography variant="body2" color="text.disabled" sx={{ mt: 0.5 }}>$30.00</Typography>
                    </Box>
                    <Button variant="outlined" disabled sx={{ textTransform: 'none', pointerEvents: 'none' }}>
                      Disabled
                    </Button>
                  </Stack>
                </Box>
              </Tooltip>


            </Stack>

            <NavButtons />
          </Box>
        )}

        {/* ── Step 6: Review & Submit ── */}
        {activeStep === STEP_REVIEW && (
          <Box sx={{ p: 4 }}>
            <Typography variant="h4" fontWeight={700} sx={{ mb: 1, textAlign: 'center' }}>
              Review & Submit
            </Typography>
            <Typography variant="body2" color="text.secondary" sx={{ mb: 4, textAlign: 'center' }}>
              Review your listing details before publishing.
            </Typography>

            <Box sx={{ maxWidth: 600, mx: 'auto', mb: 4 }}>
              <Stack spacing={1.5}>
                <Typography variant="body2"><strong>Property:</strong> {selectedProperty?.name || formData.propertyId}</Typography>
                {(selectedUnit || formData.unitId) && (
                  <Typography variant="body2"><strong>Unit:</strong> {selectedUnit?.name || formData.unitId}</Typography>
                )}
                {formData.squareFeet && (
                  <Typography variant="body2"><strong>Square Feet:</strong> {formData.squareFeet} sq ft</Typography>
                )}
                {formData.monthlyRent && (
                  <Typography variant="body2"><strong>Monthly Rent:</strong> ${Number(formData.monthlyRent).toLocaleString()}</Typography>
                )}
                {formData.securityDeposit && (
                  <Typography variant="body2"><strong>Security Deposit:</strong> ${Number(formData.securityDeposit).toLocaleString()}</Typography>
                )}
                <Typography variant="body2"><strong>Pets Allowed:</strong> {formData.petsAllowed ? 'Yes' : 'No'}</Typography>
                <Typography variant="body2">
                  <strong>Online Applications:</strong> {formData.acceptOnlineApplications ? 'Enabled' : 'Disabled — contact landlord'}
                </Typography>
                {formData.applicationFeeRequired && (
                  <Typography variant="body2"><strong>Application Fee:</strong> ${formData.applicationFee}</Typography>
                )}
              </Stack>
            </Box>

            <Box sx={{ display: 'flex', justifyContent: 'space-between', mt: 4 }}>
              <Button onClick={handleBack} sx={{ textTransform: 'none' }} disabled={isSavingStep}>Back</Button>
              <Button
                variant="contained"
                onClick={handleSubmit}
                disabled={isSavingStep}
                startIcon={isSavingStep ? <CircularProgress size={20} /> : <CheckCircleOutlined />}
                sx={{ textTransform: 'none', minWidth: 160 }}
              >
                {isSavingStep ? 'Publishing…' : 'Publish Listing'}
              </Button>
            </Box>
          </Box>
        )}

        {/* ── Success overlay ── */}
        {isComplete && (
          <Box
            sx={{
              position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
              bgcolor: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center',
              justifyContent: 'center', zIndex: 9999
            }}
          >
            <MainCard sx={{ maxWidth: 480, p: 4, textAlign: 'center' }}>
              <Box
                sx={{
                  width: 80, height: 80, borderRadius: '50%',
                  bgcolor: alpha(theme.palette.success.main, 0.1),
                  border: `3px solid ${theme.palette.success.main}`,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  mx: 'auto', mb: 3
                }}
              >
                <CheckCircleOutlined style={{ fontSize: 40, color: theme.palette.success.main }} />
              </Box>
              <Typography variant="h4" fontWeight={700} sx={{ mb: 2 }}>Listing Published!</Typography>
              <Typography variant="body1" color="text.secondary" sx={{ mb: 4 }}>
                Your listing is now live and active for 30 days.
              </Typography>
              <Stack spacing={2}>
                <Button variant="contained" fullWidth onClick={handleReset} sx={{ textTransform: 'none' }}>
                  List another property
                </Button>
                <Button
                  variant="text" fullWidth
                  onClick={() => onClose ? onClose() : navigate('/landlord/listings')}
                  sx={{ textTransform: 'none', color: theme.palette.primary.main }}
                >
                  Back to list
                </Button>
              </Stack>
            </MainCard>
          </Box>
        )}
      </MainCard>
    </Box>
  );
}
