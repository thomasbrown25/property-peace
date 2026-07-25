import { useState, useMemo, useEffect } from 'react';
import {
  Box,
  Typography,
  Grid,
  Stack,
  Button,
  CircularProgress,
  Fade,
  OutlinedInput,
  InputAdornment,
  Select,
  MenuItem,
  FormControl,
  Chip,
  LinearProgress,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  IconButton
} from '@mui/material';
import { PlusOutlined, SearchOutlined, CloseOutlined, MoreOutlined, LeftOutlined, RightOutlined } from '@ant-design/icons';
import { alpha } from '@mui/system';

import AnimateIn from 'components/AnimateIn';

import ListingsHeader from 'sections/landlord/listings/ListingsHeader';
import ListingsEmptyState from 'sections/landlord/listings/ListingsEmptyState';

import { useDispatch, useSelector } from 'react-redux';
import { getListings } from 'store/listing/listing.action';
import { selectListings, selectListingLoading } from 'store/listing/listing.selector';
import { useDrawer } from 'contexts/DrawerContext';
import { useNavigate } from 'react-router-dom';
import { formatCurrency } from 'utils/formatters';
import ListingAddWorkflowDrawer from 'components/drawers/ListingAddWorkflowDrawer';

const PER_PAGE = 6;

const darkAwareBorder = (theme, opacity = 0.14) =>
  theme.palette.mode === 'dark' ? alpha('#cbd5e1', opacity) : 'rgba(0,0,0,0.09)';

const sidebarHeaderColor = (theme) => (theme.palette.mode === 'dark' ? theme.palette.text.primary : alpha('#061e35', 0.58));

const sectionCardSx = {
  p: 2,
  borderRadius: 2,
  bgcolor: 'background.paper',
  border: (t) => `1px solid ${darkAwareBorder(t)}`,
  boxShadow: (t) => t.palette.mode === 'dark'
    ? `0 0 0 1px ${alpha(t.palette.primary.main, 0.22)}, 0 8px 28px ${alpha(t.palette.primary.main, 0.14)}`
    : `0 2px 12px ${alpha(t.palette.primary.main, 0.08)}`
};

const getStatusLabel = (status) => {
  if (typeof status === 'string') return status;
  const map = { 0: 'Draft', 1: 'Active', 2: 'Expired', 3: 'Unlisted' };
  return map[status] ?? 'Draft';
};

const getListingTitle = (listing) => {
  const propertyName = listing.propertyName || listing.PropertyName || 'Untitled listing';
  const unitName = listing.unitName || listing.UnitName || '';
  return unitName ? `${propertyName}, ${unitName}` : propertyName;
};

const getListingDate = (listing, fields) => {
  const raw = fields.map((field) => listing?.[field]).find(Boolean);
  return raw ? new Date(raw) : null;
};

const hasListingPhoto = (listing) => {
  const images = listing.images || listing.Images || [];
  return Boolean((Array.isArray(images) && images.length > 0) || listing.coverImageUrl || listing.CoverImageUrl);
};

const getListingAddress = (listing) => listing.propertyAddress || listing.PropertyAddress || listing.streetAddress || listing.StreetAddress || 'No address';

const getListingRent = (listing) => Number(listing.monthlyRent ?? listing.MonthlyRent ?? 0);

const getListingAvailabilityDate = (listing) => getListingDate(listing, ['availableDate', 'AvailableDate', 'availabilityDate', 'AvailabilityDate', 'dateAvailable', 'DateAvailable', 'availableOn', 'AvailableOn']);

const formatListingDate = (date, options = { month: 'short', day: 'numeric', year: 'numeric' }) => {
  if (!date || Number.isNaN(date.getTime())) return '—';
  return date.toLocaleDateString(undefined, options);
};

const getListingReadiness = (listing) => {
  const issues = [];
  if (!hasListingPhoto(listing)) issues.push('photos');
  if (getListingRent(listing) <= 0) issues.push('rent');
  const status = String(getStatusLabel(listing.status ?? listing.Status)).toLowerCase();
  if (status === 'draft') issues.push('draft');
  const updated = getListingDate(listing, ['updatedAt', 'UpdatedAt', 'createdAt', 'CreatedAt']);
  if (updated && Math.floor((Date.now() - updated.getTime()) / 86400000) >= 30) issues.push('stale');
  return issues;
};


function HealthMetric({ label, value, color = 'success.main', progress = 0, note, onClick }) {
  return (
    <Box
      onClick={onClick}
      sx={{
        cursor: onClick ? 'pointer' : 'default',
        borderRadius: 1.25,
        p: onClick ? 0.75 : 0,
        mx: onClick ? -0.75 : 0,
        transition: 'background-color 0.15s ease',
        '&:hover': onClick ? { bgcolor: (t) => alpha(t.palette.action.hover, t.palette.mode === 'dark' ? 0.5 : 0.7) } : undefined
      }}
    >
      <Stack direction="row" alignItems="center" justifyContent="space-between" sx={{ mb: 0.4 }}>
        <Typography sx={{ fontSize: '0.82rem', color: 'text.secondary', fontWeight: 500 }}>{label}</Typography>
        <Typography sx={{ fontSize: '0.88rem', fontWeight: 700 }}>{value}</Typography>
      </Stack>
      <LinearProgress
        variant="determinate"
        value={Math.min(100, Math.max(0, progress))}
        sx={{ height: 5, borderRadius: 99, bgcolor: (t) => alpha(t.palette.text.primary, t.palette.mode === 'dark' ? 0.14 : 0.07), '& .MuiLinearProgress-bar': { borderRadius: 99, bgcolor: color } }}
      />
      {note && <Typography sx={{ mt: 0.35, fontSize: '0.68rem', color, fontWeight: 700 }}>{note}</Typography>}
    </Box>
  );
}

function ListingHealthCard({ listings, onFilter }) {
  const metrics = useMemo(() => {
    const total = listings.length || 0;
    const draft = listings.filter((listing) => String(getStatusLabel(listing.status ?? listing.Status)).toLowerCase() === 'draft').length;
    const inactive = listings.filter((listing) => {
      const status = String(getStatusLabel(listing.status ?? listing.Status)).toLowerCase();
      return status === 'unlisted' || status === 'expired' || status === 'inactive';
    }).length;
    const missingPhotos = listings.filter((listing) => !hasListingPhoto(listing)).length;
    const missingRent = listings.filter((listing) => Number(listing.monthlyRent ?? listing.MonthlyRent ?? 0) <= 0).length;
    const stale = listings.filter((listing) => {
      const updated = getListingDate(listing, ['updatedAt', 'UpdatedAt', 'createdAt', 'CreatedAt']);
      if (!updated) return false;
      return Math.floor((Date.now() - updated.getTime()) / 86400000) >= 30;
    }).length;
    const issues = missingPhotos + missingRent + draft + inactive + stale;
    const health = total ? Math.max(0, Math.round(((total * 4 - issues) / (total * 4)) * 100)) : 100;
    const level = health >= 85 ? 'healthy' : health >= 65 ? 'watch' : 'needs work';
    const levelColor = level === 'healthy' ? 'success.main' : level === 'watch' ? 'warning.main' : 'error.main';
    return { total, draft, inactive, missingPhotos, missingRent, stale, health, level, levelColor };
  }, [listings]);

  return (
    <Box sx={sectionCardSx}>
      <Stack direction="row" alignItems="center" justifyContent="space-between" sx={{ mb: 2 }}>
        <Typography sx={{ fontSize: '0.72rem', fontWeight: 700, letterSpacing: 0.8, color: sidebarHeaderColor, textTransform: 'uppercase' }}>
          Listing Health
        </Typography>
        <Typography sx={{ fontSize: '0.78rem', color: metrics.levelColor, fontWeight: 700 }}>• {metrics.level}</Typography>
      </Stack>
      <Stack spacing={1.45}>
        <HealthMetric label="Publish readiness" value={`${metrics.health}%`} progress={metrics.health} color={metrics.levelColor} note={metrics.total ? `${metrics.total} listing${metrics.total === 1 ? '' : 's'} reviewed` : 'No listings yet'} />
        <HealthMetric label="Missing photos" value={metrics.missingPhotos} progress={metrics.total ? (metrics.missingPhotos / metrics.total) * 100 : 0} color={metrics.missingPhotos ? 'warning.main' : 'success.main'} note={metrics.missingPhotos ? 'add photos before publishing' : 'photos look good'} onClick={metrics.missingPhotos ? () => onFilter('missingPhotos') : undefined} />
        <HealthMetric label="Missing rent" value={metrics.missingRent} progress={metrics.total ? (metrics.missingRent / metrics.total) * 100 : 0} color={metrics.missingRent ? 'error.main' : 'success.main'} note={metrics.missingRent ? 'rent needed for marketing' : 'rent is set'} onClick={metrics.missingRent ? () => onFilter('missingRent') : undefined} />
        <HealthMetric label="Draft / inactive" value={metrics.draft + metrics.inactive} progress={metrics.total ? ((metrics.draft + metrics.inactive) / metrics.total) * 100 : 0} color={metrics.draft + metrics.inactive ? 'primary.main' : 'success.main'} note={metrics.draft + metrics.inactive ? 'review unpublished listings' : 'all visible listings ready'} onClick={metrics.draft ? () => onFilter('draft') : metrics.inactive ? () => onFilter('unlisted') : undefined} />
        <HealthMetric label="Stale listings" value={metrics.stale} progress={metrics.total ? (metrics.stale / metrics.total) * 100 : 0} color={metrics.stale ? 'warning.main' : 'success.main'} note={metrics.stale ? '30+ days without updates' : 'recently maintained'} onClick={metrics.stale ? () => onFilter('stale') : undefined} />
      </Stack>
    </Box>
  );
}

function UpcomingAvailabilityCard({ listings }) {
  const upcomingItems = useMemo(() => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    return listings
      .map((listing) => {
        const date = getListingDate(listing, ['availableDate', 'AvailableDate', 'availabilityDate', 'AvailabilityDate', 'dateAvailable', 'DateAvailable', 'availableOn', 'AvailableOn']);
        if (!date || Number.isNaN(date.getTime())) return null;
        date.setHours(0, 0, 0, 0);
        if (date < today) return null;
        const status = getStatusLabel(listing.status ?? listing.Status);
        return { date, title: getListingTitle(listing), subtitle: `${status} · available ${date.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })}` };
      })
      .filter(Boolean)
      .sort((a, b) => a.date - b.date)
      .slice(0, 4);
  }, [listings]);

  return (
    <Box sx={sectionCardSx}>
      <Stack direction="row" alignItems="center" justifyContent="space-between" sx={{ mb: 1.5 }}>
        <Typography sx={{ fontSize: '0.72rem', fontWeight: 700, letterSpacing: 0.8, color: sidebarHeaderColor, textTransform: 'uppercase' }}>
          Upcoming Availability
        </Typography>
      </Stack>
      <Stack spacing={1.25}>
        {upcomingItems.length ? upcomingItems.map((item, index) => (
          <Stack key={`${item.title}-${index}`} direction="row" spacing={1.25} alignItems="center">
            <Box sx={{ width: 58, py: 0.65, borderRadius: 1.5, bgcolor: (t) => alpha(t.palette.text.primary, t.palette.mode === 'dark' ? 0.08 : 0.04), border: (t) => `1px solid ${darkAwareBorder(t, 0.1)}`, textAlign: 'center', flexShrink: 0 }}>
              <Typography sx={{ fontSize: '0.72rem', color: index === 0 ? 'success.main' : index === 1 ? 'primary.main' : 'warning.main', fontWeight: 800 }}>
                {item.date.toLocaleDateString(undefined, { month: 'short', day: 'numeric' }).toUpperCase()}
              </Typography>
            </Box>
            <Box sx={{ minWidth: 0 }}>
              <Typography sx={{ fontSize: '0.9rem', fontWeight: 700, lineHeight: 1.25 }} noWrap>{item.title}</Typography>
              <Typography sx={{ fontSize: '0.75rem', color: 'text.secondary' }} noWrap>{item.subtitle}</Typography>
            </Box>
          </Stack>
        )) : (
          <Typography variant="body2" color="text.secondary">No upcoming availability dates.</Typography>
        )}
      </Stack>
    </Box>
  );
}


function ListingsTableView({ listings, onOpenListing }) {
  return (
    <Box sx={{ ...sectionCardSx, p: 0, overflow: 'hidden' }}>
      <TableContainer sx={{ width: '100%', overflowX: 'auto' }}>
        <Table size="small" sx={{ minWidth: 860 }}>
          <TableHead>
            <TableRow>
              <TableCell sx={{ fontWeight: 700, color: 'text.secondary', fontSize: '0.74rem', textTransform: 'uppercase', letterSpacing: 0.6 }}>Listing</TableCell>
              <TableCell sx={{ fontWeight: 700, color: 'text.secondary', fontSize: '0.74rem', textTransform: 'uppercase', letterSpacing: 0.6 }}>Rent</TableCell>
              <TableCell sx={{ fontWeight: 700, color: 'text.secondary', fontSize: '0.74rem', textTransform: 'uppercase', letterSpacing: 0.6 }}>Status</TableCell>
              <TableCell sx={{ fontWeight: 700, color: 'text.secondary', fontSize: '0.74rem', textTransform: 'uppercase', letterSpacing: 0.6 }}>Available</TableCell>
              <TableCell sx={{ fontWeight: 700, color: 'text.secondary', fontSize: '0.74rem', textTransform: 'uppercase', letterSpacing: 0.6 }}>Updated</TableCell>
              <TableCell align="right" />
            </TableRow>
          </TableHead>
          <TableBody>
            {listings.map((listing) => {
              const status = getStatusLabel(listing.status ?? listing.Status);
              const statusKey = String(status).toLowerCase();
              const availableDate = getListingAvailabilityDate(listing);
              const updatedDate = getListingDate(listing, ['updatedAt', 'UpdatedAt', 'createdAt', 'CreatedAt']);
              const rent = getListingRent(listing);
              const statusLabel = statusKey === 'active' || statusKey === 'published' ? 'Active' : 'Draft';
              const statusColor = statusLabel === 'Active' ? 'success' : 'warning';

              return (
                <TableRow key={listing.id || listing.Id} hover onClick={() => onOpenListing(listing)} sx={{ cursor: 'pointer', '&:last-child td': { borderBottom: 0 } }}>
                  <TableCell sx={{ py: 1.35 }}>
                    <Box sx={{ minWidth: 0 }}>
                      <Typography variant="body2" fontWeight={500} noWrap>{getListingTitle(listing)}</Typography>
                      <Typography variant="caption" color="text.secondary" noWrap sx={{ display: 'block' }}>{getListingAddress(listing)}</Typography>
                    </Box>
                  </TableCell>
                  <TableCell sx={{ py: 1.35 }}>
                    <Typography variant="body2" fontWeight={600} color={rent > 0 ? 'text.primary' : 'text.disabled'}>{rent > 0 ? formatCurrency(rent) : '—'}</Typography>
                    <Typography variant="caption" color="text.secondary">monthly</Typography>
                  </TableCell>
                  <TableCell sx={{ py: 1.35 }}>
                    <Chip size="small" label={statusLabel} color={statusColor} sx={{ height: 22, fontWeight: 700, '& .MuiChip-label': { px: 0.8 } }} />
                  </TableCell>
                  <TableCell sx={{ py: 1.35 }}>
                    <Typography variant="body2" fontWeight={500}>{formatListingDate(availableDate)}</Typography>
                    <Typography variant="caption" color="text.secondary">availability</Typography>
                  </TableCell>
                  <TableCell sx={{ py: 1.35 }}>
                    <Typography variant="body2" color="text.secondary">{formatListingDate(updatedDate, { month: 'short', day: 'numeric' })}</Typography>
                  </TableCell>
                  <TableCell align="right" onClick={(e) => e.stopPropagation()}>
                    <IconButton size="small" onClick={() => onOpenListing(listing)}>
                      <MoreOutlined />
                    </IconButton>
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </TableContainer>
    </Box>
  );
}

// ================================|| LANDLORD - LISTINGS ||================================ //

export default function ListingsPage() {
  const dispatch = useDispatch();
  const drawer = useDrawer();
  const navigate = useNavigate();
  const listings = useSelector(selectListings);
  const isLoading = useSelector(selectListingLoading);

  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [activeFilter, setActiveFilter] = useState(null);
  const [sort, setSort] = useState('newest');
  const [fadeIn, setFadeIn] = useState(false);

  useEffect(() => {
    setFadeIn(true);
  }, []);

  useEffect(() => {
    dispatch(getListings());
  }, [dispatch]);

  const filteredListings = useMemo(() => {
    if (!listings || !Array.isArray(listings)) return [];
    let list = [...listings];
    if (activeFilter === 'published') {
      list = list.filter((l) => {
        const s = String(getStatusLabel(l.status ?? l.Status)).toLowerCase();
        return s === 'active' || s === 'published' || s === '1';
      });
    } else if (activeFilter === 'draft') {
      list = list.filter((l) => {
        const s = String(getStatusLabel(l.status ?? l.Status)).toLowerCase();
        return s === 'draft' || s === '0';
      });
    } else if (activeFilter === 'unlisted') {
      list = list.filter((l) => {
        const s = String(getStatusLabel(l.status ?? l.Status)).toLowerCase();
        return s === 'unlisted' || s === 'expired' || s === 'inactive';
      });
    } else if (activeFilter === 'missingPhotos') {
      list = list.filter((l) => !hasListingPhoto(l));
    } else if (activeFilter === 'missingRent') {
      list = list.filter((l) => Number(l.monthlyRent ?? l.MonthlyRent ?? 0) <= 0);
    } else if (activeFilter === 'stale') {
      list = list.filter((l) => {
        const updated = getListingDate(l, ['updatedAt', 'UpdatedAt', 'createdAt', 'CreatedAt']);
        return updated && Math.floor((Date.now() - updated.getTime()) / 86400000) >= 30;
      });
    }
    if (search.trim()) {
      const q = search.toLowerCase();
      list = list.filter((l) =>
        (l.propertyName || l.PropertyName || '').toLowerCase().includes(q) ||
        (l.propertyAddress || l.PropertyAddress || l.streetAddress || l.StreetAddress || '').toLowerCase().includes(q)
      );
    }
    if (sort === 'newest') list.sort((a, b) => new Date(b.createdAt || b.CreatedAt || 0) - new Date(a.createdAt || a.CreatedAt || 0));
    else if (sort === 'oldest') list.sort((a, b) => new Date(a.createdAt || a.CreatedAt || 0) - new Date(b.createdAt || b.CreatedAt || 0));
    else if (sort === 'rent_asc') list.sort((a, b) => (a.monthlyRent || 0) - (b.monthlyRent || 0));
    else if (sort === 'rent_desc') list.sort((a, b) => (b.monthlyRent || 0) - (a.monthlyRent || 0));
    return list;
  }, [listings, search, activeFilter, sort]);

  const count = Math.ceil(filteredListings.length / PER_PAGE);
  const paginated = filteredListings.slice((page - 1) * PER_PAGE, page * PER_PAGE);

  const handleOpenListing = (listing) => {
    const status = String(getStatusLabel(listing.status ?? listing.Status)).toLowerCase();
    if (status === 'draft') {
      drawer.openListingAddDrawer(listing);
      return;
    }
    const id = listing.id || listing.Id;
    if (id) navigate(`/landlord/listings/${id}`);
  };

  return (
    <>
    <Fade in={fadeIn} timeout={600}>
      <Box sx={{ overflow: 'visible' }}>
        <AnimateIn direction="bottom" delay={100} distance={120}>
          <ListingsHeader />
        </AnimateIn>

        <Box>
          <AnimateIn direction="bottom" delay={400} distance={120}>
            <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1.5} alignItems={{ xs: 'stretch', sm: 'center' }} justifyContent="space-between" sx={{ mt: 3, mb: 3 }}>
              {/* Left: Search card + Sort + Active filter chip */}
              <Stack direction="row" spacing={1.5} alignItems="center" flexWrap="wrap" flex={1}>
                <OutlinedInput
                  size="small"
                  placeholder="Search properties..."
                  value={search}
                  onChange={(e) => { setSearch(e.target.value); setPage(1); }}
                  startAdornment={
                    <InputAdornment position="start">
                      <SearchOutlined style={{ fontSize: 14, opacity: 0.5 }} />
                    </InputAdornment>
                  }
                  sx={{ flex: 1, width: '100%', minWidth: 0, bgcolor: 'background.paper', height: 34, fontSize: '0.8rem' }}
                />
                <FormControl size="small" sx={{ minWidth: 140 }}>
                  <Select value={sort} onChange={(e) => { setSort(e.target.value); setPage(1); }} sx={{ bgcolor: 'background.paper', height: 34, fontSize: '0.8rem' }}>
                    <MenuItem value="newest">Newest First</MenuItem>
                    <MenuItem value="oldest">Oldest First</MenuItem>
                    <MenuItem value="rent_desc">Rent: High → Low</MenuItem>
                    <MenuItem value="rent_asc">Rent: Low → High</MenuItem>
                  </Select>
                </FormControl>
                {activeFilter && (
                  <Chip
                    label={activeFilter.charAt(0).toUpperCase() + activeFilter.slice(1)}
                    size="small"
                    onDelete={() => { setActiveFilter(null); setPage(1); }}
                    deleteIcon={<CloseOutlined style={{ fontSize: 11 }} />}
                    color="primary"
                    variant="outlined"
                  />
                )}
              </Stack>
              <Button
                size="small"
                variant="contained"
                color="primary"
                startIcon={<PlusOutlined style={{ fontSize: 13 }} />}
                onClick={() => drawer.openListingAddDrawer()}
                sx={{ borderRadius: 1.5, textTransform: 'none', flexShrink: 0, height: 34 }}
              >
                Add Listing
              </Button>
            </Stack>
          </AnimateIn>

          <AnimateIn direction="bottom" delay={500} distance={120}>
            <Grid container spacing={2.5} alignItems="flex-start">
              <Grid size={{ xs: 12, lg: 9 }}>
                {isLoading ? (
                  <Box textAlign="center" py={5}>
                    <CircularProgress size={24} />
                    <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
                      Loading listings...
                    </Typography>
                  </Box>
                ) : filteredListings.length === 0 ? (
                  <ListingsEmptyState />
                ) : (
                  <>
                    <ListingsTableView listings={paginated} onOpenListing={handleOpenListing} />
                    {count > 1 && (
                      <Box sx={{ display: 'flex', justifyContent: 'flex-end', alignItems: 'center', mt: 2, gap: 2 }}>
                        <Typography variant="body2" color="text.secondary">Page {page} of {count}</Typography>
                        <Box sx={{ display: 'flex', gap: 1 }}>
                          <Button size="small" variant="outlined" startIcon={<LeftOutlined />} onClick={() => setPage((p) => Math.max(1, p - 1))} disabled={page === 1} sx={{ minWidth: 100 }}>Previous</Button>
                          <Button size="small" variant="outlined" endIcon={<RightOutlined />} onClick={() => setPage((p) => Math.min(count, p + 1))} disabled={page >= count} sx={{ minWidth: 100 }}>Next</Button>
                        </Box>
                      </Box>
                    )}
                  </>
                )}
              </Grid>

              <Grid size={{ xs: 12, lg: 3 }}>
                <Stack spacing={2} sx={{ position: { lg: 'sticky' }, top: { lg: 88 } }}>
                  <ListingHealthCard listings={listings || []} onFilter={(filter) => { setActiveFilter(filter); setPage(1); }} />
                  <UpcomingAvailabilityCard listings={listings || []} />
                </Stack>
              </Grid>
            </Grid>
          </AnimateIn>
        </Box>
      </Box>
    </Fade>

    <ListingAddWorkflowDrawer />
    </>
  );
}


