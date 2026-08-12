import { useNavigate } from 'react-router-dom';

// material-ui
import { Box, Container } from '@mui/material';

// project imports
import MainCard from 'components/MainCard';
import LeaseAgreementBuilder from 'sections/lease-builder/LeaseAgreementBuilder';
import { openSnackbar } from 'api/snackbar';
import useFetchProperties from 'hooks/useFetchProperties';

// ==============================|| LEASE AGREEMENT BUILDER PAGE ||============================== //

export default function LeaseAgreementBuilderPage() {
  const navigate = useNavigate();
  const { propertiesRefetch } = useFetchProperties();

  const handleComplete = async (leaseId) => {
    // Refresh properties to get updated lease data with the new agreement
    await propertiesRefetch();
    
    openSnackbar('success', 'Lease agreement created and finalized successfully');
    navigate(`/landlord/leases/${leaseId}`, { state: { fromLeaseBuilder: true } });
  };

  return (
    <Container maxWidth="xl">
      <MainCard>
        <LeaseAgreementBuilder onComplete={handleComplete} />
      </MainCard>
    </Container>
  );
}
