import { useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useSelector } from 'react-redux';
import { alpha, Box, Button, Card, CardContent, Chip, Stack, Typography, useTheme } from '@mui/material';
import { selectDashboardSummary } from 'store/dashboard/dashboard.selector';
import { ArrowRightOutlined, ToolOutlined, DollarOutlined, FileTextOutlined, WarningOutlined, MessageOutlined, CloseCircleOutlined, CheckCircleOutlined } from '@ant-design/icons';
import { differenceInDays, parseISO } from 'date-fns';
import useFetchNotifications from 'hooks/useFetchNotifications';

export default function TodaysPriorities({ properties = [], summary = {}, allPayments = [] }) {
  const theme = useTheme();
  const navigate = useNavigate();
  const navyBlue = '#061e35';
  const actionGreen = theme.palette.success.main;
  const dashboardSummary = useSelector(selectDashboardSummary);
  const allRequests = dashboardSummary?.maintenanceRequests?.maintenanceRequests || [];
  const { notifications } = useFetchNotifications();


  const allPriorities = useMemo(() => {
    const items = [];

    // Overdue rent — use backend-computed status
    if (properties?.length) {
      properties.forEach((p) => {
        (p.units || p.Units || []).forEach((u) => {
          const unitStatus = (u.status || u.Status || '').toLowerCase();
          if (unitStatus !== 'overdue') return;
          const lease = u.lease || u.Lease;
          const tenantName = u.tenantName || u.TenantName || lease?.tenants?.[0]?.firstname || '';
          const propertyLabel = `${p.name || p.Name}${u.name || u.Name ? `, ${u.name || u.Name}` : ''}`;
          const rentDue = lease.rentDueDate || lease.RentDueDate;
          if (rentDue) {
            const daysOverdue = differenceInDays(new Date(), parseISO(rentDue));
            if (daysOverdue > 0) {
              items.push({
                id: `overdue-${lease.id || lease.Id}`,
                propertyId: p.id || p.Id,
                type: 'OVERDUE',
                dotColor: theme.palette.error.main,
                chipColor: 'error',
                urgent: true,
                icon: <DollarOutlined style={{ fontSize: 16 }} />,
                title: `Rent overdue · ${propertyLabel}`,
                description: tenantName ? `${tenantName} · ${daysOverdue} day${daysOverdue !== 1 ? 's' : ''} late` : `${daysOverdue} day${daysOverdue !== 1 ? 's' : ''} late`,
                actionLabel: 'Review',
                onAction: () => navigate('/landlord/accounting')
              });
            }
          }
        });
      });
    }

    // High priority maintenance
    allRequests
      .filter((r) =>
        (r.priority || '').toLowerCase() === 'high' &&
        !['completed', 'cancelled'].includes((r.status || '').toLowerCase())
      )
      .slice(0, 3)
      .forEach((m) => {
        items.push({
          id: `maint-high-${m.id || m.Id}`,
          propertyId: m.propertyId || m.PropertyId || null,
          type: 'URGENT',
          dotColor: theme.palette.error.main,
          chipColor: 'error',
          urgent: true,
          icon: <WarningOutlined style={{ fontSize: 16 }} />,
          title: m.title || m.Title || 'Maintenance request',
          description: m.propertyName || m.PropertyName
            ? `${m.propertyName || m.PropertyName}${m.unitName || m.UnitName ? ` · ${m.unitName || m.UnitName}` : ''}`
            : 'Vendor not yet assigned',
          actionLabel: 'View ticket',
          onAction: () => navigate(`/landlord/maintenance/${m.id || m.Id}`)
        });
      });

    // Medium maintenance
    allRequests
      .filter((r) =>
        (r.priority || '').toLowerCase() === 'medium' &&
        !['completed', 'cancelled'].includes((r.status || '').toLowerCase())
      )
      .slice(0, 2)
      .forEach((m) => {
        items.push({
          id: `maint-med-${m.id || m.Id}`,
          propertyId: m.propertyId || m.PropertyId || null,
          type: 'MAINTENANCE',
          dotColor: theme.palette.warning.main,
          chipColor: 'warning',
          urgent: false,
          icon: <ToolOutlined style={{ fontSize: 16 }} />,
          title: m.title || m.Title || 'Maintenance request',
          description: m.propertyName || m.PropertyName || '',
          actionLabel: 'View ticket',
          onAction: () => navigate(`/landlord/maintenance/${m.id || m.Id}`)
        });
      });

    // Expiring leases within 60 days — only for occupied (active, not overdue) units
    if (properties?.length) {
      properties.forEach((p) => {
        (p.units || p.Units || []).forEach((u) => {
          const unitStatus = (u.status || u.Status || '').toLowerCase();
          if (unitStatus !== 'occupied') return;
          const lease = u.lease || u.Lease;
          const endDate = lease.endDate || lease.EndDate;
          if (!endDate) return;
          const daysUntilEnd = differenceInDays(parseISO(endDate), new Date());
          if (daysUntilEnd >= 0 && daysUntilEnd <= 60) {
            const propertyLabel = `${p.name || p.Name}${u.name || u.Name ? ` · ${u.name || u.Name}` : ''}`;
            items.push({
              id: `lease-${lease.id || lease.Id}`,
              propertyId: p.id || p.Id,
              type: 'LEASE',
              dotColor: theme.palette.warning.main,
              chipColor: 'warning',
              urgent: false,
              icon: <FileTextOutlined style={{ fontSize: 16 }} />,
              title: `Lease expires in ${daysUntilEnd} day${daysUntilEnd !== 1 ? 's' : ''} · ${propertyLabel}`,
              description: 'Auto-renewal not set · suggest renewal terms',
              actionLabel: 'Send renewal',
              onAction: () => navigate('/landlord/leases?view=renewals')
            });
          }
        });
      });
    }

    // Failed payments
    allPayments
      .filter((p) => (p.status || p.Status || '').toLowerCase() === 'failed')
      .slice(0, 2)
      .forEach((p) => {
        const propertyName = p.propertyName || p.PropertyName || '';
        const unitName = p.unitName || p.UnitName || '';
        const label = [propertyName, unitName].filter(Boolean).join(' · ') || 'Payment';
        const amount = p.amount ?? p.Amount;
        items.push({
          id: `failed-pay-${p.id ?? p.Id}`,
          propertyId: p.propertyId || p.PropertyId || null,
          type: 'PAYMENT',
          dotColor: theme.palette.error.main,
          chipColor: 'error',
          urgent: true,
          icon: <CloseCircleOutlined style={{ fontSize: 16 }} />,
          title: `Payment failed · ${label}`,
          description: amount != null ? `$${Number(amount).toFixed(2)} — retry or contact tenant` : 'Retry or contact tenant',
          actionLabel: 'View payment',
          onAction: () => navigate('/landlord/payments')
        });
      });

    // Unread tenant messages
    const unreadMessageNotifs = (notifications || []).filter(
      (n) => !n.isRead && (n.type || '').toLowerCase() === 'message'
    );
    if (unreadMessageNotifs.length > 0) {
      items.push({
        id: 'unread-messages',
        propertyId: null,
        type: 'MESSAGE',
        dotColor: theme.palette.info.main,
        chipColor: 'info',
        urgent: false,
        icon: <MessageOutlined style={{ fontSize: 16 }} />,
        title: `${unreadMessageNotifs.length} unread tenant message${unreadMessageNotifs.length !== 1 ? 's' : ''}`,
        description: 'Respond to keep tenants informed',
        actionLabel: 'View messages',
        onAction: () => navigate('/landlord/messages')
      });
    }

    return items.slice(0, 8);
  }, [allRequests, allPayments, notifications, properties, navigate, theme]);

  const priorities = allPriorities;

  return (
    <Card
      sx={(t) => ({
        '--card-accent': t.palette.primary.main,
        border: `1px solid ${t.palette.mode === 'dark' ? alpha(t.palette.primary.main, 0.42) : alpha(t.palette.divider, 0.8)}`,
        borderRadius: 2.25,
        boxShadow: t.palette.mode === 'dark'
          ? `0 18px 46px ${alpha(t.palette.common.black, 0.26)}, 0 0 0 1px ${alpha(t.palette.primary.main, 0.2)}, 0 0 28px ${alpha(t.palette.primary.main, 0.16)}`
          : `0 14px 36px ${alpha(t.palette.common.black, 0.06)}`,
        backgroundImage: t.palette.mode === 'dark'
          ? `linear-gradient(180deg, ${alpha('#ffffff', 0.045)} 0%, ${alpha(t.palette.primary.main, 0.025)} 100%)`
          : 'none',
        bgcolor: 'background.paper',
        overflow: 'hidden',
        height: '100%',
        display: 'flex',
        flexDirection: 'column',
        '&:hover': {
          boxShadow: t.palette.mode === 'dark'
            ? `0 20px 52px ${alpha(t.palette.common.black, 0.3)}, 0 0 0 1px ${alpha(t.palette.primary.main, 0.28)}, 0 0 34px ${alpha(t.palette.primary.main, 0.2)}`
            : `0 16px 42px ${alpha(t.palette.common.black, 0.08)}`,
          borderColor: t.palette.mode === 'dark' ? alpha(t.palette.primary.main, 0.52) : alpha(t.palette.divider, 0.95)
        }
      })}
    >
      {/* Header */}
      <Box sx={{ bgcolor: 'background.paper', px: 2.5, py: 1.75, borderBottom: (t) => `1px solid ${t.palette.mode === 'dark' ? alpha('#cbd5e1', 0.18) : alpha(t.palette.divider, 0.8)}` }}>
        {/* Row 1: title + actions */}
        <Stack direction="row" alignItems="center" justifyContent="space-between" flexWrap="wrap" gap={1}>
          <Typography variant="h5" fontWeight={700} sx={{ fontSize: { xs: '1rem', sm: '1.25rem' }, color: 'text.primary' }}>
            Needs Your Attention
          </Typography>

          {/* Right: view all */}
          <Stack direction="row" alignItems="center" spacing={0.5}>
            <Button size="small" variant="text"
              endIcon={<ArrowRightOutlined style={{ fontSize: 12 }} />}
              onClick={() => navigate('/landlord/priorities')}
              sx={{ textTransform: 'none', fontSize: '0.8rem', fontWeight: 500, color: 'text.secondary', whiteSpace: 'nowrap', '&:hover': { color: 'text.primary' } }}
            >
              View all
            </Button>
          </Stack>
        </Stack>
      </Box>

      <CardContent sx={{ p: 0, '&:last-child': { pb: 0 } }}>
        {priorities.length === 0 ? (
          <Box sx={{ minHeight: 200, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', textAlign: 'center', gap: 1.5 }}>
            <Box sx={{ display: 'inline-flex', p: 1.5, borderRadius: '50%', bgcolor: alpha(theme.palette.success.main, 0.08) }}>
              <CheckCircleOutlined style={{ fontSize: 26, color: theme.palette.success.main }} />
            </Box>
            <Typography variant="body2" color="text.secondary">
              Everything looks good — no urgent items today.
            </Typography>
          </Box>
        ) : (
          <Stack>
            {priorities.map((item, idx) => (
              <Box
                key={item.id}
                sx={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 2,
                  py: 1.5,
                  px: 2.5,
                  borderBottom: idx < priorities.length - 1 ? `1px solid ${alpha(theme.palette.divider, 0.08)}` : 'none',
                  transition: 'background 0.15s',
                  '&:hover': { bgcolor: alpha(item.dotColor, 0.03) }
                }}
              >
                {/* Icon */}
                <Box sx={{
                  width: 36, height: 36, borderRadius: 1.5, flexShrink: 0,
                  bgcolor: alpha(navyBlue, 0.1),
                  display: { xs: 'none', sm: 'flex' }, alignItems: 'center', justifyContent: 'center',
                  color: navyBlue
                }}>
                  {item.icon}
                </Box>

                {/* Text */}
                <Box sx={{ flex: 1, minWidth: 0 }}>
                  <Stack direction="row" alignItems="center" spacing={1} sx={{ mb: 0.25 }}>
                    <Typography variant="body2" fontWeight={600} noWrap sx={{ fontSize: '0.9rem' }}>
                      {item.title}
                    </Typography>
                    <Chip label={item.type} size="small"
                      sx={{ height: 18, fontSize: '0.6rem', fontWeight: 700, letterSpacing: 0.4, flexShrink: 0,
                        bgcolor: alpha(navyBlue, 0.1), color: navyBlue, '& .MuiChip-label': { px: 0.6 } }} />
                  </Stack>
                  {item.description && (
                    <Typography variant="caption" color="text.secondary" noWrap sx={{ fontSize: '0.78rem' }}>
                      {item.description}
                    </Typography>
                  )}
                </Box>

                {/* Action */}
                <Button
                  size="small"
                  variant="text"
                  endIcon={<ArrowRightOutlined style={{ fontSize: 11 }} />}
                  onClick={item.onAction}
                  sx={{
                    textTransform: 'none', fontWeight: 600, flexShrink: 0, whiteSpace: 'nowrap',
                    fontSize: '0.8rem', color: actionGreen,
                    '&:hover': { bgcolor: alpha(actionGreen, 0.08) }
                  }}
                >
                  {item.actionLabel}
                </Button>
              </Box>
            ))}
          </Stack>
        )}
      </CardContent>
    </Card>
  );
}
