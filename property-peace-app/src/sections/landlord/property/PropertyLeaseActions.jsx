import { useRef, useState } from 'react';
import { Alert, Box, Button, Checkbox, Dialog, DialogActions, DialogContent, DialogContentText, DialogTitle, FormControlLabel, IconButton, Menu, MenuItem, Stack, Typography } from '@mui/material';
import { MoreOutlined } from '@ant-design/icons';
import axiosServices from 'utils/axios';

// React portal events still bubble through the table row's React ancestors.
const stopRowEvent = event => event.stopPropagation();

export default function PropertyLeaseActions({ lease, onDeleted }) {
  const id = lease?.id ?? lease?.Id;
  const [anchor, setAnchor] = useState(null);
  const [open, setOpen] = useState(false);
  const [deleteDocuments, setDeleteDocuments] = useState(true);
  const [deleteChecklists, setDeleteChecklists] = useState(true);
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState('');
  const pending = useRef(false);
  const openDelete = () => {
    setAnchor(null);
    setDeleteDocuments(true);
    setDeleteChecklists(true);
    setError('');
    setOpen(true);
  };
  const closeDelete = () => { if (!pending.current) setOpen(false); };
  const confirmDelete = async () => {
    if (!id || pending.current) return;
    pending.current = true;
    setDeleting(true);
    setError('');
    try {
      const response = await axiosServices.delete(`/api/Lease/${id}`, {
        params: { deleteLeaseDocuments: deleteDocuments, deleteChecklists }
      });
      if (response.data?.success === false || response.data?.Success === false) {
        throw new Error(response.data?.message ?? response.data?.Message ?? 'Could not archive lease');
      }
      setOpen(false);
      // A failed refresh must not turn a completed archive into a retryable deletion.
      try { await onDeleted?.(id); } catch (refreshError) { console.warn('Could not refresh property after archive:', refreshError); }
    } catch (deleteError) {
      setError(deleteError?.response?.data?.message ?? deleteError?.message ?? 'Could not archive lease. Please try again.');
    } finally {
      pending.current = false;
      setDeleting(false);
    }
  };

  return (
    <Box onClick={stopRowEvent} onKeyDown={stopRowEvent}>
      <IconButton size="small" disabled={!id || deleting}
        aria-label={`More actions for ${lease?.leaseNickname ?? lease?.LeaseNickname ?? `lease #${id}`}`}
        aria-haspopup="menu" aria-expanded={Boolean(anchor)} onClick={event => setAnchor(event.currentTarget)}>
        <MoreOutlined />
      </IconButton>
      <Menu anchorEl={anchor} open={Boolean(anchor)} onClose={() => setAnchor(null)}
        onClick={stopRowEvent} onKeyDown={stopRowEvent}>
        <MenuItem onClick={openDelete} sx={{ color: 'error.main' }}>Delete</MenuItem>
      </Menu>
      <Dialog open={open} onClose={closeDelete} maxWidth="sm" fullWidth onClick={stopRowEvent} onKeyDown={stopRowEvent}>
        <DialogTitle>Delete lease?</DialogTitle>
        <DialogContent>
          {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}
          <DialogContentText sx={{ mb: 2 }}>
            This archives and hides the lease from the lease list. The lease is not erased from financial history;
            payments and other financial records are retained, and tenant profiles are retained.
          </DialogContentText>
          <Typography variant="body2" sx={{ fontWeight: 700, mb: 0.5 }}>Also remove from the app:</Typography>
          <Stack>
            <FormControlLabel control={<Checkbox checked={deleteDocuments} onChange={event => setDeleteDocuments(event.target.checked)} disabled={deleting} />} label="Lease documents" />
            <FormControlLabel control={<Checkbox checked={deleteChecklists} onChange={event => setDeleteChecklists(event.target.checked)} disabled={deleting} />} label="Lease checklists" />
          </Stack>
          <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
            Unchecked related data stays attached to the archived lease.
          </Typography>
          {(deleteDocuments || deleteChecklists) && (
            <Typography role="alert" variant="body2" color="error.main" sx={{ mt: 1, fontWeight: 600 }}>
              Warning: {deleteDocuments && 'Selected lease documents will be hidden (their records and stored file blobs are retained). '}{deleteChecklists && 'Selected lease checklists and their items will be permanently deleted. This cannot be undone. Checklist photo blobs may be retained.'}
            </Typography>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={closeDelete} disabled={deleting}>Cancel</Button>
          <Button color="error" variant="contained" disabled={deleting} onClick={confirmDelete}>
            {deleting ? 'Deleting…' : 'Delete lease'}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}
