import { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { Link as RouterLink } from 'react-router-dom';
import { Chip, Link, Stack, Divider } from '@mui/material';
import { Box, Typography } from '@mui/material';
import { alpha } from '@mui/system';
import MainCard from 'components/MainCard';
import CircularLoader from 'components/CircularLoader';
import AnimateItem from 'components/AnimateItem';
import listingApi from 'api/listing';
import { formatCurrency } from 'utils/formatters';
import { PlusOutlined } from '@ant-design/icons';

const STATUS_MAP = { 0: 'Draft', 1: 'Active', 2: 'Expired', 3: 'Unlisted' };
const STATUS_COLOR = { Draft: 'default', Active: 'success', Expired: 'warning', Unlisted: 'default' };

/** Returns normalized status label (Draft, Active, Expired, Unlisted) for counts and chip color. */
function statusLabel(status) {
  if (status == null) return 'Draft';
  if (typeof status === 'number') return STATUS_MAP[status] ?? 'Draft';
  const s = String(status).trim();
  if (!s) return 'Draft';
  const lower = s.toLowerCase();
  const normalized = lower.charAt(0).toUpperCase() + lower.slice(1);
  if (['Draft', 'Active', 'Expired', 'Unlisted'].includes(normalized)) return normalized;
  return STATUS_MAP[status] ?? 'Draft';
}

export default function ListingsList() {
  const navigate = useNavigate();
  const [listings, setListings] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      setLoading(true);
      try {
        const res = await listingApi.getListings();
        if (cancelled) return;
        const data = res?.data ?? res;
        setListings(Array.isArray(data) ? data : []);
      } catch {
        if (!cancelled) setListings([]);
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    load();
    return () => { cancelled = true; };
  }, []);

  const counts = useMemo(() => {
    let draft = 0;
    let active = 0;
    let expired = 0;
    listings.forEach((l) => {
      const s = statusLabel(l.status);
      if (s === 'Draft') draft += 1;
      else if (s === 'Active') active += 1;
      else if (s === 'Expired') expired += 1;
    });
    return { draft, active, expired };
  }, [listings]);

  const displayListings = listings.slice(0, 5);

  const handleListingClick = (listing) => {
    const id = listing.id ?? listing.listingId;
    if (!id) return;
    const status = statusLabel(listing.status);
    if (status === 'Draft') {
      navigate(`/landlord/listings/${id}/setup`);
    } else {
      navigate(`/landlord/listings/${id}`);
    }
  };

  return (
    <MainCard
      title="Listings"
      sx={{ height: '100%' }}
      secondary={
        <Link
          component={RouterLink}
          to="/landlord/listings"
          color="primary"
          sx={{
            fontSize: '0.875rem',
            fontWeight: 500,
            textDecoration: 'none',
            '&:hover': { textDecoration: 'underline' }
          }}
        >
          View all
        </Link>
      }
      content={false}
    >
      <Box sx={{ px: 2, pt: 1.5 }}>
        <Stack direction="row" spacing={1} sx={{ mb: 1.5, width: '100%' }}>
          <Box
            onClick={() => navigate('/landlord/listings?status=draft')}
            sx={{
              p: 1,
              borderRadius: 1.5,
              bgcolor: (t) => alpha(t.palette.grey[500], 0.08),
              border: (t) => `1px solid ${alpha(t.palette.divider, 0.2)}`,
              textAlign: 'center',
              flex: 1,
              minWidth: 0,
              cursor: 'pointer',
              transition: 'all 0.2s ease',
              '&:hover': {
                bgcolor: (t) => alpha(t.palette.grey[500], 0.12),
                transform: 'translateY(-2px) scale(1.02)',
                boxShadow: (t) => `0 2px 8px ${alpha(t.palette.common.black, 0.08)}`
              }
            }}
          >
            <Typography variant="h5" fontWeight={700} sx={{ fontSize: '1.25rem', lineHeight: 1.2, color: 'text.primary' }}>
              {counts.draft}
            </Typography>
            <Typography variant="caption" color="text.secondary" sx={{ fontSize: '0.7rem', fontWeight: 500 }}>
              Draft
            </Typography>
          </Box>
          <Box
            onClick={() => navigate('/landlord/listings?status=active')}
            sx={{
              p: 1,
              borderRadius: 1.5,
              bgcolor: (t) => alpha(t.palette.success.main, 0.06),
              border: (t) => `1px solid ${alpha(t.palette.success.main, 0.15)}`,
              textAlign: 'center',
              flex: 1,
              minWidth: 0,
              cursor: 'pointer',
              transition: 'all 0.2s ease',
              '&:hover': {
                bgcolor: (t) => alpha(t.palette.success.main, 0.12),
                transform: 'translateY(-2px) scale(1.02)',
                boxShadow: (t) => `0 2px 8px ${alpha(t.palette.success.main, 0.2)}`
              }
            }}
          >
            <Typography variant="h5" fontWeight={700} color="success.main" sx={{ fontSize: '1.25rem', lineHeight: 1.2 }}>
              {counts.active}
            </Typography>
            <Typography variant="caption" color="text.secondary" sx={{ fontSize: '0.7rem', fontWeight: 500 }}>
              Active
            </Typography>
          </Box>
          <Box
            onClick={() => navigate('/landlord/listings?status=expired')}
            sx={{
              p: 1,
              borderRadius: 1.5,
              bgcolor: (t) => alpha(t.palette.warning.main, 0.06),
              border: (t) => `1px solid ${alpha(t.palette.warning.main, 0.15)}`,
              textAlign: 'center',
              flex: 1,
              minWidth: 0,
              cursor: 'pointer',
              transition: 'all 0.2s ease',
              '&:hover': {
                bgcolor: (t) => alpha(t.palette.warning.main, 0.12),
                transform: 'translateY(-2px) scale(1.02)',
                boxShadow: (t) => `0 2px 8px ${alpha(t.palette.warning.main, 0.2)}`
              }
            }}
          >
            <Typography variant="h5" fontWeight={700} color="warning.main" sx={{ fontSize: '1.25rem', lineHeight: 1.2 }}>
              {counts.expired}
            </Typography>
            <Typography variant="caption" color="text.secondary" sx={{ fontSize: '0.7rem', fontWeight: 500 }}>
              Expired
            </Typography>
          </Box>
        </Stack>
        <Divider sx={{ mb: 1.5, borderColor: (t) => alpha(t.palette.divider, 0.08) }} />
      </Box>
      <Box sx={{ maxHeight: '500px', overflowY: 'auto', px: 2, pb: 1.5 }}>
        {loading ? (
          <Box display="flex" justifyContent="center" alignItems="center" sx={{ minHeight: '120px' }}>
            <CircularLoader />
          </Box>
        ) : displayListings.length > 0 ? (
          <Stack spacing={0}>
            {displayListings.map((listing, i) => {
              const status = statusLabel(listing.status);
              const label = status;
              const listingId = listing.id ?? listing.listingId;
              return (
                <AnimateItem key={listingId ?? i} delay={i * 50} direction="bottom">
                  <Box>
                    <Box
                      onClick={() => handleListingClick(listing)}
                      sx={{
                        p: 1.5,
                        borderRadius: 1,
                        cursor: 'pointer',
                        transition: 'all 0.2s ease',
                        '&:hover': {
                          bgcolor: (t) => alpha(t.palette.primary.main, 0.06),
                          transform: 'translateX(4px)'
                        }
                      }}
                    >
                      <Box display="flex" justifyContent="space-between" alignItems="center" mb={0.75}>
                        <Typography
                          variant="subtitle2"
                          fontWeight={600}
                          color="text.primary"
                          sx={{
                            flex: 1,
                            minWidth: 0,
                            overflow: 'hidden',
                            textOverflow: 'ellipsis',
                            whiteSpace: 'nowrap',
                            pr: 1
                          }}
                        >
                          #{listing.listingNumber ?? listingId ?? '—'}
                        </Typography>
                        <Chip
                          label={label}
                          size="small"
                          color={STATUS_COLOR[status] || 'default'}
                          sx={{
                            flexShrink: 0,
                            height: 22,
                            fontSize: '0.7rem',
                            fontWeight: 600,
                            '& .MuiChip-label': { px: 1 }
                          }}
                        />
                      </Box>
                      <Typography variant="body2" color="text.secondary" sx={{ fontSize: '0.75rem' }}>
                        {listing.unitName || 'Whole property'} · {formatCurrency(listing.monthlyRent)}
                      </Typography>
                    </Box>
                    {i < displayListings.length - 1 && (
                      <Divider sx={{ mx: 2, borderColor: (t) => alpha(t.palette.divider, 0.08) }} />
                    )}
                  </Box>
                </AnimateItem>
              );
            })}
          </Stack>
        ) : (
          <Box display="flex" flexDirection="column" alignItems="center" justifyContent="center" sx={{ minHeight: '120px', gap: 1 }}>
            <Typography variant="body2" color="text.secondary">
              No listings yet
            </Typography>
            <Link
              component={RouterLink}
              to="/landlord/listings/add"
              sx={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 0.5,
                fontSize: '0.875rem',
                fontWeight: 600,
                color: 'primary.main',
                textDecoration: 'none',
                '&:hover': { textDecoration: 'underline' }
              }}
            >
              <PlusOutlined /> Create listing
            </Link>
          </Box>
        )}
      </Box>
    </MainCard>
  );
}
