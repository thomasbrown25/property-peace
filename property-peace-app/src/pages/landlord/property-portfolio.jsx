import { useState, useEffect, useMemo } from 'react';
import {
  Box,
  Typography,
  Stack,
  Tabs,
  Tab,
  Card,
  CardContent,
  CircularProgress,
  Alert,
  FormControl,
  Select,
  MenuItem,
  InputLabel,
  Chip,
  Grid,
  Slide
} from '@mui/material';
import { BarChartOutlined, HomeOutlined, CalendarOutlined, AppstoreOutlined } from '@ant-design/icons';
import MainCard from 'components/MainCard';
import PropertySelect from 'components/PropertySelect';
import useAuth from 'hooks/useAuth';
import useFetchProperties from 'hooks/useFetchProperties';
import { useSelector } from 'react-redux';
import { selectProperty } from 'store/property/property.selector';
import { getPropertyPortfolioAnalytics, getPropertyOccupancyData, getUnitAvailabilityCalendar } from 'api/property-portfolio';
import UnitAvailabilityCalendar from 'components/UnitAvailabilityCalendar';
import ComingSoon from 'pages/maintenance/coming-soon';
import {
  LineChart,
  Line,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell
} from 'recharts';

// ==============================|| PROPERTY PORTFOLIO PAGE ||============================== //

const COLORS = ['#1890ff', '#52c41a', '#faad14', '#f5222d', '#722ed1', '#eb2f96', '#13c2c2'];

function TabPanel({ children, value, index, slideDirection, ...other }) {
  const isActive = value === index;
  return (
    <div role="tabpanel" hidden={!isActive} {...other}>
      <Slide
        direction={slideDirection}
        in={isActive}
        mountOnEnter
        unmountOnExit
        timeout={300}
      >
        <Box sx={{ pt: 3 }}>{children}</Box>
      </Slide>
    </div>
  );
}

export default function PropertyPortfolio() {
  const { user } = useAuth();
  const selectedProperty = useSelector(selectProperty);
  const { properties } = useFetchProperties();
  const [tabValue, setTabValue] = useState(0);
  const [slideDirection, setSlideDirection] = useState('left');
  const [timeRange, setTimeRange] = useState('12months');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [analyticsData, setAnalyticsData] = useState(null);
  const [occupancyData, setOccupancyData] = useState(null);
  const [calendarData, setCalendarData] = useState(null);
  const [calendarLoading, setCalendarLoading] = useState(false);

  const userId = user?.Id || user?.id;

  useEffect(() => {
    if (userId) {
      fetchAnalyticsData();
      fetchOccupancyData();
      fetchCalendarData();
    }
  }, [userId, selectedProperty?.id, timeRange]);

  const fetchAnalyticsData = async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await getPropertyPortfolioAnalytics(userId, selectedProperty?.id, timeRange);
      setAnalyticsData(data);
    } catch (err) {
      setError(err.message || 'Failed to load analytics data');
      console.error('Error fetching analytics:', err);
    } finally {
      setLoading(false);
    }
  };

  const fetchOccupancyData = async () => {
    try {
      const data = await getPropertyOccupancyData(userId, selectedProperty?.id);
      setOccupancyData(data);
    } catch (err) {
      console.error('Error fetching occupancy data:', err);
    }
  };

  const fetchCalendarData = async () => {
    setCalendarLoading(true);
    try {
      const startDate = new Date();
      const endDate = new Date();
      endDate.setMonth(endDate.getMonth() + 6); // 6 months ahead
      const data = await getUnitAvailabilityCalendar(userId, selectedProperty?.id, startDate, endDate);
      setCalendarData(data);
    } catch (err) {
      console.error('Error fetching calendar data:', err);
    } finally {
      setCalendarLoading(false);
    }
  };

  const handleTabChange = (event, newValue) => {
    // Determine slide direction based on tab movement
    if (newValue > tabValue) {
      // Moving right (e.g., Property Analytics -> Units & Occupancy)
      setSlideDirection('left'); // New content comes from right (slides in from right to left)
    } else if (newValue < tabValue) {
      // Moving left (e.g., Listings -> Units & Occupancy)
      setSlideDirection('right'); // New content comes from left (slides in from left to right)
    }
    setTabValue(newValue);
  };

  return (
    <>
      <Grid container spacing={2.5}>
        <Grid size={12}>
          <Stack direction="row" spacing={2} alignItems="center" justifyContent="space-between" sx={{ mb: 2 }}>
            <Box>
              <Typography variant="h4" fontWeight="bold">
                Property Portfolio
              </Typography>
              <Typography variant="body2" color="text.secondary">
                Comprehensive analytics and occupancy insights for your properties
              </Typography>
            </Box>
            <Stack direction="row" spacing={2} alignItems="center">
              <PropertySelect width={300} />
              <FormControl size="small" sx={{ minWidth: 150 }}>
                <InputLabel>Time Range</InputLabel>
                <Select value={timeRange} label="Time Range" onChange={(e) => setTimeRange(e.target.value)}>
                  <MenuItem value="3months">Last 3 Months</MenuItem>
                  <MenuItem value="6months">Last 6 Months</MenuItem>
                  <MenuItem value="12months">Last 12 Months</MenuItem>
                  <MenuItem value="all">All Time</MenuItem>
                </Select>
              </FormControl>
            </Stack>
          </Stack>
        </Grid>

        <Grid size={12}>
          <MainCard>
            <Tabs 
              value={tabValue} 
              onChange={handleTabChange} 
              sx={{ borderBottom: 1, borderColor: 'divider' }}
            >
              <Tab icon={<BarChartOutlined />} label="Property Analytics" iconPosition="start" />
              <Tab icon={<HomeOutlined />} label="Units & Occupancy" iconPosition="start" />
              <Tab icon={<AppstoreOutlined />} label="Listings" iconPosition="start" />
            </Tabs>
          </MainCard>

          {/* Tab Content */}
          <Box sx={{ overflow: 'visible' }}>
            {/* Property Analytics Tab */}
            <TabPanel value={tabValue} index={0} slideDirection={slideDirection}>
                {loading ? (
                <Box sx={{ display: 'flex', justifyContent: 'center', p: 4 }}>
                  <CircularProgress />
                </Box>
              ) : error ? (
                <Alert severity="error" sx={{ m: 2 }}>
                  {error}
                </Alert>
              ) : analyticsData ? (
                <Grid container spacing={3} sx={{ mt: 1 }}>
                  {/* ROI Cards */}
                  <Grid size={{ xs: 12, md: 6, lg: 3 }}>
                    <Card>
                      <CardContent>
                        <Typography variant="subtitle2" color="text.secondary" gutterBottom sx={{ fontFamily: "'Poppins', sans-serif", fontWeight: 'bold' }}>
                          Average ROI
                        </Typography>
                        <Typography variant="h4" sx={{ fontFamily: "'Poppins', sans-serif", fontWeight: 'bold' }}>
                          {analyticsData.averageROI?.toFixed(1) || 0}%
                        </Typography>
                        <Typography variant="caption" color="text.secondary">
                          Across all properties
                        </Typography>
                      </CardContent>
                    </Card>
                  </Grid>
                  <Grid size={{ xs: 12, md: 6, lg: 3 }}>
                    <Card>
                      <CardContent>
                        <Typography variant="subtitle2" color="text.secondary" gutterBottom sx={{ fontFamily: "'Poppins', sans-serif", fontWeight: 'bold' }}>
                          Vacancy Rate
                        </Typography>
                        <Typography variant="h4" sx={{ fontFamily: "'Poppins', sans-serif", fontWeight: 'bold' }}>
                          {analyticsData.vacancyRate?.toFixed(1) || 0}%
                        </Typography>
                        <Typography variant="caption" color="text.secondary">
                          Current vacancy
                        </Typography>
                      </CardContent>
                    </Card>
                  </Grid>
                  <Grid size={{ xs: 12, md: 6, lg: 3 }}>
                    <Card>
                      <CardContent>
                        <Typography variant="subtitle2" color="text.secondary" gutterBottom sx={{ fontFamily: "'Poppins', sans-serif", fontWeight: 'bold' }}>
                          Occupancy Rate
                        </Typography>
                        <Typography variant="h4" sx={{ fontFamily: "'Poppins', sans-serif", fontWeight: 'bold' }}>
                          {analyticsData.occupancyRate?.toFixed(1) || 0}%
                        </Typography>
                        <Typography variant="caption" color="text.secondary">
                          Current occupancy
                        </Typography>
                      </CardContent>
                    </Card>
                  </Grid>
                  <Grid size={{ xs: 12, md: 6, lg: 3 }}>
                    <Card>
                      <CardContent>
                        <Typography variant="subtitle2" color="text.secondary" gutterBottom sx={{ fontFamily: "'Poppins', sans-serif", fontWeight: 'bold' }}>
                          Total Market Value
                        </Typography>
                        <Typography variant="h4" sx={{ fontFamily: "'Poppins', sans-serif", fontWeight: 'bold' }}>
                          ${analyticsData.totalMarketValue?.toLocaleString() || 0}
                        </Typography>
                        <Typography variant="caption" color="text.secondary">
                          Portfolio value
                        </Typography>
                      </CardContent>
                    </Card>
                  </Grid>

                  {/* ROI by Property Chart */}
                  <Grid size={{ xs: 12, lg: 6 }}>
                    <MainCard title="ROI by Property">
                      <ResponsiveContainer width="100%" height={300}>
                        <BarChart data={analyticsData.propertyROI || []}>
                          <CartesianGrid strokeDasharray="3 3" />
                          <XAxis dataKey="propertyName" />
                          <YAxis />
                          <Tooltip />
                          <Legend />
                          <Bar dataKey="roi" fill="#1890ff" name="ROI %" />
                        </BarChart>
                      </ResponsiveContainer>
                    </MainCard>
                  </Grid>

                  {/* Occupancy History Chart */}
                  <Grid size={{ xs: 12, lg: 6 }}>
                    <MainCard title="Occupancy History">
                      <ResponsiveContainer width="100%" height={300}>
                        <LineChart data={analyticsData.occupancyHistory || []}>
                          <CartesianGrid strokeDasharray="3 3" />
                          <XAxis dataKey="month" />
                          <YAxis />
                          <Tooltip />
                          <Legend />
                          <Line type="monotone" dataKey="occupancyRate" stroke="#52c41a" name="Occupancy %" />
                        </LineChart>
                      </ResponsiveContainer>
                    </MainCard>
                  </Grid>

                  {/* Property Performance Comparison */}
                  <Grid size={{ xs: 12 }}>
                    <MainCard title="Property Performance Comparison">
                      <ResponsiveContainer width="100%" height={400}>
                        <BarChart data={analyticsData.propertyPerformance || []}>
                          <CartesianGrid strokeDasharray="3 3" />
                          <XAxis dataKey="propertyName" />
                          <YAxis yAxisId="left" />
                          <YAxis yAxisId="right" orientation="right" />
                          <Tooltip />
                          <Legend />
                          <Bar yAxisId="left" dataKey="income" fill="#1890ff" name="Income" />
                          <Bar yAxisId="left" dataKey="expenses" fill="#f5222d" name="Expenses" />
                          <Bar yAxisId="right" dataKey="roi" fill="#52c41a" name="ROI %" />
                        </BarChart>
                      </ResponsiveContainer>
                    </MainCard>
                  </Grid>

                  {/* Market Value Tracking */}
                  {analyticsData.marketValueHistory && analyticsData.marketValueHistory.length > 0 && (
                    <Grid size={{ xs: 12 }}>
                      <MainCard title="Market Value Tracking">
                        <ResponsiveContainer width="100%" height={300}>
                          <LineChart data={analyticsData.marketValueHistory}>
                            <CartesianGrid strokeDasharray="3 3" />
                            <XAxis dataKey="date" />
                            <YAxis />
                            <Tooltip />
                            <Legend />
                            <Line type="monotone" dataKey="marketValue" stroke="#722ed1" name="Market Value" />
                          </LineChart>
                        </ResponsiveContainer>
                      </MainCard>
                    </Grid>
                  )}
                </Grid>
              ) : (
                <Alert severity="info" sx={{ m: 2 }}>
                  No analytics data available. Select a property to view analytics.
                </Alert>
              )}
            </TabPanel>

            {/* Units & Occupancy Tab */}
            <TabPanel value={tabValue} index={1} slideDirection={slideDirection}>
                {loading ? (
                <Box sx={{ display: 'flex', justifyContent: 'center', p: 4 }}>
                  <CircularProgress />
                </Box>
              ) : occupancyData ? (
                <Grid container spacing={3} sx={{ mt: 1 }}>
                  {/* Vacancy Cost Tracking */}
                  <Grid size={{ xs: 12, md: 6 }}>
                    <MainCard title="Vacancy Cost Tracking">
                      <Stack spacing={2}>
                        <Box>
                          <Typography variant="subtitle2" color="text.secondary" sx={{ fontFamily: "'Poppins', sans-serif", fontWeight: 'bold' }}>
                            Total Vacancy Cost (Last 12 Months)
                          </Typography>
                          <Typography variant="h4" sx={{ fontFamily: "'Poppins', sans-serif", fontWeight: 'bold' }} color="error">
                            ${occupancyData.totalVacancyCost?.toLocaleString() || 0}
                          </Typography>
                        </Box>
                        <Box>
                          <Typography variant="subtitle2" color="text.secondary" sx={{ fontFamily: "'Poppins', sans-serif", fontWeight: 'bold' }}>
                            Average Days Vacant
                          </Typography>
                          <Typography variant="h5" sx={{ fontFamily: "'Poppins', sans-serif", fontWeight: 'bold' }}>{occupancyData.averageDaysVacant?.toFixed(1) || 0} days</Typography>
                        </Box>
                        {occupancyData.vacancyCostByProperty && occupancyData.vacancyCostByProperty.length > 0 && (
                          <ResponsiveContainer width="100%" height={250}>
                            <BarChart data={occupancyData.vacancyCostByProperty}>
                              <CartesianGrid strokeDasharray="3 3" />
                              <XAxis dataKey="propertyName" />
                              <YAxis />
                              <Tooltip />
                              <Legend />
                              <Bar dataKey="vacancyCost" fill="#f5222d" name="Vacancy Cost" />
                            </BarChart>
                          </ResponsiveContainer>
                        )}
                      </Stack>
                    </MainCard>
                  </Grid>

                  {/* Tenant Turnover Analytics */}
                  <Grid size={{ xs: 12, md: 6 }}>
                    <MainCard title="Tenant Turnover Analytics">
                      <Stack spacing={2}>
                        <Box>
                          <Typography variant="subtitle2" color="text.secondary" sx={{ fontFamily: "'Poppins', sans-serif", fontWeight: 'bold' }}>
                            Average Turnover Rate
                          </Typography>
                          <Typography variant="h4" sx={{ fontFamily: "'Poppins', sans-serif", fontWeight: 'bold' }}>
                            {occupancyData.averageTurnoverRate?.toFixed(1) || 0}%
                          </Typography>
                        </Box>
                        <Box>
                          <Typography variant="subtitle2" color="text.secondary" sx={{ fontFamily: "'Poppins', sans-serif", fontWeight: 'bold' }}>
                            Total Turnovers (Last 12 Months)
                          </Typography>
                          <Typography variant="h5" sx={{ fontFamily: "'Poppins', sans-serif", fontWeight: 'bold' }}>{occupancyData.totalTurnovers || 0}</Typography>
                        </Box>
                        {occupancyData.turnoverByProperty && occupancyData.turnoverByProperty.length > 0 && (
                          <ResponsiveContainer width="100%" height={250}>
                            <PieChart>
                              <Pie
                                data={occupancyData.turnoverByProperty}
                                cx="50%"
                                cy="50%"
                                labelLine={false}
                                label={({ name, percent }) => `${name}: ${(percent * 100).toFixed(0)}%`}
                                outerRadius={80}
                                fill="#8884d8"
                                dataKey="turnovers"
                              >
                                {occupancyData.turnoverByProperty.map((entry, index) => (
                                  <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                                ))}
                              </Pie>
                              <Tooltip />
                            </PieChart>
                          </ResponsiveContainer>
                        )}
                      </Stack>
                    </MainCard>
                  </Grid>

                  {/* Optimal Rent Pricing Suggestions */}
                  {occupancyData.rentPricingSuggestions && occupancyData.rentPricingSuggestions.length > 0 && (
                    <Grid size={{ xs: 12 }}>
                      <MainCard title="Optimal Rent Pricing Suggestions">
                        <Grid container spacing={2}>
                          {occupancyData.rentPricingSuggestions.map((suggestion, index) => (
                            <Grid size={{ xs: 12, md: 6, lg: 4 }} key={index}>
                              <Card variant="outlined">
                                <CardContent>
                                  <Stack spacing={1}>
                                    <Typography variant="h6">{suggestion.propertyName}</Typography>
                                    <Typography variant="body2" color="text.secondary">
                                      Unit: {suggestion.unitName}
                                    </Typography>
                                    <Stack direction="row" spacing={1} alignItems="center">
                                      <Typography variant="body2">Current:</Typography>
                                      <Typography variant="body2" fontWeight="bold">
                                        ${suggestion.currentRent?.toLocaleString()}
                                      </Typography>
                                    </Stack>
                                    <Stack direction="row" spacing={1} alignItems="center">
                                      <Typography variant="body2">Suggested:</Typography>
                                      <Chip
                                        label={`$${suggestion.suggestedRent?.toLocaleString()}`}
                                        color={suggestion.suggestedRent > suggestion.currentRent ? 'success' : 'warning'}
                                        size="small"
                                      />
                                    </Stack>
                                    <Typography variant="caption" color="text.secondary">
                                      {suggestion.reason}
                                    </Typography>
                                  </Stack>
                                </CardContent>
                              </Card>
                            </Grid>
                          ))}
                        </Grid>
                      </MainCard>
                    </Grid>
                  )}

                  {/* Unit Availability Calendar */}
                  <Grid size={{ xs: 12 }}>
                    <MainCard title="Unit Availability Calendar">
                      <UnitAvailabilityCalendar calendarData={calendarData} loading={calendarLoading} />
                    </MainCard>
                  </Grid>
                </Grid>
              ) : (
                <Alert severity="info" sx={{ m: 2 }}>
                  No occupancy data available. Select a property to view occupancy insights.
                </Alert>
              )}
            </TabPanel>

            {/* Listings Tab */}
            <TabPanel value={tabValue} index={2} slideDirection={slideDirection}>
              <Box sx={{ py: 4 }}>
                <ComingSoon />
              </Box>
            </TabPanel>
          </Box>
        </Grid>
      </Grid>
    </>
  );
}
