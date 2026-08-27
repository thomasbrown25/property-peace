import { useState } from 'react';
import PropTypes from 'prop-types';
import { CheckCircleOutlined, DeleteOutlined, EditOutlined, MoreOutlined, TagsOutlined } from '@ant-design/icons';
import { alpha, Avatar, Box, Chip, IconButton, Menu, MenuItem, Stack, Tooltip, Typography, useTheme } from '@mui/material';

import {
  formatExpenseDate,
  getExpenseAmount,
  hasExpenseReceipt,
  isExpensePaid,
  readExpense
} from 'utils/expensesTab';

const money = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 2 });

export default function ExpenseRow({ expense, onEdit, onMarkPaid, onDelete }) {
  const theme = useTheme();
  const [anchorEl, setAnchorEl] = useState(null);
  const name = readExpense(expense, 'name', 'Name') || 'Untitled expense';
  const category = readExpense(expense, 'category', 'Category') || 'Uncategorized';
  const propertyName = readExpense(expense, 'propertyName', 'PropertyName') || 'No property';
  const unitName = readExpense(expense, 'unitName', 'UnitName');
  const vendor = readExpense(expense, 'vendor', 'Vendor');
  const date = readExpense(expense, 'paidDate', 'PaidDate') || readExpense(expense, 'expenseDate', 'ExpenseDate');
  const paid = isExpensePaid(expense);

  return (
    <Box
      sx={{
        px: { xs: 1.5, md: 2 },
        py: { xs: 1.55, md: 1.35 },
        display: { xs: 'block', md: 'grid' },
        gridTemplateColumns: 'minmax(230px, 1.55fr) minmax(180px, 1.05fr) minmax(130px, .8fr) minmax(100px, .62fr) 44px',
        gap: { xs: 1.25, md: 2 },
        alignItems: 'center',
        borderBottom: `1px solid ${alpha(theme.palette.divider, 0.13)}`,
        '&:hover': { bgcolor: alpha(theme.palette.primary.main, theme.palette.mode === 'dark' ? 0.08 : 0.028) }
      }}
    >
      <Stack direction="row" spacing={1.25} alignItems="center" minWidth={0}>
        <Avatar sx={{ width: 38, height: 38, bgcolor: alpha(theme.palette.error.main, 0.1), color: 'error.main' }}>
          <TagsOutlined />
        </Avatar>
        <Box minWidth={0}>
          <Typography fontWeight={700} noWrap>{name}</Typography>
          <Typography noWrap sx={{ mt: 0.25, fontSize: '0.75rem', color: 'text.secondary' }}>
            {[category, vendor].filter(Boolean).join(' · ')}
          </Typography>
        </Box>
      </Stack>

      <Box sx={{ mt: { xs: 1.1, md: 0 } }}>
        <Typography component="span" sx={{ display: { md: 'none' }, mr: 0.6, fontSize: '0.7rem', color: 'text.secondary' }}>Property:</Typography>
        <Typography component="span" sx={{ fontSize: '0.82rem', fontWeight: 650 }}>{propertyName}</Typography>
        {unitName && <Typography sx={{ mt: 0.25, fontSize: '0.72rem', color: 'text.secondary' }}>{unitName}</Typography>}
      </Box>

      <Box sx={{ mt: { xs: 0.8, md: 0 } }}>
        <Typography component="span" sx={{ display: { md: 'none' }, mr: 0.6, fontSize: '0.7rem', color: 'text.secondary' }}>Date:</Typography>
        <Typography component="span" sx={{ fontSize: '0.8rem', fontWeight: 600 }}>{formatExpenseDate(date)}</Typography>
        <Stack direction="row" spacing={0.6} sx={{ mt: 0.45 }}>
          <Chip label={paid ? 'Paid' : 'Unpaid'} size="small" color={paid ? 'success' : 'warning'} variant={paid ? 'filled' : 'outlined'} sx={{ height: 20, fontSize: '0.65rem' }} />
          {hasExpenseReceipt(expense) && <Chip label="Receipt" size="small" variant="outlined" sx={{ height: 20, fontSize: '0.65rem' }} />}
        </Stack>
      </Box>

      <Typography sx={{ mt: { xs: 0.8, md: 0 }, fontSize: '0.92rem', fontWeight: 750, color: paid ? 'text.primary' : 'warning.dark', textAlign: { md: 'right' } }}>
        <Box component="span" sx={{ display: { md: 'none' }, mr: 0.6, fontSize: '0.7rem', fontWeight: 400, color: 'text.secondary' }}>Amount:</Box>
        {money.format(getExpenseAmount(expense))}
      </Typography>

      <Box sx={{ display: 'flex', justifyContent: { xs: 'flex-end', md: 'center' } }}>
        <Tooltip title="Expense actions">
          <IconButton size="small" aria-label={`Actions for ${name}`} onClick={(event) => setAnchorEl(event.currentTarget)}><MoreOutlined /></IconButton>
        </Tooltip>
        <Menu anchorEl={anchorEl} open={Boolean(anchorEl)} onClose={() => setAnchorEl(null)}>
          {!paid && <MenuItem onClick={() => { setAnchorEl(null); onMarkPaid(expense); }}><CheckCircleOutlined style={{ marginRight: 10 }} />Mark as paid</MenuItem>}
          <MenuItem onClick={() => { setAnchorEl(null); onEdit(expense); }}><EditOutlined style={{ marginRight: 10 }} />Edit expense</MenuItem>
          <MenuItem sx={{ color: 'error.main' }} onClick={() => { setAnchorEl(null); onDelete(expense); }}><DeleteOutlined style={{ marginRight: 10 }} />Delete expense</MenuItem>
        </Menu>
      </Box>
    </Box>
  );
}

ExpenseRow.propTypes = {
  expense: PropTypes.object.isRequired,
  onEdit: PropTypes.func.isRequired,
  onMarkPaid: PropTypes.func.isRequired,
  onDelete: PropTypes.func.isRequired
};
