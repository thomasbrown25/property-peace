import { useParams, useNavigate, useSearchParams } from 'react-router-dom';

// material-ui
import { Box } from '@mui/material';

// project imports
import MainCard from 'components/MainCard';
import PageBreadcrumbs from 'components/breadcrumbs/PageBreadcrumbs';
import LeaseBuilderWizard from 'sections/lease-builder/LeaseBuilderWizard';
import { openSnackbar } from 'api/snackbar';
import useAuth from 'hooks/useAuth';

// ==============================|| LEASE BUILDER PAGE ||============================== //

export default function LeaseBuilderPage() {
  const { leaseId } = useParams();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { user } = useAuth();

  // Get property and unit IDs from URL parameters
  const initialPropertyId = searchParams.get('propertyId') ? parseInt(searchParams.get('propertyId')) : null;
  const initialUnitId = searchParams.get('unitId') ? parseInt(searchParams.get('unitId')) : null;

  const handleComplete = (leaseId) => {
    openSnackbar('success', 'Lease generated and finalized successfully');
    
    // Check if user hasn't seen tutorial - if so, navigate back to dashboard to reopen wizard
    const hasSeenTutorial = user?.HasSeenTutorial || user?.hasSeenTutorial || false;
    if (!hasSeenTutorial) {
      // Navigate to dashboard with a flag to reopen wizard
      navigate('/landlord/dashboard?leaseCompleted=true');
    } else {
      // Navigate to the newly created lease page using the leaseId from finalization
      navigate(`/landlord/leases/${leaseId}`);
    }
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
