import PropTypes from 'prop-types';
import { alpha, Box, Chip, Stack, TableCell, TableRow, Typography, useTheme } from '@mui/material';

import { formatMoneyCenterDate } from 'utils/moneyCenter';

const money = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' });
const entryType = (entry) => entry.direction === 'cameIn' ? 'Income' : 'Expense';
const signedMoney = (value) => {
  const amount = Number(value) || 0;
  if (amount > 0) return `+${money.format(amount)}`;
  if (amount < 0) return `-${money.format(Math.abs(amount))}`;
  return money.format(0);
};

const keyboardAction = (action) => ({
  onClick: action,
  onKeyDown: (event) => {
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      action();
    }
  }
});

export default function ActivityRow({ entry, mobile, onSelect }) {
  const theme = useTheme();
  const type = entryType(entry);
  const activityBalance = entry.runningBalance == null ? 'Unavailable' : money.format(Number(entry.runningBalance) || 0);
  const tone = entry.direction === 'cameIn' ? 'success' : 'error';
  const openDetails = () => onSelect(entry);

  if (mobile) {
    return (
      <Box
        component="button"
        type="button"
        {...keyboardAction(openDetails)}
        aria-label={`Open ${type.toLowerCase()} activity details for ${entry.description}`}
        sx={{
          width: '100%', p: 1.5, border: `1px solid ${alpha(theme.palette.divider, 0.18)}`, borderRadius: 2,
          bgcolor: 'background.paper', color: 'text.primary', textAlign: 'left', font: 'inherit', cursor: 'pointer',
          '&:focus-visible': { outline: `3px solid ${alpha(theme.palette.primary.main, 0.3)}`, outlineOffset: 2 }
        }}
      >
        <Stack direction="row" justifyContent="space-between" alignItems="flex-start" spacing={1.5}>
          <Box minWidth={0}>
            <Typography fontWeight={750} noWrap>{entry.description}</Typography>
            <Typography variant="caption" color="text.secondary">{formatMoneyCenterDate(entry.occurredAt)} · {entry.account}</Typography>
          </Box>
          <Typography fontWeight={750} color={`${tone}.main`} whiteSpace="nowrap">{signedMoney(entry.signedAmount)}</Typography>
        </Stack>
        <Stack direction="row" justifyContent="space-between" alignItems="flex-end" spacing={1.5} sx={{ mt: 1.25 }}>
          <Box>
            <Chip size="small" label={type} color={tone} variant="outlined" />
            <Typography variant="caption" display="block" color="text.secondary" sx={{ mt: 0.7 }}>
              {entry.propertyName} · {entry.unitName}
            </Typography>
          </Box>
          <Box textAlign="right">
            <Typography variant="caption" color="text.secondary">Activity balance</Typography>
            <Typography variant="body2" fontWeight={700}>{activityBalance}</Typography>
          </Box>
        </Stack>
      </Box>
    );
  }

  return (
    <TableRow
      hover
      role="button"
      tabIndex={0}
      {...keyboardAction(openDetails)}
      aria-label={`Open ${type.toLowerCase()} activity details for ${entry.description}`}
      sx={{ cursor: 'pointer', '&:focus-visible': { outline: `3px solid ${alpha(theme.palette.primary.main, 0.3)}`, outlineOffset: -3 } }}
    >
      <TableCell>
        <Typography fontWeight={700}>{entry.description}</Typography>
        <Typography variant="caption" color="text.secondary">{entry.sourceId}</Typography>
      </TableCell>
      <TableCell>
        <Typography variant="body2">{entry.account}</Typography>
        <Typography variant="caption" color="text.secondary">{entry.propertyName} · {entry.unitName}</Typography>
      </TableCell>
      <TableCell>{formatMoneyCenterDate(entry.occurredAt)}</TableCell>
      <TableCell><Chip size="small" label={type} color={tone} variant="outlined" /></TableCell>
      <TableCell align="right"><Typography fontWeight={750} color={`${tone}.main`}>{signedMoney(entry.signedAmount)}</Typography></TableCell>
      <TableCell align="right">
        <Typography fontWeight={700}>{activityBalance}</Typography>
        <Typography variant="caption" color="text.secondary">Activity balance</Typography>
      </TableCell>
    </TableRow>
  );
}

ActivityRow.propTypes = {
  entry: PropTypes.shape({
    sourceId: PropTypes.oneOfType([PropTypes.string, PropTypes.number]),
    direction: PropTypes.oneOf(['cameIn', 'wentOut']).isRequired,
    description: PropTypes.string.isRequired,
    account: PropTypes.string.isRequired,
    propertyName: PropTypes.string.isRequired,
    unitName: PropTypes.string.isRequired,
    occurredAt: PropTypes.string,
    signedAmount: PropTypes.number.isRequired,
    runningBalance: PropTypes.number
  }).isRequired,
  mobile: PropTypes.bool.isRequired,
  onSelect: PropTypes.func.isRequired
};