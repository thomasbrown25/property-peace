import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useSelector } from 'react-redux';
import {
  alpha, Box, Button, Chip, Stack, ToggleButton,
  ToggleButtonGroup, Typography, useTheme
} from '@mui/material';
import {
  DollarOutlined, ToolOutlined, FileTextOutlined,
  RobotOutlined, CheckCircleOutlined, ExclamationCircleOutlined,
  PaperClipOutlined
} from '@ant-design/icons';
import MainCard from 'components/MainCard';
import { selectAllPayments } from 'store/payment/payment.selector';
import { selectMaintenanceRequests } from 'store/maintenance/maintenance.selector';
import { format, parseISO, formatDistanceToNow } from 'date-fns';
import { formatCurrency } from 'utils/formatters';
import { darkModeActionButtonSx, propertyAccentCardSx } from './propertyAccentSx';

const MAINT_STATUS_META = {
  reported:     { label: 'Reported',     color: 'error' },
  open:         { label: 'Reported',     color: 'error' },
  notstarted:   { label: 'Reported',     color: 'error' },
  acknowledged: { label: 'Acknowledged', color: 'warning' },
  pending:      { label: 'Pending',      color: 'warning' },
  scheduled:    { label: 'Scheduled',    color: 'info' },
  inprogress:   { label: 'In Progress',  color: 'info' },
  resolved:     { label: 'Resolved',     color: 'success' },
  completed:    { label: 'Resolved',     color: 'success' },
  cancelled:    { label: 'Cancelled',    color: 'default' },
};

const getMaintenanceStatusMeta = (status) => {
  const key = (status || '').replace(/[-_ ]/g, '');
  return MAINT_STATUS_META[key] || { label: status || '—', color: 'default' };
};

const TYPE_META = {
  money:       { label: 'RENT RECEIVED', color: '#16a34a', icon: <DollarOutlined /> },
  maintenance: { label: 'MAINTENANCE',   color: '#d97706', icon: <ToolOutlined /> },
  lease:       { label: 'LEASE STARTED', color: '#1464CC', icon: <FileTextOutlined /> },
  agent:       { label: 'AGENT',         color: '#7c3aed', icon: <RobotOutlined /> },
  due:         { label: 'DUE',           color: '#dc2626', icon: <ExclamationCircleOutlined /> },
  inspection:  { label: 'INSPECTION',    color: '#0891b2', icon: <CheckCircleOutlined /> },
};

function TypeBadge({ type }) {
  const meta = TYPE_META[type] || TYPE_META.maintenance;
  return (
    <Chip
      label={meta.label}
      size="small"
      sx={{
        height: 20,
        fontSize: '0.6rem',
        fontWeight: 700,
        letterSpacing: 0.5,
        bgcolor: alpha(meta.color, 0.1),
        color: meta.color,
        border: 'none',
        '& .MuiChip-label': { px: 0.75 }
      }}
    />
  );
}

function TimelineDot({ type, isLast }) {
  const meta = TYPE_META[type] || TYPE_META.maintenance;
  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', flexShrink: 0, width: 36, alignSelf: 'stretch' }}>
      <Box
        sx={{
          width: 36,
          height: 36,
          borderRadius: '50%',
          border: `2px solid ${meta.color}`,
          bgcolor: alpha(meta.color, 0.06),
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          color: meta.color,
          fontSize: 15,
          flexShrink: 0
        }}
      >
        {meta.icon}
      </Box>
      {!isLast && (
        <Box sx={{ width: 2, flex: 1, bgcolor: (t) => t.palette.mode === 'dark' ? alpha('#cbd5e1', 0.14) : alpha(t.palette.divider, 0.18), mt: 0.75 }} />
      )}
    </Box>
  );
}

function formatEventDate(raw) {
  try {
    const d = typeof raw === 'string' ? parseISO(raw) : new Date(raw);
    return `${format(d, 'MMM dd, yyyy').toUpperCase()} · ${formatDistanceToNow(d, { addSuffix: true })}`;
  } catch {
    return '';
  }
}

function StoryItem({ item, isLast }) {
  const theme = useTheme();
  const navigate = useNavigate();

  return (
    <Stack direction="row" spacing={0.5} alignItems="stretch" sx={{ position: 'relative' }}>
      <TimelineDot type={item.type} isLast={isLast} />

      <Box sx={{ flex: 1, minWidth: 0, pb: isLast ? 0 : 2.5 }}>
        {/* Content card — badge + date live inside */}
        <Box
          sx={{
            bgcolor: 'background.paper',
            border: (t) => `1px solid ${t.palette.mode === 'dark' ? alpha('#cbd5e1', 0.16) : alpha(t.palette.divider, 0.18)}`,
            boxShadow: (t) => t.palette.mode === 'dark' ? `0 10px 24px ${alpha(theme.palette.common.black, 0.2)}, 0 0 18px ${alpha((TYPE_META[item.type] || TYPE_META.maintenance).color, 0.08)}` : 'none',
            borderRadius: 2,
            p: 1.75
          }}
        >
          {/* Meta row inside card */}
          <Stack direction="row" alignItems="center" spacing={1} sx={{ mb: 0.75 }} flexWrap="wrap">
            <TypeBadge type={item.type} />
            <Typography variant="caption" color="text.disabled" sx={{ fontSize: '0.72rem' }}>
              {formatEventDate(item.date)}
            </Typography>
            {item.amount > 0 && (
              <Typography variant="subtitle2" fontWeight={700} sx={{ color: '#16a34a', ml: 'auto !important', fontSize: '1rem' }}>
                +{formatCurrency(item.amount)}
              </Typography>
            )}
          </Stack>

          <Typography variant="subtitle2" fontWeight={700} sx={{ fontSize: '0.9375rem', mb: item.description ? 0.35 : 0 }}>
            {item.title}
          </Typography>
          {item.description && (
            <Typography variant="caption" color="text.secondary" sx={{ fontSize: '0.8rem', display: 'block', mb: item.children?.length || item.attachments || item.actions?.length ? 1 : 0 }}>
              {item.description}
            </Typography>
          )}

          {/* Attachments */}
          {item.attachments > 0 && (
            <Stack direction="row" alignItems="center" spacing={0.5} sx={{ mb: 1 }}>
              <PaperClipOutlined style={{ fontSize: 12, color: theme.palette.text.secondary }} />
              <Typography variant="caption" color="text.secondary" sx={{ fontSize: '0.78rem' }}>
                {item.attachments} attachment{item.attachments !== 1 ? 's' : ''}
              </Typography>
            </Stack>
          )}

          {/* Sub-items (grouped maintenance tickets) */}
          {item.children?.length > 0 && (
            <Stack spacing={0.5} sx={{ mb: 1.25 }}>
              {item.children.map((child, i) => (
                <Stack key={i} direction="row" alignItems="center" justifyContent="space-between"
                  sx={{ bgcolor: (t) => alpha(t.palette.text.primary, t.palette.mode === 'dark' ? 0.045 : 0.025), borderRadius: 1, px: 1.25, py: 0.75 }}>
                  <Stack direction="row" alignItems="center" spacing={0.75}>
                    <Chip
                      label={child.priority}
                      size="small"
                      color={child.priority === 'high' ? 'error' : child.priority === 'low' ? 'default' : 'warning'}
                      sx={{ height: 18, fontSize: '0.6rem', '& .MuiChip-label': { px: 0.5 } }}
                    />
                    {child.maintenanceStatus && (
                      <Chip
                        label={getMaintenanceStatusMeta(child.maintenanceStatus).label}
                        size="small"
                        sx={{ height: 18, fontSize: '0.6rem', '& .MuiChip-label': { px: 0.5 } }}
                      />
                    )}
                    <Typography variant="caption" sx={{ fontSize: '0.8rem' }}>{child.title}</Typography>
                  </Stack>
                  <Typography variant="caption" color="text.disabled" sx={{ fontSize: '0.72rem', flexShrink: 0, ml: 1 }}>
                    {child.status}
                  </Typography>
                </Stack>
              ))}
            </Stack>
          )}

          {/* Action buttons */}
          {item.actions?.length > 0 && (
            <Stack direction="row" spacing={1} sx={{ mt: item.children?.length ? 0 : 0.5 }}>
              {item.actions.map((action, i) => (
                <Button
                  key={i}
                  size="small"
                  variant="outlined"
                  onClick={() => action.path && navigate(action.path)}
                  sx={darkModeActionButtonSx(theme.palette.primary.main, {
                    textTransform: 'none',
                    fontWeight: 600,
                    fontSize: '0.8rem',
                    px: 2,
                    color: 'text.primary'
                  })}
                >
                  {action.label} {i === 0 ? '→' : ''}
                </Button>
              ))}
            </Stack>
          )}
        </Box>
      </Box>
    </Stack>
  );
}

const RANGES = [
  { label: '6M', months: 6 },
  { label: '1Y', months: 12 },
  { label: 'All', months: null }
];

export default function PropertyStory({ property, propertyId }) {
  const theme = useTheme();
  const navigate = useNavigate();
  const [filter, setFilter] = useState('all');
  const [rangeIdx, setRangeIdx] = useState(0);

  const allPayments = useSelector(selectAllPayments);
  const allMaintenance = useSelector(selectMaintenanceRequests);

  const units = property?.units || property?.Units || [];
  const firstUnit = units[0];
  const lease = firstUnit?.lease || firstUnit?.Lease;
  const leaseId = lease?.id || lease?.Id;

  const numericPropertyId = Number(propertyId);

  const items = useMemo(() => {
    const events = [];

    // ── Rent payment events ──
    (allPayments || [])
      .filter((p) => (p.propertyId || p.PropertyId) === numericPropertyId)
      .forEach((p) => {
        const raw = p.paymentDate || p.PaymentDate;
        if (!raw) return;
        const tenants = lease?.tenants || lease?.Tenants || [];
        const t = tenants[0];
        const tenantName = t
          ? `${t.firstname || t.Firstname || ''} ${t.lastname || t.Lastname || ''}`.trim()
          : 'Tenant';
        const method = p.method || p.Method;
        const markedByLandlord = !!(p.createdByUserId || p.CreatedByUserId);
        const methodLabel = method || (markedByLandlord ? 'Manual entry' : 'ACH');
        const source = markedByLandlord ? 'Recorded by landlord' : 'on time';
        events.push({
          id: `pay-${p.id || p.Id}`,
          type: 'money',
          date: raw,
          title: `${tenantName} paid ${formatCurrency(p.amount || p.Amount)} rent`,
          description: `${methodLabel} · ${source} · auto-applied to ${format(new Date(raw), 'MMMM yyyy')} cycle`,
          amount: parseFloat(p.amount || p.Amount) || 0
        });
      });

    // ── Lease start event ──
    if (lease) {
      const startDate = lease.startDate || lease.StartDate;
      const endDate = lease.endDate || lease.EndDate;
      const rawLength = lease.leaseLength || lease.LeaseLength;
      const leaseLength = rawLength
        || (startDate && endDate
          ? Math.round(Math.abs((new Date(endDate) - new Date(startDate)) / (1000 * 60 * 60 * 24 * 30.44)))
          : null);
      const autoRenew = lease.autoRenew || lease.AutoRenew || false;
      const tenants = lease.tenants || lease.Tenants || [];
      const t = tenants[0];
      const tenantName = t
        ? `${t.firstname || t.Firstname || ''} ${t.lastname || t.Lastname || ''}`.trim()
        : 'Tenant';
      const rentAmt = lease.rentAmount || lease.RentAmount || firstUnit?.rentAmount || firstUnit?.RentAmount || 0;
      const deposit = lease.securityDeposit || lease.SecurityDeposit || 0;

      if (startDate && (lease.isActive || lease.IsActive)) {
        events.push({
          id: `lease-${leaseId}`,
          type: 'lease',
          date: startDate,
          title: `${leaseLength ? `${leaseLength}-month ` : ''}Lease signed with ${tenantName}`,
          description: [
            rentAmt > 0 ? `${formatCurrency(rentAmt)}/mo` : null,
            deposit > 0 ? `${formatCurrency(deposit)} deposit` : null,
            `auto-renew ${autoRenew ? 'on' : 'off'}`,
            endDate ? `ends ${format(parseISO(endDate), 'MMM d, yyyy')}` : null
          ].filter(Boolean).join(' · '),
        });
      }
    }

    // ── Maintenance events — group same-day tickets into one item ──
    const propertyMaint = (allMaintenance || []).filter(
      (m) => (m.propertyId || m.PropertyId) === numericPropertyId
    );

    // Group by calendar day (YYYY-MM-DD)
    const maintByDay = {};
    propertyMaint.forEach((m) => {
      const raw = m.createdAt || m.CreatedAt || m.dateSubmitted || m.DateSubmitted;
      if (!raw) return;
      const dayKey = format(new Date(raw), 'yyyy-MM-dd');
      if (!maintByDay[dayKey]) maintByDay[dayKey] = [];
      maintByDay[dayKey].push({ ...m, _raw: raw });
    });

    Object.entries(maintByDay).forEach(([dayKey, dayItems]) => {
      const earliest = dayItems[0]._raw; // use earliest as the event date
      if (dayItems.length === 1) {
        const m = dayItems[0];
        const priority = (m.priority || '').toLowerCase();
        const hasVendor = !!(m.vendorId || m.VendorId || m.vendorName || m.VendorName);
        const timeStr = format(new Date(m._raw), 'h:mm a');
        events.push({
          id: `maint-${m.id || m.Id}`,
          type: 'maintenance',
          date: m._raw,
          title: m.title || m.Title || 'Maintenance request',
          description: m.description || m.Description || '',
          children: [{
            priority,
            maintenanceStatus: (m.status || m.Status || '').toLowerCase(),
            title: m.title || m.Title || 'Request',
            status: hasVendor ? `vendor assigned · ${timeStr}` : `${timeStr}`
          }],
          actions: [{ label: 'View ticket', path: `/landlord/maintenance/${m.id || m.Id}` }]
        });
      } else {
        // Multiple tickets on same day — combine
        const titles = dayItems.map((m) => m.title || m.Title || 'Request').join(' · ');
        events.push({
          id: `maint-day-${dayKey}`,
          type: 'maintenance',
          date: earliest,
          title: `${dayItems.length} maintenance tickets opened`,
          description: titles,
          children: dayItems.map((m) => {
            const priority = (m.priority || '').toLowerCase();
            const hasVendor = !!(m.vendorId || m.VendorId || m.vendorName || m.VendorName);
            const timeStr = format(new Date(m._raw), 'h:mm a');
            return {
              priority,
              maintenanceStatus: (m.status || m.Status || '').toLowerCase(),
              title: m.title || m.Title || 'Request',
              status: hasVendor ? `vendor assigned · ${timeStr}` : timeStr
            };
          }),
          actions: [{ label: 'Assign vendors', path: `/landlord/maintenances` }]
        });
      }
    });

    return events.sort((a, b) => new Date(b.date) - new Date(a.date));
  }, [allPayments, allMaintenance, numericPropertyId, lease, leaseId, firstUnit]);

  // Apply time range filter
  const rangeFiltered = useMemo(() => {
    const months = RANGES[rangeIdx].months;
    if (!months) return items;
    const cutoff = new Date();
    cutoff.setMonth(cutoff.getMonth() - months);
    return items.filter((i) => new Date(i.date) >= cutoff);
  }, [items, rangeIdx]);

  const filtered = filter === 'all' ? rangeFiltered : rangeFiltered.filter((i) => i.type === filter);

  // Range toggle (CashFlow style)
  const rangeToggle = (
    <Box sx={{ display: 'flex', border: (t) => `1px solid ${t.palette.mode === 'dark' ? alpha('#cbd5e1', 0.18) : alpha(t.palette.divider, 0.24)}`, borderRadius: 1.5, overflow: 'hidden', bgcolor: 'background.paper' }}>
      {RANGES.map((r, i) => (
        <Box
          key={r.label}
          onClick={() => setRangeIdx(i)}
          sx={{
            px: 1.5, py: 0.4,
            fontSize: '0.7rem', fontWeight: 600,
            cursor: 'pointer', userSelect: 'none',
            bgcolor: i === rangeIdx ? 'primary.main' : 'background.paper',
            color: i === rangeIdx ? 'primary.contrastText' : 'text.secondary',
            transition: 'background-color 0.15s ease, color 0.15s ease',
            borderRight: (t) => i < RANGES.length - 1 ? `1px solid ${t.palette.mode === 'dark' ? alpha('#cbd5e1', 0.16) : alpha(t.palette.divider, 0.22)}` : 'none',
          }}
        >
          {r.label}
        </Box>
      ))}
    </Box>
  );

  const filterButtons = (
    <ToggleButtonGroup
      value={filter}
      exclusive
      onChange={(_, val) => { if (val) setFilter(val); }}
      size="small"
      sx={{
        '& .MuiToggleButton-root': {
          textTransform: 'none',
          fontWeight: 600,
          fontSize: '0.78rem',
          px: 1.25,
          py: 0.3,
          borderRadius: '50px !important',
          border: (t) => `1px solid ${t.palette.mode === 'dark' ? alpha('#cbd5e1', 0.18) : alpha(t.palette.divider, 0.24)} !important`,
          mr: 0.5
        },
        '& .Mui-selected': {
          bgcolor: `${theme.palette.primary.main} !important`,
          color: `${theme.palette.primary.contrastText} !important`,
          borderColor: `${alpha(theme.palette.primary.main, 0.55)} !important`
        }
      }}
    >
      <ToggleButton value="all">All</ToggleButton>
      <ToggleButton value="money">Money</ToggleButton>
      <ToggleButton value="maintenance">Maintenance</ToggleButton>
      <ToggleButton value="lease">Lease</ToggleButton>
      <ToggleButton value="agent">Agent</ToggleButton>
    </ToggleButtonGroup>
  );

  return (
    <MainCard
      title={
        <Box>
          <Typography variant="overline" fontWeight={700} sx={{ fontSize: '0.75rem', letterSpacing: 1, color: 'text.secondary', display: 'block', lineHeight: 1.5 }}>
            ACTIVITY
          </Typography>
          <Typography variant="h5" fontWeight={700} sx={{ lineHeight: 1.2 }}>
            This property&apos;s story
          </Typography>
          <Typography variant="caption" color="text.secondary" sx={{ fontSize: '0.78rem' }}>
            Everything that&apos;s happened, in order
          </Typography>
        </Box>
      }
      secondary={
        <Stack direction="row" alignItems="center" spacing={1}>
          {rangeToggle}
          <Typography
            component="span"
            onClick={() => navigate(`/landlord/property-activity/${propertyId}`)}
            sx={{ fontSize: '0.8rem', fontWeight: 500, color: 'primary.main', cursor: 'pointer', whiteSpace: 'nowrap', '&:hover': { textDecoration: 'underline' } }}
          >
            View all →
          </Typography>
        </Stack>
      }
      contentSX={{ pt: 1.5 }}
      sx={propertyAccentCardSx(theme.palette.warning.main, { '& .MuiCardHeader-root': { pb: 1 } })}
    >
      {/* Type filter pills */}
      <Box sx={{ mb: 2 }}>{filterButtons}</Box>

      {filtered.length === 0 ? (
        <Box sx={{ py: 4, textAlign: 'center' }}>
          <Typography variant="body2" color="text.secondary">
            No activity in this period for this property.
          </Typography>
        </Box>
      ) : (
        <Stack>
          {filtered.map((item, idx) => (
            <StoryItem key={item.id} item={item} isLast={idx === filtered.length - 1} />
          ))}
        </Stack>
      )}
    </MainCard>
  );
}
