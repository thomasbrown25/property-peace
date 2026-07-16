import { useState, useEffect, useMemo } from 'react';
import {
  Box,
  Typography,
  Stack,
  Grid,
  CircularProgress,
  TextField,
  InputAdornment,
  Chip,
  alpha,
  useTheme,
  Dialog,
  DialogTitle,
  DialogContent,
  Drawer,
  Toolbar,
  Divider,
  Avatar,
  List,
  ListItemButton,
  IconButton,
  LinearProgress,
  Button,
  RadioGroup,
  FormControlLabel,
  Radio
} from '@mui/material';
import {
  SearchOutlined,
  HomeOutlined,
  AuditOutlined,
  CheckCircleFilled,
  LeftOutlined,
  RightOutlined,
  BuildOutlined,
  CloseOutlined,
  PlusOutlined
} from '@ant-design/icons';
import { useNavigate } from 'react-router-dom';
import MainCard from 'components/MainCard';
import useAuth from 'hooks/useAuth';
import { formatDate } from 'utils/formatters';
import { checklistAPI } from 'api';
import { openSnackbar } from 'api/snackbar';
import useFetchProperties from 'hooks/useFetchProperties';
import PageBreadcrumbs from 'components/breadcrumbs/PageBreadcrumbs';
import axiosServices from 'utils/axios';
import Autocomplete from 'components/@extended/AutoComplete';

const MOVE_IN = 'moveInChecklist';
const MOVE_OUT = 'moveOutChecklist';

function normalizeChecklistType(type) {
  return String(type ?? '').toLowerCase();
}

function isMoveInInspection(inspection) {
  const type = normalizeChecklistType(inspection?.checklistType);
  const typeName = normalizeChecklistType(inspection?.checklistTypeName);
  return type === MOVE_IN.toLowerCase() || type === '40' || typeName.includes('movein') || typeName.includes('move-in');
}

function isMoveOutInspection(inspection) {
  const type = normalizeChecklistType(inspection?.checklistType);
  const typeName = normalizeChecklistType(inspection?.checklistTypeName);
  return type === MOVE_OUT.toLowerCase() || type === '41' || typeName.includes('moveout') || typeName.includes('move-out');
}

const DEFAULT_INSPECTION_ITEMS = [
  { category: 'Kitchen', names: ['Walls & Ceiling', 'Floors', 'Countertops', 'Cabinets & Drawers', 'Sink & Faucet', 'Refrigerator', 'Stove & Oven', 'Dishwasher', 'Microwave', 'Light Fixtures & Outlets'] },
  { category: 'Living Room', names: ['Walls & Ceiling', 'Floors', 'Windows & Blinds', 'Doors & Locks', 'Light Fixtures & Outlets'] },
  { category: 'Bedroom', names: ['Walls & Ceiling', 'Floors', 'Windows & Blinds', 'Closet & Doors', 'Light Fixtures & Outlets'] },
  { category: 'Bathroom', names: ['Walls & Ceiling', 'Floors', 'Toilet', 'Sink & Faucet', 'Shower & Tub', 'Exhaust Fan', 'Light Fixtures & Mirror'] },
  { category: 'Laundry', names: ['Washer & Dryer Hookups', 'Floors'] },
  { category: 'General', names: ['Entry Door & Locks', 'Smoke Detectors', 'Carbon Monoxide Detectors', 'HVAC Filter', 'Keys & Access Cards'] }
];

function buildDefaultInspectionItems() {
  let sort = 0;
  return DEFAULT_INSPECTION_ITEMS.flatMap(({ category, names }) =>
    names.map((name) => ({
      Name: name,
      Category: category,
      SortOrder: sort++,
      IsChecked: false
    }))
  );
}

function isMultiUnitProperty(property) {
  const type = (property?.propertyType || '').toLowerCase();
  return type === 'multiunit' || type === 'smallmultifamily' || type === 'apartmentbuilding' || type === 'other';
}

// ─── Unit Selection Modal ─────────────────────────────────────────────────────

function inspectionProgress(insp) {
  if (!insp) return null;
  const items = insp.items || [];
  const total = items.length;
  if (total === 0) return { total: 0, done: 0, pct: 0 };
  const done = items.filter((i) => !!i.condition).length;
  return { total, done, pct: Math.round((done / total) * 100) };
}

function InspectionProgressBar({ label, inspection, accentColor }) {
  const theme = useTheme();
  const prog = inspectionProgress(inspection);

  if (!inspection) {
    return (
      <Box>
        <Stack direction="row" justifyContent="space-between" sx={{ mb: 0.4 }}>
          <Typography variant="caption" color="text.disabled" fontWeight={600}>{label}</Typography>
          <Typography variant="caption" color="text.disabled">Not started</Typography>
        </Stack>
        <LinearProgress
          variant="determinate"
          value={0}
          sx={{ height: 5, borderRadius: 1, bgcolor: alpha(theme.palette.grey[300], 0.5), '& .MuiLinearProgress-bar': { bgcolor: theme.palette.grey[300] } }}
        />
      </Box>
    );
  }

  const color = inspection.isCompleted
    ? theme.palette.success.main
    : prog?.pct > 0
    ? accentColor
    : theme.palette.grey[400];

  const statusText = inspection.isCompleted
    ? 'Complete'
    : prog?.pct > 0
    ? `${prog.done}/${prog.total} items`
    : 'Started';

  return (
    <Box>
      <Stack direction="row" justifyContent="space-between" sx={{ mb: 0.4 }}>
        <Typography variant="caption" fontWeight={600} sx={{ color }}>
          {label}
        </Typography>
        <Stack direction="row" spacing={0.75} alignItems="center">
          {inspection.isCompleted && <CheckCircleFilled style={{ fontSize: 11, color: theme.palette.success.main }} />}
          <Typography variant="caption" sx={{ color }} fontWeight={600}>
            {inspection.isCompleted ? 'Complete' : `${prog?.pct ?? 0}%`}
          </Typography>
          {!inspection.isCompleted && (
            <Typography variant="caption" color="text.disabled">{statusText}</Typography>
          )}
        </Stack>
      </Stack>
      <LinearProgress
        variant="determinate"
        value={inspection.isCompleted ? 100 : (prog?.pct ?? 0)}
        sx={{
          height: 5,
          borderRadius: 1,
          bgcolor: alpha(color, 0.12),
          '& .MuiLinearProgress-bar': { bgcolor: color, borderRadius: 1 }
        }}
      />
    </Box>
  );
}

function UnitModal({ open, property, units, inspections, onClose, onSelect }) {
  // onSelect(unit, type) where type is 'move-in' | 'move-out'
  const theme = useTheme();
  const [search, setSearch] = useState('');

  const inspByUnit = useMemo(() => {
    const map = {};
    inspections.forEach((insp) => {
      if (!insp.unitId) return;
      if (!map[insp.unitId]) map[insp.unitId] = [];
      map[insp.unitId].push(insp);
    });
    return map;
  }, [inspections]);

  const filtered = useMemo(() => {
    if (!units) return [];
    if (!search.trim()) return units;
    const q = search.toLowerCase();
    return units.filter((u) => u.name?.toLowerCase().includes(q) || String(u.id).includes(q));
  }, [units, search]);

  const getUnitStatus = (unitId) => {
    const unitInsp = inspByUnit[unitId] || [];
    const moveIn = unitInsp.find((i) => isMoveInInspection(i)) || null;
    const moveOut = unitInsp.find((i) => isMoveOutInspection(i)) || null;
    return { moveIn, moveOut };
  };

  return (
    <Dialog
      open={open}
      onClose={onClose}
      maxWidth="sm"
      fullWidth
      PaperProps={{ sx: { borderRadius: 2.5, maxHeight: '82vh' } }}
    >
      <DialogTitle sx={{ pb: 1.5 }}>
        <Stack direction="row" justifyContent="space-between" alignItems="flex-start">
          <Box>
            <Typography variant="h5" fontWeight={700}>{property?.name || 'Property'}</Typography>
            <Typography variant="body2" color="text.secondary" sx={{ mt: 0.25 }}>
              Select a unit to view its inspection
            </Typography>
          </Box>
          <IconButton size="small" onClick={onClose}><CloseOutlined style={{ fontSize: 14 }} /></IconButton>
        </Stack>
      </DialogTitle>

      <Box sx={{ px: 3, pb: 1.5 }}>
        <TextField
          fullWidth
          size="small"
          placeholder="Search units…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          autoFocus
          slotProps={{
            input: {
              startAdornment: (
                <InputAdornment position="start">
                  <SearchOutlined style={{ fontSize: 14, color: theme.palette.text.secondary }} />
                </InputAdornment>
              )
            }
          }}
          sx={{  }}
        />
      </Box>
      <Divider />

      <DialogContent sx={{ p: 0, overflowY: 'auto' }}>
        {filtered.length === 0 ? (
          <Box sx={{ textAlign: 'center', py: 6 }}>
            <Typography color="text.secondary">No units found</Typography>
          </Box>
        ) : (
          <List disablePadding>
            {filtered.map((unit, idx) => {
              const { moveIn, moveOut } = getUnitStatus(unit.id);
              const hasAny = moveIn || moveOut;
              const bothComplete = moveIn?.isCompleted && moveOut?.isCompleted;
              const dotColor = bothComplete
                ? theme.palette.success.main
                : hasAny
                ? theme.palette.warning.main
                : theme.palette.grey[300];

              return (
                <Box key={unit.id}>
                  {idx > 0 && <Divider sx={{ opacity: 0.6 }} />}
                  <Box
                    sx={{
                      px: 3,
                      py: 2,
                      display: 'flex',
                      gap: 2,
                      alignItems: 'flex-start',
                    }}
                  >
                    {/* Unit avatar */}
                    <Avatar
                      sx={{
                        width: 42,
                        height: 42,
                        bgcolor: alpha(theme.palette.primary.main, 0.1),
                        color: 'primary.main',
                        fontSize: 14,
                        fontWeight: 800,
                        flexShrink: 0,
                        mt: 0.25,
                        border: `2px solid ${alpha(theme.palette.primary.main, 0.15)}`
                      }}
                    >
                      {unit.name || unit.id}
                    </Avatar>

                    {/* Content */}
                    <Box sx={{ flex: 1, minWidth: 0 }}>
                      {/* Header row */}
                      <Stack direction="row" alignItems="center" spacing={1} sx={{ mb: 1.25 }}>
                        <Box sx={{ width: 8, height: 8, borderRadius: '50%', bgcolor: dotColor, flexShrink: 0 }} />
                        <Typography variant="subtitle2" fontWeight={700}>
                          Unit {unit.name || unit.id}
                        </Typography>
                        {unit.tenantName && (
                          <Typography variant="caption" color="text.secondary" sx={{ ml: 0.5 }}>
                            · {unit.tenantName}
                          </Typography>
                        )}
                        {!hasAny && (
                          <Chip label="No inspections" size="small" sx={{ height: 18, fontSize: 10, ml: 'auto', bgcolor: alpha(theme.palette.grey[400], 0.12), color: 'text.disabled' }} />
                        )}
                      </Stack>

                      {/* Progress bars */}
                      <Stack spacing={1}>
                        <InspectionProgressBar
                          label="Move-In"
                          inspection={moveIn}
                          accentColor={theme.palette.info.main}
                        />
                        <InspectionProgressBar
                          label="Move-Out"
                          inspection={moveOut}
                          accentColor={theme.palette.warning.main}
                        />
                      </Stack>
                    </Box>

                    <Stack direction="row" spacing={1} sx={{ mt: 1.25, flexShrink: 0 }}>
                      <Button size="small" variant="outlined" color="info" onClick={() => onSelect(unit, 'move-in')} sx={{ textTransform: 'none', fontWeight: 600, fontSize: '0.72rem', borderRadius: 1.5, px: 1.25 }}>
                        Move-In
                      </Button>
                      <Button size="small" variant="outlined" color="warning" onClick={() => onSelect(unit, 'move-out')} sx={{ textTransform: 'none', fontWeight: 600, fontSize: '0.72rem', borderRadius: 1.5, px: 1.25 }}>
                        Move-Out
                      </Button>
                    </Stack>
                  </Box>
                </Box>
              );
            })}
          </List>
        )}
      </DialogContent>
    </Dialog>
  );
}

// ─── Property Row ─────────────────────────────────────────────────────────────

function PropertyRow({ property, units, inspections, onMoveIn, onMoveOut }) {
  const theme = useTheme();

  const propertyInsp = useMemo(
    () => inspections.filter((i) => i.propertyId === property.id),
    [inspections, property.id]
  );

  const isSingleFamily = property.propertyType?.toLowerCase() === 'singlefamily';
  const unitCount = units?.length ?? 0;
  const moveInComplete = propertyInsp.filter((i) => isMoveInInspection(i) && i.isCompleted).length;
  const moveOutComplete = propertyInsp.filter((i) => isMoveOutInspection(i) && i.isCompleted).length;
  const totalInsp = propertyInsp.length;
  const lastDate = propertyInsp.reduce((latest, i) => {
    const d = new Date(i.inspectionDate || 0);
    return d > latest ? d : latest;
  }, new Date(0));
  const hasActivity = lastDate.getFullYear() > 2000;

  // Status colour: all complete = green, some = warning, none = neutral
  const allComplete = totalInsp > 0 && propertyInsp.every((i) => i.isCompleted);
  const anyInProgress = propertyInsp.some((i) => !i.isCompleted);
  const statusColor = allComplete ? 'success.main' : anyInProgress ? 'warning.main' : 'grey.400';

  return (
    <Box
      sx={{
        display: 'flex',
        alignItems: 'center',
        px: 3,
        py: 2.5,
      }}
    >
      {/* Status dot */}
      <Box sx={{ width: 10, height: 10, borderRadius: '50%', bgcolor: statusColor, flexShrink: 0, mr: 2 }} />

      {/* Property icon */}
      <Avatar
        sx={{
          width: 44,
          height: 44,
          bgcolor: alpha(theme.palette.primary.main, 0.1),
          color: 'primary.main',
          mr: 2,
          flexShrink: 0
        }}
      >
        <HomeOutlined style={{ fontSize: 20 }} />
      </Avatar>

      {/* Name + address */}
      <Box sx={{ flex: 1, minWidth: 0, mr: 3 }}>
        <Typography variant="subtitle1" fontWeight={700} noWrap>
          {property.name || property.streetAddress || 'Unnamed Property'}
        </Typography>
        {property.name && property.streetAddress && (
          <Typography variant="caption" color="text.secondary" noWrap>
            {[property.streetAddress, property.city, property.state].filter(Boolean).join(', ')}
          </Typography>
        )}
      </Box>

      {/* Unit count */}
      <Box sx={{ flexShrink: 0, mr: 4, textAlign: 'center', minWidth: 80 }}>
        <Chip
          label={isSingleFamily ? 'Single Family' : `${unitCount} unit${unitCount !== 1 ? 's' : ''}`}
          size="small"
          variant="outlined"
          color={isSingleFamily ? 'default' : 'primary'}
          sx={{ fontSize: 11, height: 22 }}
        />
      </Box>

      {/* Last activity */}
      <Box sx={{ flexShrink: 0, mr: 4, minWidth: 100, textAlign: 'right' }}>
        <Typography variant="caption" color="text.secondary">
          {hasActivity ? formatDate(lastDate.toISOString()) : '—'}
        </Typography>
      </Box>

      {/* Move-In / Move-Out buttons */}
      <Stack direction="row" spacing={1} sx={{ flexShrink: 0 }}>
        <Button
          size="small"
          variant={moveInComplete > 0 ? 'contained' : 'outlined'}
          color="info"
          onClick={() => onMoveIn(property)}
          sx={{ textTransform: 'none', fontWeight: 600, fontSize: '0.75rem', borderRadius: 1.5, px: 1.5 }}
        >
          Move-In
        </Button>
        <Button
          size="small"
          variant={moveOutComplete > 0 ? 'contained' : 'outlined'}
          color="warning"
          onClick={() => onMoveOut(property)}
          sx={{ textTransform: 'none', fontWeight: 600, fontSize: '0.75rem', borderRadius: 1.5, px: 1.5 }}
        >
          Move-Out
        </Button>
      </Stack>
    </Box>
  );
}

// ─── New Inspection Drawer ───────────────────────────────────────────────────

function NewInspectionDrawer({ open, properties, unitMap, inspections, onClose, onCreated }) {
  const theme = useTheme();
  const navigate = useNavigate();
  const [propertyId, setPropertyId] = useState('');
  const [unitId, setUnitId] = useState('');
  const [inspectionType, setInspectionType] = useState(MOVE_IN);
  const [scheduledDate, setScheduledDate] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [duplicateInspection, setDuplicateInspection] = useState(null);

  useEffect(() => {
    if (open) {
      setPropertyId('');
      setUnitId('');
      setInspectionType(MOVE_IN);
      setScheduledDate('');
      setSubmitting(false);
      setError('');
      setDuplicateInspection(null);
    }
  }, [open]);

  const propertyOptions = useMemo(
    () => (properties || []).map((p) => ({
      value: Number(p.value ?? p.id),
      label: p.label ?? p.name ?? p.streetAddress ?? `Property ${p.id}`,
      property: p
    })),
    [properties]
  );

  const selectedPropertyOption = useMemo(
    () => propertyOptions.find((option) => String(option.value) === String(propertyId)) || null,
    [propertyOptions, propertyId]
  );

  const selectedProperty = selectedPropertyOption?.property || null;
  const needsUnit = isMultiUnitProperty(selectedProperty);
  const unitOptions = useMemo(
    () => (selectedProperty ? unitMap[selectedProperty.id] || [] : []).map((unit) => ({
      id: unit.id,
      label: unit.name || `Unit ${unit.id}`
    })),
    [selectedProperty, unitMap]
  );

  const selectedUnit = useMemo(
    () => unitOptions.find((unit) => String(unit.id) === String(unitId)) || null,
    [unitOptions, unitId]
  );

  const existingOpenInspection = useMemo(() => {
    if (!propertyId) return null;
    if (needsUnit && !unitId) return null;

    return (inspections || []).find((inspection) => {
      const sameProperty = String(inspection.propertyId || inspection.PropertyId) === String(propertyId);
      const sameUnit = needsUnit
        ? String(inspection.unitId || inspection.UnitId) === String(unitId)
        : !(inspection.unitId || inspection.UnitId);
      const sameType = inspectionType === MOVE_IN
        ? isMoveInInspection(inspection)
        : isMoveOutInspection(inspection);
      return sameProperty && sameUnit && sameType && !inspection.isCompleted;
    }) || null;
  }, [inspections, inspectionType, needsUnit, propertyId, unitId]);

  useEffect(() => {
    if (existingOpenInspection) {
      setDuplicateInspection(existingOpenInspection);
      setError(`There is already an open ${inspectionType === MOVE_IN ? 'move-in' : 'move-out'} inspection for this ${needsUnit ? 'unit' : 'property'}.`);
    } else if (error.startsWith('There is already an open')) {
      setError('');
    }
  }, [existingOpenInspection, inspectionType, needsUnit, error]);

  const viewInspection = (inspection = duplicateInspection) => {
    if (!inspection) return;
    const typeParam = getInspectionTypeParam(inspection);
    onClose();
    navigate(
      inspection.unitId
        ? `/landlord/inspection/${inspection.propertyId}/unit/${inspection.unitId}?type=${typeParam}`
        : `/landlord/inspection/${inspection.propertyId}?type=${typeParam}`
    );
  };

  const handleSubmit = async () => {
    setError('');
    if (!propertyId) {
      setError('Please select a property.');
      return;
    }
    if (needsUnit && !unitId) {
      setError('Please select a unit for this property.');
      return;
    }
    if (existingOpenInspection) {
      setDuplicateInspection(existingOpenInspection);
      setError(`There is already an open ${inspectionType === MOVE_IN ? 'move-in' : 'move-out'} inspection for this ${needsUnit ? 'unit' : 'property'}.`);
      return;
    }

    setSubmitting(true);
    try {
      const typeLabel = inspectionType === MOVE_IN ? 'Move-In' : 'Move-Out';
      const propertyLabel = selectedProperty?.name || selectedProperty?.streetAddress || 'Property';
      const unitLabel = selectedUnit?.label ? ` – ${selectedUnit.label}` : '';
      const title = `${propertyLabel}${unitLabel} – ${typeLabel} Inspection`;
      const inspectionDate = scheduledDate ? new Date(`${scheduledDate}T12:00:00`).toISOString() : new Date().toISOString();

      const payload = {
        ChecklistType: inspectionType,
        PropertyId: Number(propertyId),
        UnitId: needsUnit ? Number(unitId) : null,
        Title: title,
        InspectionDate: inspectionDate,
        Items: buildDefaultInspectionItems()
      };

      const res = await checklistAPI.addChecklist(payload);
      if (!res?.success) throw new Error(res?.message || 'Failed to create inspection');

      openSnackbar({ open: true, message: `${typeLabel} inspection created`, variant: 'alert', alert: { color: 'success' } });
      onCreated?.(res.data);
      onClose();
      const typeParam = inspectionType === MOVE_IN ? 'move-in' : 'move-out';
      navigate(needsUnit ? `/landlord/inspection/${propertyId}/unit/${unitId}?type=${typeParam}` : `/landlord/inspection/${propertyId}?type=${typeParam}`);
    } catch (err) {
      setError(err.message || 'Failed to create inspection');
      openSnackbar({ open: true, message: err.message || 'Failed to create inspection', variant: 'alert', alert: { color: 'error' } });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Drawer
      anchor="right"
      open={open}
      onClose={onClose}
      PaperProps={{
        sx: {
          width: { xs: '100%', sm: 500, md: 540 },
          bgcolor: 'background.paper',
          backgroundImage: 'none',
          display: 'flex',
          flexDirection: 'column'
        }
      }}
    >
      <Toolbar sx={{ px: 2.5, justifyContent: 'space-between', borderBottom: `1px solid ${alpha(theme.palette.divider, 0.12)}` }}>
        <Stack direction="row" spacing={1.5} alignItems="center">
          <Box sx={{ width: 36, height: 36, borderRadius: 1.5, bgcolor: alpha(theme.palette.primary.main, 0.1), display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <AuditOutlined style={{ fontSize: 18, color: theme.palette.primary.main }} />
          </Box>
          <Box>
            <Typography variant="h6">New Inspection</Typography>
            <Typography variant="caption" color="text.secondary">Choose the property, type, and optional schedule date.</Typography>
          </Box>
        </Stack>
        <IconButton size="small" onClick={onClose}>
          <CloseOutlined style={{ fontSize: 16 }} />
        </IconButton>
      </Toolbar>

      <Box sx={{ flex: 1, overflowY: 'auto', px: 3, py: 3 }}>
        <Stack spacing={3}>
          <Stack spacing={0.75}>
            <Typography variant="caption" fontWeight={600} color="text.secondary">Property</Typography>
            <Autocomplete
              options={propertyOptions}
              width="100%"
              value={selectedPropertyOption}
          onChange={(_, option) => {
                setPropertyId(option ? option.value : '');
                setUnitId('');
                setError('');
                setDuplicateInspection(null);
              }}
              isOptionEqualToValue={(opt, val) => opt.value === val.value}
              getOptionLabel={(option) => option?.label ?? ''}
              disablePortal={false}
            />
          </Stack>

          {needsUnit && (
            <Stack spacing={0.75}>
              <Typography variant="caption" fontWeight={600} color="text.secondary">Unit</Typography>
              <Autocomplete
                options={unitOptions}
                width="100%"
                value={selectedUnit}
                onChange={(_, option) => {
                  setUnitId(option ? option.id : '');
                  setError('');
                  setDuplicateInspection(null);
                }}
                isOptionEqualToValue={(opt, val) => String(opt.id) === String(val.id)}
                getOptionLabel={(option) => option?.label ?? ''}
                disabled={!selectedProperty || unitOptions.length === 0}
                disablePortal={false}
              />
              {selectedProperty && unitOptions.length === 0 && (
                <Typography variant="caption" color="text.secondary">No units found for this property yet.</Typography>
              )}
            </Stack>
          )}

          <Stack spacing={1}>
            <Typography variant="caption" fontWeight={600} color="text.secondary">Inspection Type</Typography>
            <RadioGroup value={inspectionType} onChange={(e) => { setInspectionType(e.target.value); setError(''); setDuplicateInspection(null); }}>
              <FormControlLabel value={MOVE_IN} control={<Radio />} label="Move-in inspection" />
              <FormControlLabel value={MOVE_OUT} control={<Radio />} label="Move-out inspection" />
            </RadioGroup>
          </Stack>

          <TextField
            label="Schedule Date (optional)"
            type="date"
            value={scheduledDate}
            onChange={(e) => setScheduledDate(e.target.value)}
            fullWidth
            size="small"
            InputLabelProps={{ shrink: true }}
            helperText="Leave blank to create the inspection without choosing a future date."
          />

          {error && <Typography variant="caption" color="error">{error}</Typography>}
        </Stack>
      </Box>

      <Box sx={{ px: 3, py: 2, borderTop: `1px solid ${alpha(theme.palette.divider, 0.12)}`, display: 'flex', gap: 1.5 }}>
        <Button variant="outlined" onClick={onClose} fullWidth sx={{ borderRadius: 1.5, textTransform: 'none' }}>
          Cancel
        </Button>
        <Button
          variant="contained"
          onClick={handleSubmit}
          disabled={submitting || !propertyId || (needsUnit && !unitId) || !!existingOpenInspection}
          fullWidth
          startIcon={submitting ? <CircularProgress size={14} color="inherit" /> : <PlusOutlined />}
          sx={{ borderRadius: 1.5, textTransform: 'none' }}
        >
          {submitting ? 'Creating…' : 'Create Inspection'}
        </Button>
      </Box>

      <Dialog open={!!duplicateInspection} onClose={() => setDuplicateInspection(null)} maxWidth="xs" fullWidth PaperProps={{ sx: { borderRadius: 2 } }}>
        <DialogTitle>Inspection already exists</DialogTitle>
        <DialogContent>
          <Typography variant="body2" color="text.secondary">
            There is already an open {inspectionType === MOVE_IN ? 'move-in' : 'move-out'} inspection for this {needsUnit ? 'unit' : 'property'}. Would you like to view it instead?
          </Typography>
        </DialogContent>
        <Box sx={{ px: 3, pb: 2.5, display: 'flex', justifyContent: 'flex-end', gap: 1 }}>
          <Button onClick={() => setDuplicateInspection(null)} sx={{ textTransform: 'none' }}>Cancel</Button>
          <Button variant="contained" onClick={() => viewInspection()} sx={{ textTransform: 'none', borderRadius: 1.5 }}>
            View Inspection
          </Button>
        </Box>
      </Dialog>
    </Drawer>
  );
}

// ─── Inspection Lists ─────────────────────────────────────────────────────────

function getInspectionTypeParam(inspection) {
  return isMoveOutInspection(inspection) ? 'move-out' : 'move-in';
}

function getInspectionStatus(inspection) {
  const items = inspection?.items || [];
  const total = items.length;
  const complete = items.filter((item) => item.isChecked || item.IsChecked || item.condition).length;
  const label = `${complete} / ${total}`;

  if (total > 0 && complete === total) return { label, color: 'success' };
  if (complete > 0) return { label, color: 'warning' };
  return { label, color: 'default' };
}

function getInspectionLocation(inspection) {
  const propertyName = inspection.propertyName || inspection.property?.name || inspection.title || 'Property';
  const unitName = inspection.unitName || inspection.unit?.name;
  return unitName ? `${propertyName} · Unit ${unitName}` : propertyName;
}

function inspectionMatchesSearch(inspection, search) {
  if (!search.trim()) return true;
  const q = search.toLowerCase();
  return [
    inspection.title,
    inspection.propertyName,
    inspection.unitName,
    inspection.tenantName,
    inspection.checklistTypeName,
    inspection.isCompleted ? 'complete' : 'not started',
    inspection.inspectionDate ? formatDate(inspection.inspectionDate) : ''
  ]
    .filter(Boolean)
    .some((value) => String(value).toLowerCase().includes(q));
}

const INSPECTIONS_PER_PAGE = 7;

function InspectionList({ title, subtitle, inspections, search, onSearchChange, accentColor, emptyText, onOpen }) {
  const theme = useTheme();
  const [page, setPage] = useState(0);

  useEffect(() => { setPage(0); }, [inspections]);

  const totalPages = Math.ceil(inspections.length / INSPECTIONS_PER_PAGE);
  const paged = inspections.slice(page * INSPECTIONS_PER_PAGE, (page + 1) * INSPECTIONS_PER_PAGE);

  return (
    <MainCard boxShadow border={false} shadow={theme.palette.mode === 'dark' ? `0 0 0 1px ${alpha(theme.palette.primary.main, 0.22)}, 0 8px 28px ${alpha(theme.palette.primary.main, 0.14)}` : `0 2px 12px ${alpha(theme.palette.primary.main, 0.08)}`} sx={{ p: 0, overflow: 'hidden', height: '100%', border: `1px solid ${alpha(theme.palette.divider, theme.palette.mode === 'dark' ? 0.18 : 0.1)}` }}>
      <Box sx={{ p: 2.5, borderBottom: `1px solid ${alpha(theme.palette.divider, 0.12)}` }}>
        <Stack direction="row" justifyContent="space-between" alignItems="flex-start" spacing={2} sx={{ mb: 2 }}>
          <Box>
            <Stack direction="row" spacing={1} alignItems="center">
              <Box sx={{ width: 8, height: 8, borderRadius: '50%', bgcolor: accentColor }} />
              <Typography variant="h5" fontWeight={700}>{title}</Typography>
            </Stack>
            <Typography variant="body2" color="text.secondary" sx={{ mt: 0.25 }}>{subtitle}</Typography>
          </Box>
          <Chip label={inspections.length} size="small" sx={{ bgcolor: alpha(accentColor, 0.1), color: accentColor, fontWeight: 700 }} />
        </Stack>

        <TextField
          fullWidth
          size="small"
          placeholder={`Search ${title.toLowerCase()}…`}
          value={search}
          onChange={(e) => onSearchChange(e.target.value)}
          InputProps={{
            startAdornment: (
              <InputAdornment position="start">
                <SearchOutlined style={{ fontSize: 15, color: theme.palette.text.secondary }} />
              </InputAdornment>
            )
          }}
        />
      </Box>

      <Box sx={{ px: 2.5, py: 1, bgcolor: alpha(theme.palette.grey[100], 0.8), borderBottom: `1px solid ${alpha(theme.palette.divider, 0.12)}` }}>
        <Grid container spacing={1.5} alignItems="center">
          <Grid size={{ xs: 6 }}>
            <Typography variant="caption" fontWeight={700} color="text.secondary">PROPERTY / UNIT</Typography>
          </Grid>
          <Grid size={{ xs: 3 }}>
            <Typography variant="caption" fontWeight={700} color="text.secondary">STATUS</Typography>
          </Grid>
          <Grid size={{ xs: 3 }} sx={{ textAlign: 'right' }}>
            <Typography variant="caption" fontWeight={700} color="text.secondary">DATE</Typography>
          </Grid>
        </Grid>
      </Box>

      {inspections.length === 0 ? (
        <Box sx={{ py: 7, px: 3, textAlign: 'center' }}>
          <AuditOutlined style={{ fontSize: 42, color: theme.palette.text.disabled, marginBottom: 12 }} />
          <Typography variant="subtitle1" color="text.secondary" fontWeight={600}>{emptyText}</Typography>
        </Box>
      ) : (
        <List disablePadding>
          {paged.map((inspection, idx) => {
            const status = getInspectionStatus(inspection);
            return (
              <Box key={inspection.id || `${inspection.propertyId}-${inspection.unitId || 'property'}-${inspection.checklistType}-${idx}`}>
                {idx > 0 && <Divider />}
                <ListItemButton onClick={() => onOpen(inspection)} sx={{ px: 2.5, py: 1.75 }}>
                  <Grid container spacing={1.5} alignItems="center" sx={{ width: '100%' }}>
                    <Grid size={{ xs: 6 }}>
                      <Stack spacing={0.35}>
                        <Typography variant="subtitle2" fontWeight={700} noWrap>{getInspectionLocation(inspection)}</Typography>
                        <Typography variant="caption" color="text.secondary" noWrap>{inspection.title || 'Inspection'}</Typography>
                      </Stack>
                    </Grid>
                    <Grid size={{ xs: 3 }}>
                      <Chip label={status.label} color={status.color} size="small" variant={status.color === 'default' ? 'outlined' : 'filled'} sx={{ height: 22, fontSize: 11 }} />
                    </Grid>
                    <Grid size={{ xs: 3 }} sx={{ textAlign: 'right' }}>
                      <Typography variant="caption" color="text.secondary">
                        {inspection.inspectionDate ? formatDate(inspection.inspectionDate) : '—'}
                      </Typography>
                    </Grid>
                  </Grid>
                </ListItemButton>
              </Box>
            );
          })}
        </List>
      )}
      {totalPages > 1 && (
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', px: 2.5, py: 1.5, borderTop: `1px solid ${alpha(theme.palette.divider, 0.12)}` }}>
          <Typography variant="body2" color="text.secondary">Page {page + 1} of {totalPages}</Typography>
          <Box sx={{ display: 'flex', gap: 1 }}>
            <Button size="small" variant="outlined" startIcon={<LeftOutlined />} onClick={() => setPage((p) => Math.max(0, p - 1))} disabled={page === 0} sx={{ minWidth: 100 }}>Previous</Button>
            <Button size="small" variant="outlined" endIcon={<RightOutlined />} onClick={() => setPage((p) => Math.min(totalPages - 1, p + 1))} disabled={page >= totalPages - 1} sx={{ minWidth: 100 }}>Next</Button>
          </Box>
        </Box>
      )}
    </MainCard>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function InspectionsPage() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const theme = useTheme();
  const { properties, isLoading: propertiesLoading } = useFetchProperties();

  const [inspections, setInspections] = useState([]);
  const [loading, setLoading] = useState(true);
  const [unitMap, setUnitMap] = useState({}); // { [propertyId]: Unit[] }
  const [moveInSearch, setMoveInSearch] = useState('');
  const [moveOutSearch, setMoveOutSearch] = useState('');
  const [newInspectionOpen, setNewInspectionOpen] = useState(false);

  useEffect(() => {
    if (user?.id || user?.Id) loadInspections();
  }, [user]);

  // Fetch units for all properties in parallel (local state, not Redux)
  useEffect(() => {
    if (!properties || properties.length === 0) return;
    const nonSingleFamily = properties.filter(
      (p) => p.propertyType?.toLowerCase() !== 'singlefamily'
    );
    if (nonSingleFamily.length === 0) return;

    Promise.all(
      nonSingleFamily.map(async (p) => {
        try {
          const res = await axiosServices.get(`/api/unit/${p.id}`);
          return { propertyId: p.id, units: res.data?.data || [] };
        } catch {
          return { propertyId: p.id, units: [] };
        }
      })
    ).then((results) => {
      const map = {};
      results.forEach(({ propertyId, units }) => { map[propertyId] = units; });
      setUnitMap(map);
    });
  }, [properties]);

  const loadInspections = async () => {
    setLoading(true);
    try {
      const userId = user?.id || user?.Id;
      const res = await checklistAPI.getChecklistsByLandlord(userId);
      if (res?.success) setInspections(res.data || []);
    } catch {
      openSnackbar({ open: true, message: 'Failed to load inspections', variant: 'alert', alert: { color: 'error' } });
    } finally {
      setLoading(false);
    }
  };

  const moveInInspections = useMemo(
    () => inspections
      .filter((inspection) => isMoveInInspection(inspection))
      .filter((inspection) => inspectionMatchesSearch(inspection, moveInSearch))
      .sort((a, b) => new Date(b.inspectionDate || b.createdAt || 0) - new Date(a.inspectionDate || a.createdAt || 0)),
    [inspections, moveInSearch]
  );

  const moveOutInspections = useMemo(
    () => inspections
      .filter((inspection) => isMoveOutInspection(inspection))
      .filter((inspection) => inspectionMatchesSearch(inspection, moveOutSearch))
      .sort((a, b) => new Date(b.inspectionDate || b.createdAt || 0) - new Date(a.inspectionDate || a.createdAt || 0)),
    [inspections, moveOutSearch]
  );

  const stats = useMemo(() => {
    const moveInTotal = inspections.filter((i) => isMoveInInspection(i)).length;
    const moveOutTotal = inspections.filter((i) => isMoveOutInspection(i)).length;
    const completed = inspections.filter((i) => i.isCompleted).length;
    return { moveInTotal, moveOutTotal, completed };
  }, [inspections]);

  const handleOpenInspection = (inspection) => {
    const typeParam = getInspectionTypeParam(inspection);
    navigate(
      inspection.unitId
        ? `/landlord/inspection/${inspection.propertyId}/unit/${inspection.unitId}?type=${typeParam}`
        : `/landlord/inspection/${inspection.propertyId}?type=${typeParam}`
    );
  };

  const pageLoading = loading || propertiesLoading;

  return (
    <Box>
      <PageBreadcrumbs items={[{ label: 'Dashboard', path: '/landlord/dashboard' }, { label: 'Inspections' }]} />

      {/* Header */}
      <Stack direction="row" alignItems="center" spacing={2} sx={{ mb: 3 }}>
        <Box sx={{ flex: 1 }}>
          <Typography variant="h3" fontWeight={700}>Inspections</Typography>
          <Typography variant="body1" color="text.secondary">
            Move-in and move-out condition reports
          </Typography>
        </Box>
        <Button
          size="small"
          variant="contained"
          startIcon={<PlusOutlined />}
          onClick={() => setNewInspectionOpen(true)}
          sx={{ borderRadius: 1.5, textTransform: 'none', flexShrink: 0 }}
        >
          New Inspection
        </Button>
      </Stack>

      {/* Stats */}
      <Grid container spacing={2.5} sx={{ mb: 3 }}>
        {[
          {
            icon: <AuditOutlined style={{ fontSize: 22, color: theme.palette.info.main }} />,
            value: stats.moveInTotal,
            label: 'Move-In Inspections',
            color: 'info'
          },
          {
            icon: <AuditOutlined style={{ fontSize: 22, color: theme.palette.warning.main }} />,
            value: stats.moveOutTotal,
            label: 'Move-Out Inspections',
            color: 'warning'
          },
          {
            icon: <CheckCircleFilled style={{ fontSize: 22, color: theme.palette.success.main }} />,
            value: stats.completed,
            label: 'Completed',
            color: 'success'
          }
        ].map((s) => (
          <Grid key={s.label} size={{ xs: 12, sm: 4 }}>
            <MainCard sx={{ boxShadow: `0 0 18px ${alpha(theme.palette[s.color].main, 0.2)}` }}>
              <Stack direction="row" spacing={2} alignItems="center">
                <Box
                  sx={{
                    width: 48,
                    height: 48,
                    borderRadius: '50%',
                    bgcolor: alpha(theme.palette[s.color].main, 0.1),
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    flexShrink: 0
                  }}
                >
                  {s.icon}
                </Box>
                <Box>
                  <Typography variant="h4" fontWeight={700} lineHeight={1.2}>{s.value}</Typography>
                  <Typography variant="body2" color="text.secondary">{s.label}</Typography>
                </Box>
              </Stack>
            </MainCard>
          </Grid>
        ))}
      </Grid>

      {pageLoading ? (
        <Box sx={{ display: 'flex', justifyContent: 'center', py: 10 }}>
          <CircularProgress />
        </Box>
      ) : (
        <Grid container spacing={2.5} alignItems="stretch">
          <Grid size={{ xs: 12, lg: 6 }}>
            <InspectionList
              title="Move-In Inspections"
              subtitle="Inspections created for move-in condition reports"
              inspections={moveInInspections}
              search={moveInSearch}
              onSearchChange={setMoveInSearch}
              accentColor={theme.palette.info.main}
              emptyText="No move-in inspections found"
              onOpen={handleOpenInspection}
            />
          </Grid>
          <Grid size={{ xs: 12, lg: 6 }}>
            <InspectionList
              title="Move-Out Inspections"
              subtitle="Inspections created for move-out condition reports"
              inspections={moveOutInspections}
              search={moveOutSearch}
              onSearchChange={setMoveOutSearch}
              accentColor={theme.palette.warning.main}
              emptyText="No move-out inspections found"
              onOpen={handleOpenInspection}
            />
          </Grid>
        </Grid>
      )}

      <NewInspectionDrawer
        open={newInspectionOpen}
        properties={properties || []}
        unitMap={unitMap}
        inspections={inspections}
        onClose={() => setNewInspectionOpen(false)}
        onCreated={(inspection) => setInspections((prev) => [inspection, ...prev])}
      />
    </Box>
  );
}

