import { useNavigate } from 'react-router-dom';

// material-ui
import { Box, Container } from '@mui/material';

// project imports
import MainCard from 'components/MainCard';
import LeaseAgreementBuilder from 'sections/lease-builder/LeaseAgreementBuilder';
import { openSnackbar } from 'api/snackbar';
import useAuth from 'hooks/useAuth';
import useFetchProperties from 'hooks/useFetchProperties';

// ==============================|| LEASE AGREEMENT BUILDER PAGE ||============================== //

export default function LeaseAgreementBuilderPage() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { propertiesRefetch } = useFetchProperties();

  const handleComplete = async (leaseId) => {
    // Refresh properties to get updated lease data with the new agreement
    await propertiesRefetch();
    
    openSnackbar('success', 'Lease agreement created and finalized successfully');
    
    // Check if user hasn't seen tutorial - if so, navigate back to dashboard to reopen wizard
    const hasSeenTutorial = user?.HasSeenTutorial || user?.hasSeenTutorial || false;
    if (!hasSeenTutorial) {
      // Navigate to dashboard with a flag to reopen wizard
      navigate('/landlord/dashboard?leaseCompleted=true');
    } else {
      // Navigate to the lease page with state to trigger refresh
      navigate(`/landlord/leases/${leaseId}`, { state: { fromLeaseBuilder: true } });
    }
  };

  return (
    <Container maxWidth="xl">
      <MainCard>
        <LeaseAgreementBuilder onComplete={handleComplete} />
      </MainCard>
    </Container>
  );
}
