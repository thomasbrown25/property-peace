import PropTypes from 'prop-types';
import { Alert, AlertTitle, Button, Stack } from '@mui/material';
import { useNavigate } from 'react-router-dom';

export default function FeatureReadinessNotice({ presentation, featureName, compact = false }) {
  const navigate = useNavigate();
  if (!presentation || presentation.status === 'available') return null;
  return (
    <Alert
      severity={presentation.severity}
      action={presentation.action === 'upgrade' ? (
        <Button color="inherit" size="small" onClick={() => navigate('/landlord/settings?tab=subscription')}>View plans</Button>
      ) : undefined}
      sx={compact ? { py: 0.25 } : undefined}
    >
      <Stack>
        <AlertTitle sx={{ mb: 0 }}>{featureName ? `${featureName}: ${presentation.title}` : presentation.title}</AlertTitle>
        {!compact && presentation.message}
      </Stack>
    </Alert>
  );
}

FeatureReadinessNotice.propTypes = {
  presentation: PropTypes.object,
  featureName: PropTypes.string,
  compact: PropTypes.bool
};
