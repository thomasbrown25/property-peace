import { useState } from 'react';
import PropTypes from 'prop-types';
import { alpha, Box, Chip, Skeleton, Stack, Typography, useTheme } from '@mui/material';
import { HomeOutlined } from '@ant-design/icons';
import { useNavigate } from 'react-router-dom';

import MainCard from 'components/MainCard';
import placeholderImage from 'assets/images/placeholder-house.png';

const read = (value, camel, pascal) => value?.[camel] ?? value?.[pascal];
const getId = (property) => read(property, 'id', 'Id');
const getUnits = (property) => read(property, 'units', 'Units') || [];

function getImageUrl(property) {
  const images = read(property, 'images', 'Images') || [];
  return read(property, 'mainImageUrl', 'MainImageUrl') || read(images[0], 'blobUrl', 'BlobUrl') || placeholderImage;
}

function getAddress(property) {
  const directAddress = read(property, 'address', 'Address');
  if (directAddress) return directAddress;

  const parts = [
    read(property, 'streetAddress', 'StreetAddress'),
    read(property, 'city', 'City'),
    read(property, 'state', 'State'),
    read(property, 'zipCode', 'ZipCode') || read(property, 'postalCode', 'PostalCode')
  ].filter(Boolean);

  return parts.join(', ') || 'Address not available';
}

function getOccupancy(property) {
  const units = getUnits(property);
  if (!units.length) {
    const isOccupied = read(property, 'isOccupied', 'IsOccupied');
    return isOccupied === true ? { occupied: 1, vacant: 0 } : isOccupied === false ? { occupied: 0, vacant: 1 } : null;
  }

  const occupied = units.filter((unit) => {
    const status = String(read(unit, 'status', 'Status') || '').toLowerCase();
    return ['occupied', 'overdue'].includes(status) || read(unit, 'isOccupied', 'IsOccupied') === true;
  }).length;

  return { occupied, vacant: Math.max(units.length - occupied, 0) };
}

function PropertyImage({ property }) {
  const [source, setSource] = useState(() => getImageUrl(property));

  return (
    <Box
      component="img"
      src={source}
      alt=""
      onError={() => setSource(placeholderImage)}
      sx={{
        width: 68,
        height: 52,
        flexShrink: 0,
        borderRadius: 1.25,
        objectFit: 'cover',
        bgcolor: 'action.hover'
      }}
    />
  );
}

PropertyImage.propTypes = { property: PropTypes.object.isRequired };

function OccupancyChips({ property }) {
  const occupancy = getOccupancy(property);
  if (!occupancy) return null;

  const total = occupancy.occupied + occupancy.vacant;
  const isMixed = occupancy.occupied > 0 && occupancy.vacant > 0;

  return (
    <Stack direction="row" spacing={0.75} useFlexGap flexWrap="wrap" justifyContent="flex-start">
      {occupancy.occupied > 0 && (
        <Chip
          label={isMixed ? `${occupancy.occupied} occupied` : 'Occupied'}
          size="small"
          sx={(theme) => ({
            height: 24,
            fontWeight: 700,
            fontSize: '0.7rem',
            color: theme.palette.success.dark,
            bgcolor: alpha(theme.palette.success.main, 0.12),
            border: `1px solid ${alpha(theme.palette.success.main, 0.18)}`
          })}
        />
      )}
      {occupancy.vacant > 0 && (
        <Chip
          label={isMixed ? `${occupancy.vacant} vacant` : 'Vacant'}
          size="small"
          sx={(theme) => ({
            height: 24,
            fontWeight: 700,
            fontSize: '0.7rem',
            color: theme.palette.warning.dark,
            bgcolor: alpha(theme.palette.warning.main, 0.14),
            border: `1px solid ${alpha(theme.palette.warning.main, 0.2)}`
          })}
        />
      )}
      {total === 0 && null}
    </Stack>
  );
}

OccupancyChips.propTypes = { property: PropTypes.object.isRequired };

export default function RecentlyViewedProperties({ properties = [], isLoading = false, hasError = false }) {
  const navigate = useNavigate();
  const theme = useTheme();

  return (
    <MainCard
      title={
        <Typography variant="h5" fontWeight={700} sx={{ color: 'text.primary', whiteSpace: 'nowrap' }}>
          Recently viewed
        </Typography>
      }
      content={false}
      boxShadow
      sx={{ overflow: 'hidden' }}
    >
      {isLoading && !properties.length ? (
        <Stack divider={<Box sx={{ borderTop: `1px solid ${alpha(theme.palette.divider, 0.12)}` }} />}>
          {[0, 1].map((item) => (
            <Stack key={item} direction="row" spacing={1.25} alignItems="center" sx={{ px: 2, py: 1.5 }}>
              <Skeleton variant="rounded" width={68} height={52} />
              <Box sx={{ flex: 1 }}>
                <Skeleton width="44%" />
                <Skeleton width="68%" />
                <Skeleton variant="rounded" width={56} height={20} sx={{ mt: 0.5 }} />
              </Box>
            </Stack>
          ))}
        </Stack>
      ) : properties.length ? (
        <Stack>
          {properties.map((property, index) => {
            const propertyId = getId(property);
            const propertyName = read(property, 'name', 'Name') || read(property, 'streetAddress', 'StreetAddress') || 'Property';

            return (
              <Box
                key={propertyId}
                component="button"
                type="button"
                onClick={() => navigate(`/landlord/property/${propertyId}`)}
                sx={{
                  width: '100%',
                  px: 2,
                  py: 1.45,
                  display: 'flex',
                  alignItems: 'center',
                  gap: 1.25,
                  border: 0,
                  borderBottom: index < properties.length - 1 ? `1px solid ${alpha(theme.palette.divider, 0.14)}` : 0,
                  bgcolor: 'transparent',
                  color: 'inherit',
                  font: 'inherit',
                  textAlign: 'left',
                  cursor: 'pointer',
                  transition: 'background-color 150ms ease',
                  '&:hover': { bgcolor: alpha(theme.palette.primary.main, 0.035) },
                  '&:focus-visible': {
                    outline: `2px solid ${alpha(theme.palette.primary.main, 0.5)}`,
                    outlineOffset: -2
                  }
                }}
              >
                <PropertyImage property={property} />
                <Box sx={{ minWidth: 0, flex: 1 }}>
                  <Typography variant="subtitle2" fontWeight={800} noWrap color="text.primary">
                    {propertyName}
                  </Typography>
                  <Typography variant="body2" color="text.secondary" noWrap sx={{ mt: 0.35 }}>
                    {getAddress(property)}
                  </Typography>
                  <Box sx={{ mt: 0.8 }}>
                    <OccupancyChips property={property} />
                  </Box>
                </Box>
              </Box>
            );
          })}
        </Stack>
      ) : (
        <Stack alignItems="center" textAlign="center" spacing={0.75} sx={{ px: 2.5, py: 4.5 }}>
          <Box
            sx={{
              width: 38,
              height: 38,
              display: 'grid',
              placeItems: 'center',
              borderRadius: 1.5,
              color: 'text.secondary',
              bgcolor: alpha(theme.palette.primary.main, 0.07)
            }}
          >
            <HomeOutlined />
          </Box>
          <Typography variant="subtitle2" fontWeight={700}>
            {hasError ? 'Recent properties are unavailable' : 'No recently viewed properties'}
          </Typography>
          <Typography variant="body2" color="text.secondary">
            {hasError ? 'Open your properties to keep working.' : 'Properties you open will appear here.'}
          </Typography>
        </Stack>
      )}
    </MainCard>
  );
}

RecentlyViewedProperties.propTypes = {
  properties: PropTypes.array,
  isLoading: PropTypes.bool,
  hasError: PropTypes.bool
};
