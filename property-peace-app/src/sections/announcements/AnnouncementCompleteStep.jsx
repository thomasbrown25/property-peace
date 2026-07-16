import PropTypes from 'prop-types';
import { useNavigate } from 'react-router-dom';

// material-ui
import {
  Box,
  Typography,
  Button,
  Stack,
  Alert
} from '@mui/material';
import { CheckCircleOutlined, ArrowLeftOutlined } from '@ant-design/icons';

// ==============================|| ANNOUNCEMENT COMPLETE STEP ||============================== //

export default function AnnouncementCompleteStep({ sentCount, failedCount, onBack, isScheduled = false }) {
  const navigate = useNavigate();

  return (
    <Box sx={{ textAlign: 'center', py: 4 }}>
      <CheckCircleOutlined style={{ fontSize: 80, color: '#4caf50', marginBottom: 16 }} />
      <Typography variant="h5" sx={{ mb: 2, fontWeight: 'bold' }}>
        {isScheduled ? 'Announcement Scheduled Successfully!' : 'Announcement Sent Successfully!'}
      </Typography>
      
      <Stack spacing={2} sx={{ maxWidth: 500, mx: 'auto', mb: 3 }}>
        <Typography variant="body1" color="text.secondary">
          {isScheduled ? (
            <>Your announcement has been scheduled and will be sent to <strong>{sentCount}</strong> tenant(s) with created accounts at the scheduled time.</>
          ) : (
            <>Your announcement has been sent to <strong>{sentCount}</strong> tenant(s) with created accounts.</>
          )}
        </Typography>
        
        {failedCount > 0 && (
          <Alert severity="warning">
            {failedCount} delivery attempt(s) failed. Please check the announcement history for details.
          </Alert>
        )}
        
        {sentCount === 0 && (
          <Alert severity="info">
            No tenants with created accounts were found for the selected properties/organizations.
          </Alert>
        )}
      </Stack>

      <Stack direction="row" spacing={2} justifyContent="center">
        <Button
          variant="outlined"
          startIcon={<ArrowLeftOutlined />}
          onClick={onBack}
        >
          Back to Announcements
        </Button>
        <Button
          variant="contained"
          color="primary"
          onClick={() => navigate('/landlord/announcements')}
        >
          View Announcement History
        </Button>
      </Stack>
    </Box>
  );
}

AnnouncementCompleteStep.propTypes = {
  sentCount: PropTypes.number.isRequired,
  failedCount: PropTypes.number.isRequired,
  onBack: PropTypes.func.isRequired,
  isScheduled: PropTypes.bool
};
