import { useMemo, useState } from 'react';
import { alpha, Box, Button, Stack, Typography, useTheme } from '@mui/material';
import MainCard from 'components/MainCard';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { useSelector } from 'react-redux';
import { selectAllPayments } from 'store/payment/payment.selector';
import { selectExpenses } from 'store/expense/expense.selector';
import { format, subMonths, startOfMonth, endOfMonth, parseISO, isWithinInterval } from 'date-fns';

const RANGES = [
  { label: '6M', title: '6 MONTHS', months: 6 },
  { label: '1Y', title: '1 YEAR', months: 12 },
  { label: 'All', title: 'ALL TIME', months: null }
];

function formatAmount(val) {
  const abs = Math.abs(val);
  if (abs >= 1000) return `$${(abs / 1000).toFixed(1)}k`;
  return `$${abs.toLocaleString()}`;
}

function CustomTooltip({ active, payload, label }) {
  const theme = useTheme();
  if (!active || !payload?.length) return null;
  const income = payload.find((p) => p.dataKey === 'income')?.value || 0;
  const expenses = payload.find((p) => p.dataKey === 'expenses')?.value || 0;
  const net = income - expenses;
  return (
    <Box
      sx={{
        bgcolor: 'background.paper',
        p: 1.5,
        border: '1px solid',
        borderColor: 'divider',
        borderRadius: 1.5,
        boxShadow: 3,
        minWidth: 140
      }}
    >
      <Typography variant="caption" fontWeight={700} sx={{ display: 'block', mb: 0.75, color: 'text.secondary' }}>
        {label}
      </Typography>
      <Typography variant="caption" sx={{ display: 'block', color: theme.palette.primary.main, mb: 0.25 }}>
        Income: ${income.toLocaleString()}
      </Typography>
      <Typography variant="caption" sx={{ display: 'block', color: theme.palette.error.main, mb: 0.25 }}>
        Expenses: ${expenses.toLocaleString()}
      </Typography>
      <Typography
        variant="caption"
        fontWeight={700}
        sx={{ display: 'block', color: net >= 0 ? theme.palette.success.main : theme.palette.error.main }}
      >
        Net: ${Math.abs(net).toLocaleString()}
      </Typography>
    </Box>
  );
}

export default function CashFlowChart() {
  const theme = useTheme();
  const [rangeIdx, setRangeIdx] = useState(0);
  const range = RANGES[rangeIdx];

  const allPayments = useSelector(selectAllPayments);
  const expenses = useSelector(selectExpenses);

  const { chartData, netTotal, incomeTotal, expensesTotal, pctChange } = useMemo(() => {
    const now = new Date();
    const monthCount = range.months;

    function buildBuckets(offsetMonths, count) {
      const buckets = [];
      for (let i = count - 1; i >= 0; i--) {
        const d = subMonths(now, i + offsetMonths);
        buckets.push({
          key: format(d, 'yyyy-MM'),
          label: format(d, 'MMM').toUpperCase(),
          start: startOfMonth(d),
          end: endOfMonth(d),
          income: 0,
          expenses: 0
        });
      }
      return buckets;
    }

    let buckets = [];
    let prevBuckets = [];

    if (monthCount) {
      buckets = buildBuckets(0, monthCount);
      prevBuckets = buildBuckets(monthCount, monthCount);
    } else {
      const allDates = [
        ...(allPayments || []).map((p) => p.paymentDate || p.PaymentDate),
        ...(expenses || []).map((e) => e.date || e.Date || e.expenseDate || e.ExpenseDate)
      ]
        .filter(Boolean)
        .map((d) => new Date(d));
      const earliest = allDates.length ? new Date(Math.min(...allDates)) : subMonths(now, 11);
      let cursor = startOfMonth(earliest);
      while (cursor <= now) {
        buckets.push({
          key: format(cursor, 'yyyy-MM'),
          label: format(cursor, 'MMM yy').toUpperCase(),
          start: startOfMonth(cursor),
          end: endOfMonth(cursor),
          income: 0,
          expenses: 0
        });
        cursor = subMonths(cursor, -1);
      }
    }

    const EXCLUDED_STATUSES = new Set(['failed', 'refunded', 'cancelled']);

    function fillBuckets(bkts) {
      (allPayments || []).forEach((p) => {
        const status = (p.status || p.Status || '').toLowerCase();
        if (EXCLUDED_STATUSES.has(status)) return;
        const raw = p.paymentDate || p.PaymentDate;
        if (!raw) return;
        const d = typeof raw === 'string' ? parseISO(raw) : new Date(raw);
        const bucket = bkts.find((b) => isWithinInterval(d, { start: b.start, end: b.end }));
        if (bucket) bucket.income += typeof p.amount === 'number' ? p.amount : parseFloat(p.amount) || 0;
      });
      (expenses || []).forEach((e) => {
        const raw = e.date || e.Date || e.expenseDate || e.ExpenseDate;
        if (!raw) return;
        const d = typeof raw === 'string' ? parseISO(raw) : new Date(raw);
        const bucket = bkts.find((b) => isWithinInterval(d, { start: b.start, end: b.end }));
        if (bucket) bucket.expenses += typeof e.amount === 'number' ? e.amount : parseFloat(e.amount) || 0;
      });
    }

    fillBuckets(buckets);
    if (prevBuckets.length) fillBuckets(prevBuckets);

    const net = buckets.reduce((acc, b) => acc + b.income - b.expenses, 0);
    const income = buckets.reduce((acc, b) => acc + b.income, 0);
    const exp = buckets.reduce((acc, b) => acc + b.expenses, 0);

    let pctChange = null;
    if (prevBuckets.length) {
      const prevIncome = prevBuckets.reduce((acc, b) => acc + b.income, 0);
      const prevNet = prevBuckets.reduce((acc, b) => acc + b.income - b.expenses, 0);
      if (prevNet !== 0) {
        pctChange = ((net - prevNet) / Math.abs(prevNet)) * 100;
      } else if (prevIncome > 0) {
        pctChange = ((income - prevIncome) / prevIncome) * 100;
      }
    }
    // Fallback: show net margin (net ÷ income) when no prior-period data exists
    if (pctChange === null && income > 0) {
      pctChange = (net / income) * 100;
    }

    return {
      chartData: buckets.map((b) => ({ label: b.label, income: Math.round(b.income), expenses: Math.round(b.expenses) })),
      netTotal: Math.round(net),
      incomeTotal: Math.round(income),
      expensesTotal: Math.round(exp),
      pctChange
    };
  }, [allPayments, expenses, range]);

  const INCOME_COLOR = theme.palette.primary.main;
  const EXPENSE_COLOR = theme.palette.error.main;

  return (
    <MainCard
      title={
        <Typography variant="overline" fontWeight={700} sx={{ fontSize: '0.875rem', letterSpacing: 1, color: (t) => t.palette.mode === 'dark' ? t.palette.text.secondary : 'rgba(0,0,0,0.48)' }}>
          CASH FLOW · {range.title}
        </Typography>
      }
      secondary={
        <Box
          sx={{
            display: 'flex',
            border: `1px solid ${theme.palette.primary.main}`,
            borderRadius: 1.5,
            overflow: 'hidden',
            bgcolor: theme.palette.grey[200]
          }}
        >
          {RANGES.map((r, i) => (
            <Box
              key={r.label}
              onClick={() => setRangeIdx(i)}
              sx={{
                px: 1.5,
                py: 0.4,
                fontSize: '0.7rem',
                fontWeight: 600,
                cursor: 'pointer',
                userSelect: 'none',
                bgcolor: i === rangeIdx ? 'primary.main' : 'transparent',
                color: i === rangeIdx ? 'background.paper' : 'text.secondary',
                transition: 'background-color 0.15s ease, color 0.15s ease',
                borderRadius: 0,
                borderRight: i < RANGES.length - 1 ? `1px solid ${theme.palette.primary.main}` : 'none',
                '&:hover': i !== rangeIdx ? { bgcolor: alpha(theme.palette.grey[400], 0.5) } : {}
              }}
            >
              {r.label}
            </Box>
          ))}
        </Box>
      }
      contentSX={{ pt: 1 }}
      sx={{ height: '100%', '& .MuiCardHeader-root': { pb: 1 } }}
    >
      {/* Net total row */}
      <Stack direction="row" alignItems="center" spacing={1} sx={{ mb: 0.25 }}>
        <Typography variant="h5" fontWeight={700}>
          ${Math.abs(netTotal).toLocaleString()}
          <Typography component="span" variant="body2" color="text.secondary" fontWeight={400} sx={{ ml: 0.75 }}>
            net
          </Typography>
        </Typography>
        {pctChange !== null && (
          <Box
            sx={{
              display: 'inline-flex',
              alignItems: 'center',
              px: 0.75,
              py: 0.2,
              bgcolor: pctChange >= 0 ? alpha(theme.palette.success.main, 0.12) : alpha(theme.palette.error.main, 0.12),
              color: pctChange >= 0 ? theme.palette.success.main : theme.palette.error.main,
              fontSize: '0.7rem',
              fontWeight: 700,
              gap: 0.3
            }}
          >
            {pctChange >= 0 ? '▲' : '▼'} {Math.abs(pctChange).toFixed(1)}%
          </Box>
        )}
      </Stack>

      {/* Chart */}
      <Box sx={{ height: 200, mt: 1.5 }}>
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={chartData} margin={{ top: 4, right: 4, left: -28, bottom: 0 }} barGap={3} barCategoryGap="30%">
            <CartesianGrid strokeDasharray="3 3" stroke={alpha(theme.palette.divider, 0.4)} vertical={false} />
            <XAxis dataKey="label" tick={{ fill: theme.palette.text.secondary, fontSize: 11 }} axisLine={false} tickLine={false} />
            <YAxis
              tick={{ fill: theme.palette.text.secondary, fontSize: 10 }}
              axisLine={false}
              tickLine={false}
              tickFormatter={(v) => (v >= 1000 ? `${(v / 1000).toFixed(0)}k` : v)}
            />
            <Tooltip content={<CustomTooltip />} cursor={{ fill: alpha(theme.palette.primary.main, 0.04) }} />
            <Bar dataKey="income" fill={INCOME_COLOR} radius={[3, 3, 0, 0]} name="Income" />
            <Bar dataKey="expenses" fill={EXPENSE_COLOR} radius={[3, 3, 0, 0]} name="Expenses" />
          </BarChart>
        </ResponsiveContainer>
      </Box>

      {/* Legend with totals */}
      <Stack direction="row" spacing={2.5} sx={{ mt: 1 }}>
        <Stack direction="row" alignItems="center" spacing={0.75}>
          <Box sx={{ width: 10, height: 10, borderRadius: '50%', bgcolor: INCOME_COLOR }} />
          <Typography variant="caption" color="text.secondary" fontWeight={500}>
            Income {formatAmount(incomeTotal)}
          </Typography>
        </Stack>
        <Stack direction="row" alignItems="center" spacing={0.75}>
          <Box sx={{ width: 10, height: 10, borderRadius: '50%', bgcolor: EXPENSE_COLOR }} />
          <Typography variant="caption" color="text.secondary" fontWeight={500}>
            Expenses {formatAmount(expensesTotal)}
          </Typography>
        </Stack>
      </Stack>
    </MainCard>
  );
}
