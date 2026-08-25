import PropTypes from 'prop-types';
import { Alert, Box, Chip, Drawer, IconButton, Stack, Typography } from '@mui/material';
import { Close } from '@mui/icons-material';

import { formatMoneyCenterDate } from 'utils/moneyCenter';

const money = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' });
const typeLabel = { cameIn: 'Income · came in', wentOut: 'Expense · went out', obligation: 'Planned obligation', excluded: 'Excluded' };
const tone = { cameIn: 'success', wentOut: 'error', obligation: 'warning', excluded: 'default' };

export default function FinanceDetailDrawer({ item, onClose }) {
  const details = item ? [
    ['Date (UTC)', formatMoneyCenterDate(item.occurredAt)],
    ['Property', item.propertyName || 'Not recorded'],
    ['Unit', item.unitName || 'Property level'],
    ['Category', item.category || 'Not recorded'],
    ['Counterparty', item.counterparty || 'Not recorded'],
    ['Method', item.method || 'Not recorded'],
    ['Reference', item.reference || 'Not recorded'],
    ['Treatment', item.treatment || 'Not recorded'],
    ['Source type', item.sourceType || 'Not recorded'],
    ['Source ID', item.sourceId || 'Not recorded']
  ] : [];

  return (
    <Drawer
      anchor="right"
      open={Boolean(item)}
      onClose={onClose}
      aria-labelledby="finance-detail-title"
      slotProps={{ paper: { sx: { width: { xs: '100%', sm: 440 }, p: { xs: 2, sm: 3 } } } }}
    >
      {item && (
        <>
          <Stack direction="row" justifyContent="space-between" alignItems="center" spacing={1.5}>
            <Box minWidth={0}>
              <Typography variant="overline" color="text.secondary">Source record</Typography>
              <Typography id="finance-detail-title" variant="h4" noWrap>{item.description || item.category || 'Financial record'}</Typography>
            </Box>
            <IconButton onClick={onClose} aria-label="Close finance detail"><Close /></IconButton>
          </Stack>

          <Stack spacing={2.1} sx={{ mt: 3 }}>
            <Box>
              <Typography variant="caption" color="text.secondary">Amount</Typography>
              <Typography variant="h3" color={`${tone[item.direction] || 'primary'}.main`}>{money.format(Number(item.amount) || 0)}</Typography>
            </Box>
            <Chip
              label={typeLabel[item.direction] || item.direction || 'Type not recorded'}
              color={tone[item.direction] || 'default'}
              sx={{ alignSelf: 'flex-start' }}
            />
            {details.map(([label, value]) => (
              <Box key={label}>
                <Typography variant="caption" color="text.secondary">{label}</Typography>
                <Typography variant="body2" sx={{ overflowWrap: 'anywhere' }}>{value}</Typography>
              </Box>
            ))}
            {item.needsAttention && <Alert severity="warning">This source record needs review.</Alert>}
            {item.sourceType === 'expense' && item.hasReceipt === false && (
              <Alert severity="info">No receipt is attached to this expense record.</Alert>
            )}
          </Stack>
        </>
      )}
    </Drawer>
  );
}

FinanceDetailDrawer.propTypes = {
  item: PropTypes.shape({
    sourceId: PropTypes.oneOfType([PropTypes.string, PropTypes.number]),
    sourceType: PropTypes.string,
    direction: PropTypes.string,
    hasReceipt: PropTypes.bool,
    needsAttention: PropTypes.bool
  }),
  onClose: PropTypes.func.isRequired
};