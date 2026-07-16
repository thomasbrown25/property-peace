import { Alert, AlertTitle, Box, Button, Stack, Typography } from '@mui/material';
import { StopOutlined, CustomerServiceOutlined } from '@ant-design/icons';
import { useNavigate } from 'react-router-dom';

export default function SuspensionBanner() {
  const navigate = useNavigate();

  return (
    <Box sx={{ mb: 3 }}>
      <Alert 
        severity="warning" 
        icon={<StopOutlined />}
        sx={{
          '& .MuiAlert-message': {
            width: '100%'
          }
        }}
      >
        <AlertTitle>
          <Typography variant="h6" fontWeight="bold">
            Account Suspended
          </Typography>
        </AlertTitle>
        <Typography variant="body2" sx={{ mb: 2 }}>
          Your account has been suspended. You are unable to perform any actions in the system.
        </Typography>
        <Typography variant="body2" sx={{ mb: 2 }}>
          If you believe this is an error, please contact support for assistance.
        </Typography>
        <Stack direction="row" spacing={2} sx={{ mt: 2 }}>
          <Button
            variant="contained"
            color="primary"
            startIcon={<CustomerServiceOutlined />}
            onClick={() => navigate('/support')}
          >
            Contact Support
          </Button>
        </Stack>
      </Alert>
    </Box>
  );
}

