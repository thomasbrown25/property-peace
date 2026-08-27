import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  alpha, Avatar, Box, Button, Chip, Dialog, DialogActions, DialogContent,
  DialogContentText, DialogTitle, Divider, Grid, IconButton, LinearProgress,
  Menu, MenuItem, Stack, Tab, Tabs, TextField, Typography, useTheme
} from '@mui/material';
import {
  CheckOutlined, DollarOutlined, EditOutlined, EllipsisOutlined,
  FileTextOutlined, PlusOutlined,
  StopOutlined, UploadOutlined, ArrowRightOutlined,
  MailOutlined, PhoneOutlined, DeleteOutlined, CalendarOutlined,
  HomeOutlined, SearchOutlined, UserOutlined
} from '@ant-design/icons';
import PaymentEditDrawer from 'components/drawers/PaymentEditDrawer';
import TenantMessageDrawer from 'components/drawers/TenantMessageDrawer';
import { openSnackbar } from 'api/snackbar';
import axios from 'utils/axios';
import { format } from 'date-fns';
import { formatCurrency, formatPhoneInput } from 'utils/formatters';
import { buildLeasePaymentSchedule } from 'utils/leasePaymentSchedule';
import { renterProfileRoute } from 'utils/renterWorkspace';

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

// ─── Lifecycle helpers ────────────────────────────────────────────────────────

function getLeaseLifecycleStages(lease, isDraftLease = false) {
  const now = new Date();
  const startDate = lease.startDate ? new Date(lease.startDate) : null;
  const endDate   = lease.endDate   ? new Date(lease.endDate)   : null;
  const daysUntilEnd = endDate ? Math.max(0, Math.floor((endDate - now) / 86400000)) : null;

  const hasStarted        = !isDraftLease && !!(startDate && startDate <= now);
  const isActive          = !!lease.isActive && hasStarted;
  const isInRenewalWindow = isActive && daysUntilEnd !== null && daysUntilEnd <= 90;
  const hasEnded          = !lease.isActive && hasStarted;

  const stepIdx = hasEnded ? 3 : isInRenewalWindow ? 2 : isActive ? 1 : 0;

  // Progress along the active→renewal segment (only while in the active stage).
  let activeProgress = null;
  if (stepIdx === 1 && startDate && endDate) {
    const renewalStart = new Date(endDate.getTime() - 90 * 86400000);
    const total = renewalStart - startDate;
    activeProgress = total > 0 ? Math.min(1, Math.max(0, (now - startDate) / total)) : 0;
  }

  return [
    { key: 'not-started', label: 'Not Started',   date: null,                                                          done: stepIdx > 0, current: stepIdx === 0 },
    { key: 'active',      label: 'Active',         date: startDate && hasStarted ? format(startDate, 'MMM d') : null,  done: stepIdx > 1, current: stepIdx === 1, progress: activeProgress },
    { key: 'renewal',     label: 'Renewal Window', date: null,                                                          done: stepIdx > 2, current: stepIdx === 2 },
    { key: 'ended',       label: 'Ended',          date: endDate && hasEnded ? format(endDate, "MMM d ''yy") : null,   done: stepIdx === 3, current: stepIdx === 3 },
  ];
}

function getLeaseAgreementStages(lease, hasLeaseAgreementDocument) {
  const ag = lease.leaseAgreement || lease.LeaseAgreement;
  if (!ag || !hasLeaseAgreementDocument) {
    return [
      { key: 'draft',  label: 'Draft',  date: null, done: false, current: false },
      { key: 'signed', label: 'Signed', date: null, done: false, current: false },
      { key: 'active', label: 'Active', date: null, done: false, current: false },
    ];
  }
  const signatureStatus = ag?.signatureStatus ?? ag?.SignatureStatus;
  const landlordSignedAt = ag?.landlordSignedAt ?? ag?.LandlordSignedAt;
  const isSigned = signatureStatus === 4 || !!landlordSignedAt;
  const hasStarted = lease.startDate ? new Date(lease.startDate) <= new Date() : false;
  const isAgreementActive = isSigned && !!lease.isActive && hasStarted;

  const stepIdx = isAgreementActive ? 2 : isSigned ? 1 : 0;

  return [
    { key: 'draft',  label: 'Draft',  date: null,                                                              done: stepIdx > 0, current: stepIdx === 0 },
    { key: 'signed', label: 'Signed', date: landlordSignedAt ? format(new Date(landlordSignedAt), 'MMM d') : null, done: stepIdx > 1, current: stepIdx === 1 },
    { key: 'active', label: 'Active', date: null,                                                              done: stepIdx === 2, current: stepIdx === 2 },
  ];
}

// ─── Lifecycle bar ────────────────────────────────────────────────────────────

function LifecycleBar({ title, stages, hint, action }) {
  const theme = useTheme();
  return (
    <Box sx={{ ...detailCardSx, height: '100%' }}>
      <Stack direction="row" alignItems="center" justifyContent="space-between" sx={{ mb: 1.75 }}>
        <Typography sx={{ ...detailHeaderSx, fontSize: '0.6rem' }}>
          {title}
        </Typography>
        {action ?? (hint && (
          <Typography variant="caption" color="text.secondary" sx={{ fontSize: '0.68rem' }}>
            {hint}
          </Typography>
        ))}
      </Stack>
      <Stack direction="row" sx={{ position: 'relative' }}>
        {stages.map((stage, i) => {
          const isCurrent = stage.current || (!stage.done && i === stages.findIndex(s => !s.done));
          return (
            <Box key={stage.key} sx={{ flex: 1, textAlign: 'center', position: 'relative' }}>
              {i < stages.length - 1 && (stage.progress != null ? (
                <>
                  <Box sx={{ position: 'absolute', top: 9, left: '50%', right: '-50%', height: '2px', bgcolor: subtleDivider(theme, 0.24, 0.16), zIndex: 0 }} />
                  <Box sx={{ position: 'absolute', top: 9, left: '50%', width: `${stage.progress * 100}%`, height: '2px', bgcolor: theme.palette.primary.main, zIndex: 1, transition: 'width 0.4s ease' }} />
                </>
              ) : (
                <Box sx={{
                  position: 'absolute', top: 9, left: '50%', right: '-50%', height: '2px',
                  bgcolor: (stage.done || stage.current) ? theme.palette.primary.main : subtleDivider(theme, 0.24, 0.16),
                  zIndex: 0,
                }} />
              ))}
              <Box sx={{
                width: 18, height: 18, borderRadius: '50%', mx: 'auto', mb: 0.5, position: 'relative', zIndex: 1,
                bgcolor: stage.key === 'active' && (stage.done || stage.current)
                  ? theme.palette.success.main
                  : (stage.done || stage.current) ? theme.palette.primary.main : 'background.paper',
                border: `2px solid ${stage.done || isCurrent ? theme.palette.primary.main : subtleDivider(theme, 0.34, 0.24)}`,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                boxShadow: isCurrent ? `0 0 0 4px ${alpha(theme.palette.primary.main, 0.15)}` : 'none',
              }}>
                {(stage.done || stage.current) && stage.key !== 'active' && <CheckOutlined style={{ fontSize: 9, color: '#fff' }} />}
              </Box>
              <Typography sx={{ fontSize: '0.62rem', fontWeight: isCurrent ? 700 : 400, color: isCurrent ? 'text.primary' : 'text.secondary', lineHeight: 1.3 }}>
                {stage.label}
              </Typography>
              {stage.date && (
                <Typography sx={{ fontSize: '0.58rem', color: 'text.disabled', mt: 0.15 }}>{stage.date}</Typography>
              )}
            </Box>
          );
        })}
      </Stack>
    </Box>
  );
}

// ─── Lease-to-move-in readiness ──────────────────────────────────────────────

function LeaseMoveInCard({
  readiness,
  hasAgreement,
  eSignatureReadiness,
  onAssignTenants,
  onBuildAgreement,
  onViewAgreement,
  onOpenSignature,
  onConfigureRent,
  onCustomizeConditionReport,
  onViewChecklists
}) {
  const theme = useTheme();
  if (!readiness) return null;

  const actions = {
    tenants: { label: 'Assign tenants', onClick: onAssignTenants },
    agreement: { label: hasAgreement ? 'View agreement' : 'Build agreement', onClick: hasAgreement ? onViewAgreement : onBuildAgreement },
    signatures: { label: 'Open signatures', onClick: onOpenSignature, disabled: !eSignatureReadiness?.canInvoke },
    'rent-deposit': { label: 'Configure rent', onClick: onConfigureRent },
    'condition-report': { label: 'Customize report', onClick: onCustomizeConditionReport },
    checklist: { label: 'View checklists', onClick: onViewChecklists }
  };

  return (
    <Box sx={{ ...detailCardSx, mb: 2, p: { xs: 2, md: 2.5 } }}>
      <Stack direction={{ xs: 'column', sm: 'row' }} justifyContent="space-between" spacing={1.5} sx={{ mb: 2 }}>
        <Box>
          <Typography sx={{ ...detailHeaderSx, fontSize: '0.7rem', color: 'primary.main', mb: 0.4 }}>
            Lease to move-in
          </Typography>
          <Typography sx={{ fontSize: '1rem', fontWeight: 750 }}>
            {readiness.ready ? 'All tracked steps complete' : `${readiness.completed} of ${readiness.totalTrackable} tracked steps complete`}
          </Typography>
          <Typography sx={{ fontSize: '0.7rem', color: 'text.secondary', mt: 0.25 }}>
            Based only on saved lease, signature, payment, and checklist records.
          </Typography>
        </Box>
        <Chip
          size="small"
          label={readiness.ready ? 'Tracked steps complete' : 'Setup in progress'}
          color={readiness.ready ? 'success' : 'warning'}
          variant={readiness.ready ? 'filled' : 'outlined'}
          sx={{ alignSelf: { xs: 'flex-start', sm: 'center' }, fontWeight: 700 }}
        />
      </Stack>

      <LinearProgress
        variant="determinate"
        value={readiness.progress}
        color={readiness.ready ? 'success' : 'primary'}
        sx={{ height: 7, borderRadius: 4, mb: 2.25, bgcolor: alpha(theme.palette.primary.main, 0.08) }}
      />

      <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', sm: 'repeat(2, minmax(0, 1fr))', lg: 'repeat(3, minmax(0, 1fr))' }, gap: 1 }}>
        {readiness.steps.map((step) => {
          const action = actions[step.key];
          const complete = step.status === 'complete';
          const unavailable = step.status === 'unavailable';
          const color = complete ? theme.palette.success.main : unavailable ? theme.palette.text.disabled : theme.palette.warning.main;
          return (
            <Box key={step.key} sx={{ p: 1.35, borderRadius: 1.75, border: `1px solid ${alpha(color, 0.3)}`, bgcolor: alpha(color, unavailable ? 0.025 : 0.055), minWidth: 0 }}>
              <Stack direction="row" spacing={1} alignItems="flex-start">
                <Box sx={{ width: 22, height: 22, borderRadius: '50%', flexShrink: 0, mt: 0.1, bgcolor: complete ? color : 'transparent', border: `1.5px solid ${color}`, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  {complete ? <CheckOutlined style={{ color: '#fff', fontSize: 10 }} /> : <Box sx={{ width: 5, height: 5, borderRadius: '50%', bgcolor: color }} />}
                </Box>
                <Box sx={{ minWidth: 0, flex: 1 }}>
                  <Typography sx={{ fontSize: '0.75rem', fontWeight: 700 }}>{step.label}</Typography>
                  <Typography sx={{ fontSize: '0.64rem', color: unavailable ? 'text.disabled' : 'text.secondary', lineHeight: 1.4, minHeight: 18 }}>
                    {step.detail}
                  </Typography>
                  {action?.onClick && (
                    <Button size="small" disabled={action.disabled} onClick={action.onClick} sx={{ mt: 0.45, p: 0, minWidth: 0, textTransform: 'none', fontSize: '0.66rem', fontWeight: 700 }}>
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
      <Typography sx={{ ...detailHeaderSx, fontSize: '0.72rem', mb: 1.5 }}>
        Tenants
      </Typography>

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
  dashboardSummary, user, leaseDocuments, leaseAgreement, moveInReadiness, eSignatureReadiness,
  handleEndLeaseClick, handleReopenLeaseClick,
  onRecordPayment, onViewAgreement, onUploadDocument, onEditTerms,
  onAddTenant, onOpenSignature, onConfigureRent, onCustomizeConditionReport,
  onViewChecklists, onPaymentUpdated, propertiesRefetch,
}) {
  const theme = useTheme();
  const navigate = useNavigate();
  const [actionsAnchor, setActionsAnchor] = useState(null);
  const [paymentActionsAnchor, setPaymentActionsAnchor] = useState(null);
  const [selectedPayment, setSelectedPayment] = useState(null);
  const [paymentEditOpen, setPaymentEditOpen] = useState(false);
  const [deletePaymentOpen, setDeletePaymentOpen] = useState(false);
  const [deletingPayment, setDeletingPayment] = useState(false);
  const [activeTab, setActiveTab] = useState(0);
  const [paymentSearch, setPaymentSearch] = useState('');
  const [paymentFromDate, setPaymentFromDate] = useState('');
  const [paymentToDate, setPaymentToDate] = useState('');

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
  const leaseLifecycleStages    = useMemo(() => getLeaseLifecycleStages(lease, isDraftLease), [lease, isDraftLease]);
  const leaseAgreementStages    = useMemo(() => getLeaseAgreementStages(lease, hasLeaseAgreementDocument), [lease, hasLeaseAgreementDocument]);
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

  const statusLabel = isDraftLease ? 'Draft' : isNotStarted ? 'Not started' : lease?.isActive ? 'Active' : 'Ended';

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

  const leasePaymentSchedule = useMemo(
    () => buildLeasePaymentSchedule(lease),
    [lease]
  );
  const totalContractVal = leasePaymentSchedule.totalContractValue;

  const totalCollected = useMemo(() =>
    (payments || []).reduce((s, p) => s + (parseFloat(p.amount || p.Amount) || 0), 0),
    [payments]
  );

  const outstandingAmt = rentRecord?.outstanding || rentRecord?.Outstanding || 0;
  const depositHeld    = (deposits || []).reduce((s, d) => s + (parseFloat(d.amount || d.Amount) || 0), 0) || depositAmount;

  // Payment calendar
  const paymentCalendar = useMemo(() => {
    if (isDraftLease || leasePaymentSchedule.cycles.length === 0) return [];
    const gracePeriod = lease.lateFeeGracePeriod || lease.LateFeeGracePeriod || 5;
    const upcomingWindowEnd = new Date(now.getFullYear(), now.getMonth() + 2, 1);

    // Rent payments only (exclude fees & deposits), sorted oldest-first.
    const rentPayments = (payments || [])
      .filter(p => {
        const typeStr = (p.type || p.Type || '').toLowerCase();
        return !p.feeId && !p.FeeId && !p.depositId && !p.DepositId
          && !typeStr.includes('fee') && !typeStr.includes('deposit');
      })
      .sort((a, b) => new Date(a.paymentDate || a.PaymentDate) - new Date(b.paymentDate || b.PaymentDate));

    // Allocate payments cumulatively against each schedule amount. This keeps a
    // prorated move-in installment from being treated as a full-rent threshold.
    let running = 0;
    const milestones = rentPayments.map(p => {
      running += parseFloat(p.amount || p.Amount) || 0;
      return { date: new Date(p.paymentDate || p.PaymentDate), cumulative: running };
    });

    let required = 0;
    return leasePaymentSchedule.cycles.map(cycle => {
      required += cycle.amount;
      const milestone = milestones.find(m => m.cumulative >= required);
      const isPaid = !!milestone;
      const dueDate = new Date(`${cycle.dueDate}T00:00:00`);
      const lateDate = new Date(dueDate);
      lateDate.setDate(lateDate.getDate() + gracePeriod);
      const isOverdue = !isPaid && now > lateDate;
      const isUpcoming = !isPaid && !isOverdue && dueDate < upcomingWindowEnd;
      const isPaidLate = isPaid && milestone.date > lateDate;

      return {
        ...cycle,
        paid: isPaid,
        paidLate: isPaidLate,
        overdue: isOverdue,
        upcoming: isUpcoming
      };
    });
  }, [isDraftLease, leasePaymentSchedule, payments, now, lease.lateFeeGracePeriod, lease.LateFeeGracePeriod]);

  const paidCycles     = paymentCalendar.filter(m => m.paid).length;
  const paidLateCycles = paymentCalendar.filter(m => m.paidLate).length;
  const overdueCycles  = paymentCalendar.filter(m => m.overdue).length;
  const lateCycles     = paidLateCycles + overdueCycles;
  const onTimePct      = paidCycles > 0 ? Math.round(((paidCycles - paidLateCycles) / paidCycles) * 100) : 0;

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

  // Docs
  const docs = useMemo(() => {
    const list = [];
    if (hasLeaseAgreementDocument) {
      list.push({ name: 'Lease agreement PDF', tag: 'master', category: 'agreement', onClick: onViewAgreement });
    }
    (leaseDocuments || []).forEach(d => {
      const url = d.url || d.Url || d.blobUrl || d.BlobUrl || d.documentUrl || d.DocumentUrl;
      const name = d.name || d.Name || d.description || d.Description || d.fileName || d.FileName || 'Document';
      const documentType = Number(d.documentType ?? d.DocumentType);
      const normalizedName = name.toLowerCase();
      const category = [10, 11, 12].includes(documentType) || /lease|agreement|addendum|renewal/.test(normalizedName)
        ? 'agreement'
        : [40, 41].includes(documentType) || /form|checklist|condition report/.test(normalizedName)
          ? 'form'
          : 'other';
      list.push({
        name,
        tag: null,
        category,
        onClick: url ? () => window.open(url, '_blank', 'noopener,noreferrer') : onUploadDocument
      });
    });
    return list;
  }, [hasLeaseAgreementDocument, leaseDocuments, onUploadDocument, onViewAgreement]);

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

  const agreementDocuments = useMemo(() => docs.filter((document) => document.category === 'agreement'), [docs]);
  const formDocuments = useMemo(() => docs.filter((document) => document.category === 'form'), [docs]);
  const otherDocuments = useMemo(() => docs.filter((document) => document.category === 'other'), [docs]);

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
              <HomeOutlined style={{ fontSize: 21 }} />
            </Box>
            <Box sx={{ flex: 1, minWidth: 0 }}>
              <Stack direction="row" alignItems="center" spacing={1} flexWrap="wrap" useFlexGap sx={{ mb: 0.75 }}>
                <Typography sx={{ fontSize: '0.68rem', fontWeight: 750, letterSpacing: 1.25, color: 'text.secondary', textTransform: 'uppercase' }}>
                  Lease{leaseId ? ` · ${leaseId}` : ''}
                </Typography>
                <Chip
                  label={statusLabel}
                  size="small"
                  sx={{
                    height: 24,
                    bgcolor: isDraftLease ? '#fef3c7' : isNotStarted ? alpha('#f59e0b', 0.12) : lease?.isActive ? alpha('#41a541', 0.12) : alpha(theme.palette.text.secondary, 0.1),
                    color: isDraftLease ? '#92400e' : isNotStarted ? '#a35b00' : lease?.isActive ? '#287b2d' : 'text.secondary',
                    border: '1px solid',
                    borderColor: isDraftLease ? '#fde68a' : isNotStarted ? alpha('#f59e0b', 0.28) : lease?.isActive ? alpha('#41a541', 0.28) : alpha(theme.palette.divider, 0.22),
                    fontWeight: 750,
                    '& .MuiChip-label': { px: 1.15 }
                  }}
                />
              </Stack>
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
                {propertyDisplay}
                {unitDisplay && <Box component="span" sx={{ color: 'text.secondary', fontWeight: 500 }}> — {unitDisplay}</Box>}
              </Typography>
              <Typography variant="body2" sx={{ color: 'text.secondary', maxWidth: 650 }}>
                {isDraftLease
                  ? 'This lease is saved as a draft and has not started. Review the terms and complete the agreement when you are ready.'
                  : 'Residential lease'}
              </Typography>
            </Box>
          </Stack>
          <Stack direction="row" alignItems="center" spacing={1} flexWrap="wrap" useFlexGap sx={{ flexShrink: 0, pl: { xs: 7.25, sm: 8, md: 0 } }}>
            {isDraftLease && (
              <Button size="small" variant="contained" startIcon={<EditOutlined />} onClick={onEditTerms}
                sx={{ textTransform: 'none', fontWeight: 700, borderRadius: 1.5, bgcolor: '#41a541', color: '#061e35', boxShadow: 'none', '&:hover': { bgcolor: '#37943a', boxShadow: 'none' } }}>
                Edit lease
              </Button>
            )}
            {!isDraftLease && (
              <Button size="small" variant="outlined" startIcon={<FileTextOutlined style={{ fontSize: 11 }} />} onClick={onUploadDocument}
                sx={{ textTransform: 'none', fontWeight: 650, fontSize: '0.8rem', borderRadius: 1.5, borderColor: 'divider', color: theme.palette.mode === 'dark' ? 'text.primary' : '#061e35', px: 1.5, '&:hover': { borderColor: 'primary.main', bgcolor: alpha(theme.palette.primary.main, 0.04) } }}>
                Upload document
              </Button>
            )}
            {!isDraftLease && (lease?.isActive || isNotStarted) && (
              <Button size="small" variant="contained" onClick={onRecordPayment}
                sx={{ textTransform: 'none', fontWeight: 750, fontSize: '0.8rem', borderRadius: 1.5, bgcolor: '#41a541', color: '#061e35', boxShadow: 'none', '&:hover': { bgcolor: '#37943a', boxShadow: 'none' } }}>
                Record payment
              </Button>
            )}
            <IconButton aria-label="More lease actions" size="small" onClick={e => setActionsAnchor(e.currentTarget)}
              sx={{ border: '1px solid', borderColor: 'divider', borderRadius: 1.5, color: theme.palette.mode === 'dark' ? 'text.primary' : '#061e35', '&:hover': { borderColor: 'primary.main', bgcolor: alpha(theme.palette.primary.main, 0.04) } }}>
              <EllipsisOutlined style={{ fontSize: 14 }} />
            </IconButton>
            <Menu anchorEl={actionsAnchor} open={Boolean(actionsAnchor)} onClose={() => setActionsAnchor(null)}
              PaperProps={{ sx: { mt: 0.5, minWidth: 180, borderRadius: 1.5, boxShadow: t => `0 4px 16px ${alpha(t.palette.common.black, 0.12)}` } }}>
              <MenuItem onClick={() => { setActionsAnchor(null); onEditTerms(); }} sx={{ py: 1, fontSize: '0.85rem' }}>
                <EditOutlined style={{ marginRight: 8, fontSize: 13 }} /> Edit terms
              </MenuItem>
              {lease?.isActive && !isDraftLease && (
                <MenuItem onClick={() => { setActionsAnchor(null); handleEndLeaseClick(); }} sx={{ py: 1, fontSize: '0.85rem', color: 'error.main' }}>
                  <StopOutlined style={{ marginRight: 8, fontSize: 13 }} /> End lease early
                </MenuItem>
              )}
              {!lease?.isActive && !isDraftLease && (
                <MenuItem onClick={() => { setActionsAnchor(null); handleReopenLeaseClick(); }} sx={{ py: 1, fontSize: '0.85rem', color: 'success.main' }}>
                  Reopen lease
                </MenuItem>
              )}
            </Menu>
          </Stack>
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
            { label: 'Start date', value: startDate ? format(startDate, 'MMM d, yyyy') : 'Not set', icon: <CalendarOutlined /> },
            { label: 'End date', value: endDate ? format(endDate, 'MMM d, yyyy') : 'Not set', icon: <CalendarOutlined /> },
            { label: 'Monthly rent', value: rentAmount > 0 ? formatCurrency(rentAmount) : 'Not set', icon: <DollarOutlined /> },
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
              <Typography noWrap sx={{ color: 'text.primary', fontWeight: 700, fontSize: '0.85rem' }}>{item.value}</Typography>
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
              <Button variant="contained" size="small" startIcon={<EditOutlined />} onClick={onEditTerms} sx={{ textTransform: 'none', fontWeight: 700, bgcolor: '#41a541', color: '#061e35', boxShadow: 'none', '&:hover': { bgcolor: '#41a541', boxShadow: 'none' } }}>
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
        </Tabs>
      </Box>

      {activeTab === 0 && (
        <Stack spacing={2}>
          {/* Lease lifecycle row */}
          <Grid container spacing={2}>
            <Grid size={{ xs: 12, lg: 8 }}>
              <LifecycleBar
                title="Lease Lifecycle"
                stages={leaseLifecycleStages}
                hint={daysUntilEnd !== null && lease?.isActive && daysUntilEnd > 90 ? `Renewal window opens in ${daysUntilEnd - 90} days` : null}
              />
            </Grid>
            <Grid size={{ xs: 12, lg: 4 }}>
              <LifecycleBar
                title="Lease Agreement Lifecycle"
                stages={leaseAgreementStages}
                action={!hasLeaseAgreementDocument && (
                  <Typography variant="caption" color="primary" sx={{ fontWeight: 600, fontSize: '0.68rem', cursor: 'pointer' }} onClick={() => navigate(leaseAgreementSetupUrl)}>
                    + Create agreement
                  </Typography>
                )}
              />
            </Grid>
          </Grid>

          <LeaseMoveInCard
            readiness={moveInReadiness}
            hasAgreement={hasLeaseAgreementDocument}
            eSignatureReadiness={eSignatureReadiness}
            onAssignTenants={onAddTenant}
            onBuildAgreement={() => navigate(leaseAgreementSetupUrl)}
            onViewAgreement={onViewAgreement}
            onOpenSignature={onOpenSignature}
            onConfigureRent={onConfigureRent}
            onCustomizeConditionReport={onCustomizeConditionReport}
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
        <Stack spacing={2}>
          <Stack direction={{ xs: 'column', sm: 'row' }} justifyContent="space-between" alignItems={{ sm: 'center' }} spacing={1.5}>
            <Box>
              <Typography variant="h4" sx={{ fontWeight: 750 }}>People on this lease</Typography>
              <Typography variant="body2" color="text.secondary">Manage tenants and co-signers without leaving the lease.</Typography>
            </Box>
            <Button variant="contained" startIcon={<PlusOutlined />} onClick={onAddTenant} sx={{ textTransform: 'none', fontWeight: 700, alignSelf: { xs: 'stretch', sm: 'center' } }}>
              Add tenant or co-signer
            </Button>
          </Stack>
          <TenantsCard tenants={tenants} property={property} onAddTenant={onAddTenant} onViewProfile={handleViewTenantProfile} />
        </Stack>
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
        <Stack spacing={2}>
          <SectionCard
            title="Lease agreements"
            action={
              <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1}>
                <Button size="small" variant="outlined" startIcon={<UploadOutlined />} onClick={onUploadDocument} sx={{ textTransform: 'none', fontWeight: 650 }}>Upload agreement</Button>
                <Button size="small" variant="contained" startIcon={<PlusOutlined />} onClick={() => navigate(leaseAgreementSetupUrl)} sx={{ textTransform: 'none', fontWeight: 700 }}>Create agreement</Button>
              </Stack>
            }
          >
            {agreementDocuments.length > 0 ? (
              <Stack spacing={1}>
                {agreementDocuments.map((document, index) => (
                  <Stack key={`${document.name}-${index}`} direction="row" alignItems="center" spacing={1.25} onClick={document.onClick} sx={{ p: 1.25, borderRadius: 1.5, border: `1px solid ${subtleDivider(theme, 0.22, 0.14)}`, cursor: 'pointer', '&:hover': { bgcolor: alpha(theme.palette.primary.main, 0.035) } }}>
                    <FileTextOutlined style={{ fontSize: 18, color: theme.palette.primary.main }} />
                    <Box sx={{ flex: 1, minWidth: 0 }}>
                      <Typography sx={{ fontSize: '0.82rem', fontWeight: 700 }}>{document.name}</Typography>
                      <Typography sx={{ fontSize: '0.66rem', color: 'text.secondary' }}>{document.tag === 'master' ? 'Primary lease agreement' : 'Lease document'}</Typography>
                    </Box>
                    <ArrowRightOutlined style={{ color: theme.palette.text.secondary }} />
                  </Stack>
                ))}
              </Stack>
            ) : (
              <Box sx={{ py: 5, textAlign: 'center' }}>
                <FileTextOutlined style={{ fontSize: 28, color: theme.palette.text.disabled }} />
                <Typography sx={{ fontWeight: 700, mt: 1, mb: 0.4 }}>No lease agreements yet</Typography>
                <Typography variant="body2" color="text.secondary">Upload an existing agreement or create one in Property Peace.</Typography>
              </Box>
            )}
          </SectionCard>

          <SectionCard
            title="Forms"
            action={<Button size="small" variant="outlined" startIcon={<UploadOutlined />} onClick={onUploadDocument} sx={{ textTransform: 'none', fontWeight: 650 }}>Upload form</Button>}
          >
            {formDocuments.length > 0 ? (
              <Stack spacing={1}>
                {formDocuments.map((document, index) => (
                  <Stack key={`${document.name}-${index}`} direction="row" alignItems="center" spacing={1.25} onClick={document.onClick} sx={{ p: 1.25, borderRadius: 1.5, border: `1px solid ${subtleDivider(theme, 0.22, 0.14)}`, cursor: 'pointer', '&:hover': { bgcolor: alpha(theme.palette.primary.main, 0.035) } }}>
                    <FileTextOutlined style={{ fontSize: 18, color: theme.palette.primary.main }} />
                    <Box sx={{ flex: 1, minWidth: 0 }}>
                      <Typography sx={{ fontSize: '0.82rem', fontWeight: 700 }}>{document.name}</Typography>
                      <Typography sx={{ fontSize: '0.66rem', color: 'text.secondary' }}>Lease form</Typography>
                    </Box>
                    <ArrowRightOutlined style={{ color: theme.palette.text.secondary }} />
                  </Stack>
                ))}
              </Stack>
            ) : (
              <Box sx={{ py: 4, textAlign: 'center' }}>
                <Typography sx={{ fontWeight: 700, mb: 0.4 }}>No forms yet</Typography>
                <Typography variant="body2" color="text.secondary">Condition reports, checklists, and other lease forms will appear here.</Typography>
              </Box>
            )}
          </SectionCard>

          <SectionCard
            title="Other"
            action={<Button size="small" variant="outlined" startIcon={<UploadOutlined />} onClick={onUploadDocument} sx={{ textTransform: 'none', fontWeight: 650 }}>Upload document</Button>}
          >
            {otherDocuments.length > 0 ? (
              <Stack spacing={1}>
                {otherDocuments.map((document, index) => (
                  <Stack key={`${document.name}-${index}`} direction="row" alignItems="center" spacing={1.25} onClick={document.onClick} sx={{ p: 1.25, borderRadius: 1.5, border: `1px solid ${subtleDivider(theme, 0.22, 0.14)}`, cursor: 'pointer', '&:hover': { bgcolor: alpha(theme.palette.primary.main, 0.035) } }}>
                    <FileTextOutlined style={{ fontSize: 18, color: theme.palette.text.secondary }} />
                    <Box sx={{ flex: 1, minWidth: 0 }}>
                      <Typography sx={{ fontSize: '0.82rem', fontWeight: 700 }}>{document.name}</Typography>
                      <Typography sx={{ fontSize: '0.66rem', color: 'text.secondary' }}>Other lease document</Typography>
                    </Box>
                    <ArrowRightOutlined style={{ color: theme.palette.text.secondary }} />
                  </Stack>
                ))}
              </Stack>
            ) : (
              <Box sx={{ py: 4, textAlign: 'center' }}>
                <Typography sx={{ fontWeight: 700, mb: 0.4 }}>No other documents yet</Typography>
                <Typography variant="body2" color="text.secondary">Supporting lease documents that are not agreements or forms will appear here.</Typography>
              </Box>
            )}
          </SectionCard>
        </Stack>
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
