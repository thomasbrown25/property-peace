import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';

// material-ui
import { Box } from '@mui/material';
import { CircularProgress } from '@mui/material';
import { LinearProgress } from '@mui/material';
import { Typography } from '@mui/material';
import { Stack } from '@mui/material';
import { Stepper, Step, StepLabel } from '@mui/material';

// project imports
import useAuth from 'hooks/useAuth';
import AuthWrapper from 'sections/auth/AuthWrapper';
import axiosServices from 'utils/axios';
import { openSnackbar } from 'api/snackbar';
import { organizationAPI } from 'api';
import OrganizationForm from 'sections/auth/jwt/OrganizationForm';
import { trackSignUpConversion } from 'utils/googleAds';

// ================================|| JWT - SETTING UP PROFILE ||================================ //

export default function SettingUpProfile({ hideWrapper = false, redirectOnly = false }) {
  const navigate = useNavigate();
  const { register, user, isLoggedIn, updateUser } = useAuth();
  const [error, setError] = useState(null);
  const [isCreating, setIsCreating] = useState(false);
  const organizationName = sessionStorage.getItem('registerOrganizationName') || '';
  const [showOrganizationForm, setShowOrganizationForm] = useState(!organizationName);

  // When redirectOnly is true (e.g. single-page flow already completed org creation), show loading and redirect
  useEffect(() => {
    if (redirectOnly) {
      const t = setTimeout(() => {
        window.location.replace('/landlord/dashboard');
      }, 800);
      return () => clearTimeout(t);
    }
  }, [redirectOnly]);

  if (redirectOnly) {
    const redirectContent = (
      <Box
        sx={{
          width: '100%',
          minWidth: { xs: '100%', sm: 450 },
          maxWidth: { xs: '100%', sm: 450 },
          mx: 'auto',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          gap: 4,
          py: 8
        }}
      >
        <CircularProgress size={56} thickness={4} />
        <Box sx={{ width: '100%', maxWidth: 280 }}>
          <LinearProgress />
        </Box>
        <Stack spacing={1} alignItems="center">
          <Typography variant="h4" sx={{ fontWeight: 600, textAlign: 'center' }}>
            All set!
          </Typography>
          <Typography variant="body2" sx={{ color: 'text.secondary', textAlign: 'center' }}>
            Redirecting to your dashboard…
          </Typography>
        </Stack>
      </Box>
    );
    return hideWrapper ? redirectContent : <AuthWrapper splitScreen>{redirectContent}</AuthWrapper>;
  }

  const steps = ['Account Type', 'Verification', 'Password', 'Personal Info', 'Business Info', 'Complete'];
  const currentStep = 5; // Complete step (0-indexed: 5)

  useEffect(() => {
    // Only proceed with account creation if organization is already set and we're not showing the form
    if (!showOrganizationForm && organizationName && !isCreating) {
      setIsCreating(true);
      setupProfile();
    }
  }, [showOrganizationForm, organizationName, isCreating]);

  const setupProfile = async () => {
    try {
      // Get stored data from sessionStorage
      const email = user?.Email || user?.email || sessionStorage.getItem('registerEmail') || '';
      const password = sessionStorage.getItem('registerPassword') || '';
      const firstName = user?.FirstName || user?.firstName || user?.Firstname || user?.firstname || sessionStorage.getItem('registerFirstName') || '';
      const lastName = user?.LastName || user?.lastName || user?.Lastname || user?.lastname || sessionStorage.getItem('registerLastName') || '';
      const phoneNumber = user?.PhoneNumber || user?.phoneNumber || sessionStorage.getItem('registerPhoneNumber') || '';
      const googleToken = sessionStorage.getItem('googleAccessToken');
      const orgName = sessionStorage.getItem('registerOrganizationName') || '';
      const organizationDescription = sessionStorage.getItem('registerOrganizationDescription') || '';

      if (!orgName) {
        // Missing organization data, show form
        setShowOrganizationForm(true);
        setIsCreating(false);
        return;
      }

      // If user is already logged in (e.g., from Google), create organization and complete registration
      if (isLoggedIn && user) {
        // Create organization
        const orgResponse = await organizationAPI.createOrganization(
          orgName.trim(),
          organizationDescription?.trim() || null
        );

        if (orgResponse.success && orgResponse.data) {
          // Update account with business information (for backward compatibility)
          const response = await axiosServices.put('/api/user/update-account', {
            firstName: firstName,
            lastName: lastName,
            email: email,
            phoneNumber: phoneNumber || null,
            businessName: orgName.trim(),
            businessEmail: email,
            businessPhone: phoneNumber || null
          });

          if (response.data?.success && response.data?.data) {
            // Update local user state
            if (updateUser) {
              updateUser({
                FirstName: response.data.data.Firstname || response.data.data.firstname,
                LastName: response.data.data.Lastname || response.data.data.lastname,
                Email: response.data.data.Email || response.data.data.email,
                PhoneNumber: response.data.data.PhoneNumber || response.data.data.phoneNumber,
                BusinessName: orgName.trim(),
                BusinessEmail: email,
                BusinessPhone: phoneNumber || null,
                CurrentOrganizationId: orgResponse.data.id
              });
            }

            // Clear sessionStorage
            sessionStorage.removeItem('registerEmail');
            sessionStorage.removeItem('registerPassword');
            sessionStorage.removeItem('registerFirstName');
            sessionStorage.removeItem('registerLastName');
            sessionStorage.removeItem('registerPhoneNumber');
            sessionStorage.removeItem('googleAccessToken');
            sessionStorage.removeItem('registerOrganizationName');
            sessionStorage.removeItem('registerOrganizationDescription');

            trackSignUpConversion();

            openSnackbar({
              open: true,
              message: 'Your organization has been created successfully. Redirecting to dashboard...',
              variant: 'alert',
              alert: {
                color: 'success'
              }
            });

            // Redirect to dashboard - user is already signed in
            setTimeout(() => {
              window.location.replace('/landlord/dashboard');
            }, 1500);
          } else {
            throw new Error(response.data?.message || 'Failed to update account information');
          }
        } else {
          throw new Error(orgResponse.message || 'Failed to create organization');
        }
      } else {
        // User is not logged in, register them first, then create organization
        await register(
          email,
          googleToken ? '' : password, // Empty string for Google (no password)
          firstName,
          lastName,
          phoneNumber || null,
          {
            businessName: orgName.trim(),
            businessEmail: email,
            businessPhone: phoneNumber?.trim() || null,
            googleAccessToken: googleToken || null,
            roles: ['Landlord'] // Default role
          }
        );

        // Organization should already be created by the Register method when businessName is provided
        // Clear sessionStorage
        sessionStorage.removeItem('registerEmail');
        sessionStorage.removeItem('registerPassword');
        sessionStorage.removeItem('registerFirstName');
        sessionStorage.removeItem('registerLastName');
        sessionStorage.removeItem('registerPhoneNumber');
        sessionStorage.removeItem('googleAccessToken');
        sessionStorage.removeItem('registerOrganizationName');
        sessionStorage.removeItem('registerOrganizationDescription');

        trackSignUpConversion();

        openSnackbar({
          open: true,
          message: 'Your registration has been successfully completed. Redirecting to dashboard...',
          variant: 'alert',
          alert: {
            color: 'success'
          }
        });

        // Redirect to dashboard - register() already signed them in
        setTimeout(() => {
          window.location.replace('/landlord/dashboard');
        }, 1500);
      }
    } catch (err) {
      console.error('Error setting up profile:', err);
      setError(err.response?.data?.message || err.message || 'Failed to set up your profile. Please try again.');
      setIsCreating(false);

      // Show error
      openSnackbar({
        open: true,
        message: err.response?.data?.message || err.message || 'Failed to set up your profile. Please try again.',
        variant: 'alert',
        alert: {
          color: 'error'
        }
      });

      // Show organization form again on error
      setShowOrganizationForm(true);
    }
  };

  // Show organization form if organization name is not set
  if (showOrganizationForm) {
    const formContent = (
      <Box
          sx={{
            width: '100%',
            minWidth: { xs: '100%', sm: 450 },
            maxWidth: { xs: '100%', sm: 450 },
            mx: 'auto',
            display: 'flex',
            flexDirection: 'column',
            gap: 3
          }}
        >
          {/* Organization Form - Modified to trigger loading instead of navigating */}
          {/* Note: OrganizationForm has its own step indicator, so we don't show one here */}
          <OrganizationFormWrapper
            onOrganizationCreated={() => {
              setShowOrganizationForm(false);
              setIsCreating(true);
              setupProfile();
            }}
          />
        </Box>
    );

    if (hideWrapper) {
      return formContent;
    }
    return <AuthWrapper splitScreen>{formContent}</AuthWrapper>;
  }

  // Show loading screen while creating account
  const loadingContent = (
    <Box
        sx={{
          width: '100%',
          minWidth: { xs: '100%', sm: 450 },
          maxWidth: { xs: '100%', sm: 450 },
          mx: 'auto',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          gap: 4,
          py: 8
        }}
      >
        {/* Steps Indicator - Fixed position - Only show if not in single-page flow */}
        {!hideWrapper && (
          <Box
            sx={{
              mb: 2,
              width: '100%',
              pt: 4,
              position: 'relative',
              minHeight: 80, // Fixed height to prevent movement
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center'
            }}
          >
            <Stepper activeStep={currentStep} alternativeLabel sx={{ width: '100%' }}>
              {steps.map((label) => (
                <Step key={label}>
                  <StepLabel>{label}</StepLabel>
                </Step>
              ))}
            </Stepper>
          </Box>
        )}

        {/* Spinner */}
        <CircularProgress size={60} thickness={4} />

        {/* Progress Bar */}
        <Box sx={{ width: '100%', maxWidth: 300 }}>
          <LinearProgress />
        </Box>

        {/* Message */}
        <Stack spacing={1} alignItems="center">
          <Typography variant="h4" sx={{ fontWeight: 600, textAlign: 'center' }}>
            Setting up your profile
          </Typography>
          <Typography variant="body2" sx={{ color: 'text.secondary', textAlign: 'center' }}>
            Please wait while we create your organization and set up your account...
          </Typography>
        </Stack>

        {/* Error Message */}
        {error && (
          <Typography variant="body2" sx={{ color: 'error.main', textAlign: 'center', mt: 2 }}>
            {error}
          </Typography>
        )}
      </Box>
  );

  if (hideWrapper) {
    return loadingContent;
  }
  return <AuthWrapper splitScreen>{loadingContent}</AuthWrapper>;
}

// Wrapper component for OrganizationForm that handles submission
function OrganizationFormWrapper({ onOrganizationCreated }) {
  return (
    <OrganizationForm
      onSuccess={() => {
        // Store organization data and trigger account creation
        onOrganizationCreated();
      }}
      showBackButton={false}
    />
  );
}