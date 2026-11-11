import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { NumericFormat } from 'react-number-format';
import { Alert, Box, Button, Checkbox, CircularProgress, Dialog, DialogActions, DialogContent, DialogTitle,
  Divider, FormControlLabel, Grid, List, ListItemButton, ListItemText, MenuItem, Stack, TextField, Typography } from '@mui/material';
import { CheckCircleOutlined, DollarOutlined, FileTextOutlined, TeamOutlined } from '@ant-design/icons';
import MainCard from 'components/MainCard';
import RentEstimateCard from 'components/RentEstimateCard';
import ConfigureLateFeesModal from 'components/dialogs/ConfigureLateFeesModal';
import useFetchProperties from 'hooks/useFetchProperties';
import useOrganizationRole from 'hooks/useOrganizationRole';
import { useOrganization } from 'contexts/OrganizationContext';
import axiosServices from 'utils/axios';
import { isDetachedSingleUnitType } from 'utils/propertyType';
import { rentalMode } from 'utils/rentalMode';
import { leaseTermError } from 'utils/successorLease.mjs';
import { calculateProratedRent } from 'utils/leaseDraft';
import { addOrUpdateLease, addTenantToLease, removeTenantFromLease } from 'api/lease';
import TenantSelector from './TenantSelector';
import { persistLeaseSetup, readSetup, requireSetupSuccess, setupDefaults, setupDestinations, setupFromLease, setupId, setupPayload } from './leaseSetup.mjs';

const sections = [
  { title: 'Lease specifics', description: 'Choose the property and lease terms.', icon: <FileTextOutlined /> },
  { title: 'Rent, deposit, & fees', description: 'Set rent, deposits, fees, and collection methods.', icon: <DollarOutlined /> },
  { title: 'People on the lease', description: 'Add tenants, occupants, and cosigners.', icon: <TeamOutlined /> }
];
const labels = { firstName: 'First name', lastName: 'Last name', email: 'Email', phone: 'Phone', companyName: 'Company name',
  streetAddress: 'Street address', city: 'City', state: 'State', zipCode: 'ZIP code' };
const emptyPerson = { firstName: '', lastName: '', email: '' };

export default function LeaseSetupBuilder({ leaseId, initialPropertyId, initialUnitId, embedded = false, onSaved, onBusyChange }) {
  const navigate = useNavigate();
  const { currentOrganization } = useOrganization();
  const { hasPermission } = useOrganizationRole();
  const organizationRole = readSetup(currentOrganization, 'userRole');
  const canManage = ['Owner', 'Admin'].includes(organizationRole) ||
    (hasPermission('CanManageLeases') && readSetup(currentOrganization, 'canManageLeases') !== false);
  const { properties = [], isLoading, propertiesError, propertiesRefetch } = useFetchProperties({ refreshOnMount: true });
  const [values, setValues] = useState(() => ({ ...setupDefaults(), propertyId: initialPropertyId || '', unitId: initialUnitId || '',
  }));
  const [existing, setExisting] = useState(null);
  const [loading, setLoading] = useState(Boolean(leaseId));
  const [loadError, setLoadError] = useState('');
  const [loadVersion, setLoadVersion] = useState(0);
  const [active, setActive] = useState(0);
  const [completedSteps, setCompletedSteps] = useState([false, false, false]);
  const [tenants, setTenants] = useState([]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [partial, setPartial] = useState(false);
  const [saved, setSaved] = useState(null);
  const [lateFeesOpen, setLateFeesOpen] = useState(false);
  const checkpoint = useRef({ leaseId: null, linked: new Set() });
  const inFlight = useRef(false);
  const formRef = useRef(null);

  useEffect(() => {
    const scrollOwner = formRef.current?.closest('.MuiDrawer-paper') || window;
    scrollOwner.scrollTo({ top: 0, left: 0, behavior: 'instant' });
  }, [active]);

  useEffect(() => {
    if (!leaseId) return;
    let live = true;
    setLoading(true);
    setLoadError('');
    axiosServices.get(`/api/Lease/by-id/${leaseId}`).then((response) => {
      const lease = requireSetupSuccess(response.data, 'Could not load the lease.');
      if (setupId(lease) !== Number(leaseId)) throw new Error('The requested lease could not be loaded.');
      if (!live) return;
      setExisting(lease);
      setValues(setupFromLease(lease));
      const linked = readSetup(lease, 'tenants') || [];
      setTenants(linked);
      checkpoint.current = { leaseId: null, linked: new Set(linked.map(setupId)) };
    }).catch((err) => { if (live) setLoadError(err?.response?.data?.message || err.message); })
      .finally(() => { if (live) setLoading(false); });
    return () => { live = false; };
  }, [leaseId, loadVersion]);

  useEffect(() => { onBusyChange?.(saving); }, [saving, onBusyChange]);

  const property = properties.find((item) => setupId(item) === Number(values.propertyId));
  const units = readSetup(property, 'units') || [];
  const single = isDetachedSingleUnitType(readSetup(property, 'propertyType'));
  const unit = units.find((item) => setupId(item) === Number(values.unitId));
  useEffect(() => {
    if (single && units.length && !values.unitId) setValues((prev) => ({ ...prev, unitId: setupId(units[0]) }));
  }, [single, units, values.unitId]);
  useEffect(() => {
    if (!values.proratedRentDue || values.prorationMethod !== 'calculated') return;
    const amount = calculateProratedRent(values.startDate, values.rentDueDay, values.rentAmount);
    setValues((prev) => prev.proratedRentAmount === (amount ?? '') ? prev : { ...prev, proratedRentAmount: amount ?? '' });
  }, [values.proratedRentDue, values.prorationMethod, values.startDate, values.rentDueDay, values.rentAmount]);

  const change = (key, value) => setValues((prev) => ({ ...prev, [key]: value }));
  const field = (key, label, options = {}) => <TextField key={key} fullWidth label={label} value={values[key] ?? ''}
    onChange={(event) => change(key, event.target.value)} {...options} />;
  const money = (key, label, options = {}) => field(key, label, { type: 'number', inputProps: { min: 0, step: '0.01' }, ...options });
  const toggle = (key, label) => <FormControlLabel control={<Checkbox checked={Boolean(values[key])}
    onChange={(event) => change(key, event.target.checked)} />} label={label} />;
  const rows = (key, title, person = false) => <Stack spacing={2}>
    <Typography variant="h5">{title}</Typography>
    {values[key].map((row, index) => key === 'fees' && row.isLateFee ? null : <MainCard key={index} contentSX={{ p: 2 }}>
      <Stack spacing={2}>
        <Grid container spacing={2}>
          {(person ? Object.keys(emptyPerson) : ['name', 'amount', 'dueDate']).map((name) => <Grid key={name} size={{ xs: 12, sm: 6 }}>
            <TextField fullWidth label={labels[name] || ({ name: 'Name', amount: 'Amount', dueDate: 'Due date' })[name]}
              type={name === 'amount' ? 'number' : name === 'dueDate' ? 'date' : name === 'email' ? 'email' : 'text'}
              InputLabelProps={name === 'dueDate' ? { shrink: true } : undefined}
              inputProps={name === 'amount' ? { min: 0, step: '0.01' } : undefined}
              value={name === 'dueDate' ? (row[name] || '').slice(0, 10) : row[name] ?? ''}
              onChange={(event) => change(key, values[key].map((item, i) => i === index ? { ...item, [name]: event.target.value } : item))} />
          </Grid>)}
        </Grid>
        <Button color="error" sx={{ alignSelf: 'flex-start' }} onClick={() => change(key, values[key].filter((_, i) => i !== index))}>Remove {person ? 'person' : 'charge'}</Button>
      </Stack>
    </MainCard>)}
    <Button variant="outlined" sx={{ alignSelf: 'flex-start' }} onClick={() => change(key, [...values[key],
      person ? { ...emptyPerson, sortOrder: values[key].length } : { name: '', amount: '', dueDate: values.startDate }])}>Add {title.toLowerCase().replace(/s$/, '')}</Button>
  </Stack>;

  const validate = (specificsOnly = false) => {
    if (!canManage) return 'You do not have permission to manage leases.';
    if (!property || !unit) return 'Select a property and a unit.';
    if (rentalMode(unit) === 'shortTerm') return 'Short-term units use stays, not leases. Select a long-term unit.';
    if (!values.startDate || (values.termType === 'fixed' && !values.endDate)) return 'Enter the lease start date and fixed-term end date.';
    const thisId = setupId(existing);
    const current = readSetup(unit, 'lease') ?? readSetup(unit, 'activeLease');
    const termUnit = { ...unit, lease: setupId(current) === thisId ? null : current,
      Lease: null, activeLease: null, ActiveLease: null,
      leases: (readSetup(unit, 'leases') || []).filter((lease) => setupId(lease) !== thisId), Leases: [] };
    const termError = leaseTermError(values.startDate, values.termType === 'fixed' ? values.endDate : null, termUnit);
    if (termError) return termError;
    if (values.autoRenewLease && values.termType === 'fixed') {
      if (![ -1, ...Array.from({ length: 120 }, (_, i) => i + 1)].includes(Number(values.autoRenewLeaseLength))) return 'Choose a valid renewal term.';
      if (values.autoRenewRentIncrement && (values.autoRenewRentIncrementValue === '' || !Number.isFinite(Number(values.autoRenewRentIncrementValue)) || Number(values.autoRenewRentIncrementValue) < 0)) return 'Enter a valid renewal rent increase.';
    }
    if (specificsOnly === true) return null;
    if (values.rentAmount === '' || !Number.isFinite(Number(values.rentAmount)) || Number(values.rentAmount) < 0) return 'Enter a valid rent amount.';
    if (!Number.isInteger(Number(values.rentDueDay)) || Number(values.rentDueDay) < 1 || Number(values.rentDueDay) > 31) return 'Rent due day must be between 1 and 31.';
    for (const key of ['depositAmount', 'petDepositAmount', ...(values.proratedRentDue ? ['proratedRentAmount'] : [])]) {
      if (values[key] !== '' && (!Number.isFinite(Number(values[key])) || Number(values[key]) < 0)) return 'Amounts must be zero or greater.';
    }
    if (values.proratedRentDue && values.proratedRentAmount === '') return 'Enter the prorated rent amount.';
    for (const item of [...values.fees, ...values.leaseDeposits]) {
      if (!item.name?.trim() || item.amount === '' || !Number.isFinite(Number(item.amount)) || Number(item.amount) < 0) return 'Each fee and deposit needs a name and valid amount.';
    }
    if (specificsOnly === 'rent') return null;
    if (!values.addTenantsLater && !tenants.length) return 'Select at least one tenant or choose Add tenants later.';
    for (const person of [...values.leaseCoSigners, ...values.leaseAdditionalSigners, ...values.leaseOccupants]) {
      if (!(person.companyName?.trim() || person.firstName?.trim() || person.lastName?.trim())) return 'Enter a name for each person on the lease, or remove the empty entry.';
      if (person.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(person.email)) return 'Enter a valid email address for each person.';
    }
    return null;
  };
  const continueStep = () => {
    const validation = validate(active === 0 ? true : 'rent');
    if (validation) { setError(validation); return; }
    setCompletedSteps((steps) => steps.map((completed, index) => index === active ? true : completed));
    setError('');
    setActive((step) => step + 1);
  };
  const submit = async () => {
    if (inFlight.current || saved) return;
    setError('');
    const validation = validate();
    if (validation) { setError(validation); return; }
    setCompletedSteps([true, true, true]);
    inFlight.current = true;
    setSaving(true);
    try {
      const payload = setupPayload(values, existing, setupId(currentOrganization));
      const result = await persistLeaseSetup({ payload, tenants: values.addTenantsLater ? [] : tenants,
        checkpoint: checkpoint.current, saveLease: addOrUpdateLease, linkTenant: addTenantToLease, unlinkTenant: removeTenantFromLease,
        onCheckpoint: () => setPartial(true) });
      setSaved(result);
      if (embedded) await onSaved?.(result);
      // Refresh is best effort and cannot turn a persisted lease into a failed creation.
      void propertiesRefetch();
    } catch (err) {
      setError(err?.response?.data?.message || err.message || 'Could not save the lease. Your form is preserved.');
    } finally { setSaving(false); inFlight.current = false; }
  };

  if (loading || isLoading) return <Box sx={{ p: 5, textAlign: 'center' }}><CircularProgress aria-label="Loading lease setup" /></Box>;
  if (loadError) return <Alert severity="error" action={<Button onClick={() => setLoadVersion((v) => v + 1)}>Retry</Button>}>{loadError}</Alert>;
  if (!canManage) return <Alert severity="warning">You do not have permission to manage leases in this organization.</Alert>;
  const destinations = saved ? setupDestinations(saved) : null;
  return <Stack ref={formRef} spacing={3}>
    {!embedded && <Box><Typography variant="overline" color="success.main">Create lease builder</Typography>
      <Typography variant="h3">{leaseId ? 'Edit lease' : 'Create a lease'}</Typography>
      <Typography color="text.secondary" sx={{ mt: 1 }}>Set up your lease record. You can create a lease agreement after saving.</Typography></Box>}
    {propertiesError && <Alert severity="error" action={<Button onClick={propertiesRefetch}>Retry</Button>}>Could not load properties.</Alert>}
    {error && <Alert severity="error">{error}</Alert>}
    {partial && !saved && <Alert severity="warning">Lease #{checkpoint.current.leaseId} is saved. Tenant changes are not finished. Retry to finish without creating another lease. Your form is preserved.</Alert>}
    <Grid container spacing={3}>
      <Grid size={{ xs: 12, md: embedded ? 12 : 4 }}>
        <MainCard>
          <List component="nav" aria-label="Lease setup sections">{sections.map((section, index) => <ListItemButton key={section.title}
            selected={active === index} onClick={() => setActive(index)} sx={{ borderRadius: 1, mb: 1, gap: 2 }}>
            <Box component="span" sx={{ display: 'inline-flex', fontSize: 24, flexShrink: 0 }}>{section.icon}</Box>
            <ListItemText primary={`${index + 1}. ${section.title}`} primaryTypographyProps={{ fontWeight: 700 }} secondary={section.description} />
            {completedSteps[index] && !validate(index === 0 ? true : index === 1 ? 'rent' : false) && <Box component="span" sx={{ color: 'success.main', display: 'inline-flex', fontSize: 28, flexShrink: 0 }}>
              <CheckCircleOutlined aria-label={`${section.title} completed`} />
            </Box>}
          </ListItemButton>)}</List>
          <Typography variant="body2" color="text.secondary">Step {active + 1} of {sections.length}</Typography>
        </MainCard>
      </Grid>
      <Grid size={{ xs: 12, md: embedded ? 12 : 8 }}>
        <MainCard title={sections[active].title}>
          <Box component="fieldset" disabled={saving || partial || Boolean(saved)} sx={{ border: 0, p: 0, m: 0, minWidth: 0 }}>
            <Stack spacing={3}>
              {active === 0 && <>
                <TextField select fullWidth label="Property" value={values.propertyId} disabled={Boolean(leaseId)} onChange={(event) => {
                  const next = properties.find((item) => setupId(item) === Number(event.target.value));
                  const first = isDetachedSingleUnitType(readSetup(next, 'propertyType')) ? readSetup(next, 'units')?.[0] : null;
                  setValues((prev) => ({ ...prev, propertyId: event.target.value, unitId: setupId(first) || '' }));
                }}><MenuItem value="">Select a property</MenuItem>{properties.map((item) => <MenuItem key={setupId(item)} value={setupId(item)}
                  disabled={!(readSetup(item, 'units') || []).some((u) => rentalMode(u) !== 'shortTerm')}>
                  {readSetup(item, 'name') || readSetup(item, 'streetAddress') || `Property ${setupId(item)}`}</MenuItem>)}</TextField>
                {property && !single && <TextField select fullWidth label="Unit" value={values.unitId} disabled={Boolean(leaseId)} onChange={(event) => change('unitId', event.target.value)}>
                  <MenuItem value="">Select a unit</MenuItem>{units.map((item) => <MenuItem key={setupId(item)} value={setupId(item)} disabled={rentalMode(item) === 'shortTerm'}>
                    {readSetup(item, 'name') || `Unit ${setupId(item)}`}{rentalMode(item) === 'shortTerm' ? ' (short-term)' : ''}</MenuItem>)}
                </TextField>}
                {unit && rentalMode(unit) === 'shortTerm' && <Alert severity="warning">Short-term units use stays, not leases.</Alert>}
                {field('name', 'Lease nickname (optional)')}
                {field('termType', 'Lease term', { select: true, children: [<MenuItem key="fixed" value="fixed">Fixed term</MenuItem>, <MenuItem key="monthly" value="monthly">Month-to-month</MenuItem>] })}
                {field('startDate', 'Start date', { type: 'date', InputLabelProps: { shrink: true }, required: true })}
                {values.termType === 'fixed' && <>
                  {field('endDate', 'End date', { type: 'date', InputLabelProps: { shrink: true }, required: true })}
                  {toggle('autoRenewLease', 'Automatically renew at the end of the term')}
                  {values.autoRenewLease && <>
                    {field('autoRenewLeaseLength', 'Renewal term (months; -1 for month-to-month)', { type: 'number' })}
                    {toggle('autoRenewRentIncrement', 'Increase rent on renewal')}
                    {values.autoRenewRentIncrement && <>
                      {field('autoRenewRentIncrementType', 'Increase type', { select: true, children: [<MenuItem key="percentage" value="percentage">Percentage</MenuItem>, <MenuItem key="amount" value="amount">Dollar amount</MenuItem>] })}
                      {money('autoRenewRentIncrementValue', 'Renewal rent increase')}
                    </>}
                  </>}
                </>}
              </>}
              {active === 1 && <>
                {field('rentFrequency', 'Rent frequency', { select: true, children: ['Monthly', 'Quarterly', 'Yearly'].map((value) => <MenuItem key={value} value={value}>{value}</MenuItem>) })}
                <NumericFormat customInput={TextField} fullWidth required label="Base rent"
                  value={values.rentAmount ?? ''} onValueChange={({ floatValue }) => change('rentAmount', floatValue ?? '')}
                  thousandSeparator prefix="$" decimalScale={2} fixedDecimalScale allowNegative={false}
                  placeholder="$0.00" inputProps={{ inputMode: 'decimal' }} />
                {property && unit && <RentEstimateCard key={`${setupId(property)}:${setupId(unit)}`}
                  propertyId={setupId(property)} unitId={setupId(unit)} />}
                {field('rentDueDay', 'Rent due day', { select: true, children: Array.from({ length: 31 }, (_, i) => <MenuItem key={i + 1} value={i + 1}>{i + 1}</MenuItem>) })}
                {toggle('proratedRentDue', 'Prorated rent is due')}
                {values.proratedRentDue && <>
                  {field('prorationMethod', 'Proration method', { select: true, children: [<MenuItem key="calculated" value="calculated">Calculate automatically</MenuItem>, <MenuItem key="manual" value="manual">Enter manually</MenuItem>] })}
                  {money('proratedRentAmount', 'Prorated rent amount', { disabled: values.prorationMethod === 'calculated' })}
                </>}
                <Divider />{money('depositAmount', 'Security deposit')}{money('petDepositAmount', 'Pet deposit')}
                {rows('leaseDeposits', 'Other deposits')}
                <Divider />{rows('fees', 'One-time fees')}
                <Typography variant="h5">Late fees</Typography>
                {values.fees.filter((fee) => fee.isLateFee).map((fee, index) => <Typography key={index}>{fee.name} — {fee.feeType === 'Flat' ? `$${fee.amount}` : `${fee.percentValue}%`}</Typography>)}
                <Stack direction="row" spacing={1}><Button variant="outlined" onClick={() => setLateFeesOpen(true)}>Configure late fees</Button>
                  <Button color="error" onClick={() => change('fees', values.fees.filter((fee) => !fee.isLateFee))}>Remove late fees</Button></Stack>
                <Divider /><Typography variant="h5">How will you collect rent?</Typography>
                {toggle('rentCollectionByPlatform', 'Online through Property Peace')}{toggle('rentCollectionOther', 'Other payment methods')}
                {values.rentCollectionOther && <>
                  {Object.entries({ cash: 'Cash', personalCheck: 'Personal check', cashiersCheck: "Cashier’s check", moneyOrder: 'Money order', achDirectDeposit: 'ACH / direct deposit', other: 'Other' }).map(([key, label]) => <FormControlLabel key={key}
                    label={label} control={<Checkbox checked={Boolean(values.rentCollectionOtherOptions[key])} onChange={(event) => change('rentCollectionOtherOptions', { ...values.rentCollectionOtherOptions, [key]: event.target.checked })} />} />)}
                  {field('rentCollectionOtherSpecify', 'Other method details')}
                </>}
                {toggle('markPastPaymentsAsPaid', 'Mark past scheduled payments as paid')}
              </>}
              {active === 2 && <>
                {toggle('addTenantsLater', 'Add tenants later')}
                {!values.addTenantsLater && <TenantSelector selectedTenants={tenants} onSelectTenants={setTenants} propertyId={Number(values.propertyId) || null} unitId={Number(values.unitId) || null} />}
                {toggle('tenantMailingAddressDiffers', 'Tenant mailing address differs from the rental address')}
                {values.tenantMailingAddressDiffers && <>
                  {field('tenantMailingStreetAddress', 'Mailing street address')}{field('tenantMailingUnit', 'Mailing unit')}
                  {field('tenantMailingCity', 'Mailing city')}{field('tenantMailingState', 'Mailing state')}{field('tenantMailingZipCode', 'Mailing ZIP code')}
                </>}
                <Divider />{rows('leaseOccupants', 'Other occupants', true)}
                {rows('leaseCoSigners', 'Cosigners', true)}{rows('leaseAdditionalSigners', 'Additional signers', true)}
              </>}
            </Stack>
          </Box>
          <Divider sx={{ my: 3 }} />
          <Stack direction="row" justifyContent="space-between" spacing={2}>
            <Button disabled={active === 0 || saving} onClick={() => setActive((step) => step - 1)}>Back</Button>
            {active < 2 ? <Button variant="contained" onClick={continueStep}>Continue</Button> :
              <Button variant="contained" disabled={saving || Boolean(saved) || propertiesError} onClick={submit}>
                {saving ? 'Saving…' : partial ? 'Retry tenant changes' : leaseId ? 'Save lease' : 'Create lease'}
              </Button>}
          </Stack>
        </MainCard>
      </Grid>
    </Grid>
    <ConfigureLateFeesModal open={lateFeesOpen} onClose={() => setLateFeesOpen(false)} leaseId={setupId(existing) || 0}
      propertyState={readSetup(property, 'state')} existingLateFees={values.fees.filter((fee) => fee.isLateFee)}
      onSave={(fees) => { change('fees', [...values.fees.filter((fee) => !fee.isLateFee), ...fees]); setLateFeesOpen(false); }} />
    <Dialog open={!embedded && Boolean(saved)} maxWidth="sm" fullWidth aria-labelledby="lease-setup-success">
      <DialogTitle id="lease-setup-success">{leaseId ? 'Lease saved successfully' : 'Lease created successfully'}</DialogTitle>
      <DialogContent><Stack spacing={2} alignItems="center" sx={{ py: 2 }}>
        <Box sx={{ color: 'success.main', fontSize: 64, lineHeight: 1 }}><CheckCircleOutlined /></Box>
        <Typography>Your lease is saved. View your lease or create its lease agreement.</Typography>
      </Stack></DialogContent>
      <DialogActions sx={{ px: 3, pb: 3, flexWrap: 'wrap', gap: 1 }}>
        <Button variant="outlined" onClick={() => navigate(destinations.view)}>View lease</Button>
        <Button variant="contained" onClick={() => navigate(`${destinations.agreement}&selectLease=1`)}>Create lease agreement</Button>
      </DialogActions>
    </Dialog>
  </Stack>;
}
