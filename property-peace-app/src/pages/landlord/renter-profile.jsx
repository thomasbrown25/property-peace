import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Alert, alpha, Avatar, Box, Button, Chip, CircularProgress, Divider, Grid, IconButton,
  Menu, MenuItem, Paper, Stack, Tab, Tabs, Tooltip, Typography, useMediaQuery, useTheme
} from '@mui/material';
import {
  CloudUploadOutlined, DollarOutlined, DownloadOutlined, EditOutlined, FileTextOutlined,
  HomeOutlined, MailOutlined, MessageOutlined, MoreOutlined, PhoneOutlined,
  SafetyCertificateOutlined, SendOutlined, ToolOutlined
} from '@ant-design/icons';
import { useNavigate, useParams, useSearchParams } from 'react-router-dom';

import PageBreadcrumbs from 'components/breadcrumbs/PageBreadcrumbs';
import TenantEditDrawer from 'components/drawers/TenantEditDrawer';
import TenantMessageDrawer from 'components/drawers/TenantMessageDrawer';
import ConfirmationDialog from 'components/dialogs/ConfirmationDialog';
import { tenantDocumentAPI, tenantInviteAPI } from 'api';
import { getApplicationsByLandlord } from 'api/application';
import { removeTenantFromLease } from 'api/lease';
import { openSnackbar } from 'api/snackbar';
import { useDrawer } from 'contexts/DrawerContext';
import useAuth from 'hooks/useAuth';
import useFetchProperties from 'hooks/useFetchProperties';
import axiosServices from 'utils/axios';
import { formatCurrency, formatDate, formatPhoneInput } from 'utils/formatters';
import {
  applicationsForRenter, dedupeAndOrderRenterLeases, insuranceDocumentsForRenter,
  renterProfileTabFromSearch, requestsForRenter, RENTER_PROFILE_TABS, tenantDirectoryRoute
} from 'utils/renterWorkspace';

const TAB_LABELS = {
  profile: 'Profile', leases: 'Leases', transactions: 'Transactions', insurance: 'Insurance',
  applications: 'Applications', requests: 'Requests'
};

const read = (record, camel, pascal) => record?.[camel] ?? record?.[pascal];
const recordId = (record) => read(record, 'id', 'Id');
const unwrapPayload = (raw) => raw?.data?.data ?? raw?.data ?? raw;
const unwrapList = (raw) => {
  const value = unwrapPayload(raw);
  return Array.isArray(value) ? value : [];
};
const titleCase = (value) => String(value ?? '').replace(/([a-z])([A-Z])/g, '$1 $2').replace(/[_-]+/g, ' ').replace(/\b\w/g, (letter) => letter.toUpperCase()) || 'Unknown';
const statusColor = (value) => {
  const status = String(value ?? '').toLowerCase();
  if (['active', 'approved', 'paid', 'resolved', 'complete'].some((item) => status.includes(item))) return 'success';
  if (['overdue', 'rejected', 'cancelled', 'failed', 'expired'].some((item) => status.includes(item))) return 'error';
  if (['pending', 'draft', 'submitted', 'scheduled', 'progress', 'awaiting'].some((item) => status.includes(item))) return 'warning';
  return 'default';
};

function StatusChip({ value, label }) {
  return <Chip size="small" label={label || titleCase(value)} color={statusColor(value)} variant="outlined" sx={{ fontWeight: 700 }} />;
}

function EmptyState({ icon, title, description, action }) {
  return (
    <Stack alignItems="center" spacing={1.2} sx={{ py: { xs: 5, md: 7 }, px: 2, textAlign: 'center' }}>
      <Avatar sx={{ width: 48, height: 48, bgcolor: (theme) => alpha(theme.palette.primary.main, 0.1), color: 'primary.main' }}>{icon}</Avatar>
      <Typography variant="h5" fontWeight={750}>{title}</Typography>
      <Typography color="text.secondary" sx={{ maxWidth: 460 }}>{description}</Typography>
      {action}
    </Stack>
  );
}

function TabState({ loading, error, onRetry, children }) {
  if (loading) return <Stack alignItems="center" spacing={1} sx={{ py: 7 }}><CircularProgress size={28} /><Typography color="text.secondary">Loading renter records…</Typography></Stack>;
  if (error) return <Alert severity="warning" action={<Button color="inherit" size="small" onClick={onRetry}>Retry</Button>}>{error}</Alert>;
  return children;
}

function InfoField({ label, value, href }) {
  return (
    <Box minWidth={0}>
      <Typography variant="caption" color="text.secondary" fontWeight={700}>{label}</Typography>
      <Typography component={href && value ? 'a' : 'p'} href={href && value ? href : undefined} sx={{ mt: 0.35, mb: 0, color: href && value ? 'primary.main' : value ? 'text.primary' : 'text.disabled', fontWeight: 600, wordBreak: 'break-word' }}>
        {value || 'Not added'}
      </Typography>
    </Box>
  );
}

function Section({ title, action, children }) {
  return (
    <Box component="section" sx={{ py: 2.5, '& + &': { borderTop: '1px solid', borderColor: 'divider' } }}>
      <Stack direction="row" justifyContent="space-between" alignItems="center" spacing={2} sx={{ mb: 2 }}>
        <Typography variant="h5" fontWeight={750}>{title}</Typography>{action}
      </Stack>
      {children}
    </Box>
  );
}

function ResidencyTrack({ lease, propertyName, unitName }) {
  const startDate = read(lease, 'startDate', 'StartDate');
  const endDate = read(lease, 'endDate', 'EndDate');
  return (
    <Box sx={{ mt: 2.25, p: 1.5, borderRadius: 2, bgcolor: (theme) => alpha(theme.palette.primary.main, theme.palette.mode === 'dark' ? 0.12 : 0.045) }}>
      <Typography variant="caption" color="text.secondary" fontWeight={800} sx={{ letterSpacing: 0.65, textTransform: 'uppercase' }}>Residency track</Typography>
      <Stack direction="row" spacing={1.2} sx={{ mt: 1.2 }}>
        <Stack alignItems="center" sx={{ pt: 0.35 }}><Box sx={{ width: 10, height: 10, borderRadius: '50%', bgcolor: 'success.main' }} /><Box sx={{ width: 2, flex: 1, minHeight: 36, bgcolor: 'divider', my: 0.5 }} /><Box sx={{ width: 10, height: 10, borderRadius: '50%', border: '2px solid', borderColor: 'primary.main' }} /></Stack>
        <Stack spacing={1.35} minWidth={0}>
          <Box><Typography fontWeight={750} noWrap>{propertyName || 'No current residence'}</Typography><Typography variant="caption" color="text.secondary">{unitName || (lease ? 'Current home' : 'Assign a lease to begin')}</Typography></Box>
          <Box><Typography fontWeight={700}>{endDate ? `Lease ends ${formatDate(endDate)}` : 'No lease milestone'}</Typography><Typography variant="caption" color="text.secondary">{startDate ? `Started ${formatDate(startDate)}` : 'Dates not available'}</Typography></Box>
        </Stack>
      </Stack>
    </Box>
  );
}

export default function RenterProfilePage() {
  const { renterId } = useParams();
  const numericRenterId = Number(renterId);
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const activeTab = renterProfileTabFromSearch(searchParams);
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('md'));
  const drawer = useDrawer();
  const { user: authUser } = useAuth();
  const landlordId = authUser?.id ?? authUser?.Id;
  const { properties = [], propertiesRefetch } = useFetchProperties();

  const [renter, setRenter] = useState(null);
  const [linkedUser, setLinkedUser] = useState(null);
  const [baseLoading, setBaseLoading] = useState(true);
  const [baseError, setBaseError] = useState(null);
  const [leases, setLeases] = useState([]);
  const [leaseLoading, setLeaseLoading] = useState(true);
  const [payments, setPayments] = useState([]);
  const [documents, setDocuments] = useState([]);
  const [applications, setApplications] = useState([]);
  const [requests, setRequests] = useState([]);
  const [loaded, setLoaded] = useState({});
  const [tabLoading, setTabLoading] = useState({});
  const [tabErrors, setTabErrors] = useState({});
  const [actionsAnchor, setActionsAnchor] = useState(null);
  const [messageOpen, setMessageOpen] = useState(false);
  const [removeLease, setRemoveLease] = useState(null);
  const [removing, setRemoving] = useState(false);
  const [sendingInvite, setSendingInvite] = useState(false);
  const [uploadingInsurance, setUploadingInsurance] = useState(false);

  const fetchRenter = useCallback(async () => {
    if (!Number.isSafeInteger(numericRenterId) || numericRenterId <= 0) {
      setBaseError('Renter not found.');
      setBaseLoading(false);
      return;
    }
    try {
      setBaseLoading(true);
      setBaseError(null);
      const response = await axiosServices.get(`/api/tenant/${numericRenterId}`);
      const value = unwrapPayload(response);
      if (!value || recordId(value) == null) throw new Error('Renter not found.');
      setRenter(value);
      setLinkedUser(read(value, 'user', 'User') || null);
    } catch (error) {
      setBaseError(error?.response?.data?.message || error?.message || 'Unable to load this renter.');
    } finally {
      setBaseLoading(false);
    }
  }, [numericRenterId]);

  useEffect(() => {
    setLoaded({});
    setPayments([]);
    setDocuments([]);
    setApplications([]);
    setRequests([]);
    fetchRenter();
    propertiesRefetch();
  }, [fetchRenter, propertiesRefetch]);

  useEffect(() => {
    if (!renter) return undefined;
    let current = true;
    const fetchLeases = async () => {
      setLeaseLoading(true);
      try {
        const fromProperties = [];
        properties.forEach((property) => {
          (property.units || property.Units || []).forEach((unit) => {
            const lease = unit.lease || unit.Lease;
            const tenantRecords = lease?.tenants || lease?.Tenants || [];
            if (lease && tenantRecords.some((item) => Number(recordId(item)) === numericRenterId)) {
              fromProperties.push({ ...lease, propertyId: recordId(property), propertyName: read(property, 'name', 'Name'), unitId: recordId(unit), unitName: read(unit, 'name', 'Name') });
            }
          });
        });
        const historyResponse = await axiosServices.get('/api/lease/history');
        const history = unwrapList(historyResponse).filter((lease) => (lease.tenants || lease.Tenants || []).some((item) => Number(recordId(item)) === numericRenterId));
        if (current) setLeases(dedupeAndOrderRenterLeases([...fromProperties, ...history]));
      } catch {
        if (current) setLeases(dedupeAndOrderRenterLeases([]));
      } finally {
        if (current) setLeaseLoading(false);
      }
    };
    fetchLeases();
    return () => { current = false; };
  }, [numericRenterId, properties, renter]);

  const runTabLoad = useCallback(async (key, loader, force = false) => {
    if (loaded[key] && !force) return;
    setTabLoading((state) => ({ ...state, [key]: true }));
    setTabErrors((state) => ({ ...state, [key]: null }));
    try {
      await loader();
      setLoaded((state) => ({ ...state, [key]: true }));
    } catch (error) {
      setTabErrors((state) => ({ ...state, [key]: error?.response?.data?.message || error?.message || `Unable to load ${TAB_LABELS[key].toLowerCase()}.` }));
    } finally {
      setTabLoading((state) => ({ ...state, [key]: false }));
    }
  }, [loaded]);

  const loadApplications = useCallback((force = false) => runTabLoad('applications', async () => {
    if (!landlordId) throw new Error('Landlord account information is unavailable.');
    const response = await getApplicationsByLandlord(landlordId);
    setApplications(applicationsForRenter(unwrapList(response), renter));
  }, force), [landlordId, renter, runTabLoad]);
  const loadDocuments = useCallback((force = false) => runTabLoad('insurance', async () => {
    setDocuments(unwrapList(await tenantDocumentAPI.getTenantDocumentsByTenant(numericRenterId)));
  }, force), [numericRenterId, runTabLoad]);
  const loadPayments = useCallback((force = false) => runTabLoad('transactions', async () => {
    setPayments(unwrapList(await axiosServices.get(`/api/payment/tenant/${numericRenterId}`)));
  }, force), [numericRenterId, runTabLoad]);
  const loadRequests = useCallback((force = false) => runTabLoad('requests', async () => {
    setRequests(requestsForRenter(unwrapList(await axiosServices.get('/api/maintenance-requests')), numericRenterId));
  }, force), [numericRenterId, runTabLoad]);

  useEffect(() => {
    if (!renter) return;
    if (activeTab === 'profile' || activeTab === 'applications') loadApplications();
    if (activeTab === 'profile' || activeTab === 'insurance') loadDocuments();
    if (activeTab === 'transactions') loadPayments();
    if (activeTab === 'requests') loadRequests();
  }, [activeTab, loadApplications, loadDocuments, loadPayments, loadRequests, renter]);

  const fullName = useMemo(() => {
    const first = read(renter, 'firstname', 'Firstname') || read(renter, 'firstName', 'FirstName') || '';
    const last = read(renter, 'lastname', 'Lastname') || read(renter, 'lastName', 'LastName') || '';
    return `${first} ${last}`.trim() || 'Unnamed renter';
  }, [renter]);
  const initials = useMemo(() => fullName.split(/\s+/).slice(0, 2).map((part) => part[0]).join('').toUpperCase(), [fullName]);
  const activeLease = leases.find((lease) => read(lease, 'isDrafted', 'IsDrafted') !== true && read(lease, 'isActive', 'IsActive') !== false) || leases[0] || null;
  const activeLeaseId = recordId(activeLease);
  const application = applications[0] || null;
  const insuranceDocuments = insuranceDocumentsForRenter(documents);
  const generalDocuments = documents.filter((document) => !insuranceDocuments.includes(document));
  const portalConnected = Boolean(read(renter, 'userId', 'UserId'));
  const renterEmail = read(renter, 'email', 'Email');
  const renterPhone = read(renter, 'phoneNumber', 'PhoneNumber') || read(renter, 'phone', 'Phone');
  const propertyName = read(activeLease, 'propertyName', 'PropertyName') || read(renter, 'propertyName', 'PropertyName');
  const unitName = read(activeLease, 'unitName', 'UnitName') || read(renter, 'unitName', 'UnitName');
  const groupedPayments = useMemo(() => payments.reduce((groups, payment) => {
    const value = read(payment, 'paymentDate', 'PaymentDate') || read(payment, 'dueDate', 'DueDate');
    const date = value ? new Date(value) : null;
    const key = date && !Number.isNaN(date.getTime()) ? new Intl.DateTimeFormat('en-US', { month: 'long', year: 'numeric' }).format(date) : 'Date unavailable';
    groups[key] = [...(groups[key] || []), payment];
    return groups;
  }, {}), [payments]);

  const changeTab = (_, index) => {
    const key = RENTER_PROFILE_TABS[index] || 'profile';
    const next = new URLSearchParams(searchParams);
    if (key === 'profile') next.delete('tab'); else next.set('tab', key);
    setSearchParams(next);
  };

  const sendInvite = async () => {
    if (!renterEmail) return;
    try {
      setSendingInvite(true);
      const response = await tenantInviteAPI.createTenantInvite({ tenantId: numericRenterId, email: renterEmail });
      if (response?.success === false) throw new Error(response.message || 'Unable to send invite.');
      openSnackbar({ open: true, message: 'Portal invite sent.', variant: 'alert', alert: { color: 'success' } });
    } catch (error) {
      openSnackbar({ open: true, message: error?.response?.data?.message || error?.message || 'Unable to send invite.', variant: 'alert', alert: { color: 'error' } });
    } finally { setSendingInvite(false); }
  };

  const uploadInsurance = async (event) => {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) return;
    try {
      setUploadingInsurance(true);
      await tenantDocumentAPI.uploadTenantDocuments(numericRenterId, [file], { documentType: 20, leaseId: activeLeaseId || undefined });
      await loadDocuments(true);
      openSnackbar({ open: true, message: 'Insurance document uploaded.', variant: 'alert', alert: { color: 'success' } });
    } catch (error) {
      openSnackbar({ open: true, message: error?.response?.data?.message || 'Unable to upload insurance document.', variant: 'alert', alert: { color: 'error' } });
    } finally { setUploadingInsurance(false); }
  };

  const renderActivePanel = () => {
    if (activeTab === 'profile') {
      return (
        <>
          <Section title="Personal information" action={<Button size="small" startIcon={<EditOutlined />} onClick={() => drawer.openTenantEditDrawer(renter)}>Edit</Button>}>
            <Grid container spacing={2.25}>
              <Grid size={{ xs: 12, sm: 6 }}><InfoField label="First name" value={read(renter, 'firstname', 'Firstname') || read(renter, 'firstName', 'FirstName')} /></Grid>
              <Grid size={{ xs: 12, sm: 6 }}><InfoField label="Last name" value={read(renter, 'lastname', 'Lastname') || read(renter, 'lastName', 'LastName')} /></Grid>
              <Grid size={{ xs: 12, sm: 6 }}><InfoField label="Email" value={renterEmail} href={renterEmail ? `mailto:${renterEmail}` : null} /></Grid>
              <Grid size={{ xs: 12, sm: 6 }}><InfoField label="Phone" value={renterPhone ? formatPhoneInput(renterPhone) : null} href={renterPhone ? `tel:${renterPhone}` : null} /></Grid>
              <Grid size={{ xs: 12, sm: 6 }}><InfoField label="Date of birth" value={read(application, 'dateOfBirth', 'DateOfBirth') ? formatDate(read(application, 'dateOfBirth', 'DateOfBirth')) : null} /></Grid>
              <Grid size={{ xs: 12, sm: 6 }}><InfoField label="Portal access" value={portalConnected ? 'Connected' : renterEmail ? 'Ready to invite' : null} /></Grid>
            </Grid>
          </Section>
          <Section title="Forwarding address">
            <InfoField label="Address" value={[read(application, 'currentAddress', 'CurrentAddress'), read(application, 'currentCity', 'CurrentCity'), read(application, 'currentState', 'CurrentState'), read(application, 'currentZipCode', 'CurrentZipCode')].filter(Boolean).join(', ') || null} />
          </Section>
          <Section title="Emergency contact">
            {read(application, 'emergencyContactName', 'EmergencyContactName') ? (
              <Grid container spacing={2.25}>
                <Grid size={{ xs: 12, sm: 4 }}><InfoField label="Name" value={read(application, 'emergencyContactName', 'EmergencyContactName')} /></Grid>
                <Grid size={{ xs: 12, sm: 4 }}><InfoField label="Relationship" value={read(application, 'emergencyContactRelationship', 'EmergencyContactRelationship')} /></Grid>
                <Grid size={{ xs: 12, sm: 4 }}><InfoField label="Phone" value={formatPhoneInput(read(application, 'emergencyContactPhone', 'EmergencyContactPhone'))} /></Grid>
              </Grid>
            ) : <Typography color="text.secondary">No emergency contact added.</Typography>}
          </Section>
          <Section title="Pets"><Typography color={read(application, 'hasPets', 'HasPets') ? 'text.primary' : 'text.secondary'}>{read(application, 'hasPets', 'HasPets') ? read(application, 'petDetails', 'PetDetails') || 'Pets are listed on the application.' : 'No pets added.'}</Typography></Section>
          <Section title="Vehicles"><Typography color={read(application, 'hasVehicles', 'HasVehicles') ? 'text.primary' : 'text.secondary'}>{read(application, 'hasVehicles', 'HasVehicles') ? read(application, 'vehicleDetails', 'VehicleDetails') || 'Vehicles are listed on the application.' : 'No vehicles added.'}</Typography></Section>
          <Section title="Attachments">
            <TabState loading={tabLoading.insurance} error={tabErrors.insurance} onRetry={() => loadDocuments(true)}>
              {generalDocuments.length ? <Stack spacing={1}>{generalDocuments.map((document) => (
                <Paper key={recordId(document)} variant="outlined" sx={{ p: 1.5, borderRadius: 2 }}>
                  <Stack direction="row" justifyContent="space-between" alignItems="center" spacing={2}>
                    <Stack direction="row" spacing={1.2} alignItems="center" minWidth={0}><FileTextOutlined /><Box minWidth={0}><Typography fontWeight={700} noWrap>{read(document, 'fileName', 'FileName') || 'Renter document'}</Typography><Typography variant="caption" color="text.secondary">{titleCase(read(document, 'documentTypeName', 'DocumentTypeName') || read(document, 'documentType', 'DocumentType'))}</Typography></Box></Stack>
                    <IconButton aria-label="Download document" onClick={() => tenantDocumentAPI.downloadTenantDocument(read(document, 'blobUrl', 'BlobUrl'), read(document, 'fileName', 'FileName'))}><DownloadOutlined /></IconButton>
                  </Stack>
                </Paper>
              ))}</Stack> : <Typography color="text.secondary">No general attachments added.</Typography>}
            </TabState>
          </Section>
        </>
      );
    }

    if (activeTab === 'leases') {
      return (
        <Section title="Lease history">
          <TabState loading={leaseLoading} error={null}>
            {leases.length ? <Stack spacing={1.5}>{leases.map((lease) => {
              const id = recordId(lease);
              const drafted = read(lease, 'isDrafted', 'IsDrafted') === true;
              const active = !drafted && read(lease, 'isActive', 'IsActive') !== false;
              return (
                <Paper key={id} variant="outlined" sx={{ p: 2, borderRadius: 2.5 }}>
                  <Stack direction={{ xs: 'column', sm: 'row' }} justifyContent="space-between" spacing={2}>
                    <Stack spacing={0.65} minWidth={0}>
                      <Stack direction="row" spacing={1} alignItems="center" flexWrap="wrap" useFlexGap><Typography variant="h5" fontWeight={750}>{read(lease, 'propertyName', 'PropertyName') || `Lease #${id}`}</Typography><StatusChip value={drafted ? 'draft' : active ? 'active' : 'ended'} /></Stack>
                      <Typography color="text.secondary">{read(lease, 'unitName', 'UnitName') || 'Property-wide lease'}</Typography>
                      <Typography variant="body2">{read(lease, 'startDate', 'StartDate') ? formatDate(read(lease, 'startDate', 'StartDate')) : 'No start date'} – {read(lease, 'endDate', 'EndDate') ? formatDate(read(lease, 'endDate', 'EndDate')) : 'No end date'}</Typography>
                      {read(lease, 'rentAmount', 'RentAmount') != null && <Typography fontWeight={750}>{formatCurrency(read(lease, 'rentAmount', 'RentAmount'))} / month</Typography>}
                    </Stack>
                    <Stack direction="row" spacing={1} alignItems="flex-start"><Button variant="outlined" onClick={() => navigate(`/landlord/leases/${id}`)}>View lease</Button><Button color="error" onClick={() => setRemoveLease(lease)}>Remove</Button></Stack>
                  </Stack>
                </Paper>
              );
            })}</Stack> : <EmptyState icon={<HomeOutlined />} title="No leases" description="This renter is not connected to a current or historical lease." />}
          </TabState>
        </Section>
      );
    }

    if (activeTab === 'transactions') {
      return (
        <Section title="Transaction history">
          <TabState loading={tabLoading.transactions} error={tabErrors.transactions} onRetry={() => loadPayments(true)}>
            {payments.length ? <Stack spacing={2}>{Object.entries(groupedPayments).map(([month, monthPayments]) => (
              <Box key={month}>
                <Typography variant="subtitle2" color="text.secondary" fontWeight={800} sx={{ mb: 0.75 }}>{month}</Typography>
                <Paper variant="outlined" sx={{ borderRadius: 2.5, overflow: 'hidden' }}>
                  {monthPayments.map((payment, index) => {
                    const status = read(payment, 'status', 'Status') || (read(payment, 'isOnTime', 'IsOnTime') === false ? 'Late' : 'Paid');
                    return (
                      <Stack key={recordId(payment) || index} direction={{ xs: 'column', sm: 'row' }} justifyContent="space-between" spacing={1.5} sx={{ p: 1.75, borderTop: index ? '1px solid' : 0, borderColor: 'divider' }}>
                        <Stack direction="row" spacing={1.2} alignItems="center"><Avatar sx={{ bgcolor: alpha(theme.palette.success.main, 0.11), color: 'success.main' }}><DollarOutlined /></Avatar><Box><Typography fontWeight={750}>{titleCase(read(payment, 'paymentType', 'PaymentType') || 'Payment')}</Typography><Typography variant="caption" color="text.secondary">{read(payment, 'paymentDate', 'PaymentDate') ? formatDate(read(payment, 'paymentDate', 'PaymentDate')) : 'Date unavailable'}</Typography></Box></Stack>
                        <Stack direction="row" spacing={1.2} alignItems="center" justifyContent="space-between"><StatusChip value={status} /><Typography variant="h5" fontWeight={800}>{formatCurrency(read(payment, 'amount', 'Amount') || 0)}</Typography></Stack>
                      </Stack>
                    );
                  })}
                </Paper>
              </Box>
            ))}</Stack> : <EmptyState icon={<DollarOutlined />} title="No transactions" description="Payments and recorded charges for this renter will appear here." />}
          </TabState>
        </Section>
      );
    }

    if (activeTab === 'insurance') {
      return (
        <Section title="Insurance" action={<Button component="label" variant="contained" color="success" startIcon={<CloudUploadOutlined />} disabled={uploadingInsurance}>{uploadingInsurance ? 'Uploading…' : 'Upload policy'}<input hidden type="file" accept=".pdf,.png,.jpg,.jpeg" onChange={uploadInsurance} /></Button>}>
          <Paper variant="outlined" sx={{ p: 2, mb: 2, borderRadius: 2.5, bgcolor: alpha(theme.palette.info.main, 0.035) }}>
            <Stack direction="row" spacing={1.2} alignItems="center"><SafetyCertificateOutlined style={{ fontSize: 22, color: theme.palette.info.main }} /><Box><Typography fontWeight={750}>Lease requirement</Typography><Typography color="text.secondary">{read(activeLease, 'rentersInsuranceRequired', 'RentersInsuranceRequired') === true ? 'Renters insurance is required for the current lease.' : read(activeLease, 'rentersInsuranceRequired', 'RentersInsuranceRequired') === false ? 'The current lease does not require renters insurance.' : 'No insurance requirement is recorded.'}</Typography></Box></Stack>
          </Paper>
          <TabState loading={tabLoading.insurance} error={tabErrors.insurance} onRetry={() => loadDocuments(true)}>
            {insuranceDocuments.length ? <Stack spacing={1.25}>{insuranceDocuments.map((document) => {
              const expiration = read(document, 'expirationDate', 'ExpirationDate');
              const expired = expiration && new Date(expiration) < new Date();
              return (
                <Paper key={recordId(document)} variant="outlined" sx={{ p: 1.75, borderRadius: 2.5 }}>
                  <Stack direction={{ xs: 'column', sm: 'row' }} justifyContent="space-between" alignItems={{ sm: 'center' }} spacing={1.5}>
                    <Stack direction="row" spacing={1.2} alignItems="center" minWidth={0}><Avatar sx={{ bgcolor: alpha(theme.palette.info.main, 0.1), color: 'info.main' }}><SafetyCertificateOutlined /></Avatar><Box minWidth={0}><Typography fontWeight={750} noWrap>{read(document, 'fileName', 'FileName') || 'Insurance policy'}</Typography><Typography variant="caption" color="text.secondary">{titleCase(read(document, 'documentTypeName', 'DocumentTypeName') || read(document, 'documentType', 'DocumentType'))}{expiration ? ` · Expires ${formatDate(expiration)}` : ' · No expiration recorded'}</Typography></Box></Stack>
                    <Stack direction="row" spacing={1} alignItems="center"><StatusChip value={expired ? 'expired' : 'on file'} label={expired ? 'Expired' : 'On file'} /><IconButton aria-label="Download insurance document" onClick={() => tenantDocumentAPI.downloadTenantDocument(read(document, 'blobUrl', 'BlobUrl'), read(document, 'fileName', 'FileName'))}><DownloadOutlined /></IconButton></Stack>
                  </Stack>
                </Paper>
              );
            })}</Stack> : <EmptyState icon={<SafetyCertificateOutlined />} title="No insurance on file" description="Upload a renter or liability insurance policy to track coverage and expiration." />}
          </TabState>
        </Section>
      );
    }

    if (activeTab === 'applications') {
      return (
        <Section title="Applications">
          <TabState loading={tabLoading.applications} error={tabErrors.applications} onRetry={() => loadApplications(true)}>
            {applications.length ? <Stack spacing={1.25}>{applications.map((item) => (
              <Paper key={recordId(item)} variant="outlined" sx={{ p: 1.75, borderRadius: 2.5 }}>
                <Stack direction={{ xs: 'column', sm: 'row' }} justifyContent="space-between" spacing={1.5}>
                  <Stack direction="row" spacing={1.2} alignItems="center"><Avatar sx={{ bgcolor: alpha(theme.palette.primary.main, 0.1), color: 'primary.main' }}><FileTextOutlined /></Avatar><Box><Typography fontWeight={750}>{read(item, 'propertyName', 'PropertyName') || 'Rental application'}</Typography><Typography variant="caption" color="text.secondary">Submitted {read(item, 'submittedAt', 'SubmittedAt') ? formatDate(read(item, 'submittedAt', 'SubmittedAt')) : 'date unavailable'}</Typography></Box></Stack>
                  <Stack direction="row" spacing={1} alignItems="center" flexWrap="wrap" useFlexGap><StatusChip value={read(item, 'status', 'Status')} /><Button variant="outlined" onClick={() => navigate(`/landlord/listings?tab=applications&applicationId=${recordId(item)}`)}>View application</Button>{read(item, 'pdfBlobUrl', 'PdfBlobUrl') && <Button component="a" href={read(item, 'pdfBlobUrl', 'PdfBlobUrl')} target="_blank" rel="noreferrer">PDF</Button>}</Stack>
                </Stack>
              </Paper>
            ))}</Stack> : <EmptyState icon={<FileTextOutlined />} title="No linked applications" description="Applications converted to this renter will appear here." />}
          </TabState>
        </Section>
      );
    }

    if (activeTab === 'requests') {
      return (
        <Section title="Requests">
          <TabState loading={tabLoading.requests} error={tabErrors.requests} onRetry={() => loadRequests(true)}>
            {requests.length ? <Stack spacing={1.25}>{requests.map((request) => (
              <Paper key={recordId(request)} variant="outlined" sx={{ p: 1.75, borderRadius: 2.5 }}>
                <Stack direction={{ xs: 'column', sm: 'row' }} justifyContent="space-between" spacing={1.5}>
                  <Stack direction="row" spacing={1.2} alignItems="center"><Avatar sx={{ bgcolor: alpha(theme.palette.warning.main, 0.12), color: 'warning.main' }}><ToolOutlined /></Avatar><Box><Typography fontWeight={750}>{read(request, 'title', 'Title') || `Request ${read(request, 'orderNumber', 'OrderNumber') || recordId(request)}`}</Typography><Typography variant="caption" color="text.secondary">{read(request, 'orderNumber', 'OrderNumber') || `MR-${recordId(request)}`} · Submitted {read(request, 'createdAt', 'CreatedAt') ? formatDate(read(request, 'createdAt', 'CreatedAt')) : 'date unavailable'}</Typography></Box></Stack>
                  <Stack direction="row" spacing={1} alignItems="center" flexWrap="wrap" useFlexGap><StatusChip value={read(request, 'priority', 'Priority')} /><StatusChip value={read(request, 'status', 'Status')} /><Button variant="outlined" onClick={() => navigate(`/landlord/maintenance/${recordId(request)}`)}>View request</Button></Stack>
                </Stack>
              </Paper>
            ))}</Stack> : <EmptyState icon={<ToolOutlined />} title="No requests" description="Maintenance requests submitted by this renter will appear here." />}
          </TabState>
        </Section>
      );
    }

    return null;
  };

  // PROFILE_RENDER
  if (baseLoading) return <Stack alignItems="center" justifyContent="center" sx={{ minHeight: 420 }}><CircularProgress /></Stack>;
  if (baseError || !renter) {
    return (
      <Paper variant="outlined" sx={{ p: 3, borderRadius: 3 }}>
        <Alert severity="error">{baseError || 'Renter not found.'}</Alert>
        <Button sx={{ mt: 2 }} onClick={() => navigate(tenantDirectoryRoute())}>Back to tenants</Button>
      </Paper>
    );
  }

  return (
    <Box sx={{ pb: 4 }}>
      <PageBreadcrumbs items={[
        { label: 'Dashboard', path: '/landlord/dashboard' },
        { label: 'Leases', path: '/landlord/leases' },
        { label: 'Tenants', path: tenantDirectoryRoute() },
        { label: fullName }
      ]} />

      <Grid container spacing={2.5} sx={{ mt: 1 }} alignItems="flex-start">
        <Grid size={{ xs: 12, md: 3.25 }}>
          <Paper variant="outlined" sx={{ p: { xs: 2, md: 2.5 }, borderRadius: 3, position: { md: 'sticky' }, top: { md: 88 }, boxShadow: `0 12px 32px ${alpha(theme.palette.common.black, 0.05)}` }}>
            <Stack direction={{ xs: 'row', md: 'column' }} spacing={2} alignItems={{ xs: 'center', md: 'stretch' }}>
              <Avatar src={read(linkedUser, 'profileImageUrl', 'ProfileImageUrl')} sx={{ width: { xs: 64, md: 82 }, height: { xs: 64, md: 82 }, alignSelf: { md: 'center' }, bgcolor: 'primary.main', fontSize: '1.4rem', fontWeight: 750 }}>{initials}</Avatar>
              <Box sx={{ minWidth: 0, textAlign: { md: 'center' }, flex: { xs: 1, md: 'initial' } }}>
                <Typography variant={isMobile ? 'h4' : 'h3'} fontWeight={800} noWrap>{fullName}</Typography>
                <Chip size="small" label={portalConnected ? 'Portal connected' : renterEmail ? 'Ready to invite' : 'Email needed'} color={portalConnected ? 'success' : renterEmail ? 'warning' : 'default'} variant="outlined" sx={{ mt: 0.75, fontWeight: 700 }} />
              </Box>
            </Stack>
            <Stack spacing={1.15} sx={{ mt: 2.25 }}>
              {renterEmail && <Stack direction="row" spacing={1} alignItems="center"><MailOutlined /><Typography component="a" href={`mailto:${renterEmail}`} color="primary.main" noWrap>{renterEmail}</Typography></Stack>}
              {renterPhone && <Stack direction="row" spacing={1} alignItems="center"><PhoneOutlined /><Typography component="a" href={`tel:${renterPhone}`} color="text.primary">{formatPhoneInput(renterPhone)}</Typography></Stack>}
            </Stack>
            <ResidencyTrack lease={activeLease} propertyName={propertyName} unitName={unitName} />
          </Paper>
        </Grid>

        <Grid size={{ xs: 12, md: 8.75 }}>
          <Paper variant="outlined" sx={{ borderRadius: 3, overflow: 'hidden', boxShadow: `0 12px 32px ${alpha(theme.palette.common.black, 0.045)}` }}>
            <Stack direction={{ xs: 'column', sm: 'row' }} justifyContent="space-between" alignItems={{ sm: 'center' }} spacing={1.5} sx={{ px: { xs: 2, md: 2.5 }, py: 2 }}>
              <Box><Typography variant="overline" color="text.secondary" fontWeight={800}>Renter profile</Typography><Typography variant="h4" fontWeight={800}>A complete view of {fullName}</Typography></Box>
              <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap>
                <Button variant="outlined" startIcon={<MessageOutlined />} onClick={() => setMessageOpen(true)}>Message</Button>
                <Button variant="contained" color="success" startIcon={<DollarOutlined />} disabled={!activeLeaseId} onClick={() => activeLeaseId && navigate(`/landlord/leases/${activeLeaseId}/charges`)}>Add charge</Button>
                <Tooltip title="Renter actions"><IconButton aria-label="Renter actions" onClick={(event) => setActionsAnchor(event.currentTarget)} sx={{ border: '1px solid', borderColor: 'divider', borderRadius: 1.5 }}><MoreOutlined /></IconButton></Tooltip>
              </Stack>
            </Stack>
            <Menu anchorEl={actionsAnchor} open={Boolean(actionsAnchor)} onClose={() => setActionsAnchor(null)}>
              <MenuItem onClick={() => { setActionsAnchor(null); drawer.openTenantEditDrawer(renter); }}><EditOutlined style={{ marginRight: 10 }} />Edit renter</MenuItem>
              {!portalConnected && renterEmail && <MenuItem disabled={sendingInvite} onClick={() => { setActionsAnchor(null); sendInvite(); }}><SendOutlined style={{ marginRight: 10 }} />{sendingInvite ? 'Sending invite…' : 'Invite to portal'}</MenuItem>}
            </Menu>
            <Divider />
            <Tabs value={RENTER_PROFILE_TABS.indexOf(activeTab)} onChange={changeTab} variant="scrollable" scrollButtons="auto" aria-label="Renter profile sections" sx={{ px: { xs: 1, md: 2 }, minHeight: 52, '& .MuiTab-root': { minHeight: 52, textTransform: 'none', fontWeight: 750 } }}>
              {RENTER_PROFILE_TABS.map((key) => <Tab key={key} label={TAB_LABELS[key]} id={`renter-tab-${key}`} aria-controls={`renter-panel-${key}`} />)}
            </Tabs>
            <Divider />
            <Box id={`renter-panel-${activeTab}`} role="tabpanel" aria-labelledby={`renter-tab-${activeTab}`} sx={{ px: { xs: 2, md: 2.5 }, pb: 2.5 }}>{renderActivePanel()}</Box>
          </Paper>
        </Grid>
      </Grid>

      <ConfirmationDialog
        open={Boolean(removeLease)}
        onClose={() => setRemoveLease(null)}
        onConfirm={async () => {
          if (!removeLease) return;
          try {
            setRemoving(true);
            await removeTenantFromLease(recordId(removeLease), numericRenterId);
            setLeases((items) => items.filter((item) => recordId(item) !== recordId(removeLease)));
            setRemoveLease(null);
            propertiesRefetch();
            openSnackbar({ open: true, message: 'Renter removed from lease.', variant: 'alert', alert: { color: 'success' } });
          } catch (error) {
            openSnackbar({ open: true, message: error?.response?.data?.message || 'Unable to remove renter from lease.', variant: 'alert', alert: { color: 'error' } });
          } finally { setRemoving(false); }
        }}
        title="Remove renter from lease?"
        message={`Remove ${fullName} from this lease? The renter profile and historical documents will be preserved.`}
        confirmText={removing ? 'Removing…' : 'Remove from lease'}
        confirmColor="error"
      />
      <TenantEditDrawer onUpdateSuccess={fetchRenter} />
      <TenantMessageDrawer
        open={messageOpen}
        onClose={() => setMessageOpen(false)}
        tenant={renter}
        property={properties.find((item) => Number(recordId(item)) === Number(read(activeLease, 'propertyId', 'PropertyId'))) || null}
      />
    </Box>
  );
}
