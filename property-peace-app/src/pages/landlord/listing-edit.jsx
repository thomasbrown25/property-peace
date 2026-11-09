import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { Alert, Box, Button, CircularProgress, Stack } from '@mui/material';
import MainCard from 'components/MainCard';
import PageBreadcrumbs from 'components/breadcrumbs/PageBreadcrumbs';
import ListingPropertyDetails from 'components/ListingPropertyDetails';
import listingApi from 'api/listing';

export default function ListingEditPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [listing, setListing] = useState(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  const [retry, setRetry] = useState(0);

  useEffect(() => {
    let active = true;
    setLoading(true);
    setListing(null);
    setError('');
    listingApi.getListingById(id).then((response) => {
      const value = response.data?.data ?? response.data;
      if (!response.success || !value || String(value.id) !== String(id)) throw new Error(response.message || 'Listing not found.');
      if (active) setListing(value);
    }).catch((failure) => {
      if (active) setError(failure?.response?.data?.message || failure.message || 'Could not load the listing.');
    }).finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [id, retry]);

  return <Box sx={{ pb: 4 }}>
    <PageBreadcrumbs items={[
      { label: 'Listings', path: '/landlord/listings' },
      { label: listing?.propertyName || 'Listing', path: `/landlord/listings/${id}` },
      { label: 'Edit listing' }
    ]} />
    {loading ? <Stack alignItems="center" sx={{ py: 8 }}><CircularProgress aria-label="Loading listing" /></Stack>
      : error ? <Alert severity="error" action={<Button color="inherit" onClick={() => setRetry((value) => value + 1)}>Retry</Button>}>{error}</Alert>
        : listing && <MainCard><Stack spacing={3}>
          <Alert severity="info">Changes to the linked property or unit apply everywhere they are used. The address cannot be changed here.</Alert>
          <ListingPropertyDetails key={id} listing={listing} editPage />
        </Stack></MainCard>}
    {!loading && error && <Button sx={{ mt: 2 }} onClick={() => navigate('/landlord/listings')}>Back to listings</Button>}
  </Box>;
}
