import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';

// material-ui
import { Grid } from '@mui/material';
import { Stack } from '@mui/material';
import { Typography } from '@mui/material';
import { Box } from '@mui/material';
import { Alert } from '@mui/material';
import { CircularProgress } from '@mui/material';
import { Button } from '@mui/material';
import MainCard from 'components/MainCard';

// project imports
import useAuth from 'hooks/useAuth';
import TenantApplicationForm from 'sections/applications/TenantApplicationForm';
import * as applicationApi from 'api/application';
import { openSnackbar } from 'api/snackbar';

// ================================|| TENANT APPLICATION FORM PAGE ||================================ //

export default function TenantApplicationFormPage() {
  const { applicationId } = useParams();
  const navigate = useNavigate();
  const { user, isLoggedIn } = useAuth();
  const [loading, setLoading] = useState(true);
  const [application, setApplication] = useState(null);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (!isLoggedIn) {
      setError('Please log in to complete your application.');
      setLoading(false);
      return;
    }

    // Load application data
    const loadApplication = async () => {
      if (!applicationId) {
        setError('Invalid application ID.');
        setLoading(false);
        return;
      }

      try {
        setLoading(true);
        const response = await applicationApi.getApplication(parseInt(applicationId));

        if (response.success && response.data) {
          // Verify this application belongs to the current user
          const userEmail = user?.email || user?.Email;
          if (userEmail && response.data.email?.toLowerCase() !== userEmail.toLowerCase()) {
            setError('You do not have permission to access this application.');
          } else {
            setApplication(response.data);
          }
        } else {
          setError(response.message || 'Application not found.');
        }
      } catch (err) {
        console.error('Error loading application:', err);
        setError(err?.response?.data?.message || 'Failed to load application. Please try again.');
      } finally {
        setLoading(false);
      }
    };

    loadApplication();
  }, [applicationId, isLoggedIn, user]);

  if (loading) {
    return (
      <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2, py: 4 }}>
        <CircularProgress />
        <Typography variant="body2" color="text.secondary">
          Loading application form...
        </Typography>
      </Box>
    );
  }

  if (error) {
    return (
      <MainCard>
        <Stack spacing={2}>
          <Typography variant="h4">Unable to Load Application</Typography>
          <Alert severity="error">{error}</Alert>
          <Box sx={{ display: 'flex', gap: 2 }}>
            <Button variant="contained" onClick={() => navigate('/tenant/applications')}>
              Back to Applications
            </Button>
            <Button variant="outlined" onClick={() => window.location.reload()}>
              Retry
            </Button>
          </Box>
        </Stack>
      </MainCard>
    );
  }

  if (!application) {
    return (
      <MainCard>
        <Alert severity="warning">Unable to load application information.</Alert>
      </MainCard>
    );
  }

  // Check if application is in Draft status (only draft applications can be edited)
  // API serializes enums as camelCase strings, so status will be "draft" not 0
  const statusValue = application.status;
  const isDraft = statusValue === 0 || 
                  statusValue === '0' || 
                  statusValue?.toLowerCase() === 'draft';
  
  if (!isDraft) {
    return (
      <MainCard>
        <Stack spacing={2}>
          <Typography variant="h4">Application Already Submitted</Typography>
          <Alert severity="info">
            This application has already been submitted and cannot be edited. If you need to make changes, please contact your landlord.
          </Alert>
          <Button variant="contained" onClick={() => navigate('/tenant/applications')}>
            Back to Applications
          </Button>
        </Stack>
      </MainCard>
    );
  }

  return (
    <Box>
      <Box sx={{ mb: 3 }}>
        <Typography variant="h4" fontWeight="bold">
          Complete Your Rental Application
        </Typography>
        <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
          {application.propertyName}
          {application.unitName && ` - ${application.unitName}`}
        </Typography>
      </Box>

      <TenantApplicationForm application={application} onSuccess={() => navigate('/tenant/applications')} />
    </Box>
  );
}

