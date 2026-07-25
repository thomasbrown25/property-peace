import { useCallback, useEffect, useState } from 'react';
import { startRegistration } from '@simplewebauthn/browser';
import {
  Alert,
  Box,
  Button,
  CircularProgress,
  Divider,
  IconButton,
  List,
  ListItem,
  ListItemText,
  Paper,
  Stack,
  TextField,
  Typography,
  alpha
} from '@mui/material';
import { DeleteOutlined, KeyOutlined, PlusOutlined } from '@ant-design/icons';
import axiosServices from 'utils/axios';
import { openSnackbar } from 'api/snackbar';

export default function PasskeySettingsCard() {
  const [passkeys, setPasskeys] = useState([]);
  const [name, setName] = useState('');
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [deletingId, setDeletingId] = useState(null);
  const isSupported =
    typeof window !== 'undefined' && typeof navigator !== 'undefined' && !!window.PublicKeyCredential && !!navigator.credentials;

  const loadPasskeys = useCallback(async () => {
    try {
      const response = await axiosServices.get('/api/passkey');
      setPasskeys(Array.isArray(response.data) ? response.data : []);
    } catch (error) {
      openSnackbar({
        open: true,
        message: error.response?.data?.message || 'Unable to load passkeys.',
        variant: 'alert',
        alert: { color: 'error' }
      });
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadPasskeys();
  }, [loadPasskeys]);

  const createPasskey = async () => {
    if (!isSupported) return;

    try {
      setCreating(true);
      const optionsResponse = await axiosServices.post('/api/passkey/registration/options');
      const { ceremonyId, options } = optionsResponse.data || {};
      if (!ceremonyId || !options) throw new Error('Unable to start passkey setup.');

      const registration = await startRegistration({ optionsJSON: options });
      await axiosServices.post('/api/passkey/registration/verify', {
        ceremonyId,
        response: registration,
        name: name.trim() || null
      });

      setName('');
      await loadPasskeys();
      openSnackbar({
        open: true,
        message: 'Passkey added. You can now use it to sign in.',
        variant: 'alert',
        alert: { color: 'success' }
      });
    } catch (error) {
      if (error?.name !== 'NotAllowedError') {
        openSnackbar({
          open: true,
          message: error.response?.data?.message || error.message || 'Passkey setup failed.',
          variant: 'alert',
          alert: { color: 'error' }
        });
      }
    } finally {
      setCreating(false);
    }
  };

  const deletePasskey = async (passkey) => {
    if (!window.confirm(`Remove “${passkey.name}”? You will no longer be able to sign in with it.`)) return;

    try {
      setDeletingId(passkey.id);
      await axiosServices.delete(`/api/passkey/${passkey.id}`);
      setPasskeys((current) => current.filter((item) => item.id !== passkey.id));
      openSnackbar({
        open: true,
        message: 'Passkey removed.',
        variant: 'alert',
        alert: { color: 'success' }
      });
    } catch (error) {
      openSnackbar({
        open: true,
        message: error.response?.data?.message || 'Unable to remove passkey.',
        variant: 'alert',
        alert: { color: 'error' }
      });
    } finally {
      setDeletingId(null);
    }
  };

  return (
    <Paper variant="outlined" sx={{ p: 3, bgcolor: (theme) => alpha(theme.palette.background.paper, 0.6) }}>
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
        <KeyOutlined style={{ fontSize: 20, color: '#16a34a' }} />
        <Typography variant="h6" fontWeight="bold">
          Passkeys
        </Typography>
      </Box>
      <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
        Passkeys let you sign in with your fingerprint, face, screen lock, or security key. They are optional—your password and Google sign-in
        will keep working.
      </Typography>

      {!isSupported && (
        <Alert severity="info" sx={{ mb: 2 }}>
          This browser or device does not support passkeys.
        </Alert>
      )}

      {loading ? (
        <Box sx={{ display: 'flex', justifyContent: 'center', py: 2 }}>
          <CircularProgress size={24} />
        </Box>
      ) : (
        <>
          {passkeys.length > 0 ? (
            <List disablePadding sx={{ mb: 2 }}>
              {passkeys.map((passkey, index) => (
                <Box key={passkey.id}>
                  {index > 0 && <Divider />}
                  <ListItem
                    disableGutters
                    secondaryAction={
                      <IconButton
                        edge="end"
                        aria-label={`Remove ${passkey.name}`}
                        color="error"
                        disabled={deletingId === passkey.id}
                        onClick={() => deletePasskey(passkey)}
                      >
                        {deletingId === passkey.id ? <CircularProgress size={20} /> : <DeleteOutlined />}
                      </IconButton>
                    }
                  >
                    <ListItemText
                      primary={passkey.name}
                      secondary={`Added ${new Date(passkey.createdAt).toLocaleDateString()}${
                        passkey.lastUsedAt ? ` • Last used ${new Date(passkey.lastUsedAt).toLocaleDateString()}` : ''
                      }`}
                    />
                  </ListItem>
                </Box>
              ))}
            </List>
          ) : (
            <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
              No passkeys have been added yet.
            </Typography>
          )}

          <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1.5} alignItems={{ sm: 'flex-start' }}>
            <TextField
              size="small"
              label="Passkey name (optional)"
              placeholder="e.g. Personal laptop"
              value={name}
              onChange={(event) => setName(event.target.value)}
              inputProps={{ maxLength: 100 }}
              disabled={!isSupported || creating}
              sx={{ width: { xs: '100%', sm: 280 } }}
            />
            <Button
              variant="contained"
              startIcon={creating ? <CircularProgress size={18} color="inherit" /> : <PlusOutlined />}
              disabled={!isSupported || creating}
              onClick={createPasskey}
              sx={{ bgcolor: '#16a34a', '&:hover': { bgcolor: '#15803d' } }}
            >
              {creating ? 'Adding…' : 'Add passkey'}
            </Button>
          </Stack>
        </>
      )}
    </Paper>
  );
}
