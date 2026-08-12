import { useEffect, useMemo, useRef, useState } from 'react';
import PropTypes from 'prop-types';
import {
  Alert, Box, Button, Checkbox, Chip, CircularProgress, Divider, FormControl, FormControlLabel,
  FormLabel, IconButton, MenuItem, Paper, Radio, RadioGroup, Stack, Step, StepLabel, Stepper,
  TextField, Typography, alpha, useTheme
} from '@mui/material';
import { CheckCircleOutlined, CloseOutlined, CloudUploadOutlined, DeleteOutlined, HomeOutlined, PlusOutlined } from '@ant-design/icons';
import ThemeAdaptiveDrawer from 'components/drawers/shared/ThemeAdaptiveDrawer';
import axiosServices from 'utils/axios';
import { maintenanceWorkflowAPI, maintenanceProblemMessage, newMaintenanceIdempotencyKey } from 'api/maintenanceWorkflow';
import { buildCreateMaintenancePayload, classifySignals, createEvidenceUploadEntries, emergencyInstructions, evidenceSelection, MAINTENANCE_EVIDENCE_TYPES, MAINTENANCE_SIGNALS, slaState, uploadPendingEvidence } from 'utils/maintenanceWorkflow';

const STEPS = ['Issue', 'Safety', 'Access', 'Evidence', 'Review'];
const CATEGORIES = ['Plumbing', 'Electrical', 'HVAC', 'Appliance', 'Locks & security', 'Pest', 'Structural', 'General repair'];
const emptyWindow = () => ({ startsAtUtc: '', endsAtUtc: '', accessInstructions: '' });
const initialIntake = (unitId) => ({ leaseId: '', propertyId: '', unitId: unitId || '', category: '', location: '', description: '', signals: [], accessPermission: 'contact', hasPets: false, petDetails: '', preferredWindows: [], files: [] });

function FieldSummary({ label, children, onEdit }) {
  return <Box sx={{ p: 1.5, border: '1px solid', borderColor: 'divider', borderRadius: 1.5 }}><Stack direction="row" justifyContent="space-between" spacing={1}><Box><Typography variant="caption" color="text.secondary" fontWeight={700}>{label}</Typography><Box sx={{ mt: 0.35 }}>{children}</Box></Box><Button size="small" onClick={onEdit}>Edit</Button></Stack></Box>;
}

export default function TenantMaintenanceFormDrawer({ open, onClose, onRequestCreated, unitId }) {
  const theme = useTheme(); const inputRef = useRef(null); const createKeyRef = useRef(null);
  const [step, setStep] = useState(0); const [leases, setLeases] = useState([]); const [loadingLeases, setLoadingLeases] = useState(false);
  const [intake, setIntake] = useState(() => initialIntake(unitId)); const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState(''); const [receipt, setReceipt] = useState(null); const [uploadFailures, setUploadFailures] = useState([]);
  const update = (field, value) => setIntake((current) => ({ ...current, [field]: value }));

  useEffect(() => {
    if (!open) return; setLoadingLeases(true); setError('');
    axiosServices.get('/api/lease/tenant/my-leases').then((response) => {
      const rows = response.data?.success && Array.isArray(response.data?.data)
        ? response.data.data.filter((lease) => lease.id && lease.propertyId && lease.unitId)
        : null;
      if (!rows) throw new Error('Lease response was incomplete.');
      setLeases(rows);
      const selected = rows.find((lease) => Number(lease.unitId) === Number(unitId)) || (rows.length === 1 ? rows[0] : null);
      if (selected) setIntake((current) => ({ ...current, leaseId: selected.id, propertyId: selected.propertyId, unitId: selected.unitId }));
      if (!rows.length) setError('No lease with a property and unit is available for maintenance reporting.');
    }).catch(() => { setLeases([]); setError('Your leases could not be loaded. Property and unit selection is unavailable; no placeholder location will be submitted.'); }).finally(() => setLoadingLeases(false));
  }, [open, unitId]);

  useEffect(() => () => intake.files.forEach((item) => URL.revokeObjectURL(item.preview)), [intake.files]);
  const selectedLease = leases.find((lease) => Number(lease.id) === Number(intake.leaseId));
  const urgency = classifySignals(intake.signals); const emergency = emergencyInstructions(intake.signals);
  const validWindows = intake.preferredWindows.every((window) => window.startsAtUtc && window.endsAtUtc && new Date(window.endsAtUtc) > new Date(window.startsAtUtc));
  const canNext = [Boolean(intake.leaseId && intake.propertyId && intake.unitId && intake.category && intake.location.trim() && intake.description.trim().length >= 10), true, validWindows, true, true][step];

  const resetAndClose = () => { intake.files.forEach((item) => URL.revokeObjectURL(item.preview)); setStep(0); setIntake(initialIntake(unitId)); setReceipt(null); setError(''); setUploadFailures([]); onClose(); };
  const toggleSignal = (value) => update('signals', intake.signals.includes(value) ? intake.signals.filter((item) => item !== value) : [...intake.signals, value]);
  const addFiles = (event) => {
    const selection = evidenceSelection(intake.files, event.target.files);
    if (selection.errors.length) setError(selection.errors.join(' '));
    else { setError(''); update('files', [...intake.files, ...createEvidenceUploadEntries(selection.accepted).map((item) => ({ ...item, preview: URL.createObjectURL(item.file) }))]); }
    event.target.value = '';
  };
  const removeFile = (index) => { URL.revokeObjectURL(intake.files[index].preview); update('files', intake.files.filter((_, itemIndex) => itemIndex !== index)); };
  const setWindow = (index, key, value) => update('preferredWindows', intake.preferredWindows.map((window, itemIndex) => itemIndex === index ? { ...window, [key]: value } : window));

  const uploadIntakeEvidence = async (requestId, entries = intake.files) => {
    const next = await uploadPendingEvidence(entries, (file, key) => maintenanceWorkflowAPI.uploadAttachment(requestId, 'Intake', file, key));
    setIntake((current) => ({ ...current, files: next.map((entry, index) => ({ ...entry, preview: entries[index].preview })) }));
    setUploadFailures(next.filter((item) => item.status === 'failed').map((item) => item.file.name));
    return next;
  };
  const submit = async () => {
    setSubmitting(true); setError(''); setUploadFailures([]);
    try {
      createKeyRef.current ||= newMaintenanceIdempotencyKey();
      const created = await maintenanceWorkflowAPI.create(buildCreateMaintenancePayload(intake), createKeyRef.current);
      await uploadIntakeEvidence(created.id);
      createKeyRef.current = null; setReceipt(created); onRequestCreated?.(created);
    } catch (requestError) { setError(maintenanceProblemMessage(requestError, 'Request submission failed. Review the information and try again.')); }
    finally { setSubmitting(false); }
  };

  return <ThemeAdaptiveDrawer anchor="right" open={open} onClose={resetAndClose} PaperProps={{ sx: { width: { xs: '100%', sm: 620 }, bgcolor: 'background.paper', backgroundImage: 'none' } }}>
    <Stack sx={{ height: '100%' }}>
      <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ px: { xs: 2, sm: 3 }, py: 2, bgcolor: '#061e35', color: '#fff' }}>
        <Box><Typography variant="h5" color="inherit" fontWeight={750}>Report a repair</Typography><Typography variant="caption" sx={{ color: alpha('#fff', .72) }}>Structured intake · emergency guidance does not depend on Percy</Typography></Box>
        <IconButton onClick={resetAndClose} sx={{ color: '#fff' }} aria-label="Close"><CloseOutlined /></IconButton>
      </Stack>
      {!receipt && <Box sx={{ px: { xs: 2, sm: 3 }, pt: 2 }}><Stepper activeStep={step} alternativeLabel>{STEPS.map((label) => <Step key={label}><StepLabel>{label}</StepLabel></Step>)}</Stepper></Box>}
      <Box sx={{ flex: 1, overflowY: 'auto', p: { xs: 2, sm: 3 } }}>
        {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}
        {receipt ? <Stack spacing={2} alignItems="center" textAlign="center" sx={{ maxWidth: 480, mx: 'auto', pt: 3 }}>
          <CheckCircleOutlined style={{ fontSize: 58, color: theme.palette.success.main }} />
          <Box><Typography variant="h4" fontWeight={800}>Request received</Typography><Typography color="text.secondary" sx={{ mt: .5 }}>Receipt MR-{receipt.id}. Keep this number for follow-up.</Typography></Box>
          <Paper variant="outlined" sx={{ p: 2, width: '100%', borderRadius: 2, textAlign: 'left' }}>
            <Stack spacing={1}><Typography fontWeight={750}>{receipt.title}</Typography><Stack direction="row" spacing={1}><Chip label={receipt.urgency || urgency} color={urgency === 'Emergency' ? 'error' : urgency === 'Urgent' ? 'warning' : 'success'} /><Chip label={receipt.status || 'Reported'} variant="outlined" /></Stack>
            <Divider /><Typography variant="body2"><b>Acknowledgement target:</b> {receipt.acknowledgeByUtc ? new Date(receipt.acknowledgeByUtc).toLocaleString() : 'Your property team will follow up.'}</Typography><Typography variant="caption" color={slaState(receipt.acknowledgeByUtc).tone === 'error' ? 'error' : 'text.secondary'}>{slaState(receipt.acknowledgeByUtc).label}</Typography></Stack>
          </Paper>
          {uploadFailures.length > 0 && <Alert severity="warning">Request saved, but these files did not upload: {uploadFailures.join(', ')}. The files remain here for an in-place retry.<Button size="small" onClick={() => uploadIntakeEvidence(receipt.id)} disabled={submitting} sx={{ ml: 1 }}>Retry failed uploads</Button></Alert>}
          <Alert severity="info">Emergency services should still be contacted immediately if conditions are dangerous. This receipt is not an emergency-response confirmation.</Alert>
          <Button variant="contained" onClick={resetAndClose}>Done</Button>
        </Stack> : <>
          {step === 0 && <Stack spacing={2}>
            <Typography variant="h6" fontWeight={750}>Where and what is the problem?</Typography>
            {loadingLeases ? <CircularProgress size={24} /> : <TextField select label="Lease, property, and unit" value={intake.leaseId} onChange={(event) => { const lease = leases.find((item) => Number(item.id) === Number(event.target.value)); setIntake((current) => ({ ...current, leaseId: lease?.id || '', unitId: lease?.unitId || '', propertyId: lease?.propertyId || '' })); }} disabled={!leases.length} required>{leases.map((lease) => <MenuItem key={lease.id} value={lease.id}><HomeOutlined /> &nbsp;{lease.propertyName || `Property ${lease.propertyId}`}{lease.unitName ? ` · ${lease.unitName}` : ` · Unit ${lease.unitId}`}</MenuItem>)}</TextField>}
            <TextField select label="Category" value={intake.category} onChange={(event) => update('category', event.target.value)} required>{CATEGORIES.map((category) => <MenuItem key={category} value={category}>{category}</MenuItem>)}</TextField>
            <TextField label="Exact location" value={intake.location} onChange={(event) => update('location', event.target.value)} placeholder="Kitchen, under the sink; rear bedroom window…" required />
            <TextField label="Describe what is happening" multiline minRows={5} value={intake.description} onChange={(event) => update('description', event.target.value)} helperText={`${intake.description.trim().length}/10 minimum · include when it started and what you observe`} required />
          </Stack>}
          {step === 1 && <Stack spacing={2}>
            <Box><Typography variant="h6" fontWeight={750}>Safety and severity signals</Typography><Typography variant="body2" color="text.secondary">Select every condition that is true. Leave all clear for a routine issue.</Typography></Box>
            {emergency && <Alert severity="error" variant="filled"><Typography fontWeight={800}>{emergency.title}</Typography>{emergency.body}</Alert>}
            <Stack spacing={.5}>{MAINTENANCE_SIGNALS.map((signal) => <FormControlLabel key={signal.value} control={<Checkbox checked={intake.signals.includes(signal.value)} onChange={() => toggleSignal(signal.value)} />} label={<Stack direction="row" spacing={1} alignItems="center"><span>{signal.label}</span><Chip size="small" label={signal.urgency} color={signal.urgency === 'emergency' ? 'error' : 'warning'} variant="outlined" /></Stack>} />)}</Stack>
            <Alert severity={urgency === 'Emergency' ? 'error' : urgency === 'Urgent' ? 'warning' : 'info'}>Deterministic intake classification: <b>{urgency}</b>. The server applies the same signal precedence.</Alert>
          </Stack>}
          {step === 2 && <Stack spacing={2}>
            <Typography variant="h6" fontWeight={750}>Entry, pets, and preferred times</Typography>
            <FormControl><FormLabel>May the property team enter?</FormLabel><RadioGroup value={intake.accessPermission} onChange={(event) => update('accessPermission', event.target.value)}><FormControlLabel value="yes" control={<Radio />} label="Yes, entry is permitted" /><FormControlLabel value="contact" control={<Radio />} label="Contact me before entry" /><FormControlLabel value="no" control={<Radio />} label="No, I need to be present" /></RadioGroup></FormControl>
            <FormControlLabel control={<Checkbox checked={intake.hasPets} onChange={(event) => update('hasPets', event.target.checked)} />} label="There are pets in the home" />
            {intake.hasPets && <TextField label="Pet details and safety instructions" value={intake.petDetails} onChange={(event) => update('petDetails', event.target.value)} required />}
            <Divider /><Stack direction="row" justifyContent="space-between" alignItems="center"><Box><Typography fontWeight={700}>Preferred appointment windows</Typography><Typography variant="caption" color="text.secondary">Optional · up to 3</Typography></Box><Button startIcon={<PlusOutlined />} disabled={intake.preferredWindows.length >= 3} onClick={() => update('preferredWindows', [...intake.preferredWindows, emptyWindow()])}>Add time</Button></Stack>
            {intake.preferredWindows.map((window, index) => <Paper key={index} variant="outlined" sx={{ p: 1.5, borderRadius: 1.5 }}><Stack spacing={1.25}><Stack direction="row" justifyContent="space-between"><Typography fontWeight={700}>Choice {index + 1}</Typography><IconButton size="small" onClick={() => update('preferredWindows', intake.preferredWindows.filter((_, itemIndex) => index !== itemIndex))}><DeleteOutlined /></IconButton></Stack><Stack direction={{ xs: 'column', sm: 'row' }} spacing={1}><TextField fullWidth type="datetime-local" label="Start" value={window.startsAtUtc} onChange={(event) => setWindow(index, 'startsAtUtc', event.target.value)} slotProps={{ inputLabel: { shrink: true } }} /><TextField fullWidth type="datetime-local" label="End" value={window.endsAtUtc} onChange={(event) => setWindow(index, 'endsAtUtc', event.target.value)} slotProps={{ inputLabel: { shrink: true } }} /></Stack><TextField label="Window-specific notes" value={window.accessInstructions} onChange={(event) => setWindow(index, 'accessInstructions', event.target.value)} /></Stack></Paper>)}
          </Stack>}
          {step === 3 && <Stack spacing={2}>
            <Box><Typography variant="h6" fontWeight={750}>Photo or video evidence</Typography><Typography variant="body2" color="text.secondary">Optional for intake. Upload clear context and close-up images; do not put yourself in danger.</Typography></Box>
            <Button variant="outlined" startIcon={<CloudUploadOutlined />} onClick={() => inputRef.current?.click()} disabled={intake.files.length >= 10} sx={{ py: 2, borderStyle: 'dashed' }}>Add photos or videos</Button><input hidden ref={inputRef} type="file" multiple accept={MAINTENANCE_EVIDENCE_TYPES.join(',')} onChange={addFiles} />
            <Typography variant="caption" color="text.secondary">Up to 10 files. JPEG, PNG, and WebP images up to 10 MB; MP4 and QuickTime videos up to 100 MB.</Typography>
            {intake.files.map((item, index) => <Paper key={`${item.file.name}-${index}`} variant="outlined" sx={{ p: 1, borderRadius: 1.5 }}><Stack direction="row" alignItems="center" spacing={1.5}>{item.file.type.startsWith('image/') ? <Box component="img" src={item.preview} alt="Evidence preview" sx={{ width: 58, height: 58, objectFit: 'cover', borderRadius: 1 }} /> : <Box component="video" src={item.preview} sx={{ width: 58, height: 58, borderRadius: 1 }} />}<Box flex={1} minWidth={0}><Typography noWrap fontWeight={650}>{item.file.name}</Typography><Typography variant="caption" color="text.secondary">{(item.file.size / 1048576).toFixed(1)} MB</Typography></Box><IconButton onClick={() => removeFile(index)} aria-label={`Remove ${item.file.name}`}><DeleteOutlined /></IconButton></Stack></Paper>)}
          </Stack>}
          {step === 4 && <Stack spacing={1.5}>
            <Box><Typography variant="h6" fontWeight={750}>Review before submitting</Typography><Typography variant="body2" color="text.secondary">Everything remains editable. Submission creates the request first, then uploads evidence.</Typography></Box>
            {emergency && <Alert severity="error"><b>{emergency.title}.</b> {emergency.body}</Alert>}
            <FieldSummary label="PROPERTY · CATEGORY" onEdit={() => setStep(0)}><Typography>{selectedLease?.propertyName || 'Property'}{selectedLease?.unitName ? ` · ${selectedLease.unitName}` : ''} · {intake.category}</Typography></FieldSummary>
            <FieldSummary label="LOCATION · DESCRIPTION" onEdit={() => setStep(0)}><Typography fontWeight={650}>{intake.location}</Typography><Typography variant="body2" sx={{ whiteSpace: 'pre-wrap' }}>{intake.description}</Typography></FieldSummary>
            <FieldSummary label="SEVERITY" onEdit={() => setStep(1)}><Stack direction="row" spacing={.75} flexWrap="wrap" useFlexGap><Chip label={urgency} color={urgency === 'Emergency' ? 'error' : urgency === 'Urgent' ? 'warning' : 'success'} />{intake.signals.map((signal) => <Chip key={signal} label={MAINTENANCE_SIGNALS.find((item) => item.value === signal)?.label} variant="outlined" />)}</Stack></FieldSummary>
            <FieldSummary label="ACCESS" onEdit={() => setStep(2)}><Typography>{intake.accessPermission === 'yes' ? 'Entry permitted' : intake.accessPermission === 'contact' ? 'Contact before entry' : 'Tenant must be present'} · {intake.hasPets ? intake.petDetails || 'Pets present' : 'No pets reported'} · {intake.preferredWindows.length} preferred time(s)</Typography></FieldSummary>
            <FieldSummary label="EVIDENCE" onEdit={() => setStep(3)}><Typography>{intake.files.length} photo/video file(s)</Typography></FieldSummary>
          </Stack>}
        </>}
      </Box>
      {!receipt && <Stack direction="row" justifyContent="space-between" sx={{ p: 2, borderTop: '1px solid', borderColor: 'divider' }}><Button variant="outlined" onClick={() => step ? setStep(step - 1) : resetAndClose} disabled={submitting}>{step ? 'Back' : 'Cancel'}</Button>{step < 4 ? <Button variant="contained" onClick={() => setStep(step + 1)} disabled={!canNext}>Continue</Button> : <Button variant="contained" color={urgency === 'Emergency' ? 'error' : 'primary'} onClick={submit} disabled={submitting}>{submitting ? <><CircularProgress size={16} color="inherit" />&nbsp; Submitting</> : 'Submit request'}</Button>}</Stack>}
    </Stack>
  </ThemeAdaptiveDrawer>;
}

FieldSummary.propTypes = { label: PropTypes.string.isRequired, children: PropTypes.node.isRequired, onEdit: PropTypes.func.isRequired };
TenantMaintenanceFormDrawer.propTypes = { open: PropTypes.bool.isRequired, onClose: PropTypes.func.isRequired, onRequestCreated: PropTypes.func, unitId: PropTypes.number };
