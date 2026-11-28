import { useEffect, useRef, useState } from 'react';
import { Alert, Autocomplete, Box, Button, Checkbox, CircularProgress, Dialog, DialogActions, DialogContent, DialogTitle, Divider, FormControlLabel, LinearProgress, MenuItem, Stack, Tab, Tabs, TextField, Typography } from '@mui/material';
import { Link, useLocation, useNavigate, useParams, useSearchParams } from 'react-router-dom';
import MainCard from 'components/MainCard';
import AppIcon from 'components/AppIcon';
import PageBreadcrumbs from 'components/breadcrumbs/PageBreadcrumbs';
import useFetchProperties from 'hooks/useFetchProperties';
import axiosServices from 'utils/axios';
import { getLeaseOptions, leaseDates } from 'utils/checklistLeaseOptions.mjs';
import { buildReportComparisonPath, buildReportPath, clearChecklistIntent, formatHandoffProgress, getChecklistIntent, getLegacyReportPhase, handoffTitle, MOVE_IN_INTENT } from 'utils/leaseTransitionChecklists.mjs';
import {
  detachConditionReport, getTransitionChecklist, linkConditionReport, listConditionReports,
  listTransitionChecklists, saveTransitionItem, startConditionReport, startTransitionChecklist
} from 'api/leaseTransitionChecklists';

const checklistsPath = '/landlord/checklists';
const multiUnitTypes = ['multiunit', 'smallmultifamily', 'apartmentbuilding', 'multifamily', 'other'];
const propertyLabel = (property) => property.name || property.streetAddress || `Property ${property.id}`;
const errorText = (error) => error?.response?.data?.message || error.message || 'Something went wrong. Try again.';

export default function LeaseTransitionChecklistsPage() {
  const [params] = useSearchParams();
  const { transitionId } = useParams();
  const navigate = useNavigate();
  const { state: reportDraft } = useLocation();
  return transitionId
    ? <HandoffDetail key={transitionId} id={transitionId} />
    : <ChecklistHome key={params.toString()} params={params} navigate={navigate} reportDraft={reportDraft} />;
}

function ChecklistHome({ params, navigate, reportDraft }) {
  const { properties, isLoading, propertiesError, propertiesRefetch } = useFetchProperties();
  const [propertyId, setPropertyId] = useState(params.get('propertyId') || '');
  const [unitId, setUnitId] = useState(params.get('unitId') || '');
  const [leaseId, setLeaseId] = useState(params.get('leaseId') || '');
  const [section, setSection] = useState(params.get('view') === 'reports' ? 'reports' : 'handoff');
  const [home, setHome] = useState(null);
  const [history, setHistory] = useState(null);
  const [inspectionDate, setInspectionDate] = useState(reportDraft?.inspectionDate || '');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [retry, setRetry] = useState(0);
  const requests = useRef({});
  const property = (properties || []).find((option) => String(option.id) === propertyId) || null;
  const requiresUnit = multiUnitTypes.includes(String(property?.propertyType || '').toLowerCase());
  const propertyScope = property?.id;
  const homeReady = home?.propertyId === propertyScope;
  const units = homeReady ? home.units : [];
  const leaseOptions = homeReady ? getLeaseOptions(home.leases, unitId || null) : [];
  const scopedLease = homeReady && home.leases.find((lease) => String(lease.id) === leaseId && (!unitId || String(lease.unitId) === unitId));
  if (scopedLease && !leaseOptions.some(({ lease }) => lease.id === scopedLease.id)) leaseOptions.push({ lease: scopedLease });
  const ready = Boolean(propertyScope && homeReady && (!requiresUnit || units.some((unit) => String(unit.id) === unitId)));
  const selectedLease = leaseOptions.find(({ lease }) => String(lease.id) === leaseId)?.lease;
  const activeLeaseId = selectedLease?.id;
  const scopeKey = `${propertyScope}/${unitId}/${activeLeaseId}/${section}`;
  const records = history?.key === scopeKey ? history.records : null;
  const focusPhase = params.get('phase') || (getChecklistIntent(`?${params}`) ? 'moveIn' : '');
  const comparePaths = new Map();
  (records || []).forEach((record) => {
    if (section === 'handoff' && record.phase === 'moveIn' && record.leaseId) {
      const moveOut = records.find((entry) => entry.phase === 'moveOut' && entry.leaseId === record.leaseId && entry.unitId === record.unitId);
      const path = buildReportComparisonPath(record.conditionReport, moveOut?.conditionReport, record.unitId);
      if (path) comparePaths.set(record.id, path);
    }
    if (section === 'reports' && getLegacyReportPhase(record.checklistType) === 'moveIn' && record.counterpartChecklistId) {
      const moveOut = records.find((entry) => entry.id === record.counterpartChecklistId && getLegacyReportPhase(entry.checklistType) === 'moveOut');
      const path = buildReportComparisonPath(record, moveOut, unitId || record.unitId);
      if (path) comparePaths.set(record.id, path);
    }
  });

  useEffect(() => {
    if (!propertyScope) return;
    let active = true;
    const calls = [axiosServices.get(`/api/Lease/property/${propertyScope}/checklist-options`)];
    if (requiresUnit) calls.push(axiosServices.get(`/api/unit/${propertyScope}`));
    Promise.all(calls).then(([leases, unitsResponse]) => {
      if (!active) return;
      if (!leases.data?.success || (unitsResponse && !unitsResponse.data?.success)) throw new Error('Could not load the rental and leases.');
      setHome({ propertyId: propertyScope, leases: leases.data.data || [], units: unitsResponse?.data.data || [] });
    }).catch((cause) => { if (active) setError(errorText(cause)); });
    return () => { active = false; };
  }, [propertyScope, requiresUnit, retry]);

  useEffect(() => {
    if (!ready) return;
    let active = true;
    const load = section === 'reports' ? listConditionReports : listTransitionChecklists;
    load({ propertyId: propertyScope, unitId: unitId || undefined, leaseId: activeLeaseId })
      .then((items) => { if (active) setHistory({ key: scopeKey, records: items }); })
      .catch((cause) => { if (active) setError(errorText(cause)); });
    return () => { active = false; };
  }, [ready, section, propertyScope, unitId, activeLeaseId, scopeKey, retry]);

  const start = async (phase) => {
    setBusy(true);
    setError('');
    const actionKey = `${scopeKey}/${phase}`;
    const requestId = requests.current[actionKey] ||= crypto.randomUUID();
    const scope = { propertyId: propertyScope, unitId: unitId ? Number(unitId) : undefined, leaseId: activeLeaseId, requestId };
    try {
      if (phase === 'report') {
        const report = await startConditionReport({ ...scope, inspectionDate: inspectionDate ? new Date(inspectionDate).toISOString() : null, generalNotes: reportDraft?.generalNotes || undefined });
        navigate(buildReportPath(report));
      } else {
        const record = await startTransitionChecklist({ ...scope, phase });
        clearChecklistIntent();
        navigate(`${checklistsPath}/handoff/${record.id}`);
      }
    } catch (cause) {
      setError(errorText(cause));
    } finally {
      setBusy(false);
    }
  };

  return (
    <Stack spacing={2.5}>
      <PageBreadcrumbs items={[{ label: 'Dashboard', path: '/landlord/dashboard' }, { label: 'Checklists' }]} />
      <Typography variant="h3">{focusPhase && section === 'handoff' ? handoffTitle(focusPhase) : 'Checklists'}</Typography>
      <MainCard>
        <Stack spacing={2.5}>
          <Tabs value={section} onChange={(_, next) => { setSection(next); setError(''); }} variant="scrollable" aria-label="Checklist views">
            <Tab value="handoff" label="Move-in & move-out" disabled={busy} />
            <Tab value="reports" label="Condition reports" disabled={busy} />
          </Tabs>
          {propertiesError && <Alert severity="error" action={<Button color="inherit" onClick={propertiesRefetch}>Retry</Button>}>Could not load your properties.</Alert>}
          {error && <Alert severity="error" action={<Button color="inherit" onClick={() => { setError(''); setRetry((value) => value + 1); }}>Retry loading</Button>}>{error}</Alert>}
          <Stack direction={{ xs: 'column', md: 'row' }} spacing={2}>
            <Autocomplete fullWidth options={properties || []} value={property} getOptionLabel={propertyLabel}
              isOptionEqualToValue={(option, value) => option.id === value.id} loading={isLoading} disabled={busy}
              onChange={(_, value) => { setPropertyId(value ? String(value.id) : ''); setUnitId(''); setLeaseId(''); setHome(null); setError(''); }}
              renderInput={(input) => <TextField {...input} label="Property" />} />
            {property && requiresUnit && <TextField select fullWidth label="Unit" value={units.some((unit) => String(unit.id) === unitId) ? unitId : ''}
              disabled={busy || !units.length} onChange={(event) => { setUnitId(event.target.value); setLeaseId(''); }}>
              {units.map((unit) => <MenuItem key={unit.id} value={String(unit.id)}>{unit.name || `Unit ${unit.id}`}</MenuItem>)}
            </TextField>}
            {ready && <TextField select fullWidth label="Lease (optional)" value={activeLeaseId ? String(activeLeaseId) : ''}
              disabled={busy} onChange={(event) => setLeaseId(event.target.value)}>
              <MenuItem value="">No lease selected</MenuItem>
              {leaseOptions.map(({ lease }) => <MenuItem key={lease.id} value={String(lease.id)}>{leaseDates(lease) || `Lease ${lease.id}`}</MenuItem>)}
            </TextField>}
          </Stack>
          {!isLoading && !propertiesError && !properties?.length && <Box><Button component={Link} to={`/landlord/property-add-workflow${focusPhase === 'moveIn' ? `?intent=${MOVE_IN_INTENT}` : ''}`} variant="contained">Add a property</Button></Box>}
          {property && !homeReady && !error && <CircularProgress size={24} />}
          {homeReady && requiresUnit && !units.length && <Alert severity="info">Add a unit to this property before starting a checklist or report.</Alert>}
          {ready && (
            <>
              <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1.5}>
                {section === 'handoff' ? ['moveIn', 'moveOut'].map((phase) => (
                  <Button key={phase} variant={(focusPhase || 'moveIn') === phase ? 'contained' : 'outlined'} disabled={busy} onClick={() => start(phase)}>
                    {`Start ${handoffTitle(phase).toLowerCase()}`}
                  </Button>
                )) : <>
                  <TextField type="datetime-local" label="Inspection date and time" size="small" value={inspectionDate} onChange={(event) => setInspectionDate(event.target.value)} slotProps={{ inputLabel: { shrink: true } }} />
                  <Button variant="contained" disabled={busy} onClick={() => start('report')}>Start condition report</Button>
                </>}
              </Stack>
              <Divider />
              {!records ? !error && <CircularProgress size={24} /> : !records.length ? <Typography color="text.secondary">{section === 'handoff' ? 'No checklists for this rental yet.' : 'No condition reports for this rental yet.'}</Typography> : (
                <Stack divider={<Divider />}>
                  {records.map((record) => {
                    const report = section === 'reports';
                    const progress = report ? null : formatHandoffProgress(record.items);
                    return (
                      <Stack key={record.id} direction={{ xs: 'column', sm: 'row' }} alignItems={{ sm: 'center' }}>
                        <Button component={Link} to={report ? buildReportPath(record) : `${checklistsPath}/handoff/${record.id}`}
                          endIcon={<AppIcon name="arrowRight" size={16} />} sx={{ flex: 1, py: 1.5, justifyContent: 'space-between', textAlign: 'left' }}>
                          <Box>
                            <Typography variant="subtitle1">{report ? record.title || 'Condition report' : handoffTitle(record.phase)}</Typography>
                            <Typography variant="body2" color="text.secondary">{report ? [record.inspectionDate?.slice(0, 10), record.isCompleted ? 'Complete' : 'In progress'].filter(Boolean).join(' · ') : `${progress.done} of ${progress.total} complete`}</Typography>
                          </Box>
                        </Button>
                        {comparePaths.has(record.id) && <Button component={Link} to={comparePaths.get(record.id)} size="small">Compare reports</Button>}
                      </Stack>
                    );
                  })}
                </Stack>
              )}
            </>
          )}
        </Stack>
      </MainCard>
    </Stack>
  );
}

function HandoffDetail({ id }) {
  const navigate = useNavigate();
  const [record, setRecord] = useState(null);
  const [reports, setReports] = useState(null);
  const [candidate, setCandidate] = useState('');
  const [notApplicable, setNotApplicable] = useState(null);
  const [reason, setReason] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [retry, setRetry] = useState(0);

  useEffect(() => {
    let active = true;
    getTransitionChecklist(id).then((current) => { if (active) setRecord(current); })
      .catch((cause) => { if (active) setError(errorText(cause)); });
    return () => { active = false; };
  }, [id, retry]);

  const perform = async (operation, handle = setRecord) => {
    setBusy(true);
    setError('');
    try { handle(await operation()); } catch (cause) { setError(errorText(cause)); } finally { setBusy(false); }
  };

  const linkReport = (reportId) => perform(() => linkConditionReport(id, reportId), (updated) => {
    setRecord(updated);
    navigate(buildReportPath(updated.conditionReport, id));
  });
  const showReports = () => perform(() => listConditionReports({ propertyId: record.propertyId, unitId: record.unitId || undefined }), (list) => {
    setCandidate('');
    setReports(list.filter((report) => !record.leaseId || !report.leaseId || String(record.leaseId) === String(report.leaseId)));
  });
  const progress = record ? formatHandoffProgress(record.items) : null;

  return (
    <Stack spacing={2.5}>
      <PageBreadcrumbs items={[{ label: 'Checklists', path: checklistsPath }, { label: record ? handoffTitle(record.phase) : 'Checklist' }]} />
      {error && <Alert severity="error" action={!record && <Button color="inherit" onClick={() => { setError(''); setRetry((value) => value + 1); }}>Retry</Button>}>{error}</Alert>}
      {!record ? !error && <CircularProgress size={24} /> : (
        <MainCard title={handoffTitle(record.phase)}>
          <Stack spacing={2}>
            <Typography color="text.secondary">{[record.propertyName, record.unitName, record.leaseId && `Lease ${record.leaseId}`].filter(Boolean).join(' · ')}</Typography>
            <Typography variant="body2">{progress.done} of {progress.total} complete</Typography>
            <LinearProgress variant="determinate" value={progress.percent} aria-label="Checklist progress" />
            <Stack divider={<Divider />}>
              {record.items.map((item) => item.key === 'condition-report' ? (
                <Stack key={item.key} spacing={1} sx={{ py: 1.5 }}>
                  <Stack direction="row" alignItems="center" spacing={1}>
                    <Box sx={{ color: item.status === 'done' ? 'success.main' : 'primary.main', display: 'flex' }}><AppIcon name="checklists" size={20} /></Box>
                    <Typography>{item.label}</Typography>
                    {item.status === 'done' && <Typography variant="caption" color="success.main">Complete</Typography>}
                  </Stack>
                  <Stack direction="row" spacing={1} flexWrap="wrap">
                    {record.conditionReport ? <>
                      <Button component={Link} to={buildReportPath(record.conditionReport, id)}>{record.conditionReport.isCompleted ? 'View report' : 'Continue report'}</Button>
                      <Button disabled={busy} onClick={() => perform(() => detachConditionReport(id))}>Detach report</Button>
                    </> : <>
                      <Button disabled={busy} onClick={() => linkReport()}>Start report</Button>
                      <Button disabled={busy} onClick={showReports}>Use existing report</Button>
                    </>}
                  </Stack>
                  {!record.conditionReport && reports && (reports.length ? (
                    <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1}>
                      <TextField select size="small" fullWidth label="Condition report" value={candidate} disabled={busy} onChange={(event) => setCandidate(event.target.value)}>
                        {reports.map((report) => <MenuItem key={report.id} value={String(report.id)}>{report.title} {report.inspectionDate?.slice(0, 10)}</MenuItem>)}
                      </TextField>
                      <Button disabled={busy || !candidate} onClick={() => linkReport(Number(candidate))}>Link report</Button>
                    </Stack>
                  ) : <Typography color="text.secondary" variant="body2">No eligible reports for this rental.</Typography>)}
                </Stack>
              ) : (
                <Stack key={item.key} direction={{ xs: 'column', sm: 'row' }} alignItems={{ sm: 'center' }} justifyContent="space-between" sx={{ py: 0.75 }}>
                  <FormControlLabel sx={{ m: 0 }} label={item.label} control={<Checkbox checked={item.status === 'done'} disabled={busy || item.status === 'notApplicable'}
                    onChange={(_, checked) => perform(() => saveTransitionItem(id, item.key, checked ? 'done' : 'pending'))} />} />
                  {item.notApplicableReason && <Typography variant="body2" color="text.secondary">{item.notApplicableReason}</Typography>}
                  {item.allowNotApplicable && <Button size="small" disabled={busy} onClick={() => {
                    if (item.status === 'notApplicable') return perform(() => saveTransitionItem(id, item.key, 'pending'));
                    setError('');
                    setReason('');
                    setNotApplicable(item);
                  }}>
                    {item.status === 'notApplicable' ? 'Mark applicable' : 'Not applicable'}
                  </Button>}
                </Stack>
              ))}
            </Stack>
          </Stack>
        </MainCard>
      )}
      <Dialog open={Boolean(notApplicable)} onClose={() => !busy && setNotApplicable(null)} fullWidth maxWidth="xs">
        <DialogTitle>Mark task not applicable</DialogTitle>
        <DialogContent>
          {notApplicable && error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}
          <Typography sx={{ mb: 2 }}>{notApplicable?.label}</Typography>
          <TextField fullWidth label="Reason (optional)" value={reason} onChange={(event) => setReason(event.target.value)} disabled={busy} slotProps={{ htmlInput: { maxLength: 500 } }} />
        </DialogContent>
        <DialogActions>
          <Button disabled={busy} onClick={() => setNotApplicable(null)}>Cancel</Button>
          <Button variant="contained" disabled={busy} onClick={() => perform(() => saveTransitionItem(id, notApplicable.key, 'notApplicable', reason.trim() || undefined), (updated) => { setRecord(updated); setNotApplicable(null); })}>Save</Button>
        </DialogActions>
      </Dialog>
    </Stack>
  );
}
