import { Box, Typography } from '@mui/material';
import PageBreadcrumbs from 'components/breadcrumbs/PageBreadcrumbs';

export default function TenantsHeader() {
  return (
    <Box sx={{ mb: 3 }}>
      <PageBreadcrumbs
        items={[
          { label: 'Dashboard', path: '/landlord/dashboard' },
          { label: 'Tenants' }
        ]}
      />
      <Box sx={{ mt: 1.5 }}>
        <Typography variant="h3" fontWeight={700} sx={{ lineHeight: 1.15 }}>
          Tenants
        </Typography>
        <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
          Manage renter relationships, account access, and lease assignments.
        </Typography>
      </Box>
    </Box>
  );
}
