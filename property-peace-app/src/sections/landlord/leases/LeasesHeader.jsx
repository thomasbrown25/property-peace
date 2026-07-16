import { Box, Typography } from '@mui/material';
import PageBreadcrumbs from 'components/breadcrumbs/PageBreadcrumbs';

export default function LeasesHeader() {
  return (
    <Box sx={{ mb: 1.5 }}>
      <PageBreadcrumbs
        items={[
          { label: 'Dashboard', path: '/landlord/dashboard' },
          { label: 'Leases' }
        ]}
      />
      <Typography variant="h3" fontWeight={700}>
        Leases
      </Typography>
      <Typography variant="body1" color="text.secondary">
        Manage lease agreements, track terms, and monitor tenant occupancy.
      </Typography>
    </Box>
  );
}

