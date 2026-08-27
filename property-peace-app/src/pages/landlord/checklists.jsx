import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Alert,
  alpha,
  Box,
  Button,
  Chip,
  CircularProgress,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Divider,
  InputAdornment,
  LinearProgress,
  Link,
  MenuItem,
  OutlinedInput,
  Select,
  Stack,
  Typography,
  useTheme
} from '@mui/material';
import {
  AuditOutlined,
  CheckCircleOutlined,
  ClockCircleOutlined,
  DownOutlined,
  HomeOutlined,
  RightOutlined,
  SearchOutlined
} from '@ant-design/icons';
import { useSelector } from 'react-redux';
import { Link as RouterLink, useNavigate } from 'react-router-dom';

import { getChecklistsByLandlord } from 'api/checklist';
import { openSnackbar } from 'api/snackbar';
import Autocomplete from 'components/@extended/AutoComplete';
import PageBreadcrumbs from 'components/breadcrumbs/PageBreadcrumbs';
import useFetchProperties from 'hooks/useFetchProperties';
import { selectCurrentUser, selectIsLoadingAuth } from 'store/user/user.selector';
import axiosServices from 'utils/axios';
import {
  buildChecklistWorkspacePath,
  enrichChecklistsWithProperties,
  filterChecklistPortfolio,
  getChecklistDateSummary,
  getChecklistProgress
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

export default function ChecklistsPage() {
  const navigate = useNavigate();
  const theme = useTheme();
  const currentUser = useSelector(selectCurrentUser);
  const authLoading = useSelector(selectIsLoadingAuth);
  const { properties, isLoading: propertiesLoading } = useFetchProperties();
  const userId = currentUser?.id ?? currentUser?.Id;
  const headingColor = theme.palette.mode === 'dark' ? theme.palette.text.primary : '#061e35';

  const [checklists, setChecklists] = useState([]);
  const [checklistsLoading, setChecklistsLoading] = useState(true);
  const [checklistsError, setChecklistsError] = useState('');
  const [search, setSearch] = useState('');
  const [type, setType] = useState('all');
  const [status, setStatus] = useState('all');
  const [pickerOpen, setPickerOpen] = useState(false);
  const [selectedProperty, setSelectedProperty] = useState(null);
  const [selectedUnit, setSelectedUnit] = useState(null);
  const [units, setUnits] = useState([]);
  const [unitsLoading, setUnitsLoading] = useState(false);

  const propertyOptions = useMemo(
    () => (properties || []).map((property) => ({ ...property, label: getPropertyLabel(property) })),
    [properties]
  );
  const needsUnit = isMultiUnitProperty(selectedProperty);
  const unitOptions = useMemo(() => units.map((unit) => ({ ...unit, label: unit.name || `Unit ${unit.id}` })), [units]);

  const loadChecklists = useCallback(async () => {
    if (authLoading) return;

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
  }, [authLoading, userId]);

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

  const visibleChecklists = useMemo(() => {
    const enriched = enrichChecklistsWithProperties(checklists, properties || []);
    const filtered = filterChecklistPortfolio(enriched, { search, type, status });
    return [...filtered].sort((a, b) => {
      if (a.isCompleted !== b.isCompleted) return a.isCompleted ? 1 : -1;
      const aDate = new Date(a.updatedAt || a.inspectionDate || a.createdAt || 0).getTime();
      const bDate = new Date(b.updatedAt || b.inspectionDate || b.createdAt || 0).getTime();
      return bDate - aDate;
    });
  }, [checklists, properties, search, status, type]);

  const hasFilters = Boolean(search) || type !== 'all' || status !== 'all';
  const clearFilters = () => {
    setSearch('');
    setType('all');
    setStatus('all');
  };

  const openSelectedHome = () => {
    if (!selectedProperty || (needsUnit && !selectedUnit)) return;
    const basePath = `/landlord/checklists/property/${selectedProperty.id}`;
    navigate(needsUnit ? `${basePath}/unit/${selectedUnit.id}` : basePath);
    setPickerOpen(false);
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
          startIcon={<HomeOutlined />}
          onClick={() => setPickerOpen(true)}
          sx={{ alignSelf: { xs: 'flex-start', sm: 'center' }, textTransform: 'none', fontWeight: 700, boxShadow: 'none' }}
        >
          Open a home
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
                lg: 'minmax(190px, 1.65fr) minmax(125px, .9fr) minmax(140px, 1fr) minmax(140px, 1fr) minmax(100px, .75fr) minmax(100px, .7fr) 24px'
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
            {['Home', 'Checklist', 'Tenant / lease', 'Progress', 'Inspection', 'Status', ''].map((label) => (
              <Typography
                key={label || 'open'}
                role="columnheader"
                sx={{ fontSize: '0.66rem', fontWeight: 750, letterSpacing: 0.65, textTransform: 'uppercase', color: 'text.secondary' }}
              >
                {label}
              </Typography>
            ))}
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
                  : 'Open a home to review its inspection workspace and available checklists.'}
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
                  Open a home
                </Button>
              )}
            </Stack>
          ) : (
            visibleChecklists.map((checklist) => {
              const progress = getChecklistProgress(checklist);
              const workspacePath = buildChecklistWorkspacePath(checklist);
              const isMoveIn =
                Number(checklist.checklistType) === 40 ||
                String(checklist.checklistTypeName || checklist.title || '')
                  .toLowerCase()
                  .includes('move-in');
              const checklistLabel =
                checklist.checklistTypeName || checklist.title || (isMoveIn ? 'Move-in checklist' : 'Move-out checklist');
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
                      lg: 'minmax(190px, 1.65fr) minmax(125px, .9fr) minmax(140px, 1fr) minmax(140px, 1fr) minmax(100px, .75fr) minmax(100px, .7fr) 24px'
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

                  <Stack role="cell" direction="row" spacing={0.75} alignItems="center">
                    {isMoveIn ? (
                      <CheckCircleOutlined style={{ color: theme.palette.success.main }} />
                    ) : (
                      <AuditOutlined style={{ color: theme.palette.primary.main }} />
                    )}
                    <Typography sx={{ fontSize: '0.8rem', fontWeight: 650 }}>{checklistLabel}</Typography>
                  </Stack>

                  <Box role="cell">
                    <Typography sx={{ fontSize: '0.8rem', fontWeight: 650 }}>{checklist.tenantName || 'No tenant assigned'}</Typography>
                    <Typography sx={{ mt: 0.25, fontSize: '0.7rem', color: 'text.secondary' }}>{leaseDates || 'No lease dates'}</Typography>
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
                        '& .MuiLinearProgress-bar': { borderRadius: 8, bgcolor: checklist.isCompleted ? 'success.main' : 'primary.main' }
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
                      icon={checklist.isCompleted ? <CheckCircleOutlined /> : <ClockCircleOutlined />}
                      label={checklist.isCompleted ? 'Completed' : 'In progress'}
                      color={checklist.isCompleted ? 'success' : 'warning'}
                      variant={checklist.isCompleted ? 'filled' : 'outlined'}
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

      <Dialog open={pickerOpen} onClose={() => setPickerOpen(false)} fullWidth maxWidth="sm">
        <DialogTitle sx={{ pb: 1 }}>
          <Typography variant="h4" fontWeight={750}>
            Open checklists by home
          </Typography>
          <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5, fontWeight: 400 }}>
            Choose a property and unit to open its complete inspection workspace.
          </Typography>
        </DialogTitle>
        <DialogContent sx={{ pt: '16px !important' }}>
          <Stack spacing={2.25}>
            <Stack spacing={0.75}>
              <Autocomplete
                label="Property"
                options={propertyOptions}
                width="100%"
                value={selectedProperty}
                onChange={(_, property) => setSelectedProperty(property)}
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
                  Add a property before opening checklists.
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
          </Stack>
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2.5 }}>
          <Button onClick={() => setPickerOpen(false)} sx={{ textTransform: 'none' }}>
            Cancel
          </Button>
          <Button
            variant="contained"
            color="success"
            endIcon={<RightOutlined />}
            onClick={openSelectedHome}
            disabled={!selectedProperty || (needsUnit && !selectedUnit)}
            sx={{ textTransform: 'none', fontWeight: 700 }}
          >
            Open home
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}
