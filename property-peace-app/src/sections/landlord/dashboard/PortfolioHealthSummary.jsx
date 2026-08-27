import { useMemo } from 'react';
import { alpha, Box, Divider, Stack, Typography, useTheme } from '@mui/material';
import { useSelector } from 'react-redux';
import { useNavigate } from 'react-router-dom';
import MainCard from 'components/MainCard';
import { selectDashboardSummary } from 'store/dashboard/dashboard.selector';
import { formatCurrency } from 'utils/formatters';
import { CheckOutlined, DollarOutlined, ToolOutlined, RiseOutlined } from '@ant-design/icons';
import { isHighPriorityMaintenanceRequest, isOpenMaintenanceRequest } from 'utils/maintenanceStatus';

// Simple SVG sparkline
function Sparkline({ values = [], color = '#333' }) {
  if (!values || values.length < 2) return <Box sx={{ width: 80, height: 36 }} />;
  const w = 80;
  const h = 36;
  const pad = 4;
  const max = Math.max(...values);
  const min = Math.min(...values);
  const range = max - min || 1;
  const pts = values.map((v, i) => ({
    x: pad + (i / (values.length - 1)) * (w - pad * 2),
    y: h - pad - ((v - min) / range) * (h - pad * 2)
  }));
  const d = pts.map((p, i) => `${i === 0 ? 'M' : 'L'}${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(' ');
  const last = pts[pts.length - 1];
  const filterId = `shadow-${color.replace(/[^a-z0-9]/gi, '')}`;
  return (
    <svg width={w} height={h} style={{ overflow: 'visible', display: 'block' }}>
      <defs>
        <filter id={filterId} x="-20%" y="-40%" width="140%" height="180%">
          <feDropShadow dx="0" dy="2" stdDeviation="2" floodColor={color} floodOpacity="0.35" />
        </filter>
      </defs>
      <path d={d} fill="none" stroke={color} strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round" filter={`url(#${filterId})`} />
      <circle cx={last.x} cy={last.y} r={2.5} fill={color} filter={`url(#${filterId})`} />
    </svg>
  );
}

export default function PortfolioHealthSummary({ properties, summary, totalExpenses }) {
  const theme = useTheme();
  const navigate = useNavigate();
  const dashboardSummary = useSelector(selectDashboardSummary);
  const allRequests = dashboardSummary?.maintenanceRequests?.maintenanceRequests || [];

  const { totalUnits, occupiedUnits, occupancyRate } = useMemo(() => {
    if (!properties?.length) return { totalUnits: 0, occupiedUnits: 0, occupancyRate: 0 };
    let total = 0;
    let occupied = 0;
    properties.forEach((p) => {
      (p.units || p.Units || []).forEach((u) => {
        total++;
        const status = (u.status || u.Status || '').toLowerCase();
        if (status === 'occupied' || status === 'overdue') occupied++;
      });
    });
    return { totalUnits: total, occupiedUnits: occupied, occupancyRate: total > 0 ? (occupied / total) * 100 : 0 };
  }, [properties]);

  const collectedThisMonth = summary?.collectedThisMonth || 0;
  const expectedThisMonth = summary?.expectedThisMonth || 0;
  const overdueAmount = summary?.overdue || 0;
  const openCount = allRequests.filter(isOpenMaintenanceRequest).length;
  const highCount = allRequests.filter(isHighPriorityMaintenanceRequest).length;
  const vacantUnits = totalUnits - occupiedUnits;

  const errorColor = theme.palette.error.main;
  const successColor = theme.palette.success.main;
  const warningColor = theme.palette.warning.main;
  const textPrimary = theme.palette.text.primary;
  const brandNavy = '#061e35';
  const brandGreen = '#41a541';

  const metrics = [
    {
      icon: <CheckOutlined />,
      statement: vacantUnits === 0
        ? 'Fully occupied'
        : `${vacantUnits} vacant unit${vacantUnits !== 1 ? 's' : ''}`,
      statementColor: vacantUnits === 0 ? successColor : warningColor,
      action: vacantUnits === 0 ? 'View properties' : 'Ready to list',
      sparkValues: vacantUnits === 0
        ? [80, 90, 95, 100, 100, 100]
        : [60, 70, occupancyRate * 0.8, occupancyRate * 0.9, occupancyRate, occupancyRate],
      sparkColor: vacantUnits === 0 ? successColor : warningColor,
      route: '/landlord/properties'
    },
    {
      icon: <DollarOutlined />,
      statement: overdueAmount > 0
        ? `${formatCurrency(overdueAmount)} outstanding`
        : `${formatCurrency(collectedThisMonth)} collected this month`,
      statementColor: overdueAmount > 0 ? errorColor : successColor,
      action: overdueAmount > 0 ? 'Send reminder' : 'View ledger',
      sparkValues: [
        collectedThisMonth * 0.5,
        collectedThisMonth * 0.65,
        collectedThisMonth * 0.8,
        collectedThisMonth * 0.85,
        collectedThisMonth * 0.95,
        collectedThisMonth
      ],
      sparkColor: overdueAmount > 0 ? errorColor : successColor,
      route: overdueAmount > 0 ? '/landlord/rent-collection' : '/landlord/accounting'
    },
    {
      icon: <ToolOutlined />,
      statement: highCount > 0
        ? `${highCount} high-priority repair${highCount !== 1 ? 's' : ''}`
        : openCount === 0
        ? 'No open repairs'
        : `${openCount} open repair${openCount !== 1 ? 's' : ''}`,
      statementColor: highCount > 0 ? errorColor : openCount === 0 ? successColor : textPrimary,
      action: openCount === 0 ? 'All clear' : 'Review tickets',
      sparkValues: openCount === 0
        ? [3, 2, 2, 1, 1, 0]
        : [1, 2, 3, openCount * 0.7, openCount * 0.9, openCount],
      sparkColor: highCount > 0 ? errorColor : textPrimary,
      route: '/landlord/maintenances'
    },
    {
      icon: <RiseOutlined />,
      statement: `${formatCurrency(collectedThisMonth)} collected this month`,
      statementColor: collectedThisMonth > 0 ? successColor : textPrimary,
      action: 'View ledger',
      sparkValues: [
        collectedThisMonth * 0.4,
        collectedThisMonth * 0.55,
        collectedThisMonth * 0.7,
        collectedThisMonth * 0.8,
        collectedThisMonth * 0.9,
        collectedThisMonth
      ],
      sparkColor: collectedThisMonth > 0 ? successColor : textPrimary,
      route: '/landlord/accounting'
    }
  ];

  return (
    <MainCard
      accentColor={theme.palette.primary.main}
      accentShadow
      title={
        <Typography variant="overline" fontWeight={700} sx={{ fontSize: '0.875rem', letterSpacing: 1, color: 'text.primary' }}>
          PORTFOLIO SNAPSHOT
        </Typography>
      }
      contentSX={{ pt: 0.5, pb: 1 }}
      sx={{ height: '100%', '& .MuiCardHeader-root': { pb: 1 } }}
    >
      <Stack divider={<Divider sx={{ borderColor: (t) => alpha(t.palette.divider, 0.12) }} />}>
        {metrics.map((m, i) => (
          <Box
            key={i}
            onClick={() => navigate(m.route)}
            sx={{
              py: 1.5,
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: 1.5,
              borderRadius: 1,
              mx: -1,
              px: 1,
              transition: 'background 0.15s',
              '&:hover': { bgcolor: alpha(theme.palette.primary.main, 0.04) }
            }}
          >
            {/* Icon box */}
            <Box
              sx={{
                width: 42,
                height: 42,
                flexShrink: 0,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                borderRadius: 1.5,
                bgcolor: alpha(brandNavy, 0.08),
                fontSize: 16,
                color: brandNavy
              }}
            >
              {m.icon}
            </Box>
            {/* Text */}
            <Box sx={{ flex: 1, minWidth: 0 }}>
              <Typography variant="body1" fontWeight={700} noWrap sx={{ color: brandNavy, lineHeight: 1.3 }}>
                {m.statement}
              </Typography>
              <Typography variant="body2" sx={{ fontSize: '0.8rem', color: brandGreen, fontWeight: 600 }}>
                {m.action} →
              </Typography>
            </Box>
          </Box>
        ))}
      </Stack>
    </MainCard>
  );
}
