import { useMemo, useState } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { alpha } from '@mui/material/styles';
import {
  Box,
  Button,
  Checkbox,
  Chip,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  FormControl,
  IconButton,
  InputAdornment,
  MenuItem,
  Select,
  Skeleton,
  Stack,
  TextField,
  Tooltip,
  Typography,
  useTheme
} from '@mui/material';
import {
  CalendarOutlined,
  CheckCircleOutlined,
  ClockCircleOutlined,
  DeleteOutlined,
  EditOutlined,
  PlusOutlined,
  ReloadOutlined,
  SearchOutlined,
  SyncOutlined
} from '@ant-design/icons';
import { format, isBefore, isSameDay, startOfDay } from 'date-fns';
import useAuth from 'hooks/useAuth';
import useFetchProperties from 'hooks/useFetchProperties';
import useFetchTasks from 'hooks/useFetchTasks';
import { selectTasks } from 'store/task/task.selector';
import { createTask, deleteTaskAction, updateTaskAction } from 'store/task/task.action';
import DashboardHeader from 'sections/landlord/dashboard/DashboardHeader';
import TaskEditorDrawer from 'sections/landlord/tasks/TaskEditorDrawer';
import { buildTaskUpdatePayload, filterAndSortTasks, summarizeTasks, taskCategoryKey, taskStatusKey } from 'utils/taskWorkspace';

const valueOf = (item, camel, pascal) => item?.[camel] ?? item?.[pascal];

const CATEGORY_META = {
  task: { label: 'Task', color: '#41a541' },
  rent: { label: 'Rent & payment', color: '#2563eb' },
  maintenance: { label: 'Maintenance', color: '#e07a24' },
  lease: { label: 'Lease', color: '#7c5ce7' }
};

const RECURRENCE_LABELS = {
  1: 'Daily',
  2: 'Weekly',
  3: 'Monthly',
  4: 'Yearly'
};

const initialFilters = { search: '', status: 'all', propertyId: '', date: 'all', frequency: 'all' };

function SummaryCard({ icon, title, value, secondary, accent }) {
  const theme = useTheme();
  return (
    <Box
      sx={{
        position: 'relative',
        overflow: 'hidden',
        minHeight: 112,
        p: 2.25,
        borderRadius: 2.5,
        border: `1px solid ${alpha(theme.palette.divider, theme.palette.mode === 'dark' ? 0.85 : 0.62)}`,
        bgcolor: 'background.paper',
        boxShadow: theme.palette.mode === 'dark' ? `0 16px 40px ${alpha('#000', 0.18)}` : `0 10px 26px ${alpha('#061e35', 0.05)}`,
        '&::before': { content: '""', position: 'absolute', inset: '0 auto 0 0', width: 3, bgcolor: accent }
      }}
    >
      <Stack direction="row" justifyContent="space-between" alignItems="flex-start">
        <Box>
          <Typography variant="body2" color="text.secondary" fontWeight={700}>
            {title}
          </Typography>
          <Typography
            sx={{ mt: 1.1, color: 'text.primary', fontFamily: 'Poppins, sans-serif', fontSize: '1.75rem', fontWeight: 800, lineHeight: 1 }}
          >
            {value}
          </Typography>
          {secondary && (
            <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 0.65 }}>
              {secondary}
            </Typography>
          )}
        </Box>
        <Box
          sx={{
            width: 38,
            height: 38,
            display: 'grid',
            placeItems: 'center',
            borderRadius: 1.6,
            color: accent,
            bgcolor: alpha(accent, 0.11),
            fontSize: 18
          }}
        >
          {icon}
        </Box>
      </Stack>
    </Box>
  );
}

function TaskRow({ task, onToggle, onEdit, onDelete, busy }) {
  const theme = useTheme();
  const status = taskStatusKey(task);
  const category = CATEGORY_META[taskCategoryKey(task)];
  const rawDueDate = valueOf(task, 'dueDate', 'DueDate');
  const dueDate = rawDueDate ? new Date(rawDueDate) : null;
  const validDueDate = dueDate && !Number.isNaN(dueDate.getTime());
  const overdue = status === 'open' && validDueDate && isBefore(dueDate, startOfDay(new Date()));
  const dueToday = status === 'open' && validDueDate && isSameDay(dueDate, new Date());
  const propertyName = valueOf(task, 'propertyName', 'PropertyName');
  const recurring = Boolean(valueOf(task, 'isRecurring', 'IsRecurring'));
  const recurrenceType = Number(valueOf(task, 'recurrenceType', 'RecurrenceType') || 0);
  const resolved = status !== 'open';

  return (
    <Box
      sx={{
        position: 'relative',
        overflow: 'hidden',
        borderRadius: 2.25,
        border: `1px solid ${alpha(theme.palette.divider, theme.palette.mode === 'dark' ? 0.82 : 0.58)}`,
        bgcolor: 'background.paper',
        opacity: resolved ? 0.72 : 1,
        transition: 'transform 160ms ease, border-color 160ms ease, box-shadow 160ms ease',
        '&::before': {
          content: '""',
          position: 'absolute',
          top: 0,
          bottom: 0,
          left: 0,
          width: 4,
          bgcolor: resolved ? 'text.disabled' : category.color
        },
        '&:hover': {
          transform: resolved ? 'none' : 'translateY(-1px)',
          borderColor: alpha(category.color, 0.45),
          boxShadow: resolved ? 'none' : `0 12px 28px ${alpha('#061e35', 0.065)}`
        }
      }}
    >
      <Stack
        direction="row"
        alignItems="center"
        spacing={{ xs: 1, sm: 1.5 }}
        sx={{ minHeight: 78, pl: { xs: 1.25, sm: 1.75 }, pr: { xs: 0.75, sm: 1.25 }, py: 1.25 }}
      >
        <Checkbox
          checked={status === 'done'}
          disabled={busy || status === 'cancelled'}
          onChange={() => onToggle(task)}
          inputProps={{
            'aria-label': status === 'done' ? `Reopen ${valueOf(task, 'title', 'Title')}` : `Complete ${valueOf(task, 'title', 'Title')}`
          }}
          sx={{ color: alpha(category.color, 0.7), '&.Mui-checked': { color: 'success.main' } }}
        />

        <Box sx={{ flex: 1, minWidth: 0 }}>
          <Stack direction="row" alignItems="center" spacing={0.8} flexWrap="wrap" useFlexGap>
            <Typography
              fontWeight={760}
              sx={{ color: 'text.primary', textDecoration: status === 'done' ? 'line-through' : 'none', lineHeight: 1.3 }}
            >
              {valueOf(task, 'title', 'Title')}
            </Typography>
            <Chip
              size="small"
              label={category.label}
              sx={{
                height: 21,
                color: category.color,
                bgcolor: alpha(category.color, 0.09),
                border: `1px solid ${alpha(category.color, 0.18)}`,
                fontSize: '0.66rem',
                fontWeight: 800
              }}
            />
            {status === 'cancelled' && <Chip size="small" label="Cancelled" sx={{ height: 21, fontSize: '0.66rem', fontWeight: 750 }} />}
          </Stack>

          <Stack direction="row" spacing={1.6} alignItems="center" flexWrap="wrap" useFlexGap sx={{ mt: 0.7 }}>
            <Stack direction="row" spacing={0.55} alignItems="center">
              <CalendarOutlined style={{ fontSize: 12, color: overdue ? theme.palette.error.main : theme.palette.text.secondary }} />
              <Typography
                variant="caption"
                sx={{
                  color: overdue ? 'error.main' : dueToday ? 'success.dark' : 'text.secondary',
                  fontWeight: overdue || dueToday ? 750 : 550
                }}
              >
                {validDueDate
                  ? `${overdue ? 'Overdue · ' : dueToday ? 'Today · ' : ''}${format(dueDate, 'MMM d, yyyy · h:mm a')}`
                  : 'No due date'}
              </Typography>
            </Stack>
            {propertyName && (
              <Typography variant="caption" color="text.secondary">
                {propertyName}
              </Typography>
            )}
            {recurring && (
              <Stack direction="row" spacing={0.45} alignItems="center">
                <SyncOutlined style={{ fontSize: 11, color: theme.palette.text.secondary }} />
                <Typography variant="caption" color="text.secondary">
                  {RECURRENCE_LABELS[recurrenceType] || 'Recurring'}
                </Typography>
              </Stack>
            )}
          </Stack>
        </Box>

        <Stack direction="row" spacing={0.25}>
          <Tooltip title="Edit task">
            <span>
              <IconButton size="small" disabled={busy} onClick={() => onEdit(task)} aria-label={`Edit ${valueOf(task, 'title', 'Title')}`}>
                <EditOutlined />
              </IconButton>
            </span>
          </Tooltip>
          <Tooltip title="Delete task">
            <span>
              <IconButton
                size="small"
                disabled={busy}
                onClick={() => onDelete(task)}
                aria-label={`Delete ${valueOf(task, 'title', 'Title')}`}
                sx={{ '&:hover': { color: 'error.main' } }}
              >
                <DeleteOutlined />
              </IconButton>
            </span>
          </Tooltip>
        </Stack>
      </Stack>
    </Box>
  );
}

export default function TasksPage({ embedded = false }) {
  const theme = useTheme();
  const dispatch = useDispatch();
  const { user } = useAuth();
  const { properties } = useFetchProperties();
  const { loading, refetch } = useFetchTasks();
  const tasks = useSelector(selectTasks);
  const error = useSelector((state) => state.task?.error);
  const [filters, setFilters] = useState(initialFilters);
  const [editorOpen, setEditorOpen] = useState(false);
  const [editTask, setEditTask] = useState(null);
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [busyTaskId, setBusyTaskId] = useState(null);

  const summary = useMemo(() => summarizeTasks(tasks), [tasks]);
  const visibleTasks = useMemo(() => filterAndSortTasks(tasks, filters), [tasks, filters]);
  const hasFilters = Object.entries(filters).some(([key, value]) => value !== initialFilters[key]);
  const setFilter = (key, value) => setFilters((current) => ({ ...current, [key]: value }));

  const openCreate = () => {
    setEditTask(null);
    setEditorOpen(true);
  };

  const openEdit = (task) => {
    setEditTask(task);
    setEditorOpen(true);
  };

  const handleSave = async (form) => {
    if (editTask) {
      const id = valueOf(editTask, 'id', 'Id');
      await dispatch(updateTaskAction(id, { id, ...form }));
      return;
    }
    await dispatch(createTask(form));
  };

  const handleToggle = async (task) => {
    const id = valueOf(task, 'id', 'Id');
    const nextStatus = taskStatusKey(task) === 'done' ? 0 : 1;
    setBusyTaskId(id);
    try {
      await dispatch(updateTaskAction(id, buildTaskUpdatePayload(task, { status: nextStatus })));
    } finally {
      setBusyTaskId(null);
    }
  };

  const handleDelete = async () => {
    const id = valueOf(deleteTarget, 'id', 'Id');
    setBusyTaskId(id);
    try {
      await dispatch(deleteTaskAction(id));
      setDeleteTarget(null);
    } finally {
      setBusyTaskId(null);
    }
  };

  const filterControlSx = {
    minWidth: { xs: '100%', sm: 145 },
    '& .MuiOutlinedInput-root': { height: 40, borderRadius: 1.6, bgcolor: 'background.paper', fontSize: '0.8rem' }
  };

  return (
    <Box>
      {!embedded && <DashboardHeader userName={user?.firstname || user?.Firstname} />}

      <Stack
        direction={{ xs: 'column', sm: 'row' }}
        justifyContent="space-between"
        alignItems={{ xs: 'stretch', sm: 'center' }}
        spacing={1.5}
        sx={{ mb: { xs: 1.5, sm: 1 } }}
      >
        <Box>
          <Typography variant="body2" color="text.secondary">
            Plan, resolve, and revisit work across the portfolio.
          </Typography>
        </Box>
        <Button
          variant="contained"
          color="success"
          startIcon={<PlusOutlined />}
          onClick={openCreate}
          sx={{ minHeight: 40, px: 2.2, textTransform: 'none', fontWeight: 800, alignSelf: { xs: 'stretch', sm: 'center' } }}
        >
          Add task
        </Button>
      </Stack>

      <Box sx={{ mb: 2 }}>
        <Stack direction={{ xs: 'column', lg: 'row' }} spacing={1} alignItems={{ lg: 'center' }}>
          <TextField
            size="small"
            value={filters.search}
            onChange={(event) => setFilter('search', event.target.value)}
            placeholder="Search tasks or properties"
            sx={{
              minWidth: { lg: 260 },
              flex: { lg: 1 },
              '& .MuiOutlinedInput-root': { height: 40, borderRadius: 1.6, bgcolor: 'background.paper' }
            }}
            InputProps={{
              startAdornment: (
                <InputAdornment position="start">
                  <SearchOutlined />
                </InputAdornment>
              )
            }}
          />
          <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1} sx={{ flexWrap: { lg: 'wrap' } }}>
            <FormControl size="small" sx={filterControlSx}>
              <Select value={filters.status} onChange={(event) => setFilter('status', event.target.value)}>
                <MenuItem value="all">All statuses</MenuItem>
                <MenuItem value="open">Open</MenuItem>
                <MenuItem value="done">Done</MenuItem>
                <MenuItem value="cancelled">Cancelled</MenuItem>
              </Select>
            </FormControl>
            <FormControl size="small" sx={{ ...filterControlSx, minWidth: { xs: '100%', sm: 175 } }}>
              <Select
                value={filters.propertyId}
                onChange={(event) => setFilter('propertyId', event.target.value)}
                displayEmpty
                renderValue={(value) =>
                  value ? properties.find((property) => String(property.id) === String(value))?.name || 'Property' : 'All properties'
                }
              >
                <MenuItem value="">All properties</MenuItem>
                {properties.map((property) => (
                  <MenuItem key={property.id} value={String(property.id)}>
                    {property.name || property.streetAddress}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>
            <FormControl size="small" sx={filterControlSx}>
              <Select value={filters.date} onChange={(event) => setFilter('date', event.target.value)}>
                <MenuItem value="all">Any due date</MenuItem>
                <MenuItem value="today">Due today</MenuItem>
                <MenuItem value="overdue">Overdue</MenuItem>
                <MenuItem value="next-7-days">Next 7 days</MenuItem>
              </Select>
            </FormControl>
            <FormControl size="small" sx={filterControlSx}>
              <Select value={filters.frequency} onChange={(event) => setFilter('frequency', event.target.value)}>
                <MenuItem value="all">Any frequency</MenuItem>
                <MenuItem value="one-time">One-time</MenuItem>
                <MenuItem value="recurring">Recurring</MenuItem>
              </Select>
            </FormControl>
          </Stack>
          {hasFilters && (
            <Button onClick={() => setFilters(initialFilters)} sx={{ textTransform: 'none', whiteSpace: 'nowrap' }}>
              Clear filters
            </Button>
          )}
        </Stack>
      </Box>

      <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', sm: 'repeat(3, minmax(0, 1fr))' }, gap: 1.5, mb: 2.5 }}>
        <SummaryCard
          icon={<CheckCircleOutlined />}
          title="Tasks"
          value={summary.open}
          secondary={`${summary.resolved} resolved`}
          accent={theme.palette.success.main}
        />
        <SummaryCard
          icon={<ClockCircleOutlined />}
          title="Due today"
          value={summary.today}
          secondary={summary.today === 1 ? 'open task' : 'open tasks'}
          accent="#2563eb"
        />
        <SummaryCard icon={<SyncOutlined />} title="Recurring" value={summary.recurring} secondary="scheduled routines" accent="#7c5ce7" />
      </Box>

      <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 1.25 }}>
        <Typography variant="h5" fontWeight={760}>
          {hasFilters ? `${visibleTasks.length} matching task${visibleTasks.length === 1 ? '' : 's'}` : 'All tasks'}
        </Typography>
        {!loading && (
          <Tooltip title="Refresh tasks">
            <IconButton size="small" onClick={refetch} aria-label="Refresh tasks">
              <ReloadOutlined />
            </IconButton>
          </Tooltip>
        )}
      </Stack>

      {loading ? (
        <Stack spacing={1.15}>
          {[0, 1, 2].map((item) => (
            <Skeleton key={item} variant="rounded" height={78} sx={{ borderRadius: 2.25 }} />
          ))}
        </Stack>
      ) : error ? (
        <Stack
          alignItems="center"
          spacing={1.25}
          sx={{
            py: 7,
            px: 2,
            borderRadius: 2.5,
            border: `1px dashed ${alpha(theme.palette.error.main, 0.3)}`,
            bgcolor: alpha(theme.palette.error.main, 0.035)
          }}
        >
          <Typography fontWeight={750}>Tasks could not be loaded.</Typography>
          <Typography variant="body2" color="text.secondary">
            Check your connection and try again.
          </Typography>
          <Button startIcon={<ReloadOutlined />} onClick={refetch} sx={{ textTransform: 'none' }}>
            Try again
          </Button>
        </Stack>
      ) : visibleTasks.length > 0 ? (
        <Stack spacing={1.15}>
          {visibleTasks.map((task) => (
            <TaskRow
              key={valueOf(task, 'id', 'Id')}
              task={task}
              busy={busyTaskId === valueOf(task, 'id', 'Id')}
              onToggle={handleToggle}
              onEdit={openEdit}
              onDelete={setDeleteTarget}
            />
          ))}
        </Stack>
      ) : (
        <Stack
          alignItems="center"
          textAlign="center"
          spacing={1.1}
          sx={{
            minHeight: 300,
            justifyContent: 'center',
            px: 2,
            borderRadius: 2.75,
            border: `1px dashed ${alpha(theme.palette.success.main, 0.26)}`,
            bgcolor: alpha(theme.palette.success.main, 0.025)
          }}
        >
          <Box
            sx={{
              width: 58,
              height: 58,
              display: 'grid',
              placeItems: 'center',
              borderRadius: '50%',
              color: 'success.main',
              bgcolor: alpha(theme.palette.success.main, 0.1),
              fontSize: 25
            }}
          >
            <CheckCircleOutlined />
          </Box>
          <Typography variant="h5" fontWeight={780}>
            {hasFilters ? 'No tasks match these filters' : 'Your task list is clear'}
          </Typography>
          <Typography variant="body2" color="text.secondary" sx={{ maxWidth: 360 }}>
            {hasFilters
              ? 'Adjust or clear the filters to see more work.'
              : 'Add the next property task when something needs your attention.'}
          </Typography>
          {hasFilters ? (
            <Button onClick={() => setFilters(initialFilters)} sx={{ textTransform: 'none' }}>
              Clear filters
            </Button>
          ) : (
            <Button
              variant="contained"
              color="success"
              startIcon={<PlusOutlined />}
              onClick={openCreate}
              sx={{ mt: 0.5, textTransform: 'none', fontWeight: 800 }}
            >
              Add your first task
            </Button>
          )}
        </Stack>
      )}

      <TaskEditorDrawer
        open={editorOpen}
        onClose={() => {
          setEditorOpen(false);
          setEditTask(null);
        }}
        onSave={handleSave}
        defaultDate={new Date()}
        properties={properties}
        editTask={editTask}
      />

      <Dialog open={Boolean(deleteTarget)} onClose={busyTaskId ? undefined : () => setDeleteTarget(null)} maxWidth="xs" fullWidth>
        <DialogTitle>Delete task?</DialogTitle>
        <DialogContent>
          <Typography color="text.secondary">
            “{valueOf(deleteTarget, 'title', 'Title')}” will be permanently removed from Tasks and Calendar.
          </Typography>
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2.5 }}>
          <Button onClick={() => setDeleteTarget(null)} disabled={Boolean(busyTaskId)} sx={{ textTransform: 'none' }}>
            Keep task
          </Button>
          <Button variant="contained" color="error" onClick={handleDelete} disabled={Boolean(busyTaskId)} sx={{ textTransform: 'none' }}>
            {busyTaskId ? 'Deleting…' : 'Delete'}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}
