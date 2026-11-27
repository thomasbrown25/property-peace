import PropTypes from 'prop-types';
import { Alert, Box, Chip, Divider, IconButton, Stack, Typography } from '@mui/material';

import AppIcon from 'components/AppIcon';
import ThemeAdaptiveDrawer from 'components/drawers/shared/ThemeAdaptiveDrawer';
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
    <ThemeAdaptiveDrawer
      open={Boolean(item)}
      onClose={onClose}
      slotProps={{
        paper: {
          role: 'dialog',
          'aria-modal': true,
          'aria-labelledby': 'finance-detail-title',
          sx: { width: { xs: '100%', sm: 440 }, maxWidth: '100vw' }
        }
      }}
    >
      {item && (
        <>
          <Stack
            direction="row"
            justifyContent="space-between"
            alignItems="center"
            spacing={1.5}
            sx={{ px: { xs: 2, sm: 3 }, py: 2, flexShrink: 0 }}
          >
            <Box minWidth={0}>
              <Typography variant="caption" color="text.secondary">Source record</Typography>
              <Typography id="finance-detail-title" component="h2" variant="h4" fontWeight={700} sx={{ overflowWrap: 'anywhere' }}>
                {item.description || item.category || 'Financial record'}
              </Typography>
            </Box>
            <IconButton onClick={onClose} aria-label="Close finance detail" size="small"><AppIcon name="close" /></IconButton>
          </Stack>
          <Divider />

          <Stack spacing={2.1} sx={{ flex: 1, overflowY: 'auto', px: { xs: 2, sm: 3 }, py: 2.5 }}>
            <Box>
              <Typography variant="caption" color="text.secondary">Amount</Typography>
              <Typography variant="h3" fontWeight={700}>{money.format(Number(item.amount) || 0)}</Typography>
            </Box>
            <Chip
              label={typeLabel[item.direction] || item.direction || 'Type not recorded'}
              color={tone[item.direction] || 'default'}
              size="small"
              variant="outlined"
              sx={{ alignSelf: 'flex-start', color: 'inherit' }}
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
    </ThemeAdaptiveDrawer>
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
