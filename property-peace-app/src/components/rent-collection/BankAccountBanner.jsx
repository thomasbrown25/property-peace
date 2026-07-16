import { Alert, AlertTitle, Typography } from '@mui/material';
import { useNavigate } from 'react-router-dom';
import { BankOutlined } from '@ant-design/icons';

export default function BankAccountBanner() {
  const navigate = useNavigate();

  const handleConnectBank = () => {
    // Navigate to settings payments tab
    navigate('/landlord/settings?tab=payments');
  };

  return (
    <Alert
      severity="warning"
      icon={<BankOutlined />}
      sx={{
        cursor: 'pointer',
        position: 'relative',
        transition: 'all 0.2s ease-in-out',
        '&:hover': {
          bgcolor: 'action.hover',
          transform: 'translateY(-1px)',
          boxShadow: 2
        }
      }}
      onClick={handleConnectBank}
    >
      <AlertTitle sx={{ fontWeight: 600, mb: 0.5 }}>Connect Your Bank Account</AlertTitle>
      <Typography variant="body2">
        You must connect a bank account to start collecting rent. Click anywhere on this banner to connect your bank account.
      </Typography>
    </Alert>
  );
}

