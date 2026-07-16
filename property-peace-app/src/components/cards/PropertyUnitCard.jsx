import PropTypes from 'prop-types';
import { useMemo } from 'react';
import {
  Box,
  Typography,
  Stack,
  Button,
  Chip,
  Divider,
  Card,
  CardContent,
  alpha,
  useTheme
} from '@mui/material';
import {
  HomeOutlined,
  EnvironmentOutlined,
  EyeOutlined
} from '@ant-design/icons';
import { useNavigate } from 'react-router-dom';
import { useDispatch } from 'react-redux';
import { getPropertyTypeLabel, formatCurrency } from 'utils/formatters';
import { setProperty } from 'store/property/property.action';
import placeholderImage from 'assets/images/placeholder-house.png';

export default function PropertyUnitCard({ property }) {
  const navigate = useNavigate();
  const dispatch = useDispatch();
  const theme = useTheme();

  const {
    id,
    name,
    streetAddress,
    city,
    state,
    zipCode,
    propertyType,
    units = [],
    images = [],
    mainImageUrl
  } = property ?? {};

  const isMultiUnit = propertyType === 'multiUnit';

  // Format full address
  const fullAddress = useMemo(() => {
    if (!streetAddress) return 'No address set';
    
    let streetOnly = streetAddress;
    if (streetAddress.includes(',')) {
      const parts = streetAddress.split(',');
      streetOnly = parts[0].trim();
    } else {
      const zipCodePattern = /\s+\d{5}(-\d{4})?$/;
      if (zipCodePattern.test(streetAddress)) {
        streetOnly = streetAddress.replace(zipCodePattern, '').trim();
      }
    }
    
    const parts = [streetOnly];
    if (city) parts.push(city);
    if (state) {
      if (zipCode) {
        parts.push(`${state}, ${zipCode}`);
      } else {
        parts.push(state);
      }
    } else if (zipCode) {
      parts.push(zipCode);
    }
    parts.push('US');
    return parts.join(', ');
  }, [streetAddress, city, state, zipCode]);

  // Get property image
  const propertyImageUrl = useMemo(() => {
    if (images && images.length > 0 && images[0].blobUrl) {
      return images[0].blobUrl;
    }
    if (mainImageUrl) {
      return mainImageUrl;
    }
    return placeholderImage;
  }, [images, mainImageUrl]);

  // For single-unit properties, get the first unit (the property itself)
  const singleUnit = !isMultiUnit && units.length > 0 ? units[0] : null;

  // Get market rent for single unit
  const marketRent = useMemo(() => {
    if (singleUnit?.lease?.rentAmount) {
      return singleUnit.lease.rentAmount;
    }
    return 0;
  }, [singleUnit]);

  // Check if single unit is occupied
  const isOccupied = singleUnit?.isOccupied || false;

  const handleViewProperty = () => {
    dispatch(setProperty(property));
    navigate(`/landlord/property/${id}`);
  };

  const handleViewUnit = (unit) => {
    dispatch(setProperty(property));
    navigate(`/landlord/unit/${unit.id}`);
  };

  const handleListProperty = () => {
    // TODO: Implement list property action
    console.log('List property', id);
  };

  const handleMoveIn = (unit) => {
    // Navigate to lease selection page (same as Create Lease button)
    navigate('/landlord/leases/selection');
  };

  const handleListUnit = (unit) => {
    // TODO: Implement list unit action
    console.log('List unit', unit.id);
  };

  return (
    <Card
      variant="outlined"
      sx={{
        bgcolor: (t) => alpha(t.palette.background.paper, 0.8),
        borderRadius: 2,
        overflow: 'hidden',
        border: `1px solid ${alpha(theme.palette.divider, 0.1)}`,
        boxShadow: (t) => `0 0 20px ${alpha(t.palette.primary.main, 0.15)}`
      }}
    >
      <CardContent sx={{ p: 3 }}>
        {/* Property Header */}
        <Stack direction="row" spacing={2} sx={{ mb: 3 }}>
          {/* Property Image */}
          <Box
            sx={{
              width: 64,
              height: 64,
              borderRadius: 1,
              overflow: 'hidden',
              flexShrink: 0,
              bgcolor: alpha(theme.palette.primary.main, 0.05),
              border: `1px solid ${alpha(theme.palette.divider, 0.1)}`
            }}
          >
            <Box
              component="img"
              src={propertyImageUrl}
              alt={name}
              sx={{
                width: '100%',
                height: '100%',
                objectFit: 'cover'
              }}
            />
          </Box>

          {/* Property Name and Address */}
          <Stack spacing={0.5} sx={{ flex: 1, minWidth: 0 }}>
            <Stack direction="row" spacing={1} alignItems="center">
              <Typography variant="h6" fontWeight={600}>
                {name || 'Untitled property'}
              </Typography>
              {/* Status badge for single-unit */}
              {!isMultiUnit && (
                <Chip
                  label={isOccupied ? 'Occupied' : 'Vacant'}
                  size="small"
                  sx={{
                    bgcolor: isOccupied ? alpha(theme.palette.success.main, 0.1) : alpha(theme.palette.warning.main, 0.1),
                    color: isOccupied ? theme.palette.success.main : theme.palette.warning.main,
                    fontWeight: 500,
                    height: 24
                  }}
                />
              )}
            </Stack>
            <Stack direction="row" spacing={0.5} alignItems="center">
              <EnvironmentOutlined style={{ fontSize: 14, color: theme.palette.text.secondary }} />
              <Typography variant="body2" color="text.secondary">
                {fullAddress}
              </Typography>
            </Stack>
          </Stack>
        </Stack>

        {/* Single-Unit Property Display */}
        {!isMultiUnit && singleUnit && (
          <>
            <Divider sx={{ mb: 0 }} />
            <Box sx={{ position: 'relative', pl: 3 }}>
              {/* Vertical Timeline Line */}
              <Box
                sx={{
                  position: 'absolute',
                  left: 36,
                  top: 0,
                  bottom: 0,
                  width: 2,
                  bgcolor: 'divider',
                  zIndex: 0
                }}
              />
            
            <Box sx={{ position: 'relative', pt: 3, pb: 0 }}>
              <Stack direction="row" spacing={2} alignItems="center">
                {/* Timeline node */}
                <Box
                  sx={{
                    width: 24,
                    height: 24,
                    borderRadius: '50%',
                    border: `2px solid ${theme.palette.divider}`,
                    bgcolor: 'background.paper',
                    flexShrink: 0,
                    position: 'relative',
                    zIndex: 1
                  }}
                />

                {/* Unit Content */}
                <Stack spacing={2} sx={{ flex: 1, minWidth: 0 }}>
                  <Stack direction="row" spacing={2} alignItems="flex-start">
                    {/* Unit Details */}
                    <Stack spacing={1} sx={{ flex: 1, minWidth: 0 }}>
                      <Typography variant="body2" color="text.secondary" fontWeight={600}>
                        {getPropertyTypeLabel(propertyType).toUpperCase()}
                      </Typography>
                      <Stack direction="row" spacing={2} alignItems="center" flexWrap="wrap">
                        <Typography variant="body2" color="text.secondary">
                          {singleUnit.bedrooms || '-'} BEDS
                        </Typography>
                        <Typography variant="body2" color="text.secondary">
                          {singleUnit.baths || '-'} BATHS
                        </Typography>
                        <Typography variant="body2" color="text.secondary">
                          {singleUnit.squareFeet ? `${singleUnit.squareFeet.toLocaleString()} SQ.FT` : '— SQ.FT'}
                        </Typography>
                      </Stack>
                      <Stack direction="row" spacing={1} alignItems="center" flexWrap="wrap">
                        {!isOccupied && (
                          <Button
                            variant="contained"
                            color="primary"
                            size="small"
                            onClick={handleMoveIn}
                            sx={{
                              textTransform: 'none'
                            }}
                          >
                            Add Lease
                          </Button>
                        )}
                        <Typography variant="body2" color="text.secondary">
                          {formatCurrency(marketRent)} Rent due
                        </Typography>
                      </Stack>
                    </Stack>
                  </Stack>
                </Stack>
              </Stack>
            </Box>
          </Box>
          </>
        )}

        {/* Multi-Unit Property Display */}
        {isMultiUnit && units.length > 0 && (
          <>
            <Divider sx={{ mb: 0 }} />
            <Box sx={{ position: 'relative', pl: 3 }}>
              {/* Vertical Timeline Line */}
              {units.length > 1 && (
                <Box
                  sx={{
                    position: 'absolute',
                    left: 36,
                    top: 0,
                    bottom: 0,
                    width: 2,
                    bgcolor: 'divider',
                    zIndex: 0
                  }}
                />
              )}

            <Stack spacing={0}>
              {units.map((unit, index) => {
                const unitRent = unit?.lease?.rentAmount || 0;
                const unitIsOccupied = unit?.isOccupied || false;

                return (
                  <Box key={unit.id}>
                    {index > 0 && (
                      <Box sx={{ pl: 7, my: 3 }}>
                        <Divider />
                      </Box>
                    )}
                    <Box sx={{ position: 'relative', pt: index === 0 ? 3 : 0, pb: 0 }}>
                      <Stack direction="row" spacing={2} alignItems="center">
                        {/* Timeline node */}
                        <Box
                          sx={{
                            width: 24,
                            height: 24,
                            borderRadius: '50%',
                            border: `2px solid ${theme.palette.divider}`,
                            bgcolor: 'background.paper',
                            flexShrink: 0,
                            position: 'relative',
                            zIndex: 1
                          }}
                        />

                      {/* Unit Content */}
                      <Stack spacing={2} sx={{ flex: 1, minWidth: 0 }}>
                        <Stack direction="row" spacing={2} alignItems="flex-start">
                          {/* Unit Details */}
                          <Stack spacing={1} sx={{ flex: 1, minWidth: 0 }}>
                            <Stack direction="row" spacing={1} alignItems="center" flexWrap="wrap">
                              <Typography variant="subtitle1" fontWeight={600}>
                                {unit.name || `Unit ${unit.id}`}
                              </Typography>
                              <Chip
                                label={unitIsOccupied ? 'Occupied' : 'Vacant'}
                                size="small"
                                sx={{
                                  bgcolor: unitIsOccupied 
                                    ? alpha(theme.palette.success.main, 0.1) 
                                    : alpha(theme.palette.warning.main, 0.1),
                                  color: unitIsOccupied 
                                    ? theme.palette.success.main 
                                    : theme.palette.warning.main,
                                  fontWeight: 500,
                                  height: 24
                                }}
                              />
                            </Stack>
                            <Typography variant="body2" color="text.secondary" fontWeight={600}>
                              APARTMENT
                            </Typography>
                            <Stack direction="row" spacing={2} alignItems="center" flexWrap="wrap">
                              <Typography variant="body2" color="text.secondary">
                                {unit.bedrooms || '-'} BEDS
                              </Typography>
                              <Typography variant="body2" color="text.secondary">
                                {unit.baths || '-'} BATHS
                              </Typography>
                              <Typography variant="body2" color="text.secondary">
                                {unit.squareFeet ? `${unit.squareFeet.toLocaleString()} SQ.FT` : '— SQ.FT'}
                              </Typography>
                            </Stack>
                            <Stack direction="row" spacing={1} alignItems="center" flexWrap="wrap">
                              {!unitIsOccupied && (
                                <Button
                                  variant="contained"
                                  color="primary"
                                  size="small"
                                  onClick={() => handleMoveIn(unit)}
                                  sx={{
                                    textTransform: 'none'
                                  }}
                                >
                                  Add Lease
                                </Button>
                              )}
                              <Typography variant="body2" color="text.secondary">
                                {formatCurrency(unitRent)} Rent Due
                              </Typography>
                            </Stack>
                          </Stack>

                          {/* View Unit Button */}
                          <Button
                            size="small"
                            variant="text"
                            startIcon={<EyeOutlined style={{ fontSize: 16 }} />}
                            onClick={() => handleViewUnit(unit)}
                            sx={{
                              color: 'primary.main',
                              textTransform: 'none',
                              flexShrink: 0,
                              '&:hover': {
                                bgcolor: alpha(theme.palette.primary.main, 0.08)
                              }
                            }}
                          >
                            View unit
                          </Button>
                        </Stack>
                      </Stack>
                    </Stack>
                    </Box>
                  </Box>
                );
              })}
            </Stack>
          </Box>
          </>
        )}

      </CardContent>
    </Card>
  );
}

PropertyUnitCard.propTypes = {
  property: PropTypes.shape({
    id: PropTypes.number,
    name: PropTypes.string,
    streetAddress: PropTypes.string,
    city: PropTypes.string,
    state: PropTypes.string,
    zipCode: PropTypes.string,
    propertyType: PropTypes.string,
    units: PropTypes.array,
    images: PropTypes.array,
    mainImageUrl: PropTypes.string
  }).isRequired
};
