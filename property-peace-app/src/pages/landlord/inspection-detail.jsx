import { useState, useEffect, useRef, useCallback } from 'react';
import {
  Box,
  Typography,
  Stack,
  Button,
  Grid,
  CircularProgress,
  Chip,
  alpha,
  useTheme,
  Select,
  MenuItem,
  Divider,
  IconButton,
  Tooltip,
  LinearProgress,
  TextField,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Collapse
} from '@mui/material';
import {
  ArrowLeftOutlined,
  CameraOutlined,
  PlusOutlined,
  HomeOutlined,
  AuditOutlined,
  DeleteOutlined,
  CloseOutlined,
  ExpandOutlined,
  DownOutlined,
  RightOutlined,
  CalendarOutlined,
  SaveOutlined,
  EditOutlined,
  CheckOutlined
} from '@ant-design/icons';
import { useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { useSelector } from 'react-redux';
import MainCard from 'components/MainCard';
import { checklistAPI } from 'api';
import { openSnackbar } from 'api/snackbar';
import PageBreadcrumbs from 'components/breadcrumbs/PageBreadcrumbs';
import axiosServices from 'utils/axios';
import { formatDate } from 'utils/formatters';
import { selectProperties } from 'store/property/property.selector';
import useFetchProperties from 'hooks/useFetchProperties';

const MOVE_IN = 'moveInChecklist';
const MOVE_OUT = 'moveOutChecklist';

function normalizeChecklistType(type) {
  return String(type ?? '').toLowerCase();
}

function isMoveInChecklist(checklist) {
  const type = normalizeChecklistType(checklist?.checklistType);
  const typeName = normalizeChecklistType(checklist?.checklistTypeName);
  return type === MOVE_IN.toLowerCase() || type === '40' || typeName.includes('movein') || typeName.includes('move-in');
}

function isMoveOutChecklist(checklist) {
  const type = normalizeChecklistType(checklist?.checklistType);
  const typeName = normalizeChecklistType(checklist?.checklistTypeName);
  return type === MOVE_OUT.toLowerCase() || type === '41' || typeName.includes('moveout') || typeName.includes('move-out');
}

// Default inspection items — SortOrder 0-N (< 1000 = default, cannot be deleted)
const DEFAULT_INSPECTION_ITEMS = [
  { category: 'Kitchen', names: ['Walls & Ceiling', 'Floors', 'Countertops', 'Cabinets & Drawers', 'Sink & Faucet', 'Refrigerator', 'Stove & Oven', 'Dishwasher', 'Microwave', 'Light Fixtures & Outlets'] },
  { category: 'Living Room', names: ['Walls & Ceiling', 'Floors', 'Windows & Blinds', 'Doors & Locks', 'Light Fixtures & Outlets'] },
  { category: 'Bedroom', names: ['Walls & Ceiling', 'Floors', 'Windows & Blinds', 'Closet & Doors', 'Light Fixtures & Outlets'] },
  { category: 'Bathroom', names: ['Walls & Ceiling', 'Floors', 'Toilet', 'Sink & Faucet', 'Shower & Tub', 'Exhaust Fan', 'Light Fixtures & Mirror'] },
  { category: 'Laundry', names: ['Washer & Dryer Hookups', 'Floors'] },
  { category: 'General', names: ['Entry Door & Locks', 'Smoke Detectors', 'Carbon Monoxide Detectors', 'HVAC Filter', 'Keys & Access Cards'] }
];

const CONDITION_OPTIONS = [
  { value: 'Good',  label: 'Good – No issues' },
  { value: 'NC',   label: 'NC – Needs Cleaning' },
  { value: 'NP',   label: 'NP – Needs Painting' },
  { value: 'NR',   label: 'NR – Needs Repair' },
  { value: 'NSC',  label: 'NSC – Needs Spot Cleaning' },
  { value: 'NSP',  label: 'NSP – Needs Spot Painting' },
  { value: 'RP',   label: 'RP – Needs Replacing' },
];

function conditionThemeColor(cond, theme) {
  if (!cond) return undefined;
  if (cond === 'Good') return theme.palette.success.main;
  if (cond === 'NR' || cond === 'RP') return theme.palette.error.main;
  return theme.palette.warning.main;
}

function toDateTimeLocalValue(value) {
  if (!value) return '';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  const offsetDate = new Date(date.getTime() - date.getTimezoneOffset() * 60000);
  return offsetDate.toISOString().slice(0, 16);
}

function fromDateTimeLocalValue(value) {
  if (!value) return null;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  return date.toISOString();
}

function ScheduleVisitControl({ checklist, label, onRefresh }) {
  const theme = useTheme();
  const [scheduledAt, setScheduledAt] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    setScheduledAt(toDateTimeLocalValue(checklist?.inspectionDate));
  }, [checklist?.inspectionDate]);

  const handleSave = async () => {
    if (!checklist) return;
    const inspectionDate = fromDateTimeLocalValue(scheduledAt);
    if (!inspectionDate) {
      openSnackbar({ open: true, message: 'Choose a valid visit date and time', variant: 'alert', alert: { color: 'warning' } });
      return;
    }

    setSaving(true);
    try {
      const res = await checklistAPI.updateChecklist(checklist.id, { Id: checklist.id, InspectionDate: inspectionDate });
      if (!res?.success) throw new Error(res?.message || 'Failed to schedule visit');
      onRefresh(res.data);
      openSnackbar({ open: true, message: `${label} visit scheduled`, variant: 'alert', alert: { color: 'success' } });
    } catch (err) {
      openSnackbar({ open: true, message: err.message || 'Failed to schedule visit', variant: 'alert', alert: { color: 'error' } });
    } finally {
      setSaving(false);
    }
  };

  return (
    <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1} alignItems={{ xs: 'stretch', sm: 'center' }}>
      <TextField
        type="datetime-local"
        size="small"
        label="Schedule visit"
        value={scheduledAt}
        onChange={(e) => setScheduledAt(e.target.value)}
        InputLabelProps={{ shrink: true }}
        sx={{ minWidth: { sm: 220 } }}
      />
      <Button
        variant="outlined"
        size="small"
        onClick={handleSave}
        disabled={saving || !scheduledAt}
        startIcon={saving ? <CircularProgress size={13} /> : <SaveOutlined />}
        sx={{ flexShrink: 0, textTransform: 'none', borderRadius: 1.5, px: 1.5, borderColor: theme.palette.divider }}
      >
        Save
      </Button>
    </Stack>
  );
}

// Key legend shown at top of each inspection column
function KeyLegend({ sx = {} }) {
  const theme = useTheme();
  const entries = [
    ['NC', 'Needs Cleaning'],
    ['NP', 'Needs Painting'],
    ['NR', 'Needs Repair'],
    ['NSC', 'Needs Spot Cleaning'],
    ['NSP', 'Needs Spot Painting'],
    ['RP',  'Needs Replacing'],
  ];
  return (
    <Box sx={{ p: 1.75, borderRadius: 1.5, bgcolor: alpha(theme.palette.primary.main, 0.03), border: `1px solid ${alpha(theme.palette.divider, 0.7)}`, ...sx }}>
      <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 1, lineHeight: 1.4 }}>
        Unless otherwise noted, premises are in clean, good working order and undamaged. Use the key below.
      </Typography>
      <Box sx={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '2px 16px' }}>
        {entries.map(([abbr, desc]) => (
          <Stack key={abbr} direction="row" spacing={0.75} alignItems="baseline">
            <Typography variant="caption" fontWeight={800} sx={{ color: 'text.primary', minWidth: 26 }}>{abbr}</Typography>
            <Typography variant="caption" color="text.secondary">{desc}</Typography>
          </Stack>
        ))}
      </Box>
    </Box>
  );
}

// Map a loaded item to the UpdateChecklistItemDto shape
const toItemDto = (i) => ({
  Id: i.id,
  Name: i.name,
  Category: i.category || null,
  Condition: i.condition || null,
  Notes: i.notes || null,
  IsChecked: i.isChecked,
  CheckedAt: i.checkedAt || null,
  HasDamage: i.hasDamage || false,
  DamageDescription: i.damageDescription || null,
  PhotoBlobNames: i.photoBlobNames || null,
  PhotoBlobUrls: i.photoBlobUrls || null,
  SortOrder: i.sortOrder || 0
});

// ─── Item Photos Modal ────────────────────────────────────────────────────────

function ItemPhotosModal({ open, onClose, item, checklistId, onUpdated }) {
  const theme = useTheme();
  const fileRef = useRef(null);
  const [uploading, setUploading] = useState(false);
  const [deletingBlob, setDeletingBlob] = useState(null);
  const [lightbox, setLightbox] = useState(null); // url to preview full-size

  const photos = item?.photoBlobUrls || [];
  const blobNames = item?.photoBlobNames || [];

  const handleUpload = async (e) => {
    const files = Array.from(e.target.files || []);
    if (!files.length) return;
    setUploading(true);
    try {
      let latest = null;
      for (const file of files) {
        const res = await checklistAPI.uploadItemImage(checklistId, item.id, file);
        if (!res?.success) throw new Error(res?.message || 'Upload failed');
        latest = res.data;
      }
      if (latest) onUpdated(latest);
    } catch (err) {
      openSnackbar({ open: true, message: err.message || 'Failed to upload image', variant: 'alert', alert: { color: 'error' } });
    } finally {
      setUploading(false);
      e.target.value = '';
    }
  };

  const handleDelete = async (blobName) => {
    setDeletingBlob(blobName);
    try {
      const res = await checklistAPI.deleteItemImage(checklistId, item.id, blobName);
      if (!res?.success) throw new Error(res?.message || 'Delete failed');
      onUpdated(res.data);
    } catch (err) {
      openSnackbar({ open: true, message: err.message || 'Failed to delete image', variant: 'alert', alert: { color: 'error' } });
    } finally {
      setDeletingBlob(null);
    }
  };

  return (
    <>
      <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth PaperProps={{ sx: { borderRadius: 2 } }}>
        <DialogTitle sx={{ pb: 1, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <Box>
            <Typography variant="h6" fontWeight={700}>Photos</Typography>
            <Typography variant="caption" color="text.secondary">{item?.name}</Typography>
          </Box>
          <IconButton size="small" onClick={onClose}><CloseOutlined style={{ fontSize: 16 }} /></IconButton>
        </DialogTitle>

        <DialogContent sx={{ pt: 1 }}>
          {photos.length === 0 ? (
            <Box sx={{ textAlign: 'center', py: 5 }}>
              <CameraOutlined style={{ fontSize: 32, color: alpha(theme.palette.primary.main, 0.3) }} />
              <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>No photos yet</Typography>
            </Box>
          ) : (
            <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 1, mb: 1 }}>
              {photos.map((url, idx) => (
                <Box
                  key={blobNames[idx] || idx}
                  sx={{ position: 'relative', paddingTop: '100%', borderRadius: 1.5, overflow: 'hidden', bgcolor: 'grey.100', '&:hover .photo-actions': { opacity: 1 } }}
                >
                  <Box
                    component="img"
                    src={url}
                    alt={`Photo ${idx + 1}`}
                    sx={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover' }}
                  />
                  {/* Hover overlay */}
                  <Box
                    className="photo-actions"
                    sx={{
                      position: 'absolute', inset: 0, bgcolor: 'rgba(0,0,0,0.45)',
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      gap: 0.5, opacity: 0, transition: 'opacity 0.15s'
                    }}
                  >
                    <Tooltip title="View full size">
                      <IconButton size="small" onClick={() => setLightbox(url)} sx={{ bgcolor: 'rgba(255,255,255,0.15)', color: '#fff', '&:hover': { bgcolor: 'rgba(255,255,255,0.3)' } }}>
                        <ExpandOutlined style={{ fontSize: 14 }} />
                      </IconButton>
                    </Tooltip>
                    <Tooltip title="Delete photo">
                      <IconButton
                        size="small"
                        disabled={!!deletingBlob}
                        onClick={() => blobNames[idx] && handleDelete(blobNames[idx])}
                        sx={{ bgcolor: 'rgba(255,255,255,0.15)', color: '#fff', '&:hover': { bgcolor: 'rgba(220,53,69,0.7)' } }}
                      >
                        {deletingBlob === blobNames[idx] ? <CircularProgress size={12} color="inherit" /> : <DeleteOutlined style={{ fontSize: 14 }} />}
                      </IconButton>
                    </Tooltip>
                  </Box>
                </Box>
              ))}
            </Box>
          )}
        </DialogContent>

        <DialogActions sx={{ px: 3, pb: 2.5, justifyContent: 'space-between' }}>
          <Typography variant="caption" color="text.disabled">{photos.length} photo{photos.length !== 1 ? 's' : ''}</Typography>
          <Box>
            <input ref={fileRef} type="file" accept="image/*" multiple style={{ display: 'none' }} onChange={handleUpload} />
            <Button
              variant="contained"
              size="small"
              startIcon={uploading ? <CircularProgress size={13} color="inherit" /> : <CameraOutlined />}
              disabled={uploading}
              onClick={() => fileRef.current?.click()}
              sx={{ textTransform: 'none', fontWeight: 600 }}
            >
              {uploading ? 'Uploading…' : 'Add Photos'}
            </Button>
          </Box>
        </DialogActions>
      </Dialog>

      {/* Lightbox */}
      <Dialog open={!!lightbox} onClose={() => setLightbox(null)} maxWidth="md" PaperProps={{ sx: { bgcolor: 'transparent', boxShadow: 'none' } }}>
        <Box sx={{ position: 'relative' }}>
          <IconButton onClick={() => setLightbox(null)} sx={{ position: 'absolute', top: 8, right: 8, bgcolor: 'rgba(0,0,0,0.5)', color: '#fff', zIndex: 1, '&:hover': { bgcolor: 'rgba(0,0,0,0.7)' } }}>
            <CloseOutlined style={{ fontSize: 16 }} />
          </IconButton>
          <Box component="img" src={lightbox} alt="Full size" sx={{ maxWidth: '90vw', maxHeight: '85vh', borderRadius: 1, display: 'block' }} />
        </Box>
      </Dialog>
    </>
  );
}

// ─── Item photo thumbnail strip (replaces old single ImageBox) ────────────────

function ItemPhotoStrip({ item, checklistId, onUpdated }) {
  const theme = useTheme();
  const [modalOpen, setModalOpen] = useState(false);
  const photos = item?.photoBlobUrls || [];
  const count = photos.length;

  return (
    <>
      <Tooltip title={count > 0 ? `${count} photo${count !== 1 ? 's' : ''} – click to manage` : 'Add photos'}>
        <Box
          onClick={() => setModalOpen(true)}
          sx={{
            width: 56,
            height: 56,
            borderRadius: 1.5,
            flexShrink: 0,
            cursor: 'pointer',
            overflow: 'hidden',
            position: 'relative',
            border: count > 0 ? 'none' : `2px dashed ${alpha(theme.palette.primary.main, 0.3)}`,
            bgcolor: count > 0 ? 'transparent' : alpha(theme.palette.grey[100], 0.8),
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            transition: 'all 0.15s',
            '&:hover': { borderColor: 'primary.main', opacity: 0.85 },
            '&:hover .strip-overlay': { opacity: 1 }
          }}
        >
          {count > 0 ? (
            <>
              <Box component="img" src={photos[0]} alt={item.name} sx={{ width: '100%', height: '100%', objectFit: 'cover' }} />
              {count > 1 && (
                <Box sx={{ position: 'absolute', bottom: 2, right: 3 }}>
                  <Chip label={`+${count - 1}`} size="small" sx={{ height: 14, fontSize: 9, fontWeight: 700, bgcolor: 'rgba(0,0,0,0.6)', color: '#fff', '& .MuiChip-label': { px: 0.5 } }} />
                </Box>
              )}
              <Box className="strip-overlay" sx={{ position: 'absolute', inset: 0, bgcolor: 'rgba(0,0,0,0.35)', display: 'flex', alignItems: 'center', justifyContent: 'center', opacity: 0, transition: 'opacity 0.15s' }}>
                <CameraOutlined style={{ fontSize: 16, color: '#fff' }} />
              </Box>
            </>
          ) : (
            <Stack alignItems="center" spacing={0.25}>
              <CameraOutlined style={{ fontSize: 15, color: alpha(theme.palette.primary.main, 0.5) }} />
              <Typography variant="caption" sx={{ fontSize: 9, color: 'text.disabled', lineHeight: 1.2, textAlign: 'center' }}>Photos</Typography>
            </Stack>
          )}
        </Box>
      </Tooltip>

      <ItemPhotosModal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        item={item}
        checklistId={checklistId}
        onUpdated={(data) => { onUpdated(data); }}
      />
    </>
  );
}

// ─── Single Inspection Item Row ───────────────────────────────────────────────

function InspectionItemRow({ item, checklistId, allItems, onUpdated, isDefault, onDelete }) {
  const theme = useTheme();
  const [saving, setSaving] = useState(false);

  const isDone = !!item.condition;
  const condColor = conditionThemeColor(item.condition, theme);

  const handleConditionChange = async (newCondition) => {
    // Clicking the already-selected value clears it (un-marks the item)
    const next = newCondition === item.condition ? null : newCondition;
    setSaving(true);
    try {
      const updatedItems = allItems.map((i) => ({
        ...toItemDto(i),
        Condition: i.id === item.id ? next : (i.condition || null),
        IsChecked: i.id === item.id ? !!next : i.isChecked,
        CheckedAt: i.id === item.id ? (next ? new Date().toISOString() : null) : (i.checkedAt || null)
      }));
      const res = await checklistAPI.updateChecklist(checklistId, { Id: checklistId, Items: updatedItems });
      if (!res?.success) throw new Error(res?.message || 'Failed to update');
      onUpdated(res.data);
    } catch (err) {
      openSnackbar({ open: true, message: err.message || 'Failed to update item', variant: 'alert', alert: { color: 'error' } });
    } finally {
      setSaving(false);
    }
  };

  return (
    <Stack
      direction="row"
      spacing={1.5}
      alignItems="center"
      sx={{
        py: 1.25,
        px: 0.5,
        borderRadius: 1,
        transition: 'background 0.12s',
        bgcolor: isDone ? alpha(condColor || theme.palette.success.main, 0.04) : 'transparent',
        '&:hover': { bgcolor: isDone ? alpha(condColor || theme.palette.success.main, 0.07) : alpha(theme.palette.grey[100], 0.7) },
      }}
    >
      <ItemPhotoStrip item={item} checklistId={checklistId} onUpdated={onUpdated} />

      {/* Name + category */}
      <Box sx={{ flex: 1, minWidth: 0 }}>
        <Typography
          variant="body2"
          fontWeight={600}
          sx={{
            color: isDone ? 'text.secondary' : 'text.primary',
            lineHeight: 1.3
          }}
        >
          {item.name}
        </Typography>
        {item.category && (
          <Typography variant="caption" color="text.disabled" sx={{ fontSize: 11 }}>
            {item.category}
          </Typography>
        )}
      </Box>

      {/* Condition select */}
      <Select
        size="small"
        displayEmpty
        value={item.condition || ''}
        disabled={saving}
        onChange={(e) => handleConditionChange(e.target.value)}
        renderValue={(val) => {
          if (!val) return <Typography variant="caption" color="text.disabled">Condition</Typography>;
          return (
            <Typography variant="caption" fontWeight={700} sx={{ color: condColor }}>
              {val}
            </Typography>
          );
        }}
        sx={{
          minWidth: 120,
          flexShrink: 0,
          fontSize: 12,
          '& .MuiOutlinedInput-notchedOutline': {
            borderColor: isDone ? alpha(condColor || theme.palette.success.main, 0.5) : undefined
          }
        }}
      >
        {CONDITION_OPTIONS.map((opt) => (
          <MenuItem key={opt.value} value={opt.value} sx={{ fontSize: 13 }}>
            <Stack direction="row" spacing={1} alignItems="center">
              <Typography variant="caption" fontWeight={800} sx={{ minWidth: 32, color: conditionThemeColor(opt.value, theme) || 'success.main' }}>
                {opt.value}
              </Typography>
              <Typography variant="caption" color="text.secondary">
                {opt.label.split('–')[1]?.trim()}
              </Typography>
            </Stack>
          </MenuItem>
        ))}
      </Select>

      {/* Delete button (custom items only) */}
      {!isDefault && (
        <Tooltip title="Remove item">
          <IconButton
            size="small"
            onClick={onDelete}
            sx={{ color: 'text.disabled', '&:hover': { color: 'error.main' }, flexShrink: 0 }}
          >
            <DeleteOutlined style={{ fontSize: 15 }} />
          </IconButton>
        </Tooltip>
      )}
    </Stack>
  );
}

// ─── Inspection Column ────────────────────────────────────────────────────────

function getItemComplete(item) {
  return !!(item?.condition || item?.isChecked || item?.IsChecked);
}

function getRoomProgress(items = []) {
  const total = items.length;
  const done = items.filter(getItemComplete).length;
  return { total, done, pct: total > 0 ? Math.round((done / total) * 100) : 0 };
}

function groupItemsByRoom(items = [], extraRooms = []) {
  const grouped = new Map();
  const ensureRoom = (roomName) => {
    const name = (roomName || 'General').trim() || 'General';
    if (!grouped.has(name)) grouped.set(name, []);
    return name;
  };

  extraRooms.forEach(ensureRoom);
  items
    .slice()
    .sort((a, b) => (a.sortOrder || 0) - (b.sortOrder || 0))
    .forEach((item) => grouped.get(ensureRoom(item.category)).push(item));

  return Array.from(grouped.entries()).map(([name, roomItems]) => ({ name, items: roomItems }));
}

function getChecklistRoomNames(checklist, extraRooms = []) {
  const names = [...(checklist?.roomNames || []), ...extraRooms, ...(checklist?.items || []).map((item) => item.category || 'General')];
  const seen = new Set();
  return names.reduce((result, value) => {
    const name = String(value || 'General').trim() || 'General';
    const key = name.toLowerCase();
    if (!seen.has(key)) {
      seen.add(key);
      result.push(name);
    }
    return result;
  }, []);
}

function renameRoomName(roomNames, currentName, nextName) {
  const currentKey = currentName.toLowerCase();
  return roomNames.map((name) => (name.toLowerCase() === currentKey ? nextName : name));
}

function RoomInspectionSection({ room, checklist, onAddItem, addingItem, draftValue, onDraftChange, onItemUpdated, onDeleteItem, onRenameRoom }) {
  const theme = useTheme();
  const [expanded, setExpanded] = useState(false);
  const [editingName, setEditingName] = useState(false);
  const [roomNameDraft, setRoomNameDraft] = useState(room.name);
  const [renaming, setRenaming] = useState(false);
  const progress = getRoomProgress(room.items);
  const complete = progress.total > 0 && progress.done === progress.total;
  const progressColor = complete ? theme.palette.success.main : progress.done > 0 ? theme.palette.primary.main : theme.palette.grey[400];

  useEffect(() => {
    if (!editingName) setRoomNameDraft(room.name);
  }, [editingName, room.name]);

  const cancelRename = () => {
    setRoomNameDraft(room.name);
    setEditingName(false);
  };

  const saveRename = async () => {
    const nextName = roomNameDraft.trim();
    if (!nextName || nextName === room.name) {
      cancelRename();
      return;
    }

    setRenaming(true);
    const renamed = await onRenameRoom(room.name, nextName);
    setRenaming(false);
    if (renamed) setEditingName(false);
  };

  return (
    <MainCard
      content={false}
      sx={{
        overflow: 'hidden',
        border: `1px solid ${alpha(progressColor, complete ? 0.28 : 0.18)}`,
        boxShadow: 'none',
        bgcolor: '#fff'
      }}
    >
      <Box
        role="button"
        tabIndex={0}
        aria-expanded={expanded}
        onClick={() => setExpanded((prev) => !prev)}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            setExpanded((prev) => !prev);
          }
        }}
        sx={{
          p: 2,
          bgcolor: alpha(progressColor, complete ? 0.08 : 0.04),
          borderBottom: `1px solid ${alpha(theme.palette.divider, 0.7)}`,
          cursor: 'pointer',
          '&:hover': { bgcolor: alpha(progressColor, complete ? 0.12 : 0.08) },
          '&:focus-visible': { outline: `2px solid ${alpha(progressColor, 0.45)}`, outlineOffset: -2 }
        }}
      >
        <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1.25} justifyContent="space-between" alignItems={{ xs: 'stretch', sm: 'center' }}>
          <Box sx={{ minWidth: 0 }}>
            <Stack direction="row" spacing={1} alignItems="center">
              <Tooltip title={expanded ? 'Hide items' : 'Show items'}>
                <IconButton
                  component="span"
                  size="small"
                  sx={{
                    width: 26,
                    height: 26,
                    border: `1px solid ${alpha(progressColor, 0.25)}`,
                    bgcolor: expanded ? alpha(progressColor, 0.1) : '#fff',
                    color: progressColor,
                    '&:hover': { bgcolor: alpha(progressColor, 0.14) }
                  }}
                >
                  {expanded ? <DownOutlined style={{ fontSize: 12 }} /> : <RightOutlined style={{ fontSize: 12 }} />}
                </IconButton>
              </Tooltip>
              {editingName ? (
                <TextField
                  size="small"
                  autoFocus
                  value={roomNameDraft}
                  disabled={renaming}
                  onClick={(e) => e.stopPropagation()}
                  onChange={(e) => setRoomNameDraft(e.target.value)}
                  onKeyDown={(e) => {
                    e.stopPropagation();
                    if (e.key === 'Enter') saveRename();
                    if (e.key === 'Escape') cancelRename();
                  }}
                  inputProps={{ 'aria-label': `Rename ${room.name}` }}
                  sx={{ width: { xs: 150, sm: 220 } }}
                />
              ) : (
                <Typography variant="subtitle1" fontWeight={800}>{room.name}</Typography>
              )}
              {editingName ? (
                <Stack direction="row" spacing={0.25}>
                  <Tooltip title="Save room name">
                    <span>
                      <IconButton
                        size="small"
                        disabled={renaming || !roomNameDraft.trim()}
                        onClick={(e) => { e.stopPropagation(); saveRename(); }}
                        sx={{ color: 'success.main' }}
                      >
                        {renaming ? <CircularProgress size={14} /> : <CheckOutlined style={{ fontSize: 14 }} />}
                      </IconButton>
                    </span>
                  </Tooltip>
                  <Tooltip title="Cancel">
                    <IconButton size="small" disabled={renaming} onClick={(e) => { e.stopPropagation(); cancelRename(); }}>
                      <CloseOutlined style={{ fontSize: 13 }} />
                    </IconButton>
                  </Tooltip>
                </Stack>
              ) : (
                <Tooltip title="Rename room">
                  <IconButton
                    size="small"
                    aria-label={`Rename ${room.name}`}
                    onClick={(e) => {
                      e.stopPropagation();
                      setRoomNameDraft(room.name);
                      setEditingName(true);
                    }}
                    sx={{ color: 'text.secondary' }}
                  >
                    <EditOutlined style={{ fontSize: 14 }} />
                  </IconButton>
                </Tooltip>
              )}
              <Chip label={`${progress.done} / ${progress.total}`} size="small" color={complete ? 'success' : progress.done > 0 ? 'primary' : 'default'} variant={complete ? 'filled' : 'outlined'} sx={{ height: 22, fontWeight: 700 }} />
            </Stack>
            <Typography variant="caption" color="text.secondary">
              {progress.total === 0 ? 'No items yet' : `${progress.done} of ${progress.total} room items complete`}
            </Typography>
          </Box>

          {progress.total > 0 && (
            <Box sx={{ width: { xs: '100%', sm: 180 } }}>
              <Stack direction="row" justifyContent="space-between" sx={{ mb: 0.4 }}>
                <Typography variant="caption" color="text.secondary">Room progress</Typography>
                <Typography variant="caption" fontWeight={700} sx={{ color: progressColor }}>{progress.pct}%</Typography>
              </Stack>
              <LinearProgress
                variant="determinate"
                value={progress.pct}
                sx={{ height: 6, borderRadius: 1, bgcolor: alpha(progressColor, 0.12), '& .MuiLinearProgress-bar': { bgcolor: progressColor, borderRadius: 1 } }}
              />
            </Box>
          )}
        </Stack>
      </Box>

      <Collapse in={expanded} timeout="auto" unmountOnExit>
        <Box sx={{ px: 2, py: 1 }}>
          {room.items.length === 0 ? (
            <Box sx={{ py: 2.5, textAlign: 'center' }}>
              <Typography variant="body2" color="text.secondary">Add the first checklist item for this room.</Typography>
            </Box>
          ) : (
            <Stack divider={<Divider sx={{ opacity: 0.45 }} />}>
              {room.items.map((item) => (
                <InspectionItemRow
                  key={item.id}
                  item={item}
                  checklistId={checklist.id}
                  allItems={checklist.items}
                  onUpdated={onItemUpdated}
                  isDefault={item.sortOrder < 1000}
                  onDelete={() => onDeleteItem(item)}
                />
              ))}
            </Stack>
          )}
        </Box>

        <Box sx={{ px: 2, pb: 2, pt: room.items.length === 0 ? 0 : 1 }}>
          <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1}>
            <TextField
              size="small"
              fullWidth
              placeholder={`Add item to ${room.name}…`}
              value={draftValue || ''}
              onChange={(e) => onDraftChange(room.name, e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter') onAddItem(room.name); }}
              disabled={addingItem}
            />
            <Button
              variant="outlined"
              size="small"
              onClick={() => onAddItem(room.name)}
              disabled={!String(draftValue || '').trim() || addingItem}
              startIcon={addingItem ? <CircularProgress size={13} /> : <PlusOutlined />}
              sx={{ flexShrink: 0, textTransform: 'none', borderRadius: 1.5, px: 2 }}
            >
              Add Item
            </Button>
          </Stack>
        </Box>
      </Collapse>
    </MainCard>
  );
}

function InspectionColumn({ type, checklist, counterpartChecklist, propertyId, unitId, propertyName, unitName, onRefresh, onDeleted }) {
  const theme = useTheme();
  const [starting, setStarting] = useState(false);
  const [newRoomName, setNewRoomName] = useState('');
  const [customRooms, setCustomRooms] = useState([]);
  const [itemDrafts, setItemDrafts] = useState({});
  const [addingRoom, setAddingRoom] = useState(false);
  const [addingItemRoom, setAddingItemRoom] = useState(null);
  const [scheduledAt, setScheduledAt] = useState('');
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [deletingInspection, setDeletingInspection] = useState(false);

  const isMovein = type === MOVE_IN;
  const label = isMovein ? 'Move-In' : 'Move-Out';
  const accentColor = isMovein ? theme.palette.info.main : theme.palette.warning.main;
  const accentLight = isMovein ? theme.palette.info.lighter : alpha(theme.palette.warning.main, 0.08);

  const roomSections = checklist ? groupItemsByRoom(checklist.items || [], [...(checklist.roomNames || []), ...customRooms]) : [];

  useEffect(() => {
    setCustomRooms(checklist?.roomNames || []);
  }, [checklist?.id, checklist?.roomNames]);

  const progress = checklist
    ? (() => {
        const items = checklist.items || [];
        const total = items.length;
        const done = items.filter(getItemComplete).length;
        return { total, done, pct: total > 0 ? Math.round((done / total) * 100) : 0 };
      })()
    : null;


  const handleDeleteInspection = async () => {
    if (!checklist) return;
    setDeletingInspection(true);
    try {
      const res = await checklistAPI.deleteChecklist(checklist.id);
      if (!res?.success) throw new Error(res?.message || 'Failed to delete checklist');
      setDeleteOpen(false);
      onDeleted?.(type);
      openSnackbar({ open: true, message: `${label} checklist deleted`, variant: 'alert', alert: { color: 'success' } });
    } catch (err) {
      openSnackbar({ open: true, message: err.message || 'Failed to delete checklist', variant: 'alert', alert: { color: 'error' } });
    } finally {
      setDeletingInspection(false);
    }
  };

  const handleStart = async () => {
    setStarting(true);
    try {
      let sort = 0;
      const defaultItems = DEFAULT_INSPECTION_ITEMS.flatMap(({ category, names }) =>
        names.map((name) => ({
          Name: name,
          Category: category,
          SortOrder: sort++,
          IsChecked: false
        }))
      );

      const counterpartItems = counterpartChecklist?.items || [];
      const initialItems = counterpartItems.length > 0
        ? counterpartItems.map((item) => ({
            Name: item.name,
            Category: item.category || 'General',
            SortOrder: item.sortOrder || 0,
            IsChecked: false
          }))
        : defaultItems;
      const initialRoomNames = counterpartChecklist
        ? getChecklistRoomNames(counterpartChecklist)
        : getChecklistRoomNames({ items: initialItems });

      const propLabel = propertyName || 'Property';
      const unitLabel = unitName ? ` – ${unitName}` : '';
      const title = `${propLabel}${unitLabel} – ${label} Checklist`;

      const payload = {
        ChecklistType: type,
        PropertyId: parseInt(propertyId),
        UnitId: unitId ? parseInt(unitId) : null,
        CounterpartChecklistId: counterpartChecklist?.id || null,
        Title: title,
        InspectionDate: fromDateTimeLocalValue(scheduledAt),
        RoomNames: initialRoomNames,
        Items: initialItems
      };

      const res = await checklistAPI.addChecklist(payload);
      if (!res?.success) throw new Error(res?.message || 'Failed to create checklist');
      if (counterpartChecklist && res.data?.id) {
        const counterpartRes = await checklistAPI.updateChecklist(counterpartChecklist.id, {
          Id: counterpartChecklist.id,
          CounterpartChecklistId: res.data.id
        });
        if (!counterpartRes?.success) throw new Error(counterpartRes?.message || 'Failed to connect checklists');
        onRefresh(counterpartRes.data);
      }
      openSnackbar({ open: true, message: `${label} checklist started`, variant: 'alert', alert: { color: 'success' } });
      onRefresh(res.data);
    } catch (err) {
      openSnackbar({ open: true, message: err.message || 'Failed to start checklist', variant: 'alert', alert: { color: 'error' } });
    } finally {
      setStarting(false);
    }
  };

  const handleAddRoom = async () => {
    const roomName = newRoomName.trim();
    if (!roomName || !checklist) return;
    const existingRooms = getChecklistRoomNames(checklist, customRooms).map((name) => name.toLowerCase());
    if (existingRooms.includes(roomName.toLowerCase())) {
      openSnackbar({ open: true, message: 'That room already exists', variant: 'alert', alert: { color: 'warning' } });
      return;
    }

    setAddingRoom(true);
    try {
      const updates = [
        checklistAPI.updateChecklist(checklist.id, {
          Id: checklist.id,
          ...(counterpartChecklist ? { CounterpartChecklistId: counterpartChecklist.id } : {}),
          RoomNames: [...getChecklistRoomNames(checklist, customRooms), roomName]
        })
      ];
      if (counterpartChecklist) {
        const counterpartRooms = getChecklistRoomNames(counterpartChecklist);
        const counterpartHasRoom = counterpartRooms.some((name) => name.toLowerCase() === roomName.toLowerCase());
        updates.push(checklistAPI.updateChecklist(counterpartChecklist.id, {
          Id: counterpartChecklist.id,
          CounterpartChecklistId: checklist.id,
          RoomNames: counterpartHasRoom ? counterpartRooms : [...counterpartRooms, roomName]
        }));
      }

      const responses = await Promise.all(updates);
      responses.forEach((res) => {
        if (!res?.success) throw new Error(res?.message || 'Failed to add room');
        onRefresh(res.data);
      });
      setItemDrafts((prev) => ({ ...prev, [roomName]: '' }));
      setNewRoomName('');
      openSnackbar({
        open: true,
        message: counterpartChecklist ? 'Room added to move-in and move-out' : 'Room added',
        variant: 'alert',
        alert: { color: 'success' }
      });
    } catch (err) {
      openSnackbar({ open: true, message: err.message || 'Failed to add room', variant: 'alert', alert: { color: 'error' } });
    } finally {
      setAddingRoom(false);
    }
  };

  const handleAddItem = async (roomName) => {
    const itemName = String(itemDrafts[roomName] || '').trim();
    if (!itemName || !checklist) return;
    setAddingItemRoom(roomName);
    try {
      const maxSort = checklist.items?.length > 0 ? Math.max(...checklist.items.map((i) => i.sortOrder || 0)) : 999;
      const newSort = Math.max(maxSort + 1, 1000);
      const updatedItems = [
        ...(checklist.items || []).map(toItemDto),
        { Name: itemName, Category: roomName, SortOrder: newSort, IsChecked: false, Condition: null }
      ];
      const res = await checklistAPI.updateChecklist(checklist.id, { Id: checklist.id, Items: updatedItems });
      if (!res?.success) throw new Error(res?.message || 'Failed to add item');
      setItemDrafts((prev) => ({ ...prev, [roomName]: '' }));
      setCustomRooms((prev) => prev.filter((name) => name.toLowerCase() !== roomName.toLowerCase()));
      onRefresh(res.data);
    } catch (err) {
      openSnackbar({ open: true, message: err.message || 'Failed to add item', variant: 'alert', alert: { color: 'error' } });
    } finally {
      setAddingItemRoom(null);
    }
  };

  const handleRenameRoom = async (currentName, nextName) => {
    if (!checklist) return false;

    const normalizedNextName = nextName.trim();
    const roomNames = getChecklistRoomNames(checklist, customRooms);
    const duplicateRoom = roomNames.some(
      (roomName) => roomName.toLowerCase() !== currentName.toLowerCase() && roomName.toLowerCase() === normalizedNextName.toLowerCase()
    );

    if (duplicateRoom) {
      openSnackbar({ open: true, message: 'That room already exists', variant: 'alert', alert: { color: 'warning' } });
      return false;
    }

    const roomItems = (checklist.items || []).filter((item) => {
      const itemRoom = (item.category || 'General').trim() || 'General';
      return itemRoom.toLowerCase() === currentName.toLowerCase();
    });

    try {
      const updatedItems = (checklist.items || []).map((item) => ({
        ...toItemDto(item),
        Category: ((item.category || 'General').trim() || 'General').toLowerCase() === currentName.toLowerCase()
          ? normalizedNextName
          : (item.category || null)
      }));
      const updates = [checklistAPI.updateChecklist(checklist.id, {
        Id: checklist.id,
        ...(counterpartChecklist ? { CounterpartChecklistId: counterpartChecklist.id } : {}),
        RoomNames: renameRoomName(roomNames, currentName, normalizedNextName),
        ...(roomItems.length > 0 ? { Items: updatedItems } : {})
      })];

      if (counterpartChecklist) {
        const counterpartRoomNames = getChecklistRoomNames(counterpartChecklist);
        const counterpartHasCurrent = counterpartRoomNames.some((name) => name.toLowerCase() === currentName.toLowerCase());
        const counterpartHasNext = counterpartRoomNames.some((name) => name.toLowerCase() === normalizedNextName.toLowerCase());
        if (counterpartHasCurrent && counterpartHasNext) {
          openSnackbar({
            open: true,
            message: 'That room already exists in the connected checklist',
            variant: 'alert',
            alert: { color: 'warning' }
          });
          return false;
        }
        if (counterpartHasCurrent) {
          const counterpartItems = (counterpartChecklist.items || []).map((item) => ({
            ...toItemDto(item),
            Category: ((item.category || 'General').trim() || 'General').toLowerCase() === currentName.toLowerCase()
              ? normalizedNextName
              : (item.category || null)
          }));
          updates.push(checklistAPI.updateChecklist(counterpartChecklist.id, {
            Id: counterpartChecklist.id,
            CounterpartChecklistId: checklist.id,
            RoomNames: renameRoomName(counterpartRoomNames, currentName, normalizedNextName),
            Items: counterpartItems
          }));
        } else {
          updates.push(checklistAPI.updateChecklist(counterpartChecklist.id, {
            Id: counterpartChecklist.id,
            CounterpartChecklistId: checklist.id,
            RoomNames: [...counterpartRoomNames, normalizedNextName]
          }));
        }
      }

      const responses = await Promise.all(updates);
      responses.forEach((res) => {
        if (!res?.success) throw new Error(res?.message || 'Failed to rename room');
        onRefresh(res.data);
      });

      setCustomRooms((prev) => renameRoomName(prev, currentName, normalizedNextName));
      setItemDrafts((prev) => {
        const nextDrafts = { ...prev, [normalizedNextName]: prev[currentName] || '' };
        delete nextDrafts[currentName];
        return nextDrafts;
      });
      openSnackbar({
        open: true,
        message: counterpartChecklist ? 'Room renamed in move-in and move-out' : 'Room renamed',
        variant: 'alert',
        alert: { color: 'success' }
      });
      return true;
    } catch (err) {
      openSnackbar({ open: true, message: err.message || 'Failed to rename room', variant: 'alert', alert: { color: 'error' } });
      return false;
    }
  };

  const handleDeleteItem = async (itemToDelete) => {
    if (!checklist) return;
    try {
      const updatedItems = (checklist.items || []).filter((i) => i.id !== itemToDelete.id).map(toItemDto);
      const res = await checklistAPI.updateChecklist(checklist.id, { Id: checklist.id, Items: updatedItems });
      if (!res?.success) throw new Error(res?.message || 'Failed to delete item');
      onRefresh(res.data);
    } catch (err) {
      openSnackbar({ open: true, message: err.message || 'Failed to delete item', variant: 'alert', alert: { color: 'error' } });
    }
  };

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      {/* Checklist summary and room controls */}
      <Box
        sx={{
          px: 3,
          py: 2.5,
          bgcolor: accentLight,
          borderBottom: `2px solid ${alpha(accentColor, 0.25)}`,
          borderRadius: '12px 12px 0 0'
        }}
      >
        <Grid container spacing={2} alignItems="stretch">
          <Grid size={{ xs: 12, md: checklist ? 7.5 : 12 }}>
            <Stack direction="row" justifyContent="space-between" alignItems="flex-start">
              <Box>
                <Typography variant="h6" fontWeight={700} sx={{ color: accentColor }}>
                  {label} Checklist
                </Typography>
                {checklist?.inspectionDate && (
                  <Typography variant="caption" color="text.secondary">
                    {formatDate(checklist.inspectionDate)}
                  </Typography>
                )}
              </Box>
              {checklist && (
                <Stack direction="row" spacing={1} alignItems="center">
                  <Chip
                    label={`${progress?.done || 0} / ${progress?.total || 0}`}
                    size="small"
                    sx={{
                      bgcolor: progress?.total > 0 && progress.done === progress.total
                        ? alpha(theme.palette.success.main, 0.12)
                        : progress?.pct === 0
                        ? alpha(theme.palette.grey[400], 0.15)
                        : alpha(accentColor, 0.12),
                      color: progress?.total > 0 && progress.done === progress.total ? 'success.main' : progress?.pct === 0 ? 'text.secondary' : accentColor,
                      fontWeight: 700
                    }}
                  />
                  <Tooltip title="Delete checklist">
                    <IconButton size="small" color="error" onClick={() => setDeleteOpen(true)} sx={{ border: `1px solid ${alpha(theme.palette.error.main, 0.25)}` }}>
                      <DeleteOutlined style={{ fontSize: 14 }} />
                    </IconButton>
                  </Tooltip>
                </Stack>
              )}
            </Stack>

            {checklist && progress && progress.total > 0 && (
              <Box sx={{ mt: 1.5 }}>
                <Stack direction="row" justifyContent="space-between" sx={{ mb: 0.5 }}>
                  <Typography variant="caption" color="text.secondary">
                    {progress.done} of {progress.total} items completed
                  </Typography>
                  <Typography variant="caption" fontWeight={600} sx={{ color: accentColor }}>
                    {progress.pct}%
                  </Typography>
                </Stack>
                <LinearProgress
                  variant="determinate"
                  value={progress.pct}
                  sx={{
                    height: 6,
                    borderRadius: 1,
                    bgcolor: alpha(accentColor, 0.12),
                    '& .MuiLinearProgress-bar': { bgcolor: accentColor, borderRadius: 1 }
                  }}
                />
              </Box>
            )}
          </Grid>

          {checklist && (
            <Grid size={{ xs: 12, md: 4.5 }}>
              <MainCard
                content={false}
                sx={{
                  height: '100%',
                  border: `1px dashed ${alpha(accentColor, 0.38)}`,
                  bgcolor: alpha(accentColor, 0.025),
                  boxShadow: 'none'
                }}
              >
                <Box sx={{ p: 1.75 }}>
                  <Typography variant="subtitle2" fontWeight={800}>Rooms</Typography>
                  <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 0.25, mb: 1.25, lineHeight: 1.4 }}>
                    Add another room and then add its checklist items below.
                  </Typography>
                  <Stack direction="row" spacing={1}>
                    <TextField
                      size="small"
                      fullWidth
                      placeholder="e.g. Basement"
                      value={newRoomName}
                      onChange={(e) => setNewRoomName(e.target.value)}
                      onKeyDown={(e) => { if (e.key === 'Enter') handleAddRoom(); }}
                      disabled={addingRoom}
                    />
                    <Button
                      variant="contained"
                      size="small"
                      onClick={handleAddRoom}
                      disabled={!newRoomName.trim() || addingRoom}
                      startIcon={addingRoom ? <CircularProgress size={13} color="inherit" /> : <PlusOutlined />}
                      sx={{ flexShrink: 0, textTransform: 'none', borderRadius: 1.5, px: 1.5, bgcolor: accentColor, '&:hover': { bgcolor: alpha(accentColor, 0.85) } }}
                    >
                      Add Room
                    </Button>
                  </Stack>
                </Box>
              </MainCard>
            </Grid>
          )}
        </Grid>
      </Box>

      {/* Column body */}
      <Box sx={{ flex: 1, px: 3, py: 2, overflowY: 'auto' }}>
        {!checklist ? (
          // Empty state
          <Box sx={{ textAlign: 'center', py: 8 }}>
            <Box
              sx={{
                width: 56, height: 56, borderRadius: '50%',
                bgcolor: alpha(accentColor, 0.1),
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                mx: 'auto', mb: 2
              }}
            >
              <AuditOutlined style={{ fontSize: 26, color: accentColor }} />
            </Box>
            <Typography variant="body2" color="text.secondary" sx={{ mb: 2.5 }}>
              No {label.toLowerCase()} checklist has been started yet.
            </Typography>
            <Box sx={{ maxWidth: 320, mx: 'auto', mb: 2 }}>
              <TextField
                type="datetime-local"
                size="small"
                label="Schedule for"
                value={scheduledAt}
                onChange={(e) => setScheduledAt(e.target.value)}
                InputLabelProps={{ shrink: true }}
                fullWidth
                helperText="Optional — leave blank to start now"
              />
            </Box>
            <Button
              variant="contained"
              startIcon={starting ? <CircularProgress size={14} color="inherit" /> : <PlusOutlined />}
              onClick={handleStart}
              disabled={starting}
              sx={{
                textTransform: 'none',
                fontWeight: 600,
                bgcolor: accentColor,
                '&:hover': { bgcolor: alpha(accentColor, 0.85) }
              }}
            >
              {starting ? 'Starting…' : `Start ${label} Checklist`}
            </Button>
          </Box>
        ) : (
          <Stack spacing={2.25}>
            <KeyLegend />

            {/* Rooms + items */}
            {roomSections.length === 0 ? (
              <Box sx={{ textAlign: 'center', py: 4 }}>
                <Typography variant="body2" color="text.secondary">No rooms in this checklist yet.</Typography>
              </Box>
            ) : (
              <Stack spacing={2}>
                {roomSections.map((room) => (
                  <RoomInspectionSection
                    key={room.name}
                    room={room}
                    checklist={checklist}
                    onAddItem={handleAddItem}
                    addingItem={addingItemRoom === room.name}
                    draftValue={itemDrafts[room.name] || ''}
                    onDraftChange={(roomName, value) => setItemDrafts((prev) => ({ ...prev, [roomName]: value }))}
                    onItemUpdated={onRefresh}
                    onDeleteItem={handleDeleteItem}
                    onRenameRoom={handleRenameRoom}
                  />
                ))}
              </Stack>
            )}
          </Stack>
        )}
      </Box>

      <Dialog open={deleteOpen} onClose={() => setDeleteOpen(false)} maxWidth="xs" fullWidth PaperProps={{ sx: { borderRadius: 2 } }}>
        <DialogTitle>Delete {label.toLowerCase()} checklist?</DialogTitle>
        <DialogContent>
          <Typography variant="body2" color="text.secondary">
            This will permanently delete this checklist and its checklist items. This cannot be undone.
          </Typography>
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2.5 }}>
          <Button onClick={() => setDeleteOpen(false)} disabled={deletingInspection} sx={{ textTransform: 'none' }}>
            Cancel
          </Button>
          <Button
            variant="contained"
            color="error"
            onClick={handleDeleteInspection}
            disabled={deletingInspection}
            startIcon={deletingInspection ? <CircularProgress size={13} color="inherit" /> : <DeleteOutlined />}
            sx={{ textTransform: 'none', borderRadius: 1.5 }}
          >
            {deletingInspection ? 'Deleting…' : 'Delete Checklist'}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}

function ChecklistOverviewColumn({ title, checklists, accentColor, emptyText, onOpen, onCreate }) {
  const theme = useTheme();

  return (
    <MainCard
      content={false}
      sx={{
        height: '100%',
        overflow: 'hidden',
        border: `1px solid ${alpha(accentColor, 0.22)}`,
        boxShadow: `0 8px 24px ${alpha(accentColor, 0.08)}`
      }}
    >
      <Box sx={{ px: 2.5, py: 2.25, bgcolor: alpha(accentColor, 0.07), borderBottom: `1px solid ${alpha(accentColor, 0.18)}` }}>
        <Stack direction="row" justifyContent="space-between" alignItems="center">
          <Stack direction="row" spacing={1} alignItems="center">
            <Box sx={{ width: 9, height: 9, borderRadius: '50%', bgcolor: accentColor }} />
            <Typography variant="h5" fontWeight={700}>{title}</Typography>
          </Stack>
          <Chip label={checklists.length} size="small" sx={{ bgcolor: alpha(accentColor, 0.12), color: accentColor, fontWeight: 700 }} />
        </Stack>
      </Box>

      {checklists.length === 0 ? (
        <Box sx={{ px: 3, py: 8, textAlign: 'center' }}>
          <AuditOutlined style={{ fontSize: 34, color: alpha(accentColor, 0.45) }} />
          <Typography variant="body2" color="text.secondary" sx={{ mt: 1.5 }}>{emptyText}</Typography>
          <Button
            variant="outlined"
            size="small"
            startIcon={<PlusOutlined />}
            onClick={onCreate}
            sx={{ mt: 2, textTransform: 'none', borderColor: alpha(accentColor, 0.5), color: accentColor }}
          >
            Start Checklist
          </Button>
        </Box>
      ) : (
        <Stack divider={<Divider />}>
          {checklists.map((checklist) => {
            const items = checklist.items || [];
            const completed = items.filter(getItemComplete).length;
            const progress = items.length > 0 ? Math.round((completed / items.length) * 100) : 0;
            const complete = checklist.isCompleted || (items.length > 0 && completed === items.length);

            return (
              <Button
                key={checklist.id}
                color="inherit"
                onClick={() => onOpen(checklist)}
                sx={{
                  display: 'block',
                  width: '100%',
                  px: 2.5,
                  py: 2,
                  borderRadius: 0,
                  textTransform: 'none',
                  textAlign: 'left',
                  '&:hover': { bgcolor: alpha(accentColor, 0.045) }
                }}
              >
                <Stack direction="row" spacing={2} alignItems="center">
                  <Box sx={{ flex: 1, minWidth: 0 }}>
                    <Typography variant="subtitle1" fontWeight={700} noWrap>
                      {checklist.title || title.replace(/s$/, '')}
                    </Typography>
                    <Stack direction="row" spacing={1.25} alignItems="center" sx={{ mt: 0.6 }}>
                      <Stack direction="row" spacing={0.6} alignItems="center">
                        <CalendarOutlined style={{ fontSize: 12, color: theme.palette.text.secondary }} />
                        <Typography variant="caption" color="text.secondary">
                          {checklist.inspectionDate ? formatDate(checklist.inspectionDate) : 'No date'}
                        </Typography>
                      </Stack>
                      <Chip
                        label={complete ? 'Complete' : progress > 0 ? `${progress}% complete` : 'Not started'}
                        size="small"
                        color={complete ? 'success' : progress > 0 ? 'warning' : 'default'}
                        variant={complete || progress > 0 ? 'filled' : 'outlined'}
                        sx={{ height: 21, fontSize: 10.5 }}
                      />
                    </Stack>
                  </Box>
                  <RightOutlined style={{ fontSize: 13, color: theme.palette.text.secondary }} />
                </Stack>
              </Button>
            );
          })}
        </Stack>
      )}
    </MainCard>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function PropertyChecklistsPage() {
  const { propertyId, unitId, checklistId } = useParams();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const theme = useTheme();

  const properties = useSelector(selectProperties);
  useFetchProperties(); // ensure properties are in Redux

  // The type query is used when opening a not-yet-created checklist.
  const typeParam = searchParams.get('type');

  const [checklists, setChecklists] = useState([]);
  const [moveInChecklist, setMoveInChecklist] = useState(null);
  const [moveOutChecklist, setMoveOutChecklist] = useState(null);
  const [loading, setLoading] = useState(true);
  const [unitName, setUnitName] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    try {
      let checklists = [];

      if (unitId) {
        try {
          const unitRes = await axiosServices.get(`/api/unit/${propertyId}`);
          const units = unitRes.data?.data || [];
          const unit = units.find((u) => String(u.id) === String(unitId));
          if (unit) setUnitName(unit.name || `Unit ${unitId}`);
        } catch {
          // ignore
        }
        const res = await checklistAPI.getChecklistsByUnit(unitId);
        checklists = res?.success ? res.data || [] : [];
      } else {
        const res = await checklistAPI.getChecklistsByProperty(propertyId);
        checklists = res?.success ? res.data || [] : [];
      }

      const moveIn = checklists.find((c) => isMoveInChecklist(c)) || null;
      const moveOut = checklists.find((c) => isMoveOutChecklist(c)) || null;

      setChecklists(checklists);
      setMoveInChecklist(moveIn);
      setMoveOutChecklist(moveOut);
    } catch {
      openSnackbar({ open: true, message: 'Failed to load checklist', variant: 'alert', alert: { color: 'error' } });
    } finally {
      setLoading(false);
    }
  }, [propertyId, unitId]);

  useEffect(() => {
    load();
  }, [load]);

  const handleChecklistUpdated = useCallback((updatedChecklist) => {
    if (!updatedChecklist) { load(); return; }
    setChecklists((current) => {
      const exists = current.some((checklist) => String(checklist.id) === String(updatedChecklist.id));
      return exists
        ? current.map((checklist) => String(checklist.id) === String(updatedChecklist.id) ? updatedChecklist : checklist)
        : [updatedChecklist, ...current];
    });
    if (isMoveInChecklist(updatedChecklist)) {
      setMoveInChecklist(updatedChecklist);
    } else {
      setMoveOutChecklist(updatedChecklist);
    }
  }, [load]);

  const handleChecklistDeleted = useCallback((deletedType) => {
    setChecklists((current) => current.filter((checklist) => String(checklist.id) !== String(checklistId)));
    if (deletedType === MOVE_IN) {
      setMoveInChecklist(null);
    } else {
      setMoveOutChecklist(null);
    }
    navigate(unitId ? `/landlord/checklists/property/${propertyId}/unit/${unitId}` : `/landlord/checklists/property/${propertyId}`);
  }, [checklistId, navigate, propertyId, unitId]);

  // Derive property name from Redux (falls back to streetAddress when no name is set)
  const propFromRedux = properties?.find((p) => String(p.id) === String(propertyId));
  const displayPropertyName = propFromRedux?.name || propFromRedux?.streetAddress || `Property ${propertyId}`;
  const displayUnitName = unitName || (unitId ? `Unit ${unitId}` : '');

  const breadcrumbLabel = displayUnitName ? `${displayPropertyName} – ${displayUnitName}` : displayPropertyName;
  const overviewPath = unitId
    ? `/landlord/checklists/property/${propertyId}/unit/${unitId}`
    : `/landlord/checklists/property/${propertyId}`;
  const selectedChecklist = checklistId
    ? checklists.find((checklist) => String(checklist.id) === String(checklistId)) || null
    : null;
  const activeType = selectedChecklist
    ? (isMoveOutChecklist(selectedChecklist) ? MOVE_OUT : MOVE_IN)
    : typeParam === 'move-out'
    ? MOVE_OUT
    : typeParam === 'move-in'
    ? MOVE_IN
    : null;
  const activeChecklist = selectedChecklist || (activeType === MOVE_IN ? moveInChecklist : activeType === MOVE_OUT ? moveOutChecklist : null);
  const counterpartCandidates = checklists.filter(activeType === MOVE_IN ? isMoveOutChecklist : isMoveInChecklist);
  const counterpartChecklist = activeChecklist?.counterpartChecklistId
    ? counterpartCandidates.find((candidate) => String(candidate.id) === String(activeChecklist.counterpartChecklistId)) || null
    : activeChecklist?.leaseId
      ? counterpartCandidates.find((candidate) => String(candidate.leaseId) === String(activeChecklist.leaseId)) || counterpartCandidates[0] || null
      : counterpartCandidates[0] || null;
  const moveInChecklists = checklists
    .filter(isMoveInChecklist)
    .sort((a, b) => new Date(b.inspectionDate || 0) - new Date(a.inspectionDate || 0));
  const moveOutChecklists = checklists
    .filter(isMoveOutChecklist)
    .sort((a, b) => new Date(b.inspectionDate || 0) - new Date(a.inspectionDate || 0));

  const openChecklist = (checklist) => {
    navigate(`${overviewPath}/checklist/${checklist.id}`);
  };

  return (
    <Box>
      <PageBreadcrumbs
        items={[
          { label: 'Dashboard', path: '/landlord/dashboard' },
          { label: 'Checklists', path: '/landlord/checklists' },
          { label: breadcrumbLabel, path: activeType ? overviewPath : undefined },
          ...(activeType ? [{ label: activeType === MOVE_IN ? 'Move-In Checklist' : 'Move-Out Checklist' }] : [])
        ]}
      />

      {/* Header */}
      <Stack direction={{ xs: 'column', md: 'row' }} justifyContent="space-between" alignItems={{ xs: 'stretch', md: 'center' }} spacing={2} sx={{ mb: 3 }}>
        <Stack direction="row" spacing={1.5} alignItems="center">
          <IconButton size="small" onClick={() => navigate(activeType ? overviewPath : '/landlord/checklists')} sx={{ border: `1px solid ${theme.palette.divider}` }}>
            <ArrowLeftOutlined style={{ fontSize: 14 }} />
          </IconButton>
          <Box>
            <Stack direction="row" spacing={1} alignItems="center">
              <HomeOutlined style={{ fontSize: 16, color: theme.palette.primary.main }} />
              <Typography variant="h5" fontWeight={700}>{displayPropertyName}</Typography>
              {displayUnitName && (
                <Chip label={displayUnitName} size="small" color="primary" variant="outlined" sx={{ height: 22, fontSize: 12 }} />
              )}
            </Stack>
            <Typography variant="body2" color="text.secondary" sx={{ mt: 0.25 }}>
              {activeType === MOVE_IN ? 'Move-In Checklist' : activeType === MOVE_OUT ? 'Move-Out Checklist' : 'Move-in checklists on the left and move-out checklists on the right'}
            </Typography>
          </Box>
        </Stack>
        {activeChecklist && (
          <ScheduleVisitControl
            checklist={activeChecklist}
            label={activeType === MOVE_IN ? 'Move-In' : 'Move-Out'}
            onRefresh={handleChecklistUpdated}
          />
        )}
      </Stack>

      {loading ? (
        <Box sx={{ display: 'flex', justifyContent: 'center', py: 12 }}>
          <CircularProgress />
        </Box>
      ) : activeType ? (
        // Single-type view (move-in OR move-out)
        <MainCard
          sx={{
            p: 0, overflow: 'hidden',
            border: `1px solid ${alpha(activeType === MOVE_IN ? theme.palette.info.main : theme.palette.warning.main, 0.2)}`,
            boxShadow: `0 0 24px ${alpha(activeType === MOVE_IN ? theme.palette.info.main : theme.palette.warning.main, 0.08)}`,
            display: 'flex', flexDirection: 'column'
          }}
        >
          <InspectionColumn
            type={activeType}
            checklist={activeChecklist}
            counterpartChecklist={counterpartChecklist}
            propertyId={propertyId}
            unitId={unitId}
            propertyName={displayPropertyName}
            unitName={displayUnitName}
            onRefresh={handleChecklistUpdated}
            onDeleted={handleChecklistDeleted}
          />
        </MainCard>
      ) : (
        // Property/unit overview with move-in on the left and move-out on the right.
        <Grid container spacing={2.5}>
          <Grid size={{ xs: 12, md: 6 }}>
            <ChecklistOverviewColumn
              title="Move-In Checklists"
              checklists={moveInChecklists}
              accentColor={theme.palette.info.main}
              emptyText="No move-in checklists for this property yet."
              onOpen={openChecklist}
              onCreate={() => navigate(`${overviewPath}?type=move-in`)}
            />
          </Grid>
          <Grid size={{ xs: 12, md: 6 }}>
            <ChecklistOverviewColumn
              title="Move-Out Checklists"
              checklists={moveOutChecklists}
              accentColor={theme.palette.warning.main}
              emptyText="No move-out checklists for this property yet."
              onOpen={openChecklist}
              onCreate={() => navigate(`${overviewPath}?type=move-out`)}
            />
          </Grid>
        </Grid>
      )}
    </Box>
  );
}
