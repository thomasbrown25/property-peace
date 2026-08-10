import ThemeAdaptiveDrawer from 'components/drawers/shared/ThemeAdaptiveDrawer';
import { useState, useMemo, useEffect, useRef } from 'react';
import { useDashboardLoading } from 'contexts/DashboardLoadingContext';
import {
  Box,
  Typography,
  Stack,
  Button,
  CircularProgress,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Paper,
  Chip,
  IconButton,
  Tooltip,
  alpha,
  useTheme,
  Grid,
  useMediaQuery,
  Menu,
  MenuItem,
  Select,
  FormControl,
  OutlinedInput,
  InputAdornment,
  Fade,
  Tabs,
  Tab,
  Card,
  CardContent,
  Slide,
  LinearProgress,
  Checkbox,
  TextField,
  Divider,
  Avatar
} from '@mui/material';
import MainCard from 'components/MainCard';
import AnimateIn from 'components/AnimateIn';
import {
  PlusOutlined,
  HomeOutlined,
  CalendarOutlined,
  DollarOutlined,
  EditOutlined,
  CloseCircleOutlined,
  ArrowUpOutlined,
  ArrowDownOutlined,
  ReloadOutlined,
  RedoOutlined,
  AlertOutlined,
  ClockCircleOutlined,
  CheckCircleOutlined,
  FileTextOutlined,
  EyeOutlined,
  LeftOutlined,
  RightOutlined,
  FormOutlined,
  MoreOutlined,
  SearchOutlined
} from '@ant-design/icons';

import { useDispatch, useSelector } from 'react-redux';
import { selectProperties, selectProperty } from 'store/property/property.selector';
import { setProperty } from 'store/property/property.action';
import { selectUnit } from 'store/unit/unit.selector';
import { setUnit } from 'store/unit/unit.action';
import { useDrawer } from 'contexts/DrawerContext';
import LeaseAddDrawer from 'components/drawers/LeaseAddDrawer';
import LeaseViewDrawer from 'components/drawers/LeaseViewDrawer';
import LeaseEditDrawer from '../../components/drawers/LeaseEditDrawer';
import RenewLeaseDrawer from 'components/drawers/RenewLeaseDrawer';
import FilterDeleteIcon from 'components/FilterDeleteIcon';
import useFetchProperties from 'hooks/useFetchProperties';
import { useNavigate, useSearchParams, useLocation } from 'react-router-dom';
import { formatCurrency, formatDate, formatRentStatus, getRentStatusColor } from 'utils/formatters';
import { getLeaseTermLabel } from 'utils/leaseTermLabel';
import { endLease, reopenLease, setLease } from 'store/lease/lease.action';
import { getAllPayments } from 'store/payment/payment.action';
import { selectAllPayments } from 'store/payment/payment.selector';
import { openSnackbar } from 'api/snackbar';
import axiosServices from 'utils/axios';
import ConfirmationDialog from 'components/dialogs/ConfirmationDialog';
import { getSettings, saveSettings } from 'store/user/user.action';
import { selectUserSettings } from 'store/user/user.selector';
import useFetchRentCollection from 'hooks/useFetchRentCollection';
import { tenantDocumentAPI } from 'api';

// Enhanced components
import LeasesHeader from 'sections/landlord/leases/LeasesHeader';

// TabPanel component with slide animation
function TabPanel({ children, value, index, slideDirection, ...other }) {
  const isActive = value === index;
  return (
    <div role="tabpanel" hidden={!isActive} {...other}>
      {isActive && (
        <Slide
          direction={slideDirection}
          in={isActive}
          mountOnEnter
          unmountOnExit
          timeout={300}
        >
          <Box sx={{ pt: 3 }}>{children}</Box>
        </Slide>
      )}
    </div>
  );
}

const sectionCardSx = {
  p: 2,
  borderRadius: 2,
  bgcolor: 'background.paper',
  border: '1px solid',
  borderColor: (t) => alpha(t.palette.divider, t.palette.mode === 'dark' ? 0.22 : 0.14),
  boxShadow: (t) =>
    t.palette.mode === 'dark'
      ? `0 0 0 1px ${alpha(t.palette.primary.main, 0.22)}, 0 8px 28px ${alpha(t.palette.primary.main, 0.14)}`
      : `0 2px 12px ${alpha(t.palette.primary.main, 0.08)}`
};

const leaseSectionHeaderSx = {
  fontSize: '0.72rem',
  fontWeight: 700,
  letterSpacing: 0.8,
  color: 'text.secondary',
  textTransform: 'uppercase'
};

function SummaryCard({ label, value, helper, icon, color, active, onClick }) {
  const theme = useTheme();

  return (
    <Box
      component="button"
      type="button"
      onClick={onClick}
      sx={{
        width: '100%',
        minHeight: 112,
        p: 2,
        borderRadius: 2.5,
        border: `1px solid ${active ? alpha(color, 0.55) : alpha(theme.palette.divider, 0.16)}`,
        bgcolor: active ? alpha(color, theme.palette.mode === 'dark' ? 0.12 : 0.055) : 'background.paper',
        boxShadow: active ? `0 8px 24px ${alpha(color, 0.12)}` : `0 4px 18px ${alpha('#061e35', 0.05)}`,
        color: 'text.primary',
        textAlign: 'left',
        cursor: 'pointer',
        font: 'inherit',
        transition: 'transform 150ms ease, border-color 150ms ease, box-shadow 150ms ease',
        '&:hover': { transform: 'translateY(-2px)', borderColor: alpha(color, 0.45), boxShadow: `0 10px 28px ${alpha(color, 0.12)}` },
        '&:focus-visible': { outline: `3px solid ${alpha(color, 0.28)}`, outlineOffset: 2 }
      }}
    >
      <Stack direction="row" justifyContent="space-between" alignItems="flex-start" spacing={1.5}>
        <Box minWidth={0}>
          <Typography sx={{ fontSize: '0.72rem', fontWeight: 700, letterSpacing: 0.65, textTransform: 'uppercase', color: 'text.secondary' }}>
            {label}
          </Typography>
          <Typography sx={{ mt: 0.55, fontSize: '1.45rem', lineHeight: 1.15, fontWeight: 750 }} noWrap>{value}</Typography>
          <Typography sx={{ mt: 0.55, fontSize: '0.75rem', color: 'text.secondary' }} noWrap>{helper}</Typography>
        </Box>
        <Avatar sx={{ width: 38, height: 38, bgcolor: alpha(color, 0.12), color }}>{icon}</Avatar>
      </Stack>
    </Box>
  );
}

const getLeaseDisplayName = (lease) => {
  const leaseName = lease.name || lease.Name;
  if (leaseName && leaseName.trim()) return leaseName.trim();

  const propertyName = lease.propertyName || '';
  const propertyStreetAddress = lease.propertyStreetAddress || '';
  const unitName = lease.unitName || '';
  const propertyType = lease.propertyType || '';

  let displayPropertyName = propertyName;
  if (!displayPropertyName && propertyStreetAddress) {
    let streetOnly = propertyStreetAddress.trim();
    if (streetOnly.includes(',')) {
      streetOnly = streetOnly.split(',')[0].trim();
    } else {
      streetOnly = streetOnly.replace(/\s+\d{5}(-\d{4})?$/, '').trim();
    }
    displayPropertyName = streetOnly;
  }

  if (propertyType?.toLowerCase() === 'singlefamily') return displayPropertyName || 'Lease';
  const isMeaningfulUnitName = unitName && unitName.trim() && !unitName.match(/^-\s*\d+$/);
  if (isMeaningfulUnitName) return displayPropertyName ? `${displayPropertyName} · ${unitName}` : unitName || 'Lease';
  return displayPropertyName || 'Lease';
};

const getTenantDisplay = (lease) => {
  const primaryTenant = lease.tenants?.[0];
  const first = primaryTenant?.firstname || primaryTenant?.firstName || primaryTenant?.Firstname || primaryTenant?.FirstName || '';
  const last = primaryTenant?.lastname || primaryTenant?.lastName || primaryTenant?.Lastname || primaryTenant?.LastName || '';
  return [first, last].filter(Boolean).join(' ') || lease.tenantName || lease.TenantName || 'No tenants added';
};

const isLeaseDraft = (lease) =>
  lease?.leaseAgreement?.isDrafted === true ||
  lease?.leaseAgreement?.IsDrafted === true ||
  lease?.isDrafted === true ||
  lease?.IsDrafted === true;

const isStartedActiveLease = (lease) => {
  const isActive = lease?.isActive === true || lease?.IsActive === true || lease?.isActive === 1 || lease?.IsActive === 1;
  if (!lease || lease.hasLease === false || !isActive || isLeaseDraft(lease)) return false;

  const startDateValue = lease.startDate ?? lease.StartDate;
  if (!startDateValue) return false;

  const startDate = new Date(startDateValue);
  if (Number.isNaN(startDate.getTime())) return false;
  startDate.setHours(0, 0, 0, 0);

  const todayStart = new Date();
  todayStart.setHours(0, 0, 0, 0);
  if (startDate > todayStart) return false;

  const endDateValue = lease.endDate ?? lease.EndDate;
  if (!endDateValue) return true;

  const endDate = new Date(endDateValue);
  if (Number.isNaN(endDate.getTime())) return false;
  endDate.setHours(23, 59, 59, 999);
  return endDate >= todayStart;
};

const getPropertyTenantTitle = (lease) => {
  const propertyName = lease.propertyName || lease.propertyStreetAddress || 'Property';
  const cleanPropertyName = propertyName.includes(',') ? propertyName.split(',')[0].trim() : propertyName;
  const unitName = lease.unitName || '';
  if (!unitName || unitName.match(/^-\s*\d+$/)) return cleanPropertyName;
  const displayUnit = unitName.startsWith('#') ? unitName : `#${unitName}`;
  return `${cleanPropertyName}, ${displayUnit}`;
};

const getLeaseMonths = (lease) => {
  if (!isStartedActiveLease(lease) || !lease.startDate || !lease.endDate) {
    return { current: 0, total: 0, progress: 0, daysLeft: null, overDays: null };
  }
  const start = new Date(lease.startDate);
  const end = new Date(lease.endDate);
  const now = new Date();
  const total = Math.max(1, lease.leaseLength || Math.round((end - start) / (1000 * 60 * 60 * 24 * 30.44)));
  const elapsed = Math.min(total, Math.max(0, Math.floor((now - start) / (1000 * 60 * 60 * 24 * 30.44)) + 1));
  const daysLeft = Math.ceil((end - now) / 86400000);
  return {
    current: elapsed,
    total,
    progress: Math.min(100, Math.max(0, (elapsed / total) * 100)),
    daysLeft: Math.max(0, daysLeft),
    overDays: daysLeft < 0 ? Math.abs(daysLeft) : null
  };
};

function RiskMetric({ label, value, color = 'success.main', progress = 0, note }) {
  return (
    <Box>
      <Stack direction="row" alignItems="center" justifyContent="space-between" sx={{ mb: 0.4 }}>
        <Typography sx={{ fontSize: '0.82rem', color: 'text.secondary', fontWeight: 500 }}>{label}</Typography>
        <Typography sx={{ fontSize: '0.88rem', fontWeight: 700 }}>{value}</Typography>
      </Stack>
      <LinearProgress
        variant="determinate"
        value={Math.min(100, Math.max(0, progress))}
        sx={{
          height: 5,
          borderRadius: 99,
          bgcolor: (t) => alpha(t.palette.divider, t.palette.mode === 'dark' ? 0.32 : 0.28),
          '& .MuiLinearProgress-bar': { borderRadius: 99, bgcolor: color }
        }}
      />
      {note && <Typography sx={{ mt: 0.35, fontSize: '0.68rem', color, fontWeight: 700 }}>{note}</Typography>}
    </Box>
  );
}

function PortfolioRiskCard({ leases, rentRecords }) {
  const activeLeases = leases.filter((lease) => isStartedActiveLease(lease));
  const totalUnits = leases.length || activeLeases.length;
  const coverage = totalUnits ? Math.round((activeLeases.length / totalUnits) * 100) : 0;
  const paidRecords = rentRecords?.filter((record) => record.status) || [];
  const onTimeRecords = paidRecords.filter((record) => record.status === 'upToDate' || record.status === 'paid').length;
  const onTimeRate = paidRecords.length ? Math.round((onTimeRecords / paidRecords.length) * 100) : 0;
  const termValues = activeLeases
    .map((lease) => lease.endDate ? Math.max(0, Math.ceil((new Date(lease.endDate) - new Date()) / 86400000)) : null)
    .filter((value) => value !== null);
  const avgTerm = termValues.length ? Math.round(termValues.reduce((sum, value) => sum + value, 0) / termValues.length) : 0;
  const riskLevel = coverage >= 80 && onTimeRate >= 90 ? 'healthy' : coverage >= 60 && onTimeRate >= 75 ? 'watch' : 'at risk';
  const riskColor = riskLevel === 'healthy' ? 'success.main' : riskLevel === 'watch' ? 'warning.main' : 'error.main';

  return (
    <Box sx={sectionCardSx}>
      <Stack direction="row" alignItems="center" justifyContent="space-between" sx={{ mb: 2 }}>
        <Typography sx={leaseSectionHeaderSx}>
          Portfolio Risk
        </Typography>
        <Typography sx={{ fontSize: '0.78rem', color: riskColor, fontWeight: 700 }}>• {riskLevel}</Typography>
      </Stack>
      <Stack spacing={1.45}>
        <RiskMetric label="Lease coverage" value={`${activeLeases.length} of ${totalUnits}`} progress={coverage} color="success.main" />
        <RiskMetric label="On-time payment rate" value={`${onTimeRate}%`} progress={onTimeRate} color="success.main" />
        <RiskMetric label="Avg term remaining" value={`${avgTerm || '—'}${avgTerm ? ' days' : ''}`} progress={Math.min(100, (avgTerm / 365) * 100)} color="primary.main" />
      </Stack>
    </Box>
  );
}

function UpcomingCard({ leases, rentRecords, onCalendarClick }) {
  const upcomingItems = useMemo(() => {
    const items = [];
    rentRecords?.forEach((record) => {
      if (record.dueDate) {
        const lease = leases.find((l) => l.id === record.leaseId);
        const leaseDisplay = getLeaseDisplayName(lease || {});

        // If rent is overdue, show the past-due entry (dueDate is NextDueDate i.e. future;
        // the unpaid date is one cycle back). Include it so it appears before future items.
        if (record.overdueAmount > 0) {
          const nextDate = new Date(record.dueDate);
          const overdueDate = new Date(nextDate);
          overdueDate.setMonth(overdueDate.getMonth() - 1);
          items.push({ date: overdueDate, title: 'Rent overdue', subtitle: `${leaseDisplay} · ${formatCurrency(record.overdueAmount)}` });
        } else {
          items.push({ date: new Date(record.dueDate), title: 'Rent due', subtitle: `${leaseDisplay} · ${formatCurrency(record.remainingBalance || record.amount || lease?.rentAmount || 0)}` });
        }
      }
    });
    leases.forEach((lease) => {
      if (lease.startDate && new Date(lease.startDate) > new Date()) {
        items.push({ date: new Date(lease.startDate), title: `${getLeaseDisplayName(lease)} starts`, subtitle: getTenantDisplay(lease) });
      }
      if (lease.endDate) {
        const endDate = new Date(lease.endDate);
        const days = Math.ceil((endDate - new Date()) / 86400000);
        if (days >= 0 && days <= 90) items.push({ date: endDate, title: `${getTenantDisplay(lease)} lease ends`, subtitle: 'renewal window: now' });
      }
    });
    return items.sort((a, b) => a.date - b.date).slice(0, 4);
  }, [leases, rentRecords]);

  return (
    <Box sx={sectionCardSx}>
      <Stack direction="row" alignItems="center" justifyContent="space-between" sx={{ mb: 1.5 }}>
        <Typography sx={leaseSectionHeaderSx}>
          Upcoming
        </Typography>
        <Button size="small" onClick={onCalendarClick} sx={{ minWidth: 0, p: 0, fontSize: '0.78rem', fontWeight: 700, textTransform: 'none' }}>Calendar →</Button>
      </Stack>
      <Stack spacing={1.25}>
        {upcomingItems.length ? upcomingItems.map((item, index) => (
          <Stack key={`${item.title}-${index}`} direction="row" spacing={1.25} alignItems="center">
            <Box sx={{ width: 58, py: 0.65, borderRadius: 1.5, bgcolor: (t) => alpha(t.palette.primary.main, t.palette.mode === 'dark' ? 0.08 : 0.04), border: (t) => `1px solid ${alpha(t.palette.divider, t.palette.mode === 'dark' ? 0.22 : 0.12)}`, textAlign: 'center', flexShrink: 0 }}>
              <Typography sx={{ fontSize: '0.72rem', color: index === 0 ? 'success.main' : index === 1 ? 'primary.main' : 'warning.main', fontWeight: 800 }}>
                {item.date.toLocaleDateString(undefined, { month: 'short', day: 'numeric' }).toUpperCase()}
              </Typography>
            </Box>
            <Box sx={{ minWidth: 0 }}>
              <Typography sx={{ fontSize: '0.9rem', fontWeight: 700, lineHeight: 1.25 }} noWrap>{item.title}</Typography>
              <Typography sx={{ fontSize: '0.75rem', color: 'text.secondary' }} noWrap>{item.subtitle}</Typography>
            </Box>
          </Stack>
        )) : (
          <Typography variant="body2" color="text.secondary">No upcoming lease events.</Typography>
        )}
      </Stack>
    </Box>
  );
}

const getPaymentLeaseId = (payment) => Number(payment?.leaseId ?? payment?.LeaseId);
const getPaymentAmount = (payment) => parseFloat(payment?.amount ?? payment?.Amount) || 0;
const getPaymentDate = (payment) => payment?.paymentDate ?? payment?.PaymentDate;

const isRentPayment = (payment) => {
  const typeStr = String(payment?.type ?? payment?.Type ?? '').toLowerCase();
  const statusStr = String(payment?.status ?? payment?.Status ?? '').toLowerCase();

  return !payment?.feeId && !payment?.FeeId && !payment?.depositId && !payment?.DepositId &&
    !typeStr.includes('fee') && !typeStr.includes('deposit') &&
    (!statusStr || ['completed', 'paid', 'succeeded', 'success'].includes(statusStr));
};

const buildPaymentCycleCalendar = ({ lease, payments = [], now = new Date() }) => {
  const startDateValue = lease?.startDate ?? lease?.StartDate;
  const endDateValue = lease?.endDate ?? lease?.EndDate;
  const rentAmount = parseFloat(lease?.rentAmount ?? lease?.RentAmount) || 0;
  if (!startDateValue || !endDateValue || rentAmount <= 0) return [];

  const startDate = new Date(startDateValue);
  const endDate = new Date(endDateValue);
  if (Number.isNaN(startDate.getTime()) || Number.isNaN(endDate.getTime())) return [];

  const rentDueDay = lease?.rentDueDay ?? lease?.RentDueDay ?? 1;
  const gracePeriod = lease?.lateFeeGracePeriod ?? lease?.LateFeeGracePeriod ?? 5;
  const nowMonth = new Date(now.getFullYear(), now.getMonth(), 1);
  const nextMonth = new Date(now.getFullYear(), now.getMonth() + 1, 1);

  const rentPayments = (payments || [])
    .filter(isRentPayment)
    .sort((a, b) => new Date(getPaymentDate(a)) - new Date(getPaymentDate(b)));

  let running = 0;
  const milestones = rentPayments.map((payment) => {
    running += getPaymentAmount(payment);
    return { date: new Date(getPaymentDate(payment)), cumulative: running };
  });

  const months = [];
  let cursor = new Date(startDate.getFullYear(), startDate.getMonth(), 1);
  const calEnd = new Date(endDate.getFullYear(), endDate.getMonth() + 1, 1);
  let cycleNum = 0;

  while (cursor < calEnd && months.length < 24) {
    const required = (cycleNum + 1) * rentAmount;
    const milestone = milestones.find((m) => m.cumulative >= required);
    const isPaid = !!milestone;
    const isPast = cursor < nowMonth;
    const isCurrent = cursor.getTime() === nowMonth.getTime();
    const isNext = cursor.getTime() === nextMonth.getTime();
    const lateDate = new Date(cursor.getFullYear(), cursor.getMonth(), rentDueDay + gracePeriod);
    const isOverdue = !isPaid && (isPast || (isCurrent && now > lateDate));
    const isUpcoming = !isPaid && !isOverdue && (isNext || (isCurrent && now <= lateDate));
    const isPaidLate = isPaid && milestone.date > lateDate;

    months.push({ paid: isPaid, paidLate: isPaidLate, overdue: isOverdue, upcoming: isUpcoming });
    cycleNum += 1;
    cursor = new Date(cursor.getFullYear(), cursor.getMonth() + 1, 1);
  }

  return months;
};

function PaymentHeartbeat({ lease, payments }) {
  const theme = useTheme();
  const isActiveLease = isStartedActiveLease(lease);
  const paymentCalendar = isActiveLease ? buildPaymentCycleCalendar({ lease, payments }) : [];
  const visibleMonths = 12;
  const paid = paymentCalendar.filter((month) => month.paid).length;
  const paidLate = paymentCalendar.filter((month) => month.paidLate).length;
  const overdue = paymentCalendar.filter((month) => month.overdue).length;
  const late = paidLate + overdue;
  const current = isActiveLease
    ? Math.min(visibleMonths - 1, Math.max(0, paymentCalendar.findIndex((month) => month.upcoming || month.overdue)))
    : -1;

  return (
    <Box>
      <Stack direction="row" spacing={0.35} alignItems="center" sx={{ mb: 0.55 }}>
        {Array.from({ length: visibleMonths }).map((_, index) => {
          const month = paymentCalendar[index];
          const color = month?.paidLate
            ? 'warning.main'
            : month?.paid
              ? 'success.main'
              : month?.overdue
                ? 'error.main'
                : month?.upcoming || index === current
                  ? 'rgba(34, 197, 94, 0.18)'
                  : (theme.palette.mode === 'dark' ? alpha(theme.palette.divider, 0.24) : 'rgba(0,0,0,0.08)');

          return (
            <Box
              key={index}
              sx={{
                width: 8,
                height: 18,
                borderRadius: 0.6,
                border: (t) => `1px solid ${alpha(t.palette.divider, t.palette.mode === 'dark' ? 0.26 : 0.16)}`,
                bgcolor: color
              }}
            />
          );
        })}
      </Stack>
      <Typography variant="caption" color="text.secondary" sx={{ display: 'block', lineHeight: 1.2 }}>
        {isActiveLease ? `${visibleMonths}-month cycle · ${late} late this term` : 'Not started · no payment history'}
      </Typography>
    </Box>
  );
}


function CreateLeaseAgreementDrawer({ open, onClose, properties, initialLease, onSetup }) {
  const theme = useTheme();
  const [propertyId, setPropertyId] = useState('');
  const [unitId, setUnitId] = useState('');
  const [agreementName, setAgreementName] = useState('');
  const [createdLease, setCreatedLease] = useState(null);

  useEffect(() => {
    if (!open) return;
    setCreatedLease(null);
    setAgreementName('');
    setPropertyId(initialLease?.propertyId || '');
    setUnitId(initialLease?.unitId || '');
  }, [open, initialLease]);

  const selectedProperty = useMemo(() => properties?.find((p) => Number(p.id) === Number(propertyId)) || null, [properties, propertyId]);
  const unitsWithLeases = useMemo(() => (selectedProperty?.units || []).filter((unit) => unit.lease || unit.Lease), [selectedProperty]);
  const isSingleUnitProperty = useMemo(() => {
    if (!selectedProperty) return false;
    const propertyType = String(selectedProperty.propertyType || selectedProperty.PropertyType || '').toLowerCase();
    const units = selectedProperty.units || selectedProperty.Units || [];
    return units.length === 1 || propertyType.includes('single');
  }, [selectedProperty]);
  const selectedUnitForAgreement = useMemo(() => unitsWithLeases.find((unit) => Number(unit.id) === Number(unitId)) || null, [unitsWithLeases, unitId]);
  const selectedLease = selectedUnitForAgreement ? (selectedUnitForAgreement.lease || selectedUnitForAgreement.Lease) : null;

  useEffect(() => {
    if (!selectedProperty) return;
    if (isSingleUnitProperty && unitsWithLeases.length === 1 && Number(unitId) !== Number(unitsWithLeases[0].id)) {
      setUnitId(unitsWithLeases[0].id);
    }
  }, [selectedProperty, isSingleUnitProperty, unitsWithLeases, unitId]);
  const tenantLabel = selectedLease?.tenants?.length
    ? selectedLease.tenants.map((tenant) => [tenant.firstname || tenant.firstName || tenant.FirstName, tenant.lastname || tenant.lastName || tenant.LastName].filter(Boolean).join(' ')).filter(Boolean).join(', ')
    : 'No tenants added yet';

  const handleCreate = () => {
    if (!selectedLease || !selectedProperty || !selectedUnitForAgreement) return;
    const payload = {
      ...selectedLease,
      propertyId: selectedProperty.id,
      propertyName: selectedProperty.name,
      propertyStreetAddress: selectedProperty.streetAddress,
      propertyType: selectedProperty.propertyType,
      unitId: selectedUnitForAgreement.id,
      unitName: selectedUnitForAgreement.name,
      agreementName: agreementName.trim()
    };
    if (agreementName.trim()) {
      window.localStorage.setItem(`leaseAgreementName_${selectedLease.id}`, agreementName.trim());
    }
    setCreatedLease(payload);
  };

  const handleClose = () => {
    onClose?.();
  };

  return (
    <ThemeAdaptiveDrawer
      anchor="right"
      open={open}
      onClose={handleClose}
      PaperProps={{ sx: { width: { xs: '100%', sm: 520 }, bgcolor: 'background.paper' } }}
    >
      <Box sx={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
        <Box sx={{ px: 3, py: 2.5, borderBottom: `1px solid ${alpha(theme.palette.divider, 0.12)}` }}>
          <Stack direction="row" justifyContent="space-between" alignItems="flex-start" spacing={2}>
            <Box>
              <Typography variant="h5" fontWeight={800}>{createdLease ? 'Lease agreement created' : 'Create lease agreement'}</Typography>
              <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
                {createdLease ? 'Your draft is ready to set up.' : 'Choose the lease this agreement belongs to.'}
              </Typography>
            </Box>
            <IconButton onClick={handleClose} size="small"><CloseCircleOutlined /></IconButton>
          </Stack>
        </Box>

        <Box sx={{ flex: 1, overflowY: 'auto', p: 3 }}>
          {createdLease ? (
            <Stack spacing={2.5} alignItems="center" sx={{ textAlign: 'center', py: 4 }}>
              <Box sx={{ width: 72, height: 72, borderRadius: '50%', bgcolor: alpha(theme.palette.success.main, 0.12), color: 'success.main', display: 'grid', placeItems: 'center' }}>
                <CheckCircleOutlined style={{ fontSize: 36 }} />
              </Box>
              <Box>
                <Typography variant="h4" fontWeight={800}>Created successfully</Typography>
                <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
                  {createdLease.agreementName || 'Lease agreement'} is ready for setup. Complete the required sections, then finalize to generate the signing PDF.
                </Typography>
              </Box>
              <Box sx={{ width: '100%', p: 2, borderRadius: 2, border: `1px solid ${alpha(theme.palette.divider, 0.12)}`, bgcolor: alpha(theme.palette.primary.main, 0.025), textAlign: 'left' }}>
                <Typography variant="caption" color="text.secondary" fontWeight={700} sx={{ textTransform: 'uppercase', letterSpacing: 0.8 }}>Agreement</Typography>
                <Typography variant="body1" fontWeight={700}>{createdLease.propertyName || 'Property'}{createdLease.unitName ? ` · ${createdLease.unitName}` : ''}</Typography>
                <Typography variant="caption" color="text.secondary">{tenantLabel}</Typography>
              </Box>
            </Stack>
          ) : (
            <Stack spacing={2.25}>
              <Box>
                <Typography variant="caption" fontWeight={700} color="text.secondary">Property *</Typography>
                <FormControl fullWidth size="small" sx={{ mt: 0.75 }}>
                  <Select
                    value={propertyId}
                    displayEmpty
                    onChange={(e) => { setPropertyId(e.target.value); setUnitId(''); }}
                    input={<OutlinedInput />}
                  >
                    <MenuItem value="" disabled>Select a property</MenuItem>
                    {(properties || []).map((property) => (
                      <MenuItem key={property.id} value={property.id}>{property.name || property.streetAddress || `Property ${property.id}`}</MenuItem>
                    ))}
                  </Select>
                </FormControl>
              </Box>

              {isSingleUnitProperty && unitsWithLeases.length === 1 ? (
                <Box>
                  <Typography variant="caption" fontWeight={700} color="text.secondary">Unit / lease *</Typography>
                  <Box sx={{ mt: 0.75, p: 1.5, borderRadius: 1.5, border: `1px solid ${alpha(theme.palette.divider, 0.18)}`, bgcolor: alpha(theme.palette.primary.main, 0.025) }}>
                    <Typography variant="body2" fontWeight={700}>{unitsWithLeases[0].name || `Unit ${unitsWithLeases[0].id}`}</Typography>
                    <Typography variant="caption" color="text.secondary">{getTenantDisplay((unitsWithLeases[0].lease || unitsWithLeases[0].Lease) || {})}</Typography>
                  </Box>
                </Box>
              ) : (
                <Box>
                  <Typography variant="caption" fontWeight={700} color="text.secondary">Unit / lease *</Typography>
                  <FormControl fullWidth size="small" sx={{ mt: 0.75 }} disabled={!propertyId}>
                    <Select
                      value={unitId}
                      displayEmpty
                      onChange={(e) => setUnitId(e.target.value)}
                      input={<OutlinedInput />}
                    >
                      <MenuItem value="" disabled>{propertyId ? 'Select a unit with a lease' : 'Select a property first'}</MenuItem>
                      {unitsWithLeases.map((unit) => {
                        const lease = unit.lease || unit.Lease;
                        return <MenuItem key={unit.id} value={unit.id}>{unit.name || `Unit ${unit.id}`} · {getTenantDisplay(lease || {})}</MenuItem>;
                      })}
                    </Select>
                  </FormControl>
                </Box>
              )}

              <Box>
                <Typography variant="caption" fontWeight={700} color="text.secondary">Lease agreement name</Typography>
                <TextField
                  fullWidth
                  size="small"
                  value={agreementName}
                  onChange={(e) => setAgreementName(e.target.value)}
                  placeholder="Example: 2026 renewal agreement"
                  sx={{ mt: 0.75 }}
                />
                <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 0.75 }}>
                  Optional. This helps you recognize the agreement later.
                </Typography>
              </Box>

              {selectedLease && (
                <Box sx={{ p: 2, borderRadius: 2, border: `1px solid ${alpha(theme.palette.divider, 0.12)}`, bgcolor: alpha(theme.palette.primary.main, 0.025) }}>
                  <Typography variant="caption" color="text.secondary" fontWeight={700} sx={{ textTransform: 'uppercase', letterSpacing: 0.8 }}>Selected lease</Typography>
                  <Typography variant="body2" fontWeight={700} sx={{ mt: 0.5 }}>{selectedProperty?.name || 'Property'}{selectedUnitForAgreement?.name ? ` · ${selectedUnitForAgreement.name}` : ''}</Typography>
                  <Typography variant="caption" color="text.secondary">{tenantLabel}</Typography>
                  <Divider sx={{ my: 1.25 }} />
                  <Stack direction="row" justifyContent="space-between">
                    <Typography variant="caption" color="text.secondary">Term</Typography>
                    <Typography variant="caption" fontWeight={700}>{selectedLease.startDate && selectedLease.endDate ? `${formatDate(selectedLease.startDate)} – ${formatDate(selectedLease.endDate)}` : 'Not set'}</Typography>
                  </Stack>
                </Box>
              )}
            </Stack>
          )}
        </Box>

        <Box sx={{ p: 3, borderTop: `1px solid ${alpha(theme.palette.divider, 0.12)}` }}>
          {createdLease ? (
            <Stack spacing={1.25}>
              <Button fullWidth variant="contained" size="large" onClick={() => onSetup(createdLease)} sx={{ textTransform: 'none', fontWeight: 800 }}>
                Set up lease agreement
              </Button>
              <Button fullWidth variant="text" onClick={handleClose} sx={{ textTransform: 'none' }}>Close</Button>
            </Stack>
          ) : (
            <Button fullWidth variant="contained" size="large" disabled={!selectedLease} onClick={handleCreate} sx={{ textTransform: 'none', fontWeight: 800 }}>
              Create
            </Button>
          )}
        </Box>
      </Box>
    </ThemeAdaptiveDrawer>
  );
}

export default function LeasesPage({ onEditLease }) {
  const drawer = useDrawer();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const dispatch = useDispatch();
  const { propertiesRefetch, isLoading: propertiesLoading } = useFetchProperties();
  const properties = useSelector(selectProperties);
  const selectedProperty = useSelector(selectProperty);
  const selectedUnit = useSelector(selectUnit);
  const allPayments = useSelector(selectAllPayments);
  const userSettings = useSelector(selectUserSettings);
  const theme = useTheme();
  const isXs = useMediaQuery(theme.breakpoints.down('sm'));
  
  // Fetch rent collection data for metrics and rent status (lifetime scope to get all data)
  const { summary: rentSummary, rentRecords, loading: rentCollectionLoading } = useFetchRentCollection(null, true);
  
  // Get context to update leases page loading state
  const { setLeasesLoading } = useDashboardLoading();

  // Reset property selection to "All" on mount
  useEffect(() => {
    dispatch(setProperty(null));
    dispatch(setUnit(null));
  }, [dispatch]);

  // Load user settings and payment history on mount
  useEffect(() => {
    dispatch(getSettings());
    dispatch(getAllPayments());
  }, [dispatch]);

  // Fade-in animation state
  const [fadeIn, setFadeIn] = useState(false);

  // Trigger fade-in animation on mount - start immediately so components can render
  useEffect(() => {
    // Set fadeIn immediately so components render, even if they start with opacity 0
    setFadeIn(true);
  }, []);

  // Reset property selection when leaving this page
  const location = useLocation();
  const previousPathname = useRef(null);
  useEffect(() => {
    const isOnThisPage = location.pathname === '/landlord/leases';
    const justNavigatedAway = previousPathname.current === '/landlord/leases' && !isOnThisPage;
    
    if (justNavigatedAway && selectedProperty) {
      dispatch(setProperty(null));
      dispatch(setUnit(null));
    }
    
    previousPathname.current = location.pathname;
  }, [location.pathname, dispatch, selectedProperty]);

  const [leaseSearch, setLeaseSearch] = useState('');
  const [activeMetricFilter, setActiveMetricFilter] = useState(null);
  const [actionMenuAnchor, setActionMenuAnchor] = useState(null);
  const [actionMenuLease, setActionMenuLease] = useState(null);

  const [agreementSearch, setAgreementSearch] = useState('');
  const [activeAgreementFilter, setActiveAgreementFilter] = useState(null);
  const [agreementActionMenuAnchor, setAgreementActionMenuAnchor] = useState(null);
  const [agreementActionMenuLease, setAgreementActionMenuLease] = useState(null);
  const [createAgreementDrawerOpen, setCreateAgreementDrawerOpen] = useState(false);
  const [createAgreementInitialLease, setCreateAgreementInitialLease] = useState(null);

  // Get initial view from URL parameter or default to 'current'
  // Support both 'view' and legacy 'tab' parameters for backward compatibility
  const getInitialView = () => {
    const viewParam = searchParams.get('view');
    const tabParam = searchParams.get('tab'); // Legacy support
    
    if (viewParam === 'renewals') return 'renewals';
    if (viewParam === 'history') return 'history';
    if (viewParam === 'overdue') return 'overdue';
    if (viewParam === 'notStarted') return 'notStarted';
    if (viewParam === 'active') return 'active';
    if (tabParam === 'history') return 'history'; // Legacy support
    return 'current';
  };

  const [view, setView] = useState(getInitialView());
  const [filterAnchorEl, setFilterAnchorEl] = useState(null);
  const [subMenuAnchorEl, setSubMenuAnchorEl] = useState(null);
  const [activeSubMenu, setActiveSubMenu] = useState(null);
  const [clickedChipFilter, setClickedChipFilter] = useState(null); // Track which chip filter was clicked
  const filterButtonRef = useRef(null);
  const [filters, setFilters] = useState({
    status: ['current'] // Default to current, now supports multiple
  });

  // Update view when URL parameter changes
  // Support both 'view' and legacy 'tab' parameters for backward compatibility
  useEffect(() => {
    const viewParam = searchParams.get('view');
    const tabParam = searchParams.get('tab'); // Legacy support
    
    if (viewParam === 'renewals') {
      setView('renewals');
      setFilters(prev => ({ ...prev, status: ['renewals'] }));
    } else if (viewParam === 'history') {
      setView('history');
      setFilters(prev => ({ ...prev, status: ['history'] }));
    } else if (viewParam === 'overdue') {
      setView('overdue');
      setFilters(prev => ({ ...prev, status: ['overdue'] }));
    } else if (viewParam === 'notStarted') {
      setView('notStarted');
      setFilters(prev => ({ ...prev, status: ['notStarted'] }));
    } else if (viewParam === 'active') {
      setView('active');
      setFilters(prev => ({ ...prev, status: ['active'] }));
    } else if (tabParam === 'history') {
      setView('history'); // Legacy support
      setFilters(prev => ({ ...prev, status: ['history'] }));
    } else if (viewParam === null || viewParam === 'current') {
      setView('current');
      setFilters(prev => ({ ...prev, status: ['current'] }));
    }
  }, [searchParams]);

  // Update view when filter changes (use first status for URL compatibility)
  useEffect(() => {
    if (filters.status && filters.status.length > 0) {
      const firstStatus = filters.status[0];
      setView(firstStatus);
      const newSearchParams = new URLSearchParams(searchParams);
      if (firstStatus === 'current') {
        newSearchParams.delete('view');
      } else {
        newSearchParams.set('view', firstStatus);
      }
      setSearchParams(newSearchParams);
    }
  }, [filters.status, searchParams, setSearchParams]);
  const [loading, setLoading] = useState(false);
  const [leasesPage, setLeasesPage] = useState(0);
  const [leasesItemsPerPage, setLeasesItemsPerPage] = useState(10);
  const [leaseAgreementsPage, setLeaseAgreementsPage] = useState(0);
  const [leaseAgreementsItemsPerPage, setLeaseAgreementsItemsPerPage] = useState(10);
  const [selectedLeases, setSelectedLeases] = useState(new Set());
  const [sortField, setSortField] = useState('status');
  const [sortOrder, setSortOrder] = useState('asc');
  const [endLeaseConfirmOpen, setEndLeaseConfirmOpen] = useState(false);
  const [leaseToEnd, setLeaseToEnd] = useState(null);
  const [reopenLeaseConfirmOpen, setReopenLeaseConfirmOpen] = useState(false);
  const [leaseToReopen, setLeaseToReopen] = useState(null);
  const [leaseHistory, setLeaseHistory] = useState([]);
  const [loadingHistory, setLoadingHistory] = useState(false);
  
  // Tab state
  const [activeTab, setActiveTab] = useState(() => (searchParams.get('tab') === 'agreements' ? 1 : 0));
  const [slideDirection, setSlideDirection] = useState('left');
  
  // Lease Agreements tab state
  const [leaseAgreements, setLeaseAgreements] = useState([]);
  const [loadingAgreements, setLoadingAgreements] = useState(false);
  
  // Comprehensive loading state - tracks when ALL leases page components are loaded
  // This combines all individual component loading states
  const isLeasesPageLoading = useMemo(() => {
    return (
      propertiesLoading ||
      rentCollectionLoading ||
      loading ||
      loadingHistory ||
      loadingAgreements
    );
  }, [
    propertiesLoading,
    rentCollectionLoading,
    loading,
    loadingHistory,
    loadingAgreements
  ]);
  
  // Update the context whenever the leases page loading state changes
  useEffect(() => {
    setLeasesLoading(isLeasesPageLoading);
  }, [isLeasesPageLoading, setLeasesLoading]);

  useEffect(() => {
    setLoading(true);
    propertiesRefetch().finally(() => setLoading(false));
  }, [propertiesRefetch]);

  // Fetch lease agreements for all leases (for Lease Agreements tab)
  useEffect(() => {
    const fetchLeaseAgreements = async () => {
      if (!properties || properties.length === 0) {
        setLeaseAgreements([]);
        return;
      }

      setLoadingAgreements(true);
      try {
        const agreements = [];

        // Get all leases from properties
        const allLeases = [];
        properties.forEach((p) => {
          p.units?.forEach((u) => {
            const unitLease = u.lease || u.Lease;
            if (unitLease && unitLease.id) {
              allLeases.push({
                ...unitLease,
                propertyName: p.name,
                propertyStreetAddress: p.streetAddress,
                propertyId: p.id,
                propertyType: p.propertyType,
                unitName: u.name,
                unitId: u.id,
                tenants: unitLease.tenants || [],
                organizationId: p.organizationId
              });
            }
          });
        });

        // Fetch lease agreement for each lease
        for (const lease of allLeases) {
          try {
            const response = await tenantDocumentAPI.getLeaseAgreement(lease.id);
            if (response.success && response.data) {
              agreements.push({
                ...lease,
                agreement: response.data,
                hasAgreement: true
              });
            } else {
              // Lease exists but no agreement document
              agreements.push({
                ...lease,
                agreement: null,
                hasAgreement: false
              });
            }
          } catch (error) {
            // If 404 or 400, lease exists but no agreement
            const status = error?.response?.status;
            if (status === 404 || status === 400) {
              agreements.push({
                ...lease,
                agreement: null,
                hasAgreement: false
              });
            } else {
              console.error(`Error fetching agreement for lease ${lease.id}:`, error);
            }
          }
        }

        setLeaseAgreements(agreements);
      } catch (error) {
        console.error('Error fetching lease agreements:', error);
        setLeaseAgreements([]);
      } finally {
        setLoadingAgreements(false);
      }
    };

    fetchLeaseAgreements();
  }, [properties]);

  // Fetch lease history when filter includes history
  useEffect(() => {
    const fetchLeaseHistory = async () => {
      const statusFilters = Array.isArray(filters.status) ? filters.status : [filters.status || 'current'];
      if (statusFilters.includes('history')) {
        setLoadingHistory(true);
        try {
          const response = await axiosServices.get('/api/lease/history');
          if (response.data?.success && response.data?.data) {
            // Transform lease history to match the format of allLeases
            const historyLeases = response.data.data.map((history) => ({
              ...history,
              propertyName: history.propertyName || '',
              propertyId: history.propertyId || 0,
              propertyType: history.propertyType || '',
              unitName: history.unitName || '',
              unitId: history.unitId || 0,
              tenants: history.tenants || [],
              hasLease: true,
              isActive: false // History entries are always inactive
            }));
            setLeaseHistory(historyLeases);
          }
        } catch (error) {
          console.error('Error fetching lease history:', error);
          setLeaseHistory([]);
        } finally {
          setLoadingHistory(false);
        }
      } else {
        setLeaseHistory([]);
      }
    };

    fetchLeaseHistory();
  }, [filters.status]);

  // --- Flatten leases from all properties, including units without leases ---
  const allLeases = useMemo(() => {
    if (!properties) return [];
    const leases = [];

    properties.forEach((p) => {
      p.units?.forEach((u) => {
        const unitLease = u.lease || u.Lease;
        // Check if lease exists and is active (handle both camelCase and PascalCase)
        // Treat isActive = 0, false, or undefined as inactive
        const isLeaseActive = unitLease && (
          unitLease.isActive === true || 
          unitLease.IsActive === true ||
          unitLease.isActive === 1 ||
          unitLease.IsActive === 1
        );
        
        // If unit has an active lease, add it to the list for current view
        if (unitLease && isLeaseActive) {
          leases.push({
            ...unitLease,
            propertyName: p.name,
            propertyStreetAddress: p.streetAddress,
            propertyId: p.id,
            propertyType: p.propertyType,
            unitName: u.name,
            unitId: u.id,
            tenants: unitLease.tenants || [],
            hasLease: true
          });
        }
        
        // If unit has an inactive/ended lease (isActive = 0/false), also add it to history
        // But treat the unit as available (no lease) in current view
        if (unitLease && !isLeaseActive) {
          // Add the ended lease to the list for history view
          leases.push({
            ...unitLease,
            propertyName: p.name,
            propertyStreetAddress: p.streetAddress,
            propertyId: p.id,
            propertyType: p.propertyType,
            unitName: u.name,
            unitId: u.id,
            tenants: unitLease.tenants || [],
            hasLease: true
          });
        }
        
      });
    });
    return leases;
  }, [properties]);

  // --- Filter by selected property (like Rent Collection) ---
  const filteredByProperty = useMemo(() => {
    if (!selectedProperty?.id) return allLeases;
    return allLeases.filter((l) => l.propertyId === selectedProperty.id);
  }, [selectedProperty, allLeases]);

  // --- Filter by current/renewals/history/overdue/notStarted view ---
  const filteredLeases = useMemo(() => {
    const statusFilters = Array.isArray(filters.status) ? filters.status : [filters.status || 'current'];
    const hasHistory = statusFilters.includes('history');
    
    // If history filter is active, use lease history instead of allLeases
    const sourceLeases = hasHistory ? leaseHistory : filteredByProperty;

    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const ninetyDaysFromNow = new Date(today);
    ninetyDaysFromNow.setDate(ninetyDaysFromNow.getDate() + 90);

    // Filter leases based on selected statuses
    return sourceLeases.filter((l) => {
      // Check if lease matches any of the selected status filters
      const matchesStatus = statusFilters.some((statusFilter) => {
        if (statusFilter === 'current') {
          return l.isActive === true;
        }
        
        if (statusFilter === 'active') {
          return isStartedActiveLease(l);
        }
        
        if (statusFilter === 'renewals') {
          // Renewals view: show started, non-draft active leases expiring within 90 days
          if (!isStartedActiveLease(l) || !l.endDate) return false;
          const endDate = new Date(l.endDate);
          endDate.setHours(0, 0, 0, 0);
          return endDate >= today && endDate <= ninetyDaysFromNow;
        }
        
        if (statusFilter === 'overdue') {
          // Overdue view: show only started, non-draft active leases that are overdue
          if (!isStartedActiveLease(l)) return false;
          const rentRecord = rentRecords?.find((r) => r.leaseId === l.id);
          return rentRecord?.status === 'overdue';
        }
        
        if (statusFilter === 'notStarted') {
          // Drafts are not started even when placeholder dates are in the past.
          if (!l.hasLease) return false;
          if (isLeaseDraft(l)) return true;
          if (!l.startDate) return true;
          return new Date(l.startDate) > new Date();
        }
        
        if (statusFilter === 'history') {
          // History view: show all leases from lease history table
          return true;
        }
        
        return false;
      });
      
      return matchesStatus;
    });
  }, [filters.status, filteredByProperty, leaseHistory, rentRecords]);

  // Handle metric card filter
  const handleMetricFilter = (key) => {
    const next = activeMetricFilter === key ? null : key;
    setActiveMetricFilter(next);
    if (next === 'overdue') {
      setFilters({ status: ['overdue'] });
    } else {
      setFilters({ status: ['current'] });
    }
  };

  // Handle sort column click
  const handleSort = (field) => {
    if (sortField === field) {
      setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortOrder('asc');
    }
  };

  // Handle lease selection
  const handleSelectLease = (leaseId) => {
    const newSelected = new Set(selectedLeases);
    if (newSelected.has(leaseId)) {
      newSelected.delete(leaseId);
    } else {
      newSelected.add(leaseId);
    }
    setSelectedLeases(newSelected);
  };

  const handleSelectAll = () => {
    if (sortedLeases.length > 0 && sortedLeases.every((l) => selectedLeases.has(l.id))) {
      setSelectedLeases(new Set());
    } else {
      setSelectedLeases(new Set(sortedLeases.map((l) => l.id)));
    }
  };

  // Handle end lease
  const handleEndLeaseClick = (lease) => {
    setLeaseToEnd(lease);
    setEndLeaseConfirmOpen(true);
  };

  const handleConfirmEndLease = async () => {
    if (!leaseToEnd?.id) return;

    try {
      await dispatch(endLease(leaseToEnd.id));

      openSnackbar({
        open: true,
        message: 'Lease ended and archived successfully.',
        variant: 'alert',
        alert: { color: 'success' }
      });

      setEndLeaseConfirmOpen(false);
      setLeaseToEnd(null);
      propertiesRefetch();
    } catch (error) {
      console.error('Error ending lease:', error);
      openSnackbar({
        open: true,
        message: error?.response?.data?.message || 'Failed to end lease',
        variant: 'alert',
        alert: { color: 'error' }
      });
    }
  };

  // Handle reopen lease
  const handleReopenLeaseClick = (lease) => {
    setLeaseToReopen(lease);
    setReopenLeaseConfirmOpen(true);
  };

  const handleConfirmReopenLease = async () => {
    if (!leaseToReopen?.id) return;

    try {
      await dispatch(reopenLease(leaseToReopen.id));

      openSnackbar({
        open: true,
        message: 'Lease reopened successfully.',
        variant: 'alert',
        alert: { color: 'success' }
      });

      setReopenLeaseConfirmOpen(false);
      setLeaseToReopen(null);
      propertiesRefetch();
    } catch (error) {
      console.error('Error reopening lease:', error);
      openSnackbar({
        open: true,
        message: error?.response?.data?.message || 'Failed to reopen lease',
        variant: 'alert',
        alert: { color: 'error' }
      });
    }
  };

  // Sort leases based on sortField and sortOrder
  const sortedLeases = useMemo(() => {
    if (!filteredLeases || filteredLeases.length === 0) return [];

    return [...filteredLeases].sort((a, b) => {
      let comparison = 0;

      switch (sortField) {
        case 'property': {
          // Sort by property name first, then by unit name for multi-unit properties
          const aPropName = a.propertyName || '';
          const bPropName = b.propertyName || '';
          comparison = aPropName.toLowerCase().localeCompare(bPropName.toLowerCase());
          if (comparison === 0) {
            // If property names are the same, sort by unit name
            const aUnitName = a.unitName || '';
            const bUnitName = b.unitName || '';
            comparison = aUnitName.toLowerCase().localeCompare(bUnitName.toLowerCase());
          }
          break;
        }
        case 'startDate': {
          // Units without leases should sort to the end
          if (!a.hasLease && b.hasLease) return 1;
          if (a.hasLease && !b.hasLease) return -1;
          const aDate = a.startDate ? new Date(a.startDate).getTime() : 0;
          const bDate = b.startDate ? new Date(b.startDate).getTime() : 0;
          comparison = aDate - bDate;
          break;
        }
        case 'endDate': {
          // Units without leases should sort to the end
          if (!a.hasLease && b.hasLease) return 1;
          if (a.hasLease && !b.hasLease) return -1;
          const aDate = a.endDate ? new Date(a.endDate).getTime() : 0;
          const bDate = b.endDate ? new Date(b.endDate).getTime() : 0;
          comparison = aDate - bDate;
          break;
        }
        case 'rentAmount': {
          // Units without leases should sort to the end
          if (!a.hasLease && b.hasLease) return 1;
          if (a.hasLease && !b.hasLease) return -1;
          comparison = (a.rentAmount || 0) - (b.rentAmount || 0);
          break;
        }
        case 'status': {
          // Sort: Overdue first, then up to date, then drafts (asc = overdue first)
          const getStatusOrder = (lease) => {
            if (!lease.hasLease) return 4; // No lease - last
            if (!lease.isActive) return 3;  // Ended - before no lease
            const rentRecord = rentRecords?.find((r) => r.leaseId === lease.id);
            const isOverdue = rentRecord?.status === 'overdue';
            const isDraft = lease?.leaseAgreement?.isDrafted === true || lease?.isDrafted === true || lease?.IsDrafted === true;
            if (isOverdue) return 0;
            if (isDraft) return 2;
            return 1; // Up to date
          };
          comparison = getStatusOrder(a) - getStatusOrder(b);
          break;
        }
        default:
          return 0;
      }

      return sortOrder === 'asc' ? comparison : -comparison;
    });
  }, [filteredLeases, sortField, sortOrder, rentRecords]);

  // Pagination for Leases tab
  const draftCount = useMemo(() =>
    allLeases.filter((l) => l.isActive && (l.leaseAgreement?.isDrafted === true || l.isDrafted === true || l.IsDrafted === true || l.leaseAgreement?.signatureStatus === 0 || l.signatureStatus === 0 || l.SignatureStatus === 0)).length
  , [allLeases]);

  const displayLeases = useMemo(() => {
    let base = sortedLeases;
    if (activeMetricFilter === 'available') {
      base = base.filter((l) => !l.hasLease);
    }
    if (leaseSearch.trim()) {
      const q = leaseSearch.toLowerCase();
      base = base.filter((l) => {
        const name = (l.name || l.Name || '').toLowerCase();
        const propName = (l.propertyName || '').toLowerCase();
        const unitName = (l.unitName || '').toLowerCase();
        const tenantNames = (l.tenants || [])
          .map((tenant) => [tenant.firstname || tenant.firstName || tenant.FirstName, tenant.lastname || tenant.lastName || tenant.LastName].filter(Boolean).join(' '))
          .join(' ')
          .toLowerCase();
        return name.includes(q) || propName.includes(q) || unitName.includes(q) || tenantNames.includes(q);
      });
    }
    return base;
  }, [sortedLeases, activeMetricFilter, leaseSearch]);

  const leasesTotalPages = Math.ceil(displayLeases.length / leasesItemsPerPage);
  const paginatedLeases = useMemo(() => {
    const startIndex = leasesPage * leasesItemsPerPage;
    const endIndex = startIndex + leasesItemsPerPage;
    return displayLeases.slice(startIndex, endIndex);
  }, [displayLeases, leasesPage, leasesItemsPerPage]);

  useEffect(() => {
    setLeasesPage(0);
  }, [leasesItemsPerPage, leaseSearch, filters.status, selectedProperty?.id, sortField, sortOrder]);

  const handleLeasesPageChange = (newPage) => {
    setLeasesPage(newPage);
  };

  // Filter lease agreements (for Lease Agreements tab)
  const filteredLeaseAgreements = useMemo(() => {
    let filtered = leaseAgreements || [];

    // Only show leases that have an agreement started
    filtered = filtered.filter((la) => la.hasAgreement === true);

    // Filter by property
    if (selectedProperty?.id) {
      filtered = filtered.filter((la) => la.propertyId === selectedProperty.id);
    }

    // Filter by unit
    if (selectedUnit?.id) {
      filtered = filtered.filter((la) => la.unitId === selectedUnit.id);
    }

    return filtered.sort((a, b) => {
      const aProp = a.propertyName || '';
      const bProp = b.propertyName || '';
      if (aProp !== bProp) return aProp.localeCompare(bProp);
      const aUnit = a.unitName || '';
      const bUnit = b.unitName || '';
      return aUnit.localeCompare(bUnit);
    });
  }, [leaseAgreements, selectedProperty, selectedUnit]);

  // Calculate metrics for Lease Agreements tab
  const leaseAgreementsMetrics = useMemo(() => {
    const total = filteredLeaseAgreements.length;
    const withAgreement = filteredLeaseAgreements.filter((la) => la.hasAgreement).length;
    const withoutAgreement = total - withAgreement;
    const active = filteredLeaseAgreements.filter((la) => la.isActive === true).length;
    const expired = filteredLeaseAgreements.filter((la) => {
      if (!la.endDate) return false;
      const endDate = new Date(la.endDate);
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      return endDate < today;
    }).length;
    const signedComplete = filteredLeaseAgreements.filter((la) => {
      if (!la.hasAgreement) return false;
      const landlordSigned = !!(la.landlordSignedAt ?? la.LandlordSignedAt);
      const tenants = la.tenants || [];
      const allTenantsSigned = tenants.length === 0 || tenants.every((t) => !!(t.tenantSignedAt ?? t.TenantSignedAt));
      return landlordSigned && allTenantsSigned;
    }).length;
    const awaitingSignature = filteredLeaseAgreements.filter((la) => {
      if (!la.hasAgreement) return false;
      const landlordSigned = !!(la.landlordSignedAt ?? la.LandlordSignedAt);
      const tenants = la.tenants || [];
      const allTenantsSigned = tenants.length === 0 || tenants.every((t) => !!(t.tenantSignedAt ?? t.TenantSignedAt));
      return !(landlordSigned && allTenantsSigned);
    }).length;
    const landlordSigned = filteredLeaseAgreements.filter((la) => !!(la.landlordSignedAt ?? la.LandlordSignedAt)).length;
    const tenantSignatureSlots = filteredLeaseAgreements.reduce((sum, la) => sum + ((la.tenants || []).length || 0), 0);
    const tenantSignatures = filteredLeaseAgreements.reduce(
      (sum, la) => sum + (la.tenants || []).filter((t) => !!(t.tenantSignedAt ?? t.TenantSignedAt)).length,
      0
    );
    const signedRate = total ? Math.round((signedComplete / total) * 100) : 0;
    const tenantSignatureRate = tenantSignatureSlots ? Math.round((tenantSignatures / tenantSignatureSlots) * 100) : 0;

    return {
      total,
      withAgreement,
      withoutAgreement,
      active,
      expired,
      awaitingSignature,
      signedComplete,
      landlordSigned,
      tenantSignatures,
      tenantSignatureSlots,
      signedRate,
      tenantSignatureRate
    };
  }, [filteredLeaseAgreements]);

  const displayLeaseAgreements = useMemo(() => {
    let base = filteredLeaseAgreements;
    if (activeAgreementFilter === 'awaiting') {
      base = base.filter((la) => {
        if (!la.hasAgreement) return false;
        const landlordSigned = !!(la.landlordSignedAt ?? la.LandlordSignedAt);
        const tenants = la.tenants || [];
        const allTenantsSigned = tenants.length === 0 || tenants.every((t) => !!(t.tenantSignedAt ?? t.TenantSignedAt));
        return !(landlordSigned && allTenantsSigned);
      });
    } else if (activeAgreementFilter === 'signed') {
      base = base.filter((la) => {
        if (!la.hasAgreement) return false;
        const landlordSigned = !!(la.landlordSignedAt ?? la.LandlordSignedAt);
        const tenants = la.tenants || [];
        const allTenantsSigned = tenants.length === 0 || tenants.every((t) => !!(t.tenantSignedAt ?? t.TenantSignedAt));
        return landlordSigned && allTenantsSigned;
      });
    } else if (activeAgreementFilter === 'withAgreement') {
      base = base.filter((la) => la.hasAgreement);
    } else if (activeAgreementFilter === 'active') {
      base = base.filter((la) => la.isActive === true);
    } else if (activeAgreementFilter === 'expired') {
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      base = base.filter((la) => la.endDate && new Date(la.endDate) < today);
    }
    if (agreementSearch.trim()) {
      const q = agreementSearch.toLowerCase();
      base = base.filter((la) => {
        const tenantNames = (la.tenants || [])
          .map((tenant) => [tenant.firstname || tenant.firstName || tenant.FirstName, tenant.lastname || tenant.lastName || tenant.LastName].filter(Boolean).join(' '))
          .join(' ')
          .toLowerCase();
        return (
          (la.propertyName || '').toLowerCase().includes(q) ||
          (la.unitName || '').toLowerCase().includes(q) ||
          (la.agreement?.fileName || '').toLowerCase().includes(q) ||
          tenantNames.includes(q)
        );
      });
    }
    return base;
  }, [filteredLeaseAgreements, activeAgreementFilter, agreementSearch]);

  // Pagination for Lease Agreements tab
  const leaseAgreementsTotalPages = Math.ceil(displayLeaseAgreements.length / leaseAgreementsItemsPerPage);
  const paginatedLeaseAgreements = useMemo(() => {
    const startIndex = leaseAgreementsPage * leaseAgreementsItemsPerPage;
    const endIndex = startIndex + leaseAgreementsItemsPerPage;
    return displayLeaseAgreements.slice(startIndex, endIndex);
  }, [displayLeaseAgreements, leaseAgreementsPage, leaseAgreementsItemsPerPage]);

  useEffect(() => {
    setLeaseAgreementsPage(0);
  }, [leaseAgreementsItemsPerPage]);

  const handleLeaseAgreementsPageChange = (newPage) => {
    setLeaseAgreementsPage(newPage);
  };

  const handleViewAgreement = async (leaseAgreement) => {
    if (!leaseAgreement.agreement) {
      openSnackbar({
        open: true,
        message: 'No lease agreement document available',
        variant: 'alert',
        alert: { color: 'warning' }
      });
      return;
    }

    try {
      // Always fetch a fresh lease agreement to get a new SAS URL (SAS URLs expire after 1 hour)
      // This ensures the document can be viewed even if the page has been open for a while
      const response = await tenantDocumentAPI.getLeaseAgreement(leaseAgreement.id);
      if (response.success && response.data?.blobUrl) {
        window.open(response.data.blobUrl, '_blank');
      } else {
        openSnackbar({
          open: true,
          message: 'Unable to open lease agreement',
          variant: 'alert',
          alert: { color: 'error' }
        });
      }
    } catch (error) {
      console.error('Error viewing lease agreement:', error);
      openSnackbar({
        open: true,
        message: 'Error opening lease agreement',
        variant: 'alert',
        alert: { color: 'error' }
      });
    }
  };

  const handleViewLeaseFromAgreement = (leaseAgreement) => {
    const params = new URLSearchParams();
    if (leaseAgreement.id) params.set('leaseId', leaseAgreement.id);
    if (leaseAgreement.propertyId) params.set('propertyId', leaseAgreement.propertyId);
    if (leaseAgreement.unitId) params.set('unitId', leaseAgreement.unitId);
    navigate(`/landlord/leases/build-lease-agreement?${params.toString()}`);
  };

  const handleSetupCreatedAgreement = (leaseAgreement) => {
    const params = new URLSearchParams();
    if (leaseAgreement.id) params.set('leaseId', leaseAgreement.id);
    if (leaseAgreement.propertyId) params.set('propertyId', leaseAgreement.propertyId);
    if (leaseAgreement.unitId) params.set('unitId', leaseAgreement.unitId);
    setCreateAgreementDrawerOpen(false);
    setCreateAgreementInitialLease(null);
    navigate(`/landlord/leases/build-lease-agreement?${params.toString()}`);
  };

  const openCreateAgreementDrawer = (lease = null) => {
    setCreateAgreementInitialLease(lease);
    setCreateAgreementDrawerOpen(true);
  };

  const handleSignLeaseFromAgreement = (leaseAgreement) => {
    navigate(`/landlord/leases/${leaseAgreement.id}?sign=true`);
  };

  const getAgreementStatus = (leaseAgreement) => {
    if (!leaseAgreement.hasAgreement) return 'incomplete';
    const landlordSigned = !!(leaseAgreement.landlordSignedAt ?? leaseAgreement.LandlordSignedAt);
    const tenants = leaseAgreement.tenants || [];
    const allTenantsSigned = tenants.length === 0 || tenants.every((t) => !!(t.tenantSignedAt ?? t.TenantSignedAt));
    if (landlordSigned && allTenantsSigned) return 'complete';
    return 'need_to_be_signed';
  };

  const overviewMetrics = useMemo(() => {
    const activeLeases = allLeases.filter((lease) => isStartedActiveLease(lease));
    const expectedThisMonth = activeLeases.reduce((sum, lease) => sum + (Number(lease.rentAmount) || 0), 0);
    const outstanding = activeLeases.reduce((sum, lease) => {
      const rentRecord = rentRecords?.find((record) => record.leaseId === lease.id);
      return sum + (Number(rentRecord?.remainingBalance) || (rentRecord?.status === 'overdue' ? Number(lease.rentAmount) || 0 : 0));
    }, 0);
    const overdueCount = activeLeases.filter((lease) => rentRecords?.find((record) => record.leaseId === lease.id)?.status === 'overdue').length;

    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const ninetyDaysFromNow = new Date(today);
    ninetyDaysFromNow.setDate(ninetyDaysFromNow.getDate() + 90);
    const expiringSoon = activeLeases.filter((lease) => {
      if (!lease.endDate) return false;
      const endDate = new Date(lease.endDate);
      endDate.setHours(0, 0, 0, 0);
      return endDate >= today && endDate <= ninetyDaysFromNow;
    });

    const totalUnits = (properties || []).reduce((sum, property) => sum + Math.max(1, property.units?.length || 0), 0);
    const occupiedUnits = allLeases.filter((lease) => isStartedActiveLease(lease)).length;
    const occupancy = totalUnits ? Math.round((occupiedUnits / totalUnits) * 100) : 0;

    return {
      expectedThisMonth,
      billingCount: activeLeases.length,
      outstanding,
      overdueCount,
      expiringCount: expiringSoon.length,
      nextExpiring: expiringSoon[0],
      occupancy,
      occupiedUnits,
      totalUnits
    };
  }, [allLeases, properties, rentRecords]);

  const handleTabChange = (event, newValue) => {
    // Determine slide direction based on tab movement
    if (newValue > activeTab) {
      // Moving right (e.g., Leases -> Lease Agreements)
      setSlideDirection('left'); // New content comes from right (slides in from right to left)
    } else if (newValue < activeTab) {
      // Moving left (e.g., Lease Agreements -> Leases)
      setSlideDirection('right'); // New content comes from left (slides in from left to right)
    }
    setActiveTab(newValue);
  };

  return (
    <Fade in={fadeIn} timeout={600}>
      <Box sx={{ overflow: 'visible' }}>
        {/* Header */}
        <AnimateIn direction="bottom" delay={100} distance={120}>
          <LeasesHeader
            onCreateLease={() => drawer.openLeaseAddDrawer()}
            onCreateAgreement={() => openCreateAgreementDrawer()}
          />
        </AnimateIn>

        {/* Tabs */}
        <AnimateIn direction="bottom" delay={200} distance={120}>
        <Box
          sx={{
            mt: 0.5,
            borderBottom: `1px solid ${alpha(theme.palette.divider, 0.16)}`,
            '& .MuiTabs-root': { minHeight: 42 },
            '& .MuiTab-root': {
              minHeight: 42,
              px: 1.25,
              mr: 1.5,
              borderRadius: 1.5,
              textTransform: 'none',
              fontSize: '0.875rem',
              fontWeight: 700,
              color: 'text.secondary',
              transition: theme.transitions.create(['background-color', 'box-shadow', 'color'], {
                duration: theme.transitions.duration.shorter
              }),
              '&:hover': {
                color: theme.palette.mode === 'dark' ? 'primary.light' : 'primary.main',
                backgroundColor: alpha(theme.palette.primary.main, theme.palette.mode === 'dark' ? 0.16 : 0.08),
                boxShadow: theme.palette.mode === 'dark' ? `inset 0 0 0 1px ${alpha(theme.palette.primary.main, 0.24)}` : 'none'
              },
              '&.Mui-selected': {
                color: theme.palette.mode === 'dark' ? 'primary.light' : 'primary.main',
                backgroundColor: alpha(theme.palette.primary.main, theme.palette.mode === 'dark' ? 0.12 : 0.04)
              }
            },
            '& .MuiTabs-indicator': {
              height: 2,
              borderRadius: 2,
              backgroundColor: 'primary.main'
            }
          }}
        >
          <Tabs value={activeTab} onChange={handleTabChange} variant="scrollable" scrollButtons="auto">
            <Tab
              label={(
                <Stack direction="row" spacing={0.75} alignItems="center">
                  <Typography component="span" variant="body2" fontWeight={700}>Leases</Typography>
                  <Chip label={allLeases.length} size="small" sx={{ height: 18, minWidth: 18, '& .MuiChip-label': { px: 0.65, fontSize: '0.68rem', fontWeight: 700 } }} />
                </Stack>
              )}
            />
            <Tab
              label={(
                <Stack direction="row" spacing={0.75} alignItems="center">
                  <Typography component="span" variant="body2" fontWeight={700}>Lease agreements</Typography>
                  <Chip label={filteredLeaseAgreements.length} size="small" sx={{ height: 18, minWidth: 18, '& .MuiChip-label': { px: 0.65, fontSize: '0.68rem', fontWeight: 700 } }} />
                </Stack>
              )}
            />
          </Tabs>
        </Box>
        </AnimateIn>

        {/* Tab Content */}
        <Box>
          {/* Tab Panel: Leases */}
          <TabPanel key="leases" value={activeTab} index={0} slideDirection={slideDirection}>
            <AnimateIn direction="bottom" delay={300} distance={120}>
            <Grid container spacing={1.5} sx={{ mb: 2.5 }}>
              <Grid size={{ xs: 6, lg: 3 }}>
                <SummaryCard
                  label="Active leases"
                  value={overviewMetrics.billingCount}
                  helper={`${allLeases.length - overviewMetrics.billingCount} not started or archived`}
                  icon={<HomeOutlined />}
                  color={theme.palette.success.main}
                  active={filters.status?.[0] === 'active'}
                  onClick={() => setFilters({ status: [filters.status?.[0] === 'active' ? 'current' : 'active'] })}
                />
              </Grid>
              <Grid size={{ xs: 6, lg: 3 }}>
                <SummaryCard
                  label="Monthly rent roll"
                  value={formatCurrency(overviewMetrics.expectedThisMonth)}
                  helper={`${overviewMetrics.billingCount} active lease${overviewMetrics.billingCount === 1 ? '' : 's'} billing`}
                  icon={<DollarOutlined />}
                  color={theme.palette.primary.main}
                  active={sortField === 'rentAmount' && sortOrder === 'desc'}
                  onClick={() => { setSortField('rentAmount'); setSortOrder('desc'); }}
                />
              </Grid>
              <Grid size={{ xs: 6, lg: 3 }}>
                <SummaryCard
                  label="Outstanding"
                  value={formatCurrency(overviewMetrics.outstanding)}
                  helper={`${overviewMetrics.overdueCount} overdue lease${overviewMetrics.overdueCount === 1 ? '' : 's'}`}
                  icon={<AlertOutlined />}
                  color={theme.palette.error.main}
                  active={filters.status?.[0] === 'overdue'}
                  onClick={() => setFilters({ status: [filters.status?.[0] === 'overdue' ? 'current' : 'overdue'] })}
                />
              </Grid>
              <Grid size={{ xs: 6, lg: 3 }}>
                <SummaryCard
                  label="Renewals due"
                  value={overviewMetrics.expiringCount}
                  helper={overviewMetrics.nextExpiring ? `Next: ${formatDate(overviewMetrics.nextExpiring.endDate)}` : 'No expirations in 90 days'}
                  icon={<ClockCircleOutlined />}
                  color={theme.palette.warning.main}
                  active={filters.status?.[0] === 'renewals'}
                  onClick={() => setFilters({ status: [filters.status?.[0] === 'renewals' ? 'current' : 'renewals'] })}
                />
              </Grid>
            </Grid>
            </AnimateIn>

            {/* Toolbar */}
            <AnimateIn direction="bottom" delay={400} distance={120}>
            <Box
              sx={{
                mb: 2,
                p: { xs: 1.5, md: 2 },
                bgcolor: 'background.paper',
                border: `1px solid ${alpha(theme.palette.divider, 0.16)}`,
                borderRadius: 3,
                boxShadow: `0 8px 28px ${alpha('#061e35', 0.055)}`
              }}
            >
              <Stack direction={{ xs: 'column', lg: 'row' }} spacing={1.1} alignItems={{ lg: 'center' }}>
                <OutlinedInput
                  size="small"
                  placeholder="Search leases, properties, units, or tenants"
                  value={leaseSearch}
                  onChange={(e) => setLeaseSearch(e.target.value)}
                  startAdornment={<InputAdornment position="start"><SearchOutlined style={{ fontSize: 14, opacity: 0.55 }} /></InputAdornment>}
                  sx={{ flex: 1, minWidth: { lg: 260 }, borderRadius: 1.75 }}
                />
                <Stack direction="row" spacing={1} sx={{ overflowX: 'auto', pb: { xs: 0.25, lg: 0 } }}>
                  <Select
                    size="small"
                    value={filters.status?.[0] || 'current'}
                    onChange={(event) => setFilters({ status: [event.target.value] })}
                    sx={{ minWidth: 150, borderRadius: 1.75 }}
                  >
                    <MenuItem value="current">Current leases</MenuItem>
                    <MenuItem value="active">Active leases</MenuItem>
                    <MenuItem value="notStarted">Not started</MenuItem>
                    <MenuItem value="renewals">Renewals due</MenuItem>
                    <MenuItem value="overdue">Overdue rent</MenuItem>
                    <MenuItem value="history">Lease history</MenuItem>
                  </Select>
                  <Select
                    size="small"
                    value={selectedProperty?.id || 'all'}
                    onChange={(event) => {
                      const property = event.target.value === 'all' ? null : (properties || []).find((item) => Number(item.id) === Number(event.target.value));
                      dispatch(setProperty(property || null));
                      dispatch(setUnit(null));
                    }}
                    sx={{ minWidth: 155, maxWidth: 220, borderRadius: 1.75 }}
                  >
                    <MenuItem value="all">All properties</MenuItem>
                    {(properties || []).map((property) => (
                      <MenuItem key={property.id} value={property.id}>{property.name || property.streetAddress || `Property ${property.id}`}</MenuItem>
                    ))}
                  </Select>
                  <Select
                    size="small"
                    value={`${sortField}:${sortOrder}`}
                    onChange={(event) => {
                      const [field, order] = event.target.value.split(':');
                      setSortField(field);
                      setSortOrder(order);
                    }}
                    sx={{ minWidth: 160, borderRadius: 1.75 }}
                  >
                    <MenuItem value="status:asc">Sort: Attention</MenuItem>
                    <MenuItem value="property:asc">Sort: Property</MenuItem>
                    <MenuItem value="endDate:asc">Sort: Lease end</MenuItem>
                    <MenuItem value="rentAmount:desc">Sort: Highest rent</MenuItem>
                    <MenuItem value="startDate:desc">Sort: Newest start</MenuItem>
                  </Select>
                </Stack>
              </Stack>
              <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mt: 1.4 }}>
                <Typography sx={{ fontSize: '0.76rem', color: 'text.secondary' }}>
                  {displayLeases.length} of {allLeases.length} leases
                </Typography>
                {(leaseSearch || filters.status?.[0] !== 'current' || selectedProperty || sortField !== 'status' || sortOrder !== 'asc') && (
                  <Button
                    size="small"
                    onClick={() => {
                      setLeaseSearch('');
                      setFilters({ status: ['current'] });
                      dispatch(setProperty(null));
                      dispatch(setUnit(null));
                      setSortField('status');
                      setSortOrder('asc');
                    }}
                    sx={{ textTransform: 'none' }}
                  >
                    Reset view
                  </Button>
                )}
              </Stack>
            </Box>
            </AnimateIn>

            <AnimateIn direction="bottom" delay={500} distance={120}>
            <Grid container spacing={2.5} alignItems="flex-start">
              <Grid size={{ xs: 12 }}>
                <Stack spacing={2}>
                  {draftCount > 0 && (
                    <Paper
                      variant="outlined"
                      sx={{
                        p: 1.5,
                        display: 'flex',
                        alignItems: 'center',
                        gap: 1.5,
                        bgcolor: (t) => alpha(t.palette.warning.main, 0.05),
                        border: (t) => `1px solid ${alpha(t.palette.warning.main, 0.3)}`,
                        borderRadius: 2
                      }}
                    >
                      <AlertOutlined style={{ color: theme.palette.warning.main, fontSize: 18 }} />
                      <Typography variant="body2" sx={{ flex: 1 }}>
                        <strong>{draftCount} draft lease{draftCount > 1 ? 's' : ''}</strong> need{draftCount === 1 ? 's' : ''} to be finished before becoming active.
                      </Typography>
                    </Paper>
                  )}

                  {loading ? (
                    <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '400px' }}>
                      <CircularProgress />
                    </Box>
                  ) : sortedLeases.length > 0 ? (
                    isXs ? (
                      <Stack spacing={1.5}>
                        {paginatedLeases.map((lease) => {
                          const isSelected = selectedLeases.has(lease.id);
                          const hasLease = lease.hasLease !== false;
                          const rentRecord = rentRecords?.find((r) => r.leaseId === lease.id);
                          const leasePayments = (allPayments || []).filter((payment) => getPaymentLeaseId(payment) === Number(lease.id));
                          const isOverdue = rentRecord?.status === 'overdue';
                          const propertyTenantTitle = getPropertyTenantTitle(lease);
                          const isActiveLease = isStartedActiveLease(lease);
                          const balanceDue = rentRecord?.remainingBalance ?? (isOverdue ? (lease.rentAmount || 0) : 0);
                          const term = getLeaseMonths(lease);

                          return (
                            <Card
                              key={lease.id}
                              variant="outlined"
                              onClick={() => hasLease && navigate(`/landlord/leases/${lease.id}`)}
                              sx={{ borderRadius: 2, cursor: hasLease ? 'pointer' : 'default', boxShadow: `0 6px 18px ${alpha(theme.palette.common.black, 0.05)}` }}
                            >
                              <CardContent sx={{ p: 1.75, '&:last-child': { pb: 1.75 } }}>
                                <Stack spacing={1.25}>
                                  <Stack direction="row" spacing={1} alignItems="flex-start" justifyContent="space-between">
                                    <Stack direction="row" spacing={1} alignItems="flex-start" sx={{ minWidth: 0 }}>
                                      <Checkbox size="small" checked={isSelected} onClick={(e) => e.stopPropagation()} onChange={() => handleSelectLease(lease.id)} sx={{ p: 0.25 }} />
                                      <Box sx={{ minWidth: 0 }}>
                                        <Typography variant="body2" fontWeight={700} noWrap>{propertyTenantTitle}</Typography>
                                        <Typography variant="caption" color="text.secondary" noWrap sx={{ display: 'block', mb: 0.55 }}>{getTenantDisplay(lease)}</Typography>
                                        <Chip
                                          size="small"
                                          label={isActiveLease ? 'Active lease' : 'No active lease'}
                                          color={isActiveLease ? 'success' : 'default'}
                                          variant={isActiveLease ? 'filled' : 'outlined'}
                                          sx={{ height: 20, width: 'fit-content', '& .MuiChip-label': { px: 0.75, fontSize: '0.68rem', fontWeight: 700 } }}
                                        />
                                      </Box>
                                    </Stack>
                                    {hasLease ? (
                                      <IconButton size="small" aria-label={`Lease actions for ${propertyTenantTitle}`} onClick={(e) => { e.stopPropagation(); setActionMenuAnchor(e.currentTarget); setActionMenuLease(lease); }}>
                                        <MoreOutlined />
                                      </IconButton>
                                    ) : (
                                      <Button
                                        size="small"
                                        variant="outlined"
                                        startIcon={<PlusOutlined />}
                                        onClick={(e) => {
                                          e.stopPropagation();
                                          const params = new URLSearchParams();
                                          if (lease.propertyId) params.set('propertyId', lease.propertyId);
                                          if (lease.unitId) params.set('unitId', lease.unitId);
                                          navigate(`/landlord/leases/builder?${params.toString()}`);
                                        }}
                                        sx={{ textTransform: 'none', flexShrink: 0 }}
                                      >
                                        Add
                                      </Button>
                                    )}
                                  </Stack>

                                  <Stack direction="row" spacing={1.5} justifyContent="space-between">
                                    <Box>
                                      <Typography variant="caption" color="text.secondary">Rent</Typography>
                                      <Typography variant="body2" fontWeight={700}>{formatCurrency(lease.rentAmount || 0)}/mo</Typography>
                                    </Box>
                                    <Box sx={{ textAlign: 'right' }}>
                                      <Typography variant="caption" color="text.secondary">Balance</Typography>
                                      <Typography variant="body2" fontWeight={700} color={balanceDue > 0 ? 'error.main' : 'text.secondary'}>{balanceDue > 0 ? `${formatCurrency(balanceDue)} due` : 'No balance'}</Typography>
                                    </Box>
                                  </Stack>

                                  <PaymentHeartbeat lease={lease} payments={leasePayments} />

                                  <Box>
                                    <Stack direction="row" justifyContent="space-between" sx={{ mb: 0.5 }}>
                                      <Typography variant="caption" fontWeight={700}>{getLeaseTermLabel({ hasLease, ...term })}</Typography>
                                      <Typography variant="caption" color={term.overDays ? 'warning.main' : 'text.secondary'} sx={{ fontWeight: term.overDays ? 700 : 400 }}>
                                        {term.overDays ? `${term.overDays}d over` : term.daysLeft != null ? `${term.daysLeft}d left` : ''}
                                      </Typography>
                                    </Stack>
                                    <LinearProgress variant="determinate" value={term.progress} sx={{ height: 5, borderRadius: 99, bgcolor: (t) => alpha(t.palette.divider, t.palette.mode === 'dark' ? 0.32 : 0.28), '& .MuiLinearProgress-bar': { borderRadius: 99, bgcolor: term.overDays ? 'warning.main' : 'success.main' } }} />
                                  </Box>
                                </Stack>
                              </CardContent>
                            </Card>
                          );
                        })}

                        {displayLeases.length > 0 && (
                          <Stack spacing={1.25} sx={{ px: 0.5, py: 1 }}>
                            <Typography variant="body2" color="text.secondary" textAlign="center">
                              Showing {displayLeases.length === 0 ? 0 : leasesPage * leasesItemsPerPage + 1}–{Math.min(displayLeases.length, (leasesPage + 1) * leasesItemsPerPage)} of {displayLeases.length} leases
                            </Typography>
                            <Stack direction="row" spacing={1} justifyContent="center">
                              <Button size="small" variant="outlined" startIcon={<LeftOutlined />} onClick={() => handleLeasesPageChange(Math.max(0, leasesPage - 1))} disabled={leasesPage === 0} sx={{ minWidth: 92, textTransform: 'none' }}>Previous</Button>
                              <Button size="small" variant="outlined" endIcon={<RightOutlined />} onClick={() => handleLeasesPageChange(Math.min(leasesTotalPages - 1, leasesPage + 1))} disabled={leasesPage >= leasesTotalPages - 1} sx={{ minWidth: 72, textTransform: 'none' }}>Next</Button>
                            </Stack>
                          </Stack>
                        )}
                      </Stack>
                    ) : (
                    <Box sx={{ ...sectionCardSx, p: 0, overflow: 'hidden' }}>
                      <TableContainer sx={{ width: '100%', overflowX: 'auto' }}>
                        <Table size="small" sx={{ minWidth: 980 }}>
                          <TableHead>
                            <TableRow sx={{ bgcolor: (t) => alpha(t.palette.primary.main, t.palette.mode === 'dark' ? 0.07 : 0.025) }}>
                              <TableCell padding="none" sx={{ width: 44, pl: 1, pr: 0 }}>
                                <Checkbox
                                  size="small"
                                  checked={sortedLeases.length > 0 && sortedLeases.every((l) => selectedLeases.has(l.id))}
                                  indeterminate={selectedLeases.size > 0 && !sortedLeases.every((l) => selectedLeases.has(l.id))}
                                  onChange={handleSelectAll}
                                />
                              </TableCell>
                              <TableCell onClick={() => handleSort('property')} sx={{ cursor: 'pointer' }}>Property · Tenant</TableCell>
                              <TableCell align="right" onClick={() => handleSort('rentAmount')} sx={{ cursor: 'pointer', minWidth: 150, pr: 3.5 }}>Rent · Balance</TableCell>
                              <TableCell sx={{ pl: 3 }}>Payment Heartbeat</TableCell>
                              <TableCell onClick={() => handleSort('startDate')} sx={{ cursor: 'pointer' }}>Term</TableCell>
                              <TableCell align="right" />
                            </TableRow>
                          </TableHead>
                          <TableBody>
                            {paginatedLeases.map((lease) => {
                              const isSelected = selectedLeases.has(lease.id);
                              const hasLease = lease.hasLease !== false;
                              const rentRecord = rentRecords?.find((r) => r.leaseId === lease.id);
                              const leasePayments = (allPayments || []).filter((payment) => getPaymentLeaseId(payment) === Number(lease.id));
                              const isOverdue = rentRecord?.status === 'overdue';
                              const propertyTenantTitle = getPropertyTenantTitle(lease);
                              const isActiveLease = isStartedActiveLease(lease);
                              const balanceDue = rentRecord?.remainingBalance ?? (isOverdue ? (lease.rentAmount || 0) : 0);
                              const term = getLeaseMonths(lease);

                              const handleRowClick = (e) => {
                                const target = e.target;
                                const isActionElement = target.closest('button') || target.closest('[role="button"]') || target.closest('input[type="checkbox"]') || target.closest('.MuiIconButton-root') || target.closest('.MuiButton-root');
                                if (!isActionElement && hasLease) navigate(`/landlord/leases/${lease.id}`);
                              };

                              return (
                                <TableRow
                                  key={lease.id}
                                  hover
                                  selected={isSelected}
                                  onClick={handleRowClick}
                                  sx={{
                                    cursor: hasLease ? 'pointer' : 'default',
                                    bgcolor: 'transparent',
                                    borderLeft: '4px solid transparent',
                                    '& td': { py: 1.45, borderBottomColor: (t) => alpha(t.palette.divider, t.palette.mode === 'dark' ? 0.14 : 0.12) },
                                    '&:hover': { bgcolor: alpha(theme.palette.primary.main, 0.035) }
                                  }}
                                >
                                  <TableCell padding="none" sx={{ width: 44, pl: 1, pr: 0 }}>
                                    <Checkbox size="small" checked={isSelected} onChange={() => handleSelectLease(lease.id)} />
                                  </TableCell>
                                  <TableCell sx={{ width: 175, minWidth: 175, maxWidth: 190 }}>
                                    <Box sx={{ minWidth: 0 }}>
                                      <Typography variant="body2" fontWeight={700} noWrap>{propertyTenantTitle}</Typography>
                                      <Typography variant="caption" color="text.secondary" noWrap sx={{ display: 'block' }}>{getTenantDisplay(lease)}</Typography>
                                      <Chip
                                        size="small"
                                        label={isActiveLease ? 'Active lease' : 'No active lease'}
                                        color={isActiveLease ? 'success' : 'default'}
                                        variant={isActiveLease ? 'filled' : 'outlined'}
                                        sx={{ height: 20, mt: 0.35, '& .MuiChip-label': { px: 0.75, fontSize: '0.68rem', fontWeight: 700 } }}
                                      />
                                    </Box>
                                  </TableCell>
                                  <TableCell align="right" sx={{ minWidth: 150, pr: 3.5 }}>
                                    <Typography variant="body2" fontWeight={500}>{formatCurrency(lease.rentAmount || 0)}<Box component="span" sx={{ fontSize: '0.72rem', color: 'text.secondary', fontWeight: 400 }}> /mo</Box></Typography>
                                    <Typography variant="caption" sx={{ display: 'block', color: balanceDue > 0 ? 'error.main' : 'text.secondary', fontWeight: balanceDue > 0 ? 700 : 400, lineHeight: 1.2 }}>
                                      {balanceDue > 0 ? `${formatCurrency(balanceDue)} due` : 'No balance due'}
                                    </Typography>
                                  </TableCell>
                                  <TableCell sx={{ minWidth: 165, pl: 3 }}>
                                    <PaymentHeartbeat lease={lease} payments={leasePayments} />
                                  </TableCell>
                                  <TableCell sx={{ minWidth: 155 }}>
                                    <Stack direction="row" justifyContent="space-between" sx={{ mb: 0.5 }}>
                                      <Typography variant="body2" fontWeight={500}>{getLeaseTermLabel({ hasLease, ...term })}</Typography>
                                      <Typography variant="caption" color={term.overDays ? 'warning.main' : 'text.secondary'} sx={{ fontWeight: term.overDays ? 700 : 400 }}>
                                        {term.overDays ? `${term.overDays}d over` : term.daysLeft != null ? `${term.daysLeft}d left` : ''}
                                      </Typography>
                                    </Stack>
                                    <LinearProgress variant="determinate" value={term.progress} sx={{ height: 5, borderRadius: 99, bgcolor: (t) => alpha(t.palette.divider, t.palette.mode === 'dark' ? 0.32 : 0.28), '& .MuiLinearProgress-bar': { borderRadius: 99, bgcolor: term.overDays ? 'warning.main' : 'success.main' } }} />
                                  </TableCell>
                                  <TableCell align="right" onClick={(e) => e.stopPropagation()}>
                                    {hasLease ? (
                                      <IconButton size="small" onClick={(e) => { e.stopPropagation(); setActionMenuAnchor(e.currentTarget); setActionMenuLease(lease); }}>
                                        <MoreOutlined />
                                      </IconButton>
                                    ) : (
                                      <Button
                                        size="small"
                                        variant="outlined"
                                        startIcon={<PlusOutlined />}
                                        onClick={(e) => {
                                          e.stopPropagation();
                                          const params = new URLSearchParams();
                                          if (lease.propertyId) params.set('propertyId', lease.propertyId);
                                          if (lease.unitId) params.set('unitId', lease.unitId);
                                          navigate(`/landlord/leases/builder?${params.toString()}`);
                                        }}
                                        sx={{ textTransform: 'none' }}
                                      >
                                        Add Lease
                                      </Button>
                                    )}
                                  </TableCell>
                                </TableRow>
                              );
                            })}
                          </TableBody>
                        </Table>
                      </TableContainer>

                      {displayLeases.length > 0 && (
                        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', px: 2, py: 1.5, borderTop: `1px solid ${alpha(theme.palette.divider, 0.1)}` }}>
                          <Typography variant="body2" color="text.secondary">
                            Showing {displayLeases.length === 0 ? 0 : leasesPage * leasesItemsPerPage + 1}–{Math.min(displayLeases.length, (leasesPage + 1) * leasesItemsPerPage)} of {displayLeases.length} leases
                          </Typography>
                          <Stack direction="row" spacing={1.5} alignItems="center">
                            <Typography variant="body2" color="text.secondary">Items per page</Typography>
                            <FormControl size="small" sx={{ minWidth: 72 }}>
                              <Select value={leasesItemsPerPage} onChange={(e) => setLeasesItemsPerPage(Number(e.target.value))} sx={{ height: 32 }}>
                                <MenuItem value={10}>10</MenuItem>
                                <MenuItem value={20}>20</MenuItem>
                                <MenuItem value={50}>50</MenuItem>
                                <MenuItem value={100}>100</MenuItem>
                              </Select>
                            </FormControl>
                            <Button size="small" variant="outlined" startIcon={<LeftOutlined />} onClick={() => handleLeasesPageChange(Math.max(0, leasesPage - 1))} disabled={leasesPage === 0} sx={{ minWidth: 92, textTransform: 'none' }}>Previous</Button>
                            <Button size="small" variant="outlined" endIcon={<RightOutlined />} onClick={() => handleLeasesPageChange(Math.min(leasesTotalPages - 1, leasesPage + 1))} disabled={leasesPage >= leasesTotalPages - 1} sx={{ minWidth: 72, textTransform: 'none' }}>Next</Button>
                          </Stack>
                        </Box>
                      )}
                    </Box>
                    )
                  ) : (
                    <Box sx={{ ...sectionCardSx, p: 4, textAlign: 'center', borderStyle: 'dashed' }}>
                      <HomeOutlined style={{ fontSize: 64, color: alpha(theme.palette.text.secondary, theme.palette.mode === 'dark' ? 0.28 : 0.22) }} />
                      <Typography variant="h6" color="text.primary" sx={{ mt: 2 }}>
                        {view === 'current' ? 'No active leases to show' : view === 'renewals' ? 'No renewals need attention' : 'No historical leases yet'}
                      </Typography>
                      <Typography variant="body2" color="text.secondary" sx={{ mt: 1, maxWidth: 420, mx: 'auto' }}>
                        {leaseSearch.trim()
                          ? 'No leases match your search. Clear the search or try a tenant, property, or unit name.'
                          : view === 'current'
                            ? 'Create your first lease or add one from a vacant unit to start tracking rent, balances, and renewal dates.'
                            : view === 'renewals'
                              ? 'Leases expiring in the next 90 days will appear here so you can start renewal outreach.'
                              : 'Ended leases will appear here after you close them out.'}
                      </Typography>
                      {view === 'current' && !leaseSearch.trim() && (
                        <Button variant="contained" startIcon={<PlusOutlined />} onClick={() => drawer.openLeaseAddDrawer()} sx={{ mt: 2, textTransform: 'none' }}>
                          Create Lease
                        </Button>
                      )}
                    </Box>
                  )}
                </Stack>
              </Grid>

            </Grid>
            </AnimateIn>

            {/* Lease action menu */}
            <Menu
              anchorEl={actionMenuAnchor}
              open={Boolean(actionMenuAnchor)}
              onClose={() => { setActionMenuAnchor(null); setActionMenuLease(null); }}
              transformOrigin={{ horizontal: 'right', vertical: 'top' }}
              anchorOrigin={{ horizontal: 'right', vertical: 'bottom' }}
            >
              {actionMenuLease && (() => {
                const ml = actionMenuLease;
                const mlHasLeaseAgreement = Boolean(
                  ml?.leaseAgreement ||
                  ml?.LeaseAgreement ||
                  ml?.leaseAgreementId ||
                  ml?.LeaseAgreementId ||
                  ml?.agreementId ||
                  ml?.AgreementId
                );
                const close = () => { setActionMenuAnchor(null); setActionMenuLease(null); };
                const openAgreementBuilder = () => {
                  const params = new URLSearchParams();
                  if (ml.id) params.set('leaseId', ml.id);
                  if (ml.propertyId) params.set('propertyId', ml.propertyId);
                  if (ml.unitId) params.set('unitId', ml.unitId);
                  close();
                  openCreateAgreementDrawer(ml);
                };
                return [
                  <MenuItem key="edit" onClick={() => { close(); navigate(`/landlord/leases/${ml.id}/edit`); }}>
                    Edit Lease
                  </MenuItem>,
                  !mlHasLeaseAgreement && (
                    <MenuItem key="create-agreement" onClick={openAgreementBuilder}>
                      Create Lease Agreement
                    </MenuItem>
                  )
                ].filter(Boolean);
              })()}
            </Menu>

          </TabPanel>

          {/* Tab Panel: Lease Agreements */}
          <TabPanel key="lease-agreements" value={activeTab} index={1} slideDirection={slideDirection}>
            <AnimateIn direction="bottom" delay={300} distance={120}>
            <Grid container spacing={1.5} sx={{ mb: 2.5 }}>
              {[
                {
                  key: 'awaiting',
                  label: 'Awaiting signature',
                  value: leaseAgreementsMetrics.awaitingSignature,
                  caption: `${leaseAgreementsMetrics.signedComplete} fully signed`,
                  icon: FormOutlined,
                  tone: 'warning'
                },
                {
                  key: 'signed',
                  label: 'Signed agreements',
                  value: leaseAgreementsMetrics.signedComplete,
                  caption: `${leaseAgreementsMetrics.signedRate}% complete`,
                  icon: CheckCircleOutlined,
                  tone: 'success'
                },
                {
                  key: 'active',
                  label: 'Active agreements',
                  value: leaseAgreementsMetrics.active,
                  caption: `${leaseAgreementsMetrics.total} total agreements`,
                  icon: FileTextOutlined,
                  tone: 'primary'
                },
                {
                  key: 'expired',
                  label: 'Expired agreements',
                  value: leaseAgreementsMetrics.expired,
                  caption: leaseAgreementsMetrics.expired ? 'Review renewals' : 'No expired agreements',
                  icon: CloseCircleOutlined,
                  tone: 'error'
                }
              ].map((c) => {
                const Icon = c.icon;
                const paletteColor = theme.palette[c.tone]?.main || theme.palette.primary.main;
                const filterKey = c.key;
                const isActive = activeAgreementFilter === filterKey;

                return (
                  <Grid key={c.key} size={{ xs: 6, lg: 3 }}>
                    <SummaryCard
                      label={c.label}
                      value={c.value}
                      helper={c.caption}
                      icon={<Icon />}
                      color={paletteColor}
                      active={isActive}
                      onClick={() => setActiveAgreementFilter(isActive ? null : filterKey)}
                    />
                  </Grid>
                );
              })}
            </Grid>
            </AnimateIn>

            {/* Toolbar */}
            <AnimateIn direction="bottom" delay={400} distance={120}>
            <Box
              sx={{
                display: 'flex',
                gap: 1.5,
                alignItems: 'center',
                justifyContent: 'space-between',
                mb: 2,
                flexDirection: { xs: 'column', sm: 'row' }
              }}
            >
              <OutlinedInput
                size="small"
                placeholder="Search agreements, properties, tenants..."
                value={agreementSearch}
                onChange={(e) => setAgreementSearch(e.target.value)}
                startAdornment={
                  <InputAdornment position="start">
                    <SearchOutlined style={{ fontSize: 14, opacity: 0.5 }} />
                  </InputAdornment>
                }
                sx={{
                  flex: 1,
                  width: '100%',
                  minWidth: 0,
                  bgcolor: 'background.paper',
                  height: 34,
                  fontSize: '0.8rem'
                }}
              />
              <Button
                size="small"
                variant="contained"
                startIcon={<PlusOutlined style={{ fontSize: 16 }} />}
                onClick={() => openCreateAgreementDrawer()}
                sx={{ borderRadius: 1.5, textTransform: 'none', flexShrink: 0, fontWeight: 700, width: { xs: '100%', sm: 'auto' }, height: 34 }}
              >
                Create Lease Agreement
              </Button>
            </Box>
            </AnimateIn>

            <AnimateIn direction="bottom" delay={500} distance={120}>
            <Grid container spacing={2.5} alignItems="flex-start">
              <Grid size={{ xs: 12 }}>
                {loading || loadingAgreements ? (
                  <Box sx={{ display: 'flex', justifyContent: 'center', py: 4 }}>
                    <CircularProgress />
                  </Box>
                ) : displayLeaseAgreements.length === 0 ? (
                  <MainCard>
                    <Box sx={{ textAlign: 'center', py: 4 }}>
                      <Typography variant="h6" color="text.secondary">No lease agreements found</Typography>
                      <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
                        {selectedProperty ? 'Try adjusting your filter criteria.' : 'Lease agreements will appear here once leases are created.'}
                      </Typography>
                    </Box>
                  </MainCard>
                ) : (
                  <MainCard content={false} boxShadow border={false} shadow={theme.palette.mode === 'dark' ? `0 0 0 1px ${alpha(theme.palette.primary.main, 0.22)}, 0 8px 28px ${alpha(theme.palette.primary.main, 0.14)}` : `0 2px 12px ${alpha(theme.palette.primary.main, 0.08)}`} sx={{ overflow: 'hidden', borderRadius: 2, border: `1px solid ${alpha(theme.palette.divider, theme.palette.mode === 'dark' ? 0.18 : 0.1)}` }}>
                    <TableContainer>
                      <Table size="small">
                        <TableHead>
                          <TableRow sx={{ bgcolor: (t) => alpha(t.palette.grey[500], 0.04) }}>
                            <TableCell sx={{ fontSize: '0.68rem', textTransform: 'uppercase', letterSpacing: 0.8, color: 'text.secondary', fontWeight: 800 }}>Property · tenant</TableCell>
                            <TableCell sx={{ fontSize: '0.68rem', textTransform: 'uppercase', letterSpacing: 0.8, color: 'text.secondary', fontWeight: 800 }} align="center">Tenant signed</TableCell>
                            <TableCell sx={{ fontSize: '0.68rem', textTransform: 'uppercase', letterSpacing: 0.8, color: 'text.secondary', fontWeight: 800 }} align="center">Owner signed</TableCell>
                            <TableCell sx={{ fontSize: '0.68rem', textTransform: 'uppercase', letterSpacing: 0.8, color: 'text.secondary', fontWeight: 800 }}>Term</TableCell>
                            <TableCell sx={{ fontSize: '0.68rem', textTransform: 'uppercase', letterSpacing: 0.8, color: 'text.secondary', fontWeight: 800 }}>Status</TableCell>
                            <TableCell sx={{ fontWeight: 600 }} align="right" />
                          </TableRow>
                        </TableHead>
                        <TableBody>
                          {paginatedLeaseAgreements.map((leaseAgreement) => {
                            const propertyDisplay = leaseAgreement.propertyName?.trim() || (() => {
                              const addr = leaseAgreement.propertyStreetAddress?.trim() || '';
                              if (!addr) return '—';
                              if (addr.includes(',')) return addr.split(',')[0].trim();
                              return addr.replace(/\s+\d{5}(-\d{4})?$/, '').trim() || addr;
                            })();
                            const tenantCount = leaseAgreement.tenants?.length ?? 0;
                            const tenantsSignedCount = (leaseAgreement.tenants || []).filter((t) => !!(t.tenantSignedAt ?? t.TenantSignedAt)).length;
                            const weSigned = !!(leaseAgreement.landlordSignedAt ?? leaseAgreement.LandlordSignedAt);
                            const isMultiUnit = leaseAgreement.propertyType?.toLowerCase() !== 'singlefamily' && leaseAgreement.unitName;
                            const agreementStatus = getAgreementStatus(leaseAgreement);
                            const tenantDisplay = getTenantDisplay(leaseAgreement);

                            return (
                              <TableRow key={leaseAgreement.id} hover onClick={() => handleViewLeaseFromAgreement(leaseAgreement)} sx={{ cursor: 'pointer', '& td': { borderBottomColor: (t) => alpha(t.palette.divider, 0.08) } }}>
                                <TableCell>
                                  <Box sx={{ minWidth: 0 }}>
                                    <Stack direction="row" spacing={0.75} alignItems="center" flexWrap="wrap">
                                      <Typography variant="body2" fontWeight={500}>{propertyDisplay}</Typography>
                                      {isMultiUnit && <Typography variant="caption" color="text.secondary">#{leaseAgreement.unitName}</Typography>}
                                    </Stack>
                                    <Typography variant="caption" color="text.secondary" noWrap sx={{ display: 'block' }}>{tenantDisplay}</Typography>
                                  </Box>
                                </TableCell>
                                <TableCell align="center">
                                  <Typography variant="body2" fontWeight={500}>{tenantCount > 0 ? `${tenantsSignedCount}/${tenantCount}` : '—'}</Typography>
                                </TableCell>
                                <TableCell align="center">
                                  <Typography variant="body2" fontWeight={500}>{weSigned ? '1/1' : '0/1'}</Typography>
                                </TableCell>
                                <TableCell>
                                  <Typography variant="body2" color="text.secondary">
                                    {leaseAgreement.startDate && leaseAgreement.endDate
                                      ? `${formatDate(leaseAgreement.startDate)} – ${formatDate(leaseAgreement.endDate)}`
                                      : '—'}
                                  </Typography>
                                </TableCell>
                                <TableCell>
                                  {(() => {
                                    const statusConfig = {
                                      incomplete: { label: 'Incomplete', color: 'default' },
                                      need_to_be_signed: { label: 'Need to be signed', color: 'warning' },
                                      complete: { label: 'Complete', color: 'success' }
                                    };
                                    const { label, color } = statusConfig[agreementStatus];
                                    return <Chip label={label} color={color} size="small" />;
                                  })()}
                                </TableCell>
                                <TableCell align="right" onClick={(e) => e.stopPropagation()}>
                                  <Stack direction="row" spacing={0.5} justifyContent="flex-end" alignItems="center">
                                    {agreementStatus === 'need_to_be_signed' && (
                                      <Button size="small" variant="contained" startIcon={<FormOutlined style={{ fontSize: 14 }} />} onClick={() => handleSignLeaseFromAgreement(leaseAgreement)} sx={{ textTransform: 'none', px: 1.5 }}>
                                        Sign
                                      </Button>
                                    )}
                                    <IconButton size="small" onClick={(e) => { setAgreementActionMenuAnchor(e.currentTarget); setAgreementActionMenuLease(leaseAgreement); }}>
                                      <MoreOutlined />
                                    </IconButton>
                                  </Stack>
                                </TableCell>
                              </TableRow>
                            );
                          })}
                        </TableBody>
                      </Table>
                    </TableContainer>

                    {displayLeaseAgreements.length > 0 && (
                      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: { xs: 'stretch', sm: 'center' }, gap: 1.5, p: 2, borderTop: `1px solid ${alpha(theme.palette.divider, 0.1)}`, flexDirection: { xs: 'column', sm: 'row' } }}>
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                          <Typography variant="body2" color="text.secondary">Items per page:</Typography>
                          <FormControl size="small" sx={{ minWidth: 80 }}>
                            <Select value={leaseAgreementsItemsPerPage} onChange={(e) => setLeaseAgreementsItemsPerPage(Number(e.target.value))} sx={{ height: 32 }}>
                              <MenuItem value={10}>10</MenuItem>
                              <MenuItem value={20}>20</MenuItem>
                            </Select>
                          </FormControl>
                        </Box>
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, justifyContent: { xs: 'space-between', sm: 'flex-end' } }}>
                          <Typography variant="body2" color="text.secondary">Page {leaseAgreementsPage + 1} of {leaseAgreementsTotalPages}</Typography>
                          <Box sx={{ display: 'flex', gap: 1 }}>
                            <Button size="small" variant="outlined" startIcon={<LeftOutlined />} onClick={() => handleLeaseAgreementsPageChange(Math.max(0, leaseAgreementsPage - 1))} disabled={leaseAgreementsPage === 0} sx={{ minWidth: 100 }}>Previous</Button>
                            <Button size="small" variant="outlined" endIcon={<RightOutlined />} onClick={() => handleLeaseAgreementsPageChange(Math.min(leaseAgreementsTotalPages - 1, leaseAgreementsPage + 1))} disabled={leaseAgreementsPage >= leaseAgreementsTotalPages - 1} sx={{ minWidth: 100 }}>Next</Button>
                          </Box>
                        </Box>
                      </Box>
                    )}
                  </MainCard>
                )}
              </Grid>

            </Grid>
            </AnimateIn>

            {/* Agreement action menu */}
            <Menu
              anchorEl={agreementActionMenuAnchor}
              open={Boolean(agreementActionMenuAnchor)}
              onClose={() => { setAgreementActionMenuAnchor(null); setAgreementActionMenuLease(null); }}
              transformOrigin={{ horizontal: 'right', vertical: 'top' }}
              anchorOrigin={{ horizontal: 'right', vertical: 'bottom' }}
            >
              {agreementActionMenuLease && (() => {
                const la = agreementActionMenuLease;
                const close = () => { setAgreementActionMenuAnchor(null); setAgreementActionMenuLease(null); };
                return [
                  <MenuItem key="view-lease" onClick={() => { close(); handleViewLeaseFromAgreement(la); }}>View Lease</MenuItem>,
                  la.hasAgreement && <MenuItem key="view-agreement" onClick={() => { close(); handleViewAgreement(la); }}>View Agreement</MenuItem>,
                  getAgreementStatus(la) === 'need_to_be_signed' && <MenuItem key="sign" onClick={() => { close(); handleSignLeaseFromAgreement(la); }}>Sign Agreement</MenuItem>,
                ].filter(Boolean);
              })()}
            </Menu>
          </TabPanel>
        </Box>

      {/* End Lease Confirmation Dialog */}
      <ConfirmationDialog
        open={endLeaseConfirmOpen}
        onClose={() => {
          setEndLeaseConfirmOpen(false);
          setLeaseToEnd(null);
        }}
        onConfirm={handleConfirmEndLease}
        title="End Lease"
        message={
          leaseToEnd
            ? `Are you sure you want to end this lease? This will mark the lease as inactive. The lease data will be preserved but it will no longer be active.`
            : 'Are you sure you want to end this lease?'
        }
        confirmText="End Lease"
        cancelText="Cancel"
        confirmColor="warning"
      />

      {/* Reopen Lease Confirmation Dialog */}
      <ConfirmationDialog
        open={reopenLeaseConfirmOpen}
        onClose={() => {
          setReopenLeaseConfirmOpen(false);
          setLeaseToReopen(null);
        }}
        onConfirm={handleConfirmReopenLease}
        title="Reopen Lease"
        message={
          leaseToReopen
            ? `Are you sure you want to reopen this lease? This will mark the lease as active again.`
            : 'Are you sure you want to reopen this lease?'
        }
        confirmText="Reopen Lease"
        cancelText="Cancel"
        confirmColor="success"
      />


      <LeaseAddDrawer />
      <CreateLeaseAgreementDrawer
        open={createAgreementDrawerOpen}
        onClose={() => { setCreateAgreementDrawerOpen(false); setCreateAgreementInitialLease(null); }}
        properties={properties}
        initialLease={createAgreementInitialLease}
        onSetup={handleSetupCreatedAgreement}
      />
      <RenewLeaseDrawer onRenewSuccess={() => propertiesRefetch()} />
      <LeaseViewDrawer />
      </Box>
    </Fade>
  );
}
