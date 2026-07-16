import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  Box,
  Typography,
  Stack,
  Button,
  alpha,
  useTheme,
  CircularProgress
} from '@mui/material';
import { ArrowLeftOutlined } from '@ant-design/icons';
import MainCard from 'components/MainCard';
import PageBreadcrumbs from 'components/breadcrumbs/PageBreadcrumbs';
import { useDispatch, useSelector } from 'react-redux';
import { getListingById, setSelectedListing, updateListing } from 'store/listing/listing.action';
import { selectSelectedListing, selectListingLoading } from 'store/listing/listing.selector';
import ListingAmenitiesStep from 'components/listings/ListingAmenitiesStep';
import { openSnackbar } from 'api/snackbar';
import { getFallbackSelections } from 'utils/amenityFallbacks';

export default function ListingSetupAmenitiesPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const theme = useTheme();
  const dispatch = useDispatch();
  const rawListing = useSelector(selectSelectedListing);
  const loading = useSelector(selectListingLoading);
  const [formData, setFormData] = useState(null);
  const [saving, setSaving] = useState(false);

  // Unwrap in case store ever has { success, data } shape; support both camelCase and PascalCase
  const listing = rawListing?.data ?? rawListing;

  useEffect(() => {
    if (id) dispatch(getListingById(parseInt(id)));
    return () => dispatch(setSelectedListing(null));
  }, [id, dispatch]);

  useEffect(() => {
    const listingId = id != null ? parseInt(id, 10) : NaN;
    const listingIdVal = listing?.id ?? listing?.Id;
    const match = listing && (Number(listingIdVal) === listingId);
    if (!match || !listing) return;

    const getId = (a) => {
      const raw = a?.id ?? a?.Id;
      return raw != null ? Number(raw) : null;
    };
    const isCustom = (a) => a?.isCustom === true || a?.IsCustom === true;
    // Load from DB: listing.ListingBasicAmenities → API returns as basicAmenities (each item has id = BasicAmenityId)
    const basicList = Array.isArray(listing.basicAmenities) ? listing.basicAmenities : (Array.isArray(listing.BasicAmenities) ? listing.BasicAmenities : []);
    const basicAmenityIds = basicList.map(getId).filter(Boolean);
    const propAmenities = listing.propertyAmenities ?? listing.PropertyAmenities ?? [];
    const propFeatures = listing.propertyFeatures ?? listing.PropertyFeatures ?? [];

    setFormData({
      basicAmenityIds,
      defaultAmenityIds: propAmenities.filter((a) => !isCustom(a)).map(getId).filter(Boolean),
      customAmenityIds: propAmenities.filter(isCustom).map(getId).filter(Boolean),
      defaultFeatureIds: propFeatures.filter((a) => !isCustom(a)).map(getId).filter(Boolean),
      customFeatureIds: propFeatures.filter(isCustom).map(getId).filter(Boolean)
    });
  }, [listing, id]);

  const handleBack = () => navigate(`/landlord/listings/${id}/setup`);

  const handleSave = async () => {
    if (!id || !formData) return;
    setSaving(true);
    const timeoutMs = 20000;
    const timeoutId = setTimeout(() => {
      setSaving(false);
      openSnackbar({
        open: true,
        message: 'Save is taking longer than expected. Please check your connection and try again.',
        variant: 'alert',
        alert: { color: 'warning' }
      });
    }, timeoutMs);
    try {
      // Positive ids (from API) are sent as-is; negative ids are fallbacks—send by name so backend can resolve
      const basicAmenityIds = (formData.basicAmenityIds || []).filter((id) => Number(id) > 0);
      const defaultAmenityIds = (formData.defaultAmenityIds || []).filter((id) => Number(id) > 0);
      const defaultFeatureIds = (formData.defaultFeatureIds || []).filter((id) => Number(id) > 0);
      const { basicAmenitySelections, defaultAmenitySelections, defaultFeatureSelections } = getFallbackSelections(formData);
      const payload = {
        basicAmenityIds,
        defaultAmenityIds,
        customAmenityIds: formData.customAmenityIds ?? [],
        defaultFeatureIds,
        customFeatureIds: formData.customFeatureIds ?? [],
        ...(basicAmenitySelections.length > 0 && { basicAmenitySelections }),
        ...(defaultAmenitySelections.length > 0 && { defaultAmenitySelections }),
        ...(defaultFeatureSelections.length > 0 && { defaultFeatureSelections })
      };
      const result = await dispatch(updateListing(parseInt(id), payload));
      clearTimeout(timeoutId);
      if (result?.success) {
        openSnackbar({ open: true, message: 'Amenities & features saved', variant: 'alert', alert: { color: 'success' } });
        dispatch(getListingById(parseInt(id)));
        navigate(`/landlord/listings/${id}/setup`);
      } else throw new Error(result?.message);
    } catch (e) {
      clearTimeout(timeoutId);
      openSnackbar({
        open: true,
        message: e?.response?.data?.message || e?.message || 'Failed to save',
        variant: 'alert',
        alert: { color: 'error' }
      });
    } finally {
      setSaving(false);
    }
  };

  // Full-page spinner: no listing yet, or listing loaded but formData not yet initialized from it (so BasicAmenityIds from DB are in formData)
  if (!listing && loading && !saving) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: 400 }}>
        <CircularProgress />
      </Box>
    );
  }
  if (!listing) return null;
  if (listing && !formData) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: 400 }}>
        <CircularProgress />
      </Box>
    );
  }

  const propertyDisplay = listing.propertyName || 'Property';
  const unitDisplay = listing.unitName || 'Whole property';
  const addressDisplay = listing.propertyAddress ?? '';

  return (
    <Box>
      <PageBreadcrumbs
        items={[
          { label: 'Listings', path: '/landlord/listings' },
          { label: listing.listingNumber ?? 'Listing' },
          { label: 'Set Up', path: `/landlord/listings/${id}/setup` },
          { label: 'Amenities & features' }
        ]}
      />

      <Box
        sx={{
          mb: 4,
          p: 3,
          borderRadius: 2,
          bgcolor: (t) => alpha(t.palette.background.paper, 0.6),
          border: (t) => `1px solid ${alpha(t.palette.divider, 0.1)}`,
          boxShadow: (t) => `0 2px 8px ${alpha(t.palette.common.black, 0.04)}`
        }}
      >
        <Stack direction="row" justifyContent="space-between" alignItems="flex-start">
          <Stack spacing={1} alignItems="flex-start">
            <Button
              variant="text"
              size="small"
              startIcon={<ArrowLeftOutlined style={{ fontSize: 14 }} />}
              onClick={handleBack}
              sx={{
                color: 'text.secondary',
                textTransform: 'none',
                minWidth: 'auto',
                width: 'fit-content',
                '&:hover': { bgcolor: alpha(theme.palette.primary.main, 0.08) }
              }}
            >
              BACK
            </Button>
            <Typography variant="h4" fontWeight={700}>
              {propertyDisplay} – {unitDisplay}
            </Typography>
            <Typography variant="body2" color="text.secondary">
              {addressDisplay}
            </Typography>
          </Stack>
        </Stack>
      </Box>

      <MainCard
        title="Amenities & features"
        sx={{
          bgcolor: (t) => alpha(t.palette.background.paper, 0.8),
          boxShadow: (t) => `0 4px 20px ${alpha(t.palette.primary.main, 0.15)}`,
          border: `1px solid ${alpha(theme.palette.divider, 0.1)}`,
          borderRadius: 2
        }}
      >
        {formData && (
          <Stack spacing={3}>
            <ListingAmenitiesStep
              formData={formData}
              setFormData={setFormData}
              savedBasicAmenities={Array.isArray(listing.basicAmenities) ? listing.basicAmenities : (Array.isArray(listing.BasicAmenities) ? listing.BasicAmenities : [])}
              savedPropertyAmenities={listing.propertyAmenities ?? listing.PropertyAmenities}
              savedPropertyFeatures={listing.propertyFeatures ?? listing.PropertyFeatures}
            />
            <Stack direction="row" spacing={2}>
              <Button
                variant="outlined"
                onClick={handleBack}
                sx={{ textTransform: 'uppercase', fontWeight: 700, px: 2, py: 1 }}
              >
                Cancel
              </Button>
              <Button
                variant="contained"
                onClick={handleSave}
                disabled={saving}
                sx={{ textTransform: 'uppercase', fontWeight: 700, px: 2, py: 1 }}
              >
                {saving ? 'Saving...' : 'Save'}
              </Button>
            </Stack>
          </Stack>
        )}
      </MainCard>
    </Box>
  );
}
