import {
  AlertOutlined,
  CheckCircleOutlined,
  ClockCircleOutlined,
  DollarOutlined,
  ExclamationCircleOutlined,
  RollbackOutlined,
  SafetyCertificateOutlined,
  SyncOutlined
} from '@ant-design/icons';
import { alpha, Box, CardContent, Grid, Stack, Typography, useTheme } from '@mui/material';
import MainCard from 'components/MainCard';
import { formatCurrency } from 'utils/formatters';
import { buildSettlementPresentation } from 'utils/settlementSummary';

const STATE_STYLE = {
  processing: { icon: ClockCircleOutlined, paletteKey: 'info' },
  held: { icon: SafetyCertificateOutlined, paletteKey: 'warning' },
  available: { icon: DollarOutlined, paletteKey: 'success' },
  transferred: { icon: CheckCircleOutlined, paletteKey: 'success' },
  blocked: { icon: AlertOutlined, paletteKey: 'error' },
  returned: { icon: RollbackOutlined, paletteKey: 'error' },
  reconciliationPending: { icon: SyncOutlined, paletteKey: 'warning' },
  recoveryFailed: { icon: ExclamationCircleOutlined, paletteKey: 'error' }
};

function SettlementStateCard({ state }) {
  const theme = useTheme();
  const { icon: Icon, paletteKey } = STATE_STYLE[state.key];
  const color = theme.palette[paletteKey].main;
  const isZero = state.count === 0 && state.amount === 0;

  return (
    <MainCard
      sx={{
        height: '100%',
        border: `1px solid ${alpha(color, 0.25)}`,
        borderTop: `4px solid ${color}`,
        borderRadius: 2,
        boxShadow: `0 2px 10px ${alpha(theme.palette.common.black, 0.06)}`
      }}
    >
      <CardContent sx={{ p: { xs: 1.5, sm: 2 }, '&:last-child': { pb: { xs: 1.5, sm: 2 } } }}>
        <Stack spacing={1.25} height="100%">
          <Stack direction="row" alignItems="center" justifyContent="space-between" spacing={1}>
            <Typography variant="subtitle1" fontWeight={700}>
              {state.label}
            </Typography>
            <Box
              aria-hidden="true"
              sx={{
                width: 34,
                height: 34,
                borderRadius: 1.5,
                bgcolor: alpha(color, 0.12),
                color,
                display: 'grid',
                placeItems: 'center',
                flexShrink: 0
              }}
            >
              <Icon style={{ fontSize: 18 }} />
            </Box>
          </Stack>

          <Stack direction={{ xs: 'row', sm: 'column', md: 'row' }} alignItems={{ xs: 'baseline', sm: 'flex-start', md: 'baseline' }} gap={1}>
            <Typography variant="h4" component="p" color={color} fontWeight={700}>
              {formatCurrency(state.amount)}
            </Typography>
            <Typography variant="body2" color="text.secondary">
              {state.countLabel}
            </Typography>
          </Stack>

          <Typography variant="body2" color={isZero ? 'text.primary' : 'text.secondary'} fontWeight={isZero ? 600 : 400}>
            {isZero ? state.zeroLabel : state.description}
          </Typography>
          {isZero && (
            <Typography variant="caption" color="text.secondary">
              {state.description}
            </Typography>
          )}
        </Stack>
      </CardContent>
    </MainCard>
  );
}

export default function SettlementSummary({ summary }) {
  const presentation = buildSettlementPresentation(summary);

  return (
    <Box component="section" aria-labelledby="landlord-settlement-heading" sx={{ mt: 3 }}>
      <Stack spacing={0.5} sx={{ mb: 1.5 }}>
        <Typography id="landlord-settlement-heading" variant="h4" component="h2">
          {presentation.heading}
        </Typography>
        <Typography variant="body2" color="text.secondary" sx={{ maxWidth: 820 }}>
          {presentation.explanation}
        </Typography>
      </Stack>
      <Grid container spacing={{ xs: 1.5, sm: 2 }}>
        {presentation.states.map((state) => (
          <Grid key={state.key} size={{ xs: 12, sm: 6, md: 3 }}>
            <SettlementStateCard state={state} />
          </Grid>
        ))}
      </Grid>
    </Box>
  );
}
