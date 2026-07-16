import { useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { alpha, Box, Button, Divider, LinearProgress, Stack, Typography, useTheme } from '@mui/material';
import { ArrowRightOutlined } from '@ant-design/icons';
import MainCard from 'components/MainCard';
import { formatCurrency } from 'utils/formatters';

function StatTile({ label, value, valueColor }) {
  return (
    <Box sx={{ flex: 1, minWidth: 0 }}>
      <Typography
        variant="h5"
        fontWeight={700}
        sx={{ color: valueColor || 'text.primary', lineHeight: 1.2, mb: 0.4, fontSize: { xs: '1rem', sm: '1.15rem' } }}
      >
        {value}
      </Typography>
      <Typography variant="caption" color="text.secondary" sx={{ fontSize: '0.72rem', fontWeight: 500 }}>
        {label}
      </Typography>
    </Box>
  );
}

export default function MoneySummary({ summary = {}, lifetimeSummary = {}, totalExpenses = 0, allPayments = [] }) {
  const theme = useTheme();
  const navigate = useNavigate();
  const [period, setPeriod] = useState('this-month');

  // All-time collected is computed directly from allPayments — reliable regardless of API field names
  const allTimeCollected = useMemo(
    () => (allPayments || []).reduce((sum, p) => sum + (parseFloat(p.amount ?? p.Amount) || 0), 0),
    [allPayments]
  );

  const isAllTime = period === 'all-time';

  // Current outstanding balance applies to both views
  const currentOutstanding = Math.max(0, summary?.outstanding ?? ((summary?.expectedThisMonth || 0) - (summary?.collectedThisMonth || 0)));

  // All-time expected = everything collected so far + what's still owed
  const allTimeExpected = allTimeCollected + currentOutstanding;

  const rentExpected  = isAllTime ? allTimeExpected                    : (summary?.expectedThisMonth  || 0);
  const rentCollected = isAllTime ? allTimeCollected                   : (summary?.collectedThisMonth || 0);
  const outstanding   = isAllTime ? currentOutstanding                 : Math.max(0, (summary?.expectedThisMonth || 0) - (summary?.collectedThisMonth || 0));
  const expenses      = totalExpenses || 0;
  const net           = rentCollected - expenses;
  const netColor      = net >= 0 ? theme.palette.success.main : theme.palette.error.main;
  const collectionPct = rentExpected > 0 ? Math.min(100, (rentCollected / rentExpected) * 100) : 0;
  const collectionProgressColor = '#061e35';

  const toggle = (
    <Box
      sx={{
        display: 'flex',
        border: `1px solid ${theme.palette.divider}`,
        borderRadius: 1.5,
        overflow: 'hidden',
        flexShrink: 0,
        whiteSpace: 'nowrap'
      }}
    >
      {[
        { key: 'this-month', label: 'This month' },
        { key: 'all-time',   label: 'All time' }
      ].map(({ key, label }) => (
        <Box
          key={key}
          onClick={() => setPeriod(key)}
          sx={{
            px: 1.25,
            py: 0.5,
            cursor: 'pointer',
            bgcolor: period === key ? collectionProgressColor : 'transparent',
            color: period === key ? '#fff' : 'text.secondary',
            fontWeight: 600,
            fontSize: '0.7rem',
            lineHeight: 1.6,
            transition: 'all 0.15s',
            '&:hover': {
              bgcolor: period === key ? collectionProgressColor : alpha(collectionProgressColor, 0.08)
            }
          }}
        >
          {label}
        </Box>
      ))}
    </Box>
  );

  return (
    <MainCard
      accentColor={theme.palette.success.main}
      accentShadow
      title={
        <Stack direction="row" alignItems="center" spacing={1.5} sx={{ minWidth: 0, flexWrap: 'nowrap' }}>
          <Typography variant="h5" fontWeight={700} sx={{ lineHeight: 1.2, color: 'text.primary', whiteSpace: 'nowrap' }}>
            Money Summary
          </Typography>
          {toggle}
        </Stack>
      }
      secondary={
        <Button
          size="small"
          variant="text"
          endIcon={<ArrowRightOutlined style={{ fontSize: 12 }} />}
          onClick={() => navigate('/landlord/money-activity')}
          sx={{
            display: { xs: 'none', sm: 'inline-flex' },
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
      contentSX={{ pt: 2, display: 'flex', flexDirection: 'column', height: 'calc(100% - 72px)' }}
      sx={{
        height: '100%',
        '& .MuiCardHeader-root': { pb: 1, flexWrap: 'nowrap', alignItems: 'center' },
        '& .MuiCardHeader-content': { minWidth: 0, flex: '1 1 auto' },
        '& .MuiCardHeader-action': { display: { xs: 'none', sm: 'flex' }, flexShrink: 0, alignSelf: 'center' }
      }}
    >
      {/* Stat row */}
      <Stack
        direction="row"
        spacing={2}
        divider={<Box sx={{ width: '1px', bgcolor: (t) => alpha(t.palette.divider, 0.3), alignSelf: 'stretch' }} />}
      >
        <StatTile label="Rent Expected"  value={formatCurrency(rentExpected)} valueColor={theme.palette.success.main} />
        <StatTile label="Rent Collected" value={formatCurrency(rentCollected)} valueColor={theme.palette.success.main} />
        <StatTile label="Outstanding"    value={formatCurrency(outstanding)}   valueColor={collectionProgressColor} />
        <StatTile label="Expenses"       value={formatCurrency(expenses)}       valueColor={collectionProgressColor} />
      </Stack>

      <Box sx={{ flex: 1 }} />

      {/* Collection progress bar */}
      <Box sx={{ mb: 1.5 }}>
        <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 0.75 }}>
          <Typography variant="caption" color="text.secondary" sx={{ fontWeight: 500 }}>
            Collection progress
          </Typography>
          <Typography variant="caption" fontWeight={700} sx={{ color: collectionPct >= 100 ? theme.palette.success.main : collectionProgressColor }}>
            {collectionPct.toFixed(0)}%
          </Typography>
        </Stack>
        <LinearProgress
          variant="determinate"
          value={collectionPct}
          sx={{
            height: 6,
            borderRadius: 3,
            bgcolor: alpha(theme.palette.success.main, 0.12),
            '& .MuiLinearProgress-bar': {
              borderRadius: 3,
              bgcolor: theme.palette.success.main
            }
          }}
        />
      </Box>

      {/* Net row */}
      <Divider sx={{ mb: 1.5 }} />
      <Stack direction="row" alignItems="center" spacing={1}>
        <Typography variant="body2" color="text.secondary" sx={{ fontWeight: 500 }}>
          {isAllTime ? 'Net all time:' : 'Net this month:'}
        </Typography>
        <Typography variant="body2" fontWeight={700} sx={{ color: netColor, fontSize: '0.95rem' }}>
          {formatCurrency(net)}
        </Typography>
      </Stack>
    </MainCard>
  );
}
