import { useState, useEffect } from 'react';
import {
  Box,
  Grid,
  Typography,
  Card,
  CardContent,
  Stack,
  Button,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Paper,
  Chip,
  CircularProgress,
  Alert
} from '@mui/material';
import {
  UserOutlined,
  HomeOutlined,
  DollarOutlined,
  FileTextOutlined,
  ReloadOutlined
} from '@ant-design/icons';

// project imports
import MainCard from 'components/MainCard';
import useAuth from 'hooks/useAuth';
import axios from 'utils/axios';

// ==============================|| ADMIN DASHBOARD ||============================== //

export default function AdminDashboard() {
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState({
    totalUsers: 0,
    totalProperties: 0,
    totalSubscriptions: 0,
    activeSubscriptions: 0,
    totalRevenue: 0
  });
  const [recentSubscriptions, setRecentSubscriptions] = useState([]);
  const [error, setError] = useState(null);

  useEffect(() => {
    loadDashboardData();
  }, []);

  const loadDashboardData = async () => {
    try {
      setLoading(true);
      setError(null);

      // Fetch all user subscriptions (admin endpoint)
      const subscriptionsResponse = await axios.get('/api/admin/subscription/users');
      
      if (subscriptionsResponse.data?.success && subscriptionsResponse.data?.data) {
        const subscriptions = subscriptionsResponse.data.data;
        
        // Calculate stats
        const activeSubs = subscriptions.filter(s => 
          s.status === 'Active' || s.status === 'Trial'
        );
        
        setStats({
          totalUsers: new Set(subscriptions.map(s => s.organizationId)).size, // Count unique organizations
          totalProperties: 0, // TODO: Add property count endpoint
          totalSubscriptions: subscriptions.length,
          activeSubscriptions: activeSubs.length,
          totalRevenue: 0 // TODO: Calculate from Stripe
        });

        // Get recent subscriptions (last 10)
        setRecentSubscriptions(subscriptions.slice(0, 10));
      }
    } catch (err) {
      console.error('Error loading admin dashboard:', err);
      setError(err.response?.data?.message || 'Failed to load dashboard data');
    } finally {
      setLoading(false);
    }
  };

  const StatCard = ({ title, value, icon: Icon, color = 'primary' }) => (
    <MainCard>
      <CardContent>
        <Stack direction="row" spacing={2} alignItems="center">
          <Box
            sx={{
              width: 56,
              height: 56,
              borderRadius: 2,
              bgcolor: `${color}.lighter`,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center'
            }}
          >
            <Icon style={{ fontSize: 28, color: `var(--mui-palette-${color}-main)` }} />
          </Box>
          <Box sx={{ flex: 1 }}>
            <Typography variant="h3" fontWeight="bold">
              {value}
            </Typography>
            <Typography variant="body2" color="text.secondary">
              {title}
            </Typography>
          </Box>
        </Stack>
      </CardContent>
    </MainCard>
  );

  if (loading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: 400 }}>
        <CircularProgress />
      </Box>
    );
  }

  return (
    <Grid container spacing={3}>
      {/* Header */}
      <Grid size={12}>
        <Stack direction="row" justifyContent="space-between" alignItems="center">
          <Typography variant="h3" fontWeight="bold">
            Admin Dashboard
          </Typography>
          <Button
            variant="outlined"
            startIcon={<ReloadOutlined />}
            onClick={loadDashboardData}
            disabled={loading}
          >
            Refresh
          </Button>
        </Stack>
      </Grid>

      {/* Error Alert */}
      {error && (
        <Grid size={12}>
          <Alert severity="error" onClose={() => setError(null)}>
            {error}
          </Alert>
        </Grid>
      )}

      {/* Stats Cards */}
      <Grid size={{ xs: 12, sm: 6, md: 4 }}>
        <StatCard
          title="Total Users"
          value={stats.totalUsers}
          icon={UserOutlined}
          color="primary"
        />
      </Grid>
      <Grid size={{ xs: 12, sm: 6, md: 4 }}>
        <StatCard
          title="Total Subscriptions"
          value={stats.totalSubscriptions}
          icon={FileTextOutlined}
          color="success"
        />
      </Grid>
      <Grid size={{ xs: 12, sm: 6, md: 4 }}>
        <StatCard
          title="Active Subscriptions"
          value={stats.activeSubscriptions}
          icon={DollarOutlined}
          color="warning"
        />
      </Grid>

      {/* Recent Subscriptions Table */}
      <Grid size={12}>
        <MainCard title="Recent Subscriptions">
          <TableContainer>
            <Table>
              <TableHead>
                <TableRow>
                  <TableCell>User</TableCell>
                  <TableCell>Plan</TableCell>
                  <TableCell>Status</TableCell>
                  <TableCell>Billing Cycle</TableCell>
                  <TableCell>Start Date</TableCell>
                  <TableCell>End Date</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {recentSubscriptions.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={6} align="center">
                      <Typography variant="body2" color="text.secondary" sx={{ py: 3 }}>
                        No subscriptions found
                      </Typography>
                    </TableCell>
                  </TableRow>
                ) : (
                  recentSubscriptions.map((sub) => (
                    <TableRow key={sub.id}>
                      <TableCell>
                        {sub.organizationOwner 
                          ? `${sub.organizationOwner.firstName || ''} ${sub.organizationOwner.lastName || ''}`.trim() || sub.organizationOwner.email || `Owner #${sub.organizationOwner.id}`
                          : sub.organizationName || `Organization #${sub.organizationId}`}
                        {sub.organizationOwner?.email && sub.organizationOwner.firstName && sub.organizationOwner.lastName && (
                          <Typography variant="caption" color="text.secondary" display="block">
                            {sub.organizationOwner.email}
                          </Typography>
                        )}
                        {sub.organizationName && !sub.organizationOwner && (
                          <Typography variant="caption" color="text.secondary" display="block">
                            {sub.organizationName}
                          </Typography>
                        )}
                      </TableCell>
                      <TableCell>{sub.plan?.name || 'N/A'}</TableCell>
                      <TableCell>
                        <Chip
                          label={sub.status}
                          color={
                            sub.status === 'Active' ? 'success' :
                            sub.status === 'Trial' ? 'primary' :
                            sub.status === 'Cancelled' ? 'default' : 'error'
                          }
                          size="small"
                        />
                      </TableCell>
                      <TableCell>{sub.billingCycle || 'N/A'}</TableCell>
                      <TableCell>
                        {sub.currentPeriodStart
                          ? new Date(sub.currentPeriodStart).toLocaleDateString()
                          : 'N/A'}
                      </TableCell>
                      <TableCell>
                        {sub.currentPeriodEnd
                          ? new Date(sub.currentPeriodEnd).toLocaleDateString()
                          : 'N/A'}
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </TableContainer>
        </MainCard>
      </Grid>
    </Grid>
  );
}

