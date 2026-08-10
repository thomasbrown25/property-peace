import { Alert, AlertTitle, Typography } from '@mui/material';
import { useNavigate } from 'react-router-dom';

export default function FreePlanBanner() {
  const navigate = useNavigate();
  const handleStartFree = () => {
    navigate('/landlord/settings?tab=subscription');
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
      onClick={handleStartFree}
    >
      <AlertTitle sx={{ fontWeight: 600, mb: 0.5 }}>Start Free</AlertTitle>
      <Typography variant="body2">
        Free for up to 5 units. Click anywhere on this banner to review your plan options.
      </Typography>
    </Alert>
  );
}
