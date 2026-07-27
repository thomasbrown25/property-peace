import { useEffect, useMemo, useState } from 'react';
import {
  alpha,
  Avatar,
  Box,
  Button,
  Chip,
  CircularProgress,
  Divider,
  Grid,
  IconButton,
  InputAdornment,
  LinearProgress,
  Menu,
  MenuItem,
  OutlinedInput,
  Pagination,
  Select,
  Stack,
  Tooltip,
  Typography,
  useTheme
} from '@mui/material';
import {
  ArrowRightOutlined,
  CalendarOutlined,
  DownOutlined,
  HomeOutlined,
  MoreOutlined,
  PlusOutlined,
  SearchOutlined,
  ToolOutlined,
  WarningOutlined
} from '@ant-design/icons';
import { useDispatch, useSelector } from 'react-redux';
import { useNavigate } from 'react-router-dom';

import PageBreadcrumbs from 'components/breadcrumbs/PageBreadcrumbs';
import LeaseAddDrawer from 'components/drawers/LeaseAddDrawer';
import { PropertyCsvImportButton } from 'components/import/CsvImportButtons';
import PropertiesEmptyState from 'sections/landlord/properties/PropertiesEmptyState';
import useFetchProperties from 'hooks/useFetchProperties';
import { useDashboardLoading } from 'contexts/DashboardLoadingContext';
import { useDrawer } from 'contexts/DrawerContext';
import { setProperty } from 'store/property/property.action';
import { selectProperties } from 'store/property/property.selector';
import { isHighPriorityMaintenanceRequest } from 'utils/maintenanceStatus';
import placeholderImage from 'assets/images/placeholder-house.png';

const PAGE_SIZE = 10;

const read = (object, camel, pascal) => object?.[camel] ?? object?.[pascal];
const getId = (property) => read(property, 'id', 'Id');
const getUnits = (property) => read(property, 'units', 'Units') || [];
const getMaintenance = (property) => read(property, 'maintenanceRequests', 'MaintenanceRequests') || [];
const getLease = (unit) => read(unit, 'lease', 'Lease');
const getUnitStatus = (unit) => String(read(unit, 'status', 'Status') || '').toLowerCase();
const isOccupiedUnit = (unit) => ['occupied', 'overdue'].includes(getUnitStatus(unit));
const isOverdueUnit = (unit) => getUnitStatus(unit) === 'overdue';
const isActiveProperty = (property) => read(property, 'isActive', 'IsActive') !== false;

function getRentAmount(unit) {
  const lease = getLease(unit);
  return Number(read(lease, 'rentAmount', 'RentAmount') || read(unit, 'rentAmount', 'RentAmount') || 0);
}

function getLeaseEnd(unit) {
  const lease = getLease(unit);
  const value = read(lease, 'endDate', 'EndDate');
  const date = value ? new Date(value) : null;
  return date && !Number.isNaN(date.getTime()) ? date : null;
}

function getPropertySummary(property) {
  const units = getUnits(property);
  const occupied = units.filter(isOccupiedUnit).length;
  const overdue = units.filter(isOverdueUnit).length;
  const vacant = Math.max(units.length - occupied, 0);
  const rentRoll = units.reduce((total, unit) => total + getRentAmount(unit), 0);
  const urgentMaintenance = getMaintenance(property).filter(isHighPriorityMaintenanceRequest).length;
  const leaseEnds = units.map(getLeaseEnd).filter(Boolean).sort((a, b) => a - b);
  const nextLeaseEnd = leaseEnds.find((date) => date >= new Date()) || leaseEnds[0] || null;
  const daysToLeaseEnd = nextLeaseEnd ? Math.ceil((nextLeaseEnd.getTime() - Date.now()) / 86400000) : null;
  const expiringSoon = daysToLeaseEnd !== null && daysToLeaseEnd >= 0 && daysToLeaseEnd <= 60;
  const attentionScore = overdue * 3 + urgentMaintenance * 2 + (expiringSoon ? 1 : 0);

  return {
    units,
    occupied,
    overdue,
    vacant,
    rentRoll,
    urgentMaintenance,
    nextLeaseEnd,
    daysToLeaseEnd,
    expiringSoon,
    attentionScore
  };
}

function formatMoney(value) {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    maximumFractionDigits: 0
  }).format(value || 0);
}

function formatDate(value) {
  if (!value) return 'No lease date';
  return value.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

function SummaryCard({ label, value, helper, icon, color, active, onClick }) {
  const theme = useTheme();

  return (
    <Box
      component="button"
      type="button"
      onClick={onClick}
      sx={{
        width: '100%',
        minHeight: 112,
        p: 2,
        borderRadius: 2.5,
        border: `1px solid ${active ? alpha(color, 0.55) : alpha(theme.palette.divider, 0.16)}`,
        bgcolor: active ? alpha(color, theme.palette.mode === 'dark' ? 0.12 : 0.055) : 'background.paper',
        boxShadow: active ? `0 8px 24px ${alpha(color, 0.12)}` : `0 4px 18px ${alpha('#061e35', 0.05)}`,
        color: 'text.primary',
        textAlign: 'left',
        cursor: 'pointer',
        font: 'inherit',
        transition: 'transform 150ms ease, border-color 150ms ease, box-shadow 150ms ease',
        '&:hover': { transform: 'translateY(-2px)', borderColor: alpha(color, 0.45), boxShadow: `0 10px 28px ${alpha(color, 0.12)}` },
        '&:focus-visible': { outline: `3px solid ${alpha(color, 0.28)}`, outlineOffset: 2 }
      }}
    >
      <Stack direction="row" justifyContent="space-between" alignItems="flex-start" spacing={1.5}>
        <Box>
          <Typography sx={{ fontSize: '0.72rem', fontWeight: 700, letterSpacing: 0.65, textTransform: 'uppercase', color: 'text.secondary' }}>
            {label}
          </Typography>
          <Typography sx={{ mt: 0.55, fontSize: '1.45rem', lineHeight: 1.15, fontWeight: 750 }}>{value}</Typography>
          <Typography sx={{ mt: 0.55, fontSize: '0.75rem', color: 'text.secondary' }}>{helper}</Typography>
        </Box>
        <Avatar sx={{ width: 38, height: 38, bgcolor: alpha(color, 0.12), color }}>{icon}</Avatar>
      </Stack>
    </Box>
  );
}

function PropertyRow({ property, onOpen, onAddLease }) {
  const theme = useTheme();
  const navigate = useNavigate();
  const [anchorEl, setAnchorEl] = useState(null);
  const summary = getPropertySummary(property);
  const propertyId = getId(property);
  const name = read(property, 'name', 'Name') || read(property, 'streetAddress', 'StreetAddress') || 'Untitled property';
  const address = [
    read(property, 'streetAddress', 'StreetAddress'),
    read(property, 'city', 'City'),
    read(property, 'state', 'State')
  ].filter(Boolean).join(', ');
  const imageUrl = read(property, 'mainImageUrl', 'MainImageUrl') || read(property, 'images', 'Images')?.[0]?.blobUrl || placeholderImage;
  const occupancy = summary.units.length ? Math.round((summary.occupied / summary.units.length) * 100) : 0;
  const statusLabel = summary.overdue
    ? `${summary.overdue} overdue`
    : summary.vacant
      ? `${summary.vacant} vacant`
      : summary.units.length
        ? 'Fully occupied'
        : 'No units';
  const statusColor = summary.overdue ? theme.palette.error.main : summary.vacant ? theme.palette.warning.main : theme.palette.success.main;

  const handleKeyDown = (event) => {
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      onOpen(property);
    }
  };

  return (
    <Box
      role="link"
      tabIndex={0}
      onClick={() => onOpen(property)}
      onKeyDown={handleKeyDown}
      sx={{
        px: { xs: 1.5, md: 2 },
        py: { xs: 1.5, md: 1.35 },
        display: { xs: 'block', md: 'grid' },
        gridTemplateColumns: 'minmax(230px, 1.9fr) minmax(130px, .9fr) minmax(120px, .8fr) minmax(170px, 1fr) 44px',
        gap: { xs: 1.4, md: 2 },
        alignItems: 'center',
        cursor: 'pointer',
        borderBottom: `1px solid ${alpha(theme.palette.divider, 0.13)}`,
        transition: 'background-color 140ms ease',
        '&:hover': { bgcolor: alpha(theme.palette.primary.main, theme.palette.mode === 'dark' ? 0.08 : 0.028) },
        '&:focus-visible': { outline: `2px solid ${alpha(theme.palette.primary.main, 0.45)}`, outlineOffset: -2 }
      }}
    >
      <Stack direction="row" spacing={1.4} alignItems="center" minWidth={0}>
        <Box
          component="img"
          src={imageUrl}
          alt=""
          sx={{ width: 58, height: 58, borderRadius: 1.8, objectFit: 'cover', bgcolor: alpha(theme.palette.primary.main, 0.08), flexShrink: 0 }}
        />
        <Box minWidth={0}>
          <Stack direction="row" alignItems="center" spacing={0.75}>
            <Typography fontWeight={700} noWrap>{name}</Typography>
            {!isActiveProperty(property) && <Chip size="small" label="Archived" sx={{ height: 20, fontSize: '0.65rem' }} />}
          </Stack>
          <Typography noWrap sx={{ mt: 0.3, fontSize: '0.77rem', color: 'text.secondary' }}>{address || 'Address not added'}</Typography>
        </Box>
      </Stack>

      <Box>
        <Stack direction="row" justifyContent="space-between" alignItems="center">
          <Typography sx={{ fontSize: '0.8rem', fontWeight: 650 }}>{summary.occupied}/{summary.units.length || 0} occupied</Typography>
          <Typography sx={{ fontSize: '0.72rem', color: 'text.secondary' }}>{occupancy}%</Typography>
        </Stack>
        <LinearProgress
          variant="determinate"
          value={occupancy}
          sx={{ mt: 0.65, height: 5, borderRadius: 8, bgcolor: alpha(theme.palette.divider, 0.12), '& .MuiLinearProgress-bar': { borderRadius: 8, bgcolor: statusColor } }}
        />
        <Typography sx={{ mt: 0.55, fontSize: '0.7rem', color: statusColor, fontWeight: 650 }}>{statusLabel}</Typography>
      </Box>

      <Box>
        <Typography sx={{ fontSize: '0.7rem', color: 'text.secondary' }}>Monthly rent roll</Typography>
        <Typography sx={{ mt: 0.25, fontSize: '0.92rem', fontWeight: 750 }}>{summary.rentRoll ? formatMoney(summary.rentRoll) : '—'}</Typography>
      </Box>

      <Stack spacing={0.55}>
        {summary.overdue > 0 && (
          <Stack direction="row" spacing={0.65} alignItems="center">
            <WarningOutlined style={{ color: theme.palette.error.main, fontSize: 13 }} />
            <Typography sx={{ fontSize: '0.75rem', fontWeight: 650, color: 'error.main' }}>{summary.overdue} overdue unit{summary.overdue === 1 ? '' : 's'}</Typography>
          </Stack>
        )}
        {summary.urgentMaintenance > 0 && (
          <Stack direction="row" spacing={0.65} alignItems="center">
            <ToolOutlined style={{ color: theme.palette.warning.main, fontSize: 13 }} />
            <Typography sx={{ fontSize: '0.75rem', fontWeight: 650, color: 'warning.main' }}>{summary.urgentMaintenance} urgent ticket{summary.urgentMaintenance === 1 ? '' : 's'}</Typography>
          </Stack>
        )}
        <Stack direction="row" spacing={0.65} alignItems="center">
          <CalendarOutlined style={{ color: theme.palette.text.secondary, fontSize: 13 }} />
          <Typography sx={{ fontSize: '0.75rem', color: summary.expiringSoon ? 'warning.main' : 'text.secondary', fontWeight: summary.expiringSoon ? 650 : 400 }}>
            {summary.nextLeaseEnd ? `Next lease ${formatDate(summary.nextLeaseEnd)}` : 'No upcoming lease end'}
          </Typography>
        </Stack>
      </Stack>

      <Box sx={{ display: 'flex', justifyContent: { xs: 'flex-end', md: 'center' } }}>
        <Tooltip title="Property actions">
          <IconButton
            aria-label={`Actions for ${name}`}
            onClick={(event) => { event.stopPropagation(); setAnchorEl(event.currentTarget); }}
            size="small"
          >
            <MoreOutlined />
          </IconButton>
        </Tooltip>
        <Menu anchorEl={anchorEl} open={Boolean(anchorEl)} onClose={() => setAnchorEl(null)}>
          <MenuItem onClick={(event) => { event.stopPropagation(); setAnchorEl(null); onOpen(property); }}>Open property</MenuItem>
          <MenuItem onClick={(event) => { event.stopPropagation(); setAnchorEl(null); onAddLease(property); }}>Add lease</MenuItem>
          <MenuItem onClick={(event) => { event.stopPropagation(); setAnchorEl(null); navigate(`/landlord/maintenances/add?propertyId=${propertyId}`); }}>Create maintenance ticket</MenuItem>
          <MenuItem onClick={(event) => { event.stopPropagation(); setAnchorEl(null); navigate(`/landlord/property/${propertyId}/settings`); }}>Property settings</MenuItem>
        </Menu>
      </Box>
    </Box>
  );
}

export default function Properties() {
  const theme = useTheme();
  const navigate = useNavigate();
  const dispatch = useDispatch();
  const drawer = useDrawer();
  const { propertiesRefetch, isLoading } = useFetchProperties();
  const { setPropertiesLoading } = useDashboardLoading();
  const properties = useSelector(selectProperties) || [];

  const [search, setSearch] = useState('');
  const [status, setStatus] = useState('active');
  const [occupancy, setOccupancy] = useState('all');
  const [attention, setAttention] = useState('all');
  const [sort, setSort] = useState('attention');
  const [page, setPage] = useState(1);

  useEffect(() => {
    setPropertiesLoading(isLoading);
  }, [isLoading, setPropertiesLoading]);

  useEffect(() => {
    propertiesRefetch();
    dispatch(setProperty(null));
  }, [dispatch, propertiesRefetch]);

  useEffect(() => {
    setPage(1);
  }, [search, status, occupancy, attention, sort]);

  const metrics = useMemo(() => {
    const activeProperties = properties.filter(isActiveProperty);
    const units = activeProperties.flatMap(getUnits);
    const occupiedUnits = units.filter(isOccupiedUnit).length;
    const vacantUnits = Math.max(units.length - occupiedUnits, 0);
    const rentRoll = activeProperties.reduce((total, property) => total + getPropertySummary(property).rentRoll, 0);
    const needsAttention = activeProperties.filter((property) => getPropertySummary(property).attentionScore > 0).length;
    const occupancyRate = units.length ? Math.round((occupiedUnits / units.length) * 100) : 0;
    return { activeProperties: activeProperties.length, units: units.length, occupiedUnits, vacantUnits, rentRoll, needsAttention, occupancyRate };
  }, [properties]);

  const filteredProperties = useMemo(() => {
    const query = search.trim().toLowerCase();
    const list = properties.filter((property) => {
      const summary = getPropertySummary(property);
      const searchable = [
        read(property, 'name', 'Name'),
        read(property, 'streetAddress', 'StreetAddress'),
        read(property, 'city', 'City'),
        read(property, 'state', 'State'),
        ...summary.units.flatMap((unit) => [read(unit, 'name', 'Name'), read(unit, 'unitNumber', 'UnitNumber')])
      ].filter(Boolean).join(' ').toLowerCase();

      if (query && !searchable.includes(query)) return false;
      if (status === 'active' && !isActiveProperty(property)) return false;
      if (status === 'archived' && isActiveProperty(property)) return false;
      if (occupancy === 'occupied' && summary.occupied === 0) return false;
      if (occupancy === 'vacant' && summary.vacant === 0) return false;
      if (occupancy === 'full' && (!summary.units.length || summary.occupied !== summary.units.length)) return false;
      if (attention === 'overdue' && summary.overdue === 0) return false;
      if (attention === 'maintenance' && summary.urgentMaintenance === 0) return false;
      if (attention === 'lease' && !summary.expiringSoon) return false;
      if (attention === 'any' && summary.attentionScore === 0) return false;
      return true;
    });

    return list.sort((a, b) => {
      const aSummary = getPropertySummary(a);
      const bSummary = getPropertySummary(b);
      if (sort === 'name') return String(read(a, 'name', 'Name') || '').localeCompare(String(read(b, 'name', 'Name') || ''));
      if (sort === 'rent') return bSummary.rentRoll - aSummary.rentRoll;
      if (sort === 'occupancy') {
        const aRate = aSummary.units.length ? aSummary.occupied / aSummary.units.length : 0;
        const bRate = bSummary.units.length ? bSummary.occupied / bSummary.units.length : 0;
        return bRate - aRate;
      }
      if (sort === 'lease') return (aSummary.nextLeaseEnd?.getTime() || Number.MAX_SAFE_INTEGER) - (bSummary.nextLeaseEnd?.getTime() || Number.MAX_SAFE_INTEGER);
      return bSummary.attentionScore - aSummary.attentionScore || String(read(a, 'name', 'Name') || '').localeCompare(String(read(b, 'name', 'Name') || ''));
    });
  }, [attention, occupancy, properties, search, sort, status]);

  const pageCount = Math.ceil(filteredProperties.length / PAGE_SIZE);
  const paginatedProperties = filteredProperties.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);
  const hasFilters = search || status !== 'active' || occupancy !== 'all' || attention !== 'all' || sort !== 'attention';

  const clearFilters = () => {
    setSearch('');
    setStatus('active');
    setOccupancy('all');
    setAttention('all');
    setSort('attention');
  };

  const openProperty = (property) => {
    dispatch(setProperty(property));
    navigate(`/landlord/property/${getId(property)}`);
  };

  const addLease = (property) => {
    dispatch(setProperty(property));
    drawer.openLeaseAddDrawer();
  };

  return (
    <Box sx={{ pb: 3 }}>
      <Box sx={{ display: { xs: 'none', md: 'block' } }}>
        <PageBreadcrumbs items={[{ label: 'Dashboard', path: '/landlord/dashboard' }, { label: 'Properties' }]} />
      </Box>

      <Box
        sx={{
          mb: 2.5,
          p: { xs: 2, md: 2.75 },
          borderRadius: 3,
          color: '#fff',
          background: `linear-gradient(120deg, #061e35 0%, #0b3558 100%)`,
          boxShadow: `0 16px 38px ${alpha('#061e35', 0.18)}`
        }}
      >
        <Stack direction={{ xs: 'column', md: 'row' }} alignItems={{ md: 'center' }} justifyContent="space-between" spacing={2}>
          <Box>
            <Typography variant="h3" sx={{ color: '#fff', fontWeight: 750, letterSpacing: -0.4 }}>Properties</Typography>
            <Typography sx={{ mt: 0.6, color: alpha('#fff', 0.72), fontSize: '0.88rem' }}>
              A clear operating view of occupancy, rent roll, leases, and work that needs attention.
            </Typography>
          </Box>
          <Stack direction="row" spacing={1}>
            <PropertyCsvImportButton
              buttonProps={{
                sx: {
                  color: '#fff',
                  borderColor: alpha('#fff', 0.35),
                  bgcolor: alpha('#fff', 0.06),
                  textTransform: 'none',
                  '&:hover': { borderColor: alpha('#fff', 0.65), bgcolor: alpha('#fff', 0.12) }
                }
              }}
            />
            <Button
              variant="contained"
              color="success"
              startIcon={<PlusOutlined />}
              onClick={() => drawer.openPropertyAddWorkflowDrawer()}
              sx={{ textTransform: 'none', fontWeight: 700, boxShadow: 'none' }}
            >
              Add property
            </Button>
          </Stack>
        </Stack>
      </Box>

      <Grid container spacing={1.5} sx={{ mb: 2.5 }}>
        <Grid size={{ xs: 6, lg: 3 }}>
          <SummaryCard
            label="Portfolio occupancy"
            value={`${metrics.occupancyRate}%`}
            helper={`${metrics.occupiedUnits} of ${metrics.units} units occupied`}
            icon={<HomeOutlined />}
            color={theme.palette.success.main}
            active={occupancy === 'occupied'}
            onClick={() => setOccupancy((value) => value === 'occupied' ? 'all' : 'occupied')}
          />
        </Grid>
        <Grid size={{ xs: 6, lg: 3 }}>
          <SummaryCard
            label="Vacant units"
            value={metrics.vacantUnits}
            helper="Across active properties"
            icon={<HomeOutlined />}
            color={theme.palette.warning.main}
            active={occupancy === 'vacant'}
            onClick={() => setOccupancy((value) => value === 'vacant' ? 'all' : 'vacant')}
          />
        </Grid>
        <Grid size={{ xs: 6, lg: 3 }}>
          <SummaryCard
            label="Monthly rent roll"
            value={formatMoney(metrics.rentRoll)}
            helper="Scheduled rent, not collections"
            icon={<ArrowRightOutlined />}
            color={theme.palette.primary.main}
            active={sort === 'rent'}
            onClick={() => setSort((value) => value === 'rent' ? 'attention' : 'rent')}
          />
        </Grid>
        <Grid size={{ xs: 6, lg: 3 }}>
          <SummaryCard
            label="Needs attention"
            value={metrics.needsAttention}
            helper="Overdue, urgent, or expiring"
            icon={<WarningOutlined />}
            color={theme.palette.error.main}
            active={attention === 'any'}
            onClick={() => setAttention((value) => value === 'any' ? 'all' : 'any')}
          />
        </Grid>
      </Grid>

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
              placeholder="Search properties, addresses, or units"
              size="small"
              startAdornment={<InputAdornment position="start"><SearchOutlined /></InputAdornment>}
              sx={{ flex: 1, minWidth: { md: 260 }, borderRadius: 1.75 }}
            />
            <Stack direction="row" spacing={1} sx={{ overflowX: 'auto', pb: { xs: 0.25, md: 0 } }}>
              <Select size="small" value={status} onChange={(event) => setStatus(event.target.value)} IconComponent={DownOutlined} sx={{ minWidth: 118, borderRadius: 1.75 }}>
                <MenuItem value="active">Active</MenuItem>
                <MenuItem value="archived">Archived</MenuItem>
                <MenuItem value="all">All status</MenuItem>
              </Select>
              <Select size="small" value={occupancy} onChange={(event) => setOccupancy(event.target.value)} IconComponent={DownOutlined} sx={{ minWidth: 145, borderRadius: 1.75 }}>
                <MenuItem value="all">All occupancy</MenuItem>
                <MenuItem value="occupied">Has occupancy</MenuItem>
                <MenuItem value="vacant">Has vacancy</MenuItem>
                <MenuItem value="full">Fully occupied</MenuItem>
              </Select>
              <Select size="small" value={attention} onChange={(event) => setAttention(event.target.value)} IconComponent={DownOutlined} sx={{ minWidth: 148, borderRadius: 1.75 }}>
                <MenuItem value="all">All attention</MenuItem>
                <MenuItem value="any">Needs attention</MenuItem>
                <MenuItem value="overdue">Overdue rent</MenuItem>
                <MenuItem value="maintenance">Urgent maintenance</MenuItem>
                <MenuItem value="lease">Lease ending soon</MenuItem>
              </Select>
              <Select size="small" value={sort} onChange={(event) => setSort(event.target.value)} IconComponent={DownOutlined} sx={{ minWidth: 158, borderRadius: 1.75 }}>
                <MenuItem value="attention">Sort: Attention</MenuItem>
                <MenuItem value="name">Sort: Name</MenuItem>
                <MenuItem value="rent">Sort: Rent roll</MenuItem>
                <MenuItem value="occupancy">Sort: Occupancy</MenuItem>
                <MenuItem value="lease">Sort: Lease end</MenuItem>
              </Select>
            </Stack>
          </Stack>
          <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mt: 1.4 }}>
            <Typography sx={{ fontSize: '0.76rem', color: 'text.secondary' }}>
              {filteredProperties.length} of {properties.length} properties
            </Typography>
            {hasFilters && <Button size="small" onClick={clearFilters} sx={{ textTransform: 'none' }}>Reset view</Button>}
          </Stack>
        </Box>

        <Divider />

        <Box sx={{ display: { xs: 'none', md: 'grid' }, gridTemplateColumns: 'minmax(230px, 1.9fr) minmax(130px, .9fr) minmax(120px, .8fr) minmax(170px, 1fr) 44px', gap: 2, px: 2, py: 1.15, bgcolor: alpha(theme.palette.primary.main, 0.025) }}>
          {['Property', 'Occupancy', 'Rent roll', 'Operations', ''].map((label) => (
            <Typography key={label || 'actions'} sx={{ fontSize: '0.66rem', fontWeight: 750, letterSpacing: 0.65, textTransform: 'uppercase', color: 'text.secondary' }}>{label}</Typography>
          ))}
        </Box>

        {isLoading ? (
          <Stack alignItems="center" spacing={1} sx={{ py: 7 }}>
            <CircularProgress size={26} />
            <Typography sx={{ fontSize: '0.82rem', color: 'text.secondary' }}>Loading portfolio…</Typography>
          </Stack>
        ) : properties.length === 0 ? (
          <Box sx={{ p: 2 }}><PropertiesEmptyState /></Box>
        ) : filteredProperties.length === 0 ? (
          <Stack alignItems="center" spacing={1.5} sx={{ py: 7, px: 2, textAlign: 'center' }}>
            <Typography variant="h6" fontWeight={700}>No properties match this view</Typography>
            <Typography sx={{ color: 'text.secondary', fontSize: '0.85rem' }}>Try a different search or reset the portfolio filters.</Typography>
            <Button variant="outlined" onClick={clearFilters} sx={{ textTransform: 'none' }}>Reset filters</Button>
          </Stack>
        ) : (
          paginatedProperties.map((property) => (
            <PropertyRow key={getId(property)} property={property} onOpen={openProperty} onAddLease={addLease} />
          ))
        )}

        {pageCount > 1 && (
          <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1.5} alignItems="center" justifyContent="space-between" sx={{ p: 2 }}>
            <Typography sx={{ fontSize: '0.76rem', color: 'text.secondary' }}>
              Showing {(page - 1) * PAGE_SIZE + 1}–{Math.min(page * PAGE_SIZE, filteredProperties.length)} of {filteredProperties.length}
            </Typography>
            <Pagination count={pageCount} page={page} onChange={(_, value) => setPage(value)} color="primary" shape="rounded" />
          </Stack>
        )}
      </Box>

      <LeaseAddDrawer />
    </Box>
  );
}
