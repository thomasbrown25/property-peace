import { useState, useEffect, useMemo } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  Box,
  Typography,
  Stack,
  Button,
  LinearProgress,
  TextField,
  Grid,
  Checkbox,
  FormControlLabel,
  MenuItem,
  alpha,
  useTheme,
  CircularProgress,
  Dialog,
  IconButton,
  Chip
} from '@mui/material';
import {
  CheckCircleOutlined,
  ArrowLeftOutlined,
  CloseOutlined,
  StarOutlined,
  PictureOutlined,
  HomeOutlined,
  FileTextOutlined,
  TagsOutlined,
  CalendarOutlined,
  ContactsOutlined
} from '@ant-design/icons';
import MainCard from 'components/MainCard';
import PageBreadcrumbs from 'components/breadcrumbs/PageBreadcrumbs';
import { useDispatch, useSelector } from 'react-redux';
import { getListingById, updateListing, setSelectedListing } from 'store/listing/listing.action';
import { selectSelectedListing, selectListingLoading } from 'store/listing/listing.selector';
import listingApi from 'api/listing';
import listingAIApi from 'api/listingAI';
import { openSnackbar } from 'api/snackbar';
import { useSubscription } from 'hooks/useSubscription';
import RentEstimateCard from 'components/RentEstimateCard';
import ListingAmenitiesStep from 'components/listings/ListingAmenitiesStep';
import { getFallbackSelections } from 'utils/amenityFallbacks';

const LEASE_DURATION_OPTIONS = [
  'Monthly', '2 Months', '3 Months', '4 Months', '5 Months', '6 Months', '7 Months', '8 Months', '9 Months',
  '10 Months', '11 Months', '12 Months', '13 Months', '14 Months', '15 Months', '16 Months', '17 Months',
  '18 Months', '19 Months', '20 Months', '21 Months', '22 Months', '23 Months', '24 Months', 'Contact for details'
];

const SETUP_TABS = [
  { key: 'details', label: 'Property details', description: 'Size, year built, and rent.', icon: HomeOutlined },
  { key: 'media', label: 'Photos & media', description: 'Cover photo, gallery, and video.', icon: PictureOutlined },
  { key: 'amenities', label: 'Amenities & features', description: 'What tenants care about.', icon: TagsOutlined },
  { key: 'description', label: 'Marketing description', description: 'Public listing copy.', icon: FileTextOutlined },
  { key: 'leaseTerms', label: 'Lease terms', description: 'Deposit, availability, and pets.', icon: CalendarOutlined },
  { key: 'application', label: 'Contact details', description: 'Application and contact settings.', icon: ContactsOutlined }
];

const fieldSx = {
  '& .MuiOutlinedInput-root': {
    borderRadius: 1.5,
    bgcolor: 'background.paper'
  },
  '& .MuiInputLabel-root': {
    display: 'none'
  },
  '& legend': {
    display: 'none'
  },
  '& fieldset': {
    top: 0
  }
};

function SetupField({ label, required = false, children }) {
  return (
    <Stack spacing={0.75}>
      <Typography variant="caption" fontWeight={600} color="text.secondary">
        {label}{required ? ' *' : ''}
      </Typography>
      {children}
    </Stack>
  );
}

const getId = (item) => item?.id ?? item?.Id;
const isCustom = (item) => item?.isCustom === true || item?.IsCustom === true;

export default function ListingSetupPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const theme = useTheme();
  const dispatch = useDispatch();
  const listing = useSelector(selectSelectedListing);
  const loading = useSelector(selectListingLoading);
  const { subscription } = useSubscription();
  const planName = (subscription?.plan?.name || subscription?.subscriptionPlan?.name || '').toLowerCase();
  const isPremium = planName === 'premium' || planName.includes('lifetime');

  const [activeTab, setActiveTab] = useState('details');
  const [saving, setSaving] = useState(false);
  const [publishing, setPublishing] = useState(false);
  const [generatingDescription, setGeneratingDescription] = useState(false);
  const [formData, setFormData] = useState(null);
  const [coverFile, setCoverFile] = useState(null);
  const [coverPreview, setCoverPreview] = useState(null);
  const [galleryNewFiles, setGalleryNewFiles] = useState([]);
  const [galleryPreviews, setGalleryPreviews] = useState([]);
  const [removedImageIds, setRemovedImageIds] = useState([]);

  useEffect(() => {
    if (id) dispatch(getListingById(parseInt(id, 10)));
    return () => dispatch(setSelectedListing(null));
  }, [id, dispatch]);

  useEffect(() => {
    if (!listing) return;
    const basicAmenities = listing.basicAmenities ?? [];
    const propertyAmenities = listing.propertyAmenities ?? [];
    const propertyFeatures = listing.propertyFeatures ?? [];

    setFormData({
      squareFeet: listing.squareFeet ?? '',
      yearBuilt: listing.yearBuilt ?? '',
      monthlyRent: listing.monthlyRent ?? '',
      securityDeposit: listing.securityDeposit ?? '',
      dateAvailable: listing.dateAvailable ? listing.dateAvailable.slice(0, 10) : '',
      minLeaseDuration: listing.minLeaseDuration ?? '',
      maxLeaseDuration: listing.maxLeaseDuration ?? '',
      petsAllowed: listing.petsAllowed ?? false,
      additionalLeaseTermsNotes: listing.additionalLeaseTermsNotes ?? '',
      marketingDescription: listing.marketingDescription ?? '',
      videoTourUrl: listing.videoTourUrl ?? '',
      acceptOnlineApplications: listing.acceptOnlineApplications ?? true,
      applicationFeeRequired: listing.applicationFeeRequired ?? false,
      applicationFee: listing.applicationFee ?? '0',
      requireScreening: listing.requireScreening ?? true,
      screeningType: listing.screeningType ?? 'Essential',
      requireIncomeVerification: listing.requireIncomeVerification ?? false,
      incomeVerificationCost: listing.incomeVerificationCost ?? '12',
      listingContactName: listing.listingContactName ?? '',
      listingContactPhone: listing.listingContactPhone ?? '',
      listingContactEmail: listing.listingContactEmail ?? '',
      syndicateToListingWebsite: listing.syndicateToListingWebsite ?? true,
      syndicateToFreeSites: listing.syndicateToFreeSites ?? false,
      syndicateToPremiumSites: listing.syndicateToPremiumSites ?? false,
      basicAmenityIds: basicAmenities.map(getId).filter(Boolean),
      defaultAmenityIds: propertyAmenities.filter((a) => !isCustom(a)).map(getId).filter(Boolean),
      customAmenityIds: propertyAmenities.filter(isCustom).map(getId).filter(Boolean),
      defaultFeatureIds: propertyFeatures.filter((a) => !isCustom(a)).map(getId).filter(Boolean),
      customFeatureIds: propertyFeatures.filter(isCustom).map(getId).filter(Boolean)
    });

    setCoverFile(null);
    setGalleryNewFiles([]);
    setRemovedImageIds([]);
  }, [listing]);

  useEffect(() => {
    if (!coverFile) {
      setCoverPreview(null);
      return undefined;
    }
    const url = URL.createObjectURL(coverFile);
    setCoverPreview(url);
    return () => URL.revokeObjectURL(url);
  }, [coverFile]);

  useEffect(() => {
    if (galleryNewFiles.length === 0) {
      setGalleryPreviews([]);
      return undefined;
    }
    const urls = galleryNewFiles.map((file) => URL.createObjectURL(file));
    setGalleryPreviews(urls);
    return () => urls.forEach((url) => URL.revokeObjectURL(url));
  }, [galleryNewFiles]);

  const existingImages = useMemo(() => (listing?.images ?? []).filter((img) => !removedImageIds.includes(img.id)), [listing?.images, removedImageIds]);
  const coverImage = existingImages.find((img) => img.isCoverPhoto) ?? existingImages[0];
  const galleryImages = existingImages.filter((img) => img.id !== coverImage?.id);

  const setupProgress = useMemo(() => {
    const hasMedia = existingImages.length + (coverFile ? 1 : 0) + galleryNewFiles.length > 0;
    const steps = {
      details: Number(formData?.monthlyRent) > 0,
      media: hasMedia,
      description: !!(formData?.marketingDescription?.trim()),
      leaseTerms: !!(formData?.dateAvailable || formData?.minLeaseDuration || formData?.securityDeposit !== ''),
      amenities: ((formData?.basicAmenityIds?.length ?? 0) + (formData?.defaultAmenityIds?.length ?? 0) + (formData?.customAmenityIds?.length ?? 0) + (formData?.defaultFeatureIds?.length ?? 0) + (formData?.customFeatureIds?.length ?? 0)) > 0,
      application: !!(formData?.listingContactName?.trim())
    };
    const completed = Object.values(steps).filter(Boolean).length;
    return { completed, total: SETUP_TABS.length, progress: (completed / SETUP_TABS.length) * 100, steps };
  }, [formData, existingImages.length, coverFile, galleryNewFiles.length]);

  useEffect(() => {
    if (!formData) return;
    const firstIncomplete = SETUP_TABS.find((tab) => !setupProgress.steps[tab.key]);
    setActiveTab((current) => current || firstIncomplete?.key || 'details');
  }, [formData, setupProgress.steps]);

  const isDraft = listing?.status === 'Draft' || listing?.status === 0;
  const propertyDisplay = listing?.propertyName || 'Property';
  const unitDisplay = listing?.unitName || 'Whole property';
  const addressDisplay = listing?.propertyAddress || '';
  const activeTabConfig = SETUP_TABS.find((tab) => tab.key === activeTab) ?? SETUP_TABS[0];

  const handleBack = () => navigate('/landlord/listings');

  const buildListingPayload = () => {
    const { basicAmenitySelections, defaultAmenitySelections, defaultFeatureSelections } = getFallbackSelections(formData);
    return {
      squareFeet: formData.squareFeet ? parseInt(formData.squareFeet, 10) : null,
      yearBuilt: formData.yearBuilt ? parseInt(formData.yearBuilt, 10) : null,
      monthlyRent: parseFloat(formData.monthlyRent) || 0,
      securityDeposit: formData.securityDeposit ? parseFloat(formData.securityDeposit) : null,
      dateAvailable: formData.dateAvailable || null,
      minLeaseDuration: formData.minLeaseDuration || null,
      maxLeaseDuration: formData.maxLeaseDuration || null,
      petsAllowed: Boolean(formData.petsAllowed),
      additionalLeaseTermsNotes: formData.additionalLeaseTermsNotes || null,
      marketingDescription: formData.marketingDescription || '',
      videoTourUrl: formData.videoTourUrl || null,
      acceptOnlineApplications: Boolean(formData.acceptOnlineApplications),
      applicationFeeRequired: Boolean(formData.applicationFeeRequired),
      applicationFee: formData.applicationFeeRequired ? parseFloat(formData.applicationFee) || 0 : 0,
      requireScreening: Boolean(formData.requireScreening),
      screeningType: formData.screeningType || 'Essential',
      requireIncomeVerification: Boolean(formData.requireIncomeVerification),
      incomeVerificationCost: formData.requireIncomeVerification ? parseFloat(formData.incomeVerificationCost) || 0 : 0,
      listingContactName: formData.listingContactName?.trim() || null,
      listingContactPhone: formData.listingContactPhone?.trim() || null,
      listingContactEmail: formData.listingContactEmail?.trim() || null,
      syndicateToListingWebsite: Boolean(formData.syndicateToListingWebsite),
      syndicateToFreeSites: Boolean(formData.syndicateToFreeSites),
      syndicateToPremiumSites: Boolean(formData.syndicateToPremiumSites),
      basicAmenityIds: (formData.basicAmenityIds ?? []).filter((value) => Number(value) > 0),
      defaultAmenityIds: (formData.defaultAmenityIds ?? []).filter((value) => Number(value) > 0),
      customAmenityIds: formData.customAmenityIds ?? [],
      defaultFeatureIds: (formData.defaultFeatureIds ?? []).filter((value) => Number(value) > 0),
      customFeatureIds: formData.customFeatureIds ?? [],
      ...(basicAmenitySelections.length > 0 && { basicAmenitySelections }),
      ...(defaultAmenitySelections.length > 0 && { defaultAmenitySelections }),
      ...(defaultFeatureSelections.length > 0 && { defaultFeatureSelections })
    };
  };

  const saveListingChanges = async ({ quiet = false } = {}) => {
    if (!id || !formData) return false;
    const result = await dispatch(updateListing(parseInt(id, 10), buildListingPayload()));
    if (!result?.success) throw new Error(result?.message || 'Failed to save listing');

    for (const imageId of removedImageIds) {
      await listingApi.deleteListingImage(imageId);
    }

    const filesToUpload = [coverFile, ...galleryNewFiles].filter(Boolean);
    if (filesToUpload.length > 0) {
      const res = await listingApi.uploadListingImages(parseInt(id, 10), filesToUpload);
      if (res?.data?.length && coverFile) {
        await listingApi.setCoverPhoto(res.data[0].id, parseInt(id, 10));
      }
    }

    dispatch(getListingById(parseInt(id, 10)));
    if (!quiet) openSnackbar({ open: true, message: 'Listing setup saved', variant: 'alert', alert: { color: 'success' } });
    return true;
  };

  const handleSaveDraft = async () => {
    setSaving(true);
    try {
      await saveListingChanges();
      setCoverFile(null);
      setGalleryNewFiles([]);
      setRemovedImageIds([]);
    } catch (e) {
      openSnackbar({ open: true, message: e?.response?.data?.message || e?.message || 'Failed to save', variant: 'alert', alert: { color: 'error' } });
    } finally {
      setSaving(false);
    }
  };

  const handleSaveAndPublish = async () => {
    if (!id || !formData) return;
    const incompleteTab = SETUP_TABS.find((tab) => !setupProgress.steps[tab.key]);
    if (incompleteTab) {
      setActiveTab(incompleteTab.key);
      openSnackbar({
        open: true,
        message: `${incompleteTab.label} needs to be complete before publishing.`,
        variant: 'alert',
        alert: { color: 'warning' }
      });
      return;
    }

    setPublishing(true);
    try {
      await saveListingChanges({ quiet: true });
      const res = await listingApi.publishListing(parseInt(id, 10));
      if (res.success) {
        openSnackbar({ open: true, message: 'Listing saved and published', variant: 'alert', alert: { color: 'success' } });
        navigate(`/landlord/listings/${id}`);
      } else throw new Error(res.message);
    } catch (e) {
      openSnackbar({ open: true, message: e?.response?.data?.message || e?.message || 'Failed to save and publish', variant: 'alert', alert: { color: 'error' } });
    } finally {
      setPublishing(false);
    }
  };

  const handleGenerateDescription = async () => {
    setGeneratingDescription(true);
    try {
      const toNames = (arr) => (arr ?? []).map((a) => a.name ?? a.Name).filter(Boolean);
      const res = await listingAIApi.generateMarketingDescription({
        propertyName: listing?.propertyName ?? '',
        propertyAddress: listing?.propertyAddress ?? '',
        unitName: listing?.unitName ?? null,
        squareFeet: formData?.squareFeet ? parseInt(formData.squareFeet, 10) : null,
        yearBuilt: formData?.yearBuilt ? parseInt(formData.yearBuilt, 10) : null,
        bedrooms: null,
        baths: null,
        monthlyRent: parseFloat(formData?.monthlyRent) || 0,
        basicAmenities: toNames(listing?.basicAmenities),
        propertyAmenities: toNames(listing?.propertyAmenities),
        propertyFeatures: toNames(listing?.propertyFeatures)
      });
      if (res.success && res.data) setFormData((prev) => ({ ...prev, marketingDescription: res.data }));
    } catch (e) {
      openSnackbar({ open: true, message: e?.response?.data?.message || 'Could not generate description', variant: 'alert', alert: { color: 'error' } });
    } finally {
      setGeneratingDescription(false);
    }
  };

  const handleCoverChange = (event) => {
    const file = event.target.files?.[0];
    if (file) setCoverFile(file);
    event.target.value = '';
  };

  const handleGalleryAdd = (event) => {
    const files = event.target.files;
    if (files?.length) setGalleryNewFiles((prev) => [...prev, ...Array.from(files)]);
    event.target.value = '';
  };

  const removeExistingImage = (imageId) => setRemovedImageIds((prev) => [...prev, imageId]);
  const removeGalleryNewFile = (index) => setGalleryNewFiles((prev) => prev.filter((_, itemIndex) => itemIndex !== index));

  const handleSetAsCover = async (imageId) => {
    try {
      await listingApi.setCoverPhoto(imageId, parseInt(id, 10));
      dispatch(getListingById(parseInt(id, 10)));
      openSnackbar({ open: true, message: 'Cover photo updated', variant: 'alert', alert: { color: 'success' } });
    } catch (e) {
      openSnackbar({ open: true, message: e?.response?.data?.message || 'Failed to set cover photo', variant: 'alert', alert: { color: 'error' } });
    }
  };

  if ((!listing && loading) || (listing && !formData)) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: 400 }}>
        <CircularProgress />
      </Box>
    );
  }
  if (!listing) return null;

  const renderTabPanel = () => {
    switch (activeTab) {
      case 'details':
        return (
          <Stack spacing={3}>
            <Grid container spacing={2.5} alignItems="flex-start">
              <Grid size={{ xs: 12, md: listing?.propertyId ? 5 : 12 }}>
                <Stack spacing={2}>
                  <Grid container spacing={2}>
                    <Grid size={{ xs: 12, sm: 6 }}>
                      <SetupField label="Square feet">
                        <TextField fullWidth label="" placeholder="e.g. 950" type="number" value={formData.squareFeet} onChange={(e) => setFormData((p) => ({ ...p, squareFeet: e.target.value }))} sx={fieldSx} />
                      </SetupField>
                    </Grid>
                    <Grid size={{ xs: 12, sm: 6 }}>
                      <SetupField label="Year built">
                        <TextField fullWidth label="" placeholder="e.g. 1925" type="number" value={formData.yearBuilt} onChange={(e) => setFormData((p) => ({ ...p, yearBuilt: e.target.value }))} sx={fieldSx} />
                      </SetupField>
                    </Grid>
                    <Grid size={12}>
                      <SetupField label="Monthly rent" required>
                        <TextField fullWidth label="" placeholder="e.g. 2200" type="number" value={formData.monthlyRent} onChange={(e) => setFormData((p) => ({ ...p, monthlyRent: e.target.value }))} InputProps={{ startAdornment: <Typography sx={{ mr: 1 }}>$</Typography> }} sx={fieldSx} />
                      </SetupField>
                    </Grid>
                  </Grid>
                </Stack>
              </Grid>
              {listing?.propertyId && (
                <Grid size={{ xs: 12, md: 7 }}>
                  <RentEstimateCard propertyId={listing.propertyId} unitId={listing.unitId} isPremium={isPremium} onUseAmount={(amount) => setFormData((p) => ({ ...p, monthlyRent: String(amount) }))} />
                </Grid>
              )}
            </Grid>
          </Stack>
        );
      case 'media':
        return (
          <Stack spacing={3}>
            <Box>
              <Typography variant="subtitle1" fontWeight={700} sx={{ mb: 1 }}>Cover photo</Typography>
              <Box sx={{ border: `1px dashed ${alpha(theme.palette.primary.main, 0.35)}`, borderRadius: 2, p: 2, bgcolor: alpha(theme.palette.primary.main, 0.035) }}>
                {coverPreview || coverImage?.blobUrl ? (
                  <Box component="img" src={coverPreview || coverImage.blobUrl} alt="Cover" sx={{ width: '100%', maxHeight: 260, objectFit: 'cover', borderRadius: 1.5, display: 'block', mb: 2 }} />
                ) : (
                  <Box sx={{ height: 180, borderRadius: 1.5, bgcolor: 'grey.100', display: 'flex', alignItems: 'center', justifyContent: 'center', mb: 2 }}>
                    <PictureOutlined style={{ fontSize: 42, color: theme.palette.text.disabled }} />
                  </Box>
                )}
                <Button variant="outlined" component="label" sx={{ textTransform: 'none' }}>
                  Choose cover photo
                  <input hidden type="file" accept="image/*" onChange={handleCoverChange} />
                </Button>
              </Box>
            </Box>

            <Box>
              <Stack direction="row" alignItems="center" justifyContent="space-between" sx={{ mb: 1 }}>
                <Typography variant="subtitle1" fontWeight={700}>Gallery photos</Typography>
                <Button variant="contained" component="label" size="small" sx={{ textTransform: 'none' }}>
                  Add photos
                  <input hidden type="file" accept="image/*" multiple onChange={handleGalleryAdd} />
                </Button>
              </Stack>
              <Grid container spacing={1.5}>
                {galleryImages.map((img) => (
                  <Grid key={img.id} size={{ xs: 6, sm: 4, md: 3 }}>
                    <Box sx={{ position: 'relative', borderRadius: 1.5, overflow: 'hidden', border: `1px solid ${theme.palette.divider}` }}>
                      <Box component="img" src={img.blobUrl} alt="Gallery" sx={{ width: '100%', height: 120, objectFit: 'cover', display: 'block' }} />
                      <Stack direction="row" spacing={0.5} sx={{ position: 'absolute', top: 6, right: 6 }}>
                        <IconButton size="small" onClick={() => handleSetAsCover(img.id)} sx={{ bgcolor: 'background.paper', '&:hover': { bgcolor: 'background.paper' } }}><StarOutlined /></IconButton>
                        <IconButton size="small" onClick={() => removeExistingImage(img.id)} sx={{ bgcolor: 'background.paper', '&:hover': { bgcolor: 'background.paper' } }}><CloseOutlined /></IconButton>
                      </Stack>
                    </Box>
                  </Grid>
                ))}
                {galleryPreviews.map((preview, index) => (
                  <Grid key={preview} size={{ xs: 6, sm: 4, md: 3 }}>
                    <Box sx={{ position: 'relative', borderRadius: 1.5, overflow: 'hidden', border: `1px solid ${alpha(theme.palette.success.main, 0.35)}` }}>
                      <Box component="img" src={preview} alt="New gallery" sx={{ width: '100%', height: 120, objectFit: 'cover', display: 'block' }} />
                      <IconButton size="small" onClick={() => removeGalleryNewFile(index)} sx={{ position: 'absolute', top: 6, right: 6, bgcolor: 'background.paper', '&:hover': { bgcolor: 'background.paper' } }}><CloseOutlined /></IconButton>
                    </Box>
                  </Grid>
                ))}
              </Grid>
            </Box>

            <SetupField label="Video tour URL">
              <TextField fullWidth label="" value={formData.videoTourUrl} onChange={(e) => setFormData((p) => ({ ...p, videoTourUrl: e.target.value }))} placeholder="e.g. https://youtu.be/your-tour" sx={fieldSx} />
            </SetupField>
          </Stack>
        );
      case 'amenities':
        return (
          <ListingAmenitiesStep formData={formData} setFormData={setFormData} savedBasicAmenities={listing.basicAmenities ?? []} savedPropertyAmenities={listing.propertyAmenities ?? []} savedPropertyFeatures={listing.propertyFeatures ?? []} />
        );
      case 'description':
        return (
          <Stack spacing={2}>
            <SetupField label="Marketing description" required>
              <TextField fullWidth multiline rows={8} label="" placeholder="e.g. Bright 2-bedroom apartment with updated finishes, convenient parking, and easy access to downtown." value={formData.marketingDescription} onChange={(e) => setFormData((p) => ({ ...p, marketingDescription: e.target.value }))} inputProps={{ maxLength: 4000 }} helperText={`${(formData.marketingDescription || '').length} / 4000`} sx={fieldSx} />
            </SetupField>
            <Button variant="outlined" onClick={handleGenerateDescription} disabled={generatingDescription} sx={{ textTransform: 'none', alignSelf: 'flex-start' }}>
              Generate with AI
            </Button>
          </Stack>
        );
      case 'leaseTerms':
        return (
          <Stack spacing={2.5}>
            <Grid container spacing={2}>
              <Grid size={{ xs: 12, sm: 6 }}>
                <SetupField label="Security deposit">
                  <TextField fullWidth label="" placeholder="e.g. 2200" type="number" value={formData.securityDeposit} onChange={(e) => setFormData((p) => ({ ...p, securityDeposit: e.target.value }))} InputProps={{ startAdornment: <Typography sx={{ mr: 1 }}>$</Typography> }} sx={fieldSx} />
                </SetupField>
              </Grid>
              <Grid size={{ xs: 12, sm: 6 }}>
                <SetupField label="Date available">
                  <TextField fullWidth label="" type="date" value={formData.dateAvailable} onChange={(e) => setFormData((p) => ({ ...p, dateAvailable: e.target.value }))} sx={fieldSx} />
                </SetupField>
              </Grid>
              <Grid size={{ xs: 12, sm: 6 }}>
                <SetupField label="Minimum lease duration">
                  <TextField select fullWidth label="" value={formData.minLeaseDuration} onChange={(e) => setFormData((p) => ({ ...p, minLeaseDuration: e.target.value }))} sx={fieldSx}>
                    <MenuItem value="">Select minimum lease duration</MenuItem>
                    {LEASE_DURATION_OPTIONS.map((option) => <MenuItem key={option} value={option}>{option}</MenuItem>)}
                  </TextField>
                </SetupField>
              </Grid>
              <Grid size={{ xs: 12, sm: 6 }}>
                <SetupField label="Maximum lease duration">
                  <TextField select fullWidth label="" value={formData.maxLeaseDuration} onChange={(e) => setFormData((p) => ({ ...p, maxLeaseDuration: e.target.value }))} sx={fieldSx}>
                    <MenuItem value="">Select maximum lease duration</MenuItem>
                    {LEASE_DURATION_OPTIONS.map((option) => <MenuItem key={option} value={option}>{option}</MenuItem>)}
                  </TextField>
                </SetupField>
              </Grid>
              <Grid size={12}>
                <FormControlLabel control={<Checkbox checked={Boolean(formData.petsAllowed)} onChange={(e) => setFormData((p) => ({ ...p, petsAllowed: e.target.checked }))} />} label="Pets allowed" />
              </Grid>
              <Grid size={12}>
                <SetupField label="Additional lease terms notes">
                  <TextField fullWidth multiline rows={4} label="" placeholder="e.g. Tenant pays electric and gas. No smoking." value={formData.additionalLeaseTermsNotes} onChange={(e) => setFormData((p) => ({ ...p, additionalLeaseTermsNotes: e.target.value }))} sx={fieldSx} />
                </SetupField>
              </Grid>
            </Grid>
          </Stack>
        );
      case 'application':
        return (
          <Stack spacing={2.5}>
            <Grid container spacing={2}>
              <Grid size={{ xs: 12, sm: 6 }}>
                <SetupField label="Contact name" required>
                  <TextField fullWidth label="" placeholder="e.g. Thomas Brown" value={formData.listingContactName} onChange={(e) => setFormData((p) => ({ ...p, listingContactName: e.target.value }))} sx={fieldSx} />
                </SetupField>
              </Grid>
              <Grid size={{ xs: 12, sm: 6 }}>
                <SetupField label="Contact phone">
                  <TextField fullWidth label="" placeholder="e.g. (216) 555-0184" value={formData.listingContactPhone} onChange={(e) => setFormData((p) => ({ ...p, listingContactPhone: e.target.value }))} sx={fieldSx} />
                </SetupField>
              </Grid>
              <Grid size={12}>
                <SetupField label="Contact email">
                  <TextField fullWidth label="" placeholder="e.g. leasing@example.com" type="email" value={formData.listingContactEmail} onChange={(e) => setFormData((p) => ({ ...p, listingContactEmail: e.target.value }))} sx={fieldSx} />
                </SetupField>
              </Grid>
            </Grid>

            <Box sx={{ p: 2, borderRadius: 2, border: `1px solid ${theme.palette.divider}`, bgcolor: alpha(theme.palette.primary.main, 0.035) }}>
              <Typography variant="subtitle2" fontWeight={700} sx={{ mb: 1 }}>Application settings</Typography>
              <Stack spacing={0.5}>
                <FormControlLabel control={<Checkbox checked={Boolean(formData.acceptOnlineApplications)} onChange={(e) => setFormData((p) => ({ ...p, acceptOnlineApplications: e.target.checked }))} />} label="Accept online applications" />
                <FormControlLabel control={<Checkbox checked={Boolean(formData.applicationFeeRequired)} onChange={(e) => setFormData((p) => ({ ...p, applicationFeeRequired: e.target.checked }))} />} label="Require application fee" />
                {formData.applicationFeeRequired && (
                  <Box sx={{ mt: 1 }}>
                    <SetupField label="Application fee">
                      <TextField fullWidth label="" placeholder="e.g. 35" type="number" value={formData.applicationFee} onChange={(e) => setFormData((p) => ({ ...p, applicationFee: e.target.value }))} InputProps={{ startAdornment: <Typography sx={{ mr: 1 }}>$</Typography> }} sx={fieldSx} />
                    </SetupField>
                  </Box>
                )}
                <FormControlLabel control={<Checkbox checked={Boolean(formData.requireScreening)} onChange={(e) => setFormData((p) => ({ ...p, requireScreening: e.target.checked }))} />} label="Require tenant screening" />
                <FormControlLabel control={<Checkbox checked={Boolean(formData.requireIncomeVerification)} onChange={(e) => setFormData((p) => ({ ...p, requireIncomeVerification: e.target.checked }))} />} label="Require income verification" />
              </Stack>
            </Box>

            <Box sx={{ p: 2, borderRadius: 2, border: `1px solid ${theme.palette.divider}` }}>
              <Typography variant="subtitle2" fontWeight={700} sx={{ mb: 1 }}>Syndication</Typography>
              <Stack spacing={0.5}>
                <FormControlLabel control={<Checkbox checked={Boolean(formData.syndicateToListingWebsite)} onChange={(e) => setFormData((p) => ({ ...p, syndicateToListingWebsite: e.target.checked }))} />} label="Show on Property Peace listing website" />
                <FormControlLabel control={<Checkbox checked={Boolean(formData.syndicateToFreeSites)} onChange={(e) => setFormData((p) => ({ ...p, syndicateToFreeSites: e.target.checked }))} />} label="Syndicate to free sites" />
                <FormControlLabel control={<Checkbox checked={Boolean(formData.syndicateToPremiumSites)} onChange={(e) => setFormData((p) => ({ ...p, syndicateToPremiumSites: e.target.checked }))} />} label="Syndicate to premium sites" />
              </Stack>
            </Box>
          </Stack>
        );
      default:
        return null;
    }
  };

  return (
    <Box>
      <Dialog open={generatingDescription} disableEscapeKeyDown PaperProps={{ sx: { borderRadius: 2, p: 3, minWidth: 320 } }}>
        <Stack spacing={2} alignItems="center" sx={{ py: 2 }}>
          <CircularProgress size={40} />
          <Typography variant="body1" color="text.secondary">Writing your marketing description…</Typography>
        </Stack>
      </Dialog>

      <PageBreadcrumbs
        links={[
          { title: 'Listings', to: '/landlord/listings' },
          { title: listing.listingNumber ?? 'Listing' },
          { title: 'Set Up' }
        ]}
      />

      <Box sx={{ mb: 3, p: 3, borderRadius: 2, bgcolor: (t) => alpha(t.palette.background.paper, 0.7), border: (t) => `1px solid ${alpha(t.palette.divider, 0.12)}` }}>
        <Stack direction={{ xs: 'column', md: 'row' }} justifyContent="space-between" spacing={2} alignItems={{ xs: 'flex-start', md: 'center' }}>
          <Stack spacing={1} alignItems="flex-start">
            <Button variant="text" size="small" startIcon={<ArrowLeftOutlined style={{ fontSize: 14 }} />} onClick={handleBack} sx={{ color: 'text.secondary', textTransform: 'none', minWidth: 'auto', width: 'fit-content', '&:hover': { bgcolor: alpha(theme.palette.primary.main, 0.08) } }}>
              BACK
            </Button>
            <Stack direction="row" spacing={1} alignItems="center" flexWrap="wrap" useFlexGap>
              {isDraft && <Chip label="Draft" size="small" color="info" variant="outlined" />}
              <Chip label={`${setupProgress.completed}/${setupProgress.total} steps complete`} size="small" color={setupProgress.completed === setupProgress.total ? 'success' : 'default'} variant="outlined" />
            </Stack>
            <Typography variant="h4" fontWeight={700}>{propertyDisplay} – {unitDisplay}</Typography>
            <Typography variant="body2" color="text.secondary">{addressDisplay}</Typography>
          </Stack>
          <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1} sx={{ width: { xs: '100%', md: 'auto' } }}>
            <Button variant="outlined" onClick={handleSaveDraft} disabled={saving || publishing} sx={{ textTransform: 'none', fontWeight: 700 }}>
              {saving ? 'Saving...' : 'Save draft'}
            </Button>
            <Button variant="contained" onClick={handleSaveAndPublish} disabled={saving || publishing} sx={{ textTransform: 'none', fontWeight: 800, px: 3 }}>
              {publishing ? 'Publishing...' : 'Save & Publish'}
            </Button>
          </Stack>
        </Stack>
      </Box>

      <Grid container spacing={2.5} alignItems="flex-start">
        <Grid size={{ xs: 12, lg: 3 }}>
          <MainCard content={false} sx={{ position: { lg: 'sticky' }, top: { lg: 88 }, borderRadius: 2, border: `1px solid ${alpha(theme.palette.divider, 0.16)}`, boxShadow: 'none', overflow: 'hidden' }}>
            <Box sx={{ p: 2, borderBottom: `1px solid ${alpha(theme.palette.divider, 0.16)}` }}>
              <Typography variant="h6" fontWeight={800}>Set up your listing</Typography>
              <Typography variant="caption" color="text.secondary">Complete each section before publishing.</Typography>
              <Stack spacing={0.75} sx={{ mt: 1.5 }}>
                <Stack direction="row" justifyContent="space-between" alignItems="center">
                  <Typography variant="caption" color="text.secondary" fontWeight={700}>Steps completed</Typography>
                  <Typography variant="caption" color="text.secondary" fontWeight={800}>{Math.round(setupProgress.progress)}%</Typography>
                </Stack>
                <LinearProgress variant="determinate" value={setupProgress.progress} sx={{ height: 8, borderRadius: 99, bgcolor: alpha(theme.palette.success.main, 0.12), '& .MuiLinearProgress-bar': { borderRadius: 99, backgroundColor: theme.palette.success.main } }} />
              </Stack>
            </Box>

            <Stack spacing={0}>
              {SETUP_TABS.map((tab) => {
                const Icon = tab.icon;
                const complete = setupProgress.steps[tab.key];
                const selected = activeTab === tab.key;
                return (
                  <Box
                    key={tab.key}
                    component="button"
                    type="button"
                    onClick={() => setActiveTab(tab.key)}
                    sx={{
                      width: '100%',
                      border: 0,
                      borderBottom: `1px solid ${alpha(theme.palette.divider, 0.12)}`,
                      bgcolor: selected ? alpha(theme.palette.primary.main, 0.07) : 'background.paper',
                      color: 'text.primary',
                      textAlign: 'left',
                      p: 1.5,
                      cursor: 'pointer',
                      borderLeft: selected ? `3px solid ${theme.palette.primary.main}` : '3px solid transparent',
                      transition: 'background-color 0.15s ease, border-color 0.15s ease',
                      '&:hover': { bgcolor: selected ? alpha(theme.palette.primary.main, 0.08) : alpha(theme.palette.primary.main, 0.035) }
                    }}
                  >
                    <Stack direction="row" spacing={1.25} alignItems="flex-start">
                      <Box sx={{ width: 24, pt: 0.15, display: 'flex', justifyContent: 'center', color: complete ? 'success.main' : 'text.secondary' }}>
                        {complete ? <CheckCircleOutlined style={{ fontSize: 20 }} /> : <Checkbox disabled checked={false} sx={{ p: 0, '& .MuiSvgIcon-root': { fontSize: 20 } }} />}
                      </Box>
                      <Box sx={{ minWidth: 0, flex: 1 }}>
                        <Stack direction="row" spacing={0.75} alignItems="center">
                          <Icon style={{ fontSize: 15, color: selected ? theme.palette.primary.main : theme.palette.text.secondary }} />
                          <Typography variant="body2" fontWeight={selected ? 800 : 700}>{tab.label}</Typography>
                        </Stack>
                        <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 0.25, lineHeight: 1.35 }}>{tab.description}</Typography>
                      </Box>
                    </Stack>
                  </Box>
                );
              })}
            </Stack>
          </MainCard>
        </Grid>

        <Grid size={{ xs: 12, lg: 9 }}>
          <MainCard content={false} sx={{ borderRadius: 2, border: `1px solid ${alpha(theme.palette.divider, 0.16)}`, boxShadow: 'none', overflow: 'hidden' }}>
            <Box sx={{ p: { xs: 2, md: 2.5 }, borderBottom: `1px solid ${alpha(theme.palette.divider, 0.14)}`, bgcolor: alpha(theme.palette.background.paper, 0.86) }}>
              <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1} alignItems={{ xs: 'flex-start', sm: 'center' }} justifyContent="space-between">
                <Box>
                  <Typography variant="h5" fontWeight={800}>{activeTabConfig.label}</Typography>
                  <Typography variant="body2" color="text.secondary">{activeTabConfig.description}</Typography>
                </Box>
                <Chip label={setupProgress.steps[activeTab] ? 'Complete' : 'Needs attention'} size="small" color={setupProgress.steps[activeTab] ? 'success' : 'warning'} variant="outlined" />
              </Stack>
            </Box>
            <Box sx={{ p: { xs: 2, md: 2.5 } }}>{renderTabPanel()}</Box>
          </MainCard>
        </Grid>
      </Grid>
    </Box>
  );
}
