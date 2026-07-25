import { useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useSelector } from 'react-redux';
import { alpha, Box, Button, Stack, Typography, useTheme } from '@mui/material';
import MainCard from 'components/MainCard';
import CircularLoader from 'components/CircularLoader';
import useFetchAllPayments from 'hooks/useFetchAllPayments';
import { selectAllPayments, selectAllPaymentsLoadedAt } from 'store/payment/payment.selector';
import { formatCurrency } from 'utils/formatters';
import moment from 'moment';
import { ArrowRightOutlined, SwapOutlined } from '@ant-design/icons';

const RECENT_PAYMENT_LIMIT = 6;

function buildPaymentItem(p) {
  const propertyName = p.propertyName || p.PropertyName || '';
  const isSingleUnitProperty = p.isSingleUnitProperty ?? p.IsSingleUnitProperty ?? false;
  const unitName = isSingleUnitProperty ? '' : p.unitName || p.UnitName || p.unitNumber || p.UnitNumber || '';
  const title = [propertyName, unitName].filter(Boolean).join(' · ') || 'Payment';
  return {
    id: `pay-${p.id ?? p.Id}`,
    kind: 'income',
    date: p.paymentDate || p.PaymentDate,
    title,
    amount: p.amount ?? p.Amount ?? 0,
    onClick: p.propertyId ? `/landlord/property/${p.propertyId}` : '/landlord/payments'
  };
}

export default function PaymentsCard() {
  const theme = useTheme();
  const navigate = useNavigate();

  useFetchAllPayments();
  const payments = useSelector(selectAllPayments);
  const loadedAt = useSelector(selectAllPaymentsLoadedAt);
  const loading = !loadedAt;

  const items = useMemo(() => {
    return payments
      .map(buildPaymentItem)
      .filter((x) => x.date)
      .sort((a, b) => new Date(b.date) - new Date(a.date))
      .slice(0, RECENT_PAYMENT_LIMIT);
  }, [payments]);

  return (
    <MainCard
      accentColor={theme.palette.primary.main}
      accentShadow
      title={
        <Typography variant="h5" fontWeight={700} sx={{ lineHeight: 1.2, color: 'text.primary' }}>
          Recent Payments
        </Typography>
      }
      secondary={
        <Button
          size="small"
          variant="text"
          endIcon={<ArrowRightOutlined style={{ fontSize: 12 }} />}
          onClick={() => navigate('/landlord/payments')}
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
      contentSX={{ pt: 1.5, pb: 1, minHeight: 248 }}
      sx={{ minHeight: 328, '& .MuiCardHeader-root': { pb: 1 } }}
    >
      {loading ? (
        <Box sx={{ minHeight: 248, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <CircularLoader />
        </Box>
      ) : items.length > 0 ? (
        <Stack>
          {items.map((item, i) => {
            const accentColor = theme.palette.success.main;
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
                {/* Content */}
                <Box sx={{ flex: 1, minWidth: 0 }}>
                  <Stack direction="row" alignItems="center" spacing={0.75} sx={{ mb: 0.2, flexWrap: 'wrap' }}>
                    <Typography variant="body2" fontWeight={600} noWrap sx={{ fontSize: '0.875rem' }}>
                      {item.title}
                    </Typography>
                  </Stack>
                  <Stack direction="row" alignItems="center" spacing={0.75}>
                    <Typography variant="caption" color="text.secondary" noWrap sx={{ fontSize: '0.72rem' }}>
                      {moment(item.date).format('MMM D')}
                      {item.sub ? ` · ${item.sub}` : ''}
                    </Typography>
                  </Stack>
                </Box>

                {/* Amount */}
                <Typography variant="subtitle2" fontWeight={700} sx={{ flexShrink: 0, color: accentColor, fontSize: '0.9rem' }}>
                  +
                  {formatCurrency(item.amount)}
                </Typography>
              </Box>
            );
          })}
        </Stack>
      ) : (
        <Box sx={{ minHeight: 248, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 1.5 }}>
          <Box sx={{ display: 'inline-flex', p: 1.5, borderRadius: '50%', bgcolor: alpha(theme.palette.primary.main, 0.07) }}>
            <SwapOutlined style={{ fontSize: 26, color: theme.palette.primary.main }} />
          </Box>
          <Typography variant="body2" color="text.secondary">
            No recent payments
          </Typography>
        </Box>
      )}
    </MainCard>
  );
}
