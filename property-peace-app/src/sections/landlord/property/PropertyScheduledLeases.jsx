import { useEffect, useState } from 'react';
import { Alert, Box, Button, Chip, Stack, Typography } from '@mui/material';
import { useNavigate } from 'react-router-dom';
import { useDrawer } from 'contexts/DrawerContext';
import axiosServices from 'utils/axios';
import { calendarDate } from 'utils/successorLease.mjs';
import { scheduledPropertyLeases } from './scheduledPropertyLeases.mjs';

export default function PropertyScheduledLeases({ property, propertyId }) {
  const [leases, setLeases] = useState([]);
  const [error, setError] = useState(false);
  const [forbidden, setForbidden] = useState(false);
  const navigate = useNavigate();
  const drawer = useDrawer();

  useEffect(() => {
    if (!propertyId) return;
    let cancelled = false;
    setError(false);
    setForbidden(false);
    setLeases([]);
    axiosServices.get(`/api/lease/property/${propertyId}`)
      .then((response) => {
        if (cancelled) return;
        if (!response.data?.success || !Array.isArray(response.data.data)) throw new Error('Invalid lease list');
        setLeases(response.data.data);
      })
      .catch((requestError) => {
        if (cancelled) return;
        setForbidden((requestError?.response?.status ?? requestError?.status) === 403);
        setError((requestError?.response?.status ?? requestError?.status) !== 403);
      });
    return () => { cancelled = true; };
  }, [propertyId, property]);

  const today = calendarDate(new Date());
  const upcoming = scheduledPropertyLeases(property, leases, today);
  const units = property?.units ?? property?.Units ?? [];
  if (forbidden) return null;

  return (
    <Box component="section" aria-label="Scheduled leases" sx={{ mt: 3 }}>
      <Stack direction="row" spacing={2} alignItems="center" sx={{ mb: 1 }}>
        <Typography variant="h6">Scheduled leases</Typography>
        <Button size="small" variant="outlined" onClick={() => drawer.openLeaseAddDrawer(null, property)}>
          Create lease (including occupied units)
        </Button>
      </Stack>
      <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
        The current tenant keeps the unit through its end date. If a new lease starts that same day, it becomes current the next day.
      </Typography>
      {error ? <Alert severity="warning">Scheduled leases could not be loaded. Refresh to try again.</Alert> : null}
      {!error && upcoming.length === 0 ? <Typography variant="body2" color="text.secondary">No scheduled leases.</Typography> : null}
      <Stack spacing={1}>
        {upcoming.map((lease) => {
          const leaseId = lease.id ?? lease.Id;
          const unit = units.find((item) => String(item.id ?? item.Id) === String(lease.unitId ?? lease.UnitId));
          return (
            <Stack key={leaseId} direction="row" spacing={2} alignItems="center" sx={{ p: 1.5, border: 1, borderColor: 'divider', borderRadius: 1 }}>
              <Chip label="Scheduled" color="info" size="small" variant="outlined" />
              <Typography variant="body2" sx={{ flex: 1 }}>
                {unit?.name ?? unit?.Name ?? `Unit ${lease.unitId ?? lease.UnitId}`} · {calendarDate(lease.startDate ?? lease.StartDate)} – {calendarDate(lease.endDate ?? lease.EndDate) ?? 'open end'}
              </Typography>
              <Button size="small" onClick={() => navigate(`/landlord/leases/${leaseId}`)}>View lease</Button>
            </Stack>
          );
        })}
      </Stack>
    </Box>
  );
}
