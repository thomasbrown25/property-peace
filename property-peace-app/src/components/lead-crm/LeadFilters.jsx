import { Box, FormControl, InputLabel, MenuItem, Select, Stack, TextField, Tooltip } from '@mui/material';
import { LEAD_STATUSES, titleCaseStatus } from 'utils/leads';

export default function LeadFilters({ filters, listings, onChange }) {
  const update = (key) => (event) => onChange({ ...filters, [key]: event.target.value });
  return (
    <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1.25} useFlexGap flexWrap="wrap" aria-label="Lead filters">
      <FormControl size="small" sx={{ minWidth: 155 }}>
        <InputLabel id="lead-stage-label">Stage / status</InputLabel>
        <Select labelId="lead-stage-label" label="Stage / status" value={filters.status} onChange={update('status')}>
          <MenuItem value="all">All stages</MenuItem>
          {LEAD_STATUSES.map((status) => <MenuItem key={status} value={status}>{titleCaseStatus(status)}</MenuItem>)}
        </Select>
      </FormControl>
      <FormControl size="small" sx={{ minWidth: 180 }}>
        <InputLabel id="lead-listing-label">Listing / property</InputLabel>
        <Select labelId="lead-listing-label" label="Listing / property" value={filters.listingId} onChange={update('listingId')}>
          <MenuItem value="">All listings</MenuItem>
          {listings.map((listing) => <MenuItem key={listing.id} value={String(listing.id)}>{listing.label}</MenuItem>)}
        </Select>
      </FormControl>
      <TextField size="small" type="number" label="Assigned owner ID" value={filters.ownerUserId} onChange={update('ownerUserId')} inputProps={{ min: 1 }} sx={{ width: 165 }} />
      <FormControl size="small" sx={{ minWidth: 155 }}>
        <InputLabel id="follow-up-label">Follow-up</InputLabel>
        <Select labelId="follow-up-label" label="Follow-up" value={filters.followUp} onChange={update('followUp')}>
          <MenuItem value="all">Any date</MenuItem>
          <MenuItem value="overdue">Overdue</MenuItem>
          <MenuItem value="next7">Next 7 days</MenuItem>
          <MenuItem value="none">Not scheduled</MenuItem>
        </Select>
      </FormControl>
      <Tooltip title="The current lead list API does not return source attribution.">
        <Box><TextField size="small" disabled label="Source" value="All sources" sx={{ width: 145 }} /></Box>
      </Tooltip>
    </Stack>
  );
}
