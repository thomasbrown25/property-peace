import { Alert, CircularProgress, Paper, Stack, Typography } from '@mui/material';

export default function InventorySnapshotCard({ snapshot, start, end, timeZoneId }) {
  const { report, loading, error } = snapshot;
  // Hide a previous window immediately, even before the range-change effect runs.
  const visible = report?.start === start && report?.end === end && report?.timeZoneId === timeZoneId;
  return <Paper sx={{ p: 3 }}>
    <Typography variant="h6" gutterBottom>Owner inventory snapshot</Typography>
    <Typography color="text.secondary" sx={{ mb: 2 }}>Property-local nights {start} to {end} (end exclusive). Inventory and pricing coverage only; not a booking or financial report.</Typography>
    {loading && <CircularProgress size={24} aria-label="Loading inventory snapshot" />}
    {error && <Alert severity="warning">Inventory snapshot unavailable: {error}</Alert>}
    {!loading && !error && !visible && <Typography color="text.secondary">Inventory snapshot unavailable for this range.</Typography>}
    {!loading && !error && visible && <Stack spacing={1}>
      <Typography>Total nights: {report.totalNights} · Blocked nights: {report.blockedNights}</Typography>
      <Typography>Owner blocked: {report.ownerBlockedNights} · Airbnb blocked: {report.airbnbBlockedNights} · Overlap: {report.overlapNights} (counted once in blocked nights)</Typography>
      <Typography>Unblocked nights, not booked/occupancy: {report.unblockedNights}</Typography>
      <Typography>Priced unblocked nights: {report.pricedUnblockedNights} · Unpriced unblocked nights: {report.unpricedUnblockedNights}</Typography>
      <Typography color="text.secondary">Booking metrics: Unavailable · Revenue metrics: Unavailable · Occupancy metrics: Unavailable</Typography>
      {report.airbnbSyncStaleWarning && <Alert severity="warning">Airbnb imported availability may be out of date. Check Airbnb directly before relying on these dates.</Alert>}
    </Stack>}
  </Paper>;
}
