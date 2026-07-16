import { useState, useEffect } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { useSubscription } from 'hooks/useSubscription';
import {
  Box,
  Typography,
  Card,
  CardContent,
  Grid,
  Stack,
  Button,
  CircularProgress,
  Alert
} from '@mui/material';
import { DownloadOutlined } from '@ant-design/icons';
import MainCard from 'components/MainCard';
import PageBreadcrumbs from 'components/breadcrumbs/PageBreadcrumbs';
import ReportFilters from 'sections/reports/ReportFilters';
import { getRevenuePerUnitReport } from 'api/reports';
import useAuth from 'hooks/useAuth';
import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, LineChart, Line } from 'recharts';

export default function RevenuePerUnitReport() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const { subscription, loading: subscriptionLoading } = useSubscription();
  const planName = (subscription?.plan?.name || subscription?.subscriptionPlan?.name || '').toLowerCase();
  const hasPremiumAccess = planName === 'premium' || planName.includes('lifetime');
  const [searchParams, setSearchParams] = useSearchParams();

  useEffect(() => {
    if (!subscriptionLoading && !hasPremiumAccess) {
      navigate('/landlord/reports');
    }
  }, [hasPremiumAccess, subscriptionLoading, navigate]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [reportData, setReportData] = useState(null);

  const [filters, setFilters] = useState({
    propertyIds: searchParams.get('propertyIds')?.split(',').filter(Boolean).map(Number) || [],
    unitIds: searchParams.get('unitIds')?.split(',').filter(Boolean).map(Number) || [],
    timespan: searchParams.get('timespan') ? {
      timespan: searchParams.get('timespan'),
      dateFrom: searchParams.get('dateFrom') ? new Date(searchParams.get('dateFrom')) : null,
      dateTo: searchParams.get('dateTo') ? new Date(searchParams.get('dateTo')) : null
    } : {
      timespan: '12months',
      dateFrom: new Date(Date.now() - 365 * 24 * 60 * 60 * 1000),
      dateTo: new Date()
    }
  });

  useEffect(() => {
    const params = new URLSearchParams();
    if (filters.propertyIds?.length > 0) {
      params.set('propertyIds', filters.propertyIds.join(','));
    }
    if (filters.unitIds?.length > 0) {
      params.set('unitIds', filters.unitIds.join(','));
    }
    if (filters.timespan) {
      params.set('timespan', filters.timespan.timespan);
      if (filters.timespan.dateFrom) {
        params.set('dateFrom', filters.timespan.dateFrom.toISOString());
      }
      if (filters.timespan.dateTo) {
        params.set('dateTo', filters.timespan.dateTo.toISOString());
      }
    }
    setSearchParams(params, { replace: true });
  }, [filters, setSearchParams]);

  useEffect(() => {
    const fetchData = async () => {
      if (!user?.id && !user?.Id) return;

      setLoading(true);
      setError(null);

      try {
        const timeRange = filters.timespan?.timespan || '12months';
        const startDate = filters.timespan?.dateFrom;
        const endDate = filters.timespan?.dateTo;

        const data = await getRevenuePerUnitReport({
          propertyIds: filters.propertyIds,
          unitIds: filters.unitIds,
          startDate,
          endDate,
          timeRange
        });

        setReportData(data?.data || data);
      } catch (err) {
        console.error('Error fetching revenue per unit report:', err);
        setError(err.response?.data?.message || err.message || 'Failed to load revenue per unit report');
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [user, filters]);

  return (
    <Box>
      <PageBreadcrumbs
        items={[
          { label: 'Dashboard', path: '/landlord/dashboard' },
          { label: 'Reports & Analytics', path: '/landlord/reports' },
          { label: 'Revenue Per Unit Report' }
        ]}
      />

      <MainCard>
        <Stack spacing={3}>
          <Box>
            <Typography variant="h4" fontWeight="bold" gutterBottom>
              Revenue Per Unit (RPU) Report
            </Typography>
            <Typography variant="body2" color="text.secondary">
              Revenue generated per unit under management
            </Typography>
            <Typography variant="caption" color="text.secondary" sx={{ fontStyle: 'italic', display: 'block', mt: 0.5 }}>
              Formula: Total Property Management Revenue / Number of Units
            </Typography>
          </Box>

          <ReportFilters filters={filters} onFiltersChange={setFilters} />

          {loading && (
            <Box sx={{ display: 'flex', justifyContent: 'center', p: 4 }}>
              <CircularProgress />
            </Box>
          )}

          {error && <Alert severity="error">{error}</Alert>}

          {!loading && !error && reportData && (
            <Grid container spacing={3}>
              <Grid size={{ xs: 12, md: 4 }}>
                <Card>
                  <CardContent>
                    <Typography variant="subtitle2" color="text.secondary" gutterBottom>
                      Average Revenue Per Unit
                    </Typography>
                    <Typography variant="h3" fontWeight="bold" color="primary">
                      ${reportData.averageRPU?.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 }) || '0.00'}
                    </Typography>
                  </CardContent>
                </Card>
              </Grid>

              <Grid size={{ xs: 12, md: 4 }}>
                <Card>
                  <CardContent>
                    <Typography variant="subtitle2" color="text.secondary" gutterBottom>
                      Total Units
                    </Typography>
                    <Typography variant="h3" fontWeight="bold">
                      {reportData.totalUnits || 0}
                    </Typography>
                  </CardContent>
                </Card>
              </Grid>

              <Grid size={{ xs: 12, md: 4 }}>
                <Card>
                  <CardContent>
                    <Typography variant="subtitle2" color="text.secondary" gutterBottom>
                      Total Revenue
                    </Typography>
                    <Typography variant="h3" fontWeight="bold" color="success.main">
                      ${reportData.totalRevenue?.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 }) || '0.00'}
                    </Typography>
                  </CardContent>
                </Card>
              </Grid>

              {reportData.rpuByProperty && reportData.rpuByProperty.length > 0 && (
                <Grid size={{ xs: 12, lg: 6 }}>
                  <MainCard title="RPU by Property">
                    <ResponsiveContainer width="100%" height={300}>
                      <BarChart data={reportData.rpuByProperty}>
                        <CartesianGrid strokeDasharray="3 3" />
                        <XAxis dataKey="propertyName" />
                        <YAxis />
                        <Tooltip formatter={(value) => `$${value.toLocaleString()}`} />
                        <Legend />
                        <Bar dataKey="rpu" fill="#1890ff" name="Revenue Per Unit" />
                      </BarChart>
                    </ResponsiveContainer>
                  </MainCard>
                </Grid>
              )}

              {reportData.rpuHistory && reportData.rpuHistory.length > 0 && (
                <Grid size={{ xs: 12, lg: 6 }}>
                  <MainCard title="RPU Trend">
                    <ResponsiveContainer width="100%" height={300}>
                      <LineChart data={reportData.rpuHistory}>
                        <CartesianGrid strokeDasharray="3 3" />
                        <XAxis dataKey="month" />
                        <YAxis />
                        <Tooltip formatter={(value) => `$${value.toLocaleString()}`} />
                        <Legend />
                        <Line type="monotone" dataKey="rpu" stroke="#1890ff" name="Revenue Per Unit" />
                      </LineChart>
                    </ResponsiveContainer>
                  </MainCard>
                </Grid>
              )}

              <Grid size={{ xs: 12 }}>
                <Stack direction="row" justifyContent="flex-end">
                  <Button
                    variant="outlined"
                    startIcon={<DownloadOutlined />}
                    onClick={() => alert('Export functionality coming soon')}
                  >
                    Export Report
                  </Button>
                </Stack>
              </Grid>
            </Grid>
          )}

          {!loading && !error && !reportData && (
            <Alert severity="info">
              No data available for the selected filters.
            </Alert>
          )}
        </Stack>
      </MainCard>
    </Box>
  );
}
