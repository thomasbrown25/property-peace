import { useState, useEffect } from 'react';
import { useDispatch } from 'react-redux';
import PropTypes from 'prop-types';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  Divider,
  Stack,
  Typography,
  TextField,
  FormControlLabel,
  Checkbox,
  Box,
  CircularProgress,
  Alert
} from '@mui/material';
import {
  UserOutlined,
  TeamOutlined,
  PlusOutlined,
  StopOutlined
} from '@ant-design/icons';
import { assignMaintenance } from 'store/maintenance/maintenance.action';
import { openSnackbar } from 'api/snackbar';
import VendorSelect from 'components/VendorSelect';

const MODES = {
  SELF: 'Self',
  VENDOR: 'Vendor',
  ONE_TIME: 'OneTimeContact',
  UNASSIGNED: 'Unassigned'
};

const modeOptions = [
  { key: MODES.SELF, label: 'Assign to me', icon: <UserOutlined />, description: "You'll handle this one" },
  { key: MODES.VENDOR, label: 'Assign to vendor', icon: <TeamOutlined />, description: 'Pick from your vendor list' },
  { key: MODES.ONE_TIME, label: 'Add one-time contact', icon: <PlusOutlined />, description: "Someone not in your vendor list yet" },
  { key: MODES.UNASSIGNED, label: 'Leave unassigned', icon: <StopOutlined />, description: 'Clear current assignment' }
];

export default function AssignMaintenanceModal({ open, onClose, maintenance, onSuccess }) {
  const dispatch = useDispatch();
  const [mode, setMode] = useState(null);
  const [vendorId, setVendorId] = useState(null);
  const [contact, setContact] = useState({ name: '', phone: '', email: '', notes: '' });
  const [saveAsVendor, setSaveAsVendor] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  // Pre-select current assignment mode
  useEffect(() => {
    if (!open) return;
    setError('');
    if (maintenance?.assignedToType === 'Vendor') {
      setMode(MODES.VENDOR);
      setVendorId(maintenance.vendorId || null);
    } else if (maintenance?.assignedToType === 'Self') {
      setMode(MODES.SELF);
    } else {
      setMode(null);
    }
    setContact({ name: '', phone: '', email: '', notes: '' });
    setSaveAsVendor(false);
  }, [open, maintenance]);

  const handleSubmit = async () => {
    setError('');

    if (!mode) {
      setError('Please select an assignment option.');
      return;
    }
    if (mode === MODES.VENDOR && !vendorId) {
      setError('Please select a vendor.');
      return;
    }
    if (mode === MODES.ONE_TIME && !contact.name.trim()) {
      setError('Contact name is required.');
      return;
    }

    setSubmitting(true);
    try {
      const payload = {
        assignedToType: mode,
        vendorId: mode === MODES.VENDOR ? vendorId : null,
        contactName: mode === MODES.ONE_TIME ? contact.name : null,
        contactPhone: mode === MODES.ONE_TIME ? contact.phone : null,
        contactEmail: mode === MODES.ONE_TIME ? contact.email : null,
        contactNotes: mode === MODES.ONE_TIME ? contact.notes : null,
        saveAsVendor: mode === MODES.ONE_TIME ? saveAsVendor : false
      };

      const result = await dispatch(assignMaintenance(maintenance.id, payload));

      if (result?.success) {
        openSnackbar({
          open: true,
          message: mode === MODES.UNASSIGNED ? 'Assignment cleared' : 'Assigned successfully',
          variant: 'alert',
          alert: { color: 'success', variant: 'filled' },
          close: true,
          anchorOrigin: { vertical: 'bottom', horizontal: 'right' },
          transition: 'SlideUp',
          autoHideDuration: 4000
        });
        onSuccess?.(result.data);
        onClose();
      } else {
        setError(result?.message || 'Assignment failed. Please try again.');
      }
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onClose={onClose} maxWidth="xs" fullWidth>
      <DialogTitle>Assign Request</DialogTitle>
      <Divider />
      <DialogContent sx={{ pt: 2 }}>
        {maintenance && (
          <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
            <strong>{maintenance.title}</strong>
            {maintenance.unitName ? ` · ${maintenance.unitName}` : ''}
          </Typography>
        )}

        {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}

        {/* Mode selector */}
        <Stack spacing={1} sx={{ mb: 2 }}>
          {modeOptions.map((opt) => {
            const isActive = mode === opt.key;
            return (
              <Box
                key={opt.key}
                onClick={() => setMode(opt.key)}
                sx={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 1.5,
                  px: 2,
                  py: 1.5,
                  borderRadius: 2,
                  cursor: 'pointer',
                  border: '1px solid',
                  borderColor: isActive ? 'primary.main' : 'divider',
                  bgcolor: isActive ? 'primary.lighter' : 'background.paper',
                  transition: 'all 0.15s'
                }}
              >
                <Box sx={{ color: isActive ? 'primary.main' : 'text.secondary', fontSize: 16 }}>
                  {opt.icon}
                </Box>
                <Box>
                  <Typography variant="body2" fontWeight={isActive ? 600 : 400}>
                    {opt.label}
                  </Typography>
                  <Typography variant="caption" color="text.secondary">
                    {opt.description}
                  </Typography>
                </Box>
              </Box>
            );
          })}
        </Stack>

        {/* Vendor picker */}
        {mode === MODES.VENDOR && (
          <Box sx={{ mt: 1 }}>
            <Typography variant="caption" color="text.secondary" sx={{ mb: 0.5, display: 'block' }}>
              Select vendor
            </Typography>
            <VendorSelect
              width="100%"
              value={vendorId}
              onChange={(id) => setVendorId(id)}
              label="Search vendors..."
            />
          </Box>
        )}

        {/* One-time contact form */}
        {mode === MODES.ONE_TIME && (
          <Stack spacing={1.5} sx={{ mt: 1 }}>
            <TextField
              label="Name *"
              size="small"
              fullWidth
              value={contact.name}
              onChange={(e) => setContact((c) => ({ ...c, name: e.target.value }))}
            />
            <TextField
              label="Phone"
              size="small"
              fullWidth
              value={contact.phone}
              onChange={(e) => setContact((c) => ({ ...c, phone: e.target.value }))}
            />
            <TextField
              label="Email"
              size="small"
              fullWidth
              value={contact.email}
              onChange={(e) => setContact((c) => ({ ...c, email: e.target.value }))}
            />
            <TextField
              label="Notes"
              size="small"
              fullWidth
              multiline
              rows={2}
              value={contact.notes}
              onChange={(e) => setContact((c) => ({ ...c, notes: e.target.value }))}
            />
            <FormControlLabel
              control={
                <Checkbox
                  size="small"
                  checked={saveAsVendor}
                  onChange={(e) => setSaveAsVendor(e.target.checked)}
                />
              }
              label={<Typography variant="body2">Save as vendor for future use</Typography>}
            />
          </Stack>
        )}
      </DialogContent>
      <Divider />
      <DialogActions sx={{ p: 2 }}>
        <Button variant="outlined" color="inherit" onClick={onClose} disabled={submitting}>
          Cancel
        </Button>
        <Button
          variant="contained"
          onClick={handleSubmit}
          disabled={submitting || !mode}
          startIcon={submitting ? <CircularProgress size={14} color="inherit" /> : null}
        >
          {mode === MODES.UNASSIGNED ? 'Clear Assignment' : 'Assign'}
        </Button>
      </DialogActions>
    </Dialog>
  );
}

AssignMaintenanceModal.propTypes = {
  open: PropTypes.bool.isRequired,
  onClose: PropTypes.func.isRequired,
  maintenance: PropTypes.object,
  onSuccess: PropTypes.func
};
