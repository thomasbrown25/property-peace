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
  CalendarOutlined,
  CameraOutlined,
  CheckCircleOutlined,
  DownOutlined,
  EditOutlined,
  MoreOutlined,
  PlusOutlined,
  SearchOutlined,
  WarningOutlined
} from '@ant-design/icons';
import { useDispatch, useSelector } from 'react-redux';
import { useNavigate } from 'react-router-dom';

import PageBreadcrumbs from 'components/breadcrumbs/PageBreadcrumbs';
import ListingAddWorkflowDrawer from 'components/drawers/ListingAddWorkflowDrawer';
import { useDrawer } from 'contexts/DrawerContext';
import { getListings } from 'store/listing/listing.action';
import { selectListings, selectListingLoading } from 'store/listing/listing.selector';
import { formatCurrency } from 'utils/formatters';
import placeholderImage from 'assets/images/placeholder-house.png';

const PAGE_SIZE = 10;

const read = (object, camel, pascal) => object?.[camel] ?? object?.[pascal];
const getId = (listing) => read(listing, 'id', 'Id');
const getStatus = (listing) => {
  const value = read(listing, 'status', 'Status');
  if (typeof value === 'string') return value.toLowerCase();
  return ({ 0: 'draft', 1: 'active', 2: 'expired', 3: 'unlisted' })[value] || 'draft';
};
const isActiveListing = (listing) => ['active', 'published'].includes(getStatus(listing));
const getDisplayStatus = (listing) => isActiveListing(listing) ? 'Active' : 'Draft';
const getTitle = (listing) => {
  const propertyName = read(listing, 'propertyName', 'PropertyName') || 'Untitled listing';
  const unitName = read(listing, 'unitName', 'UnitName');
  return unitName ? `${propertyName}, ${unitName}` : propertyName;
};
const getAddress = (listing) => read(listing, 'propertyAddress', 'PropertyAddress') || 'Address not added';
const getRent = (listing) => Number(read(listing, 'monthlyRent', 'MonthlyRent') || 0);
const getImages = (listing) => read(listing, 'images', 'Images') || [];
const getDate = (listing, camel, pascal) => {
  const value = read(listing, camel, pascal);
  const date = value ? new Date(value) : null;
  return date && !Number.isNaN(date.getTime()) ? date : null;
};
const getAvailableDate = (listing) => getDate(listing, 'dateAvailable', 'DateAvailable') || getDate(listing, 'availableDate', 'AvailableDate');
const getUpdatedDate = (listing) => getDate(listing, 'updatedAt', 'UpdatedAt') || getDate(listing, 'createdAt', 'CreatedAt');
const hasPhoto = (listing) => getImages(listing).length > 0 || Boolean(read(listing, 'coverImageUrl', 'CoverImageUrl'));
const isStale = (listing) => {
  const updated = getUpdatedDate(listing);
  return Boolean(updated && Date.now() - updated.getTime() >= 30 * 86400000);
};
const getReadinessIssues = (listing) => [
  !hasPhoto(listing) && 'photos',
  getRent(listing) <= 0 && 'rent',
  isStale(listing) && 'stale'
].filter(Boolean);

function getImageUrl(listing) {
  const images = getImages(listing);
  const cover = images.find((image) => read(image, 'isCoverPhoto', 'IsCoverPhoto'));
  return read(cover, 'blobUrl', 'BlobUrl') || read(images[0], 'blobUrl', 'BlobUrl') || read(listing, 'coverImageUrl', 'CoverImageUrl') || placeholderImage;
}

function formatDate(date, options = { month: 'short', day: 'numeric', year: 'numeric' }) {
  return date ? date.toLocaleDateString('en-US', options) : 'Not set';
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

function Readiness({ listing }) {
  const theme = useTheme();
  const issues = getReadinessIssues(listing);
  const score = Math.round(((3 - issues.length) / 3) * 100);
  const color = issues.length === 0 ? theme.palette.success.main : issues.length === 1 ? theme.palette.warning.main : theme.palette.error.main;

  return (
    <Box>
      <Stack direction="row" alignItems="center" justifyContent="space-between" spacing={1}>
        <Typography sx={{ fontSize: '0.76rem', fontWeight: 650, color }}>{issues.length ? `${issues.length} item${issues.length === 1 ? '' : 's'} to review` : 'Ready to market'}</Typography>
        <Typography sx={{ fontSize: '0.7rem', color: 'text.secondary' }}>{score}%</Typography>
      </Stack>
      <LinearProgress
        variant="determinate"
        value={score}
        sx={{ mt: 0.65, height: 5, borderRadius: 8, bgcolor: alpha(theme.palette.divider, 0.12), '& .MuiLinearProgress-bar': { borderRadius: 8, bgcolor: color } }}
      />
      <Typography sx={{ mt: 0.5, fontSize: '0.68rem', color: 'text.secondary' }}>
        {issues.length ? `Check ${issues.join(', ')}` : `${getImages(listing).length} photo${getImages(listing).length === 1 ? '' : 's'} · rent set`}
      </Typography>
    </Box>
  );
}

function ListingRow({ listing, onOpen }) {
  const theme = useTheme();
  const [anchorEl, setAnchorEl] = useState(null);
  const title = getTitle(listing);
  const rent = getRent(listing);
  const available = getAvailableDate(listing);
  const updated = getUpdatedDate(listing);
  const active = isActiveListing(listing);

  const handleKeyDown = (event) => {
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      onOpen(listing);
    }
  };

  return (
    <Box
      role="link"
      tabIndex={0}
      onClick={() => onOpen(listing)}
      onKeyDown={handleKeyDown}
      sx={{
        px: { xs: 1.5, md: 2 },
        py: { xs: 1.5, md: 1.35 },
        display: { xs: 'block', md: 'grid' },
        gridTemplateColumns: 'minmax(245px, 1.8fr) minmax(105px, .7fr) minmax(90px, .65fr) minmax(125px, .85fr) minmax(160px, 1fr) 44px',
        gap: { xs: 1.5, md: 2 },
        alignItems: 'center',
        cursor: 'pointer',
        borderBottom: `1px solid ${alpha(theme.palette.divider, 0.13)}`,
        transition: 'background-color 140ms ease',
        '&:hover': { bgcolor: alpha(theme.palette.primary.main, theme.palette.mode === 'dark' ? 0.08 : 0.028) },
        '&:focus-visible': { outline: `2px solid ${alpha(theme.palette.primary.main, 0.45)}`, outlineOffset: -2 }
      }}
    >
      <Stack direction="row" spacing={1.4} alignItems="center" minWidth={0}>
        <Box component="img" src={getImageUrl(listing)} alt="" sx={{ width: 62, height: 58, borderRadius: 1.8, objectFit: 'cover', bgcolor: alpha(theme.palette.primary.main, 0.08), flexShrink: 0 }} />
        <Box minWidth={0}>
          <Typography fontWeight={700} noWrap>{title}</Typography>
          <Typography noWrap sx={{ mt: 0.3, fontSize: '0.77rem', color: 'text.secondary' }}>{getAddress(listing)}</Typography>
          <Typography sx={{ mt: 0.3, fontSize: '0.68rem', color: 'text.disabled' }}>
            {read(listing, 'listingNumber', 'ListingNumber') ? `#${read(listing, 'listingNumber', 'ListingNumber')} · ` : ''}Updated {formatDate(updated, { month: 'short', day: 'numeric' })}
          </Typography>
        </Box>
      </Stack>

      <Box>
        <Typography sx={{ fontSize: '0.92rem', fontWeight: 750, color: rent > 0 ? 'text.primary' : 'text.disabled' }}>{rent > 0 ? formatCurrency(rent) : 'Not set'}</Typography>
        <Typography sx={{ mt: 0.25, fontSize: '0.7rem', color: 'text.secondary' }}>per month</Typography>
      </Box>

      <Box>
        <Chip
          size="small"
          label={getDisplayStatus(listing)}
          color={active ? 'success' : 'warning'}
          sx={{ height: 23, fontWeight: 700, '& .MuiChip-label': { px: 0.9 } }}
        />
      </Box>

      <Box>
        <Typography sx={{ fontSize: '0.8rem', fontWeight: 650 }}>{formatDate(available)}</Typography>
        <Typography sx={{ mt: 0.25, fontSize: '0.7rem', color: 'text.secondary' }}>{available && available <= new Date() ? 'Available now' : 'Availability'}</Typography>
      </Box>

      <Readiness listing={listing} />

      <Box sx={{ display: 'flex', justifyContent: { xs: 'flex-end', md: 'center' } }}>
        <Tooltip title="Listing actions">
          <IconButton
            size="small"
            aria-label={`Actions for ${title}`}
            onClick={(event) => { event.stopPropagation(); setAnchorEl(event.currentTarget); }}
          >
            <MoreOutlined />
          </IconButton>
        </Tooltip>
        <Menu anchorEl={anchorEl} open={Boolean(anchorEl)} onClose={() => setAnchorEl(null)}>
          <MenuItem onClick={(event) => { event.stopPropagation(); setAnchorEl(null); onOpen(listing); }}>
            {active ? 'Open listing' : 'Continue draft'}
          </MenuItem>
        </Menu>
      </Box>
    </Box>
  );
}

export default function ListingsPage() {
  const theme = useTheme();
  const dispatch = useDispatch();
  const drawer = useDrawer();
  const navigate = useNavigate();
  const listings = useSelector(selectListings) || [];
  const isLoading = useSelector(selectListingLoading);

  const [search, setSearch] = useState('');
  const [status, setStatus] = useState('all');
  const [readiness, setReadiness] = useState('all');
  const [availability, setAvailability] = useState('all');
  const [sort, setSort] = useState('updated');
  const [page, setPage] = useState(1);

  useEffect(() => {
    dispatch(getListings());
  }, [dispatch]);

  useEffect(() => {
    setPage(1);
  }, [availability, readiness, search, sort, status]);

  const metrics = useMemo(() => {
    const active = listings.filter(isActiveListing).length;
    const drafts = listings.length - active;
    const needsAttention = listings.filter((listing) => getReadinessIssues(listing).length > 0).length;
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const upcoming = listings.filter((listing) => {
      const date = getAvailableDate(listing);
      if (!date) return false;
      const difference = Math.ceil((date.getTime() - today.getTime()) / 86400000);
      return difference >= 0 && difference <= 60;
    }).length;
    return { active, drafts, needsAttention, upcoming };
  }, [listings]);

  const filteredListings = useMemo(() => {
    const query = search.trim().toLowerCase();
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const filtered = listings.filter((listing) => {
      const searchable = [
        getTitle(listing),
        getAddress(listing),
        read(listing, 'listingNumber', 'ListingNumber')
      ].filter(Boolean).join(' ').toLowerCase();
      const issues = getReadinessIssues(listing);
      const available = getAvailableDate(listing);

      if (query && !searchable.includes(query)) return false;
      if (status === 'active' && !isActiveListing(listing)) return false;
      if (status === 'draft' && isActiveListing(listing)) return false;
      if (readiness === 'ready' && issues.length > 0) return false;
      if (readiness === 'attention' && issues.length === 0) return false;
      if (readiness === 'photos' && !issues.includes('photos')) return false;
      if (readiness === 'rent' && !issues.includes('rent')) return false;
      if (readiness === 'stale' && !issues.includes('stale')) return false;
      if (availability === 'now' && (!available || available > today)) return false;
      if (availability === 'upcoming') {
        const difference = available ? Math.ceil((available.getTime() - today.getTime()) / 86400000) : -1;
        if (difference < 0 || difference > 60) return false;
      }
      if (availability === 'unset' && available) return false;
      return true;
    });

    return filtered.sort((a, b) => {
      if (sort === 'rent-desc') return getRent(b) - getRent(a);
      if (sort === 'rent-asc') return getRent(a) - getRent(b);
      if (sort === 'availability') return (getAvailableDate(a)?.getTime() || Number.MAX_SAFE_INTEGER) - (getAvailableDate(b)?.getTime() || Number.MAX_SAFE_INTEGER);
      if (sort === 'name') return getTitle(a).localeCompare(getTitle(b));
      if (sort === 'readiness') return getReadinessIssues(b).length - getReadinessIssues(a).length;
      return (getUpdatedDate(b)?.getTime() || 0) - (getUpdatedDate(a)?.getTime() || 0);
    });
  }, [availability, listings, readiness, search, sort, status]);

  const pageCount = Math.ceil(filteredListings.length / PAGE_SIZE);
  const paginatedListings = filteredListings.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);
  const hasFilters = search || status !== 'all' || readiness !== 'all' || availability !== 'all' || sort !== 'updated';

  const clearFilters = () => {
    setSearch('');
    setStatus('all');
    setReadiness('all');
    setAvailability('all');
    setSort('updated');
  };

  const openListing = (listing) => {
    if (!isActiveListing(listing)) {
      drawer.openListingAddDrawer(listing);
      return;
    }
    navigate(`/landlord/listings/${getId(listing)}`);
  };

  return (
    <Box sx={{ pb: 3 }}>
      <Box sx={{ display: { xs: 'none', md: 'block' } }}>
        <PageBreadcrumbs items={[{ label: 'Dashboard', path: '/landlord/dashboard' }, { label: 'Listings' }]} />
      </Box>

      <Box
        sx={{
          mb: 2.5,
          p: { xs: 2, md: 2.75 },
          borderRadius: 3,
          color: '#fff',
          background: 'linear-gradient(120deg, #061e35 0%, #0b3558 100%)',
          boxShadow: `0 16px 38px ${alpha('#061e35', 0.18)}`
        }}
      >
        <Stack direction={{ xs: 'column', md: 'row' }} alignItems={{ md: 'center' }} justifyContent="space-between" spacing={2}>
          <Box>
            <Typography variant="h3" sx={{ color: '#fff', fontWeight: 750, letterSpacing: -0.4 }}>Listings</Typography>
            <Typography sx={{ mt: 0.6, color: alpha('#fff', 0.72), fontSize: '0.88rem' }}>
              Prepare, publish, and monitor every rental listing from one focused workspace.
            </Typography>
          </Box>
          <Button
            variant="contained"
            color="success"
            startIcon={<PlusOutlined />}
            onClick={() => drawer.openListingAddDrawer()}
            sx={{ textTransform: 'none', fontWeight: 700, boxShadow: 'none', alignSelf: { xs: 'flex-start', md: 'center' } }}
          >
            Add listing
          </Button>
        </Stack>
      </Box>

      <Grid container spacing={1.5} sx={{ mb: 2.5 }}>
        <Grid size={{ xs: 6, lg: 3 }}>
          <SummaryCard label="Active listings" value={metrics.active} helper="Currently marketed" icon={<CheckCircleOutlined />} color={theme.palette.success.main} active={status === 'active'} onClick={() => setStatus((value) => value === 'active' ? 'all' : 'active')} />
        </Grid>
        <Grid size={{ xs: 6, lg: 3 }}>
          <SummaryCard label="Drafts" value={metrics.drafts} helper="Continue preparing" icon={<EditOutlined />} color={theme.palette.warning.main} active={status === 'draft'} onClick={() => setStatus((value) => value === 'draft' ? 'all' : 'draft')} />
        </Grid>
        <Grid size={{ xs: 6, lg: 3 }}>
          <SummaryCard label="Needs attention" value={metrics.needsAttention} helper="Photos, rent, or stale content" icon={<WarningOutlined />} color={theme.palette.error.main} active={readiness === 'attention'} onClick={() => setReadiness((value) => value === 'attention' ? 'all' : 'attention')} />
        </Grid>
        <Grid size={{ xs: 6, lg: 3 }}>
          <SummaryCard label="Available soon" value={metrics.upcoming} helper="Within the next 60 days" icon={<CalendarOutlined />} color={theme.palette.primary.main} active={availability === 'upcoming'} onClick={() => setAvailability((value) => value === 'upcoming' ? 'all' : 'upcoming')} />
        </Grid>
      </Grid>

      <Box sx={{ bgcolor: 'background.paper', border: `1px solid ${alpha(theme.palette.divider, 0.16)}`, borderRadius: 3, boxShadow: `0 8px 28px ${alpha('#061e35', 0.055)}`, overflow: 'hidden' }}>
        <Box sx={{ p: { xs: 1.5, md: 2 } }}>
          <Stack direction={{ xs: 'column', md: 'row' }} spacing={1.1} alignItems={{ md: 'center' }}>
            <OutlinedInput
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Search listings, addresses, units, or listing numbers"
              size="small"
              startAdornment={<InputAdornment position="start"><SearchOutlined /></InputAdornment>}
              sx={{ flex: 1, minWidth: { md: 260 }, borderRadius: 1.75 }}
            />
            <Stack direction="row" spacing={1} sx={{ overflowX: 'auto', pb: { xs: 0.25, md: 0 } }}>
              <Select size="small" value={status} onChange={(event) => setStatus(event.target.value)} IconComponent={DownOutlined} sx={{ minWidth: 126, borderRadius: 1.75 }}>
                <MenuItem value="all">All status</MenuItem>
                <MenuItem value="active">Active</MenuItem>
                <MenuItem value="draft">Draft</MenuItem>
              </Select>
              <Select size="small" value={readiness} onChange={(event) => setReadiness(event.target.value)} IconComponent={DownOutlined} sx={{ minWidth: 160, borderRadius: 1.75 }}>
                <MenuItem value="all">All readiness</MenuItem>
                <MenuItem value="ready">Ready to market</MenuItem>
                <MenuItem value="attention">Needs attention</MenuItem>
                <MenuItem value="photos">Missing photos</MenuItem>
                <MenuItem value="rent">Missing rent</MenuItem>
                <MenuItem value="stale">Stale content</MenuItem>
              </Select>
              <Select size="small" value={availability} onChange={(event) => setAvailability(event.target.value)} IconComponent={DownOutlined} sx={{ minWidth: 156, borderRadius: 1.75 }}>
                <MenuItem value="all">All availability</MenuItem>
                <MenuItem value="now">Available now</MenuItem>
                <MenuItem value="upcoming">Next 60 days</MenuItem>
                <MenuItem value="unset">Date not set</MenuItem>
              </Select>
              <Select size="small" value={sort} onChange={(event) => setSort(event.target.value)} IconComponent={DownOutlined} sx={{ minWidth: 158, borderRadius: 1.75 }}>
                <MenuItem value="updated">Sort: Recently updated</MenuItem>
                <MenuItem value="readiness">Sort: Needs attention</MenuItem>
                <MenuItem value="availability">Sort: Availability</MenuItem>
                <MenuItem value="rent-desc">Sort: Rent high</MenuItem>
                <MenuItem value="rent-asc">Sort: Rent low</MenuItem>
                <MenuItem value="name">Sort: Name</MenuItem>
              </Select>
            </Stack>
          </Stack>
          <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mt: 1.4 }}>
            <Typography sx={{ fontSize: '0.76rem', color: 'text.secondary' }}>{filteredListings.length} of {listings.length} listings</Typography>
            {hasFilters && <Button size="small" onClick={clearFilters} sx={{ textTransform: 'none' }}>Reset view</Button>}
          </Stack>
        </Box>

        <Divider />

        <Box sx={{ display: { xs: 'none', md: 'grid' }, gridTemplateColumns: 'minmax(245px, 1.8fr) minmax(105px, .7fr) minmax(90px, .65fr) minmax(125px, .85fr) minmax(160px, 1fr) 44px', gap: 2, px: 2, py: 1.15, bgcolor: alpha(theme.palette.primary.main, 0.025) }}>
          {['Listing', 'Rent', 'Status', 'Available', 'Marketing readiness', ''].map((label) => (
            <Typography key={label || 'actions'} sx={{ fontSize: '0.66rem', fontWeight: 750, letterSpacing: 0.65, textTransform: 'uppercase', color: 'text.secondary' }}>{label}</Typography>
          ))}
        </Box>

        {isLoading ? (
          <Stack alignItems="center" spacing={1} sx={{ py: 7 }}>
            <CircularProgress size={26} />
            <Typography sx={{ fontSize: '0.82rem', color: 'text.secondary' }}>Loading listings…</Typography>
          </Stack>
        ) : listings.length === 0 ? (
          <Stack alignItems="center" spacing={1.5} sx={{ py: 7, px: 2, textAlign: 'center' }}>
            <Avatar sx={{ width: 54, height: 54, bgcolor: alpha(theme.palette.success.main, 0.1), color: 'success.main' }}><CameraOutlined /></Avatar>
            <Typography variant="h5" fontWeight={700}>Create your first listing</Typography>
            <Typography sx={{ color: 'text.secondary', fontSize: '0.85rem', maxWidth: 440 }}>Add the rent, availability, photos, and marketing details tenants need to discover your property.</Typography>
            <Button variant="contained" color="success" startIcon={<PlusOutlined />} onClick={() => drawer.openListingAddDrawer()} sx={{ textTransform: 'none', fontWeight: 700 }}>Add listing</Button>
          </Stack>
        ) : filteredListings.length === 0 ? (
          <Stack alignItems="center" spacing={1.5} sx={{ py: 7, px: 2, textAlign: 'center' }}>
            <Typography variant="h6" fontWeight={700}>No listings match this view</Typography>
            <Typography sx={{ color: 'text.secondary', fontSize: '0.85rem' }}>Try a different search or reset the listing filters.</Typography>
            <Button variant="outlined" onClick={clearFilters} sx={{ textTransform: 'none' }}>Reset filters</Button>
          </Stack>
        ) : (
          paginatedListings.map((listing) => <ListingRow key={getId(listing)} listing={listing} onOpen={openListing} />)
        )}

        {pageCount > 1 && (
          <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1.5} alignItems="center" justifyContent="space-between" sx={{ p: 2 }}>
            <Typography sx={{ fontSize: '0.76rem', color: 'text.secondary' }}>
              Showing {(page - 1) * PAGE_SIZE + 1}–{Math.min(page * PAGE_SIZE, filteredListings.length)} of {filteredListings.length}
            </Typography>
            <Pagination count={pageCount} page={page} onChange={(_, value) => setPage(value)} color="primary" shape="rounded" />
          </Stack>
        )}
      </Box>

      <ListingAddWorkflowDrawer />
    </Box>
  );
}
