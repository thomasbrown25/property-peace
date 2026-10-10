import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Alert,
  Autocomplete as MuiAutocomplete,
  createFilterOptions,
  alpha,
  Box,
  Button,
  Chip,
  CircularProgress,
  FormControl,
  IconButton,
  Divider,
  InputAdornment,
  LinearProgress,
  Link,
  MenuItem,
  OutlinedInput,
  Select,
  Stack,
  TextField,
  Typography,
  useTheme
} from '@mui/material';
import {
  AuditOutlined,
  DeleteOutlined,
  DownOutlined,
  HomeOutlined,
  PlusOutlined,
  CloseOutlined,
  RightOutlined,
  SearchOutlined
} from '@ant-design/icons';
import { Link as RouterLink, useNavigate } from 'react-router-dom';

import { addChecklist, getChecklistsByLandlord, getChecklistsByLease } from 'api/checklist';
import { findLinkedChecklist, getLeaseOptions, leaseDates, suggestLeaseId } from 'utils/checklistLeaseOptions.mjs';
import { applyRoomNames, buildFloorInspectionItems, floorLabel, getRoomNameErrors, isValidBathroomCount, isValidFloorPlan, removeInspectionRooms, MAX_FLOORS, MAX_ROOMS_PER_FLOOR } from 'utils/checklistFloorPlan.mjs';
import ThemeAdaptiveDrawer from 'components/drawers/shared/ThemeAdaptiveDrawer';
import { openSnackbar } from 'api/snackbar';
import Autocomplete from 'components/@extended/AutoComplete';
import PageBreadcrumbs from 'components/breadcrumbs/PageBreadcrumbs';
import useFetchProperties from 'hooks/useFetchProperties';
import useAuth from 'hooks/useAuth';
import axiosServices from 'utils/axios';
import {
  buildChecklistWorkspacePath,
  enrichChecklistsWithProperties,
  filterChecklistPortfolio,
  getChecklistDateSummary,
  getChecklistProgress,
  getChecklistStatus,
  getChecklistTypeLabel,
  sortChecklistPortfolio
} from 'utils/checklistPortfolio';
import { formatDate2 } from 'utils/formatters';

function isMultiUnitProperty(property) {
  const type = String(property?.propertyType || '').toLowerCase();
  return ['multiunit', 'smallmultifamily', 'apartmentbuilding', 'multifamily', 'other'].includes(type);
}

function getPropertyLabel(property) {
  return property?.name || property?.streetAddress || `Property ${property?.id}`;
}

function getPropertyAddress(property) {
  return [property?.streetAddress, property?.city, property?.state].filter(Boolean).join(', ');
}

const checklistTypeOptions = [
  { value: 'move-in', label: 'Move-in' },
  { value: 'move-out', label: 'Move-out' }
];
const floorOptions = Array.from({ length: MAX_FLOORS }, (_, index) => String(index + 1));
const limitedFloorOptions = createFilterOptions({ limit: 5 });

export default function ChecklistsPage() {
  const navigate = useNavigate();
  const theme = useTheme();
  const { user, isInitialized } = useAuth();
  const { properties, isLoading: propertiesLoading } = useFetchProperties();
  const userId = user?.id ?? user?.Id;
  const headingColor = theme.palette.mode === 'dark' ? theme.palette.text.primary : '#061e35';

  const [checklists, setChecklists] = useState([]);
  const [checklistsLoading, setChecklistsLoading] = useState(true);
  const [checklistsError, setChecklistsError] = useState('');
  const [search, setSearch] = useState('');
  const [type, setType] = useState('all');
  const [status, setStatus] = useState('all');
  const [sort, setSort] = useState({ key: 'created', direction: 'desc' });
  const [pickerOpen, setPickerOpen] = useState(false);
  const [createType, setCreateType] = useState('');
  const [floorCount, setFloorCount] = useState(null);
  const [floorPlan, setFloorPlan] = useState([]);
  const [roomNameOverrides, setRoomNameOverrides] = useState({});
  const [removedRoomNames, setRemovedRoomNames] = useState([]);
  const [creating, setCreating] = useState(false);
  const [createError, setCreateError] = useState('');
  const [selectedProperty, setSelectedProperty] = useState(null);
  const [selectedUnit, setSelectedUnit] = useState(null);
  const [units, setUnits] = useState([]);
  const [unitsLoading, setUnitsLoading] = useState(false);
  const [leases, setLeases] = useState([]);
  const [leasesLoading, setLeasesLoading] = useState(false);
  const [leasesError, setLeasesError] = useState('');
  const [leaseRetry, setLeaseRetry] = useState(0);
  const [selectedLeaseId, setSelectedLeaseId] = useState(null);
  const [leaseDecision, setLeaseDecision] = useState('unanswered');
  const [leaseChecking, setLeaseChecking] = useState(false);
  const leaseRequestToken = useRef(0);

  const propertyOptions = useMemo(
    () => (properties || []).map((property) => ({ ...property, label: getPropertyLabel(property) })),
    [properties]
  );
  const needsUnit = isMultiUnitProperty(selectedProperty);
  const unitOptions = useMemo(() => units.map((unit) => ({ ...unit, label: unit.name || `Unit ${unit.id}` })), [units]);

  const loadChecklists = useCallback(async () => {
    if (!isInitialized) return;

    if (!userId) {
      setChecklists([]);
      setChecklistsError('Your session is not available. Refresh the page and sign in again.');
      setChecklistsLoading(false);
      return;
    }

    setChecklistsLoading(true);
    setChecklistsError('');
    try {
      const response = await getChecklistsByLandlord(userId);
      if (!response?.success) throw new Error(response?.message || 'Unable to load checklists');
      setChecklists(response.data || []);
    } catch (error) {
      setChecklistsError(error?.response?.data?.message || error?.message || 'Unable to load checklists');
    } finally {
      setChecklistsLoading(false);
    }
  }, [isInitialized, userId]);

  useEffect(() => {
    loadChecklists();
  }, [loadChecklists]);

  useEffect(() => {
    setSelectedUnit(null);
    setUnits([]);

    if (!selectedProperty || !isMultiUnitProperty(selectedProperty)) return;

    let active = true;
    const loadUnits = async () => {
      setUnitsLoading(true);
      try {
        const response = await axiosServices.get(`/api/unit/${selectedProperty.id}`);
        if (active) setUnits(response.data?.data || []);
      } catch {
        if (active) {
          openSnackbar({
            open: true,
            message: 'Failed to load units for this property',
            variant: 'alert',
            alert: { color: 'error' }
          });
        }
      } finally {
        if (active) setUnitsLoading(false);
      }
    };

    loadUnits();
    return () => {
      active = false;
    };
  }, [selectedProperty]);

  useEffect(() => {
    leaseRequestToken.current += 1;
    setSelectedLeaseId(null);
    setLeaseDecision('unanswered');
    setLeaseChecking(false);
  }, [selectedProperty?.id, selectedUnit?.id, createType]);

  useEffect(() => {
    setLeases([]);
    setLeasesError('');
    if (!pickerOpen || !selectedProperty?.id) {
      setLeasesLoading(false);
      return;
    }
    let active = true;
    setLeasesLoading(true);
    axiosServices.get(`/api/Lease/property/${selectedProperty.id}/checklist-options`)
      .then((response) => {
        if (!active) return;
        if (!response.data?.success) throw new Error(response.data?.message || 'Could not load leases');
        setLeases(response.data.data || []);
      })
      .catch((error) => { if (active) setLeasesError(error?.response?.data?.message || error.message || 'Could not load leases'); })
      .finally(() => { if (active) setLeasesLoading(false); });
    return () => { active = false; };
  }, [pickerOpen, selectedProperty?.id, leaseRetry]);

  const leaseOptions = useMemo(() => getLeaseOptions(leases, needsUnit ? selectedUnit?.id : null), [leases, needsUnit, selectedUnit?.id]);
  const suggestedLeaseId = useMemo(() => suggestLeaseId(leaseOptions, checklists, createType), [leaseOptions, checklists, createType]);
  const shownLeaseId = leaseDecision === 'unanswered' ? suggestedLeaseId : selectedLeaseId;
  const shownLease = leaseOptions.find(({ lease }) => String(lease.id) === String(shownLeaseId))?.lease;
  const leaseContextReady = Boolean(selectedProperty && (!needsUnit || selectedUnit));

  const handleLeaseSelection = async (leaseId) => {
    const token = ++leaseRequestToken.current;
    setCreateError('');
    if (!leaseId) {
      setSelectedLeaseId(null);
      setLeaseDecision('none');
      return;
    }
    setSelectedLeaseId(leaseId);
    setLeaseDecision('linked');
    const cached = findLinkedChecklist(checklists, leaseId, createType);
    if (cached) {
      navigate(buildChecklistWorkspacePath(cached));
      return;
    }
    setLeaseChecking(true);
    try {
      const response = await getChecklistsByLease(leaseId);
      if (!response?.success) throw new Error(response?.message || 'Could not check linked checklists');
      if (token !== leaseRequestToken.current) return;
      const existingChecklist = findLinkedChecklist(response.data || [], leaseId, createType);
      if (existingChecklist) navigate(buildChecklistWorkspacePath(existingChecklist));
    } catch (error) {
      if (token === leaseRequestToken.current) {
        setLeaseDecision('unanswered');
        setSelectedLeaseId(null);
        setCreateError(error?.response?.data?.message || error.message || 'Could not check linked checklists');
      }
    } finally {
      if (token === leaseRequestToken.current) setLeaseChecking(false);
    }
  };

  const visibleChecklists = useMemo(() => {
    const enriched = enrichChecklistsWithProperties(checklists, properties || []);
    const filtered = filterChecklistPortfolio(enriched, { search, type, status });
    return sortChecklistPortfolio(filtered, sort.key, sort.direction);
  }, [checklists, properties, search, status, type, sort]);

  const handleSort = (key) => {
    setSort((prev) => ({ key, direction: prev.key === key ? (prev.direction === 'asc' ? 'desc' : 'asc') : 'asc' }));
  };

  const hasFilters = Boolean(search) || type !== 'all' || status !== 'all';
  const clearFilters = () => {
    setSearch('');
    setType('all');
    setStatus('all');
  };

  const generatedItems = useMemo(() => isValidFloorPlan(floorCount, floorPlan) ? buildFloorInspectionItems(floorPlan.slice(0, floorCount)) : [], [floorCount, floorPlan]);
  const generatedRoomNames = useMemo(() => [...new Set(generatedItems.map((item) => item.Category))], [generatedItems]);
  const visibleRoomNames = generatedRoomNames.filter((name) => !removedRoomNames.includes(name));
  const roomNames = visibleRoomNames.map((name) => roomNameOverrides[name] ?? name);
  const roomNameErrors = getRoomNameErrors(roomNames);
  const validRoomNames = roomNameErrors.every((error) => !error);

  const closeCreateDrawer = () => {
    if (creating) return;
    setPickerOpen(false);
    setSelectedProperty(null);
    setSelectedUnit(null);
    setCreateType('');
    setFloorCount(null);
    setFloorPlan([]);
    setRoomNameOverrides({});
    setRemovedRoomNames([]);
    setSelectedLeaseId(null);
    setLeaseDecision('unanswered');
    leaseRequestToken.current += 1;
    setCreateError('');
  };

  const createChecklist = async () => {
    if (!createType || !selectedProperty || (needsUnit && !selectedUnit) || !isValidFloorPlan(floorCount, floorPlan) || !visibleRoomNames.length || !validRoomNames || creating || leasesLoading || leasesError || checklistsLoading || checklistsError || leaseChecking || (leaseOptions.length > 0 && leaseDecision === 'unanswered')) return;
    setCreating(true);
    setCreateError('');
    try {
      if (leaseDecision === 'linked' && selectedLeaseId) {
        const existingResponse = await getChecklistsByLease(selectedLeaseId);
        if (!existingResponse?.success) throw new Error(existingResponse?.message || 'Could not check linked checklists');
        const existingChecklist = findLinkedChecklist(existingResponse.data || [], selectedLeaseId, createType);
        if (existingChecklist) {
          navigate(buildChecklistWorkspacePath(existingChecklist));
          return;
        }
      }
      const isMoveIn = createType === 'move-in';
      const home = `${getPropertyLabel(selectedProperty)}${needsUnit ? ` – ${selectedUnit.label}` : ''}`;
      const items = applyRoomNames(removeInspectionRooms(buildFloorInspectionItems(floorPlan.slice(0, floorCount)), removedRoomNames), roomNames);
      const response = await addChecklist({
        ChecklistType: isMoveIn ? 40 : 41,
        PropertyId: selectedProperty.id,
        UnitId: needsUnit ? selectedUnit.id : null,
        LeaseId: leaseDecision === 'linked' ? selectedLeaseId : null,
        Title: `${home} – ${isMoveIn ? 'Move-In' : 'Move-Out'} Checklist`,
        RoomNames: [...new Set(items.map((item) => item.Category))],
        Items: items
      });
      if (!response?.success || !response?.data?.id) throw new Error(response?.message || 'Could not create checklist');
      setChecklists((current) => [response.data, ...current]);
      openSnackbar({ open: true, message: 'Checklist created', variant: 'alert', alert: { color: 'success' } });
      setPickerOpen(false);
      setSelectedProperty(null);
      setSelectedUnit(null);
      setCreateType('');
      setFloorCount(null);
      setFloorPlan([]);
      setRoomNameOverrides({});
      setRemovedRoomNames([]);
      setSelectedLeaseId(null);
      setLeaseDecision('unanswered');
      navigate(buildChecklistWorkspacePath(response.data));
    } catch (error) {
      if (leaseDecision === 'linked' && selectedLeaseId) {
        try {
          const latest = await getChecklistsByLease(selectedLeaseId);
          const existingChecklist = latest?.success && findLinkedChecklist(latest.data || [], selectedLeaseId, createType);
          if (existingChecklist) {
            navigate(buildChecklistWorkspacePath(existingChecklist));
            return;
          }
        } catch {
          // Keep the original create error if the follow-up lookup also fails.
        }
      }
      setCreateError(error?.response?.data?.message || error?.message || 'Could not create checklist');
    } finally {
      setCreating(false);
    }
  };

  return (
    <Box sx={{ pb: 3 }}>
      <Box sx={{ display: { xs: 'none', md: 'block' } }}>
        <PageBreadcrumbs items={[{ label: 'Dashboard', path: '/landlord/dashboard' }, { label: 'Checklists' }]} />
      </Box>

      <Stack
        direction={{ xs: 'column', sm: 'row' }}
        alignItems={{ sm: 'center' }}
        justifyContent="space-between"
        spacing={2}
        sx={{ mb: 2.5 }}
      >
        <Box>
          <Typography variant="h3" sx={{ color: headingColor, fontWeight: 750, letterSpacing: -0.4 }}>
            Checklists
          </Typography>
          <Typography sx={{ mt: 0.6, color: headingColor, fontSize: '0.88rem' }}>
            Track move-in and move-out inspections across every home in your portfolio.
          </Typography>
        </Box>
        <Button
          variant="contained"
          color="success"
          startIcon={<PlusOutlined />}
          onClick={() => setPickerOpen(true)}
          sx={{ alignSelf: { xs: 'flex-start', sm: 'center' }, textTransform: 'none', fontWeight: 700, boxShadow: 'none' }}
        >
          Create checklist
        </Button>
      </Stack>

      <Box
        sx={{
          bgcolor: 'background.paper',
          border: `1px solid ${alpha(theme.palette.divider, 0.16)}`,
          borderRadius: 3,
          boxShadow: `0 8px 28px ${alpha('#061e35', 0.055)}`,
          overflow: 'hidden'
        }}
      >
        <Box sx={{ p: { xs: 1.5, md: 2 } }}>
          <Stack direction={{ xs: 'column', md: 'row' }} spacing={1.1} alignItems={{ md: 'center' }}>
            <OutlinedInput
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Search homes, units, tenants, or checklists"
              size="small"
              startAdornment={
                <InputAdornment position="start">
                  <SearchOutlined />
                </InputAdornment>
              }
              sx={{ flex: 1, minWidth: { md: 280 }, borderRadius: 1.75 }}
              inputProps={{ 'aria-label': 'Search checklists' }}
            />
            <Stack direction="row" spacing={1} sx={{ overflowX: 'auto', pb: { xs: 0.25, md: 0 } }}>
              <Select
                size="small"
                value={type}
                onChange={(event) => setType(event.target.value)}
                IconComponent={DownOutlined}
                sx={{ minWidth: 146, borderRadius: 1.75 }}
                inputProps={{ 'aria-label': 'Checklist type' }}
              >
                <MenuItem value="all">All types</MenuItem>
                <MenuItem value="move-in">Move-in</MenuItem>
                <MenuItem value="move-out">Move-out</MenuItem>
              </Select>
              <Select
                size="small"
                value={status}
                onChange={(event) => setStatus(event.target.value)}
                IconComponent={DownOutlined}
                sx={{ minWidth: 148, borderRadius: 1.75 }}
                inputProps={{ 'aria-label': 'Checklist status' }}
              >
                <MenuItem value="all">All statuses</MenuItem>
                <MenuItem value="in-progress">In progress</MenuItem>
                <MenuItem value="completed">Completed</MenuItem>
              </Select>
              <Select
                size="small"
                value={sort.key}
                onChange={(event) => setSort({ key: event.target.value, direction: event.target.value === 'created' ? 'desc' : 'asc' })}
                sx={{ display: { xs: 'flex', lg: 'none' }, minWidth: 140, borderRadius: 1.75 }}
                inputProps={{ 'aria-label': 'Sort checklists by' }}
              >
                <MenuItem value="created">Created date</MenuItem>
                {['Home', 'Checklist', 'Lease', 'Progress', 'Inspection', 'Status'].map((label) => (
                  <MenuItem key={label} value={label.toLowerCase()}>{label}</MenuItem>
                ))}
              </Select>
              <Button
                size="small"
                variant="outlined"
                aria-label={`Sort ${sort.direction === 'asc' ? 'ascending' : 'descending'}; reverse order`}
                onClick={() => handleSort(sort.key)}
                sx={{ display: { xs: 'inline-flex', lg: 'none' }, minWidth: 40, borderRadius: 1.75 }}
              >
                {sort.direction === 'asc' ? '↑' : '↓'}
              </Button>
            </Stack>
          </Stack>
          <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mt: 1.4 }}>
            <Typography sx={{ fontSize: '0.76rem', color: 'text.secondary' }}>
              {visibleChecklists.length} of {checklists.length} checklists
            </Typography>
            {hasFilters && (
              <Button size="small" onClick={clearFilters} sx={{ textTransform: 'none' }}>
                Reset view
              </Button>
            )}
          </Stack>
        </Box>

        <Divider />

        <Box role="table" aria-label="Portfolio checklists" aria-busy={checklistsLoading}>
          <Box
            role="row"
            sx={{
              display: 'grid',
              gridTemplateColumns: {
                xs: 'minmax(0, 1fr)',
                lg: 'minmax(190px, 1.65fr) minmax(130px, .9fr) minmax(145px, 1fr) minmax(140px, 1fr) minmax(100px, .75fr) minmax(175px, 1.2fr) 24px'
              },
              gap: 1.5,
              position: { xs: 'absolute', lg: 'static' },
              width: { xs: 1, lg: 'auto' },
              height: { xs: 1, lg: 'auto' },
              p: { xs: 0, lg: undefined },
              px: { lg: 2 },
              py: { lg: 1.15 },
              m: { xs: -1, lg: 0 },
              overflow: { xs: 'hidden', lg: 'visible' },
              clip: { xs: 'rect(0, 0, 0, 0)', lg: 'auto' },
              clipPath: { xs: 'inset(50%)', lg: 'none' },
              whiteSpace: { xs: 'nowrap', lg: 'normal' },
              bgcolor: alpha(theme.palette.primary.main, 0.025)
            }}
          >
            {['Home', 'Checklist', 'Lease', 'Progress', 'Inspection', 'Status'].map((label) => {
              const key = label.toLowerCase();
              const active = sort.key === key;
              return (
                <Box key={key} role="columnheader" aria-sort={sort.key === key ? (sort.direction === 'asc' ? 'ascending' : 'descending') : 'none'}>
                  <Button
                    size="small"
                    color="inherit"
                    onClick={() => handleSort(key)}
                    aria-label={`Sort by ${label}${active ? `, ${sort.direction === 'asc' ? 'ascending' : 'descending'}` : ''}`}
                    sx={{ p: 0, minWidth: 0, justifyContent: 'flex-start', textTransform: 'uppercase', fontSize: '0.66rem', fontWeight: 750, letterSpacing: 0.65, color: active ? 'text.primary' : 'text.secondary' }}
                  >
                    {label}{active && <Box component="span" aria-hidden="true" sx={{ ml: 0.5 }}>{sort.direction === 'asc' ? '↑' : '↓'}</Box>}
                  </Button>
                </Box>
              );
            })}
            <Box role="columnheader" />
          </Box>

          {checklistsLoading ? (
            <Stack alignItems="center" spacing={1} sx={{ py: 8 }}>
              <CircularProgress size={26} />
              <Typography sx={{ fontSize: '0.82rem', color: 'text.secondary' }}>Loading checklists…</Typography>
            </Stack>
          ) : checklistsError ? (
            <Box sx={{ p: 2 }}>
              <Alert
                severity="error"
                action={
                  <Button color="inherit" size="small" onClick={loadChecklists}>
                    Try again
                  </Button>
                }
              >
                {checklistsError}
              </Alert>
            </Box>
          ) : visibleChecklists.length === 0 ? (
            <Stack alignItems="center" textAlign="center" spacing={1.25} sx={{ px: 2, py: 8 }}>
              <Box
                sx={{
                  width: 48,
                  height: 48,
                  borderRadius: 2,
                  bgcolor: alpha(theme.palette.primary.main, 0.08),
                  color: 'primary.main',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center'
                }}
              >
                <AuditOutlined style={{ fontSize: 23 }} />
              </Box>
              <Typography variant="h5" fontWeight={700}>
                {hasFilters ? 'No checklists match this view' : 'No checklists yet'}
              </Typography>
              <Typography variant="body2" color="text.secondary" sx={{ maxWidth: 430 }}>
                {hasFilters
                  ? 'Try a different search or reset the filters.'
                  : 'Create a move-in or move-out checklist for a property or unit.'}
              </Typography>
              {hasFilters ? (
                <Button onClick={clearFilters} sx={{ textTransform: 'none' }}>
                  Reset view
                </Button>
              ) : (
                <Button
                  variant="contained"
                  color="success"
                  onClick={() => setPickerOpen(true)}
                  sx={{ textTransform: 'none', fontWeight: 700 }}
                >
                  Create checklist
                </Button>
              )}
            </Stack>
          ) : (
            visibleChecklists.map((checklist) => {
              const progress = getChecklistProgress(checklist);
              const checklistStatus = getChecklistStatus(checklist);
              const workspacePath = buildChecklistWorkspacePath(checklist);
              const checklistLabel = getChecklistTypeLabel(checklist);
              const leaseDates = [checklist.leaseStartDate, checklist.leaseEndDate].filter(Boolean).map(formatDate2).join(' – ');
              const dateSummary = getChecklistDateSummary(checklist);

              return (
                <Box
                  key={checklist.id}
                  role="row"
                  onClick={() => navigate(workspacePath)}
                  sx={{
                    px: { xs: 1.5, lg: 2 },
                    py: { xs: 1.65, lg: 1.45 },
                    display: 'grid',
                    gridTemplateColumns: {
                      xs: 'minmax(0, 1fr)',
                      lg: 'minmax(190px, 1.65fr) minmax(130px, .9fr) minmax(145px, 1fr) minmax(140px, 1fr) minmax(100px, .75fr) minmax(175px, 1.2fr) 24px'
                    },
                    gap: { xs: 1.35, lg: 1.5 },
                    alignItems: 'center',
                    cursor: 'pointer',
                    borderBottom: `1px solid ${alpha(theme.palette.divider, 0.13)}`,
                    transition: 'background-color 140ms ease',
                    '&:hover': { bgcolor: alpha(theme.palette.primary.main, theme.palette.mode === 'dark' ? 0.08 : 0.028) },
                    '&:last-of-type': { borderBottom: 0 }
                  }}
                >
                  <Stack role="cell" direction="row" spacing={1.2} alignItems="center" minWidth={0}>
                    <Box
                      sx={{
                        width: 42,
                        height: 42,
                        borderRadius: 1.6,
                        bgcolor: alpha(headingColor, theme.palette.mode === 'dark' ? 0.14 : 0.07),
                        color: headingColor,
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        flexShrink: 0
                      }}
                    >
                      <HomeOutlined style={{ fontSize: 18 }} />
                    </Box>
                    <Box minWidth={0}>
                      <Link
                        component={RouterLink}
                        to={workspacePath}
                        onClick={(event) => event.stopPropagation()}
                        aria-label={`Open ${checklistLabel} for ${checklist.propertyName || `Property ${checklist.propertyId}`}`}
                        color="inherit"
                        underline="hover"
                        sx={{ display: 'block', fontWeight: 700, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}
                      >
                        {checklist.propertyName || `Property ${checklist.propertyId}`}
                      </Link>
                      <Typography noWrap sx={{ mt: 0.25, fontSize: '0.75rem', color: 'text.secondary' }}>
                        {[checklist.unitName, checklist.propertyAddress].filter(Boolean).join(' · ') || 'Whole property'}
                      </Typography>
                    </Box>
                  </Stack>

                  <Box role="cell">
                    <Typography sx={{ fontSize: '0.8rem', fontWeight: 650 }}>{checklistLabel}</Typography>
                  </Box>

                  <Box role="cell">
                    <Typography sx={{ fontSize: '0.8rem', fontWeight: 650 }}>{leaseDates || 'No lease dates'}</Typography>
                  </Box>

                  <Box role="cell">
                    <Stack direction="row" justifyContent="space-between" alignItems="center">
                      <Typography sx={{ fontSize: '0.75rem', fontWeight: 650 }}>
                        {progress.completed} of {progress.total}
                      </Typography>
                      <Typography sx={{ fontSize: '0.7rem', color: 'text.secondary' }}>{progress.percent}%</Typography>
                    </Stack>
                    <LinearProgress
                      variant="determinate"
                      value={progress.percent}
                      aria-label={`${progress.percent}% complete`}
                      sx={{
                        mt: 0.7,
                        height: 6,
                        borderRadius: 8,
                        bgcolor: alpha(theme.palette.divider, 0.15),
                        '& .MuiLinearProgress-bar': { borderRadius: 8, bgcolor: '#061E35' }
                      }}
                    />
                  </Box>

                  <Box role="cell">
                    <Typography sx={{ fontSize: '0.78rem', fontWeight: 600 }}>
                      {dateSummary.value ? formatDate2(dateSummary.value) : 'Not scheduled'}
                    </Typography>
                    <Typography sx={{ mt: 0.25, fontSize: '0.7rem', color: 'text.secondary' }}>{dateSummary.label}</Typography>
                  </Box>

                  <Box role="cell">
                    <Chip
                      size="small"
                      label={checklistStatus.label}
                      color={checklistStatus.color}
                      variant={checklistStatus.completed ? 'filled' : 'outlined'}
                      sx={{ width: 'fit-content', fontWeight: 650 }}
                    />
                  </Box>

                  <Box role="cell" sx={{ display: { xs: 'none', lg: 'flex' } }}>
                    <RightOutlined style={{ color: theme.palette.text.secondary, fontSize: 13 }} />
                  </Box>
                </Box>
              );
            })
          )}
        </Box>
      </Box>

      <ThemeAdaptiveDrawer
        anchor="right"
        open={pickerOpen}
        onClose={closeCreateDrawer}
        PaperProps={{ sx: { width: { xs: '100%', sm: 480 }, bgcolor: 'background.paper', backgroundImage: 'none' } }}
      >
        <Stack sx={{ height: '100%' }}>
          <Stack direction="row" alignItems="center" justifyContent="space-between" sx={{ px: 3, py: 2.5, borderBottom: 1, borderColor: 'divider' }}>
            <Box>
              <Typography variant="h4" fontWeight={750}>Create checklist</Typography>
              <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
                Choose the inspection type and the home it belongs to.
              </Typography>
            </Box>
            <IconButton aria-label="Close create checklist" onClick={closeCreateDrawer} disabled={creating}><CloseOutlined /></IconButton>
          </Stack>
          <Stack spacing={2.25} sx={{ flex: 1, overflowY: 'auto', px: 3, py: 3 }}>
            <Autocomplete
              label="Checklist type"
              options={checklistTypeOptions}
              width="100%"
              value={checklistTypeOptions.find((option) => option.value === createType) || null}
              onChange={(_, option) => setCreateType(option?.value || '')}
              isOptionEqualToValue={(option, value) => option.value === value.value}
              getOptionLabel={(option) => option?.label || ''}
              disablePortal={false}
            />
            <Stack spacing={0.75}>
              <Autocomplete
                label="Property"
                options={propertyOptions}
                width="100%"
                value={selectedProperty}
                onChange={(_, property) => { setSelectedProperty(property); setSelectedUnit(null); setCreateError(''); }}
                isOptionEqualToValue={(option, value) => String(option.id) === String(value.id)}
                getOptionLabel={(option) => option?.label || ''}
                loading={propertiesLoading}
                disabled={propertiesLoading}
                disablePortal={false}
                renderOption={(props, option) => {
                  const { key, ...optionProps } = props;
                  const address = getPropertyAddress(option);
                  return (
                    <Box component="li" key={key} {...optionProps} sx={{ py: 1.25, alignItems: 'flex-start !important' }}>
                      <Box>
                        <Typography variant="body2" fontWeight={700}>
                          {option.label}
                        </Typography>
                        {address && address !== option.label && (
                          <Typography variant="caption" color="text.secondary">
                            {address}
                          </Typography>
                        )}
                      </Box>
                    </Box>
                  );
                }}
              />
              {!propertiesLoading && propertyOptions.length === 0 && (
                <Typography variant="caption" color="text.secondary">
                  Add a property before creating a checklist.
                </Typography>
              )}
            </Stack>

            {needsUnit && (
              <Stack spacing={0.75}>
                <Autocomplete
                  label="Unit"
                  options={unitOptions}
                  width="100%"
                  value={selectedUnit}
                  onChange={(_, unit) => setSelectedUnit(unit)}
                  isOptionEqualToValue={(option, value) => String(option.id) === String(value.id)}
                  getOptionLabel={(option) => option?.label || ''}
                  loading={unitsLoading}
                  disabled={unitsLoading || unitOptions.length === 0}
                  disablePortal={false}
                />
                {unitsLoading && (
                  <Stack direction="row" spacing={1} alignItems="center">
                    <CircularProgress size={13} />
                    <Typography variant="caption" color="text.secondary">
                      Loading units…
                    </Typography>
                  </Stack>
                )}
                {!unitsLoading && selectedProperty && unitOptions.length === 0 && (
                  <Typography variant="caption" color="text.secondary">
                    No units were found for this property.
                  </Typography>
                )}
              </Stack>
            )}
            {leaseContextReady && (
              <Stack spacing={0.9} component="section" aria-label="Checklist lease">
                {leasesLoading || checklistsLoading ? (
                  <Stack direction="row" spacing={1} alignItems="center"><CircularProgress size={15} /><Typography variant="body2">Checking leases and linked checklists…</Typography></Stack>
                ) : leasesError ? (
                  <Alert severity="error" action={<Button size="small" onClick={() => setLeaseRetry((value) => value + 1)}>Retry</Button>}>{leasesError}</Alert>
                ) : checklistsError ? (
                  <Alert severity="error">Could not check linked checklists. Refresh this page before creating.</Alert>
                ) : leaseOptions.length > 0 ? (
                  <>
                    <Typography variant="subtitle2" fontWeight={700}>
                      {shownLease ? `Is this checklist for lease #${shownLease.id}?` : 'Which lease is this checklist for?'}
                    </Typography>
                    {shownLease && <Typography variant="body2" color="text.secondary">{leaseDates(shownLease)}</Typography>}
                    <FormControl size="small" fullWidth>
                      <Select
                        value={shownLeaseId ?? ''}
                        displayEmpty
                        renderValue={(value) => value ? `Lease #${value}` : leaseDecision === 'none' ? 'No lease' : 'Choose a lease or no lease'}
                        inputProps={{ 'aria-label': 'Lease for checklist' }}
                        disabled={leaseChecking || creating}
                        onChange={(event) => handleLeaseSelection(event.target.value || null)}
                      >
                        <MenuItem value="">No lease — create unlinked checklist</MenuItem>
                        {leaseOptions.map(({ lease, status: leaseStatus }) => {
                          const linked = findLinkedChecklist(checklists, lease.id, createType);
                          return (
                            <MenuItem key={lease.id} value={lease.id}>
                              <Stack spacing={0.2} sx={{ py: 0.35 }}>
                                <Typography variant="body2" fontWeight={650}>Lease #{lease.id} · {leaseStatus}{linked ? ` · Already linked to a ${createType} checklist` : ''}</Typography>
                                <Typography variant="caption" color="text.secondary">{leaseDates(lease)}</Typography>
                              </Stack>
                            </MenuItem>
                          );
                        })}
                      </Select>
                    </FormControl>
                    {leaseDecision === 'unanswered' && suggestedLeaseId && (
                      <Button size="small" variant="outlined" onClick={() => handleLeaseSelection(suggestedLeaseId)} disabled={leaseChecking} sx={{ alignSelf: 'flex-start', textTransform: 'none' }}>
                        Yes, use lease #{suggestedLeaseId}
                      </Button>
                    )}
                    {leaseChecking && <Typography variant="caption" color="text.secondary">Checking for an existing checklist…</Typography>}
                    {leaseDecision === 'unanswered' && <Typography variant="caption" color="text.secondary">Confirm the suggested lease, select another, or choose No lease before creating.</Typography>}
                  </>
                ) : <Typography variant="body2" color="text.secondary">No leases found for this home. You can create an unlinked checklist.</Typography>}
              </Stack>
            )}
            <MuiAutocomplete
              size="small"
              fullWidth
              options={floorOptions}
              filterOptions={limitedFloorOptions}
              value={floorCount ? String(floorCount) : null}
              onChange={(_, value) => {
                const count = value ? Number(value) : null;
                setFloorCount(count);
                setFloorPlan((current) => count
                  ? Array.from({ length: count }, (_, index) => current[index] || { bedrooms: '', bathrooms: '' })
                  : []);
              }}
              renderInput={(params) => (
                <TextField
                  {...params}
                  label="How many floors"
                  required
                  helperText="Select the number of floors in this home (up to 20)."
                  inputProps={{ ...params.inputProps, inputMode: 'numeric' }}
                />
              )}
            />
            {floorCount && (
              <Typography variant="caption" color="text.secondary" sx={{ mt: -1 }}>
                Enter 0 for rooms a floor does not have. Bathrooms can include a half bath (for example, 1.5). Up to 20 bedrooms and 20.5 bathrooms per floor.
              </Typography>
            )}
            {floorPlan.slice(0, floorCount).map((floor, index) => (
              <Box
                key={index}
                component="section"
                aria-label={floorLabel(index + 1)}
                sx={{ p: 2, border: 1, borderColor: 'divider', borderRadius: 1.5, bgcolor: (theme) => alpha(theme.palette.primary.main, 0.025) }}
              >
                <Typography variant="subtitle1" fontWeight={700} sx={{ mb: 1.5 }}>{floorLabel(index + 1)}</Typography>
                <Stack direction="row" spacing={1.5}>
                  {[
                    { key: 'bedrooms', label: 'Bedrooms' },
                    { key: 'bathrooms', label: 'Bathrooms' }
                  ].map(({ key, label }) => (
                    <TextField
                      key={key}
                      size="small"
                      type="number"
                      label={label}
                      required
                      value={floor[key]}
                      onChange={(event) => {
                        const value = event.target.value;
                        setFloorPlan((current) => current.map((entry, position) => position === index ? { ...entry, [key]: value } : entry));
                      }}
                      inputProps={{ min: 0, max: key === 'bathrooms' ? MAX_ROOMS_PER_FLOOR + 0.5 : MAX_ROOMS_PER_FLOOR, step: key === 'bathrooms' ? 0.5 : 1 }}
                      error={floor[key] !== '' && (key === 'bathrooms' ? !isValidBathroomCount(floor[key]) : (!/^\d+$/.test(floor[key]) || Number(floor[key]) > MAX_ROOMS_PER_FLOOR))}
                      sx={{ flex: 1, minWidth: 0 }}
                    />
                  ))}
                </Stack>
              </Box>
            ))}
            {generatedRoomNames.length > 0 && (
              <Stack spacing={1.25} component="section" aria-label="Room names">
                <Box>
                  <Typography variant="subtitle1" fontWeight={700}>Room names</Typography>
                  <Typography variant="caption" color="text.secondary">Edit any room name before creating the checklist. Names must be unique.</Typography>
                </Box>
                {visibleRoomNames.map((originalName, index) => (
                  <Stack key={originalName} direction="row" spacing={1} alignItems="flex-start">
                    <TextField
                      size="small"
                      fullWidth
                      label={originalName}
                      aria-label={`Name for ${originalName}`}
                      value={roomNames[index]}
                      onChange={(event) => setRoomNameOverrides((current) => ({ ...current, [originalName]: event.target.value }))}
                      error={Boolean(roomNameErrors[index])}
                      helperText={roomNameErrors[index] || ' '}
                      sx={{ minWidth: 0 }}
                    />
                    <IconButton
                      aria-label={`Remove ${originalName} room`}
                      color="error"
                      disabled={creating}
                      onClick={() => setRemovedRoomNames((current) => [...current, originalName])}
                      sx={{ flexShrink: 0, width: 40, height: 40 }}
                    >
                      <DeleteOutlined />
                    </IconButton>
                  </Stack>
                ))}
                {visibleRoomNames.length === 0 && (
                  <Typography variant="body2" color="text.secondary">All rooms removed. Change the floor counts to add rooms before creating.</Typography>
                )}
              </Stack>
            )}
            {createError && <Alert severity="error">{createError}</Alert>}
          </Stack>
          <Stack direction="row" spacing={1} justifyContent="flex-end" sx={{ px: 3, py: 2.5, borderTop: 1, borderColor: 'divider' }}>
            <Button onClick={closeCreateDrawer} disabled={creating} sx={{ textTransform: 'none' }}>
              Cancel
            </Button>
            <Button
              variant="contained"
              color="success"
              startIcon={creating ? <CircularProgress size={16} color="inherit" /> : <PlusOutlined />}
              onClick={createChecklist}
              disabled={creating || !createType || !selectedProperty || (needsUnit && (!selectedUnit || unitsLoading)) || leasesLoading || Boolean(leasesError) || checklistsLoading || Boolean(checklistsError) || leaseChecking || (leaseOptions.length > 0 && leaseDecision === 'unanswered') || (leaseDecision === 'linked' && !shownLease) || !isValidFloorPlan(floorCount, floorPlan) || !visibleRoomNames.length || !validRoomNames}
              sx={{ textTransform: 'none', fontWeight: 700 }}
            >
              Create checklist
            </Button>
          </Stack>
        </Stack>
      </ThemeAdaptiveDrawer>
    </Box>
  );
}
