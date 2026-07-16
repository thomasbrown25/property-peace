import { useState, useEffect } from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  Typography,
  Box,
  Stepper,
  Step,
  StepLabel,
  StepContent,
  Paper,
  Stack,
  IconButton,
  alpha
} from '@mui/material';
import { CloseOutlined, PlayCircleOutlined, RightOutlined } from '@ant-design/icons';
import VideoPlayer from '../videos/VideoPlayer';
import { getAllVideos, VIDEO_CATEGORIES } from 'data/videos';
import useAuth from 'hooks/useAuth';
import axiosServices from 'utils/axios';

/**
 * OnboardingDialog Component
 * 
 * Shows an onboarding flow for new users with key tutorial videos.
 * This is displayed once for users who haven't seen it (HasSeenTutorial = false).
 */
export default function OnboardingDialog({ open, onClose, onComplete }) {
  const { user, updateUser: updateUserContext } = useAuth();
  const [activeStep, setActiveStep] = useState(0);
  const [completed, setCompleted] = useState({});

  // Get essential onboarding videos (first 3-4 key videos)
  const onboardingVideos = getAllVideos().slice(0, 4);

  // Check if user has seen tutorial
  const hasSeenTutorial = user?.HasSeenTutorial || user?.hasSeenTutorial || false;

  useEffect(() => {
    // If user has already seen tutorial, don't show onboarding
    if (hasSeenTutorial && open) {
      onClose();
    }
  }, [hasSeenTutorial, open, onClose]);

  const handleNext = () => {
    setCompleted({ ...completed, [activeStep]: true });
    setActiveStep((prevActiveStep) => prevActiveStep + 1);
  };

  const handleBack = () => {
    setActiveStep((prevActiveStep) => prevActiveStep - 1);
  };

  const handleSkip = async () => {
    await markTutorialAsSeen();
    onComplete?.();
    onClose();
  };

  const handleComplete = async () => {
    setCompleted({ ...completed, [activeStep]: true });
    await markTutorialAsSeen();
    onComplete?.();
    onClose();
  };

  const markTutorialAsSeen = async () => {
    try {
      // Update user's HasSeenTutorial flag on backend using existing endpoint
      await axiosServices.put('/api/user/tutorial-status', { hasSeenTutorial: true });
      
      // Update user context if available
      if (updateUserContext) {
        updateUserContext({ ...user, HasSeenTutorial: true, hasSeenTutorial: true });
      }
    } catch (error) {
      console.error('Error marking tutorial as seen:', error);
      // Don't block the flow if this fails - user can still proceed
    }
  };

  if (hasSeenTutorial || onboardingVideos.length === 0) {
    return null;
  }

  return (
    <Dialog
      open={open && !hasSeenTutorial}
      onClose={handleSkip}
      maxWidth="md"
      fullWidth
      PaperProps={{
        sx: {
          borderRadius: 2
        }
      }}
    >
      <DialogTitle sx={{ 
        display: 'flex', 
        justifyContent: 'space-between', 
        alignItems: 'center',
        pb: 1
      }}>
        <Typography variant="h5" fontWeight="bold">
          Welcome to Property Peace! 🎉
        </Typography>
        <IconButton
          onClick={handleSkip}
          size="small"
          sx={{
            color: 'text.secondary',
            '&:hover': {
              backgroundColor: 'action.hover'
            }
          }}
        >
          <CloseOutlined />
        </IconButton>
      </DialogTitle>

      <DialogContent sx={{ p: 3 }}>
        <Typography variant="body1" color="text.secondary" sx={{ mb: 3 }}>
          Let's get you started with a quick tour of the most important features.
        </Typography>

        <Stepper activeStep={activeStep} orientation="vertical">
          {onboardingVideos.map((video, index) => (
            <Step key={video.key} completed={completed[index]}>
              <StepLabel>
                <Typography variant="subtitle1" fontWeight="bold">
                  {video.title}
                </Typography>
              </StepLabel>
              <StepContent>
                <Paper 
                  sx={{ 
                    p: 2, 
                    mt: 2,
                    bgcolor: (t) => alpha(t.palette.background.paper, 0.6)
                  }}
                >
                  <VideoPlayer 
                    videoId={video.id}
                    title={video.title}
                    description={video.description}
                    autoPlay={false}
                  />
                </Paper>
                <Box sx={{ mb: 2, mt: 2 }}>
                  <Stack direction="row" spacing={2}>
                    <Button
                      variant="contained"
                      onClick={index === onboardingVideos.length - 1 ? handleComplete : handleNext}
                      endIcon={index === onboardingVideos.length - 1 ? null : <RightOutlined />}
                    >
                      {index === onboardingVideos.length - 1 ? 'Get Started' : 'Next'}
                    </Button>
                    <Button
                      onClick={handleBack}
                      disabled={index === 0}
                    >
                      Back
                    </Button>
                    <Button
                      onClick={handleSkip}
                      color="inherit"
                    >
                      Skip Tutorial
                    </Button>
                  </Stack>
                </Box>
              </StepContent>
            </Step>
          ))}
        </Stepper>
      </DialogContent>

      <DialogActions sx={{ p: 2, pt: 1 }}>
        <Button onClick={handleSkip} color="inherit">
          Skip All
        </Button>
        <Button 
          onClick={() => {
            window.location.href = '/landlord/help';
            handleSkip();
          }}
          startIcon={<PlayCircleOutlined />}
        >
          View All Tutorials
        </Button>
      </DialogActions>
    </Dialog>
  );
}
