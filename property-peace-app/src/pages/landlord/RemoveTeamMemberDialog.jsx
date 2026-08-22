import { useEffect, useState } from 'react';
import {
  Alert,
  alpha,
  Avatar,
  Box,
  Button,
  Chip,
  CircularProgress,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  IconButton,
  Stack,
  Typography,
  useMediaQuery,
  useTheme
} from '@mui/material';
import { CloseOutlined, DeleteOutlined } from '@ant-design/icons';

import { openSnackbar } from 'api/snackbar';
import { removeMember } from 'api/organizationMember';
import { createTeamMemberRemovalModel } from './teamMemberRemoval';

function roleColor(role) {
  if (role === 'Owner') return 'primary';
  if (role === 'Manager') return 'success';
  return 'default';
}

export default function RemoveTeamMemberDialog({ member, organization, open, onClose, onRemoved }) {
  const theme = useTheme();
  const fullScreen = useMediaQuery(theme.breakpoints.down('sm'));
  const [removing, setRemoving] = useState(false);
  const [error, setError] = useState('');
  const model = createTeamMemberRemovalModel(member, organization);

  useEffect(() => {
    if (open) setError('');
  }, [member, open]);

  const confirmRemoval = async () => {
    if (!member?.id || !organization?.id) return;

    setRemoving(true);
    setError('');
    try {
      await removeMember(organization.id, member.id);
      openSnackbar({
        open: true,
        message: `${model.name} was removed`,
        variant: 'alert',
        alert: { color: 'success' }
      });
      await onRemoved();
      onClose();
    } catch (err) {
      setError(err?.response?.data?.message || err?.response?.data?.Message || err?.message || 'Could not remove this team member.');
    } finally {
      setRemoving(false);
    }
  };

  return (
    <Dialog
      open={open}
      onClose={removing ? undefined : onClose}
      fullWidth
      maxWidth="xs"
      fullScreen={fullScreen}
      PaperProps={{ sx: { borderRadius: { xs: 0, sm: 3 }, overflow: 'hidden' } }}
    >
      <DialogTitle sx={{ px: { xs: 2.25, sm: 3 }, pt: { xs: 2.5, sm: 3 }, pb: 1.25 }}>
        <Stack direction="row" alignItems="flex-start" justifyContent="space-between" spacing={2}>
          <Stack direction="row" alignItems="center" spacing={1.4}>
            <Avatar sx={{ width: 44, height: 44, bgcolor: alpha(theme.palette.error.main, 0.1), color: 'error.main' }}>
              <DeleteOutlined />
            </Avatar>
            <Box>
              <Typography variant="h4" fontWeight={750}>
                {model.title}
              </Typography>
              <Typography sx={{ mt: 0.35, color: 'text.secondary', fontSize: '0.78rem' }}>
                Review the member before removing access.
              </Typography>
            </Box>
          </Stack>
          <IconButton onClick={onClose} disabled={removing} aria-label="Close remove team member dialog" size="small">
            <CloseOutlined />
          </IconButton>
        </Stack>
      </DialogTitle>

      <DialogContent sx={{ px: { xs: 2.25, sm: 3 }, pt: '12px !important' }}>
        <Stack spacing={2}>
          <Stack
            direction="row"
            alignItems="center"
            spacing={1.4}
            sx={{
              p: 1.6,
              borderRadius: 2,
              border: `1px solid ${alpha(theme.palette.divider, 0.22)}`,
              bgcolor: alpha(theme.palette.primary.main, 0.025)
            }}
          >
            <Avatar
              sx={{
                width: 46,
                height: 46,
                bgcolor: alpha(theme.palette.primary.main, 0.12),
                color: 'primary.main',
                fontWeight: 750,
                fontSize: '0.82rem'
              }}
            >
              {model.initials}
            </Avatar>
            <Box minWidth={0} flex={1}>
              <Typography fontWeight={750} noWrap>
                {model.name}
              </Typography>
              {model.email && model.email !== model.name && (
                <Typography noWrap sx={{ mt: 0.2, color: 'text.secondary', fontSize: '0.75rem' }}>
                  {model.email}
                </Typography>
              )}
            </Box>
            <Chip
              size="small"
              color={roleColor(model.role)}
              variant={model.role === 'Viewer' ? 'outlined' : 'filled'}
              label={model.role}
              sx={{ height: 24, fontWeight: 700, fontSize: '0.7rem' }}
            />
          </Stack>

          <Alert severity="warning" sx={{ alignItems: 'flex-start', '& .MuiAlert-message': { width: '100%' } }}>
            <Typography fontWeight={700} sx={{ fontSize: '0.8rem' }}>
              {model.consequence}
            </Typography>
            <Typography sx={{ mt: 0.4, fontSize: '0.74rem' }}>The organization and its other team members will not be affected.</Typography>
          </Alert>

          {error && <Alert severity="error">{error}</Alert>}
        </Stack>
      </DialogContent>

      <DialogActions
        sx={{
          px: { xs: 2.25, sm: 3 },
          pb: { xs: 2.5, sm: 3 },
          pt: 2,
          flexDirection: { xs: 'column-reverse', sm: 'row' },
          gap: 1,
          '& > :not(style) ~ :not(style)': { ml: 0 }
        }}
      >
        <Button
          onClick={onClose}
          disabled={removing}
          variant="outlined"
          color="inherit"
          fullWidth={fullScreen}
          sx={{ textTransform: 'none', fontWeight: 700 }}
        >
          {model.cancelLabel}
        </Button>
        <Button
          onClick={confirmRemoval}
          disabled={removing}
          variant="contained"
          color="error"
          fullWidth={fullScreen}
          startIcon={removing ? <CircularProgress size={16} color="inherit" /> : <DeleteOutlined />}
          sx={{ textTransform: 'none', fontWeight: 750, boxShadow: 'none' }}
        >
          {removing ? 'Removing…' : model.confirmLabel}
        </Button>
      </DialogActions>
    </Dialog>
  );
}
