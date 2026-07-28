'use client';
import { useEffect, useMemo, useState } from 'react';
import {
  alpha, Box, Button, Chip, Drawer, FormControl, IconButton,
  MenuItem, Select, Stack, TextField, Tooltip, Typography, useTheme, useMediaQuery
} from '@mui/material';
import {
  CloseOutlined, LeftOutlined,
  PlusOutlined, RightOutlined
} from '@ant-design/icons';
import {
  addDays, addMonths, addWeeks, eachDayOfInterval, endOfMonth,
  endOfWeek, format, getHours, getMinutes, isSameDay, isSameMonth,
  isToday, parseISO, startOfMonth, startOfWeek, subMonths, subWeeks,
  startOfDay, endOfDay
} from 'date-fns';
import { useDispatch, useSelector } from 'react-redux';
import { useNavigate } from 'react-router-dom';
import { selectDashboardSummary } from 'store/dashboard/dashboard.selector';
import { selectAllPayments } from 'store/payment/payment.selector';
import { selectTasks } from 'store/task/task.selector';
import { createTask, updateTaskAction, deleteTaskAction, fetchTasks } from 'store/task/task.action';
import useFetchTasks from 'hooks/useFetchTasks';
import useFetchProperties from 'hooks/useFetchProperties';
import useFetchAllPayments from 'hooks/useFetchAllPayments';
import PageBreadcrumbs from 'components/breadcrumbs/PageBreadcrumbs';
import { checklistAPI } from 'api';

// ─── Constants ────────────────────────────────────────────────────────────────

const CATEGORY_COLORS = {
  RentPayment: { bg: '#dbeafe', text: '#1d4ed8', border: '#93c5fd', dot: '#1877F2' },
  Maintenance:  { bg: '#fee2e2', text: '#b91c1c', border: '#fca5a5', dot: '#ef4444' },
  Lease:        { bg: '#ede9fe', text: '#6d28d9', border: '#c4b5fd', dot: '#8b5cf6' },
  Inspection:   { bg: '#ffedd5', text: '#c2410c', border: '#fdba74', dot: '#f97316' },
  Task:         { bg: '#dcfce7', text: '#15803d', border: '#86efac', dot: '#22c55e' },
};

const FILTERS = [
  { key: 'RentPayment', label: 'Rent & payments' },
  { key: 'Maintenance', label: 'Maintenance' },
  { key: 'Lease',       label: 'Leases & move dates' },
  { key: 'Inspection',  label: 'Checklists' },
  { key: 'Task',        label: 'Tasks' },
];

const VIEWS = ['Month', 'Week', 'Agenda'];
const TASK_CATEGORIES = ['RentPayment', 'Maintenance', 'Lease', 'Task'];
const STATUS_FILTERS = ['All statuses', 'Upcoming', 'Overdue', 'Paid', 'Completed', 'Scheduled'];

function getEventColors(event) {
  if (event?.category === 'RentPayment' && event.status === 'Paid') return CATEGORY_COLORS.Task;
  if (event?.category === 'RentPayment' && event.status === 'Overdue') return CATEGORY_COLORS.Maintenance;
  return CATEGORY_COLORS[event?.category] || CATEGORY_COLORS.Task;
}

const subtleBorder = (theme, opacity = 0.14) => theme.palette.mode === 'dark' ? alpha('#cbd5e1', opacity) : 'rgba(0,0,0,0.09)';
const calendarLabelColor = (theme) => theme.palette.mode === 'dark' ? theme.palette.text.primary : alpha('#061e35', 0.58);
const calendarAccentPanelSx = (accentColor, extra = {}) => ({
  ...extra,
  position: 'relative',
  bgcolor: 'background.paper',
  border: (t) => `1px solid ${t.palette.mode === 'dark' ? alpha(accentColor, 0.36) : subtleBorder(t)}`,
  boxShadow: (t) => t.palette.mode === 'dark'
    ? `0 18px 46px ${alpha(t.palette.common.black, 0.24)}, 0 0 0 1px ${alpha(accentColor, 0.18)}, 0 0 28px ${alpha(accentColor, 0.14)}`
    : 'none',
  '&::before': {
    content: '""',
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: 2,
    background: `linear-gradient(90deg, ${alpha(accentColor, 0.9)} 0%, ${alpha(accentColor, 0.35)} 44%, transparent 100%)`,
    pointerEvents: 'none',
    zIndex: 2
  },
  '&:hover': {
    borderColor: (t) => t.palette.mode === 'dark' ? alpha(accentColor, 0.44) : subtleBorder(t, 0.18),
    boxShadow: (t) => t.palette.mode === 'dark'
      ? `0 20px 52px ${alpha(t.palette.common.black, 0.28)}, 0 0 0 1px ${alpha(accentColor, 0.26)}, 0 0 34px ${alpha(accentColor, 0.18)}`
      : 'none'
  }
});

const RECURRENCE_TYPES = [
  { value: 0, label: 'Does not repeat' },
  { value: 2, label: 'Weekly' },
  { value: 3, label: 'Monthly' },
  { value: 4, label: 'Yearly' },
];

const MOVE_IN_CHECKLIST = 'moveInChecklist';
const MOVE_OUT_CHECKLIST = 'moveOutChecklist';

function normalizeChecklistType(type) {
  return String(type ?? '').toLowerCase();
}

function getInspectionTypeLabel(inspection) {
  const type = normalizeChecklistType(inspection?.checklistType);
  const typeName = normalizeChecklistType(inspection?.checklistTypeName);
  if (type === MOVE_OUT_CHECKLIST.toLowerCase() || type === '41' || typeName.includes('moveout') || typeName.includes('move-out')) return 'Move-out';
  return 'Move-in';
}

const valueOf = (object, camel, pascal) => object?.[camel] ?? object?.[pascal];

function isLeaseDraft(lease) {
  return String(lease?.status || lease?.Status || '').toLowerCase() === 'draft' ||
    lease?.isDrafted === true ||
    lease?.IsDrafted === true ||
    lease?.leaseAgreement?.isDrafted === true ||
    lease?.leaseAgreement?.IsDrafted === true;
}

function isStartedActiveLease(lease, now = new Date()) {
  const active = lease?.isActive === true || lease?.IsActive === true || lease?.isActive === 1 || lease?.IsActive === 1;
  if (!lease || lease.hasLease === false || !active || isLeaseDraft(lease)) return false;
  const start = valueOf(lease, 'startDate', 'StartDate');
  const end = valueOf(lease, 'endDate', 'EndDate');
  const startDate = start ? new Date(start) : null;
  const endDate = end ? new Date(end) : null;
  if (!startDate || Number.isNaN(startDate.getTime()) || startDate > now) return false;
  return !endDate || (!Number.isNaN(endDate.getTime()) && endOfDay(endDate) >= now);
}

function paymentForCycle(payments, leaseId, cycleDate) {
  return (payments || []).find(payment => {
    const paymentLeaseId = valueOf(payment, 'leaseId', 'LeaseId');
    const status = String(valueOf(payment, 'status', 'Status') || '').toLowerCase();
    const cycleAt = valueOf(payment, 'dueDate', 'DueDate') ||
      valueOf(payment, 'rentDueDate', 'RentDueDate') ||
      valueOf(payment, 'paymentDate', 'PaymentDate');
    const isRent = !valueOf(payment, 'depositId', 'DepositId') && !valueOf(payment, 'feeId', 'FeeId');
    const isFailed = ['failed', 'canceled', 'cancelled', 'disputed', 'refunded'].includes(status);
    return isRent && !isFailed && String(paymentLeaseId) === String(leaseId) && cycleAt && isSameMonth(new Date(cycleAt), cycleDate);
  });
}

// ─── Event generation ─────────────────────────────────────────────────────────

function expandRecurring(task, viewStart, viewEnd) {
  if (!task.isRecurring || task.recurrenceType === 0) return [task];
  const instances = [];
  let cursor = parseISO(task.dueDate || task.DueDate);
  const end = task.recurrenceEndDate ? parseISO(task.recurrenceEndDate) : viewEnd;
  let safety = 0;
  while (cursor <= end && safety < 500) {
    safety++;
    if (cursor >= viewStart) instances.push({ ...task, dueDate: cursor.toISOString(), _instanceOf: task.id });
    switch (task.recurrenceType) {
      case 1: cursor = addDays(cursor, task.recurrenceInterval || 1); break;
      case 2: cursor = addWeeks(cursor, task.recurrenceInterval || 1); break;
      case 3: cursor = addMonths(cursor, task.recurrenceInterval || 1); break;
      case 4: cursor = addMonths(cursor, 12 * (task.recurrenceInterval || 1)); break;
      default: cursor = new Date(9999, 0); break;
    }
  }
  return instances;
}

function buildEvents(properties, allPayments, dashboardSummary, tasks, inspections, viewStart, viewEnd) {
  const events = [];
  const today = startOfDay(new Date());

  // Rent due events — only leases that are active, started, non-draft and not expired.
  (properties || []).forEach(p => {
    (p.units || []).forEach(u => {
      if (String(u.status || u.Status || '').toLowerCase() === 'draft') return;
      const lease = u.lease || u.Lease;
      if (!isStartedActiveLease(lease)) return;
      const leaseId = lease.id || lease.Id;
      const rentDay = lease.rentDueDay || lease.RentDueDay || 1;
      const startD = lease.startDate || lease.StartDate;
      const endD = lease.endDate || lease.EndDate;
      let cursor = new Date(viewStart.getFullYear(), viewStart.getMonth(), rentDay);
      while (cursor <= viewEnd) {
        if (cursor >= viewStart && cursor >= new Date(startD) && (!endD || cursor <= new Date(endD))) {
          const payment = paymentForCycle(allPayments, leaseId, cursor);
          events.push({
            id: `rent-${leaseId || u.id}-${format(cursor, 'yyyy-MM')}`,
            title: `Rent due · ${p.name || p.streetAddress || 'Property'}`,
            date: cursor,
            category: 'RentPayment',
            source: 'auto',
            propertyId: p.id,
            unitId: u.id || u.Id,
            leaseId,
            paymentId: valueOf(payment, 'id', 'Id') || null,
            payment,
            status: payment ? 'Paid' : cursor < today ? 'Overdue' : 'Upcoming',
            amount: valueOf(lease, 'rentAmount', 'RentAmount') ?? valueOf(lease, 'monthlyRent', 'MonthlyRent') ?? null,
            propertyName: p.name || p.streetAddress || 'Property',
            unitName: u.name || u.Name || 'Unit'
          });
        }
        cursor = addMonths(cursor, 1);
        cursor = new Date(cursor.getFullYear(), cursor.getMonth(), rentDay);
      }
    });
  });

  (properties || []).forEach(p => {
    (p.units || []).forEach(u => {
      const lease = u.lease || u.Lease;
      if (!lease || isLeaseDraft(lease)) return;
      const leaseId = lease.id || lease.Id;
      const startD = lease.startDate || lease.StartDate;
      const endD = lease.endDate || lease.EndDate;
      const tenants = lease.tenants || lease.Tenants || [];
      const tName = tenants[0] ? [tenants[0].firstname || tenants[0].Firstname, tenants[0].lastname || tenants[0].Lastname].filter(Boolean).join(' ') : '';
      const metadata = { category: 'Lease', source: 'auto', propertyId: p.id, unitId: u.id || u.Id, leaseId };
      if (startD) {
        const date = new Date(startD);
        if (date >= viewStart && date <= viewEnd) events.push({ ...metadata, id: `lease-start-${leaseId}`, title: `Move-in · ${p.name || p.streetAddress || 'Unit'}`, date, status: date < today ? 'Completed' : 'Upcoming', milestone: 'Move-in' });
      }
      if (endD) {
        const date = new Date(endD);
        if (date >= viewStart && date <= viewEnd) events.push({ ...metadata, id: `lease-end-${leaseId}`, title: `Move-out · ${u.name || 'Unit'}`, date, status: date < today ? 'Completed' : 'Upcoming', milestone: 'Move-out' });
        const renewDate = addDays(date, -90);
        if (renewDate >= viewStart && renewDate <= viewEnd) events.push({ ...metadata, id: `lease-renew-${leaseId}`, title: `Renewal window · ${tName || u.name || 'Unit'}`, date: renewDate, status: renewDate < today ? 'Completed' : 'Upcoming', milestone: 'Renewal' });
      }
    });
  });

  const allRequests = dashboardSummary?.maintenanceRequests?.maintenanceRequests || [];
  allRequests.forEach(request => {
    const raw = request.scheduledDate || request.ScheduledDate;
    if (!raw) return;
    const date = new Date(raw);
    if (date >= viewStart && date <= viewEnd) events.push({
      id: `maint-${request.id || request.Id}`,
      title: request.title || request.Title || 'Maintenance',
      date,
      category: 'Maintenance',
      source: 'auto',
      propertyId: request.propertyId || request.PropertyId || null,
      unitId: request.unitId || request.UnitId || null,
      maintenanceId: request.id || request.Id,
      status: ['completed', 'cancelled'].includes(String(request.status || request.Status || '').toLowerCase()) ? 'Completed' : 'Scheduled',
      request
    });
  });

  (inspections || []).forEach(inspection => {
    const raw = inspection.inspectionDate || inspection.InspectionDate;
    if (!raw) return;
    const date = new Date(raw);
    if (Number.isNaN(date.getTime()) || date < viewStart || date > viewEnd) return;
    const typeLabel = getInspectionTypeLabel(inspection);
    const propertyName = inspection.propertyName || inspection.PropertyName || 'Property';
    const unitName = inspection.unitName || inspection.UnitName;
    events.push({
      id: `inspection-${inspection.id || inspection.Id}`,
      title: `${typeLabel} checklist · ${unitName ? `${propertyName} · ${unitName}` : propertyName}`,
      date,
      category: 'Inspection',
      source: 'inspection',
      propertyId: inspection.propertyId || inspection.PropertyId || null,
      unitId: inspection.unitId || inspection.UnitId || null,
      status: date < today ? 'Completed' : 'Upcoming',
      typeParam: typeLabel === 'Move-out' ? 'move-out' : 'move-in',
      inspection
    });
  });

  (tasks || []).forEach(task => {
    const raw = task.dueDate || task.DueDate;
    if (!raw) return;
    expandRecurring({ ...task, dueDate: raw }, viewStart, viewEnd).forEach(instance => {
      const date = typeof instance.dueDate === 'string' ? parseISO(instance.dueDate) : instance.dueDate;
      if (date < viewStart || date > viewEnd) return;
      const category = TASK_CATEGORIES[Number(task.category ?? task.Category ?? 3)] || 'Task';
      const completed = Boolean(task.isCompleted ?? task.IsCompleted ?? task.completed ?? task.Completed);
      events.push({
        id: `task-${task.id || task.Id}-${format(date, 'yyyy-MM-dd')}`,
        title: task.title || task.Title,
        date,
        category,
        source: 'task',
        taskId: task.id || task.Id,
        task,
        propertyId: task.propertyId || task.PropertyId || null,
        unitId: task.unitId || task.UnitId || null,
        status: completed ? 'Completed' : date < today ? 'Overdue' : 'Upcoming'
      });
    });
  });

  return events.sort((a, b) => a.date - b.date);
}

// ─── Add Task Drawer ──────────────────────────────────────────────────────────

function AddTaskDrawer({ open, onClose, onSave, defaultDate, properties, editTask }) {
  const theme = useTheme();
  const isDarkMode = theme.palette.mode === 'dark';
  const taskDrawerBorder = isDarkMode ? alpha(theme.palette.primary.main, 0.18) : 'rgba(0,0,0,0.09)';
  const taskDrawerSurface = isDarkMode ? theme.palette.background.default : '#fff';
  const taskDrawerHeaderSurface = isDarkMode ? alpha(theme.palette.background.paper, 0.88) : '#fff';
  const taskDrawerFooterSurface = isDarkMode ? alpha(theme.palette.background.paper, 0.94) : theme.palette.background.paper;
  const [form, setForm] = useState({
    title: '', dueDate: format(defaultDate || new Date(), "yyyy-MM-dd'T'HH:mm"),
    category: 3, propertyId: '', unitId: '', isRecurring: false, recurrenceType: 0, recurrenceInterval: 1, recurrenceEndDate: ''
  });

  useEffect(() => {
    if (editTask) {
      setForm({
        title: editTask.title || editTask.Title || '',
        dueDate: format(parseISO(editTask.dueDate || editTask.DueDate), "yyyy-MM-dd'T'HH:mm"),
        category: editTask.category ?? editTask.Category ?? 3,
        propertyId: editTask.propertyId || editTask.PropertyId || '',
        unitId: editTask.unitId || editTask.UnitId || '',
        isRecurring: editTask.isRecurring || false,
        recurrenceType: editTask.recurrenceType ?? 0,
        recurrenceInterval: editTask.recurrenceInterval || 1,
        recurrenceEndDate: editTask.recurrenceEndDate ? format(parseISO(editTask.recurrenceEndDate), 'yyyy-MM-dd') : ''
      });
    } else {
      setForm(f => ({ ...f, dueDate: format(defaultDate || new Date(), "yyyy-MM-dd'T'HH:mm") }));
    }
  }, [editTask, defaultDate]);

  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));

  const handleSave = () => {
    onSave({
      ...form,
      dueDate: new Date(form.dueDate).toISOString(),
      category: Number(form.category),
      propertyId: form.propertyId ? Number(form.propertyId) : null,
      unitId: form.unitId ? Number(form.unitId) : null,
      recurrenceType: Number(form.recurrenceType),
      recurrenceInterval: Number(form.recurrenceInterval),
      recurrenceEndDate: form.recurrenceEndDate ? new Date(form.recurrenceEndDate).toISOString() : null,
    });
    onClose();
  };

  return (
    <Drawer
      anchor="right"
      open={open}
      onClose={onClose}
      PaperProps={{
        sx: {
          width: { xs: '100%', sm: 420 },
          bgcolor: taskDrawerSurface,
          backgroundImage: isDarkMode ? `linear-gradient(180deg, ${alpha(theme.palette.primary.main, 0.08)} 0%, transparent 180px)` : 'none',
          color: 'text.primary',
          borderLeft: `1px solid ${taskDrawerBorder}`,
          boxShadow: isDarkMode ? `-18px 0 44px ${alpha('#020617', 0.45)}` : undefined
        }
      }}
    >
      <Stack sx={{ height: '100%' }}>
        {/* Header */}
        <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ px: 3, py: 2, borderBottom: `1px solid ${taskDrawerBorder}`, bgcolor: taskDrawerHeaderSurface }}>
          <Typography variant="h6" fontWeight={700}>{editTask ? 'Edit task' : 'New task'}</Typography>
          <IconButton size="small" onClick={onClose}><CloseOutlined /></IconButton>
        </Stack>

        {/* Fields */}
        <Stack spacing={2.5} sx={{ flex: 1, overflowY: 'auto', px: 3, py: 3 }}>
          <Stack spacing={0.75}>
            <Typography variant="caption" fontWeight={600} color="text.secondary">Title</Typography>
            <TextField value={form.title} onChange={e => set('title', e.target.value)} fullWidth autoFocus size="small" placeholder="e.g. Schedule plumber visit" />
          </Stack>
          <Stack spacing={0.75}>
            <Typography variant="caption" fontWeight={600} color="text.secondary">Due date & time</Typography>
            <TextField type="datetime-local" value={form.dueDate} onChange={e => set('dueDate', e.target.value)} fullWidth size="small" InputLabelProps={{ shrink: true }} />
          </Stack>
          <Stack spacing={0.75}>
            <Typography variant="caption" fontWeight={600} color="text.secondary">Category</Typography>
            <FormControl fullWidth size="small">
              <Select value={form.category} onChange={e => set('category', e.target.value)}>
                <MenuItem value={3}>Task</MenuItem>
                <MenuItem value={0}>Rent & Payment</MenuItem>
                <MenuItem value={1}>Maintenance</MenuItem>
                <MenuItem value={2}>Lease</MenuItem>
              </Select>
            </FormControl>
          </Stack>
          <Stack spacing={0.75}>
            <Typography variant="caption" fontWeight={600} color="text.secondary">Property (optional)</Typography>
            <FormControl fullWidth size="small">
              <Select value={form.propertyId} onChange={e => { set('propertyId', e.target.value); set('unitId', ''); }} displayEmpty renderValue={v => v ? (properties || []).find(p => String(p.id) === String(v))?.name || 'Property' : 'None'}>
                <MenuItem value="">None</MenuItem>
                {(properties || []).map(p => <MenuItem key={p.id} value={p.id}>{p.name || p.streetAddress}</MenuItem>)}
              </Select>
            </FormControl>
          </Stack>
          {(() => {
            const selProp = form.propertyId ? (properties || []).find(p => String(p.id) === String(form.propertyId)) : null;
            const units = selProp?.units || [];
            if (units.length < 2) return null;
            return (
              <Stack spacing={0.75}>
                <Typography variant="caption" fontWeight={600} color="text.secondary">Unit (optional)</Typography>
                <FormControl fullWidth size="small">
                  <Select value={form.unitId} onChange={e => set('unitId', e.target.value)} displayEmpty renderValue={v => v ? units.find(u => String(u.id) === String(v))?.name || 'Unit' : 'None'}>
                    <MenuItem value="">None</MenuItem>
                    {units.map(u => <MenuItem key={u.id} value={u.id}>{u.name}</MenuItem>)}
                  </Select>
                </FormControl>
              </Stack>
            );
          })()}
          <Stack spacing={0.75}>
            <Typography variant="caption" fontWeight={600} color="text.secondary">Repeat</Typography>
            <FormControl fullWidth size="small">
              <Select value={form.recurrenceType} onChange={e => { set('recurrenceType', e.target.value); set('isRecurring', Number(e.target.value) !== 0); }}>
                {RECURRENCE_TYPES.map(r => <MenuItem key={r.value} value={r.value}>{r.label}</MenuItem>)}
              </Select>
            </FormControl>
          </Stack>
          {form.isRecurring && (
            <Stack direction="row" spacing={1.5}>
              <Stack spacing={0.75} sx={{ width: 110 }}>
                <Typography variant="caption" fontWeight={600} color="text.secondary">Every</Typography>
                <TextField type="number" value={form.recurrenceInterval} onChange={e => set('recurrenceInterval', e.target.value)} size="small" inputProps={{ min: 1 }} placeholder="1" />
              </Stack>
              <Stack spacing={0.75} sx={{ flex: 1 }}>
                <Typography variant="caption" fontWeight={600} color="text.secondary">End date (optional)</Typography>
                <TextField type="date" value={form.recurrenceEndDate} onChange={e => set('recurrenceEndDate', e.target.value)} size="small" InputLabelProps={{ shrink: true }} />
              </Stack>
            </Stack>
          )}
        </Stack>

        {/* Footer */}
        <Stack direction="row" justifyContent="flex-end" spacing={1.5} sx={{ px: 3, py: 2, borderTop: `1px solid ${taskDrawerBorder}`, bgcolor: taskDrawerFooterSurface, boxShadow: isDarkMode ? `0 -12px 28px ${alpha('#020617', 0.22)}` : 'none' }}>
          <Button onClick={onClose} sx={{ textTransform: 'none' }}>Cancel</Button>
          <Button variant="contained" onClick={handleSave} disabled={!form.title.trim()} sx={{ textTransform: 'none', borderRadius: 1.5 }}>
            {editTask ? 'Save changes' : 'Add task'}
          </Button>
        </Stack>
      </Stack>
    </Drawer>
  );
}

// ─── Event pill ───────────────────────────────────────────────────────────────

function EventPill({ event, onClick }) {
  const c = getEventColors(event);
  return (
    <Tooltip title={event.title} arrow placement="top">
      <Box onClick={e => { e.stopPropagation(); onClick(event); }}
        sx={{
          width: '100%',
          maxWidth: '100%',
          minWidth: 0,
          px: 0.75,
          py: 0.1,
          borderRadius: 0.75,
          bgcolor: c.bg,
          border: `1px solid ${c.border}`,
          cursor: 'pointer',
          '&:hover': { filter: 'brightness(0.94)' },
          overflow: 'hidden'
        }}>
        <Typography noWrap sx={{ fontSize: '0.65rem', fontWeight: 600, color: c.text, lineHeight: 1.5, minWidth: 0 }}>
          {event.title}
        </Typography>
      </Box>
    </Tooltip>
  );
}

// ─── Month view ───────────────────────────────────────────────────────────────

const DAY_LABELS_FULL  = ['SUN','MON','TUE','WED','THU','FRI','SAT'];
const DAY_LABELS_SHORT = ['S','M','T','W','T','F','S'];

function MonthView({ current, events, onDayClick, selectedDay, onEventClick }) {
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('sm'));
  const monthStart = startOfMonth(current);
  const monthEnd   = endOfMonth(current);
  const gridStart  = startOfWeek(monthStart);
  const gridEnd    = endOfWeek(monthEnd);
  const days = eachDayOfInterval({ start: gridStart, end: gridEnd });
  const weeks = [];
  for (let i = 0; i < days.length; i += 7) weeks.push(days.slice(i, i + 7));

  const eventsForDay = (day) => events.filter(e => isSameDay(e.date, day));
  const maxVisible = 3;
  const dayLabels = isMobile ? DAY_LABELS_SHORT : DAY_LABELS_FULL;

  return (
    <Box sx={calendarAccentPanelSx(theme.palette.primary.main, { borderRadius: 2, overflow: 'hidden', flex: 1 })}>
      {/* Day headers */}
      <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(7,minmax(0,1fr))', bgcolor: alpha(theme.palette.primary.main, 0.04) }}>
        {dayLabels.map((d, i) => (
          <Box key={i} sx={{ minWidth: 0, py: 0.75, textAlign: 'center', borderRight: (t) => `1px solid ${subtleBorder(t, 0.14)}`, '&:last-child': { borderRight: 'none' } }}>
            <Typography sx={{ fontSize: { xs: '0.6rem', sm: '0.65rem' }, fontWeight: 700, letterSpacing: { xs: 0, sm: 0.5 }, color: 'text.secondary' }}>{d}</Typography>
          </Box>
        ))}
      </Box>
      {/* Weeks */}
      {weeks.map((week, wi) => (
        <Box key={wi} sx={{ display: 'grid', gridTemplateColumns: 'repeat(7,minmax(0,1fr))', borderTop: (t) => `1px solid ${subtleBorder(t, 0.14)}` }}>
          {week.map((day, di) => {
            const dayEvents = eventsForDay(day);
            const isSelected = isSameDay(day, selectedDay);
            const isCurrentMonth = isSameMonth(day, current);
            const todayDay = isToday(day);
            const overflow = dayEvents.length - maxVisible;
            return (
              <Box key={di} onClick={() => onDayClick(day)}
                sx={{
                  minWidth: 0,
                  height: { xs: 72, sm: 120 },
                  p: { xs: 0.25, sm: 0.5 },
                  overflow: 'hidden',
                  display: 'flex', flexDirection: 'column',
                  borderRight: (t) => `1px solid ${subtleBorder(t, 0.14)}`, '&:last-child': { borderRight: 'none' },
                  cursor: 'pointer', bgcolor: isSelected ? alpha(theme.palette.primary.main, 0.05) : 'background.paper',
                  '&:hover': { bgcolor: alpha(theme.palette.primary.main, 0.04) }
                }}>
                {/* Day number */}
                <Box sx={{ display: 'flex', justifyContent: 'flex-end', mb: 0.25, flexShrink: 0 }}>
                  <Box sx={{
                    width: { xs: 18, sm: 22 }, height: { xs: 18, sm: 22 },
                    borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center',
                    bgcolor: todayDay ? theme.palette.primary.main : 'transparent',
                  }}>
                    <Typography sx={{ fontSize: { xs: '0.65rem', sm: '0.72rem' }, fontWeight: todayDay ? 700 : 400, color: todayDay ? '#fff' : isCurrentMonth ? 'text.primary' : 'text.disabled' }}>
                      {format(day, 'd')}
                    </Typography>
                  </Box>
                </Box>
                {/* Events */}
                <Stack spacing={0.25} sx={{ minWidth: 0, flex: 1, overflow: 'hidden' }}>
                  {isMobile ? (
                    <Stack direction="row" spacing={0.35} justifyContent="center" alignItems="center" sx={{ mt: 0.5 }}>
                      {dayEvents.slice(0, 4).map(ev => <Box key={ev.id} sx={{ width: 5, height: 5, borderRadius: '50%', bgcolor: getEventColors(ev).dot }} />)}
                      {dayEvents.length > 4 && <Typography sx={{ fontSize: '0.55rem', fontWeight: 700, color: 'text.secondary' }}>+{dayEvents.length - 4}</Typography>}
                    </Stack>
                  ) : (
                    <>
                      {dayEvents.slice(0, maxVisible).map(ev => <EventPill key={ev.id} event={ev} onClick={onEventClick} />)}
                      {overflow > 0 && (
                        <Box onClick={e => { e.stopPropagation(); onDayClick(day); }}
                          sx={{ px: 0.75, py: 0.15, borderRadius: 1, bgcolor: 'rgba(0,0,0,0.06)', display: 'inline-flex', alignItems: 'center', alignSelf: 'flex-start', cursor: 'pointer', '&:hover': { bgcolor: 'rgba(0,0,0,0.1)' } }}>
                          <Typography sx={{ fontSize: '0.6rem', fontWeight: 700, color: 'text.secondary', lineHeight: 1.4 }}>+{overflow} more</Typography>
                        </Box>
                      )}
                    </>
                  )}
                </Stack>
              </Box>
            );
          })}
        </Box>
      ))}
    </Box>
  );
}

// ─── Week view ────────────────────────────────────────────────────────────────

const HOUR_H = 48;

function WeekView({ current, events, onDayClick, selectedDay, onEventClick }) {
  const theme = useTheme();
  const weekStart = startOfWeek(current);
  const days = Array.from({ length: 7 }, (_, i) => addDays(weekStart, i));
  const hours = Array.from({ length: 24 }, (_, i) => i);

  const eventsForDay = (day) => events.filter(e => isSameDay(e.date, day));

  return (
    <Box sx={{ overflowX: 'auto', WebkitOverflowScrolling: 'touch' }}>
      <Box sx={calendarAccentPanelSx(theme.palette.info.main, { borderRadius: 2, overflow: 'hidden', flex: 1, display: 'flex', flexDirection: 'column', minWidth: { xs: 760, md: 0 } })}>
      {/* Header */}
      <Box sx={{ display: 'grid', gridTemplateColumns: '48px repeat(7,minmax(0,1fr))', bgcolor: alpha(theme.palette.primary.main, 0.04), borderBottom: (t) => `1px solid ${subtleBorder(t, 0.14)}` }}>
        <Box />
        {days.map((day, i) => {
          const todayDay = isToday(day);
          return (
            <Box key={i} onClick={() => onDayClick(day)} sx={{ py: 1, textAlign: 'center', cursor: 'pointer', borderLeft: (t) => `1px solid ${subtleBorder(t, 0.14)}` }}>
              <Typography sx={{ fontSize: '0.62rem', fontWeight: 600, letterSpacing: 0.5, color: 'text.secondary' }}>{format(day, 'EEE').toUpperCase()}</Typography>
              <Box sx={{ width: 26, height: 26, borderRadius: '50%', mx: 'auto', display: 'flex', alignItems: 'center', justifyContent: 'center', bgcolor: todayDay ? theme.palette.primary.main : 'transparent' }}>
                <Typography sx={{ fontSize: '0.8rem', fontWeight: 700, color: todayDay ? '#fff' : 'text.primary' }}>{format(day, 'd')}</Typography>
              </Box>
            </Box>
          );
        })}
      </Box>
      {/* Time grid */}
      <Box sx={{ flex: 1, overflowY: 'auto', position: 'relative' }}>
        {hours.map(hour => (
          <Box key={hour} sx={{ display: 'grid', gridTemplateColumns: '48px repeat(7,minmax(0,1fr))', height: HOUR_H, borderBottom: (t) => `1px solid ${subtleBorder(t, 0.1)}` }}>
            <Box sx={{ pr: 0.75, display: 'flex', alignItems: 'flex-start', justifyContent: 'flex-end', pt: 0.25 }}>
              <Typography sx={{ fontSize: '0.58rem', color: 'text.disabled' }}>{hour === 0 ? '' : format(new Date(2000, 0, 1, hour), 'h a')}</Typography>
            </Box>
            {days.map((day, di) => {
              const dayEvs = eventsForDay(day).filter(e => getHours(e.date) === hour);
              return (
                <Box key={di} onClick={() => onDayClick(day)} sx={{ minWidth: 0, borderLeft: (t) => `1px solid ${subtleBorder(t, 0.1)}`, position: 'relative', cursor: 'pointer', '&:hover': { bgcolor: alpha(theme.palette.primary.main, 0.02) } }}>
                  {dayEvs.map(ev => (
                    <Tooltip key={ev.id} title={`${format(ev.date, 'h:mm a')} ${ev.title}`} arrow placement="top">
                      <Box onClick={e => { e.stopPropagation(); onEventClick(ev); }}
                        sx={{
                          position: 'absolute', left: 1, right: 1, top: `${(getMinutes(ev.date) / 60) * HOUR_H}px`,
                          minWidth: 0, maxWidth: 'calc(100% - 2px)', minHeight: 20, px: 0.5, py: 0.1, borderRadius: 0.75,
                          bgcolor: getEventColors(ev).bg, border: `1px solid ${getEventColors(ev).border}`,
                          cursor: 'pointer', zIndex: 1, overflow: 'hidden', '&:hover': { filter: 'brightness(0.92)' }
                        }}>
                        <Typography noWrap sx={{ fontSize: '0.6rem', fontWeight: 600, color: getEventColors(ev).text, lineHeight: 1.4, minWidth: 0 }}>
                          {format(ev.date, 'h:mm a')} {ev.title}
                        </Typography>
                      </Box>
                    </Tooltip>
                  ))}
                </Box>
              );
            })}
          </Box>
        ))}
      </Box>
      </Box>
    </Box>
  );
}

// ─── Agenda view ─────────────────────────────────────────────────────────────

function AgendaView({ events, onEventClick, selectedDay }) {
  const theme = useTheme();
  const grouped = useMemo(() => {
    const map = new Map();
    events.forEach(e => {
      const key = format(e.date, 'yyyy-MM-dd');
      if (!map.has(key)) map.set(key, []);
      map.get(key).push(e);
    });
    return [...map.entries()].sort(([a], [b]) => a.localeCompare(b));
  }, [events]);

  if (grouped.length === 0)
    return <Box sx={{ p: 4, textAlign: 'center' }}><Typography color="text.secondary">No events in this period</Typography></Box>;

  return (
    <Box sx={calendarAccentPanelSx(theme.palette.success.main, { borderRadius: 2, overflow: 'hidden', flex: 1, overflowY: 'auto' })}>
      {grouped.map(([dateKey, dayEvents]) => {
        const date = parseISO(dateKey);
        const todayDay = isToday(date);
        return (
          <Box key={dateKey} sx={{ display: 'flex', borderBottom: (t) => `1px solid ${subtleBorder(t, 0.14)}` }}>
            {/* Date label */}
            <Box sx={{ width: 80, flexShrink: 0, p: 1.5, textAlign: 'center', bgcolor: todayDay ? alpha(theme.palette.primary.main, 0.06) : 'transparent' }}>
              <Typography sx={{ fontSize: '0.58rem', fontWeight: 700, color: 'text.disabled', textTransform: 'uppercase' }}>{format(date, 'EEE')}</Typography>
              <Typography sx={{ fontSize: '1.4rem', fontWeight: 700, lineHeight: 1.2, color: todayDay ? 'primary.main' : 'text.primary' }}>{format(date, 'd')}</Typography>
              <Typography sx={{ fontSize: '0.62rem', color: 'text.secondary' }}>{format(date, 'MMM')}</Typography>
            </Box>
            {/* Events */}
            <Stack sx={{ flex: 1, p: 1, gap: 0.5 }}>
              {dayEvents.map(ev => {
                const c = getEventColors(ev);
                return (
                  <Tooltip key={ev.id} title={ev.title} arrow placement="top">
                    <Stack direction="row" alignItems="center" spacing={1.5}
                      onClick={() => onEventClick(ev)}
                      sx={{ minWidth: 0, p: 1, borderRadius: 1.25, border: `1px solid ${c.border}`, bgcolor: c.bg, cursor: 'pointer', '&:hover': { filter: 'brightness(0.95)' } }}>
                      <Box sx={{ width: 8, height: 8, borderRadius: '50%', bgcolor: c.dot, flexShrink: 0 }} />
                      <Box sx={{ flex: 1, minWidth: 0 }}>
                        <Typography noWrap sx={{ fontSize: '0.82rem', fontWeight: 600, color: c.text }}>{ev.title}</Typography>
                        <Typography sx={{ fontSize: '0.66rem', color: 'text.secondary' }}>{format(ev.date, 'h:mm a')}</Typography>
                      </Box>
                    </Stack>
                  </Tooltip>
                );
              })}
            </Stack>
          </Box>
        );
      })}
    </Box>
  );
}

// ─── Right Sidebar ────────────────────────────────────────────────────────────

function Sidebar({ selectedDay, events, onAddTask, onEventClick }) {
  const theme = useTheme();
  const dayEvents = events.filter(e => isSameDay(e.date, selectedDay));

  return (
    <Box sx={{ width: 280, flexShrink: 0 }}>
      <Box sx={calendarAccentPanelSx(theme.palette.primary.main, { p: 2, borderRadius: 2 })}>
        <Typography sx={{ fontSize: '0.58rem', fontWeight: 700, letterSpacing: 0.8, color: (t) => calendarLabelColor(t), textTransform: 'uppercase', mb: 0.5 }}>
          {isToday(selectedDay) ? 'Selected · Today' : 'Selected'}
        </Typography>
        <Typography variant="h5" fontWeight={700} sx={{ mb: 0.25 }}>{format(selectedDay, 'EEE, MMM d')}</Typography>
        <Typography sx={{ fontSize: '0.72rem', color: 'text.secondary', mb: 1.5 }}>
          {dayEvents.length} event{dayEvents.length !== 1 ? 's' : ''}
        </Typography>

        {dayEvents.length > 0 ? (
          <Stack spacing={1} sx={{ mb: 1.5 }}>
            {dayEvents.map(ev => {
              const c = getEventColors(ev);
              return (
                <Tooltip key={ev.id} title={ev.title} arrow placement="top">
                  <Box onClick={() => onEventClick(ev)} sx={{ p: 1, borderRadius: 1.25, bgcolor: c.bg, border: `1px solid ${c.border}`, cursor: 'pointer', minWidth: 0, '&:hover': { filter: 'brightness(0.95)' } }}>
                    <Stack direction="row" spacing={0.75} alignItems="center" sx={{ mb: 0.25, minWidth: 0 }}>
                      <Box sx={{ width: 6, height: 6, borderRadius: '50%', bgcolor: c.dot, flexShrink: 0 }} />
                      <Typography noWrap sx={{ fontSize: '0.78rem', fontWeight: 600, color: c.text, flex: 1, minWidth: 0 }}>{ev.title}</Typography>
                    </Stack>
                    <Typography sx={{ fontSize: '0.62rem', color: 'text.secondary', pl: 1.25 }}>{format(ev.date, 'h:mm a')}</Typography>
                  </Box>
                </Tooltip>
              );
            })}
          </Stack>
        ) : (
          <Typography sx={{ fontSize: '0.72rem', color: 'text.secondary', mb: 1.5 }}>No events</Typography>
        )}

        <Button variant="contained" fullWidth startIcon={<PlusOutlined style={{ fontSize: 11 }} />} onClick={() => onAddTask(selectedDay)}
          sx={{ textTransform: 'none', fontWeight: 700, borderRadius: 1.5, fontSize: '0.8rem', bgcolor: 'primary.main', color: 'primary.contrastText', '&:hover': { bgcolor: 'primary.main', opacity: 0.88 } }}>
          Add task
        </Button>
      </Box>
    </Box>
  );
}

function EventDetailsDrawer({ event, onClose, onEditTask, onDeleteTask, onNavigate }) {
  const c = getEventColors(event);
  const checklistPropertyId = event?.propertyId || event?.inspection?.propertyId || event?.inspection?.PropertyId;
  const checklistUnitId = event?.unitId || event?.inspection?.unitId || event?.inspection?.UnitId;
  const checklistId = event?.inspection?.id || event?.inspection?.Id;
  const checklistBase = checklistUnitId
    ? `/landlord/checklists/property/${checklistPropertyId}/unit/${checklistUnitId}`
    : `/landlord/checklists/property/${checklistPropertyId}`;
  const categoryLabel = event?.category === 'RentPayment'
    ? 'Rent & payment'
    : event?.category === 'Inspection' ? 'Checklist' : event?.category;
  const destination = event?.category === 'RentPayment'
    ? (event.leaseId ? `/landlord/leases/${event.leaseId}/payment-history` : '/landlord/payments')
    : event?.category === 'Maintenance' && event.maintenanceId ? `/landlord/maintenance/${event.maintenanceId}`
    : event?.category === 'Lease' && event.leaseId ? `/landlord/leases/${event.leaseId}`
    : event?.source === 'inspection' && checklistPropertyId
      ? (checklistId ? `${checklistBase}/checklist/${checklistId}` : `${checklistBase}?type=${event.typeParam || 'move-in'}`)
    : null;
  return (
    <Drawer
      anchor="right"
      open={Boolean(event)}
      onClose={onClose}
      PaperProps={{
        sx: {
          width: { xs: '100%', sm: 400 },
          bgcolor: '#fff',
          color: '#061e35',
          borderLeft: `1px solid ${c.border}`,
          boxShadow: '-18px 0 48px rgba(6, 30, 53, 0.24)'
        }
      }}
    >
      {event && <Stack sx={{ minHeight: '100%' }}>
        <Stack
          direction="row"
          justifyContent="space-between"
          alignItems="center"
          sx={{ px: 3, py: 2, bgcolor: '#f8fafc', borderBottom: '1px solid #e2e8f0' }}
        >
          <Typography variant="overline" fontWeight={800} sx={{ color: c.text, letterSpacing: 1 }}>
            {categoryLabel}
          </Typography>
          <IconButton
            onClick={onClose}
            aria-label="Close event details"
            sx={{ color: '#334155', bgcolor: '#fff', border: '1px solid #e2e8f0', '&:hover': { bgcolor: '#f1f5f9' } }}
          >
            <CloseOutlined />
          </IconButton>
        </Stack>

        <Stack spacing={2.5} sx={{ flex: 1, px: 3, py: 3 }}>
          <Box>
            <Typography variant="h5" fontWeight={750} sx={{ color: '#061e35', lineHeight: 1.3 }}>
              {event.title}
            </Typography>
            <Typography sx={{ mt: 0.75, color: '#475569', fontWeight: 500 }}>
              {format(event.date, 'EEEE, MMMM d, yyyy · h:mm a')}
            </Typography>
          </Box>

          <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap>
            <Chip
              size="small"
              label={event.status || 'Scheduled'}
              sx={{ bgcolor: c.bg, color: c.text, border: `1px solid ${c.border}`, fontWeight: 700 }}
            />
            {event.unitName && <Chip size="small" label={event.unitName} sx={{ bgcolor: '#f8fafc', color: '#334155', border: '1px solid #cbd5e1' }} />}
          </Stack>

          {event.amount != null && (
            <Box sx={{ p: 2, borderRadius: 1.5, bgcolor: '#f8fafc', border: '1px solid #e2e8f0' }}>
              <Typography sx={{ color: '#475569', fontSize: '0.75rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: 0.6 }}>
                Rent amount
              </Typography>
              <Typography variant="h5" fontWeight={800} sx={{ mt: 0.25, color: '#061e35' }}>
                ${Number(event.amount).toLocaleString()}
              </Typography>
            </Box>
          )}

          {event.source === 'task' ? <Stack direction="row" spacing={1}>
            <Button variant="contained" onClick={() => onEditTask(event.task)} sx={{ fontWeight: 700 }}>Edit task</Button>
            <Button color="error" variant="outlined" onClick={() => onDeleteTask(event.taskId)} sx={{ fontWeight: 700 }}>Delete</Button>
          </Stack> : destination ? <Button
            variant="contained"
            onClick={() => onNavigate(destination)}
            sx={{ alignSelf: 'flex-start', px: 2.5, bgcolor: '#061e35', color: '#fff', fontWeight: 800, '&:hover': { bgcolor: '#0b2f4f' } }}
          >
            {event.category === 'RentPayment' ? 'View payments' : event.category === 'Maintenance' ? 'View request' : event.source === 'inspection' ? 'Open checklist' : 'View lease'}
          </Button> : null}
        </Stack>
      </Stack>}
    </Drawer>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function CalendarPage() {
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('sm'));
  const dispatch = useDispatch();
  const navigate = useNavigate();

  const [current, setCurrent] = useState(new Date());
  const [view, setView] = useState(isMobile ? 'Agenda' : 'Month');
  const [selectedDay, setSelectedDay] = useState(new Date());
  const [activeFilters, setActiveFilters] = useState(new Set(['RentPayment', 'Maintenance', 'Lease', 'Inspection', 'Task']));
  const [selectedProperty, setSelectedProperty] = useState('');
  const [selectedStatus, setSelectedStatus] = useState('All statuses');
  const [dayAgendaOpen, setDayAgendaOpen] = useState(false);
  const [addTaskOpen, setAddTaskOpen] = useState(false);
  const [addTaskDate, setAddTaskDate] = useState(new Date());
  const [editTask, setEditTask] = useState(null);
  const [selectedEvent, setSelectedEvent] = useState(null);
  const [inspections, setInspections] = useState([]);

  // Data
  const { properties } = useFetchProperties();
  useFetchAllPayments();
  useFetchTasks();
  const allPayments      = useSelector(selectAllPayments);
  const dashboardSummary = useSelector(selectDashboardSummary);
  const tasks            = useSelector(selectTasks);

  useEffect(() => {
    let cancelled = false;

    const loadInspections = async () => {
      if (!properties || properties.length === 0) {
        setInspections([]);
        return;
      }

      const results = await Promise.all(
        properties.map(async (property) => {
          try {
            const res = await checklistAPI.getChecklistsByProperty(property.id);
            return res?.success ? res.data || [] : [];
          } catch {
            return [];
          }
        })
      );

      if (!cancelled) {
        const byId = new Map();
        results.flat().forEach((inspection) => {
          const id = inspection.id || inspection.Id;
          if (id) byId.set(id, inspection);
        });
        setInspections(Array.from(byId.values()));
      }
    };

    loadInspections();
    return () => { cancelled = true; };
  }, [properties]);

  // View range
  const { viewStart, viewEnd } = useMemo(() => {
    if (view === 'Month') {
      return { viewStart: startOfMonth(addMonths(current, -1)), viewEnd: endOfMonth(addMonths(current, 1)) };
    }
    if (view === 'Week') {
      return { viewStart: startOfWeek(current), viewEnd: endOfWeek(current) };
    }
    return { viewStart: startOfDay(current), viewEnd: endOfDay(addDays(current, 60)) };
  }, [current, view]);

  // All events
  const allEvents = useMemo(() =>
    buildEvents(properties, allPayments, dashboardSummary, tasks, inspections, viewStart, viewEnd),
    [properties, allPayments, dashboardSummary, tasks, inspections, viewStart, viewEnd]
  );

  const summaryEvents = useMemo(() => {
    const now = new Date();
    return buildEvents(properties, allPayments, dashboardSummary, tasks, inspections, startOfDay(addDays(now, -365)), endOfDay(addDays(now, 90)));
  }, [properties, allPayments, dashboardSummary, tasks, inspections]);

  // Filtered
  const filteredEvents = useMemo(() =>
    allEvents
      .filter(e => activeFilters.has(e.category))
      .filter(e => !selectedProperty || String(e.propertyId) === String(selectedProperty))
      .filter(e => selectedStatus === 'All statuses' || e.status === selectedStatus),
    [allEvents, activeFilters, selectedProperty, selectedStatus]
  );

  const summaryCards = useMemo(() => {
    const now = new Date();
    const inSevenDays = endOfDay(addDays(now, 7));
    const scoped = summaryEvents.filter(event => !selectedProperty || String(event.propertyId) === String(selectedProperty));
    return [
      { label: 'Due next 7 days', value: scoped.filter(event => event.date >= now && event.date <= inSevenDays && !['Paid', 'Completed'].includes(event.status)).length, color: CATEGORY_COLORS.Task.dot },
      { label: 'Overdue', value: scoped.filter(event => event.status === 'Overdue').length, color: CATEGORY_COLORS.Maintenance.dot },
      { label: 'Lease milestones', value: scoped.filter(event => event.category === 'Lease' && event.date >= now).length, color: CATEGORY_COLORS.Lease.dot },
      { label: 'Scheduled maintenance', value: scoped.filter(event => event.category === 'Maintenance' && event.status === 'Scheduled' && event.date >= now).length, color: CATEGORY_COLORS.Maintenance.text }
    ];
  }, [summaryEvents, selectedProperty]);

  // Nav
  const goToday = () => { setCurrent(new Date()); setSelectedDay(new Date()); };
  const goPrev  = () => setCurrent(v => view === 'Month' ? subMonths(v, 1) : subWeeks(v, 1));
  const goNext  = () => setCurrent(v => view === 'Month' ? addMonths(v, 1) : addWeeks(v, 1));

  const toggleFilter = (key) => setActiveFilters(prev => {
    const next = new Set(prev);
    next.has(key) ? next.delete(key) : next.add(key);
    return next;
  });

  const handleDayClick = (day) => {
    setSelectedDay(day);
    if (isMobile) setDayAgendaOpen(true);
  };

  const handleEventClick = (event) => {
    setSelectedEvent(event);
  };

  const handleAddTask = (date) => {
    setEditTask(null);
    setAddTaskDate(date || selectedDay);
    setAddTaskOpen(true);
  };

  const handleSaveTask = async (form) => {
    if (editTask) {
      const taskId = editTask.id || editTask.Id;
      await dispatch(updateTaskAction(taskId, { id: taskId, ...form }));
    } else {
      await dispatch(createTask(form));
    }
    dispatch(fetchTasks());
  };

  const handleDeleteTask = async (taskId) => {
    await dispatch(deleteTaskAction(taskId));
    setSelectedEvent(null);
  };

  const title = view === 'Month'
    ? format(current, 'MMMM yyyy')
    : view === 'Week'
    ? `${format(startOfWeek(current), 'MMM d')} – ${format(endOfWeek(current), 'MMM d, yyyy')}`
    : 'Agenda';

  return (
    <Box>
      <PageBreadcrumbs items={[{ label: 'Dashboard', path: '/landlord/dashboard' }, { label: 'Calendar' }]} />

      <Box sx={{ mb: 2, p: { xs: 2, sm: 3 }, borderRadius: 2.5, bgcolor: '#061e35', color: '#fff', backgroundImage: 'linear-gradient(120deg, #061e35 45%, #0b3653)' }}>
        <Stack direction="row" justifyContent="space-between" alignItems="center" spacing={2}>
          <Box>
            <Typography variant="h3" fontWeight={700} sx={{ color: '#fff' }}>Calendar</Typography>
            <Typography variant="body2" sx={{ color: alpha('#fff', 0.72), mt: 0.5 }}>{title} · Keep rent, work, leases, and checklists moving.</Typography>
          </Box>
          <Button variant="contained" color="success" startIcon={<PlusOutlined />} onClick={() => handleAddTask(selectedDay)} sx={{ flexShrink: 0, textTransform: 'none', fontWeight: 800, borderRadius: 1.5 }}>
            Add task
          </Button>
        </Stack>
      </Box>

      {/* Filter bar */}
      <Box sx={{ mb: 2, p: 1.5, border: (t) => `1px solid ${subtleBorder(t)}`, borderRadius: 2, bgcolor: 'background.paper' }}>
        <Stack direction={{ xs: 'column', md: 'row' }} spacing={1} justifyContent="space-between" sx={{ mb: 1.25 }}>
          <Stack direction="row" spacing={1} sx={{ overflowX: 'auto' }}>
          <FormControl size="small" sx={{ width: { xs: '100%', sm: 'auto' }, minWidth: { sm: 160 } }}>
            <Select value={selectedProperty} onChange={e => setSelectedProperty(e.target.value)} displayEmpty
              sx={{ fontSize: '0.78rem', borderRadius: 1.5, height: 32 }}
              renderValue={v => v ? (properties || []).find(p => String(p.id) === String(v))?.name || 'Property' : 'All properties'}>
              <MenuItem value="">All properties</MenuItem>
              {(properties || []).map(p => <MenuItem key={p.id} value={String(p.id)}>{p.name || p.streetAddress}</MenuItem>)}
            </Select>
          </FormControl>
          <FormControl size="small" sx={{ minWidth: 145 }}><Select value={selectedStatus} onChange={e => setSelectedStatus(e.target.value)} sx={{ fontSize: '0.78rem', borderRadius: 1.5, height: 32 }}>
            {STATUS_FILTERS.map(status => <MenuItem key={status} value={status}>{status}</MenuItem>)}
          </Select></FormControl>
          </Stack>
          <Stack direction="row" spacing={1} alignItems="center">
            <Stack direction="row" sx={{ border: (t) => `1px solid ${subtleBorder(t, 0.2)}`, borderRadius: 1.5, overflow: 'hidden' }}>
              {VIEWS.map(v => <Box key={v} onClick={() => setView(v)} sx={{ px: { xs: 1.2, sm: 1.75 }, py: 0.6, cursor: 'pointer', fontSize: '0.78rem', fontWeight: 700, bgcolor: view === v ? 'success.main' : 'transparent', color: view === v ? 'success.contrastText' : 'text.secondary' }}>{v}</Box>)}
            </Stack>
            <IconButton size="small" onClick={goPrev}><LeftOutlined /></IconButton>
            <Button size="small" onClick={goToday} variant="outlined" sx={{ textTransform: 'none' }}>Today</Button>
            <IconButton size="small" onClick={goNext}><RightOutlined /></IconButton>
          </Stack>
        </Stack>

        {/* Pills row — horizontally scrollable on mobile */}
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, overflowX: 'auto', pb: 0.5,
          scrollbarWidth: 'none', '&::-webkit-scrollbar': { display: 'none' } }}>
          <Typography sx={{ fontSize: '0.68rem', fontWeight: 600, color: 'text.secondary', flexShrink: 0 }}>SHOW:</Typography>
          {FILTERS.map(f => {
            const c = CATEGORY_COLORS[f.key];
            const active = activeFilters.has(f.key);
            return (
              <Box key={f.key} onClick={() => toggleFilter(f.key)}
                sx={{
                  display: 'inline-flex', alignItems: 'center', gap: 0.6, px: 1.5, py: 0.4,
                  cursor: 'pointer', userSelect: 'none', flexShrink: 0,
                  border: `1.5px solid ${active ? c.border : 'rgba(0,0,0,0.18)'}`,
                  bgcolor: active ? c.bg : 'transparent', transition: 'all 0.15s'
                }}>
                <Box sx={{ width: 6, height: 6, borderRadius: '50%', bgcolor: active ? c.dot : 'text.disabled' }} />
                <Typography sx={{ fontSize: '0.72rem', fontWeight: 600, color: active ? c.text : 'text.secondary' }}>{f.label}</Typography>
              </Box>
            );
          })}
        </Box>
      </Box>

      <Box sx={{ display: 'grid', gridTemplateColumns: { xs: 'repeat(2, 1fr)', md: 'repeat(4, 1fr)' }, gap: 1.25, mb: 2 }}>
        {summaryCards.map(card => <Box key={card.label} sx={{ p: 1.5, borderRadius: 2, bgcolor: 'background.paper', border: (t) => `1px solid ${subtleBorder(t)}`, borderTop: `3px solid ${card.color}` }}>
          <Typography sx={{ fontSize: '1.45rem', fontWeight: 800, lineHeight: 1.1 }}>{card.value}</Typography>
          <Typography sx={{ fontSize: '0.72rem', color: 'text.secondary', mt: 0.4 }}>{card.label}</Typography>
        </Box>)}
      </Box>

      {/* Main layout */}
      <Stack direction="row" spacing={2} sx={{ minHeight: 600 }}>
        {/* Calendar — full width on mobile */}
        <Box sx={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column' }}>
          {view === 'Month' && <MonthView current={current} events={filteredEvents} onDayClick={handleDayClick} selectedDay={selectedDay} onEventClick={handleEventClick} />}
          {view === 'Week'  && <WeekView  current={current} events={filteredEvents} onDayClick={handleDayClick} selectedDay={selectedDay} onEventClick={handleEventClick} />}
          {view === 'Agenda' && <AgendaView events={filteredEvents} onEventClick={handleEventClick} selectedDay={selectedDay} />}
        </Box>

        {/* Sidebar — hidden on mobile */}
        <Box sx={{ display: { xs: 'none', md: 'block' } }}>
          <Sidebar
            selectedDay={selectedDay}
            events={filteredEvents}
            onAddTask={handleAddTask}
            onEventClick={handleEventClick}
          />
        </Box>
      </Stack>

      {/* Add / Edit Task Drawer */}
      <AddTaskDrawer
        open={addTaskOpen}
        onClose={() => { setAddTaskOpen(false); setEditTask(null); }}
        onSave={handleSaveTask}
        defaultDate={addTaskDate}
        properties={properties}
        editTask={editTask}
      />
      <EventDetailsDrawer
        event={selectedEvent}
        onClose={() => setSelectedEvent(null)}
        onEditTask={(task) => { setSelectedEvent(null); setEditTask(task); setAddTaskOpen(true); }}
        onDeleteTask={handleDeleteTask}
        onNavigate={(path) => { setSelectedEvent(null); navigate(path); }}
      />
      <Drawer anchor="bottom" open={dayAgendaOpen && isMobile} onClose={() => setDayAgendaOpen(false)} PaperProps={{ sx: { maxHeight: '72vh', borderRadius: '18px 18px 0 0', p: 2 } }}>
        <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 1.5 }}>
          <Box><Typography variant="h6" fontWeight={750}>{format(selectedDay, 'EEEE, MMM d')}</Typography><Typography variant="caption" color="text.secondary">Day agenda</Typography></Box>
          <IconButton onClick={() => setDayAgendaOpen(false)}><CloseOutlined /></IconButton>
        </Stack>
        <Stack spacing={1} sx={{ overflowY: 'auto' }}>
          {filteredEvents.filter(event => isSameDay(event.date, selectedDay)).map(event => <EventPill key={event.id} event={event} onClick={(item) => { setDayAgendaOpen(false); handleEventClick(item); }} />)}
          {!filteredEvents.some(event => isSameDay(event.date, selectedDay)) && <Typography color="text.secondary">No events scheduled.</Typography>}
        </Stack>
        <Button variant="contained" color="success" startIcon={<PlusOutlined />} onClick={() => { setDayAgendaOpen(false); handleAddTask(selectedDay); }} sx={{ mt: 2, textTransform: 'none', fontWeight: 700 }}>Add task</Button>
      </Drawer>
    </Box>
  );
}
