import PropTypes from 'prop-types';
import { useMemo, useState, useEffect } from 'react';

// material-ui
import { Typography, Box, Chip, Stack, Divider } from '@mui/material';
import { alpha } from '@mui/system';

import { formatCurrency } from 'utils/formatters';

// project imports
import MainCard from 'components/MainCard';
import placeholderImage from 'assets/images/placeholder-house.png';

import { useNavigate } from 'react-router';
import { useDrawer } from 'contexts/DrawerContext';

const STATUS_COLOR = {
  Draft: 'default',
  Active: 'success',
  Published: 'success',
  Expired: 'warning',
  Unlisted: 'default'
};

function statusLabel(status) {
  if (typeof status === 'string') return status;
  const map = { 0: 'Draft', 1: 'Active', 2: 'Expired', 3: 'Unlisted' };
  return map[status] ?? 'Draft';
}

export default function ListingCard({ listing }) {
  const navigate = useNavigate();
  const drawer = useDrawer();
  const [imageError, setImageError] = useState(false);

  useEffect(() => {
    setImageError(false);
  }, [listing?.id]);

  const {
    id,
    listingNumber,
    propertyName,
    unitName,
    propertyAddress,
    status,
    monthlyRent,
    bedrooms,
    baths,
    squareFeet,
    createdAt,
    images = [],
    coverImageUrl
  } = listing ?? {};

  const displayTitle = useMemo(() => {
    const name = propertyName?.trim() || 'Untitled listing';
    return unitName?.trim() ? `${name}, ${unitName.trim()}` : name;
  }, [propertyName, unitName]);

  const imageUrl = useMemo(() => {
    if (imageError) return placeholderImage;
    const list = images ?? [];
    const cover = list.find((img) => img.isCoverPhoto || img.IsCoverPhoto);
    const url = (img) => img?.blobUrl ?? img?.BlobUrl;
    if (cover && url(cover)) return url(cover);
    if (list.length > 0 && url(list[0])) return url(list[0]);
    const coverUrl = coverImageUrl ?? listing?.CoverImageUrl;
    if (coverUrl) return coverUrl;
    return placeholderImage;
  }, [images, coverImageUrl, listing, imageError]);

  const statusDisplay = useMemo(() => statusLabel(status), [status]);
  const chipColor = STATUS_COLOR[statusDisplay] || (String(statusDisplay).toLowerCase() === 'active' ? 'success' : 'default');

  const daysListed = useMemo(() => {
    if (!createdAt) return null;
    const days = Math.floor((Date.now() - new Date(createdAt)) / 86400000);
    return days;
  }, [createdAt]);

  const handleCardClick = (e) => {
    const target = e?.target;
    if (target?.closest('button') || target?.closest('[role="button"]') || target?.closest('a')) {
      return;
    }
    if (!id) return;
    const isDraft = String(statusDisplay).toLowerCase() === 'draft';
    if (isDraft) {
      drawer.openListingAddDrawer(listing);
    } else {
      navigate(`/landlord/listings/${id}`);
    }
  };

  return (
    <MainCard
      sx={{
        bgcolor: (t) => alpha(t.palette.background.paper, 0.6),
        boxShadow: (t) => `0 0 20px ${alpha(t.palette.primary.main, 0.15)}`,
        overflow: 'visible',
        cursor: 'pointer',
        transition: 'box-shadow 0.2s ease-in-out',
        position: 'relative',
        '&:hover': {
          boxShadow: (t) => `0 0 24px ${alpha(t.palette.primary.main, 0.25)}`
        },
        '& .MuiCardContent-root': {
          p: 0
        }
      }}
      onClick={handleCardClick}
    >
      <Box sx={{ display: 'flex', flexDirection: { xs: 'column', md: 'row' }, position: 'relative' }}>
        {/* Left - Image */}
        <Box
          sx={{
            position: 'relative',
            width: { xs: '100%', md: 230 },
            height: { xs: 240, md: 240 },
            overflow: 'hidden',
            backgroundColor: (theme) => alpha(theme.palette.background.default, 0.2),
            flexShrink: 0
          }}
        >
          <Box
            component="img"
            src={imageUrl}
            alt={displayTitle}
            onError={() => setImageError(true)}
            sx={{
              width: '100%',
              height: '100%',
              objectFit: 'cover'
            }}
          />
        </Box>

        {/* Right - Details */}
        <Box sx={{ flex: 1, minWidth: 0, pt: 2.5, px: 2.5, pb: 2.5, display: 'flex', flexDirection: 'column' }}>
          {/* Title + status */}
          <Box sx={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 1, mb: 0.5 }}>
            <Typography variant="h6" fontWeight={700} sx={{ color: 'primary.main', lineHeight: 1.2 }}>
              {displayTitle}
            </Typography>
            <Chip size="small" label={statusDisplay} color={chipColor} sx={{ flexShrink: 0 }} />
          </Box>

          {/* Address + listing number inline */}
          {propertyAddress && (
            <Stack direction="row" spacing={1} alignItems="center" sx={{ mb: 1.5 }} flexWrap="wrap">
              <Typography variant="body2" color="text.secondary">
                {propertyAddress}
              </Typography>
              {listingNumber && (
                <>
                  <Typography variant="caption" color="text.disabled">•</Typography>
                  <Typography variant="caption" color="text.disabled">
                    #{listingNumber}
                  </Typography>
                </>
              )}
            </Stack>
          )}

          {/* Beds / Baths / Sqft */}
          {(bedrooms || baths || squareFeet) && (
            <Stack direction="row" spacing={1.5} alignItems="center" sx={{ mb: 1.5 }}>
              {bedrooms && (
                <Typography variant="caption" color="text.secondary">
                  <strong>{bedrooms}</strong> bed{bedrooms !== 1 ? 's' : ''}
                </Typography>
              )}
              {baths && (
                <>
                  {bedrooms && <Divider orientation="vertical" flexItem />}
                  <Typography variant="caption" color="text.secondary">
                    <strong>{baths}</strong> bath{baths !== 1 ? 's' : ''}
                  </Typography>
                </>
              )}
              {squareFeet && (
                <>
                  {(bedrooms || baths) && <Divider orientation="vertical" flexItem />}
                  <Typography variant="caption" color="text.secondary">
                    <strong>{squareFeet.toLocaleString()}</strong> sq ft
                  </Typography>
                </>
              )}
            </Stack>
          )}

          <Box sx={{ mt: 'auto' }}>
            <Stack direction="row" alignItems="baseline" spacing={1.5}>
              <Box>
                <Typography variant="caption" color="text.secondary" sx={{ fontWeight: 600, textTransform: 'uppercase', letterSpacing: 0.5 }}>
                  Rent
                </Typography>
                <Typography variant="body1" fontWeight={700} color={(!monthlyRent || monthlyRent === 0) ? 'text.disabled' : 'text.primary'}>
                  {(!monthlyRent || monthlyRent === 0) ? '—' : formatCurrency(monthlyRent)}
                </Typography>
              </Box>
              {daysListed !== null && (
                <Typography variant="caption" color="text.disabled" sx={{ mb: 0.25 }}>
                  Listed {daysListed === 0 ? 'today' : `${daysListed}d ago`}
                </Typography>
              )}
            </Stack>
          </Box>
        </Box>
      </Box>
    </MainCard>
  );
}

ListingCard.propTypes = {
  listing: PropTypes.shape({
    id: PropTypes.oneOfType([PropTypes.string, PropTypes.number]),
    listingNumber: PropTypes.string,
    propertyName: PropTypes.string,
    unitName: PropTypes.string,
    propertyAddress: PropTypes.string,
    status: PropTypes.oneOfType([PropTypes.string, PropTypes.number]),
    monthlyRent: PropTypes.number,
    images: PropTypes.arrayOf(PropTypes.shape({ blobUrl: PropTypes.string, isCoverPhoto: PropTypes.bool })),
    coverImageUrl: PropTypes.string
  })
};
