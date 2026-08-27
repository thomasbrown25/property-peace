import { ArrowDownward, ArrowUpward, CalendarMonthOutlined, WalletOutlined } from '@mui/icons-material';
import { alpha, Box, Grid, Stack, Typography, useTheme } from '@mui/material';

const money = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' });

function MetricCard({ label, value, available, note, color, icon, onSelect }) {
  const theme = useTheme();
  const displayValue = available ? money.format(value) : 'Unavailable';

  return (
    <Box
      component="button"
      type="button"
      onClick={available ? onSelect : undefined}
      disabled={!available}
      aria-label={`${label}: ${displayValue}. ${note}`}
      sx={{
        width: '100%',
        minHeight: 122,
        p: 2,
        borderRadius: 2.5,
        border: `1px solid ${alpha(theme.palette.divider, 0.18)}`,
        bgcolor: 'background.paper',
        color: 'text.primary',
        textAlign: 'left',
        font: 'inherit',
        cursor: available ? 'pointer' : 'default',
        opacity: available ? 1 : 0.78,
        boxShadow: `0 7px 24px ${alpha(theme.palette.primary.dark, 0.055)}`,
        transition: 'transform 150ms ease, border-color 150ms ease',
        '&:hover': available ? { transform: 'translateY(-2px)', borderColor: alpha(color, 0.45) } : {},
        '&:focus-visible': { outline: `3px solid ${alpha(theme.palette.primary.main, 0.28)}`, outlineOffset: 2 }
      }}
    >
      <Stack direction="row" justifyContent="space-between" alignItems="flex-start" spacing={1.5}>
        <Box minWidth={0}>
          <Typography variant="overline" color="text.secondary" fontWeight={700}>{label}</Typography>
          <Typography variant="h3" sx={{ mt: 0.45, fontWeight: 800 }} noWrap>{displayValue}</Typography>
          <Typography variant="caption" color="text.secondary">{note}</Typography>
        </Box>
        <Box sx={{ p: 1, borderRadius: 1.5, bgcolor: alpha(color, 0.1), color }}>{icon}</Box>
      </Stack>
    </Box>
  );
}

export default function FinancesMetrics({ overview, collectedThisMonth, collectedThisMonthAvailable, onSelectMetric }) {
  const metrics = [
    {
      key: 'income',
      label: 'Income',
      value: overview?.cameIn,
      available: Boolean(overview?.fieldAvailability?.cameIn),
      note: 'Recorded money that came in',
      color: '#2e7d32',
      icon: <ArrowUpward />
    },
    {
      key: 'expenses',
      label: 'Expenses',
      value: overview?.wentOut,
      available: Boolean(overview?.fieldAvailability?.wentOut),
      note: 'Recorded money that went out',
      color: '#d32f2f',
      icon: <ArrowDownward />
    },
    {
      key: 'net-cash-flow',
      label: 'Net cash flow',
      value: overview?.recordedNetCashFlow,
      available: Boolean(overview?.fieldAvailability?.recordedNetCashFlow),
      note: 'Recorded income minus expenses',
      color: '#1976d2',
      icon: <WalletOutlined />
    },
    {
      key: 'collected-this-month',
      label: 'Collected this month',
      value: collectedThisMonth,
      available: collectedThisMonthAvailable,
      note: 'Completed payments in the current month',
      color: '#7b1fa2',
      icon: <CalendarMonthOutlined />
    }
  ];

  return (
    <Grid container spacing={1.5} sx={{ mb: 2.5 }}>
      {metrics.map((metric) => (
        <Grid key={metric.key} size={{ xs: 12, sm: 6, xl: 3 }}>
          <MetricCard {...metric} onSelect={() => onSelectMetric(metric.key)} />
        </Grid>
      ))}
    </Grid>
  );
}
