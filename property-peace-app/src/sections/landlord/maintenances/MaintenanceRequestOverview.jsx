import { Box, Divider, Link, Paper, Stack, Typography, alpha } from '@mui/material';
import { Link as RouterLink } from 'react-router-dom';
import AppIcon from 'components/AppIcon';
import { isClosedMaintenanceStatus } from 'utils/maintenanceStatus';
import { normalizeWorkflowToken, statusLabel } from 'utils/maintenanceWorkflow';

const cardSx = { borderRadius: 3, minWidth: 0, overflow: 'hidden' };
const cardPadding = { xs: 2, sm: 2.5 };
const headingIconSx = {
  display: 'grid', placeItems: 'center', width: 36, height: 36,
  flexShrink: 0, borderRadius: 1.25, bgcolor: 'surface.nested', color: 'primary.main'
};
const paragraphSx = { whiteSpace: 'pre-wrap', overflowWrap: 'anywhere', lineHeight: 1.7 };

const statusIcons = {
  reported: 'document', acknowledged: 'check', assigned: 'team', awaitingapproval: 'clock',
  scheduled: 'calendar', inprogress: 'playCircle', awaitingtenant: 'messages', resolved: 'checkCircle', cancelled: 'stopCircle'
};
const priorityColors = { emergency: '#FFD0CA', high: '#FFD0CA', medium: '#FCE0A5', urgent: '#FCE0A5' };

function formatRequestDate(value) {
  if (!value) return '';
  const date = new Date(value);
  return Number.isFinite(date.getTime()) ? new Intl.DateTimeFormat(undefined, { dateStyle: 'medium', timeStyle: 'short' }).format(date) : '';
}

function CardHeading({ id, icon, children }) {
  return (
    <Stack direction="row" spacing={1.25} alignItems="center">
      <Box sx={headingIconSx}><AppIcon name={icon} size={19} /></Box>
      <Typography id={id} component="h2" variant="h5" fontWeight={750}>{children}</Typography>
    </Stack>
  );
}

export function MaintenanceRequestHeader({ request, property }) {
  const propertyName = request.propertyName || property?.name;
  const address = request.propertyStreetAddress || property?.streetAddress;
  const propertyLabel = [propertyName, address !== propertyName && address].filter(Boolean).join(' · ');
  const priority = request.priority || request.urgency;
  const priorityLabel = priority && `${String(priority).replace(/[-_]/g, ' ').toLowerCase().replace(/^./, letter => letter.toUpperCase())} priority`;
  const statusIcon = statusIcons[normalizeWorkflowToken(request.status)] || 'document';

  return (
    <Box
      component="header"
      sx={(theme) => ({
        display: 'grid', gridTemplateColumns: { xs: 'minmax(0, 1fr)', md: 'minmax(0, 1fr) minmax(180px, 250px)' },
        alignItems: 'center', gap: { xs: 2.25, md: 3 }, p: { xs: 2.5, sm: 3.5, lg: 4 },
        color: 'common.white', bgcolor: 'brand.forest', borderRadius: 3,
        backgroundImage: `linear-gradient(115deg, ${theme.palette.brand.forest} 30%, ${alpha(theme.palette.brand.teal, 0.45)})`
      })}
    >
      <Stack direction="row" alignItems="flex-start" spacing={{ xs: 1.25, sm: 2 }} sx={{ minWidth: 0 }}>
        <Box sx={(theme) => ({
          display: { xs: 'none', sm: 'grid' }, placeItems: 'center', width: 54, height: 54, flexShrink: 0,
          borderRadius: 2, color: 'brand.mint', bgcolor: alpha(theme.palette.brand.mint, 0.12), border: '1px solid', borderColor: alpha(theme.palette.brand.mint, 0.22)
        })}>
          <AppIcon name="maintenance" size={27} />
        </Box>
        <Box sx={{ minWidth: 0 }}>
          <Typography component="h1" sx={{ color: 'inherit', fontSize: 'clamp(1.75rem, 3vw, 2.55rem)', fontWeight: 800, lineHeight: 1.15, overflowWrap: 'anywhere' }}>
            {request.title}
          </Typography>
          {propertyLabel && (
            <Stack direction="row" spacing={0.75} alignItems="flex-start" sx={{ mt: 1.25, color: 'brand.mint' }}>
              <Box component="span" sx={{ display: 'inline-flex', pt: 0.35 }}><AppIcon name="home" size={16} /></Box>
              {request.propertyId ? (
                <Link component={RouterLink} to={`/landlord/property/${request.propertyId}`} color="inherit" variant="body2" underline="hover" sx={{ overflowWrap: 'anywhere' }}>{propertyLabel}</Link>
              ) : <Typography variant="body2" sx={{ overflowWrap: 'anywhere' }}>{propertyLabel}</Typography>}
            </Stack>
          )}
        </Box>
      </Stack>
      <Box sx={(theme) => ({
        minWidth: 0, width: { sm: 'fit-content', md: '100%' }, p: 1.75, borderRadius: 2,
        bgcolor: alpha(theme.palette.common.white, 0.065), border: '1px solid', borderColor: alpha(theme.palette.brand.mint, 0.24)
      })}>
        <Typography variant="body2" color="brand.mint" sx={{ mb: 0.5 }}>Current status</Typography>
        <Stack direction="row" spacing={0.75} alignItems="center">
          <AppIcon name={statusIcon} size={19} />
          <Typography sx={{ color: 'inherit', fontWeight: 750, fontSize: '1.2rem', lineHeight: 1.25 }}>{statusLabel(request.status)}</Typography>
        </Stack>
        {priorityLabel && (
          <Typography
            component="span"
            variant="caption"
            sx={(theme) => {
              const color = priorityColors[normalizeWorkflowToken(priority)] || theme.palette.brand.mint;
              return { display: 'inline-block', mt: 1.25, px: 1, py: 0.25, borderRadius: 10, bgcolor: alpha(color, 0.12), border: `1px solid ${alpha(color, 0.35)}`, color, fontWeight: 700 };
            }}
          >
            {priorityLabel}
          </Typography>
        )}
      </Box>
    </Box>
  );
}

export function MaintenanceRequestReport({ description, landlordSummary }) {
  const report = description?.trim() || '';
  const summary = landlordSummary?.trim() || '';
  const distinctSummary = summary.replace(/\s+/g, ' ') !== report.replace(/\s+/g, ' ') ? summary : '';

  return (
    <Paper variant="outlined" component="section" aria-labelledby="maintenance-report-heading" sx={{ ...cardSx, p: cardPadding }}>
      <CardHeading id="maintenance-report-heading" icon="document">Request details</CardHeading>
      <Stack spacing={1.75} divider={<Divider />} sx={{ mt: 2 }}>
        {distinctSummary && <Typography sx={paragraphSx}>{distinctSummary}</Typography>}
        {report && (
          <Box>
            {distinctSummary && <Typography component="h3" variant="subtitle2" color="text.secondary" sx={{ mb: 0.5 }}>Reported description</Typography>}
            <Typography sx={paragraphSx}>{report}</Typography>
          </Box>
        )}
        {!distinctSummary && !report && <Typography color="text.secondary">No description was provided.</Typography>}
      </Stack>
    </Paper>
  );
}

export function MaintenanceWorkDetails({ request, property, assignedTo }) {
  const unit = request.unitId && (property?.units || []).find((item) => String(item.id) === String(request.unitId));
  const deadline = !isClosedMaintenanceStatus(request.status) && formatRequestDate(request.actionByUtc);
  const rows = [
    { label: 'Assigned to', value: assignedTo, icon: 'team' },
    { label: 'Reported', value: formatRequestDate(request.createdAtUtc || request.createdAt), icon: 'clock' },
    { label: 'Action due', value: deadline, icon: 'calendar' },
    { label: 'Unit', value: unit?.name, icon: 'house' },
    { label: 'Issue location', value: request.location?.trim(), icon: 'home' }
  ].filter(({ value }) => value);

  return (
    <Paper variant="outlined" component="section" aria-labelledby="maintenance-work-heading" sx={{ ...cardSx, p: cardPadding }}>
      <CardHeading id="maintenance-work-heading" icon="checklists">Work details</CardHeading>
      <Box component="dl" sx={{ m: 0, mt: 1, '& > :not(:first-of-type)': { borderTop: 1, borderColor: 'divider' } }}>
        {rows.map(({ label, value, icon }) => (
          <Box key={label} sx={{ position: 'relative', py: 1.25, pl: 5, minWidth: 0 }}>
            <Typography component="dt" variant="body2" color="text.secondary">
              <Box component="span" sx={{ ...headingIconSx, position: 'absolute', left: 0, width: 30, height: 30 }}><AppIcon name={icon} size={16} /></Box>
              {label}
            </Typography>
            <Typography component="dd" variant="body2" sx={{ m: 0, mt: 0.15, fontWeight: 700, overflowWrap: 'anywhere' }}>{value}</Typography>
          </Box>
        ))}
      </Box>
    </Paper>
  );
}
