import { Grid, Stack, Typography, Box, Card, CardContent, alpha } from '@mui/material';
import { FileTextOutlined, ArrowUpOutlined, ArrowDownOutlined, DollarOutlined } from '@ant-design/icons';
import { useMemo } from 'react';
import { formatCurrency } from 'utils/formatters';

const MetricCard = ({ icon: IconComponent, label, value, iconColor }) => {
  return (
    <Card
      variant="outlined"
      sx={{
        bgcolor: (t) => alpha(t.palette.background.paper, 0.6),
        boxShadow: (t) => `0 0 20px ${alpha(t.palette.primary.main, 0.15)}`
      }}
    >
      <CardContent>
        <Stack direction="row" spacing={1} alignItems="center">
          <IconComponent style={{ fontSize: 24, color: iconColor }} />
          <Box>
            <Typography variant="body2" color="text.secondary" sx={{ fontFamily: "'Host Grotesk', sans-serif", fontWeight: 'bold' }}>
              {label}
            </Typography>
            <Typography variant="h5" sx={{ fontFamily: "'Host Grotesk', sans-serif", fontWeight: 'bold' }}>
              {value}
            </Typography>
          </Box>
        </Stack>
      </CardContent>
    </Card>
  );
};

export default function GeneralLedgerMetrics({ entries = [] }) {
  const metrics = useMemo(() => {
    const totalEntries = entries.length;
    
    // Calculate total income (positive amounts)
    const totalIncome = entries
      .filter(entry => entry.amount > 0)
      .reduce((sum, entry) => sum + (entry.amount || 0), 0);
    
    // Calculate total expenses (negative amounts, shown as positive)
    const totalExpenses = Math.abs(entries
      .filter(entry => entry.amount < 0)
      .reduce((sum, entry) => sum + (entry.amount || 0), 0));
    
    // Calculate net balance
    const netBalance = entries.reduce((sum, entry) => sum + (entry.amount || 0), 0);
    
    return {
      totalEntries,
      totalIncome,
      totalExpenses,
      netBalance
    };
  }, [entries]);

  return (
    <Grid container spacing={2} sx={{ mb: 3 }}>
      <Grid size={{ xs: 12, sm: 6, md: 3 }}>
        <MetricCard
          icon={FileTextOutlined}
          label="Total Entries"
          value={metrics.totalEntries}
          iconColor="#1877F2"
        />
      </Grid>
      <Grid size={{ xs: 12, sm: 6, md: 3 }}>
        <MetricCard
          icon={ArrowUpOutlined}
          label="Total Income"
          value={formatCurrency(metrics.totalIncome)}
          iconColor="#2e7d32"
        />
      </Grid>
      <Grid size={{ xs: 12, sm: 6, md: 3 }}>
        <MetricCard
          icon={ArrowDownOutlined}
          label="Total Expenses"
          value={formatCurrency(metrics.totalExpenses)}
          iconColor="#d32f2f"
        />
      </Grid>
      <Grid size={{ xs: 12, sm: 6, md: 3 }}>
        <MetricCard
          icon={DollarOutlined}
          label="Net Balance"
          value={formatCurrency(metrics.netBalance)}
          iconColor={metrics.netBalance >= 0 ? "#0288d1" : "#ed6c02"}
        />
      </Grid>
    </Grid>
  );
}
