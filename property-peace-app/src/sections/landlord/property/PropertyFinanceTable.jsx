import { useEffect, useMemo, useState } from 'react';
import { Box, Button, Chip, FormControl, IconButton, MenuItem, Select, Stack, Table, TableBody, TableCell, TableContainer, TableHead, TablePagination, TableRow, TextField, Tooltip, Typography } from '@mui/material';
import { CheckCircleOutlined, DeleteOutlined, EditOutlined, PlusOutlined } from '@ant-design/icons';
import MainCard from 'components/MainCard';
import { formatCurrency, formatDate } from 'utils/formatters';
import { combinePropertyFinances } from './propertyFinances.mjs';

const financeSurfaceSx = {
  border: 'none',
  boxShadow: 'none',
  '&::before': { display: 'none' },
  '&:hover': { border: 'none', boxShadow: 'none' }
};

export default function PropertyFinanceTable({ propertyId, payments, expenses, onAddExpense, onEditExpense, onDeleteExpense, onMarkAsPaid }) {
  const [query, setQuery] = useState('');
  const [kind, setKind] = useState('all');
  const [page, setPage] = useState(0);
  const [rowsPerPage, setRowsPerPage] = useState(10);
  const rows = useMemo(() => combinePropertyFinances(payments, expenses, propertyId), [payments, expenses, propertyId]);
  const filtered = useMemo(() => rows.filter(({ kind: rowKind, record }) => {
    if (kind !== 'all' && kind !== rowKind) return false;
    const text = [record.name, record.vendor, record.category, record.tenantName, record.lease?.tenantName,
      record.unitName, record.lease?.unitName, record.type, record.status, rowKind].filter(Boolean).join(' ').toLowerCase();
    return text.includes(query.trim().toLowerCase());
  }), [rows, kind, query]);
  const totalIncome = rows.filter(row => row.kind === 'income').reduce((sum, row) => sum + (Number(row.record.amount) || 0), 0);
  const totalExpenses = rows.filter(row => row.kind === 'expense').reduce((sum, row) => sum + (Number(row.record.amount) || 0), 0);
  const safePage = Math.min(page, Math.max(0, Math.ceil(filtered.length / rowsPerPage) - 1));
  useEffect(() => setPage(0), [propertyId, query, kind, rowsPerPage]);
  return (
    <Box sx={{ mb: 3 }}>
      <MainCard sx={{ ...financeSurfaceSx, mb: 3 }}>
        <Stack direction="row" gap={4} flexWrap="wrap">
          <Box><Typography variant="body2" color="text.secondary">Total Income</Typography>
            <Typography variant="h4" fontWeight={700} color="success.main">{formatCurrency(totalIncome)}</Typography></Box>
          <Box><Typography variant="body2" color="text.secondary">Total Expenses</Typography>
            <Typography variant="h4" fontWeight={700} color="error.main">{formatCurrency(totalExpenses)}</Typography></Box>
        </Stack>
      </MainCard>
      <MainCard sx={financeSurfaceSx}>
        <Stack direction={{ xs: 'column', sm: 'row' }} gap={1.5} sx={{ mb: 2 }}>
          <TextField size="small" placeholder="Search finances..." inputProps={{ 'aria-label': 'Search finances' }}
            value={query} onChange={event => setQuery(event.target.value)} sx={{ flex: 1, minWidth: 0 }} />
          <FormControl size="small" sx={{ minWidth: 170 }}>
            <Select value={kind} onChange={event => setKind(event.target.value)} inputProps={{ 'aria-label': 'Filter finances by type' }}>
              <MenuItem value="all">All transactions</MenuItem><MenuItem value="income">Income</MenuItem><MenuItem value="expense">Expenses</MenuItem>
            </Select>
          </FormControl>
          <Button variant="contained" startIcon={<PlusOutlined />} onClick={onAddExpense} sx={{ flexShrink: 0, whiteSpace: 'nowrap', textTransform: 'none' }}>Add Expense</Button>
        </Stack>
        <TableContainer sx={{ overflowX: 'auto', minHeight: { xs: 260, sm: 360 } }}>
          <Table size="small" aria-label="Property finances">
            <TableHead><TableRow>
              <TableCell>Date</TableCell><TableCell>Type</TableCell><TableCell>Name / Tenant</TableCell><TableCell>Category</TableCell>
              <TableCell>Unit</TableCell><TableCell>Status</TableCell><TableCell align="right">Amount</TableCell><TableCell align="center">Actions</TableCell>
            </TableRow></TableHead>
            <TableBody>
              {filtered.slice(safePage * rowsPerPage, (safePage + 1) * rowsPerPage).map(({ kind: rowKind, record, date }, index) => (
                <TableRow key={`${rowKind}-${record.id ?? index}`} hover>
                  <TableCell sx={{ whiteSpace: 'nowrap' }}>{date ? formatDate(date) : '—'}</TableCell>
                  <TableCell>{rowKind === 'income' ? 'Income' : 'Expense'}</TableCell>
                  <TableCell>{rowKind === 'income' ? record.tenantName || record.lease?.tenantName || 'N/A' : record.name || '—'}
                    {rowKind === 'expense' && record.vendor && <Typography variant="caption" display="block" color="text.secondary">{record.vendor}</Typography>}</TableCell>
                  <TableCell>{rowKind === 'income' ? (record.type === 'deposit' ? 'Deposit' : 'Rent Payment') : record.category || 'Other'}</TableCell>
                  <TableCell>{record.unitName || record.lease?.unitName || 'N/A'}</TableCell>
                  <TableCell>{rowKind === 'income'
                    ? <Chip size="small" label={record.status || 'Completed'} color={['Completed', 'completed'].includes(record.status) ? 'success' : 'default'} />
                    : <Chip size="small" label={record.isPaid ? 'Paid' : 'Unpaid'} color={record.isPaid ? 'success' : 'warning'} />}</TableCell>
                  <TableCell align="right" sx={{ whiteSpace: 'nowrap', color: rowKind === 'income' ? 'success.main' : 'error.main', fontWeight: 600 }}>
                    {rowKind === 'income' ? '+' : '−'}{formatCurrency(record.amount || 0)}</TableCell>
                  <TableCell align="center">{rowKind === 'expense' && <Stack direction="row" justifyContent="center">
                    {!record.isPaid && <Tooltip title="Mark as Paid"><IconButton size="small" color="success" onClick={() => onMarkAsPaid(record)}><CheckCircleOutlined /></IconButton></Tooltip>}
                    <Tooltip title="Edit Expense"><IconButton size="small" aria-label="Edit Expense" onClick={() => onEditExpense(record)}><EditOutlined /></IconButton></Tooltip>
                    <Tooltip title="Delete Expense"><IconButton size="small" color="error" aria-label="Delete Expense" onClick={() => onDeleteExpense(record)}><DeleteOutlined /></IconButton></Tooltip>
                  </Stack>}</TableCell>
                </TableRow>
              ))}
              {!filtered.length && <TableRow><TableCell colSpan={8} align="center" sx={{ py: 4, color: 'text.secondary' }}>
                {rows.length ? 'No matching transactions.' : 'No income or expenses recorded yet.'}
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
