import { useEffect, useState } from 'react';
import { Alert, Box, Button, Chip, CircularProgress, Stack, Typography } from '@mui/material';
import { useNavigate } from 'react-router-dom';
import axiosServices from 'utils/axios';
import { formatCurrency, formatDate } from 'utils/formatters';
import { recentPropertyLeases } from './propertyLeaseList.mjs';

export default function PropertyLeasesTab({ propertyId, property }) {
  const [leases, setLeases] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const navigate = useNavigate();

  useEffect(() => {
    if (!propertyId) {
      setLeases([]);
      setLoading(false);
      return;
    }
    let cancelled = false;
    setLoading(true);
    setError(false);
    setLeases([]);
    axiosServices.get(`/api/lease/property/${propertyId}/all`)
      .then((response) => {
        if (cancelled) return;
        if (!response.data?.success || !Array.isArray(response.data.data)) throw new Error('Invalid lease list');
        setLeases(response.data.data);
      })
      .catch(() => { if (!cancelled) setError(true); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [propertyId]);

  const units = property?.units ?? property?.Units ?? [];
  const recent = recentPropertyLeases(leases);
  return (
    <Box component="section" aria-label="Property leases" sx={{ maxWidth: 1000 }}>
      <Stack direction={{ xs: 'column', sm: 'row' }} justifyContent="space-between" alignItems={{ sm: 'center' }} gap={1} sx={{ mb: 2 }}>
        <Typography variant="h5">Leases</Typography>
        <Button variant="outlined" onClick={() => navigate(`/landlord/leases?propertyId=${encodeURIComponent(propertyId)}&view=all`)}>
          View all
        </Button>
      </Stack>
      {loading ? <CircularProgress aria-label="Loading leases" /> : error ? (
        <Alert severity="warning">Leases could not be loaded. Refresh to try again.</Alert>
      ) : recent.length === 0 ? (
        <Typography color="text.secondary">No leases for this property yet.</Typography>
      ) : (
        <Stack spacing={1}>
          {recent.map((lease) => {
            const id = lease.id ?? lease.Id;
            const unitId = lease.unitId ?? lease.UnitId;
            const unit = units.find((item) => String(item.id ?? item.Id) === String(unitId));
            const name = lease.name ?? lease.Name ?? lease.leaseNickname ?? lease.LeaseNickname;
            const start = lease.startDate ?? lease.StartDate;
            const end = lease.endDate ?? lease.EndDate;
            const rent = lease.rentAmount ?? lease.RentAmount;
            return (
              <Box key={id} sx={{ p: 2, border: 1, borderColor: 'divider', borderRadius: 1 }}>
                <Stack direction={{ xs: 'column', sm: 'row' }} alignItems={{ sm: 'center' }} gap={1.5}>
                  <Box sx={{ flex: 1, minWidth: 0 }}>
                    <Typography fontWeight={600}>{name || unit?.name || unit?.Name || `Lease ${id}`}</Typography>
                    <Typography variant="body2" color="text.secondary">
                      {start ? formatDate(start) : 'Start date not set'} – {end ? formatDate(end) : 'Open end'}
                      {rent != null ? ` · ${formatCurrency(rent)} rent` : ''}
                    </Typography>
                  </Box>
                  <Chip size="small" variant="outlined" label={lease.isDrafted ?? lease.IsDrafted ? 'Draft' : lease.isActive ?? lease.IsActive ? 'Active' : 'Ended'} />
                  <Button size="small" onClick={() => navigate(`/landlord/leases/${id}`)}>View lease</Button>
                </Stack>
              </Box>
            );
          })}
        </Stack>
      )}
    </Box>
  );
}
