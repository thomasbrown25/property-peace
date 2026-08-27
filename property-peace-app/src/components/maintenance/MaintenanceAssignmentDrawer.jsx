import { useEffect, useState } from 'react';
import { Alert, Button, CircularProgress, IconButton, MenuItem, Stack, TextField, Typography, alpha, useTheme } from '@mui/material';
import { CloseOutlined, TeamOutlined } from '@ant-design/icons';
import ThemeAdaptiveDrawer from 'components/drawers/shared/ThemeAdaptiveDrawer';

export default function MaintenanceAssignmentDrawer({ open, onClose, assignees, currentAssignment, onAssign, saving = false }) {
  const theme = useTheme();
  const [selection, setSelection] = useState('');

  useEffect(() => {
    if (!open) return;
    const current = assignees.find((option) => {
      if (currentAssignment?.vendorId) return String(option.vendorId) === String(currentAssignment.vendorId);
      return option.assignedToUserId && String(option.assignedToUserId) === String(currentAssignment?.assignedToUserId);
    });
    setSelection(current?.key || assignees.find((option) => option.type === 'Self')?.key || '');
  }, [assignees, currentAssignment, open]);

  const selected = assignees.find((option) => option.key === selection);
  const borderColor = theme.palette.mode === 'dark' ? alpha(theme.palette.primary.main, 0.22) : alpha('#061e35', 0.12);

  return (
    <ThemeAdaptiveDrawer
      anchor="right"
      open={open}
      onClose={saving ? undefined : onClose}
      PaperProps={{
        sx: {
          width: { xs: '100%', sm: 430 },
          bgcolor: 'background.paper',
          backgroundImage: theme.palette.mode === 'dark'
            ? `linear-gradient(180deg, ${alpha(theme.palette.primary.main, 0.1)} 0%, transparent 220px)`
            : 'linear-gradient(180deg, #f3f8fc 0%, #ffffff 190px)',
          borderLeft: `1px solid ${borderColor}`
        }
      }}
    >
      <Stack sx={{ height: '100%' }}>
        <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ px: 3, py: 2.25, borderBottom: `1px solid ${borderColor}` }}>
          <Stack spacing={0.25}>
            <Typography variant="h5" fontWeight={800}>Assign maintenance</Typography>
            <Typography variant="caption" color="text.secondary">Choose yourself, a team member, or a portal-ready vendor.</Typography>
          </Stack>
          <IconButton onClick={onClose} disabled={saving} aria-label="Close assignment drawer"><CloseOutlined /></IconButton>
        </Stack>

        <Stack spacing={2.25} sx={{ flex: 1, overflowY: 'auto', px: 3, py: 3 }}>
          <Stack spacing={0.75}>
            <Typography variant="caption" fontWeight={750} color="text.secondary">ASSIGN TO</Typography>
            <TextField
              select
              fullWidth
              size="small"
              value={selection}
              onChange={(event) => setSelection(event.target.value)}
              SelectProps={{ displayEmpty: true }}
              inputProps={{ 'aria-label': 'Assign maintenance to' }}
            >
              {!assignees.length && <MenuItem value="" disabled>No available assignees</MenuItem>}
              {assignees.map((option) => (
                <MenuItem key={option.key} value={option.key}>
                  {option.label} · {option.type === 'Vendor' ? 'Vendor' : option.type === 'Self' ? 'You' : 'Team'}
                </MenuItem>
              ))}
            </TextField>
          </Stack>

          {!assignees.length && <Alert severity="warning">No active team members or portal-ready vendors are available. Reload the page after updating your organization or vendor list.</Alert>}
          {selected && (
            <Alert icon={<TeamOutlined />} severity="info">
              Assigning to <strong>{selected.label}</strong> will move this request to Assigned.
            </Alert>
          )}
        </Stack>

        <Stack direction="row" justifyContent="flex-end" spacing={1.25} sx={{ px: 3, py: 2, borderTop: `1px solid ${borderColor}` }}>
          <Button onClick={onClose} disabled={saving} sx={{ textTransform: 'none' }}>Cancel</Button>
          <Button
            variant="contained"
            onClick={() => onAssign(selected)}
            disabled={!selected || saving}
            startIcon={saving ? <CircularProgress size={15} color="inherit" /> : <TeamOutlined />}
            sx={{ px: 2.5, textTransform: 'none', fontWeight: 800 }}
          >
            {saving ? 'Assigning…' : 'Assign'}
          </Button>
        </Stack>
      </Stack>
    </ThemeAdaptiveDrawer>
  );
}
