import { useEffect, useState } from 'react';
import { Alert, Autocomplete, Box, Button, CircularProgress, Container, Grid, List, ListItemButton, ListItemText, Stack, TextField, Typography } from '@mui/material';
import MainCard from 'components/MainCard';
import PageBreadcrumbs from 'components/breadcrumbs/PageBreadcrumbs';
import useFetchProperties from 'hooks/useFetchProperties';
import axiosServices from 'utils/axios';
import { agreementDate, agreementMoney, readAgreement } from './agreementWorkflow.mjs';
import { loadAgreementLeaseOptions } from './leaseSelection.mjs';

export default function SelectAgreementLease({ initialLease, onContinue, onCreateLease }) {
  const { properties, propertiesLoadedAt, isLoading, propertiesError, propertiesRefetch } = useFetchProperties();
  const [options, setOptions] = useState([]);
  const [selected, setSelected] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [reload, setReload] = useState(0);

  useEffect(() => {
    let live = true;
    setLoading(true);
    setOptions([]);
    setSelected(null);
    setError('');
    if (isLoading || propertiesError || !propertiesLoadedAt) return () => { live = false; };
    loadAgreementLeaseOptions(properties || [], axiosServices.get)
      .then((leases) => {
        if (!live) return;
        const initialId = Number(readAgreement(initialLease, 'id'));
        const preselected = leases.find((lease) => lease.id === initialId) ||
          (Number.isSafeInteger(initialId) && initialId > 0 ? { ...initialLease, id: initialId } : null);
        setOptions(preselected && !leases.some((lease) => lease.id === initialId) ? [preselected, ...leases] : leases);
        setSelected(preselected);
      })
      .catch((err) => { if (live) setError(err?.response?.data?.message || err.message || 'Could not load saved leases.'); })
      .finally(() => { if (live) setLoading(false); });
    return () => { live = false; };
  }, [properties, propertiesLoadedAt, isLoading, propertiesError, reload, initialLease]);

  const label = (lease) => [lease.propertyName, readAgreement(lease, 'unitName'), readAgreement(lease, 'name') || `Lease #${lease.id}`, `Starts ${agreementDate(readAgreement(lease, 'startDate'))}`].filter(Boolean).join(' · ');
  return <Container maxWidth="xl" sx={{ py: 3 }}><Stack spacing={3}>
    <PageBreadcrumbs items={[{ label: 'Dashboard', path: '/landlord/dashboard' }, { label: 'Leases', path: '/landlord/leases?tab=agreements' }, { label: 'Build lease agreement' }]} />
    <MainCard><Typography variant="overline" color="success.main">Lease agreement builder</Typography>
      <Typography variant="h3">Create a lease agreement</Typography>
      <Typography color="text.secondary" sx={{ mt: 1 }}>First choose the saved lease. Its property, rental terms, financials, and people will be inherited automatically.</Typography>
    </MainCard>
    <Grid container spacing={3} alignItems="flex-start">
      <Grid size={{ xs: 12, lg: 3 }}><MainCard><Typography variant="h5">Agreement setup</Typography>
        <List component="nav" aria-label="Agreement sections"><ListItemButton selected><ListItemText primary="1. Select lease" secondary="Choose the lease for this agreement" /></ListItemButton></List>
      </MainCard></Grid>
      <Grid size={{ xs: 12, lg: 9 }}><MainCard title="Select lease"><Stack spacing={3}>
        {propertiesError ? <Alert severity="error" action={<Button onClick={propertiesRefetch}>Retry</Button>}>Could not load properties.</Alert>
          : error ? <Alert severity="error" action={<Button onClick={() => setReload((value) => value + 1)}>Retry</Button>}>{error}</Alert>
          : loading ? <Box sx={{ py: 3, textAlign: 'center' }}><CircularProgress aria-label="Loading available leases" /></Box>
          : options.length ? <>
            <Autocomplete options={options} value={selected} onChange={(_event, value) => setSelected(value)} getOptionLabel={label}
              isOptionEqualToValue={(option, value) => option.id === value.id}
              renderInput={(params) => <TextField {...params} label="Lease" placeholder="Search property, unit, or lease" />} />
            {selected && <Box><Typography fontWeight={700}>{readAgreement(selected, 'name') || `Lease #${selected.id}`}</Typography>
              <Typography color="text.secondary">Rent: {agreementMoney(readAgreement(selected, 'rentAmount'))} · Starts {agreementDate(readAgreement(selected, 'startDate'))}</Typography></Box>}
          </> : <Alert severity="info">No saved leases found. Create a lease first, then return to build its agreement.</Alert>}
        <Stack direction={{ xs: 'column', sm: 'row' }} alignItems={{ xs: 'flex-start', sm: 'center' }} spacing={2}>
          <Button variant="contained" disabled={!selected || loading || Boolean(error) || propertiesError} onClick={() => { if (selected) onContinue(selected.id); }}>Continue</Button>
          <Button variant="text" onClick={onCreateLease} sx={{ p: 0, minWidth: 0, color: 'text.secondary', fontWeight: 400, '&:hover': { backgroundColor: 'transparent', textDecoration: 'underline' } }}>Don't see your lease? Create a lease</Button>
        </Stack>
      </Stack></MainCard></Grid>
    </Grid>
  </Stack></Container>;
}
