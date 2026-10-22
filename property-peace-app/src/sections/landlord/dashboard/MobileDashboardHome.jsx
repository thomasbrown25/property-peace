import { useMemo } from 'react';
import { useNavigate } from 'react-router-dom';

import { Box, ButtonBase, LinearProgress, Typography, useTheme } from '@mui/material';
import { ArrowRightOutlined, HomeOutlined } from '@ant-design/icons';

import { mobileDashboardData } from 'utils/dashboardMobileSummary';

const money = (amount) => new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', minimumFractionDigits: amount % 1 === 0 ? 0 : 2 }).format(amount);
const read = (item, camel, pascal) => item?.[camel] ?? item?.[pascal];

export default function MobileDashboardHome({ properties, propertiesLoading, propertiesError, dashboardSummary, dashboardLoading, dashboardError, rentSummary, rentRecords, rentLoading, rentError, conversations, shortTermOnly }) {
  const navigate = useNavigate();
  const theme = useTheme();

  const requests = read(dashboardSummary, 'maintenanceRequests', 'MaintenanceRequests');
  const maintenance = read(requests, 'maintenanceRequests', 'MaintenanceRequests');
  const data = useMemo(() => mobileDashboardData({
    properties, requests: Array.isArray(maintenance) ? maintenance : [], summary: rentSummary, rentRecords, conversations
  }), [properties, maintenance, rentSummary, rentRecords, conversations]);
  const dark = theme.palette.mode === 'dark';
  const navy = dark ? theme.palette.text.primary : '#061e35';
  const green = dark ? '#70cb8c' : '#2c914e';
  const muted = theme.palette.text.secondary;
  const red = dark ? '#ff9d97' : '#b13232';
  const divider = dark ? 'rgba(255,255,255,.14)' : '#e5e9e9';
  const today = new Date();
  const heading = { fontSize: '1.42rem', fontWeight: 800, letterSpacing: '-.035em', lineHeight: 1.2, color: navy };
  const section = { mt: 4, pt: 3.3, borderTop: `1px solid ${divider}` };
  const link = (label, path) => <ButtonBase onClick={() => navigate(path)} sx={{ gap: 0.8, color: muted, fontSize: '.83rem', fontWeight: 700, flexShrink: 0, p: 0.5, borderRadius: 1 }} aria-label={label}>View all <ArrowRightOutlined style={{ fontSize: 13 }} /></ButtonBase>;
  const rentUnavailable = rentError || (!rentLoading && !rentSummary);
  const attentionUnavailable = dashboardError || (!dashboardLoading && !dashboardSummary);
  return (
    <Box sx={{ color: navy, pb: 3, pt: 1.8, maxWidth: 620, mx: 'auto' }} aria-label="Portfolio overview">
      <ButtonBase onClick={() => navigate('/landlord/dashboard?tab=calendar')} aria-label="View calendar" sx={{ width: '100%', textAlign: 'left', display: 'flex', alignItems: 'center', gap: 2, pb: 2.7, borderRadius: 1 }}>
        <Box sx={{ width: 62, flexShrink: 0, textAlign: 'center', borderRight: `1px solid ${divider}`, pr: 1.4 }}>
          <Typography sx={{ color: dark ? green : '#2773ae', fontWeight: 800, fontSize: '.68rem', letterSpacing: '.15em' }}>{today.toLocaleDateString('en-US', { month: 'short' }).toUpperCase()}</Typography>
          <Typography sx={{ fontSize: '2.75rem', fontWeight: 800, letterSpacing: '-.065em', lineHeight: 1, color: navy }}>{today.getDate()}</Typography>
          <Typography sx={{ color: muted, fontWeight: 800, fontSize: '.66rem', letterSpacing: '.12em', mt: 0.4 }}>{today.toLocaleDateString('en-US', { weekday: 'short' }).toUpperCase()}</Typography>
        </Box>
        <Box sx={{ minWidth: 0, flex: 1 }}>
          <Typography sx={{ ...heading, fontSize: { xs: '1.05rem', sm: '1.24rem' }, whiteSpace: 'nowrap' }}><Box component="span" sx={{ display: 'inline-block', width: 8, height: 8, borderRadius: '50%', bgcolor: green, mr: 1.1, verticalAlign: 'middle' }} />Today at a glance</Typography>
          <Typography sx={{ color: muted, fontSize: '.83rem', mt: .5, lineHeight: 1.45 }}>
            {dashboardLoading ? 'Loading portfolio updates…' : attentionUnavailable ? 'Portfolio updates unavailable' : <><Box component="span" sx={{ color: data.openRepairs ? red : muted }}>{data.openRepairs} open {data.openRepairs === 1 ? 'repair' : 'repairs'}</Box> · {data.unread} unread {data.unread === 1 ? 'message' : 'messages'}</>}
          </Typography>
        </Box>
        <ArrowRightOutlined style={{ fontSize: 18, flexShrink: 0 }} />
      </ButtonBase>

      {(!shortTermOnly || data.metrics.expectedRent > 0 || data.metrics.income > 0 || Number(data.overdue) > 0) && <Box sx={section}>
        <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 2.25 }}>
          <Typography component="h2" sx={heading}>{today.toLocaleDateString('en-US', { month: 'long' })} rent</Typography>
          {link('View all rent collection', '/landlord/rent-collection')}
        </Box>
        {rentLoading ? <Typography color="text.secondary">Loading rent collection…</Typography> : rentUnavailable ? <Typography color="text.secondary">Rent collection is unavailable.</Typography> : data.metrics.expectedRent === 0 && data.metrics.income === 0 && !data.overdue ? <Typography color="text.secondary">No active rent expected this month. Rent figures will appear when a lease is active.</Typography> : <Box sx={{ bgcolor: dark ? '#163d34' : '#edf8f2', borderRadius: 2.5, p: { xs: 2.5, sm: 3 } }}>
          <Typography sx={{ color: green, letterSpacing: '.11em', fontWeight: 800, fontSize: '.7rem' }}>COLLECTED THIS MONTH</Typography>
          <Box sx={{ display: 'flex', gap: 1.5, alignItems: 'baseline', mt: 1 }}>
            <Typography sx={{ color: navy, fontWeight: 800, fontSize: '2.45rem', lineHeight: 1.15, letterSpacing: '-.06em' }}>{money(data.metrics.income)}</Typography>
            {data.metrics.expectedRent > 0 && <Typography sx={{ color: green, fontWeight: 800 }}>{Math.round(data.metrics.collectionPct)}%</Typography>}
          </Box>
          {data.metrics.expectedRent > 0 && <LinearProgress variant="determinate" value={data.metrics.collectionPct} aria-label="Rent collected this month" sx={{ mt: 2.25, mb: 2.1, height: 8, borderRadius: 4, bgcolor: dark ? '#315b48' : '#dfeee4', '& .MuiLinearProgress-bar': { borderRadius: 4, bgcolor: green } }} />}
          <Box sx={{ display: 'flex', justifyContent: 'space-between', gap: 1, py: 1.4, borderBottom: `1px solid ${divider}` }}><Typography sx={{ color: muted, fontSize: '.84rem' }}>Expected this month</Typography><Typography sx={{ color: navy, fontWeight: 800, fontSize: '.9rem' }}>{money(data.metrics.expectedRent)}</Typography></Box>
          <Box sx={{ display: 'flex', justifyContent: 'space-between', gap: 1, pt: 1.6 }}><Typography sx={{ color: muted, fontSize: '.84rem' }}>Overdue rent</Typography><Typography sx={{ color: Number(data.overdue) > 0 ? red : navy, fontWeight: 800, fontSize: '.9rem' }}>{typeof data.overdue === 'number' ? money(data.overdue) : '—'}</Typography></Box>
        </Box>}
      </Box>}

      <Box sx={{ mt: 4.5 }}>
        <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 2 }}>
          <Typography component="h2" sx={{ ...heading, display: 'flex', alignItems: 'center', gap: 1 }}><HomeOutlined style={{ color: dark ? green : '#2875bb', fontSize: 21 }} />Properties</Typography>
          {link('View all properties', '/landlord/properties')}
        </Box>
        {propertiesLoading || dashboardLoading || rentLoading ? <Typography color="text.secondary">Loading properties…</Typography> : propertiesError || attentionUnavailable ? <Typography color="text.secondary">Property information is unavailable.</Typography> : data.rows.length === 0 ? <Typography color="text.secondary">No active properties yet.</Typography> : data.rows.map((property) => <ButtonBase key={property.id} onClick={() => navigate(`/landlord/property/${property.id}`)} aria-label={`View ${property.name}`} sx={{ width: '100%', minHeight: 74, py: 1.4, display: 'flex', justifyContent: 'space-between', textAlign: 'left', borderBottom: `1px solid ${divider}`, gap: 1.4 }}>
          <Box sx={{ minWidth: 0 }}><Typography sx={{ color: navy, fontWeight: 800, fontSize: '1.02rem', lineHeight: 1.3 }} noWrap>{property.name}</Typography><Typography sx={{ color: muted, fontSize: '.8rem', mt: .4 }}><Box component="span" sx={{ color: property.repairs ? red : muted }}>{property.repairs} open {property.repairs === 1 ? 'repair' : 'repairs'}</Box>{(!shortTermOnly || property.overdue > 0) && <> · <Box component="span" sx={{ color: property.overdue === null ? muted : property.overdue > 0 ? red : green }}>{property.overdue > 0 ? `${money(property.overdue)} overdue rent` : property.overdue === null ? 'Rent status unavailable' : 'Paid'}</Box></>}</Typography></Box>
          <ArrowRightOutlined style={{ color: navy, fontSize: 18, flexShrink: 0 }} />
        </ButtonBase>)}
      </Box>
    </Box>
  );
}
