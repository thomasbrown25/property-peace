import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Alert,
  Box,
  Button,
  Chip,
  CircularProgress,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Divider,
  Paper,
  Stack,
  TextField,
  Typography,
  alpha
} from '@mui/material';
import { LockOutlined, MobileOutlined, SafetyCertificateOutlined } from '@ant-design/icons';
import PasskeySettingsCard from './PasskeySettingsCard';
import {
  confirmSmsEnrollment,
  confirmTotpEnrollment,
  disableMfaMethod,
  getMfaStatus,
  startSmsEnrollment,
  startTotpEnrollment
} from 'api/security';
import { openSnackbar } from 'api/snackbar';

const methodLabel = { sms: 'Text message', totp: 'Authenticator app' };
const getErrorMessage = (error, fallback) => error?.response?.data?.message || error?.message || fallback;
const ensureSuccessful = (result, fallback) => {
  if (result?.success === false) throw new Error(result.message || fallback);
  return result;
};

const normalizeStatus = (status) => {
  if (typeof status?.smsEnabled === 'boolean' || typeof status?.totpEnabled === 'boolean') {
    const enabled = new Map();
    if (status.smsEnabled) enabled.set('sms', { type: 'sms', maskedDestination: status.maskedPhone });
    if (status.totpEnabled) enabled.set('totp', { type: 'totp' });
    return { enabled };
  }

  const methods = Array.isArray(status?.methods) ? status.methods : [];
  const enabled = new Map(
    methods
      .filter((method) => method && method.enabled !== false && method.isEnabled !== false)
      .map((method) => [String(method.type || '').toLowerCase(), method])
  );
  return { enabled };
};

export default function AuthenticationMethodsCard() {
  const [status, setStatus] = useState(null);
  const [loading, setLoading] = useState(true);
  const [statusError, setStatusError] = useState('');
  const [busyMethod, setBusyMethod] = useState('');
  const [smsDialog, setSmsDialog] = useState({ open: false, step: 'phone', phoneNumber: '', enrollmentId: '', destination: '', code: '' });
  const [totpDialog, setTotpDialog] = useState({ open: false, enrollmentId: '', secret: '', qrCode: '', code: '', loading: false });
  const normalized = useMemo(() => normalizeStatus(status), [status]);

  const loadStatus = useCallback(async () => {
    setStatusError('');
    try {
      setStatus(await getMfaStatus());
    } catch (error) {
      setStatusError(getErrorMessage(error, 'Unable to load authentication methods.'));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadStatus();
  }, [loadStatus]);

  const notify = (message) => openSnackbar({ open: true, message, variant: 'alert', alert: { color: 'success' } });

  const startSms = async () => {
    try {
      setBusyMethod('sms-start');
      const result = ensureSuccessful(await startSmsEnrollment(smsDialog.phoneNumber.trim()), 'Unable to send a verification code.');
      const enrollmentId = result?.challengeId || result?.enrollmentId || result?.id;
      if (!enrollmentId) throw new Error('The server did not return an SMS enrollment ID.');
      setSmsDialog((current) => ({
        ...current,
        step: 'code',
        enrollmentId,
        destination: result.maskedPhone || result.maskedDestination || current.phoneNumber,
        code: ''
      }));
    } catch (error) {
      setStatusError(getErrorMessage(error, 'Unable to send a verification code.'));
    } finally {
      setBusyMethod('');
    }
  };

  const confirmSms = async () => {
    try {
      setBusyMethod('sms-confirm');
      ensureSuccessful(await confirmSmsEnrollment(smsDialog.enrollmentId, smsDialog.code), 'Unable to verify that code.');
      setSmsDialog((current) => ({ ...current, open: false }));
      setLoading(true);
      await loadStatus();
      notify('Text-message authentication is enabled.');
    } catch (error) {
      setStatusError(getErrorMessage(error, 'Unable to verify that code.'));
    } finally {
      setBusyMethod('');
    }
  };

  const openTotpSetup = async () => {
    setTotpDialog((current) => ({ ...current, open: true, loading: true, code: '' }));
    setStatusError('');
    try {
      const result = ensureSuccessful(await startTotpEnrollment(), 'Unable to start authenticator setup.');
      const enrollmentId = result?.challengeId || result?.enrollmentId || result?.id;
      if (!enrollmentId) throw new Error('The server did not return an authenticator enrollment ID.');
      setTotpDialog({
        open: true,
        loading: false,
        enrollmentId,
        secret: result.secret || result.manualEntryKey || '',
        qrCode: result.qrCodeDataUrl || result.qrCodeUrl || '',
        otpAuthUri: result.otpAuthUri || '',
        code: ''
      });
    } catch (error) {
      setTotpDialog((current) => ({ ...current, loading: false }));
      setStatusError(getErrorMessage(error, 'Unable to start authenticator setup.'));
    }
  };

  const confirmTotp = async () => {
    try {
      setBusyMethod('totp-confirm');
      ensureSuccessful(await confirmTotpEnrollment(totpDialog.enrollmentId, totpDialog.code), 'Unable to verify that code.');
      setTotpDialog((current) => ({ ...current, open: false }));
      setLoading(true);
      await loadStatus();
      notify('Authenticator-app authentication is enabled.');
    } catch (error) {
      setStatusError(getErrorMessage(error, 'Unable to verify that code.'));
    } finally {
      setBusyMethod('');
    }
  };

  const removeMethod = async (type) => {
    if (!window.confirm(`Turn off ${methodLabel[type]} authentication?`)) return;
    try {
      setBusyMethod(`${type}-remove`);
      ensureSuccessful(await disableMfaMethod(type), `Unable to turn off ${methodLabel[type]}.`);
      setLoading(true);
      await loadStatus();
      notify(`${methodLabel[type]} authentication is turned off.`);
    } catch (error) {
      setStatusError(getErrorMessage(error, `Unable to turn off ${methodLabel[type]}.`));
    } finally {
      setBusyMethod('');
    }
  };

  const renderMethod = (type, title, description, Icon) => {
    const details = normalized.enabled.get(type);
    const isEnabled = Boolean(details);
    return (
      <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2} justifyContent="space-between" alignItems={{ sm: 'center' }}>
        <Stack direction="row" spacing={1.5} alignItems="flex-start">
          <Box sx={{ color: 'primary.main', pt: 0.25 }}><Icon style={{ fontSize: 22 }} /></Box>
          <Box>
            <Stack direction="row" spacing={1} alignItems="center" flexWrap="wrap">
              <Typography fontWeight={700}>{title}</Typography>
              <Chip size="small" color={isEnabled ? 'success' : 'default'} label={isEnabled ? 'Enabled' : 'Not set up'} />

            </Stack>
            <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>{description}</Typography>
            {details?.maskedDestination && <Typography variant="caption" color="text.secondary">Destination: {details.maskedDestination}</Typography>}
          </Box>
        </Stack>
        <Stack direction="row" spacing={1} sx={{ flexShrink: 0 }}>

          <Button
            size="small"
            variant={isEnabled ? 'outlined' : 'contained'}
            color={isEnabled ? 'error' : 'primary'}
            disabled={Boolean(busyMethod)}
            onClick={() => isEnabled ? removeMethod(type) : type === 'sms' ? setSmsDialog({ open: true, step: 'phone', phoneNumber: '', enrollmentId: '', destination: '', code: '' }) : openTotpSetup()}
          >
            {busyMethod.startsWith(type) ? <CircularProgress size={18} /> : isEnabled ? 'Turn off' : 'Set up'}
          </Button>
        </Stack>
      </Stack>
    );
  };

  return (
    <Paper variant="outlined" sx={{ p: { xs: 2, sm: 3 }, bgcolor: (theme) => alpha(theme.palette.background.paper, 0.72) }}>
      <Stack direction="row" spacing={1.25} alignItems="center">
        <LockOutlined style={{ fontSize: 22, color: '#16a34a' }} />
        <Box>
          <Typography variant="h5" fontWeight={800}>Authentication methods</Typography>
          <Typography variant="body2" color="text.secondary">Choose how you sign in and verify it’s really you.</Typography>
        </Box>
      </Stack>

      {statusError && <Alert severity="error" onClose={() => setStatusError('')} sx={{ mt: 2 }}>{statusError}</Alert>}
      {loading ? (
        <Box sx={{ py: 5, textAlign: 'center' }}><CircularProgress size={28} aria-label="Loading authentication methods" /></Box>
      ) : !status ? (
        <Box sx={{ py: 3 }}>
          <Button variant="outlined" onClick={() => { setLoading(true); loadStatus(); }}>Try again</Button>
        </Box>
      ) : (
        <Stack spacing={2.5} divider={<Divider flexItem />} sx={{ mt: 3 }}>
          {renderMethod('sms', 'Text message (SMS)', 'Receive a one-time code at your verified mobile number.', MobileOutlined)}
          {renderMethod('totp', 'Authenticator app', 'Use a rotating code from apps such as 1Password, Google Authenticator, or Authy.', SafetyCertificateOutlined)}
          <PasskeySettingsCard embedded />
        </Stack>
      )}

      <Dialog open={smsDialog.open} onClose={() => !busyMethod && setSmsDialog((current) => ({ ...current, open: false }))} fullWidth maxWidth="xs">
        <DialogTitle>Set up text-message authentication</DialogTitle>
        <DialogContent>
          {smsDialog.step === 'phone' ? (
            <Stack spacing={2} sx={{ pt: 1 }}>
              <Typography variant="body2" color="text.secondary">Enter a mobile number that can receive security codes.</Typography>
              <TextField autoFocus fullWidth label="Mobile number" type="tel" autoComplete="tel" value={smsDialog.phoneNumber} onChange={(event) => setSmsDialog((current) => ({ ...current, phoneNumber: event.target.value }))} placeholder="+1 555 123 4567" />
            </Stack>
          ) : (
            <Stack spacing={2} sx={{ pt: 1 }}>
              <Typography variant="body2" color="text.secondary">Enter the code sent to {smsDialog.destination}.</Typography>
              <TextField autoFocus fullWidth label="6-digit verification code" inputMode="numeric" autoComplete="one-time-code" value={smsDialog.code} onChange={(event) => setSmsDialog((current) => ({ ...current, code: event.target.value.replace(/\D/g, '').slice(0, 6) }))} inputProps={{ maxLength: 6, 'aria-label': 'SMS verification code' }} />
            </Stack>
          )}
        </DialogContent>
        <DialogActions>
          <Button color="inherit" onClick={() => setSmsDialog((current) => ({ ...current, open: false }))} disabled={Boolean(busyMethod)}>Cancel</Button>
          <Button variant="contained" onClick={smsDialog.step === 'phone' ? startSms : confirmSms} disabled={Boolean(busyMethod) || (smsDialog.step === 'phone' ? !smsDialog.phoneNumber.trim() : smsDialog.code.length !== 6)}>{smsDialog.step === 'phone' ? 'Send code' : 'Verify and enable'}</Button>
        </DialogActions>
      </Dialog>

      <Dialog open={totpDialog.open} onClose={() => !busyMethod && setTotpDialog((current) => ({ ...current, open: false }))} fullWidth maxWidth="xs">
        <DialogTitle>Set up an authenticator app</DialogTitle>
        <DialogContent>
          {totpDialog.loading ? <Box sx={{ py: 5, textAlign: 'center' }}><CircularProgress aria-label="Starting authenticator setup" /></Box> : (
            <Stack spacing={2} sx={{ pt: 1 }}>
              <Typography variant="body2" color="text.secondary">Add the setup key to your authenticator app, then enter its current 6-digit code.</Typography>
              {totpDialog.qrCode && <Box component="img" src={totpDialog.qrCode} alt="Authenticator setup QR code" sx={{ width: 200, height: 200, maxWidth: '100%', alignSelf: 'center' }} />}
              {totpDialog.secret && <Alert severity="info">Enter this setup key in your authenticator app: <Box component="code" sx={{ display: 'block', mt: 1, overflowWrap: 'anywhere' }}>{totpDialog.secret}</Box></Alert>}
              {totpDialog.otpAuthUri && <Button component="a" href={totpDialog.otpAuthUri} variant="outlined">Open authenticator app</Button>}
              {!totpDialog.qrCode && !totpDialog.secret && <Alert severity="warning">The server did not provide setup details. Close this dialog and try again.</Alert>}
              <TextField autoFocus fullWidth label="6-digit verification code" inputMode="numeric" autoComplete="one-time-code" value={totpDialog.code} onChange={(event) => setTotpDialog((current) => ({ ...current, code: event.target.value.replace(/\D/g, '').slice(0, 6) }))} inputProps={{ maxLength: 6, 'aria-label': 'Authenticator verification code' }} />
            </Stack>
          )}
        </DialogContent>
        <DialogActions>
          <Button color="inherit" onClick={() => setTotpDialog((current) => ({ ...current, open: false }))} disabled={Boolean(busyMethod)}>Cancel</Button>
          <Button variant="contained" onClick={confirmTotp} disabled={totpDialog.loading || busyMethod === 'totp-confirm' || totpDialog.code.length !== 6 || (!totpDialog.qrCode && !totpDialog.secret)}>Verify and enable</Button>
        </DialogActions>
      </Dialog>
    </Paper>
  );
}
