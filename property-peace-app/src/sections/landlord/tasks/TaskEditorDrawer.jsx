import { useEffect, useState } from 'react';
import { format, parseISO } from 'date-fns';
import { alpha } from '@mui/material/styles';
import { Button, FormControl, IconButton, MenuItem, Select, Stack, TextField, Typography, useTheme } from '@mui/material';
import { CloseOutlined } from '@ant-design/icons';
import ThemeAdaptiveDrawer from 'components/drawers/shared/ThemeAdaptiveDrawer';

const RECURRENCE_TYPES = [
  { value: 0, label: 'Does not repeat' },
  { value: 1, label: 'Daily' },
  { value: 2, label: 'Weekly' },
  { value: 3, label: 'Monthly' },
  { value: 4, label: 'Yearly' }
];

const CATEGORY_OPTIONS = [
  { value: 0, label: 'Task' },
  { value: 1, label: 'Rent & payment' },
  { value: 2, label: 'Maintenance' },
  { value: 3, label: 'Lease' }
];

const STATUS_OPTIONS = [
  { value: 0, label: 'Open' },
  { value: 1, label: 'Done' },
  { value: 2, label: 'Cancelled' }
];

const valueOf = (item, camel, pascal) => item?.[camel] ?? item?.[pascal];

const editorDate = (value, fallback = new Date()) => {
  const parsed = value ? parseISO(value) : fallback;
  return format(Number.isNaN(parsed.getTime()) ? fallback : parsed, "yyyy-MM-dd'T'HH:mm");
};

const emptyForm = (defaultDate, initialValues = null) => ({
  title: initialValues?.title || '',
  dueDate: editorDate(initialValues?.dueDate, defaultDate || new Date()),
  category: Number(initialValues?.category ?? 0),
  status: 0,
  propertyId: initialValues?.propertyId || '',
  isRecurring: false,
  recurrenceType: Number(initialValues?.recurrenceType ?? 0),
  recurrenceInterval: 1,
  recurrenceEndDate: ''
});

export default function TaskEditorDrawer({ open, onClose, onSave, defaultDate, properties = [], editTask = null, initialValues = null }) {
  const theme = useTheme();
  const isDarkMode = theme.palette.mode === 'dark';
  const [form, setForm] = useState(() => emptyForm(defaultDate, initialValues));
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open) return;
    if (!editTask) {
      setForm(emptyForm(defaultDate, initialValues));
      return;
    }

    const recurrenceEnd = valueOf(editTask, 'recurrenceEndDate', 'RecurrenceEndDate');
    setForm({
      title: valueOf(editTask, 'title', 'Title') || '',
      dueDate: editorDate(valueOf(editTask, 'dueDate', 'DueDate'), defaultDate || new Date()),
      category: Number(valueOf(editTask, 'category', 'Category') ?? 0),
      status: Number(valueOf(editTask, 'status', 'Status') ?? 0),
      propertyId: valueOf(editTask, 'propertyId', 'PropertyId') || '',
      isRecurring: Boolean(valueOf(editTask, 'isRecurring', 'IsRecurring')),
      recurrenceType: Number(valueOf(editTask, 'recurrenceType', 'RecurrenceType') ?? 0),
      recurrenceInterval: Number(valueOf(editTask, 'recurrenceInterval', 'RecurrenceInterval') || 1),
      recurrenceEndDate: recurrenceEnd ? format(parseISO(recurrenceEnd), 'yyyy-MM-dd') : ''
    });
  }, [defaultDate, editTask, initialValues, open]);

  const set = (key, value) => setForm((current) => ({ ...current, [key]: value }));

  const handleSave = async () => {
    if (!form.title.trim() || saving) return;
    setSaving(true);
    try {
      await onSave({
        ...form,
        title: form.title.trim(),
        dueDate: new Date(form.dueDate).toISOString(),
        category: Number(form.category),
        status: Number(form.status),
        propertyId: form.propertyId ? Number(form.propertyId) : null,
        isRecurring: Number(form.recurrenceType) !== 0,
        recurrenceType: Number(form.recurrenceType),
        recurrenceInterval: Math.max(1, Number(form.recurrenceInterval) || 1),
        recurrenceEndDate: form.recurrenceEndDate ? new Date(form.recurrenceEndDate).toISOString() : null
      });
      onClose();
    } finally {
      setSaving(false);
    }
  };

  const borderColor = isDarkMode ? alpha(theme.palette.primary.main, 0.2) : alpha('#061e35', 0.11);

  return (
    <ThemeAdaptiveDrawer
      anchor="right"
      open={open}
      onClose={saving ? undefined : onClose}
      PaperProps={{
        sx: {
          width: { xs: '100%', sm: 430 },
          bgcolor: 'background.paper',
          backgroundImage: isDarkMode
            ? `linear-gradient(180deg, ${alpha(theme.palette.success.main, 0.08)} 0%, transparent 220px)`
            : 'linear-gradient(180deg, #f5fbf7 0%, #ffffff 180px)',
          borderLeft: `1px solid ${borderColor}`
        }
      }}
    >
      <Stack sx={{ height: '100%' }}>
        <Stack
          direction="row"
          justifyContent="space-between"
          alignItems="center"
          sx={{ px: 3, py: 2.25, borderBottom: `1px solid ${borderColor}` }}
        >
          <Stack spacing={0.25}>
            <Typography variant="h5" fontWeight={750}>
              {editTask ? 'Edit task' : 'Add a task'}
            </Typography>
            <Typography variant="caption" color="text.secondary">
              Keep the next property action clear and scheduled.
            </Typography>
          </Stack>
          <IconButton onClick={onClose} disabled={saving} aria-label="Close task editor">
            <CloseOutlined />
          </IconButton>
        </Stack>

        <Stack spacing={2.25} sx={{ flex: 1, overflowY: 'auto', px: 3, py: 3 }}>
          <Stack spacing={0.75}>
            <Typography variant="caption" fontWeight={700} color="text.secondary">
              Task
            </Typography>
            <TextField
              value={form.title}
              onChange={(event) => set('title', event.target.value)}
              fullWidth
              autoFocus
              size="small"
              placeholder="e.g. Confirm the plumber appointment"
              inputProps={{ maxLength: 300 }}
            />
          </Stack>

          <Stack spacing={0.75}>
            <Typography variant="caption" fontWeight={700} color="text.secondary">
              Due date and time
            </Typography>
            <TextField
              type="datetime-local"
              value={form.dueDate}
              onChange={(event) => set('dueDate', event.target.value)}
              fullWidth
              size="small"
              InputLabelProps={{ shrink: true }}
            />
          </Stack>

          <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1.5}>
            <Stack spacing={0.75} sx={{ flex: 1 }}>
              <Typography variant="caption" fontWeight={700} color="text.secondary">
                Category
              </Typography>
              <FormControl fullWidth size="small">
                <Select value={form.category} onChange={(event) => set('category', event.target.value)}>
                  {CATEGORY_OPTIONS.map((option) => (
                    <MenuItem key={option.value} value={option.value}>
                      {option.label}
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>
            </Stack>
            {editTask && (
              <Stack spacing={0.75} sx={{ flex: 1 }}>
                <Typography variant="caption" fontWeight={700} color="text.secondary">
                  Status
                </Typography>
                <FormControl fullWidth size="small">
                  <Select value={form.status} onChange={(event) => set('status', event.target.value)}>
                    {STATUS_OPTIONS.map((option) => (
                      <MenuItem key={option.value} value={option.value}>
                        {option.label}
                      </MenuItem>
                    ))}
                  </Select>
                </FormControl>
              </Stack>
            )}
          </Stack>

          <Stack spacing={0.75}>
            <Typography variant="caption" fontWeight={700} color="text.secondary">
              Property
            </Typography>
            <FormControl fullWidth size="small">
              <Select
                value={form.propertyId}
                onChange={(event) => set('propertyId', event.target.value)}
                displayEmpty
                renderValue={(value) =>
                  value
                    ? properties.find((property) => String(property.id) === String(value))?.name || 'Property'
                    : 'All properties / general'
                }
              >
                <MenuItem value="">All properties / general</MenuItem>
                {properties.map((property) => (
                  <MenuItem key={property.id} value={property.id}>
                    {property.name || property.streetAddress}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>
          </Stack>

          <Stack spacing={0.75}>
            <Typography variant="caption" fontWeight={700} color="text.secondary">
              Frequency
            </Typography>
            <FormControl fullWidth size="small">
              <Select value={form.recurrenceType} onChange={(event) => set('recurrenceType', event.target.value)}>
                {RECURRENCE_TYPES.map((option) => (
                  <MenuItem key={option.value} value={option.value}>
                    {option.label}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>
          </Stack>

          {Number(form.recurrenceType) !== 0 && (
            <Stack direction="row" spacing={1.5}>
              <Stack spacing={0.75} sx={{ width: 120 }}>
                <Typography variant="caption" fontWeight={700} color="text.secondary">
                  Repeat every
                </Typography>
                <TextField
                  type="number"
                  value={form.recurrenceInterval}
                  onChange={(event) => set('recurrenceInterval', event.target.value)}
                  size="small"
                  inputProps={{ min: 1 }}
                />
              </Stack>
              <Stack spacing={0.75} sx={{ flex: 1 }}>
                <Typography variant="caption" fontWeight={700} color="text.secondary">
                  End date
                </Typography>
                <TextField
                  type="date"
                  value={form.recurrenceEndDate}
                  onChange={(event) => set('recurrenceEndDate', event.target.value)}
                  size="small"
                  InputLabelProps={{ shrink: true }}
                />
              </Stack>
            </Stack>
          )}
        </Stack>

        <Stack
          direction="row"
          justifyContent="flex-end"
          spacing={1.25}
          sx={{ px: 3, py: 2, borderTop: `1px solid ${borderColor}`, bgcolor: alpha(theme.palette.background.paper, 0.94) }}
        >
          <Button onClick={onClose} disabled={saving} sx={{ textTransform: 'none' }}>
            Cancel
          </Button>
          <Button
            variant="contained"
            color="success"
            onClick={handleSave}
            disabled={!form.title.trim() || saving}
            sx={{ px: 2.5, textTransform: 'none', fontWeight: 800 }}
          >
            {saving ? 'Saving…' : editTask ? 'Save changes' : 'Add task'}
          </Button>
        </Stack>
      </Stack>
    </ThemeAdaptiveDrawer>
  );
}
