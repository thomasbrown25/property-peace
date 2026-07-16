import { Alert, AlertTitle, Typography } from '@mui/material';
import { useNavigate, useLocation } from 'react-router-dom';

export default function TrialBanner() {
  const navigate = useNavigate();
  const location = useLocation();

  const handleStartTrial = () => {
    // If already on subscription page, navigate to Plans tab
    if (location.pathname === '/landlord/subscription') {
      navigate('/landlord/subscription?tab=0');
    } else {
      // Otherwise, navigate to subscription page
      navigate('/landlord/subscription');
    }
  };

  return (
    <Alert
      severity="info"
      sx={{
        cursor: 'pointer',
        position: 'relative',
        transition: 'all 0.2s ease-in-out',
        '&:hover': {
          bgcolor: 'action.hover',
          transform: 'translateY(-1px)',
          boxShadow: 2
        }
      }}
      onClick={handleStartTrial}
    >
      <AlertTitle sx={{ fontWeight: 600, mb: 0.5 }}>Start Your Free 30-Day Trial</AlertTitle>
      <Typography variant="body2">
        Click anywhere on this banner to get started and start your free trial. You will need to subscribe before you can add a property.
      </Typography>
    </Alert>
  );
}
