import { useState, useEffect } from 'react';
import {
  Dialog,
  DialogContent,
  Button,
  Typography,
  Box,
  Stack,
  IconButton,
  Chip,
  LinearProgress,
  alpha
} from '@mui/material';
import { 
  CloseOutlined, 
  CheckCircleFilled,
  RightOutlined,
  RocketOutlined
} from '@ant-design/icons';
import useAuth from 'hooks/useAuth';
import axiosServices from 'utils/axios';

export default function OnboardingWizard({ open, onClose, onStartSetupTasks, steps = [] }) {
  const { user, updateUser } = useAuth();
  const [loading, setLoading] = useState(false);

  // Check if user has seen tutorial - if so, don't show
  const hasSeenTutorial = user?.HasSeenTutorial || user?.hasSeenTutorial || false;
  const firstName = user?.firstname || user?.Firstname || user?.firstName || user?.FirstName;
  const completedCount = steps.filter((step) => step.completed).length;
  const totalCount = steps.length;
  const progress = totalCount ? Math.round((completedCount / totalCount) * 100) : 0;
  const essentialSteps = steps.filter((step) => step.required && !step.completed).slice(0, 3);

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
      maxWidth="sm"
      fullWidth
      PaperProps={{
        sx: {
          borderRadius: 3,
          overflow: 'hidden',
          boxShadow: (theme) => `0 24px 70px ${alpha(theme.palette.common.black, 0.24)}`
        }
      }}
    >
      <Box
        sx={{
          position: 'relative',
          px: { xs: 3, sm: 4 },
          pt: { xs: 3.5, sm: 4 },
          pb: 3,
          color: '#fff',
          bgcolor: '#061e35'
        }}
      >
        <IconButton
          onClick={handleClose}
          aria-label="Close welcome dialog"
          sx={{
            position: 'absolute',
            right: 14,
            top: 14,
            color: alpha('#fff', 0.76),
            '&:hover': { color: '#fff', backgroundColor: alpha('#fff', 0.1) }
          }}
        >
          <CloseOutlined />
        </IconButton>
        <Chip
          icon={<RocketOutlined style={{ color: '#41a541' }} />}
          label="LET’S GET YOU SET UP"
          size="small"
          sx={{
            mb: 2,
            color: '#86efac',
            bgcolor: alpha('#41a541', 0.12),
            border: `1px solid ${alpha('#41a541', 0.3)}`,
            fontWeight: 800,
            letterSpacing: 0.5,
            '& .MuiChip-icon': { color: '#41a541' }
          }}
        />
        <Typography variant="h3" fontWeight={850} sx={{ color: '#fff', pr: 4, lineHeight: 1.15 }}>
          {firstName ? `Welcome, ${firstName}.` : 'Welcome to Property Peace.'}
        </Typography>
        <Typography variant="body1" sx={{ mt: 1.25, color: alpha('#fff', 0.78), maxWidth: 500, lineHeight: 1.65 }}>
          Add the essentials once, and Property Peace will organize rent, leases, tenants, and day-to-day work around your portfolio.
        </Typography>
      </Box>

      <DialogContent sx={{ px: { xs: 3, sm: 4 }, py: 3.25 }}>
        <Stack spacing={2.5}>
          {totalCount > 0 && (
            <Box>
              <Stack direction="row" alignItems="center" justifyContent="space-between" sx={{ mb: 1 }}>
                <Typography variant="subtitle2" fontWeight={800}>Your setup checklist</Typography>
                <Typography variant="caption" color="text.secondary" fontWeight={700}>
                  {completedCount} of {totalCount} complete
                </Typography>
              </Stack>
              <LinearProgress
                variant="determinate"
                value={progress}
                sx={{
                  height: 7,
                  borderRadius: 99,
                  bgcolor: alpha('#41a541', 0.12),
                  '& .MuiLinearProgress-bar': { borderRadius: 99, bgcolor: '#41a541' }
                }}
              />
            </Box>
          )}

          <Stack spacing={1.25}>
            {(essentialSteps.length ? essentialSteps : steps.filter((step) => !step.completed).slice(0, 3)).map((step, index) => (
              <Stack
                key={step.id}
                direction="row"
                spacing={1.5}
                alignItems="center"
                sx={{ p: 1.5, border: '1px solid', borderColor: 'divider', borderRadius: 2 }}
              >
                <Box
                  sx={{
                    width: 30,
                    height: 30,
                    borderRadius: '50%',
                    display: 'grid',
                    placeItems: 'center',
                    flexShrink: 0,
                    color: '#347f34',
                    bgcolor: alpha('#41a541', 0.12),
                    fontWeight: 850,
                    fontSize: '0.8rem'
                  }}
                >
                  {index + 1}
                </Box>
                <Box sx={{ minWidth: 0 }}>
                  <Typography variant="body2" fontWeight={800}>{step.title}</Typography>
                  <Typography variant="caption" color="text.secondary">{step.description}</Typography>
                </Box>
              </Stack>
            ))}
            {steps.length > 0 && essentialSteps.length === 0 && steps.every((step) => step.completed) && (
              <Stack direction="row" spacing={1.25} alignItems="center" sx={{ p: 1.5, borderRadius: 2, bgcolor: alpha('#41a541', 0.08) }}>
                <CheckCircleFilled style={{ color: '#41a541', fontSize: 22 }} />
                <Typography variant="body2" fontWeight={800}>Your account setup is complete.</Typography>
              </Stack>
            )}
          </Stack>

          <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1.25}>
            <Button
              variant="contained"
              size="large"
              onClick={handleStartSetupTasks}
              disabled={loading}
              endIcon={<RightOutlined />}
              sx={{
                flex: 1,
                textTransform: 'none',
                fontWeight: 800,
                borderRadius: 1.75,
                bgcolor: '#41a541',
                boxShadow: 'none',
                '&:hover': { bgcolor: '#347f34', boxShadow: 'none' }
              }}
            >
              View setup checklist
            </Button>
            <Button
              variant="text"
              size="large"
              onClick={handleClose}
              disabled={loading}
              sx={{ textTransform: 'none', fontWeight: 750, color: '#061e35' }}
            >
              Explore dashboard
            </Button>
          </Stack>
          <Typography variant="caption" color="text.secondary" textAlign="center">
            You can reopen the checklist anytime from <strong>Finish Setup</strong> in the top bar.
          </Typography>
        </Stack>
      </DialogContent>
    </Dialog>
  );
}

