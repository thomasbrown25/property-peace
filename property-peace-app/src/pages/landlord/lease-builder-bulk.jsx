import { useNavigate } from 'react-router-dom';

// material-ui
import { Box } from '@mui/material';

// project imports
import MainCard from 'components/MainCard';
import PageBreadcrumbs from 'components/breadcrumbs/PageBreadcrumbs';
import BulkLeaseBuilderWizard from 'sections/lease-builder/BulkLeaseBuilderWizard';
import { openSnackbar } from 'api/snackbar';

// ==============================|| BULK LEASE BUILDER PAGE ||============================== //

export default function LeaseBuilderBulkPage() {
  const navigate = useNavigate();

  const handleComplete = (leaseIds) => {
    const count = Array.isArray(leaseIds) ? leaseIds.length : 1;
    openSnackbar({
      open: true,
      message: `Successfully created ${count} lease(s)`,
      variant: 'alert',
      alert: { color: 'success' },
      autoHideDuration: 3000
    });
    
    // Navigate to leases page
    navigate('/landlord/leases');
  };

  return (
    <Box>
      <PageBreadcrumbs
        items={[
          { label: 'Dashboard', path: '/landlord/dashboard' },
          { label: 'Add Lease (Bulk)' }
        ]}
      />

      <MainCard sx={{ mt: 3, minHeight: '600px', display: 'flex', flexDirection: 'column' }}>
        <BulkLeaseBuilderWizard onComplete={handleComplete} />
      </MainCard>
    </Box>
  );
}
