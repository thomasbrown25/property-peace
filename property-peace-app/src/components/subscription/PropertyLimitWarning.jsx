import { Alert, AlertTitle, Button, Typography } from '@mui/material';
import { useNavigate } from 'react-router-dom';

export default function PropertyLimitWarning({ status }) {
  const navigate = useNavigate();

  if (!status) return null;

  // Show banner only if user has reached their property limit
  // (First property is allowed for free, so we check canAddProperty which accounts for this)
  if (!status.canAddProperty) {
    return (
      <Alert
        severity="warning"
        sx={{ mb: 3 }}
        action={
          <Button
            color="inherit"
            size="small"
            onClick={() => navigate('/landlord/settings?tab=subscription')}
          >
            Upgrade Plan
          </Button>
        }
      >
        <AlertTitle>Property Limit Reached</AlertTitle>
        <Typography variant="body2">
          {status.upgradeMessage || `You've reached your property limit (${status.currentPropertyCount} properties). Upgrade your subscription to add more properties.`}
        </Typography>
      </Alert>
    );
  }

  return null;
}

