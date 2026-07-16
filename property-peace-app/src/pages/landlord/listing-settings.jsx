import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  Box,
  Typography,
  Stack,
  Button,
  CircularProgress,
  alpha,
  useTheme
} from '@mui/material';
import { ArrowLeftOutlined, DeleteOutlined, EditOutlined } from '@ant-design/icons';
import MainCard from 'components/MainCard';
import PageBreadcrumbs from 'components/breadcrumbs/PageBreadcrumbs';
import { useDispatch, useSelector } from 'react-redux';
import { getListingById, setSelectedListing, deleteListing } from 'store/listing/listing.action';
import { selectSelectedListing, selectListingLoading } from 'store/listing/listing.selector';
import { openSnackbar } from 'api/snackbar';
import ConfirmationDialog from 'components/dialogs/ConfirmationDialog';

export default function ListingSettingsPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const dispatch = useDispatch();
  const listing = useSelector(selectSelectedListing);
  const loading = useSelector(selectListingLoading);
  const theme = useTheme();
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
  const [deleting, setDeleting] = useState(false);

  useEffect(() => {
    if (id) {
      dispatch(getListingById(parseInt(id)));
    }
    return () => {
      dispatch(setSelectedListing(null));
    };
  }, [id, dispatch]);

  const isDraft = listing?.status === 'Draft' || listing?.status === 0;

  const handleDeleteListing = async () => {
    if (!id) return;
    setDeleting(true);
    try {
      const result = await dispatch(deleteListing(parseInt(id)));
      if (result?.success) {
        openSnackbar({
          open: true,
          message: 'Listing deleted',
          variant: 'alert',
          alert: { color: 'success' }
        });
        navigate('/landlord/listings');
      } else {
        openSnackbar({
          open: true,
          message: result?.message || 'Failed to delete listing',
          variant: 'alert',
          alert: { color: 'error' }
        });
      }
    } catch (e) {
      openSnackbar({
        open: true,
        message: e?.response?.data?.message || e?.message || 'Failed to delete listing',
        variant: 'alert',
        alert: { color: 'error' }
      });
    } finally {
      setDeleting(false);
      setDeleteConfirmOpen(false);
    }
  };

  if (loading && !listing) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '400px' }}>
        <CircularProgress />
      </Box>
    );
  }

  if (!listing) {
    return (
      <Box>
        <Typography variant="h6" color="error">
          Listing not found
        </Typography>
        <Button onClick={() => navigate('/landlord/listings')} sx={{ mt: 2 }}>
          Back to listings
        </Button>
      </Box>
    );
  }

  return (
    <Box>
      <PageBreadcrumbs
        links={[
          { title: 'Listings', to: '/landlord/listings' },
          { title: listing.listingNumber, to: `/landlord/listings/${id}` },
          { title: 'Settings' }
        ]}
      />

      <Box sx={{ mb: 3 }}>
        <Button
          startIcon={<ArrowLeftOutlined />}
          onClick={() => navigate(`/landlord/listings/${id}`)}
          sx={{
            color: 'text.secondary',
            textTransform: 'none',
            minWidth: 'auto',
            width: 'fit-content',
            '&:hover': { bgcolor: alpha(theme.palette.primary.main, 0.08) }
          }}
        >
          Back
        </Button>
      </Box>

      <MainCard sx={{ mb: 3 }}>
        <Stack spacing={2}>
          <Typography variant="h4" fontWeight={700}>
            Listing settings
          </Typography>
          <Typography variant="body2" color="text.secondary">
            {listing.propertyName}
            {listing.unitName ? ` – ${listing.unitName}` : ''}
          </Typography>
          <Button
            variant="outlined"
            startIcon={<EditOutlined />}
            onClick={() => navigate(`/landlord/listings/${id}/setup`)}
            sx={{ textTransform: 'none', alignSelf: 'flex-start', px: 2.5 }}
          >
            {isDraft ? 'Set up listing' : 'Edit listing'}
          </Button>
        </Stack>
      </MainCard>

      <MainCard
        sx={{
          bgcolor: (t) => alpha(t.palette.error.main, 0.05),
          border: `1px solid ${alpha(theme.palette.error.main, 0.2)}`
        }}
      >
        <Stack spacing={2}>
          <Typography variant="h6" fontWeight={600} color="error.main">
            Delete listing
          </Typography>
          <Typography variant="body2" color="text.secondary">
            Permanently delete this listing and all data tied to it (photos, amenities and features selected for this listing). Custom amenities and features you created will remain available for other listings.
          </Typography>
          <Button
            variant="outlined"
            color="error"
            disabled={deleting}
            startIcon={<DeleteOutlined />}
            onClick={() => setDeleteConfirmOpen(true)}
            sx={{
              textTransform: 'none',
              px: 2.5,
              alignSelf: 'flex-start',
              borderColor: 'error.main',
              color: 'error.main',
              '&:hover': {
                borderColor: 'error.dark',
                bgcolor: alpha(theme.palette.error.main, 0.08)
              }
            }}
          >
            {deleting ? 'Deleting...' : 'Delete listing'}
          </Button>
        </Stack>
      </MainCard>

      <ConfirmationDialog
        open={deleteConfirmOpen}
        onClose={() => setDeleteConfirmOpen(false)}
        onConfirm={handleDeleteListing}
        title="Delete listing"
        message="Are you sure you want to delete this listing? This will remove the listing and all data associated with it. Custom amenities and features you created will be kept. This action cannot be undone."
        confirmText="Delete"
        confirmColor="error"
      />
    </Box>
  );
}
