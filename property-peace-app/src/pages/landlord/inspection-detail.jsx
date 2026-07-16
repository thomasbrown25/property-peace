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
  SaveOutlined
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

// Key legend shown at top of each inspection column
function KeyLegend() {
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
    <Box sx={{ mb: 2, p: 1.5, borderRadius: 1.5, bgcolor: alpha(theme.palette.primary.main, 0.03), border: `1px solid ${alpha(theme.palette.divider, 0.7)}` }}>
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

function RoomInspectionSection({ room, checklist, onAddItem, addingItem, draftValue, onDraftChange, onItemUpdated, onDeleteItem }) {
  const theme = useTheme();
  const [expanded, setExpanded] = useState(false);
  const progress = getRoomProgress(room.items);
  const complete = progress.total > 0 && progress.done === progress.total;
  const progressColor = complete ? theme.palette.success.main : progress.done > 0 ? theme.palette.primary.main : theme.palette.grey[400];

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
              <Typography variant="subtitle1" fontWeight={800}>{room.name}</Typography>
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
              <Typography variant="body2" color="text.secondary">Add the first inspection item for this room.</Typography>
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

function InspectionColumn({ type, checklist, propertyId, unitId, propertyName, unitName, onRefresh, onDeleted }) {
  const theme = useTheme();
  const [starting, setStarting] = useState(false);
  const [newRoomName, setNewRoomName] = useState('');
  const [customRooms, setCustomRooms] = useState([]);
  const [itemDrafts, setItemDrafts] = useState({});
  const [addingRoom, setAddingRoom] = useState(false);
  const [addingItemRoom, setAddingItemRoom] = useState(null);
  const [scheduledAt, setScheduledAt] = useState('');
  const [savingSchedule, setSavingSchedule] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [deletingInspection, setDeletingInspection] = useState(false);

  const isMovein = type === MOVE_IN;
  const label = isMovein ? 'Move-In' : 'Move-Out';
  const accentColor = isMovein ? theme.palette.info.main : theme.palette.warning.main;
  const accentLight = isMovein ? theme.palette.info.lighter : alpha(theme.palette.warning.main, 0.08);

  const roomSections = checklist ? groupItemsByRoom(checklist.items || [], customRooms) : [];

  const progress = checklist
    ? (() => {
        const items = checklist.items || [];
        const total = items.length;
        const done = items.filter(getItemComplete).length;
        return { total, done, pct: total > 0 ? Math.round((done / total) * 100) : 0 };
      })()
    : null;

  useEffect(() => {
    setScheduledAt(toDateTimeLocalValue(checklist?.inspectionDate));
  }, [checklist?.inspectionDate]);

  const handleSaveSchedule = async () => {
    if (!checklist) return;
    const inspectionDate = fromDateTimeLocalValue(scheduledAt);
    if (!inspectionDate) {
      openSnackbar({ open: true, message: 'Choose a valid inspection date and time', variant: 'alert', alert: { color: 'warning' } });
      return;
    }

    setSavingSchedule(true);
    try {
      const res = await checklistAPI.updateChecklist(checklist.id, { Id: checklist.id, InspectionDate: inspectionDate });
      if (!res?.success) throw new Error(res?.message || 'Failed to schedule inspection');
      onRefresh(res.data);
      openSnackbar({ open: true, message: `${label} inspection scheduled`, variant: 'alert', alert: { color: 'success' } });
    } catch (err) {
      openSnackbar({ open: true, message: err.message || 'Failed to schedule inspection', variant: 'alert', alert: { color: 'error' } });
    } finally {
      setSavingSchedule(false);
    }
  };

  const handleDeleteInspection = async () => {
    if (!checklist) return;
    setDeletingInspection(true);
    try {
      const res = await checklistAPI.deleteChecklist(checklist.id);
      if (!res?.success) throw new Error(res?.message || 'Failed to delete inspection');
      setDeleteOpen(false);
      onDeleted?.(type);
      openSnackbar({ open: true, message: `${label} inspection deleted`, variant: 'alert', alert: { color: 'success' } });
    } catch (err) {
      openSnackbar({ open: true, message: err.message || 'Failed to delete inspection', variant: 'alert', alert: { color: 'error' } });
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

      const propLabel = propertyName || 'Property';
      const unitLabel = unitName ? ` – ${unitName}` : '';
      const title = `${propLabel}${unitLabel} – ${label} Inspection`;

      const payload = {
        ChecklistType: type,
        PropertyId: parseInt(propertyId),
        UnitId: unitId ? parseInt(unitId) : null,
        Title: title,
        InspectionDate: fromDateTimeLocalValue(scheduledAt),
        Items: defaultItems
      };

      const res = await checklistAPI.addChecklist(payload);
      if (!res?.success) throw new Error(res?.message || 'Failed to create inspection');
      openSnackbar({ open: true, message: `${label} inspection started`, variant: 'alert', alert: { color: 'success' } });
      onRefresh(res.data);
    } catch (err) {
      openSnackbar({ open: true, message: err.message || 'Failed to start inspection', variant: 'alert', alert: { color: 'error' } });
    } finally {
      setStarting(false);
    }
  };

  const handleAddRoom = () => {
    const roomName = newRoomName.trim();
    if (!roomName) return;
    const existingRooms = groupItemsByRoom(checklist?.items || [], customRooms).map((room) => room.name.toLowerCase());
    if (existingRooms.includes(roomName.toLowerCase())) {
      openSnackbar({ open: true, message: 'That room already exists', variant: 'alert', alert: { color: 'warning' } });
      return;
    }

    setAddingRoom(true);
    setCustomRooms((prev) => [...prev, roomName]);
    setItemDrafts((prev) => ({ ...prev, [roomName]: '' }));
    setNewRoomName('');
    setAddingRoom(false);
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
      {/* Column header */}
      <Box
        sx={{
          px: 3,
          py: 2.5,
          bgcolor: accentLight,
          borderBottom: `2px solid ${alpha(accentColor, 0.25)}`,
          borderRadius: '12px 12px 0 0'
        }}
      >
        <Stack direction="row" justifyContent="space-between" alignItems="flex-start">
          <Box>
            <Typography variant="h6" fontWeight={700} sx={{ color: accentColor }}>
              {label} Inspection
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
              <Tooltip title="Delete inspection">
                <IconButton size="small" color="error" onClick={() => setDeleteOpen(true)} sx={{ border: `1px solid ${alpha(theme.palette.error.main, 0.25)}` }}>
                  <DeleteOutlined style={{ fontSize: 14 }} />
                </IconButton>
              </Tooltip>
            </Stack>
          )}
        </Stack>

        {/* Progress bar */}
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
      </Box>

      {/* Column body */}
      <Box sx={{ flex: 1, px: 3, py: 2, overflowY: 'auto' }}>
        {checklist && (
          <MainCard content={false} sx={{ mb: 2, border: `1px solid ${alpha(accentColor, 0.22)}`, bgcolor: alpha(accentColor, 0.025), boxShadow: 'none' }}>
            <Box sx={{ p: 2 }}>
              <Stack direction={{ xs: 'column', md: 'row' }} spacing={1.25} alignItems={{ xs: 'stretch', md: 'center' }} justifyContent="space-between">
                <Stack direction="row" spacing={1.25} alignItems="center">
                  <Box sx={{ width: 36, height: 36, borderRadius: '50%', bgcolor: alpha(accentColor, 0.12), display: 'flex', alignItems: 'center', justifyContent: 'center', color: accentColor }}>
                    <CalendarOutlined />
                  </Box>
                  <Box>
                    <Typography variant="subtitle2" fontWeight={800}>Schedule inspection</Typography>
                    <Typography variant="caption" color="text.secondary">
                      Set the planned date and time for this {label.toLowerCase()} inspection.
                    </Typography>
                  </Box>
                </Stack>
                <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1} sx={{ minWidth: { xs: '100%', md: 360 } }}>
                  <TextField
                    type="datetime-local"
                    size="small"
                    label="Scheduled for"
                    value={scheduledAt}
                    onChange={(e) => setScheduledAt(e.target.value)}
                    InputLabelProps={{ shrink: true }}
                    fullWidth
                  />
                  <Button
                    variant="outlined"
                    size="small"
                    onClick={handleSaveSchedule}
                    disabled={savingSchedule || !scheduledAt}
                    startIcon={savingSchedule ? <CircularProgress size={13} /> : <SaveOutlined />}
                    sx={{ flexShrink: 0, textTransform: 'none', borderRadius: 1.5, px: 2 }}
                  >
                    Save
                  </Button>
                </Stack>
              </Stack>
            </Box>
          </MainCard>
        )}
        {checklist && <KeyLegend />}
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
              No {label.toLowerCase()} inspection has been started yet.
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
              {starting ? 'Starting…' : `Start ${label} Inspection`}
            </Button>
          </Box>
        ) : (
          <Stack spacing={2.25}>
            {/* Add room */}
            <MainCard content={false} sx={{ border: `1px dashed ${alpha(accentColor, 0.38)}`, bgcolor: alpha(accentColor, 0.025), boxShadow: 'none' }}>
              <Box sx={{ p: 2 }}>
                <Stack direction={{ xs: 'column', md: 'row' }} spacing={1.25} alignItems={{ xs: 'stretch', md: 'center' }} justifyContent="space-between">
                  <Box>
                    <Typography variant="subtitle2" fontWeight={800}>Rooms</Typography>
                    <Typography variant="caption" color="text.secondary">
                      Common rooms are added by default. Add another room here, then add its inspection items inside that room.
                    </Typography>
                  </Box>
                  <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1} sx={{ minWidth: { xs: '100%', md: 360 } }}>
                    <TextField
                      size="small"
                      fullWidth
                      placeholder="Add room, e.g. Basement"
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
                      sx={{ flexShrink: 0, textTransform: 'none', borderRadius: 1.5, px: 2, bgcolor: accentColor, '&:hover': { bgcolor: alpha(accentColor, 0.85) } }}
                    >
                      Add Room
                    </Button>
                  </Stack>
                </Stack>
              </Box>
            </MainCard>

            {/* Rooms + items */}
            {roomSections.length === 0 ? (
              <Box sx={{ textAlign: 'center', py: 4 }}>
                <Typography variant="body2" color="text.secondary">No rooms in this inspection yet.</Typography>
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
                  />
                ))}
              </Stack>
            )}
          </Stack>
        )}
      </Box>

      <Dialog open={deleteOpen} onClose={() => setDeleteOpen(false)} maxWidth="xs" fullWidth PaperProps={{ sx: { borderRadius: 2 } }}>
        <DialogTitle>Delete {label.toLowerCase()} inspection?</DialogTitle>
        <DialogContent>
          <Typography variant="body2" color="text.secondary">
            This will permanently delete this inspection and its inspection items. This cannot be undone.
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
            {deletingInspection ? 'Deleting…' : 'Delete Inspection'}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function InspectionDetailPage() {
  const { propertyId, unitId } = useParams();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const theme = useTheme();

  const properties = useSelector(selectProperties);
  useFetchProperties(); // ensure properties are in Redux

  // 'move-in' | 'move-out' | null (null = legacy combined view)
  const typeParam = searchParams.get('type');
  const activeType = typeParam === 'move-out' ? MOVE_OUT : typeParam === 'move-in' ? MOVE_IN : null;

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

      setMoveInChecklist(moveIn);
      setMoveOutChecklist(moveOut);
    } catch {
      openSnackbar({ open: true, message: 'Failed to load inspection', variant: 'alert', alert: { color: 'error' } });
    } finally {
      setLoading(false);
    }
  }, [propertyId, unitId]);

  useEffect(() => {
    load();
  }, [load]);

  const handleChecklistUpdated = useCallback((updatedChecklist) => {
    if (!updatedChecklist) { load(); return; }
    if (isMoveInChecklist(updatedChecklist)) {
      setMoveInChecklist(updatedChecklist);
    } else {
      setMoveOutChecklist(updatedChecklist);
    }
  }, [load]);

  const handleChecklistDeleted = useCallback((deletedType) => {
    if (deletedType === MOVE_IN) {
      setMoveInChecklist(null);
    } else {
      setMoveOutChecklist(null);
    }
  }, []);

  // Derive property name from Redux (falls back to streetAddress when no name is set)
  const propFromRedux = properties?.find((p) => String(p.id) === String(propertyId));
  const displayPropertyName = propFromRedux?.name || propFromRedux?.streetAddress || `Property ${propertyId}`;
  const displayUnitName = unitName || (unitId ? `Unit ${unitId}` : '');

  const breadcrumbLabel = displayUnitName ? `${displayPropertyName} – ${displayUnitName}` : displayPropertyName;

  return (
    <Box>
      <PageBreadcrumbs
        items={[
          { label: 'Dashboard', path: '/landlord/dashboard' },
          { label: 'Inspections', path: '/landlord/checklists' },
          { label: breadcrumbLabel }
        ]}
      />

      {/* Header */}
      <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 3 }}>
        <Stack direction="row" spacing={1.5} alignItems="center">
          <IconButton size="small" onClick={() => navigate('/landlord/checklists')} sx={{ border: `1px solid ${theme.palette.divider}` }}>
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
              {activeType === MOVE_IN ? 'Move-In Inspection' : activeType === MOVE_OUT ? 'Move-Out Inspection' : 'Move-in and move-out inspection'}
            </Typography>
          </Box>
        </Stack>
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
            checklist={activeType === MOVE_IN ? moveInChecklist : moveOutChecklist}
            propertyId={propertyId}
            unitId={unitId}
            propertyName={displayPropertyName}
            unitName={displayUnitName}
            onRefresh={handleChecklistUpdated}
            onDeleted={handleChecklistDeleted}
          />
        </MainCard>
      ) : (
        // Legacy combined view (both columns side by side)
        <Grid container spacing={2.5}>
          <Grid size={{ xs: 12, md: 6 }}>
            <MainCard sx={{ p: 0, overflow: 'hidden', border: `1px solid ${alpha(theme.palette.info.main, 0.2)}`, boxShadow: `0 0 24px ${alpha(theme.palette.info.main, 0.08)}`, height: '100%', display: 'flex', flexDirection: 'column' }}>
              <InspectionColumn type={MOVE_IN} checklist={moveInChecklist} propertyId={propertyId} unitId={unitId} propertyName={displayPropertyName} unitName={displayUnitName} onRefresh={handleChecklistUpdated} onDeleted={handleChecklistDeleted} />
            </MainCard>
          </Grid>
          <Grid size={{ xs: 12, md: 6 }}>
            <MainCard sx={{ p: 0, overflow: 'hidden', border: `1px solid ${alpha(theme.palette.warning.main, 0.2)}`, boxShadow: `0 0 24px ${alpha(theme.palette.warning.main, 0.08)}`, height: '100%', display: 'flex', flexDirection: 'column' }}>
              <InspectionColumn type={MOVE_OUT} checklist={moveOutChecklist} propertyId={propertyId} unitId={unitId} propertyName={displayPropertyName} unitName={displayUnitName} onRefresh={handleChecklistUpdated} onDeleted={handleChecklistDeleted} />
            </MainCard>
          </Grid>
        </Grid>
      )}
    </Box>
  );
}
