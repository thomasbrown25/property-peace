import { Grid, Box, Stack, Typography, Card, CardContent, useTheme, alpha, IconButton, Button, CircularProgress } from '@mui/material';
import { HomeOutlined, EnvironmentOutlined, UploadOutlined, PlusOutlined } from '@ant-design/icons';
import MainCard from 'components/MainCard';
import PropertyMap from 'components/maps/PropertyMap';
import { useState, useRef } from 'react';
import { propertyAccentCardSx } from './propertyAccentSx';

const ImageGallery = ({ images, propertyName, propertyId, onImageUpload, uploading }) => {
  const [selectedIndex, setSelectedIndex] = useState(0);
  const theme = useTheme();
  const fileInputRef = useRef(null);

  const handleFileSelect = (event) => {
    const files = Array.from(event.target.files);
    if (files.length > 0 && onImageUpload) {
      onImageUpload(files);
    }
    // Reset input so same file can be selected again
    event.target.value = '';
  };

  const handleClick = () => {
    if (fileInputRef.current) {
      fileInputRef.current.click();
    }
  };

  if (!images || images.length === 0) {
    return (
      <Box
        onClick={handleClick}
        sx={{
          width: '100%',
          height: '100%',
          minHeight: 400,
          borderRadius: 2,
          bgcolor: alpha(theme.palette.primary.main, 0.05),
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          flexDirection: 'column',
          gap: 2,
          border: `2px dashed ${alpha(theme.palette.primary.main, 0.3)}`,
          cursor: 'pointer',
          transition: 'all 0.3s ease',
          position: 'relative',
          overflow: 'hidden',
          '&:hover': {
            bgcolor: alpha(theme.palette.primary.main, 0.1),
            borderColor: theme.palette.primary.main,
            transform: 'scale(1.02)',
            '& .upload-overlay': {
              opacity: 1
            }
          }
        }}
      >
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          multiple
          style={{ display: 'none' }}
          onChange={handleFileSelect}
        />
        {uploading ? (
          <>
            <CircularProgress size={48} />
            <Typography variant="body2" color="text.secondary">
              Uploading images...
            </Typography>
          </>
        ) : (
          <>
            {/* Placeholder House Image */}
            <Box
              component="img"
              src="/src/assets/images/placeholder-house.png"
              alt="House placeholder"
              onError={(e) => {
                // Fallback if image doesn't exist
                e.target.style.display = 'none';
              }}
              sx={{
                width: '60%',
                maxWidth: 300,
                height: 'auto',
                opacity: 0.3,
                objectFit: 'contain'
              }}
            />
            {/* Upload Icon Overlay */}
            <Box
              className="upload-overlay"
              sx={{
                position: 'absolute',
                top: '50%',
                left: '50%',
                transform: 'translate(-50%, -50%)',
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                gap: 1,
                opacity: 0.7,
                transition: 'opacity 0.3s ease',
                pointerEvents: 'none'
              }}
            >
              <Box
                sx={{
                  width: 64,
                  height: 64,
                  borderRadius: '50%',
                  bgcolor: alpha(theme.palette.primary.main, 0.2),
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  border: `2px solid ${theme.palette.primary.main}`
                }}
              >
                <UploadOutlined style={{ fontSize: 32, color: theme.palette.primary.main }} />
              </Box>
            </Box>
            <Typography variant="body1" color="primary" fontWeight={600} sx={{ mt: 2 }}>
              Click to upload property images
            </Typography>
            <Typography variant="body2" color="text.secondary">
              Select one or more images
            </Typography>
          </>
        )}
      </Box>
    );
  }

  return (
    <Box sx={{ position: 'relative', width: '100%', height: '100%', minHeight: 400 }}>
      {/* Main Image */}
      <Box
        sx={{
          width: '100%',
          height: '100%',
          minHeight: 400,
          borderRadius: 2,
          overflow: 'hidden',
          position: 'relative',
          boxShadow: `0 8px 32px ${alpha(theme.palette.common.black, 0.2)}`
        }}
      >
        <Box
          component="img"
          src={images[selectedIndex]?.blobUrl}
          alt={propertyName || 'Property Image'}
          sx={{
            width: '100%',
            height: '100%',
            objectFit: 'cover',
            transition: 'transform 0.5s ease',
            '&:hover': {
              transform: 'scale(1.05)'
            }
          }}
        />
        {/* Gradient Overlay */}
        <Box
          sx={{
            position: 'absolute',
            bottom: 0,
            left: 0,
            right: 0,
            height: '30%',
            background: 'linear-gradient(to top, rgba(0,0,0,0.6), transparent)',
            pointerEvents: 'none'
          }}
        />
        {/* Image Counter */}
        {images.length > 1 && (
          <Box
            sx={{
              position: 'absolute',
              bottom: 16,
              right: 16,
              px: 2,
              py: 1,
              borderRadius: 2,
              bgcolor: alpha(theme.palette.common.black, 0.6),
              backdropFilter: 'blur(10px)'
            }}
          >
            <Typography variant="body2" color="white" fontWeight={500}>
              {selectedIndex + 1} / {images.length}
            </Typography>
          </Box>
        )}
      </Box>

      {/* Thumbnail Strip */}
      {images.length > 1 && (
        <Stack
          direction="row"
          spacing={1}
          sx={{
            mt: 2,
            overflowX: 'auto',
            pb: 1,
            '&::-webkit-scrollbar': {
              height: 6
            },
            '&::-webkit-scrollbar-thumb': {
              bgcolor: alpha(theme.palette.divider, 0.5),
              borderRadius: 3
            }
          }}
        >
          {images.map((image, index) => (
            <Box
              key={index}
              onClick={() => setSelectedIndex(index)}
              sx={{
                width: 80,
                height: 80,
                borderRadius: 1,
                overflow: 'hidden',
                cursor: 'pointer',
                border: `2px solid ${selectedIndex === index ? theme.palette.primary.main : 'transparent'}`,
                opacity: selectedIndex === index ? 1 : 0.7,
                transition: 'all 0.2s ease',
                flexShrink: 0,
                '&:hover': {
                  opacity: 1,
                  transform: 'scale(1.05)'
                }
              }}
            >
              <Box
                component="img"
                src={image.blobUrl}
                alt={`Thumbnail ${index + 1}`}
                sx={{
                  width: '100%',
                  height: '100%',
                  objectFit: 'cover'
                }}
              />
            </Box>
          ))}
        </Stack>
      )}
    </Box>
  );
};

export default function PropertyHero({ property, onImageUpload, uploading }) {
  const theme = useTheme();

  return (
    <Grid container spacing={3} sx={{ mb: 3 }}>
      {/* Property Image and Details Section - Now on the left */}
      <Grid size={{ xs: 12, md: 4 }}>
        <MainCard
          sx={propertyAccentCardSx(theme.palette.primary.main, {
            height: '100%',
            minHeight: { xs: 400, lg: 500 },
            bgcolor: (t) => alpha(t.palette.background.paper, 0.8),
            display: 'flex',
            flexDirection: 'column',
            borderRadius: 2
          })}
        >
          <Stack spacing={3} sx={{ height: '100%' }}>
            {/* Property Image */}
            <Box sx={{ flex: 1, minHeight: 0 }}>
              <ImageGallery 
                images={property?.images || []} 
                propertyName={property?.name}
                propertyId={property?.id}
                onImageUpload={onImageUpload}
                uploading={uploading}
              />
            </Box>

            {/* Property Details */}
            <Stack spacing={2}>
              {/* Address */}
              {property?.streetAddress && (
                <Stack direction="row" spacing={1.5} alignItems="flex-start">
                  <EnvironmentOutlined
                    style={{
                      fontSize: 20,
                      color: theme.palette.primary.main,
                      marginTop: 2,
                      flexShrink: 0
                    }}
                  />
                  <Typography variant="body1" color="text.primary" sx={{ flex: 1, lineHeight: 1.6 }}>
                    {property.streetAddress}
                  </Typography>
                </Stack>
              )}

              {/* Description */}
              {property?.description && (
                <Box
                  sx={{
                    pt: 2,
                    borderTop: `1px solid ${alpha(theme.palette.divider, 0.5)}`
                  }}
                >
                  <Typography variant="body2" color="text.secondary" sx={{ lineHeight: 1.8 }}>
                    {property.description}
                  </Typography>
                </Box>
              )}
            </Stack>
          </Stack>
        </MainCard>
      </Grid>

      {/* Map Section - Now on the right - Hidden on sm and lower */}
      <Grid size={{ xs: 0, sm: 0, md: 8 }} sx={{ display: { xs: 'none', sm: 'none', md: 'block' } }}>
        <MainCard
          sx={propertyAccentCardSx(theme.palette.info.main, {
            height: '100%',
            minHeight: { xs: 400, lg: 500 },
            bgcolor: (t) => alpha(t.palette.background.paper, 0.8),
            p: 0,
            overflow: 'hidden',
            position: 'relative',
            borderRadius: 2
          })}
        >
          {property?.streetAddress ? (
            <PropertyMap address={property.streetAddress} propertyName={property.name} />
          ) : (
            <Box
              sx={{
                width: '100%',
                height: '100%',
                minHeight: 400,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                bgcolor: alpha(theme.palette.primary.main, 0.05),
                flexDirection: 'column',
                gap: 2
              }}
            >
              <EnvironmentOutlined style={{ fontSize: 64, color: alpha(theme.palette.text.secondary, 0.3) }} />
              <Typography variant="body2" color="text.secondary">
                No address available to display map
              </Typography>
            </Box>
          )}
        </MainCard>
      </Grid>
    </Grid>
  );
}

