import { useNavigate } from 'react-router-dom';

// material-ui
import { Container, Box } from '@mui/material';

// project imports
import MainCard from 'components/MainCard';
import RecordPaymentWizard from 'sections/payment-recording/RecordPaymentWizard';
import { openSnackbar } from 'api/snackbar';

// ==============================|| RECORD PAYMENT PAGE ||============================== //

export default function RecordPaymentPage() {
  const navigate = useNavigate();

  const handleComplete = () => {
    openSnackbar('success', 'Payment recorded successfully!');
    navigate('/landlord/dashboard');
  };

  return (
    <Box
      sx={{
        display: 'flex',
        justifyContent: 'center',
        width: '100%',
        py: 4
      }}
    >
      <Container maxWidth="xl" sx={{ width: '100%' }}>
        <MainCard>
          <RecordPaymentWizard onComplete={handleComplete} />
        </MainCard>
      </Container>
    </Box>
  );
}
