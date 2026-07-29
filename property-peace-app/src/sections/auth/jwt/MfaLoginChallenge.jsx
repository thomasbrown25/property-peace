import PropTypes from 'prop-types';
import { useEffect, useMemo, useState } from 'react';
import { Alert, Box, Button, CircularProgress, Stack, TextField, Typography } from '@mui/material';
import { MobileOutlined, SafetyCertificateOutlined } from '@ant-design/icons';
import useAuth from 'hooks/useAuth';
import { getChallengeMethodLabel } from 'utils/mfaChallenge';

const errorMessage = (error, fallback) => error?.response?.data?.message || error?.message || fallback;

export default function MfaLoginChallenge({ challenge, onCancel }) {
  const { verifyMfaLogin } = useAuth();
  const [method, setMethod] = useState(challenge.methods[0]?.type || '');
  const [code, setCode] = useState('');
  const [verifying, setVerifying] = useState(false);
  const [error, setError] = useState('');
  const selected = useMemo(() => challenge.methods.find((item) => item.type === method), [challenge.methods, method]);

  useEffect(() => {
    setCode('');
    setError('');
  }, [method]);

  const verify = async (event) => {
    event.preventDefault();
    try {
      setVerifying(true);
      setError('');
      await verifyMfaLogin(challenge.challengeId, code);
    } catch (verifyError) {
      setError(errorMessage(verifyError, 'That code could not be verified.'));
      setVerifying(false);
    }
  };

  return (
    <Box component="form" onSubmit={verify} sx={{ width: '100%' }}>
      <Stack spacing={3}>
        <Box textAlign="center">
          <Typography variant="h3" fontWeight={700}>Verify it’s you</Typography>
          <Typography color="text.secondary" sx={{ mt: 1 }}>Complete one more step to securely sign in.</Typography>
        </Box>

        {challenge.methods.length > 1 && (
          <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1}>
            {challenge.methods.map((item) => (
              <Button key={item.type} fullWidth variant={method === item.type ? 'contained' : 'outlined'} onClick={() => setMethod(item.type)} startIcon={item.type === 'sms' ? <MobileOutlined /> : <SafetyCertificateOutlined />}>
                {getChallengeMethodLabel(item.type)}
              </Button>
            ))}
          </Stack>
        )}

        <Box>
          <Typography variant="h5" fontWeight={700}>{getChallengeMethodLabel(method)}</Typography>
          <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
            {method === 'sms'
              ? `Enter the one-time code sent to ${selected?.maskedDestination || 'your verified mobile number'}.`
              : 'Enter the current 6-digit code from your authenticator app.'}
          </Typography>
        </Box>

        <>
            {method === 'sms' && <Alert severity="success">A security code was sent to {selected?.maskedDestination || 'your mobile number'}.</Alert>}
            <TextField
              autoFocus
              fullWidth
              label="6-digit security code"
              value={code}
              onChange={(event) => setCode(event.target.value.replace(/\D/g, '').slice(0, 6))}
              inputProps={{ inputMode: 'numeric', maxLength: 6, autoComplete: 'one-time-code', 'aria-label': 'Multi-factor security code' }}
            />
            <Button type="submit" size="large" variant="contained" disabled={code.length !== 6 || verifying} startIcon={verifying ? <CircularProgress size={18} color="inherit" /> : null}>
              {verifying ? 'Verifying…' : 'Verify and sign in'}
            </Button>
          </>

        {error && <Alert severity="error">{error}</Alert>}
        {challenge.expiresAt && <Typography variant="caption" textAlign="center" color="text.secondary">This verification request expires at {new Date(challenge.expiresAt).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })}.</Typography>}
        <Button color="inherit" onClick={onCancel} disabled={verifying}>Back to login</Button>
      </Stack>
    </Box>
  );
}

MfaLoginChallenge.propTypes = {
  challenge: PropTypes.shape({
    challengeId: PropTypes.string.isRequired,
    expiresAt: PropTypes.string,
    methods: PropTypes.arrayOf(PropTypes.shape({ type: PropTypes.oneOf(['sms', 'totp']).isRequired, maskedDestination: PropTypes.string })).isRequired
  }).isRequired,
  onCancel: PropTypes.func.isRequired
};
