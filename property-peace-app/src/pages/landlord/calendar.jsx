'use client';
import { useEffect, useMemo, useState } from 'react';
import {
  alpha, Box, Button, Chip, Divider, Drawer, FormControl, IconButton,
  MenuItem, Select, Stack, TextField, Tooltip, Typography, useTheme, useMediaQuery
} from '@mui/material';
import {
  CalendarOutlined, CheckOutlined, CloseOutlined, LeftOutlined,
  PlusOutlined, RightOutlined
} from '@ant-design/icons';
import {
  addDays, addMonths, addWeeks, eachDayOfInterval, endOfMonth,
  endOfWeek, format, getHours, getMinutes, isSameDay, isSameMonth,
  isToday, parseISO, startOfMonth, startOfWeek, subMonths, subWeeks,
  differenceInMinutes, startOfDay, endOfDay, addMinutes
} from 'date-fns';
import { useDispatch, useSelector } from 'react-redux';
import { useNavigate } from 'react-router-dom';
import { selectProperties } from 'store/property/property.selector';
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
  { key: 'Inspection',  label: 'Inspections' },
  { key: 'Task',        label: 'Tasks' },
];

const VIEWS = ['Month', 'Week', 'Agenda'];

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

  // Rent due events — one per lease per month in range
  (properties || []).forEach(p => {
    (p.units || []).forEach(u => {
      const unitStatus = (u.status || u.Status || '').toLowerCase();
      if (unitStatus === 'draft') return;
      const lease = u.lease || u.Lease;
      if (!lease) return;
      const leaseStatus = (lease.status || lease.Status || '').toLowerCase();
      if (leaseStatus === 'draft') return;
      if (!lease?.isActive && !lease?.IsActive) return;
      const rentDay  = lease.rentDueDay || lease.RentDueDay || 1;
      const startD   = lease.startDate  || lease.StartDate;
      const endD     = lease.endDate    || lease.EndDate;
      if (!startD) return;
      let cursor = new Date(viewStart.getFullYear(), viewStart.getMonth(), rentDay);
      while (cursor <= viewEnd) {
        if (cursor >= viewStart && cursor >= new Date(startD) && (!endD || cursor <= new Date(endD))) {
          events.push({
            id: `rent-${lease.id || u.id}-${format(cursor, 'yyyy-MM')}`,
            title: `Rent due · ${p.name || p.streetAddress || 'Property'}`,
            date: cursor,
            category: 'RentPayment',
            source: 'auto',
            propertyId: p.id,
          });
        }
        cursor = addMonths(cursor, 1);
        cursor = new Date(cursor.getFullYear(), cursor.getMonth(), rentDay);
      }
    });
  });

  // Lease events
  (properties || []).forEach(p => {
    (p.units || []).forEach(u => {
      const lease = u.lease || u.Lease;
      if (!lease) return;
      const startD = lease.startDate || lease.StartDate;
      const endD   = lease.endDate   || lease.EndDate;
      const tenants = lease.tenants || lease.Tenants || [];
      const tName = tenants[0] ? [tenants[0].firstname || tenants[0].Firstname, tenants[0].lastname || tenants[0].Lastname].filter(Boolean).join(' ') : '';

      if (startD) {
        const d = new Date(startD);
        if (d >= viewStart && d <= viewEnd)
          events.push({ id: `lease-start-${lease.id}`, title: `Lease start · ${p.name || p.streetAddress || 'Unit'}`, date: d, category: 'Lease', source: 'auto', propertyId: p.id });
      }
      if (endD) {
        const d = new Date(endD);
        if (d >= viewStart && d <= viewEnd)
          events.push({ id: `lease-end-${lease.id}`, title: `Move-out · ${u.name || 'Unit'}`, date: d, category: 'Lease', source: 'auto', propertyId: p.id });
        const renewD = addDays(d, -90);
        if (renewD >= viewStart && renewD <= viewEnd)
          events.push({ id: `lease-renew-${lease.id}`, title: `Renewal window · ${tName || u.name || 'Unit'}`, date: renewD, category: 'Lease', source: 'auto', propertyId: p.id });
      }
    });
  });

  // Maintenance events — only show when explicitly scheduled
  const allRequests = dashboardSummary?.maintenanceRequests?.maintenanceRequests || [];
  allRequests.forEach(r => {
    const d = r.scheduledDate || r.ScheduledDate;
    if (!d) return;
    const date = new Date(d);
    if (date >= viewStart && date <= viewEnd)
      events.push({ id: `maint-${r.id}`, title: r.title || r.Title || 'Maintenance', date, category: 'Maintenance', source: 'auto', propertyId: r.propertyId || r.PropertyId || null });
  });

  // Inspection events — scheduled move-in/move-out inspections
  (inspections || []).forEach((inspection) => {
    const raw = inspection.inspectionDate || inspection.InspectionDate;
    if (!raw) return;
    const date = new Date(raw);
    if (Number.isNaN(date.getTime()) || date < viewStart || date > viewEnd) return;

    const typeLabel = getInspectionTypeLabel(inspection);
    const propertyName = inspection.propertyName || inspection.PropertyName || 'Property';
    const unitName = inspection.unitName || inspection.UnitName;
    const location = unitName ? `${propertyName} · ${unitName}` : propertyName;
    const typeParam = typeLabel === 'Move-out' ? 'move-out' : 'move-in';

    events.push({
      id: `inspection-${inspection.id || inspection.Id}`,
      title: `${typeLabel} inspection · ${location}`,
      date,
      category: 'Inspection',
      source: 'inspection',
      propertyId: inspection.propertyId || inspection.PropertyId || null,
      unitId: inspection.unitId || inspection.UnitId || null,
      typeParam,
      inspection
    });
  });

  // Tasks (manual + recurring expansion)
  (tasks || []).forEach(t => {
    const raw = t.dueDate || t.DueDate;
    if (!raw) return;
    const base = { ...t, dueDate: raw };
    const instances = expandRecurring(base, viewStart, viewEnd);
    instances.forEach(inst => {
      const date = typeof inst.dueDate === 'string' ? parseISO(inst.dueDate) : inst.dueDate;
      if (date >= viewStart && date <= viewEnd)
        events.push({ id: `task-${t.id}-${format(date, 'yyyy-MM-dd')}`, title: t.title || t.Title, date, category: 'Task', source: 'task', taskId: t.id, task: t });
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

  useMemo(() => {
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
  const c = CATEGORY_COLORS[event.category] || CATEGORY_COLORS.Task;
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
  const maxVisible = isMobile ? 1 : 3;
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
                  {dayEvents.slice(0, maxVisible).map(ev => <EventPill key={ev.id} event={ev} onClick={onEventClick} />)}
                  {overflow > 0 && (
                    <Box onClick={e => { e.stopPropagation(); onDayClick(day); }}
                      sx={{ px: 0.75, py: 0.15, borderRadius: 1, bgcolor: 'rgba(0,0,0,0.06)', display: 'inline-flex', alignItems: 'center', alignSelf: 'flex-start', cursor: 'pointer', '&:hover': { bgcolor: 'rgba(0,0,0,0.1)' } }}>
                      <Typography sx={{ fontSize: '0.6rem', fontWeight: 700, color: 'text.secondary', lineHeight: 1.4 }}>+{overflow} more</Typography>
                    </Box>
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
    <Box sx={calendarAccentPanelSx(theme.palette.info.main, { borderRadius: 2, overflow: 'hidden', flex: 1, display: 'flex', flexDirection: 'column' })}>
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
                          bgcolor: CATEGORY_COLORS[ev.category]?.bg, border: `1px solid ${CATEGORY_COLORS[ev.category]?.border}`,
                          cursor: 'pointer', zIndex: 1, overflow: 'hidden', '&:hover': { filter: 'brightness(0.92)' }
                        }}>
                        <Typography noWrap sx={{ fontSize: '0.6rem', fontWeight: 600, color: CATEGORY_COLORS[ev.category]?.text, lineHeight: 1.4, minWidth: 0 }}>
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
                const c = CATEGORY_COLORS[ev.category] || CATEGORY_COLORS.Task;
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

function Sidebar({ selectedDay, events, onAddTask, onEventClick, properties, rentDueThisMonth, openMaintenance, leasesEndingSoon, needsApproval }) {
  const theme = useTheme();
  const dayEvents = events.filter(e => isSameDay(e.date, selectedDay));
  const next7 = useMemo(() => {
    const end = addDays(new Date(), 7);
    return events.filter(e => e.date >= new Date() && e.date <= end).slice(0, 5);
  }, [events]);

  return (
    <Box sx={{ width: 280, flexShrink: 0, display: 'flex', flexDirection: 'column', gap: 1.5 }}>

      {/* Selected day */}
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
              const c = CATEGORY_COLORS[ev.category] || CATEGORY_COLORS.Task;
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

      {/* Next 7 days */}
      <Box sx={calendarAccentPanelSx(theme.palette.info.main, { p: 2, borderRadius: 2 })}>
        <Typography sx={{ fontSize: '0.58rem', fontWeight: 700, letterSpacing: 0.8, color: (t) => calendarLabelColor(t), textTransform: 'uppercase', mb: 1.25 }}>
          Next 7 days
        </Typography>
        {next7.length > 0 ? (
          <Stack spacing={0.75}>
            {next7.map(ev => {
              const c = CATEGORY_COLORS[ev.category] || CATEGORY_COLORS.Task;
              return (
                <Tooltip key={ev.id} title={ev.title} arrow placement="top">
                  <Stack direction="row" spacing={1} alignItems="center" onClick={() => onEventClick(ev)} sx={{ cursor: 'pointer', minWidth: 0 }}>
                    <Typography sx={{ fontSize: '0.62rem', fontWeight: 600, color: 'text.disabled', width: 40, flexShrink: 0 }}>{format(ev.date, 'EEE d').toUpperCase()}</Typography>
                    <Box sx={{ width: 6, height: 6, borderRadius: '50%', bgcolor: c.dot, flexShrink: 0 }} />
                    <Typography noWrap sx={{ fontSize: '0.72rem', flex: 1, minWidth: 0 }}>{ev.title}</Typography>
                  </Stack>
                </Tooltip>
              );
            })}
          </Stack>
        ) : (
          <Typography sx={{ fontSize: '0.72rem', color: 'text.secondary' }}>Nothing coming up</Typography>
        )}
      </Box>

      {/* Subscribe placeholder */}
      <Box sx={calendarAccentPanelSx(theme.palette.warning.main, { p: 2, borderRadius: 2 })}>
        <Typography sx={{ fontSize: '0.58rem', fontWeight: 700, letterSpacing: 0.8, color: (t) => calendarLabelColor(t), textTransform: 'uppercase', mb: 1 }}>
          Subscribe
        </Typography>
        <Typography sx={{ fontSize: '0.72rem', color: 'text.secondary', mb: 0.5 }}>Sync to Google · Apple · Outlook</Typography>
        <Typography sx={{ fontSize: '0.72rem', color: 'text.disabled' }}>iCal feed · coming soon</Typography>
      </Box>
    </Box>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function CalendarPage() {
  const theme = useTheme();
  const dispatch = useDispatch();
  const navigate = useNavigate();

  const [current, setCurrent] = useState(new Date());
  const [view, setView] = useState('Month');
  const [selectedDay, setSelectedDay] = useState(new Date());
  const [activeFilters, setActiveFilters] = useState(new Set(['RentPayment', 'Maintenance', 'Lease', 'Inspection', 'Task']));
  const [selectedProperty, setSelectedProperty] = useState('');
  const [addTaskOpen, setAddTaskOpen] = useState(false);
  const [addTaskDate, setAddTaskDate] = useState(new Date());
  const [editTask, setEditTask] = useState(null);
  const [selectedEvent, setSelectedEvent] = useState(null);
  const [inspections, setInspections] = useState([]);

  // Data
  const { properties } = useFetchProperties();
  useFetchAllPayments();
  const { refetch: refetchTasks } = useFetchTasks();
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

  // Filtered
  const filteredEvents = useMemo(() =>
    allEvents
      .filter(e => activeFilters.has(e.category))
      .filter(e => !selectedProperty || String(e.propertyId) === String(selectedProperty)),
    [allEvents, activeFilters, selectedProperty]
  );

  // Stats
  const rentDueThisMonth = useMemo(() => {
    const now = new Date();
    return allEvents.filter(e => e.category === 'RentPayment' && isSameMonth(e.date, now)).length;
  }, [allEvents]);

  const openMaintenance = (dashboardSummary?.maintenanceRequests?.maintenanceRequests || [])
    .filter(r => !['completed','cancelled'].includes((r.status || '').toLowerCase())).length;

  const leasesEndingSoon = useMemo(() => {
    const soon = addDays(new Date(), 90);
    return (properties || []).flatMap(p => p.units || [])
      .filter(u => {
        const lease = u.lease || u.Lease;
        const endD = lease?.endDate || lease?.EndDate;
        return endD && new Date(endD) <= soon && (lease?.isActive || lease?.IsActive);
      }).length;
  }, [properties]);

  // Nav
  const goToday = () => { setCurrent(new Date()); setSelectedDay(new Date()); };
  const goPrev  = () => setCurrent(v => view === 'Month' ? subMonths(v, 1) : subWeeks(v, 1));
  const goNext  = () => setCurrent(v => view === 'Month' ? addMonths(v, 1) : addWeeks(v, 1));

  const toggleFilter = (key) => setActiveFilters(prev => {
    const next = new Set(prev);
    next.has(key) ? next.delete(key) : next.add(key);
    return next;
  });

  const handleDayClick = (day) => setSelectedDay(day);

  const handleEventClick = (event) => {
    setSelectedEvent(event);
    if (event.source === 'inspection') {
      const propertyId = event.propertyId || event.inspection?.propertyId || event.inspection?.PropertyId;
      const unitId = event.unitId || event.inspection?.unitId || event.inspection?.UnitId;
      const typeParam = event.typeParam || 'move-in';
      if (propertyId) {
        navigate(unitId ? `/landlord/inspection/${propertyId}/unit/${unitId}?type=${typeParam}` : `/landlord/inspection/${propertyId}?type=${typeParam}`);
      }
      return;
    }
    if (event.source === 'task' && event.task) {
      setEditTask(event.task);
      setAddTaskOpen(true);
    }
  };

  const handleAddTask = (date) => {
    setEditTask(null);
    setAddTaskDate(date || selectedDay);
    setAddTaskOpen(true);
  };

  const handleSaveTask = async (form) => {
    if (editTask) {
      await dispatch(updateTaskAction(editTask.id, { id: editTask.id, ...form }));
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

      {/* Page header */}
      <Box sx={{ mb: 2 }}>
        {/* On mobile: stacked rows. On desktop: two-column flex row. */}
        <Stack
          direction={{ xs: 'column', sm: 'row' }}
          alignItems={{ xs: 'flex-start', sm: 'flex-start' }}
          justifyContent="space-between"
          spacing={{ xs: 1.5, sm: 0 }}
        >
          {/* Left: label + title + subtext */}
          <Box>
            <Typography sx={{ fontSize: '0.62rem', fontWeight: 700, letterSpacing: 0.8, color: (t) => calendarLabelColor(t), textTransform: 'uppercase', mb: 0.25 }}>
              CALENDAR
            </Typography>
            <Typography variant="h4" fontWeight={700}>{title}</Typography>
            <Typography variant="body2" color="text.secondary">
              Everything happening across your units, in one place.
            </Typography>
          </Box>

          {/* Right: view toggle + nav — own row on mobile */}
          <Stack direction="row" spacing={1} alignItems="center" sx={{ flexShrink: 0 }}>
            <Stack direction="row" sx={{ border: (t) => `1px solid ${subtleBorder(t, 0.2)}`, borderRadius: 1.5, overflow: 'hidden' }}>
              {VIEWS.map(v => (
                <Box key={v} onClick={() => setView(v)}
                  sx={{ px: 1.75, py: 0.6, cursor: 'pointer', fontSize: '0.8rem', fontWeight: 600,
                    bgcolor: view === v ? 'success.main' : 'transparent', color: view === v ? 'success.contrastText' : 'text.secondary',
                    transition: 'all 0.15s', borderRight: v !== 'Agenda' ? (t) => `1px solid ${subtleBorder(t, 0.2)}` : 'none',
                    '&:hover': view === v ? { bgcolor: 'success.dark' } : { bgcolor: alpha(theme.palette.action.hover, 0.5) } }}>
                  {v}
                </Box>
              ))}
            </Stack>
            <Stack direction="row" alignItems="center" spacing={0.5}>
              <IconButton size="small" onClick={goPrev} sx={{ border: (t) => `1px solid ${subtleBorder(t, 0.2)}`, borderRadius: 1 }}><LeftOutlined style={{ fontSize: 11 }} /></IconButton>
              <Button size="small" onClick={goToday} variant="outlined" sx={{ textTransform: 'none', fontWeight: 600, borderRadius: 1.25, px: 1.5, borderColor: (t) => subtleBorder(t, 0.2) }}>Today</Button>
              <IconButton size="small" onClick={goNext} sx={{ border: (t) => `1px solid ${subtleBorder(t, 0.2)}`, borderRadius: 1 }}><RightOutlined style={{ fontSize: 11 }} /></IconButton>
            </Stack>
          </Stack>
        </Stack>
      </Box>

      {/* Filter bar */}
      <Box sx={{ mb: 2 }}>
        {/* Property filter — full width on mobile, auto-width on desktop */}
        <Box sx={{ mb: 1 }}>
          <FormControl size="small" sx={{ width: { xs: '100%', sm: 'auto' }, minWidth: { sm: 160 } }}>
            <Select value={selectedProperty} onChange={e => setSelectedProperty(e.target.value)} displayEmpty
              sx={{ fontSize: '0.78rem', borderRadius: 1.5, height: 32 }}
              renderValue={v => v ? (properties || []).find(p => String(p.id) === String(v))?.name || 'Property' : 'All properties'}>
              <MenuItem value="">All properties</MenuItem>
              {(properties || []).map(p => <MenuItem key={p.id} value={String(p.id)}>{p.name || p.streetAddress}</MenuItem>)}
            </Select>
          </FormControl>
        </Box>

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
            properties={properties}
            rentDueThisMonth={rentDueThisMonth}
            openMaintenance={openMaintenance}
            leasesEndingSoon={leasesEndingSoon}
            needsApproval={0}
          />
        </Box>
      </Stack>

      {/* Bottom stats */}
      <Box sx={calendarAccentPanelSx(theme.palette.success.main, { mt: 2, p: 2, borderRadius: 2 })}>
        <Stack direction="row" divider={<Divider orientation="vertical" flexItem />} spacing={3}>
          {[
            { value: `${rentDueThisMonth}`, label: 'Rent events this month', color: CATEGORY_COLORS.RentPayment.text },
            { value: `${openMaintenance}`,  label: 'Open maintenance',       color: CATEGORY_COLORS.Maintenance.text },
            { value: `${leasesEndingSoon}`, label: 'Leases ending soon',     color: CATEGORY_COLORS.Lease.text },
            { value: `${allEvents.filter(e => e.category === 'Inspection' && isSameMonth(e.date, new Date())).length}`, label: 'Inspections this month', color: CATEGORY_COLORS.Inspection.text },
            { value: `${tasks.length}`,     label: 'Active tasks',           color: CATEGORY_COLORS.Task.text },
          ].map(s => (
            <Box key={s.label}>
              <Typography sx={{ fontSize: '1.6rem', fontWeight: 800, color: s.color, lineHeight: 1.1 }}>{s.value}</Typography>
              <Typography sx={{ fontSize: '0.72rem', color: 'text.secondary' }}>{s.label}</Typography>
            </Box>
          ))}
        </Stack>
      </Box>

      {/* Add / Edit Task Drawer */}
      <AddTaskDrawer
        open={addTaskOpen}
        onClose={() => { setAddTaskOpen(false); setEditTask(null); }}
        onSave={handleSaveTask}
        defaultDate={addTaskDate}
        properties={properties}
        editTask={editTask}
      />
    </Box>
  );
}
