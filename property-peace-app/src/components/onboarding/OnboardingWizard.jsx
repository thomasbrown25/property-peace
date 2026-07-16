import { useState, useEffect } from 'react';
import {
  Dialog,
  DialogContent,
  Button,
  Typography,
  Box,
  Stack,
  IconButton,
  Paper,
  alpha
} from '@mui/material';
import { 
  CloseOutlined, 
  RocketOutlined
} from '@ant-design/icons';
import useAuth from 'hooks/useAuth';
import axiosServices from 'utils/axios';

export default function OnboardingWizard({ open, onClose, onStartSetupTasks }) {
  const { user, updateUser } = useAuth();
  const [loading, setLoading] = useState(false);

  // Check if user has seen tutorial - if so, don't show
  const hasSeenTutorial = user?.HasSeenTutorial || user?.hasSeenTutorial || false;

  useEffect(() => {
    if (hasSeenTutorial && open) {
      onClose();
    }
  }, [hasSeenTutorial, open, onClose]);

  const handleClose = async () => {
    await markTutorialAsSeen();
    onClose();
  };

  const handleStartSetupTasks = async () => {
    await markTutorialAsSeen();
    onClose();
    onStartSetupTasks?.();
  };

  const markTutorialAsSeen = async () => {
    try {
      setLoading(true);
      await axiosServices.put('/api/user/tutorial-status', { hasSeenTutorial: true });
      
      if (updateUser && user) {
        updateUser({ ...user, HasSeenTutorial: true, hasSeenTutorial: true });
      }
    } catch (error) {
      console.error('Error marking tutorial as seen:', error);
    } finally {
      setLoading(false);
    }
  };

  if (hasSeenTutorial || !open) {
    return null;
  }

  return (
    <Dialog
      open={open && !hasSeenTutorial}
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
      <Box sx={{ position: 'relative', p: 3, pb: 2 }}>
        <IconButton
          onClick={handleClose}
          sx={{
            position: 'absolute',
            right: 16,
            top: 16,
            color: 'text.secondary',
            '&:hover': {
              backgroundColor: 'action.hover'
            }
          }}
        >
          <CloseOutlined />
        </IconButton>

      </Box>

      <DialogContent sx={{ px: 4, pb: 2 }}>
        <Paper
          sx={{
            p: 4,
            bgcolor: (theme) => alpha(theme.palette.background.paper, 0.6),
            borderRadius: 2
          }}
        >
          <Stack spacing={3} alignItems="center" sx={{ py: 4 }}>
            <Box
              sx={{
                width: 100,
                height: 100,
                borderRadius: '50%',
                bgcolor: (theme) => alpha(theme.palette.primary.main, 0.1),
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: 'primary.main',
                mb: 2
              }}
            >
              <RocketOutlined style={{ fontSize: 48 }} />
            </Box>
            <Typography variant="h4" fontWeight="bold" textAlign="center">
              Welcome to Property Peace! 🎉
            </Typography>
            <Typography variant="body1" color="text.secondary" textAlign="center" sx={{ maxWidth: 500 }}>
              Your all-in-one property management platform
            </Typography>
          </Stack>
        </Paper>
      </DialogContent>

      <Box sx={{ p: 3, pt: 2, display: 'flex', justifyContent: 'center', alignItems: 'center' }}>
        <Button
          variant="contained"
          size="large"
          onClick={handleStartSetupTasks}
          disabled={loading}
          sx={{ textTransform: 'none', fontWeight: 800, borderRadius: 1.5, px: 3 }}
        >
          Start your setup tasks
        </Button>
      </Box>
    </Dialog>
  );
}

