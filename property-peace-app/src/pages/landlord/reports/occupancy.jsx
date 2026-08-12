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
  Alert,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  alpha,
  useTheme
} from '@mui/material';
import { DownloadOutlined } from '@ant-design/icons';
import { useSelector } from 'react-redux';
import MainCard from 'components/MainCard';
import PageBreadcrumbs from 'components/breadcrumbs/PageBreadcrumbs';
import PropertySelect from 'components/PropertySelect';
import OccupancyTimelineGraph from 'components/OccupancyTimelineGraph';
import { getOccupancyReport } from 'api/reports';
import { getUnitAvailabilityCalendar } from 'api/property-portfolio';
import useAuth from 'hooks/useAuth';
import { selectProperty } from 'store/property/property.selector';

export default function OccupancyReport() {
  const { user } = useAuth();
  const theme = useTheme();

  const [searchParams, setSearchParams] = useSearchParams();
  const [exportLoading, setExportLoading] = useState(false);
  const selectedProperty = useSelector(selectProperty);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [reportData, setReportData] = useState(null);
  
  // Year selector for timeline graph
  const currentYear = new Date().getFullYear();
  const [selectedYear, setSelectedYear] = useState(currentYear);
  const [timelineData, setTimelineData] = useState(null);
  const [timelineLoading, setTimelineLoading] = useState(false);

  // Initialize filters from URL params or defaults
  const [filters, setFilters] = useState({
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

  // Update URL params when filters change
  useEffect(() => {
    const params = new URLSearchParams();
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

  // Fetch report data
  useEffect(() => {
    const fetchData = async () => {
      if (!user?.id && !user?.Id) return;

      setLoading(true);
      setError(null);

      try {
        const landlordId = user?.id || user?.Id;
        const timeRange = filters.timespan?.timespan || '12months';
        const startDate = filters.timespan?.dateFrom;
        const endDate = filters.timespan?.dateTo;

        const data = await getOccupancyReport({
          propertyIds: selectedProperty?.id ? [selectedProperty.id] : [],
          unitIds: filters.unitIds,
          startDate,
          endDate,
          timeRange
        });

        setReportData(data?.data || data);
      } catch (err) {
        console.error('Error fetching occupancy report:', err);
        setError(err.response?.data?.message || err.message || 'Failed to load occupancy report');
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [user, filters, selectedProperty]);

  // Fetch timeline data for selected year
  useEffect(() => {
    const fetchTimelineData = async () => {
      if (!user?.id && !user?.Id || !selectedYear) return;

      setTimelineLoading(true);
      try {
        const landlordId = user?.id || user?.Id;
        // Fetch data for the entire selected year (Jan 1 - Dec 31)
        const yearStart = new Date(selectedYear, 0, 1);
        const yearEnd = new Date(selectedYear, 11, 31, 23, 59, 59);

        const propertyId = selectedProperty?.id || null;
        const data = await getUnitAvailabilityCalendar(landlordId, propertyId, yearStart, yearEnd);
        setTimelineData(data);
      } catch (err) {
        console.error('Error fetching timeline data:', err);
        // Don't set error state for timeline - it's optional
      } finally {
        setTimelineLoading(false);
      }
    };

    fetchTimelineData();
  }, [user, selectedYear, selectedProperty]);

  return (
    <Box>
      <PageBreadcrumbs
        items={[
          { label: 'Dashboard', path: '/landlord/dashboard' },
          { label: 'Reports & Analytics', path: '/landlord/reports' },
          { label: 'Occupancy Report' }
        ]}
      />

      {/* Filters and Overview Cards */}
      <MainCard
        sx={{
          mb: 3,
          bgcolor: (t) => alpha(t.palette.background.paper, 0.8),
          boxShadow: (t) => `0 4px 20px ${alpha(t.palette.primary.main, 0.15)}`,
          border: `1px solid ${alpha(theme.palette.divider, 0.1)}`,
          borderRadius: 2,
          overflow: 'hidden'
        }}
      >
        <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 3 }}>
          <Box>
            <Typography variant="h4" fontWeight="bold">Occupancy Report</Typography>
            <Typography variant="body2" color="text.secondary">Percentage of units occupied across your portfolio</Typography>
          </Box>
          <Stack direction="row" spacing={1} alignItems="center">
            <PropertySelect width={220} />
            <Button
              variant="outlined"
              startIcon={<DownloadOutlined />}
              disabled
              sx={{ flexShrink: 0 }}
            >
              Export
            </Button>
          </Stack>
        </Stack>

        {/* Overview Cards */}
        {!loading && !error && reportData && (
          <Grid container spacing={2}>
            <Grid size={{ xs: 12, sm: 6, md: 3 }}>
              <Card sx={{ bgcolor: (t) => alpha(t.palette.primary.main, 0.1), border: `1px solid ${alpha(theme.palette.primary.main, 0.2)}` }}>
                <CardContent>
                  <Typography variant="subtitle2" color="text.secondary" gutterBottom>
                    Occupancy Rate
                  </Typography>
                  <Typography variant="h3" fontWeight="bold" color="primary.main">
                    {reportData.occupancyRate?.toFixed(1) || 0}%
                  </Typography>
                  <Typography variant="caption" color="text.secondary" sx={{ mt: 1, display: 'block' }}>
                    {reportData.occupiedUnits || 0} of {reportData.totalUnits || 0} units
                  </Typography>
                </CardContent>
              </Card>
            </Grid>

            <Grid size={{ xs: 12, sm: 6, md: 3 }}>
              <Card sx={{ bgcolor: (t) => alpha(t.palette.success.main, 0.1), border: `1px solid ${alpha(theme.palette.success.main, 0.2)}` }}>
                <CardContent>
                  <Typography variant="subtitle2" color="text.secondary" gutterBottom>
                    Occupied Units
                  </Typography>
                  <Typography variant="h3" fontWeight="bold" color="success.main">
                    {reportData.occupiedUnits || 0}
                  </Typography>
                  <Typography variant="caption" color="text.secondary" sx={{ mt: 1, display: 'block' }}>
                    Currently leased
                  </Typography>
                </CardContent>
              </Card>
            </Grid>

            <Grid size={{ xs: 12, sm: 6, md: 3 }}>
              <Card
                sx={{
                  bgcolor: (t) => alpha((reportData.vacantUnits || 0) > 0 ? t.palette.warning.main : t.palette.success.main, 0.1),
                  border: `1px solid ${alpha((reportData.vacantUnits || 0) > 0 ? theme.palette.warning.main : theme.palette.success.main, 0.2)}`
                }}
              >
                <CardContent>
                  <Typography variant="subtitle2" color="text.secondary" gutterBottom>
                    Vacant Units
                  </Typography>
                  <Typography
                    variant="h3"
                    fontWeight="bold"
                    color={(reportData.vacantUnits || 0) > 0 ? 'warning.main' : 'success.main'}
                  >
                    {reportData.vacantUnits || 0}
                  </Typography>
                  <Typography variant="caption" color="text.secondary" sx={{ mt: 1, display: 'block' }}>
                    Vacancy rate: {reportData.vacancyRate?.toFixed(1) || 0}%
                  </Typography>
                </CardContent>
              </Card>
            </Grid>

            <Grid size={{ xs: 12, sm: 6, md: 3 }}>
              <Card sx={{ bgcolor: (t) => alpha(t.palette.info.main, 0.1), border: `1px solid ${alpha(theme.palette.info.main, 0.2)}` }}>
                <CardContent>
                  <Typography variant="subtitle2" color="text.secondary" gutterBottom>
                    Total Units
                  </Typography>
                  <Typography variant="h3" fontWeight="bold" color="info.main">
                    {reportData.totalUnits || 0}
                  </Typography>
                  <Typography variant="caption" color="text.secondary" sx={{ mt: 1, display: 'block' }}>
                    Across all properties
                  </Typography>
                </CardContent>
              </Card>
            </Grid>
          </Grid>
        )}
      </MainCard>

      {/* Loading State */}
      {loading && (
        <Box sx={{ display: 'flex', justifyContent: 'center', p: 4 }}>
          <CircularProgress />
        </Box>
      )}

      {/* Error State */}
      {error && (
        <Alert severity="error" sx={{ mb: 3 }}>{error}</Alert>
      )}

      {/* Occupancy Timeline Graph */}
      {!loading && !error && (
        <MainCard
          title="Occupancy Timeline"
          secondary={
            <FormControl size="small" sx={{ minWidth: 120 }}>
              <InputLabel>Year</InputLabel>
              <Select
                value={selectedYear}
                label="Year"
                onChange={(e) => setSelectedYear(e.target.value)}
              >
                {Array.from({ length: 5 }, (_, i) => currentYear - 2 + i).map((year) => (
                  <MenuItem key={year} value={year}>
                    {year}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>
          }
        >
          <OccupancyTimelineGraph
            calendarData={timelineData}
            year={selectedYear}
            loading={timelineLoading}
            fallbackPropertyName={selectedProperty?.name || null}
          />
        </MainCard>
      )}

      {/* Empty State */}
      {!loading && !error && !reportData && (
        <Alert severity="info">
          No data available for the selected filters. Try adjusting your filters or date range.
        </Alert>
      )}
    </Box>
  );
}
