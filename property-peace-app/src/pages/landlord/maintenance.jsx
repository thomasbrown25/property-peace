import { useEffect, useState, useRef, useMemo } from 'react';
import {
  alpha, Avatar, Box, Button, Chip, CircularProgress, Dialog, DialogActions,
  DialogContent, DialogTitle, Divider, Grid, IconButton, Stack, TextField,
  Typography, useTheme
} from '@mui/material';
import {
  CalendarOutlined, CheckCircleOutlined, CheckOutlined, CloseOutlined,
  EditOutlined, HomeOutlined, MessageOutlined, PaperClipOutlined,
  PhoneOutlined, PlusOutlined, RobotOutlined, ToolOutlined,
  ReloadOutlined, SendOutlined, UserOutlined
} from '@ant-design/icons';
import { useNavigate, useParams } from 'react-router-dom';
import { useSelector, useDispatch } from 'react-redux';
import { formatDate, formatCurrency, formatPhoneInput } from 'utils/formatters';
import MainCard from 'components/MainCard';
import { selectMaintenanceRequests, selectHistoryMaintenances, selectMaintenanceLoading } from 'store/maintenance/maintenance.selector';
import { selectProperties } from 'store/property/property.selector';
import useFetchMaintenances from 'hooks/useFetchMaintenances';
import {
  updateMaintenance, deleteMaintenance, reopenMaintenanceRequest,
  addMaintenanceImages, resolveMaintenanceRequest, analyzeMaintenanceRequest
} from 'store/maintenance/maintenance.action';
import ConfirmationDialog from 'components/dialogs/ConfirmationDialog';
import { openSnackbar } from 'api/snackbar';
import MaintenanceEditDrawer from 'components/drawers/MaintenanceEditDrawer';
import VendorAssignDrawer from 'components/drawers/VendorAssignDrawer';
import TenantMessageDrawer from 'components/drawers/TenantMessageDrawer';
import { useDrawer } from 'contexts/DrawerContext';
import PageBreadcrumbs from 'components/breadcrumbs/PageBreadcrumbs';
import { expenseAPI } from 'api';
import { getMessages, addMessage } from 'api/message';
import ExpenseAddDrawer from 'components/expense/ExpenseAddDrawer';
import { format, startOfMonth, endOfMonth, startOfWeek, endOfWeek, eachDayOfInterval, addMonths, subMonths, isSameDay, isSameMonth, isToday } from 'date-fns';

// ─── Status stepper config ────────────────────────────────────────────────────
const STEPS = [
  { key: 'reported',   label: 'Reported',    num: 1 },
  { key: 'acknowledged', label: 'Acknowledged', num: 2 },
  { key: 'scheduled',  label: 'Scheduled',   num: 3 },
  { key: 'inprogress', label: 'In progress', num: 4 },
  { key: 'resolved',   label: 'Resolved',    num: 5 },
];

function normalizeStatus(s) {
  return (s || '').toString().toLowerCase().replace(/[-_ ]/g, '');
}

function getStepIndex(status) {
  const n = normalizeStatus(status);
  const idx = STEPS.findIndex(s => s.key === n);
  return idx === -1 ? 0 : idx;
}

function priorityColor(p) {
  const s = (p || '').toLowerCase();
  if (s === 'high') return { bg: '#fde8e8', color: '#c62828' };
  if (s === 'medium') return { bg: '#fff3e0', color: '#e65100' };
  return { bg: '#e8f5e9', color: '#2e7d32' };
}

function getMaintenanceLinkedExpenses(response, maintenanceId) {
  const data = response?.data?.success
    ? response.data.data
    : response?.success
      ? response.data
      : Array.isArray(response?.data)
        ? response.data
        : Array.isArray(response)
          ? response
          : [];

  const targetMaintenanceId = Number(maintenanceId);
  return (Array.isArray(data) ? data : []).filter((expense) => {
    const linkedId = expense?.maintenanceRequestId
      ?? expense?.MaintenanceRequestId
      ?? expense?.maintenanceRequest?.id
      ?? expense?.MaintenanceRequest?.Id;
    return Number(linkedId) === targetMaintenanceId;
  });
}

function getExpenseValue(expense, lowerKey, upperKey) {
  return expense?.[lowerKey] ?? expense?.[upperKey];
}

// ─── Stepper ─────────────────────────────────────────────────────────────────
function StatusStepper({ status, createdAt, scheduledDate, completedAt, onStepClick, disabled }) {
  const theme = useTheme();
  const current = getStepIndex(status);

  const stepDates = [
    createdAt   ? format(new Date(createdAt),    'MMM d · h:mm a') : null,
    null,
    scheduledDate ? format(new Date(scheduledDate), 'MMM d · h:mm a') : null,
    null,
    completedAt ? format(new Date(completedAt),  'MMM d · h:mm a') : null,
  ];

  return (
    <Box sx={{ mb: 2.5, bgcolor: 'background.paper', border: '1px solid rgba(0,0,0,0.09)', borderRadius: 2.5, overflow: 'hidden' }}>
    <Box sx={{ display: 'flex', overflowX: { xs: 'auto', sm: 'visible' }, scrollbarWidth: 'none', '&::-webkit-scrollbar': { display: 'none' } }}>
      {STEPS.map((step, i) => {
        const isLastAndResolved = i === current && i === STEPS.length - 1;
        const done   = i < current || isLastAndResolved;
        const active = i === current && !isLastAndResolved;
        return (
          <Box
            key={step.key}
            role="button"
            tabIndex={disabled ? -1 : 0}
            aria-label={`Change maintenance status to ${step.label}`}
            onClick={() => !disabled && onStepClick?.(step)}
            onKeyDown={(e) => {
              if (disabled) return;
              if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                onStepClick?.(step);
              }
            }}
            sx={{
            flex: { xs: '0 0 130px', sm: 1 },
            px: 1.75, py: 1.5,
            borderRight: i < STEPS.length - 1 ? '1px solid rgba(0,0,0,0.09)' : 'none',
            borderBottom: active ? '3px solid #1877F2' : '3px solid transparent',
            bgcolor: active ? 'rgba(24,119,242,0.04)' : 'background.paper',
            cursor: disabled ? 'default' : 'pointer',
            transition: 'background-color 140ms ease, box-shadow 140ms ease',
            '&:hover': disabled ? {} : { bgcolor: active ? 'rgba(24,119,242,0.08)' : 'rgba(24,119,242,0.035)' },
            '&:focus-visible': { outline: '2px solid #1877F2', outlineOffset: -2 },
          }}>
            <Typography sx={{ fontSize: '0.58rem', fontWeight: 700, letterSpacing: 0.6, textTransform: 'uppercase', mb: 0.75,
              color: active ? '#1877F2' : 'rgba(0,0,0,0.35)' }}>
              STEP {step.num}{active ? ' · NOW' : ''}
            </Typography>
            <Stack direction="row" alignItems="center" spacing={0.75}>
              {done ? (
                <Box sx={{ width: 22, height: 22, borderRadius: '50%', bgcolor: theme.palette.success.main, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, boxShadow: `0 2px 6px ${alpha(theme.palette.success.main, 0.4)}` }}>
                  <CheckOutlined style={{ fontSize: 11, color: '#fff', fontWeight: 700 }} />
                </Box>
              ) : active ? (
                <Box sx={{
                  width: 26, height: 26, borderRadius: '50%',
                  background: 'linear-gradient(135deg, #1877F2, #1464CC)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
                  boxShadow: '0 0 0 4px rgba(24,119,242,0.18)',
                  animation: 'pulse-blue 1.8s ease-in-out infinite',
                  '@keyframes pulse-blue': {
                    '0%':   { boxShadow: '0 0 0 0 rgba(24,119,242,0.4)' },
                    '70%':  { boxShadow: '0 0 0 8px rgba(24,119,242,0)' },
                    '100%': { boxShadow: '0 0 0 0 rgba(24,119,242,0)' },
                  }
                }}>
                  <Typography sx={{ fontSize: '0.7rem', fontWeight: 700, color: '#fff', lineHeight: 1 }}>{step.num}</Typography>
                </Box>
              ) : (
                <Box sx={{ width: 20, height: 20, borderRadius: '50%', border: '2px solid rgba(0,0,0,0.18)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                  <Typography sx={{ fontSize: '0.62rem', fontWeight: 600, color: 'text.disabled', lineHeight: 1 }}>{step.num}</Typography>
                </Box>
              )}
              <Typography sx={{ fontSize: '0.82rem', fontWeight: 700, color: 'text.primary' }}>
                {step.label}
              </Typography>
            </Stack>
            <Stack direction="row" alignItems="center" spacing={0.75} sx={{ mt: 0.5 }}>
              <Box sx={{ width: 22, flexShrink: 0 }} />
              <Typography sx={{ fontSize: '0.65rem', color: active ? '#1877F2' : done ? 'text.secondary' : 'text.disabled' }}>
                {stepDates[i] || (active ? 'Awaiting action' : '—')}
              </Typography>
            </Stack>
          </Box>
        );
      })}
    </Box>
    </Box>
  );
}

// ─── Scheduled Visit Card with mini calendar ─────────────────────────────────
function ScheduledVisitCard({ scheduledDateObj, vendorDisplay, onSchedule, onCancel, onOpenCalendar }) {
  const theme = useTheme();
  const [calMonth, setCalMonth] = useState(scheduledDateObj || new Date());

  const monthStart = startOfMonth(calMonth);
  const monthEnd   = endOfMonth(calMonth);
  const gridStart  = startOfWeek(monthStart);
  const gridEnd    = endOfWeek(monthEnd);
  const days = eachDayOfInterval({ start: gridStart, end: gridEnd });
  const weeks = [];
  for (let i = 0; i < days.length; i += 7) weeks.push(days.slice(i, i + 7));

  return (
    <Box sx={{ borderRadius: 2.5, border: '1.5px solid #bfdbfe', bgcolor: '#eff6ff', overflow: 'hidden' }}>
      {/* Header */}
      <Box sx={{ px: 2, pt: 1.75, pb: 0 }}>
        <Stack direction="row" alignItems="center" justifyContent="space-between" sx={{ mb: 0.75 }}>
          <Stack direction="row" alignItems="center" spacing={0.75}>
            <CalendarOutlined style={{ fontSize: 12, color: '#1877F2' }} />
            <Typography sx={{ fontSize: '0.62rem', fontWeight: 700, letterSpacing: 1, color: '#1877F2', textTransform: 'uppercase' }}>
              {scheduledDateObj ? 'Scheduled Visit' : 'Visit Schedule'}
            </Typography>
          </Stack>
          <Button size="small" variant="text" onClick={onOpenCalendar}
            sx={{ textTransform: 'none', fontSize: '0.72rem', color: '#1877F2', fontWeight: 600, p: 0, minWidth: 0 }}>
            Open in Calendar →
          </Button>
        </Stack>
        {scheduledDateObj ? (
          <>
            <Typography variant="h5" fontWeight={700} sx={{ mb: 0.2, color: '#1e3a5f' }}>
              {format(scheduledDateObj, 'EEE, MMM d')}
            </Typography>
            <Stack direction="row" alignItems="center" spacing={0.5} sx={{ mb: 1.5 }}>
              <CloseOutlined style={{ fontSize: 11, color: '#64748b', transform: 'rotate(45deg)' }} />
              <Typography variant="body2" sx={{ fontSize: '0.8rem', color: '#64748b' }}>
                {format(scheduledDateObj, 'h:mm a')}{vendorDisplay ? ` · with ${vendorDisplay}` : ''}
              </Typography>
            </Stack>
          </>
        ) : (
          <Typography variant="body2" sx={{ mb: 1.5, fontSize: '0.82rem', color: '#64748b' }}>
            No visit scheduled yet
          </Typography>
        )}
      </Box>

      {/* Mini calendar */}
      <Box sx={{ px: 1.5, pb: 1.5 }}>
        <Box sx={{ bgcolor: '#fff', borderRadius: 2, border: '1px solid #e2e8f0', overflow: 'hidden', p: 1.25 }}>
          {/* Month nav */}
          <Stack direction="row" alignItems="center" justifyContent="space-between" sx={{ mb: 1 }}>
            <Typography sx={{ fontSize: '0.82rem', fontWeight: 700, color: '#1e3a5f' }}>{format(calMonth, 'MMMM yyyy')}</Typography>
            <Stack direction="row" spacing={0.25}>
              <IconButton size="small" onClick={() => setCalMonth(m => subMonths(m, 1))} sx={{ p: 0.4, color: '#94a3b8' }}>
                <Typography sx={{ fontSize: '1rem', lineHeight: 1, color: 'inherit' }}>‹</Typography>
              </IconButton>
              <IconButton size="small" onClick={() => setCalMonth(m => addMonths(m, 1))} sx={{ p: 0.4, color: '#94a3b8' }}>
                <Typography sx={{ fontSize: '1rem', lineHeight: 1, color: 'inherit' }}>›</Typography>
              </IconButton>
            </Stack>
          </Stack>

          {/* Day headers */}
          <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', mb: 0.25 }}>
            {['S','M','T','W','T','F','S'].map((d, i) => (
              <Typography key={i} sx={{ textAlign: 'center', fontSize: '0.62rem', fontWeight: 600, color: '#94a3b8', py: 0.25 }}>{d}</Typography>
            ))}
          </Box>

          {/* Weeks */}
          {weeks.map((week, wi) => (
            <Box key={wi} sx={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)' }}>
              {week.map((day, di) => {
                const isScheduled = scheduledDateObj ? isSameDay(day, scheduledDateObj) : false;
                const todayDay    = isToday(day);
                const inMonth     = isSameMonth(day, calMonth);
                return (
                  <Box key={di} sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', py: 0.3 }}>
                    <Box sx={{
                      width: 28, height: 28,
                      borderRadius: isScheduled ? 1.5 : '50%',
                      border: todayDay && !isScheduled ? '1.5px solid #1877F2' : 'none',
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      background: isScheduled ? 'linear-gradient(135deg, #1877F2, #1464CC)' : 'transparent',
                      boxShadow: isScheduled ? '0 2px 8px rgba(24,119,242,0.35)' : 'none',
                    }}>
                      <Typography sx={{
                        fontSize: '0.72rem',
                        fontWeight: isScheduled || todayDay ? 700 : 400,
                        color: isScheduled ? '#fff' : todayDay ? '#1877F2' : inMonth ? '#1e293b' : '#cbd5e1',
                      }}>
                        {format(day, 'd')}
                      </Typography>
                    </Box>
                  </Box>
                );
              })}
            </Box>
          ))}
        </Box>
      </Box>

      {/* Actions */}
      <Box sx={{ borderTop: '1px solid #bfdbfe' }}>
        <Stack direction="row">
          <Button fullWidth onClick={onSchedule}
            sx={{ textTransform: 'none', fontWeight: 600, fontSize: '0.82rem', py: 1.25, borderRadius: 0, color: '#1e293b', '&:hover': { bgcolor: 'rgba(0,0,0,0.04)' } }}>
            {scheduledDateObj ? 'Reschedule' : 'Schedule visit'}
          </Button>
          {scheduledDateObj && (
            <>
              <Box sx={{ width: '1px', bgcolor: '#bfdbfe' }} />
              <Button fullWidth onClick={onCancel}
                sx={{ textTransform: 'none', fontWeight: 600, fontSize: '0.82rem', py: 1.25, borderRadius: 0, color: '#ef4444', '&:hover': { bgcolor: 'rgba(239,68,68,0.05)' } }}>
                Cancel visit
              </Button>
            </>
          )}
        </Stack>
      </Box>
    </Box>
  );
}

// ─── Conversation message bubble ─────────────────────────────────────────────
function MessageBubble({ msg }) {
  const theme = useTheme();
  const isSystem = msg.role === 'system' || msg.isSystem;
  const isAssistant = msg.role === 'assistant';
  if (isSystem) {
    return (
      <Box sx={{ textAlign: 'center', py: 0.5 }}>
        <Typography variant="caption" sx={{ fontSize: '0.72rem', color: 'text.disabled', fontStyle: 'italic' }}>
          {msg.content}
        </Typography>
      </Box>
    );
  }
  return (
    <Stack direction={isAssistant ? 'row' : 'row-reverse'} spacing={1} alignItems="flex-start" sx={{ mb: 1.5 }}>
      <Avatar sx={{ width: 28, height: 28, fontSize: '0.7rem', fontWeight: 700, flexShrink: 0,
        bgcolor: isAssistant ? theme.palette.primary.main : theme.palette.success.main }}>
        {isAssistant ? 'AI' : (msg.senderName?.[0] || 'T')}
      </Avatar>
      <Box sx={{ maxWidth: '75%' }}>
        <Stack direction="row" alignItems="center" spacing={1} sx={{ mb: 0.4 }}>
          <Typography variant="caption" fontWeight={600} sx={{ fontSize: '0.75rem' }}>
            {isAssistant ? 'AI Agent' : (msg.senderName || 'Tenant')}
          </Typography>
          {msg.createdAt && (
            <Typography variant="caption" color="text.disabled" sx={{ fontSize: '0.68rem' }}>
              {format(new Date(msg.createdAt), 'MMM d · h:mm a')}
            </Typography>
          )}
        </Stack>
        <Box sx={{
          px: 1.5, py: 1,
          borderRadius: isAssistant ? '4px 12px 12px 12px' : '12px 4px 12px 12px',
          bgcolor: isAssistant ? alpha(theme.palette.primary.main, 0.08) : '#f0fdf4',
          border: `1px solid ${isAssistant ? alpha(theme.palette.primary.main, 0.15) : alpha(theme.palette.success.main, 0.2)}`
        }}>
          <Typography variant="body2" sx={{ fontSize: '0.875rem', lineHeight: 1.55, whiteSpace: 'pre-wrap' }}>
            {msg.content}
          </Typography>
        </Box>
      </Box>
    </Stack>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────
export default function MaintenancePage() {
  const navigate = useNavigate();
  const { maintenanceId } = useParams();
  const dispatch = useDispatch();
  const drawer = useDrawer();
  const theme = useTheme();

  const [openDeleteConfirm, setOpenDeleteConfirm] = useState(false);
  const [isResolving, setIsResolving] = useState(false);
  const [savingStatusStep, setSavingStatusStep] = useState(false);
  const [optimisticStatus, setOptimisticStatus] = useState(null);
  const [expenses, setExpenses] = useState([]);
  const [loadingExpenses, setLoadingExpenses] = useState(false);
  const [expenseModalOpen, setExpenseModalOpen] = useState(false);
  const [imageUploading, setImageUploading] = useState(false);
  const [aiTriage, setAiTriage] = useState(null);
  const [loadingAI, setLoadingAI] = useState(false);
  const [scheduleOpen, setScheduleOpen] = useState(false);
  const [scheduleDateInput, setScheduleDateInput] = useState('');
  const [scheduleTimeInput, setScheduleTimeInput] = useState('');
  const [savingSchedule, setSavingSchedule] = useState(false);
  const [conversationMessages, setConversationMessages] = useState([]);
  const [convFilter, setConvFilter] = useState('all');
  const [messageDrawerOpen, setMessageDrawerOpen] = useState(false);
  const [replyText, setReplyText] = useState('');
  const [sendingReply, setSendingReply] = useState(false);
  const imageInputRef = useRef(null);
  const convEndRef = useRef(null);

  const { refetch } = useFetchMaintenances();
  const requests = useSelector(selectMaintenanceRequests);
  const historyRequests = useSelector(selectHistoryMaintenances);
  const allRequests = [...(requests || []), ...(historyRequests || [])];
  const maintenance = allRequests.find(m => m.id === Number(maintenanceId));
  const maintenanceLoading = useSelector(selectMaintenanceLoading);
  const properties = useSelector(selectProperties);

  useEffect(() => { refetch(); }, [refetch]);

  useEffect(() => {
    const fetchExpenses = async () => {
      if (!maintenanceId || !maintenance) return;
      setLoadingExpenses(true);
      try {
        const filters = maintenance.propertyId ? { propertyId: maintenance.propertyId } : {};
        const res = await expenseAPI.getExpenses(filters);
        setExpenses(getMaintenanceLinkedExpenses(res, maintenanceId));
      } catch { setExpenses([]); } finally { setLoadingExpenses(false); }
    };
    fetchExpenses();
  }, [maintenance, maintenanceId]);

  useEffect(() => {
    if (maintenance?.scheduledDate) {
      const d = new Date(maintenance.scheduledDate);
      setScheduleDateInput(format(d, 'yyyy-MM-dd'));
      setScheduleTimeInput(format(d, 'HH:mm'));
    }
  }, [maintenance?.scheduledDate]);

  // Fetch linked conversation messages
  useEffect(() => {
    if (!maintenance?.conversationId) return;
    const load = async () => {
      try {
        const res = await getMessages(maintenance.conversationId, 0, 100);
        if (res?.success && Array.isArray(res.data)) {
          setConversationMessages(res.data.map(m => ({
            id: m.id,
            role: m.senderName?.toLowerCase().includes('ai') || m.senderName?.toLowerCase().includes('agent') ? 'assistant' : 'user',
            content: m.content,
            senderName: m.senderName,
            createdAt: m.createdAt,
            tag: 'message',
          })));
        }
      } catch { /* silent */ }
    };
    load();
  }, [maintenance?.conversationId]);

  // Auto-scroll to bottom when messages update
  useEffect(() => {
    convEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [conversationMessages]);

  // Auto-fetch AI triage on mount if description exists
  useEffect(() => {
    if (maintenance?.description && !aiTriage && !loadingAI) {
      fetchAITriage();
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [maintenance?.id]);

  const tenantInfo = useMemo(() => {
    if (!maintenance?.propertyId) return null;
    const prop = (properties || []).find(p => (p.id || p.Id) === maintenance.propertyId);
    if (!prop) return null;
    const unit = (prop.units || []).find(u => (u.id || u.Id) === maintenance.unitId) || (prop.units || [])[0];
    const lease = unit?.lease || unit?.Lease;
    const tenants = lease?.tenants || lease?.Tenants || [];
    const t = tenants[0];
    if (!t) return null;
    return {
      id: t.id || t.Id,
      userId: t.userId || t.UserId,
      firstname: t.firstname || t.Firstname || '',
      lastname: t.lastname || t.Lastname || '',
      name: `${t.firstname || t.Firstname || ''} ${t.lastname || t.Lastname || ''}`.trim(),
      email: t.email || t.Email || '',
      phone: t.phoneNumber || t.PhoneNumber || '',
      leaseEnd: lease?.endDate || lease?.EndDate,
      unitName: unit?.name || unit?.Name || maintenance.unitName,
      propertyName: prop.name || prop.Name || maintenance.propertyName,
    };
  }, [properties, maintenance]);

  const tenantProperty = useMemo(() => {
    if (!maintenance?.propertyId) return null;
    return (properties || []).find(p => (p.id || p.Id) === maintenance.propertyId) || null;
  }, [properties, maintenance]);

  const maintenanceUnit = useMemo(() => {
    if (!tenantProperty || !maintenance?.unitId) return null;
    return (tenantProperty.units || tenantProperty.Units || []).find(u => (u.id || u.Id) === maintenance.unitId) || null;
  }, [tenantProperty, maintenance]);

  const fetchAITriage = async () => {
    if (!maintenance?.description || loadingAI) return;
    setLoadingAI(true);
    try {
      const result = await dispatch(analyzeMaintenanceRequest(maintenance.title || '', maintenance.description));
      if (result) setAiTriage(result?.data ?? result);
    } catch { /* fail silently */ } finally { setLoadingAI(false); }
  };

  const handleStatusStepClick = async (step) => {
    if (!maintenance || savingStatusStep) return;
    const nextStatus = step.key;
    const currentStatus = normalizeStatus(maintenance.status);
    if (currentStatus === nextStatus) {
      openSnackbar({ open: true, message: `Maintenance is already ${step.label.toLowerCase()}`, variant: 'alert', alert: { color: 'info' } });
      return;
    }

    setOptimisticStatus(nextStatus);
    setSavingStatusStep(true);
    try {
      await dispatch(updateMaintenance({
        id: maintenance.id,
        title: maintenance.title,
        unitName: maintenance.unitName,
        status: nextStatus,
        priority: maintenance.priority,
        description: maintenance.description,
        categoryId: maintenance.categoryId,
        imageUrl: maintenance.imageUrl || '',
        completedAt: nextStatus === 'resolved' ? new Date().toISOString() : null,
        vendorId: maintenance.vendorId || null,
        scheduledDate: maintenance.scheduledDate || null
      }));
      await refetch();
      openSnackbar({ open: true, message: `Status changed to ${step.label}`, variant: 'alert', alert: { color: 'success' } });
    } catch (e) {
      setOptimisticStatus(null);
      openSnackbar({ open: true, message: e?.message || 'Failed to update status', variant: 'alert', alert: { color: 'error' } });
    } finally {
      setSavingStatusStep(false);
    }
  };

  const handleResolve = async () => {
    setOptimisticStatus('resolved');
    setIsResolving(true);
    try {
      await dispatch(resolveMaintenanceRequest(maintenance.id));
      await refetch();
      openSnackbar({ open: true, message: 'Marked as resolved', variant: 'alert', alert: { color: 'success' } });
    } catch (e) {
      setOptimisticStatus(null);
      openSnackbar({ open: true, message: e?.message || 'Failed', variant: 'alert', alert: { color: 'error' } });
    } finally { setIsResolving(false); }
  };

  const handleScheduleSave = async () => {
    if (!scheduleDateInput) return;
    setOptimisticStatus('scheduled');
    setSavingSchedule(true);
    try {
      const dt = scheduleTimeInput ? `${scheduleDateInput}T${scheduleTimeInput}:00` : `${scheduleDateInput}T09:00:00`;
      await dispatch(updateMaintenance({
        id: maintenance.id, title: maintenance.title, unitName: maintenance.unitName,
        status: 'scheduled', priority: maintenance.priority, description: maintenance.description,
        categoryId: maintenance.categoryId, imageUrl: maintenance.imageUrl || '',
        completedAt: maintenance.completedAt || null, vendorId: maintenance.vendorId || null,
        scheduledDate: dt
      }));
      await refetch();
      setScheduleOpen(false);
      openSnackbar({ open: true, message: 'Visit scheduled', variant: 'alert', alert: { color: 'success' } });
    } catch (e) {
      setOptimisticStatus(null);
      openSnackbar({ open: true, message: e?.message || 'Failed', variant: 'alert', alert: { color: 'error' } });
    } finally { setSavingSchedule(false); }
  };

  const handleImageUpload = async (e) => {
    const files = Array.from(e.target.files);
    if (!files.length) return;
    e.target.value = '';
    setImageUploading(true);
    try {
      await dispatch(addMaintenanceImages(maintenanceId, files));
      await refetch();
    } catch { openSnackbar({ open: true, message: 'Upload failed', variant: 'alert', alert: { color: 'error' } }); }
    finally { setImageUploading(false); }
  };

  const handleSendReply = async () => {
    if (!replyText.trim() || !maintenance?.conversationId || sendingReply) return;
    setSendingReply(true);
    try {
      const res = await addMessage({ conversationId: maintenance.conversationId, content: replyText.trim() });
      if (res?.success && res.data) {
        const m = res.data;
        setConversationMessages(prev => [...prev, {
          id: m.id,
          role: 'user',
          content: m.content,
          senderName: m.senderName,
          createdAt: m.createdAt,
          tag: 'message',
        }]);
      }
      setReplyText('');
    } catch {
      openSnackbar({ open: true, message: 'Failed to send message', variant: 'alert', alert: { color: 'error' } });
    } finally { setSendingReply(false); }
  };

  const handleConfirmDelete = async () => {
    setOpenDeleteConfirm(false);
    try {
      await dispatch(deleteMaintenance(maintenance.id));
      navigate('/landlord/maintenances');
    } catch { openSnackbar({ open: true, message: 'Delete failed', variant: 'alert', alert: { color: 'error' } }); }
  };

  // Build activity feed (timeline + any conversation messages)
  const activityFeed = useMemo(() => {
    if (!maintenance) return [];
    const items = [];
    if (maintenance.createdAt) items.push({ role: 'system', content: `Request reported — ${maintenance.propertyName || ''}${maintenance.unitName ? ` · ${maintenance.unitName}` : ''}`, createdAt: maintenance.createdAt, tag: 'system' });
    if (maintenance.assignedAt) items.push({ role: 'system', content: `${maintenance.vendorName ? `Vendor assigned · ${maintenance.vendorName}` : 'Vendor assigned'}`, createdAt: maintenance.assignedAt, tag: 'system' });
    if (maintenance.scheduledDate) items.push({ role: 'system', content: `Visit scheduled · ${format(new Date(maintenance.scheduledDate), 'EEE, MMM d h:mm a')}`, createdAt: maintenance.scheduledDate, tag: 'system' });
    if (maintenance.completedAt) items.push({ role: 'system', content: 'Marked resolved', createdAt: maintenance.completedAt, tag: 'system' });
    conversationMessages.forEach(m => items.push(m));
    return items.sort((a, b) => new Date(a.createdAt) - new Date(b.createdAt));
  }, [maintenance, conversationMessages]);

  // ─── Loading states ──────────────────────────────────────────────────────────
  if (maintenanceLoading && allRequests.length === 0) return <Box textAlign="center" py={5}><CircularProgress size={24} /></Box>;
  if (!maintenance) return allRequests.length > 0
    ? <Box textAlign="center" py={5}><Typography color="text.secondary">Not found.</Typography></Box>
    : <Box textAlign="center" py={5}><CircularProgress size={24} /></Box>;

  const { title, description, priority, status, propertyName, unitName,
    images = [], createdAt, orderNumber, vendorName, vendorEmail, vendorPhone,
    assignedContactName, assignedContactPhone, assignedContactEmail,
    category, scheduledDate } = maintenance;

  const displayStatus = optimisticStatus ?? status;
  const isResolved = normalizeStatus(displayStatus) === 'resolved';
  const pColor = priorityColor(priority);
  const scheduledDateObj = scheduledDate ? new Date(scheduledDate) : null;
  const totalExpenses = expenses.reduce((s, e) => s + (parseFloat(getExpenseValue(e, 'amount', 'Amount')) || 0), 0);
  const linkedExpenses = [...expenses].sort((a, b) => {
    const aDate = getExpenseValue(a, 'expenseDate', 'ExpenseDate') || getExpenseValue(a, 'createdAt', 'CreatedAt') || 0;
    const bDate = getExpenseValue(b, 'expenseDate', 'ExpenseDate') || getExpenseValue(b, 'createdAt', 'CreatedAt') || 0;
    return new Date(bDate) - new Date(aDate);
  });
  const vendorDisplay = vendorName || assignedContactName || null;
  const vendorPhoneDisplay = vendorPhone || assignedContactPhone || null;

  return (
    <Box sx={{ pb: 4 }}>
      <PageBreadcrumbs items={[
        { label: 'Dashboard', path: '/landlord/dashboard' },
        { label: 'Maintenance', path: '/landlord/maintenances' },
        { label: orderNumber || `MR-${maintenanceId}` }
      ]} />

      {/* ── Header ──────────────────────────────────────────────────────────── */}
      <Box sx={{ mb: 2 }}>
        {/* Chips + action buttons: single row on sm+, two rows on xs */}
        <Stack direction={{ xs: 'column', sm: 'row' }} alignItems={{ xs: 'flex-start', sm: 'center' }} justifyContent="space-between" spacing={{ xs: 0.75, sm: 0 }} sx={{ mb: 1 }}>
          <Stack direction="row" spacing={0.75} flexWrap="wrap" alignItems="center">
            <Chip label={orderNumber || `MR-${maintenanceId}`} size="small" variant="outlined"
              sx={{ height: 22, fontSize: '0.68rem', fontWeight: 600, borderColor: 'rgba(0,0,0,0.2)', color: 'text.secondary', borderRadius: '6px' }} />
            <Chip
              icon={<span style={{ fontSize: 8, marginLeft: 6 }}>▲</span>}
              label={(priority || 'Medium')}
              size="small"
              sx={{ height: 22, fontSize: '0.68rem', fontWeight: 700, bgcolor: pColor.bg, color: pColor.color, border: 'none',
                '& .MuiChip-icon': { color: pColor.color } }} />
            <Chip label={normalizeStatus(displayStatus) === 'inprogress' ? 'In progress' : (displayStatus || 'Open')} size="small" variant="outlined"
              sx={{ height: 22, fontSize: '0.68rem', fontWeight: 600, borderColor: theme.palette.primary.main, color: theme.palette.primary.main,
                '& .MuiChip-icon': { color: theme.palette.primary.main } }}
              icon={<Box component="span" sx={{ width: 6, height: 6, borderRadius: '50%', bgcolor: 'primary.main', ml: '6px !important' }} />} />
            <Chip label={category?.name || 'General'} size="small" variant="outlined"
              sx={{ height: 22, fontSize: '0.68rem', borderColor: 'rgba(0,0,0,0.2)', color: 'text.secondary' }} />
          </Stack>
          {/* Action buttons */}
          <Stack direction="row" spacing={1} flexWrap="wrap" alignItems="center" sx={{ gap: { xs: 0.75, sm: 0 } }}>
            <Button size="small" variant="outlined"
              startIcon={<EditOutlined style={{ fontSize: 13 }} />}
              onClick={() => drawer.openMaintenanceEditDrawer?.()}
              sx={{ textTransform: 'none', fontWeight: 600, borderRadius: 1.5, fontSize: '0.8rem', borderColor: 'rgba(0,0,0,0.18)' }}>
              Edit
            </Button>
            <Button size="small" variant="outlined"
              startIcon={<PaperClipOutlined style={{ fontSize: 13 }} />}
              onClick={() => imageInputRef.current?.click()}
              sx={{ textTransform: 'none', fontWeight: 600, borderRadius: 1.5, fontSize: '0.8rem', borderColor: 'rgba(0,0,0,0.18)' }}>
              Attach
            </Button>
            <Button size="small" variant="contained" color="primary"
              startIcon={<CalendarOutlined style={{ fontSize: 13 }} />}
              onClick={() => setScheduleOpen(true)}
              sx={{ textTransform: 'none', fontWeight: 700, borderRadius: 1.5, fontSize: '0.8rem',
                background: 'linear-gradient(135deg, #061e35, #042238)', boxShadow: '0 2px 8px rgba(6,30,53,0.35)' }}>
              {scheduledDate ? 'Reschedule' : 'Schedule visit'}
            </Button>
            {isResolved ? (
              <Button size="small" variant="outlined"
                startIcon={<ReloadOutlined style={{ fontSize: 13 }} />}
                onClick={async () => { await dispatch(reopenMaintenanceRequest(maintenance.id)); await refetch(); }}
                sx={{ textTransform: 'none', fontWeight: 600, borderRadius: 1.5, fontSize: '0.8rem' }}>
                Reopen
              </Button>
            ) : (
              <Button size="small" variant="contained"
                startIcon={isResolving ? <CircularProgress size={13} color="inherit" /> : null}
                onClick={handleResolve} disabled={isResolving}
                sx={{ textTransform: 'none', fontWeight: 700, borderRadius: 1.5, fontSize: '0.8rem', bgcolor: 'primary.main', color: 'background.paper', '&:hover': { bgcolor: 'primary.main' } }}>
                ✓ Mark Resolved
              </Button>
            )}
          </Stack>
        </Stack>

        {/* Title */}
        <Typography variant="h3" fontWeight={700} sx={{ mb: 0.75, lineHeight: 1.15 }}>{title || 'Maintenance Request'}</Typography>

        {/* Meta */}
        <Stack direction="row" alignItems="center" flexWrap="wrap" sx={{ gap: 0 }}>
          {[
            propertyName && { icon: <HomeOutlined style={{ fontSize: 12 }} />, text: `${propertyName}${unitName ? ` · ${unitName}` : ''}` },
            tenantInfo?.name && { icon: <UserOutlined style={{ fontSize: 12 }} />, text: `Reported by ${tenantInfo.name}` },
            createdAt && { icon: <CalendarOutlined style={{ fontSize: 12 }} />, text: formatDate(createdAt) },
            createdAt && { icon: null, text: `${Math.max(0, Math.floor((Date.now() - new Date(createdAt)) / 86400000))} days open` },
          ].filter(Boolean).map((item, i, arr) => (
            <Stack key={i} direction="row" alignItems="center">
              <Stack direction="row" alignItems="center" spacing={0.5} sx={{ color: 'text.secondary' }}>
                {item.icon}
                <Typography variant="body2" color="text.secondary" sx={{ fontSize: '0.82rem' }}>
                  {item.text}
                </Typography>
              </Stack>
              {i < arr.length - 1 && (
                <Typography sx={{ mx: 1.25, fontSize: '0.75rem', lineHeight: 1, color: 'rgba(0,0,0,0.45)', fontWeight: 700 }}>·</Typography>
              )}
            </Stack>
          ))}
        </Stack>
      </Box>

      {/* ── Status stepper ──────────────────────────────────────────────────── */}
      <StatusStepper
        status={displayStatus}
        createdAt={createdAt}
        scheduledDate={scheduledDate}
        completedAt={maintenance.completedAt}
        onStepClick={handleStatusStepClick}
        disabled={savingStatusStep}
      />

      {/* ── Three-column layout ─────────────────────────────────────────────── */}
      <Grid container spacing={2.5}>

        {/* LEFT column — Problem + AI Triage + Tenant */}
        <Grid size={{ xs: 12, md: 3 }}>
          <Stack spacing={2}>

            {/* The Problem */}
            <MainCard title={<Typography variant="overline" fontWeight={700} sx={{ fontSize: '0.7rem', letterSpacing: 1, color: 'rgba(0,0,0,0.45)' }}>THE PROBLEM</Typography>}
              contentSX={{ pt: 1 }} sx={{ '& .MuiCardHeader-root': { pb: 1 } }}>
              <Typography variant="body2" sx={{ mb: images.length ? 1.5 : 0, lineHeight: 1.65, fontSize: '0.875rem' }}>
                {description || 'No description.'}
              </Typography>
              {images.length > 0 && (
                <Box sx={{ display: 'flex', gap: 0.75, flexWrap: 'wrap' }}>
                  {images.map((img, i) => (
                    <Box key={i} component="img" src={img.blobUrl || img.BlobUrl}
                      sx={{ width: 70, height: 70, borderRadius: 1.5, objectFit: 'cover', border: '1px solid rgba(0,0,0,0.08)' }} />
                  ))}
                  <Box onClick={() => imageInputRef.current?.click()}
                    sx={{ width: 70, height: 70, borderRadius: 1.5, border: '1.5px dashed rgba(0,0,0,0.18)', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', color: 'text.disabled', '&:hover': { borderColor: 'primary.main', color: 'primary.main' } }}>
                    {imageUploading ? <CircularProgress size={16} /> : <PlusOutlined />}
                  </Box>
                </Box>
              )}
              {images.length === 0 && (
                <Box onClick={() => imageInputRef.current?.click()}
                  sx={{ mt: 0.5, p: 1.5, borderRadius: 1.5, border: '1.5px dashed rgba(0,0,0,0.12)', textAlign: 'center', cursor: 'pointer', '&:hover': { borderColor: 'primary.main' } }}>
                  <Typography variant="caption" color="text.disabled">{imageUploading ? 'Uploading...' : '+ Add photos'}</Typography>
                </Box>
              )}
              <input ref={imageInputRef} type="file" multiple accept="image/*" onChange={handleImageUpload} style={{ display: 'none' }} />
            </MainCard>

            {/* Acknowledgement */}
            {(() => {
              const isAcknowledged = ['acknowledged','scheduled','inprogress','resolved'].includes(normalizeStatus(displayStatus));
              return (
                <Box sx={{
                  p: 2, borderRadius: 2.5,
                  border: `1.5px solid ${isAcknowledged ? alpha(theme.palette.success.main, 0.4) : alpha(theme.palette.warning.main, 0.5)}`,
                  bgcolor: isAcknowledged ? alpha(theme.palette.success.main, 0.04) : alpha(theme.palette.warning.main, 0.04)
                }}>
                  <Stack direction="row" alignItems="center" spacing={0.75} sx={{ mb: 1 }}>
                    <CheckCircleOutlined style={{ fontSize: 13, color: isAcknowledged ? theme.palette.success.main : theme.palette.warning.main }} />
                    <Typography sx={{ fontSize: '0.65rem', fontWeight: 700, letterSpacing: 1, textTransform: 'uppercase',
                      color: isAcknowledged ? theme.palette.success.main : theme.palette.warning.main }}>
                      {isAcknowledged ? 'Acknowledged' : 'Needs acknowledgement'}
                    </Typography>
                  </Stack>

                  {isAcknowledged ? (
                    <Typography variant="body2" color="text.secondary" sx={{ fontSize: '0.8rem', lineHeight: 1.55 }}>
                      You've reviewed this request and confirmed it's valid.
                      {aiTriage?.summary ? ` AI assessment: ${aiTriage.summary}` : ''}
                    </Typography>
                  ) : (
                    <>
                      {loadingAI ? (
                        <CircularProgress size={16} sx={{ mb: 1 }} />
                      ) : aiTriage?.summary ? (
                        <Typography variant="body2" color="text.secondary" sx={{ mb: 1.25, fontSize: '0.8rem', lineHeight: 1.55 }}>
                          <strong>AI assessment:</strong> {aiTriage.summary}
                        </Typography>
                      ) : (
                        <Typography variant="body2" color="text.secondary" sx={{ mb: 1.25, fontSize: '0.8rem', lineHeight: 1.55 }}>
                          Review this request and confirm it needs action before scheduling a visit.
                        </Typography>
                      )}
                      <Stack direction="row" spacing={0.75}>
                        <Button size="small" variant="contained"
                          onClick={async () => {
                            const suggestedPriority = aiTriage?.priority || aiTriage?.Priority || maintenance.priority;
                            await dispatch(updateMaintenance({
                              id: maintenance.id, title: maintenance.title, unitName: maintenance.unitName,
                              status: 'acknowledged', priority: suggestedPriority,
                              description: maintenance.description, categoryId: maintenance.categoryId,
                              imageUrl: maintenance.imageUrl || '', completedAt: maintenance.completedAt || null,
                              vendorId: maintenance.vendorId || null, scheduledDate: maintenance.scheduledDate || null
                            }));
                            await refetch();
                            openSnackbar({ open: true, message: 'Request acknowledged', variant: 'alert', alert: { color: 'success' } });
                          }}
                          sx={{ textTransform: 'none', fontWeight: 700, borderRadius: 1.5, fontSize: '0.75rem',
                            bgcolor: 'primary.main', color: 'background.paper', '&:hover': { bgcolor: 'primary.main', opacity: 0.88 } }}>
                          ✓ Acknowledge
                        </Button>
                        {!aiTriage && !loadingAI && (
                          <Button size="small" variant="outlined" onClick={fetchAITriage}
                            sx={{ textTransform: 'none', fontWeight: 600, borderRadius: 1.5, fontSize: '0.75rem', borderColor: 'rgba(0,0,0,0.2)' }}>
                            AI assess
                          </Button>
                        )}
                      </Stack>
                    </>
                  )}
                </Box>
              );
            })()}

            {/* Tenant */}
            {(tenantInfo || unitName) && (
              <MainCard title={<Typography variant="overline" fontWeight={700} sx={{ fontSize: '0.7rem', letterSpacing: 1, color: 'rgba(0,0,0,0.45)' }}>TENANT</Typography>}
                contentSX={{ pt: 1 }} sx={{ '& .MuiCardHeader-root': { pb: 1 } }}>
                {tenantInfo ? (
                  <>
                    <Stack direction="row" alignItems="center" spacing={1.25} sx={{ mb: 1.25 }}>
                      <Avatar sx={{ width: 34, height: 34, bgcolor: theme.palette.success.main, fontSize: '0.75rem', fontWeight: 700 }}>
                        {tenantInfo.name.split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase()}
                      </Avatar>
                      <Box>
                        <Typography variant="subtitle2" fontWeight={700} sx={{ fontSize: '0.875rem' }}>{tenantInfo.name}</Typography>
                        <Typography variant="caption" color="text.secondary" sx={{ fontSize: '0.72rem' }}>
                          {tenantInfo.unitName}{tenantInfo.leaseEnd ? ` · lease through ${format(new Date(tenantInfo.leaseEnd), 'MMM yyyy')}` : ''}
                        </Typography>
                      </Box>
                    </Stack>
                    <Stack direction="row" spacing={0.75}>
                      {tenantInfo.phone && (
                        <Button size="small" variant="outlined" startIcon={<PhoneOutlined style={{ fontSize: 12 }} />}
                          href={`tel:${tenantInfo.phone}`}
                          sx={{ textTransform: 'none', borderRadius: 1.5, fontSize: '0.75rem', fontWeight: 600, borderColor: 'rgba(0,0,0,0.18)', minWidth: 0, px: 1.25 }}>
                          Call
                        </Button>
                      )}
                      <Button size="small" variant="outlined" startIcon={<MessageOutlined style={{ fontSize: 12 }} />}
                        onClick={() => setMessageDrawerOpen(true)}
                        sx={{ textTransform: 'none', borderRadius: 1.5, fontSize: '0.75rem', fontWeight: 600, borderColor: 'rgba(0,0,0,0.18)', px: 1.25 }}>
                        Message
                      </Button>
                    </Stack>
                  </>
                ) : (
                  <Typography variant="body2" color="text.disabled" sx={{ fontSize: '0.82rem', py: 0.5 }}>
                    No tenant — unit is vacant
                  </Typography>
                )}
              </MainCard>
            )}

          </Stack>
        </Grid>

        {/* CENTER column — Conversation & Activity */}
        <Grid size={{ xs: 12, md: 5 }}>
          <Box sx={{ borderRadius: 3, border: '1px solid rgba(0,0,0,0.08)', bgcolor: 'background.paper', display: 'flex', flexDirection: 'column', height: '100%', minHeight: 500 }}>
            {/* Header */}
            <Box sx={{ px: 2, py: 1.5, borderBottom: '1px solid rgba(0,0,0,0.08)' }}>
              <Stack direction="row" alignItems="center" justifyContent="space-between">
                <Typography sx={{ fontSize: '0.65rem', fontWeight: 700, letterSpacing: 1, color: 'rgba(0,0,0,0.45)', textTransform: 'uppercase' }}>
                  CONVERSATION & ACTIVITY
                </Typography>
                {/* Filter pills */}
                <Stack direction="row" spacing={0.5}>
                  {['all', 'tenant', 'vendor', 'system'].map(f => (
                    <Box key={f} onClick={() => setConvFilter(f)}
                      sx={{ px: 1, py: 0.25, cursor: 'pointer', fontSize: '0.7rem', fontWeight: 600,
                        bgcolor: convFilter === f ? 'primary.main' : 'transparent',
                        color: convFilter === f ? 'background.paper' : 'text.secondary',
                        border: `1px solid ${convFilter === f ? 'text.primary' : 'rgba(0,0,0,0.12)'}`,
                        transition: 'all 0.15s' }}>
                      {f.charAt(0).toUpperCase() + f.slice(1)}
                    </Box>
                  ))}
                </Stack>
              </Stack>
            </Box>

            {/* Messages area */}
            <Box sx={{ flex: 1, overflowY: 'auto', p: 2 }}>
              {activityFeed.length === 0 ? (
                <Box sx={{ textAlign: 'center', py: 4 }}>
                  <Typography variant="body2" color="text.disabled">No activity yet</Typography>
                </Box>
              ) : (
                activityFeed.map((msg, i) => <MessageBubble key={i} msg={msg} />)
              )}
              <div ref={convEndRef} />
            </Box>

            {/* Reply input */}
            <Box sx={{ px: 2, py: 1.5, borderTop: '1px solid rgba(0,0,0,0.08)' }}>
              <Stack direction="row" spacing={1} alignItems="flex-end">
                <TextField
                  fullWidth
                  multiline
                  maxRows={3}
                  size="small"
                  placeholder={maintenance?.conversationId ? 'Reply to conversation...' : 'No linked conversation yet'}
                  disabled={!maintenance?.conversationId || sendingReply}
                  value={replyText}
                  onChange={e => setReplyText(e.target.value)}
                  onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSendReply(); } }}
                  sx={{ '& .MuiOutlinedInput-root': { fontSize: '0.85rem' } }}
                />
                <Button variant="contained" size="small"
                  disabled={!replyText.trim() || !maintenance?.conversationId || sendingReply}
                  onClick={handleSendReply}
                  sx={{ borderRadius: 1.5, minWidth: 0, px: 1.75, py: 0.875, bgcolor: 'primary.main', '&:hover': { bgcolor: 'primary.main' }, '&.Mui-disabled': { bgcolor: 'rgba(0,0,0,0.12)' } }}>
                  {sendingReply ? <CircularProgress size={14} color="inherit" /> : <SendOutlined style={{ fontSize: 14, color: '#fff' }} />}
                </Button>
              </Stack>
            </Box>
          </Box>
        </Grid>

        {/* RIGHT column — Scheduled + Vendor + Ledger */}
        <Grid size={{ xs: 12, md: 4 }}>
          <Stack spacing={2}>

            {/* Scheduled Visit */}
            <ScheduledVisitCard
              scheduledDateObj={scheduledDateObj}
              vendorDisplay={vendorDisplay}
              onSchedule={() => setScheduleOpen(true)}
              onCancel={async () => {
                await dispatch(updateMaintenance({ id: maintenance.id, title: maintenance.title, unitName: maintenance.unitName, status: maintenance.status, priority: maintenance.priority, description: maintenance.description, categoryId: maintenance.categoryId, imageUrl: maintenance.imageUrl || '', completedAt: maintenance.completedAt || null, vendorId: maintenance.vendorId || null, scheduledDate: null }));
                await refetch();
              }}
              onOpenCalendar={() => navigate('/landlord/calendar')}
            />

            {/* Vendor */}
            {vendorDisplay && (
              <MainCard title={<Typography variant="overline" fontWeight={700} sx={{ fontSize: '0.7rem', letterSpacing: 1, color: 'rgba(0,0,0,0.45)' }}>VENDOR</Typography>}
                contentSX={{ pt: 1 }} sx={{ '& .MuiCardHeader-root': { pb: 1 } }}>
                <Stack direction="row" alignItems="center" spacing={1.25} sx={{ mb: 1.25 }}>
                  <Avatar sx={{ width: 36, height: 36, bgcolor: theme.palette.primary.main, fontSize: '0.8rem', fontWeight: 700 }}>
                    {vendorDisplay.split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase()}
                  </Avatar>
                  <Box sx={{ flex: 1 }}>
                    <Stack direction="row" alignItems="center" justifyContent="space-between">
                      <Typography variant="subtitle2" fontWeight={700}>{vendorDisplay}</Typography>
                      <Chip label="Accepted" size="small" color="success"
                        sx={{ height: 18, fontSize: '0.6rem', '& .MuiChip-label': { px: 0.5 } }} />
                    </Stack>
                    {vendorPhoneDisplay && (
                      <Typography variant="caption" color="text.secondary" sx={{ fontSize: '0.72rem' }}>{formatPhoneInput(vendorPhoneDisplay)}</Typography>
                    )}
                  </Box>
                </Stack>
                <Stack direction="row" spacing={0.75}>
                  <Button size="small" variant="outlined" startIcon={<MessageOutlined style={{ fontSize: 12 }} />}
                    onClick={() => navigate('/landlord/messages')}
                    sx={{ textTransform: 'none', borderRadius: 1.5, fontSize: '0.75rem', fontWeight: 600, borderColor: 'rgba(0,0,0,0.18)' }}>
                    Message
                  </Button>
                  <Button size="small" variant="outlined" onClick={() => drawer.openVendorAssignDrawer?.()}
                    sx={{ textTransform: 'none', borderRadius: 1.5, fontSize: '0.75rem', fontWeight: 600, borderColor: 'rgba(0,0,0,0.18)' }}>
                    Reassign
                  </Button>
                </Stack>
              </MainCard>
            )}
            {!vendorDisplay && (
              <Box sx={{ p: 2, borderRadius: 2.5, border: '1.5px dashed rgba(0,0,0,0.15)', textAlign: 'center' }}>
                <ToolOutlined style={{ fontSize: 20, color: theme.palette.text.disabled, marginBottom: 6 }} />
                <Typography variant="body2" color="text.secondary" sx={{ mb: 1, fontSize: '0.85rem' }}>No vendor assigned</Typography>
                <Button size="small" variant="outlined" onClick={() => drawer.openVendorAssignDrawer?.()}
                  sx={{ textTransform: 'none', fontWeight: 600, borderRadius: 1.5, fontSize: '0.8rem', borderColor: 'rgba(0,0,0,0.2)' }}>
                  Assign vendor
                </Button>
              </Box>
            )}

            {/* Ledger */}
            <MainCard
              title={<Typography variant="overline" fontWeight={700} sx={{ fontSize: '0.7rem', letterSpacing: 1, color: 'rgba(0,0,0,0.45)' }}>LEDGER</Typography>}
              secondary={
                <Button size="small" variant="text" startIcon={<PlusOutlined style={{ fontSize: 11 }} />}
                  onClick={() => setExpenseModalOpen(true)}
                  sx={{ textTransform: 'none', fontSize: '0.75rem', color: 'primary.main', fontWeight: 600, px: 0.5 }}>
                  Add
                </Button>
              }
              contentSX={{ pt: 1 }} sx={{ '& .MuiCardHeader-root': { pb: 1 } }}>
              <Box sx={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 1.5, mb: 1 }}>
                <Box>
                  <Typography sx={{ fontSize: '0.62rem', fontWeight: 700, letterSpacing: 0.6, color: alpha('#061e35', 0.58), textTransform: 'uppercase', mb: 0.25 }}>SPENT</Typography>
                  <Typography variant="h5" fontWeight={700} sx={{ color: totalExpenses > 0 ? 'text.primary' : 'text.disabled' }}>
                    {formatCurrency(totalExpenses)}
                  </Typography>
                </Box>
              </Box>
              <Typography variant="caption" color="text.disabled" sx={{ fontSize: '0.72rem' }}>
                {loadingExpenses ? 'Loading...' : `${expenses.length} expense${expenses.length !== 1 ? 's' : ''} logged`}
              </Typography>
              <Divider sx={{ my: 1, borderColor: 'rgba(0,0,0,0.06)' }} />
              {loadingExpenses ? (
                <Stack direction="row" alignItems="center" spacing={1} sx={{ py: 1 }}>
                  <CircularProgress size={14} />
                  <Typography variant="caption" color="text.secondary" sx={{ fontSize: '0.72rem' }}>
                    Loading linked expenses...
                  </Typography>
                </Stack>
              ) : linkedExpenses.length > 0 ? (
                <Stack spacing={0.75} sx={{ mb: 1.25 }}>
                  {linkedExpenses.map((expense) => {
                    const expenseId = getExpenseValue(expense, 'id', 'Id');
                    const expenseName = getExpenseValue(expense, 'name', 'Name') || getExpenseValue(expense, 'category', 'Category') || 'Expense';
                    const expenseCategory = getExpenseValue(expense, 'category', 'Category');
                    const expenseDate = getExpenseValue(expense, 'expenseDate', 'ExpenseDate') || getExpenseValue(expense, 'createdAt', 'CreatedAt');
                    const expenseAmount = parseFloat(getExpenseValue(expense, 'amount', 'Amount')) || 0;

                    return (
                      <Box
                        key={expenseId || `${expenseName}-${expenseDate}`}
                        sx={{
                          p: 1,
                          borderRadius: 1.5,
                          border: '1px solid rgba(0,0,0,0.08)',
                          bgcolor: alpha(theme.palette.primary.main, 0.025)
                        }}
                      >
                        <Stack direction="row" alignItems="flex-start" justifyContent="space-between" spacing={1}>
                          <Box sx={{ minWidth: 0 }}>
                            <Typography variant="body2" fontWeight={600} noWrap sx={{ fontSize: '0.82rem' }}>
                              {expenseName}
                            </Typography>
                            <Typography variant="caption" color="text.secondary" sx={{ fontSize: '0.7rem' }}>
                              {[expenseCategory, expenseDate ? formatDate(expenseDate) : null].filter(Boolean).join(' · ')}
                            </Typography>
                          </Box>
                          <Typography variant="body2" fontWeight={700} sx={{ fontSize: '0.82rem', whiteSpace: 'nowrap' }}>
                            {formatCurrency(expenseAmount)}
                          </Typography>
                        </Stack>
                      </Box>
                    );
                  })}
                </Stack>
              ) : (
                <Typography variant="caption" color="text.disabled" sx={{ display: 'block', mb: 1.25, fontSize: '0.72rem' }}>
                  No expenses linked to this maintenance request yet.
                </Typography>
              )}
              <Stack direction="row" alignItems="center" spacing={0.75}>
                <CalendarOutlined style={{ fontSize: 12, color: theme.palette.text.disabled }} />
                <Typography variant="caption" color="text.disabled" sx={{ fontSize: '0.72rem' }}>
                  Time logging — coming soon
                </Typography>
              </Stack>
            </MainCard>

            {/* Delete */}
            <Button size="small" variant="text" color="error" onClick={() => setOpenDeleteConfirm(true)}
              sx={{ textTransform: 'none', fontSize: '0.78rem', fontWeight: 500, alignSelf: 'flex-start' }}>
              Delete request
            </Button>
          </Stack>
        </Grid>
      </Grid>

      {/* ── Schedule Dialog ─────────────────────────────────────────────────── */}
      <Dialog open={scheduleOpen} onClose={() => setScheduleOpen(false)} maxWidth="xs" fullWidth PaperProps={{ sx: { borderRadius: 3 } }}>
        <DialogTitle sx={{ pb: 1 }}>
          <Stack direction="row" alignItems="center" justifyContent="space-between">
            <Typography variant="h6" fontWeight={700}>Schedule visit</Typography>
            <IconButton size="small" onClick={() => setScheduleOpen(false)}><CloseOutlined style={{ fontSize: 14 }} /></IconButton>
          </Stack>
        </DialogTitle>
        <DialogContent>
          <Stack spacing={2} sx={{ pt: 0.5 }}>
            <TextField fullWidth label="Date" type="date" value={scheduleDateInput}
              onChange={e => setScheduleDateInput(e.target.value)}
              slotProps={{ inputLabel: { shrink: true }, htmlInput: { min: new Date().toISOString().split('T')[0] } }} />
            <TextField fullWidth label="Time (optional)" type="time" value={scheduleTimeInput}
              onChange={e => setScheduleTimeInput(e.target.value)}
              slotProps={{ inputLabel: { shrink: true } }} />
          </Stack>
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2.5 }}>
          <Button variant="outlined" onClick={() => setScheduleOpen(false)}
            sx={{ textTransform: 'none', borderRadius: 1.5, borderColor: 'rgba(0,0,0,0.2)' }}>Cancel</Button>
          <Button variant="contained" onClick={handleScheduleSave} disabled={!scheduleDateInput || savingSchedule}
            sx={{ textTransform: 'none', fontWeight: 700, borderRadius: 1.5 }}>
            {savingSchedule ? <CircularProgress size={16} color="inherit" /> : 'Save & add to calendar'}
          </Button>
        </DialogActions>
      </Dialog>

      {/* ── Other modals ────────────────────────────────────────────────────── */}
      <ConfirmationDialog open={openDeleteConfirm} onClose={() => setOpenDeleteConfirm(false)}
        onConfirm={handleConfirmDelete} title="Delete Request"
        message={`Delete "${title}"? This cannot be undone.`} confirmText="Delete" />
      <MaintenanceEditDrawer />
      <VendorAssignDrawer />
      <TenantMessageDrawer
        open={messageDrawerOpen}
        onClose={() => setMessageDrawerOpen(false)}
        tenant={tenantInfo}
        property={tenantProperty}
      />
      <ExpenseAddDrawer
        open={expenseModalOpen}
        onClose={() => setExpenseModalOpen(false)}
        initialSelection={{
          skipPropertyAndMaintenanceSteps: true,
          maintenance,
          maintenanceRequestId: Number(maintenanceId),
          property: tenantProperty,
          propertyId: maintenance.propertyId,
          unit: maintenanceUnit,
          unitId: maintenance.unitId || null
        }}
        onSuccess={async () => {
          const filters = maintenance.propertyId ? { propertyId: maintenance.propertyId } : {};
          const res = await expenseAPI.getExpenses(filters);
          setExpenses(getMaintenanceLinkedExpenses(res, maintenanceId));
        }}
      />
    </Box>
  );
}
