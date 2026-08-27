import { useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';

// material-ui
import { Grid, Stack, Typography, Box, Alert, Button } from '@mui/material';
import { CheckCircleOutlined } from '@ant-design/icons';

// project imports
import AuthWrapper from 'sections/auth/AuthWrapper';
import AnimateButton from 'components/@extended/AnimateButton';

// ================================|| TENANT - INVITE SUCCESS ||================================ //

export default function TenantInviteSuccess() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const propertyName = searchParams.get('propertyName') || 'the property';

  useEffect(() => {
    // Clear any session storage related to invite flow
    sessionStorage.removeItem('tenantInviteToken');
    sessionStorage.removeItem('tenantInviteEmail');
    sessionStorage.removeItem('isExistingUserInvite');
    sessionStorage.removeItem('pendingTenantInviteAccept');
  }, []);

  return (
    <AuthWrapper splitScreen>
      <Grid container spacing={3}>
        <Grid size={12}>
          <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 3, py: 4 }}>
            <Box
              sx={{
                width: 80,
                height: 80,
                borderRadius: '50%',
                bgcolor: 'success.lighter',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center'
              }}
            >
              <CheckCircleOutlined style={{ fontSize: 48, color: '#41a541' }} />
            </Box>
            
            <Stack spacing={2} sx={{ textAlign: 'center', maxWidth: 500 }}>
              <Typography variant="h3" fontWeight={700}>
                Successfully Added!
              </Typography>
              
              <Typography variant="body1" color="text.secondary">
                You've been successfully added to {propertyName}. You can now view lease details, payment history, and communicate with your landlord.
              </Typography>
              
              <Alert severity="success" sx={{ mt: 2 }}>
                <Typography variant="body2">
                  Your account has been connected to the property. You can access all property-related information from your dashboard.
                </Typography>
              </Alert>
              
              <Box sx={{ mt: 3 }}>
                <AnimateButton>
                  <Button
                    variant="contained"
                    fullWidth
                    size="large"
                    onClick={() => navigate('/tenant/dashboard')}
                  >
                    Go to Dashboard
                  </Button>
                </AnimateButton>
              </Box>
            </Stack>
          </Box>
        </Grid>
      </Grid>
    </AuthWrapper>
  );
}
