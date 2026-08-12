import { useParams, useNavigate, useSearchParams } from 'react-router-dom';

// material-ui
import { Box } from '@mui/material';

// project imports
import MainCard from 'components/MainCard';
import PageBreadcrumbs from 'components/breadcrumbs/PageBreadcrumbs';
import LeaseBuilderWizard from 'sections/lease-builder/LeaseBuilderWizard';
import { openSnackbar } from 'api/snackbar';

// ==============================|| LEASE BUILDER PAGE ||============================== //

export default function LeaseBuilderPage() {
  const { leaseId } = useParams();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();

  // Get property and unit IDs from URL parameters
  const initialPropertyId = searchParams.get('propertyId') ? parseInt(searchParams.get('propertyId')) : null;
  const initialUnitId = searchParams.get('unitId') ? parseInt(searchParams.get('unitId')) : null;

  const handleComplete = (completedLeaseId) => {
    openSnackbar('success', 'Lease generated and finalized successfully');
    navigate(`/landlord/leases/${completedLeaseId}`);
  };

  return (
    <Box>
      <PageBreadcrumbs
        items={[
          { label: 'Dashboard', path: '/landlord/dashboard' },
          { label: 'Add Lease' }
        ]}
      />

      <Box sx={{ display: 'flex', justifyContent: 'center', mt: 3 }}>
        <MainCard sx={{ minHeight: '600px', display: 'flex', flexDirection: 'column', maxWidth: 600, width: '100%' }}>
          <LeaseBuilderWizard
            leaseId={leaseId ? parseInt(leaseId) : null}
            onComplete={handleComplete}
            initialPropertyId={initialPropertyId}
            initialUnitId={initialUnitId}
          />
        </MainCard>
      </Box>
    </Box>
  );
}
