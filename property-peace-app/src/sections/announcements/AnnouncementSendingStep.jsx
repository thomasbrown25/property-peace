import PropTypes from 'prop-types';
import { alpha, useTheme } from '@mui/material';

// material-ui
import {
  Box,
  Typography,
  CircularProgress,
  Stack,
  LinearProgress
} from '@mui/material';

// ==============================|| ANNOUNCEMENT SENDING STEP ||============================== //

export default function AnnouncementSendingStep({ message, isScheduled = false }) {
  const theme = useTheme();
  
  return (
    <Box
      sx={{
        position: 'relative',
        minHeight: '400px',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 3,
        p: 4
      }}
    >
      <CircularProgress size={60} thickness={4} />
      <Box sx={{ width: '100%', maxWidth: 300 }}>
        <LinearProgress />
      </Box>
      <Stack spacing={1} sx={{ textAlign: 'center', px: 2 }}>
        <Typography variant="h4" sx={{ fontWeight: 600 }}>
          {isScheduled ? 'Saving Your Announcement' : 'Sending Your Announcement'}
        </Typography>
        <Typography variant="body1" color="text.secondary">
          {isScheduled 
            ? "We're saving your announcement to be sent at the scheduled time..."
            : "We're sending your announcement to all tenants..."}
        </Typography>
        <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
          This will just take a moment
        </Typography>
      </Stack>
    </Box>
  );
}

AnnouncementSendingStep.propTypes = {
  message: PropTypes.string,
  isScheduled: PropTypes.bool
};
