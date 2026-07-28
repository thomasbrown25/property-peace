import ThemeAdaptiveDrawer from 'components/drawers/shared/ThemeAdaptiveDrawer';
import { useState, useMemo, useEffect } from 'react';
import { useSelector } from 'react-redux';
import {
  Box,
  Typography,
  Stack,
  Button,
  Divider,
  IconButton,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Alert,
  CircularProgress,
  alpha,
  useTheme
} from '@mui/material';
import { CloseOutlined, FileTextOutlined, HomeOutlined } from '@ant-design/icons';
import { selectProperties } from 'store/property/property.selector';
import { addTenantToLease } from 'api/lease';
import { openSnackbar } from 'api/snackbar';
import { formatDate } from 'utils/formatters';

export default function AddToLeaseDrawer({ open, tenant, onClose, onSuccess }) {
  const theme = useTheme();
  const properties = useSelector(selectProperties) || [];

  const [selectedPropertyId, setSelectedPropertyId] = useState('');
  const [selectedLeaseId, setSelectedLeaseId] = useState('');
  const [submitting, setSubmitting] = useState(false);

  // Reset selections when drawer opens with a new tenant
  useEffect(() => {
    if (open) {
      setSelectedPropertyId('');
      setSelectedLeaseId('');
    }
  }, [open, tenant?.id]);

  // Properties that have at least one unit with an active lease
  const propertiesWithLeases = useMemo(() => {
    return properties.filter((p) =>
      (p.units || []).some((u) => {
        const lease = u.lease || u.Lease;
        return lease && (lease.isActive || lease.IsActive);
      })
    );
  }, [properties]);

  const selectedProperty = useMemo(
    () => properties.find((p) => p.id === selectedPropertyId) || null,
    [properties, selectedPropertyId]
  );

  // Active leases for the selected property
  const availableLeases = useMemo(() => {
    if (!selectedProperty) return [];
    const leases = [];
    (selectedProperty.units || []).forEach((u) => {
      const lease = u.lease || u.Lease;
      if (lease && (lease.isActive || lease.IsActive)) {
        leases.push({ ...lease, unitName: u.name || u.Name });
      }
    });
    return leases;
  }, [selectedProperty]);

  // Reset lease selection when property changes
  useEffect(() => {
    setSelectedLeaseId('');
  }, [selectedPropertyId]);

  // Check if this tenant is already on the selected lease
  const alreadyOnLease = useMemo(() => {
    if (!selectedLeaseId || !tenant) return false;
    const lease = availableLeases.find((l) => (l.id || l.Id) === selectedLeaseId);
    if (!lease) return false;
    return (lease.tenants || []).some(
      (t) => (t.id || t.Id) === tenant.id
    );
  }, [selectedLeaseId, availableLeases, tenant]);

  const selectedLease = useMemo(
    () => availableLeases.find((l) => (l.id || l.Id) === selectedLeaseId) || null,
    [availableLeases, selectedLeaseId]
  );

  const handleSubmit = async () => {
    if (!selectedLeaseId || !tenant?.id) return;
    setSubmitting(true);
    try {
      const response = await addTenantToLease(selectedLeaseId, tenant.id);
      if (response?.success === false) {
        openSnackbar({ open: true, message: response.message || 'Failed to add tenant to lease', variant: 'alert', alert: { color: 'error' } });
      } else {
        openSnackbar({ open: true, message: `${tenant.firstname} ${tenant.lastname} added to lease successfully`, variant: 'alert', alert: { color: 'success' } });
        if (onSuccess) onSuccess();
        onClose();
      }
    } catch (err) {
      openSnackbar({ open: true, message: err?.message || 'Failed to add tenant to lease', variant: 'alert', alert: { color: 'error' } });
    } finally {
      setSubmitting(false);
    }
  };

  const tenantName = tenant ? `${tenant.firstname || ''} ${tenant.lastname || ''}`.trim() : '';

  return (
    <ThemeAdaptiveDrawer
      anchor="right"
      open={open}
      onClose={onClose}
      PaperProps={{ sx: { width: { xs: '100%', sm: 440 }, p: 0, bgcolor: 'background.paper' } }}
    >
      {/* Header */}
      <Stack
        direction="row"
        alignItems="center"
        justifyContent="space-between"
        sx={{ px: 3, py: 2, borderBottom: `1px solid ${theme.palette.divider}` }}
      >
        <Stack direction="row" spacing={1.5} alignItems="center">
          <Box
            sx={{
              width: 36,
              height: 36,
              borderRadius: 1.5,
              bgcolor: alpha(theme.palette.primary.main, 0.1),
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center'
            }}
          >
            <FileTextOutlined style={{ fontSize: 18, color: theme.palette.primary.main }} />
          </Box>
          <Box>
            <Typography variant="h6" fontWeight={600}>Add to Lease</Typography>
            {tenantName && (
              <Typography variant="caption" color="text.secondary">{tenantName}</Typography>
            )}
          </Box>
        </Stack>
        <IconButton size="small" onClick={onClose}>
          <CloseOutlined />
        </IconButton>
      </Stack>

      {/* Body */}
      <Box sx={{ px: 3, py: 3, flex: 1, overflowY: 'auto' }}>
        {propertiesWithLeases.length === 0 ? (
          <Alert severity="info" icon={<HomeOutlined />}>
            No properties with active leases found. Create a lease first before adding tenants to it.
          </Alert>
        ) : (
          <Stack spacing={3}>
            {/* Step 1 — Property */}
            <Box>
              <Typography variant="body2" fontWeight={600} sx={{ mb: 1 }}>
                1. Select Property
              </Typography>
              <FormControl fullWidth size="small">
                <InputLabel>Property</InputLabel>
                <Select
                  value={selectedPropertyId}
                  label="Property"
                  onChange={(e) => setSelectedPropertyId(e.target.value)}
                >
                  {propertiesWithLeases.map((p) => (
                    <MenuItem key={p.id} value={p.id}>
                      {p.streetAddress || p.name || `Property ${p.id}`}
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>
            </Box>

            {/* Step 2 — Lease */}
            {selectedPropertyId && (
              <Box>
                <Typography variant="body2" fontWeight={600} sx={{ mb: 1 }}>
                  2. Select Lease
                </Typography>
                {availableLeases.length === 0 ? (
                  <Alert severity="info">No active leases found for this property.</Alert>
                ) : (
                  <FormControl fullWidth size="small">
                    <InputLabel>Lease</InputLabel>
                    <Select
                      value={selectedLeaseId}
                      label="Lease"
                      onChange={(e) => setSelectedLeaseId(e.target.value)}
                    >
                      {availableLeases.map((lease) => {
                        const id = lease.id || lease.Id;
                        const start = lease.startDate || lease.StartDate;
                        const end = lease.endDate || lease.EndDate;
                        const label = lease.name || lease.Name ||
                          (start && end ? `${formatDate(start)} – ${formatDate(end)}` : `Lease #${id}`);
                        return (
                          <MenuItem key={id} value={id}>
                            <Stack>
                              <Typography variant="body2">{label}</Typography>
                              {lease.unitName && (
                                <Typography variant="caption" color="text.secondary">
                                  {lease.unitName}
                                </Typography>
                              )}
                            </Stack>
                          </MenuItem>
                        );
                      })}
                    </Select>
                  </FormControl>
                )}
              </Box>
            )}

            {/* Lease summary */}
            {selectedLease && (
              <Box
                sx={{
                  p: 2,
                  borderRadius: 2,
                  bgcolor: alpha(theme.palette.primary.main, 0.05),
                  border: `1px solid ${alpha(theme.palette.primary.main, 0.15)}`
                }}
              >
                <Typography variant="body2" fontWeight={600} sx={{ mb: 0.5 }}>
                  Lease Summary
                </Typography>
                {selectedLease.unitName && (
                  <Typography variant="caption" color="text.secondary" display="block">
                    Unit: {selectedLease.unitName}
                  </Typography>
                )}
                {(selectedLease.startDate || selectedLease.StartDate) && (
                  <Typography variant="caption" color="text.secondary" display="block">
                    Term: {formatDate(selectedLease.startDate || selectedLease.StartDate)}
                    {(selectedLease.endDate || selectedLease.EndDate) && ` – ${formatDate(selectedLease.endDate || selectedLease.EndDate)}`}
                  </Typography>
                )}
                {(selectedLease.tenants || []).length > 0 && (
                  <Typography variant="caption" color="text.secondary" display="block">
                    Current tenants: {selectedLease.tenants.map((t) => `${t.firstname || ''} ${t.lastname || ''}`.trim()).join(', ')}
                  </Typography>
                )}
              </Box>
            )}

            {/* Already on lease warning */}
            {alreadyOnLease && (
              <Alert severity="warning">
                {tenantName} is already on this lease.
              </Alert>
            )}
          </Stack>
        )}
      </Box>

      {/* Footer */}
      <Divider />
      <Stack direction="row" spacing={1.5} sx={{ px: 3, py: 2 }}>
        <Button variant="outlined" fullWidth onClick={onClose} sx={{ textTransform: 'none' }}>
          Cancel
        </Button>
        <Button
          variant="contained"
          fullWidth
          disabled={!selectedLeaseId || alreadyOnLease || submitting}
          onClick={handleSubmit}
          sx={{ textTransform: 'none' }}
        >
          {submitting ? <CircularProgress size={18} color="inherit" /> : 'Add to Lease'}
        </Button>
      </Stack>
    </ThemeAdaptiveDrawer>
  );
}
