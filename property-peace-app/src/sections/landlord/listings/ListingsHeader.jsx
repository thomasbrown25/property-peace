import { Box, Typography } from '@mui/material';
import PageBreadcrumbs from 'components/breadcrumbs/PageBreadcrumbs';

export default function ListingsHeader() {
  return (
    <Box sx={{ mb: 1 }}>
      <PageBreadcrumbs
        items={[
          { label: 'Dashboard', path: '/landlord/dashboard' },
          { label: 'Listings' }
        ]}
      />

      <Box sx={{ mb: 1, mt: 1.5 }}>
        <Typography variant="h4" fontWeight={700} sx={{ lineHeight: 1.2 }}>
          Listings
        </Typography>
        <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 0.5 }}>
          Manage your property listings, showcase availability, and attract tenants.
        </Typography>
      </Box>
    </Box>
  );
}
