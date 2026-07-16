import { useState, useEffect } from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  Box,
  Typography,
  IconButton,
  Checkbox,
  FormControlLabel,
  Stack,
  alpha
} from '@mui/material';
import { CloseOutlined } from '@ant-design/icons';
import VideoPlayer from 'components/videos/VideoPlayer';
import { getVideo } from 'data/videos';

// ==============================|| ONBOARDING VIDEO DIALOG ||============================== //

export default function OnboardingVideoDialog({ open, onClose, onDontShowAgain }) {
  const [dontShowAgain, setDontShowAgain] = useState(false);
  const onboardingVideo = getVideo('onboarding');

  useEffect(() => {
    if (open) {
      setDontShowAgain(false);
    }
  }, [open]);

  const handleClose = () => {
    // If "Don't show again" checkbox is checked, call onDontShowAgain
    // Otherwise, just close (which handles "Skip for now")
    if (dontShowAgain) {
      onDontShowAgain();
    } else {
      onClose();
    }
  };

  const handleSkipForNow = () => {
    // Skip for now - just close, don't call onDontShowAgain
    onClose();
  };

  const handleGetStarted = () => {
    // If "Don't show again" is checked, mark as seen permanently
    // Otherwise, just close (skip for now)
    if (dontShowAgain) {
      onDontShowAgain();
    } else {
      onClose();
    }
  };

  const handleCheckboxChange = (event) => {
    setDontShowAgain(event.target.checked);
  };

  if (!onboardingVideo) {
    return null;
  }

  return (
    <Dialog
      open={open}
      onClose={handleClose}
      maxWidth="md"
      fullWidth
      PaperProps={{
        sx: {
          borderRadius: 2,
          boxShadow: (theme) => `0 8px 32px ${alpha(theme.palette.common.black, 0.12)}`
        }
      }}
    >
      <DialogTitle>
        <Stack direction="row" justifyContent="space-between" alignItems="center">
          <Typography variant="h5" fontWeight="bold">
            Welcome to Property Peace!
          </Typography>
          <IconButton
            edge="end"
            color="inherit"
            onClick={handleClose}
            aria-label="close"
            size="small"
          >
            <CloseOutlined />
          </IconButton>
        </Stack>
      </DialogTitle>
      <DialogContent>
        <Box sx={{ mb: 2 }}>
          <Typography variant="body1" color="text.secondary" paragraph>
            Let's get you started with a quick tour of the platform. This video will walk you through the basics of managing your properties.
          </Typography>
        </Box>
        <Box
          sx={{
            width: '100%',
            borderRadius: 2,
            overflow: 'hidden',
            bgcolor: 'background.paper',
            boxShadow: 1
          }}
        >
          <VideoPlayer 
            videoId={onboardingVideo.id}
            title={onboardingVideo.title}
            thumbnailUrl={null}
          />
        </Box>
      </DialogContent>
      <DialogActions sx={{ px: 3, pb: 2, justifyContent: 'space-between' }}>
        <FormControlLabel
          control={
            <Checkbox
              checked={dontShowAgain}
              onChange={handleCheckboxChange}
              size="small"
            />
          }
          label={
            <Typography variant="body2" color="text.secondary">
              Don't show this again
            </Typography>
          }
        />
        <Stack direction="row" spacing={2}>
          <Button onClick={handleSkipForNow} variant="outlined">
            Skip for now
          </Button>
          <Button onClick={handleGetStarted} variant="contained" color="primary">
            Get Started
          </Button>
        </Stack>
      </DialogActions>
    </Dialog>
  );
}
