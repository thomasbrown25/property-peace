import { useEffect, useMemo, useState } from 'react';
import {
  alpha,
  Avatar,
  Box,
  Button,
  Chip,
  CircularProgress,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  IconButton,
  InputAdornment,
  LinearProgress,
  Menu,
  MenuItem,
  OutlinedInput,
  Pagination,
  Select,
  Stack,
  Tab,
  Tabs,
  Tooltip,
  Typography,
  useTheme
} from '@mui/material';
import {
  CameraOutlined,
  DownOutlined,
  MoreOutlined,
  PlusOutlined,
  SearchOutlined
} from '@ant-design/icons';
import { useDispatch, useSelector } from 'react-redux';
import { useNavigate, useSearchParams } from 'react-router-dom';
import useSWR from 'swr';

import ManagementPageHeader from 'components/headers/ManagementPageHeader';
import { managementPageHeaderActionSx } from 'components/headers/managementPageHeaderStyles';
import ListingAddWorkflowDrawer from 'components/drawers/ListingAddWorkflowDrawer';
import ApplicationsPage from 'pages/landlord/applications';
import { useDrawer } from 'contexts/DrawerContext';
import { deleteListing, getListings } from 'store/listing/listing.action';
import { openSnackbar } from 'api/snackbar';
import { selectListings, selectListingLoading } from 'store/listing/listing.selector';
import { formatCurrency } from 'utils/formatters';
import { getRentEstimate } from 'api/rentEstimate';
import useEntitlement from 'hooks/useEntitlement';
import { RENT_ESTIMATE_FEATURE } from 'utils/entitlements';
import placeholderImage from 'assets/images/placeholder-house.png';
import { getImages, getReadinessIssues, getReadinessScore, isActiveListing } from './listing-readiness.mjs';

const PAGE_SIZE = 10;

const read = (object, camel, pascal) => object?.[camel] ?? object?.[pascal];
const getId = (listing) => read(listing, 'id', 'Id');
const getDisplayStatus = (listing) => (isActiveListing(listing) ? 'Active' : 'Draft');
const getTitle = (listing) => {
  const propertyName = read(listing, 'propertyName', 'PropertyName') || 'Untitled listing';
  const unitName = read(listing, 'unitName', 'UnitName');
  return unitName ? `${propertyName}, ${unitName}` : propertyName;
};
const getAddress = (listing) => read(listing, 'propertyAddress', 'PropertyAddress') || 'Address not added';
const getRent = (listing) => Number(read(listing, 'monthlyRent', 'MonthlyRent') || 0);
const getDate = (listing, camel, pascal) => {
  const value = read(listing, camel, pascal);
  const date = value ? new Date(value) : null;
  return date && !Number.isNaN(date.getTime()) ? date : null;
};
const getAvailableDate = (listing) =>
  getDate(listing, 'dateAvailable', 'DateAvailable') || getDate(listing, 'availableDate', 'AvailableDate');
const getUpdatedDate = (listing) => getDate(listing, 'updatedAt', 'UpdatedAt') || getDate(listing, 'createdAt', 'CreatedAt');

function getImageUrl(listing) {
  const images = getImages(listing);
  const cover = images.find((image) => read(image, 'isCoverPhoto', 'IsCoverPhoto'));
  return (
    read(cover, 'blobUrl', 'BlobUrl') ||
    read(images[0], 'blobUrl', 'BlobUrl') ||
    read(listing, 'coverImageUrl', 'CoverImageUrl') ||
    placeholderImage
  );
}

function formatDate(date, options = { month: 'short', day: 'numeric', year: 'numeric' }) {
  return date ? date.toLocaleDateString('en-US', options) : 'Not set';
}

function Readiness({ listing }) {
  const theme = useTheme();
  const issues = getReadinessIssues(listing);
  const score = getReadinessScore(listing);
  const color =
    issues.length === 0 ? theme.palette.success.main : issues.length === 1 ? theme.palette.warning.main : theme.palette.error.main;

  return (
    <Box>
      <Stack direction="row" alignItems="center" justifyContent="space-between" spacing={1}>
        <Typography sx={{ fontSize: '0.76rem', fontWeight: 650, color }}>
          {issues.length ? `${issues.length} item${issues.length === 1 ? '' : 's'} to review` : 'Ready to market'}
        </Typography>
        <Typography sx={{ fontSize: '0.7rem', color: 'text.secondary' }}>{score}%</Typography>
      </Stack>
      <LinearProgress
        variant="determinate"
        value={score}
        sx={{
          mt: 0.65,
          height: 5,
          borderRadius: 8,
          bgcolor: alpha(theme.palette.divider, 0.12),
          '& .MuiLinearProgress-bar': { borderRadius: 8, bgcolor: color }
        }}
      />
      <Typography sx={{ mt: 0.5, fontSize: '0.68rem', color: 'text.secondary' }}>
        {issues.length
          ? `Check ${issues.join(', ')}`
          : 'Required listing details complete'}
      </Typography>
    </Box>
  );
}

function ListingMarketRent({ listing }) {
  const propertyId = read(listing, 'propertyId', 'PropertyId');
  const unitId = read(listing, 'unitId', 'UnitId');
  const { presentation } = useEntitlement(RENT_ESTIMATE_FEATURE);
  const allowed = presentation.kind === 'allowed';
  const { data, error, isLoading } = useSWR(
    allowed && propertyId ? ['listing-market-rent', propertyId, unitId] : null,
    () => getRentEstimate(propertyId, unitId),
    { shouldRetryOnError: false, revalidateOnFocus: false }
  );
  const estimate = Number(data?.rentEstimate);
  const label = allowed
    ? isLoading ? 'Checking market estimate…' : !error && Number.isFinite(estimate) && estimate > 0
      ? `${formatCurrency(estimate)} est. market value`
      : 'Market estimate unavailable'
    : presentation.kind === 'loading' ? 'Checking market estimate…' : 'Market estimate requires Premium';

  return <Typography sx={{ mt: 0.25, fontSize: '0.7rem', color: 'text.secondary' }}>{label}</Typography>;
}

function ListingRow({ listing, onOpen, onDelete }) {
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
        <Box
          component="img"
          src={getImageUrl(listing)}
          alt=""
          sx={{
            width: 62,
            height: 58,
            borderRadius: 1.8,
            objectFit: 'cover',
            bgcolor: alpha(theme.palette.primary.main, 0.08),
            flexShrink: 0
          }}
        />
        <Box minWidth={0}>
          <Typography fontWeight={700} noWrap>
            {title}
          </Typography>
          <Typography noWrap sx={{ mt: 0.3, fontSize: '0.77rem', color: 'text.secondary' }}>
            {getAddress(listing)}
          </Typography>
          <Typography sx={{ mt: 0.3, fontSize: '0.68rem', color: 'text.disabled' }}>
            {read(listing, 'listingNumber', 'ListingNumber') ? `#${read(listing, 'listingNumber', 'ListingNumber')} · ` : ''}Updated{' '}
            {formatDate(updated, { month: 'short', day: 'numeric' })}
          </Typography>
        </Box>
      </Stack>

      <Box>
        <Typography sx={{ fontSize: '0.92rem', fontWeight: 750, color: rent > 0 ? 'text.primary' : 'text.disabled' }}>
          {rent > 0 ? `${formatCurrency(rent)}/mo` : 'Not set'}
        </Typography>
        <ListingMarketRent listing={listing} />
      </Box>

      <Box>
        <Chip
          size="small"
          label={getDisplayStatus(listing)}
          color={active ? 'success' : 'warning'}
          sx={{ height: 23, fontWeight: 700, '& .MuiChip-label': { px: 0.9 } }}
        />
      </Box>

      <Box sx={{ display: 'flex', alignItems: 'center', alignSelf: 'stretch' }}>
        <Typography sx={{ fontSize: '0.8rem', fontWeight: 650 }}>{formatDate(available)}</Typography>
      </Box>

      <Readiness listing={listing} />

      <Box sx={{ display: 'flex', justifyContent: { xs: 'flex-end', md: 'center' } }}>
        <Tooltip title="Listing actions">
          <IconButton
            size="small"
            aria-label={`Actions for ${title}`}
            onClick={(event) => {
              event.stopPropagation();
              setAnchorEl(event.currentTarget);
            }}
          >
            <MoreOutlined />
          </IconButton>
        </Tooltip>
        <Menu anchorEl={anchorEl} open={Boolean(anchorEl)} onClose={() => setAnchorEl(null)} onClick={(event) => event.stopPropagation()}>
          <MenuItem
            onClick={(event) => {
              event.stopPropagation();
              setAnchorEl(null);
              onOpen(listing);
            }}
          >
            {active ? 'Open listing' : 'Continue draft'}
          </MenuItem>
          <MenuItem
            onClick={() => {
              setAnchorEl(null);
              onDelete(listing);
            }}
            sx={{ color: 'error.main' }}
          >
            Delete listing
          </MenuItem>
        </Menu>
      </Box>
    </Box>
  );
}

function ListingsTab() {
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
  const [listingToDelete, setListingToDelete] = useState(null);
  const [deleting, setDeleting] = useState(false);

  useEffect(() => {
    dispatch(getListings());
  }, [dispatch]);

  useEffect(() => {
    setPage(1);
  }, [availability, readiness, search, sort, status]);

  const filteredListings = useMemo(() => {
    const query = search.trim().toLowerCase();
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const filtered = listings.filter((listing) => {
      const searchable = [getTitle(listing), getAddress(listing), read(listing, 'listingNumber', 'ListingNumber')]
        .filter(Boolean)
        .join(' ')
        .toLowerCase();
      const issues = getReadinessIssues(listing);
      const available = getAvailableDate(listing);

      if (query && !searchable.includes(query)) return false;
      if (status === 'active' && !isActiveListing(listing)) return false;
      if (status === 'draft' && isActiveListing(listing)) return false;
      if (readiness === 'ready' && issues.length > 0) return false;
      if (readiness === 'attention' && issues.length === 0) return false;
      if (readiness === 'photos' && !issues.includes('photos')) return false;
      if (readiness === 'rent' && !issues.includes('rent')) return false;
      if (readiness === 'address' && !issues.includes('address')) return false;
      if (readiness === 'description' && !issues.includes('description')) return false;
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
      if (sort === 'availability')
        return (getAvailableDate(a)?.getTime() || Number.MAX_SAFE_INTEGER) - (getAvailableDate(b)?.getTime() || Number.MAX_SAFE_INTEGER);
      if (sort === 'name') return getTitle(a).localeCompare(getTitle(b));
      if (sort === 'readiness') return getReadinessIssues(b).length - getReadinessIssues(a).length;
      return (getUpdatedDate(b)?.getTime() || 0) - (getUpdatedDate(a)?.getTime() || 0);
    });
  }, [availability, listings, readiness, search, sort, status]);

  const pageCount = Math.ceil(filteredListings.length / PAGE_SIZE);
  const currentPage = Math.min(page, Math.max(1, pageCount));
  const paginatedListings = filteredListings.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE);
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

  const confirmDelete = async () => {
    if (!listingToDelete || deleting) return;
    setDeleting(true);
    try {
      const result = await dispatch(deleteListing(getId(listingToDelete)));
      if (!result?.success) throw new Error(result?.message || 'Failed to delete listing');
      setListingToDelete(null);
      openSnackbar({ open: true, message: 'Listing deleted. Applications were kept.', variant: 'alert', alert: { color: 'success' } });
    } catch (error) {
      openSnackbar({ open: true, message: error?.message || 'Failed to delete listing', variant: 'alert', alert: { color: 'error' } });
    } finally {
      setDeleting(false);
    }
  };

  return (
    <Box sx={{ pb: 3 }}>
      <Typography sx={{ mb: 2.5, color: 'text.secondary', maxWidth: 760 }}>
        Create and manage rental listings with rent, availability, photos, and marketing details. Use the filters below to find drafts and listings that need attention.
      </Typography>

      <Box data-testid="listing-filters" sx={{ mb: 2 }}>
          <Stack direction={{ xs: 'column', md: 'row' }} spacing={1.1} alignItems={{ md: 'center' }}>
            <OutlinedInput
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Search listings, addresses, units, or listing numbers"
              size="small"
              startAdornment={
                <InputAdornment position="start">
                  <SearchOutlined />
                </InputAdornment>
              }
              sx={{ flex: 1, minWidth: { md: 260 }, borderRadius: 1.75 }}
            />
            <Stack direction="row" spacing={1} sx={{ overflowX: 'auto', pb: { xs: 0.25, md: 0 } }}>
              <Select
                size="small"
                value={status}
                onChange={(event) => setStatus(event.target.value)}
                IconComponent={DownOutlined}
                sx={{ minWidth: 126, borderRadius: 1.75 }}
              >
                <MenuItem value="all">All status</MenuItem>
                <MenuItem value="active">Active</MenuItem>
                <MenuItem value="draft">Draft</MenuItem>
              </Select>
              <Select
                size="small"
                value={readiness}
                onChange={(event) => setReadiness(event.target.value)}
                IconComponent={DownOutlined}
                sx={{ minWidth: 160, borderRadius: 1.75 }}
              >
                <MenuItem value="all">All readiness</MenuItem>
                <MenuItem value="ready">Ready to market</MenuItem>
                <MenuItem value="attention">Needs attention</MenuItem>
                <MenuItem value="photos">Missing photos</MenuItem>
                <MenuItem value="rent">Missing rent</MenuItem>
                <MenuItem value="address">Missing address</MenuItem>
                <MenuItem value="description">Missing description</MenuItem>
              </Select>
              <Select
                size="small"
                value={availability}
                onChange={(event) => setAvailability(event.target.value)}
                IconComponent={DownOutlined}
                sx={{ minWidth: 156, borderRadius: 1.75 }}
              >
                <MenuItem value="all">All availability</MenuItem>
                <MenuItem value="now">Available now</MenuItem>
                <MenuItem value="upcoming">Next 60 days</MenuItem>
                <MenuItem value="unset">Date not set</MenuItem>
              </Select>
              <Select
                size="small"
                value={sort}
                onChange={(event) => setSort(event.target.value)}
                IconComponent={DownOutlined}
                sx={{ minWidth: 158, borderRadius: 1.75 }}
              >
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
            <Typography sx={{ fontSize: '0.76rem', color: 'text.secondary' }}>
              {filteredListings.length} of {listings.length} listings
            </Typography>
            {hasFilters && (
              <Button size="small" onClick={clearFilters} sx={{ textTransform: 'none' }}>
                Reset view
              </Button>
            )}
          </Stack>
      </Box>

      <Box
        data-testid="listing-table"
        sx={{
          bgcolor: 'background.paper',
          border: `1px solid ${alpha(theme.palette.divider, 0.16)}`,
          borderRadius: 3,
          boxShadow: `0 8px 28px ${alpha('#061e35', 0.055)}`,
          overflow: 'hidden'
        }}
      >
        <Box
          sx={{
            display: { xs: 'none', md: 'grid' },
            gridTemplateColumns:
              'minmax(245px, 1.8fr) minmax(105px, .7fr) minmax(90px, .65fr) minmax(125px, .85fr) minmax(160px, 1fr) 44px',
            gap: 2,
            px: 2,
            py: 1.15,
            bgcolor: alpha(theme.palette.primary.main, 0.025)
          }}
        >
          {['Listing', 'Rent', 'Status', 'Available', 'Marketing readiness', ''].map((label) => (
            <Typography
              key={label || 'actions'}
              sx={{ fontSize: '0.66rem', fontWeight: 750, letterSpacing: 0.65, textTransform: 'uppercase', color: 'text.secondary' }}
            >
              {label}
            </Typography>
          ))}
        </Box>

        {isLoading ? (
          <Stack alignItems="center" spacing={1} sx={{ py: 7 }}>
            <CircularProgress size={26} />
            <Typography sx={{ fontSize: '0.82rem', color: 'text.secondary' }}>Loading listings…</Typography>
          </Stack>
        ) : listings.length === 0 ? (
          <Stack alignItems="center" spacing={1.5} sx={{ py: 7, px: 2, textAlign: 'center' }}>
            <Avatar sx={{ width: 54, height: 54, bgcolor: alpha(theme.palette.success.main, 0.1), color: 'success.main' }}>
              <CameraOutlined />
            </Avatar>
            <Typography variant="h5" fontWeight={700}>
              Create your first listing
            </Typography>
            <Typography sx={{ color: 'text.secondary', fontSize: '0.85rem', maxWidth: 440 }}>
              Add the rent, availability, photos, and marketing details tenants need to discover your property.
            </Typography>
            <Button
              variant="contained"
              startIcon={<PlusOutlined />}
              onClick={() => navigate('/landlord/listings/add')}
              sx={{ textTransform: 'none', fontWeight: 700, bgcolor: '#061e35', color: '#fff', '&:hover': { bgcolor: '#0b2f4f' } }}
            >
              Add listing
            </Button>
          </Stack>
        ) : filteredListings.length === 0 ? (
          <Stack alignItems="center" spacing={1.5} sx={{ py: 7, px: 2, textAlign: 'center' }}>
            <Typography variant="h6" fontWeight={700}>
              No listings match this view
            </Typography>
            <Typography sx={{ color: 'text.secondary', fontSize: '0.85rem' }}>
              Try a different search or reset the listing filters.
            </Typography>
            <Button variant="outlined" onClick={clearFilters} sx={{ textTransform: 'none' }}>
              Reset filters
            </Button>
          </Stack>
        ) : (
          paginatedListings.map((listing) => <ListingRow key={getId(listing)} listing={listing} onOpen={openListing} onDelete={setListingToDelete} />)
        )}

        {pageCount > 1 && (
          <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1.5} alignItems="center" justifyContent="space-between" sx={{ p: 2 }}>
            <Typography sx={{ fontSize: '0.76rem', color: 'text.secondary' }}>
              Showing {(currentPage - 1) * PAGE_SIZE + 1}–{Math.min(currentPage * PAGE_SIZE, filteredListings.length)} of {filteredListings.length}
            </Typography>
            <Pagination count={pageCount} page={currentPage} onChange={(_, value) => setPage(value)} color="primary" shape="rounded" />
          </Stack>
        )}
      </Box>

      <Dialog open={Boolean(listingToDelete)} onClose={deleting ? undefined : () => setListingToDelete(null)}>
        <DialogTitle>Delete listing?</DialogTitle>
        <DialogContent>
          <Typography>
            Permanently delete {listingToDelete ? getTitle(listingToDelete) : 'this listing'} and its listing photos and details?
            Applications will remain in the Applications tab. This cannot be undone.
          </Typography>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setListingToDelete(null)} disabled={deleting}>Cancel</Button>
          <Button onClick={confirmDelete} color="error" variant="contained" disabled={deleting}>
            {deleting ? 'Deleting…' : 'Permanently delete'}
          </Button>
        </DialogActions>
      </Dialog>
      <ListingAddWorkflowDrawer />
    </Box>
  );
}

export default function ListingsPage() {
  const theme = useTheme();
  const drawer = useDrawer();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const activeTab = searchParams.get('tab') === 'applications' ? 'applications' : 'listings';

  const handleTabChange = (_, nextTab) => {
    const next = new URLSearchParams(searchParams);
    if (nextTab === 'applications') next.set('tab', 'applications');
    else next.delete('tab');
    if (nextTab !== 'applications') {
      next.delete('applicationId');
      next.delete('propertyId');
    }
    setSearchParams(next, { replace: true });
  };

  return (
    <Box sx={{ pb: 3 }}>
      <ManagementPageHeader
        title="Listings & Applications"
        showBreadcrumbs={false}
        actions={
          <Button
            variant="contained"
            color={activeTab === 'applications' ? 'primary' : undefined}
            startIcon={<PlusOutlined />}
            onClick={() =>
              activeTab === 'applications' ? drawer.openApplicationAddDrawer() : navigate('/landlord/listings/add')
            }
            sx={activeTab === 'applications' ? managementPageHeaderActionSx : { ...managementPageHeaderActionSx, bgcolor: '#061e35', color: '#fff', '&:hover': { bgcolor: '#0b2f4f' } }}
          >
            {activeTab === 'applications' ? 'New application' : 'Add listing'}
          </Button>
        }
      />

      <Box
        sx={{
          mt: 0.5,
          mb: 2.5,
          position: 'relative',
          isolation: 'isolate',
          width: '100%',
          '&::after': {
            content: '""',
            position: 'absolute',
            right: 0,
            bottom: 0,
            left: 0,
            height: '1px',
            bgcolor: alpha(theme.palette.text.primary, theme.palette.mode === 'dark' ? 0.22 : 0.12),
            pointerEvents: 'none',
            zIndex: 0
          },
          '& .MuiTabs-root': { minHeight: 42 },
          '& .MuiTab-root': {
            minHeight: 42,
            px: 1.25,
            mr: 1.5,
            borderRadius: 1.5,
            textTransform: 'none',
            fontSize: '0.875rem',
            fontWeight: 700,
            color: 'text.secondary',
            transition: theme.transitions.create(['background-color', 'box-shadow', 'color'], {
              duration: theme.transitions.duration.shorter
            }),
            '&:hover': {
              color: theme.palette.mode === 'dark' ? 'primary.light' : 'primary.main',
              backgroundColor: alpha(theme.palette.primary.main, theme.palette.mode === 'dark' ? 0.16 : 0.08),
              boxShadow: theme.palette.mode === 'dark' ? `inset 0 0 0 1px ${alpha(theme.palette.primary.main, 0.24)}` : 'none'
            },
            '&.Mui-selected': {
              color: theme.palette.mode === 'dark' ? 'primary.light' : 'primary.main',
              backgroundColor: alpha(theme.palette.primary.main, theme.palette.mode === 'dark' ? 0.12 : 0.04)
            }
          },
          '& .MuiTabs-indicator': {
            zIndex: 1,
            height: 2,
            borderRadius: 2,
            backgroundColor: 'primary.main'
          }
        }}
      >
        <Tabs
          value={activeTab}
          onChange={handleTabChange}
          variant="scrollable"
          scrollButtons="auto"
          aria-label="Listings and applications views"
        >
          <Tab value="listings" label="Listings" id="listings-tab" aria-controls="listings-panel" />
          <Tab value="applications" label="Applications" id="applications-tab" aria-controls="applications-panel" />
        </Tabs>
      </Box>

      <Box id={`${activeTab}-panel`} role="tabpanel" aria-labelledby={`${activeTab}-tab`}>
        {activeTab === 'applications' ? <ApplicationsPage hideHeader /> : <ListingsTab />}
      </Box>
    </Box>
  );
}
