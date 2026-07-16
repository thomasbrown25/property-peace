import { useMemo, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useSelector } from 'react-redux';
import {
  Box, Typography, Stack, Chip, Fade, alpha, useTheme,
  ToggleButton, ToggleButtonGroup, CircularProgress
} from '@mui/material';
import {
  DollarOutlined, FileTextOutlined, ToolOutlined, CheckCircleOutlined,
  ExclamationCircleOutlined
} from '@ant-design/icons';
import { format, subMonths, isAfter } from 'date-fns';
import { formatCurrency } from 'utils/formatters';
import { selectProperties } from 'store/property/property.selector';
import { selectAllPayments } from 'store/payment/payment.selector';
import { selectMaintenanceRequests } from 'store/maintenance/maintenance.selector';
import useFetchProperties from 'hooks/useFetchProperties';
import useFetchAllPayments from 'hooks/useFetchAllPayments';
import MainCard from 'components/MainCard';
import PageBreadcrumbs from 'components/breadcrumbs/PageBreadcrumbs';
import AnimateIn from 'components/AnimateIn';

// ─── Item type config ─────────────────────────────────────────────────────────

const TYPE = {
  payment:     { label: 'Payment',     color: '#16a34a', icon: <DollarOutlined /> },
  deposit:     { label: 'Deposit',     color: '#1464CC', icon: <DollarOutlined /> },
  lease:       { label: 'Lease',       color: '#7c3aed', icon: <FileTextOutlined /> },
  maintenance: { label: 'Maintenance', color: '#d97706', icon: <ToolOutlined /> },
  fee:         { label: 'Fee',         color: '#16a34a', icon: <ExclamationCircleOutlined /> },
  signed:      { label: 'Signed',      color: '#0891b2', icon: <CheckCircleOutlined /> },
};

function TypeBadge({ type }) {
  const cfg = TYPE[type] || TYPE.payment;
  return (
    <Chip
      label={cfg.label}
      size="small"
      sx={{
        height: 20, fontSize: '0.62rem', fontWeight: 700, letterSpacing: 0.4,
        bgcolor: alpha(cfg.color, 0.1), color: cfg.color, border: 'none',
        '& .MuiChip-label': { px: 0.75 }
      }}
    />
  );
}

function ActivityDot({ type, isLast }) {
  const cfg = TYPE[type] || TYPE.payment;
  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', flexShrink: 0, width: 32, alignSelf: 'stretch' }}>
      <Box sx={{
        width: 32, height: 32, borderRadius: '50%', flexShrink: 0,
        bgcolor: alpha(cfg.color, 0.08),
        border: `2px solid ${cfg.color}`,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        color: cfg.color, fontSize: 13
      }}>
        {cfg.icon}
      </Box>
      {!isLast && <Box sx={{ width: 2, flex: 1, bgcolor: 'rgba(0,0,0,0.07)', mt: 0.75 }} />}
    </Box>
  );
}

function ActivityItem({ item, isLast }) {
  const theme = useTheme();
  return (
    <Stack direction="row" spacing={1} alignItems="stretch">
      <ActivityDot type={item.type} isLast={isLast} />
      <Box sx={{ flex: 1, minWidth: 0, pb: isLast ? 0 : 2.5 }}>
        <Box sx={{ border: '1px solid rgba(0,0,0,0.08)', borderRadius: 2, p: 1.75, bgcolor: 'background.paper' }}>
          <Stack direction="row" alignItems="center" spacing={1} sx={{ mb: 0.6 }} flexWrap="wrap" gap={0.5}>
            <TypeBadge type={item.type} />
            <Typography variant="caption" color="text.disabled" sx={{ fontSize: '0.68rem' }}>
              {format(item.date, 'MMM d, yyyy')} · {format(item.date, 'h:mm a')}
            </Typography>
            {item.amount != null && (
              <Typography variant="subtitle2" fontWeight={700} sx={{ color: '#16a34a', ml: 'auto !important', fontSize: '0.95rem' }}>
                +{formatCurrency(item.amount)}
              </Typography>
            )}
          </Stack>
          <Typography variant="subtitle2" fontWeight={700} sx={{ fontSize: '0.88rem', mb: item.sub ? 0.25 : 0 }}>
            {item.label}
          </Typography>
          {item.sub && (
            <Typography variant="caption" color="text.secondary" sx={{ fontSize: '0.76rem' }}>
              {item.sub}
            </Typography>
          )}
        </Box>
      </Box>
    </Stack>
  );
}

// ─── Shared toggle style ──────────────────────────────────────────────────────

const toggleSx = (theme) => ({
  '& .MuiToggleButton-root': {
    textTransform: 'none', fontWeight: 600, fontSize: '0.78rem',
    px: 1.5, py: 0.4,
    borderRadius: '50px !important',
    border: '1px solid rgba(0,0,0,0.12) !important',
    mr: 0.5
  },
  '& .Mui-selected': {
    bgcolor: `${theme.palette.primary.main} !important`,
    color: `${theme.palette.background.paper} !important`,
    borderColor: `${theme.palette.text.primary} !important`
  }
});

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function LeaseActivityPage() {
  const { leaseId } = useParams();
  const navigate = useNavigate();
  const theme = useTheme();

  const [range, setRange]       = useState('6m');
  const [category, setCategory] = useState('all');

  useFetchProperties();
  useFetchAllPayments();

  const properties  = useSelector(selectProperties);
  const allPayments = useSelector(selectAllPayments);
  const allMaintenance = useSelector(selectMaintenanceRequests);

  // Resolve lease
  const lease = useMemo(() => {
    if (!properties) return null;
    for (const p of properties) {
      for (const u of (p.units || [])) {
        const l = u.lease || u.Lease;
        if (l && (l.id || l.Id)?.toString() === leaseId) {
          return { ...l, unit: u, property: p };
        }
      }
    }
    return null;
  }, [properties, leaseId]);

  const tenantName = useMemo(() => {
    const tenants = lease?.tenants || lease?.Tenants || [];
    const t = tenants[0];
    if (!t) return 'Tenant';
    return `${t.firstname || t.Firstname || ''} ${t.lastname || t.Lastname || ''}`.trim() || 'Tenant';
  }, [lease]);

  const propertyName = lease?.property?.name || lease?.property?.Name || '';
  const unitName = lease?.unit?.name || lease?.unit?.Name || '';
  const displayName = unitName ? `${propertyName} — ${unitName}` : propertyName;

  // Build all activity items
  const allItems = useMemo(() => {
    if (!lease) return [];
    const numLeaseId = Number(leaseId);
    const items = [];

    // Payments for this lease
    (allPayments || [])
      .filter(p => (p.leaseId || p.LeaseId) === numLeaseId)
      .forEach(p => {
        const amt  = parseFloat(p.amount || p.Amount) || 0;
        const date = new Date(p.paymentDate || p.PaymentDate);
        const isDeposit = !!(p.depositId || p.DepositId);
        const isFee     = !!(p.feeId || p.FeeId);
        const method    = p.method || p.Method || 'ACH';
        const feeName   = p.feeName || p.FeeName || 'Fee';
        items.push({
          date,
          type: isDeposit ? 'deposit' : isFee ? 'fee' : 'payment',
          label: isDeposit
            ? `Security deposit received — ${formatCurrency(amt)}`
            : isFee
            ? `${feeName} paid — ${formatCurrency(amt)}`
            : `${tenantName} paid ${formatCurrency(amt)} rent`,
          sub: isDeposit
            ? `${method} · deposit`
            : isFee
            ? `${method} · fee payment`
            : `${method} · ${format(date, 'MMMM yyyy')} cycle`,
          amount: amt
        });
      });

    // Lease signed
    const signedAt = lease.landlordSignedAt || lease.LandlordSignedAt;
    if (signedAt) {
      items.push({
        date: new Date(signedAt),
        type: 'signed',
        label: 'Lease signed by both parties',
        sub: `DocuSign · signed at ${format(new Date(signedAt), 'h:mm a')}`,
        amount: null
      });
    }

    // Lease started
    const startDate = lease.startDate || lease.StartDate;
    if (startDate && (lease.isActive || lease.IsActive)) {
      items.push({
        date: new Date(startDate),
        type: 'lease',
        label: 'Lease became active',
        sub: `${format(new Date(startDate), 'MMM d, yyyy')} · start date`,
        amount: null
      });
    }

    // Maintenance requests for this property
    const propId = lease?.unit?.propertyId || lease?.property?.id;
    (allMaintenance || [])
      .filter(m => (m.propertyId || m.PropertyId) === propId)
      .forEach(m => {
        const raw = m.createdAt || m.CreatedAt || m.dateSubmitted || m.DateSubmitted;
        if (!raw) return;
        items.push({
          date: new Date(raw),
          type: 'maintenance',
          label: m.title || m.Title || 'Maintenance request',
          sub: `${(m.priority || m.Priority || 'Normal')} priority · ${m.status || m.Status || 'Open'}`,
          amount: null
        });
      });

    return items.sort((a, b) => b.date - a.date);
  }, [lease, allPayments, allMaintenance, leaseId, tenantName]);

  const CATEGORY_TYPES = {
    payments:    ['payment', 'deposit'],
    maintenance: ['maintenance'],
    lease:       ['lease', 'signed'],
    fee:         ['fee'],
  };

  // Apply category + time range filters
  const now = new Date();
  const filtered = useMemo(() => {
    let items = allItems;
    if (category !== 'all') {
      const allowed = CATEGORY_TYPES[category] || [];
      items = items.filter(item => allowed.includes(item.type));
    }
    if (range !== 'all') {
      const cutoff = range === '6m' ? subMonths(now, 6) : subMonths(now, 12);
      items = items.filter(item => isAfter(item.date, cutoff));
    }
    return items;
  }, [allItems, category, range]);

  const loading = !lease;

  return (
    <Fade in timeout={500}>
      <Box>
        <AnimateIn direction="bottom" delay={80} distance={100}>
          <Box sx={{ mb: 2.5 }}>
            <PageBreadcrumbs
              items={[
                { label: 'Dashboard', path: '/landlord/dashboard' },
                { label: 'Leases', path: '/landlord/leases' },
                { label: displayName || `Lease ${leaseId}`, path: `/landlord/leases/${leaseId}` },
                { label: 'Activity' }
              ]}
            />
            <Box sx={{ mb: 1.5 }}>
              <Typography variant="h3" fontWeight={700}>Lease Activity</Typography>
              <Typography variant="body2" color="text.secondary">
                {displayName && `${displayName} · `}every event on this lease, in order
              </Typography>
            </Box>

            {/* Filters — right aligned */}
            <Stack direction="row" alignItems="center" justifyContent="flex-end" spacing={1} flexWrap="wrap" gap={1}>
              <ToggleButtonGroup
                value={category}
                exclusive
                onChange={(_, v) => { if (v) setCategory(v); }}
                size="small"
                sx={toggleSx(theme)}
              >
                <ToggleButton value="all">All</ToggleButton>
                <ToggleButton value="payments">Payments</ToggleButton>
                <ToggleButton value="maintenance">Maintenance</ToggleButton>
                <ToggleButton value="lease">Lease</ToggleButton>
                <ToggleButton value="fee">Fee</ToggleButton>
              </ToggleButtonGroup>

              <Box sx={{ width: '1px', height: 20, bgcolor: 'rgba(0,0,0,0.15)' }} />

              <ToggleButtonGroup
                value={range}
                exclusive
                onChange={(_, v) => { if (v) setRange(v); }}
                size="small"
                sx={toggleSx(theme)}
              >
                <ToggleButton value="6m">6M</ToggleButton>
                <ToggleButton value="1y">1Y</ToggleButton>
                <ToggleButton value="all">All</ToggleButton>
              </ToggleButtonGroup>
            </Stack>
          </Box>
        </AnimateIn>

        <AnimateIn direction="bottom" delay={140} distance={100}>
          <MainCard contentSX={{ pt: 2 }}>
            {loading ? (
              <Box sx={{ display: 'flex', justifyContent: 'center', py: 6 }}>
                <CircularProgress size={32} />
              </Box>
            ) : filtered.length === 0 ? (
              <Box sx={{ py: 6, textAlign: 'center' }}>
                <Typography variant="body2" color="text.secondary">
                  No activity for the selected category and time range.
                </Typography>
              </Box>
            ) : (
              <Stack>
                {filtered.map((item, idx) => (
                  <ActivityItem key={idx} item={item} isLast={idx === filtered.length - 1} />
                ))}
              </Stack>
            )}
          </MainCard>
        </AnimateIn>
      </Box>
    </Fade>
  );
}
