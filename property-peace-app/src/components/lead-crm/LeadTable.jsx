import { Avatar, Box, Chip, Stack, Typography, alpha, useTheme } from '@mui/material';
import { CheckCircleOutlined, ClockCircleOutlined, UserOutlined } from '@ant-design/icons';
import { formatZonedDateTime, titleCaseStatus } from 'utils/leads';
import { getTableStyles } from 'themes/tableStyles';

export default function LeadTable({ leads, listingLabels, timeZone, onOpen }) {
  const theme = useTheme();
  const tableStyles = getTableStyles(theme);
  const columns = 'minmax(230px,1.5fr) minmax(150px,1fr) 135px 150px 125px';
  return (
    <Box role="list" aria-label="Prospect leads" style={tableStyles.container} sx={{ overflow: 'hidden' }}>
      <Box style={{ ...tableStyles.header, borderBottom: tableStyles.headerCell.borderBottom }} sx={{ display: { xs: 'none', md: 'grid' }, gridTemplateColumns: columns }}>
        {['Prospect', 'Listing / property', 'Stage', 'Follow-up', 'Assignment'].map((label) => <Typography key={label} style={{ ...tableStyles.headerCell, borderBottom: 0 }}>{label}</Typography>)}
      </Box>
      {leads.map((lead, index) => (
        <Box key={lead.id} role="listitem" component="button" type="button" onClick={() => onOpen(lead.id)} style={{ ...tableStyles.row, ...(index === leads.length - 1 && { borderBottom: 0 }) }} sx={{ width: '100%', display: { xs: 'block', md: 'grid' }, gridTemplateColumns: columns, alignItems: 'center', p: 0, bgcolor: 'background.paper', color: 'text.primary', border: 0, textAlign: 'left', cursor: 'pointer', font: 'inherit', '&:hover': { bgcolor: alpha(theme.palette.primary.main, 0.035) }, '&:focus-visible': { outline: `3px solid ${alpha(theme.palette.primary.main, .35)}`, outlineOffset: -3 } }}>
          <Stack direction="row" spacing={1.25} alignItems="center" minWidth={0} style={tableStyles.cell}>
            <Avatar sx={{ width: 38, height: 38, bgcolor: alpha(theme.palette.primary.main, .1), color: 'primary.main' }}><UserOutlined /></Avatar>
            <Box minWidth={0}><Typography fontWeight={750} noWrap>{lead.name}</Typography><Typography variant="caption" color="text.secondary" noWrap>{lead.email}</Typography></Box>
          </Stack>
          <Box style={tableStyles.cell} sx={{ minWidth: 0 }}><Typography variant="body2" noWrap>{listingLabels[lead.listingId] || `Listing #${lead.listingId}`}</Typography></Box>
          <Box style={tableStyles.cell}><Chip size="small" variant="outlined" label={titleCaseStatus(lead.status)} color={lead.status === 'lost' ? 'default' : lead.status === 'applied' ? 'success' : 'primary'} /></Box>
          <Stack direction="row" spacing={0.7} alignItems="center" style={tableStyles.cell}><ClockCircleOutlined /><Typography variant="caption">{lead.nextFollowUpAtUtc ? formatZonedDateTime(lead.nextFollowUpAtUtc, timeZone) : 'Not scheduled'}</Typography></Stack>
          <Stack direction="row" spacing={0.7} alignItems="center" style={tableStyles.cell}>{lead.ownerUserId ? <CheckCircleOutlined /> : <UserOutlined />}<Typography variant="caption">{lead.ownerUserId ? `Owner #${lead.ownerUserId}` : 'Unassigned'}</Typography></Stack>
        </Box>
      ))}
    </Box>
  );
}
