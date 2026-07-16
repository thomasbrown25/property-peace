import { useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useSelector } from 'react-redux';
import { alpha, Box, Button, Chip, Stack, Typography, useTheme } from '@mui/material';
import MainCard from 'components/MainCard';
import CircularLoader from 'components/CircularLoader';
import useFetchAllPayments from 'hooks/useFetchAllPayments';
import { selectAllPayments, selectAllPaymentsLoadedAt } from 'store/payment/payment.selector';
import { selectExpenses, selectExpenseLoading } from 'store/expense/expense.selector';
import { formatCurrency } from 'utils/formatters';
import moment from 'moment';
import { ArrowRightOutlined, ArrowUpOutlined, ArrowDownOutlined, SwapOutlined } from '@ant-design/icons';

const TYPE_LABELS = {
  rent: 'Rent',
  latefee: 'Late Fee',
  'late fee': 'Late Fee',
  deposit: 'Deposit',
  other: 'Other'
};

const STATUS_CONFIG = {
  completed: { label: 'Paid', color: 'success' },
  paid: { label: 'Paid', color: 'success' },
  pending: { label: 'Pending', color: 'warning' },
  processing: { label: 'Processing', color: 'info' },
  failed: { label: 'Failed', color: 'error' },
  canceled: { label: 'Canceled', color: 'default' },
  cancelled: { label: 'Canceled', color: 'default' },
  disputed: { label: 'Disputed', color: 'error' },
  refunded: { label: 'Refunded', color: 'info' }
};

const hasValue = (value) => value !== null && value !== undefined && value !== '';

function getPaymentTypeLabel(p) {
  const rawType = (p.type || p.Type || p.paymentType || p.PaymentType || '').toLowerCase();
  const depositId = p.depositId ?? p.DepositId;
  const feeId = p.feeId ?? p.FeeId;
  const leaseId = p.leaseId ?? p.LeaseId;

  if (hasValue(depositId)) return 'Deposit';
  if (hasValue(feeId)) return (p.feeName || p.FeeName || '').toLowerCase().includes('late') ? 'Late Fee' : 'Fee';
  if (rawType && rawType !== 'other') return TYPE_LABELS[rawType] || 'Payment';
  if (hasValue(leaseId)) return 'Rent';

  return TYPE_LABELS[rawType] || 'Payment';
}

function buildPaymentItem(p) {
  const typeLabel = getPaymentTypeLabel(p);
  const rawStatus = (p.status || p.Status || 'completed').toLowerCase();
  const statusCfg = STATUS_CONFIG[rawStatus] || STATUS_CONFIG.completed;
  const propertyName = p.propertyName || p.PropertyName || '';
  const unitName = p.unitName || p.UnitName || p.unitNumber || p.UnitNumber || '';
  const title = [propertyName, unitName].filter(Boolean).join(' · ') || 'Payment';
  return {
    id: `pay-${p.id ?? p.Id}`,
    kind: 'income',
    date: p.paymentDate || p.PaymentDate,
    title,
    typeLabel,
    statusLabel: statusCfg.label,
    statusColor: statusCfg.color,
    amount: p.amount ?? p.Amount ?? 0,
    onClick: p.propertyId ? `/landlord/property/${p.propertyId}` : '/landlord/payments'
  };
}

function buildExpenseItem(e) {
  const category = e.category || e.Category || 'Expense';
  const propertyName = e.propertyName || e.PropertyName || '';
  const unitName = e.unitName || e.UnitName || '';
  const sub = [propertyName, unitName].filter(Boolean).join(' · ');
  return {
    id: `exp-${e.id}`,
    kind: 'expense',
    date: e.paidDate || e.expenseDate,
    title: e.name || e.Name || 'Expense',
    sub,
    typeLabel: category,
    amount: e.amount ?? e.Amount ?? 0,
    onClick: '/landlord/expenses'
  };
}

export default function PaymentsCard() {
  const theme = useTheme();
  const navigate = useNavigate();

  useFetchAllPayments();
  const payments = useSelector(selectAllPayments);
  const loadedAt = useSelector(selectAllPaymentsLoadedAt);
  const paymentsLoading = !loadedAt;
  const expenses = useSelector(selectExpenses);
  const expensesLoading = useSelector(selectExpenseLoading);

  const loading = paymentsLoading && expensesLoading;

  const items = useMemo(() => {
    const payItems = payments.map(buildPaymentItem);
    const expItems = expenses.map(buildExpenseItem);
    return [...payItems, ...expItems]
      .filter((x) => x.date)
      .sort((a, b) => new Date(b.date) - new Date(a.date))
      .slice(0, 2);
  }, [payments, expenses]);

  return (
    <MainCard
      accentColor={theme.palette.primary.main}
      accentShadow
      title={
        <Box>
          <Typography variant="h5" fontWeight={700} sx={{ lineHeight: 1.2, color: 'text.primary' }}>
            Payment check-in
          </Typography>
          <Typography
            variant="caption"
            color="text.secondary"
            sx={{ display: 'block', mt: 0.25, fontSize: '0.75rem', lineHeight: 1.3 }}
          >
            Recent money activity
          </Typography>
        </Box>
      }
      secondary={
        <Button
          size="small"
          variant="text"
          endIcon={<ArrowRightOutlined style={{ fontSize: 12 }} />}
          onClick={() => navigate('/landlord/money-activity')}
          sx={{
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
      contentSX={{ pt: 1.5, pb: 1 }}
      sx={{ height: '100%', '& .MuiCardHeader-root': { pb: 1 } }}
    >
      {loading ? (
        <Box sx={{ minHeight: 200, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <CircularLoader />
        </Box>
      ) : items.length > 0 ? (
        <Stack>
          {items.map((item, i) => {
            const isIncome = item.kind === 'income';
            const accentColor = isIncome ? theme.palette.success.main : theme.palette.warning.main;
            return (
              <Box
                key={item.id}
                onClick={() => navigate(item.onClick)}
                sx={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 1.5,
                  py: 1.25,
                  px: 1,
                  mx: -1,
                  cursor: 'pointer',
                  borderBottom: i < items.length - 1 ? `1px solid ${alpha(theme.palette.divider, 0.08)}` : 'none',
                  borderRadius: 1,
                  transition: 'background 0.15s',
                  '&:hover': { bgcolor: alpha(accentColor, 0.04) }
                }}
              >
                {/* Direction icon */}
                <Box
                  sx={{
                    width: 34,
                    height: 34,
                    borderRadius: '50%',
                    flexShrink: 0,
                    bgcolor: alpha(accentColor, 0.1),
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    color: accentColor
                  }}
                >
                  {isIncome ? <ArrowUpOutlined style={{ fontSize: 14 }} /> : <ArrowDownOutlined style={{ fontSize: 14 }} />}
                </Box>

                {/* Content */}
                <Box sx={{ flex: 1, minWidth: 0 }}>
                  <Stack direction="row" alignItems="center" spacing={0.75} sx={{ mb: 0.2, flexWrap: 'wrap' }}>
                    <Typography variant="body2" fontWeight={600} noWrap sx={{ fontSize: '0.875rem' }}>
                      {item.title}
                    </Typography>
                    <Chip
                      label={item.typeLabel}
                      size="small"
                      sx={{
                        height: 17,
                        fontSize: '0.6rem',
                        fontWeight: 700,
                        flexShrink: 0,
                        bgcolor: alpha(accentColor, 0.1),
                        color: accentColor,
                        '& .MuiChip-label': { px: 0.6 }
                      }}
                    />
                  </Stack>
                  <Stack direction="row" alignItems="center" spacing={0.75}>
                    <Typography variant="caption" color="text.secondary" noWrap sx={{ fontSize: '0.72rem' }}>
                      {moment(item.date).format('MMM D')}
                      {item.sub ? ` · ${item.sub}` : ''}
                    </Typography>
                    {item.statusLabel ? (
                      <Chip
                        label={item.statusLabel}
                        size="small"
                        color={item.statusColor}
                        sx={{ height: 16, fontSize: '0.58rem', fontWeight: 600, '& .MuiChip-label': { px: 0.5 } }}
                      />
                    ) : null}
                  </Stack>
                </Box>

                {/* Amount */}
                <Typography variant="subtitle2" fontWeight={700} sx={{ flexShrink: 0, color: accentColor, fontSize: '0.9rem' }}>
                  {isIncome ? '+' : '-'}
                  {formatCurrency(item.amount)}
                </Typography>
              </Box>
            );
          })}
        </Stack>
      ) : (
        <Box sx={{ minHeight: 200, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 1.5 }}>
          <Box sx={{ display: 'inline-flex', p: 1.5, borderRadius: '50%', bgcolor: alpha(theme.palette.primary.main, 0.07) }}>
            <SwapOutlined style={{ fontSize: 26, color: theme.palette.primary.main }} />
          </Box>
          <Typography variant="body2" color="text.secondary">
            No recent activity
          </Typography>
        </Box>
      )}
    </MainCard>
  );
}
