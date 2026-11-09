import { useEffect, useMemo, useState } from 'react';
import { Box, Button, Chip, FormControl, IconButton, MenuItem, Select, Stack, Table, TableBody, TableCell, TableContainer, TableHead, TablePagination, TableRow, TextField, Tooltip, Typography } from '@mui/material';
import { CheckCircleOutlined, DeleteOutlined, EditOutlined, PlusOutlined } from '@ant-design/icons';
import MainCard from 'components/MainCard';
import { formatCurrency, formatDate } from 'utils/formatters';
import { combinePropertyFinances, financeUnitName, hasFinanceUnits, paymentCategory } from './propertyFinances.mjs';

const financeSurfaceSx = {
  border: 'none',
  boxShadow: 'none',
  '&::before': { display: 'none' },
  '&:hover': { border: 'none', boxShadow: 'none' }
};

export default function PropertyFinanceTable({ propertyId, property, payments = [], expenses = [], mode = 'payments', rentOverview, monthlyExpenses, monthlyExpensesLoading = false, monthlyExpensesError = false, onRecordPayment, onAddExpense, onEditExpense, onDeleteExpense, onMarkAsPaid }) {
  const [query, setQuery] = useState('');
  const [filter, setFilter] = useState('all');
  const [page, setPage] = useState(0);
  const [rowsPerPage, setRowsPerPage] = useState(10);
  const isPayments = mode === 'payments';
  const label = isPayments ? 'payments' : 'expenses';
  const showUnit = hasFinanceUnits(property);
  const rows = useMemo(() => combinePropertyFinances(isPayments ? payments : [], isPayments ? [] : expenses, propertyId), [payments, expenses, propertyId, isPayments]);
  const getFilterValue = record => isPayments ? record.status || 'Unknown' : record.category || 'Other';
  const filterOptions = [...new Set(rows.map(({ record }) => getFilterValue(record)))].sort();
  const filtered = rows.filter(({ record }) => {
    if (filter !== 'all' && filter !== getFilterValue(record)) return false;
    const text = [record.name, record.vendor, record.category, record.tenantName, record.lease?.tenantName,
      financeUnitName(record, property), paymentCategory(record), record.reference, record.method, record.status].filter(Boolean).join(' ').toLowerCase();
    return text.includes(query.trim().toLowerCase());
  });
  const total = rows.filter(({ record }) => !isPayments || String(record.status).toLowerCase() === 'completed')
    .reduce((sum, row) => sum + (Number(row.record.amount) || 0), 0);
  const safePage = Math.min(page, Math.max(0, Math.ceil(filtered.length / rowsPerPage) - 1));
  const columnCount = 5 + (showUnit ? 1 : 0) + (isPayments ? 0 : 1);
  useEffect(() => { setPage(0); setFilter('all'); setQuery(''); }, [propertyId, mode]);
  useEffect(() => setPage(0), [query, filter, rowsPerPage]);
  return (
    <Box sx={{ mb: 3 }}>
      {isPayments ? (
        <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2} alignItems={{ xs: 'stretch', sm: 'center' }} justifyContent="space-between" sx={{ px: 2.5, pt: 1, pb: 0.5 }}>
          <Stack spacing={0.75} sx={{ minWidth: 0 }}>
            <Box sx={{ display: 'grid', gridTemplateColumns: '112px minmax(0, 1fr)', columnGap: 1.5, alignItems: 'baseline' }}>
              <Typography variant="body2" color="text.secondary">Total received:</Typography>
              <Typography variant="body1" fontWeight={700} color="success.main">{formatCurrency(total)}</Typography>
            </Box>
            {rentOverview}
          </Stack>
          {onRecordPayment && <Button variant="contained" startIcon={<PlusOutlined />} onClick={onRecordPayment} sx={{ alignSelf: { xs: 'flex-end', sm: 'center' }, flexShrink: 0, whiteSpace: 'nowrap', textTransform: 'none' }}>Record payment</Button>}
        </Stack>
      ) : (
        <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2} alignItems={{ xs: 'stretch', sm: 'center' }} justifyContent="space-between" sx={{ px: 2.5, pt: 1, pb: 0.5 }}>
          <Box sx={{ display: 'grid', gridTemplateColumns: 'max-content minmax(0, 1fr)', columnGap: 1.5, rowGap: 1, alignItems: 'baseline' }}>
            <Typography variant="body2" color="text.secondary">Total expenses:</Typography>
            <Typography variant="body1" fontWeight={700} color="error.main">{formatCurrency(total)}</Typography>
            <Typography variant="body2" color="text.secondary">Monthly expenses:</Typography>
            <Typography variant="body1" fontWeight={700} color={monthlyExpensesError ? 'text.secondary' : 'error.main'}
              title="Expected expenses for the current calendar month, including recorded expenses and scheduled recurring and one-time expenses."
              aria-live="polite">
              {monthlyExpensesLoading ? 'Loading…' : monthlyExpensesError || monthlyExpenses == null ? '—' : formatCurrency(monthlyExpenses)}
            </Typography>
          </Box>
          <Button variant="contained" startIcon={<PlusOutlined />} onClick={onAddExpense} sx={{ alignSelf: { xs: 'flex-end', sm: 'center' }, flexShrink: 0, whiteSpace: 'nowrap', textTransform: 'none' }}>Add Expense</Button>
        </Stack>
      )}
      <MainCard sx={financeSurfaceSx}>
        <Stack direction={{ xs: 'column', sm: 'row' }} gap={1.5} sx={{ mb: 2 }}>
          <TextField size="small" placeholder={`Search ${label}...`} inputProps={{ 'aria-label': `Search ${label}` }}
            value={query} onChange={event => setQuery(event.target.value)} sx={{ flex: 1, minWidth: 0 }} />
          <FormControl size="small" sx={{ minWidth: 170 }}>
            <Select value={filter} onChange={event => setFilter(event.target.value)} inputProps={{ 'aria-label': `Filter ${label} by ${isPayments ? 'status' : 'category'}` }}>
              <MenuItem value="all">{isPayments ? 'All statuses' : 'All categories'}</MenuItem>
              {filterOptions.map(value => <MenuItem key={value} value={value}>{value}</MenuItem>)}
            </Select>
          </FormControl>
        </Stack>
        <TableContainer sx={{ overflowX: 'auto', minHeight: { xs: 260, sm: 360 } }}>
          <Table size="small" aria-label={`Property ${label}`}>
            <TableHead><TableRow>
              <TableCell>Date</TableCell><TableCell>{isPayments ? 'Tenant' : 'Name'}</TableCell><TableCell>{isPayments ? 'Payment type' : 'Category'}</TableCell>
              {showUnit && <TableCell>Unit</TableCell>}<TableCell>Status</TableCell><TableCell align="right">Amount</TableCell>
              {!isPayments && <TableCell align="center">Actions</TableCell>}
            </TableRow></TableHead>
            <TableBody>
              {filtered.slice(safePage * rowsPerPage, (safePage + 1) * rowsPerPage).map(({ record, date }, index) => (
                <TableRow key={record.id ?? index} hover>
                  <TableCell sx={{ whiteSpace: 'nowrap' }}>{date ? formatDate(date) : '—'}</TableCell>
                  <TableCell>{isPayments ? record.tenantName || record.lease?.tenantName || '—' : record.name || '—'}
                    {!isPayments && record.vendor && <Typography variant="caption" display="block" color="text.secondary">{record.vendor}</Typography>}</TableCell>
                  <TableCell>{isPayments ? paymentCategory(record) : record.category || 'Other'}</TableCell>
                  {showUnit && <TableCell>{financeUnitName(record, property)}</TableCell>}
                  <TableCell>{isPayments
                    ? <Chip size="small" label={record.status || 'Unknown'} color={String(record.status).toLowerCase() === 'completed' ? 'success' : 'default'} />
                    : <Chip size="small" label={record.isPaid ? 'Paid' : 'Unpaid'} color={record.isPaid ? 'success' : 'warning'} />}</TableCell>
                  <TableCell align="right" sx={{ whiteSpace: 'nowrap', color: isPayments ? 'success.main' : 'error.main', fontWeight: 600 }}>
                    {isPayments ? '+' : '−'}{formatCurrency(record.amount || 0)}</TableCell>
                  {!isPayments && <TableCell align="center"><Stack direction="row" justifyContent="center">
                    {!record.isPaid && <Tooltip title="Mark as Paid"><IconButton size="small" color="success" aria-label="Mark as Paid" onClick={() => onMarkAsPaid(record)}><CheckCircleOutlined /></IconButton></Tooltip>}
                    <Tooltip title="Edit Expense"><IconButton size="small" aria-label="Edit Expense" onClick={() => onEditExpense(record)}><EditOutlined /></IconButton></Tooltip>
                    <Tooltip title="Delete Expense"><IconButton size="small" color="error" aria-label="Delete Expense" onClick={() => onDeleteExpense(record)}><DeleteOutlined /></IconButton></Tooltip>
                  </Stack></TableCell>}
                </TableRow>
              ))}
              {!filtered.length && <TableRow><TableCell colSpan={columnCount} align="center" sx={{ py: 4, color: 'text.secondary' }}>
                {rows.length ? `No matching ${label}.` : `No ${label} recorded for this property yet.`}
              </TableCell></TableRow>}
            </TableBody>
          </Table>
        </TableContainer>
        <TablePagination component="div" count={filtered.length} page={safePage} onPageChange={(_, next) => setPage(next)}
          rowsPerPage={rowsPerPage} onRowsPerPageChange={event => setRowsPerPage(Number(event.target.value))} rowsPerPageOptions={[10, 25, 50]} />
      </MainCard>
    </Box>
  );
}
