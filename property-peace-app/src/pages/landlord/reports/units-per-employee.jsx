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
import { getUnitsPerEmployeeReport } from 'api/reports';

import useAuth from 'hooks/useAuth';
import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend } from 'recharts';

export default function UnitsPerEmployeeReport() {
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
        const data = await getUnitsPerEmployeeReport({
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
        { label: 'Units Per Employee Report' }
      ]} />
      <MainCard>
        <Stack spacing={3}>
          <Box>
            <Typography variant="h4" fontWeight="bold" gutterBottom>Units Per Employee Report</Typography>
            <Typography variant="body2" color="text.secondary">Total number of units divided by total number of "direct" team members</Typography>
            <Typography variant="caption" color="text.secondary" sx={{ fontStyle: 'italic', display: 'block', mt: 0.5 }}>
              Formula: Total Units / Direct Team Members
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
                      Units Per Employee
                    </Typography>
                    <Typography variant="h3" fontWeight="bold" color="primary">
                      {reportData.unitsPerEmployee?.toFixed(2) || 0}
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
                      Direct Team Members
                    </Typography>
                    <Typography variant="h3" fontWeight="bold">
                      {reportData.totalEmployees || 0}
                    </Typography>
                  </CardContent>
                </Card>
              </Grid>
              {reportData.employeePerformance && reportData.employeePerformance.length > 0 && (
                <Grid size={{ xs: 12 }}>
                  <MainCard title="Employee Performance">
                    <ResponsiveContainer width="100%" height={300}>
                      <BarChart data={reportData.employeePerformance}>
                        <CartesianGrid strokeDasharray="3 3" />
                        <XAxis dataKey="employeeName" />
                        <YAxis />
                        <Tooltip />
                        <Legend />
                        <Bar dataKey="unitsManaged" fill="#fa8c16" name="Units Managed" />
                      </BarChart>
                    </ResponsiveContainer>
                  </MainCard>
                </Grid>
              )}
              <Grid size={{ xs: 12 }}>
                <Stack direction="row" justifyContent="flex-end">
                  <Button variant="outlined" startIcon={<DownloadOutlined />} onClick={() => alert('Export coming soon')}>
                    Export Report
                  </Button>
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
