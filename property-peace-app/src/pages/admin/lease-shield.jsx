import { useState, useEffect } from 'react';
import {
  Box,
  Typography,
  Button,
  Stack,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Paper,
  CircularProgress,
  TextField,
  MenuItem,
  IconButton
} from '@mui/material';
import { ReloadOutlined, SaveOutlined, PlusOutlined, DeleteOutlined } from '@ant-design/icons';
import MainCard from 'components/MainCard';
import {
  getLeaseShieldStateLawSources,
  upsertLeaseShieldStateLawSource,
  deleteLeaseShieldStateLawSource
} from 'api/admin/lease-shield';
import { openSnackbar } from 'api/snackbar';

const ALL_STATE_CODES = [
  'AL', 'AK', 'AZ', 'AR', 'CA', 'CO', 'CT', 'DE', 'FL', 'GA',
  'HI', 'ID', 'IL', 'IN', 'IA', 'KS', 'KY', 'LA', 'ME', 'MD',
  'MA', 'MI', 'MN', 'MS', 'MO', 'MT', 'NE', 'NV', 'NH', 'NJ',
  'NM', 'NY', 'NC', 'ND', 'OH', 'OK', 'OR', 'PA', 'RI', 'SC',
  'SD', 'TN', 'TX', 'UT', 'VT', 'VA', 'WA', 'WV', 'WI', 'WY', 'DC'
];

export default function AdminLeaseShield() {
  const [sources, setSources] = useState([]);
  const [loading, setLoading] = useState(true);
  const [sourceEdits, setSourceEdits] = useState({});
  const [savingState, setSavingState] = useState(null);
  const [savingAll, setSavingAll] = useState(false);
  const [deletingState, setDeletingState] = useState(null);
  const [adding, setAdding] = useState(false);
  const [newRow, setNewRow] = useState({ state: '', baseUrl: '', description: '' });

  const loadSources = async () => {
    setLoading(true);
    try {
      const res = await getLeaseShieldStateLawSources();
      if (res?.success && res?.data) {
        const sorted = [...res.data].sort((a, b) => (a.state || '').localeCompare(b.state || ''));
        setSources(sorted);
        setSourceEdits({});
      } else setSources([]);
    } catch (err) {
      console.error('Error loading LeaseShield state law sources:', err);
      setSources([]);
      openSnackbar({
        open: true,
        message: err?.response?.data?.message || err?.message || 'Failed to load sources',
        variant: 'alert',
        alert: { color: 'error' }
      });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadSources();
  }, []);

  const handleSourceFieldChange = (state, field, value) => {
    setSourceEdits((prev) => ({
      ...prev,
      [state]: {
        ...(prev[state] || {}),
        [field]: value
      }
    }));
  };

  const getSourceDisplay = (row, field) => {
    const edit = sourceEdits[row.state];
    if (edit && field in edit) return edit[field] ?? row[field] ?? '';
    return row[field] ?? '';
  };

  const handleSaveSource = async (state) => {
    const row = sources.find((s) => s.state === state) || {};
    const edit = sourceEdits[state] || {};
    const baseUrl = (edit.baseUrl !== undefined ? edit.baseUrl : row.baseUrl) ?? '';
    const description = (edit.description !== undefined ? edit.description : row.description) ?? '';
    setSavingState(state);
    try {
      const res = await upsertLeaseShieldStateLawSource({ state, baseUrl: baseUrl || null, description: description || null });
      if (res?.success) {
        openSnackbar({ open: true, message: 'Saved', variant: 'alert', alert: { color: 'success' } });
        setSourceEdits((prev) => {
          const next = { ...prev };
          delete next[state];
          return next;
        });
        setSources((prev) =>
          prev.map((s) =>
            s.state === state
              ? { ...s, baseUrl: baseUrl || null, description: description || null, updatedAt: res.data?.updatedAt ?? s.updatedAt }
              : s
          )
        );
      } else {
        openSnackbar({ open: true, message: res?.message || 'Save failed', variant: 'alert', alert: { color: 'error' } });
      }
    } catch (err) {
      openSnackbar({
        open: true,
        message: err?.response?.data?.message || err?.message || 'Save failed',
        variant: 'alert',
        alert: { color: 'error' }
      });
    } finally {
      setSavingState(null);
    }
  };

  const handleSaveAll = async () => {
    const statesToSave = Object.keys(sourceEdits);
    if (statesToSave.length === 0) {
      openSnackbar({ open: true, message: 'No changes to save', variant: 'alert', alert: { color: 'info' } });
      return;
    }
    setSavingAll(true);
    try {
      const updates = {};
      for (const state of statesToSave) {
        const row = sources.find((s) => s.state === state) || {};
        const edit = sourceEdits[state] || {};
        const baseUrl = (edit.baseUrl !== undefined ? edit.baseUrl : row.baseUrl) ?? '';
        const description = (edit.description !== undefined ? edit.description : row.description) ?? '';
        const res = await upsertLeaseShieldStateLawSource({ state, baseUrl: baseUrl || null, description: description || null });
        if (res?.success)
          updates[state] = {
            baseUrl: baseUrl || null,
            description: description || null,
            updatedAt: res.data?.updatedAt
          };
      }
      setSourceEdits({});
      setSources((prev) =>
        prev.map((s) => (updates[s.state] ? { ...s, ...updates[s.state] } : s))
      );
      openSnackbar({ open: true, message: 'Saved all', variant: 'alert', alert: { color: 'success' } });
    } catch (err) {
      openSnackbar({
        open: true,
        message: err?.response?.data?.message || err?.message || 'Save failed',
        variant: 'alert',
        alert: { color: 'error' }
      });
    } finally {
      setSavingAll(false);
    }
  };

  const handleDelete = async (state) => {
    setDeletingState(state);
    try {
      const res = await deleteLeaseShieldStateLawSource(state);
      if (res?.success) {
        openSnackbar({ open: true, message: 'Deleted', variant: 'alert', alert: { color: 'success' } });
        setSources((prev) => prev.filter((s) => s.state !== state));
        setSourceEdits((prev) => {
          const next = { ...prev };
          delete next[state];
          return next;
        });
      } else {
        openSnackbar({ open: true, message: res?.message || 'Delete failed', variant: 'alert', alert: { color: 'error' } });
      }
    } catch (err) {
      openSnackbar({
        open: true,
        message: err?.response?.data?.message || err?.message || 'Delete failed',
        variant: 'alert',
        alert: { color: 'error' }
      });
    } finally {
      setDeletingState(null);
    }
  };

  const handleAdd = async () => {
    const state = (newRow.state || '').trim().toUpperCase();
    if (!state) {
      openSnackbar({ open: true, message: 'Select a state', variant: 'alert', alert: { color: 'warning' } });
      return;
    }
    if (sources.some((s) => s.state === state)) {
      openSnackbar({ open: true, message: 'This state already has a source', variant: 'alert', alert: { color: 'warning' } });
      return;
    }
    setAdding(true);
    try {
      const res = await upsertLeaseShieldStateLawSource({
        state,
        baseUrl: newRow.baseUrl?.trim() || null,
        description: newRow.description?.trim() || null
      });
      if (res?.success) {
        openSnackbar({ open: true, message: 'Added', variant: 'alert', alert: { color: 'success' } });
        setSources((prev) => [...prev, res.data].sort((a, b) => (a.state || '').localeCompare(b.state || '')));
        setNewRow({ state: '', baseUrl: '', description: '' });
      } else {
        openSnackbar({ open: true, message: res?.message || 'Add failed', variant: 'alert', alert: { color: 'error' } });
      }
    } catch (err) {
      openSnackbar({
        open: true,
        message: err?.response?.data?.message || err?.message || 'Add failed',
        variant: 'alert',
        alert: { color: 'error' }
      });
    } finally {
      setAdding(false);
    }
  };

  const formatDate = (d) => {
    if (!d) return '—';
    const date = typeof d === 'string' ? new Date(d) : d;
    return date.toLocaleString();
  };

  const existingStates = sources.map((s) => s.state);
  const statesAvailableToAdd = ALL_STATE_CODES.filter((s) => !existingStates.includes(s));

  return (
    <Box>
      <Typography variant="h4" fontWeight={700} sx={{ mb: 2 }}>
        LeaseShield State Law Sources
      </Typography>
      <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
        Manage state law source URLs and descriptions used by LeaseShield. Add, edit, or remove entries per state.
      </Typography>

      <MainCard
        title="State law sources"
        secondary={
          <Stack direction="row" alignItems="center" spacing={1}>
            <Button
              size="small"
              startIcon={<ReloadOutlined />}
              onClick={loadSources}
              disabled={loading}
              sx={{ textTransform: 'none' }}
            >
              Refresh
            </Button>
            <Button
              size="small"
              variant="contained"
              startIcon={savingAll ? <CircularProgress size={14} color="inherit" /> : <SaveOutlined />}
              onClick={handleSaveAll}
              disabled={savingAll || savingState != null || Object.keys(sourceEdits).length === 0}
              sx={{ textTransform: 'none' }}
            >
              Save all
            </Button>
          </Stack>
        }
      >
        {loading ? (
          <Box sx={{ display: 'flex', justifyContent: 'center', py: 3 }}>
            <CircularProgress size={28} />
          </Box>
        ) : (
          <>
            <Stack direction="row" alignItems="center" spacing={2} sx={{ mb: 2 }}>
              <Typography variant="body2" color="text.secondary">
                Add a new state:
              </Typography>
              <TextField
                select
                size="small"
                label="State"
                value={newRow.state}
                onChange={(e) => setNewRow((p) => ({ ...p, state: e.target.value }))}
                sx={{ minWidth: 100 }}
              >
                <MenuItem value="">—</MenuItem>
                {statesAvailableToAdd.map((st) => (
                  <MenuItem key={st} value={st}>
                    {st}
                  </MenuItem>
                ))}
              </TextField>
              <TextField
                size="small"
                placeholder="Base URL"
                value={newRow.baseUrl}
                onChange={(e) => setNewRow((p) => ({ ...p, baseUrl: e.target.value }))}
                sx={{ minWidth: 280 }}
              />
              <TextField
                size="small"
                placeholder="Description"
                value={newRow.description}
                onChange={(e) => setNewRow((p) => ({ ...p, description: e.target.value }))}
                sx={{ minWidth: 200 }}
              />
              <Button
                size="small"
                variant="outlined"
                startIcon={adding ? <CircularProgress size={14} /> : <PlusOutlined />}
                onClick={handleAdd}
                disabled={adding || !newRow.state}
                sx={{ textTransform: 'none' }}
              >
                Add
              </Button>
            </Stack>

            <TableContainer component={Paper} variant="outlined" sx={{ boxShadow: 'none' }}>
              <Table size="small">
                <TableHead>
                  <TableRow>
                    <TableCell sx={{ width: 72 }}><strong>State</strong></TableCell>
                    <TableCell><strong>Base URL</strong></TableCell>
                    <TableCell><strong>Description</strong></TableCell>
                    <TableCell sx={{ width: 160 }}><strong>Updated</strong></TableCell>
                    <TableCell sx={{ width: 120 }} align="right"><strong>Actions</strong></TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {sources.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={5} align="center" sx={{ py: 3, color: 'text.secondary' }}>
                        No state law sources yet. Add one above.
                      </TableCell>
                    </TableRow>
                  ) : (
                    sources.map((row) => (
                      <TableRow key={row.state}>
                        <TableCell>{row.state}</TableCell>
                        <TableCell>
                          <TextField
                            size="small"
                            fullWidth
                            placeholder="https://..."
                            value={getSourceDisplay(row, 'baseUrl')}
                            onChange={(e) => handleSourceFieldChange(row.state, 'baseUrl', e.target.value)}
                            sx={{ '& .MuiInputBase-input': { fontSize: '0.875rem' } }}
                          />
                        </TableCell>
                        <TableCell>
                          <TextField
                            size="small"
                            fullWidth
                            placeholder="Optional description"
                            value={getSourceDisplay(row, 'description')}
                            onChange={(e) => handleSourceFieldChange(row.state, 'description', e.target.value)}
                            sx={{ '& .MuiInputBase-input': { fontSize: '0.875rem' } }}
                          />
                        </TableCell>
                        <TableCell>{formatDate(row.updatedAt)}</TableCell>
                        <TableCell align="right">
                          <Button
                            size="small"
                            variant="outlined"
                            startIcon={savingState === row.state ? <CircularProgress size={14} /> : <SaveOutlined />}
                            onClick={() => handleSaveSource(row.state)}
                            disabled={savingState != null || savingAll}
                            sx={{ textTransform: 'none', mr: 0.5 }}
                          >
                            Save
                          </Button>
                          <IconButton
                            size="small"
                            color="error"
                            onClick={() => handleDelete(row.state)}
                            disabled={deletingState != null}
                            title="Delete"
                          >
                            {deletingState === row.state ? (
                              <CircularProgress size={18} color="error" />
                            ) : (
                              <DeleteOutlined />
                            )}
                          </IconButton>
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </TableContainer>
          </>
        )}
      </MainCard>
    </Box>
  );
}
