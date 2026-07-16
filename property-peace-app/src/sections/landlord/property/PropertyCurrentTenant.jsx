import { useState } from 'react';
import { alpha, Avatar, Box, Button, Chip, Divider, Stack, Typography, useTheme } from '@mui/material';
import { MailOutlined, PhoneOutlined, ArrowRightOutlined } from '@ant-design/icons';
import MainCard from 'components/MainCard';
import { useNavigate } from 'react-router-dom';
import { format, parseISO } from 'date-fns';
import { formatPhone } from 'utils/formatters';
import TenantMessageDrawer from 'components/drawers/TenantMessageDrawer';
import { darkModeActionButtonSx, propertyAccentCardSx } from './propertyAccentSx';

export default function PropertyCurrentTenant({ property }) {
  const theme = useTheme();
  const navigate = useNavigate();
  const [messageDrawerOpen, setMessageDrawerOpen] = useState(false);

  const units = property?.units || property?.Units || [];
  const firstUnit = units[0];
  const lease = firstUnit?.lease || firstUnit?.Lease;
  const tenants = lease?.tenants || lease?.Tenants || [];
  const tenant = tenants[0];

  if (!tenant) {
    return (
      <MainCard title="Current Tenant" contentSX={{ pt: 1 }} sx={propertyAccentCardSx(theme.palette.success.main, { '& .MuiCardHeader-root': { pb: 1 } })}>
        <Typography variant="body2" color="text.secondary" sx={{ py: 1 }}>
          No active tenant on this property.
        </Typography>
      </MainCard>
    );
  }

  const firstName = tenant.firstname || tenant.Firstname || '';
  const lastName = tenant.lastname || tenant.Lastname || '';
  const fullName = `${firstName} ${lastName}`.trim();
  const initials = `${firstName[0] || ''}${lastName[0] || ''}`.toUpperCase();
  const email = tenant.email || tenant.Email || '';
  const phone = tenant.phoneNumber || tenant.PhoneNumber || '';
  const tenantId = tenant.id || tenant.Id;

  const leaseStart = lease?.startDate || lease?.StartDate;
  const tenantSince = leaseStart
    ? `Tenant since ${format(parseISO(leaseStart), 'MMM yyyy')}`
    : 'Active tenant';

  // Payment status — check overdueAmount on lease
  const overdueAmount = lease?.overdueAmount || lease?.OverdueAmount || 0;
  const isOnTime = !overdueAmount || overdueAmount === 0;

  const unitStatus = (firstUnit?.status || firstUnit?.Status || '').toLowerCase();
  const statusLabel = unitStatus === 'overdue' ? 'overdue' : 'on time';
  const statusColor = unitStatus === 'overdue' ? 'error' : 'success';

  return (
    <MainCard
      title={
        <Typography variant="overline" fontWeight={700} sx={{ fontSize: '0.75rem', letterSpacing: 1, color: 'text.secondary' }}>
          CURRENT TENANT
        </Typography>
      }
      secondary={
        <Chip
          label={`✓ ${statusLabel}`}
          size="small"
          sx={{
            height: 22,
            fontSize: '0.7rem',
            fontWeight: 700,
            bgcolor: (t) => alpha(statusColor === 'error' ? t.palette.error.main : t.palette.success.main, 0.12),
            color: (t) => statusColor === 'error' ? t.palette.error.main : t.palette.success.main,
            border: 'none'
          }}
        />
      }
      contentSX={{ pt: 1 }}
      sx={propertyAccentCardSx(theme.palette.success.main, { '& .MuiCardHeader-root': { pb: 1 } })}
    >
      <Stack direction="row" alignItems="center" spacing={1.5} sx={{ mb: 1.5 }}>
        <Avatar
          sx={{ width: 44, height: 44, bgcolor: theme.palette.success.main, fontWeight: 700, fontSize: '1rem' }}
        >
          {initials}
        </Avatar>
        <Box>
          <Typography variant="subtitle1" fontWeight={700} sx={{ lineHeight: 1.2 }}>{fullName}</Typography>
          <Typography variant="caption" color="text.secondary">{tenantSince}</Typography>
        </Box>
      </Stack>

      <Divider sx={{ mb: 1.5, borderColor: (t) => t.palette.mode === 'dark' ? alpha('#cbd5e1', 0.16) : alpha(t.palette.divider, 0.18) }} />

      <Stack spacing={0.75} sx={{ mb: 2 }}>
        {email && (
          <Stack direction="row" alignItems="center" spacing={1}>
            <MailOutlined style={{ fontSize: 13, color: theme.palette.text.secondary }} />
            <Typography variant="caption" color="text.secondary" sx={{ fontSize: '0.8rem' }}>{email}</Typography>
          </Stack>
        )}
        {phone && (
          <Stack direction="row" alignItems="center" spacing={1}>
            <PhoneOutlined style={{ fontSize: 13, color: theme.palette.text.secondary }} />
            <Typography variant="caption" color="text.secondary" sx={{ fontSize: '0.8rem' }}>{formatPhone(phone)}</Typography>
          </Stack>
        )}
      </Stack>

      <Stack direction="row" spacing={1}>
        <Button
          variant="contained"
          size="small"
          fullWidth
          onClick={() => setMessageDrawerOpen(true)}
          sx={{ textTransform: 'none', fontWeight: 600, borderRadius: 1.5, fontSize: '0.8rem' }}
        >
          Message
        </Button>
        <Button
          variant="outlined"
          size="small"
          fullWidth
          onClick={() => tenantId && navigate(`/landlord/tenants/${tenantId}`)}
          sx={darkModeActionButtonSx(theme.palette.primary.main, { textTransform: 'none', fontWeight: 600, borderRadius: 1.5, fontSize: '0.8rem' })}
        >
          Profile
        </Button>
      </Stack>

      <TenantMessageDrawer
        open={messageDrawerOpen}
        onClose={() => setMessageDrawerOpen(false)}
        tenant={tenant}
        property={property}
      />
    </MainCard>
  );
}
