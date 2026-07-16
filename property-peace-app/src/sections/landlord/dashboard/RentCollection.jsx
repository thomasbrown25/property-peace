import { useState } from 'react';
import { alpha, Box, Button, Grid, Stack, Typography, useTheme } from '@mui/material';
import MainCard from 'components/MainCard';
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip, Label } from 'recharts';
import CircularLoader from 'components/CircularLoader';
import { formatCurrency } from 'utils/formatters';

const COLORS = ['#52c41a', '#1890ff', '#f5222d'];

// Custom tooltip for pie chart
const CustomTooltip = ({ active, payload }) => {
  if (active && payload && payload.length) {
    const { name, value, percent } = payload[0];
    return (
      <Box
        sx={{
          bgcolor: 'background.paper',
          p: 1,
          border: '1px solid',
          borderColor: 'divider',
          borderRadius: 1
        }}
      >
        <Typography variant="body2" fontWeight="bold">
          {name}
        </Typography>
        <Typography variant="body2">
          {percent && (percent * 100).toFixed(1)}% — ${value.toLocaleString()}
        </Typography>
      </Box>
    );
  }
  return null;
};

export default function RentCollection({ summary, loading }) {
  const { remainingThisMonth = 0, expectedThisMonth = 0, collectedThisMonth = 0, overdue = 0 } = summary || {};

  const theme = useTheme();
  const [view, setView] = useState('monthly');

  // Use the same values as OverviewCards - directly from summary
  // remainingThisMonth already excludes overdue leases (calculated in backend)
  const remaining = remainingThisMonth;
  const collected = collectedThisMonth;
  const overdueAmount = overdue;

  // Calculate collection percentage based on expected this month
  const collectedPercent = expectedThisMonth ? Math.min(100, Math.round((collected / expectedThisMonth) * 100)) : 0;

  const chartData = [
    { name: 'Collected', value: collected },
    { name: 'Remaining', value: remaining },
    ...(overdueAmount > 0 ? [{ name: 'Overdue', value: overdueAmount }] : [])
  ].filter(item => item.value > 0); // Filter out zero values to prevent gaps

  return (
    <MainCard
      title="Rent Collection"
      className="rent-collection-chart"
      sx={{
        bgcolor: (t) => alpha(t.palette.background.paper, 0.6),
        boxShadow: (t) => `0 0 20px ${alpha(t.palette.primary.main, 0.15)}`
      }}
      secondary={
        <Grid container alignItems="center" justifyContent="space-between">
          <Grid>
            <Stack direction="row" sx={{ alignItems: 'center' }}>
              <Button
                size="small"
                onClick={() => setView('monthly')}
                color={view === 'monthly' ? 'primary' : 'secondary'}
                variant={view === 'monthly' ? 'outlined' : 'text'}
              >
                This Month
              </Button>
              {/* <Button
                size="small"
                onClick={() => setView('weekly')}
                color={view === 'weekly' ? 'primary' : 'secondary'}
                variant={view === 'weekly' ? 'outlined' : 'text'}
              >
                6 Months
              </Button> */}
            </Stack>
          </Grid>
        </Grid>
      }
    >
      {loading ? (
        <Box sx={{ height: 250, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <CircularLoader />
        </Box>
      ) : chartData.every((data) => data.value === 0) ? (
        <Box sx={{ height: 250, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <Typography variant="h6" color="textSecondary">
            Nothing to show here. Add a lease to see rent collection status.
          </Typography>
        </Box>
      ) : (
        <Box sx={{ pt: 2, pr: 2, height: 250 }}>
          <ResponsiveContainer>
            <PieChart>
              <Pie
                data={chartData}
                cx="50%"
                cy="50%"
                innerRadius={60}
                outerRadius={90}
                paddingAngle={0}
                dataKey="value"
                isAnimationActive={true}
                startAngle={90}
                endAngle={-270}
              >
                {chartData.map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                ))}
                {/* Center Label with Typography */}
                <Label
                  position="center"
                  content={({ viewBox }) => {
                    const { cx, cy } = viewBox;
                    return (
                      <foreignObject x={'46%'} y={'45%'} width={60} height={60}>
                        <Typography variant="h3" align="center" sx={{ color: theme.palette.text.primary, fontWeight: 'bold' }}>
                          {collectedPercent}%
                        </Typography>
                      </foreignObject>
                    );
                  }}
                />
              </Pie>
              <Tooltip content={<CustomTooltip />} />
            </PieChart>
          </ResponsiveContainer>
        </Box>
      )}

      {/* Totals below chart */}
      <Stack direction="row" justifyContent="space-between" sx={{ px: 2, pb: 1 }} spacing={2}>
        <Typography variant="h6" fontWeight="bold" color="success.main">
          Collected: {formatCurrency(collected)}
        </Typography>
        <Typography variant="h6" fontWeight="bold" color="primary.main">
          Remaining: {formatCurrency(remaining)}
        </Typography>
        {overdueAmount > 0 && (
          <Typography variant="h6" fontWeight="bold" color="error.main">
            Overdue: {formatCurrency(overdueAmount)}
          </Typography>
        )}
      </Stack>
    </MainCard>
  );
}
