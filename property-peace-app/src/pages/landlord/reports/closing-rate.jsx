import { useState, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Box, Typography, Card, CardContent, Grid, Stack, Button, CircularProgress, Alert } from '@mui/material';
import { DownloadOutlined } from '@ant-design/icons';
import MainCard from 'components/MainCard';
import PageBreadcrumbs from 'components/breadcrumbs/PageBreadcrumbs';
import ReportFilters from 'sections/reports/ReportFilters';
import { getClosingRateReport } from 'api/reports';

import useAuth from 'hooks/useAuth';
import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, LineChart, Line } from 'recharts';

export default function ClosingRateReport() {
  const { user } = useAuth();

  const [searchParams, setSearchParams] = useSearchParams();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [reportData, setReportData] = useState(null);



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
    const fetchData = async () => {
      if (!user?.id && !user?.Id) return;
      setLoading(true);
      setError(null);
      try {
        const data = await getClosingRateReport({
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
  }, [user, filters]);


  return (
    <Box>
      <PageBreadcrumbs items={[
        { label: 'Dashboard', path: '/landlord/dashboard' },
        { label: 'Reports & Analytics', path: '/landlord/reports' },
        { label: 'Closing Rate Report' }
      ]} />
      <MainCard>
        <Stack spacing={3}>
          <Box>
            <Typography variant="h4" fontWeight="bold" gutterBottom>Closing Rate Report</Typography>
            <Typography variant="body2" color="text.secondary">Percentage of valid leads that turn into customers</Typography>
            <Typography variant="caption" color="text.secondary" sx={{ fontStyle: 'italic', display: 'block', mt: 0.5 }}>
              Formula: Won Customers / Total Leads
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
                      Closing Rate
                    </Typography>
                    <Typography variant="h3" fontWeight="bold" color="primary">
                      {reportData.closingRate?.toFixed(2) || 0}%
                    </Typography>
                  </CardContent>
                </Card>
              </Grid>
              <Grid size={{ xs: 12, md: 4 }}>
                <Card>
                  <CardContent>
                    <Typography variant="subtitle2" color="text.secondary" gutterBottom>
                      Won Customers
                    </Typography>
                    <Typography variant="h3" fontWeight="bold" color="success.main">
                      {reportData.wonCustomers || 0}
                    </Typography>
                  </CardContent>
                </Card>
              </Grid>
              <Grid size={{ xs: 12, md: 4 }}>
                <Card>
                  <CardContent>
                    <Typography variant="subtitle2" color="text.secondary" gutterBottom>
                      Total Leads
                    </Typography>
                    <Typography variant="h3" fontWeight="bold">
                      {reportData.totalLeads || 0}
                    </Typography>
                  </CardContent>
                </Card>
              </Grid>
              {reportData.closingRateHistory && reportData.closingRateHistory.length > 0 && (
                <Grid size={{ xs: 12 }}>
                  <MainCard title="Closing Rate Trend">
                    <ResponsiveContainer width="100%" height={300}>
                      <LineChart data={reportData.closingRateHistory}>
                        <CartesianGrid strokeDasharray="3 3" />
                        <XAxis dataKey="period" />
                        <YAxis />
                        <Tooltip formatter={(value) => `${value.toFixed(2)}%`} />
                        <Legend />
                        <Line type="monotone" dataKey="closingRate" stroke="#13c2c2" name="Closing Rate %" />
                      </LineChart>
                    </ResponsiveContainer>
                  </MainCard>
                </Grid>
              )}
              {reportData.conversionBySource && reportData.conversionBySource.length > 0 && (
                <Grid size={{ xs: 12 }}>
                  <MainCard title="Conversion by Source">
                    <ResponsiveContainer width="100%" height={300}>
                      <BarChart data={reportData.conversionBySource}>
                        <CartesianGrid strokeDasharray="3 3" />
                        <XAxis dataKey="source" />
                        <YAxis />
                        <Tooltip formatter={(value) => `${value.toFixed(2)}%`} />
                        <Legend />
                        <Bar dataKey="conversionRate" fill="#13c2c2" name="Conversion Rate %" />
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
