import { Grid, Box, Stack, Typography, Card, CardContent, Chip, Button, useTheme, alpha } from '@mui/material';
import { ToolOutlined, PlusOutlined, CalendarOutlined, UserOutlined, ArrowRightOutlined } from '@ant-design/icons';
import { useNavigate } from 'react-router-dom';
import { formatRelativeTime } from 'utils/formatters';
import { getPriorityColor, getStatusColor } from 'utils/helper-methods';
import MainCard from 'components/MainCard';
import { useDrawer } from 'contexts/DrawerContext';

const MaintenanceCard = ({ request, onClick }) => {
  const theme = useTheme();

  return (
    <Card
      onClick={onClick}
      sx={{
        height: '100%',
        cursor: 'pointer',
        border: `1px solid ${alpha(theme.palette.divider, 0.1)}`,
        transition: 'all 0.3s ease',
        '&:hover': {
          transform: 'translateY(-4px)',
          boxShadow: `0 8px 24px ${alpha(theme.palette.primary.main, 0.2)}`,
          borderColor: theme.palette.primary.main
        }
      }}
    >
      <CardContent>
        <Stack spacing={2}>
          {/* Header */}
          <Stack direction="row" justifyContent="space-between" alignItems="flex-start">
            <Typography variant="h6" fontWeight={600} sx={{ flex: 1, pr: 1 }}>
              {request.title}
            </Typography>
            <Chip
              size="small"
              label={request.status}
              color={getStatusColor(request.status)}
              sx={{ textTransform: 'capitalize', fontWeight: 500 }}
            />
          </Stack>

          {/* Priority */}
          <Chip
            size="small"
            label={request.priority}
            color={getPriorityColor(request.priority)}
            variant="outlined"
            sx={{ textTransform: 'capitalize', width: 'fit-content' }}
          />

          {/* Unit Info */}
          {request.propertyType?.toLowerCase() !== 'singlefamily' && request.unitName && (
            <Stack direction="row" spacing={1} alignItems="center">
              <Chip
                label={request.unitName}
                variant="outlined"
                color="primary"
                size="small"
              />
            </Stack>
          )}

          {/* Date */}
          {request.createdAt && (
            <Stack direction="row" spacing={1} alignItems="center">
              <CalendarOutlined style={{ fontSize: 14, color: theme.palette.text.secondary }} />
              <Typography variant="caption" color="text.secondary">
                {formatRelativeTime(request.createdAt)}
              </Typography>
            </Stack>
          )}

          {/* View Button */}
          <Button
            size="small"
            endIcon={<ArrowRightOutlined />}
            sx={{
              mt: 'auto',
              alignSelf: 'flex-start',
              textTransform: 'none'
            }}
          >
            View Details
          </Button>
        </Stack>
      </CardContent>
    </Card>
  );
};

export default function MaintenanceTab({ maintenances, propertyId }) {
  const navigate = useNavigate();
  const theme = useTheme();
  const drawer = useDrawer();

  const openRequests = maintenances?.filter((req) => req.status?.toLowerCase() === 'open') || [];
  const allRequests = maintenances || [];

  if (allRequests.length === 0) {
    return (
      <MainCard
        sx={{
          p: 6,
          textAlign: 'center',
          bgcolor: (t) => alpha(t.palette.background.paper, 0.6)
        }}
      >
        <Box
          sx={{
            width: 120,
            height: 120,
            borderRadius: '50%',
            bgcolor: alpha(theme.palette.info.main, 0.1),
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            mx: 'auto',
            mb: 3
          }}
        >
          <ToolOutlined style={{ fontSize: 64, color: theme.palette.info.main, opacity: 0.5 }} />
        </Box>
        <Typography variant="h6" fontWeight={600} gutterBottom>
          No Maintenance Requests
        </Typography>
        <Typography variant="body2" color="text.secondary" sx={{ mb: 3, maxWidth: 400, mx: 'auto' }}>
          This property doesn't have any maintenance requests yet. When tenants submit maintenance requests, they'll appear here.
        </Typography>
        <Button
          variant="outlined"
          startIcon={<PlusOutlined style={{ fontSize: 16 }} />}
          onClick={() => navigate(`/landlord/maintenances/add${propertyId ? `?propertyId=${propertyId}` : ''}`)}
          sx={{
            textTransform: 'none'
          }}
        >
          Create Maintenance Request
        </Button>
      </MainCard>
    );
  }

  return (
    <Box>
      {/* Summary */}
      <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 3 }}>
        <Box>
          <Typography variant="h6" fontWeight={600}>
            Maintenance Requests
          </Typography>
          <Typography variant="body2" color="text.secondary">
            {openRequests.length} open {openRequests.length === 1 ? 'request' : 'requests'} of {allRequests.length} total
          </Typography>
        </Box>
        <Button
          variant="outlined"
          startIcon={<PlusOutlined style={{ fontSize: 16 }} />}
          onClick={() => navigate(`/landlord/maintenances/add${propertyId ? `?propertyId=${propertyId}` : ''}`)}
          sx={{
            textTransform: 'none'
          }}
        >
          Create Maintenance Request
        </Button>
      </Stack>

      {/* Requests Grid */}
      <Grid container spacing={3}>
        {allRequests.map((request) => (
          <Grid size={{ xs: 12, sm: 6, md: 6 }} key={request.id}>
            <MaintenanceCard
              request={request}
              onClick={() => navigate(`/landlord/maintenance/${request.id}`)}
            />
          </Grid>
        ))}
      </Grid>
    </Box>
  );
}

