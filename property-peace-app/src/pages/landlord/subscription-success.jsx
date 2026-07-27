import { useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';

// material-ui
import { Container, Stack, Typography, Box, Alert, Button } from '@mui/material';
import { CheckCircleOutlined } from '@ant-design/icons';

// project imports
import MainCard from 'components/MainCard';
import AnimateButton from 'components/@extended/AnimateButton';

// ================================|| LANDLORD - SUBSCRIPTION SUCCESS ||================================ //

export default function SubscriptionSuccess() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const planName = searchParams.get('plan') || 'your subscription plan';

  useEffect(() => {
    // Clear any query parameters after reading them
    if (searchParams.get('plan')) {
      // Optionally clear the plan param, but it's fine to leave it for display
    }
  }, [searchParams]);

  return (
    <Container maxWidth="md" sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '80vh' }}>
      <MainCard sx={{ borderRadius: 4 }}>
        <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4, py: 5 }}>
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
            <CheckCircleOutlined style={{ fontSize: 48, color: '#52c41a' }} />
          </Box>
          
          <Stack spacing={4} sx={{ textAlign: 'center', maxWidth: 500 }}>
            <Typography variant="h3" fontWeight={700}>
              Subscription Activated Successfully!
            </Typography>
            
            <Alert severity="success" sx={{ mt: 2 }}>
              <Typography variant="body1">
                Your subscription is now active. You can manage your subscription, view billing information, and upgrade or downgrade your plan at any time from the Subscription Management page.
              </Typography>
            </Alert>
            
            <Box sx={{ mt: 4, display: 'flex', gap: 2, justifyContent: 'center' }}>
              <AnimateButton>
                <Button
                  variant="outlined"
                  size="small"
                  onClick={() => navigate('/landlord/settings?tab=subscription')}
                >
                  View Subscription
                </Button>
              </AnimateButton>
              <AnimateButton>
                <Button
                  variant="contained"
                  size="small"
                  onClick={() => navigate('/landlord/dashboard')}
                >
                  Go to Dashboard
                </Button>
              </AnimateButton>
            </Box>
          </Stack>
        </Box>
      </MainCard>
    </Container>
  );
}
