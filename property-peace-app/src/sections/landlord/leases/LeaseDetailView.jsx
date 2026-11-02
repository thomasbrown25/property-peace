import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  alpha, Avatar, Box, Button, Checkbox, Dialog, DialogActions, DialogContent,
  DialogContentText, DialogTitle, Divider, IconButton, LinearProgress,
  FormControlLabel, Menu, MenuItem, Stack, Tab, Tabs, TextField, Typography, useTheme,
  FormControl, InputLabel, Select, Table, TableBody, TableCell, TableContainer, TableHead, TableRow, TablePagination
} from '@mui/material';
import {
  CheckOutlined, DollarOutlined, EditOutlined, EllipsisOutlined,
  FileTextOutlined, PlusOutlined,
  StopOutlined, UploadOutlined, ArrowRightOutlined,
  MailOutlined, PhoneOutlined, DeleteOutlined, CalendarOutlined,
  SearchOutlined, UserOutlined, ThunderboltOutlined
} from '@ant-design/icons';
import PaymentEditDrawer from 'components/drawers/PaymentEditDrawer';
import TenantMessageDrawer from 'components/drawers/TenantMessageDrawer';
import { openSnackbar } from 'api/snackbar';
import { modeLabel } from 'utils/rentalMode';
import axios from 'utils/axios';
import { format } from 'date-fns';
import { formatCurrency, formatPhoneInput } from 'utils/formatters';
import { buildLeasePaymentTimeline } from 'utils/leasePaymentTimeline';
import { getLeaseHeaderBalance } from 'utils/leaseHeaderSummary';
import { buildDocumentRows, filterDocumentRows, paginateDocumentRows } from './leaseDocumentTable.mjs';
import { leaseDetailTitle } from 'utils/leaseDetailTitle.mjs';
import { renterProfileRoute } from 'utils/renterWorkspace';
import LeaseChargesTab from './LeaseChargesTab';
import { buildLeaseChecklistCards, sortLeaseChecklistSteps } from 'utils/leaseMoveIn';

const detailCardSx = {
  p: 2,
  borderRadius: 2,
  bgcolor: 'background.paper',
  border: '1px solid',
  borderColor: (t) => alpha(t.palette.divider, t.palette.mode === 'dark' ? 0.22 : 0.14),
  boxShadow: (t) =>
    t.palette.mode === 'dark'
      ? `0 16px 36px ${alpha(t.palette.common.black, 0.22)}, inset 0 1px 0 ${alpha(t.palette.common.white, 0.04)}`
      : 'none'
};

const detailHeaderSx = {
  fontWeight: 700,
  letterSpacing: 0.8,
  color: 'text.secondary',
  textTransform: 'uppercase'
};

const subtleDivider = (theme, darkAlpha = 0.22, lightAlpha = 0.12) => alpha(theme.palette.divider, theme.palette.mode === 'dark' ? darkAlpha : lightAlpha);





function LeaseMoveInCard({
  readiness,
  lease,
  checklists,
  hasAgreement,
  eSignatureReadiness,
  onAssignTenants,
  onViewTenants,
  onBuildAgreement,
  onViewAgreement,
  onOpenSignature,
  onViewChecklists
}) {
  const theme = useTheme();
  if (!readiness) return null;
  const checklist = buildLeaseChecklistCards({ readiness, lease, checklists });

  const actions = {
    tenants: { label: 'Assign tenants', onClick: onAssignTenants },
    agreement: { label: hasAgreement ? 'View agreement' : 'Build agreement', onClick: hasAgreement ? onViewAgreement : onBuildAgreement },
    signatures: { label: 'Open signatures', onClick: onOpenSignature, disabled: !eSignatureReadiness?.canInvoke },
    checklist: { label: 'View checklists', onClick: () => onViewChecklists('move-in') },
    'move-out': { label: 'View checklists', onClick: () => onViewChecklists('move-out') }
  };

  return (
    <Box sx={{ ...detailCardSx, mb: 2, p: { xs: 2, md: 2.5 } }}>
      <Stack direction={{ xs: 'column', sm: 'row' }} justifyContent="space-between" spacing={1.5} sx={{ mb: 2 }}>
        <Box>
          <Typography sx={{ ...detailHeaderSx, fontSize: '0.7rem', color: 'primary.main', mb: 0.4 }}>
            Lease checklist
          </Typography>
          <Typography sx={{ fontSize: '1rem', fontWeight: 750 }}>
            {checklist.completed} of {checklist.totalTrackable} steps complete
          </Typography>
          <Typography sx={{ fontSize: '0.7rem', color: 'text.secondary', mt: 0.25 }}>
            Based on saved lease, signature, and checklist records.
          </Typography>
        </Box>
      </Stack>

      <LinearProgress
        variant="determinate"
        value={checklist.progress}
        color="success"
        sx={{ height: 7, borderRadius: 4, mb: 2.25, bgcolor: alpha(theme.palette.success.main, 0.12) }}
      />

      <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', sm: 'repeat(2, minmax(0, 1fr))', lg: 'repeat(4, minmax(0, 1fr))' }, gap: 1 }}>
        {sortLeaseChecklistSteps(checklist.steps).map((step) => {
          const action = step.key === 'tenants' && step.status === 'complete'
            ? { label: 'View tenants', onClick: onViewTenants }
            : actions[step.key];
          const complete = step.status === 'complete';
          const unavailable = step.status === 'unavailable';
          const color = complete ? theme.palette.success.main : unavailable ? theme.palette.text.disabled : theme.palette.warning.main;
          const cardAction = (step.key === 'checklist' || step.key === 'move-out') ? action?.onClick : null;
          return (
            <Box
              key={step.key}
              role={cardAction ? 'button' : undefined}
              tabIndex={cardAction ? 0 : undefined}
              aria-label={cardAction ? `${step.label}. ${action.label}` : undefined}
              onClick={cardAction}
              onKeyDown={(event) => {
                if (cardAction && event.target === event.currentTarget && (event.key === 'Enter' || event.key === ' ')) {
                  event.preventDefault();
                  cardAction();
                }
              }}
              sx={{ p: 1.35, borderRadius: 1.75, border: `1px solid ${alpha(color, 0.3)}`, bgcolor: alpha(color, unavailable ? 0.025 : 0.055), minWidth: 0, cursor: cardAction ? 'pointer' : 'default', '&:focus-visible': cardAction ? { outline: `2px solid ${theme.palette.primary.main}`, outlineOffset: 2 } : undefined }}
            >
              <Stack direction="row" spacing={1} alignItems="flex-start">
                <Box sx={{ width: 22, height: 22, borderRadius: '50%', flexShrink: 0, mt: 0.1, bgcolor: complete ? color : 'transparent', border: `1.5px solid ${color}`, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  {complete ? <CheckOutlined style={{ color: '#fff', fontSize: 10 }} /> : <Box sx={{ width: 5, height: 5, borderRadius: '50%', bgcolor: color }} />}
                </Box>
                <Box sx={{ minWidth: 0, flex: 1 }}>
                  <Typography sx={{ fontSize: '0.75rem', fontWeight: 700 }}>{step.label}</Typography>
                  <Typography sx={{ fontSize: '0.64rem', color: unavailable ? 'text.disabled' : 'text.secondary', lineHeight: 1.4, minHeight: 18 }}>
                    {step.detail}
                  </Typography>
                  {action?.onClick && !(step.key === 'signatures' && complete) && (
                    <Button size="small" disabled={action.disabled} onClick={(event) => { event.stopPropagation(); action.onClick(); }} sx={{ mt: 0.45, p: 0, minWidth: 0, textTransform: 'none', fontSize: '0.66rem', fontWeight: 700 }}>
                      {action.label} →
                    </Button>
                  )}
                </Box>
              </Stack>
            </Box>
          );
        })}
      </Box>
    </Box>
  );
}

// ─── Section card ─────────────────────────────────────────────────────────────

function SectionCard({ title, action, children, sx }) {
  return (
    <Box sx={{ ...detailCardSx, ...sx }}>
      {(title || action) && (
        <Stack direction="row" alignItems="center" justifyContent="space-between" sx={{ mb: 1.5 }}>
          {title && (
            <Typography sx={{ ...detailHeaderSx, fontSize: '0.62rem' }}>
              {title}
            </Typography>
          )}
          {action}
        </Stack>
      )}
      {children}
    </Box>
  );
}

// ─── Tenants card ─────────────────────────────────────────────────────────────

function TenantRow({ role, name, email, phone, initials, onMessage, onViewProfile, showMessage = true }) {
  const theme = useTheme();
  return (
    <Box sx={{ border: (t) => `1.5px dashed ${subtleDivider(t, 0.26, 0.18)}`, borderRadius: 2, p: 1.75 }}>
      <Stack direction="row" alignItems="flex-start" spacing={1.5}>
        <Avatar sx={{
          width: 40, height: 40, flexShrink: 0,
          bgcolor: 'transparent',
          border: (t) => `1.5px dashed ${subtleDivider(t, 0.34, 0.28)}`,
          color: 'text.primary',
          fontSize: '0.78rem', fontWeight: 700
        }}>
          {initials}
        </Avatar>

        <Box sx={{ flex: 1, minWidth: 0 }}>
          <Stack direction="row" alignItems="flex-start" justifyContent="space-between" spacing={1}>
            <Box sx={{ minWidth: 0 }}>
              <Typography sx={{ ...detailHeaderSx, fontSize: '0.58rem', mb: 0.2 }}>
                {role}
              </Typography>
              <Typography sx={{ fontSize: '0.95rem', fontWeight: 700, lineHeight: 1.25, mb: 0.5 }}>
                {name}
              </Typography>
              {email && (
                <Stack direction="row" alignItems="center" spacing={0.5} sx={{ mb: 0.2 }}>
                  <MailOutlined style={{ fontSize: 10, color: theme.palette.text.disabled }} />
                  <Typography sx={{ fontSize: '0.68rem', color: 'text.secondary' }} noWrap>{email}</Typography>
                </Stack>
              )}
              {phone && (
                <Stack direction="row" alignItems="center" spacing={0.5}>
                  <PhoneOutlined style={{ fontSize: 10, color: theme.palette.text.disabled }} />
                  <Typography sx={{ fontSize: '0.68rem', color: 'text.secondary' }}>{formatPhoneInput(phone)}</Typography>
                </Stack>
              )}
            </Box>

            <Stack direction={{ xs: 'column', sm: 'row' }} alignItems={{ xs: 'flex-end', sm: 'center' }} spacing={0.75} flexShrink={0}>
              <Button
                size="small"
                variant="outlined"
                onClick={onViewProfile}
                sx={{ px: 1.4, py: 0.3, fontSize: '0.7rem', fontWeight: 650, textTransform: 'none', minWidth: 0 }}
              >
                View profile
              </Button>
              {showMessage && <Button
                size="small"
                onClick={onMessage}
                sx={{
                  px: 1.75, py: 0.35,
                  bgcolor: 'primary.main', color: 'background.paper',
                  fontSize: '0.7rem', fontWeight: 600, textTransform: 'none', minWidth: 0,
                  '&:hover': { bgcolor: 'primary.main', opacity: 0.85 }
                }}
              >
                Message
              </Button>}
            </Stack>
          </Stack>
        </Box>
      </Stack>
    </Box>
  );
}

function TenantsCard({ tenants, property, onAddTenant, onViewProfile }) {
  const theme = useTheme();
  const [messageTenant, setMessageTenant] = useState(null);
  const activeTenants = (tenants || []).filter((tenant) => {
    const isDeleted = tenant.isDeleted ?? tenant.IsDeleted ?? false;
    const isActive = tenant.isActive ?? tenant.IsActive ?? true;
    return !isDeleted && isActive !== false;
  });
  const additionalCount = Math.max(0, activeTenants.length - 1);

  return (
    <Box sx={detailCardSx}>
      <Stack spacing={1.25}>
        {activeTenants.map((tenant) => {
          const first = tenant.firstname || tenant.Firstname || '';
          const last  = tenant.lastname  || tenant.Lastname || '';
          const name  = [first, last].filter(Boolean).join(' ') || 'Tenant';
          const initials = `${first?.[0] || ''}${last?.[0] || ''}`.toUpperCase() || 'T';
          return (
            <TenantRow
              key={tenant.id || tenant.Id}
              role="TENANT"
              name={name}
              email={tenant.email || tenant.Email || ''}
              phone={tenant.phoneNumber || tenant.PhoneNumber || ''}
              initials={initials}
              onMessage={() => setMessageTenant(tenant)}
              onViewProfile={() => onViewProfile?.(tenant)}
            />
          );
        })}

        {activeTenants.length === 0 && (
          <Typography sx={{ fontSize: '0.75rem', color: 'text.secondary' }}>
            No active tenants assigned to this lease.
          </Typography>
        )}

        {/* Add tenant */}
        <Box
          onClick={() => onAddTenant?.()}
          sx={{
            border: (t) => `1.5px dashed ${subtleDivider(t, 0.26, 0.18)}`, borderRadius: 2,
            px: 2, py: 1.25, cursor: 'pointer',
            display: 'flex', alignItems: 'center', justifyContent: 'space-between',
            transition: 'background-color 0.15s',
            '&:hover': { bgcolor: (t) => alpha(t.palette.primary.main, t.palette.mode === 'dark' ? 0.08 : 0.03) }
          }}
        >
          <Box>
            <Typography sx={{ fontSize: '0.78rem', fontWeight: 600, color: 'text.secondary' }}>
              + Add tenant or co-signer
            </Typography>
            <Typography sx={{ fontSize: '0.65rem', color: 'text.disabled', mt: 0.15 }}>
              {additionalCount} additional {additionalCount === 1 ? 'person' : 'people'} on this lease
            </Typography>
          </Box>
          <Box sx={{ width: 24, height: 24, borderRadius: '50%', border: (t) => `1px solid ${subtleDivider(t, 0.34, 0.24)}`, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <PlusOutlined style={{ fontSize: 11, color: theme.palette.text.secondary }} />
          </Box>
        </Box>
      </Stack>
      <TenantMessageDrawer
        open={!!messageTenant}
        onClose={() => setMessageTenant(null)}
        tenant={messageTenant}
        property={property}
      />
    </Box>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────

export default function LeaseDetailView({
  lease, tenants, property, payments, deposits, rentRecord,
  propertyDisplay, unitDisplay, isDraftLease, isNotStarted, leaseId,
  dashboardSummary, user, leaseDocuments, leaseAgreement, moveInReadiness, leaseChecklists, eSignatureReadiness,
  handleEndLeaseClick, handleReopenLeaseClick,
  onRecordPayment, onViewAgreement, onUploadDocument, onEditTerms,
  onAddTenant, onOpenSignature,
  onViewChecklists, onPaymentUpdated, propertiesRefetch,
}) {
  const theme = useTheme();
  const navigate = useNavigate();
  const [leaseActionsAnchor, setLeaseActionsAnchor] = useState(null);
  const [deleteLeaseOpen, setDeleteLeaseOpen] = useState(false);
  const [deleteDocuments, setDeleteDocuments] = useState(true);
  const [deleteChecklists, setDeleteChecklists] = useState(true);
  const [deletingLease, setDeletingLease] = useState(false);
  const [paymentActionsAnchor, setPaymentActionsAnchor] = useState(null);
  const [selectedPayment, setSelectedPayment] = useState(null);
  const [paymentEditOpen, setPaymentEditOpen] = useState(false);
  const [deletePaymentOpen, setDeletePaymentOpen] = useState(false);
  const [deletingPayment, setDeletingPayment] = useState(false);
  const [activeTab, setActiveTab] = useState(0);
  const [paymentSearch, setPaymentSearch] = useState('');
  const [paymentFromDate, setPaymentFromDate] = useState('');
  const [paymentToDate, setPaymentToDate] = useState('');
  const [documentSearch, setDocumentSearch] = useState('');
  const [documentTypeFilter, setDocumentTypeFilter] = useState('all');
  const [documentVisibilityFilter, setDocumentVisibilityFilter] = useState('all');
  const [documentPage, setDocumentPage] = useState(0);
  const [documentRowsPerPage, setDocumentRowsPerPage] = useState(10);

  // ─── Computed ──────────────────────────────────────────────────────────────
  const primaryTenant = tenants[0];
  const tenantFullName = [
    primaryTenant?.firstname || primaryTenant?.Firstname,
    primaryTenant?.lastname  || primaryTenant?.Lastname,
  ].filter(Boolean).join(' ');

  const startDateValue = lease.startDate ?? lease.StartDate;
  const endDateValue = lease.endDate ?? lease.EndDate;
  const startDate = startDateValue ? new Date(startDateValue) : null;
  const endDate = endDateValue ? new Date(endDateValue) : null;
  const now = new Date();


  const daysUntilEnd = useMemo(() => {
    if (!endDate) return null;
    return Math.max(0, Math.floor((endDate - now) / 86400000));
  }, [endDate, now]);

  const hasLeaseAgreementDocument = !!(
    leaseAgreement?.blobUrl ||
    leaseAgreement?.BlobUrl ||
    leaseAgreement?.blobName ||
    leaseAgreement?.BlobName
  );

  const leaseAgreementSetupUrl = useMemo(() => {
    const params = new URLSearchParams();
    const resolvedLeaseId = lease?.id ?? lease?.Id ?? leaseId;
    const resolvedPropertyId = property?.id ?? property?.Id ?? lease?.propertyId ?? lease?.PropertyId ?? lease?.unit?.propertyId ?? lease?.unit?.PropertyId;
    const resolvedUnitId = lease?.unit?.id ?? lease?.unit?.Id ?? lease?.unitId ?? lease?.UnitId;

    if (resolvedLeaseId) params.set('leaseId', resolvedLeaseId);
    if (resolvedPropertyId) params.set('propertyId', resolvedPropertyId);
    if (resolvedUnitId) params.set('unitId', resolvedUnitId);

    const query = params.toString();
    return `/landlord/leases/build-lease-agreement${query ? `?${query}` : ''}`;
  }, [lease, leaseId, property]);

  const openDeleteLease = () => {
    setDeleteDocuments(true);
    setDeleteChecklists(true);
    setDeleteLeaseOpen(true);
  };

  const confirmDeleteLease = async () => {
    const id = lease?.id ?? lease?.Id ?? leaseId;
    if (!id || deletingLease) return;
    setDeletingLease(true);
    try {
      // DELETE /api/Lease/:id binds cleanup options from query, not from a DELETE body.
      const response = await axios.delete(`/api/Lease/${id}`, {
        params: { deleteLeaseDocuments: deleteDocuments, deleteChecklists }
      });
      if (response.data?.success === false || response.data?.Success === false) {
        throw new Error(response.data?.message ?? response.data?.Message ?? 'Could not archive lease');
      }
      setDeleteLeaseOpen(false);
      // A refresh error must not misreport a completed archive as a failed deletion.
      try { await propertiesRefetch?.(); } catch (refreshError) { console.warn('Could not refresh leases after archive:', refreshError); }
      openSnackbar({ open: true, message: 'Lease archived and hidden from the lease list.', variant: 'alert', alert: { color: 'success' } });
      navigate('/landlord/leases');
    } catch (error) {
      openSnackbar({ open: true, message: error?.message || 'Could not archive lease. Please try again.', variant: 'alert', alert: { color: 'error' } });
    } finally {
      setDeletingLease(false);
    }
  };

  const handlePaymentActionsClick = (event, payment) => {
    setPaymentActionsAnchor(event.currentTarget);
    setSelectedPayment(payment);
  };

  const handlePaymentActionsClose = () => {
    setPaymentActionsAnchor(null);
  };

  const handlePaymentEdit = () => {
    setPaymentEditOpen(true);
    handlePaymentActionsClose();
  };

  const handlePaymentDelete = () => {
    setDeletePaymentOpen(true);
    handlePaymentActionsClose();
  };

  const handlePaymentEditClose = () => {
    setPaymentEditOpen(false);
    setSelectedPayment(null);
  };

  const handlePaymentDeleteCancel = () => {
    setDeletePaymentOpen(false);
    setSelectedPayment(null);
  };

  const handlePaymentUpdateSuccess = () => {
    onPaymentUpdated?.();
  };

  const handlePaymentDeleteConfirm = async () => {
    const paymentId = selectedPayment?.id ?? selectedPayment?.Id;
    if (!paymentId) return;

    try {
      setDeletingPayment(true);
      await axios.delete(`/api/payment/${paymentId}`);
      openSnackbar({
        open: true,
        message: 'Payment deleted successfully.',
        variant: 'alert',
        alert: { color: 'success' }
      });
      handlePaymentDeleteCancel();
      onPaymentUpdated?.();
    } catch (error) {
      openSnackbar({
        open: true,
        message: error?.response?.data?.message || error?.response?.data?.Message || error?.response?.data || 'Failed to delete payment.',
        variant: 'alert',
        alert: { color: 'error' }
      });
    } finally {
      setDeletingPayment(false);
    }
  };

  const rentAmount    = lease.rentAmount    || lease.RentAmount    || 0;
  const depositAmount = lease.depositAmount || lease.DepositAmount || 0;

  const paymentTimeline = useMemo(
    () => buildLeasePaymentTimeline(lease, payments, now, isDraftLease),
    [lease, payments, isDraftLease]
  );
  const paidCycles = paymentTimeline.filter(cycle => cycle.status === 'on-time' || cycle.status === 'late').length;
  const paidLateCycles = paymentTimeline.filter(cycle => cycle.status === 'late').length;
  const overdueCycles = paymentTimeline.filter(cycle => cycle.status === 'overdue').length;
  const lateCycles = paidLateCycles + overdueCycles;
  const headerBalance = getLeaseHeaderBalance(rentRecord, lease.balanceDue ?? lease.BalanceDue, isDraftLease);

  // Lease health
  const maintenanceRequests = useMemo(() => {
    const all = dashboardSummary?.maintenanceRequests?.maintenanceRequests || [];
    const pid = lease?.unit?.propertyId || property?.id;
    return all.filter(r => !pid || (r.propertyId || r.PropertyId) === pid);
  }, [dashboardSummary, lease, property]);

  const minorIssues = maintenanceRequests.filter(r =>
    !['completed', 'cancelled'].includes((r.status || '').toLowerCase())
  ).length;

  const evaluatedCycles = paidCycles + overdueCycles;
  const lateCycleRate = evaluatedCycles > 0 ? lateCycles / evaluatedCycles : 0;
  const highLateRisk = lateCycles >= 2 && lateCycleRate >= 0.5;
  const highIssueRisk = minorIssues >= 4;

  const healthLabel =
    highLateRisk || highIssueRisk ? 'At Risk' :
    lateCycles === 0 && minorIssues === 0 ? 'Good' :
    'Medium Risk';
  const healthColor = healthLabel === 'Good' ? '#41a541' : healthLabel === 'Medium Risk' ? '#d97706' : '#dc2626';
  const summaryColor = isDraftLease ? '#d97706' : healthColor;
  const renewalGuidance = healthLabel === 'At Risk'
    ? 'review before renewal'
    : daysUntilEnd !== null && daysUntilEnd <= 90 ? 'renewal window open' : 'renewal recommended';

  // Activity timeline
  const activityItems = useMemo(() => {
    const items = [];
    (payments || []).forEach(p => {
      const amt  = parseFloat(p.amount || p.Amount) || 0;
      const date = new Date(p.paymentDate || p.PaymentDate);
      const type = (p.type || p.Type || '').toLowerCase();
      items.push({
        date,
        label: type === 'deposit' ? 'Deposit received' : `${tenantFullName || 'Tenant'} paid ${formatCurrency(amt)}`,
        sub: type === 'deposit' ? `${formatCurrency(amt)} · deposit` : `${format(date, 'MMM d')} · on time · auto-payment`,
        amount: `+${formatCurrency(amt)}`,
        payment: p,
        dot: true
      });
    });
    if (lease.landlordSignedAt) {
      items.push({
        date: new Date(lease.landlordSignedAt),
        label: 'Lease signed by both parties',
        sub: `DocuSign · signed at ${format(new Date(lease.landlordSignedAt), 'h:mma')}`,
        amount: null, dot: false
      });
    }
    return items.sort((a, b) => b.date - a.date).slice(0, 8);
  }, [payments, lease.landlordSignedAt, tenantFullName]);

  const docs = useMemo(() => buildDocumentRows(leaseDocuments, hasLeaseAgreementDocument), [leaseDocuments, hasLeaseAgreementDocument]);
  const documentTypes = useMemo(() => [...new Set(docs.map((doc) => doc.type))].sort(), [docs]);
  const filteredDocuments = useMemo(
    () => filterDocumentRows(docs, { search: documentSearch, type: documentTypeFilter, visibility: documentVisibilityFilter }),
    [docs, documentSearch, documentTypeFilter, documentVisibilityFilter]
  );
  const documentPagination = useMemo(
    () => paginateDocumentRows(filteredDocuments, documentPage, documentRowsPerPage),
    [filteredDocuments, documentPage, documentRowsPerPage]
  );

  const filteredPayments = useMemo(() => {
    const query = paymentSearch.trim().toLowerCase();
    const from = paymentFromDate ? new Date(`${paymentFromDate}T00:00:00`) : null;
    const to = paymentToDate ? new Date(`${paymentToDate}T23:59:59.999`) : null;

    return [...(payments || [])]
      .filter((payment) => {
        const paymentDateValue = payment.paymentDate ?? payment.PaymentDate;
        const paymentDate = paymentDateValue ? new Date(paymentDateValue) : null;
        if (from && (!paymentDate || paymentDate < from)) return false;
        if (to && (!paymentDate || paymentDate > to)) return false;

        if (!query) return true;
        const searchable = [
          payment.type ?? payment.Type,
          payment.reference ?? payment.Reference,
          payment.description ?? payment.Description,
          payment.notes ?? payment.Notes,
          payment.amount ?? payment.Amount,
          tenantFullName
        ].filter((value) => value != null).join(' ').toLowerCase();
        return searchable.includes(query);
      })
      .sort((a, b) => new Date(b.paymentDate ?? b.PaymentDate ?? 0) - new Date(a.paymentDate ?? a.PaymentDate ?? 0));
  }, [paymentFromDate, paymentSearch, paymentToDate, payments, tenantFullName]);



  const handleViewTenantProfile = (tenant) => {
    const tenantId = tenant?.id ?? tenant?.Id;
    const route = renterProfileRoute(tenantId);
    if (route) navigate(route);
  };

  return (
    <Box>
      {/* ── Lease header ─────────────────────────────────────────────────── */}
      <Box
        sx={{
          mb: 2,
          borderRadius: 2.5,
          bgcolor: 'background.paper',
          border: '1px solid',
          borderColor: (t) => alpha(t.palette.divider, t.palette.mode === 'dark' ? 0.28 : 0.16),
          overflow: 'hidden',
          position: 'relative',
          boxShadow: (t) => t.palette.mode === 'dark'
            ? `0 18px 40px ${alpha(t.palette.common.black, 0.2)}`
            : `0 14px 34px ${alpha('#061e35', 0.08)}`,
          '&::before': {
            content: '""',
            position: 'absolute',
            inset: '0 auto 0 0',
            width: 4,
            bgcolor: '#41a541'
          }
        }}
      >
        <Stack
          direction={{ xs: 'column', md: 'row' }}
          alignItems={{ md: 'flex-start' }}
          justifyContent="space-between"
          spacing={2.5}
          sx={{ p: { xs: 2.25, sm: 2.75, md: 3 }, position: 'relative' }}
        >
          <Stack direction="row" spacing={{ xs: 1.5, sm: 2 }} sx={{ flex: 1, minWidth: 0 }}>
            <Box
              sx={{
                width: { xs: 42, sm: 48 },
                height: { xs: 42, sm: 48 },
                borderRadius: 2,
                flexShrink: 0,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: '#061e35',
                bgcolor: alpha('#41a541', 0.12),
                border: `1px solid ${alpha('#41a541', 0.24)}`
              }}
            >
              <FileTextOutlined style={{ fontSize: 21 }} />
            </Box>
            <Box sx={{ flex: 1, minWidth: 0 }}>
              <Typography
                variant="h3"
                sx={{
                  color: theme.palette.mode === 'dark' ? 'text.primary' : '#061e35',
                  fontSize: { xs: '1.75rem', sm: '2.25rem' },
                  fontWeight: 750,
                  lineHeight: 1.12,
                  mb: 0.65
                }}
              >
                {leaseDetailTitle(lease, propertyDisplay, leaseId)}
              </Typography>
              <Typography variant="body2" sx={{ color: 'text.secondary', maxWidth: 650 }}>
                {unitDisplay ? `${unitDisplay} · ` : ''}{modeLabel(lease?.unit ?? lease?.Unit)} lease
              </Typography>
              {isDraftLease && (
                <Typography variant="body2" sx={{ color: 'text.secondary', maxWidth: 650, mt: 0.5 }}>
                  This lease is saved as a draft and has not started. Review the terms and complete the agreement when you are ready.
                </Typography>
              )}
            </Box>
          </Stack>
          <Box sx={{ flexShrink: 0, alignSelf: { xs: 'flex-end', md: 'flex-start' } }}>
            <Button
              variant="outlined"
              startIcon={<ThunderboltOutlined style={{ fontSize: 13 }} />}
              aria-label="Lease actions"
              aria-controls={leaseActionsAnchor ? 'lease-actions-menu' : undefined}
              aria-haspopup="menu"
              aria-expanded={Boolean(leaseActionsAnchor)}
              onClick={(event) => setLeaseActionsAnchor(event.currentTarget)}
              sx={{ textTransform: 'none', fontWeight: 600, borderRadius: 1.5, px: 3, fontSize: '0.875rem', whiteSpace: 'nowrap', borderColor: theme.palette.mode === 'dark' ? alpha('#cbd5e1', 0.16) : alpha(theme.palette.divider, 0.24) }}
            >
              Actions
            </Button>
            <Menu
              id="lease-actions-menu"
              anchorEl={leaseActionsAnchor}
              open={Boolean(leaseActionsAnchor)}
              onClose={() => setLeaseActionsAnchor(null)}
              anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
              transformOrigin={{ vertical: 'top', horizontal: 'right' }}
            >
              {!isDraftLease && (
                <MenuItem onClick={() => { setLeaseActionsAnchor(null); onUploadDocument?.(); }}>
                  <FileTextOutlined style={{ marginRight: 12 }} /> Upload document
                </MenuItem>
              )}
              {!isDraftLease && (lease?.isActive || isNotStarted) && (
                <MenuItem onClick={() => { setLeaseActionsAnchor(null); onRecordPayment?.(); }}>
                  <DollarOutlined style={{ marginRight: 12 }} /> Record payment
                </MenuItem>
              )}
              <MenuItem onClick={() => { setLeaseActionsAnchor(null); onEditTerms?.(); }}>
                <EditOutlined style={{ marginRight: 12 }} /> Edit lease
              </MenuItem>
              {!isDraftLease && (
                <MenuItem onClick={() => { setLeaseActionsAnchor(null); (lease?.isActive ? handleEndLeaseClick : handleReopenLeaseClick)?.(); }}>
                  <StopOutlined style={{ marginRight: 12 }} /> {lease?.isActive ? 'End lease early' : 'Reopen lease'}
                </MenuItem>
              )}
              <Divider />
              <MenuItem onClick={() => { setLeaseActionsAnchor(null); openDeleteLease(); }} sx={{ color: 'error.main' }}>
                <DeleteOutlined style={{ marginRight: 12 }} /> Delete
              </MenuItem>
            </Menu>
          </Box>
        </Stack>
        <Box
          sx={{
            display: 'grid',
            gridTemplateColumns: { xs: '1fr 1fr', sm: 'repeat(4, minmax(0, 1fr))' },
            borderTop: '1px solid',
            borderColor: (t) => alpha(t.palette.divider, t.palette.mode === 'dark' ? 0.26 : 0.13),
            bgcolor: (t) => alpha(t.palette.primary.main, t.palette.mode === 'dark' ? 0.035 : 0.018)
          }}
        >
          {[
            { label: 'Start date - End date', value: `${startDate ? format(startDate, 'MMM d, yyyy') : 'Not set'} - ${endDate ? format(endDate, 'MMM d, yyyy') : 'Not set'}`, icon: <CalendarOutlined /> },
            { label: 'Monthly rent', value: rentAmount > 0 ? formatCurrency(rentAmount) : 'Not set', icon: <DollarOutlined /> },
            { label: 'Amount due', value: formatCurrency(headerBalance.amountDue), overdueAmount: headerBalance.overdueAmount, icon: <DollarOutlined /> },
            { label: 'Tenant', value: tenantFullName || 'Not assigned', icon: <UserOutlined /> },
          ].map((item) => (
            <Box
              key={item.label}
              sx={{
                px: { xs: 2, md: 2.5 },
                py: 1.65,
                minWidth: 0,
                borderRight: '1px solid',
                borderBottom: { xs: '1px solid', sm: 'none' },
                borderColor: (t) => alpha(t.palette.divider, t.palette.mode === 'dark' ? 0.26 : 0.13),
                '&:nth-of-type(2n)': { borderRight: { xs: 'none', sm: '1px solid' } },
                '&:nth-of-type(n+3)': { borderBottom: 'none' },
                '&:last-of-type': { borderRight: 'none' }
              }}
            >
              <Stack direction="row" alignItems="center" spacing={0.75} sx={{ color: 'text.secondary', mb: 0.45 }}>
                {item.icon}
                <Typography sx={{ fontSize: '0.62rem', fontWeight: 700, letterSpacing: 0.65, textTransform: 'uppercase', color: 'inherit' }}>{item.label}</Typography>
              </Stack>
              <Stack direction="row" alignItems="baseline" flexWrap="wrap" columnGap={0.75} rowGap={0.1}>
                <Typography sx={{ color: item.label === 'Amount due' ? '#061E35' : 'text.primary', fontWeight: 700, fontSize: '0.85rem' }}>{item.value}</Typography>
                {item.overdueAmount > 0 && (
                  <Typography sx={{ color: 'error.main', fontWeight: 650, fontSize: '0.72rem' }}>
                    {formatCurrency(item.overdueAmount)} overdue
                  </Typography>
                )}
              </Stack>
            </Box>
          ))}
        </Box>
      </Box>

      {isDraftLease && (
        <Box sx={{ mb: 2, p: { xs: 2, md: 2.25 }, borderRadius: 2.5, bgcolor: '#fffbeb', border: '1px solid #fde68a', borderLeft: '4px solid #f59e0b' }}>
          <Stack direction={{ xs: 'column', md: 'row' }} alignItems={{ md: 'center' }} justifyContent="space-between" spacing={2}>
            <Box>
              <Typography sx={{ fontWeight: 750, color: '#78350f', mb: 0.35 }}>Draft lease — not started</Typography>
              <Typography sx={{ fontSize: '0.78rem', color: '#92400e', maxWidth: 720 }}>
                Drafts do not collect rent or count as active occupancy. Add the start date, rent, tenants, and agreement before starting this lease.
              </Typography>
            </Box>
            <Stack direction="row" spacing={1} flexShrink={0}>
              <Button variant="outlined" size="small" onClick={() => navigate(leaseAgreementSetupUrl)} sx={{ textTransform: 'none', fontWeight: 650, borderColor: '#d97706', color: '#92400e' }}>
                Create agreement
              </Button>
              <Button variant="contained" color="success" size="small" startIcon={<EditOutlined />} onClick={onEditTerms} sx={{ textTransform: 'none', fontWeight: 700, boxShadow: 'none', '&:hover': { boxShadow: 'none' } }}>
                Edit lease details
              </Button>
            </Stack>
          </Stack>
        </Box>
      )}
      <Box
        sx={{
          mb: 2,
          borderBottom: '1px solid',
          borderColor: (t) => subtleDivider(t, 0.24, 0.14),
          overflowX: 'auto'
        }}
      >
        <Tabs
          value={activeTab}
          onChange={(_, value) => setActiveTab(value)}
          aria-label="Lease detail sections"
          variant="scrollable"
          scrollButtons="auto"
          sx={{
            minHeight: 44,
            '& .MuiTab-root': { minHeight: 44, px: { xs: 1.75, sm: 2.5 }, textTransform: 'none', fontWeight: 650 },
            '& .MuiTabs-indicator': { height: 3, borderRadius: '3px 3px 0 0' }
          }}
        >
          <Tab label="Overview" />
          <Tab label="Tenants" />
          <Tab label="Payments" />
          <Tab label="Documents" />
          <Tab label="Insurance" />
          <Tab label="Utilities" />
          <Tab label="Charges" />
        </Tabs>
      </Box>

      {activeTab === 0 && (
        <Stack spacing={2}>
          <SectionCard title="Rent payment history">
            {paymentTimeline.length ? (
              <>
                <Typography sx={{ fontSize: '0.72rem', color: 'text.secondary', mb: 1.5 }}>
                  Full lease term · Each tile represents a scheduled rent payment. On time includes the lease grace period.
                </Typography>
                <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(78px, 1fr))', gap: 1 }}>
                  {paymentTimeline.map((cycle) => {
                    const tone = cycle.status === 'on-time' ? 'success' : cycle.status === 'late' ? 'warning' : cycle.status === 'overdue' ? 'error' : 'grey';
                    const color = (t) => tone === 'grey' ? t.palette.grey[500] : t.palette[tone].main;
                    const label = cycle.status === 'on-time' ? 'Paid on time' : cycle.status === 'late' ? 'Paid late' : cycle.status === 'overdue' ? 'Overdue' : 'Upcoming';
                    return (
                      <Box key={cycle.key} title={`${cycle.dueDate} · ${label}${cycle.paidAt ? ` · paid ${format(cycle.paidAt, 'MMM d, yyyy')}` : ''}`} aria-label={`${format(new Date(`${cycle.dueDate}T00:00:00`), 'MMMM yyyy')} rent due ${cycle.dueDate}: ${label}`} sx={{ p: 1, borderRadius: 1.5, textAlign: 'center', border: '1px solid', borderColor: (t) => alpha(color(t), 0.4), bgcolor: (t) => alpha(color(t), 0.12) }}>
                        <Typography sx={{ fontSize: '0.72rem', fontWeight: 750, color }}>{cycle.label} {cycle.dueDate.slice(2, 4)}</Typography>
                        <Typography sx={{ fontSize: '0.61rem', color: 'text.secondary' }}>{cycle.isProrated ? 'Move-in' : `Due ${cycle.dueDate.slice(8)}`}</Typography>
                      </Box>
                    );
                  })}
                </Box>
                <Stack direction="row" spacing={2} flexWrap="wrap" useFlexGap sx={{ mt: 1.75 }}>
                  {[
                    ['grey', 'Not due yet'], ['success', 'Paid on time'], ['warning', 'Paid late'], ['error', 'Overdue']
                  ].map(([color, label]) => (
                    <Stack key={label} direction="row" spacing={0.6} alignItems="center">
                      <Box sx={{ width: 10, height: 10, borderRadius: 0.5, bgcolor: color === 'grey' ? 'grey.500' : `${color}.main` }} />
                      <Typography sx={{ fontSize: '0.68rem', color: 'text.secondary' }}>{label}</Typography>
                    </Stack>
                  ))}
                </Stack>
              </>
            ) : (
              <Typography sx={{ fontSize: '0.75rem', color: 'text.secondary' }}>Add lease dates and rent to see the full payment timeline.</Typography>
            )}
          </SectionCard>

          <LeaseMoveInCard
            readiness={moveInReadiness}
            lease={lease}
            checklists={leaseChecklists}
            hasAgreement={hasLeaseAgreementDocument}
            eSignatureReadiness={eSignatureReadiness}
            onAssignTenants={onAddTenant}
            onViewTenants={() => setActiveTab(1)}
            onBuildAgreement={() => navigate(leaseAgreementSetupUrl)}
            onViewAgreement={onViewAgreement}
            onOpenSignature={onOpenSignature}
            onViewChecklists={onViewChecklists}
          />

          {/* Lease activity */}
            <SectionCard
              title="Lease activity"
              action={
                <Typography
                  variant="caption"
                  color="primary"
                  sx={{ fontWeight: 600, fontSize: '0.68rem', cursor: 'pointer' }}
                  onClick={() => navigate(`/landlord/leases/${leaseId}/activity`)}
                >
                  View all →
                </Typography>
              }
            >
              {activityItems.length > 0 ? (
                <Stack>
                  {activityItems.map((item, i) => (
                    <Stack key={i} direction="row" spacing={1.5} alignItems="flex-start"
                      sx={{ py: 1, borderBottom: i < activityItems.length - 1 ? `1px solid ${subtleDivider(theme, 0.16, 0.1)}` : 'none' }}>
                      <Box sx={{
                        width: 18, height: 18, borderRadius: '50%', flexShrink: 0, mt: 0.15,
                        bgcolor: item.dot ? alpha(theme.palette.success.main, 0.12) : alpha(theme.palette.primary.main, 0.1),
                        border: `2px solid ${item.dot ? theme.palette.success.main : theme.palette.primary.main}`,
                        display: 'flex', alignItems: 'center', justifyContent: 'center'
                      }}>
                        {item.dot && <Box sx={{ width: 6, height: 6, borderRadius: '50%', bgcolor: 'success.main' }} />}
                      </Box>
                      <Box sx={{ flex: 1, minWidth: 0 }}>
                        <Typography sx={{ fontSize: '0.78rem', fontWeight: 500, lineHeight: 1.3 }}>{item.label}</Typography>
                        <Typography sx={{ fontSize: '0.65rem', color: 'text.secondary' }}>{item.sub}</Typography>
                      </Box>
                      {item.amount && (
                        <Stack direction="row" alignItems="center" spacing={0.5} sx={{ flexShrink: 0 }}>
                          <Typography sx={{ fontSize: '0.82rem', fontWeight: 700, color: 'success.main' }}>{item.amount}</Typography>
                          {item.payment && (
                            <IconButton
                              size="small"
                              onClick={(event) => handlePaymentActionsClick(event, item.payment)}
                              aria-label="Payment actions"
                              sx={{ width: 24, height: 24, color: 'text.secondary' }}
                            >
                              <EllipsisOutlined style={{ fontSize: 13 }} />
                            </IconButton>
                          )}
                        </Stack>
                      )}
                    </Stack>
                  ))}
                </Stack>
              ) : (
                <Typography sx={{ fontSize: '0.75rem', color: 'text.secondary' }}>No activity yet</Typography>
              )}
            </SectionCard>
        </Stack>
      )}

      {activeTab === 1 && (
        <TenantsCard tenants={tenants} property={property} onAddTenant={onAddTenant} onViewProfile={handleViewTenantProfile} />
      )}

      {activeTab === 6 && (
        <LeaseChargesTab leaseId={lease?.id ?? lease?.Id ?? leaseId} />
      )}

      {activeTab === 2 && (
        <SectionCard title="Payment history">
          <Stack direction={{ xs: 'column', md: 'row' }} spacing={1.25} sx={{ mb: 2 }}>
            <TextField fullWidth size="small" value={paymentSearch} onChange={(event) => setPaymentSearch(event.target.value)} placeholder="Search payments" slotProps={{ input: { startAdornment: <SearchOutlined style={{ marginRight: 8, color: theme.palette.text.secondary }} /> } }} />
            <TextField size="small" type="date" label="From" value={paymentFromDate} onChange={(event) => setPaymentFromDate(event.target.value)} slotProps={{ inputLabel: { shrink: true } }} sx={{ minWidth: { md: 170 } }} />
            <TextField size="small" type="date" label="To" value={paymentToDate} onChange={(event) => setPaymentToDate(event.target.value)} slotProps={{ inputLabel: { shrink: true } }} sx={{ minWidth: { md: 170 } }} />
          </Stack>

          {filteredPayments.length > 0 ? (
            <Stack divider={<Divider flexItem />}>
              {filteredPayments.map((payment, index) => {
                const paymentId = payment.id ?? payment.Id ?? index;
                const amount = parseFloat(payment.amount ?? payment.Amount) || 0;
                const paymentDate = payment.paymentDate ?? payment.PaymentDate;
                const type = payment.type ?? payment.Type ?? 'Payment';
                return (
                  <Stack key={paymentId} direction="row" alignItems="center" spacing={1.5} sx={{ py: 1.25 }}>
                    <Box sx={{ width: 38, height: 38, borderRadius: 1.5, display: 'flex', alignItems: 'center', justifyContent: 'center', bgcolor: alpha(theme.palette.success.main, 0.09), color: 'success.main', flexShrink: 0 }}><DollarOutlined /></Box>
                    <Box sx={{ flex: 1, minWidth: 0 }}>
                      <Typography sx={{ fontSize: '0.82rem', fontWeight: 700 }}>{type}</Typography>
                      <Typography sx={{ fontSize: '0.68rem', color: 'text.secondary' }}>{paymentDate ? format(new Date(paymentDate), 'MMM d, yyyy') : 'Date not recorded'}{tenantFullName ? ` · ${tenantFullName}` : ''}</Typography>
                    </Box>
                    <Typography sx={{ fontSize: '0.9rem', fontWeight: 750, color: 'success.main' }}>{formatCurrency(amount)}</Typography>
                    <IconButton size="small" aria-label="Payment actions" onClick={(event) => handlePaymentActionsClick(event, payment)}><EllipsisOutlined /></IconButton>
                  </Stack>
                );
              })}
            </Stack>
          ) : (
            <Box sx={{ py: 5, textAlign: 'center' }}>
              <Typography sx={{ fontWeight: 700, mb: 0.4 }}>No matching payments</Typography>
              <Typography variant="body2" color="text.secondary">Try another search or date range.</Typography>
            </Box>
          )}
        </SectionCard>
      )}

      {activeTab === 3 && (
        <SectionCard title="Documents" action={<Stack direction="row" spacing={1}>
          <Button size="small" variant="outlined" startIcon={<PlusOutlined />} onClick={() => navigate(leaseAgreementSetupUrl)}>Create agreement</Button>
          <Button size="small" variant="contained" startIcon={<UploadOutlined />} onClick={onUploadDocument}>Upload</Button>
        </Stack>}>
          <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1.5} sx={{ mb: 2 }}>
            <TextField size="small" label="Search documents" value={documentSearch} onChange={(event) => { setDocumentSearch(event.target.value); setDocumentPage(0); }} sx={{ flex: 1 }} />
            <FormControl size="small" sx={{ minWidth: 170 }}>
              <InputLabel id="document-type-filter-label">Type</InputLabel>
              <Select labelId="document-type-filter-label" label="Type" value={documentTypeFilter} onChange={(event) => { setDocumentTypeFilter(event.target.value); setDocumentPage(0); }}>
                <MenuItem value="all">All types</MenuItem>
                {documentTypes.map((type) => <MenuItem key={type} value={type}>{type}</MenuItem>)}
              </Select>
            </FormControl>
            <FormControl size="small" sx={{ minWidth: 175 }}>
              <InputLabel id="document-visibility-filter-label">Tenant visibility</InputLabel>
              <Select labelId="document-visibility-filter-label" label="Tenant visibility" value={documentVisibilityFilter} onChange={(event) => { setDocumentVisibilityFilter(event.target.value); setDocumentPage(0); }}>
                <MenuItem value="all">All visibility</MenuItem>
                <MenuItem value="visible">Tenant visible</MenuItem>
                <MenuItem value="private">Private</MenuItem>
              </Select>
            </FormControl>
          </Stack>
          <TableContainer sx={{ overflowX: 'auto' }}>
            <Table size="small" aria-label="Lease documents" sx={{ minWidth: 650 }}>
              <TableHead><TableRow><TableCell>Name</TableCell><TableCell>Type</TableCell><TableCell>Tenant visible</TableCell><TableCell>Uploaded date</TableCell><TableCell>Action</TableCell></TableRow></TableHead>
              <TableBody>
                {documentPagination.rows.map((document) => (
                  <TableRow key={document.key}>
                    <TableCell>{document.name}</TableCell>
                    <TableCell>{document.type}</TableCell>
                    <TableCell>{document.tenantVisible === null ? 'Not specified' : document.tenantVisible ? 'Yes' : 'No'}</TableCell>
                    <TableCell>{document.uploadedAt && !Number.isNaN(new Date(document.uploadedAt).getTime()) ? format(new Date(document.uploadedAt), 'MMM d, yyyy') : '—'}</TableCell>
                    <TableCell><Button size="small" disabled={document.source !== 'agreement' && !document.url} onClick={() => document.source === 'agreement' ? onViewAgreement?.() : window.open(document.url, '_blank', 'noopener,noreferrer')}>View</Button></TableCell>
                  </TableRow>
                ))}
                {!documentPagination.count && <TableRow><TableCell colSpan={5} align="center">No matching documents</TableCell></TableRow>}
              </TableBody>
            </Table>
          </TableContainer>
          <TablePagination component="div" count={documentPagination.count} page={documentPagination.page} rowsPerPage={documentRowsPerPage}
            onPageChange={(_, page) => setDocumentPage(page)} onRowsPerPageChange={(event) => { setDocumentRowsPerPage(Number(event.target.value)); setDocumentPage(0); }} rowsPerPageOptions={[10, 20, 50, 100]} />
        </SectionCard>
      )}

          {activeTab === 4 && (
            <SectionCard title="Insurance">
              <Box sx={{ py: 5, textAlign: 'center' }}>
                <Typography sx={{ fontWeight: 700, mb: 0.4 }}>No insurance records on this lease</Typography>
                <Typography variant="body2" color="text.secondary">Insurance details will appear here when they are associated with this lease.</Typography>
              </Box>
            </SectionCard>
          )}

          {activeTab === 5 && (
            <SectionCard title="Utilities">
              <Box sx={{ py: 5, textAlign: 'center' }}>
                <Typography sx={{ fontWeight: 700, mb: 0.4 }}>No utility records on this lease</Typography>
                <Typography variant="body2" color="text.secondary">Utility responsibilities and records will appear here when they are available.</Typography>
              </Box>
            </SectionCard>
          )}

      <Dialog open={deleteLeaseOpen} onClose={deletingLease ? undefined : () => setDeleteLeaseOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle>Delete lease?</DialogTitle>
        <DialogContent>
          <DialogContentText sx={{ mb: 2 }}>
            This archives and hides the lease from the lease list. The lease is not erased from financial history;
            payments and other financial records are retained, and tenant profiles are retained.
          </DialogContentText>
          <Typography variant="body2" sx={{ fontWeight: 700, mb: 0.5 }}>Also remove from the app:</Typography>
          <Stack>
            <FormControlLabel control={<Checkbox checked={deleteDocuments} onChange={(event) => setDeleteDocuments(event.target.checked)} disabled={deletingLease} />} label="Lease documents" />
            <FormControlLabel control={<Checkbox checked={deleteChecklists} onChange={(event) => setDeleteChecklists(event.target.checked)} disabled={deletingLease} />} label="Lease checklists" />
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
          <Button onClick={() => setDeleteLeaseOpen(false)} disabled={deletingLease}>Cancel</Button>
          <Button color="error" variant="contained" disabled={deletingLease} onClick={confirmDeleteLease}>
            {deletingLease ? 'Deleting…' : 'Delete lease'}
          </Button>
        </DialogActions>
      </Dialog>

      <Menu
        anchorEl={paymentActionsAnchor}
        open={Boolean(paymentActionsAnchor)}
        onClose={handlePaymentActionsClose}
        PaperProps={{ sx: { mt: 0.5, minWidth: 170, borderRadius: 1.5 } }}
      >
        <MenuItem onClick={handlePaymentEdit} sx={{ gap: 1, fontSize: '0.85rem' }}>
          <EditOutlined style={{ fontSize: 14 }} />
          Edit payment
        </MenuItem>
        <MenuItem onClick={handlePaymentDelete} sx={{ gap: 1, fontSize: '0.85rem', color: 'error.main' }}>
          <DeleteOutlined style={{ fontSize: 14 }} />
          Delete payment
        </MenuItem>
      </Menu>

      <PaymentEditDrawer
        payment={selectedPayment}
        open={paymentEditOpen}
        onClose={handlePaymentEditClose}
        onUpdateSuccess={handlePaymentUpdateSuccess}
      />

      <Dialog open={deletePaymentOpen} onClose={handlePaymentDeleteCancel} maxWidth="sm" fullWidth>
        <DialogTitle>Delete Payment</DialogTitle>
        <DialogContent>
          <DialogContentText>
            Are you sure you want to delete this payment? This action cannot be undone.
            {selectedPayment && (
              <Box component="span" sx={{ display: 'block', mt: 2, fontWeight: 600, color: 'text.primary' }}>
                Amount: {formatCurrency(parseFloat(selectedPayment.amount ?? selectedPayment.Amount) || 0)}
                <br />
                Date: {selectedPayment.paymentDate || selectedPayment.PaymentDate ? format(new Date(selectedPayment.paymentDate ?? selectedPayment.PaymentDate), 'MMM d, yyyy') : '—'}
              </Box>
            )}
          </DialogContentText>
        </DialogContent>
        <DialogActions>
          <Button onClick={handlePaymentDeleteCancel} disabled={deletingPayment} sx={{ textTransform: 'none' }}>
            Cancel
          </Button>
          <Button onClick={handlePaymentDeleteConfirm} variant="contained" color="error" disabled={deletingPayment} sx={{ textTransform: 'none' }}>
            {deletingPayment ? 'Deleting...' : 'Delete'}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}
