import { useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import {
  Box,
  Typography,
  Stack,
  Button,
  alpha,
  useTheme
} from '@mui/material';
import { ArrowLeftOutlined } from '@ant-design/icons';
import MainCard from 'components/MainCard';
import PageBreadcrumbs from 'components/breadcrumbs/PageBreadcrumbs';
import PropertySelect from 'components/PropertySelect';
import UnitSelect from 'components/UnitSelect';
import { useDispatch, useSelector } from 'react-redux';
import { createListing } from 'store/listing/listing.action';
import { setProperty } from 'store/property/property.action';
import { selectProperties, selectProperty } from 'store/property/property.selector';
import { selectUnit } from 'store/unit/unit.selector';
import { selectCurrentUser } from 'store/user/user.selector';
import useFetchProperties from 'hooks/useFetchProperties';
import { openSnackbar } from 'api/snackbar';

function getUserContactDisplay(user) {
  if (!user) return { name: '', email: '', phone: '' };
  const first = user.Firstname ?? user.firstname ?? '';
  const last = user.Lastname ?? user.lastname ?? '';
  const name = ([first, last].filter(Boolean).join(' ') || (user.Name ?? user.name ?? ''));
  return {
    name: (name || '').trim(),
    email: ((user.Email ?? user.email) ?? '').trim(),
    phone: ((user.PhoneNumber ?? user.phoneNumber) ?? '').trim()
  };
}

const DEFAULT_CREATE_PAYLOAD = {
  squareFeet: null,
  securityDeposit: null,
  yearBuilt: null,
  dateAvailable: null,
  minLeaseDuration: null,
  maxLeaseDuration: null,
  petsAllowed: false,
  marketingDescription: '',
  videoTourUrl: null,
  acceptOnlineApplications: true,
  applicationFeeRequired: false,
  applicationFee: 0,
  requireScreening: true,
  screeningType: 'Essential',
  requireIncomeVerification: false,
  incomeVerificationCost: 12,
  listingContactId: null,
  listingContactName: null,
  listingContactPhone: null,
  listingContactEmail: null,
  syndicateToListingWebsite: true,
  syndicateToFreeSites: false,
  syndicateToPremiumSites: false,
  basicAmenityIds: [],
  defaultAmenityIds: [],
  customAmenityIds: [],
  defaultFeatureIds: [],
  customFeatureIds: []
};

export default function ListingCreatePage() {
  const theme = useTheme();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const dispatch = useDispatch();
  useFetchProperties();
  const properties = useSelector(selectProperties) ?? [];
  const selectedProperty = useSelector(selectProperty);
  const selectedUnit = useSelector(selectUnit);
  const currentUser = useSelector(selectCurrentUser);
  const [creating, setCreating] = useState(false);

  const propertyIdFromUrl = searchParams.get('propertyId');

  useEffect(() => {
    if (!propertyIdFromUrl || !Array.isArray(properties) || properties.length === 0) return;
    const id = parseInt(propertyIdFromUrl, 10);
    if (Number.isNaN(id)) return;
    const property = properties.find((p) => p.id === id || p.Id === id);
    if (property) {
      dispatch(setProperty(property));
    }
  }, [propertyIdFromUrl, properties, dispatch]);

  const handleBack = () => {
    navigate('/landlord/listings');
  };

  const handleCreateListing = async () => {
    if (!selectedProperty?.id) {
      openSnackbar({
        open: true,
        message: 'Please select a property',
        variant: 'alert',
        alert: { color: 'warning' }
      });
      return;
    }

    setCreating(true);
    try {
      const userContact = getUserContactDisplay(currentUser);
      const payload = {
        propertyId: selectedProperty.id,
        unitId: selectedUnit?.id ?? null,
        monthlyRent: 0,
        ...DEFAULT_CREATE_PAYLOAD,
        listingContactName: userContact.name || null,
        listingContactPhone: userContact.phone || null,
        listingContactEmail: userContact.email || null
      };
      const result = await dispatch(createListing(payload, []));
      if (result?.success && result?.data?.id) {
        openSnackbar({
          open: true,
          message: 'Draft listing created. Complete the setup to publish.',
          variant: 'alert',
          alert: { color: 'success' }
        });
        navigate(`/landlord/listings/${result.data.id}/setup`);
      } else {
        throw new Error(result?.message || 'Failed to create listing');
      }
    } catch (error) {
      openSnackbar({
        open: true,
        message: error?.response?.data?.message || error?.message || 'Failed to create listing',
        variant: 'alert',
        alert: { color: 'error' }
      });
    } finally {
      setCreating(false);
    }
  };

  const isMultiUnit =
    selectedProperty?.propertyType?.toLowerCase() === 'multiunit' ||
    selectedProperty?.propertyType?.toLowerCase() === 'multifamily';

  const propertyPreSelected = Boolean(propertyIdFromUrl && selectedProperty);
  const propertyDisplayName =
    selectedProperty?.name || selectedProperty?.streetAddress || selectedProperty?.StreetAddress || 'Property';

  return (
    <Box>
      <PageBreadcrumbs links={[{ title: 'Listings', to: '/landlord/listings' }, { title: 'Create Listing' }]} />

      <Box
        sx={{
          mb: 4,
          mt: 2,
          p: 3,
          borderRadius: 2,
          bgcolor: (t) => alpha(t.palette.background.paper, 0.6),
          border: (t) => `1px solid ${alpha(t.palette.divider, 0.1)}`,
          boxShadow: (t) => `0 2px 8px ${alpha(t.palette.common.black, 0.04)}`
        }}
      >
        <Stack direction="row" alignItems="center" spacing={1} sx={{ mb: 2 }}>
          <Button
            startIcon={<ArrowLeftOutlined />}
            onClick={handleBack}
            sx={{
              color: 'text.secondary',
              textTransform: 'none',
              minWidth: 'auto',
              '&:hover': { bgcolor: alpha(theme.palette.primary.main, 0.08) }
            }}
          >
            BACK
          </Button>
        </Stack>
        <Typography variant="h4" fontWeight={700} sx={{ mb: 1 }}>
          Create Listing
        </Typography>
        <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
          {propertyPreSelected
            ? (isMultiUnit
                ? 'Select the unit for this listing. A draft will be created and you can complete the setup on the next page.'
                : 'A draft listing will be created for this property. You can complete the setup on the next page.')
            : 'Select the property and unit (if applicable) for this listing. A draft will be created and you can complete the setup on the next page.'}
        </Typography>
      </Box>

      <MainCard
        sx={{
          maxWidth: 640,
          mx: 'auto',
          bgcolor: (t) => alpha(t.palette.background.paper, 0.6),
          boxShadow: (t) => `0 0 20px ${alpha(t.palette.primary.main, 0.08)}`
        }}
      >
        <Stack spacing={3} sx={{ p: 4 }}>
          {propertyPreSelected ? (
            <Box>
              <Typography variant="subtitle1" fontWeight={600} sx={{ mb: 1 }}>
                Property
              </Typography>
              <Typography variant="body1" color="text.secondary">
                {propertyDisplayName}
              </Typography>
            </Box>
          ) : (
            <Box>
              <Typography variant="subtitle1" fontWeight={600} sx={{ mb: 2 }}>
                Property *
              </Typography>
              <PropertySelect width="100%" disableAllOption />
            </Box>
          )}
          {isMultiUnit && (
            <Box>
              <Typography variant="subtitle1" fontWeight={600} sx={{ mb: 2 }}>
                Unit
              </Typography>
              <UnitSelect width="100%" />
            </Box>
          )}
          <Button
            variant="contained"
            size="large"
            onClick={handleCreateListing}
            disabled={creating}
            sx={{ textTransform: 'none', mt: 2 }}
          >
            {creating ? 'Creating...' : 'Create Listing'}
          </Button>
        </Stack>
      </MainCard>
    </Box>
  );
}
