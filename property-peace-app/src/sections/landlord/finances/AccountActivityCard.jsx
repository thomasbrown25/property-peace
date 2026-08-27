import PropTypes from 'prop-types';
import { alpha, Box, Stack, Typography, useTheme } from '@mui/material';

const money = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' });

function formatSignedMoney(value) {
  const amount = Number(value);
  if (amount > 0) return `+${money.format(amount)}`;
  if (amount < 0) return `-${money.format(Math.abs(amount))}`;
  return money.format(0);
}

export default function AccountActivityCard({ accounts = [], available,
  partial = false,
  loadedCount = 0,
  totalCount = 0, loading, onSelectAccount }) {
  const theme = useTheme();
  const maxMagnitude = Math.max(0, ...accounts.map((account) => Math.abs(account.signedTotal)));

  return (
    <Box sx={{ p: 2, bgcolor: 'background.paper', border: `1px solid ${alpha(theme.palette.divider, 0.16)}`, borderRadius: 3, boxShadow: `0 8px 28px ${alpha(theme.palette.primary.dark, 0.045)}` }}>
      <Typography fontWeight={750}>Account Activity</Typography>
      <Typography sx={{ mt: 0.35, fontSize: '0.75rem', color: 'text.secondary' }}>Recorded net movement by account</Typography>
      <Stack spacing={1.5} sx={{ mt: 2 }}>
        {loading ? (
          <Typography role="status" sx={{ fontSize: '0.8rem', color: 'text.secondary' }}>Loading account activity…</Typography>
        ) : partial ? (
          <Typography role="status" sx={{ fontSize: '0.8rem', color: 'text.secondary' }}>
            Account totals are unavailable because only {loadedCount} of {totalCount} source records loaded.
          </Typography>
        ) : !available ? (
          <Typography role="status" sx={{ fontSize: '0.8rem', color: 'text.secondary' }}>Account activity is unavailable.</Typography>
        ) : accounts.length === 0 ? (
          <Typography sx={{ fontSize: '0.8rem', color: 'text.secondary' }}>No recorded account activity for this scope.</Typography>
        ) : accounts.map((account) => {
          const width = maxMagnitude ? (Math.abs(account.signedTotal) / maxMagnitude) * 100 : 0;
          return (
            <Box
              key={account.account}
              component="button"
              type="button"
              onClick={() => onSelectAccount(account.account)}
              aria-label={`Show ${account.account} activity, ${formatSignedMoney(account.signedTotal)}`}
              sx={{ p: 0, border: 0, bgcolor: 'transparent', color: 'inherit', textAlign: 'left', font: 'inherit', cursor: 'pointer', '&:focus-visible': { outline: '2px solid', outlineColor: 'primary.main', outlineOffset: 3 } }}
            >
              <Stack direction="row" justifyContent="space-between" spacing={1}>
                <Typography sx={{ fontSize: '0.78rem', fontWeight: 650 }} noWrap>{account.account}</Typography>
                <Typography sx={{ fontSize: '0.78rem', fontWeight: 700, color: account.signedTotal < 0 ? 'error.main' : 'text.primary' }}>
                  {formatSignedMoney(account.signedTotal)}
                </Typography>
              </Stack>
              <Box sx={{ mt: 0.65, height: 6, borderRadius: 8, bgcolor: alpha(theme.palette.divider, 0.14), overflow: 'hidden' }}>
                <Box sx={{ width: `${width}%`, height: '100%', borderRadius: 8, bgcolor: account.signedTotal < 0 ? 'error.main' : 'success.main' }} />
              </Box>
            </Box>
          );
        })}
      </Stack>
    </Box>
  );
}

AccountActivityCard.propTypes = {
  accounts: PropTypes.arrayOf(
    PropTypes.shape({
      account: PropTypes.string.isRequired,
      signedTotal: PropTypes.number.isRequired,
      count: PropTypes.number.isRequired
    })
  ),
  available: PropTypes.bool.isRequired,
  partial: PropTypes.bool,
  loadedCount: PropTypes.number,
  totalCount: PropTypes.number,
  loading: PropTypes.bool.isRequired,
  onSelectAccount: PropTypes.func.isRequired
};
