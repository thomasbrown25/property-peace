import PropTypes from 'prop-types';
import { useEffect, useRef, useState } from 'react';

// material-ui
import { Box } from '@mui/material';
import { Button } from '@mui/material';
import { CircularProgress } from '@mui/material';
import { LinearProgress } from '@mui/material';
import { Link } from '@mui/material';
import { Stack } from '@mui/material';
import { Typography } from '@mui/material';
import { ArrowLeftOutlined } from '@ant-design/icons';
import { Link as RouterLink } from 'react-router-dom';

// project imports
import useAuth from 'hooks/useAuth';
import { openSnackbar } from 'api/snackbar';
import { organizationAPI } from 'api';
import axiosServices from 'utils/axios';
import { trackSignUpConversion } from 'utils/googleAds';

// ============================|| CREATING ACCOUNT STEP ||============================ //

export default function CreatingAccountStep({ password = '', onComplete, onBack }) {
  const { user, register, isLoggedIn, updateUser } = useAuth();
  const [error, setError] = useState(null);
  const [retryCount, setRetryCount] = useState(0);
  const onCompleteRef = useRef(onComplete);
  onCompleteRef.current = onComplete;

  useEffect(() => {
    let cancelled = false;

    const run = async () => {
      const storedEmail = sessionStorage.getItem('registerEmail') || user?.Email || user?.email || '';
      const storedFirstName = sessionStorage.getItem('registerFirstName') || user?.FirstName || user?.Firstname || user?.firstName || '';
      const storedLastName = sessionStorage.getItem('registerLastName') || user?.LastName || user?.Lastname || user?.lastName || '';
      const storedPhoneNumber = sessionStorage.getItem('registerPhoneNumber') || user?.PhoneNumber || user?.phoneNumber || '';
      const organizationName = sessionStorage.getItem('registerOrganizationName') || '';
      const organizationDescription = sessionStorage.getItem('registerOrganizationDescription') || '';
      const googleToken = sessionStorage.getItem('googleAccessToken');

      if (!storedEmail || !storedFirstName || !storedLastName || !storedPhoneNumber || !organizationName) {
        setError('Missing required information. Please go back and complete the form.');
        return;
      }

      try {
        if (isLoggedIn && user) {
          const orgResponse = await organizationAPI.createOrganization(organizationName.trim(), organizationDescription?.trim() || null);

          if (!orgResponse.success || !orgResponse.data) {
            throw new Error(orgResponse.message || 'Failed to create organization');
          }

          const response = await axiosServices.put('/api/user/update-account', {
            firstName: storedFirstName,
            lastName: storedLastName,
            email: storedEmail,
            phoneNumber: storedPhoneNumber || null,
            businessName: organizationName.trim(),
            businessEmail: storedEmail,
            businessPhone: storedPhoneNumber || null
          });

          if (!response.data?.success || !response.data?.data) {
            throw new Error(response.data?.message || 'Failed to update account information');
          }

          if (updateUser) {
            updateUser({
              FirstName: response.data.data.Firstname || response.data.data.firstname,
              LastName: response.data.data.Lastname || response.data.data.lastname,
              Email: response.data.data.Email || response.data.data.email,
              PhoneNumber: response.data.data.PhoneNumber || response.data.data.phoneNumber,
              BusinessName: organizationName.trim(),
              BusinessEmail: storedEmail,
              BusinessPhone: storedPhoneNumber || null,
              CurrentOrganizationId: orgResponse.data.id
            });
          }

          [
            'registerEmail',
            'registerPassword',
            'registerFirstName',
            'registerLastName',
            'registerProfileImageUrl',
            'registerPhoneNumber',
            'googleAccessToken',
            'registerOrganizationName',
            'registerOrganizationDescription',
            'registerRole',
            'registerUserType',
            'emailVerified'
          ].forEach((key) => sessionStorage.removeItem(key));

          trackSignUpConversion();

          openSnackbar({
            open: true,
            message: 'Your organization has been created successfully. Redirecting to dashboard...',
            variant: 'alert',
            alert: { color: 'success' }
          });

          if (!cancelled) onCompleteRef.current?.();
        } else {
          if (!googleToken && !password) {
            throw new Error('Your password is no longer available. Go back to the account step and enter it again.');
          }
          const accountPassword = googleToken ? '' : password;
          const storedRole = sessionStorage.getItem('registerRole') || 'Landlord';

          await register(storedEmail, accountPassword, storedFirstName, storedLastName, storedPhoneNumber || null, {
            businessName: organizationName.trim(),
            businessEmail: storedEmail,
            businessPhone: storedPhoneNumber?.trim() || null,
            googleAccessToken: googleToken || null,
            roles: [storedRole]
          });

          [
            'registerEmail',
            'registerPassword',
            'registerFirstName',
            'registerLastName',
            'registerProfileImageUrl',
            'registerPhoneNumber',
            'googleAccessToken',
            'registerOrganizationName',
            'registerOrganizationDescription',
            'registerRole',
            'registerUserType',
            'emailVerified'
          ].forEach((key) => sessionStorage.removeItem(key));

          trackSignUpConversion();

          openSnackbar({
            open: true,
            message: 'Your registration has been successfully completed. Redirecting to dashboard...',
            variant: 'alert',
            alert: { color: 'success' }
          });

          if (!cancelled) onCompleteRef.current?.();
        }
      } catch (err) {
        if (cancelled) return;
        console.error('Error creating account:', err);
        const message = err.response?.data?.message || err.message || 'Registration failed. Please try again.';
        setError(message);
        openSnackbar({
          open: true,
          message,
          variant: 'alert',
          alert: { color: 'error' }
        });
      }
    };

    run();
    return () => {
      cancelled = true;
    };
  }, [isLoggedIn, user, updateUser, register, password, retryCount]);

  if (error) {
    return (
      <Box
        sx={{
          width: '100%',
          minWidth: { xs: '100%', sm: 400 },
          maxWidth: { xs: '100%', sm: 400 },
          mx: 'auto',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          gap: 3,
          py: 6
        }}
      >
        <Typography variant="body1" color="error" sx={{ textAlign: 'center' }}>
          {error}
        </Typography>
        <Typography variant="body2" color="text.secondary" sx={{ textAlign: 'center' }}>
          Your details are still saved. Check them, retry, or log in if the account was already created.
        </Typography>
        <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1.5} sx={{ width: '100%' }}>
          {onBack && (
            <Button fullWidth startIcon={<ArrowLeftOutlined />} onClick={onBack} variant="outlined">
              Review details
            </Button>
          )}
          <Button
            fullWidth
            onClick={() => {
              setError(null);
              setRetryCount((count) => count + 1);
            }}
            variant="contained"
          >
            Try again
          </Button>
        </Stack>
        <Typography variant="caption" color="text.secondary" sx={{ textAlign: 'center' }}>
          By creating an account, you agree to our{' '}
          <Link component={RouterLink} to="/terms">
            Terms of Use
          </Link>{' '}
          and{' '}
          <Link component={RouterLink} to="/privacy">
            Privacy Policy
          </Link>
          .
        </Typography>
        <Button component={RouterLink} to="/login" variant="text" sx={{ textTransform: 'none' }}>
          Go to login
        </Button>
      </Box>
    );
  }

  return (
    <Box
      sx={{
        width: '100%',
        minWidth: { xs: '100%', sm: 400 },
        maxWidth: { xs: '100%', sm: 400 },
        mx: 'auto',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 3,
        py: 8,
        minHeight: 360
      }}
    >
      <CircularProgress size={56} thickness={4} />
      <Box sx={{ width: '100%', maxWidth: 280 }}>
        <LinearProgress />
      </Box>
      <Stack spacing={1} alignItems="center">
        <Typography variant="h4" sx={{ fontWeight: 600, textAlign: 'center', color: '#061e35' }}>
          Creating your account
        </Typography>
        <Typography variant="body2" sx={{ color: 'text.secondary', textAlign: 'center' }}>
          Please wait while we set up your organization and complete registration…
        </Typography>
      </Stack>
    </Box>
  );
}

CreatingAccountStep.propTypes = {
  password: PropTypes.string,
  onComplete: PropTypes.func,
  onBack: PropTypes.func
};
