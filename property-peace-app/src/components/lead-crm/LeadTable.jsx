import { Avatar, Box, Chip, Stack, Typography, alpha, useTheme } from '@mui/material';
import { CheckCircleOutlined, ClockCircleOutlined, UserOutlined } from '@ant-design/icons';
import { formatZonedDateTime, titleCaseStatus } from 'utils/leads';

export default function LeadTable({ leads, listingLabels, timeZone, onOpen }) {
  const theme = useTheme();
  return (
    <Box role="list" aria-label="Prospect leads">
      <Box sx={{ display: { xs: 'none', md: 'grid' }, gridTemplateColumns: 'minmax(230px,1.5fr) minmax(150px,1fr) 135px 150px 125px', gap: 2, px: 2, py: 1, bgcolor: alpha(theme.palette.primary.main, 0.035), borderBottom: '1px solid', borderColor: 'divider' }}>
        {['Prospect', 'Listing / property', 'Stage', 'Follow-up', 'Assignment'].map((label) => <Typography key={label} variant="caption" fontWeight={750} color="text.secondary">{label}</Typography>)}
      </Box>
      {leads.map((lead) => (
        <Box key={lead.id} role="listitem" component="button" type="button" onClick={() => onOpen(lead.id)} sx={{ width: '100%', display: { xs: 'block', md: 'grid' }, gridTemplateColumns: 'minmax(230px,1.5fr) minmax(150px,1fr) 135px 150px 125px', gap: { xs: 1, md: 2 }, alignItems: 'center', p: 2, bgcolor: 'background.paper', color: 'text.primary', border: 0, borderBottom: '1px solid', borderColor: 'divider', textAlign: 'left', cursor: 'pointer', font: 'inherit', '&:hover': { bgcolor: alpha(theme.palette.primary.main, 0.035) }, '&:focus-visible': { outline: `3px solid ${alpha(theme.palette.primary.main, .35)}`, outlineOffset: -3 } }}>
          <Stack direction="row" spacing={1.25} alignItems="center" minWidth={0}>
            <Avatar sx={{ width: 38, height: 38, bgcolor: alpha(theme.palette.primary.main, .1), color: 'primary.main' }}><UserOutlined /></Avatar>
            <Box minWidth={0}><Typography fontWeight={750} noWrap>{lead.name}</Typography><Typography variant="caption" color="text.secondary" noWrap>{lead.email}</Typography></Box>
          </Stack>
          <Typography variant="body2" noWrap>{listingLabels[lead.listingId] || `Listing #${lead.listingId}`}</Typography>
          <Chip size="small" variant="outlined" label={titleCaseStatus(lead.status)} color={lead.status === 'lost' ? 'default' : lead.status === 'applied' ? 'success' : 'primary'} sx={{ justifySelf: { md: 'start' } }} />
          <Stack direction="row" spacing={0.7} alignItems="center"><ClockCircleOutlined /><Typography variant="caption">{lead.nextFollowUpAtUtc ? formatZonedDateTime(lead.nextFollowUpAtUtc, timeZone) : 'Not scheduled'}</Typography></Stack>
          <Stack direction="row" spacing={0.7} alignItems="center">{lead.ownerUserId ? <CheckCircleOutlined /> : <UserOutlined />}<Typography variant="caption">{lead.ownerUserId ? `Owner #${lead.ownerUserId}` : 'Unassigned'}</Typography></Stack>
        </Box>
      ))}
    </Box>
  );
}
