import ThemeAdaptiveDrawer from 'components/drawers/shared/ThemeAdaptiveDrawer';
import { alpha, Avatar, Box, Button, Chip, Divider, IconButton, Stack, Typography, useTheme } from '@mui/material';
import {
  CloseOutlined, MailOutlined, PhoneOutlined, HomeOutlined,
  FileTextOutlined, MessageOutlined, ToolOutlined, ArrowRightOutlined
} from '@ant-design/icons';
import { useNavigate } from 'react-router-dom';
import { format, differenceInDays, differenceInMonths } from 'date-fns';
import { formatCurrency, formatPhone } from 'utils/formatters';
import { getLeasePagePath, getUnitStatusPresentation } from 'utils/unitPresentation';
import { useDrawer } from 'contexts/DrawerContext';
import { isOpenMaintenanceRequest } from 'utils/maintenanceStatus';

function InfoRow({ label, value }) {
  return (
    <Stack direction="row" justifyContent="space-between" alignItems="flex-start" sx={{ py: 0.6 }}>
      <Typography sx={{ fontSize: '0.78rem', color: 'text.secondary', flexShrink: 0, mr: 1 }}>{label}</Typography>
      <Typography sx={{ fontSize: '0.78rem', fontWeight: 600, textAlign: 'right' }}>{value || '—'}</Typography>
    </Stack>
  );
}

export default function UnitDetailDrawer({ open, unit, property, onClose }) {
  const theme = useTheme();
  const navigate = useNavigate();
  const drawer = useDrawer();

  if (!unit) return null;

  const unitName = unit.name || unit.Name || 'Unit';
  const statusPresentation = getUnitStatusPresentation(unit.status || unit.Status);
  const statusColor = {
    success: theme.palette.success.main,
    error: theme.palette.error.main,
    warning: theme.palette.warning.dark,
    info: theme.palette.info.main,
    neutral: theme.palette.text.secondary
  }[statusPresentation.tone];

  const beds = unit.bedrooms || unit.Bedrooms;
  const baths = unit.baths || unit.Baths;
  const sqft = unit.squareFeet || unit.SquareFeet;

  const lease = unit.lease || unit.Lease;
  const tenants = lease?.tenants || lease?.Tenants || [];
  const primaryTenant = tenants[0];
  const tenantId = primaryTenant?.id || primaryTenant?.Id;
  const firstName = primaryTenant?.firstname || primaryTenant?.Firstname || '';
  const lastName = primaryTenant?.lastname || primaryTenant?.Lastname || '';
  const tenantName = `${firstName} ${lastName}`.trim();
  const initials = `${firstName[0] || ''}${lastName[0] || ''}`.toUpperCase();
  const email = primaryTenant?.email || primaryTenant?.Email || '';
  const phone = primaryTenant?.phoneNumber || primaryTenant?.PhoneNumber || '';

  const leaseId = lease?.id || lease?.Id;
  const leaseStart = lease?.startDate || lease?.StartDate;
  const leaseEnd = lease?.endDate || lease?.EndDate;
  const rentAmount = lease?.rentAmount || lease?.RentAmount || unit.rentAmount || unit.RentAmount || 0;
  const securityDeposit = lease?.securityDeposit || lease?.SecurityDeposit || 0;
  const overdueAmount = lease?.overdueAmount || lease?.OverdueAmount || 0;

  const leaseEndDate = leaseEnd ? new Date(leaseEnd) : null;
  const leaseStartDate = leaseStart ? new Date(leaseStart) : null;
  const monthsLeft = leaseEndDate ? differenceInMonths(leaseEndDate, new Date()) : null;
  const daysLeft = leaseEndDate ? differenceInDays(leaseEndDate, new Date()) : null;
  const timeLeftStr = monthsLeft !== null && monthsLeft > 0
    ? `${monthsLeft} mo left`
    : daysLeft !== null && daysLeft > 0
    ? `${daysLeft} days left`
    : daysLeft !== null && daysLeft <= 0
    ? 'Expired'
    : null;

  const maintenanceRequests = (property?.maintenanceRequests || []).filter(
    (r) => (r.unitId || r.UnitId) === (unit.id || unit.Id)
  );
  const openTickets = maintenanceRequests.filter(isOpenMaintenanceRequest);

  const propertyId = property?.id || property?.Id;
  const leasePagePath = getLeasePagePath(leaseId);

  const handleOpenLease = () => {
    if (!leasePagePath) return;
    onClose();
    navigate(leasePagePath);
  };

  return (
    <ThemeAdaptiveDrawer
      anchor="right"
      open={open}
      onClose={onClose}
      PaperProps={{ sx: { width: { xs: '100%', sm: 420 }, bgcolor: 'background.default' } }}
    >
      {/* Header */}
      <Box sx={{ px: 2.5, py: 2, bgcolor: 'background.paper', borderBottom: '1px solid rgba(0,0,0,0.08)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <Box>
          <Stack direction="row" alignItems="center" spacing={1.25}>
            <Typography variant="h6" fontWeight={700}>{unitName}</Typography>
            <Stack direction="row" alignItems="center" spacing={0.6}>
              <Box sx={{ width: 6, height: 6, borderRadius: '50%', bgcolor: statusColor }} />
              <Typography sx={{ fontSize: '0.7rem', color: statusColor, fontWeight: 700 }}>
                {statusPresentation.label}
              </Typography>
            </Stack>
          </Stack>
          {property?.name && (
            <Typography sx={{ fontSize: '0.75rem', color: 'text.secondary', mt: 0.25 }}>{property.name}</Typography>
          )}
        </Box>
        <IconButton aria-label="Close unit details" size="small" onClick={onClose}>
          <CloseOutlined style={{ fontSize: 16 }} />
        </IconButton>
      </Box>

      <Box sx={{ flex: 1, overflowY: 'auto', p: 2.5 }}>
        <Stack spacing={2}>

          {/* Unit specs */}
          <Box sx={{ p: 1.75, bgcolor: 'background.paper', borderRadius: 2, border: '1px solid rgba(0,0,0,0.08)' }}>
            <Typography sx={{ fontSize: '0.62rem', fontWeight: 700, letterSpacing: 0.8, color: alpha('#061e35', 0.58), textTransform: 'uppercase', mb: 1 }}>Unit Details</Typography>
            <Stack direction="row" spacing={2.5} flexWrap="wrap">
              {beds && (
                <Box>
                  <Typography sx={{ fontSize: '0.65rem', color: 'text.secondary' }}>Beds</Typography>
                  <Typography fontWeight={700}>{beds}</Typography>
                </Box>
              )}
              {baths && (
                <Box>
                  <Typography sx={{ fontSize: '0.65rem', color: 'text.secondary' }}>Baths</Typography>
                  <Typography fontWeight={700}>{baths}</Typography>
                </Box>
              )}
              {sqft > 0 && (
                <Box>
                  <Typography sx={{ fontSize: '0.65rem', color: 'text.secondary' }}>Sq ft</Typography>
                  <Typography fontWeight={700}>{Number(sqft).toLocaleString()}</Typography>
                </Box>
              )}
              {rentAmount > 0 && (
                <Box>
                  <Typography sx={{ fontSize: '0.65rem', color: 'text.secondary' }}>Rent</Typography>
                  <Typography fontWeight={700} sx={{ color: theme.palette.success.main }}>{formatCurrency(rentAmount)}/mo</Typography>
                </Box>
              )}
            </Stack>
          </Box>

          {/* Tenant */}
          <Box sx={{ p: 1.75, bgcolor: 'background.paper', borderRadius: 2, border: '1px solid rgba(0,0,0,0.08)' }}>
            <Typography sx={{ fontSize: '0.62rem', fontWeight: 700, letterSpacing: 0.8, color: alpha('#061e35', 0.58), textTransform: 'uppercase', mb: 1 }}>Tenant</Typography>
            {primaryTenant ? (
              <>
                <Stack direction="row" alignItems="center" spacing={1.5} sx={{ mb: 1.5 }}>
                  <Avatar sx={{ width: 40, height: 40, bgcolor: theme.palette.primary.main, fontWeight: 700 }}>{initials}</Avatar>
                  <Box>
                    <Typography fontWeight={700} sx={{ fontSize: '0.95rem', lineHeight: 1.2 }}>{tenantName}</Typography>
                    {leaseStartDate && (
                      <Typography sx={{ fontSize: '0.72rem', color: 'text.secondary' }}>
                        Tenant since {format(leaseStartDate, 'MMM yyyy')}
                      </Typography>
                    )}
                  </Box>
                </Stack>
                <Stack spacing={0.5} sx={{ mb: 1.5 }}>
                  {email && (
                    <Stack direction="row" alignItems="center" spacing={1}>
                      <MailOutlined style={{ fontSize: 12, color: theme.palette.text.secondary }} />
                      <Typography sx={{ fontSize: '0.78rem', color: 'text.secondary' }}>{email}</Typography>
                    </Stack>
                  )}
                  {phone && (
                    <Stack direction="row" alignItems="center" spacing={1}>
                      <PhoneOutlined style={{ fontSize: 12, color: theme.palette.text.secondary }} />
                      <Typography sx={{ fontSize: '0.78rem', color: 'text.secondary' }}>{formatPhone(phone)}</Typography>
                    </Stack>
                  )}
                </Stack>
                {overdueAmount > 0 && (
                  <Box sx={{ px: 1.25, py: 0.75, bgcolor: alpha(theme.palette.error.main, 0.08), borderRadius: 1.5, mb: 1.5 }}>
                    <Typography sx={{ fontSize: '0.78rem', color: theme.palette.error.main, fontWeight: 600 }}>
                      {formatCurrency(overdueAmount)} overdue
                    </Typography>
                  </Box>
                )}
                <Stack direction="row" spacing={1}>
                  <Button
                    variant="contained"
                    size="small"
                    fullWidth
                    startIcon={<MessageOutlined />}
                    onClick={() => navigate('/landlord/messages')}
                    sx={{ textTransform: 'none', fontWeight: 600, borderRadius: 1.5, fontSize: '0.78rem' }}
                  >
                    Message
                  </Button>
                  <Button
                    variant="outlined"
                    size="small"
                    fullWidth
                    onClick={() => tenantId && navigate(`/landlord/renters/${tenantId}`)}
                    sx={{ textTransform: 'none', fontWeight: 600, borderRadius: 1.5, fontSize: '0.78rem', borderColor: 'rgba(0,0,0,0.2)' }}
                  >
                    Profile
                  </Button>
                </Stack>
              </>
            ) : (
              <Typography sx={{ fontSize: '0.85rem', color: 'text.disabled', py: 0.5 }}>No tenant — unit is vacant</Typography>
            )}
          </Box>

          {/* Lease */}
          {lease && (
            <Box sx={{ p: 1.75, bgcolor: 'background.paper', borderRadius: 2, border: '1px solid rgba(0,0,0,0.08)' }}>
              <Typography sx={{ fontSize: '0.62rem', fontWeight: 700, letterSpacing: 0.8, color: alpha('#061e35', 0.58), textTransform: 'uppercase', mb: 0.75 }}>Lease</Typography>
              <Divider sx={{ mb: 1, borderColor: 'rgba(0,0,0,0.06)' }} />
              {leaseStartDate && <InfoRow label="Start date" value={format(leaseStartDate, 'MMM d, yyyy')} />}
              {leaseEndDate && <InfoRow label="End date" value={format(leaseEndDate, 'MMM d, yyyy')} />}
              {timeLeftStr && <InfoRow label="Time remaining" value={timeLeftStr} />}
              {rentAmount > 0 && <InfoRow label="Monthly rent" value={formatCurrency(rentAmount)} />}
              {securityDeposit > 0 && <InfoRow label="Security deposit" value={formatCurrency(securityDeposit)} />}
              {leasePagePath && (
                <Button
                  variant="contained"
                  size="small"
                  fullWidth
                  startIcon={<FileTextOutlined />}
                  endIcon={<ArrowRightOutlined />}
                  onClick={handleOpenLease}
                  sx={{
                    textTransform: 'none',
                    fontWeight: 700,
                    fontSize: '0.8rem',
                    mt: 1.25,
                    borderRadius: 1.5,
                    justifyContent: 'space-between',
                    px: 1.5
                  }}
                >
                  Open lease page
                </Button>
              )}
            </Box>
          )}

          {/* Quick actions */}
          <Box sx={{ p: 1.75, bgcolor: 'background.paper', borderRadius: 2, border: '1px solid rgba(0,0,0,0.08)' }}>
            <Typography sx={{ fontSize: '0.62rem', fontWeight: 700, letterSpacing: 0.8, color: alpha('#061e35', 0.58), textTransform: 'uppercase', mb: 1 }}>Quick Actions</Typography>
            <Stack spacing={0.75}>
              <Button
                variant="outlined"
                size="small"
                fullWidth
                startIcon={<ToolOutlined />}
                onClick={() => { onClose(); drawer.openMaintenanceAddDrawer({ propertyId, propertyName: property?.name, unitId: unit.id || unit.Id, unitName: unit.name || unit.Name }); }}
                sx={{ textTransform: 'none', fontWeight: 600, borderRadius: 1.5, fontSize: '0.8rem', borderColor: 'rgba(0,0,0,0.18)', justifyContent: 'flex-start' }}
              >
                Create maintenance ticket
              </Button>
              {!primaryTenant && (
                <Button
                  variant="outlined"
                  size="small"
                  fullWidth
                  startIcon={<HomeOutlined />}
                  onClick={() => { onClose(); drawer.openLeaseAddDrawer(unit.id || unit.Id, property); }}
                  sx={{ textTransform: 'none', fontWeight: 600, borderRadius: 1.5, fontSize: '0.8rem', borderColor: 'rgba(0,0,0,0.18)', justifyContent: 'flex-start' }}
                >
                  Add lease / move in tenant
                </Button>
              )}
            </Stack>
          </Box>

          {/* Open tickets */}
          {openTickets.length > 0 && (
            <Box sx={{ p: 1.75, bgcolor: 'background.paper', borderRadius: 2, border: '1px solid rgba(0,0,0,0.08)' }}>
              <Typography sx={{ fontSize: '0.62rem', fontWeight: 700, letterSpacing: 0.8, color: alpha('#061e35', 0.58), textTransform: 'uppercase', mb: 1 }}>
                Open Tickets ({openTickets.length})
              </Typography>
              <Stack spacing={0.75}>
                {openTickets.slice(0, 5).map((r) => {
                  const priority = (r.priority || '').toLowerCase();
                  const priorityColor = priority === 'high' ? theme.palette.error.main : priority === 'medium' ? theme.palette.warning.main : theme.palette.text.secondary;
                  return (
                    <Stack key={r.id || r.Id} direction="row" alignItems="center" justifyContent="space-between">
                      <Typography sx={{ fontSize: '0.78rem' }} noWrap>{r.title || r.Title || 'Ticket'}</Typography>
                      <Chip label={r.priority || 'normal'} size="small" sx={{ height: 18, fontSize: '0.62rem', fontWeight: 700, color: priorityColor, bgcolor: alpha(priorityColor, 0.1), '& .MuiChip-label': { px: 0.75 }, flexShrink: 0, ml: 1 }} />
                    </Stack>
                  );
                })}
              </Stack>
            </Box>
          )}

        </Stack>
      </Box>
    </ThemeAdaptiveDrawer>
  );
}
