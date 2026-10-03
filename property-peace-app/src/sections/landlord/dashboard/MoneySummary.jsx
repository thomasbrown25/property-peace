import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { alpha, Box, Button, LinearProgress, MenuItem, Select, Stack, Tooltip as MuiTooltip, Typography, useTheme } from '@mui/material';
import { ArrowRightOutlined } from '@ant-design/icons';
import { Bar, BarChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import MainCard from 'components/MainCard';
import { formatCurrency } from 'utils/formatters';
import {
  buildCurrentMonthMoneySeries,
  normalizeRentCollectionMetrics,
  summarizeCurrentMonthRentIncome
} from 'utils/rentCollectionMetrics';

function MoneyChartTooltip({ active, payload, label }) {
  if (!active || !payload?.length) return null;

  return (
    <Box
      sx={{
        minWidth: 150,
        p: 1.5,
        border: '1px solid',
        borderColor: 'divider',
        borderRadius: 1.5,
        bgcolor: 'background.paper',
        boxShadow: 3
      }}
    >
      <Typography variant="caption" color="text.secondary" fontWeight={700} sx={{ display: 'block', mb: 0.75 }}>
        {label}
      </Typography>
      {payload.map((item) => (
        <Stack key={item.dataKey} direction="row" justifyContent="space-between" spacing={2} sx={{ mt: 0.35 }}>
          <Typography variant="caption" sx={{ color: item.color, fontWeight: 600 }}>
            {item.name}
          </Typography>
          <Typography variant="caption" color="text.primary" fontWeight={700}>
            {formatCurrency(item.value || 0)}
          </Typography>
        </Stack>
      ))}
    </Box>
  );
}

function MetricCard({ label, description, value, accentColor, textColor, icon }) {
  const theme = useTheme();

  return (
    <Box
      sx={{
        flex: 1,
        minWidth: 0,
        minHeight: { xs: 128, sm: 0 },
        px: { xs: 2, sm: 1.75 },
        py: 2,
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'center',
        border: `1px solid ${theme.palette.mode === 'dark' ? alpha('#dbe7f3', 0.2) : alpha(theme.palette.divider, 0.8)}`,
        borderRadius: 2.25,
        bgcolor: 'background.paper',
        backgroundImage:
          theme.palette.mode === 'dark'
            ? `linear-gradient(180deg, ${alpha('#ffffff', 0.045)} 0%, ${alpha(accentColor, 0.025)} 100%)`
            : 'none',
        boxShadow:
          theme.palette.mode === 'dark'
            ? `0 16px 38px ${alpha(theme.palette.common.black, 0.24)}, 0 0 24px ${alpha(accentColor, 0.1)}`
            : `0 14px 36px ${alpha(theme.palette.common.black, 0.06)}`
      }}
    >
      <Stack direction="row" alignItems="center" spacing={1.5} sx={{ minWidth: 0 }}>
        <Box
          aria-hidden="true"
          sx={{
            width: 44,
            height: 44,
            borderRadius: 1.5,
            flexShrink: 0,
            display: 'grid',
            placeItems: 'center',
            color: accentColor,
            bgcolor: alpha(accentColor, theme.palette.mode === 'dark' ? 0.18 : 0.1),
            '& svg': { width: 25, height: 25 }
          }}
        >
          {icon}
        </Box>
        <Box sx={{ minWidth: 0 }}>
          <Typography variant="body2" fontWeight={700} sx={{ color: textColor, lineHeight: 1.25 }}>
            {label}
          </Typography>
          <Typography variant="caption" color="text.secondary" sx={{ display: 'block', lineHeight: 1.35, mt: 0.35 }}>
            {description}
          </Typography>
        </Box>
      </Stack>
      <Typography variant="h4" fontWeight={700} sx={{ ml: 7, mt: 1, color: textColor, lineHeight: 1.15, fontSize: { xs: '1.5rem', sm: '1.55rem' } }}>
        {value}
      </Typography>
    </Box>
  );
}

function CollectionProgressCard({ collectionPct, collectedRent, expectedRent, incomeColor, textColor }) {
  const theme = useTheme();

  return (
    <MuiTooltip
      title="This shows collection progress for the current month's rent only. Past-due rent from earlier months does not affect this metric."
      placement="top"
      arrow
      describeChild
    >
      <Box
        tabIndex={0}
        sx={{
          width: '100%',
          height: '100%',
          px: { xs: 2, sm: 2.5 },
          py: 2.25,
          border: `1px solid ${theme.palette.mode === 'dark' ? alpha('#dbe7f3', 0.2) : alpha(theme.palette.divider, 0.8)}`,
          borderRadius: 2.25,
          bgcolor: 'background.paper',
          backgroundImage:
            theme.palette.mode === 'dark'
              ? `linear-gradient(180deg, ${alpha('#ffffff', 0.045)} 0%, ${alpha(incomeColor, 0.025)} 100%)`
              : 'none',
          boxShadow:
            theme.palette.mode === 'dark'
              ? `0 16px 38px ${alpha(theme.palette.common.black, 0.24)}, 0 0 24px ${alpha(incomeColor, 0.1)}`
              : `0 14px 36px ${alpha(theme.palette.common.black, 0.06)}`,
          cursor: 'help',
          '&:focus-visible': {
            outline: `2px solid ${theme.palette.primary.main}`,
            outlineOffset: 2
          }
        }}
      >
        <Stack direction={{ xs: 'column', sm: 'row' }} justifyContent="space-between" alignItems={{ xs: 'flex-start', sm: 'center' }} spacing={1} sx={{ mb: 1.5 }}>
          <Typography variant="h5" fontWeight={700} sx={{ color: textColor }}>
            Rent Collection
          </Typography>
          <Typography variant="body2" sx={{ color: textColor, textAlign: { xs: 'left', sm: 'right' } }}>
            Collected <Box component="span" sx={{ color: incomeColor, fontWeight: 700 }}>{formatCurrency(collectedRent)}</Box> of {formatCurrency(expectedRent)}
          </Typography>
        </Stack>

        <Stack direction="row" alignItems="center" spacing={1.5}>
          <LinearProgress
            variant="determinate"
            value={collectionPct}
            aria-label="Rent collection progress"
            sx={{
              flex: 1,
              height: 8,
              borderRadius: 4,
              bgcolor: alpha(theme.palette.text.secondary, 0.15),
              '& .MuiLinearProgress-bar': { borderRadius: 4, bgcolor: incomeColor }
            }}
          />
          <Typography variant="body2" color="text.secondary" sx={{ flexShrink: 0, minWidth: 36, textAlign: 'right' }}>
            {collectionPct.toFixed(0)}%
          </Typography>
        </Stack>
      </Box>
    </MuiTooltip>
  );
}

export function RentCollectionProgress({ summary = {} }) {
  const theme = useTheme();
  const { collectionPct, income, expectedRent } = normalizeRentCollectionMetrics(summary);
  const incomeColor = theme.palette.success.main;
  const textColor = theme.palette.mode === 'dark' ? theme.palette.common.white : '#061e35';

  return (
    <CollectionProgressCard
      collectionPct={collectionPct}
      collectedRent={income}
      expectedRent={expectedRent}
      incomeColor={incomeColor}
      textColor={textColor}
    />
  );
}

export default function MoneySummary({
  summary = {},
  lifetimeSummary = {},
  totalExpenses = 0,
  allPayments = [],
  expenses: expenseItems = []
}) {
  const theme = useTheme();
  const navigate = useNavigate();
  const [period, setPeriod] = useState('this-month');

  const allTimeCollected = useMemo(
    () =>
      Number(lifetimeSummary?.collectedLifetime) ||
      (allPayments || []).reduce((sum, payment) => sum + (Number(payment.amount ?? payment.Amount) || 0), 0),
    [allPayments, lifetimeSummary?.collectedLifetime]
  );
  const isAllTime = period === 'all-time';
  const monthlyMetrics = normalizeRentCollectionMetrics(summary);
  const paymentHistoryIncome = useMemo(() => summarizeCurrentMonthRentIncome(allPayments), [allPayments]);
  const income = isAllTime ? allTimeCollected : Math.max(monthlyMetrics.income, paymentHistoryIncome);
  const expenses = Number(totalExpenses || 0);
  const incomeColor = theme.palette.success.main;
  const expenseColor = theme.palette.error.main;
  const navy = theme.palette.mode === 'dark' ? theme.palette.primary.light : '#061e35';
  const summaryTextColor = theme.palette.mode === 'dark' ? theme.palette.common.white : '#061e35';
  const dailyChartData = useMemo(
    () => buildCurrentMonthMoneySeries({ payments: allPayments, expenses: expenseItems }),
    [allPayments, expenseItems]
  );
  const chartData = isAllTime ? [{ label: 'All time', income, expenses }] : dailyChartData;
  const metricCards = [
    {
      label: 'Income',
      description: 'Total rent collected',
      value: income,
      color: incomeColor,
      icon: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M4 19v-3m5 3v-6m5 6v-9m5 9V5" /><path d="m4 12 5-3 5 1 5-6" /></svg>
    },
    {
      label: 'Expenses',
      description: 'Total property expenses',
      value: expenses,
      color: expenseColor,
      icon: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M5 3h14v18l-3.5-2-3.5 2-3.5-2L5 21V3Z" /><path d="M9 8h6M9 12h5" /></svg>
    }
  ];

  return (
    <Box
      sx={{
        display: 'grid',
        width: '100%',
        height: '100%',
        gridTemplateColumns: { xs: 'minmax(0, 1fr)', sm: 'minmax(0, 2.8fr) minmax(150px, 1fr)' },
        gap: 2.5,
        alignItems: 'stretch'
      }}
    >
      <MainCard
        accentColor={incomeColor}
        accentShadow
        title={
          <Stack direction="row" alignItems="center" spacing={1.25} sx={{ minWidth: 0 }}>
            <Typography variant="h5" fontWeight={700} sx={{ color: 'text.primary', whiteSpace: 'nowrap' }}>
              Money Summary
            </Typography>
            <Select
              value={period}
              onChange={(event) => setPeriod(event.target.value)}
              inputProps={{ 'aria-label': 'Money summary period' }}
              size="small"
              sx={{
                minWidth: 108,
                height: 28,
                borderRadius: 1.25,
                color: 'text.secondary',
                fontSize: '0.7rem',
                fontWeight: 600,
                '& .MuiSelect-select': { py: 0.35, pl: 1.1, pr: '28px !important' },
                '& .MuiOutlinedInput-notchedOutline': { borderColor: 'divider' }
              }}
            >
              <MenuItem value="this-month">This month</MenuItem>
              <MenuItem value="all-time">All time</MenuItem>
            </Select>
          </Stack>
        }
        secondary={
          <Button
            size="small"
            variant="text"
            endIcon={<ArrowRightOutlined style={{ fontSize: 12 }} />}
            onClick={() => navigate('/landlord/finances?tab=activity')}
            sx={{
              display: { xs: 'none', md: 'inline-flex' },
              textTransform: 'none',
              fontSize: '0.8rem',
              fontWeight: 500,
              color: 'text.secondary',
              whiteSpace: 'nowrap',
              '&:hover': { color: 'text.primary' }
            }}
          >
            View all
          </Button>
        }
        contentSX={{ pt: 1.5, pb: 0, '&:last-child': { pb: 0 }, display: 'flex', flexDirection: 'column' }}
        sx={{
          height: '100%',
          minHeight: { xs: 296, sm: 316 },
          '& .MuiCardHeader-root': { pb: 1, flexWrap: 'nowrap', alignItems: 'center' },
          '& .MuiCardHeader-content': { minWidth: 0, flex: '1 1 auto' },
          '& .MuiCardHeader-action': { flexShrink: 0, alignSelf: 'center' }
        }}
      >
        <Box sx={{ height: { xs: 190, sm: 215 }, minHeight: 0 }}>
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={chartData} margin={{ top: 6, right: 6, left: -8, bottom: isAllTime ? 0 : 2 }} barGap={1} barCategoryGap="24%">
              <XAxis
                dataKey="label"
                axisLine={{ stroke: alpha(navy, 0.72) }}
                tickLine={{ stroke: alpha(navy, 0.72) }}
                interval={isAllTime ? 0 : 3}
                angle={isAllTime ? 0 : 90}
                textAnchor={isAllTime ? 'middle' : 'start'}
                height={isAllTime ? 24 : 48}
                tickMargin={6}
                tick={{ fill: theme.palette.text.secondary, fontSize: 9 }}
              />
              <YAxis
                axisLine={{ stroke: alpha(navy, 0.72) }}
                tickLine={{ stroke: alpha(navy, 0.72) }}
                width={48}
                tick={{ fill: theme.palette.text.secondary, fontSize: 10 }}
                tickFormatter={(value) => (value >= 1000 ? `$${(value / 1000).toFixed(value % 1000 === 0 ? 0 : 1)}k` : `$${value}`)}
              />
              <Tooltip content={<MoneyChartTooltip />} cursor={{ fill: alpha(navy, 0.035) }} />
              <Bar dataKey="income" name="Income" fill={incomeColor} maxBarSize={isAllTime ? 38 : 7} />
              <Bar dataKey="expenses" name="Expenses" fill={expenseColor} maxBarSize={isAllTime ? 38 : 7} />
            </BarChart>
          </ResponsiveContainer>
        </Box>

        <Stack direction="row" spacing={2.5} justifyContent="center" sx={{ mt: 0, mb: 0 }}>
          {[
            { label: 'Income', color: incomeColor },
            { label: 'Expenses', color: expenseColor }
          ].map((item) => (
            <Stack key={item.label} direction="row" alignItems="center" spacing={0.75}>
              <Box sx={{ width: 9, height: 9, borderRadius: 0.75, bgcolor: item.color }} />
              <Typography variant="caption" color="text.secondary" fontWeight={600}>
                {item.label}
              </Typography>
            </Stack>
          ))}
        </Stack>
      </MainCard>

      <Stack direction="column" spacing={2.5} sx={{ minWidth: 0 }}>
        {metricCards.map((metric) => (
          <MetricCard
            key={metric.label}
            label={metric.label}
            description={metric.description}
            value={formatCurrency(metric.value)}
            accentColor={metric.color}
            textColor={summaryTextColor}
            icon={metric.icon}
          />
        ))}
      </Stack>
    </Box>
  );
}
