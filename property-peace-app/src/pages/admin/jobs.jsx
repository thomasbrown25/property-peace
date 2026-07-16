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
  Alert,
  Chip,
  Tabs,
  Tab,
  TextField,
  FormControl,
  InputLabel,
  Select,
  MenuItem
} from '@mui/material';
import { PlayCircleOutlined, ReloadOutlined, SaveOutlined } from '@ant-design/icons';
import MainCard from 'components/MainCard';
import { getJobs, runJob, getJobHistory, getStateLawSources, updateStateLawSource, getGeneratedLaws, getLeasesForJobs } from 'api/admin/jobs';
import { openSnackbar } from 'api/snackbar';

function TabPanel({ children, value, index, ...rest }) {
  return (
    <div role="tabpanel" hidden={value !== index} id={`jobs-tabpanel-${index}`} aria-labelledby={`jobs-tab-${index}`} {...rest}>
      {value === index && <Box sx={{ pt: 2 }}>{children}</Box>}
    </div>
  );
}

export default function AdminJobs() {
  const [tab, setTab] = useState(0);
  const [jobs, setJobs] = useState([]);
  const [history, setHistory] = useState([]);
  const [sources, setSources] = useState([]);
  const [loadingJobs, setLoadingJobs] = useState(true);
  const [loadingHistory, setLoadingHistory] = useState(true);
  const [loadingSources, setLoadingSources] = useState(false);
  const [runningJobId, setRunningJobId] = useState(null);
  const [savingState, setSavingState] = useState(null);
  const [savingAll, setSavingAll] = useState(false);
  const [error, setError] = useState(null);
  const [sourceEdits, setSourceEdits] = useState({});
  const [generatedLaws, setGeneratedLaws] = useState({ depositLaws: [], lateFeeLaws: [] });
  const [loadingGeneratedLaws, setLoadingGeneratedLaws] = useState(false);
  const [leasesForJobs, setLeasesForJobs] = useState([]);
  const [loadingLeases, setLoadingLeases] = useState(false);
  const [rentReminderLeaseId, setRentReminderLeaseId] = useState('');

  const loadJobs = async () => {
    setLoadingJobs(true);
    setError(null);
    try {
      const res = await getJobs();
      if (res?.success && res?.data) setJobs(res.data);
      else setJobs([]);
    } catch (err) {
      console.error('Error loading jobs:', err);
      setError(err?.response?.data?.message || 'Failed to load jobs');
      setJobs([]);
    } finally {
      setLoadingJobs(false);
    }
  };

  const loadHistory = async () => {
    setLoadingHistory(true);
    try {
      const res = await getJobHistory(100);
      if (res?.success && res?.data) setHistory(res.data);
      else setHistory([]);
    } catch (err) {
      console.error('Error loading job history:', err);
      setHistory([]);
    } finally {
      setLoadingHistory(false);
    }
  };

  const loadLeasesForJobs = async () => {
    setLoadingLeases(true);
    try {
      const res = await getLeasesForJobs();
      if (res?.success && res?.data) setLeasesForJobs(res.data);
      else setLeasesForJobs([]);
    } catch (err) {
      console.error('Error loading leases for jobs:', err);
      setLeasesForJobs([]);
    } finally {
      setLoadingLeases(false);
    }
  };

  useEffect(() => {
    loadJobs();
  }, []);

  useEffect(() => {
    loadHistory();
  }, []);

  useEffect(() => {
    if (tab === 0) loadLeasesForJobs();
  }, [tab]);

  const loadSources = async () => {
    setLoadingSources(true);
    try {
      const res = await getStateLawSources();
      if (res?.success && res?.data) {
        const sorted = [...res.data].sort((a, b) => (a.state || '').localeCompare(b.state || ''));
        setSources(sorted);
        setSourceEdits({});
      } else setSources([]);
    } catch (err) {
      console.error('Error loading state law sources:', err);
      setSources([]);
    } finally {
      setLoadingSources(false);
    }
  };

  useEffect(() => {
    if (tab === 2) loadSources();
  }, [tab]);

  const loadGeneratedLaws = async () => {
    setLoadingGeneratedLaws(true);
    try {
      const res = await getGeneratedLaws();
      if (res?.success && res?.data) {
        setGeneratedLaws({
          depositLaws: (res.data.depositLaws || []).sort((a, b) => (a.state || '').localeCompare(b.state || '')),
          lateFeeLaws: (res.data.lateFeeLaws || []).sort((a, b) => (a.state || '').localeCompare(b.state || ''))
        });
      } else {
        setGeneratedLaws({ depositLaws: [], lateFeeLaws: [] });
      }
    } catch (err) {
      console.error('Error loading generated laws:', err);
      setGeneratedLaws({ depositLaws: [], lateFeeLaws: [] });
    } finally {
      setLoadingGeneratedLaws(false);
    }
  };

  useEffect(() => {
    if (tab === 3) loadGeneratedLaws();
  }, [tab]);

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
    const lateFeeUrl = (edit.lateFeeUrl !== undefined ? edit.lateFeeUrl : row.lateFeeUrl) ?? '';
    const securityDepositUrl = (edit.securityDepositUrl !== undefined ? edit.securityDepositUrl : row.securityDepositUrl) ?? '';
    setSavingState(state);
    try {
      const res = await updateStateLawSource({ state, lateFeeUrl: lateFeeUrl || null, securityDepositUrl: securityDepositUrl || null });
      if (res?.success) {
        openSnackbar({ open: true, message: 'Saved', variant: 'alert', alert: { color: 'success' } });
        setSourceEdits((prev) => {
          const next = { ...prev };
          delete next[state];
          return next;
        });
        setSources((prev) =>
          prev.map((s) =>
            s.state === state ? { ...s, lateFeeUrl: lateFeeUrl || null, securityDepositUrl: securityDepositUrl || null } : s
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
        const lateFeeUrl = (edit.lateFeeUrl !== undefined ? edit.lateFeeUrl : row.lateFeeUrl) ?? '';
        const securityDepositUrl = (edit.securityDepositUrl !== undefined ? edit.securityDepositUrl : row.securityDepositUrl) ?? '';
        const res = await updateStateLawSource({ state, lateFeeUrl: lateFeeUrl || null, securityDepositUrl: securityDepositUrl || null });
        if (res?.success) updates[state] = { lateFeeUrl: lateFeeUrl || null, securityDepositUrl: securityDepositUrl || null };
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

  const handleRunJob = async (jobId, leaseId) => {
    setRunningJobId(jobId);
    try {
      const res = await runJob(jobId, leaseId);
      if (res?.success) {
        openSnackbar({
          open: true,
          message: 'Job completed successfully',
          variant: 'alert',
          alert: { color: 'success' }
        });
        loadHistory();
      } else {
        openSnackbar({
          open: true,
          message: res?.message || 'Job failed',
          variant: 'alert',
          alert: { color: 'error' }
        });
      }
    } catch (err) {
      const msg = err?.response?.data?.message || err?.message || 'Job failed';
      openSnackbar({
        open: true,
        message: msg,
        variant: 'alert',
        alert: { color: 'error' }
      });
    } finally {
      setRunningJobId(null);
      loadHistory();
    }
  };

  const formatDate = (d) => {
    if (!d) return '—';
    const date = typeof d === 'string' ? new Date(d) : d;
    return date.toLocaleString();
  };

  return (
    <Box>
      <Typography variant="h4" fontWeight={700} sx={{ mb: 2 }}>
        Jobs
      </Typography>
      <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
        Manually run background jobs, view history, and manage state law source URLs.
      </Typography>

      {error && (
        <Alert severity="error" sx={{ mb: 2 }} onClose={() => setError(null)}>
          {error}
        </Alert>
      )}

      <Tabs value={tab} onChange={(_, v) => setTab(v)} sx={{ borderBottom: 1, borderColor: 'divider', mb: 0 }}>
        <Tab label="Run jobs" id="jobs-tab-0" />
        <Tab label="Job history" id="jobs-tab-1" />
        <Tab label="State law sources" id="jobs-tab-2" />
        <Tab label="Generated law descriptions" id="jobs-tab-3" />
      </Tabs>

      <TabPanel value={tab} index={0}>
      <MainCard title="Run a job" sx={{ mb: 3 }}>
        {loadingJobs ? (
          <Box sx={{ display: 'flex', justifyContent: 'center', py: 3 }}>
            <CircularProgress size={28} />
          </Box>
        ) : (
          <Stack spacing={2}>
            {jobs.map((job) => (
              <Box key={job.id} sx={{ display: 'flex', alignItems: 'center', gap: 2, flexWrap: 'wrap' }}>
                <Button
                  variant="contained"
                  startIcon={
                    runningJobId === job.id ? (
                      <CircularProgress size={18} color="inherit" />
                    ) : (
                      <PlayCircleOutlined />
                    )
                  }
                  onClick={() => {
                    if (job.id === 'RentReminder') {
                      const leaseIdNum = rentReminderLeaseId ? Number(rentReminderLeaseId) : null;
                      if (!leaseIdNum) return;
                      handleRunJob(job.id, leaseIdNum);
                    } else {
                      handleRunJob(job.id);
                    }
                  }}
                  disabled={
                    !!runningJobId ||
                    (job.id === 'RentReminder' && !rentReminderLeaseId)
                  }
                  sx={{ textTransform: 'none' }}
                >
                  Run: {job.name}
                </Button>
                {job.id === 'RentReminder' && (
                  <FormControl size="small" sx={{ minWidth: 320 }}>
                    <InputLabel id="rent-reminder-lease-label">Select lease</InputLabel>
                    <Select
                      labelId="rent-reminder-lease-label"
                      value={rentReminderLeaseId}
                      label="Select lease"
                      onChange={(e) => setRentReminderLeaseId(e.target.value)}
                      disabled={loadingLeases}
                    >
                      <MenuItem value="">
                        <em>{loadingLeases ? 'Loading…' : 'Select a lease'}</em>
                      </MenuItem>
                      {leasesForJobs.map((lease) => (
                        <MenuItem key={lease.id} value={lease.id}>
                          {lease.label}
                        </MenuItem>
                      ))}
                    </Select>
                  </FormControl>
                )}
              </Box>
            ))}
            {jobs.length === 0 && !loadingJobs && (
              <Typography variant="body2" color="text.secondary">
                No jobs available.
              </Typography>
            )}
          </Stack>
        )}
      </MainCard>
      </TabPanel>

      <TabPanel value={tab} index={1}>
      <MainCard
        title="Job run history"
        secondary={
          <Button
            size="small"
            startIcon={<ReloadOutlined />}
            onClick={loadHistory}
            disabled={loadingHistory}
            sx={{ textTransform: 'none' }}
          >
            Refresh
          </Button>
        }
      >
        {loadingHistory ? (
          <Box sx={{ display: 'flex', justifyContent: 'center', py: 3 }}>
            <CircularProgress size={28} />
          </Box>
        ) : (
          <TableContainer component={Paper} variant="outlined" sx={{ boxShadow: 'none' }}>
            <Table size="small">
              <TableHead>
                <TableRow>
                  <TableCell><strong>Job</strong></TableCell>
                  <TableCell><strong>Started</strong></TableCell>
                  <TableCell><strong>Completed</strong></TableCell>
                  <TableCell><strong>Status</strong></TableCell>
                  <TableCell><strong>Message</strong></TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {history.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={5} align="center" sx={{ py: 3 }}>
                      No run history yet.
                    </TableCell>
                  </TableRow>
                ) : (
                  history.map((row) => (
                    <TableRow key={row.id}>
                      <TableCell>{row.jobName}</TableCell>
                      <TableCell>{formatDate(row.startedAt)}</TableCell>
                      <TableCell>{formatDate(row.completedAt)}</TableCell>
                      <TableCell>
                        <Chip
                          label={row.status}
                          size="small"
                          color={row.status === 'Completed' ? 'success' : row.status === 'Failed' ? 'error' : 'default'}
                          variant="outlined"
                        />
                      </TableCell>
                      <TableCell sx={{ maxWidth: 320, overflow: 'hidden', textOverflow: 'ellipsis' }}>
                        {row.message || '—'}
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </TableContainer>
        )}
      </MainCard>
      </TabPanel>

      <TabPanel value={tab} index={2}>
        <MainCard
          title="State law sources"
          secondary={
            <Stack direction="column" alignItems="flex-end" spacing={1}>
              <Button size="small" startIcon={<ReloadOutlined />} onClick={loadSources} disabled={loadingSources} sx={{ textTransform: 'none' }}>
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
          <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
            Official .gov URLs used when running state late-fee and deposit-law jobs. Leave blank to use AI-only for that state.
          </Typography>
          {loadingSources ? (
            <Box sx={{ display: 'flex', justifyContent: 'center', py: 3 }}>
              <CircularProgress size={28} />
            </Box>
          ) : (
            <TableContainer component={Paper} variant="outlined" sx={{ boxShadow: 'none' }}>
              <Table size="small">
                <TableHead>
                  <TableRow>
                    <TableCell sx={{ width: 72 }}><strong>State</strong></TableCell>
                    <TableCell><strong>Late fee URL</strong></TableCell>
                    <TableCell><strong>Security deposit URL</strong></TableCell>
                    <TableCell sx={{ width: 100 }} align="right"><strong>Actions</strong></TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {sources.map((row) => (
                    <TableRow key={row.state}>
                      <TableCell>{row.state}</TableCell>
                      <TableCell>
                        <TextField
                          size="small"
                          fullWidth
                          placeholder="https://..."
                          value={getSourceDisplay(row, 'lateFeeUrl')}
                          onChange={(e) => handleSourceFieldChange(row.state, 'lateFeeUrl', e.target.value)}
                          sx={{ '& .MuiInputBase-input': { fontSize: '0.875rem' } }}
                        />
                      </TableCell>
                      <TableCell>
                        <TextField
                          size="small"
                          fullWidth
                          placeholder="https://..."
                          value={getSourceDisplay(row, 'securityDepositUrl')}
                          onChange={(e) => handleSourceFieldChange(row.state, 'securityDepositUrl', e.target.value)}
                          sx={{ '& .MuiInputBase-input': { fontSize: '0.875rem' } }}
                        />
                      </TableCell>
                      <TableCell align="right">
                        <Button
                          size="small"
                          variant="outlined"
                          startIcon={savingState === row.state ? <CircularProgress size={14} /> : <SaveOutlined />}
                          onClick={() => handleSaveSource(row.state)}
                          disabled={savingState != null || savingAll}
                          sx={{ textTransform: 'none' }}
                        >
                          Save
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </TableContainer>
          )}
        </MainCard>
      </TabPanel>

      <TabPanel value={tab} index={3}>
        <MainCard
          title="Generated law descriptions"
          secondary={
            <Button size="small" startIcon={<ReloadOutlined />} onClick={loadGeneratedLaws} disabled={loadingGeneratedLaws} sx={{ textTransform: 'none' }}>
              Refresh
            </Button>
          }
        >
          <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
            AI-generated summaries from the state law jobs. Run &quot;State deposit law update&quot; and &quot;State late fee law update&quot; to generate or refresh.
          </Typography>
          {loadingGeneratedLaws ? (
            <Box sx={{ display: 'flex', justifyContent: 'center', py: 3 }}>
              <CircularProgress size={28} />
            </Box>
          ) : (
            <Stack spacing={3}>
              <Box>
                <Typography variant="subtitle1" fontWeight={600} sx={{ mb: 1 }}>
                  Deposit laws (security deposits)
                </Typography>
                <TableContainer component={Paper} variant="outlined" sx={{ boxShadow: 'none' }}>
                  <Table size="small">
                    <TableHead>
                      <TableRow>
                        <TableCell sx={{ width: 72 }}><strong>State</strong></TableCell>
                        <TableCell><strong>Description</strong></TableCell>
                        <TableCell sx={{ width: 140 }}><strong>Last updated</strong></TableCell>
                      </TableRow>
                    </TableHead>
                    <TableBody>
                      {generatedLaws.depositLaws.length === 0 ? (
                        <TableRow>
                          <TableCell colSpan={3} align="center" sx={{ py: 2, color: 'text.secondary' }}>
                            No deposit law descriptions yet. Run the job to generate.
                          </TableCell>
                        </TableRow>
                      ) : (
                        generatedLaws.depositLaws.map((row) => (
                          <TableRow key={`dep-${row.state}`}>
                            <TableCell>{row.state}</TableCell>
                            <TableCell sx={{ maxWidth: 480, whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>
                              {(row.bulletPointsText || '').slice(0, 300)}
                              {(row.bulletPointsText || '').length > 300 ? '…' : ''}
                            </TableCell>
                            <TableCell>{formatDate(row.lastUpdated)}</TableCell>
                          </TableRow>
                        ))
                      )}
                    </TableBody>
                  </Table>
                </TableContainer>
              </Box>
              <Box>
                <Typography variant="subtitle1" fontWeight={600} sx={{ mb: 1 }}>
                  Late fee laws
                </Typography>
                <TableContainer component={Paper} variant="outlined" sx={{ boxShadow: 'none' }}>
                  <Table size="small">
                    <TableHead>
                      <TableRow>
                        <TableCell sx={{ width: 72 }}><strong>State</strong></TableCell>
                        <TableCell><strong>Grace period</strong></TableCell>
                        <TableCell><strong>Fee amount</strong></TableCell>
                        <TableCell sx={{ width: 140 }}><strong>Last updated</strong></TableCell>
                      </TableRow>
                    </TableHead>
                    <TableBody>
                      {generatedLaws.lateFeeLaws.length === 0 ? (
                        <TableRow>
                          <TableCell colSpan={4} align="center" sx={{ py: 2, color: 'text.secondary' }}>
                            No late fee law descriptions yet. Run the job to generate.
                          </TableCell>
                        </TableRow>
                      ) : (
                        generatedLaws.lateFeeLaws.map((row) => (
                          <TableRow key={`late-${row.state}`}>
                            <TableCell>{row.state}</TableCell>
                            <TableCell sx={{ maxWidth: 280, whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>
                              {(row.gracePeriodDescription || '—').slice(0, 200)}
                              {(row.gracePeriodDescription || '').length > 200 ? '…' : ''}
                            </TableCell>
                            <TableCell sx={{ maxWidth: 280, whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>
                              {(row.feeAmountDescription || '—').slice(0, 200)}
                              {(row.feeAmountDescription || '').length > 200 ? '…' : ''}
                            </TableCell>
                            <TableCell>{formatDate(row.lastUpdated)}</TableCell>
                          </TableRow>
                        ))
                      )}
                    </TableBody>
                  </Table>
                </TableContainer>
              </Box>
            </Stack>
          )}
        </MainCard>
      </TabPanel>
    </Box>
  );
}
