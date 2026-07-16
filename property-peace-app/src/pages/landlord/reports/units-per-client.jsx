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
import { getUnitsPerClientReport } from 'api/reports';
import useAuth from 'hooks/useAuth';
import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, PieChart, Pie, Cell } from 'recharts';

const COLORS = ['#1890ff', '#52c41a', '#faad14', '#f5222d', '#722ed1', '#eb2f96', '#13c2c2', '#fa8c16'];

export default function UnitsPerClientReport() {
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

        const data = await getUnitsPerClientReport({
          propertyIds: filters.propertyIds,
          startDate,
          endDate,
          timeRange
        });

        setReportData(data?.data || data);
      } catch (err) {
        console.error('Error fetching units per client report:', err);
        setError(err.response?.data?.message || err.message || 'Failed to load units per client report');
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
          { label: 'Units per Client Report' }
        ]}
      />

      <MainCard>
        <Stack spacing={3}>
          <Box>
            <Typography variant="h4" fontWeight="bold" gutterBottom>
              Units per Client Report
            </Typography>
            <Typography variant="body2" color="text.secondary">
              Average number of units per client
            </Typography>
            <Typography variant="caption" color="text.secondary" sx={{ fontStyle: 'italic', display: 'block', mt: 0.5 }}>
              Formula: Total Units / Total Clients
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
                      Average Units per Client
                    </Typography>
                    <Typography variant="h3" fontWeight="bold" color="primary">
                      {reportData.averageUnitsPerClient?.toFixed(2) || 0}
                    </Typography>
                  </CardContent>
                </Card>
              </Grid>

              <Grid size={{ xs: 12, md: 4 }}>
                <Card>
                  <CardContent>
                    <Typography variant="subtitle2" color="text.secondary" gutterBottom>
                      Total Clients
                    </Typography>
                    <Typography variant="h3" fontWeight="bold">
                      {reportData.totalClients || 0}
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

              {reportData.clientDistribution && reportData.clientDistribution.length > 0 && (
                <Grid size={{ xs: 12, lg: 6 }}>
                  <MainCard title="Client Distribution">
                    <ResponsiveContainer width="100%" height={300}>
                      <PieChart>
                        <Pie
                          data={reportData.clientDistribution}
                          cx="50%"
                          cy="50%"
                          labelLine={false}
                          label={({ name, value }) => `${name}: ${value}`}
                          outerRadius={100}
                          fill="#8884d8"
                          dataKey="units"
                        >
                          {reportData.clientDistribution.map((entry, index) => (
                            <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                          ))}
                        </Pie>
                        <Tooltip />
                      </PieChart>
                    </ResponsiveContainer>
                  </MainCard>
                </Grid>
              )}

              {reportData.topClients && reportData.topClients.length > 0 && (
                <Grid size={{ xs: 12, lg: 6 }}>
                  <MainCard title="Top Clients by Unit Count">
                    <ResponsiveContainer width="100%" height={300}>
                      <BarChart data={reportData.topClients}>
                        <CartesianGrid strokeDasharray="3 3" />
                        <XAxis dataKey="clientName" />
                        <YAxis />
                        <Tooltip />
                        <Legend />
                        <Bar dataKey="unitCount" fill="#722ed1" name="Units" />
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
