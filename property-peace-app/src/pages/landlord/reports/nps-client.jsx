import { useState, useEffect } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { Box, Typography, Card, CardContent, Grid, Stack, Button, CircularProgress, Alert } from '@mui/material';
import { DownloadOutlined } from '@ant-design/icons';
import MainCard from 'components/MainCard';
import PageBreadcrumbs from 'components/breadcrumbs/PageBreadcrumbs';
import ReportFilters from 'sections/reports/ReportFilters';
import { getNPSClientReport } from 'api/reports';
import { useSubscription } from 'hooks/useSubscription';
import useAuth from 'hooks/useAuth';
import { ResponsiveContainer, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, BarChart, Bar } from 'recharts';

export default function NPSClientReport() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const { subscription, loading: subscriptionLoading } = useSubscription();
  const [searchParams, setSearchParams] = useSearchParams();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [reportData, setReportData] = useState(null);

  const planName = (subscription?.plan?.name || subscription?.subscriptionPlan?.name || '').toLowerCase();
  const hasPremiumAccess = planName === 'premium' || planName.includes('lifetime');

  useEffect(() => {
    if (!subscriptionLoading && !hasPremiumAccess) {
      navigate('/landlord/reports');
    }
  }, [hasPremiumAccess, subscriptionLoading, navigate]);

  const [filters, setFilters] = useState({
    propertyIds: searchParams.get('propertyIds')?.split(',').filter(Boolean).map(Number) || [],
    timespan: searchParams.get('timespan') ? {
      timespan: searchParams.get('timespan'),
      dateFrom: searchParams.get('dateFrom') ? new Date(searchParams.get('dateFrom')) : null,
      dateTo: searchParams.get('dateTo') ? new Date(searchParams.get('dateTo')) : null
    } : { timespan: '12months', dateFrom: new Date(Date.now() - 365 * 24 * 60 * 60 * 1000), dateTo: new Date() }
  });

  useEffect(() => {
    const params = new URLSearchParams();
    if (filters.propertyIds?.length > 0) params.set('propertyIds', filters.propertyIds.join(','));
    if (filters.timespan) {
      params.set('timespan', filters.timespan.timespan);
      if (filters.timespan.dateFrom) params.set('dateFrom', filters.timespan.dateFrom.toISOString());
      if (filters.timespan.dateTo) params.set('dateTo', filters.timespan.dateTo.toISOString());
    }
    setSearchParams(params, { replace: true });
  }, [filters, setSearchParams]);

  useEffect(() => {
    // TODO: Re-enable premium access check when ready
    // if (!hasPremiumAccess) return;
    const fetchData = async () => {
      if (!user?.id && !user?.Id) return;
      setLoading(true);
      setError(null);
      try {
        const data = await getNPSClientReport({
          propertyIds: filters.propertyIds,
          startDate: filters.timespan?.dateFrom,
          endDate: filters.timespan?.dateTo,
          timeRange: filters.timespan?.timespan || '12months'
        });
        setReportData(data?.data || data);
      } catch (err) {
        setError(err.response?.data?.message || err.message || 'Failed to load report');
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, [user, filters]); // TODO: Add hasPremiumAccess back when re-enabling premium checks

  // TODO: Re-enable premium access check when ready
  // if (!hasPremiumAccess) {
  //   return (
  //     <Box>
  //       <PageBreadcrumbs items={[
  //         { label: 'Dashboard', path: '/landlord/dashboard' },
  //         { label: 'Reports & Analytics', path: '/landlord/reports' },
  //         { label: 'NPS Client Score Report' }
  //       ]} />
  //       <MainCard><Alert severity="warning">This report requires a premium subscription.</Alert></MainCard>
  //     </Box>
  //   );
  // }

  return (
    <Box>
      <PageBreadcrumbs items={[
        { label: 'Dashboard', path: '/landlord/dashboard' },
        { label: 'Reports & Analytics', path: '/landlord/reports' },
        { label: 'NPS Client Score Report' }
      ]} />
      <MainCard>
        <Stack spacing={3}>
          <Box>
            <Typography variant="h4" fontWeight="bold" gutterBottom>NPS Client Score Report</Typography>
            <Typography variant="body2" color="text.secondary">Measures client satisfaction</Typography>
            <Typography variant="caption" color="text.secondary" sx={{ fontStyle: 'italic', display: 'block', mt: 0.5 }}>
              Formula: NPS = Net Promoter Score
            </Typography>
          </Box>
          <ReportFilters filters={filters} onFiltersChange={setFilters} />
          {loading && <Box sx={{ display: 'flex', justifyContent: 'center', p: 4 }}><CircularProgress /></Box>}
          {error && <Alert severity="error">{error}</Alert>}
          {!loading && !error && reportData && (
            <Grid container spacing={3}>
              <Grid size={{ xs: 12, md: 4 }}>
                <Card>
                  <CardContent>
                    <Typography variant="subtitle2" color="text.secondary" gutterBottom>
                      NPS Score
                    </Typography>
                    <Typography variant="h3" fontWeight="bold" color={reportData.npsScore >= 50 ? 'success' : reportData.npsScore >= 0 ? 'warning' : 'error'}>
                      {reportData.npsScore || 0}
                    </Typography>
                  </CardContent>
                </Card>
              </Grid>
              <Grid size={{ xs: 12, md: 4 }}>
                <Card>
                  <CardContent>
                    <Typography variant="subtitle2" color="text.secondary" gutterBottom>
                      Promoters
                    </Typography>
                    <Typography variant="h3" fontWeight="bold" color="success.main">
                      {reportData.promoters || 0}
                    </Typography>
                  </CardContent>
                </Card>
              </Grid>
              <Grid size={{ xs: 12, md: 4 }}>
                <Card>
                  <CardContent>
                    <Typography variant="subtitle2" color="text.secondary" gutterBottom>
                      Detractors
                    </Typography>
                    <Typography variant="h3" fontWeight="bold" color="error.main">
                      {reportData.detractors || 0}
                    </Typography>
                  </CardContent>
                </Card>
              </Grid>
              {reportData.npsHistory && reportData.npsHistory.length > 0 && (
                <Grid size={{ xs: 12 }}>
                  <MainCard title="NPS Trend">
                    <ResponsiveContainer width="100%" height={300}>
                      <LineChart data={reportData.npsHistory}>
                        <CartesianGrid strokeDasharray="3 3" />
                        <XAxis dataKey="period" />
                        <YAxis />
                        <Tooltip />
                        <Legend />
                        <Line type="monotone" dataKey="npsScore" stroke="#2f54eb" name="NPS Score" />
                      </LineChart>
                    </ResponsiveContainer>
                  </MainCard>
                </Grid>
              )}
              {reportData.promoterBreakdown && reportData.promoterBreakdown.length > 0 && (
                <Grid size={{ xs: 12 }}>
                  <MainCard title="Promoter/Detractor Breakdown">
                    <ResponsiveContainer width="100%" height={300}>
                      <BarChart data={reportData.promoterBreakdown}>
                        <CartesianGrid strokeDasharray="3 3" />
                        <XAxis dataKey="category" />
                        <YAxis />
                        <Tooltip />
                        <Legend />
                        <Bar dataKey="promoters" fill="#52c41a" name="Promoters" />
                        <Bar dataKey="detractors" fill="#f5222d" name="Detractors" />
                      </BarChart>
                    </ResponsiveContainer>
                  </MainCard>
                </Grid>
              )}
              <Grid size={{ xs: 12 }}>
                <Stack direction="row" justifyContent="flex-end">
                  <Button variant="outlined" startIcon={<DownloadOutlined />} onClick={() => alert('Export coming soon')}>Export Report</Button>
                </Stack>
              </Grid>
            </Grid>
          )}
          {!loading && !error && !reportData && <Alert severity="info">No data available.</Alert>}
        </Stack>
      </MainCard>
    </Box>
  );
}
