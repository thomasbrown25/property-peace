import { useState, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
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
import { getClientChurnReport } from 'api/reports';

import useAuth from 'hooks/useAuth';
import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, LineChart, Line } from 'recharts';

export default function ClientChurnReport() {
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

        const data = await getClientChurnReport({
          propertyIds: filters.propertyIds,
          startDate,
          endDate,
          timeRange
        });

        setReportData(data?.data || data);
      } catch (err) {
        console.error('Error fetching client churn report:', err);
        setError(err.response?.data?.message || err.message || 'Failed to load client churn report');
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
          { label: 'Client Churn Report' }
        ]}
      />

      <MainCard>
        <Stack spacing={3}>
          <Box>
            <Typography variant="h4" fontWeight="bold" gutterBottom>
              Client Churn Rate Report
            </Typography>
            <Typography variant="body2" color="text.secondary">
              Percentage of customers lost in a given time frame
            </Typography>
            <Typography variant="caption" color="text.secondary" sx={{ fontStyle: 'italic', display: 'block', mt: 0.5 }}>
              Formula: Units Lost / Units Started With
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
                      Client Churn Rate
                    </Typography>
                    <Typography variant="h3" fontWeight="bold" color={reportData.churnRate > 10 ? 'error' : 'primary'}>
                      {reportData.churnRate?.toFixed(2) || 0}%
                    </Typography>
                  </CardContent>
                </Card>
              </Grid>

              <Grid size={{ xs: 12, md: 4 }}>
                <Card>
                  <CardContent>
                    <Typography variant="subtitle2" color="text.secondary" gutterBottom>
                      Units Lost
                    </Typography>
                    <Typography variant="h3" fontWeight="bold" color="error">
                      {reportData.unitsLost || 0}
                    </Typography>
                  </CardContent>
                </Card>
              </Grid>

              <Grid size={{ xs: 12, md: 4 }}>
                <Card>
                  <CardContent>
                    <Typography variant="subtitle2" color="text.secondary" gutterBottom>
                      Units Started With
                    </Typography>
                    <Typography variant="h3" fontWeight="bold">
                      {reportData.unitsStartedWith || 0}
                    </Typography>
                  </CardContent>
                </Card>
              </Grid>

              {reportData.churnHistory && reportData.churnHistory.length > 0 && (
                <Grid size={{ xs: 12 }}>
                  <MainCard title="Churn Rate Over Time">
                    <ResponsiveContainer width="100%" height={300}>
                      <LineChart data={reportData.churnHistory}>
                        <CartesianGrid strokeDasharray="3 3" />
                        <XAxis dataKey="period" />
                        <YAxis />
                        <Tooltip formatter={(value) => `${value.toFixed(2)}%`} />
                        <Legend />
                        <Line type="monotone" dataKey="churnRate" stroke="#f5222d" name="Churn Rate %" />
                      </LineChart>
                    </ResponsiveContainer>
                  </MainCard>
                </Grid>
              )}

              {reportData.churnReasons && reportData.churnReasons.length > 0 && (
                <Grid size={{ xs: 12 }}>
                  <MainCard title="Reasons for Churn">
                    <ResponsiveContainer width="100%" height={300}>
                      <BarChart data={reportData.churnReasons}>
                        <CartesianGrid strokeDasharray="3 3" />
                        <XAxis dataKey="reason" />
                        <YAxis />
                        <Tooltip />
                        <Legend />
                        <Bar dataKey="count" fill="#f5222d" name="Units Lost" />
                      </BarChart>
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
