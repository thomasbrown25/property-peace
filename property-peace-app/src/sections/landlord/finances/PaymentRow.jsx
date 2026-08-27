import { useState } from 'react';
import PropTypes from 'prop-types';
import { DeleteOutlined, DollarOutlined, EditOutlined, MoreOutlined } from '@ant-design/icons';
import { alpha, Avatar, Box, Chip, IconButton, Menu, MenuItem, Stack, Tooltip, Typography, useTheme } from '@mui/material';

import {
  formatPaymentDate,
  getPaymentAmount,
  getPaymentLocation,
  getPaymentMethod,
  getPaymentReference,
  getPaymentStatusPresentation,
  getPaymentTitle,
  getPaymentType,
  isOnlinePayment,
  normalizePaymentStatus,
  readPayment
} from 'utils/paymentsTab';

const money = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 2 });

export default function PaymentRow({ payment, onEdit, onDelete }) {
  const theme = useTheme();
  const [anchorEl, setAnchorEl] = useState(null);
  const status = normalizePaymentStatus(payment);
  const statusView = getPaymentStatusPresentation(status);
  const type = getPaymentType(payment);
  const online = isOnlinePayment(payment);
  const reference = getPaymentReference(payment);

  return (
    <Box
      sx={{
        px: { xs: 1.5, md: 2 },
        py: { xs: 1.55, md: 1.35 },
        display: { xs: 'block', md: 'grid' },
        gridTemplateColumns: 'minmax(240px, 1.45fr) minmax(190px, 1.05fr) minmax(150px, .82fr) minmax(105px, .58fr) 44px',
        gap: { xs: 1.2, md: 2 },
        alignItems: 'center',
        borderBottom: `1px solid ${alpha(theme.palette.divider, 0.13)}`,
        '&:hover': { bgcolor: alpha(theme.palette.success.main, theme.palette.mode === 'dark' ? 0.07 : 0.025) }
      }}
    >
      <Stack direction="row" spacing={1.25} alignItems="center" minWidth={0}>
        <Avatar sx={{ width: 38, height: 38, bgcolor: alpha(theme.palette.success.main, 0.11), color: 'success.main' }}>
          <DollarOutlined />
        </Avatar>
        <Box minWidth={0}>
          <Typography fontWeight={700} noWrap>{getPaymentTitle(payment)}</Typography>
          <Typography noWrap sx={{ mt: 0.25, fontSize: '0.75rem', color: 'text.secondary' }}>{reference}</Typography>
        </Box>
      </Stack>

      <Box minWidth={0} sx={{ mt: { xs: 1.05, md: 0 } }}>
        <Typography component="span" sx={{ display: { md: 'none' }, mr: 0.6, fontSize: '0.7rem', color: 'text.secondary' }}>Property:</Typography>
        <Typography component="span" sx={{ fontSize: '0.82rem', fontWeight: 650 }}>{getPaymentLocation(payment)}</Typography>
        <Typography sx={{ mt: 0.25, fontSize: '0.72rem', color: 'text.secondary' }}>
          {type === 'rent' ? 'Rent' : type === 'fee' ? 'Lease fee' : 'Deposit'}
        </Typography>
      </Box>

      <Box sx={{ mt: { xs: 0.8, md: 0 } }}>
        <Typography component="span" sx={{ display: { md: 'none' }, mr: 0.6, fontSize: '0.7rem', color: 'text.secondary' }}>Date:</Typography>
        <Typography component="span" sx={{ fontSize: '0.8rem', fontWeight: 600 }}>
          {formatPaymentDate(readPayment(payment, 'paymentDate', 'PaymentDate'))}
        </Typography>
        <Stack direction="row" spacing={0.6} sx={{ mt: 0.45 }} flexWrap="wrap" useFlexGap>
          <Chip
            label={statusView.label}
            size="small"
            color={statusView.color}
            variant={status === 'completed' ? 'filled' : 'outlined'}
            sx={{ height: 20, fontSize: '0.65rem' }}
          />
          <Chip
            label={online ? 'Online' : getPaymentMethod(payment)}
            size="small"
            variant="outlined"
            sx={{ height: 20, maxWidth: 120, fontSize: '0.65rem' }}
          />
        </Stack>
      </Box>

      <Typography sx={{ mt: { xs: 0.8, md: 0 }, fontSize: '0.94rem', fontWeight: 760, color: status === 'completed' ? 'success.dark' : 'text.primary', textAlign: { md: 'right' } }}>
        <Box component="span" sx={{ display: { md: 'none' }, mr: 0.6, fontSize: '0.7rem', fontWeight: 400, color: 'text.secondary' }}>Amount:</Box>
        {money.format(getPaymentAmount(payment))}
      </Typography>

      <Box sx={{ display: 'flex', justifyContent: { xs: 'flex-end', md: 'center' } }}>
        <Tooltip title="Payment actions">
          <IconButton size="small" aria-label={`Actions for ${reference}`} onClick={(event) => setAnchorEl(event.currentTarget)}><MoreOutlined /></IconButton>
        </Tooltip>
        <Menu anchorEl={anchorEl} open={Boolean(anchorEl)} onClose={() => setAnchorEl(null)}>
          <MenuItem onClick={() => { setAnchorEl(null); onEdit(payment); }}><EditOutlined style={{ marginRight: 10 }} />Edit payment</MenuItem>
          <MenuItem sx={{ color: 'error.main' }} onClick={() => { setAnchorEl(null); onDelete(payment); }}><DeleteOutlined style={{ marginRight: 10 }} />Delete payment</MenuItem>
        </Menu>
      </Box>
    </Box>
  );
}

PaymentRow.propTypes = {
  payment: PropTypes.object.isRequired,
  onEdit: PropTypes.func.isRequired,
  onDelete: PropTypes.func.isRequired
};
