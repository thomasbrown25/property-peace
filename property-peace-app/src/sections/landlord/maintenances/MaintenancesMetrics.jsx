import { Grid, Stack, Typography, Box, Card, CardContent, alpha, useTheme } from '@mui/material';
import { ToolOutlined, WarningOutlined, CheckCircleOutlined, ClockCircleOutlined } from '@ant-design/icons';

const MetricCard = ({ icon: IconComponent, label, value, iconColor, onClick, isActive }) => {
  const theme = useTheme();
  return (
    <Card
      variant="outlined"
      onClick={onClick}
      sx={{
        bgcolor: (t) => isActive ? alpha(t.palette.primary.main, 0.07) : alpha(t.palette.background.paper, 0.6),
        boxShadow: (t) => `0 0 20px ${alpha(t.palette.primary.main, 0.15)}`,
        border: (t) => isActive ? `2px solid ${t.palette.primary.main}` : undefined,
        cursor: 'pointer',
        transition: 'all 0.15s ease',
        '&:hover': {
          boxShadow: (t) => `0 0 24px ${alpha(t.palette.primary.main, 0.25)}`
        }
      }}
    >
      <CardContent>
        <Stack direction="row" spacing={1} alignItems="center">
          <IconComponent style={{ fontSize: 24, color: isActive ? theme.palette.primary.main : iconColor }} />
          <Box>
            <Typography variant="body2" color="text.secondary" sx={{ fontFamily: "'Poppins', sans-serif", fontWeight: 'bold' }}>
              {label}
            </Typography>
            <Typography variant="h5" sx={{ fontFamily: "'Poppins', sans-serif", fontWeight: 'bold' }}>
              {value}
            </Typography>
          </Box>
        </Stack>
      </CardContent>
    </Card>
  );
};

export default function MaintenancesMetrics({ currentRequests, historyRequests, activeFilter, onFilterChange }) {
  const openRequests = currentRequests?.filter((r) => r.status?.toLowerCase() === 'open').length || 0;
  const inProgressRequests = currentRequests?.filter((r) => {
    const s = r.status?.toLowerCase();
    return s === 'in-progress' || s === 'inprogress' || s === 'in progress';
  }).length || 0;
  const resolvedRequests = (historyRequests?.filter((r) => {
    const s = r.status?.toLowerCase();
    return s === 'completed' || s === 'resolved' || s === 'cancelled';
  }).length || 0);
  const totalRequests = (currentRequests?.length || 0) + (historyRequests?.length || 0);

  const handleClick = (key) => {
    onFilterChange(activeFilter === key ? null : key);
  };

  return (
    <Grid container spacing={2} sx={{ mb: 3 }}>
      <Grid size={{ xs: 12, sm: 6, md: 3 }}>
        <MetricCard icon={ToolOutlined} label="Total Requests" value={totalRequests} iconColor="#1877F2"
          onClick={() => handleClick('total')} isActive={activeFilter === 'total'} />
      </Grid>
      <Grid size={{ xs: 12, sm: 6, md: 3 }}>
        <MetricCard icon={WarningOutlined} label="Not Started" value={openRequests} iconColor="#d32f2f"
          onClick={() => handleClick('open')} isActive={activeFilter === 'open'} />
      </Grid>
      <Grid size={{ xs: 12, sm: 6, md: 3 }}>
        <MetricCard icon={ClockCircleOutlined} label="In Progress" value={inProgressRequests} iconColor="#0288d1"
          onClick={() => handleClick('in-progress')} isActive={activeFilter === 'in-progress'} />
      </Grid>
      <Grid size={{ xs: 12, sm: 6, md: 3 }}>
        <MetricCard icon={CheckCircleOutlined} label="Resolved" value={resolvedRequests} iconColor="#2e7d32"
          onClick={() => handleClick('resolved')} isActive={activeFilter === 'resolved'} />
      </Grid>
    </Grid>
  );
}
