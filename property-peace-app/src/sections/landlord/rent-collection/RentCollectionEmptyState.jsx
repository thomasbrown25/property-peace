import { Box, Typography, Button, Stack, useTheme, alpha } from '@mui/material';
import { HomeOutlined, DollarOutlined, FileTextOutlined, CalendarOutlined } from '@ant-design/icons';
import { useNavigate } from 'react-router-dom';
import MainCard from 'components/MainCard';

export default function RentCollectionEmptyState({ tab }) {
  const navigate = useNavigate();
  const theme = useTheme();

  const getEmptyStateContent = () => {
    switch (tab) {
      case 'overdue':
        return {
          icon: <DollarOutlined style={{ fontSize: 64, color: theme.palette.error.main, opacity: 0.3 }} />,
          title: 'No Overdue Rent',
          description: 'Great job! All rent payments are up to date.',
          showAction: false
        };
      case 'paid':
        return {
          icon: <DollarOutlined style={{ fontSize: 64, color: theme.palette.success.main, opacity: 0.3 }} />,
          title: 'No Paid Rent Records',
          description: 'Paid rent records will appear here once payments are recorded.',
          showAction: false
        };
      case 'notStarted':
        return {
          icon: <CalendarOutlined style={{ fontSize: 64, color: theme.palette.warning.main, opacity: 0.3 }} />,
          title: 'No Upcoming Rent',
          description: 'All rent periods have started or there are no leases set up yet.',
          showAction: true
        };
      case 'archived':
        return {
          icon: <FileTextOutlined style={{ fontSize: 64, color: theme.palette.text.secondary, opacity: 0.3 }} />,
          title: 'No Archived Records',
          description: 'Archived rent records will appear here.',
          showAction: false
        };
      default:
        return {
          icon: <HomeOutlined style={{ fontSize: 64, color: theme.palette.primary.main, opacity: 0.3 }} />,
          title: 'No Active Rent Records',
          description: 'Add a lease to start tracking rent collection. Once you have active leases, rent records will appear here.',
          showAction: true
        };
    }
  };

  const { icon, title, description, showAction } = getEmptyStateContent();

  return (
    <MainCard
      sx={{
        p: 6,
        textAlign: 'center',
        bgcolor: (t) => alpha(t.palette.background.paper, 0.6),
        border: `2px dashed ${alpha(theme.palette.divider, 0.3)}`,
        borderRadius: 2
      }}
    >
      <Box
        sx={{
          width: 120,
          height: 120,
          borderRadius: '50%',
          bgcolor: alpha(theme.palette.primary.main, 0.05),
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          mx: 'auto',
          mb: 3
        }}
      >
        {icon}
      </Box>
      <Typography variant="h5" fontWeight={600} gutterBottom>
        {title}
      </Typography>
      <Typography variant="body2" color="text.secondary" sx={{ mb: 3, maxWidth: 400, mx: 'auto' }}>
        {description}
      </Typography>
      {showAction && (
        <Stack direction="row" spacing={2} justifyContent="center">
          <Button variant="outlined" onClick={() => navigate('/landlord/leases')}>
            View Leases
          </Button>
          <Button variant="contained" color="primary" onClick={() => navigate('/landlord/leases/selection')}>
            Create Lease
          </Button>
        </Stack>
      )}
    </MainCard>
  );
}

