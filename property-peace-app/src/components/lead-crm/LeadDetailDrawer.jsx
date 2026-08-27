import { useEffect, useMemo, useState } from 'react';
import {
  Alert, Box, Button, Chip, CircularProgress, Divider, Drawer, FormControl, InputLabel, MenuItem, Select, Stack, Tab, Tabs, TextField, Typography
} from '@mui/material';
import { CheckCircleOutlined, CloseOutlined, ClockCircleOutlined, FormOutlined, MailOutlined } from '@ant-design/icons';
import { useNavigate } from 'react-router-dom';
import {
  addLeadNote, addLeadTask, completeLeadTask, convertLeadToApplication, getLead, getLeadNotes, getLeadTasks, updateLead
} from 'api/leads';
import ShowingsPanel from './ShowingsPanel';
import { allowedLeadStatuses, formatZonedDateTime, getLeadErrorMessage, titleCaseStatus, toUtcIso, toZonedLocalInput } from 'utils/leads';

export default function LeadDetailDrawer({ leadId, open, onClose, showings, showingsLoading, showingsError, onChanged, onShowingsChanged, timeZone }) {
  const navigate = useNavigate();
  const [lead, setLead] = useState(null);
  const [notes, setNotes] = useState([]);
  const [tasks, setTasks] = useState([]);

  const [tab, setTab] = useState(0);
  const [loading, setLoading] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [note, setNote] = useState('');
  const [task, setTask] = useState({ title: '', assigneeUserId: '', dueAt: '' });
  const [edit, setEdit] = useState({ status: 'new', ownerUserId: '', assignedTeamMemberId: '', nextFollowUpAt: '' });

  const load = async () => {
    if (!leadId) return;
    setLoading(true); setError(''); setLead(null);
    try {
      const detail = await getLead(leadId);
      const [savedNotes, savedTasks] = await Promise.all([
        getLeadNotes(leadId), getLeadTasks(leadId)
      ]);
      setLead(detail); setNotes(Array.isArray(savedNotes) ? savedNotes : []); setTasks(Array.isArray(savedTasks) ? savedTasks : []);
      setEdit({ status: detail.status, ownerUserId: detail.ownerUserId || '', assignedTeamMemberId: detail.assignedTeamMemberId || '', nextFollowUpAt: toZonedLocalInput(detail.nextFollowUpAtUtc, timeZone) });
    } catch (requestError) { setError(getLeadErrorMessage(requestError, 'Lead detail could not be loaded.')); }
    finally { setLoading(false); }
  };
  useEffect(() => { if (open && leadId) load(); }, [open, leadId]); // eslint-disable-line react-hooks/exhaustive-deps

  const run = async (operation) => {
    setBusy(true); setError('');
    try { await operation(); await load(); await onChanged?.(); }
    catch (requestError) { setError(getLeadErrorMessage(requestError, requestError?.message || 'The request could not be completed.')); }
    finally { setBusy(false); }
  };
  const save = () => {
    const followUp = edit.nextFollowUpAt ? toUtcIso(edit.nextFollowUpAt, timeZone) : null;
    if (edit.nextFollowUpAt && !followUp) { setError('That follow-up time is nonexistent or ambiguous in this timezone. Choose another time.'); return; }
    run(() => updateLead(leadId, {
      status: edit.status, ownerUserId: edit.ownerUserId ? Number(edit.ownerUserId) : null,
      assignedTeamMemberId: edit.assignedTeamMemberId ? Number(edit.assignedTeamMemberId) : null,
      concurrencyToken: lead.concurrencyToken, nextFollowUpAtUtc: followUp
    }));
  };
  const addNote = () => run(async () => { await addLeadNote(leadId, note.trim()); setNote(''); });
  const addTask = () => run(async () => {
    const dueAtUtc = task.dueAt ? toUtcIso(task.dueAt, timeZone) : null;
    if (task.dueAt && !dueAtUtc) throw new Error('That task due time is nonexistent or ambiguous in this timezone. Choose another time.');
    await addLeadTask(leadId, { title: task.title.trim(), assigneeUserId: task.assigneeUserId ? Number(task.assigneeUserId) : null, dueAtUtc });
    setTask({ title: '', assigneeUserId: '', dueAt: '' });
  });
  const convert = async () => {
    setBusy(true); setError('');
    try {
      const result = await convertLeadToApplication(leadId);
      await onChanged?.();
      navigate(`/landlord/listings?tab=applications&applicationId=${result.applicationId}`);
    } catch (requestError) { setError(getLeadErrorMessage(requestError)); setBusy(false); }
  };

  const leadShowings = (showings || []).filter((showing) => Number(showing.leadId) === Number(leadId));
  const activity = useMemo(() => {
    if (!lead) return [];
    return [
      { at: lead.createdAtUtc, label: 'Inquiry saved' },
      ...notes.map((item) => ({ at: item.createdAtUtc, label: 'Note added', detail: item.body })),
      ...tasks.map((item) => ({ at: item.createdAtUtc, label: `Task ${item.status === 'completed' ? 'completed' : 'added'}`, detail: item.title })),
      ...leadShowings.map((item) => ({ at: item.startsAtUtc, label: `Showing ${titleCaseStatus(item.status)}` }))
    ].filter((item) => item.at).sort((a, b) => Date.parse(b.at) - Date.parse(a.at));
  }, [lead, notes, tasks, leadShowings]);

  return <Drawer anchor="right" open={open} onClose={busy ? undefined : onClose} PaperProps={{ sx: { width: { xs: '100%', sm: 620 }, p: { xs: 2, sm: 3 } } }}>
    <Stack direction="row" justifyContent="space-between" alignItems="flex-start"><Box><Typography variant="h5" fontWeight={800}>Lead details</Typography><Typography variant="body2" color="text.secondary">Verified prospect workflow and saved activity</Typography></Box><Button aria-label="Close lead details" onClick={onClose} startIcon={<CloseOutlined />}>Close</Button></Stack>
    {loading && <Stack alignItems="center" sx={{ py: 8 }} role="status"><CircularProgress /><Typography sx={{ mt: 1 }}>Loading lead…</Typography></Stack>}
    {error && <Alert severity="error" sx={{ mt: 2 }} action={leadId ? <Button color="inherit" onClick={load}>Retry</Button> : null}>{error}</Alert>}
    {!loading && lead && <>
      <Box sx={{ mt: 2, p: 2, border: '1px solid', borderColor: 'divider', borderRadius: 1.5 }}>
        <Stack direction="row" justifyContent="space-between" gap={1}><Box><Typography variant="h6" fontWeight={750}>{lead.name}</Typography><Stack direction="row" spacing={.75} alignItems="center"><MailOutlined /><Typography variant="body2">{lead.email}</Typography></Stack>{lead.phone && <Typography variant="body2">{lead.phone}</Typography>}</Box><Chip icon={lead.contactVerified ? <CheckCircleOutlined /> : <ClockCircleOutlined />} color={lead.contactVerified ? 'success' : 'warning'} label={lead.contactVerified ? 'Contact verified' : 'Verification pending'} /></Stack>
        {!lead.contactVerified && <Alert severity="warning" sx={{ mt: 1.5 }}>Sensitive booking actions remain unavailable until the prospect uses the verification message delivered by the backend.</Alert>}
      </Box>
      <Tabs value={tab} onChange={(_, value) => setTab(value)} variant="scrollable" scrollButtons="auto" aria-label="Lead detail sections" sx={{ mt: 1 }}>{['Overview', `Notes (${notes.length})`, `Tasks (${tasks.length})`, 'Showings', 'Activity'].map((label, index) => <Tab key={label} id={`detail-tab-${index}`} aria-controls={`detail-panel-${index}`} label={label} />)}</Tabs>
      <Divider />
      {tab === 0 && <Stack role="tabpanel" id="detail-panel-0" aria-labelledby="detail-tab-0" spacing={2} sx={{ mt: 2 }}>
        <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1}><FormControl size="small" fullWidth><InputLabel id="detail-stage-label">Stage / status</InputLabel><Select labelId="detail-stage-label" label="Stage / status" value={edit.status} onChange={(e) => setEdit((value) => ({ ...value, status: e.target.value }))}>{allowedLeadStatuses(lead.status).map((status) => <MenuItem key={status} value={status}>{titleCaseStatus(status)}</MenuItem>)}</Select></FormControl><TextField size="small" type="number" fullWidth label="Owner user ID" value={edit.ownerUserId} onChange={(e) => setEdit((value) => ({ ...value, ownerUserId: e.target.value }))} /></Stack>
        <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1}><TextField size="small" type="number" fullWidth label="Assigned team member ID" value={edit.assignedTeamMemberId} onChange={(e) => setEdit((value) => ({ ...value, assignedTeamMemberId: e.target.value }))} /><TextField size="small" type="datetime-local" fullWidth label="Next follow-up" InputLabelProps={{ shrink: true }} value={edit.nextFollowUpAt} onChange={(e) => setEdit((value) => ({ ...value, nextFollowUpAt: e.target.value }))} helperText={`Displayed in ${timeZone}`} /></Stack>
        <Button variant="contained" onClick={save} disabled={busy}>Save lead</Button>
        <Box><Typography fontWeight={750}>Pre-screen answers</Typography>{lead.preScreenResponse ? <Stack spacing={.75} sx={{ mt: 1 }}>{[
          ['Move-in date', lead.preScreenResponse.moveInDate], ['Occupants', lead.preScreenResponse.occupants],
          ['Pets', lead.preScreenResponse.hasPets == null ? null : lead.preScreenResponse.hasPets ? 'Yes' : 'No'],
          ['Smoking', lead.preScreenResponse.smoking == null ? null : lead.preScreenResponse.smoking ? 'Yes' : 'No'],
          ['Income range', lead.preScreenResponse.incomeRange],
          ['Requested showing', lead.preScreenResponse.requestedShowingAtUtc ? formatZonedDateTime(lead.preScreenResponse.requestedShowingAtUtc, timeZone) : null]
        ].map(([label, value]) => <Stack key={label} direction="row" justifyContent="space-between" gap={2}><Typography variant="body2" color="text.secondary">{label}</Typography><Typography variant="body2">{value ?? 'Not answered'}</Typography></Stack>)}</Stack> : <Alert severity="info" sx={{ mt: 1 }}>No pre-screen response was saved for this lead.</Alert>}</Box>
        <Box><Typography fontWeight={750}>Application</Typography>{lead.rentalApplicationId ? <Button startIcon={<FormOutlined />} onClick={() => navigate(`/landlord/listings?tab=applications&applicationId=${lead.rentalApplicationId}`)}>Open application #{lead.rentalApplicationId}</Button> : <Button variant="outlined" startIcon={<FormOutlined />} onClick={convert} disabled={busy || !lead.contactVerified}>Convert to application</Button>}</Box>
      </Stack>}
      {tab === 1 && <Stack spacing={1.25} sx={{ mt: 2 }}><TextField label="Add a private lead note" multiline minRows={3} value={note} onChange={(e) => setNote(e.target.value)} inputProps={{ maxLength: 2000 }} /><Button variant="contained" disabled={busy || !note.trim()} onClick={addNote}>Save note</Button>{!notes.length ? <Alert severity="info">No notes have been saved for this lead.</Alert> : notes.map((item) => <Box key={item.id} sx={{ p: 1.5, border: '1px solid', borderColor: 'divider' }}><Typography variant="body2">{item.body}</Typography><Typography variant="caption" color="text.secondary">User #{item.authorUserId} · {formatZonedDateTime(item.createdAtUtc, timeZone)}</Typography></Box>)}</Stack>}
      {tab === 2 && <Stack spacing={1.25} sx={{ mt: 2 }}><TextField label="Follow-up task" value={task.title} onChange={(e) => setTask((value) => ({ ...value, title: e.target.value }))} /><Stack direction={{ xs: 'column', sm: 'row' }} spacing={1}><TextField type="number" label="Assignee user ID" value={task.assigneeUserId} onChange={(e) => setTask((value) => ({ ...value, assigneeUserId: e.target.value }))} /><TextField type="datetime-local" label="Due" InputLabelProps={{ shrink: true }} value={task.dueAt} onChange={(e) => setTask((value) => ({ ...value, dueAt: e.target.value }))} /></Stack><Button variant="contained" disabled={busy || !task.title.trim()} onClick={addTask}>Add task</Button>{!tasks.length ? <Alert severity="info">No follow-up tasks have been added.</Alert> : tasks.map((item) => <Box key={item.id} sx={{ p: 1.5, border: '1px solid', borderColor: 'divider' }}><Stack direction="row" justifyContent="space-between"><Box><Typography fontWeight={700}>{item.title}</Typography><Typography variant="caption" color="text.secondary">{item.dueAtUtc ? `Due ${formatZonedDateTime(item.dueAtUtc, timeZone)}` : 'No due date'} · {titleCaseStatus(item.status)}</Typography></Box>{item.status === 'open' && <Button disabled={busy} onClick={() => run(() => completeLeadTask(leadId, item.id, item.concurrencyToken))}>Complete</Button>}</Stack></Box>)}</Stack>}
      {tab === 3 && <Box sx={{ mt: 2 }}><ShowingsPanel compact showings={leadShowings} loading={showingsLoading} error={showingsError} timeZone={timeZone} onChanged={onShowingsChanged} /></Box>}
      {tab === 4 && <Stack spacing={1.25} sx={{ mt: 2 }}><Alert severity="info">Activity is based on saved lead, note, task, and showing records returned by the API. Delivery status is not inferred.</Alert>{activity.map((item, index) => <Box key={`${item.at}-${index}`} sx={{ pl: 2, borderLeft: '2px solid', borderColor: 'primary.main' }}><Typography fontWeight={700}>{item.label}</Typography>{item.detail && <Typography variant="body2">{item.detail}</Typography>}<Typography variant="caption" color="text.secondary">{formatZonedDateTime(item.at, timeZone)}</Typography></Box>)}</Stack>}
    </>}
  </Drawer>;
}
