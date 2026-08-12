import { Box, MenuItem, Select, Stack, TextField, Tooltip } from '@mui/material';
import { DownOutlined } from '@ant-design/icons';
import { LEAD_STATUSES, titleCaseStatus } from 'utils/leads';

const controlSx = {
  width: { xs: '100%', sm: 'auto' },
  borderRadius: 1.75
};

export default function LeadFilters({ filters, listings, onChange }) {
  const update = (key) => (event) => onChange({ ...filters, [key]: event.target.value });

  return (
    <Stack
      direction={{ xs: 'column', sm: 'row' }}
      spacing={1}
      useFlexGap
      flexWrap="wrap"
      alignItems={{ sm: 'center' }}
      aria-label="Lead filters"
    >
      <Select
        size="small"
        value={filters.status}
        onChange={update('status')}
        IconComponent={DownOutlined}
        inputProps={{ 'aria-label': 'Stage or status' }}
        sx={{ ...controlSx, minWidth: { sm: 155 } }}
      >
        <MenuItem value="all">All stages</MenuItem>
        {LEAD_STATUSES.map((status) => <MenuItem key={status} value={status}>{titleCaseStatus(status)}</MenuItem>)}
      </Select>

      <Select
        displayEmpty
        size="small"
        value={filters.listingId}
        onChange={update('listingId')}
        IconComponent={DownOutlined}
        inputProps={{ 'aria-label': 'Listing or property' }}
        sx={{ ...controlSx, flex: { sm: 1 }, minWidth: { sm: 210 }, maxWidth: { sm: 340 } }}
      >
        <MenuItem value="">All listings</MenuItem>
        {listings.map((listing) => <MenuItem key={listing.id} value={String(listing.id)}>{listing.label}</MenuItem>)}
      </Select>

      <TextField
        size="small"
        type="number"
        placeholder="Assigned owner ID"
        value={filters.ownerUserId}
        onChange={update('ownerUserId')}
        inputProps={{ min: 1, 'aria-label': 'Assigned owner ID' }}
        sx={{
          width: { xs: '100%', sm: 175 },
          '& .MuiOutlinedInput-root': { borderRadius: 1.75 }
        }}
      />

      <Select
        size="small"
        value={filters.followUp}
        onChange={update('followUp')}
        IconComponent={DownOutlined}
        inputProps={{ 'aria-label': 'Follow-up date' }}
        sx={{ ...controlSx, minWidth: { sm: 155 } }}
      >
        <MenuItem value="all">Any follow-up date</MenuItem>
        <MenuItem value="overdue">Overdue</MenuItem>
        <MenuItem value="next7">Next 7 days</MenuItem>
        <MenuItem value="none">Not scheduled</MenuItem>
      </Select>

      <Tooltip title="The current lead list API does not return source attribution.">
        <Box sx={{ width: { xs: '100%', sm: 145 } }}>
          <Select
            disabled
            size="small"
            value="all"
            IconComponent={DownOutlined}
            inputProps={{ 'aria-label': 'Lead source' }}
            sx={{ width: '100%', borderRadius: 1.75 }}
          >
            <MenuItem value="all">All sources</MenuItem>
          </Select>
        </Box>
      </Tooltip>
    </Stack>
  );
}
