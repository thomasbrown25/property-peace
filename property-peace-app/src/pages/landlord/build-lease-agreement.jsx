import { useEffect, useRef, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Alert, Box, Button, CircularProgress, Container, Divider, Drawer, Grid, LinearProgress,
  List, ListItemButton, ListItemText, Stack, Typography } from '@mui/material';
import { CheckCircleOutlined, EditOutlined, EyeOutlined, FileTextOutlined } from '@ant-design/icons';
import MainCard from 'components/MainCard';
import LeaseSetupBuilder from 'sections/lease-builder/LeaseSetupBuilder';
import PageBreadcrumbs from 'components/breadcrumbs/PageBreadcrumbs';
import LeasePreviewModal from 'components/dialogs/LeasePreviewModal';
import axiosServices from 'utils/axios';
import { finishLeaseAgreement } from 'api/leaseGeneration';
import { areAllLeasePreflightChecksComplete, computeLeasePreflightChecks } from 'utils/leasePreflight';
import useOrganizationRole from 'hooks/useOrganizationRole';
import { useOrganization } from 'contexts/OrganizationContext';
import LandlordsPage from './build-lease-agreement/landlords';
import PetsSmokingOtherPage from './build-lease-agreement/pets-smoking-other';
import UtilitiesMaintenanceKeysPage from './build-lease-agreement/utilities-maintenance-keys';
import ProvisionsAttachmentsPage from './build-lease-agreement/provisions-attachments';
import { agreementSections, agreementLeaseFacts, loadAgreementContext, readAgreement, requireAgreementData } from './build-lease-agreement/agreementWorkflow.mjs';

import SelectAgreementLease from './build-lease-agreement/SelectAgreementLease';
import { agreementBuilderPath } from './build-lease-agreement/leaseSelection.mjs';

const contentBorderSx = { border: '1px solid', borderColor: 'divider', boxShadow: 'none', '&:hover': { borderColor: 'divider', boxShadow: 'none' } };
const noBorderSx = { border: 0, boxShadow: 'none', '&:hover': { border: 0, boxShadow: 'none' }, '&::before, &::after': { display: 'none' } };

const editors = [LandlordsPage, PetsSmokingOtherPage, UtilitiesMaintenanceKeysPage, ProvisionsAttachmentsPage];

// Lease terms are a read-only reference here. Landlords and document-specific sections can save.
export default function BuildLeaseAgreementPage() {
  const [params] = useSearchParams();
  const { currentOrganization } = useOrganization();
  const organizationId = readAgreement(currentOrganization, 'id');
  const leaseId = Number(params.get('leaseId'));
  return <AgreementBuilder key={`${organizationId}:${leaseId}`} leaseId={leaseId} confirmSelection={params.get('selectLease') === '1'} />;
}

function AgreementBuilder({ leaseId, confirmSelection }) {
  const navigate = useNavigate();
  const { currentOrganization } = useOrganization();
  const { hasPermission } = useOrganizationRole();
  const canManage = ['Owner', 'Admin'].includes(readAgreement(currentOrganization, 'userRole')) ||
    (hasPermission('CanManageLeases') && readAgreement(currentOrganization, 'canManageLeases') !== false);
  const [context, setContext] = useState(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');
  const [error, setError] = useState('');
  const [reload, setReload] = useState(0);
  const [active, setActive] = useState(0);
  const [dirty, setDirty] = useState({});
  const [editOpen, setEditOpen] = useState(false);
  const [editBusy, setEditBusy] = useState(false);
  const [leaseRefreshNeeded, setLeaseRefreshNeeded] = useState(false);
  const [previewOpen, setPreviewOpen] = useState(false);
  const [confirmMode, setConfirmMode] = useState(false);
  const [finishing, setFinishing] = useState(false);
  const [finished, setFinished] = useState(false);
  const finishInFlight = useRef(false);
  const mounted = useRef(true);
  useEffect(() => { mounted.current = true; return () => { mounted.current = false; }; }, []);

  useEffect(() => {
    window.scrollTo({ top: 0, left: 0, behavior: 'instant' });
  }, [active]);

  useEffect(() => {
    let live = true;
    setLoading(true);
    setLoadError('');
    setContext(null);
    if (!Number.isSafeInteger(leaseId) || leaseId <= 0) { setLoading(false); return; }
    loadAgreementContext(leaseId, axiosServices.get).then((data) => { if (live) setContext(data); })
      .catch((err) => { if (live) setLoadError(err?.response?.data?.message || err.message); })
      .finally(() => { if (live) setLoading(false); });
    return () => { live = false; };
  }, [leaseId, reload]);

  const lease = context?.lease;
  const agreement = readAgreement(lease, 'leaseAgreement');
  const locked = context?.locked || finished;
  const hasUnsavedChanges = Object.values(dirty).some(Boolean);
  const completed = agreementSections.filter((section) => readAgreement(agreement, section.flag) === true && !dirty[section.id]).length;
  const checks = computeLeasePreflightChecks(lease);
  const missing = checks.flatMap((section) => section.checks.filter((check) => !check.ok).map((check) => `${section.section}: ${check.label}`));
  const ready = completed === agreementSections.length && areAllLeasePreflightChecksComplete(checks) && !hasUnsavedChanges && !leaseRefreshNeeded;
  const editLease = () => { setEditOpen(true); };
  const closeLeaseEditor = () => {
    if (editBusy || !window.confirm('Close the lease editor? Any unsaved lease edits will be lost.')) return;
    setEditOpen(false);
  };
  const refreshLease = async () => {
    try {
      const data = await loadAgreementContext(leaseId, axiosServices.get);
      if (!mounted.current) return;
      setContext(data);
      setLeaseRefreshNeeded(false);
      setError('');
    } catch (err) {
      if (!mounted.current) return;
      setLeaseRefreshNeeded(true);
      setError(`Lease saved, but agreement details could not be refreshed. ${err.message}`);
    }
  };
  const onLeaseSaved = async () => {
    setEditBusy(false);
    setEditOpen(false);
    await refreshLease();
  };
  const onSaved = async (sectionId) => {
    try {
      const data = await loadAgreementContext(leaseId, axiosServices.get);
      if (!mounted.current) return;
      setContext(data);
      setDirty((previous) => ({ ...previous, [sectionId]: false }));
      setError('');
      const index = agreementSections.findIndex((section) => section.id === sectionId);
      if (index < agreementSections.length - 1) setActive(index + 1);
    } catch (err) {
      // Do not remount the forms or lose edits if a save succeeded but refreshing failed.
      throw new Error(`Agreement saved, but its status could not be refreshed. Save again to retry. ${err.message}`);
    }
  };
  const confirmComplete = async () => {
    if (finishInFlight.current || !ready || locked || !canManage) return;
    finishInFlight.current = true;
    setFinishing(true);
    setError('');
    try {
      // Refresh the authoritative lease/flags immediately before generation, never send copied terms.
      const latest = await loadAgreementContext(leaseId, axiosServices.get);
      if (!mounted.current) return;
      setContext(latest);
      if (latest.locked) throw new Error('This agreement has already been finalized or sent for signing. Open the lease to view it.');
      const latestAgreement = readAgreement(latest.lease, 'leaseAgreement');
      if (!agreementSections.every((section) => readAgreement(latestAgreement, section.flag) === true) ||
        !areAllLeasePreflightChecksComplete(computeLeasePreflightChecks(latest.lease))) {
        throw new Error('The lease or agreement has changed. Review the checklist before finalizing.');
      }
      requireAgreementData(await finishLeaseAgreement(leaseId), 'Could not finalize the agreement.');
      if (!mounted.current) return;
      setPreviewOpen(false);
      setFinished(true);
    } catch (err) {
      if (mounted.current) {
        setPreviewOpen(false);
        setError(err?.response?.data?.message || err.message || 'Could not finalize the agreement.');
      }
    } finally {
      finishInFlight.current = false;
      if (mounted.current) setFinishing(false);
    }
  };

  if (loading) return <Box sx={{ py: 8, textAlign: 'center' }}><CircularProgress aria-label="Loading saved lease" /></Box>;
  if (loadError) return <Alert severity="error" action={<Button onClick={() => setReload((value) => value + 1)}>Retry</Button>}>{loadError}</Alert>;
  if (!canManage) return <Alert severity="warning">You do not have permission to manage lease agreements in this organization.</Alert>;
  if (!lease || confirmSelection) return <SelectAgreementLease
    initialLease={lease}
    onContinue={(selectedLeaseId) => navigate(agreementBuilderPath(selectedLeaseId))}
    onCreateLease={() => navigate('/landlord/leases/builder')}
  />;

  return <Container maxWidth="xl" sx={{ py: 3 }}>
    <Stack spacing={3}>
      <PageBreadcrumbs items={[
        { label: 'Dashboard', path: '/landlord/dashboard' },
        { label: 'Leases', path: '/landlord/leases' },
        { label: 'Build lease agreement' }
      ]} />
      {error && <Alert severity="error" action={leaseRefreshNeeded ? <Button onClick={refreshLease}>Retry</Button> : undefined}>{error}</Alert>}
      {finished && <Alert severity="success" icon={<CheckCircleOutlined />}>
        Lease agreement finalized. The signing PDF has been generated from your saved lease and agreement details.
      </Alert>}
      {!locked && completed > 0 && <Alert severity="success" icon={<CheckCircleOutlined />}>Draft saved. You can return to this agreement from Leases → Lease agreements to finish it.</Alert>}
      <MainCard>
        <Stack direction={{ xs: 'column', md: 'row' }} spacing={2} justifyContent="space-between">
          <Box>
            <Typography variant="overline" color="success.main">Lease agreement builder</Typography>
            <Typography variant="h3">{readAgreement(lease, 'name') || readAgreement(lease, 'propertyName') || `Lease #${leaseId}`}</Typography>
            <Typography color="text.secondary" sx={{ mt: 1 }}>Your lease defines the rental terms and tenants. Define the landlord and add agreement policies and disclosures here.</Typography>
          </Box>
          <Button variant="outlined" sx={{ alignSelf: 'flex-start', flexShrink: 0 }} onClick={() => navigate(`/landlord/leases/${leaseId}`)}>View lease</Button>
        </Stack>
      </MainCard>
      <MainCard title="From your lease" sx={contentBorderSx}>
        <Grid container spacing={2}>
          {agreementLeaseFacts(lease).map(([label, value]) => <Grid key={label} size={{ xs: 12, sm: 6, lg: 3 }}>
            <Typography variant="caption" color="text.secondary">{label}</Typography>
            <Typography variant="body2" fontWeight={700} sx={{ overflowWrap: 'anywhere' }}>{value}</Typography>
          </Grid>)}
        </Grid>
        <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2} justifyContent="space-between" alignItems={{ sm: 'center' }} sx={{ mt: 3 }}>
          <Typography variant="body2" color="text.secondary">Need to change rent, dates, deposits, fees, tenants, or occupants? Edit the lease, then return here. The agreement uses the saved lease values.</Typography>
          <Button variant="outlined" startIcon={<EditOutlined />} onClick={editLease} sx={{ flexShrink: 0 }}>Edit lease</Button>
        </Stack>
      </MainCard>
      {locked ? <MainCard><Stack spacing={2}>
        <Typography variant="h4">Agreement is read-only</Typography>
        <Typography color="text.secondary">A finalized agreement or one already sent for signature cannot be changed in this builder. View its documents and signature workflow on the lease.</Typography>
        <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1}>
          <Button variant="contained" onClick={() => navigate(`/landlord/leases/${leaseId}${finished ? '?sign=true' : ''}`)}>{finished ? 'Continue to signing' : 'View agreement'}</Button>
          <Button variant="outlined" onClick={() => navigate(`/landlord/leases/${leaseId}`)}>View lease</Button>
        </Stack>
      </Stack></MainCard> : <Grid container spacing={3} alignItems="flex-start">
        <Grid size={{ xs: 12, lg: 3 }}>
          <MainCard sx={{ ...noBorderSx, position: { lg: 'sticky' }, top: 88 }}>
            <Typography variant="body2" color="text.secondary" sx={{ my: 1 }}>{completed} of {agreementSections.length} sections saved</Typography>
            <LinearProgress variant="determinate" value={completed / agreementSections.length * 100} color="success" sx={{ height: 8, borderRadius: 2 }} />
            <List component="nav" aria-label="Agreement sections" sx={{ mt: 2 }}>
              {agreementSections.map((section, index) => <ListItemButton key={section.id} selected={active === index} onClick={() => setActive(index)} disabled={finishing} sx={{ ...noBorderSx, borderRadius: 1, mb: 1, gap: 1, outline: 0, '&.Mui-selected, &.Mui-selected:hover, &:focus-visible': { border: 0, boxShadow: 'none' } }}>
                <Box component="span" sx={{ display: 'inline-flex', fontSize: 24, flexShrink: 0 }}>
                  {readAgreement(agreement, section.flag) === true && !dirty[section.id] ? <CheckCircleOutlined style={{ color: '#16a34a', fontSize: 28 }} /> : <FileTextOutlined />}
                </Box>
                <ListItemText primary={section.title} primaryTypographyProps={{ fontWeight: 700 }} secondary={dirty[section.id] ? 'Unsaved changes' : section.description} />
              </ListItemButton>)}
            </List>
            <Typography variant="caption" color="text.secondary">Save each section to keep your progress. Finalizing creates the signing PDF.</Typography>
          </MainCard>
        </Grid>
        <Grid size={{ xs: 12, lg: 9 }}>
          <Stack spacing={3}>
            <MainCard title={agreementSections[active].title} sx={contentBorderSx}>
              <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>{agreementSections[active].description}</Typography>
              {/* Keep each editor mounted so switching sections cannot discard unsaved input. */}
              {agreementSections.map((section, index) => {
                const Editor = editors[index];
                return <Box key={section.id} sx={{ display: active === index ? 'block' : 'none' }} onChangeCapture={() => setDirty((previous) => ({ ...previous, [section.id]: true }))} onClickCapture={(event) => { if (event.target.closest("button")) setDirty((previous) => ({ ...previous, [section.id]: true })); }}>
                  <Box component="fieldset" disabled={finishing} sx={{ border: 0, m: 0, p: 0, minWidth: 0 }}>
                    <Editor embedded leaseData={lease} onSaved={() => onSaved(section.id)} />
                  </Box>
                </Box>;
              })}
            </MainCard>
            <MainCard title="Review & finalize" sx={contentBorderSx}>
              <Stack spacing={2}>
                <Typography color="text.secondary">The PDF combines your saved lease terms with these agreement policies. Preview shows saved values only.</Typography>
                {hasUnsavedChanges && <Alert severity="warning">Save your changed sections before previewing or finalizing.</Alert>}
                {!ready && <Alert severity="info">
                  {completed < agreementSections.length && <Typography variant="body2">Save all agreement sections.</Typography>}
                  {missing.length > 0 && <Box component="ul" sx={{ my: 1, pl: 2 }}>{missing.map((item) => <li key={item}>{item}</li>)}</Box>}
                  {missing.some((item) => /Lease Specifics|Rent, Deposit|People on the Lease/.test(item)) && <Button onClick={editLease}>Complete missing details in the lease</Button>}
                </Alert>}
                <Divider />
                <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1} justifyContent="flex-end">
                  <Button variant="outlined" startIcon={<EyeOutlined />} disabled={hasUnsavedChanges || finishing || leaseRefreshNeeded} onClick={() => { setConfirmMode(false); setPreviewOpen(true); }}>Preview PDF</Button>
                  <Button variant="contained" disabled={!ready || finishing} onClick={() => { setConfirmMode(true); setPreviewOpen(true); }}>Finalize agreement</Button>
                </Stack>
              </Stack>
            </MainCard>
          </Stack>
        </Grid>
      </Grid>}
    </Stack>
    <Drawer anchor="right" open={editOpen} onClose={closeLeaseEditor}
      PaperProps={{ sx: { width: { xs: '100%', md: 960 }, maxWidth: '100%' }, role: 'dialog', 'aria-labelledby': 'agreement-edit-lease-title' }}>
      <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ p: 3 }}>
        <Typography variant="h4" id="agreement-edit-lease-title">Edit lease</Typography>
        <Button onClick={closeLeaseEditor} disabled={editBusy}>Close</Button>
      </Stack>
      <Divider />
      <Box sx={{ p: { xs: 2, sm: 3 } }}>
        {editOpen && <LeaseSetupBuilder embedded leaseId={leaseId} onSaved={onLeaseSaved} onBusyChange={setEditBusy} />}
      </Box>
    </Drawer>
    <LeasePreviewModal open={previewOpen} onClose={() => { if (!finishing) setPreviewOpen(false); }} leaseId={leaseId}
      confirmMode={confirmMode} onConfirm={confirmComplete} submitting={finishing} confirmLabel="Confirm & finalize agreement" />
  </Container>;
}
