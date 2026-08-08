import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  alpha, Avatar, Box, Button, Chip, Dialog, DialogActions, DialogContent,
  DialogContentText, DialogTitle, Divider, Grid, IconButton, LinearProgress,
  Menu, MenuItem, Stack, Tooltip, Typography, useTheme
} from '@mui/material';
import {
  CheckOutlined, DollarOutlined, EditOutlined, EllipsisOutlined,
  FileTextOutlined, MessageOutlined, PlusOutlined, RedoOutlined,
  StopOutlined, UploadOutlined, ArrowRightOutlined, StarFilled,
  MailOutlined, PhoneOutlined, DeleteOutlined, CalendarOutlined,
  UserOutlined
} from '@ant-design/icons';
import PaymentEditDrawer from 'components/drawers/PaymentEditDrawer';
import TenantMessageDrawer from 'components/drawers/TenantMessageDrawer';
import { openSnackbar } from 'api/snackbar';
import axios from 'utils/axios';
import { format } from 'date-fns';
import { formatCurrency, formatPhoneInput } from 'utils/formatters';
import { buildLeasePaymentSchedule } from 'utils/leasePaymentSchedule';

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

function TenantRow({ role, name, email, phone, initials, onMessage, showMessage = true }) {
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

            <Stack alignItems="flex-end" spacing={0.75} flexShrink={0}>
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
                message →
              </Button>}
            </Stack>
          </Stack>
        </Box>
      </Stack>
    </Box>
  );
}

function TenantsCard({ tenants, property, onAddTenant }) {
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
  onRenew, onRecordPayment, onViewAgreement, onUploadDocument, onEditTerms,
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

  const leaseLength = useMemo(() => {
    if (lease.leaseLength ?? lease.LeaseLength) return lease.leaseLength ?? lease.LeaseLength;
    if (!startDate || !endDate) return null;
    return Math.round(Math.abs((endDate - startDate) / (1000 * 60 * 60 * 24 * 30.44)));
  }, [lease.leaseLength, lease.LeaseLength, startDate, endDate]);

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
  const lateFeeAmount = lease.lateFee       || lease.LateFee       || 0;
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
  const healthColor = healthLabel === 'Good' ? '#16a34a' : healthLabel === 'Medium Risk' ? '#d97706' : '#dc2626';
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
      list.push({ name: 'Lease agreement PDF', tag: 'master', onClick: onViewAgreement });
    }
    (leaseDocuments || []).forEach(d => {
      const url = d.url || d.Url || d.blobUrl || d.BlobUrl || d.documentUrl || d.DocumentUrl;
      list.push({
        name: d.name || d.Name || 'Document',
        tag: null,
        onClick: url ? () => window.open(url, '_blank', 'noopener,noreferrer') : onUploadDocument
      });
    });
    return list;
  }, [hasLeaseAgreementDocument, leaseDocuments, onUploadDocument, onViewAgreement]);

  return (
    <Box>
      {/* ── Lease hero ───────────────────────────────────────────────────── */}
      <Box sx={{ mb: 2, p: { xs: 2.5, md: 3 }, borderRadius: 3, color: '#fff', bgcolor: '#061e35', overflow: 'hidden', position: 'relative', boxShadow: `0 18px 44px ${alpha('#061e35', 0.2)}` }}>
        <Box sx={{ position: 'absolute', width: 280, height: 280, borderRadius: '50%', right: -100, top: -170, bgcolor: alpha('#22c55e', 0.12), pointerEvents: 'none' }} />
        <Stack direction={{ xs: 'column', md: 'row' }} alignItems={{ md: 'flex-start' }} justifyContent="space-between" spacing={2.5} sx={{ position: 'relative' }}>
          <Box sx={{ flex: 1, minWidth: 0 }}>
            <Stack direction="row" alignItems="center" spacing={1} sx={{ mb: 1 }}>
              <Typography sx={{ fontSize: '0.68rem', fontWeight: 700, letterSpacing: 1.25, color: alpha('#fff', 0.66), textTransform: 'uppercase' }}>
                Lease{leaseId ? ` · ${leaseId}` : ''}
              </Typography>
              <Chip
                label={statusLabel}
                size="small"
                sx={{ height: 24, bgcolor: isDraftLease ? '#fef3c7' : isNotStarted ? alpha('#f59e0b', 0.2) : lease?.isActive ? alpha('#22c55e', 0.18) : alpha('#fff', 0.12), color: isDraftLease ? '#92400e' : isNotStarted ? '#fde68a' : lease?.isActive ? '#86efac' : '#fff', fontWeight: 700, '& .MuiChip-label': { px: 1.15 } }}
              />
            </Stack>
            <Typography variant="h3" sx={{ color: '#fff', fontWeight: 750, lineHeight: 1.12, mb: 0.65 }}>
              {propertyDisplay}
              {unitDisplay && <Box component="span" sx={{ color: alpha('#fff', 0.66), fontWeight: 500 }}> — {unitDisplay}</Box>}
            </Typography>
            <Typography variant="body2" sx={{ color: alpha('#fff', 0.7), maxWidth: 650 }}>
              {isDraftLease
                ? 'This lease is saved as a draft and has not started. Review the terms and complete the agreement when you are ready.'
                : tenantFullName ? `${tenantFullName} · Residential lease` : 'Residential lease'}
            </Typography>
          </Box>
          <Stack direction="row" alignItems="center" spacing={1} flexWrap="wrap" useFlexGap sx={{ flexShrink: 0 }}>
            {isDraftLease && (
              <Button size="small" variant="contained" startIcon={<EditOutlined />} onClick={onEditTerms}
                sx={{ textTransform: 'none', fontWeight: 700, borderRadius: 1.5, bgcolor: '#22c55e', color: '#061e35', boxShadow: 'none', '&:hover': { bgcolor: '#16a34a', boxShadow: 'none' } }}>
                Edit lease
              </Button>
            )}
            {!isDraftLease && lease?.isActive && (
              <Button size="small" variant="outlined" startIcon={<RedoOutlined style={{ fontSize: 11 }} />} onClick={onRenew}
                sx={{ textTransform: 'none', fontWeight: 600, fontSize: '0.8rem', borderRadius: 1.5, borderColor: alpha('#fff', 0.35), color: '#fff', px: 1.5, '&:hover': { borderColor: '#fff', bgcolor: alpha('#fff', 0.08) } }}>
                Renew
              </Button>
            )}
            {!isDraftLease && (
              <Button size="small" variant="outlined" startIcon={<FileTextOutlined style={{ fontSize: 11 }} />} onClick={onUploadDocument}
                sx={{ textTransform: 'none', fontWeight: 600, fontSize: '0.8rem', borderRadius: 1.5, borderColor: alpha('#fff', 0.35), color: '#fff', px: 1.5, '&:hover': { borderColor: '#fff', bgcolor: alpha('#fff', 0.08) } }}>
                Document
              </Button>
            )}
            {!isDraftLease && (lease?.isActive || isNotStarted) && (
              <Button size="small" variant="contained" onClick={onRecordPayment}
                sx={{ textTransform: 'none', fontWeight: 700, fontSize: '0.8rem', borderRadius: 1.5, bgcolor: '#22c55e', color: '#061e35', boxShadow: 'none', '&:hover': { bgcolor: '#16a34a', boxShadow: 'none' } }}>
                Record payment
              </Button>
            )}
            <IconButton size="small" onClick={e => setActionsAnchor(e.currentTarget)}
              sx={{ border: `1px solid ${alpha('#fff', 0.35)}`, borderRadius: 1.5, color: '#fff', '&:hover': { bgcolor: alpha('#fff', 0.08) } }}>
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
        <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr 1fr', sm: 'repeat(4, minmax(0, 1fr))' }, gap: 1, mt: 3, position: 'relative' }}>
          {[
            { label: 'Start date', value: startDate ? format(startDate, 'MMM d, yyyy') : 'Not set', icon: <CalendarOutlined /> },
            { label: 'End date', value: endDate ? format(endDate, 'MMM d, yyyy') : 'Not set', icon: <CalendarOutlined /> },
            { label: 'Monthly rent', value: rentAmount > 0 ? formatCurrency(rentAmount) : 'Not set', icon: <DollarOutlined /> },
            { label: 'Tenant', value: tenantFullName || 'Not assigned', icon: <UserOutlined /> },
          ].map((item) => (
            <Box key={item.label} sx={{ p: 1.35, borderRadius: 2, bgcolor: alpha('#fff', 0.075), border: `1px solid ${alpha('#fff', 0.1)}` }}>
              <Stack direction="row" alignItems="center" spacing={0.75} sx={{ color: alpha('#fff', 0.58), mb: 0.45 }}>
                {item.icon}
                <Typography sx={{ fontSize: '0.62rem', fontWeight: 700, letterSpacing: 0.65, textTransform: 'uppercase', color: 'inherit' }}>{item.label}</Typography>
              </Stack>
              <Typography sx={{ color: '#fff', fontWeight: 650, fontSize: '0.82rem' }}>{item.value}</Typography>
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
              <Button variant="contained" size="small" startIcon={<EditOutlined />} onClick={onEditTerms} sx={{ textTransform: 'none', fontWeight: 700, bgcolor: '#22c55e', color: '#061e35', boxShadow: 'none', '&:hover': { bgcolor: '#16a34a', boxShadow: 'none' } }}>
                Edit lease details
              </Button>
            </Stack>
          </Stack>
        </Box>
      )}

      {/* ── Lifecycle bars ────────────────────────────────────────────────── */}
      <Grid container spacing={2} sx={{ mb: 2 }}>
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
              <Typography
                variant="caption"
                color="primary"
                sx={{ fontWeight: 600, fontSize: '0.68rem', cursor: 'pointer' }}
                onClick={() => navigate(leaseAgreementSetupUrl)}
              >
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

      {/* ── 8 / 4 grid layout ─────────────────────────────────────────────── */}
      <Grid container spacing={2}>

        {/* ── Left col (8) ───────────────────────────────────────────────── */}
        <Grid size={{ xs: 12, lg: 8 }}>
          <Stack spacing={2}>

            {/* Payment heartbeat */}
            <SectionCard title={isDraftLease ? 'Payment schedule' : 'Payment heartbeat'}>
              {isDraftLease ? (
                <Box sx={{ py: 2, px: 1, textAlign: 'center' }}>
                  <Typography sx={{ fontSize: '0.82rem', fontWeight: 700, mb: 0.5 }}>No payment cycles yet</Typography>
                  <Typography sx={{ fontSize: '0.72rem', color: 'text.secondary', maxWidth: 430, mx: 'auto' }}>
                    Payment tracking begins after this lease is completed and reaches its start date.
                  </Typography>
                </Box>
              ) : (
                <>
                  <Typography sx={{ fontSize: '0.7rem', color: 'text.secondary', mb: 1.25 }}>
                    {paymentCalendar.length} scheduled {paymentCalendar.length === 1 ? 'payment' : 'payments'}
                  </Typography>
                  <Box sx={{ display: 'grid', gridTemplateColumns: `repeat(${Math.max(1, Math.min(paymentCalendar.length, 6))}, 1fr)`, gap: 0.75, mb: 1 }}>
                    {paymentCalendar.map((m) => (
                      <Box key={m.key} sx={{
                        borderRadius: 1.5, border: '1px solid',
                        borderColor: m.overdue ? theme.palette.error.main : m.paidLate ? theme.palette.warning.main : m.paid ? alpha(theme.palette.success.main, 0.3) : m.upcoming ? alpha(theme.palette.primary.main, 0.4) : subtleDivider(theme, 0.24, 0.16),
                        bgcolor: m.overdue ? alpha(theme.palette.error.main, 0.07) : m.paidLate ? alpha(theme.palette.warning.main, 0.07) : m.paid ? alpha(theme.palette.success.main, 0.07) : m.upcoming ? alpha(theme.palette.primary.main, 0.05) : alpha(theme.palette.text.primary, 0.03),
                        p: 0.75, textAlign: 'center'
                      }}>
                        <Typography sx={{ fontSize: '0.6rem', fontWeight: 700, color: 'text.secondary', letterSpacing: 0.3, mb: 0.2 }}>
                          {m.label}
                        </Typography>
                        <Typography sx={{ fontSize: '0.72rem', fontWeight: 700, color: m.overdue ? 'error.main' : m.paidLate ? 'warning.main' : m.paid ? 'success.main' : m.upcoming ? 'primary.main' : 'text.disabled' }}>
                          {formatCurrency(m.amount)}
                        </Typography>
                        {m.isProrated && (
                          <Typography sx={{ fontSize: '0.52rem', fontWeight: 700, color: 'text.secondary', textTransform: 'uppercase', letterSpacing: 0.25 }}>
                            prorated
                          </Typography>
                        )}
                      </Box>
                    ))}
                  </Box>
                  <Stack direction="row" spacing={2} flexWrap="wrap" useFlexGap>
                    {[
                      { color: alpha(theme.palette.success.main, 0.3), label: 'paid on time' },
                      { color: theme.palette.warning.main, label: 'paid late' },
                      { color: theme.palette.error.main, label: 'overdue' },
                      { color: alpha(theme.palette.primary.main, 0.4), label: 'upcoming' },
                      { color: alpha(theme.palette.text.primary, 0.1), label: 'future' },
                    ].map(item => (
                      <Stack key={item.label} direction="row" alignItems="center" spacing={0.5}>
                        <Box sx={{ width: 8, height: 8, borderRadius: 0.5, bgcolor: item.color }} />
                        <Typography sx={{ fontSize: '0.62rem', color: 'text.disabled' }}>{item.label}</Typography>
                      </Stack>
                    ))}
                  </Stack>
                </>
              )}
            </SectionCard>

            {/* Key terms */}
            <SectionCard
              title="Key terms"
              action={
                <Typography
                  variant="caption"
                  color="primary"
                  sx={{ fontWeight: 600, fontSize: '0.68rem', cursor: 'pointer' }}
                  onClick={hasLeaseAgreementDocument ? onViewAgreement : () => navigate(leaseAgreementSetupUrl)}
                >
                  {hasLeaseAgreementDocument ? 'View full agreement →' : '+ Create agreement'}
                </Typography>
              }
            >
              <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', sm: '1fr 1fr', md: 'repeat(3, 1fr)' }, gap: 1 }}>
                {[
                  { label: 'Lease length', value: leaseLength ? `${leaseLength} months` : 'Not set', sub: startDate && endDate ? `${format(startDate, 'MMM d yyyy')} – ${format(endDate, 'MMM d yyyy')}` : 'Add start and end dates' },
                  { label: 'Monthly rent', value: rentAmount > 0 ? formatCurrency(rentAmount) : 'Not set', sub: rentAmount > 0 ? `Due day ${lease.rentDueDay || lease.RentDueDay || 1} · ${lease.lateFeeGracePeriod || lease.LateFeeGracePeriod || 5}d grace` : 'Add rent terms' },
                  { label: 'Security deposit', value: depositAmount > 0 ? formatCurrency(depositAmount) : 'Not set', sub: depositAmount > 0 ? (deposits?.length ? 'received' : 'pending') : null },
                  { label: 'Late fee',          value: lateFeeAmount > 0 ? formatCurrency(lateFeeAmount) : 'None', sub: lateFeeAmount > 0 ? `after day ${lease.lateFeeGracePeriod || 5}` : null },
                  { label: 'Auto-renew',        value: (lease.autoRenew || lease.AutoRenew) ? 'ON' : 'OFF', sub: 'month-to-month 2-alert' },
                  { label: 'Notice period',     value: '60 days', sub: 'either party' },
                ].map(item => (
                  <Box key={item.label} sx={{ p: 1, borderRadius: 1.25, bgcolor: alpha(theme.palette.text.primary, theme.palette.mode === 'dark' ? 0.05 : 0.03), border: `1px solid ${subtleDivider(theme, 0.22, 0.14)}` }}>
                    <Typography sx={{ ...detailHeaderSx, fontSize: '0.6rem', letterSpacing: 0.4, mb: 0.3 }}>
                      {item.label}
                    </Typography>
                    <Typography sx={{ fontSize: '0.82rem', fontWeight: 700 }}>{item.value}</Typography>
                    {item.sub && <Typography sx={{ fontSize: '0.62rem', color: 'text.secondary' }}>{item.sub}</Typography>}
                  </Box>
                ))}
              </Box>
              <Button size="small" startIcon={<PlusOutlined style={{ fontSize: 10 }} />}
                onClick={onUploadDocument}
                sx={{ mt: 1.25, textTransform: 'none', fontSize: '0.72rem', color: 'text.secondary', justifyContent: 'flex-start', py: 0.4 }}>
                Upload addendum
              </Button>
            </SectionCard>

            {/* Documents */}
            <SectionCard
              title="Documents"
              action={
                <Button size="small" variant="outlined" startIcon={<UploadOutlined style={{ fontSize: 11 }} />} onClick={onUploadDocument}
                  sx={{ textTransform: 'none', fontSize: '0.7rem', borderRadius: 1.25, px: 1.25, py: 0.35, borderColor: (t) => subtleDivider(t, 0.34, 0.24) }}>
                  + upload
                </Button>
              }
            >
              {docs.length > 0 ? (
                <Stack spacing={0.75}>
                  {docs.map((d, i) => (
                    <Stack key={i} direction="row" alignItems="center" spacing={1} onClick={d.onClick}
                      sx={{ p: 1, borderRadius: 1.25, border: (t) => `1px solid ${subtleDivider(t, 0.22, 0.14)}`, cursor: 'pointer', '&:hover': { bgcolor: alpha(theme.palette.primary.main, 0.03) } }}>
                      <FileTextOutlined style={{ fontSize: 16, color: theme.palette.text.secondary, flexShrink: 0 }} />
                      <Box sx={{ flex: 1, minWidth: 0 }}>
                        <Typography sx={{ fontSize: '0.75rem', fontWeight: 500 }}>{d.name}</Typography>
                        {d.tag && <Typography sx={{ fontSize: '0.62rem', color: 'text.disabled' }}>{d.tag}</Typography>}
                      </Box>
                      <ArrowRightOutlined style={{ fontSize: 11, color: theme.palette.text.disabled }} />
                    </Stack>
                  ))}
                </Stack>
              ) : (
                <Stack alignItems="center" spacing={1} sx={{ py: 2 }}>
                  <Typography sx={{ fontSize: '0.75rem', color: 'text.secondary' }}>No documents uploaded</Typography>
                  <Button size="small" variant="outlined" onClick={onUploadDocument}
                    sx={{ textTransform: 'none', fontSize: '0.72rem', borderRadius: 1.25, borderColor: (t) => subtleDivider(t, 0.34, 0.24) }}>
                    Upload lease agreement
                  </Button>
                </Stack>
              )}
            </SectionCard>

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
        </Grid>

        {/* ── Right col (4) ──────────────────────────────────────────────── */}
        <Grid size={{ xs: 12, lg: 4 }}>
          <Stack spacing={2}>

            {/* Lease summary */}
            <Box sx={{
              p: 2, borderRadius: 2,
              bgcolor: `${summaryColor}12`,
              border: `1.5px dashed ${summaryColor}`,
            }}>
              <Stack direction="row" alignItems="center" spacing={0.75} sx={{ mb: 1 }}>
                <StarFilled style={{ fontSize: 12, color: summaryColor }} />
                <Typography sx={{ fontSize: '0.62rem', fontWeight: 700, letterSpacing: 0.8, color: summaryColor, textTransform: 'uppercase' }}>
                  {isDraftLease ? 'Draft setup' : `Lease health · ${healthLabel}`}
                </Typography>
              </Stack>
              {isDraftLease ? (
                <>
                  <Typography sx={{ fontSize: '0.78rem', fontWeight: 650, color: 'text.primary', mb: 0.75 }}>
                    This lease is not active yet
                  </Typography>
                  <Typography sx={{ fontSize: '0.7rem', color: 'text.secondary', lineHeight: 1.55 }}>
                    {startDate ? `Planned start: ${format(startDate, 'MMMM d, yyyy')}. ` : 'A start date still needs to be set. '}
                    Health and payment insights will appear after the lease starts.
                  </Typography>
                </>
              ) : (
                <>
                  <Typography sx={{ fontSize: '0.78rem', fontWeight: 600, color: 'text.primary', mb: 0.75 }}>
                    {paidCycles} of {paymentCalendar.length || leaseLength || '—'} cycles paid · {lateCycles} late
                    {minorIssues > 0 ? ` · ${minorIssues} minor issue${minorIssues !== 1 ? 's' : ''}` : ''}
                    {daysUntilEnd !== null && daysUntilEnd <= 180 ? ` (renewal in ${daysUntilEnd}d)` : ''}
                  </Typography>
                  <Typography sx={{ fontSize: '0.7rem', color: 'text.secondary', lineHeight: 1.5 }}>
                    {lateCycles === 0
                      ? 'tenant has perfect payment record · '
                      : `${lateCycles} late payment${lateCycles !== 1 ? 's' : ''} on record · `}
                    {minorIssues === 0 ? 'maintenance volume normal · ' : `${minorIssues} open issue${minorIssues !== 1 ? 's' : ''} · `}
                    {renewalGuidance}
                  </Typography>
                </>
              )}
            </Box>

            {/* Tenants */}
            <TenantsCard
              tenants={tenants}
              property={property}
              onAddTenant={onAddTenant}
            />

            {/* Ledger — this lease in money */}
            <SectionCard
              title="This lease, in money"
              action={
                <Typography variant="caption" color="primary" onClick={() => navigate(`/landlord/leases/${leaseId}/payment-history`)} sx={{ fontWeight: 600, fontSize: '0.68rem', cursor: 'pointer' }}>
                  Payment history →
                </Typography>
              }
            >
              <Stack spacing={1.25}>
                {[
                  { label: 'Total contract value', value: formatCurrency(totalContractVal),  sub: null,                             valueColor: 'text.primary' },
                  { label: 'Collected to date',    value: formatCurrency(totalCollected),    sub: `${paidCycles} cycles · ${onTimePct}% on time`, valueColor: 'text.primary' },
                  { label: 'Outstanding',          value: outstandingAmt > 0 ? formatCurrency(outstandingAmt) : '$0', sub: outstandingAmt > 0 ? 'next due' : null, valueColor: outstandingAmt > 0 ? 'error.main' : 'text.primary' },
                  { label: 'Deposit held',         value: formatCurrency(depositHeld),       sub: 'in trust · refundable',          valueColor: 'text.primary' },
                  { label: 'Late fees waived',     value: '$0',                              sub: 'no late events',                 valueColor: 'text.primary' },
                ].map((row, i, arr) => (
                  <Stack key={row.label} direction="row" alignItems="flex-start" justifyContent="space-between"
                    sx={{ pb: i < arr.length - 1 ? 1.25 : 0, borderBottom: i < arr.length - 1 ? `1px solid ${subtleDivider(theme, 0.16, 0.1)}` : 'none' }}>
                    <Box>
                      <Typography sx={{ fontSize: '0.72rem', color: 'text.secondary' }}>{row.label}</Typography>
                      {row.sub && <Typography sx={{ fontSize: '0.62rem', color: 'text.disabled' }}>{row.sub}</Typography>}
                    </Box>
                    <Typography sx={{ fontSize: '0.9rem', fontWeight: 700, color: row.valueColor }}>{row.value}</Typography>
                  </Stack>
                ))}
              </Stack>
            </SectionCard>

            {/* Lease Actions */}
            <SectionCard title="Lease actions">
              <Stack>
                {lease?.isActive && (
                  <Box onClick={handleEndLeaseClick} sx={{ py: 0.85, borderBottom: (t) => `1px solid ${subtleDivider(t, 0.14, 0.08)}`, cursor: 'pointer', px: 0.5, borderRadius: 1, '&:hover': { bgcolor: alpha(theme.palette.error.main, 0.04) } }}>
                    <Typography sx={{ fontSize: '0.78rem', fontWeight: 600, color: 'error.main' }}>End lease early</Typography>
                    <Typography sx={{ fontSize: '0.65rem', color: 'text.secondary' }}>60-day notice</Typography>
                  </Box>
                )}
                {!lease?.isActive && !isNotStarted && (
                  <Box onClick={handleReopenLeaseClick} sx={{ py: 0.85, borderBottom: (t) => `1px solid ${subtleDivider(t, 0.14, 0.08)}`, cursor: 'pointer', px: 0.5, borderRadius: 1, '&:hover': { bgcolor: alpha(theme.palette.success.main, 0.04) } }}>
                    <Typography sx={{ fontSize: '0.78rem', fontWeight: 600, color: 'success.main' }}>Reopen lease</Typography>
                    <Typography sx={{ fontSize: '0.65rem', color: 'text.secondary' }}>Restores to active</Typography>
                  </Box>
                )}
                <Box onClick={onRenew} sx={{ py: 0.85, borderBottom: (t) => `1px solid ${subtleDivider(t, 0.14, 0.08)}`, cursor: 'pointer', px: 0.5, borderRadius: 1, '&:hover': { bgcolor: alpha(theme.palette.primary.main, 0.04) } }}>
                  <Typography sx={{ fontSize: '0.78rem', fontWeight: 600 }}>Renew lease</Typography>
                  <Typography sx={{ fontSize: '0.65rem', color: 'text.secondary' }}>Create successor lease</Typography>
                </Box>
                <Box onClick={onEditTerms} sx={{ py: 0.85, cursor: 'pointer', px: 0.5, borderRadius: 1, '&:hover': { bgcolor: alpha(theme.palette.primary.main, 0.04) } }}>
                  <Typography sx={{ fontSize: '0.78rem', fontWeight: 600 }}>Edit lease terms</Typography>
                  <Typography sx={{ fontSize: '0.65rem', color: 'text.secondary' }}>Update rent, dates, or conditions</Typography>
                </Box>
              </Stack>
            </SectionCard>

          </Stack>
        </Grid>
      </Grid>

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
