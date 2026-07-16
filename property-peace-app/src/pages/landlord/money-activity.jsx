import { useState, useMemo, useEffect } from 'react';
import {
  alpha, Box, Button, Chip, FormControl, MenuItem, Select,
  Stack, Table, TableBody, TableCell, TableContainer,
  TableHead, TableRow, Typography, useTheme, CircularProgress
} from '@mui/material';
import {
  ArrowDownOutlined, ArrowUpOutlined, LeftOutlined, RightOutlined
} from '@ant-design/icons';
import { useSelector } from 'react-redux';
import { useNavigate } from 'react-router-dom';
import MainCard from 'components/MainCard';
import PageBreadcrumbs from 'components/breadcrumbs/PageBreadcrumbs';
import { selectAllPayments } from 'store/payment/payment.selector';
import { selectExpenses, selectExpenseLoading } from 'store/expense/expense.selector';
import { selectAllPaymentsLoadedAt } from 'store/payment/payment.selector';
import { formatCurrency } from 'utils/formatters';
import moment from 'moment';
import useFetchAllPayments from 'hooks/useFetchAllPayments';

const TYPE_LABELS = {
  rent: 'Rent',
  latefee: 'Late Fee',
  'late fee': 'Late Fee',
  deposit: 'Deposit',
  other: 'Other',
};

const STATUS_CONFIG = {
  completed: { label: 'Paid',     color: 'success' },
  paid:      { label: 'Paid',     color: 'success' },
  pending:   { label: 'Pending',  color: 'warning' },
  failed:    { label: 'Failed',   color: 'error' },
  refunded:  { label: 'Refunded', color: 'info' },
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

function buildRows(payments, expenses) {
  const payRows = (payments || []).map((p) => {
    const rawStatus = (p.status || p.Status || 'completed').toLowerCase();
    const statusCfg = STATUS_CONFIG[rawStatus] || STATUS_CONFIG.completed;
    const propertyName = p.propertyName || p.PropertyName || '';
    const unitName = p.unitName || p.UnitName || p.unitNumber || p.UnitNumber || '';
    return {
      id: `pay-${p.id ?? p.Id}`,
      kind: 'income',
      date: p.paymentDate || p.PaymentDate,
      property: [propertyName, unitName].filter(Boolean).join(' · ') || '—',
      propertyId: p.propertyId || p.PropertyId,
      type: getPaymentTypeLabel(p),
      amount: p.amount ?? p.Amount ?? 0,
      statusLabel: statusCfg.label,
      statusColor: statusCfg.color,
    };
  });

  const expRows = (expenses || []).map((e) => {
    const rawStatus = e.isPaid ? 'paid' : 'pending';
    const statusCfg = STATUS_CONFIG[rawStatus];
    const propertyName = e.propertyName || e.PropertyName || '';
    const unitName = e.unitName || e.UnitName || '';
    return {
      id: `exp-${e.id}`,
      kind: 'expense',
      date: e.paidDate || e.expenseDate,
      property: [propertyName, unitName].filter(Boolean).join(' · ') || '—',
      propertyId: e.propertyId || e.PropertyId,
      type: e.category || e.Category || 'Expense',
      amount: e.amount ?? e.Amount ?? 0,
      statusLabel: statusCfg.label,
      statusColor: statusCfg.color,
    };
  });

  return [...payRows, ...expRows]
    .filter((r) => r.date)
    .sort((a, b) => new Date(b.date) - new Date(a.date));
}

export default function MoneyActivity() {
  const theme = useTheme();
  const navigate = useNavigate();

  useFetchAllPayments();
  const payments = useSelector(selectAllPayments);
  const loadedAt = useSelector(selectAllPaymentsLoadedAt);
  const expenses = useSelector(selectExpenses);
  const expensesLoading = useSelector(selectExpenseLoading);
  const loading = !loadedAt && expensesLoading;

  const [kindFilter, setKindFilter] = useState('all');
  const [page, setPage] = useState(0);
  const [itemsPerPage, setItemsPerPage] = useState(20);

  const allRows = useMemo(() => buildRows(payments, expenses), [payments, expenses]);

  const filtered = useMemo(() => {
    if (kindFilter === 'all') return allRows;
    return allRows.filter((r) => r.kind === kindFilter);
  }, [allRows, kindFilter]);

  const totalPages = Math.ceil(filtered.length / itemsPerPage);
  const paginated = useMemo(() => {
    const start = page * itemsPerPage;
    return filtered.slice(start, start + itemsPerPage);
  }, [filtered, page, itemsPerPage]);

  useEffect(() => { setPage(0); }, [kindFilter, itemsPerPage]);

  return (
    <Box>
      <PageBreadcrumbs
        items={[
          { label: 'Dashboard', path: '/landlord/dashboard' },
          { label: 'Recent Money Activity' }
        ]}
      />

      {/* Header */}
      <Box sx={{ mb: 3 }}>
        <Typography variant="h4" fontWeight={700}>Recent Money Activity</Typography>
        <Typography variant="body2" color="text.secondary">
          All payments and expenses across your portfolio
        </Typography>
      </Box>

      <MainCard
        sx={{
          bgcolor: (t) => alpha(t.palette.background.paper, 0.8),
          boxShadow: (t) => `0 4px 20px ${alpha(t.palette.primary.main, 0.1)}`,
          border: `1px solid ${alpha(theme.palette.divider, 0.1)}`,
          borderRadius: 2,
          overflow: 'hidden'
        }}
      >
        {/* Toolbar */}
        <Box
          sx={{
            px: 3, py: 2,
            borderBottom: `1px solid ${alpha(theme.palette.divider, 0.1)}`,
            display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 1.5
          }}
        >
          <Box>
            <Typography variant="h5" fontWeight={600}>Transactions</Typography>
            <Typography variant="body2" color="text.secondary" sx={{ mt: 0.25 }}>
              {filtered.length} {filtered.length === 1 ? 'record' : 'records'}
            </Typography>
          </Box>
          <Stack direction="row" spacing={1} alignItems="center">
            <FormControl size="small" sx={{ minWidth: 140 }}>
              <Select
                value={kindFilter}
                onChange={(e) => setKindFilter(e.target.value)}
                sx={{ height: 34, fontSize: '0.82rem' }}
              >
                <MenuItem value="all">All activity</MenuItem>
                <MenuItem value="income">Payments only</MenuItem>
                <MenuItem value="expense">Expenses only</MenuItem>
              </Select>
            </FormControl>
          </Stack>
        </Box>

        {loading ? (
          <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: 300 }}>
            <CircularProgress />
          </Box>
        ) : (
          <TableContainer>
            <Table>
              <TableHead>
                <TableRow
                  sx={{
                    bgcolor: (t) => alpha(t.palette.primary.main, 0.04),
                    '& .MuiTableCell-head': {
                      fontWeight: 700, fontSize: '0.75rem', textTransform: 'uppercase',
                      letterSpacing: '0.5px', borderBottom: `2px solid ${alpha(theme.palette.divider, 0.1)}`
                    }
                  }}
                >
                  <TableCell>Date</TableCell>
                  <TableCell>Property / Unit</TableCell>
                  <TableCell>Type</TableCell>
                  <TableCell>Direction</TableCell>
                  <TableCell>Amount</TableCell>
                  <TableCell>Status</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {paginated.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={6} align="center" sx={{ py: 6 }}>
                      <Typography variant="body2" color="text.secondary">No transactions found</Typography>
                    </TableCell>
                  </TableRow>
                ) : (
                  paginated.map((row) => {
                    const isIncome = row.kind === 'income';
                    const accentColor = isIncome ? theme.palette.success.main : theme.palette.error.main;
                    return (
                      <TableRow
                        key={row.id}
                        hover
                        sx={{ '&:hover': { bgcolor: alpha(theme.palette.primary.main, 0.03) }, transition: 'background 0.15s' }}
                      >
                        <TableCell>
                          <Typography variant="body2" fontWeight={500}>
                            {moment(row.date).format('MMM D, YYYY')}
                          </Typography>
                          <Typography variant="caption" color="text.secondary">
                            {moment(row.date).format('h:mm A')}
                          </Typography>
                        </TableCell>
                        <TableCell>
                          {row.propertyId ? (
                            <Typography
                              variant="body2"
                              sx={{ color: 'primary.main', cursor: 'pointer', '&:hover': { textDecoration: 'underline' } }}
                              onClick={() => navigate(`/landlord/property/${row.propertyId}`)}
                            >
                              {row.property}
                            </Typography>
                          ) : (
                            <Typography variant="body2" color="text.secondary">{row.property}</Typography>
                          )}
                        </TableCell>
                        <TableCell>
                          <Typography variant="body2" color="text.secondary">{row.type}</Typography>
                        </TableCell>
                        <TableCell>
                          <Stack direction="row" alignItems="center" spacing={0.75}>
                            <Box
                              sx={{
                                width: 24, height: 24, borderRadius: '50%', flexShrink: 0,
                                bgcolor: alpha(accentColor, 0.1),
                                display: 'flex', alignItems: 'center', justifyContent: 'center'
                              }}
                            >
                              {isIncome
                                ? <ArrowUpOutlined style={{ fontSize: 11, color: accentColor }} />
                                : <ArrowDownOutlined style={{ fontSize: 11, color: accentColor }} />
                              }
                            </Box>
                            <Typography variant="body2" sx={{ color: accentColor, fontWeight: 500 }}>
                              {isIncome ? 'Income' : 'Expense'}
                            </Typography>
                          </Stack>
                        </TableCell>
                        <TableCell>
                          <Typography variant="body2" fontWeight={600} sx={{ color: accentColor }}>
                            {isIncome ? '+' : '-'}{formatCurrency(row.amount)}
                          </Typography>
                        </TableCell>
                        <TableCell>
                          <Chip
                            label={row.statusLabel}
                            size="small"
                            color={row.statusColor}
                            sx={{ fontWeight: 500, height: 22, fontSize: '0.7rem' }}
                          />
                        </TableCell>
                      </TableRow>
                    );
                  })
                )}
              </TableBody>
            </Table>
          </TableContainer>
        )}

        {/* Pagination */}
        {filtered.length > 0 && (
          <Box
            sx={{
              display: 'flex', justifyContent: 'space-between', alignItems: 'center',
              px: 3, py: 2, borderTop: `1px solid ${alpha(theme.palette.divider, 0.1)}`
            }}
          >
            <Stack direction="row" alignItems="center" spacing={1}>
              <Typography variant="body2" color="text.secondary">Rows per page:</Typography>
              <FormControl size="small">
                <Select value={itemsPerPage} onChange={(e) => setItemsPerPage(Number(e.target.value))} sx={{ height: 32 }}>
                  <MenuItem value={10}>10</MenuItem>
                  <MenuItem value={20}>20</MenuItem>
                  <MenuItem value={50}>50</MenuItem>
                </Select>
              </FormControl>
            </Stack>
            <Stack direction="row" alignItems="center" spacing={2}>
              <Typography variant="body2" color="text.secondary">
                Page {page + 1} of {Math.max(1, totalPages)}
              </Typography>
              <Stack direction="row" spacing={1}>
                <Button
                  size="small" variant="outlined"
                  startIcon={<LeftOutlined />}
                  onClick={() => setPage((p) => Math.max(0, p - 1))}
                  disabled={page === 0}
                  sx={{ minWidth: 100 }}
                >
                  Previous
                </Button>
                <Button
                  size="small" variant="outlined"
                  endIcon={<RightOutlined />}
                  onClick={() => setPage((p) => Math.min(totalPages - 1, p + 1))}
                  disabled={page >= totalPages - 1}
                  sx={{ minWidth: 100 }}
                >
                  Next
                </Button>
              </Stack>
            </Stack>
          </Box>
        )}
      </MainCard>
    </Box>
  );
}
