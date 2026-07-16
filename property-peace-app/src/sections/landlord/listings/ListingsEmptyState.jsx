import { Box, Typography, Button, useTheme, alpha } from '@mui/material';
import { RocketOutlined, PlusOutlined } from '@ant-design/icons';
import { useNavigate } from 'react-router-dom';
import MainCard from 'components/MainCard';

export default function ListingsEmptyState() {
  const navigate = useNavigate();
  const theme = useTheme();

  return (
    <MainCard
      sx={{
        p: 4,
        textAlign: 'center',
        bgcolor: alpha(theme.palette.background.paper, 0.8),
        borderRadius: 2,
        border: `1px dashed ${theme.palette.divider}`,
        boxShadow: `0 4px 20px ${alpha(theme.palette.primary.main, 0.05)}`
      }}
    >
      <Box sx={{ mb: 3 }}>
        <RocketOutlined style={{ fontSize: 64, color: alpha(theme.palette.text.secondary, 0.3) }} />
      </Box>
      <Typography variant="h5" fontWeight={600} color="text.primary" sx={{ mb: 1 }}>
        No Listings Yet
      </Typography>
      <Typography variant="body2" color="text.secondary" sx={{ mb: 3, maxWidth: 400, mx: 'auto' }}>
        Create your first listing to showcase a property, add photos and details, and share it with potential tenants.
      </Typography>
      <Button
        variant="contained"
        color="primary"
        onClick={() => navigate('/landlord/listings/add')}
        size="large"
        startIcon={<PlusOutlined />}
        sx={{
          boxShadow: `0 4px 12px ${alpha(theme.palette.primary.main, 0.3)}`,
          '&:hover': {
            boxShadow: `0 6px 16px ${alpha(theme.palette.primary.main, 0.4)}`,
            transform: 'translateY(-2px)'
          },
          transition: 'all 0.3s ease'
        }}
      >
        Add Your First Listing
      </Button>
    </MainCard>
  );
}
