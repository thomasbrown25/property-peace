import { Box, Typography, Button, Stack, Paper, alpha } from '@mui/material';
import { useNavigate } from 'react-router-dom';
import { CreditCardOutlined } from '@ant-design/icons';
import MainCard from 'components/MainCard';
import { useSubscription, useSubscriptionStatus } from 'hooks/useSubscription';
import SubscriptionStatus from 'components/subscription/SubscriptionStatus';

export default function SubscriptionSettings() {
  const navigate = useNavigate();
  const { subscription, loading } = useSubscription();
  const { status } = useSubscriptionStatus();

  return (
    <Box>
      <Stack spacing={3}>
        <Paper variant="outlined" sx={{ p: 3, bgcolor: (t) => alpha(t.palette.background.paper, 0.6) }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 2 }}>
            <CreditCardOutlined style={{ fontSize: 20, color: '#1890ff' }} />
            <Typography variant="h6" fontWeight="bold">
              Subscription Management
            </Typography>
          </Box>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
            Manage your subscription, view plans, upgrade or downgrade, and update billing information.
          </Typography>

          <Button
            variant="contained"
            size="large"
            onClick={() => navigate('/landlord/subscription')}
            startIcon={<CreditCardOutlined />}
            sx={{ mb: 2 }}
          >
            Go to Subscription Page
          </Button>
        </Paper>

        {status && (
          <MainCard>
            <Typography variant="h6" fontWeight="bold" sx={{ mb: 2 }}>
              Current Status
            </Typography>
            <SubscriptionStatus status={status} />
          </MainCard>
        )}
      </Stack>
    </Box>
  );
}

