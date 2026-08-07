import { useEffect, useState, useMemo, useRef } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { useDashboardLoading } from 'contexts/DashboardLoadingContext';
import {
  Box,
  Grid,
  Typography,
  Stack,
  Chip,
  Divider,
  Button,
  Tabs,
  Tab,
  Paper,
  IconButton,
  alpha,
  Dialog,
  DialogTitle,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Toolbar,
  TextField,
  InputAdornment,
  ToggleButton,
  ToggleButtonGroup,
  Checkbox,
  Tooltip,
  useTheme,
  MenuItem,
  Select,
  FormControl,
  InputLabel,
  useMediaQuery,
  CircularProgress,
  Card,
  CardContent,
  Fade
} from '@mui/material';
import { HomeOutlined, DollarOutlined, ToolOutlined, ArrowLeftOutlined, EditOutlined, PlusOutlined, SearchOutlined, DeleteOutlined, EnvironmentOutlined, FileTextOutlined, FolderOutlined, CheckCircleOutlined, UploadOutlined, CloseOutlined, EyeOutlined, CloseCircleOutlined, BankOutlined, FallOutlined, RiseOutlined, AppstoreOutlined, CopyOutlined, LinkOutlined } from '@ant-design/icons';
import { useNavigate, useParams, useSearchParams, useLocation } from 'react-router-dom';

// project imports
import MainCard from 'components/MainCard';
import Avatar from 'components/@extended/Avatar';
import useFetchProperty from 'hooks/useFetchProperty';
import { getPropertyTypeLabel, parseDecimalToCurrency, formatDate, formatCurrency } from 'utils/formatters';
import { getNextDueDate } from 'utils/helper-methods';
import useFetchRentCollection from 'hooks/useFetchRentCollection';
import useFetchMaintenances from 'hooks/useFetchMaintenances';
import LeaseOverviewCard from 'components/cards/LeaseOverviewCard';
import PropertyEditDrawer from 'components/drawers/PropertyEditDrawer';
import ListingAddWorkflowDrawer from 'components/drawers/ListingAddWorkflowDrawer';
import { useDrawer } from 'contexts/DrawerContext';
import { DeleteOutline } from '@mui/icons-material';
import ConfirmationDialog from 'components/dialogs/ConfirmationDialog';
import DeletePropertyModal from 'components/dialogs/DeletePropertyModal';
import { inactivateProperty, reactivateProperty, setProperty, addPropertyImages, addOrUpdateProperty } from 'store/property/property.action';
import { selectPropertyLoading, selectProperty } from 'store/property/property.selector';
import { createListing } from 'store/listing/listing.action';
import { selectCurrentUser } from 'store/user/user.selector';
import { selectMaintenanceLoading } from 'store/maintenance/maintenance.selector';
import HouseholdEditDrawer from 'components/drawers/HouseholdEditDrawer';
import BulkLeaseManagement from 'components/property/BulkLeaseManagement';
import BulkUnitCreateDrawer from 'components/drawers/BulkUnitCreateDrawer';
import UnitEditDrawer from 'components/drawers/UnitEditDrawer';
import { deleteUnit } from 'store/unit/unit.action';
import { openSnackbar } from 'api/snackbar';
import PropertyMap from 'components/maps/PropertyMap';
import { addOrUpdateLease, setLease, deleteLease } from 'store/lease/lease.action';
import { useFormik, FormikProvider, Form } from 'formik';
import * as Yup from 'yup';
import { LeaseFields, buildInitialValues } from 'components/fields/LeaseFields';
import DialogContent from '@mui/material/DialogContent';
import DialogActions from '@mui/material/DialogActions';
import LeaseEditDrawer from 'components/drawers/LeaseEditDrawer';
import LeaseAddDrawer from 'components/drawers/LeaseAddDrawer';
import { applicationAPI } from 'api';
import listingApi from 'api/listing';

// Enhanced components
import PropertyHeader from 'sections/landlord/property/PropertyHeader';
import PropertyMetrics from 'sections/landlord/property/PropertyMetrics';
import PropertyHero from 'sections/landlord/property/PropertyHero';
import MaintenanceTab from 'sections/landlord/property/MaintenanceTab';
import MarketingTab from 'sections/landlord/property/MarketingTab';
import DocumentsTab from 'sections/landlord/property/DocumentsTab';
import ExpensesTab from 'sections/landlord/property/ExpensesTab';
import OverviewTab from 'sections/landlord/property/OverviewTab';
import PropertyOverview from 'sections/landlord/property/PropertyOverview';
import LandlordMaintenanceDrawer from 'components/drawers/LandlordMaintenanceDrawer';
import { bankAccountAPI } from 'api';
import axiosServices from 'utils/axios';
import StripeConnectOnboardingDialog from 'components/dialogs/StripeConnectOnboardingDialog';
import AnimateIn from 'components/AnimateIn';
import PageBreadcrumbs from 'components/breadcrumbs/PageBreadcrumbs';
import FeatureReadinessNotice from 'components/feature-readiness/FeatureReadinessNotice';
import useFeatureReadiness from 'hooks/useFeatureReadiness';
import { FEATURE_KEYS } from 'utils/featureReadiness';
import PropertyLeasingPipeline from 'components/leasing-pipeline/PropertyLeasingPipeline';

// Default payload for creating a draft listing (same as listing-create page)
const DEFAULT_LISTING_CREATE_PAYLOAD = {
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

function getUserContactDisplay(user) {
  if (!user) return { name: '', email: '', phone: '' };
  const first = user.Firstname ?? user.firstname ?? '';
  const last = user.Lastname ?? user.lastname ?? '';
  const name = ([first, last].filter(Boolean).join(' ') || (user.Name ?? user.name ?? '')).trim();
  return {
    name: name || '',
    email: ((user.Email ?? user.email) ?? '').trim(),
    phone: ((user.PhoneNumber ?? user.phoneNumber ?? '')).trim()
  };
}

// Application Status Options (same as applications page)
const APPLICATION_STATUSES = [
  { value: 0, label: 'Draft', color: 'default' },
  { value: 1, label: 'Submitted', color: 'success' },
  { value: 2, label: 'Under Review', color: 'warning' },
  { value: 3, label: 'Approved', color: 'success' },
  { value: 4, label: 'Rejected', color: 'error' },
  { value: 5, label: 'Withdrawn', color: 'default' },
  { value: 6, label: 'On Hold', color: 'warning' },
  { value: 7, label: 'Lease Signed', color: 'success' },
  { value: 8, label: 'Pending', color: 'warning' }
];

// Summary Tab Component
function SummaryTab({ property, onRefresh, onImageUpload, uploading }) {
  const drawer = useDrawer();
  const theme = useTheme();
  const navigate = useNavigate();
  const dispatch = useDispatch();
  const { presentation: rentReadiness, canInvoke: rentCanInvoke } = useFeatureReadiness(FEATURE_KEYS.onlineRentCollection);
  const [operatingAccount, setOperatingAccount] = useState(null);
  const [loadingAccount, setLoadingAccount] = useState(false);
  const [bankingModalOpen, setBankingModalOpen] = useState(false);
  const [deleteModalOpen, setDeleteModalOpen] = useState(false);
  const [bankAccounts, setBankAccounts] = useState([]);
  const [loadingBankAccounts, setLoadingBankAccounts] = useState(false);
  const [selectedAccountId, setSelectedAccountId] = useState(property?.operatingAccountId || null);
  const [savingBankAccount, setSavingBankAccount] = useState(false);
  const [showStripeOnboarding, setShowStripeOnboarding] = useState(false);

  // Clean street address to remove any zip code that might be included

  const cleanStreetAddress = useMemo(() => {

    if (!property?.streetAddress) return '';
    let streetOnly = property.streetAddress;
    if (property.streetAddress.includes(',')) {
      // If there's a comma, take the part before it (the actual street address)
      const parts = property.streetAddress.split(',');
      streetOnly = parts[0].trim();
    } else {
      // If no comma, check if it ends with a zip code pattern (5 digits)
      const zipCodePattern = /\s+\d{5}(-\d{4})?$/;
      if (zipCodePattern.test(property.streetAddress)) {
        streetOnly = property.streetAddress.replace(zipCodePattern, '').trim();
      }
    }
    return streetOnly;
  }, [property?.streetAddress]);

  // Format address as: streetAddress, city, state zipCode
  const fullAddress = useMemo(() => {
    if (!cleanStreetAddress) return '';
    const parts = [cleanStreetAddress];
    if (property?.city) parts.push(property.city);
    if (property?.state) {
      if (property?.zipCode) {
        parts.push(`${property.state} ${property.zipCode}`);
      } else {
        parts.push(property.state);
      }
    } else if (property?.zipCode) {
      parts.push(property.zipCode);
    }
    return parts.join(', ');
  }, [cleanStreetAddress, property?.city, property?.state, property?.zipCode]);

  const handleMapIt = () => {
    if (property?.streetAddress) {
      const mapsUrl = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(fullAddress)}`;
      window.open(mapsUrl, '_blank');
    }
  };

  // Fetch operating account details
  useEffect(() => {
    const fetchOperatingAccount = async () => {
      if (!rentCanInvoke || !property?.operatingAccountId) {
        setOperatingAccount(null);
        setLoadingAccount(false);
        return;
      }
      if (property?.operatingAccountId) {
        setLoadingAccount(true);
        try {
          const response = await bankAccountAPI.getBankAccount(property.operatingAccountId);
          if (response.success && response.data) {
            setOperatingAccount(response.data);
          }
        } catch (error) {
          console.error('Error fetching operating account:', error);
        } finally {
          setLoadingAccount(false);
        }
      } else {
        setOperatingAccount(null);
      }
    };

    fetchOperatingAccount();
  }, [property?.operatingAccountId, rentCanInvoke]);

  // Fetch bank accounts when modal opens
  useEffect(() => {
    const fetchBankAccounts = async () => {
      if (!bankingModalOpen || !rentCanInvoke) {
        setLoadingBankAccounts(false);
        return;
      }
      if (bankingModalOpen) {
        setLoadingBankAccounts(true);
        try {
          const response = await bankAccountAPI.getBankAccounts();
          if (response.success && response.data) {
            setBankAccounts(response.data || []);
            setSelectedAccountId(property?.operatingAccountId || null);
          }
        } catch (error) {
          console.error('Error fetching bank accounts:', error);
          openSnackbar({
            open: true,
            message: 'Failed to load bank accounts',
            variant: 'alert',
            alert: { color: 'error' }
          });
        } finally {
          setLoadingBankAccounts(false);
        }
      }
    };

    fetchBankAccounts();
  }, [bankingModalOpen, property?.operatingAccountId, rentCanInvoke]);

  useEffect(() => {
    if (!rentCanInvoke) {
      setBankingModalOpen(false);
      setShowStripeOnboarding(false);
      setBankAccounts([]);
      setSelectedAccountId(null);
    }
  }, [rentCanInvoke]);

  // Handle saving bank account selection
  const handleSaveBankAccount = async () => {
    if (!rentCanInvoke || !property?.id) return;

    setSavingBankAccount(true);
    try {
      // Update property with selected operating account using the dispatch action
      const updatedProperty = {
        ...property,
        operatingAccountId: selectedAccountId || null
      };

      await dispatch(addOrUpdateProperty(updatedProperty));
      
      openSnackbar({
        open: true,
        message: 'Banking information updated successfully',
        variant: 'alert',
        alert: { color: 'success' }
      });
      setBankingModalOpen(false);
      onRefresh(); // Refresh property data
    } catch (error) {
      console.error('Error updating banking information:', error);
      openSnackbar({
        open: true,
        message: error?.response?.data?.message || 'Failed to update banking information',
        variant: 'alert',
        alert: { color: 'error' }
      });
    } finally {
      setSavingBankAccount(false);
    }
  };

  // Handler for when Stripe onboarding completes
  const handleStripeOnboardingComplete = async () => {
    if (!rentCanInvoke) return;
    // Close the Stripe onboarding dialog
    setShowStripeOnboarding(false);
    
    // Ensure banking modal stays open
    if (!bankingModalOpen) {
      setBankingModalOpen(true);
    }
    
    // Wait a moment for Stripe to process, then sync bank account
    await new Promise(resolve => setTimeout(resolve, 1000));
    
    try {
      // Sync bank account with backend
      await axiosServices.post('/api/stripe/sync-bank-account');
    } catch (error) {
      console.error('Error syncing bank account:', error);
    }
    
    // Wait a bit more, then refresh bank accounts list
    await new Promise(resolve => setTimeout(resolve, 1000));
    
    try {
      const response = await bankAccountAPI.getBankAccounts();
      if (response.success && response.data) {
        setBankAccounts(response.data || []);
        // Auto-select the most recently created account
        if (response.data.length > 0) {
          const newestAccount = response.data[0];
          setSelectedAccountId(newestAccount.id);
        }
      }
    } catch (error) {
      console.error('Error refreshing bank accounts after onboarding:', error);
    }
    
    // Refresh property data to get updated operating account
    onRefresh();
  };

  return (
    <Box>
      <Grid container spacing={3} alignItems="stretch">
        {/* Property Details Section */}
        <Grid size={{ xs: 12, md: 6 }}>
          <MainCard
            sx={{
              mb: 3,
              bgcolor: (t) => alpha(t.palette.background.paper, 0.8),
              boxShadow: (t) => `0 4px 20px ${alpha(t.palette.primary.main, 0.15)}`,
              border: `1px solid ${alpha(theme.palette.divider, 0.1)}`,
              borderRadius: 2,
              transition: 'all 0.3s ease-in-out',
              '&:hover': {
                boxShadow: (t) => `0 8px 32px ${alpha(t.palette.primary.main, 0.25)}`,
                transform: 'translateY(-4px)',
                bgcolor: (t) => alpha(t.palette.background.paper, 0.95)
              },
              height: '100%',
              display: 'flex',
              flexDirection: 'column'
            }}
      >
        {/* Section Header */}
        <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 2 }}>
          <Typography variant="h6" fontWeight={600}>
            Property Details
          </Typography>
          <Stack direction="column" alignItems="flex-end" spacing={0.5}>
            <Button
              onClick={() => drawer.openPropertyEditDrawer(property)}
              variant="text"
              size="small"
              startIcon={<EditOutlined style={{ fontSize: 16 }} />}
              sx={{ color: 'primary.main', textTransform: 'none', '&:hover': { bgcolor: alpha(theme.palette.primary.main, 0.08) } }}
            >
              Edit
            </Button>
            <Button
              onClick={() => setDeleteModalOpen(true)}
              variant="text"
              size="small"
              startIcon={<DeleteOutlined style={{ fontSize: 16 }} />}
              sx={{ color: 'error.main', textTransform: 'none', '&:hover': { bgcolor: alpha(theme.palette.error.main, 0.08) } }}
            >
              Delete Property
            </Button>
          </Stack>
        </Stack>
        <Divider sx={{ mb: 3 }} />

        <Box sx={{ flex: 1 }}>
          <Grid container spacing={3}>
          {/* Left Side - Image */}
          <Grid size={{ xs: 12, md: 4 }}>
            <Stack spacing={1.5}>
              <Box
                sx={{
                  width: '100%',
                  height: 200,
                  borderRadius: 2,
                  overflow: 'hidden',
                  position: 'relative',
                  bgcolor: alpha(theme.palette.primary.main, 0.05),
                  border: `1px solid ${alpha(theme.palette.divider, 0.1)}`
                }}
              >
                {(property?.mainImageUrl || (property?.images && property.images.length > 0)) ? (
                  <Box
                    component="img"
                    src={property?.mainImageUrl || property.images[0]?.blobUrl}
                    alt={property.name || 'Property'}
                    onError={(e) => {
                      // If mainImageUrl fails, try falling back to first image
                      if (property?.mainImageUrl && property?.images && property.images.length > 0) {
                        const target = e.target;
                        target.src = property.images[0]?.blobUrl || '';
                        // If that also fails, hide the image
                        target.onerror = () => {
                          target.style.display = 'none';
                        };
                      } else {
                        // Hide image if no fallback available
                        e.target.style.display = 'none';
                      }
                    }}
                    sx={{
                      width: '100%',
                      height: '100%',
                      objectFit: 'cover'
                    }}
                  />
                ) : (
                  <Box
                    sx={{
                      width: '100%',
                      height: '100%',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      flexDirection: 'column',
                      gap: 1
                    }}
                  >
                    <HomeOutlined style={{ fontSize: 48, color: alpha(theme.palette.text.secondary, 0.3) }} />
                  </Box>
                )}
              </Box>
              <Button
                variant="text"
                size="small"
                startIcon={<UploadOutlined style={{ fontSize: 14 }} />}
                onClick={() => {
                  const input = document.createElement('input');
                  input.type = 'file';
                  input.accept = 'image/*';
                  input.multiple = true;
                  input.onchange = (e) => {
                    if (e.target.files && e.target.files.length > 0) {
                      onImageUpload(Array.from(e.target.files));
                    }
                  };
                  input.click();
                }}
                disabled={uploading}
                sx={{
                  color: 'primary.main',
                  textTransform: 'none',
                  alignSelf: 'flex-start',
                  '&:hover': {
                    bgcolor: alpha(theme.palette.primary.main, 0.08)
                  }
                }}
              >
                {uploading ? 'Uploading...' : 'Upload photo'}
              </Button>
            </Stack>
          </Grid>

          {/* Right Side - Property Information */}
          <Grid size={{ xs: 12, md: 8 }}>
            <Stack spacing={2}>
              {/* Address */}
              {fullAddress && (
                <Stack spacing={1}>
                  <Typography variant="caption" color="text.secondary" fontWeight={600} sx={{ textTransform: 'uppercase', letterSpacing: 0.5 }}>
                    Address
                  </Typography>
                  <Typography 
                    variant="body1" 
                    color="text.primary"
                  >
                    {fullAddress}
                  </Typography>
                  <Button
                    variant="text"
                    size="small"
                    startIcon={<EnvironmentOutlined style={{ fontSize: 14 }} />}
                    onClick={handleMapIt}
                    sx={{
                      color: 'primary.main',
                      textTransform: 'none',
                      alignSelf: 'flex-start',
                      px: 1,
                      '&:hover': {
                        bgcolor: alpha(theme.palette.primary.main, 0.08)
                      }
                    }}
                  >
                    Map it
                  </Button>
                </Stack>
              )}

              {/* Property Manager */}
              <Stack spacing={1}>
                <Typography variant="caption" color="text.secondary" fontWeight={600} sx={{ textTransform: 'uppercase', letterSpacing: 0.5 }}>
                  Property Manager
                </Typography>
                <Typography variant="body1" color="text.primary">
                  {property?.primaryManagerName || property?.propertyManager || 'Not assigned'}
                </Typography>
              </Stack>

              {/* Property Details: Units (for multi-unit) or Beds, Bath, Sqft (for single-family) */}
              {(() => {
                const isMultiUnit = property?.propertyType === 'multiUnit' || property?.propertyType === 'MultiUnit';
                const unitsCount = property?.units?.length || 0;
                
                if (isMultiUnit && unitsCount > 0) {
                  return (
                    <Stack direction="row" spacing={3} flexWrap="wrap">
                      <Stack spacing={0.5}>
                        <Typography variant="body2" color="text.secondary">
                          Units
                        </Typography>
                        <Typography variant="body1" color="text.primary" fontWeight={500}>
                          {unitsCount}
                        </Typography>
                      </Stack>
                    </Stack>
                  );
                }
                
                // For single-family, show Beds, Bath, Sqft
                const firstUnit = property?.units?.[0];
                const beds = firstUnit?.bedrooms || firstUnit?.Bedrooms;
                const baths = firstUnit?.baths || firstUnit?.Baths;
                const sqft = firstUnit?.squareFeet || firstUnit?.SquareFeet;
                
                if (beds || baths || sqft) {
                  return (
                    <Stack direction="row" spacing={3} flexWrap="wrap">
                      {beds && (
                        <Stack spacing={0.5}>
                          <Typography variant="body2" color="text.secondary">
                            Beds
                          </Typography>
                          <Typography variant="body1" color="text.primary" fontWeight={500}>
                            {beds}
                          </Typography>
                        </Stack>
                      )}
                      {baths && (
                        <Stack spacing={0.5}>
                          <Typography variant="body2" color="text.secondary">
                            Baths
                          </Typography>
                          <Typography variant="body1" color="text.primary" fontWeight={500}>
                            {baths}
                          </Typography>
                        </Stack>
                      )}
                      {sqft && (
                        <Stack spacing={0.5}>
                          <Typography variant="body2" color="text.secondary">
                            Sqft
                          </Typography>
                          <Typography variant="body1" color="text.primary" fontWeight={500}>
                            {sqft.toLocaleString()}
                          </Typography>
                        </Stack>
                      )}
                    </Stack>
                  );
                }
                return null;
              })()}

              {/* Rental Owners */}
              {property?.rentalOwners && property.rentalOwners.length > 0 && (
                <Stack spacing={1}>
                  <Typography variant="caption" color="text.secondary" fontWeight={600} sx={{ textTransform: 'uppercase', letterSpacing: 0.5 }}>
                    Rental Owners
                  </Typography>
                  {property.rentalOwners.map((owner, index) => (
                    <Stack key={index} direction="row" spacing={1} alignItems="center">
                      <Typography variant="body1" color="text.primary">
                        {owner.name || owner}
                      </Typography>
                      {owner.percentage && (
                        <Typography variant="body2" color="text.secondary">
                          {owner.percentage}%
                        </Typography>
                      )}
                    </Stack>
                  ))}
                </Stack>
              )}
            </Stack>
          </Grid>
        </Grid>
        </Box>
      </MainCard>
        </Grid>

        {/* Banking Information Section - Side by side on larger screens */}
        <Grid size={{ xs: 12, md: 6 }}>
          <MainCard
            sx={{
              mb: 3,
              bgcolor: (t) => alpha(t.palette.background.paper, 0.8),
              boxShadow: (t) => `0 4px 20px ${alpha(t.palette.primary.main, 0.15)}`,
              border: `1px solid ${alpha(theme.palette.divider, 0.1)}`,
              borderRadius: 2,
              transition: 'all 0.3s ease-in-out',
              '&:hover': {
                boxShadow: (t) => `0 8px 32px ${alpha(t.palette.primary.main, 0.25)}`,
                transform: 'translateY(-4px)',
                bgcolor: (t) => alpha(t.palette.background.paper, 0.95)
              },
              height: '100%',
              display: 'flex',
              flexDirection: 'column'
            }}
          >
            {/* Section Header */}
            <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 2 }}>
              <Typography variant="h6" fontWeight={600}>
                Banking Information
              </Typography>
            </Stack>
            <Divider sx={{ mb: 3 }} />

            <Box sx={{ flex: 1 }}>
              {!rentCanInvoke ? (
                <FeatureReadinessNotice presentation={rentReadiness} featureName="Online rent collection" />
              ) : loadingAccount ? (
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                  <CircularProgress size={16} />
                  <Typography variant="body2" color="text.secondary">
                    Loading bank information...
                  </Typography>
                </Box>
              ) : operatingAccount ? (
                <Card
                  variant="outlined"
                  sx={{
                    bgcolor: alpha(theme.palette.info.main, 0.05),
                    border: (theme) => `1px solid ${alpha(theme.palette.info.main, 0.2)}`
                  }}
                >
                  <CardContent sx={{ p: 2, '&:last-child': { pb: 2 } }}>
                    <Stack spacing={1.5}>
                      <Stack direction="row" spacing={1.5} alignItems="center">
                        <Box
                          sx={{
                            p: 1,
                            borderRadius: 1,
                            bgcolor: alpha(theme.palette.info.main, 0.1),
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center'
                          }}
                        >
                          <BankOutlined style={{ fontSize: 18, color: theme.palette.info.main }} />
                        </Box>
                        <Typography variant="body2" color="text.secondary" fontWeight={600}>
                          Connected Bank Account
                        </Typography>
                      </Stack>
                      <Stack spacing={1}>
                        <Stack spacing={0.5}>
                          <Typography variant="body2" color="text.primary" fontWeight={500}>
                            {operatingAccount.displayName || 'Bank Account'}
                          </Typography>
                          {operatingAccount.bankName && (
                            <Typography variant="caption" color="text.secondary">
                              {operatingAccount.bankName}
                              {operatingAccount.last4 && ` • ****${operatingAccount.last4}`}
                            </Typography>
                          )}
                          {!operatingAccount.bankName && operatingAccount.last4 && (
                            <Typography variant="caption" color="text.secondary">
                              Account ending in {operatingAccount.last4}
                            </Typography>
                          )}
                        </Stack>
                        <Button
                          size="small"
                          variant="outlined"
                          startIcon={<EditOutlined style={{ fontSize: 14 }} />}
                          onClick={() => setBankingModalOpen(true)}
                          sx={{
                            textTransform: 'none',
                            alignSelf: 'flex-start',
                            color: 'info.main',
                            borderColor: 'info.main',
                            '&:hover': {
                              borderColor: 'info.dark',
                              bgcolor: alpha(theme.palette.info.main, 0.08)
                            }
                          }}
                        >
                          Switch Bank Account
                        </Button>
                      </Stack>
                    </Stack>
                  </CardContent>
                </Card>
              ) : (
                <Card
                  variant="outlined"
                  sx={{
                    bgcolor: alpha(theme.palette.info.main, 0.05),
                    border: (theme) => `1px solid ${alpha(theme.palette.info.main, 0.2)}`
                  }}
                >
                  <CardContent sx={{ p: 2, '&:last-child': { pb: 2 } }}>
                    <Stack spacing={1.5}>
                      <Stack direction="row" spacing={1.5} alignItems="center">
                        <Box
                          sx={{
                            p: 1,
                            borderRadius: 1,
                            bgcolor: alpha(theme.palette.info.main, 0.1),
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center'
                          }}
                        >
                          <BankOutlined style={{ fontSize: 18, color: theme.palette.info.main }} />
                        </Box>
                        <Typography variant="body2" color="text.secondary" fontWeight={600}>
                          Connected Bank Account
                        </Typography>
                      </Stack>
                      <Stack spacing={1}>
                        <Typography variant="body2" color="text.secondary">
                          No bank account connected
                        </Typography>
                        <Button
                          size="small"
                          variant="outlined"
                          startIcon={<PlusOutlined style={{ fontSize: 14 }} />}
                          onClick={() => setBankingModalOpen(true)}
                          sx={{
                            textTransform: 'none',
                            alignSelf: 'flex-start',
                            color: 'info.main',
                            borderColor: 'info.main',
                            '&:hover': {
                              borderColor: 'info.dark',
                              bgcolor: alpha(theme.palette.info.main, 0.08)
                            }
                          }}
                        >
                          Connect Bank Account
                        </Button>
                      </Stack>
                    </Stack>
                  </CardContent>
                </Card>
              )}
            </Box>
          </MainCard>
        </Grid>
      </Grid>

      {/* Leasing Information Section - Only show for single-family properties */}
      {property?.propertyType !== 'multiUnit' && (
      <MainCard
        sx={{
          mt: 3,
          mb: 3,
          bgcolor: (t) => alpha(t.palette.background.paper, 0.8),
          boxShadow: (t) => `0 4px 20px ${alpha(t.palette.primary.main, 0.15)}`,
          border: `1px solid ${alpha(theme.palette.divider, 0.1)}`,
          borderRadius: 2,
          transition: 'all 0.3s ease-in-out',
          '&:hover': {
            boxShadow: (t) => `0 2px 12px ${alpha(t.palette.primary.main, 0.1)}`,
            transform: 'translateY(2px)',
            bgcolor: (t) => alpha(t.palette.background.paper, 0.6)
          }
        }}
      >
        {/* Section Header */}
        <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 2 }}>
          <Typography variant="h6" fontWeight={600}>
            Leasing information
          </Typography>
          {property?.units?.[0]?.lease ? (
            <Button
              onClick={() => {
                navigate(`/landlord/leases/${property.units[0].lease.id}`);
              }}
              variant="text"
              size="small"
              startIcon={<EyeOutlined style={{ fontSize: 16 }} />}
              sx={{
                color: 'primary.main',
                textTransform: 'none',
                '&:hover': {
                  bgcolor: alpha(theme.palette.primary.main, 0.08)
                }
              }}
            >
              View
            </Button>
          ) : (
            <Button
              onClick={() => drawer.openLeaseAddDrawer?.()}
              variant="text"
              size="small"
              startIcon={<PlusOutlined style={{ fontSize: 16 }} />}
              sx={{
                color: 'primary.main',
                textTransform: 'none',
                '&:hover': {
                  bgcolor: alpha(theme.palette.primary.main, 0.08)
                }
              }}
            >
              Create Lease
            </Button>
          )}
        </Stack>
        <Divider sx={{ mb: 3 }} />

        {(() => {
          const unit = property?.units?.[0];
          const lease = unit?.lease;
          const hasLease = !!lease;
          const tenants = unit?.tenants || [];

          if (!hasLease) {
            return (
              <Box sx={{ p: 4, textAlign: 'center' }}>
                <HomeOutlined style={{ fontSize: 64, color: alpha(theme.palette.text.secondary, 0.3) }} />
                <Typography variant="h6" color="text.secondary" sx={{ mt: 2 }}>
                  No active lease
                </Typography>
                <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
                  Create a lease to start tracking rental information and tenant details.
                </Typography>
                <Button
                  variant="text"
                  startIcon={<PlusOutlined style={{ fontSize: 16 }} />}
                  onClick={() => drawer.openLeaseAddDrawer?.()}
                  sx={{
                    color: 'primary.main',
                    textTransform: 'none',
                    mt: 2,
                    '&:hover': {
                      bgcolor: alpha(theme.palette.primary.main, 0.08)
                    }
                  }}
                >
                  Create Lease
                </Button>
              </Box>
            );
          }

          const leaseStartDate = lease?.startDate || lease?.StartDate;
          const leaseEndDate = lease?.endDate || lease?.EndDate;
          const rentAmount = lease?.rentAmount || lease?.RentAmount || 0;
          const rentFrequency = lease?.rentFrequency || lease?.RentFrequency || 'Monthly';
          const rentDueDay = lease?.rentDueDay || lease?.RentDueDay || 1;
          const leaseLength = lease?.leaseLength || lease?.LeaseLength || 12;
          
          // Calculate next due date
          const nextDueDate = leaseStartDate ? getNextDueDate(leaseStartDate, rentFrequency, rentDueDay) : null;

          return (
            <Grid container spacing={3}>
              {/* Left Side - Lease Status and Key Info */}
              <Grid size={{ xs: 12, md: 4 }}>
                <Stack spacing={2}>
                  <Box
                    sx={{
                      width: '100%',
                      p: 3,
                      borderRadius: 2,
                      bgcolor: alpha(theme.palette.primary.main, 0.05),
                      border: `1px solid ${alpha(theme.palette.divider, 0.1)}`
                    }}
                  >
                    <Stack spacing={2}>
                      <Stack direction="row" justifyContent="space-between" alignItems="center">
                        <Typography variant="caption" color="text.secondary" fontWeight={600} sx={{ textTransform: 'uppercase', letterSpacing: 0.5 }}>
                          Lease Status
                        </Typography>
                        <Chip
                          label={lease?.isActive ? 'Active' : 'Inactive'}
                          color={lease?.isActive ? 'success' : 'default'}
                          size="small"
                          sx={{ fontWeight: 600 }}
                        />
                      </Stack>
                      <Divider />
                      <Stack spacing={1}>
                        <Typography variant="caption" color="text.secondary" fontWeight={600} sx={{ textTransform: 'uppercase', letterSpacing: 0.5 }}>
                          Monthly Rent
                        </Typography>
                        <Typography variant="h5" color="primary.main" fontWeight={700}>
                          {formatCurrency(rentAmount)}
                        </Typography>
                        <Typography variant="body2" color="text.secondary">
                          Due on day {rentDueDay} of each {rentFrequency.toLowerCase()} period
                        </Typography>
                      </Stack>
                      
                      {/* Lease Agreement Status */}
                      <Divider sx={{ my: 2 }} />
                      <Stack spacing={1.5}>
                        <Typography variant="caption" color="text.secondary" fontWeight={600} sx={{ textTransform: 'uppercase', letterSpacing: 0.5 }}>
                          Lease Agreement Status
                        </Typography>
                        {(() => {
                          // Agreement is created if lease exists and has a finalized instance or tenant document
                          // For now, we'll check if lease exists (tenant document check would require API call)
                          const hasAgreement = !!lease;
                          const hasBeenSentForSignature = !!lease?.signatureSentAt;
                          const landlordSigned = !!lease?.landlordSignedAt;
                          const tenantSignatures = tenants?.map(t => ({
                            name: `${t.firstname || t.Firstname || ''} ${t.lastname || t.Lastname || ''}`.trim() || 'Tenant',
                            signed: !!t.tenantSignedAt || !!t.TenantSignedAt
                          })) || [];
                          const allTenantsSigned = tenantSignatures.length > 0 && tenantSignatures.every(t => t.signed);
                          
                          if (!hasAgreement) {
                            return (
                              <Stack spacing={1}>
                                <Stack direction="row" spacing={1} alignItems="center">
                                  <CloseCircleOutlined style={{ fontSize: 16, color: theme.palette.text.secondary }} />
                                  <Typography variant="body2" color="text.secondary">
                                    Agreement not created
                                  </Typography>
                                </Stack>
                              </Stack>
                            );
                          }
                          
                          return (
                            <Stack spacing={1.5}>
                              {/* Agreement Created Status */}
                              <Stack direction="row" spacing={1} alignItems="center">
                                <CheckCircleOutlined style={{ fontSize: 16, color: theme.palette.success.main }} />
                                <Typography variant="body2" color="text.primary">
                                  Agreement created
                                </Typography>
                              </Stack>
                              
                              {/* Sent for Signature Status */}
                              <Stack direction="row" spacing={1} alignItems="center">
                                {hasBeenSentForSignature ? (
                                  <CheckCircleOutlined style={{ fontSize: 16, color: theme.palette.info.main }} />
                                ) : (
                                  <CloseCircleOutlined style={{ fontSize: 16, color: theme.palette.text.secondary }} />
                                )}
                                <Typography variant="body2" color={hasBeenSentForSignature ? 'text.primary' : 'text.secondary'}>
                                  {hasBeenSentForSignature ? 'Sent for signature' : 'Not sent for signature'}
                                </Typography>
                              </Stack>
                              
                              {/* Landlord Signature Status */}
                              <Stack direction="row" spacing={1} alignItems="center" justifyContent="space-between">
                                <Stack direction="row" spacing={1} alignItems="center">
                                  {landlordSigned ? (
                                    <CheckCircleOutlined style={{ fontSize: 16, color: theme.palette.success.main }} />
                                  ) : (
                                    <CloseCircleOutlined style={{ fontSize: 16, color: theme.palette.text.secondary }} />
                                  )}
                                  <Typography variant="body2" color={landlordSigned ? 'text.primary' : 'text.secondary'}>
                                    You {landlordSigned ? 'signed' : 'not signed'}
                                  </Typography>
                                </Stack>
                                {landlordSigned && lease?.landlordSignedAt && (
                                  <Typography variant="caption" color="text.secondary">
                                    {formatDate(lease.landlordSignedAt)}
                                  </Typography>
                                )}
                              </Stack>
                              
                              {/* Tenant Signature Status */}
                              {tenantSignatures.map((tenant, index) => (
                                <Stack key={index} direction="row" spacing={1} alignItems="center" justifyContent="space-between">
                                  <Stack direction="row" spacing={1} alignItems="center">
                                    {tenant.signed ? (
                                      <CheckCircleOutlined style={{ fontSize: 16, color: theme.palette.success.main }} />
                                    ) : (
                                      <CloseCircleOutlined style={{ fontSize: 16, color: theme.palette.text.secondary }} />
                                    )}
                                    <Typography variant="body2" color={tenant.signed ? 'text.primary' : 'text.secondary'}>
                                      {tenant.name} {tenant.signed ? 'signed' : 'not signed'}
                                    </Typography>
                                  </Stack>
                                  {tenant.signed && (() => {
                                    const tenantData = tenants[index];
                                    const signedAt = tenantData?.tenantSignedAt || tenantData?.TenantSignedAt;
                                    return signedAt ? (
                                      <Typography variant="caption" color="text.secondary">
                                        {formatDate(signedAt)}
                                      </Typography>
                                    ) : null;
                                  })()}
                                </Stack>
                              ))}
                              
                              {/* Overall Status */}
                              {landlordSigned && allTenantsSigned && (
                                <Chip
                                  label="Fully Signed"
                                  color="success"
                                  size="small"
                                  icon={<CheckCircleOutlined />}
                                  sx={{ alignSelf: 'flex-start', mt: 0.5 }}
                                />
                              )}
                            </Stack>
                          );
                        })()}
                      </Stack>
                    </Stack>
                  </Box>
                </Stack>
              </Grid>

              {/* Right Side - Lease Details */}
              <Grid size={{ xs: 12, md: 8 }}>
                <Stack spacing={3}>
                  {/* Lease Dates */}
                  <Stack spacing={1}>
                    <Typography variant="caption" color="text.secondary" fontWeight={600} sx={{ textTransform: 'uppercase', letterSpacing: 0.5 }}>
                      Lease Term
                    </Typography>
                    <Stack direction="row" spacing={3} flexWrap="wrap">
                      {leaseStartDate && (
                        <Stack spacing={0.5}>
                          <Typography variant="body2" color="text.secondary">
                            Start Date
                          </Typography>
                          <Typography variant="body1" color="text.primary" fontWeight={500}>
                            {formatDate(leaseStartDate)}
                          </Typography>
                        </Stack>
                      )}
                      {leaseEndDate && (
                        <Stack spacing={0.5}>
                          <Typography variant="body2" color="text.secondary">
                            End Date
                          </Typography>
                          <Typography variant="body1" color="text.primary" fontWeight={500}>
                            {formatDate(leaseEndDate)}
                          </Typography>
                        </Stack>
                      )}
                      <Stack spacing={0.5}>
                        <Typography variant="body2" color="text.secondary">
                          Duration
                        </Typography>
                        <Typography variant="body1" color="text.primary" fontWeight={500}>
                          {leaseLength} {leaseLength === 1 ? 'month' : 'months'}
                        </Typography>
                      </Stack>
                    </Stack>
                  </Stack>

                  {/* Payment Details */}
                  <Stack spacing={1}>
                    <Typography variant="caption" color="text.secondary" fontWeight={600} sx={{ textTransform: 'uppercase', letterSpacing: 0.5 }}>
                      Payment Details
                    </Typography>
                    <Stack direction="row" spacing={3} flexWrap="wrap">
                      <Stack spacing={0.5}>
                        <Typography variant="body2" color="text.secondary">
                          Frequency
                        </Typography>
                        <Typography variant="body1" color="text.primary" fontWeight={500}>
                          {rentFrequency}
                        </Typography>
                      </Stack>
                      <Stack spacing={0.5}>
                        <Typography variant="body2" color="text.secondary">
                          Next Due Date
                        </Typography>
                        <Typography variant="body1" color="text.primary" fontWeight={500}>
                          {nextDueDate ? formatDate(nextDueDate) : `Day ${rentDueDay}`}
                        </Typography>
                      </Stack>
                    </Stack>
                  </Stack>

                  {/* Tenants */}
                  {tenants.length > 0 && (
                    <Stack spacing={1}>
                      <Typography variant="caption" color="text.secondary" fontWeight={600} sx={{ textTransform: 'uppercase', letterSpacing: 0.5 }}>
                        Tenants ({tenants.length})
                      </Typography>
                      <Stack spacing={1}>
                        {tenants.map((tenant, index) => {
                          const firstName = tenant?.firstname || tenant?.firstName || '';
                          const lastName = tenant?.lastname || tenant?.lastName || '';
                          const fullName = `${firstName} ${lastName}`.trim() || 'Unnamed Tenant';
                          const email = tenant?.email || '';
                          return (
                            <Box
                              key={tenant?.id || index}
                              sx={{
                                p: 1.5,
                                borderRadius: 1,
                                bgcolor: alpha(theme.palette.primary.main, 0.03),
                                border: `1px solid ${alpha(theme.palette.divider, 0.1)}`
                              }}
                            >
                              <Typography variant="body1" color="text.primary" fontWeight={500}>
                                {fullName}
                              </Typography>
                              {email && (
                                <Typography variant="body2" color="text.secondary">
                                  {email}
                                </Typography>
                              )}
                            </Box>
                          );
                        })}
                      </Stack>
                    </Stack>
                  )}
                </Stack>
              </Grid>
            </Grid>
          );
        })()}
      </MainCard>
      )}

      {/* Banking Information Modal */}
      {rentCanInvoke && bankingModalOpen && (
      <Dialog
        open={bankingModalOpen}
        onClose={() => setBankingModalOpen(false)}
        maxWidth="sm"
        fullWidth
      >
        <DialogTitle>
          <Stack direction="row" justifyContent="space-between" alignItems="center">
            <Typography variant="h6">Banking Information</Typography>
            <IconButton
              onClick={() => setBankingModalOpen(false)}
              size="small"
              sx={{ color: 'text.secondary' }}
            >
              <CloseOutlined />
            </IconButton>
          </Stack>
        </DialogTitle>
        <DialogContent>
          <Stack spacing={3} sx={{ mt: 1 }}>
            <Typography variant="body2" color="text.secondary">
              Select or change the operating bank account for this property. This account will be used to receive rent payments.
            </Typography>

            {loadingBankAccounts ? (
              <Box sx={{ display: 'flex', justifyContent: 'center', py: 3 }}>
                <CircularProgress size={24} />
              </Box>
            ) : (
              <FormControl fullWidth>
                <InputLabel id="bank-account-select-label">Operating Account</InputLabel>
                <Select
                  labelId="bank-account-select-label"
                  id="bank-account-select"
                  value={selectedAccountId || ''}
                  label="Operating Account"
                  onChange={(e) => setSelectedAccountId(e.target.value || null)}
                >
                  <MenuItem value="">
                    <em>None (No account selected)</em>
                  </MenuItem>
                  {bankAccounts.map((account) => (
                    <MenuItem key={account.id} value={account.id}>
                      <Stack>
                        <Typography variant="body1">
                          {account.displayName || 'Bank Account'}
                        </Typography>
                        {account.last4 && (
                          <Typography variant="caption" color="text.secondary">
                            ****{account.last4} {account.bankName ? `• ${account.bankName}` : ''}
                          </Typography>
                        )}
                      </Stack>
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>
            )}

            <Button
              variant="outlined"
              startIcon={<PlusOutlined />}
              onClick={() => {
                // Keep modal open and show Stripe onboarding
                setShowStripeOnboarding(true);
              }}
              sx={{
                alignSelf: 'flex-start',
                textTransform: 'none'
              }}
            >
              Add New Bank Account
            </Button>
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setBankingModalOpen(false)} disabled={savingBankAccount}>
            Cancel
          </Button>
          <Button
            variant="contained"
            onClick={handleSaveBankAccount}
            disabled={savingBankAccount || loadingBankAccounts}
            startIcon={savingBankAccount ? <CircularProgress size={16} /> : null}
          >
            {savingBankAccount ? 'Saving...' : 'Save'}
          </Button>
        </DialogActions>
      </Dialog>
      )}

      {/* Stripe Connect Onboarding Dialog */}
      {rentCanInvoke && showStripeOnboarding && (
      <StripeConnectOnboardingDialog
        open={showStripeOnboarding}
        onClose={() => setShowStripeOnboarding(false)}
        onComplete={handleStripeOnboardingComplete}
      />
      )}

      <DeletePropertyModal
        open={deleteModalOpen}
        onClose={() => setDeleteModalOpen(false)}
        propertyId={property?.id}
        propertyName={property?.name || property?.streetAddress}
      />
    </Box>
  );
}

// Property Details Tab Component (for single family homes) - Keep for backward compatibility
function PropertyDetailsTab({ property, onRefresh }) {
  const unit = property?.units?.[0]; // Single family homes have one unit
  const [applications, setApplications] = useState([]);
  const [applicationsLoading, setApplicationsLoading] = useState(false);

  const hasLease = !!unit?.lease;
  const leaseIsActive = unit?.lease?.isActive ?? unit?.lease?.IsActive ?? true;
  const leaseStartDate = unit?.lease?.startDate || unit?.lease?.StartDate;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  
  // Determine lease status
  let leaseStatusLabel = 'No lease';
  let leaseStatusColor = 'default';
  if (hasLease) {
    if (leaseStartDate) {
      const startDate = new Date(leaseStartDate);
      startDate.setHours(0, 0, 0, 0);
      const hasStarted = startDate <= today;
      
      if (!hasStarted) {
        leaseStatusLabel = 'Not Started';
        leaseStatusColor = 'warning';
      } else if (leaseIsActive) {
        leaseStatusLabel = 'Active Lease';
        leaseStatusColor = 'success';
      } else {
        leaseStatusLabel = 'Lease Ended';
        leaseStatusColor = 'warning';
      }
    } else if (leaseIsActive) {
      leaseStatusLabel = 'Active Lease';
      leaseStatusColor = 'success';
    } else {
      leaseStatusLabel = 'Lease Ended';
      leaseStatusColor = 'warning';
    }
  }
  
  const isActiveLease = hasLease && leaseIsActive === true;

  // Fetch applications for this property
  useEffect(() => {
    const fetchApplications = async () => {
      if (!property?.id) return;
      
      setApplicationsLoading(true);
      try {
        const response = await applicationAPI.getApplicationsByProperty(property.id);
        if (response?.success && response?.data) {
          setApplications(response.data);
        } else {
          setApplications([]);
        }
      } catch (error) {
        console.error('Error fetching applications:', error);
        setApplications([]);
      } finally {
        setApplicationsLoading(false);
      }
    };

    fetchApplications();
  }, [property?.id]);

  // Normalize application status
  const normalizeStatus = (status) => {
    if (typeof status === 'string') {
      const statusMap = {
        'Draft': 0, 'draft': 0,
        'Submitted': 1, 'submitted': 1,
        'UnderReview': 2, 'underReview': 2,
        'Approved': 3, 'approved': 3,
        'Rejected': 4, 'rejected': 4,
        'Withdrawn': 5, 'withdrawn': 5,
        'OnHold': 6, 'onHold': 6,
        'LeaseSigned': 7, 'leaseSigned': 7,
        'Pending': 8, 'pending': 8
      };
      return statusMap[status] !== undefined ? statusMap[status] : status;
    }
    return status;
  };

  // Calculate application status summary
  const applicationSummary = useMemo(() => {
    if (!applications || applications.length === 0) {
      return { total: 0, byStatus: {}, hasActive: false };
    }

    const byStatus = {};
    let hasActive = false;

    applications.forEach(app => {
      const status = normalizeStatus(app.status);
      byStatus[status] = (byStatus[status] || 0) + 1;
      
      // Consider pending, submitted, under review, and on hold as "active"
      if ([1, 2, 6, 8].includes(status)) {
        hasActive = true;
      }
    });

    return {
      total: applications.length,
      byStatus,
      hasActive
    };
  }, [applications]);

  return (
    <Box>
      <Paper
        variant="outlined"
        sx={{
          p: 3,
          borderRadius: 2
        }}
      >
        <Typography variant="h6" fontWeight={600} sx={{ mb: 2 }}>
          Property Details
        </Typography>

        <Grid container spacing={3}>
          <Grid size={{ xs: 12, sm: 6, md: 3 }}>
            <Stack spacing={0.5}>
              <Typography variant="caption" color="text.secondary" fontWeight={500}>
                Bedrooms
              </Typography>
              <Typography variant="body1" fontWeight={500}>
                {unit?.bedrooms || '-'}
              </Typography>
            </Stack>
          </Grid>
          <Grid size={{ xs: 12, sm: 6, md: 3 }}>
            <Stack spacing={0.5}>
              <Typography variant="caption" color="text.secondary" fontWeight={500}>
                Baths
              </Typography>
              <Typography variant="body1" fontWeight={500}>
                {unit?.baths || '-'}
              </Typography>
            </Stack>
          </Grid>
          <Grid size={{ xs: 12, sm: 6, md: 3 }}>
            <Stack spacing={0.5}>
              <Typography variant="caption" color="text.secondary" fontWeight={500}>
                Square Feet
              </Typography>
              <Typography variant="body1" fontWeight={500}>
                {unit?.squareFeet ? `${unit.squareFeet.toLocaleString()} sq ft` : '-'}
              </Typography>
            </Stack>
          </Grid>
          <Grid size={{ xs: 12, sm: 6, md: 3 }}>
            <Stack spacing={0.5}>
              <Typography variant="caption" color="text.secondary" fontWeight={500}>
                Status
              </Typography>
              <Chip
                size="small"
                label={unit?.isOccupied ? 'Occupied' : 'Vacant'}
                color={unit?.isOccupied ? 'success' : 'default'}
                variant="outlined"
                sx={{ width: 'fit-content' }}
              />
            </Stack>
          </Grid>
          <Grid size={{ xs: 12 }}>
            <Divider sx={{ my: 1 }} />
          </Grid>
          <Grid size={{ xs: 12, sm: 6 }}>
            <Stack spacing={0.5}>
              <Typography variant="caption" color="text.secondary" fontWeight={500}>
                Lease
              </Typography>
              {hasLease ? (
                <Chip
                  size="small"
                  label={leaseStatusLabel}
                  color={leaseStatusColor}
                  variant="outlined"
                  sx={{ width: 'fit-content' }}
                />
              ) : (
                <Typography variant="body2" color="text.secondary">
                  No lease
                </Typography>
              )}
            </Stack>
          </Grid>
          <Grid size={{ xs: 12, sm: 6 }}>
            <Stack spacing={0.5}>
              <Typography variant="caption" color="text.secondary" fontWeight={500}>
                Applications
              </Typography>
              {applicationsLoading ? (
                <Typography variant="body2" color="text.secondary">
                  Loading...
                </Typography>
              ) : applicationSummary.total > 0 ? (
                <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap>
                  <Typography variant="body2" color="text.primary" sx={{ fontWeight: 500 }}>
                    {applicationSummary.total} {applicationSummary.total === 1 ? 'application' : 'applications'}
                  </Typography>
                  {applicationSummary.hasActive && (
                    <Chip
                      size="small"
                      label="Active"
                      color="warning"
                      variant="outlined"
                      sx={{ width: 'fit-content' }}
                    />
                  )}
                  {applicationSummary.byStatus[3] > 0 && (
                    <Chip
                      size="small"
                      label={`${applicationSummary.byStatus[3]} Approved`}
                      color="success"
                      variant="outlined"
                      sx={{ width: 'fit-content' }}
                    />
                  )}
                </Stack>
              ) : (
                <Typography variant="body2" color="text.secondary">
                  No applications
                </Typography>
              )}
            </Stack>
          </Grid>
        </Grid>
      </Paper>

      {/* Unit Edit Drawer */}
      <UnitEditDrawer
        propertyId={property?.id}
        onUpdateSuccess={onRefresh}
      />
    </Box>
  );
}

// Lease Tab Component (for single family homes)
function LeaseTab({ property, onRefresh, leases: propLeases, loadingLeases: propLoadingLeases, onLeasesRefresh }) {
  const dispatch = useDispatch();
  const drawer = useDrawer();
  const navigate = useNavigate();
  const theme = useTheme();
  const unit = property?.units?.[0]; // Single family homes have one unit
  
  const [allLeases, setAllLeases] = useState([]);
  const [loadingLeases, setLoadingLeases] = useState(false);
  const [deleteLeaseConfirmOpen, setDeleteLeaseConfirmOpen] = useState(false);
  const [leaseToDelete, setLeaseToDelete] = useState(null);
  const [leaseSearch, setLeaseSearch] = useState('');

  const LeaseSchema = Yup.object().shape({
    leaseEndDate: Yup.string().required('Lease end date is required'),
    rentFrequency: Yup.string().oneOf(['monthly', 'quarterly', 'yearly']).required('Rent frequency is required'),
    rentDueDay: Yup.number().min(1).max(31).required('Rent due day is required'),
    leaseLength: Yup.number().min(0).required('Lease length is required'),
    rentAmount: Yup.number().typeError('Enter a valid amount').min(0, 'Must be ≥ 0').required('Rent amount is required')
  });

  const createLeaseFormik = useFormik({
    initialValues: buildInitialValues(property),
    validationSchema: LeaseSchema,
    onSubmit: async (values, { setSubmitting }) => {
      try {
        if (!unit?.id) {
          openSnackbar({
            open: true,
            message: 'Unit not found.',
            variant: 'alert',
            alert: { color: 'error' }
          });
          setSubmitting(false);
          return;
        }

        const leasePayload = {
          PropertyId: property.id,
          UnitId: unit.id,
          StartDate: new Date(values.leaseStartDate),
          EndDate: new Date(values.leaseEndDate),
          LeaseLength: Number(values.leaseLength || 12),
          RentAmount: Number(values.rentAmount || 0),
          RentFrequency: values.rentFrequency === 'monthly' ? 'Monthly' : values.rentFrequency === 'quarterly' ? 'Quarterly' : 'Yearly',
          RentDueDay: Number(values.rentDueDay || 1),
          MarkPastPaymentsAsPaid: values.markPastPaymentsAsPaid || false,
          ...(property?.organizationId != null && { organizationId: Number(property.organizationId) })
        };

        await dispatch(addOrUpdateLease(leasePayload));

        openSnackbar({
          open: true,
          message: 'Lease created successfully.',
          variant: 'alert',
          alert: { color: 'success' }
        });

        setCreateLeaseDialogOpen(false);
        createLeaseFormik.resetForm();
        
        if (onRefresh) {
          onRefresh();
        }
      } catch (error) {
        console.error(error);
        openSnackbar({
          open: true,
          message: error?.response?.data?.message || 'Failed to create lease.',
          variant: 'alert',
          alert: { color: 'error' }
        });
      } finally {
        setSubmitting(false);
      }
    }
  });

  // Handle delete lease
  const handleDeleteLeaseClick = (leaseToDeleteItem) => {
    setLeaseToDelete(leaseToDeleteItem);
    setDeleteLeaseConfirmOpen(true);
  };

  const handleConfirmDeleteLease = async () => {
    if (!leaseToDelete?.id) return;

    try {
      await dispatch(deleteLease(leaseToDelete.id));

      // Remove from local state
      setAllLeases(allLeases.filter((l) => l.id !== leaseToDelete.id));

      openSnackbar({
        open: true,
        message: 'Lease deleted successfully.',
        variant: 'alert',
        alert: { color: 'success' }
      });

      setDeleteLeaseConfirmOpen(false);
      setLeaseToDelete(null);

      // Refresh shared lease data if callback provided
      if (onLeasesRefresh) {
        onLeasesRefresh();
      }

      // Refresh property data
      if (onRefresh) {
        onRefresh();
      }
    } catch (error) {
      console.error('Error deleting lease:', error);
      openSnackbar({
        open: true,
        message: error?.response?.data?.message || 'Failed to delete lease',
        variant: 'alert',
        alert: { color: 'error' }
      });
    }
  };

  // Helper function to check if lease is draft
  const isDraftLease = (lease) => {
    const signatureStatus = lease?.signatureStatus ?? lease?.SignatureStatus ?? null;
    return signatureStatus === 0 || signatureStatus === 'NotSent' || signatureStatus === 'notsent';
  };

  // Helper function to format lease display name
  const getLeaseDisplayName = (lease) => {
    if (lease?.leaseNickname || lease?.LeaseNickname) {
      return lease.leaseNickname || lease.LeaseNickname;
    }
    // Fallback to property address and end date
    const endDate = lease?.endDate || lease?.EndDate;
    if (endDate) {
      const date = new Date(endDate);
      const month = date.toLocaleString('default', { month: 'long' });
      const year = date.getFullYear();
      return `${property?.streetAddress || property?.name || ''} - ${month} ${year}`;
    }
    return property?.streetAddress || property?.name || 'Lease';
  };

  // Use leases from props if provided, otherwise fetch locally
  useEffect(() => {
    if (propLeases !== undefined) {
      // Use leases from props
      setAllLeases(propLeases);
      setLoadingLeases(propLoadingLeases || false);
      return;
    }
    
    // Extract leases directly from property units (no API call needed)
    const fetchAllLeases = () => {
      if (property?.units) {
        setLoadingLeases(true);
        try {
          const leasesFromUnits = [];
          property.units.forEach((u) => {
            const unitLease = u.lease || u.Lease;
            if (unitLease && (unitLease.id || unitLease.Id)) {
              leasesFromUnits.push(unitLease);
            }
          });
          setAllLeases(leasesFromUnits);
        } catch (error) {
          console.error('Error extracting leases from property units:', error);
          setAllLeases([]);
        } finally {
          setLoadingLeases(false);
        }
      } else {
        setAllLeases([]);
        setLoadingLeases(false);
      }
    };

    fetchAllLeases();
  }, [property?.id, propLeases, propLoadingLeases]);

  const getLeaseStatus = (lease) => {
    if (isDraftLease(lease)) return { label: 'Draft', color: 'info' };
    const today = new Date();
    const start = lease?.startDate ? new Date(lease.startDate) : null;
    const end = lease?.endDate ? new Date(lease.endDate) : null;
    if (end && end < today) return { label: 'Expired', color: 'default' };
    if (start && start > today) return { label: 'Pending', color: 'warning' };
    return { label: 'Active', color: 'success' };
  };

  const sortedFilteredLeases = useMemo(() => {
    const sorted = [...allLeases].sort((a, b) => {
      const aDate = a.createdAt ? new Date(a.createdAt) : new Date(0);
      const bDate = b.createdAt ? new Date(b.createdAt) : new Date(0);
      return bDate - aDate;
    });
    if (!leaseSearch.trim()) return sorted;
    const q = leaseSearch.toLowerCase();
    return sorted.filter((l) => getLeaseDisplayName(l).toLowerCase().includes(q));
  }, [allLeases, leaseSearch]);

  const leaseBuilderUrl = () => {
    const params = new URLSearchParams();
    if (property?.id) params.set('propertyId', property.id);
    if (unit?.id) params.set('unitId', unit.id);
    return `/landlord/leases/builder?${params.toString()}`;
  };

  return (
    <Box>
      {/* Header */}
      <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 2 }}>
        <Typography variant="h6" fontWeight={600}>
          Leases
        </Typography>
        <Button
          variant="outlined"
          startIcon={<PlusOutlined style={{ fontSize: 16 }} />}
          onClick={() => navigate(leaseBuilderUrl())}
          sx={{ textTransform: 'none' }}
        >
          Create Lease
        </Button>
      </Stack>

      {/* Search */}
      {allLeases.length > 0 && (
        <TextField
          size="small"
          placeholder="Search leases..."
          value={leaseSearch}
          onChange={(e) => setLeaseSearch(e.target.value)}
          InputProps={{
            startAdornment: (
              <InputAdornment position="start">
                <SearchOutlined style={{ fontSize: 14, color: theme.palette.text.secondary }} />
              </InputAdornment>
            )
          }}
          sx={{ mb: 2, width: 280 }}
        />
      )}

      {/* Loading */}
      {loadingLeases ? (
        <Box sx={{ p: 4, textAlign: 'center' }}>
          <CircularProgress size={40} />
        </Box>
      ) : allLeases.length === 0 ? (
        <MainCard sx={{ p: 6, textAlign: 'center', bgcolor: (t) => alpha(t.palette.background.paper, 0.6) }}>
          <Box
            sx={{
              width: 120,
              height: 120,
              borderRadius: '50%',
              bgcolor: alpha(theme.palette.info.main, 0.1),
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              mx: 'auto',
              mb: 3
            }}
          >
            <HomeOutlined style={{ fontSize: 64, color: theme.palette.info.main, opacity: 0.5 }} />
          </Box>
          <Typography variant="h6" fontWeight={600} gutterBottom>
            No leases
          </Typography>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 3, maxWidth: 400, mx: 'auto' }}>
            Create a lease to start tracking rental information and tenant details.
          </Typography>
          <Button
            variant="outlined"
            startIcon={<PlusOutlined style={{ fontSize: 16 }} />}
            onClick={() => navigate(leaseBuilderUrl())}
            sx={{ textTransform: 'none' }}
          >
            Create Lease
          </Button>
        </MainCard>
      ) : (
        <TableContainer component={Paper} variant="outlined" sx={{ borderRadius: 2 }}>
          <Table size="small">
            <TableHead>
              <TableRow sx={{ bgcolor: (t) => alpha(t.palette.grey[100], 0.8) }}>
                <TableCell sx={{ fontWeight: 600 }}>Lease</TableCell>
                <TableCell sx={{ fontWeight: 600 }}>Term</TableCell>
                <TableCell sx={{ fontWeight: 600 }}>Status</TableCell>
                <TableCell sx={{ fontWeight: 600 }}>Rent</TableCell>
                <TableCell align="right" sx={{ fontWeight: 600 }}>Actions</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {sortedFilteredLeases.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={5} align="center" sx={{ py: 4, color: 'text.secondary' }}>
                    No leases match your search.
                  </TableCell>
                </TableRow>
              ) : (
                sortedFilteredLeases.map((lease) => {
                  const isDraft = isDraftLease(lease);
                  const displayName = getLeaseDisplayName(lease);
                  const startDate = lease?.startDate || lease?.StartDate;
                  const endDate = lease?.endDate || lease?.EndDate;
                  const hasTerm = startDate && endDate;
                  const rentAmount = lease?.rentAmount || lease?.RentAmount;
                  const rentFrequency = lease?.rentFrequency || lease?.RentFrequency;
                  const status = getLeaseStatus(lease);

                  return (
                    <TableRow key={lease.id} hover sx={{ cursor: 'pointer' }} onClick={() => navigate(`/landlord/leases/${lease.id}`)}>
                      <TableCell>
                        <Typography variant="body2" fontWeight={500}>
                          {displayName}
                        </Typography>
                      </TableCell>
                      <TableCell>
                        <Typography variant="body2" color={hasTerm ? 'text.primary' : 'text.secondary'} sx={{ fontStyle: hasTerm ? 'normal' : 'italic' }}>
                          {hasTerm ? `${formatDate(startDate)} – ${formatDate(endDate)}` : 'Not set'}
                        </Typography>
                      </TableCell>
                      <TableCell>
                        <Chip label={status.label} color={status.color} size="small" />
                      </TableCell>
                      <TableCell>
                        <Typography variant="body2">
                          {rentAmount ? `${formatCurrency(rentAmount)}${rentFrequency ? ` / ${rentFrequency}` : ''}` : '—'}
                        </Typography>
                      </TableCell>
                      <TableCell align="right">
                        <Stack direction="row" spacing={0.5} justifyContent="flex-end" alignItems="center" onClick={(e) => e.stopPropagation()}>
                          <IconButton
                            size="small"
                            onClick={() => handleDeleteLeaseClick(lease)}
                            sx={{ color: 'error.main', '&:hover': { bgcolor: alpha(theme.palette.error.main, 0.08) } }}
                          >
                            <DeleteOutlined style={{ fontSize: 15 }} />
                          </IconButton>
                          <Button
                            variant={isDraft ? 'contained' : 'outlined'}
                            size="small"
                            onClick={() => navigate(`/landlord/leases/${lease.id}`)}
                            sx={{ textTransform: 'none', whiteSpace: 'nowrap' }}
                          >
                            {isDraft ? 'Finish Setup' : 'View Lease'}
                          </Button>
                        </Stack>
                      </TableCell>
                    </TableRow>
                  );
                })
              )}
            </TableBody>
          </Table>
        </TableContainer>
      )}

      {/* Delete Lease Confirmation Dialog */}
      <ConfirmationDialog
        open={deleteLeaseConfirmOpen}
        onClose={() => {
          setDeleteLeaseConfirmOpen(false);
          setLeaseToDelete(null);
        }}
        onConfirm={handleConfirmDeleteLease}
        title="Delete Lease"
        message={
          leaseToDelete
            ? `Are you sure you want to permanently delete this lease? This will delete the lease and all associated payments and deposits. This action cannot be undone.`
            : 'Are you sure you want to delete this lease?'
        }
        confirmText="Delete Lease"
        cancelText="Cancel"
        confirmColor="error"
      />
    </Box>
  );
}

// Units Tab Component
function UnitsTab({ property, onRefresh, onOpenBulkCreate }) {
  const drawer = useDrawer();
  const dispatch = useDispatch();
  const navigate = useNavigate();
  const theme = useTheme();
  const units = property?.units || [];
  const isMultiUnit = property?.propertyType === 'multiUnit';
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('all'); // 'all', 'occupied', 'vacant'
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
  const [selectedUnits, setSelectedUnits] = useState(new Set());

  // Filter and search units
  const filteredUnits = useMemo(() => {
    let filtered = units;

    // Apply status filter
    if (statusFilter === 'occupied') {
      filtered = filtered.filter((unit) => unit.isOccupied);
    } else if (statusFilter === 'vacant') {
      filtered = filtered.filter((unit) => !unit.isOccupied);
    }

    // Apply search query
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter(
        (unit) =>
          unit.name?.toLowerCase().includes(query) ||
          unit.bedrooms?.toString().includes(query) ||
          unit.baths?.toString().includes(query) ||
          unit.squareFeet?.toString().includes(query)
      );
    }

    return filtered;
  }, [units, searchQuery, statusFilter]);

  const handleUnitClick = (unit) => {
    drawer.openUnitEditDrawer(unit);
  };

  // Handle unit selection
  const handleSelectUnit = (e, unitId) => {
    e.stopPropagation(); // Prevent row click
    const newSelected = new Set(selectedUnits);
    if (newSelected.has(unitId)) {
      newSelected.delete(unitId);
    } else {
      newSelected.add(unitId);
    }
    setSelectedUnits(newSelected);
  };

  // Handle select all
  const handleSelectAll = (e) => {
    if (e.target.checked) {
      setSelectedUnits(new Set(filteredUnits.map((u) => u.id)));
    } else {
      setSelectedUnits(new Set());
    }
  };

  // Handle bulk delete click
  const handleBulkDeleteClick = () => {
    if (selectedUnits.size === 0) return;
    setDeleteConfirmOpen(true);
  };

  // Handle bulk delete confirmation
  const handleConfirmBulkDelete = async () => {
    if (selectedUnits.size === 0) return;

    try {
      const deletePromises = Array.from(selectedUnits).map((unitId) => dispatch(deleteUnit(unitId)));
      await Promise.all(deletePromises);

      const count = selectedUnits.size;
      openSnackbar({
        open: true,
        message: `Successfully deleted ${count} ${count === 1 ? 'unit' : 'units'}. All associated data (leases, tenants, maintenance requests) has been removed.`,
        variant: 'alert',
        alert: { color: 'success' }
      });

      setDeleteConfirmOpen(false);
      setSelectedUnits(new Set());

      // Refresh the property data
      if (onRefresh) {
        onRefresh();
      }
    } catch (error) {
      console.error('Error deleting units:', error);
      openSnackbar({
        open: true,
        message: error?.response?.data?.message || 'Failed to delete units',
        variant: 'alert',
        alert: { color: 'error' }
      });
    }
  };

  return (
    <Box>
      <Toolbar sx={{ px: 0, justifyContent: 'space-between', mb: 2, flexWrap: 'wrap', gap: 2 }}>
        <Stack direction="row" spacing={2} alignItems="center">
          <Typography variant="subtitle1">
            {filteredUnits.length} of {units.length} {units.length === 1 ? 'Unit' : 'Units'}
            {selectedUnits.size > 0 && ` (${selectedUnits.size} selected)`}
          </Typography>
        </Stack>
        {isMultiUnit && (
          <Stack direction="row" spacing={1} alignItems="center">
            <Button
              variant="contained"
              color="primary"
              startIcon={<PlusOutlined />}
              onClick={onOpenBulkCreate}
            >
              Add Units
            </Button>
            <Button
              variant="contained"
              color="error"
              startIcon={<DeleteOutlined />}
              onClick={handleBulkDeleteClick}
              disabled={selectedUnits.size === 0}
            >
              Delete {selectedUnits.size > 0 && `(${selectedUnits.size})`}
            </Button>
          </Stack>
        )}
      </Toolbar>

      {/* Search and Filter Bar */}
      <Stack direction="row" spacing={2} sx={{ mb: 2 }} flexWrap="wrap">
        <TextField
          placeholder="Search units..."
          size="small"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          InputProps={{
            startAdornment: (
              <InputAdornment position="start">
                <SearchOutlined style={{ fontSize: 18 }} />
              </InputAdornment>
            )
          }}
          sx={{ flexGrow: 1, minWidth: 200 }}
        />
        <ToggleButtonGroup
          value={statusFilter}
          exclusive
          onChange={(e, newValue) => newValue && setStatusFilter(newValue)}
          size="small"
        >
          <ToggleButton value="all">All</ToggleButton>
          <ToggleButton value="occupied">Occupied</ToggleButton>
          <ToggleButton value="vacant">Vacant</ToggleButton>
        </ToggleButtonGroup>
      </Stack>

      {units.length === 0 ? (
        <Box sx={{ p: 4, textAlign: 'center' }}>
          <HomeOutlined style={{ fontSize: 64, color: 'rgba(0,0,0,0.12)' }} />
          <Typography variant="h6" color="text.secondary" sx={{ mt: 2 }}>
            No units found
          </Typography>
          <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
            {isMultiUnit
              ? "This property doesn't have any units yet. Click 'Add Units' to create them."
              : 'Single-family properties automatically have Unit 1.'}
          </Typography>
          {isMultiUnit && (
            <Button
              variant="contained"
              color="primary"
              startIcon={<PlusOutlined />}
              onClick={onOpenBulkCreate}
              sx={{ mt: 2 }}
            >
              Add Units
            </Button>
          )}
        </Box>
      ) : filteredUnits.length === 0 ? (
        <Box sx={{ p: 4, textAlign: 'center' }}>
          <SearchOutlined style={{ fontSize: 64, color: 'rgba(0,0,0,0.12)' }} />
          <Typography variant="h6" color="text.secondary" sx={{ mt: 2 }}>
            No units match your search
          </Typography>
          <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
            Try adjusting your search query or filters.
          </Typography>
        </Box>
      ) : (
        <TableContainer component={Paper} variant="outlined">
          <Table>
            <TableHead>
              <TableRow>
                <TableCell padding="checkbox" width={50}>
                  <Checkbox
                    checked={filteredUnits.length > 0 && filteredUnits.every((u) => selectedUnits.has(u.id))}
                    indeterminate={selectedUnits.size > 0 && !filteredUnits.every((u) => selectedUnits.has(u.id))}
                    onChange={handleSelectAll}
                  />
                </TableCell>
                <TableCell>Unit Name</TableCell>
                <TableCell>Bedrooms</TableCell>
                <TableCell>Baths</TableCell>
                <TableCell>Square Feet</TableCell>
                <TableCell>Status</TableCell>
                <TableCell>Lease</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {filteredUnits.map((unit) => {
                const hasLease = !!unit.lease;
                // Check isActive (camelCase) or IsActive (PascalCase) - backend may return either
                // Default to true if not explicitly set to false
                const leaseIsActive = unit.lease?.isActive ?? unit.lease?.IsActive ?? true;
                const leaseStartDate = unit.lease?.startDate || unit.lease?.StartDate;
                const today = new Date();
                today.setHours(0, 0, 0, 0);
                
                // Check if lease has started
                let leaseStatus = 'none';
                let leaseStatusLabel = 'No lease';
                let leaseStatusColor = 'default';
                
                if (hasLease) {
                  if (leaseStartDate) {
                    const startDate = new Date(leaseStartDate);
                    startDate.setHours(0, 0, 0, 0);
                    const hasStarted = startDate <= today; // Lease has started if startDate is today or in the past
                    
                    // Priority: Check if lease hasn't started first (startDate is in the future)
                    if (!hasStarted) {
                      leaseStatus = 'notStarted';
                      leaseStatusLabel = 'Not Started';
                      leaseStatusColor = 'warning';
                    } else if (leaseIsActive) {
                      leaseStatus = 'active';
                      leaseStatusLabel = 'Active Lease';
                      leaseStatusColor = 'success';
                    } else {
                      leaseStatus = 'ended';
                      leaseStatusLabel = 'Lease Ended';
                      leaseStatusColor = 'warning';
                    }
                  } else {
                    // No start date - check if it's active, but prioritize showing status based on isActive
                    if (leaseIsActive) {
                      leaseStatus = 'active';
                      leaseStatusLabel = 'Active Lease';
                      leaseStatusColor = 'success';
                    } else {
                      leaseStatus = 'ended';
                      leaseStatusLabel = 'Lease Ended';
                      leaseStatusColor = 'warning';
                    }
                  }
                }
                
                const isActiveLease = hasLease && leaseIsActive === true;
                const isSelected = selectedUnits.has(unit.id);

                return (
                  <TableRow
                    key={unit.id}
                    hover
                    selected={isSelected}
                  >
                    <TableCell padding="checkbox" onClick={(e) => handleSelectUnit(e, unit.id)}>
                      <Checkbox checked={isSelected} />
                    </TableCell>
                    <TableCell>
                      <Stack direction="row" spacing={1} alignItems="center">
                        <Typography variant="body2" fontWeight={500}>
                          {unit.name || `Unit ${unit.id}`}
                        </Typography>
                        <IconButton
                          size="small"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleUnitClick(unit);
                          }}
                          sx={{
                            padding: 0.5,
                            '&:hover': {
                              bgcolor: alpha(theme.palette.primary.main, 0.08)
                            }
                          }}
                        >
                          <EditOutlined style={{ fontSize: 14, opacity: 0.7 }} />
                        </IconButton>
                      </Stack>
                    </TableCell>
                    <TableCell>
                      <Typography variant="body2" color="text.secondary">
                        {unit.bedrooms || '-'}
                      </Typography>
                    </TableCell>
                    <TableCell>
                      <Typography variant="body2" color="text.secondary">
                        {unit.baths || '-'}
                      </Typography>
                    </TableCell>
                    <TableCell>
                      <Typography variant="body2" color="text.secondary">
                        {unit.squareFeet ? `${unit.squareFeet.toLocaleString()} sq ft` : '-'}
                      </Typography>
                    </TableCell>
                    <TableCell>
                      <Chip
                        size="small"
                        label={unit.isOccupied ? 'Occupied' : 'Vacant'}
                        color={unit.isOccupied ? 'success' : 'default'}
                        variant="outlined"
                      />
                    </TableCell>
                    <TableCell>
                      {hasLease && (unit?.lease?.id || unit?.lease?.Id) ? (
                        <Button
                          variant="outlined"
                          size="small"
                          onClick={(e) => {
                            e.stopPropagation();
                            const leaseId = unit.lease.id || unit.lease.Id;
                            navigate(`/landlord/leases/${leaseId}`);
                          }}
                          sx={{ textTransform: 'none' }}
                        >
                          View Lease
                        </Button>
                      ) : (
                        <Button
                          variant="outlined"
                          size="small"
                          color="primary"
                          onClick={(e) => {
                            e.stopPropagation();
                            navigate(`/landlord/leases/builder?${params.toString()}`);
                          }}
                          sx={{ textTransform: 'none' }}
                        >
                          Add Lease
                        </Button>
                      )}
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </TableContainer>
      )}

      {/* Unit Edit Drawer */}
      <UnitEditDrawer
        propertyId={property?.id}
        onUpdateSuccess={onRefresh}
      />

      {/* Bulk Delete Confirmation Dialog */}
      <ConfirmationDialog
        open={deleteConfirmOpen}
        onClose={() => {
          setDeleteConfirmOpen(false);
        }}
        onConfirm={handleConfirmBulkDelete}
        title="Delete Units"
        message={
          selectedUnits.size > 0
            ? `Are you sure you want to delete ${selectedUnits.size} ${selectedUnits.size === 1 ? 'unit' : 'units'}? This will permanently delete the ${selectedUnits.size === 1 ? 'unit' : 'units'} and all associated data including leases, tenants, maintenance requests, and images. This action cannot be undone.`
            : 'Are you sure you want to delete these units?'
        }
        confirmText="Delete"
        cancelText="Cancel"
        confirmColor="error"
      />
    </Box>
  );
}

export default function Property() {
  const { propertyId } = useParams();
  const dispatch = useDispatch();
  const navigate = useNavigate();
  const drawer = useDrawer();
  const [searchParams] = useSearchParams();
  const location = useLocation();
  const previousPathname = useRef(null);
  const reduxSelectedProperty = useSelector(selectProperty);

  // Initialize tab from URL query parameter or default to 'overview'
  const [tab, setTab] = useState(() => {
    const tabParam = searchParams.get('tab');
    return tabParam || 'overview';
  });

  // Update tab when URL query parameter changes
  useEffect(() => {
    const tabParam = searchParams.get('tab');
    if (tabParam) {
      setTab(tabParam);
    }
  }, [searchParams]);

  // Reset property selection when leaving this page
  useEffect(() => {
    const isOnThisPage = location.pathname.startsWith('/landlord/property/');
    const justNavigatedAway = previousPathname.current && previousPathname.current.startsWith('/landlord/property/') && !isOnThisPage;
    
    if (justNavigatedAway && reduxSelectedProperty) {
      dispatch(setProperty(null));
    }
    
    previousPathname.current = location.pathname;
  }, [location.pathname, dispatch, reduxSelectedProperty]);
  const [openConfirm, setOpenConfirm] = useState(false);
  const [deletePropertyModalOpen, setDeletePropertyModalOpen] = useState(false);
  const [bulkUnitDrawerOpen, setBulkUnitDrawerOpen] = useState(false);
  const [uploadingImages, setUploadingImages] = useState(false);
  const [refreshingProperty, setRefreshingProperty] = useState(false);
  const [creatingListing, setCreatingListing] = useState(false);

  // Fade-in animation state
  const [fadeIn, setFadeIn] = useState(false);

  // Trigger fade-in animation on mount - start immediately so components can render
  useEffect(() => {
    // Set fadeIn immediately so components render, even if they start with opacity 0
    setFadeIn(true);
  }, []);

  const { selectedProperty, refetch: refetchProperty } = useFetchProperty(propertyId);
  const currentUser = useSelector(selectCurrentUser);
  const { canInvoke: screeningCanInvoke } = useFeatureReadiness(FEATURE_KEYS.tenantScreening);
  const propertyLoading = useSelector(selectPropertyLoading);
  const maintenanceLoading = useSelector(selectMaintenanceLoading);

  const { rentRecords, loading: rentCollectionLoading } = useFetchRentCollection(propertyId);
  const { maintenances, refetch: refetchMaintenances } = useFetchMaintenances(propertyId);
  
  // Get context to update property loading state
  const { setPropertyLoading } = useDashboardLoading();

  // Fetch leases once at property page level (shared across OverviewTab and LeaseTab)
  const [propertyLeases, setPropertyLeases] = useState([]);
  const [loadingPropertyLeases, setLoadingPropertyLeases] = useState(false);
  
  // Comprehensive loading state - tracks when ALL property page components are loaded
  // This combines all individual component loading states
  const isPropertyPageLoading = useMemo(() => {
    return (
      propertyLoading ||
      rentCollectionLoading ||
      maintenanceLoading ||
      loadingPropertyLeases
    );
  }, [
    propertyLoading,
    rentCollectionLoading,
    maintenanceLoading,
    loadingPropertyLeases
  ]);
  
  // Update the context whenever the property page loading state changes
  useEffect(() => {
    setPropertyLoading(isPropertyPageLoading);
  }, [isPropertyPageLoading, setPropertyLoading]);

  // Extract leases directly from property units (no API call needed)
  useEffect(() => {
    if (!selectedProperty?.units) {
      setPropertyLeases([]);
      setLoadingPropertyLeases(false);
      return;
    }

    setLoadingPropertyLeases(true);
    try {
      const leasesFromUnits = [];
      if (Array.isArray(selectedProperty.units)) {
        selectedProperty.units.forEach((unit) => {
          const unitLease = unit.lease || unit.Lease;
          if (unitLease && (unitLease.id || unitLease.Id)) {
            leasesFromUnits.push(unitLease);
          }
        });
      }
      setPropertyLeases(leasesFromUnits);
    } catch (error) {
      console.error('Error extracting leases from property units:', error);
      setPropertyLeases([]);
    } finally {
      setLoadingPropertyLeases(false);
    }
  }, [selectedProperty?.units]);

  const handlePropertyRefresh = async () => {
    setRefreshingProperty(true);
    try {
      await refetchProperty();
      // Also refresh related data
      await refetchMaintenances();
      
      // Refresh leases - the useEffect watching selectedProperty?.units will automatically update
      // No API call needed, leases are extracted from property units
    } catch (error) {
      console.error('Error refreshing property:', error);
      openSnackbar({
        open: true,
        message: 'Failed to refresh property data',
        variant: 'alert',
        alert: { color: 'error' }
      });
    } finally {
      setRefreshingProperty(false);
    }
  };

  const handleImageUpload = async (files) => {
    if (!selectedProperty?.id || !files || files.length === 0) return;

    setUploadingImages(true);
    try {
      const uploadedImages = await dispatch(addPropertyImages(selectedProperty.id, files));
      
      // If images were uploaded, update the property's MainImageUrl to the first uploaded image
      if (uploadedImages && uploadedImages.length > 0) {
        const firstImageUrl = uploadedImages[0]?.blobUrl || uploadedImages[0]?.BlobUrl;
        if (firstImageUrl) {
          // Update the property to set the new image as the main/profile image
          await dispatch(addOrUpdateProperty({
            ...selectedProperty,
            id: selectedProperty.id,
            mainImageUrl: firstImageUrl
          }, []));
        }
      }
      
      openSnackbar({
        open: true,
        message: 'Property images uploaded successfully',
        variant: 'alert',
        alert: { color: 'success' }
      });
      refetchProperty(); // Refresh to show new images
    } catch (error) {
      openSnackbar({
        open: true,
        message: error?.response?.data?.message || 'Failed to upload images',
        variant: 'alert',
        alert: { color: 'error' }
      });
    } finally {
      setUploadingImages(false);
    }
  };

  const handleConfirmInactivateProperty = async () => {
    setOpenConfirm(false);
    try {
      await dispatch(inactivateProperty(propertyId));
      openSnackbar({
        open: true,
        message: 'Property deactivated successfully',
        variant: 'alert',
        alert: { color: 'success' }
      });
      // Navigate back to properties page after successful deactivation
      navigate('/landlord/properties');
    } catch (error) {
      openSnackbar({
        open: true,
        message: error?.response?.data?.message || 'Failed to deactivate property',
        variant: 'alert',
        alert: { color: 'error' }
      });
    }
  };

  const handleConfirmReactivateProperty = async () => {
    try {
      await dispatch(reactivateProperty(propertyId));
      openSnackbar({
        open: true,
        message: 'Property reactivated successfully',
        variant: 'alert',
        alert: { color: 'success' }
      });
      handlePropertyRefresh();
    } catch (error) {
      openSnackbar({
        open: true,
        message: error?.response?.data?.message || 'Failed to reactivate property',
        variant: 'alert',
        alert: { color: 'error' }
      });
    }
  };

  const handleMarketingNavigateToAddListing = async () => {
    if (!propertyId || !selectedProperty?.id) {
      const params = new URLSearchParams();
      if (propertyId) params.set('propertyId', propertyId);
      navigate(`/landlord/listings/add${params.toString() ? `?${params.toString()}` : ''}`);
      return;
    }
    setCreatingListing(true);
    try {
      const userContact = getUserContactDisplay(currentUser);
      const payload = {
        propertyId: selectedProperty.id,
        unitId: null,
        monthlyRent: 0,
        ...DEFAULT_LISTING_CREATE_PAYLOAD,
        requireScreening: screeningCanInvoke,
        screeningType: screeningCanInvoke ? 'Essential' : null,
        requireIncomeVerification: false,
        incomeVerificationCost: screeningCanInvoke ? 12 : 0,
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
      // Fallback: go to add page with property pre-selected so user can pick unit if needed
      const params = new URLSearchParams();
      params.set('propertyId', propertyId);
      navigate(`/landlord/listings/add?${params.toString()}`);
    } finally {
      setCreatingListing(false);
    }
  };

  const theme = useTheme();
  const isSingleFamily = selectedProperty?.propertyType?.toLowerCase() === 'singlefamily';
  const downMD = useMediaQuery(theme => theme.breakpoints.down('md'));

  // Redirect from units tab to overview if single-family property
  useEffect(() => {
    if (isSingleFamily && tab === 'units') {
      setTab('overview');
    }
  }, [isSingleFamily, tab]);

  return (
    <>
      <Fade in={fadeIn} timeout={600}>
        <Box sx={{ overflow: 'visible' }}>
        <PageBreadcrumbs items={[
          { label: 'Dashboard', path: '/landlord/dashboard' },
          { label: 'Properties', path: '/landlord/properties' },
          { label: selectedProperty?.name || 'Property' }
        ]} />
        {/* Enhanced Header */}
        <AnimateIn direction="bottom" delay={100} distance={120}>
          <PropertyHeader
            property={selectedProperty}
            onEdit={drawer.openPropertyEditDrawer}
            onDelete={() => setDeletePropertyModalOpen(true)}
            onDeactivate={() => setOpenConfirm(true)}
            onReactivate={handleConfirmReactivateProperty}
            onRefresh={handlePropertyRefresh}
            refreshing={refreshingProperty}
          />
        </AnimateIn>

        {/* Property Overview */}
        <Box sx={{ mt: 3 }}>
          <AnimateIn direction="bottom" delay={200} distance={120}>
            <PropertyOverview
              property={selectedProperty}
              propertyId={propertyId}
              onCreateListing={drawer.openListingAddDrawer}
            />
          </AnimateIn>
        </Box>
        <Box sx={{ mt: 2, display: { xs: 'none', sm: 'block' } }}>
          <PropertyLeasingPipeline
            propertyId={propertyId}
            units={selectedProperty?.units ?? selectedProperty?.Units ?? []}
            onCreateListing={drawer.openListingAddDrawer}
          />
        </Box>
      {/* Confirmation Dialog */}
      <ConfirmationDialog
        open={openConfirm}
        onClose={() => setOpenConfirm(false)}
        onConfirm={handleConfirmInactivateProperty}
        title="Deactivate Property"
        message="Are you sure you want to deactivate this property? The property will be hidden from your active properties list but can be reactivated later."
        confirmText="Deactivate"
      />

      <PropertyEditDrawer property={selectedProperty} onUpdateSuccess={handlePropertyRefresh} />
      <ListingAddWorkflowDrawer />
      
      {/* Bulk Unit Create Drawer */}
      <BulkUnitCreateDrawer
        property={selectedProperty}
        open={bulkUnitDrawerOpen}
        onClose={() => setBulkUnitDrawerOpen(false)}
        onSuccess={handlePropertyRefresh}
      />

      {/* Maintenance Add Drawer */}
      <LandlordMaintenanceDrawer
        onAddSuccess={async () => {
          await refetchMaintenances();
        }}
      />

      <LeaseAddDrawer />

      <DeletePropertyModal
        open={deletePropertyModalOpen}
        onClose={() => setDeletePropertyModalOpen(false)}
        propertyId={selectedProperty?.id}
        propertyName={selectedProperty?.name || selectedProperty?.streetAddress}
      />

      </Box>
      </Fade>
    </>
  );
}
